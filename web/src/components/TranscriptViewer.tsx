'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import styles from './TranscriptViewer.module.css';

interface TranscriptLine {
  seconds: number;
  timeStr: string;
  text: string;
}

interface TranscriptViewerProps {
  transcriptText: string;
  currentTime?: number;
  onTimestampClick?: (seconds: number) => void;
}

export default function TranscriptViewer({
  transcriptText,
  currentTime = 0,
  onTimestampClick,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Parse raw text transcript into structured lines
  const parsedLines = useMemo((): TranscriptLine[] => {
    if (!transcriptText) return [];

    const rawLines = transcriptText.split('\n');
    const lines: TranscriptLine[] = [];

    // Match format: [HH:MM:SS] Text content...
    const lineRegex = /^\[(\d{2}):(\d{2}):(\d{2})\]\s*(.*)$/;

    for (const line of rawLines) {
      const match = line.trim().match(lineRegex);
      if (match) {
        const [_, h, m, s, text] = match;
        const seconds = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
        lines.push({
          seconds,
          timeStr: `${h}:${m}:${s}`,
          text: text.trim(),
        });
      }
    }

    return lines;
  }, [transcriptText]);

  // Find which line is active based on current time
  const activeIndex = useMemo(() => {
    return parsedLines.reduce((acc, line, idx) => {
      if (currentTime >= line.seconds) {
        return idx;
      }
      return acc;
    }, -1);
  }, [parsedLines, currentTime]);

  // Filter lines based on search query
  const filteredLines = useMemo(() => {
    if (!searchQuery) return parsedLines;
    const query = searchQuery.toLowerCase();
    return parsedLines.filter((line) => line.text.toLowerCase().includes(query));
  }, [parsedLines, searchQuery]);

  // Auto-scroll to center the active line
  useEffect(() => {
    if (autoScroll && activeLineRef.current && containerRef.current && !searchQuery) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScroll, searchQuery]);

  // Helper to highlight search matches in text
  const renderHighlightedText = (text: string, query: string) => {
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return (
      <>
        {before}
        <mark className={styles.highlight}>{match}</mark>
        {after}
      </>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.controlsRow}>
        <input
          type="text"
          placeholder="පිටපතෙහි වචන සොයන්න..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${styles.searchInput} glass`}
          id="transcript-search-input"
        />
        {!searchQuery && (
          <label className={styles.scrollToggle}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-Scroll
          </label>
        )}
      </div>

      <div ref={containerRef} className={styles.linesContainer}>
        {filteredLines.length > 0 ? (
          filteredLines.map((line, idx) => {
            const originalIndex = parsedLines.indexOf(line);
            const isActive = originalIndex === activeIndex;

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                className={`${styles.lineItem} ${isActive ? styles.activeLine : ''}`}
                onClick={() => onTimestampClick?.(line.seconds)}
                id={`transcript-line-${originalIndex}`}
              >
                <span className={styles.timestamp}>{line.timeStr}</span>
                <span className={styles.text}>
                  {renderHighlightedText(line.text, searchQuery)}
                </span>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <p>ගැලපෙන වචන කිසිවක් හමු නොවීය. (No matches found)</p>
          </div>
        )}
      </div>
    </div>
  );
}
