import Dexie, { type EntityTable } from 'dexie';

export interface Entry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // The Lucide icon name, e.g. 'User', 'Book'
  color: string;
  isDefault?: boolean; // Protect "その他" and default categories from deletion if we want
  sortOrder: number;
}

// Available preset icons
export const PRESET_ICONS = [
  { id: 'User', label: '人物' },
  { id: 'Book', label: '本' },
  { id: 'Hash', label: 'ハッシュタグ' },
  { id: 'Briefcase', label: 'かばん' },
  { id: 'Folder', label: 'フォルダ' },
  { id: 'Star', label: '星' },
  { id: 'Tag', label: 'タグ' },
  { id: 'AlertCircle', label: '注意' },
] as const;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '人物メモ', icon: 'User', color: '#4F46E5', isDefault: true, sortOrder: 0 },
  { id: 'cat-2', name: '社内用語', icon: 'Book', color: '#10B981', isDefault: true, sortOrder: 1 },
  { id: 'cat-3', name: 'ローカルルール', icon: 'Hash', color: '#F59E0B', isDefault: true, sortOrder: 2 },
  { id: 'cat-4', name: 'その他', icon: 'Hash', color: '#6B7280', isDefault: true, sortOrder: 3 },
];

const db = new Dexie('ShadowDexDB') as Dexie & {
  entries: EntityTable<Entry, 'id'>;
  categories: EntityTable<Category, 'id'>;
};

// Version 1 Schema
db.version(1).stores({
  entries: 'id, title, category, *tags, createdAt, updatedAt', // Primary key and indexed props
  categories: 'id, name'
});

// Version 2 Schema (Added icon and migration)
db.version(2).stores({
  entries: 'id, title, category, *tags, createdAt, updatedAt',
  categories: 'id, name, icon'
}).upgrade(tx => {
  return tx.table('categories').toCollection().modify(category => {
    if (!category.icon) {
      category.icon = 'Hash';
    }
  });
});

// Version 3 Schema (Added sortOrder for category reordering)
db.version(3).stores({
  entries: 'id, title, category, *tags, createdAt, updatedAt',
  categories: 'id, name, icon, sortOrder'
}).upgrade(async tx => {
  const categories = await tx.table('categories').toArray();
  for (let i = 0; i < categories.length; i++) {
    await tx.table('categories').update(categories[i].id, { sortOrder: i });
  }
});

// Populate default categories on first db creation
db.on('populate', (transaction) => {
  transaction.table('categories').bulkAdd(DEFAULT_CATEGORIES);
});

export { db };
