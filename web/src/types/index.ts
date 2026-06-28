export interface AIConfig {
  enabled: boolean;
  summarize: boolean;
  chapters: boolean;
  check_podcast_friendly: boolean;
  skip_title_rewrite?: boolean;
}

export interface SyncConfig {
  max_videos_per_day: number;
  max_ai_calls_per_day: number;
}


export interface S3Config {
  endpoint_env: string;
  bucket_env: string;
  access_key_env: string;
  secret_key_env: string;
}

export interface PodcastMetadata {
  title: string;
  description: string;
  link: string;
  author: string;
  language: string;
  category: string;
  subcategory?: string;
  image_url: string;
  explicit: string;
  email: string;
  description_template: string;
  providers?: {
    apple?: string;
    spotify?: string;
    amazon?: string;
    pocketcasts?: string;
  };
}

export interface TheroConfig {
  id: string;
  seniority?: number;
  enabled: boolean;
  name: string;
  name_sinhala?: string;
  rss?: string; // Absolute path to podcast RSS feed
  blocklist: string[];
  youtube_channel_urls: string[];
  ai_config: AIConfig;
  sync_config: SyncConfig;
  rss_filename: string;
  s3: S3Config;
  podcast: PodcastMetadata;
}

export interface Chapter {
  startTime: number; // in seconds
  title: string;
  description?: string;
  is_qa: boolean;
  start_time_str: string;
}

export interface ChapterData {
  version: string;
  chapters: Chapter[];
}

export interface Episode {
  id: string;
  title: string;
  display_title?: string;
  description: string;
  url: string;
  s3_audio_url?: string;
  length_bytes: number;
  pub_date: string;
  duration: number; // in seconds
  image_url?: string;
  chapters?: ChapterData;
  has_transcript?: boolean;
  youtube_url?: string;
}


export interface Ebook {
  id: string;
  title: string;
  title_transliterated?: string;
  author: string;
  description: string;
  cover_url: string;
  pdf_url?: string;
  epub_url?: string;
  html_url?: string;
  has_questions?: boolean;
}

export interface Definition {
  term: string;
  translation?: string;
  definition: string;
  language: 'pali' | 'sanskrit' | 'sinhala';
  matches?: string[];
}

export interface Question {
  id: string;
  type?: 'mcq' | 'multiselect' | 'wordbuilder';
  question: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerIndices?: number[];
  words?: string[];
  correctWordSequence?: string[];
  explanation: string;
  fromBook?: boolean;
  placeholder?: string;
}

export type BookQuestions = Record<string, Question[]>; // Keyed by TOC anchor ID


