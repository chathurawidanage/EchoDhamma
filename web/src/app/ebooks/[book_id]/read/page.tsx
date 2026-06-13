import { notFound } from 'next/navigation';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import BookReaderClient from '@/components/BookReaderClient';
import { parseBookHtml } from '@/lib/ebookParser';

interface ReadBookPageProps {
  params: Promise<{ book_id: string }>;
}

export default async function ReadBookPage({ params }: ReadBookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);

  if (!book || (!book.pdf_url && !book.epub_url && !book.html_url)) {
    notFound();
  }

  let parsedBook = null;
  if (book.html_url) {
    try {
      parsedBook = await parseBookHtml(book.html_url);
    } catch (e) {
      console.error('Failed to parse ebook HTML:', e);
    }
  }

  return <BookReaderClient book={book} parsedBook={parsedBook} />;
}

export async function generateMetadata({ params }: ReadBookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);
  if (!book) {
    return { title: 'Book Not Found' };
  }

  return {
    title: `කියවන්න: ${book.title} - ${book.author} | DamSak.org`,
    description: book.description.substring(0, 160),
    openGraph: {
      title: book.title,
      description: book.description.substring(0, 160),
      images: [{ url: book.cover_url }],
    },
  };
}

