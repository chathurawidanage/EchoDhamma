'use client';

import { useState } from 'react';
import { Episode } from '@/types';
import EpisodeCard from './EpisodeCard';
import { SearchIcon } from './Icons';
import styles from './EpisodeList.module.css';

interface EpisodeListProps {
  episodes: Episode[];
  theroId: string;
}

export default function EpisodeList({ episodes, theroId }: EpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className={styles.container}>
      <div className={styles.searchRow}>
        <input
          type="text"
          placeholder="දේශනාවල මාතෘකා හෝ විස්තර සොයන්න... (Search episodes...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${styles.searchInput} glass`}
          id="episode-search-input"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')} 
            className={styles.clearBtn}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      <div className={styles.resultsMeta}>
        Found {uniqueEpisodes.length} {uniqueEpisodes.length === 1 ? 'episode' : 'episodes'} 
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {uniqueEpisodes.length > 0 ? (
        <div className={styles.grid}>
          {uniqueEpisodes.map((episode) => (
            <EpisodeCard 
              key={episode.id} 
              episode={episode} 
              theroId={theroId} 
            />
          ))}
        </div>
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
