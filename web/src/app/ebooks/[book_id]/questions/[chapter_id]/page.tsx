import { notFound } from 'next/navigation';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import BookQuestionsClient from '@/components/BookQuestionsClient';
import { parseBookHtml } from '@/lib/ebookParser';

interface BookQuestionsChapterPageProps {
  params: Promise<{ book_id: string; chapter_id: string }>;
}

export default async function BookQuestionsChapterPage({ params }: BookQuestionsChapterPageProps) {
  const { book_id, chapter_id } = await params;
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

  return <BookQuestionsClient book={book} parsedBook={parsedBook} chapterId={chapter_id} />;
}

export async function generateMetadata({ params }: BookQuestionsChapterPageProps) {
  const { book_id, chapter_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);
  if (!book) {
    return { title: 'Book Not Found' };
  }

  let chapterTitle = 'ප්‍රශ්නෝත්තර';
  if (book.html_url) {
    try {
      const parsedBook = await parseBookHtml(book.html_url);
      const match = parsedBook.toc.find(t => t.id === chapter_id);
      if (match) {
        chapterTitle = match.title;
      } else {
        const chapterMatch = parsedBook.chapters.find(c => c.id === chapter_id);
        if (chapterMatch) {
          chapterTitle = chapterMatch.title;
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  return {
    title: `ප්‍රශ්නෝත්තර: ${chapterTitle} - ${book.title} | DamSak.org`,
    description: `ප්‍රශ්නෝත්තර - ${book.title} - ${chapterTitle}: ${book.description.substring(0, 120)}`,
    openGraph: {
      title: `ප්‍රශ්නෝත්තර: ${chapterTitle} - ${book.title}`,
      description: book.description.substring(0, 160),
      images: [{ url: book.cover_url }],
    },
  };
}
