import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkerMessage, WorkerResponse } from '../workers/ai.worker';
import AiWorker from '../workers/ai.worker?worker';

export type AIStatus = 'idle' | 'downloading' | 'ready' | 'error';

export function useAI() {
    const [status, setStatus] = useState<AIStatus>('idle');
    const [progress, setProgress] = useState<{ file: string, progress: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);

    // Initialize worker
    useEffect(() => {
        if (!workerRef.current) {
            workerRef.current = new AiWorker();

            workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
                const data = e.data;
                switch (data.type) {
                    case 'INIT_START':
                        setStatus('downloading');
                        break;
                    case 'INIT_PROGRESS':
                        setStatus('downloading');
                        setProgress({ file: data.file, progress: data.progress });
                        break;
                    case 'INIT_COMPLETE':
                        setStatus('ready');
                        setProgress(null);
                        // Auto generate missing embeddings once ready
                        workerRef.current?.postMessage({ type: 'GENERATE_MISSING' } as WorkerMessage);
                        break;
                    case 'INIT_ERROR':
                        setStatus('error');
                        setError(data.error);
                        break;
                    case 'GENERATE_COMPLETE':
                        // Generation done
                        break;
                }
            };

            // Start init
            workerRef.current.postMessage({ type: 'INIT' } as WorkerMessage);
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    const searchSemantic = useCallback((query: string, limit = 10): Promise<any[]> => {
        return new Promise((resolve) => {
            if (!workerRef.current || status !== 'ready') {
                resolve([]);
                return;
            }

            const handler = (e: MessageEvent<WorkerResponse>) => {
                if (e.data.type === 'SEARCH_RESULT') {
                    workerRef.current?.removeEventListener('message', handler);
                    resolve(e.data.results);
                }
            };
            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage({ type: 'SEMANTIC_SEARCH', query, limit } as WorkerMessage);
        });
    }, [status]);

    const getRelated = useCallback((targetId: string, limit = 5): Promise<any[]> => {
        return new Promise((resolve) => {
            if (!workerRef.current || status !== 'ready') {
                resolve([]);
                return;
            }

            const handler = (e: MessageEvent<WorkerResponse>) => {
                if (e.data.type === 'RELATED_RESULT' && e.data.targetId === targetId) {
                    workerRef.current?.removeEventListener('message', handler);
                    resolve(e.data.results);
                }
            };
            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage({ type: 'GET_RELATED', targetId, limit } as WorkerMessage);
        });
    }, [status]);

    // Trigger generation manually if needed
    const triggerGeneration = useCallback(() => {
        if (workerRef.current && status === 'ready') {
            workerRef.current.postMessage({ type: 'GENERATE_MISSING' } as WorkerMessage);
        }
    }, [status]);

    return {
        status,
        progress,
        error,
        searchSemantic,
        getRelated,
        triggerGeneration
    };
}
