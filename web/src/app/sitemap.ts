import { MetadataRoute } from 'next';
import { getTheros } from '@/utils/theros.server';
import { fetchPodcastFeed } from '@/utils/rssParser';
import { getTheroS3BaseUrl } from '@/utils/theros';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';

export const revalidate = 86400; // Revalidate sitemap daily (24 hours)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://echodhamma.org';
  const theros = getTheros();
  const ebooks = ebooksData as Ebook[];

  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/ebooks`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Ebooks reading routes
  for (const book of ebooks) {
    sitemapEntries.push({
      url: `${baseUrl}/ebooks/${book.id}/read`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  // Theros and their podcast episodes routes
  for (const thero of theros) {
    // Add Thero podcast list page
    sitemapEntries.push({
      url: `${baseUrl}/podcast/${thero.id}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    });

    try {
      const rssUrl = thero.rss || `${getTheroS3BaseUrl(thero)}/${thero.rss_filename}`;
      const episodes = await fetchPodcastFeed(rssUrl);
      
      // Add individual episode detail pages
      for (const episode of episodes) {
        sitemapEntries.push({
          url: `${baseUrl}/podcast/${thero.id}/${episode.id}`,
          lastModified: new Date(episode.pub_date || new Date()),
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    } catch (err) {
      console.error(`Sitemap: Failed to parse episodes for Thero: ${thero.id}`, err);
    }
  }

  return sitemapEntries;
}
