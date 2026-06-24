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

  const idToSectionCid: Record<string, string> = {};

  // 1. Extract TOC first so we know the TOC boundaries
  const toc: TocItem[] = [];
  const tocIds = new Set<string>();
  $('nav[epub\\:type="toc"] ul.TOC-container li').each((_, el) => {
    const li = $(el);
    const link = li.find('a.TOC');
    const href = link.attr('href');
    const id = href ? href.replace('#', '') : '';
    const itemTitle = link.text().trim();
    const className = li.attr('class') || 'H1';
    const level = className.includes('H2') ? 'H2' : className.includes('H3') ? 'H3' : 'H1';

    if (id) {
      tocIds.add(id);
      toc.push({
        id,
        title: itemTitle,
        level,
        chapterId: '', // Will be updated after sections are parsed
      });
    }
  });

  // 2. Extract Main Chapters, splitting by TOC items
  $('section[epub\\:type="chapter"]').each((idx, el) => {
    const section = $(el);
    const firstHeader = section.find('h1, h2, h3').first();
    const sectionCid = firstHeader.attr('id') || `chapter-${idx}`;
    const sectionTitle = firstHeader.text().trim() || `පරිච්ඡේදය ${idx + 1}`;

    // Find all element IDs inside this section that are in the TOC list
    const sectionTocIds = new Set<string>();
    section.find('[id]').each((_, child) => {
      const id = $(child).attr('id');
      if (id && tocIds.has(id)) {
        sectionTocIds.add(id);
      }
    });

    // If there are no TOC IDs in this section, add the entire section as a single chapter
    if (sectionTocIds.size === 0) {
      chapters.push({
        id: sectionCid,
        title: sectionTitle,
        content: section.html() || '',
      });
      section.find('[id]').each((_, child) => {
        const id = $(child).attr('id');
        if (id) {
          idToChapterId[id] = sectionCid;
          idToSectionCid[id] = sectionCid;
        }
      });
      return;
    }

    // Map all descendant IDs to this parent section CID for TOC hierarchical linking
    section.find('[id]').each((_, child) => {
      const id = $(child).attr('id');
      if (id) {
        idToSectionCid[id] = sectionCid;
      }
    });
    if (firstHeader.attr('id')) {
      idToSectionCid[firstHeader.attr('id')!] = sectionCid;
    }

    // Split the children of the section at TOC boundaries
    let currentChapterId = sectionCid;
    let currentChapterTitle = sectionTitle;
    let currentWrapper = $('<div></div>');

    section.children().each((_, childEl) => {
      const child = $(childEl);
      const childId = child.attr('id');

      // Check if this child itself has a TOC ID or contains one
      let foundTocId = childId && sectionTocIds.has(childId) ? childId : null;
      if (!foundTocId) {
        const nestedHeading = child.find('h1, h2, h3, h4, h5, h6').filter((_, h) => {
          const hid = $(h).attr('id');
          return !!hid && sectionTocIds.has(hid);
        }).first();
        if (nestedHeading.length > 0) {
          foundTocId = nestedHeading.attr('id')!;
        }
      }

      if (foundTocId && foundTocId !== currentChapterId) {
        // Save the previous chapter before starting the new one
        if (currentWrapper.children().length > 0 || currentChapterId === sectionCid) {
          chapters.push({
            id: currentChapterId,
            title: currentChapterTitle,
            content: currentWrapper.html() || '',
          });
        }

        // Start the new chapter
        currentChapterId = foundTocId;
        const matchingToc = toc.find(t => t.id === foundTocId);
        currentChapterTitle = matchingToc ? matchingToc.title : child.text().trim();
        currentWrapper = $('<div></div>');
      }

      // Map all element IDs inside this child to the current active chapter
      if (childId) {
        idToChapterId[childId] = currentChapterId;
      }
      child.find('[id]').each((_, nestedEl) => {
        const nestedId = $(nestedEl).attr('id');
        if (nestedId) {
          idToChapterId[nestedId] = currentChapterId;
        }
      });

      currentWrapper.append(child.clone());
    });

    // Save the last chapter of the section
    if (currentWrapper.children().length > 0 || currentChapterId === sectionCid) {
      chapters.push({
        id: currentChapterId,
        title: currentChapterTitle,
        content: currentWrapper.html() || '',
      });
    }
  });

  // 3. Link each TOC item to its containing parent section chapter
  for (const item of toc) {
    item.chapterId = idToSectionCid[item.id] || 'titlepage';
  }

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
