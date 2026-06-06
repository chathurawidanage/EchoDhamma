# Task 3: Thero Selection & Podcast Feed Parsing

## Objective
Retrieve thero metadata and dynamic RSS feeds from S3, parse them into standard JSON structures, and display a list of episodes for each thero.

## Scope & Requirements
- **Thero Configuration**: Dynamically read thero configuration files from the Python codebase ([src/echodhamma/theros/](file:///Users/chathura/code/EchoDhamma/src/echodhamma/theros/)) or bundle them into the Next.js assets to build the list of theros (e.g., Ven. Bambalapitiye Gnanaloka Thero, Ven. Watagoda Maggavihari Thero).
- **RSS Parsing**: Implement an RSS feed XML parser to extract episode elements (`<title>`, `<description>`, `<enclosure>` audio URL, `<pubDate>`, and custom tags like `<itunes:duration>`, `<itunes:image>`, and `<podcast:chapters>` URL).
- **Caching & Performance**: Enable Incremental Static Regeneration (ISR) with a revalidation time (e.g., every 60 minutes) to avoid overloading S3 buckets on page views.
- **UI Feed View**: Render a gorgeous list of episodes for the selected thero, sorted by publishing date, with filter/search options.

## Proposed Steps

### 1. Read Thero Setup Configurations
Write a server utility to parse files like `bambalapitiye_gnanaloka_thero.json`.
- Extract fields: `id`, `name`, `rss_filename`, S3 credentials/endpoint, and metadata (like the banner image).
- Map bucket variables dynamically to access the correct S3 endpoint.

### 2. Fetch and Parse Podcast XML (RSS)
Create an XML-to-JSON utility:
- Fetch the `podcast.xml` feed from S3 bucket.
- Extract episode items containing titles, audio file URLs, durations, descriptions, and chapters JSON references.
- Clean up HTML tags in RSS descriptions or display them using safe HTML renderers.

### 3. Build Thero Page & Episode List View
- Create route `/podcast/[thero_id]`:
  - Fetch Thero information and parse their RSS feed.
  - Display Thero header (Name, Bio, RSS links, external platform buttons like Spotify, Apple Podcast, Youtube, etc.).
  - Search bar to filter episodes by title or topic.
  - Grid or list layout of episode cards.

## Files to Create / Modify
- [NEW] [task-3-podcast-feed-integration.md](file:///Users/chathura/code/EchoDhamma/web/task-3-podcast-feed-integration.md) (This file)
- [NEW] [src/utils/thero.ts](file:///Users/chathura/code/EchoDhamma/web/src/utils/thero.ts) - Helper to load config details from thero JSON files.
- [NEW] [src/utils/rssParser.ts](file:///Users/chathura/code/EchoDhamma/web/src/utils/rssParser.ts) - RSS feed parser module.
- [NEW] [src/app/podcast/[thero_id]/page.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/podcast/%5Bthero_id%5D/page.tsx) - Thero landing page displaying episode listing.
- [NEW] [src/components/EpisodeCard.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/EpisodeCard.tsx) - Card showing short info of an episode.
- [NEW] [src/components/EpisodeCard.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/EpisodeCard.module.css) - Card layout styling.

## Verification Plan
1. **Mock Feed Parsing**: Test the parser with a local mock RSS feed file to ensure all metadata keys parse accurately.
2. **S3 Integration**: Fetch the real podcast RSS from the S3 bucket to verify authentication and connection logic.
3. **UI Listing**: Check that search/filter functionality instantly filters the UI list cards.
