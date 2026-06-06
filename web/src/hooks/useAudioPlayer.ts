'use client';

import { useContext } from 'react';
import { AudioPlayerContext } from '../components/AudioPlayerProvider';

export default function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider wrapper.');
  }
  return context;
}
