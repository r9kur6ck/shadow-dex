import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, User, FileText, Edit, Eye, CheckSquare, List, Heading2, ListOrdered, Underline, Minus } from 'lucide-react';
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

    const [vpHeight, setVpHeight] = useState(window.visualViewport?.height || window.innerHeight);
    const [vpOffsetTop, setVpOffsetTop] = useState(window.visualViewport?.offsetTop || 0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isFocused, setIsFocused] = useState(false);

    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleVP = () => {
            if (window.visualViewport) {
                setVpHeight(window.visualViewport.height);
                setVpOffsetTop(window.visualViewport.offsetTop);
            }
        };
        handleVP();
        window.visualViewport?.addEventListener('resize', handleVP);
        window.visualViewport?.addEventListener('scroll', handleVP);
        return () => {
            window.visualViewport?.removeEventListener('resize', handleVP);
            window.visualViewport?.removeEventListener('scroll', handleVP);
        };
    }, []);

    const renderToolbarButtons = (className: string, style?: React.CSSProperties) => (
        <div className={className} style={style}>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) editor.toggleStyles({ bold: true });
                }}
                title="太字"
            >
                <span style={{ fontWeight: 'bold' }}>B</span>
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) editor.toggleStyles({ underline: true });
                }}
                title="アンダーライン"
            >
                <Underline size={18} />
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) {
                        const block = editor.getTextCursorPosition()?.block;
                        if (block) editor.updateBlock(block, { type: 'heading', props: { level: 2 } });
                    }
                }}
                title="見出し2"
            >
                <Heading2 size={18} />
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) {
                        const block = editor.getTextCursorPosition()?.block;
                        if (block) editor.updateBlock(block, { type: 'bulletListItem' });
                    }
                }}
                title="箇条書きリスト"
            >
                <List size={18} />
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) {
                        const block = editor.getTextCursorPosition()?.block;
                        if (block) editor.updateBlock(block, { type: 'numberedListItem' });
                    }
                }}
                title="番号付きリスト"
            >
                <ListOrdered size={18} />
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) {
                        const block = editor.getTextCursorPosition()?.block;
                        if (block) editor.updateBlock(block, { type: 'checkListItem' });
                    }
                }}
                title="チェックボックス"
            >
                <CheckSquare size={18} />
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) {
                        const currentBlock = editor.getTextCursorPosition()?.block;
                        if (currentBlock) {
                            editor.insertBlocks([{ type: 'divider' }], currentBlock, 'after');
                            // 新しくブロックを追加したため、基本的にはその後にカーソルが合うか、もしくは別途明示的な処理をしない方が安全
                        }
                    }
                }}
                title="横罫線"
            >
                <Minus size={18} />
            </button>
            <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (editor) {
                        editor.insertInlineContent([
                            { type: "text", text: "@", styles: {} }
                        ]);
                    }
                }}
                title="別のノートを参照"
            >
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>@</span>
            </button>
        </div>
    );


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

        const tags = tagsStr.split(/[,、]/).map(t => t.trim()).filter(t => t);
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

                    {/* タグPill表示エリア（入力された文字をカンマ区切りで解析して表示） */}
                    {tagsStr.trim() && (
                        <div className={styles.tagPillContainer}>
                            {tagsStr.split(/[,、]/).map(t => t.trim()).filter(t => t).map((tag, idx) => (
                                <div key={idx} className={styles.tagPill}>
                                    <span className={styles.tagPillText}>{tag}</span>
                                    {isEditing && (
                                        <button
                                            type="button"
                                            className={styles.tagPillDelete}
                                            onClick={() => {
                                                const currentTags = tagsStr.split(/[,、]/).map(t => t.trim()).filter(t => t);
                                                currentTags.splice(idx, 1);
                                                setTagsStr(currentTags.join(', '));
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div
                        className={`${styles.editorContainer} ${isEditing ? styles.editingMode : ''}`}
                        onFocusCapture={() => setIsFocused(true)}
                        onBlurCapture={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setIsFocused(false);
                            }
                        }}
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
                                theme={systemTheme}
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

                {/* PC Toolbar: above the footer */}
                {isEditing && !isMobile && renderToolbarButtons(styles.toolbarPc)}

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

            {/* Mobile Toolbar: floats above keyboard using visualViewport */}
            {isEditing && isMobile && isFocused && renderToolbarButtons(styles.toolbarMobile, {
                top: `${vpOffsetTop + vpHeight}px`,
                transform: 'translateY(-100%)'
            })}
        </div>
    );
};

export default EntryEditor;
