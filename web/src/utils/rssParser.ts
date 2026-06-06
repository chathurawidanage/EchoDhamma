import { XMLParser } from 'fast-xml-parser';
import { Episode } from '../types';

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
    };

    return episode;
  });
}

/**
 * Fetches and parses a thero's RSS feed from S3 with cache revalidation (ISR).
 */
export async function fetchPodcastFeed(rssUrl: string): Promise<Episode[]> {
  try {
    const res = await fetch(rssUrl, {
      next: { revalidate: 1800 }, // Cache and revalidate every 30 minutes
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch RSS feed from S3 status: ${res.status}`);
    }

    const xmlText = await res.text();
    return parsePodcastFeed(xmlText);
  } catch (error) {
    console.error(`Error fetching podcast feed for URL ${rssUrl}:`, error);
    return [];
  }
}
