'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ebook } from '@/types';
import { DownloadIcon } from '@/components/Icons';
import styles from '@/app/ebooks/[book_id]/read/page.module.css';

interface BookReaderClientProps {
  book: Ebook;
}

export default function BookReaderClient({ book }: BookReaderClientProps) {
  // Prefer HTML reader for online reading over PDF if available
  const hasHtml = !!book.html_url;
  const hasPdf = !!book.pdf_url;
  const [activeTab, setActiveTab] = useState<'html' | 'pdf'>(hasHtml ? 'html' : 'pdf');

  const showFormatSwitcher = hasHtml && hasPdf;

  return (
    <div className={styles.container}>
      <header className={`${styles.header} glass`}>
        <div className={styles.left}>
          <Link href="/ebooks" className={styles.backLink}>
            ← ග්‍රන්ථ එකතුවට (Back)
          </Link>
          <div className={styles.titleInfo}>
            <h1 className={styles.bookTitle}>{book.title}</h1>
            <span className={styles.bookAuthor}>{book.author}</span>
          </div>
        </div>

        {/* Format Switcher Tabs */}
        {showFormatSwitcher && (
          <div className={styles.tabContainer}>
            <button
              onClick={() => setActiveTab('html')}
              className={`${styles.tabBtn} ${activeTab === 'html' ? styles.activeTab : ''}`}
            >
              HTML කියවනය
            </button>
            <button
              onClick={() => setActiveTab('pdf')}
              className={`${styles.tabBtn} ${activeTab === 'pdf' ? styles.activeTab : ''}`}
            >
              PDF කියවනය
            </button>
          </div>
        )}

        <div className={styles.right}>
          {/* Always show EPUB download if available, as a useful extra link */}
          {book.epub_url && (
            <a
              href={book.epub_url}
              download
              className={`${styles.actionBtn} glass`}
              style={{ marginRight: '0.5rem' }}
              id="reader-download-epub"
            >
              <DownloadIcon size={14} /> EPUB බාගත කරන්න
            </a>
          )}
          
          {activeTab === 'pdf' && book.pdf_url && (
            <a
              href={book.pdf_url}
              download
              className={`${styles.actionBtn} glass`}
              id="reader-download-pdf"
            >
              <DownloadIcon size={14} /> PDF බාගත කරන්න
            </a>
          )}
        </div>
      </header>

      {/* Reader area */}
      <main className={styles.readerWrapper}>
        {activeTab === 'html' && book.html_url ? (
          <iframe
            src={book.html_url}
            title={book.title}
            className={styles.pdfIframe}
            style={{ backgroundColor: '#ffffff' }} // Keep HTML background clean
          />
        ) : (
          book.pdf_url && (
            <iframe
              src={`${book.pdf_url}#toolbar=1`}
              title={book.title}
              className={styles.pdfIframe}
            />
          )
        )}
      </main>
    </div>
  );
}
