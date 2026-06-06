'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import EbookCard from '@/components/EbookCard';
import { SearchIcon } from '@/components/Icons';
import styles from './page.module.css';

export default function EbooksPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const ebooks = ebooksData as Ebook[];

  // Filter ebooks based on search query
  const filteredEbooks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return ebooks;

    return ebooks.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.description.toLowerCase().includes(query)
    );
  }, [ebooks, searchQuery]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← මුල් පිටුවට (Back to Home)
        </Link>
        <h1 className={styles.pageTitle}>දහම් පොත් එකතුව (Ebook Library)</h1>
        <p className={styles.pageSubtitle}>
          අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් මෙහිදී ඔබට කියවීමට සහ භාගත (Download) කර ගැනීමට හැකිය.
        </p>
      </header>

      {/* Search Input bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="පොත්වල මාතෘකා, කර්තෘ හෝ විස්තර සොයන්න... (Search books...)"
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
          <div className={styles.emptyIcon}><SearchIcon size={40} /></div>
          <h4>පොත් කිසිවක් හමු නොවීය</h4>
          <p>ඔබ සොයන වචන පරීක්ෂා කර නැවත උත්සාහ කරන්න.</p>
        </div>
      )}
    </div>
  );
}
