'use client';

import { useState } from 'react';
import Link from 'next/link';
import useAudioPlayer from '@/hooks/useAudioPlayer';
import { formatTimer } from '@/utils/format';
import { 
  SkipBackIcon, 
  PlayIcon, 
  PauseIcon, 
  SkipForwardIcon, 
  SpeedIcon, 
  VolumeIcon,
  PodcastIcon
} from './Icons';
import styles from './AudioPlayer.module.css';

export default function AudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    togglePlay,
    seekTo,
    setVolume,
    setPlaybackRate,
  } = useAudioPlayer();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  if (!currentTrack) {
    return null;
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const skipBackward = () => seekTo(currentTime - 10);
  const skipForward = () => seekTo(currentTime + 30);

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className={`${styles.playerBar} glass`} id="global-persistent-player">
      {/* Left: Track Details */}
      <div className={styles.trackDetails}>
        <div className={styles.thumbnail}>
          {currentTrack.imageUrl ? (
            <img src={currentTrack.imageUrl} alt={currentTrack.title} />
          ) : (
            <span className={styles.thumbnailFallback}>
              <PodcastIcon size={20} />
            </span>
          )}
        </div>
        <div className={styles.textDetails}>
          <Link href={`/podcast/${currentTrack.theroId}/${currentTrack.id}`} className={styles.trackLink}>
            <h5 className={styles.trackTitle} title={currentTrack.title}>
              {currentTrack.title}
            </h5>
          </Link>
          <Link href={`/podcast/${currentTrack.theroId}`} className={styles.authorLink}>
            <span className={styles.trackAuthor}>{currentTrack.theroName}</span>
          </Link>
        </div>
      </div>

      {/* Center: Playback Controls & Progress */}
      <div className={styles.playbackControls}>
        <div className={styles.buttonsRow}>
          <button 
            onClick={skipBackward} 
            className={styles.controlBtn} 
            title="Skip back 10s"
            id="player-skip-back"
          >
            <SkipBackIcon size={14} /> <span className={styles.btnText}>10s</span>
          </button>
          
          <button 
            onClick={togglePlay} 
            className={`${styles.controlBtn} ${styles.playPauseBtn}`} 
            title={isPlaying ? 'Pause' : 'Play'}
            id="player-play-pause"
          >
            {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          </button>
          
          <button 
            onClick={skipForward} 
            className={styles.controlBtn} 
            title="Skip forward 30s"
            id="player-skip-forward"
          >
            <span className={styles.btnText}>30s</span> <SkipForwardIcon size={14} />
          </button>
        </div>

        <div className={styles.progressBarRow}>
          <span className={styles.timer}>{formatTimer(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleProgressChange}
            className={styles.slider}
            id="player-seek-slider"
          />
          <span className={styles.timer}>{formatTimer(duration)}</span>

          {/* Speed Option */}
          <div className={styles.speedWrapper}>
            <button 
              onClick={() => setShowSpeedMenu(!showSpeedMenu)} 
              className={styles.speedBtn}
              id="player-speed-btn"
            >
              <SpeedIcon size={14} /> {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className={`${styles.speedDropdown} glass`}>
                {speedOptions.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setPlaybackRate(rate);
                      setShowSpeedMenu(false);
                    }}
                    className={`${styles.dropdownItem} ${playbackRate === rate ? styles.activeRate : ''}`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Audio Settings (Volume) */}
      <div className={styles.settingsControls}>
        {/* Volume Option */}
        <div className={styles.volumeWrapper}>
          <span className={styles.volumeIcon}><VolumeIcon size={18} /></span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className={styles.volumeSlider}
            id="player-volume-slider"
          />
        </div>
      </div>

    </div>
  );
}
