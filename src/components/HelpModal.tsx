import React from 'react';
import styles from './HelpModal.module.css';
import { X, Book, Shield, Smartphone, Zap, Settings, RefreshCw } from 'lucide-react';

interface HelpModalProps {
    onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <Book size={20} className={styles.titleIcon} />
                        <h2>Shadow Dex の使い方</h2>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close Help">
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.content}>
                    <section className={styles.section}>
                        <h3>🌟 主な特徴</h3>
                        <ul className={styles.featureList}>
                            <li>
                                <Shield size={16} className={styles.featureIcon} />
                                <div>
                                    <strong>完全ローカル・セキュア設計</strong>
                                    <p>データはすべてブラウザ内に保存されます。外部サーバーには一切送信されないため安心です。</p>
                                </div>
                            </li>
                            <li>
                                <Zap size={16} className={styles.featureIcon} />
                                <div>
                                    <strong>爆速のリアルタイム検索</strong>
                                    <p>タイトル、詳細メモ、カテゴリ、タグから部分一致で瞬間的に検索可能です。</p>
                                </div>
                            </li>
                            <li>
                                <Smartphone size={16} className={styles.featureIcon} />
                                <div>
                                    <strong>PWA (アプリとしてインストール)</strong>
                                    <p>スマホやPCの「ホーム画面に追加」から独立したアプリとして利用できます。</p>
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h3>📖 使い方ガイド</h3>
                        <div className={styles.guideItem}>
                            <h4>1. 新規作成</h4>
                            <p>左下の「＋ 新規作成」ボタンから、エントリを追加します。カテゴリやタグを設定して整理しましょう。</p>
                        </div>
                        <div className={styles.guideItem}>
                            <h4>2. 検索</h4>
                            <p>上部の検索バーにキーワードを入力すると、リアルタイムで一覧が絞り込まれます。</p>
                        </div>
                        <div className={styles.guideItem}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Settings size={16} />
                                3. 設定 / バックアップ
                            </h4>
                            <p>カテゴリの追加・編集やアイコンの変更が行えます。また、AES暗号化ファイルとしてローカルに安全なバックアップを作成できます。</p>
                        </div>
                        <div className={styles.guideItem}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <RefreshCw size={16} />
                                4. P2Pデバイス同期
                            </h4>
                            <p>PCとスマホ間でQRコードを読み取ることで、サーバーを経由せずに直接データを同期・マージできます。</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
