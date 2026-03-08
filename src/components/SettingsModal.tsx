import React, { useState, useRef, useEffect } from 'react';
import { Settings, Download, Upload, X, Plus, Trash2, Edit2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './SettingsModal.module.css';
import { db, PRESET_ICONS } from '../db/db';
import type { Category } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import DynamicIcon from './DynamicIcon';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import SyncModal from './SyncModal';

interface SettingsModalProps {
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedSection, setExpandedSection] = useState<'category' | 'sync' | 'backup' | 'storage' | null>('category');

    // Category management states
    const categories = useLiveQuery(() => db.categories.toArray()) || [];
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editIcon, setEditIcon] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Storage persistence state
    const [isPersisted, setIsPersisted] = useState<boolean | null>(null);

    useEffect(() => {
        const checkPersistence = async () => {
            if (navigator.storage && navigator.storage.persisted) {
                const persisted = await navigator.storage.persisted();
                setIsPersisted(persisted);
            }
        };
        checkPersistence();
    }, [expandedSection]);

    const handleExport = async () => {
        try {
            const password = window.prompt('バックアップを暗号化するためのパスワードを入力してください。\n（キャンセルするとエクスポートを中止します）');
            if (password === null) return; // cancelled
            if (password.trim() === '') {
                alert('パスワードを入力してください。');
                return;
            }

            const entries = await db.entries.toArray();
            const categories = await db.categories.toArray();

            const data = {
                entries,
                categories,
            };

            const jsonString = JSON.stringify(data);
            const encryptedData = CryptoJS.AES.encrypt(jsonString, password).toString();
            const blob = new Blob([encryptedData], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const fileName = `shadow_dex_backup_${yyyy}${mm}${dd}.enc`;

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export data:', error);
            alert('エクスポートに失敗しました。');
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) return;

                let data;
                if (content.trim().startsWith('{')) {
                    // It might be a plain json for backward compatibility
                    data = JSON.parse(content);
                } else {
                    // Assume it's encrypted (.enc fallback)
                    const password = window.prompt('復元用パスワードを入力してください。');
                    if (password === null) {
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        return;
                    }

                    try {
                        const bytes = CryptoJS.AES.decrypt(content.trim(), password);
                        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                        if (!decryptedStr) throw new Error('復号化された文字列が空です。パスワードが間違っている可能性があります。');
                        data = JSON.parse(decryptedStr);
                    } catch (err: unknown) {
                        console.error('Decryption error:', err);
                        const errorMessage = err instanceof Error ? err.message : 'パスワードが間違っているか、ファイルが破損しています。';
                        alert(`復号化に失敗しました。\nエラー詳細: ${errorMessage}`);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        return;
                    }
                }

                if (!data || !Array.isArray(data.entries)) {
                    throw new Error('Invalid backup file format');
                }

                if (window.confirm('現在のデータはすべて上書きされます。よろしいですか？')) {
                    await db.transaction('rw', db.entries, db.categories, async () => {
                        await db.entries.clear();
                        if (data.categories && Array.isArray(data.categories)) {
                            await db.categories.clear();
                            await db.categories.bulkPut(data.categories);
                        }
                        await db.entries.bulkPut(data.entries);
                    });
                    alert('データの復元が完了しました。');
                    onClose();
                }
            } catch (error) {
                console.error('Failed to import data:', error);
                alert('インポートに失敗しました。無効なファイル形式です。');
            }
        };
        reader.readAsText(file);

        // Reset the file input so the same file could be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Category Handlers
    const startCreateCategory = () => {
        setIsCreating(true);
        setEditingCatId(null);
        setEditName('');
        setEditIcon(PRESET_ICONS[0].id);
    };

    const startEditCategory = (cat: Category) => {
        if (cat.isDefault) return; // Disallow editing default completely, or allow rename? Let's disallow for now to keep it simple
        setIsCreating(false);
        setEditingCatId(cat.id);
        setEditName(cat.name);
        setEditIcon(cat.icon);
    };

    const cancelEdit = () => {
        setIsCreating(false);
        setEditingCatId(null);
        setEditName('');
        setEditIcon('');
    };

    const saveCategory = async () => {
        if (!editName.trim()) return;

        if (isCreating) {
            const maxOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
            await db.categories.add({
                id: uuidv4(),
                name: editName.trim(),
                icon: editIcon,
                color: '#6B7280', // default color
                sortOrder: maxOrder + 1
            });
        } else if (editingCatId) {
            await db.categories.update(editingCatId, {
                name: editName.trim(),
                icon: editIcon
            });

            // Update associated entries
            const oldCat = categories.find(c => c.id === editingCatId);
            if (oldCat && oldCat.name !== editName.trim()) {
                const entriesToUpdate = await db.entries.where('category').equals(oldCat.name).toArray();
                await Promise.all(entriesToUpdate.map(e => db.entries.update(e.id, { category: editName.trim() })));
            }
        }
        cancelEdit();
    };

    const deleteCategory = async (cat: Category) => {
        if (cat.isDefault) return;
        if (window.confirm(`カテゴリ「${cat.name}」を削除しますか？\n(このカテゴリのエントリは「その他」に移動します)`)) {
            await db.categories.delete(cat.id);
            // Fallback entries to default 'その他'
            const entriesToUpdate = await db.entries.where('category').equals(cat.name).toArray();
            await Promise.all(entriesToUpdate.map(e => db.entries.update(e.id, { category: 'その他' })));
        }
    };

    const toggleSection = (section: 'category' | 'sync' | 'backup' | 'storage') => {
        setExpandedSection(prev => prev === section ? null : section);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <Settings size={20} />
                        設定
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>

                    {/* Category Section (Accordion) */}
                    <div className={styles.accordionGroup}>
                        <button className={styles.accordionHeader} onClick={() => toggleSection('category')}>
                            <div className={styles.accordionTitle}>カテゴリ設定</div>
                            {expandedSection === 'category' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSection === 'category' && (
                            <div className={styles.accordionContent}>
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionDesc}>カテゴリ名の編集やアイコンの変更、新規追加を行います。</div>
                                    {!isCreating && !editingCatId && (
                                        <button className={styles.addCatBtn} onClick={startCreateCategory}>
                                            <Plus size={16} /> 追加
                                        </button>
                                    )}
                                </div>

                                {(isCreating || editingCatId) ? (
                                    <div className={styles.catEditor}>
                                        <input
                                            type="text"
                                            className={styles.catNameInput}
                                            placeholder="カテゴリ名"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            autoFocus
                                        />
                                        <div className={styles.iconGrid}>
                                            {PRESET_ICONS.map(icon => (
                                                <button
                                                    key={icon.id}
                                                    className={clsx(styles.iconSelectBtn, editIcon === icon.id && styles.selectedIcon)}
                                                    onClick={() => setEditIcon(icon.id)}
                                                    title={icon.label}
                                                >
                                                    <DynamicIcon name={icon.id} size={20} />
                                                </button>
                                            ))}
                                        </div>
                                        <div className={styles.editorActions}>
                                            <button className={styles.cancelBtn} onClick={cancelEdit}>キャンセル</button>
                                            <button className={styles.saveBtn} onClick={saveCategory} disabled={!editName.trim()}>
                                                <Check size={16} /> 保存
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.catList}>
                                        {categories.map(cat => (
                                            <div key={cat.id} className={styles.catItem}>
                                                <div className={styles.catItemName}>
                                                    <DynamicIcon name={cat.icon} size={16} className={styles.catItemIcon} />
                                                    <span>{cat.name}</span>
                                                    {cat.isDefault && <span className={styles.defaultBadge}>標準</span>}
                                                </div>
                                                {!cat.isDefault && (
                                                    <div className={styles.catItemActions}>
                                                        <button onClick={() => startEditCategory(cat)} className={styles.iconBtn} title="編集">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => deleteCategory(cat)} className={`${styles.iconBtn} ${styles.danger}`} title="削除">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Backup Section (Accordion) */}
                    <div className={styles.accordionGroup}>
                        <button className={styles.accordionHeader} onClick={() => toggleSection('backup')}>
                            <div className={styles.accordionTitle}>バックアップと復元</div>
                            {expandedSection === 'backup' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSection === 'backup' && (
                            <div className={styles.accordionContent}>
                                <div className={styles.sectionDesc} style={{ marginBottom: '16px' }}>
                                    現在の全データを暗号化ファイルとしてダウンロード（エクスポート）し、PCに保存します。また、保存したファイルからデータを復元することができます。
                                </div>
                                <div className={styles.section}>
                                    <button className={`${styles.btn} ${styles.exportBtn}`} onClick={handleExport}>
                                        <Download size={18} />
                                        バックアップをダウンロード
                                    </button>

                                    <div className={styles.importWrapper}>
                                        <button className={`${styles.btn} ${styles.importBtn}`}>
                                            <Upload size={18} />
                                            ファイルからデータを復元
                                        </button>
                                        <input
                                            type="file"
                                            className={styles.fileInput}
                                            onChange={handleImport}
                                            ref={fileInputRef}
                                            title="ファイルを選択してください (.enc または .json)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sync Section (Accordion) */}
                    <div className={styles.accordionGroup}>
                        <button className={styles.accordionHeader} onClick={() => toggleSection('sync')}>
                            <div className={styles.accordionTitle}>デバイス同期 (P2P)</div>
                            {expandedSection === 'sync' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSection === 'sync' && (
                            <div className={styles.accordionContent}>
                                <SyncModal />
                            </div>
                        )}
                    </div>

                    {/* Storage Protection Section (Accordion) */}
                    <div className={styles.accordionGroup}>
                        <button className={styles.accordionHeader} onClick={() => toggleSection('storage')}>
                            <div className={styles.accordionTitle}>ストレージ保護（データ保全）</div>
                            {expandedSection === 'storage' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSection === 'storage' && (
                            <div className={styles.accordionContent}>
                                <div className={styles.sectionDesc}>
                                    ブラウザの自動クリーンアップによってデータが削除されるのを防ぎます。
                                    <div style={{ marginTop: '8px', padding: '10px', borderRadius: 'var(--radius)', background: 'var(--sidebar-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                        {isPersisted === null ? (
                                            <span style={{ color: 'var(--text-muted)' }}>確認中...</span>
                                        ) : isPersisted ? (
                                            <><span style={{ color: '#10B981' }}>🟢</span> <span>有効（データは安全に保護されています）</span></>
                                        ) : (
                                            <><span style={{ color: '#F59E0B' }}>🟡</span> <span>無効（OSの空き容量不足などで削除されるリスクがあります。PWAとしてホーム画面に追加すると有効化されやすくなります）</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
