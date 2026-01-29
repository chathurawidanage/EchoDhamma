# EchoDhamma - Podcast Sync Service

This service automates the creation and maintenance of podcast RSS feeds from dhamma YouTube channels. It fetches videos, converts them to MP3, uploads them (along with thumbnails) to an S3-compatible storage (like MinIO), generates AI-enhanced metadata, and updates RSS feeds compliant with Spotify and Apple Podcasts.

## 🎧 Live Podcasts

The following podcasts are powered by this service:

### සද්ධර්මධාරා - Saddharmadhara

Dhamma talks by **Ven. Bambalapitiye Gnanaloka Thero** (අති පූජ්‍ය බම්බලපිටියේ ඤාණාලෝක ස්වාමීන් වහන්සේ)

[![Apple Podcasts](https://img.shields.io/badge/Apple_Podcasts-9933CC?style=for-the-badge&logo=apple-podcasts&logoColor=white)](https://podcasts.apple.com/us/podcast/saddharmadhara-the-stream-of-noble-dhamma/id1865923407)
[![Spotify](https://img.shields.io/badge/Spotify-1ED760?style=for-the-badge&logo=spotify&logoColor=white)](https://open.spotify.com/show/3OcRrpafqLSskdmM33byCo)
[![Amazon Music](https://img.shields.io/badge/Amazon_Music-FF9900?style=for-the-badge&logo=amazon-music&logoColor=white)](https://music.amazon.com/podcasts/4b8360ee-ebde-492e-8cb7-1bd1aaf784e4/සදධරමධර-saddharmadhara)
[![Pocket Casts](https://img.shields.io/badge/Pocket_Casts-F43E37?style=for-the-badge&logo=pocket-casts&logoColor=white)](https://pca.st/ddb4b738)

### වටගොඩ මග්ගවිහාරී හිමි - Ven. Watagoda Maggavihari Thero

Dhamma talks by **Ven. Watagoda Maggavihari Thero** (පූජ්‍ය වටගොඩ මග්ගවිහාරී ස්වාමීන් වහන්සේ)

[![Apple Podcasts](https://img.shields.io/badge/Apple_Podcasts-9933CC?style=for-the-badge&logo=apple-podcasts&logoColor=white)](https://podcasts.apple.com/us/podcast/වටගොඩ-මග්ගවිහාරී-හිමි-ven-watagoda-maggavihari-thero/id1871646624)
[![Spotify](https://img.shields.io/badge/Spotify-1ED760?style=for-the-badge&logo=spotify&logoColor=white)](https://open.spotify.com/show/4Tu5syVofxiwu00PxurUIx)
[![Amazon Music](https://img.shields.io/badge/Amazon_Music-FF9900?style=for-the-badge&logo=amazon-music&logoColor=white)](https://music.amazon.com/podcasts/be3b57f8-dfb6-4fe0-8988-402b57931343/වටගඩ-මගගවහර-හම-ven-watagoda-maggavihari-thero)
[![Pocket Casts](https://img.shields.io/badge/Pocket_Casts-F43E37?style=for-the-badge&logo=pocket-casts&logoColor=white)](https://pca.st/bo8kic93)

## Features

- **YouTube to Podcast**: Automatically converts YouTube videos to audio-only podcasts.
- **Multi-Thero Support**: Configure and manage multiple independent podcast feeds, each with its own YouTube channel, S3 bucket, and settings via JSON configuration files in the `theros/` directory.
- **AI-Powered Metadata Generation**: Uses Google Gemini (via the `google-genai` SDK) to:
  - Generate optimized, Sinhala podcast descriptions from video content.
  - Extract and structure title components (series name, episode number, topic summary).
  - Determine if a video is "podcast-friendly" (e.g., doesn't rely heavily on visuals).
- **Title Validation**: Safeguards against AI hallucinations by validating AI-generated `series_name` and `episode_number` against the original video title using fuzzy matching (`thefuzz`).
- **Content Filtering**: Uses fuzzy matching (`title_matcher.py`) to verify that a video's content matches the expected Thero before including it in the feed.
- **S3 Integration**: Stores audio files, thumbnails, metadata JSON, and the `podcast.xml` RSS feed in S3/MinIO.
- **Smart Sync**: Skips videos that have already been processed to save bandwidth and time.
- **Rate Limiting**: Configurable daily sync limits per Thero to avoid overwhelming external services (YouTube, AI API). State is persisted to S3.
- **Prometheus Metrics**: Exposes metrics at `/metrics` for monitoring sync attempts, successes, failures, skipped videos, AI errors, and rate limits.
- **HTTP API**: Includes a Flask server with endpoints to trigger synchronization and RSS regeneration via webhooks or cron jobs.
- **Asynchronous Execution**: Sync and RSS update tasks run in a background thread to prevent blocking the API server.
- **Dockerized**: Ready for deployment on platforms like Coolify.

## Architecture

```text
podcast/
├── server.py           # Flask HTTP API server
├── sync.py             # Core synchronization logic (PodcastSync class)
├── ai_manager.py       # Google Gemini AI integration for metadata generation
├── rate_limiter.py     # Rate limiting logic (periodic and daily quotas)
├── rss_generator.py    # RSS feed generation
├── s3_manager.py       # S3/MinIO storage operations
├── audio_processor.py  # Audio extraction from YouTube videos
├── title_formatter.py  # AI title validation and formatting
├── title_matcher.py    # Thero name matching in video content
├── metrics.py          # Prometheus metrics definitions
├── prompt_service.py   # AI prompt construction and schema generation
├── prompts/            # Markdown prompt templates and schemas
├── requirements.txt    # Python dependencies
├── Dockerfile          # Docker build configuration
└── theros/             # Thero configuration files
    ├── bambalapitiye_gnanaloka_thero.json
    └── watagoda_maggavihari_thero.json
```

## Configuration

### Thero Configuration Files (`theros/*.json`)

Each Thero has its own JSON configuration file. Key fields include:

| Field                              | Description                                             |
| ---------------------------------- | ------------------------------------------------------- |
| `id` | Unique identifier for the Thero |
| `enabled` | Set to `true` to enable syncing for this Thero |
| `name` | Display name of the Thero |
| `youtube_channel_urls` | List of YouTube channel URLs to fetch videos from |
| `ai_config.enabled` | Enable AI metadata generation |
| `ai_config.summarize` | Generate AI descriptions |
| `ai_config.check_podcast_friendly` | Use AI to determine podcast compatibility |
| `sync_config.max_videos_per_day` | Daily limit for video processing |
| `sync_config.max_ai_calls_per_day` | Daily limit for AI API calls (separate from video limit) |
| `rss_filename` | Name of the generated RSS file (e.g., `podcast.xml`) |
| `s3.*_env` | Environment variable names for S3 credentials |
| `podcast.*` | Podcast metadata (title, description, author, etc.) |
| `matcher.english_tokens` / `matcher.sinhala_tokens` | Tokens for fuzzy title matching |
| `blocklist` | List of video IDs to exclude from the RSS feed |

### Environment Variables (`.env`)

Create a `.env` file in this directory with the following variables:

#### S3 / MinIO Configuration (per Thero)

```env
# Example for one Thero
GNANALOKA_THERO_S3_ENDPOINT=https://your-minio-url
GNANALOKA_THERO_S3_BUCKET=your-bucket-name
GNANALOKA_THERO_S3_ACCESS_KEY=your-access-key
GNANALOKA_THERO_S3_SECRET_KEY=your-secret-key
```

#### AI Configuration

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview  # Optional, defaults to gemini-3-flash-preview
```

## Running Locally

1. **Install Dependencies**:
    You need `ffmpeg` installed on your system.

    ```bash
    brew install ffmpeg  # macOS
    pip install -r requirements.txt
    ```

2. **Run Sync Script**:
    Run the synchronization logic once for all enabled Theros:

    ```bash
    python sync.py
    ```

3. **Run HTTP Server**:
    Start the API server to trigger syncs on demand:

    ```bash
    python server.py
    ```

## API Endpoints

| Endpoint             | Method     | Description                                                                                                                                        |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health` | GET | Health check. Returns `200 OK` if the server is running. |
| `POST/GET /sync` | POST, GET | Triggers the full synchronization workflow asynchronously. Returns `202 Accepted` if started, or `429 Too Many Requests` if a sync is already running. |
| `POST/GET /sync/rss` | POST, GET | Triggers only the RSS regeneration workflow asynchronously. Useful for updating the feed without processing new videos. |
| `GET /metrics` | GET | Returns Prometheus metrics for monitoring. |

## Deployment (Docker / Coolify)

The service includes a `Dockerfile` for easy deployment.

1. **Build & Run**:

    ```bash
    docker build -t podcast-sync .
    docker run -p 8080:8080 --env-file .env podcast-sync
    ```

2. **Coolify**:
    - Deploy as an **Application** using the `Dockerfile`.
    - Add all environment variables in the Coolify dashboard.
    - Set the **Health Check** path to `/health`.
    - Use Coolify's **Scheduler** (or an external cron) to hit the `/sync` endpoint periodically (e.g., every hour).

## Monitoring

The `/metrics` endpoint exposes the following Prometheus counters (labeled by `thero`):

| Metric                       | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `sync_attempts_total` | Total number of sync attempts |
| `sync_success_total` | Total number of successful syncs |
| `sync_skipped_total` | Total number of skipped videos (with `reason` label) |
| `sync_failure_total` | Total number of sync failures |
| `ai_failure_total` | Total number of AI generation failures |
| `ai_rate_limited_total` | Total number of AI rate limit occurrences |
| `sync_runs_total` | Total number of times the sync workflow is initiated |
| `sync_filtered_items_total` | Total number of items filtered out from RSS feed |

## AI Prompt Guidelines

The AI is instructed (via `prompt.md`) to follow strict guidelines:

- **Zero-Hallucination Mode**: Only summarize factual points from the video.
- **Strict Objectivity**: No concluding blessings or aspirational statements.
- **No Extrapolation**: Only list topics covered, not benefits of watching.
- **Podcast Compatibility**: Intelligently determines if audio-only format works.
