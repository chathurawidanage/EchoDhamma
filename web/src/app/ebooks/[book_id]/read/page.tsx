import { notFound, redirect } from 'next/navigation';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';

interface ReadBookPageProps {
  params: Promise<{ book_id: string }>;
}

export default async function ReadBookPage({ params }: ReadBookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);

  if (!book || (!book.pdf_url && !book.epub_url && !book.html_url)) {
    notFound();
  }

  redirect(`/ebooks/${book_id}/read/titlepage`);
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

