import { promises as fs } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

export interface TocItem {
  id: string;
  title: string;
  level: 'H1' | 'H2' | 'H3';
  chapterId: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export interface ParsedBook {
  toc: TocItem[];
  chapters: Chapter[];
  title: string;
  author: string;
}

export async function parseBookHtml(htmlUrl: string): Promise<ParsedBook> {
  // htmlUrl is like "/ebooks/Abi_Dharmaye_Moolika_Karunu/Abi_Dharmaye_Moolika_Karunu.html"
  const filePath = path.join(process.cwd(), 'public', htmlUrl);
  const rawHtml = await fs.readFile(filePath, 'utf-8');
  const $ = cheerio.load(rawHtml);

  const title = $('title').text().trim() || 'Dhamma Book';
  const author = $('meta[name="author"]').attr('content')?.trim() || 'රේරුකානේ චන්දවිමල හිමි';

  const chapters: Chapter[] = [];
  const idToChapterId: Record<string, string> = {};

  // 1. Extract Title Page
  const titlePage = $('.first-page');
  if (titlePage.length > 0) {
    const cid = 'titlepage';
    chapters.push({
      id: cid,
      title: 'මුල් පිටුව',
      content: titlePage.html() || '',
    });
    titlePage.find('[id]').each((_, el) => {
      const id = $(el).attr('id');
      if (id) idToChapterId[id] = cid;
    });
  }

  // 2. Extract Colophon/Metadata
  const bookMeta = $('.book-meta');
  if (bookMeta.length > 0) {
    const cid = 'colophon';
    chapters.push({
      id: cid,
      title: 'පොත පිළිබඳ විස්තර',
      content: bookMeta.html() || '',
    });
    bookMeta.find('[id]').each((_, el) => {
      const id = $(el).attr('id');
      if (id) idToChapterId[id] = cid;
    });
  }

  // 3. Extract Main Chapters
  $('section[epub\\:type="chapter"]').each((idx, el) => {
    const section = $(el);
    const firstHeader = section.find('h1, h2, h3').first();
    const cid = firstHeader.attr('id') || `chapter-${idx}`;
    const chapterTitle = firstHeader.text().trim() || `පරිච්ඡේදය ${idx + 1}`;

    chapters.push({
      id: cid,
      title: chapterTitle,
      content: section.html() || '',
    });

    // Map all IDs inside this chapter to this chapter ID
    section.find('[id]').each((_, child) => {
      const id = $(child).attr('id');
      if (id) {
        idToChapterId[id] = cid;
      }
    });

    const mainId = firstHeader.attr('id');
    if (mainId) {
      idToChapterId[mainId] = cid;
    }
  });

  // 4. Extract TOC and link each item to its containing chapter
  const toc: TocItem[] = [];
  $('nav[epub\\:type="toc"] ul.TOC-container li').each((_, el) => {
    const li = $(el);
    const link = li.find('a.TOC');
    const href = link.attr('href');
    const id = href ? href.replace('#', '') : '';
    const itemTitle = link.text().trim();
    const className = li.attr('class') || 'H1';
    const level = className.includes('H2') ? 'H2' : className.includes('H3') ? 'H3' : 'H1';

    if (id) {
      const chapterId = idToChapterId[id] || 'titlepage';
      toc.push({
        id,
        title: itemTitle,
        level,
        chapterId,
      });
    }
  });

  return {
    toc,
    chapters,
    title,
    author,
  };
}
