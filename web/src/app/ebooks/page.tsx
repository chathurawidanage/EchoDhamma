'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import EbookCard from '@/components/EbookCard';
import { SearchIcon, HelpCircleIcon } from '@/components/Icons';
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
          ← මුල් පිටුවට <span className="english-sub">Back to Home</span>
        </Link>
        <h1 className={styles.pageTitle}>
          දහම් පොත් එකතුව <span className="english-sub">Dhamma Ebook Library</span>
        </h1>
        <p className={styles.pageSubtitle}>
          අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් මෙහිදී ඔබට කියවීමට සහ භාගත (Download) කර ගැනීමට හැකිය.
        </p>
      </header>

      {/* EPUB versions explanation */}
      <div className={`${styles.infoCard} glass`}>
        <span className={styles.infoTitle}>
          <HelpCircleIcon size={16} className={styles.infoIcon} />
          EPUB සංස්කරණ බාගත කිරීම් පිළිබඳ උපදෙස්
        </span>
        <div className={styles.infoContent}>
          <p>
            මෙම වෙබ් අඩවියේ ඇති ඊ-පොත් (Ebooks) කියවීම සඳහා සංස්කරණ 2කින් ලබාගත හැකිය:
          </p>
          <ul>
            <li>
              <strong>EPUB (Standard)</strong>: Apple Books, Google Play Books, Kobo හෝ වෙනත් සාමාන්‍ය ඊ-පොත් කියවන මෘදුකාංග සඳහා සුදුසු වේ. මෙහි පටුන සිංහල අකුරෙන්ම පවතී.
            </li>
            <li>
              <strong>EPUB (Kindle)</strong>: Amazon Kindle උපාංග සඳහා විශේෂයෙන් සකසා ඇත. Kindle උපාංගවල සිංහල අකුරු සහිත පටුන (Table of Contents) නිවැරදිව පෙන්වීමට නොහැකි බැවින්, මෙම සංස්කරණයේ පටුන ඉංග්‍රීසි අකුරෙන් (Transliterated) සකසා ඇත.
            </li>
          </ul>
        </div>
      </div>

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
          <div className={styles.emptyIcon}><SearchIcon size={40} /></div>
          <h4>පොත් කිසිවක් හමු නොවීය</h4>
          <p>ඔබ සොයන වචන පරීක්ෂා කර නැවත උත්සාහ කරන්න.</p>
        </div>
      )}

      {/* Credits and Punyanimodana Footer Card */}
      <footer className={`${styles.creditsCard} glass`}>
        <div className={styles.creditsContent}>
          <h3>පුණ්‍යානුමෝදනාව සහ මූලාශ්‍ර කෘතඥතාව</h3>
          <p className={styles.creditsTextSinhala}>
            මෙම පොත් එකතුවේ ඇති ඊ-පොත් (EPUB) සැකසීමට සහ අපගේ මාර්ගගත කියවනය (Online Reader) සඳහා <a href="https://pitaka.lk/books/" target="_blank" rel="noopener noreferrer" className={styles.creditLink}>pitaka.lk</a> වෙබ් අඩවියේ ඇති ඩිජිටල්කරණය කරන ලද මුල් HTML ලිපිගොනු මූලාශ්‍ර කරගන්නා ලදී. එම දහම් පොත් ඩිජිටල්කරණය කර පොදු පරිහරණය සඳහා විවෘතව ලබාදීම පිළිබඳව pitaka.lk කණ්ඩායමට අපගේ ගෞරවනීය ස්තූතිය සහ පුණ්‍යානුමෝදනාව මෙයින් පළ කර සිටිමු.
          </p>
        </div>
      </footer>
    </div>
  );
}
