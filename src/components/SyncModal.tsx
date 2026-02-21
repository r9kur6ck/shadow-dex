import React, { useState, useEffect, useRef } from 'react';
import { X, Smartphone, Monitor, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import styles from './SyncModal.module.css';
import { SyncManager, type SyncState } from '../sync/syncManager';

interface SyncModalProps {
    onClose: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'host' | 'guest'>('host');
    const [syncState, setSyncState] = useState<SyncState>('idle');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [hostId, setHostId] = useState<string | null>(null);

    const syncManagerRef = useRef<SyncManager | null>(null);

    useEffect(() => {
        syncManagerRef.current = new SyncManager((state, msg) => {
            setSyncState(state);
            if (msg) setErrorMsg(msg);
        });

        return () => {
            if (syncManagerRef.current) {
                syncManagerRef.current.disconnect();
            }
        };
    }, []);

    const handleStartHost = async () => {
        if (!syncManagerRef.current) return;
        try {
            setErrorMsg('');
            const id = await syncManagerRef.current.startHosting();
            setHostId(id);
        } catch (e: unknown) {
            console.error(e);
            setSyncState('error');
            const errorMessage = e instanceof Error ? e.message : 'ホストの開始に失敗しました';
            setErrorMsg(errorMessage);
        }
    };

    const handleScanSuccess = (result: string) => {
        if (!syncManagerRef.current || syncState !== 'idle') return;
        if (result && result.startsWith('shadow-dex-')) {
            syncManagerRef.current.connectToHost(result);
        } else {
            setSyncState('error');
            setErrorMsg('無効なQRコードです');
        }
    };

    // 状態に応じたUIのレンダリング
    const renderStatus = () => {
        switch (syncState) {
            case 'generating':
                return <div className={styles.status}><Loader2 className={styles.spin} /> 接続IDを生成中...</div>;
            case 'waiting':
                return <div className={styles.status}>ピアからの接続を待っています...</div>;
            case 'connecting':
                return <div className={styles.status}><Loader2 className={styles.spin} /> ホストに接続中...</div>;
            case 'syncing':
                return <div className={styles.status}><Loader2 className={styles.spin} /> データを同期中...</div>;
            case 'success':
                return <div className={`${styles.status} ${styles.success}`}><CheckCircle /> 同期が完了しました！</div>;
            case 'error':
                return <div className={`${styles.status} ${styles.error}`}><AlertTriangle /> {errorMsg}</div>;
            default:
                return null;
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>デバイス同期 (P2P)</h2>
                    <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                </div>

                {syncState === 'idle' || syncState === 'error' ? (
                    <>
                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tab} ${activeTab === 'host' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('host')}
                            >
                                <Monitor size={18} />
                                PC側 (QRを表示)
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'guest' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('guest')}
                            >
                                <Smartphone size={18} />
                                スマホ側 (QRを読む)
                            </button>
                        </div>

                        <div className={styles.tabContent}>
                            {activeTab === 'host' && (
                                <div className={styles.hostView}>
                                    <p className={styles.instruction}>
                                        このデバイスのデータを他のデバイス（スマホなど）と同期します。<br />
                                        下のボタンを押して、QRコードを生成してください。
                                    </p>
                                    <button className={styles.primaryBtn} onClick={handleStartHost}>
                                        同期を開始する (QR表示)
                                    </button>
                                </div>
                            )}

                            {activeTab === 'guest' && (
                                <div className={styles.guestView}>
                                    <p className={styles.instruction}>
                                        PC画面に表示されたQRコードをスキャンしてください。<br />
                                        データは通信経路上で暗号化され、P2Pで直接同期されます。
                                    </p>
                                    <div className={styles.scannerWrapper}>
                                        <Scanner
                                            onScan={(result) => handleScanSuccess(result[0].rawValue)}
                                            components={{ finder: true }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        {renderStatus()}
                    </>
                ) : (
                    <div className={styles.activeSyncView}>
                        {syncState === 'waiting' && hostId && (
                            <div className={styles.qrContainer}>
                                <QRCodeSVG value={hostId} size={200} />
                                <p className={styles.qrHint}>スマホでこのQRコードをスキャンしてください</p>
                            </div>
                        )}
                        {renderStatus()}

                        {(String(syncState) === 'success' || String(syncState) === 'error') && (
                            <button className={styles.primaryBtn} onClick={onClose} style={{ marginTop: 24 }}>
                                閉じる
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncModal;
