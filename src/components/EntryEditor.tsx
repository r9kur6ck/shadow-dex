import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import styles from './EntryEditor.module.css';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

interface EntryEditorProps {
    entryId?: string | null;
    onClose: () => void;
}

const EntryEditor: React.FC<EntryEditorProps> = ({ entryId, onClose }) => {
    const categories = useLiveQuery(() => db.categories.toArray()) || [];
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [tagsStr, setTagsStr] = useState('');
    const [content, setContent] = useState('');

    const [initialContent, setInitialContent] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!entryId && categories.length > 0 && !category) {
            setCategory(categories[0].name);
            setIsLoaded(true);
        }
    }, [categories, entryId, category]);

    useEffect(() => {
        if (entryId) {
            db.entries.get(entryId).then(entry => {
                if (entry) {
                    setTitle(entry.title);
                    setCategory(entry.category);
                    setTagsStr(entry.tags.join(', '));
                    setContent(entry.content);
                    setInitialContent(entry.content);
                }
                setIsLoaded(true);
            });
        }
    }, [entryId]);

    // Create the editor instance. We wait for `isLoaded` to ensure we have the correct 
    // initialContent before instantiating, to avoid empty editors on edit.
    const editor = useCreateBlockNote({
        initialContent: isLoaded && initialContent ? undefined : undefined,
    });

    // Since initialContent must be set asynchronously when editing, we load it into the editor once it's ready
    useEffect(() => {
        async function loadMarkdown() {
            if (isLoaded && editor) {
                if (initialContent) {
                    const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
                    editor.replaceBlocks(editor.document, blocks);
                }
            }
        }
        loadMarkdown();
    }, [isLoaded, initialContent, editor]);

    const handleSave = async () => {
        if (!title.trim()) return;

        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        const now = Date.now();

        if (entryId) {
            await db.entries.update(entryId, {
                title, category, tags, content, updatedAt: now
            });
        } else {
            await db.entries.add({
                id: uuidv4(),
                title,
                category,
                tags,
                content,
                createdAt: now,
                updatedAt: now
            });
        }
        onClose();
    };

    const handleDelete = async () => {
        if (entryId) {
            if (window.confirm('本当に削除しますか？')) {
                await db.entries.delete(entryId);
                onClose();
            }
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.actions}>
                        {entryId && (
                            <button onClick={handleDelete} className={`${styles.iconBtn} ${styles.danger}`} title="削除">
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button onClick={onClose} className={styles.iconBtn} title="閉じる">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className={styles.body}>
                    <input
                        type="text"
                        className={styles.titleInput}
                        placeholder="タイトル（無題）"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                    />

                    <div className={styles.metaRow}>
                        <div className={styles.metaLabel}>カテゴリ</div>
                        <select
                            className={styles.select}
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                        >
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.metaRow}>
                        <div className={styles.metaLabel}>タグ</div>
                        <input
                            type="text"
                            className={styles.tagInput}
                            placeholder="カンマ区切りで入力 (例: 営業部, 要注意)"
                            value={tagsStr}
                            onChange={e => setTagsStr(e.target.value)}
                        />
                    </div>

                    <div className={styles.editorContainer}>
                        {isLoaded && editor && (
                            <BlockNoteView
                                editor={editor}
                                theme="light" /* will be overridden by CSS variables if needed */
                                onChange={async () => {
                                    const markdown = await editor.blocksToMarkdownLossy(editor.document);
                                    setContent(markdown);
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button onClick={handleSave} className={styles.primaryBtn}>
                        <Save size={16} />
                        <span>保存</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EntryEditor;
