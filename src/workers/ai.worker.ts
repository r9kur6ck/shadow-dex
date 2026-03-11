import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { db } from '../db/db';

// Import WASM files explicitly as raw URLs so Vite copies them to the dist/assets folder
import wasmUrl from 'onnxruntime-web/dist/ort-wasm.wasm?url';
import wasmThreadedUrl from 'onnxruntime-web/dist/ort-wasm-threaded.wasm?url';
import wasmSimdUrl from 'onnxruntime-web/dist/ort-wasm-simd.wasm?url';
import wasmSimdThreadedUrl from 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';

// Force using the hf-proxy to bypass HuggingFace CORS on Cloudflare
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.remoteHost = ''; // Relative to the current origin
env.remotePathTemplate = '/hf-proxy/{model}/resolve/{revision}/';
env.useBrowserCache = true;

// Fix for Cloudflare and other environments lacking SharedArrayBuffer
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false; // Disable proxy to ensure it doesn't try to spawn threads

// Explicitly provide all WASM URLs to ONNX Runtime so it doesn't try to fetch from jsdelivr/CDN
env.backends.onnx.wasm.wasmPaths = {
    'ort-wasm.wasm': wasmUrl,
    'ort-wasm-threaded.wasm': wasmThreadedUrl,
    'ort-wasm-simd.wasm': wasmSimdUrl,
    'ort-wasm-simd-threaded.wasm': wasmSimdThreadedUrl
};

// Define message types
export type WorkerMessage =
    | { type: 'INIT' }
    | { type: 'GENERATE_MISSING' }
    | { type: 'SEMANTIC_SEARCH'; query: string; limit?: number }
    | { type: 'GET_RELATED'; targetId: string; limit?: number };

export type WorkerResponse =
    | { type: 'INIT_START' }
    | { type: 'INIT_PROGRESS'; progress: number; file: string; status: string }
    | { type: 'INIT_COMPLETE' }
    | { type: 'INIT_ERROR'; error: string }
    | { type: 'GENERATE_PROGRESS'; current: number; total: number }
    | { type: 'GENERATE_COMPLETE' }
    | { type: 'SEARCH_RESULT'; results: { id: string; title: string; score: number }[] }
    | { type: 'RELATED_RESULT'; targetId: string; results: { id: string; title: string; score: number }[] };

class PIPELINE_SINGLETON {
    static task = 'feature-extraction';
    static model = 'Xenova/multilingual-e5-small';
    static instance: Promise<FeatureExtractionPipeline> | null = null;

    static async getInstance(progress_callback?: (info: any) => void) {
        if (this.instance === null) {
            this.instance = pipeline(this.task as any, this.model, { progress_callback }) as Promise<FeatureExtractionPipeline>;
        }
        return this.instance;
    }
}

// Cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Keyword matching score for hybrid search
function keywordScore(query: string, title: string, tags: string[], content: string): number {
    const q = query.toLowerCase().trim();
    if (!q) return 0;

    const titleLower = title.toLowerCase();
    const tagsLower = tags.join(' ').toLowerCase();
    const contentLower = content.toLowerCase();

    let score = 0;

    // Title match (highest weight)
    if (titleLower.includes(q)) score += 0.6;
    // Tag match
    if (tagsLower.includes(q)) score += 0.25;
    // Content match
    if (contentLower.includes(q)) score += 0.15;

    // Also check individual words for multi-word queries
    const words = q.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 1) {
        let wordHits = 0;
        for (const word of words) {
            if (titleLower.includes(word) || tagsLower.includes(word) || contentLower.includes(word)) {
                wordHits++;
            }
        }
        const wordScore = (wordHits / words.length) * 0.5;
        score = Math.max(score, wordScore);
    }

    return Math.min(score, 1.0);
}

async function getEmbedding(text: string): Promise<number[]> {
    const extractor = await PIPELINE_SINGLETON.getInstance();
    // Provide input exactly as required by e5 models: "query: ..." or "passage: ..."
    // For simplicity, we just use the text.
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
    try {
        const { data } = event;

        if (data.type === 'INIT') {
            self.postMessage({ type: 'INIT_START' });
            await PIPELINE_SINGLETON.getInstance((progress) => {
                self.postMessage({
                    type: 'INIT_PROGRESS',
                    progress: progress.progress || 0,
                    file: progress.file || '',
                    status: progress.status
                });
            });
            self.postMessage({ type: 'INIT_COMPLETE' });
        }
        else if (data.type === 'GENERATE_MISSING') {
            const entries = await db.entries.toArray();
            const missing = entries.filter((e) => !e.embedding || e.embedding.length === 0);

            for (let i = 0; i < missing.length; i++) {
                const entry = missing[i];
                // e5 models require "passage: " prefix for documents
                const textToEmbed = `passage: ${entry.title} ${entry.tags.join(' ')} ${entry.content}`;
                const embedding = await getEmbedding(textToEmbed);

                await db.entries.update(entry.id, { embedding });

                self.postMessage({
                    type: 'GENERATE_PROGRESS',
                    current: i + 1,
                    total: missing.length,
                });
            }
            self.postMessage({ type: 'GENERATE_COMPLETE' });
        }
        else if (data.type === 'SEMANTIC_SEARCH') {
            // Skip AI search for very short queries (single chars like "あ")
            if (data.query.trim().length < 2) {
                self.postMessage({ type: 'SEARCH_RESULT', results: [] });
                return;
            }

            const queryVec = await getEmbedding(`query: ${data.query}`);
            const entries = await db.entries.toArray();

            // Hybrid search: combine vector similarity with keyword matching
            const VECTOR_WEIGHT = 0.7;
            const KEYWORD_WEIGHT = 0.3;

            const allScored = entries
                .filter((e) => e.embedding && e.embedding.length > 0)
                .map((e) => {
                    const vecScore = cosineSimilarity(queryVec, e.embedding!);
                    const kwScore = keywordScore(data.query, e.title, e.tags || [], e.content || '');
                    return {
                        id: e.id,
                        title: e.title,
                        score: vecScore * VECTOR_WEIGHT + kwScore * KEYWORD_WEIGHT,
                    };
                })
                .sort((a, b) => b.score - a.score);

            // Adaptive threshold: use the mean score as baseline noise floor
            // Only return results that are meaningfully above the average
            let results = allScored;
            if (allScored.length > 1) {
                const meanScore = allScored.reduce((sum, e) => sum + e.score, 0) / allScored.length;
                const threshold = Math.max(0.5, meanScore + 0.05);
                results = allScored.filter((e) => e.score >= threshold);
            } else if (allScored.length === 1 && allScored[0].score < 0.5) {
                results = [];
            }

            self.postMessage({ type: 'SEARCH_RESULT', results: results.slice(0, data.limit || 10) });
        }
        else if (data.type === 'GET_RELATED') {
            const target = await db.entries.get(data.targetId);
            if (!target || !target.embedding) {
                self.postMessage({ type: 'RELATED_RESULT', targetId: data.targetId, results: [] });
                return;
            }

            const entries = await db.entries.toArray();
            const scored = entries
                .filter((e) => e.id !== data.targetId && e.embedding && e.embedding.length > 0)
                .map((e) => ({
                    id: e.id,
                    title: e.title,
                    score: cosineSimilarity(target.embedding!, e.embedding!),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, data.limit || 5);

            self.postMessage({ type: 'RELATED_RESULT', targetId: data.targetId, results: scored });
        }
    } catch (err: any) {
        console.error('AI Worker error:', err);
        self.postMessage({ type: 'INIT_ERROR', error: err.message });
    }
});
