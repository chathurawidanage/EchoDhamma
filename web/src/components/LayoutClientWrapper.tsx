'use client';

import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';
import AudioPlayer from '@/components/AudioPlayer';
import useAudioPlayer from '@/hooks/useAudioPlayer';
import styles from '@/app/layout.module.css';
import { TheroConfig } from '@/types';

interface LayoutClientWrapperProps {
  theros: TheroConfig[];
  children: React.ReactNode;
}

export default function LayoutClientWrapper({ theros, children }: LayoutClientWrapperProps) {
  const pathname = usePathname();
  // Detect if we are on the ebook reader or questions page
  const isReaderPage =
    pathname?.endsWith('/read') ||
    pathname?.includes('/read/') ||
    pathname?.endsWith('/questions') ||
    pathname?.includes('/questions/');
  const { currentTrack } = useAudioPlayer();
  const showPlayer = !isReaderPage && !!currentTrack;

  return (
    <div className={`${styles.layoutShell} ${isReaderPage ? styles.readerLayoutShell : ''}`}>
      <Navigation theros={theros} />
      <main className={`${styles.contentWrapper} ${isReaderPage ? styles.readerMode : ''} ${showPlayer ? styles.hasPlayer : ''}`}>
        {children}
      </main>
      {!isReaderPage && <AudioPlayer />}
    </div>
  );
}
