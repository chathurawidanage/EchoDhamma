import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTheroById } from '@/utils/theros.server';
import { getTheroS3BaseUrl } from '@/utils/theros';
import { fetchPodcastFeed } from '@/utils/rssParser';
import EpisodeList from '@/components/EpisodeList';
import { 
  YoutubeIcon, 
  SpotifyIcon, 
  ApplePodcastIcon, 
  AmazonMusicIcon, 
  RssIcon 
} from '@/components/Icons';
import styles from './page.module.css';

interface TheroPageProps {
  params: Promise<{ thero_id: string }>;
}

export default async function TheroPage({ params }: TheroPageProps) {
  const { thero_id } = await params;
  const thero = getTheroById(thero_id);

  if (!thero) {
    notFound();
  }

  // Resolve RSS URL from config or S3 fallback
  const rssUrl = thero.rss || `${getTheroS3BaseUrl(thero)}/${thero.rss_filename}`;
  
  // Fetch episodes from S3 XML
  const episodes = await fetchPodcastFeed(rssUrl);

  const initialLetters = thero.name
    .split(' ')
    .filter(n => !n.startsWith('Ven.') && !n.startsWith('Thero') && !n.startsWith('අති') && !n.startsWith('පූජ්‍ය'))
    .map(n => n[0])
    .join('') || 'Ven';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← මුල් පිටුවට (Back to Home)
        </Link>
      </header>

      <div className={styles.profileSection}>
        <div className={styles.avatar}>
          {thero.podcast.image_url ? (
            <img 
              src={thero.podcast.image_url.startsWith('http') ? thero.podcast.image_url : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`} 
              alt={thero.name}
              className={styles.avatarImg}
            />
          ) : (
            initialLetters
          )}
        </div>
        
        <div className={styles.profileInfo}>
          <h1 className={styles.theroName}>{thero.name}</h1>
          <h3 className={styles.podcastTitle}>{thero.podcast.title}</h3>
          <p className={styles.podcastDesc}>{thero.podcast.description}</p>
          
          <div className={styles.platformRow}>
            {thero.youtube_channel_urls?.[0] && (
              <a 
                href={thero.youtube_channel_urls[0]} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`${styles.platformBtn} ${styles.youtube}`}
                id="platform-youtube-btn"
              >
                <YoutubeIcon size={16} /> watch on youtube
              </a>
            )}
            
            <a 
              href={`https://open.spotify.com/search/${encodeURIComponent(thero.podcast.title)}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.spotify}`}
              id="platform-spotify-btn"
            >
              <SpotifyIcon size={16} /> Spotify
            </a>
            
            <a 
              href={`https://podcasts.apple.com/us/search?term=${encodeURIComponent(thero.podcast.title)}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.apple}`}
              id="platform-apple-btn"
            >
              <ApplePodcastIcon size={16} /> Apple Podcast
            </a>

            <a 
              href={`https://music.amazon.com/search/${encodeURIComponent(thero.podcast.title)}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.amazon}`}
              id="platform-amazon-btn"
            >
              <AmazonMusicIcon size={16} /> Amazon Music
            </a>

            <a 
              href={rssUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.rss}`}
              id="platform-rss-btn"
            >
              <RssIcon size={16} /> RSS Feed
            </a>
          </div>
        </div>
      </div>

      <section className={styles.episodesSection}>
        <h4 className={styles.sectionTitle}>ධර්ම දේශනා එකතුව (Episodes)</h4>
        <EpisodeList episodes={episodes} theroId={thero_id} />
      </section>
    </div>
  );
}

export async function generateMetadata({ params }: TheroPageProps) {
  const { thero_id } = await params;
  const thero = getTheroById(thero_id);
  if (!thero) {
    return { title: 'Thero Not Found' };
  }

  const logoUrl = thero.podcast.image_url.startsWith('http')
    ? thero.podcast.image_url
    : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`;

  return {
    title: `${thero.name} - ${thero.podcast.title} | EchoDhamma`,
    description: thero.podcast.description.substring(0, 160),
    openGraph: {
      title: `${thero.name} | EchoDhamma`,
      description: thero.podcast.description.substring(0, 160),
      images: [{ url: logoUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${thero.name} | EchoDhamma`,
      description: thero.podcast.description.substring(0, 160),
      images: [logoUrl],
    },
  };
}
