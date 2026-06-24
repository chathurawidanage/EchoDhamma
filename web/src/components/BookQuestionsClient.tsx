'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Ebook, Question } from '@/types';
import { SettingsIcon, ChevronLeftIcon, DownloadIcon } from '@/components/Icons';
import { ParsedBook, TocItem } from '@/lib/ebookParser';
import styles from '@/app/ebooks/[book_id]/read/page.module.css';
import { settingsCache } from '@/lib/readerSettingsCache';

interface BookQuestionsClientProps {
  book: Ebook;
  parsedBook: ParsedBook;
  chapterId: string;
}

export default function BookQuestionsClient({ book, parsedBook, chapterId }: BookQuestionsClientProps) {
  const hasPdf = !!book.pdf_url;

  // Q&A Mode State
  const [qaQuestions, setQaQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [incorrectCount, setIncorrectCount] = useState<number>(0);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);

  // Reader/Aesthetics Settings State
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>(() => settingsCache.theme || 'sepia');
  const [fontSize, setFontSize] = useState<number>(() => settingsCache.fontSize || 18);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>(() => settingsCache.fontFamily || 'serif');
  const [isLoaded, setIsLoaded] = useState<boolean>(() => settingsCache.isLoaded || false);

  // Navigation and Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Helper to determine if a TOC item (and its descendants) has questions
  const hasQuestions = (index: number) => {
    const item = parsedBook.toc[index];
    if (!item) return false;
    
    const currentLevelNum = item.level === 'H1' ? 1 : item.level === 'H2' ? 2 : 3;
    
    // Collect all child/descendant TOC IDs
    const targetIds = [item.id];
    for (let i = index + 1; i < parsedBook.toc.length; i++) {
      const nextItem = parsedBook.toc[i];
      const nextLevelNum = nextItem.level === 'H1' ? 1 : nextItem.level === 'H2' ? 2 : 3;
      if (nextLevelNum <= currentLevelNum) {
        break; // Reached next sibling or higher parent
      }
      targetIds.push(nextItem.id);
    }
    
    // Check if any of these target TOC IDs has questions
    const bookQuestions = parsedBook.questions || {};
    return targetIds.some(id => {
      const list = bookQuestions[id];
      return list && Array.isArray(list) && list.length > 0;
    });
  };

  // Load settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('ebook-reader-theme') as 'light' | 'sepia' | 'dark' | null;
    if (savedTheme) setTheme(savedTheme);

    const savedFontSize = localStorage.getItem('ebook-reader-font-size');
    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));

    const savedFontFamily = localStorage.getItem('ebook-reader-font-family') as 'serif' | 'sans' | null;
    if (savedFontFamily) setFontFamily(savedFontFamily);

    // Sync to cache
    settingsCache.theme = savedTheme || 'sepia';
    settingsCache.fontSize = savedFontSize ? parseInt(savedFontSize, 10) : 18;
    settingsCache.fontFamily = savedFontFamily || 'serif';
    settingsCache.isLoaded = true;

    setIsLoaded(true);
  }, []);

  // Save settings when changed (synchronizes with reader page)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('ebook-reader-theme', theme);
    settingsCache.theme = theme;
  }, [theme, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('ebook-reader-font-size', String(fontSize));
    settingsCache.fontSize = fontSize;
  }, [fontSize, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('ebook-reader-font-family', fontFamily);
    settingsCache.fontFamily = fontFamily;
  }, [fontFamily, isLoaded]);

  // Sync activeTocId from chapterId prop
  useEffect(() => {
    if (!parsedBook) return;
    if (chapterId) {
      const match = parsedBook.toc.find(t => t.id === chapterId);
      if (match) {
        setActiveTocId(match.id);
      }
    } else {
      // Find first TOC item that has questions
      const firstWithQuestions = parsedBook.toc.find((_, idx) => hasQuestions(idx));
      if (firstWithQuestions) {
        setActiveTocId(firstWithQuestions.id);
      } else if (parsedBook.toc.length > 0) {
        setActiveTocId(parsedBook.toc[0].id);
      }
    }
  }, [chapterId, parsedBook]);

  // Load questions when activeTocId updates
  useEffect(() => {
    if (activeTocId) {
      loadQuestionsForSection(activeTocId);
    }
  }, [activeTocId]);

  // Load and shuffle questions for the selected section
  const loadQuestionsForSection = (tocId: string) => {
    const tocIndex = parsedBook.toc.findIndex(t => t.id === tocId);
    if (tocIndex === -1) {
      setQaQuestions([]);
      return;
    }

    const clickedItem = parsedBook.toc[tocIndex];
    const targetTocIds = [clickedItem.id];

    const clickedLevelOrder = clickedItem.level === 'H1' ? 1 : clickedItem.level === 'H2' ? 2 : 3;

    for (let i = tocIndex + 1; i < parsedBook.toc.length; i++) {
      const currentItem = parsedBook.toc[i];
      const currentLevelOrder = currentItem.level === 'H1' ? 1 : currentItem.level === 'H2' ? 2 : 3;
      if (currentLevelOrder <= clickedLevelOrder) {
        break;
      }
      targetTocIds.push(currentItem.id);
    }

    const bookQuestions = parsedBook.questions || {};
    const gatheredQuestions: Question[] = [];

    targetTocIds.forEach(id => {
      const list = bookQuestions[id];
      if (list && Array.isArray(list)) {
        gatheredQuestions.push(...list);
      }
    });

    const shuffled = [...gatheredQuestions].sort(() => Math.random() - 0.5);

    const processed = shuffled.map(q => {
      const correctText = q.options[q.correctAnswerIndex];
      const shuffledOpts = [...q.options].sort(() => Math.random() - 0.5);
      const newCorrectIdx = shuffledOpts.indexOf(correctText);
      return {
        ...q,
        options: shuffledOpts,
        correctAnswerIndex: newCorrectIdx
      };
    });

    setQaQuestions(processed);
    setCurrentQuestionIdx(0);
    setSelectedOptionIdx(null);
    setCorrectCount(0);
    setIncorrectCount(0);
    setSessionCompleted(false);
  };

  const handleTocClick = (item: TocItem) => {
    setSidebarOpen(false);
    router.replace(`/ebooks/${book.id}/questions/${item.id}`, { scroll: false });
  };

  const handleOptionSelect = (idx: number) => {
    if (selectedOptionIdx !== null) return;

    setSelectedOptionIdx(idx);
    const question = qaQuestions[currentQuestionIdx];
    if (question) {
      if (idx === question.correctAnswerIndex) {
        setCorrectCount(prev => prev + 1);
      } else {
        setIncorrectCount(prev => prev + 1);
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIdx < qaQuestions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOptionIdx(null);
    } else {
      setSessionCompleted(true);
    }
  };

  const renderQuestionView = () => {
    const question = qaQuestions[currentQuestionIdx];
    if (!question) return null;

    const activeTocItem = parsedBook.toc.find(t => t.id === activeTocId);
    const categoryTitle = activeTocItem ? activeTocItem.title : 'ප්‍රශ්නෝත්තර';

    return (
      <div className={styles.qaCard} key={question.id}>
        <div className={styles.qaHeader}>
          <div className={styles.qaCategoryWrapper}>
            <span className={styles.qaCategory}>{categoryTitle}</span>
            {question.fromBook && (
              <span className={styles.qaBookBadge}>පොතෙන්</span>
            )}
          </div>
          <span className={styles.qaProgress}>
            ප්‍රශ්න {qaQuestions.length} න් {currentQuestionIdx + 1}
          </span>
        </div>

        <h3 className={styles.qaQuestion}>{question.question}</h3>

        <div className={styles.qaOptions}>
          {question.options.map((option, idx) => {
            const isSelected = selectedOptionIdx === idx;
            const isCorrect = idx === question.correctAnswerIndex;
            const hasAnswered = selectedOptionIdx !== null;

            let optionClass = styles.qaOption;
            if (hasAnswered) {
              if (isCorrect) {
                optionClass += ` ${styles.qaOptionCorrect}`;
              } else if (isSelected) {
                optionClass += ` ${styles.qaOptionIncorrect}`;
              } else {
                optionClass += ` ${styles.qaOptionDimmed}`;
              }
            }

            return (
              <button
                key={idx}
                className={optionClass}
                onClick={() => handleOptionSelect(idx)}
                disabled={hasAnswered}
              >
                <span>{option}</span>
                {hasAnswered && isCorrect && (
                  <span className={styles.qaIcon} style={{ color: '#10b981' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                )}
                {hasAnswered && isSelected && !isCorrect && (
                  <span className={styles.qaIcon} style={{ color: '#ef4444' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedOptionIdx !== null && (
          <div className={styles.qaExplanation}>
            <div className={styles.qaExplanationTitle}>පැහැදිලි කිරීම</div>
            <p className={styles.qaExplanationText}>{question.explanation}</p>
          </div>
        )}

        <div className={styles.qaFooter}>
          {selectedOptionIdx !== null && (
            <button className={styles.qaNextBtn} onClick={handleNextQuestion}>
              {currentQuestionIdx < qaQuestions.length - 1 ? 'මීළඟ ප්‍රශ්නය' : 'අවසන් කරන්න'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '0.25rem' }}>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderResultsView = () => {
    const totalQuestions = qaQuestions.length;
    const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (scorePct / 100) * circumference;

    return (
      <div className={styles.qaCard}>
        <div className={styles.qaResults}>
          <h2 className={styles.qaResultsTitle}>ප්‍රතිඵල සාරාංශය</h2>

          <div className={styles.qaScoreRing}>
            <svg className={styles.qaScoreCircleSvg} width="140" height="140">
              <circle
                className={styles.qaScoreCircleBg}
                cx="70"
                cy="70"
                r={radius}
              />
              <circle
                className={styles.qaScoreCircleVal}
                cx="70"
                cy="70"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <span className={styles.qaScoreText}>{scorePct}%</span>
          </div>

          <div className={styles.qaStats}>
            <div className={styles.qaStatItem}>
              <span className={`${styles.qaStatVal} ${styles.qaStatValCorrect}`}>{correctCount}</span>
              <span className={styles.qaStatLabel}>නිවැරදි පිළිතුරු</span>
            </div>
            <div className={styles.qaStatItem}>
              <span className={`${styles.qaStatVal} ${styles.qaStatValIncorrect}`}>{incorrectCount}</span>
              <span className={styles.qaStatLabel}>වැරදි පිළිතුරු</span>
            </div>
            <div className={styles.qaStatItem}>
              <span className={styles.qaStatVal}>{totalQuestions}</span>
              <span className={styles.qaStatLabel}>මුළු ප්‍රශ්න ගණන</span>
            </div>
          </div>

          <button className={styles.qaRestartBtn} onClick={() => loadQuestionsForSection(activeTocId || '')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            නැවත ආරම්භ කරන්න
          </button>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => {
    return (
      <div className={styles.qaCard}>
        <div className={styles.qaEmptyState}>
          <div style={{ color: 'var(--accent-gold)', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <h3 className={styles.qaEmptyTitle}>ප්‍රශ්න සූදානම් කර නොමැත</h3>
          <p className={styles.qaEmptyText}>
            මෙම කොටස සඳහා ප්‍රශ්න තවම සූදානම් කර නැත.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      id="questions-container"
      className={`${styles.container} ${styles[theme]} ${sidebarOpen ? styles.sidebarActive : ''}`}
      style={{
        '--reader-font-size': `${fontSize}px`,
      } as any}
    >
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
             <Link
              href={`/ebooks/${book.id}/read/${activeTocId || 'titlepage'}`}
              className={styles.tabBtn}
            >
              කියවන්න
            </Link>
            <span className={`${styles.tabBtn} ${styles.activeTab}`}>
              ප්‍රශ්නෝත්තර
            </span>
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
              {parsedBook.toc.map((item, idx) => {
                if (!hasQuestions(idx)) return null;
                return (
                  <li
                    key={`${item.id}-${idx}`}
                    className={`${styles.tocItem} ${styles[`level${item.level}`]} ${activeTocId === item.id ? styles.activeTocItem : ''
                      }`}
                  >
                    <Link
                      href={`/ebooks/${book.id}/questions/${item.id}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
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

        {/* Display Panel */}
        <main
          className={`${styles.readerPane} ${fontFamily === 'serif' ? styles.serif : styles.sans}`}
        >
          <div className={styles.qaContainer}>
            {sessionCompleted ? (
              renderResultsView()
            ) : qaQuestions.length > 0 ? (
              renderQuestionView()
            ) : (
              renderEmptyState()
            )}
          </div>
        </main>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('ebook-reader-theme') || 'sepia';
                var fontSize = localStorage.getItem('ebook-reader-font-size') || '18';
                var fontFamily = localStorage.getItem('ebook-reader-font-family') || 'serif';
                
                var el = document.getElementById('questions-container');
                if (el) {
                  // Apply theme class
                  var themeClasses = {
                    light: '${styles.light || ""}',
                    sepia: '${styles.sepia || ""}',
                    dark: '${styles.dark || ""}'
                  };
                  var activeClass = themeClasses[theme];
                  if (activeClass) {
                    var classesToRemove = [themeClasses.light, themeClasses.sepia, themeClasses.dark].filter(Boolean);
                    var currentClasses = el.className.split(' ');
                    var newClasses = currentClasses.filter(function(c) {
                      return classesToRemove.indexOf(c) === -1;
                    });
                    newClasses.push(activeClass);
                    el.className = newClasses.join(' ');
                  }
                  
                  // Apply inline styles for font size
                  el.style.setProperty('--reader-font-size', fontSize + 'px');
                  
                  // Apply font family to readerPane
                  var mainEl = el.querySelector('main');
                  if (mainEl) {
                    var fontClasses = {
                      serif: '${styles.serif || ""}',
                      sans: '${styles.sans || ""}'
                    };
                    
                    var activeFontClass = fontClasses[fontFamily];
                    if (activeFontClass) {
                      var fontToRemove = [fontClasses.serif, fontClasses.sans].filter(Boolean);
                      var mainClasses = mainEl.className.split(' ');
                      var newMainClasses = mainClasses.filter(function(c) {
                        return fontToRemove.indexOf(c) === -1;
                      });
                      newMainClasses.push(activeFontClass);
                      mainEl.className = newMainClasses.join(' ');
                    }
                  }
                }
              } catch (e) {}
            })();
          `
        }}
      />
    </div>
  );
}
