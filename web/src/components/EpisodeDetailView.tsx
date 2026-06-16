'use client';

import Link from 'next/link';
import { Episode, TheroConfig, ChapterData } from '@/types';
import ChaptersList from './ChaptersList';
import TranscriptViewer from './TranscriptViewer';
import { formatDate, formatDuration } from '@/utils/format';
import { getTheroS3BaseUrl } from '@/utils/theros';
import useAudioPlayer from '@/hooks/useAudioPlayer';
import {
  ClockIcon,
  SpotifyIcon,
  ApplePodcastIcon,
  AmazonMusicIcon,
  PocketCastsIcon,
  PlayIcon,
  PauseIcon,
  YoutubeIcon
} from './Icons';
import styles from './EpisodeDetailView.module.css';

interface EpisodeDetailViewProps {
  episode: Episode;
  thero: TheroConfig;
  chapters: ChapterData | null;
  transcript: string | null;
  directLinks?: {
    apple: string;
    spotify: string;
    pocketcasts: string;
    amazon: string;
  };
}

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  const videoId = (match && match[2].length === 11) ? match[2] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

export default function EpisodeDetailView({
  episode,
  thero,
  chapters,
  transcript,
  directLinks,
}: EpisodeDetailViewProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime: globalTime,
    playTrack,
    togglePlay,
    seekTo,
  } = useAudioPlayer();

  const isCurrentEpisode = currentTrack?.id === episode.id;
  const currentTime = isCurrentEpisode ? globalTime : 0;
  const youtubeEmbedUrl = getYouTubeEmbedUrl(episode.youtube_url);

  const handlePlayEpisode = () => {
    const artworkUrl = episode.image_url || `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`;
    playTrack({
      id: episode.id,
      title: episode.display_title || episode.title,
      audioUrl: episode.s3_audio_url || episode.url,
      imageUrl: artworkUrl,
      theroName: thero.name_sinhala || thero.name,
      theroId: thero.id,
      duration: episode.duration,
    });
  };

  // Handle seeks from chapter list or transcript clicks
  const handleSeek = (seconds: number) => {
    if (!isCurrentEpisode) {
      handlePlayEpisode();
    }
    // Seek to destination
    seekTo(seconds);
  };

  const handleChapterSeek = (seconds: number, chapterTitle: string) => {
    handleSeek(seconds);
    if (typeof window !== 'undefined' && (window as any).umami) {
      (window as any).umami.track('Chapter Clicked', {
        title: chapterTitle,
        seconds,
        episode: episode.title,
        thero: thero.name,
      });
    }
  };

  const handleTranscriptSeek = (seconds: number) => {
    handleSeek(seconds);
    if (typeof window !== 'undefined' && (window as any).umami) {
      (window as any).umami.track('Transcript Clicked', {
        seconds,
        episode: episode.title,
        thero: thero.name,
      });
    }
  };

  const handleDescriptionTimestampSeek = (seconds: number, timestampText: string) => {
    handleSeek(seconds);
    if (typeof window !== 'undefined' && (window as any).umami) {
      (window as any).umami.track('Description Timestamp Clicked', {
        seconds,
        timestamp: timestampText,
        episode: episode.title,
        thero: thero.name,
      });
    }
  };

  // Convert text timestamps in the HTML description to clickable buttons
  const linkifyTimestamps = (html: string): string => {
    if (!html) return '';

    // Match optional parenthesis + HH:MM:SS or MM:SS + optional parenthesis
    const regex = /(\()?(\d{1,2}):(\d{2}):(\d{2})(\))?|(\()?(\d{1,2}):(\d{2})(\))?/g;

    return html.replace(regex, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9) => {
      let seconds = 0;
      if (p2 !== undefined) {
        // HH:MM:SS
        seconds = parseInt(p2, 10) * 3600 + parseInt(p3, 10) * 60 + parseInt(p4, 10);
      } else if (p7 !== undefined) {
        // MM:SS
        seconds = parseInt(p7, 10) * 60 + parseInt(p8, 10);
      } else {
        return match;
      }
      return `<button class="timestamp-link" data-seconds="${seconds}" type="button">${match}</button>`;
    });
  };

  // Click handler using event delegation
  const handleDescriptionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('timestamp-link')) {
      const seconds = Number(target.getAttribute('data-seconds'));
      if (!isNaN(seconds)) {
        handleDescriptionTimestampSeek(seconds, target.innerText);
      }
    }
  };

  const queryTitle = encodeURIComponent(episode.display_title || episode.title);
  const providers = thero.podcast.providers || {};

  const youtubeUrl = episode.youtube_url || `https://www.youtube.com/results?search_query=${queryTitle}`;
  const spotifyUrl = directLinks?.spotify || providers.spotify || `https://open.spotify.com/search/${queryTitle}`;
  const appleUrl = directLinks?.apple || providers.apple || `https://podcasts.apple.com/us/search?term=${queryTitle}`;
  const amazonUrl = directLinks?.amazon || providers.amazon || `https://music.amazon.com/search/${queryTitle}`;
  const pocketUrl = directLinks?.pocketcasts || providers.pocketcasts || `https://pocketcasts.com/search?q=${queryTitle}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href={`/podcast/${thero.id}`} className={styles.backLink}>
          ← දේශනා ලැයිස්තුවට
        </Link>
      </header>

      <div className={styles.heroLayout}>
        <div className={styles.metaInfo}>
          <span className={styles.date}>{formatDate(episode.pub_date)}</span>
          <span className={styles.separator}>•</span>
          <span className={styles.duration}>
            <ClockIcon size={14} /> {formatDuration(episode.duration)}
          </span>
        </div>

        <h1 className={styles.title}>{episode.display_title || episode.title}</h1>
        <span className={styles.speaker}>
          {thero.name_sinhala || thero.name}
          {thero.name_sinhala && (
            <span className={styles.englishNameSmall}> ({thero.name})</span>
          )}
        </span>

        {/* Local player segment */}
        <div className={styles.playerControlsRow}>
          <button
            onClick={isCurrentEpisode ? togglePlay : handlePlayEpisode}
            className={`${styles.playBtn} ${isCurrentEpisode && isPlaying ? styles.playingBtn : ''}`}
            id="detail-play-button"
          >
            {isCurrentEpisode && isPlaying ? (
              <>
                <PauseIcon size={14} /> දේශනාව නවත්වන්න (Pause)
              </>
            ) : (
              <>
                <PlayIcon size={14} /> දේශනාව ශ්‍රවණය කරන්න (Play)
              </>
            )}
          </button>
        </div>

        {/* External Platform Links */}
        <div className={styles.platformSection}>
          <div className={styles.platformTitle}>
            වෙනත් මාධ්‍ය හරහා ශ්‍රවණය/නැරඹීම
          </div>
          <div className={styles.platformRow}>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.platformBtn} ${styles.youtube}`}
              id="ext-youtube"
            >
              <YoutubeIcon size={14} /> YouTube
            </a>
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.platformBtn} ${styles.spotify}`}
              id="ext-spotify"
            >
              <SpotifyIcon size={14} /> Spotify
            </a>
            <a
              href={appleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.platformBtn} ${styles.apple}`}
              id="ext-apple"
            >
              <ApplePodcastIcon size={14} /> Apple Podcast
            </a>
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.platformBtn} ${styles.amazon}`}
              id="ext-amazon"
            >
              <AmazonMusicIcon size={14} /> Amazon Music
            </a>
            <a
              href={pocketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.platformBtn} ${styles.pocket}`}
              id="ext-pocket"
            >
              <PocketCastsIcon size={14} /> Pocket Casts
            </a>
          </div>
        </div>
      </div>

      <div className={styles.detailsGrid}>
        <div className={styles.leftCol}>
          {youtubeEmbedUrl && (
            <div className={`${styles.card} ${styles.videoCard} glass`}>
              <h4 className={`${styles.sectionHeading} ${styles.videoCardHeading}`}>
                දේශනාවේ වීඩියෝව <span className="english-sub">Watch Video</span>
              </h4>
              <div className={styles.videoContainer}>
                <iframe
                  src={youtubeEmbedUrl}
                  title={`${episode.display_title || episode.title} - YouTube`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          <div className={`${styles.card} glass`}>
            <h4 className={styles.sectionHeading}>
              දේශනාවේ විස්තරය <span className="english-sub">Episode Summary</span>
            </h4>
            <div
              className={styles.summaryContent}
              onClick={handleDescriptionClick}
              dangerouslySetInnerHTML={{ __html: linkifyTimestamps(episode.description) }}
            />
          </div>

          {transcript && (
            <div className={`${styles.card} glass`} style={{ display: 'none' }}>
              <h4 className={styles.sectionHeading}>
                දේශනාවේ පිටපත <span className="english-sub">Transcript timeline</span>
              </h4>
              <TranscriptViewer
                transcriptText={transcript}
                currentTime={currentTime}
                onTimestampClick={handleTranscriptSeek}
              />
            </div>
          )}
        </div>

        {chapters && chapters.chapters?.length > 0 && (
          <div className={styles.rightCol}>
            <div className={`${styles.card} glass ${styles.stickyChapters}`}>
              <h4 className={styles.sectionHeading}>
                දේශනාවේ ප්‍රධාන මාතෘකා <span className="english-sub">Chapters</span>
              </h4>
              <ChaptersList
                chapters={chapters.chapters}
                currentTime={currentTime}
                onChapterClick={(seconds) => {
                  const ch = chapters.chapters.find((c) => c.startTime === seconds);
                  handleChapterSeek(seconds, ch?.title || '');
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
