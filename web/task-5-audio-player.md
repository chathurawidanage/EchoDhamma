# Task 5: Persistent Audio Player Integration

## Objective
Build a premium, globally persistent audio player that allows users to listen to episodes without interruption while browsing other sections of the website.

## Scope & Requirements
- **Global Context**: React context (`AudioPlayerContext`) to share audio state (playing, current time, duration, track metadata) across the entire application.
- **Audio Controls**: Play, pause, seek, playback rate adjustment (0.5x to 2.0x), and volume control.
- **Continuous Playback**: The player should persist fixed at the bottom of the window across route transitions.
- **OS/Mobile Integration**: Implement the HTML5 Media Session API to synchronize metadata and playback controls with mobile lock screens and OS notifications.
- **Synchronized Highlighting**: Broadcast the current playback time to automatically highlight the active chapter and the active transcript line.

## Proposed Steps

### 1. Build Audio Player State Provider
Create `AudioPlayerContext` and hook `useAudioPlayer`:
- Keep track of: `currentTrack` (Thero, Title, URL, Image, Duration), `isPlaying`, `currentTime`, `duration`, `playbackRate`, and `volume`.
- Expose methods: `playTrack(track)`, `togglePlay()`, `seekTo(seconds)`, `setRate(rate)`, and `setVolume(volume)`.
- Use a single, hidden `<audio>` element inside the provider wrapper in the root layout.

### 2. Implement the Bottom Player Bar Component
Create a floating/sticky, glassmorphic audio player:
- **Left**: Mini-thumbnail, episode title, and thero name.
- **Center**: Playback controls (skip back 10s, play/pause toggle, skip forward 30s), progress scrub bar with timer labels (`currentTime` / `duration`).
- **Right**: Volume bar, playback speed popup, and links to current episode details page.

### 3. Integrate Media Session API
Wire up OS integrations inside a React `useEffect`:
```javascript
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.theroName,
    artwork: [{ src: track.imageUrl }]
  });
  navigator.mediaSession.setActionHandler('play', () => togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => togglePlay());
  navigator.mediaSession.setActionHandler('seekto', (details) => seekTo(details.seekTime));
}
```

## Files to Create / Modify
- [NEW] [task-5-audio-player.md](file:///Users/chathura/code/EchoDhamma/web/task-5-audio-player.md) (This file)
- [NEW] [src/hooks/useAudioPlayer.ts](file:///Users/chathura/code/EchoDhamma/web/src/hooks/useAudioPlayer.ts) - Custom hook to control audio.
- [NEW] [src/components/AudioPlayerProvider.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/AudioPlayerProvider.tsx) - React context provider wrapping the app.
- [NEW] [src/components/AudioPlayer.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/AudioPlayer.tsx) - Sticky player bar UI component.
- [NEW] [src/components/AudioPlayer.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/AudioPlayer.module.css) - Styling for the sticky player.

## Verification Plan
1. **Uninterrupted Navigation**: Play an episode, click on sidebar navigation items, and ensure audio plays continuously across page transitions.
2. **Scrub & Controls**: Test progress scrubbing and speed adjustments. Verify time updates correspond to chapters.
3. **Lock Screen Integration**: Test on mobile Safari/Chrome or macOS system controls to verify play, pause, and track info display.
