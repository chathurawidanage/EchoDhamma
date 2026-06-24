import { promises as fs } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import definitionsData from '../data/definitions.json';
import { Definition, Question } from '@/types';

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
  questions?: Record<string, Question[]>;
}

function injectDefinitions($: cheerio.CheerioAPI) {
  const definitions = definitionsData as Record<string, Definition>;
  const termToKey: Record<string, string> = {};
  const matchStrings: string[] = [];

  for (const [key, def] of Object.entries(definitions)) {
    if (!termToKey[key]) {
      termToKey[key] = key;
      matchStrings.push(key);
    }
    if (def.matches) {
      for (const match of def.matches) {
        if (!termToKey[match]) {
          termToKey[match] = key;
          matchStrings.push(match);
        }
      }
    }
  }

  // Sort matches by length descending to match longest first
  matchStrings.sort((a, b) => b.length - a.length);

  if (matchStrings.length === 0) return;

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `(?<![\\u0D80-\\u0DFF])(${matchStrings.map(escapeRegExp).join('|')})(?![\\u0D80-\\u0DFF])`;
  const regex = new RegExp(pattern, 'g');

  const ignoreTags = new Set([
    'a', 'script', 'style', 'head', 'title', 'meta', 'button', 'iframe',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]);

  function walk(node: any) {
    if (!node) return;

    if (node.type === 'tag') {
      const tagName = node.name.toLowerCase();
      if (ignoreTags.has(tagName)) {
        return;
      }
      if (node.attribs && node.attribs.class && node.attribs.class.includes('def-term')) {
        return;
      }
    }

    if (node.type === 'text') {
      const text = node.data;
      if (text && regex.test(text)) {
        regex.lastIndex = 0; // Reset index for replace
        const parent = node.parent;
        if (parent) {
          const escapedText = escapeHtml(text);
          const replacedHtml = escapedText.replace(regex, (match) => {
            const canonicalKey = termToKey[match];
            return `<span class="def-term" data-term="${canonicalKey}">${match}</span>`;
          });
          
          if (replacedHtml !== escapedText) {
            $(node).replaceWith($(replacedHtml));
          }
        }
      }
      return;
    }

    if (node.children) {
      const children = [...node.children];
      for (const child of children) {
        walk(child);
      }
    }
  }

  function escapeHtml(unsafe: string) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  $('body').each((_, bodyEl) => {
    walk(bodyEl);
  });
}

export async function parseBookHtml(htmlUrl: string): Promise<ParsedBook> {
  // htmlUrl is like "/ebooks/Abi_Dharmaye_Moolika_Karunu/Abi_Dharmaye_Moolika_Karunu.html"
  const filePath = path.join(process.cwd(), 'public', htmlUrl);
  const rawHtml = await fs.readFile(filePath, 'utf-8');
  const $ = cheerio.load(rawHtml);

  // Inject definition terms into text nodes
  injectDefinitions($);


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

  // 5. Scan and load questions if questions directory exists next to the HTML file
  const questions: Record<string, Question[]> = {};
  const bookDir = path.dirname(filePath);
  const questionsDir = path.join(bookDir, 'questions');

  try {
    const stats = await fs.stat(questionsDir);
    if (stats.isDirectory()) {
      const files = await fs.readdir(questionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sectionId = path.basename(file, '.json');
          const fileContent = await fs.readFile(path.join(questionsDir, file), 'utf-8');
          try {
            const parsedQuestions = JSON.parse(fileContent);
            if (Array.isArray(parsedQuestions)) {
              questions[sectionId] = parsedQuestions;
            }
          } catch (err) {
            console.error(`Failed to parse question JSON file ${file}:`, err);
          }
        }
      }
    }
  } catch (e) {
    // questions directory does not exist, ignore
  }

  return {
    toc,
    chapters,
    title,
    author,
    questions,
  };
}
