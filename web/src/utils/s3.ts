import { TheroConfig, ChapterData, Episode } from '../types';
import { getTheroS3BaseUrl } from './theros';

/**
 * Fetches the raw JSON metadata file for a specific episode from S3.
 */
export async function fetchEpisodeMetadata(
  thero: TheroConfig,
  episodeId: string
): Promise<any | null> {
  const s3BaseUrl = getTheroS3BaseUrl(thero);
  const url = `${s3BaseUrl}/${episodeId}.json`;
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // Cache and revalidate hourly
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error(`Error fetching episode metadata for ${episodeId}:`, error);
    return null;
  }
}

/**
 * Fetches chapters JSON file for a specific episode from S3.
 */
export async function fetchEpisodeChapters(
  thero: TheroConfig,
  episodeId: string
): Promise<ChapterData | null> {
  const s3BaseUrl = getTheroS3BaseUrl(thero);
  const url = `${s3BaseUrl}/${episodeId}_chapters.json`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // Cache and revalidate hourly
    });
    if (!res.ok) {
      return null;
    }
    return await res.json() as ChapterData;
  } catch (error) {
    console.warn(`Chapters not found or failed to fetch for ${episodeId}:`, error);
    return null;
  }
}

/**
 * Fetches the transcript text file for a specific episode from S3.
 */
export async function fetchEpisodeTranscript(
  thero: TheroConfig,
  episodeId: string
): Promise<string | null> {
  const s3BaseUrl = getTheroS3BaseUrl(thero);
  const url = `${s3BaseUrl}/transcripts/${episodeId}.txt`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // Cache and revalidate hourly
    });
    if (!res.ok) {
      return null;
    }
    return await res.text();
  } catch (error) {
    console.warn(`Transcript not found or failed to fetch for ${episodeId}:`, error);
    return null;
  }
}
