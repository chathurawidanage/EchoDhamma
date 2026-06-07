import { XMLParser } from 'fast-xml-parser';
import { Episode } from '../types';
import https from 'https';

function fetchUrlNative(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`Status Code: ${res.statusCode}`));
        return;
      }
      const data: any[] = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data).toString('utf8')));
    }).on('error', (err) => reject(err));
  });
}

/**
 * Parses podcast RSS XML string into a structured array of Episode objects.
 */
export function parsePodcastFeed(xmlText: string): Episode[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
  });

  const jsonObj = parser.parse(xmlText);
  const channel = jsonObj?.rss?.channel;
  if (!channel) {
    return [];
  }

  const rawItems = channel.item;
  const items = Array.isArray(rawItems)
    ? rawItems
    : rawItems
    ? [rawItems]
    : [];

  return items.map((item: any) => {
    // Extract unique video/episode ID
    const guidObj = item.guid;
    const guidVal = typeof guidObj === 'object' ? guidObj['#text'] || '' : guidObj || '';
    const enclosureUrl = item.enclosure?.['@_url'] || '';
    
    // Fallback ID if guid is empty: S3 file key name without extension
    let id = guidVal;
    if (!id && enclosureUrl) {
      id = enclosureUrl.split('/').pop()?.replace('.mp3', '') || '';
    }
    if (!id) {
      id = Math.random().toString(36).substring(2, 9);
    }

    // Parse duration (e.g. HH:MM:SS or seconds)
    const durationVal = item['itunes:duration'] || '0';
    let durationSeconds = 0;
    if (typeof durationVal === 'string' && durationVal.includes(':')) {
      const parts = durationVal.split(':').map(Number);
      if (parts.length === 3) {
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        durationSeconds = parts[0] * 60 + parts[1];
      }
    } else {
      durationSeconds = Number(durationVal) || 0;
    }

    const imageHref = item['itunes:image']?.['@_href'] || '';
    const chaptersUrl = item['podcast:chapters']?.['@_url'] || '';

    // Strip out CDATA and normalize descriptions
    let description = item.description || '';
    if (description.includes('<![CDATA[')) {
      description = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    }

    // Extract alternate enclosure YouTube URL if present
    let youtubeUrl = '';
    const rawAltEnc = item['podcast:alternateEnclosure'];
    if (rawAltEnc) {
      const altEncs = Array.isArray(rawAltEnc) ? rawAltEnc : [rawAltEnc];
      for (const enc of altEncs) {
        const rawSource = enc['podcast:source'];
        if (rawSource) {
          const sources = Array.isArray(rawSource) ? rawSource : [rawSource];
          for (const src of sources) {
            const uri = src['@_uri'] || '';
            if (typeof uri === 'string' && (uri.includes('youtube.com') || uri.includes('youtu.be'))) {
              youtubeUrl = uri;
              break;
            }
          }
        }
        if (youtubeUrl) break;
      }
    }

    const episode: Episode = {
      id,
      title: item.title || 'No Title',
      display_title: item.title || '',
      description,
      url: enclosureUrl,
      s3_audio_url: enclosureUrl,
      length_bytes: Number(item.enclosure?.['@_length']) || 0,
      pub_date: item.pubDate || '',
      duration: durationSeconds,
      image_url: imageHref || channel.image?.url || '',
      youtube_url: youtubeUrl || undefined,
    };

    return episode;
  });
}

interface CacheEntry {
  episodes: Episode[];
  timestamp: number;
}

const rssCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache duration

/**
 * Fetches and parses a thero's RSS feed from S3 with custom in-memory caching.
 * Bypasses Next.js fetch cache to avoid errors with feeds exceeding 2MB.
 */
export async function fetchPodcastFeed(rssUrl: string): Promise<Episode[]> {
  const now = Date.now();
  const cached = rssCache.get(rssUrl);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.episodes;
  }

  try {
    const xmlText = await fetchUrlNative(rssUrl);
    const episodes = parsePodcastFeed(xmlText);

    // Update in-memory cache
    rssCache.set(rssUrl, {
      episodes,
      timestamp: now,
    });

    return episodes;
  } catch (error) {
    console.error(`Error fetching podcast feed for URL ${rssUrl}:`, error);
    // If fetch fails but we have stale cache, return it
    if (cached) {
      console.log(`Returning stale cache for ${rssUrl} due to fetch failure`);
      return cached.episodes;
    }
    return [];
  }
}
