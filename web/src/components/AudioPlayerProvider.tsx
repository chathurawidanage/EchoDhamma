'use client';

import React, { createContext, useState, useEffect, useRef } from 'react';

export interface PlayerTrack {
  id: string;
  title: string;
  audioUrl: string;
  imageUrl: string;
  theroName: string;
  theroId: string;
  duration: number; // in seconds
}

interface AudioPlayerContextType {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  playTrack: (track: PlayerTrack) => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
}

export const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export default function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85); // Default 85% volume
  const [playbackRate, setPlaybackRateState] = useState(1.0); // Default 1.0x speed

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  // Update volume on audio ref when state changes
  const setVolume = (vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);
    if (audioRef.current) {
      audioRef.current.volume = clampedVol;
    }
  };

  // Update speed/playback rate on audio ref when state changes
  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Play a specific track
  const playTrack = (track: PlayerTrack) => {
    if (!audioRef.current) return;

    const isSameTrack = currentTrack?.id === track.id;
    
    if (!isSameTrack) {
      audioRef.current.src = track.audioUrl;
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.duration || 0);

      // Track dynamic play event
      if (typeof window !== 'undefined' && (window as any).umami) {
        (window as any).umami.track('Play Podcast', {
          title: track.title,
          thero: track.theroName,
          duration: track.duration,
        });
      }
    }
    
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error("Playback error:", err));
  };

  // Toggle play/pause state
  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Playback error:", err));
    }
  };

  // Seek to specific timeline location
  const seekTo = (seconds: number) => {
    if (!audioRef.current) return;
    const clampedSecs = Math.max(0, Math.min(duration, seconds));
    audioRef.current.currentTime = clampedSecs;
    setCurrentTime(clampedSecs);
  };

  // Media Session API integration for Lock Screen / Background Controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.theroName,
        album: 'DamSak.org Podcast',
        artwork: [
          { src: currentTrack.imageUrl || '/ssmct.jpg', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current) {
            audioRef.current.play().then(() => setIsPlaying(true));
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setCurrentTime(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const offset = details.seekOffset || 10;
          seekTo(currentTime - offset);
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const offset = details.seekOffset || 30;
          seekTo(currentTime + offset);
        });
      } catch (error) {
        console.warn("Media Session action handler error:", error);
      }
    }
  }, [currentTrack, currentTime]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playbackRate,
        playTrack,
        togglePlay,
        seekTo,
        setVolume,
        setPlaybackRate,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}
