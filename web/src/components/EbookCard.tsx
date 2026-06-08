'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ebook } from '@/types';
import { Card } from './UI';
import { BookIcon, DownloadIcon, EyeIcon } from './Icons';
import styles from './EbookCard.module.css';

interface EbookCardProps {
  ebook: Ebook;
}

export default function EbookCard({ ebook }: EbookCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <Card className={styles.card}>
      {/* Cover Image or CSS Placeholder */}
      <div className={styles.coverWrapper}>
        {!imgError ? (
          <img
            src={ebook.cover_url}
            alt={ebook.title}
            onError={() => setImgError(true)}
            className={styles.coverImage}
          />
        ) : (
          <div className={styles.coverPlaceholder}>
            <div className={styles.placeholderBg}></div>
            <div className={styles.placeholderContent}>
              <BookIcon size={32} className={styles.placeholderIcon} />
              <div className={styles.placeholderText}>{ebook.title}</div>
              <div className={styles.placeholderAuthor}>ධර්ම දානයකි</div>
            </div>
          </div>
        )}
      </div>

      {/* Book details */}
      <div className={styles.bookInfo}>
        <h4 className={styles.title} title={ebook.title}>
          {ebook.title}
        </h4>
        {ebook.title_transliterated && (
          <span className={styles.titleTransliterated} title={ebook.title_transliterated}>
            {ebook.title_transliterated}
          </span>
        )}
        <span className={styles.author}>{ebook.author}</span>
        <p className={styles.description}>{ebook.description}</p>

        {/* Action Buttons */}
        <div className={styles.actions}>
          {(ebook.pdf_url || ebook.html_url) && (
            <Link 
              href={`/ebooks/${ebook.id}/read`}
              className={`${styles.actionBtn} ${styles.readBtn}`}
              id={`read-online-${ebook.id}`}
              onClick={() => {
                const win = window as unknown as { umami?: { track: (event: string, data: Record<string, string>) => void } };
                if (typeof window !== 'undefined' && win.umami) {
                  win.umami.track('Ebook Read Online', { title: ebook.title, id: ebook.id });
                }
              }}
            >
              <EyeIcon size={16} /> කියවන්න (Read)
            </Link>
          )}

          <div className={styles.downloadRow}>
            {ebook.pdf_url && (
              <a
                href={ebook.pdf_url}
                download
                className={`${styles.actionBtn} ${styles.downloadBtn}`}
                id={`download-pdf-${ebook.id}`}
                onClick={() => {
                  const win = window as unknown as { umami?: { track: (event: string, data: Record<string, string>) => void } };
                  if (typeof window !== 'undefined' && win.umami) {
                    win.umami.track('Ebook Download', { title: ebook.title, id: ebook.id, format: 'pdf' });
                  }
                }}
              >
                <DownloadIcon size={14} /> PDF
              </a>
            )}
            
            {ebook.epub_url && (
              <a
                href={ebook.epub_url}
                download
                className={`${styles.actionBtn} ${styles.downloadBtn}`}
                id={`download-epub-${ebook.id}`}
                onClick={() => {
                  const win = window as unknown as { umami?: { track: (event: string, data: Record<string, string>) => void } };
                  if (typeof window !== 'undefined' && win.umami) {
                    win.umami.track('Ebook Download', { title: ebook.title, id: ebook.id, format: 'epub' });
                  }
                }}
              >
                <DownloadIcon size={14} /> EPUB
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
