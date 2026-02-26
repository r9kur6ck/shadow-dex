import React, { useState, useCallback } from 'react';
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
    const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray()) || [];

    // Drag & Drop state
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Make the drag image slightly transparent
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.5';
        }
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
        setDragIndex(null);
        setDragOverIndex(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverIndex(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === dropIndex) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }

        // Reorder the categories
        const reordered = [...categories];
        const [movedItem] = reordered.splice(dragIndex, 1);
        reordered.splice(dropIndex, 0, movedItem);

        // Update sortOrder in DB
        await db.transaction('rw', db.categories, async () => {
            for (let i = 0; i < reordered.length; i++) {
                await db.categories.update(reordered[i].id, { sortOrder: i });
            }
        });

        setDragIndex(null);
        setDragOverIndex(null);
    }, [dragIndex, categories]);

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

                {categories.map((cat, index) => (
                    <div
                        key={cat.id}
                        className={clsx(
                            styles.navItem,
                            categoryFilter === cat.name && styles.active,
                            dragOverIndex === index && dragIndex !== index && styles.dragOver
                        )}
                        onClick={() => onSelectCategory(cat.name)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
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
