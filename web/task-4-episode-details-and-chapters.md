# Task 4: Episode Details, Chapters & Transcripts

## Objective
Create a rich, responsive detail page for individual episodes featuring episode summary, interactive chapters, full transcripts, and links to external platforms.

## Scope & Requirements
- **Dynamic Route**: `/podcast/[thero_id]/[episode_id]`.
- **External Platform Navigation**: Display buttons linking to Apple Podcasts, Spotify, YouTube, Amazon Music, and Pocket Casts.
- **Interactive Chapters**: Read `<video_id>_chapters.json` from S3. Display list of chapters with start times. Clicking a chapter should update the audio player's playback position.
- **Full Transcripts**: Read `transcripts/<video_id>.txt` from S3. Display the transcript formatted as an interactive timeline. Clicking any line should seek the audio player to the corresponding timestamp. Search functionality should highlight matches in the transcript.

## Proposed Steps

### 1. Create Episode Detail Page
- Implement the route `/podcast/[thero_id]/[episode_id]`.
- Load the specific episode item from the cached/parsed RSS feed or S3 `<video_id>.json` metadata.
- Display title, date, duration, description, and external platform links.

### 2. Fetch and Render Chapters
- If the episode RSS feed or metadata indicates chapters are available, fetch the `<video_id>_chapters.json` from S3.
- Map the chapters array: `startTime` (in seconds), `title`, `description`, `is_qa`, and `start_time_str`.
- Display chapters in a sleek list/timeline with active markers showing which chapter is currently playing.

### 3. Fetch, Parse and Render Transcript
- Fetch the `transcripts/<video_id>.txt` file from S3 (e.g. key `transcripts/{video_id}.txt`).
- Parse the transcript text, which is formatted as `[HH:MM:SS] Text content...` on each line. Convert timestamps into absolute seconds.
- Render the transcript as list of blocks.
- Add a search box to dynamically filter transcript blocks or highlight keywords.
- Implement click handlers on each block to trigger seeking in the global audio player.

## Files to Create / Modify
- [NEW] [task-4-episode-details-and-chapters.md](file:///Users/chathura/code/EchoDhamma/web/task-4-episode-details-and-chapters.md) (This file)
- [NEW] [src/app/podcast/[thero_id]/[episode_id]/page.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/podcast/%5Bthero_id%5D/%5Bepisode_id%5D/page.tsx) - Detailed episode view page.
- [NEW] [src/components/ChaptersList.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/ChaptersList.tsx) - Interactive chapters timeline component.
- [NEW] [src/components/ChaptersList.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/ChaptersList.module.css) - Chapters timeline styling.
- [NEW] [src/components/TranscriptViewer.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/TranscriptViewer.tsx) - Timeline transcript with interactive click-to-seek.
- [NEW] [src/components/TranscriptViewer.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/TranscriptViewer.module.css) - Transcript UI styling.

## Verification Plan
1. **Dynamic Fetching**: Inspect S3 HTTP requests to confirm chapter JSONs and transcript text files are fetched correctly.
2. **Transcript Parsing**: Verify that all lines formatted as `[HH:MM:SS] text` are parsed into accurate second counts.
3. **Interactive Actions**: Verify clicking chapters and transcript lines calls the audio controller with correct timestamps.
