'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Episode } from '@/types';
import EpisodeCard from './EpisodeCard';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import styles from './EpisodeList.module.css';

const ITEMS_PER_PAGE = 24;

interface EpisodeListProps {
  episodes: Episode[];
  theroId: string;
  currentPage?: number;
}

export default function EpisodeList({ episodes, theroId, currentPage = 1 }: EpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSearching = searchQuery.trim().length > 0;

  // Filter episodes based on title or description search
  const filteredEpisodes = isSearching
    ? episodes.filter((episode) => {
        const query = searchQuery.toLowerCase();
        const titleMatch = (episode.display_title || episode.title || '').toLowerCase().includes(query);
        const descMatch = (episode.description || '').toLowerCase().includes(query);
        return titleMatch || descMatch;
      })
    : episodes;

  // Deduplicate episodes by ID to prevent duplicate React keys
  const seenIds = new Set<string>();
  const uniqueEpisodes = filteredEpisodes.filter((episode) => {
    if (seenIds.has(episode.id)) {
      return false;
    }
    seenIds.add(episode.id);
    return true;
  });

  const totalItems = uniqueEpisodes.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Active page depends on whether we are searching or in standard URL pagination mode
  const activePage = isSearching
    ? Math.min(Math.max(1, searchPage), totalPages || 1)
    : Math.min(Math.max(1, currentPage), totalPages || 1);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchPage(1);
  };

  const handleSearchPageChange = (page: number) => {
    setSearchPage(page);
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Get paginated slice
  const paginatedEpisodes = uniqueEpisodes.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  const getPageUrl = (pageNum: number) => {
    return pageNum === 1 ? `/podcast/${theroId}` : `/podcast/${theroId}?page=${pageNum}`;
  };

  // Generate page numbers array with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (activePage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, activePage - 1);
      const end = Math.min(totalPages - 1, activePage + 1);
      let adjustedStart = start;
      let adjustedEnd = end;
      if (activePage <= 3) {
        adjustedEnd = 4;
      } else if (activePage >= totalPages - 2) {
        adjustedStart = totalPages - 3;
      }
      for (let i = adjustedStart; i <= adjustedEnd; i++) {
        pages.push(i);
      }
      if (activePage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.searchRow}>
        <input
          type="text"
          placeholder="දේශනාවල මාතෘකා හෝ විස්තර සොයන්න..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={`${styles.searchInput} glass`}
          id="episode-search-input"
        />
        {searchQuery && (
          <button
            onClick={() => handleSearchChange('')}
            className={styles.clearBtn}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      <div className={styles.resultsMeta}>
        Found {totalItems} {totalItems === 1 ? 'episode' : 'episodes'}
        {searchQuery && ` matching "${searchQuery}"`}
        {totalPages > 1 && ` (Showing page ${activePage} of ${totalPages})`}
      </div>

      {paginatedEpisodes.length > 0 ? (
        <>
          <div className={styles.grid}>
            {paginatedEpisodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                theroId={theroId}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationControls}>
              <div className={styles.pageButtons}>
                {/* Previous Page Button */}
                {isSearching ? (
                  <button
                    onClick={() => handleSearchPageChange(activePage - 1)}
                    disabled={activePage === 1}
                    className={`${styles.pageBtn} ${styles.navBtn} ${activePage === 1 ? styles.disabledBtn : ''}`}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon size={18} />
                  </button>
                ) : activePage > 1 ? (
                  <Link
                    href={getPageUrl(activePage - 1)}
                    scroll={true}
                    className={`${styles.pageBtn} ${styles.navBtn}`}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon size={18} />
                  </Link>
                ) : (
                  <span className={`${styles.pageBtn} ${styles.navBtn} ${styles.disabledBtn}`} aria-hidden="true">
                    <ChevronLeftIcon size={18} />
                  </span>
                )}

                {/* Page Numbers */}
                {pageNumbers.map((pageNum, idx) => {
                  if (pageNum === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                        ...
                      </span>
                    );
                  }

                  const num = pageNum as number;
                  const isActive = activePage === num;

                  if (isSearching) {
                    return (
                      <button
                        key={`page-${num}`}
                        onClick={() => handleSearchPageChange(num)}
                        className={`${styles.pageBtn} ${isActive ? styles.activePage : ''}`}
                      >
                        {num}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={`page-${num}`}
                      href={getPageUrl(num)}
                      scroll={true}
                      className={`${styles.pageBtn} ${isActive ? styles.activePage : ''}`}
                    >
                      {num}
                    </Link>
                  );
                })}

                {/* Next Page Button */}
                {isSearching ? (
                  <button
                    onClick={() => handleSearchPageChange(activePage + 1)}
                    disabled={activePage === totalPages}
                    className={`${styles.pageBtn} ${styles.navBtn} ${activePage === totalPages ? styles.disabledBtn : ''}`}
                    aria-label="Next page"
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                ) : activePage < totalPages ? (
                  <Link
                    href={getPageUrl(activePage + 1)}
                    scroll={true}
                    className={`${styles.pageBtn} ${styles.navBtn}`}
                    aria-label="Next page"
                  >
                    <ChevronRightIcon size={18} />
                  </Link>
                ) : (
                  <span className={`${styles.pageBtn} ${styles.navBtn} ${styles.disabledBtn}`} aria-hidden="true">
                    <ChevronRightIcon size={18} />
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={`${styles.emptyState} glass`}>
          <div className={styles.emptyIcon}>
            <SearchIcon size={40} />
          </div>
          <h4>දේශනා කිසිවක් හමු නොවීය</h4>
          <p>ඔබ සොයන වචන පරීක්ෂා කර නැවත උත්සාහ කරන්න.</p>
        </div>
      )}
    </div>
  );
}
