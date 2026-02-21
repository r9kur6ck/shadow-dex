import React from 'react';
import { Search } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
    value: string;
    onChange: (val: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
    return (
        <div className={styles.wrapper}>
            <Search size={16} className={styles.icon} />
            <input
                type="text"
                className={styles.input}
                placeholder="検索 または コマンド入力..."
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
};

export default SearchBar;
