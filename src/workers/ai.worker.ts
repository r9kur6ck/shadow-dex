import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { db } from '../db/db';

// Skip local model check since we are using browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;

// Fix for Cloudflare and other environments lacking SharedArrayBuffer
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false; // Disable proxy to ensure it doesn't try to spawn threads

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
                const textToEmbed = `title: ${entry.title} tags: ${entry.tags.join(',')} content: ${entry.content}`;
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
            const queryVec = await getEmbedding(`query: ${data.query}`);
            const entries = await db.entries.toArray();

            const scored = entries
                .filter((e) => e.embedding && e.embedding.length > 0)
                .map((e) => ({
                    id: e.id,
                    title: e.title,
                    score: cosineSimilarity(queryVec, e.embedding!),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, data.limit || 10);

            self.postMessage({ type: 'SEARCH_RESULT', results: scored });
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
