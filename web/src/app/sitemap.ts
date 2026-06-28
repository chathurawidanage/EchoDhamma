import { MetadataRoute } from 'next';
import { getTheros } from '@/utils/theros.server';
import { fetchPodcastFeed } from '@/utils/rssParser';
import { getTheroS3BaseUrl } from '@/utils/theros';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import { parseBookHtml } from '@/lib/ebookParser';

export const revalidate = 86400; // Revalidate sitemap daily (24 hours)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://damsak.org';
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

  // Ebooks reading and questions routes
  for (const book of ebooks) {
    // Base redirect route
    sitemapEntries.push({
      url: `${baseUrl}/ebooks/${book.id}/read`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    });

    if (book.html_url) {
      try {
        const parsedBook = await parseBookHtml(book.html_url);

        // Add special chapters if present
        const specialChapters = ['titlepage', 'colophon'];
        for (const cid of specialChapters) {
          if (parsedBook.chapters.some(c => c.id === cid)) {
            sitemapEntries.push({
              url: `${baseUrl}/ebooks/${book.id}/read/${cid}`,
              lastModified: new Date(),
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        }

        // Add all TOC item read routes
        for (const item of parsedBook.toc) {
          sitemapEntries.push({
            url: `${baseUrl}/ebooks/${book.id}/read/${item.id}`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }

        // Add questions root route if there are any questions
        const hasQuestions = parsedBook.questions && Object.values(parsedBook.questions).some(q => q && q.length > 0);
        if (hasQuestions) {
          sitemapEntries.push({
            url: `${baseUrl}/ebooks/${book.id}/questions`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
          });

          // Add individual TOC item questions routes
          for (const item of parsedBook.toc) {
            const list = parsedBook.questions?.[item.id];
            if (list && Array.isArray(list) && list.length > 0) {
              sitemapEntries.push({
                url: `${baseUrl}/ebooks/${book.id}/questions/${item.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.6,
              });
            }
          }
        }
      } catch (err) {
        console.error(`Sitemap: Failed to parse ebook HTML for sitemap: ${book.id}`, err);
      }
    }
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
