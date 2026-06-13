'use client';

import { useState, useRef, useEffect } from 'react';
import { Episode } from '@/types';
import EpisodeCard from './EpisodeCard';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import styles from './EpisodeList.module.css';

interface EpisodeListProps {
  episodes: Episode[];
  theroId: string;
}

export default function EpisodeList({ episodes, theroId }: EpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter episodes based on title or description search
  const filteredEpisodes = episodes.filter((episode) => {
    const query = searchQuery.toLowerCase();
    const titleMatch = (episode.display_title || episode.title || '').toLowerCase().includes(query);
    const descMatch = (episode.description || '').toLowerCase().includes(query);
    return titleMatch || descMatch;
  });

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
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Ensure current page is valid when totalPages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Handle page change with smooth scroll to top of list
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  // Get paginated slice
  const paginatedEpisodes = uniqueEpisodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Generate page numbers array with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      let adjustedStart = start;
      let adjustedEnd = end;
      if (currentPage <= 3) {
        adjustedEnd = 4;
      } else if (currentPage >= totalPages - 2) {
        adjustedStart = totalPages - 3;
      }
      for (let i = adjustedStart; i <= adjustedEnd; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
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
        {totalPages > 1 && ` (Showing page ${currentPage} of ${totalPages})`}
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
              <div className={styles.perPageSelector}>
                <span>පෙන්වන ප්‍රමාණය:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className={`${styles.selectInput} glass`}
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                </select>
              </div>

              <div className={styles.pageButtons}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`${styles.pageBtn} ${styles.navBtn} glass`}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon size={18} />
                </button>

                {pageNumbers.map((pageNum, idx) => {
                  if (pageNum === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={`page-${pageNum}`}
                      onClick={() => handlePageChange(pageNum as number)}
                      className={`${styles.pageBtn} ${currentPage === pageNum ? styles.activePage : ''} glass`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`${styles.pageBtn} ${styles.navBtn} glass`}
                  aria-label="Next page"
                >
                  <ChevronRightIcon size={18} />
                </button>
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
