import { notFound } from 'next/navigation';
import { getTheroById } from '@/utils/theros.server';
import { getTheroS3BaseUrl } from '@/utils/theros';
import { fetchPodcastFeed } from '@/utils/rssParser';
import { fetchEpisodeChapters, fetchEpisodeTranscript } from '@/utils/s3';
import EpisodeDetailView from '@/components/EpisodeDetailView';
import { 
  getAppleEpisodeLinks, 
  getPocketCastsEpisodeLinks, 
  getSpotifyEpisodeLinks 
} from '@/utils/episodeLinks';

interface EpisodePageProps {
  params: Promise<{ thero_id: string; episode_id: string }>;
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { thero_id, episode_id } = await params;
  const thero = getTheroById(thero_id);

  if (!thero) {
    notFound();
  }

  // Resolve RSS URL from config or S3 fallback
  const rssUrl = thero.rss || `${getTheroS3BaseUrl(thero)}/${thero.rss_filename}`;
  const episodes = await fetchPodcastFeed(rssUrl);

  const episode = episodes.find((e) => e.id === episode_id);

  if (!episode) {
    notFound();
  }

  // Fetch optional chapters and transcripts from S3
  const [chapters, transcript] = await Promise.all([
    fetchEpisodeChapters(thero, episode_id),
    fetchEpisodeTranscript(thero, episode_id),
  ]);

  // Resolve direct podcast platform links
  const providers = thero.podcast.providers || {};
  const directLinks = {
    apple: '',
    spotify: '',
    pocketcasts: '',
    amazon: '',
  };

  const mp3Filename = episode.url.split('/').pop() || '';
  const episodeTitleLower = episode.title.trim().toLowerCase();
  const displayTitleLower = (episode.display_title || '').trim().toLowerCase();

  const [appleMap, pocketcastsMap, spotifyMap] = await Promise.all([
    providers.apple ? getAppleEpisodeLinks(providers.apple) : Promise.resolve<Record<string, string>>({}),
    providers.pocketcasts ? getPocketCastsEpisodeLinks(providers.pocketcasts) : Promise.resolve<Record<string, string>>({}),
    providers.spotify ? getSpotifyEpisodeLinks(providers.spotify) : Promise.resolve<Record<string, string>>({}),
  ]);

  if (providers.apple) {
    directLinks.apple = appleMap[episode.id] || appleMap[mp3Filename] || '';
  }

  if (providers.pocketcasts) {
    directLinks.pocketcasts = pocketcastsMap[mp3Filename] || '';
  }

  if (providers.spotify) {
    directLinks.spotify = spotifyMap[episodeTitleLower] || spotifyMap[displayTitleLower] || '';
  }

  return (
    <EpisodeDetailView
      episode={episode}
      thero={thero}
      chapters={chapters}
      transcript={transcript}
      directLinks={directLinks}
    />
  );
}

export async function generateMetadata({ params }: EpisodePageProps) {
  const { thero_id, episode_id } = await params;
  const thero = getTheroById(thero_id);
  if (!thero) {
    return { title: 'Episode Not Found' };
  }

  const rssUrl = thero.rss || `${getTheroS3BaseUrl(thero)}/${thero.rss_filename}`;
  const episodes = await fetchPodcastFeed(rssUrl);
  const episode = episodes.find((e) => e.id === episode_id);

  if (!episode) {
    return { title: 'Episode Not Found' };
  }

  const displayName = thero.name_sinhala 
    ? `${thero.name_sinhala} (${thero.name})` 
    : thero.name;
  const titleText = `${episode.title} - ${displayName} | DamSak.org`;
  const descText = episode.description
    ? episode.description.replace(/<[^>]*>/g, '').substring(0, 160)
    : thero.podcast.description.substring(0, 160);

  const theroLogo = thero.podcast.image_url.startsWith('http')
    ? thero.podcast.image_url
    : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`;
  const logoUrl = episode.image_url || theroLogo;

  return {
    title: titleText,
    description: descText,
    openGraph: {
      title: episode.title,
      description: descText,
      images: [{ url: logoUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: episode.title,
      description: descText,
      images: [logoUrl],
    },
  };
}
