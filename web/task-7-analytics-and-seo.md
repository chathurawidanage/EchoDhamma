# Task 7: SEO Best Practices & Umami Analytics Integration

## Objective
Optimize the website for Search Engine Optimization (SEO) and integrate analytics tracking (Umami) mapped dynamically to each thero's configuration.

## Scope & Requirements
- **Dynamic Meta Tags**: Headings, title tags, and descriptions generated dynamically based on active pages, Theros, or episodes.
- **OpenGraph & Twitter Cards**: Add cards/images for social sharing of podcast episodes and ebooks.
- **Umami Tracker Integration**: Include Umami tracking script. The `website_id` must change dynamically depending on which Thero's section is being viewed (loading from Python configs).
- **Custom Event Tracking**: Track user interactions such as "Podcast Play", "Podcast Seek (from Chapter or Transcript)", "Ebook Download", and "Ebook Read".
- **Unique IDs**: Enforce unique, descriptive `id` properties on all interactive controls (buttons, links, play scrubbers) to facilitate testing.

## Proposed Steps

### 1. Configure Global & Dynamic Metadata
- Implement Next.js Metadata API in layout and dynamic page components.
- Ensure that the episode pages utilize RSS title summaries and artwork for OpenGraph:
```typescript
export async function generateMetadata({ params }) {
  const episode = await getEpisodeDetails(params.thero_id, params.episode_id);
  return {
    title: `${episode.title} - ${episode.theroName}`,
    description: episode.summary,
    openGraph: {
      images: [episode.imageUrl],
    },
  };
}
```

### 2. Dynamically Inject Umami Tracking Scripts
- Create an `Analytics` component that reads the current active thero page.
- If the route belongs to a specific thero, load their respective `website_id` from their thero JSON config (e.g., `25970dec-065e-4740-ba91-7394ad1f613a` for Ven. Bambalapitiye Gnanaloka Thero).
- Otherwise, fallback to a global default site ID.
- Use `next/script` to load `script.js` with the correct `data-website-id`.

### 3. Track Custom Events
- Inside the global audio context (Task 5), trigger custom Umami events:
  - `window.umami.track('Play Podcast', { title: track.title, thero: track.theroName })` when play starts.
  - `window.umami.track('Chapter Clicked', { title: chapter.title })` when user jumps via chapter list.
- Inside the ebook reader (Task 6), track:
  - `window.umami.track('Ebook Download', { title: book.title, format: 'pdf' })`.

### 4. Accessibility and Semantic Hierarchy Audit
- Verify only one `<h1>` tag is loaded per page.
- Check semantic elements (`<article>`, `<section>`, `<aside>`).
- Verify all interactive controls have descriptive, unique `id` values (e.g. `id="play-button"`, `id="chapter-item-2"`).

## Files to Create / Modify
- [NEW] [task-7-analytics-and-seo.md](file:///Users/chathura/code/EchoDhamma/web/task-7-analytics-and-seo.md) (This file)
- [NEW] [src/components/UmamiTracker.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/UmamiTracker.tsx) - Dynamic analytics script injector.
- [MODIFY] [src/app/layout.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/layout.tsx) - Add global meta tags and inject tracking script wrapper.
- [NEW] [public/robots.txt](file:///Users/chathura/code/EchoDhamma/web/public/robots.txt) - Search engine guidelines.
- [NEW] [src/app/sitemap.ts](file:///Users/chathura/code/EchoDhamma/web/src/app/sitemap.ts) - Dynamic sitemap generator containing theros, episodes, and ebooks.

## Verification Plan
1. **Dynamic Scripts**: Navigate between Ven. Bambalapitiye Gnanaloka Thero's page and Ven. Watagoda Maggavihari Thero's page. Inspect loaded script tags in the browser DOM to confirm `data-website-id` changes accordingly.
2. **Event Verification**: Trigger play, seek, and download actions. Confirm that requests to Umami's `/api/send` contain the correct payload custom events.
3. **SEO Audit**: Run Lighthouse or meta tag check tools to confirm structured tags, headings, and alt tags are fully optimized.
