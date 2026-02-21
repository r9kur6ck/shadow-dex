import React from 'react';
import styles from './Sidebar.module.css';
import { Book, Plus, Monitor, Smartphone, X, Settings, HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import DynamicIcon from './DynamicIcon';

interface SidebarProps {
    categoryFilter: string | null;
    onSelectCategory: (cat: string | null) => void;
    onNewEntry: () => void;
    onOpenSync: () => void;
    onOpenSettings: () => void;
    onOpenHelp: () => void;
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ categoryFilter, onSelectCategory, onNewEntry, onOpenSync, onOpenSettings, onOpenHelp, isOpen, onClose }) => {
    const categories = useLiveQuery(() => db.categories.toArray()) || [];

    return (
        <aside className={clsx(styles.sidebar, isOpen && styles.open)}>
            <div className={styles.header}>
                <div className={styles.userSection}>
                    <div className={styles.avatar}>S</div>
                    <span className={styles.title}>Shadow Dex</span>
                </div>
                {onClose && (
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close Menu">
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className={styles.navSection}>
                <div
                    className={clsx(styles.navItem, categoryFilter === null && styles.active)}
                    onClick={() => onSelectCategory(null)}
                >
                    <Book size={18} className={styles.icon} />
                    <span>すべてのエントリ</span>
                </div>

                <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>カテゴリ</span>
                    <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="カテゴリ管理">
                        <Settings size={12} />
                    </button>
                </div>

                {categories.map(cat => (
                    <div
                        key={cat.id}
                        className={clsx(styles.navItem, categoryFilter === cat.name && styles.active)}
                        onClick={() => onSelectCategory(cat.name)}
                    >
                        <DynamicIcon name={cat.icon} size={18} className={styles.icon} />
                        <span>{cat.name}</span>
                    </div>
                ))}
            </div>

            <div className={styles.footer}>
                <button className={styles.syncBtn} onClick={onOpenHelp}>
                    <HelpCircle size={18} className={styles.icon} />
                    <span>使い方 / ヘルプ</span>
                </button>
                <button className={styles.syncBtn} onClick={onOpenSettings}>
                    <Settings size={18} className={styles.icon} />
                    <span>設定 / バックアップ</span>
                </button>
                <button className={styles.syncBtn} onClick={onOpenSync}>
                    <Monitor size={18} className={styles.icon} />
                    <Smartphone size={16} className={styles.icon} style={{ marginRight: 6 }} />
                    <span>デバイス同期</span>
                </button>
                <button className={styles.newBtn} onClick={onNewEntry}>
                    <Plus size={18} />
                    <span>新規作成</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
