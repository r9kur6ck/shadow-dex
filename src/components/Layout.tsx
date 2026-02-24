import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';
import EntryList from './EntryList';
import SearchBar from './SearchBar';
import EntryEditor from './EntryEditor';
import SyncModal from './SyncModal';
import SettingsModal from './SettingsModal';
import HelpModal from './HelpModal';
import { Menu, Plus } from 'lucide-react';
const Layout: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [isSyncOpen, setIsSyncOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const handleOpenEditor = (id?: string) => {
        setSelectedEntryId(id || null);
        setIsEditorOpen(true);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setSelectedEntryId(null);
    };

    useEffect(() => {
        const handleOpenEntryEvent = (e: Event) => {
            const customEvent = e as CustomEvent<{ id: string }>;
            if (customEvent.detail && customEvent.detail.id) {
                handleOpenEditor(customEvent.detail.id);
            }
        };

        window.addEventListener('open-entry', handleOpenEntryEvent);
        return () => window.removeEventListener('open-entry', handleOpenEntryEvent);
    }, []);

    return (
        <div className={styles.layout}>
            <Sidebar
                categoryFilter={categoryFilter}
                onSelectCategory={(cat) => {
                    setCategoryFilter(cat);
                    setIsSidebarOpen(false); // Close on selection in mobile
                }}
                onNewEntry={() => {
                    handleOpenEditor();
                    setIsSidebarOpen(false);
                }}
                onOpenSync={() => {
                    setIsSyncOpen(true);
                    setIsSidebarOpen(false);
                }}
                onOpenSettings={() => {
                    setIsSettingsOpen(true);
                    setIsSidebarOpen(false);
                }}
                onOpenHelp={() => {
                    setIsHelpOpen(true);
                    setIsSidebarOpen(false);
                }}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)}></div>
            )}
            <main className={styles.main}>
                <header className={styles.header}>
                    <button
                        className={styles.menuButton}
                        onClick={() => setIsSidebarOpen(true)}
                        aria-label="Toggle Menu"
                    >
                        <Menu size={20} />
                    </button>
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </header>
                <div className={styles.content}>
                    <EntryList
                        searchQuery={searchQuery}
                        categoryFilter={categoryFilter}
                        onSelectEntry={(id) => handleOpenEditor(id)}
                    />
                </div>
                <button
                    className={styles.fab}
                    onClick={() => handleOpenEditor()}
                    aria-label="新規作成"
                >
                    <Plus size={24} />
                </button>
            </main>

            {isEditorOpen && (
                <EntryEditor
                    key={selectedEntryId || 'new'}
                    entryId={selectedEntryId}
                    onClose={handleCloseEditor}
                />
            )}

            {isSyncOpen && (
                <SyncModal onClose={() => setIsSyncOpen(false)} />
            )}

            {isSettingsOpen && (
                <SettingsModal onClose={() => setIsSettingsOpen(false)} />
            )}

            {isHelpOpen && (
                <HelpModal onClose={() => setIsHelpOpen(false)} />
            )}
        </div>
    );
};

export default Layout;
