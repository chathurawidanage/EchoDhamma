'use client';

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ebook, Definition } from '@/types';
import { DownloadIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from '@/components/Icons';
import { ParsedBook, TocItem } from '@/lib/ebookParser';
import styles from '@/app/ebooks/[book_id]/read/page.module.css';
import definitionsData from '@/data/definitions.json';
import { settingsCache } from '@/lib/readerSettingsCache';

const definitions = definitionsData as Record<string, Definition>;


interface BookReaderClientProps {
  book: Ebook;
  parsedBook: ParsedBook | null;
  initialActiveChapterId: string;
  initialPendingScrollId: string | null;
  initialChapterId: string;
}

export default function BookReaderClient({
  book,
  parsedBook,
  initialActiveChapterId,
  initialPendingScrollId,
  initialChapterId,
}: BookReaderClientProps) {
  // Reader Settings State
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>(() => settingsCache.theme || 'sepia');
  const [fontSize, setFontSize] = useState<number>(() => settingsCache.fontSize || 18);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>(() => settingsCache.fontFamily || 'serif');
  const [lineHeight, setLineHeight] = useState<number>(() => settingsCache.lineHeight || 1.6);
  const [textWidth, setTextWidth] = useState<'narrow' | 'medium' | 'wide'>(() => settingsCache.textWidth || 'medium');
  const [isLoaded, setIsLoaded] = useState<boolean>(() => settingsCache.isLoaded || false);

  // Navigation and Layout State
  const currentChapterId = initialActiveChapterId;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(initialPendingScrollId);

  // Sync props to state on path-based navigation
  useEffect(() => {
    setPendingScrollId(initialPendingScrollId);
  }, [initialPendingScrollId]);

  // Tooltip State
  const [tooltip, setTooltip] = useState<{
    term: string;
    translation?: string;
    definition: string;
    language: string;
    top: number;
    left: number;
    visible: boolean;
    persistent: boolean;
  } | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);

  const hideTooltip = () => {
    setTooltip(null);
  };

  const showTooltipForElement = (el: HTMLElement, termKey: string, persistent = false) => {
    const def = definitions[termKey];
    if (!def || !readerRef.current) return;

    const container = readerRef.current;
    const containerRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();

    const left = rect.left - containerRect.left + container.scrollLeft + rect.width / 2;
    const top = rect.top - containerRect.top + container.scrollTop;

    setTooltip({
      term: def.term || termKey,
      translation: def.translation,
      definition: def.definition,
      language: def.language,
      left,
      top,
      visible: true,
      persistent,
    });
  };

  // Adjust tooltip positioning to prevent viewport overflow
  useLayoutEffect(() => {
    if (tooltip && tooltipRef.current && readerRef.current) {
      const tooltipEl = tooltipRef.current;
      const containerEl = readerRef.current;
      const containerRect = containerEl.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();

      let offset = 0;
      if (tooltipRect.left < containerRect.left + 12) {
        offset = (containerRect.left + 12) - tooltipRect.left;
      } else if (tooltipRect.right > containerRect.right - 12) {
        offset = (containerRect.right - 12) - tooltipRect.right;
      }

      if (offset !== 0) {
        tooltipEl.style.transform = `translate(calc(-50% + ${offset}px), -100%)`;
      } else {
        tooltipEl.style.transform = 'translate(-50%, -100%)';
      }
    }
  }, [tooltip]);

  const readerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (settingsCache.isLoaded) {
      setIsLoaded(true);
      return;
    }

    const savedTheme = localStorage.getItem('ebook-reader-theme') as 'light' | 'sepia' | 'dark' | null;
    if (savedTheme) setTheme(savedTheme);

    const savedFontSize = localStorage.getItem('ebook-reader-font-size');
    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));

    const savedFontFamily = localStorage.getItem('ebook-reader-font-family') as 'serif' | 'sans' | null;
    if (savedFontFamily) setFontFamily(savedFontFamily);

    const savedLineHeight = localStorage.getItem('ebook-reader-line-height');
    if (savedLineHeight) setLineHeight(parseFloat(savedLineHeight));

    const savedTextWidth = localStorage.getItem('ebook-reader-text-width') as 'narrow' | 'medium' | 'wide' | null;
    if (savedTextWidth) setTextWidth(savedTextWidth);

    // Sync to cache
    settingsCache.theme = savedTheme || 'sepia';
    settingsCache.fontSize = savedFontSize ? parseInt(savedFontSize, 10) : 18;
    settingsCache.fontFamily = savedFontFamily || 'serif';
    settingsCache.lineHeight = savedLineHeight ? parseFloat(savedLineHeight) : 1.6;
    settingsCache.textWidth = savedTextWidth || 'medium';
    settingsCache.isLoaded = true;

    setIsLoaded(true);
  }, [book.id]);

  // Save settings when changed
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('ebook-reader-theme', theme);
    localStorage.setItem('ebook-reader-font-size', String(fontSize));
    localStorage.setItem('ebook-reader-font-family', fontFamily);
    localStorage.setItem('ebook-reader-line-height', String(lineHeight));
    localStorage.setItem('ebook-reader-text-width', textWidth);

    settingsCache.theme = theme;
    settingsCache.fontSize = fontSize;
    settingsCache.fontFamily = fontFamily;
    settingsCache.lineHeight = lineHeight;
    settingsCache.textWidth = textWidth;
  }, [theme, fontSize, fontFamily, lineHeight, textWidth, isLoaded]);

  // Simple scroll position tracking to update progress bar width
  const handleScroll = () => {
    if (!readerRef.current || !progressBarRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = readerRef.current;
    const totalScrollable = scrollHeight - clientHeight;
    const pct = totalScrollable > 0 ? (scrollTop / totalScrollable) * 100 : 0;
    progressBarRef.current.style.width = `${pct}%`;
  };

  // Reset scroll to top synchronously when chapter changes
  useLayoutEffect(() => {
    if (!readerRef.current) return;
    hideTooltip();

    if (!initialPendingScrollId) {
      readerRef.current.scrollTop = 0;
      if (progressBarRef.current) {
        progressBarRef.current.style.width = '0%';
      }
    }
  }, [initialActiveChapterId]);

  // Handle scrolling to a specific target within a chapter
  useEffect(() => {
    if (!parsedBook || !pendingScrollId || !readerRef.current) return;

    const timer = setTimeout(() => {
      const element = document.getElementById(pendingScrollId);
      if (element && readerRef.current) {
        const containerTop = readerRef.current.getBoundingClientRect().top;
        const elementTop = element.getBoundingClientRect().top;
        const relativeOffset = elementTop - containerTop + readerRef.current.scrollTop;

        readerRef.current.scrollTo({
          top: relativeOffset - 24, // 24px padding at the top
          behavior: 'instant' as any
        });
      }
      setPendingScrollId(null);
    }, 50);

    return () => clearTimeout(timer);
  }, [pendingScrollId, parsedBook]);

  // Navigate through table of contents
  const handleTocClick = (item: TocItem) => {
    if (item.chapterId === currentChapterId) {
      // Same chapter - scroll immediately
      const element = document.getElementById(item.id);
      if (element && readerRef.current) {
        const containerTop = readerRef.current.getBoundingClientRect().top;
        const elementTop = element.getBoundingClientRect().top;
        const relativeOffset = elementTop - containerTop + readerRef.current.scrollTop;
        readerRef.current.scrollTo({
          top: relativeOffset - 24,
          behavior: 'instant' as any
        });
      }
      
      // Update path (still in the same chapter, but with the element's TOC ID)
      router.replace(`/ebooks/${book.id}/read/${item.id}`, { scroll: false });
    } else {
      // Different chapter - transition path
      router.replace(`/ebooks/${book.id}/read/${item.id}`, { scroll: false });
    }
    setSidebarOpen(false);
  };

  const handleTocLinkClick = (e: React.MouseEvent, item: TocItem) => {
    if (item.chapterId === currentChapterId) {
      e.preventDefault();
      handleTocClick(item);
    } else {
      setSidebarOpen(false);
    }
  };

  // Handle in-book link interceptions and term clicks
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Check if clicked on a definition term
    const defSpan = target.closest('.def-term') as HTMLElement;
    if (defSpan) {
      e.preventDefault();
      e.stopPropagation();
      const termKey = defSpan.getAttribute('data-term');
      if (termKey) {
        const canonicalDef = definitions[termKey];
        const canonicalTerm = canonicalDef ? canonicalDef.term : termKey;
        // Toggle or open persistent tooltip
        if (tooltip && tooltip.persistent && tooltip.term === canonicalTerm) {
          hideTooltip();
        } else {
          showTooltipForElement(defSpan, termKey, true);
        }
      }
      return;
    }

    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const id = href.replace('#', '');
        if (id === 'toc') {
          setSidebarOpen(true);
        } else {
          // See if it is in TOC
          const tocItem = parsedBook?.toc.find(t => t.id === id);
          if (tocItem) {
            handleTocClick(tocItem);
          } else {
            // Check if it exists in current page
            const el = document.getElementById(id);
            if (el && readerRef.current) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              router.replace(`/ebooks/${book.id}/read/${id}`, { scroll: false });
            } else if (parsedBook) {
              // Try to find if this id exists inside any chapter
              // Fallback scanning
              const targetChapter = parsedBook.chapters.find(c => c.content.includes(`id="${id}"`) || c.content.includes(`id='${id}'`));
              if (targetChapter) {
                router.replace(`/ebooks/${book.id}/read/${id}`, { scroll: false });
              }
            }
          }
        }
      }
    } else {
      // Clicked elsewhere - close tooltip if open
      if (tooltip) {
        hideTooltip();
      }
    }
  };



  if (!parsedBook) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>පොත පූරණය වෙමින් පවතී...</p>
      </div>
    );
  }

  // HTML Native Reader Layout
  const chapters = parsedBook.chapters;
  const currentChapterIdx = chapters.findIndex(c => c.id === currentChapterId);
  const activeChapter = chapters[currentChapterIdx >= 0 ? currentChapterIdx : 0];


  // Helper to find the best TOC item for questions in the current chapter
  const getQuestionsTocId = (): string => {
    if (!parsedBook) return '';
    
    // Helper to check if a TOC item (or its descendants) has questions
    const hasQuestions = (tocItem: TocItem) => {
      const idx = parsedBook.toc.findIndex(t => t.id === tocItem.id);
      if (idx === -1) return false;
      const currentLevelNum = tocItem.level === 'H1' ? 1 : tocItem.level === 'H2' ? 2 : 3;
      const targetIds = [tocItem.id];
      for (let i = idx + 1; i < parsedBook.toc.length; i++) {
        const nextItem = parsedBook.toc[i];
        const nextLevelNum = nextItem.level === 'H1' ? 1 : nextItem.level === 'H2' ? 2 : 3;
        if (nextLevelNum <= currentLevelNum) {
          break;
        }
        targetIds.push(nextItem.id);
      }
      const bookQuestions = parsedBook.questions || {};
      return targetIds.some(id => {
        const list = bookQuestions[id];
        return list && Array.isArray(list) && list.length > 0;
      });
    };

    // If initialChapterId is in the current chapter and has questions, use it
    if (initialChapterId) {
      const activeItem = parsedBook.toc.find(t => t.id === initialChapterId);
      if (activeItem && activeItem.chapterId === currentChapterId && hasQuestions(activeItem)) {
        return initialChapterId;
      }
    }

    // Otherwise, find the first TOC item in the current chapter that has questions
    const chapterTocItems = parsedBook.toc.filter(item => item.chapterId === currentChapterId);
    const firstWithQuestions = chapterTocItems.find(item => hasQuestions(item));
    return firstWithQuestions ? firstWithQuestions.id : '';
  };

  const activeChapterItem = parsedBook?.toc.find(t => t.id === activeChapter?.id);

  const subChapters = useMemo(() => {
    if (!parsedBook || !activeChapter) return [];
    const idx = parsedBook.toc.findIndex(t => t.id === activeChapter.id);
    if (idx === -1) return [];

    const parentLevelNum = activeChapterItem?.level === 'H1' ? 1 : activeChapterItem?.level === 'H2' ? 2 : 3;
    const targetLevelNum = parentLevelNum + 1;

    const list: TocItem[] = [];
    for (let i = idx + 1; i < parsedBook.toc.length; i++) {
      const nextItem = parsedBook.toc[i];
      const nextLevelNum = nextItem.level === 'H1' ? 1 : nextItem.level === 'H2' ? 2 : 3;
      
      if (nextLevelNum <= parentLevelNum) {
        break;
      }
      
      if (nextLevelNum === targetLevelNum) {
        list.push(nextItem);
      }
    }
    return list;
  }, [parsedBook, activeChapter, activeChapterItem]);

  const isDirPage = useMemo(() => {
    if (!activeChapter || !parsedBook || subChapters.length === 0) return false;

    const contentWithoutHeadings = activeChapter.content
      .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
      
    return contentWithoutHeadings.length < 10;
  }, [activeChapter, parsedBook, subChapters]);

  const questionsTocId = getQuestionsTocId();

  return (
    <div
      id="reader-container"
      className={`${styles.container} ${styles[theme]} ${sidebarOpen ? styles.sidebarActive : ''}`}
      style={{
        '--reader-font-size': `${fontSize}px`,
        '--reader-line-height': lineHeight,
      } as any}
      suppressHydrationWarning
    >
      {/* Top Reading Progress Bar */}
      <div ref={progressBarRef} className={styles.progressBar} />

      {/* Reader Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.left}>
          <Link href="/ebooks" className={`${styles.iconBtn} ${styles.backBtn}`} title="ග්‍රන්ථ එකතුවට">
            <ChevronLeftIcon size={20} />
          </Link>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`${styles.actionBtn} ${styles.tocToggleBtn}`}
            title="පටුන (Table of Contents)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span className={styles.tocToggleText}>පටුන</span>
          </button>

          <div className={styles.titleInfo}>
            <h1 className={styles.bookTitle}>{book.title}</h1>
            <span className={styles.bookAuthor}>{book.author}</span>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.tabContainer}>
            <span className={`${styles.tabBtn} ${styles.activeTab}`}>
              කියවන්න
            </span>
            {questionsTocId ? (
              <Link
                href={`/ebooks/${book.id}/questions/${questionsTocId}`}
                className={styles.tabBtn}
              >
                ප්‍රශ්නෝත්තර
              </Link>
            ) : (
              <span
                className={`${styles.tabBtn} ${styles.tabBtnDisabled}`}
                title="මෙම පරිච්ඡේදය සඳහා ප්‍රශ්න සූදානම් කර නොමැත"
              >
                ප්‍රශ්නෝත්තර
              </span>
            )}
          </div>
          {/* Format Settings Toggle */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`${styles.iconBtn} ${settingsOpen ? styles.activeIconBtn : ''}`}
            title="අකුරු සැකසුම් (Aesthetics & Typography)"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className={styles.workspace}>
        {/* Table of Contents Sidebar */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''} glass`}>
          <div className={styles.sidebarHeader}>
            <h3>පටුන</h3>
            <button className={styles.closeBtn} onClick={() => setSidebarOpen(false)}>×</button>
          </div>
          <nav className={styles.tocNav}>
            <ul>
              {parsedBook.toc.map((item, idx) => (
                <li
                  key={`${item.id}-${idx}`}
                  className={`${styles.tocItem} ${styles[`level${item.level}`]} ${initialChapterId === item.id ? styles.activeTocItem : ''
                    }`}
                >
                  <Link
                    href={`/ebooks/${book.id}/read/${item.id}`}
                    scroll={false}
                    onClick={(e) => handleTocLinkClick(e, item)}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
        )}

        {/* Settings Popover Panel */}
        {settingsOpen && (
          <div className={`${styles.settingsPanel} glass`}>
            <div className={styles.settingsHeader}>
              <h4>සැකසුම්</h4>
              <button className={styles.closeBtn} onClick={() => setSettingsOpen(false)}>×</button>
            </div>

            {/* Theme Selector */}
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>තේමාව (Theme)</span>
              <div className={styles.themeSelector}>
                <button
                  className={`${styles.themeBtn} ${styles.themeBtnLight} ${theme === 'light' ? styles.activeSetting : ''}`}
                  onClick={() => setTheme('light')}
                  title="Light Theme"
                >
                  Aa
                </button>
                <button
                  className={`${styles.themeBtn} ${styles.themeBtnSepia} ${theme === 'sepia' ? styles.activeSetting : ''}`}
                  onClick={() => setTheme('sepia')}
                  title="Sepia Theme"
                >
                  Aa
                </button>
                <button
                  className={`${styles.themeBtn} ${styles.themeBtnDark} ${theme === 'dark' ? styles.activeSetting : ''}`}
                  onClick={() => setTheme('dark')}
                  title="Dark Theme"
                >
                  Aa
                </button>
              </div>
            </div>

            {/* Font Family Selector */}
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>අකුරු (Font)</span>
              <div className={styles.btnGroup}>
                <button
                  className={`${styles.settingBtn} ${fontFamily === 'serif' ? styles.activeSetting : ''}`}
                  onClick={() => setFontFamily('serif')}
                >
                  Serif
                </button>
                <button
                  className={`${styles.settingBtn} ${fontFamily === 'sans' ? styles.activeSetting : ''}`}
                  onClick={() => setFontFamily('sans')}
                >
                  Sans
                </button>
              </div>
            </div>

            {/* Font Size Selector */}
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>ප්‍රමාණය (Size)</span>
              <div className={styles.btnGroup}>
                <button
                  className={styles.settingBtn}
                  onClick={() => setFontSize(prev => Math.max(14, prev - 2))}
                  disabled={fontSize <= 14}
                >
                  A-
                </button>
                <span className={styles.sizeIndicator}>{fontSize}px</span>
                <button
                  className={styles.settingBtn}
                  onClick={() => setFontSize(prev => Math.min(28, prev + 2))}
                  disabled={fontSize >= 28}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Line Height Selector */}
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>පරතරය (Spacing)</span>
              <div className={styles.btnGroup}>
                <button
                  className={`${styles.settingBtn} ${lineHeight === 1.4 ? styles.activeSetting : ''}`}
                  onClick={() => setLineHeight(1.4)}
                >
                  1.4
                </button>
                <button
                  className={`${styles.settingBtn} ${lineHeight === 1.6 ? styles.activeSetting : ''}`}
                  onClick={() => setLineHeight(1.6)}
                >
                  1.6
                </button>
                <button
                  className={`${styles.settingBtn} ${lineHeight === 1.8 ? styles.activeSetting : ''}`}
                  onClick={() => setLineHeight(1.8)}
                >
                  1.8
                </button>
                <button
                  className={`${styles.settingBtn} ${lineHeight === 2.0 ? styles.activeSetting : ''}`}
                  onClick={() => setLineHeight(2.0)}
                >
                  2.0
                </button>
              </div>
            </div>

            {/* Text Width Selector */}
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>තීරු පළල (Width)</span>
              <div className={styles.btnGroup}>
                <button
                  className={`${styles.settingBtn} ${textWidth === 'narrow' ? styles.activeSetting : ''}`}
                  onClick={() => setTextWidth('narrow')}
                  title="Narrow View"
                >
                  Narrow
                </button>
                <button
                  className={`${styles.settingBtn} ${textWidth === 'medium' ? styles.activeSetting : ''}`}
                  onClick={() => setTextWidth('medium')}
                  title="Medium View"
                >
                  Medium
                </button>
                <button
                  className={`${styles.settingBtn} ${textWidth === 'wide' ? styles.activeSetting : ''}`}
                  onClick={() => setTextWidth('wide')}
                  title="Wide View"
                >
                  Wide
                </button>
              </div>
            </div>

            {/* Download Buttons Section */}
            {(book.epub_url || book.pdf_url) && (
              <div className={styles.settingRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem', marginTop: '1.2rem', borderTop: '1px solid var(--border-reader)', paddingTop: '1.2rem' }}>
                <span className={styles.settingLabel} style={{ marginBottom: '0.2rem' }}>ග්‍රන්ථය බාගත කරන්න (Download Book)</span>
                <div className={styles.btnGroup} style={{ width: '100%', gap: '0.5rem' }}>
                  {book.epub_url && (
                    <a
                      href={book.epub_url}
                      download
                      className={styles.settingBtn}
                      style={{ flex: 1, textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', height: '36px' }}
                    >
                      <DownloadIcon size={14} /> EPUB
                    </a>
                  )}
                  {book.pdf_url && (
                    <a
                      href={book.pdf_url}
                      download
                      className={styles.settingBtn}
                      style={{ flex: 1, textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', height: '36px' }}
                    >
                      <DownloadIcon size={14} /> PDF
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reader Display Panel */}
        <main
          className={`${styles.readerPane} ${fontFamily === 'serif' ? styles.serif : styles.sans} ${styles[`width-${textWidth}`]
            }`}
          ref={readerRef}
          onScroll={handleScroll}
        >
          <div
            className={styles.readingArea}
            onClick={handleContentClick}
          >
            {/* Title / Cover Header if first page */}
            {activeChapter.id === 'titlepage' && (
              <div className={styles.chapterCover}>
                <h1 className={styles.coverTitle}>{book.title}</h1>
                <h3 className={styles.coverAuthor}>{book.author}</h3>
              </div>
            )}

            <article
              className={`${styles.articleContent} ${isDirPage ? styles.directoryArticle : ''}`}
              dangerouslySetInnerHTML={{ __html: activeChapter.content }}
            />

            {isDirPage && (
              <div className={styles.directoryContainer}>
                <div className={styles.directoryGrid}>
                  {subChapters.map((item) => (
                    <Link
                      key={item.id}
                      href={`/ebooks/${book.id}/read/${item.id}`}
                      scroll={false}
                      className={styles.directoryCard}
                      onClick={(e) => handleTocLinkClick(e, item)}
                    >
                      <span className={styles.directoryCardNumber}>
                        {item.title.match(/^\d+(\.\d+)*/)?.[0] || '§'}
                      </span>
                      <span className={styles.directoryCardTitle}>
                        {item.title.replace(/^\d+(\.\d+)*\.\s*/, '')}
                      </span>
                      <span className={styles.directoryCardChevron}>→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Chapter Footer Navigation */}
            <div className={styles.chapterNavigation}>
              {currentChapterIdx > 0 ? (
                <Link
                  href={`/ebooks/${book.id}/read/${chapters[currentChapterIdx - 1].id}`}
                  className={styles.navBtn}
                  scroll={false}
                >
                  <ChevronLeftIcon size={16} /> පෙර පරිච්ඡේදය
                </Link>
              ) : (
                <button className={styles.navBtn} disabled>
                  <ChevronLeftIcon size={16} /> පෙර පරිච්ඡේදය
                </button>
              )}

              <span className={styles.chapterProgressLabel}>
                පරිච්ඡේදය {currentChapterIdx + 1} / {chapters.length}
              </span>

              {currentChapterIdx < chapters.length - 1 ? (
                <Link
                  href={`/ebooks/${book.id}/read/${chapters[currentChapterIdx + 1].id}`}
                  className={styles.navBtn}
                  scroll={false}
                >
                  මීළඟ පරිච්ඡේදය <ChevronRightIcon size={16} />
                </Link>
              ) : (
                <button className={styles.navBtn} disabled>
                  මීළඟ පරිච්ඡේදය <ChevronRightIcon size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Tooltip render */}
          {tooltip && tooltip.visible && (
            <div
              ref={tooltipRef}
              className={`${styles.tooltip} ${tooltip.persistent ? styles.persistent : ''}`}
              style={{
                top: `${tooltip.top}px`,
                left: `${tooltip.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.tooltipHeader}>
                <div className={styles.tooltipMeta}>
                  <span className={styles.tooltipTerm}>{tooltip.term}</span>
                  <span className={`${styles.badge} ${styles[tooltip.language]}`}>
                    {tooltip.language === 'pali' ? 'පාලි' : tooltip.language === 'sanskrit' ? 'සංස්කෘත' : 'සිංහල'}
                  </span>
                </div>
                {tooltip.persistent && (
                  <button className={styles.tooltipCloseBtn} onClick={hideTooltip} title="වසන්න (Close)">
                    ×
                  </button>
                )}
              </div>
              {tooltip.translation && (
                <div className={styles.tooltipTranslation}>{tooltip.translation}</div>
              )}
              <div className={styles.tooltipDefinition}>{tooltip.definition}</div>
              <div className={styles.tooltipArrow} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
