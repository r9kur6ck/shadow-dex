import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, User, FileText, Edit, Eye } from 'lucide-react';
import styles from './EntryEditor.module.css';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { useCreateBlockNote, SuggestionMenuController, LinkToolbarController } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { SuggestionMenu } from '@blocknote/core/extensions';
import '@blocknote/mantine/style.css';

import type { Category } from '../db/db';

const EMPTY_CATEGORIES: Category[] = [];

interface EntryEditorProps {
    entryId?: string | null;
    onClose: () => void;
}

const EntryEditor: React.FC<EntryEditorProps> = ({ entryId, onClose }) => {
    const categories = useLiveQuery(() => db.categories.toArray()) || EMPTY_CATEGORIES;
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [tagsStr, setTagsStr] = useState('');
    const [content, setContent] = useState('');

    const [isEditing, setIsEditing] = useState(!entryId);

    const [initialContent, setInitialContent] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!entryId && categories.length > 0 && !category) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
                            <button onClick={() => setIsEditing(!isEditing)} className={styles.iconBtn} title={isEditing ? "閲覧モードにする" : "編集モードにする"}>
                                {isEditing ? <Eye size={18} /> : <Edit size={18} />}
                            </button>
                        )}
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
                    {isEditing ? (
                        <input
                            type="text"
                            className={styles.titleInput}
                            placeholder="タイトル（無題）"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    ) : (
                        <div className={styles.viewTitle}>{title || '無題'}</div>
                    )}

                    <div className={styles.metaRow}>
                        <div className={styles.metaLabel}>カテゴリ</div>
                        {isEditing ? (
                            <select
                                className={styles.select}
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className={styles.viewText}>{category}</div>
                        )}
                    </div>

                    <div className={styles.metaRow}>
                        <div className={styles.metaLabel}>タグ</div>
                        {isEditing ? (
                            <input
                                type="text"
                                className={styles.tagInput}
                                placeholder="カンマ区切りで入力 (例: 営業部, 要注意)"
                                value={tagsStr}
                                onChange={e => setTagsStr(e.target.value)}
                            />
                        ) : (
                            <div className={styles.viewText}>{tagsStr || 'なし'}</div>
                        )}
                    </div>

                    <div
                        className={`${styles.editorContainer} ${isEditing ? styles.editingMode : ''}`}
                        onClick={(e) => {
                            const target = e.target as HTMLElement;
                            const anchor = target.closest('a');

                            if (isEditing) {
                                // 編集モード時はリンク遷移（新規タブ等の挙動）を完全にブロックする
                                if (anchor) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                                return;
                            }

                            if (!isEditing) {
                                if (anchor) {
                                    const href = anchor.getAttribute('href');
                                    if (href && href.startsWith('/entry/')) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const id = href.replace('/entry/', '');
                                        window.dispatchEvent(new CustomEvent('open-entry', { detail: { id } }));
                                    }
                                }
                            }
                        }}
                    >
                        {isLoaded && editor && (
                            <BlockNoteView
                                editor={editor}
                                theme="light" /* will be overridden by CSS variables if needed */
                                editable={isEditing}
                                onChange={async () => {
                                    const markdown = await editor.blocksToMarkdownLossy(editor.document);
                                    setContent(markdown);
                                }}
                            >
                                <SuggestionMenuController
                                    triggerCharacter={"@"}
                                    getItems={async (query) => {
                                        const entries = await db.entries.toArray();
                                        return entries
                                            .filter(e => e.title.toLowerCase().includes(query.toLowerCase()))
                                            .map(entry => ({
                                                title: entry.title,
                                                onItemClick: () => {
                                                    editor.getExtension(SuggestionMenu)?.clearQuery();
                                                    editor.insertInlineContent([
                                                        {
                                                            type: "link",
                                                            href: `/entry/${entry.id}`,
                                                            content: `@${entry.title}`
                                                        },
                                                        {
                                                            type: "text",
                                                            text: " ",
                                                            styles: {}
                                                        }
                                                    ]);
                                                },
                                                subtext: entry.category,
                                                icon: entry.category === '人物メモ' ? <User size={18} /> : <FileText size={18} />
                                            }));
                                    }}
                                />
                                <SuggestionMenuController
                                    triggerCharacter={"["}
                                    getItems={async (query) => {
                                        const cleanQuery = query.startsWith('[') ? query.slice(1) : query;
                                        const entries = await db.entries.toArray();
                                        return entries
                                            .filter(e => e.title.toLowerCase().includes(cleanQuery.toLowerCase()))
                                            .map(entry => ({
                                                title: entry.title,
                                                onItemClick: () => {
                                                    // By default, SuggestionMenu only removes the query and its trigger `[`
                                                    // We typed `[[` so we have to manually delete an extra `[` backwards before replacing
                                                    editor.getExtension(SuggestionMenu)?.clearQuery();
                                                    const pos = editor._tiptapEditor.state.selection.from;
                                                    editor._tiptapEditor.commands.deleteRange({ from: pos - 1, to: pos });

                                                    editor.insertInlineContent([
                                                        {
                                                            type: "link",
                                                            href: `/entry/${entry.id}`,
                                                            content: `[[${entry.title}]]`
                                                        },
                                                        {
                                                            type: "text",
                                                            text: " ",
                                                            styles: {}
                                                        }
                                                    ]);
                                                },
                                                subtext: entry.category,
                                                icon: <FileText size={18} />
                                            }));
                                    }}
                                />
                                <LinkToolbarController
                                    linkToolbar={(props) => {
                                        // If it's an internal link, intercept it here instead of showing the toolbar
                                        if (props.url.startsWith('/entry/')) {
                                            // Provide a simple button to navigate when NOT editing
                                            if (isEditing) return null;

                                            const id = props.url.replace('/entry/', '');
                                            return (
                                                <div className="blocknote-custom-link-toolbar" style={{
                                                    padding: '8px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                                    display: 'flex',
                                                    gap: '8px',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#4F46E5' }}>{props.text}</span>
                                                    <button
                                                        onClick={() => {
                                                            const event = new CustomEvent('open-entry', { detail: { id } });
                                                            window.dispatchEvent(event);
                                                            if (props.setToolbarOpen) {
                                                                props.setToolbarOpen(false);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '4px 8px',
                                                            backgroundColor: '#4F46E5',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        開く
                                                    </button>
                                                </div>
                                            );
                                        }

                                        // For external links, just render nothing or a custom fallback if we wanted to
                                        // By returning undefined or a default, it usually bypasses, but since we replaced it,
                                        // we should probably just show a basic "open" link for standard URLs.
                                        return (
                                            <div style={{ padding: '4px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                                <a href={props.url} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: 'blue', textDecoration: 'none' }}>開く</a>
                                            </div>
                                        );
                                    }}
                                />
                            </BlockNoteView>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    {isEditing ? (
                        <button onClick={handleSave} className={styles.primaryBtn}>
                            <Save size={16} />
                            <span>保存</span>
                        </button>
                    ) : (
                        <div style={{ flex: 1 }}></div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EntryEditor;
