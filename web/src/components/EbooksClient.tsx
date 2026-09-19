'use client';

import { useState, useMemo } from 'react';
import { Ebook } from '@/types';
import EbookCard from '@/components/EbookCard';
import { SearchIcon } from '@/components/Icons';
import styles from '@/app/ebooks/page.module.css';

interface EbooksClientProps {
  ebooks: Ebook[];
}

export default function EbooksClient({ ebooks }: EbooksClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter ebooks based on search query
  const filteredEbooks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return ebooks;

    return ebooks.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        (book.title_transliterated && book.title_transliterated.toLowerCase().includes(query)) ||
        book.author.toLowerCase().includes(query) ||
        book.description.toLowerCase().includes(query)
    );
  }, [ebooks, searchQuery]);

  return (
    <>
      {/* Search Input bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="පොත්වල මාතෘකා, කර්තෘ හෝ විස්තර සොයන්න..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${styles.searchInput} glass`}
            id="ebook-search-input"
          />
          <SearchIcon size={20} className={styles.searchIcon} />
        </div>
      </div>

      {/* Grid listing */}
      {filteredEbooks.length > 0 ? (
        <div className={styles.grid}>
          {filteredEbooks.map((book) => (
            <EbookCard key={book.id} ebook={book} />
          ))}
        </div>
      ) : (
        <div className={`${styles.emptyState} glass`}>
          <div className={styles.emptyIcon}>
            <SearchIcon size={40} />
          </div>
          <h4>පොත් කිසිවක් හමු නොවීය</h4>
          <p>ඔබ සොයන වචන පරීක්ෂා කර නැවත උත්සාහ කරන්න.</p>
        </div>
      )}
    </>
  );
}
