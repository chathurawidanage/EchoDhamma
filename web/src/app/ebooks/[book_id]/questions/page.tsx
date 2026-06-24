import { notFound } from 'next/navigation';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import BookQuestionsClient from '@/components/BookQuestionsClient';
import { parseBookHtml } from '@/lib/ebookParser';

interface BookQuestionsPageProps {
  params: Promise<{ book_id: string }>;
}

export default async function BookQuestionsPage({ params }: BookQuestionsPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);

  if (!book || !book.html_url) {
    notFound();
  }

  let parsedBook = null;
  try {
    parsedBook = await parseBookHtml(book.html_url);
  } catch (e) {
    console.error('Failed to parse ebook HTML for questions:', e);
    notFound();
  }

  return <BookQuestionsClient book={book} parsedBook={parsedBook} />;
}

export async function generateMetadata({ params }: BookQuestionsPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);
  if (!book) {
    return { title: 'Book Not Found' };
  }

  return {
    title: `ප්‍රශ්නෝත්තර: ${book.title} - ${book.author} | DamSak.org`,
    description: `ප්‍රශ්නෝත්තර: ${book.description.substring(0, 160)}`,
    openGraph: {
      title: `ප්‍රශ්නෝත්තර: ${book.title}`,
      description: book.description.substring(0, 160),
      images: [{ url: book.cover_url }],
    },
  };
}
