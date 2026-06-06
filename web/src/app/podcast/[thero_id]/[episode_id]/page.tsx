import { notFound } from 'next/navigation';
import { getTheroById } from '@/utils/theros.server';
import { getTheroS3BaseUrl } from '@/utils/theros';
import { fetchPodcastFeed } from '@/utils/rssParser';
import { fetchEpisodeChapters, fetchEpisodeTranscript } from '@/utils/s3';
import EpisodeDetailView from '@/components/EpisodeDetailView';

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

  return (
    <EpisodeDetailView
      episode={episode}
      thero={thero}
      chapters={chapters}
      transcript={transcript}
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

  const titleText = `${episode.title} - ${thero.name} | EchoDhamma`;
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
