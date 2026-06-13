'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Ebook } from '@/types';
import { DownloadIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from '@/components/Icons';
import { ParsedBook, TocItem } from '@/lib/ebookParser';
import styles from '@/app/ebooks/[book_id]/read/page.module.css';

interface BookReaderClientProps {
  book: Ebook;
  parsedBook: ParsedBook | null;
}

export default function BookReaderClient({ book, parsedBook }: BookReaderClientProps) {
  // Determine if HTML mode is available
  const hasHtml = !!parsedBook;
  const hasPdf = !!book.pdf_url;
  const [activeTab, setActiveTab] = useState<'html' | 'pdf'>(hasHtml ? 'html' : 'pdf');

  // Reader Settings State
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>('sepia');
  const [fontSize, setFontSize] = useState<number>(18);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [lineHeight, setLineHeight] = useState<number>(1.6);
  const [textWidth, setTextWidth] = useState<'narrow' | 'medium' | 'wide'>('medium');

  // Navigation and Layout State
  const [currentChapterId, setCurrentChapterId] = useState<string>('titlepage');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [scrollPercentage, setScrollPercentage] = useState<number>(0);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);

  const readerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Load settings and last read chapter on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

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

    // Restore last read chapter for this book
    const savedChapter = localStorage.getItem(`ebook-last-chapter-${book.id}`);
    if (savedChapter && parsedBook) {
      const chapterExists = parsedBook.chapters.some(c => c.id === savedChapter);
      if (chapterExists) {
        setCurrentChapterId(savedChapter);
      }
    }
  }, [book.id, parsedBook]);

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem('ebook-reader-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ebook-reader-font-size', String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('ebook-reader-font-family', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('ebook-reader-line-height', String(lineHeight));
  }, [lineHeight]);

  useEffect(() => {
    localStorage.setItem('ebook-reader-text-width', textWidth);
  }, [textWidth]);

  // Track current chapter to restore position
  useEffect(() => {
    if (hasHtml && currentChapterId) {
      localStorage.setItem(`ebook-last-chapter-${book.id}`, currentChapterId);
    }
  }, [currentChapterId, book.id, hasHtml]);

  // Clean up scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Sync scroll position tracking and active section highlighting
  const handleScroll = () => {
    if (!readerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = readerRef.current;

    // Save scroll offset for resuming in the same chapter
    localStorage.setItem(`ebook-scroll-${book.id}-${currentChapterId}`, String(scrollTop));

    const totalScrollable = scrollHeight - clientHeight;
    if (totalScrollable > 0) {
      const pct = (scrollTop / totalScrollable) * 100;
      setScrollPercentage(pct);
    } else {
      setScrollPercentage(0);
    }

    // Debounce active section highlight update on manual scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (!parsedBook || !readerRef.current) return;

      const currentChapterToc = parsedBook.toc.filter(t => t.chapterId === currentChapterId);
      if (currentChapterToc.length === 0) return;

      const containerTop = readerRef.current.getBoundingClientRect().top;
      const containerBottom = readerRef.current.getBoundingClientRect().bottom;

      const visibleHeadings: typeof currentChapterToc = [];
      const headingsAbove: typeof currentChapterToc = [];

      currentChapterToc.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Element is visible if it intersects the reader viewport bounds (with a small 10px buffer)
          const isVisible = rect.bottom > containerTop + 10 && rect.top < containerBottom - 10;
          
          if (isVisible) {
            visibleHeadings.push(item);
          } else if (rect.top <= containerTop + 10) {
            headingsAbove.push(item);
          }
        }
      });

      let activeId = currentChapterToc[0].id; // Fallback to first section of the chapter

      if (visibleHeadings.length > 0) {
        // Highlight the first visible heading on the screen (highest in TOC order)
        activeId = visibleHeadings[0].id;
      } else if (headingsAbove.length > 0) {
        // Highlight the last heading scrolled past (above the viewport)
        activeId = headingsAbove[headingsAbove.length - 1].id;
      }

      setActiveTocId(activeId);
    }, 150);
  };

  // Restore scroll position when chapter changes
  useEffect(() => {
    if (!hasHtml || !readerRef.current) return;

    // If there is a pending scroll ID, let the other effect handle it.
    // Do NOT restore the old saved scroll position.
    if (pendingScrollId) {
      return;
    }

    const savedScroll = localStorage.getItem(`ebook-scroll-${book.id}-${currentChapterId}`);
    if (savedScroll) {
      readerRef.current.scrollTop = parseFloat(savedScroll);
    } else {
      readerRef.current.scrollTop = 0;
    }
  }, [currentChapterId, book.id, hasHtml]);

  // Handle scrolling to a specific target within a chapter
  useEffect(() => {
    if (!hasHtml || !pendingScrollId || !readerRef.current) return;

    const timer = setTimeout(() => {
      const element = document.getElementById(pendingScrollId);
      if (element && readerRef.current) {
        const containerTop = readerRef.current.getBoundingClientRect().top;
        const elementTop = element.getBoundingClientRect().top;
        const relativeOffset = elementTop - containerTop + readerRef.current.scrollTop;

        readerRef.current.scrollTo({
          top: relativeOffset - 24, // 24px padding at the top
          behavior: 'smooth'
        });
      }
      setPendingScrollId(null);
    }, 100);

    return () => clearTimeout(timer);
  }, [pendingScrollId, hasHtml]);

  // Listen to url query updates e.g. when deep-linked
  useEffect(() => {
    if (!parsedBook) return;
    const chapterParam = searchParams.get('chapter');
    if (chapterParam) {
      const match = parsedBook.toc.find(t => t.id === chapterParam);
      if (match) {
        setCurrentChapterId(match.chapterId);
        setPendingScrollId(match.id);
        setActiveTocId(match.id);
      } else {
        const chapterMatch = parsedBook.chapters.find(c => c.id === chapterParam);
        if (chapterMatch) {
          setCurrentChapterId(chapterMatch.id);
          const firstToc = parsedBook.toc.find(t => t.chapterId === chapterMatch.id);
          setActiveTocId(firstToc ? firstToc.id : null);
        }
      }
    } else {
      // If no query param, default to the current chapter's first TOC item
      const firstToc = parsedBook.toc.find(t => t.chapterId === currentChapterId);
      setActiveTocId(firstToc ? firstToc.id : null);
    }
  }, [searchParams, parsedBook, currentChapterId]);

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
          behavior: 'smooth'
        });
      }
    } else {
      // Different chapter - set pending scroll and change chapter
      setCurrentChapterId(item.chapterId);
      setPendingScrollId(item.id);
    }
    setSidebarOpen(false);

    // Update query param
    const params = new URLSearchParams(window.location.search);
    params.set('chapter', item.id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Handle in-book link interceptions
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
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
            } else if (parsedBook) {
              // Try to find if this id exists inside any chapter
              // Fallback scanning
              const targetChapter = parsedBook.chapters.find(c => c.content.includes(`id="${id}"`) || c.content.includes(`id='${id}'`));
              if (targetChapter) {
                setCurrentChapterId(targetChapter.id);
                setPendingScrollId(id);
              }
            }
          }
        }
      }
    }
  };

  const isPdfView = !hasHtml || activeTab === 'pdf';
  if (isPdfView) {
    return (
      <div className={styles.container}>
        <header className={`${styles.header} glass`}>
          <div className={styles.left}>
            <Link href="/ebooks" className={styles.backLink}>
              ← ග්‍රන්ථ එකතුවට (Back)
            </Link>
            <div className={styles.titleInfo}>
              <h1 className={styles.bookTitle}>{book.title}</h1>
              <span className={styles.bookAuthor}>{book.author}</span>
            </div>
          </div>

          {hasHtml && hasPdf && (
            <div className={styles.tabContainer}>
              <button
                onClick={() => setActiveTab('html')}
                className={`${styles.tabBtn} ${(activeTab as string) === 'html' ? styles.activeTab : ''}`}
              >
                HTML කියවනය
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`${styles.tabBtn} ${(activeTab as string) === 'pdf' ? styles.activeTab : ''}`}
              >
                PDF කියවනය
              </button>
            </div>
          )}

          <div className={styles.right}>
            {book.epub_url && (
              <a
                href={book.epub_url}
                download
                className={styles.actionBtn}
                style={{ marginRight: '0.5rem' }}
                id="reader-download-epub"
              >
                <DownloadIcon size={14} /> EPUB බාගත කරන්න
              </a>
            )}
            {book.pdf_url && (
              <a
                href={book.pdf_url}
                download
                className={styles.actionBtn}
                id="reader-download-pdf"
              >
                <DownloadIcon size={14} /> PDF බාගත කරන්න
              </a>
            )}
          </div>
        </header>
        <main className={styles.readerWrapper}>
          {book.pdf_url && (
            <iframe
              src={`${book.pdf_url}#toolbar=1`}
              title={book.title}
              className={styles.pdfIframe}
            />
          )}
        </main>
      </div>
    );
  }

  // HTML Native Reader Layout
  const chapters = parsedBook.chapters;
  const currentChapterIdx = chapters.findIndex(c => c.id === currentChapterId);
  const activeChapter = chapters[currentChapterIdx >= 0 ? currentChapterIdx : 0];

  const handlePrevChapter = () => {
    if (currentChapterIdx > 0) {
      const prev = chapters[currentChapterIdx - 1];
      setCurrentChapterId(prev.id);
      if (readerRef.current) readerRef.current.scrollTop = 0;
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIdx < chapters.length - 1) {
      const next = chapters[currentChapterIdx + 1];
      setCurrentChapterId(next.id);
      if (readerRef.current) readerRef.current.scrollTop = 0;
    }
  };

  return (
    <div
      className={`${styles.container} ${styles[theme]} ${sidebarOpen ? styles.sidebarActive : ''}`}
      style={{
        '--reader-font-size': `${fontSize}px`,
        '--reader-line-height': lineHeight,
      } as any}
    >
      {/* Top Reading Progress Bar */}
      <div className={styles.progressBar} style={{ width: `${scrollPercentage}%` }} />

      {/* Reader Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.left}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`${styles.actionBtn} ${styles.tocToggleBtn}`}
            title="පටුන (Table of Contents)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            පටුන (TOC)
          </button>
          
          <Link href="/ebooks" className={styles.backLink}>
            ← ග්‍රන්ථ එකතුවට
          </Link>
          
          <div className={styles.titleInfo}>
            <h1 className={styles.bookTitle}>{book.title}</h1>
            <span className={styles.bookAuthor}>{book.author}</span>
          </div>
        </div>

        {hasHtml && hasPdf && (
          <div className={styles.tabContainer}>
            <button
              onClick={() => setActiveTab('html')}
              className={`${styles.tabBtn} ${(activeTab as string) === 'html' ? styles.activeTab : ''}`}
            >
              HTML කියවනය
            </button>
            <button
              onClick={() => setActiveTab('pdf')}
              className={`${styles.tabBtn} ${(activeTab as string) === 'pdf' ? styles.activeTab : ''}`}
            >
              PDF කියවනය
            </button>
          </div>
        )}

        <div className={styles.right}>
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
                  className={`${styles.tocItem} ${styles[`level${item.level}`]} ${
                    activeTocId === item.id ? styles.activeTocItem : ''
                  }`}
                >
                  <button onClick={() => handleTocClick(item)}>
                    {item.title}
                  </button>
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
          </div>
        )}

        {/* Reader Display Panel */}
        <main
          className={`${styles.readerPane} ${fontFamily === 'serif' ? styles.serif : styles.sans} ${
            styles[`width-${textWidth}`]
          }`}
          ref={readerRef}
          onScroll={handleScroll}
        >
          <div className={styles.readingArea} onClick={handleContentClick}>
            {/* Title / Cover Header if first page */}
            {activeChapter.id === 'titlepage' && (
              <div className={styles.chapterCover}>
                <h1 className={styles.coverTitle}>{book.title}</h1>
                <h3 className={styles.coverAuthor}>{book.author}</h3>
              </div>
            )}

            <article
              className={styles.articleContent}
              dangerouslySetInnerHTML={{ __html: activeChapter.content }}
            />

            {/* Chapter Footer Navigation */}
            <div className={styles.chapterNavigation}>
              <button
                className={styles.navBtn}
                onClick={handlePrevChapter}
                disabled={currentChapterIdx <= 0}
              >
                <ChevronLeftIcon size={16} /> පෙර පරිච්ඡේදය
              </button>
              
              <span className={styles.chapterProgressLabel}>
                පරිච්ඡේදය {currentChapterIdx + 1} / {chapters.length}
              </span>

              <button
                className={styles.navBtn}
                onClick={handleNextChapter}
                disabled={currentChapterIdx >= chapters.length - 1}
              >
                මීළඟ පරිච්ඡේදය <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
