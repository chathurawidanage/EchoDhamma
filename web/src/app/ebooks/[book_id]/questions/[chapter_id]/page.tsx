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
  if (chapter_id === 'all') {
    chapterTitle = 'මුළු පොතෙන්ම ප්‍රශ්න';
  } else if (book.html_url) {
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

export async function generateStaticParams() {
  const params: { book_id: string; chapter_id: string }[] = [];

  for (const book of ebooksData as Ebook[]) {
    if (book.html_url) {
      try {
        const parsedBook = await parseBookHtml(book.html_url);

        // Add 'all' questions route if there are any questions in the book
        const hasQuestions = parsedBook.questions && Object.values(parsedBook.questions).some(q => q && q.length > 0);
        if (hasQuestions) {
          params.push({
            book_id: book.id,
            chapter_id: 'all',
          });
        }

        // Add individual TOC item questions routes
        for (const item of parsedBook.toc) {
          const list = parsedBook.questions?.[item.id];
          if (list && Array.isArray(list) && list.length > 0) {
            params.push({
              book_id: book.id,
              chapter_id: item.id,
            });
          }
        }
      } catch (err) {
        console.error(`generateStaticParams: Failed to parse ebook ${book.id} for questions`, err);
      }
    }
  }

  return params;
}
