import { notFound, redirect } from 'next/navigation';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';

interface BookPageProps {
  params: Promise<{ book_id: string }>;
}

export default async function BookPage({ params }: BookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);

  if (!book) {
    notFound();
  }

  // Redirect directly to the titlepage/chapter reader
  redirect(`/ebooks/${book_id}/read/titlepage`);
}

export async function generateMetadata({ params }: BookPageProps) {
  const { book_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);
  if (!book) {
    return { title: 'Book Not Found' };
  }

  const destinationPath = `/ebooks/${book_id}/read/titlepage`;

  return {
    title: `${book.title} - ${book.author} | DamSak.org`,
    description: book.description.substring(0, 160),
    alternates: {
      canonical: destinationPath,
    },
    openGraph: {
      title: `${book.title} - ${book.author}`,
      description: book.description.substring(0, 160),
      url: destinationPath,
      images: [{ url: book.cover_url }],
    },
  };
}

export async function generateStaticParams() {
  return (ebooksData as Ebook[]).map((book) => ({
    book_id: book.id,
  }));
}
