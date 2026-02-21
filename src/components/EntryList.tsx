import React from 'react';
import styles from './EntryList.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';

interface EntryListProps {
    searchQuery: string;
    categoryFilter: string | null;
    onSelectEntry: (id: string) => void;
}

const EntryList: React.FC<EntryListProps> = ({ searchQuery, categoryFilter, onSelectEntry }) => {
    const entries = useLiveQuery(
        () => {
            // Fetch all entries then sort by updatedAt desc in JS
            return db.entries.toArray().then(arr =>
                arr.sort((a, b) => b.updatedAt - a.updatedAt)
            );
        },
        []
    ) || [];

    const filteredEntries = entries.filter(entry => {
        // Category filter
        if (categoryFilter && entry.category !== categoryFilter) return false;

        // Search query filter (title, content, tags)
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const inTitle = entry.title.toLowerCase().includes(q);
            const inContent = entry.content.toLowerCase().includes(q);
            const inTags = entry.tags.some(t => t.toLowerCase().includes(q));
            if (!inTitle && !inContent && !inTags) return false;
        }

        return true;
    });

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{categoryFilter || 'すべてのエントリ'}</h1>

            {filteredEntries.length === 0 ? (
                <div className={styles.empty}>
                    <FileText size={48} className={styles.emptyIcon} />
                    <p>エントリが見つかりません</p>
                    {!searchQuery && <p className={styles.emptySub}>左下の「新規作成」から追加してください</p>}
                </div>
            ) : (
                <div className={styles.list}>
                    {filteredEntries.map(entry => (
                        <div key={entry.id} className={styles.card} onClick={() => onSelectEntry(entry.id)}>
                            <div className={styles.cardHeader}>
                                <FileText size={18} className={styles.cardIcon} />
                                <h3 className={styles.cardTitle}>{entry.title}</h3>
                            </div>
                            <div className={styles.cardPreview}>
                                {entry.content.substring(0, 150)}{entry.content.length > 150 ? '...' : ''}
                            </div>
                            <div className={styles.cardMeta}>
                                <span className={styles.badge}>{entry.category}</span>
                                <span className={styles.date}>{format(entry.updatedAt, 'yy/MM/dd HH:mm')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EntryList;
