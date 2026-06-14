import Link from 'next/link';
import { Episode } from '@/types';
import { Card, Badge } from './UI';
import { formatDate, formatDuration } from '@/utils/format';
import { ClockIcon } from './Icons';
import styles from './EpisodeCard.module.css';

interface EpisodeCardProps {
  episode: Episode;
  theroId: string;
}

export default function EpisodeCard({ episode, theroId }: EpisodeCardProps) {
  // Strip any inline HTML tag highlights in case they are set in descriptions
  const cleanDescription = episode.description
    ? episode.description.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
    : '';

  return (
    <Link
      href={`/podcast/${theroId}/${episode.id}`}
      className={styles.cardLink}
      id={`episode-details-btn-${episode.id}`}
    >
      <Card className={styles.card}>
        <div className={styles.metaRow}>
          <span className={styles.date}>{formatDate(episode.pub_date)}</span>
          <Badge variant="secondary" className={styles.durationBadge}>
            <ClockIcon size={14} /> {formatDuration(episode.duration)}
          </Badge>
        </div>

        <h4 className={styles.title} title={episode.display_title || episode.title}>
          {episode.display_title || episode.title}
        </h4>

        <p className={styles.description}>{cleanDescription}</p>

        <div className={styles.footerRow}>
          <span className={styles.detailsLink}>
            දේශනාවට සවන් දෙන්න →
          </span>
        </div>
      </Card>
    </Link>
  );
}
