import { notFound } from 'next/navigation';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import BookReaderClient from '@/components/BookReaderClient';
import { parseBookHtml } from '@/lib/ebookParser';

interface ReadBookChapterPageProps {
  params: Promise<{ book_id: string; chapter_id: string }>;
}

export default async function ReadBookChapterPage({ params }: ReadBookChapterPageProps) {
  const { book_id, chapter_id } = await params;
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

  if (!parsedBook) {
    notFound();
  }

  // Resolve containing chapter and element scroll anchors on the server
  let activeChapterId = 'titlepage';
  let pendingScrollId: string | null = null;

  const chapterMatch = parsedBook.chapters.find(c => c.id === chapter_id);
  if (chapterMatch) {
    activeChapterId = chapterMatch.id;
  } else {
    const match = parsedBook.toc.find(t => t.id === chapter_id);
    if (match) {
      const hasSplitChapter = parsedBook.chapters.some(c => c.id === match.id);
      if (hasSplitChapter) {
        activeChapterId = match.id;
      } else {
        activeChapterId = match.chapterId;
        pendingScrollId = match.id;
      }
    } else {
      // Fallback: search which split chapter contains this element ID
      const containingChapter = parsedBook.chapters.find(
        (c) => c.content.includes(`id="${chapter_id}"`) || c.content.includes(`id='${chapter_id}'`)
      );
      if (containingChapter) {
        activeChapterId = containingChapter.id;
        pendingScrollId = chapter_id;
      }
    }
  }

  return (
    <BookReaderClient
      book={book}
      parsedBook={parsedBook}
      initialActiveChapterId={activeChapterId}
      initialPendingScrollId={pendingScrollId}
      initialChapterId={chapter_id}
    />
  );
}

export async function generateMetadata({ params }: ReadBookChapterPageProps) {
  const { book_id, chapter_id } = await params;
  const book = (ebooksData as Ebook[]).find((b) => b.id === book_id);
  if (!book) {
    return { title: 'Book Not Found' };
  }

  let chapterTitle = 'කියවන්න';
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
    title: `${chapterTitle} - ${book.title} | DamSak.org`,
    description: `${book.title} - ${chapterTitle}: ${book.description.substring(0, 120)}`,
    openGraph: {
      title: `${chapterTitle} - ${book.title}`,
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

        // Add special chapters
        const specialChapters = ['titlepage', 'colophon'];
        for (const cid of specialChapters) {
          if (parsedBook.chapters.some(c => c.id === cid)) {
            params.push({
              book_id: book.id,
              chapter_id: cid,
            });
          }
        }

        // Add all TOC items
        for (const item of parsedBook.toc) {
          params.push({
            book_id: book.id,
            chapter_id: item.id,
          });
        }
      } catch (err) {
        console.error(`generateStaticParams: Failed to parse ebook ${book.id}`, err);
      }
    }
  }

  return params;
}
