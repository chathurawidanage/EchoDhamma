import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getTheros, getTheroById } from '@/utils/theros.server';
import { getTheroS3BaseUrl } from '@/utils/theros';
import { fetchPodcastFeed } from '@/utils/rssParser';
import { fetchEpisodeChapters } from '@/utils/s3';
import EpisodeDetailView from '@/components/EpisodeDetailView';
import { 
  getAppleEpisodeLinks, 
  getPocketCastsEpisodeLinks, 
  getSpotifyEpisodeLinks 
} from '@/utils/episodeLinks';

// Episodes are immutable once published: generate statically and cache indefinitely
export const revalidate = false;
export const dynamicParams = true;

interface EpisodePageProps {
  params: Promise<{ thero_id: string; episode_id: string }>;
}

/**
 * Memoized episode data fetcher shared across generateMetadata and EpisodePage during render.
 */
const getEpisodeData = cache(async (theroId: string, episodeId: string) => {
  const thero = getTheroById(theroId);
  if (!thero) return null;

  const rssUrl = thero.rss || `${getTheroS3BaseUrl(thero)}/${thero.rss_filename}`;
  const episodes = await fetchPodcastFeed(rssUrl);
  const episode = episodes.find((e) => e.id === episodeId);
  if (!episode) return null;

  return { thero, episode };
});

/**
 * Pre-renders all podcast episode pages statically at build time.
 */
export async function generateStaticParams() {
  const theros = getTheros();
  const params: Array<{ thero_id: string; episode_id: string }> = [];

  for (const thero of theros) {
    try {
      const rssUrl = thero.rss || `${getTheroS3BaseUrl(thero)}/${thero.rss_filename}`;
      const episodes = await fetchPodcastFeed(rssUrl);
      for (const ep of episodes) {
        params.push({
          thero_id: thero.id,
          episode_id: ep.id,
        });
      }
    } catch (e) {
      console.error(`Failed to generate static params for thero ${thero.id}:`, e);
    }
  }

  return params;
}

function formatIsoDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'PT0S';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}${s}S`;
}

function cleanDescription(text?: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { thero_id, episode_id } = await params;
  const data = await getEpisodeData(thero_id, episode_id);

  if (!data) {
    notFound();
  }

  const { thero, episode } = data;

  // Fetch optional chapters from S3 (transcript omitted as auto-generated transcripts are inaccurate)
  const chapters = await fetchEpisodeChapters(thero, episode_id);

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

  const theroLogo = thero.podcast.image_url.startsWith('http')
    ? thero.podcast.image_url
    : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`;
  const logoUrl = episode.image_url || theroLogo;
  const episodeTitle = episode.display_title || episode.title;
  const displayName = thero.name_sinhala
    ? `${thero.name_sinhala} (${thero.name})`
    : thero.name;
  const cleanedDesc = cleanDescription(episode.description || thero.podcast.description);

  // Build Key Moments (Clips) from chapters for Google search timeline scrubbing
  const allChapters = chapters?.chapters || [];
  const clips = allChapters.map((ch, idx) => {
    const nextCh = allChapters[idx + 1];
    const endOffset = nextCh ? nextCh.startTime : (episode.duration || ch.startTime + 60);
    return {
      '@type': 'Clip',
      name: ch.title,
      startOffset: ch.startTime,
      endOffset,
      url: `https://damsak.org/podcast/${thero.id}/${episode.id}#t=${ch.startTime}`,
    };
  });

  // Extract Q&A chapters for FAQPage / Question rich snippets
  const qaChapters = allChapters.filter((ch) => ch.is_qa);
  const faqEntity = qaChapters.length > 0 ? {
    '@type': 'FAQPage',
    mainEntity: qaChapters.map((ch) => {
      const timeLabel = ch.start_time_str || `${Math.floor(ch.startTime / 60)}:${(ch.startTime % 60).toString().padStart(2, '0')}`;
      return {
        '@type': 'Question',
        name: ch.title,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `මෙම පැනයට අදාළ ධර්ම දේශනා පිළිතුර ශ්‍රව්‍ය ඛණ්ඩයේ ${timeLabel} සිට සාකච්ඡා වේ. (The answer to this question is discussed in the audio talk starting at ${timeLabel}).`,
          url: `https://damsak.org/podcast/${thero.id}/${episode.id}#t=${ch.startTime}`,
        },
      };
    }),
  } : null;

  const episodeNode: any = {
    '@type': 'PodcastEpisode',
    '@id': `https://damsak.org/podcast/${thero.id}/${episode.id}#episode`,
    url: `https://damsak.org/podcast/${thero.id}/${episode.id}`,
    name: episodeTitle,
    description: cleanedDesc.substring(0, 300),
    datePublished: episode.pub_date ? new Date(episode.pub_date).toISOString() : undefined,
    timeRequired: episode.duration ? formatIsoDuration(episode.duration) : undefined,
    image: logoUrl,
    associatedMedia: {
      '@type': 'AudioObject',
      contentUrl: episode.s3_audio_url || episode.url,
      encodingFormat: 'audio/mpeg',
      duration: episode.duration ? formatIsoDuration(episode.duration) : undefined,
    },
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: displayName,
      url: `https://damsak.org/podcast/${thero.id}`,
    },
    author: {
      '@type': 'Person',
      name: displayName,
    },
  };

  if (clips.length > 0) {
    episodeNode.hasPart = clips;
  }

  const graphNodes: any[] = [
    episodeNode,
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'මුල් පිටුව',
          item: 'https://damsak.org',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: displayName,
          item: `https://damsak.org/podcast/${thero.id}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: episodeTitle,
          item: `https://damsak.org/podcast/${thero.id}/${episode.id}`,
        },
      ],
    },
  ];

  if (faqEntity) {
    graphNodes.push(faqEntity);
  }

  // Schema.org Structured Data (JSON-LD) for rich podcast & Q&A SERP snippets
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': graphNodes,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EpisodeDetailView
        episode={episode}
        thero={thero}
        chapters={chapters}
        transcript={null}
        directLinks={directLinks}
      />
    </>
  );
}

export async function generateMetadata({ params }: EpisodePageProps) {
  const { thero_id, episode_id } = await params;
  const data = await getEpisodeData(thero_id, episode_id);
  if (!data) {
    return { title: 'Episode Not Found' };
  }

  const { thero, episode } = data;

  const displayName = thero.name_sinhala 
    ? `${thero.name_sinhala} (${thero.name})` 
    : thero.name;
  const episodeTitle = episode.display_title || episode.title;
  const titleText = `${episodeTitle} - ${displayName} | DamSak.org`;

  const cleanedDesc = cleanDescription(episode.description || thero.podcast.description);
  const descText = cleanedDesc.length > 160 ? `${cleanedDesc.substring(0, 157)}...` : cleanedDesc;

  const theroLogo = thero.podcast.image_url.startsWith('http')
    ? thero.podcast.image_url
    : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`;
  const logoUrl = episode.image_url || theroLogo;
  const pagePath = `/podcast/${thero_id}/${episode_id}`;

  return {
    title: titleText,
    description: descText,
    alternates: {
      canonical: pagePath,
    },
    openGraph: {
      title: titleText,
      description: descText,
      url: pagePath,
      type: 'article',
      publishedTime: episode.pub_date ? new Date(episode.pub_date).toISOString() : undefined,
      images: [
        {
          url: logoUrl,
          width: 1200,
          height: 1200,
          alt: episodeTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description: descText,
      images: [logoUrl],
    },
  };
}
