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
  PocketCastsIcon
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

  const providers = thero.podcast.providers || {};
  const queryTitle = encodeURIComponent(thero.name);
  
  const spotifyUrl = providers.spotify || `https://open.spotify.com/search/${queryTitle}`;
  const appleUrl = providers.apple || `https://podcasts.apple.com/us/search?term=${queryTitle}`;
  const amazonUrl = providers.amazon || `https://music.amazon.com/search/${queryTitle}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← මුල් පිටුවට <span className="english-sub">Back to Home</span>
        </Link>
      </header>

      <div className={styles.profileSection}>
        <div className={styles.avatar}>
          {thero.podcast.image_url ? (
            <img 
              src={thero.podcast.image_url.startsWith('http') ? thero.podcast.image_url : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`} 
              alt={thero.name_sinhala || thero.name}
              className={styles.avatarImg}
            />
          ) : (
            initialLetters
          )}
        </div>
        
        <div className={styles.profileInfo}>
          <h1 className={styles.theroName}>
            {thero.name_sinhala || thero.name}
            {thero.name_sinhala && (
              <span className={styles.englishNameSub}>{thero.name}</span>
            )}
          </h1>
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
              href={spotifyUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.spotify}`}
              id="platform-spotify-btn"
            >
              <SpotifyIcon size={16} /> Spotify
            </a>
            
            <a 
              href={appleUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.apple}`}
              id="platform-apple-btn"
            >
              <ApplePodcastIcon size={16} /> Apple Podcast
            </a>

            <a 
              href={amazonUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`${styles.platformBtn} ${styles.amazon}`}
              id="platform-amazon-btn"
            >
              <AmazonMusicIcon size={16} /> Amazon Music
            </a>

            {providers.pocketcasts && (
              <a 
                href={providers.pocketcasts} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`${styles.platformBtn} ${styles.pocket}`}
                id="platform-pocket-btn"
              >
                <PocketCastsIcon size={16} /> Pocket Casts
              </a>
            )}
          </div>
        </div>
      </div>

      <section className={styles.episodesSection}>
        <h4 className={styles.sectionTitle}>
          ධර්ම දේශනා එකතුව <span className="english-sub">Episodes</span>
        </h4>
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

  const displayName = thero.name_sinhala 
    ? `${thero.name_sinhala} (${thero.name})` 
    : thero.name;

  return {
    title: `${displayName} | DamSak.org`,
    description: thero.podcast.description.substring(0, 160),
    openGraph: {
      title: `${displayName} | DamSak.org`,
      description: thero.podcast.description.substring(0, 160),
      images: [{ url: logoUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} | DamSak.org`,
      description: thero.podcast.description.substring(0, 160),
      images: [logoUrl],
    },
  };
}
