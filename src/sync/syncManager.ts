import { Peer, type DataConnection } from 'peerjs';
import { db, type Entry } from '../db/db';

export type SyncState = 'idle' | 'generating' | 'waiting' | 'connecting' | 'syncing' | 'success' | 'error';

export interface SyncPayload {
    type: 'SYNC_DATA';
    entries: Entry[];
}

export class SyncManager {
    private peer: Peer | null = null;
    private conn: DataConnection | null = null;
    private onStateChange: (state: SyncState, message?: string) => void;

    constructor(onStateChange: (state: SyncState, message?: string) => void) {
        this.onStateChange = onStateChange;
    }

    // ホスト（PC側）開始：QRコード用IDを生成して待機
    public async startHosting(): Promise<string> {
        this.onStateChange('generating');
        return new Promise((resolve, reject) => {
            // ランダムIDを生成するか、無指定でPeerに作らせる
            const newPeerId = 'shadow-dex-' + Math.random().toString(36).substring(2, 10);
            this.peer = new Peer(newPeerId);

            this.peer.on('open', (id) => {
                this.onStateChange('waiting');
                resolve(id);
            });

            this.peer.on('connection', (connection) => {
                this.conn = connection;
                this.setupConnection();
            });

            this.peer.on('error', (err) => {
                console.error('PeerHost error:', err);
                this.onStateChange('error', err.message);
                reject(err);
            });
        });
    }

    // ゲスト（スマホ側）開始：スキャンしたIDに接続
    public connectToHost(hostId: string) {
        this.onStateChange('connecting');
        this.peer = new Peer();

        this.peer.on('open', () => {
            this.conn = this.peer!.connect(hostId);
            this.setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('PeerGuest error:', err);
            this.onStateChange('error', err.message);
        });
    }

    // 接続が確立した後の共通セットアップ（データ送受信処理）
    private setupConnection() {
        if (!this.conn) return;

        this.conn.on('open', async () => {
            this.onStateChange('syncing');

            // 自分のローカルデータを全件取得して相手に送信
            const localEntries = await db.entries.toArray();
            const payload: SyncPayload = {
                type: 'SYNC_DATA',
                entries: localEntries,
            };
            this.conn!.send(payload);
        });

        this.conn.on('data', async (data: unknown) => {
            const payload = data as SyncPayload;
            if (payload && payload.type === 'SYNC_DATA') {
                await this.mergeData(payload.entries);
                this.onStateChange('success');

                // 少し待ってから切断（双方向で成功メッセージを出すため）
                setTimeout(() => this.disconnect(), 1500);
            }
        });

        this.conn.on('close', () => {
            console.log('Connection closed');
        });

        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.onStateChange('error', err.message);
        });
    }

    // データのマージロジック (Last-Write-Wins)
    private async mergeData(remoteEntries: Entry[]) {
        await db.transaction('rw', db.entries, async () => {
            for (const remote of remoteEntries) {
                const local = await db.entries.get(remote.id);
                if (!local) {
                    // ローカルに存在しない場合は追加
                    await db.entries.add(remote);
                } else if (remote.updatedAt > local.updatedAt) {
                    // コンフリクト: リモートの方が新しい場合は上書き
                    await db.entries.put(remote);
                }
            }
        });
    }

    public disconnect() {
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        // Success状態などはUI側でクリアしてもらう
    }
}
