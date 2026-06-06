import { notFound } from 'next/navigation';
import Link from 'next/link';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import { DownloadIcon } from '@/components/Icons';
import styles from './page.module.css';

interface ReadBookPageProps {
  params: Promise<{ book_id: string }>;
}

export default async function ReadBookPage({ params }: ReadBookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);

  if (!book || !book.pdf_url) {
    notFound();
  }

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

        <div className={styles.right}>
          <a
            href={book.pdf_url}
            download
            className={`${styles.actionBtn} glass`}
            id="reader-download-pdf"
          >
            <DownloadIcon size={14} /> PDF භාගත කරන්න (Download)
          </a>
        </div>
      </header>

      {/* Embedded PDF iframe container */}
      <main className={styles.readerWrapper}>
        <iframe
          src={`${book.pdf_url}#toolbar=1`}
          title={book.title}
          className={styles.pdfIframe}
        />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: ReadBookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);
  if (!book) {
    return { title: 'Book Not Found' };
  }

  return {
    title: `කියවන්න: ${book.title} - ${book.author} | EchoDhamma`,
    description: book.description.substring(0, 160),
    openGraph: {
      title: book.title,
      description: book.description.substring(0, 160),
      images: [{ url: book.cover_url }],
    },
  };
}
