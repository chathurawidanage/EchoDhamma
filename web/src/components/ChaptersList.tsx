'use client';

import { Chapter } from '@/types';
import styles from './ChaptersList.module.css';

interface ChaptersListProps {
  chapters: Chapter[];
  currentTime?: number;
  onChapterClick?: (startTime: number) => void;
}

export default function ChaptersList({ 
  chapters, 
  currentTime = 0, 
  onChapterClick 
}: ChaptersListProps) {
  
  // Find current active chapter index
  const activeIndex = chapters.reduce((acc, ch, idx) => {
    if (currentTime >= ch.startTime) {
      return idx;
    }
    return acc;
  }, 0);

  return (
    <div className={styles.container}>
      <div className={styles.timeline}>
        {chapters.map((chapter, index) => {
          const isActive = index === activeIndex;
          
          return (
            <div 
              key={index}
              className={`${styles.chapterItem} ${isActive ? styles.active : ''} ${chapter.is_qa ? styles.qa : ''}`}
              onClick={() => onChapterClick?.(chapter.startTime)}
              id={`chapter-item-${index}`}
            >
              <div className={styles.markerContainer}>
                <div className={styles.line}></div>
                <div className={styles.dot}></div>
              </div>
              
              <div className={styles.content}>
                <div className={styles.meta}>
                  <span className={styles.timestamp}>{chapter.start_time_str}</span>
                  {chapter.is_qa && <span className={styles.qaBadge}>Q&A</span>}
                </div>
                <h5 className={styles.title}>{chapter.title}</h5>
                {chapter.description && (
                  <p className={styles.description}>{chapter.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
