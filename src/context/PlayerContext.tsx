import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { DownloadItem } from '@/services/DownloadService';

let globalPlayer: AudioPlayer | null = null;
let globalSubscription: any = null;

const cleanupPlayer = () => {
  if (globalSubscription) {
    try {
      globalSubscription.remove();
    } catch (e) {
      console.warn('Failed to remove global subscription:', e);
    }
    globalSubscription = null;
  }
  if (globalPlayer) {
    try {
      globalPlayer.remove();
    } catch (e) {
      console.warn('Failed to remove global player:', e);
    }
    globalPlayer = null;
  }
};

interface PlayerContextType {
  isPlaying: boolean;
  currentMedia: DownloadItem | null;
  position: number;
  duration: number;
  playbackStatus: AudioStatus | null;
  queue: DownloadItem[];
  playMedia: (item: DownloadItem, newQueue?: DownloadItem[]) => Promise<void>;
  pauseMedia: () => Promise<void>;
  resumeMedia: () => Promise<void>;
  stopMedia: () => Promise<void>;
  seekMedia: (positionMs: number) => Promise<void>;
  nextMedia: () => Promise<void>;
  previousMedia: () => Promise<void>;
  addToQueue: (item: DownloadItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMedia, setCurrentMedia] = useState<DownloadItem | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<AudioStatus | null>(null);
  const [queue, setQueue] = useState<DownloadItem[]>([]);

  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<any>(null);
  const currentMediaRef = useRef<DownloadItem | null>(null);
  const queueRef = useRef<DownloadItem[]>([]);
  const nextMediaRef = useRef<() => Promise<void>>(async () => {});
  const positionRef = useRef<number>(0);

  const savePlaybackState = async (media: DownloadItem | null, activeQueue: DownloadItem[], lastPosition: number) => {
    try {
      const dir = `${FileSystem.documentDirectory}downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      const stateFile = `${dir}playback_state.json`;
      await FileSystem.writeAsStringAsync(
        stateFile,
        JSON.stringify({
          currentMedia: media,
          queue: activeQueue,
          position: lastPosition
        })
      );
    } catch (error) {
      console.error('Failed to save playback state:', error);
    }
  };

  useEffect(() => {
    let active = true;
    const setupAudioAndLoadState = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        if (!active) return;

        // Load saved state
        const stateFile = `${FileSystem.documentDirectory}downloads/playback_state.json`;
        const fileInfo = await FileSystem.getInfoAsync(stateFile);
        if (!active) return;
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(stateFile);
          if (!active) return;
          const data = JSON.parse(content);
          if (data) {
            if (data.queue && data.queue.length > 0) {
              const validQueue: DownloadItem[] = [];
              for (const item of data.queue) {
                const fileName = item.localUri ? item.localUri.split('/').pop() : '';
                const resolvedUri = `${FileSystem.documentDirectory}downloads/${fileName}`;
                const itemInfo = await FileSystem.getInfoAsync(resolvedUri);
                if (itemInfo.exists) {
                  validQueue.push({ ...item, localUri: resolvedUri });
                }
              }
              if (!active) return;
              queueRef.current = validQueue;
              setQueue(validQueue);
            }
            if (data.currentMedia) {
              const fileName = data.currentMedia.localUri ? data.currentMedia.localUri.split('/').pop() : '';
              const resolvedUri = `${FileSystem.documentDirectory}downloads/${fileName}`;
              const localFileInfo = await FileSystem.getInfoAsync(resolvedUri);
              if (!active) return;
              if (localFileInfo.exists) {
                const resolvedMedia = { ...data.currentMedia, localUri: resolvedUri };
                currentMediaRef.current = resolvedMedia;
                setCurrentMedia(resolvedMedia);
                setPosition(data.position || 0);
                positionRef.current = data.position || 0;

                cleanupPlayer();
                const player = createAudioPlayer({ uri: resolvedUri }, { updateInterval: 500 });
                if (!active) {
                  player.remove();
                  return;
                }
                globalPlayer = player;
                playerRef.current = player;

                // Setup status listener
                globalSubscription = player.addListener('playbackStatusUpdate', (status) => {
                  setIsPlaying(status.playing);
                  setPosition(status.currentTime * 1000);
                  positionRef.current = status.currentTime * 1000;
                  setDuration(status.duration * 1000);
                  setPlaybackStatus(status);

                  if (status.didJustFinish) {
                    nextMediaRef.current();
                  }
                });
                subscriptionRef.current = globalSubscription;

                // Seek to initial position (seekTo takes seconds)
                await player.seekTo((data.position || 0) / 1000);
                if (!active) return;

                // Set lock screen active info
                player.setActiveForLockScreen(true, {
                  title: resolvedMedia.name,
                  artist: resolvedMedia.type === 'audio' ? 'Yerel Ses Dosyası' : 'Yerel Video Dosyası',
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to setup audio and load state:', error);
      }
    };

    setupAudioAndLoadState();

    return () => {
      active = false;
      cleanupPlayer();
      playerRef.current = null;
      subscriptionRef.current = null;
    };
  }, []);

  const playMedia = async (item: DownloadItem, newQueue?: DownloadItem[]) => {
    try {
      cleanupPlayer();
      playerRef.current = null;
      subscriptionRef.current = null;

      currentMediaRef.current = item;
      setCurrentMedia(item);
      setIsPlaying(true);
      setPosition(0);
      positionRef.current = 0;
      setDuration(0);

      if (newQueue) {
        queueRef.current = newQueue;
        setQueue(newQueue);
      } else if (!queueRef.current.some(q => q.id === item.id)) {
        const updatedQueue = [...queueRef.current, item];
        queueRef.current = updatedQueue;
        setQueue(updatedQueue);
      }

      const player = createAudioPlayer({ uri: item.localUri }, { updateInterval: 500 });
      globalPlayer = player;
      playerRef.current = player;

      // Setup status listener
      globalSubscription = player.addListener('playbackStatusUpdate', (status) => {
        setIsPlaying(status.playing);
        setPosition(status.currentTime * 1000);
        positionRef.current = status.currentTime * 1000;
        setDuration(status.duration * 1000);
        setPlaybackStatus(status);

        if (status.didJustFinish) {
          nextMediaRef.current();
        }
      });
      subscriptionRef.current = globalSubscription;

      player.play();

      // Set lock screen info
      player.setActiveForLockScreen(true, {
        title: item.name,
        artist: item.type === 'audio' ? 'Yerel Ses Dosyası' : 'Yerel Video Dosyası',
      });

      await savePlaybackState(item, newQueue || queueRef.current, 0);
    } catch (error) {
      console.error('Error in playMedia:', error);
      setIsPlaying(false);
    }
  };

  const pauseMedia = async () => {
    try {
      playerRef.current?.pause();
      setIsPlaying(false);
      if (currentMediaRef.current) {
        await savePlaybackState(currentMediaRef.current, queueRef.current, positionRef.current);
      }
    } catch (error) {
      console.error('Error pausing media:', error);
    }
  };

  const resumeMedia = async () => {
    try {
      if (playerRef.current) {
        playerRef.current.play();
        setIsPlaying(true);
      } else if (currentMediaRef.current) {
        await playMedia(currentMediaRef.current, queueRef.current);
      }
    } catch (error) {
      console.error('Error resuming media:', error);
    }
  };

  const stopMedia = async () => {
    try {
      cleanupPlayer();
      playerRef.current = null;
      subscriptionRef.current = null;

      currentMediaRef.current = null;
      setCurrentMedia(null);
      setIsPlaying(false);
      setPosition(0);
      positionRef.current = 0;
      setDuration(0);
      await savePlaybackState(null, [], 0);
    } catch (error) {
      console.error('Error stopping media:', error);
    }
  };

  const seekMedia = async (positionMs: number) => {
    try {
      await playerRef.current?.seekTo(positionMs / 1000);
      setPosition(positionMs);
      positionRef.current = positionMs;
      if (currentMediaRef.current) {
        await savePlaybackState(currentMediaRef.current, queueRef.current, positionMs);
      }
    } catch (error) {
      console.error('Error seeking media:', error);
    }
  };

  const nextMedia = async () => {
    const activeQueue = queueRef.current;
    const activeMedia = currentMediaRef.current;
    if (activeQueue.length === 0 || !activeMedia) return;

    const currentIndex = activeQueue.findIndex(item => item.id === activeMedia.id);
    if (currentIndex !== -1 && currentIndex < activeQueue.length - 1) {
      await playMedia(activeQueue[currentIndex + 1], activeQueue);
    } else {
      await stopMedia();
    }
  };

  const previousMedia = async () => {
    const activeQueue = queueRef.current;
    const activeMedia = currentMediaRef.current;
    if (activeQueue.length === 0 || !activeMedia) return;

    const currentIndex = activeQueue.findIndex(item => item.id === activeMedia.id);
    if (currentIndex > 0) {
      await playMedia(activeQueue[currentIndex - 1], activeQueue);
    } else {
      await seekMedia(0);
    }
  };

  const addToQueue = (item: DownloadItem) => {
    if (queueRef.current.some(q => q.id === item.id)) return;
    const updatedQueue = [...queueRef.current, item];
    queueRef.current = updatedQueue;
    setQueue(updatedQueue);
  };

  const removeFromQueue = (id: string) => {
    const updatedQueue = queueRef.current.filter(item => item.id !== id);
    queueRef.current = updatedQueue;
    setQueue(updatedQueue);
  };

  const clearQueue = () => {
    queueRef.current = [];
    setQueue([]);
  };

  // Periodically save state during active playback (every 5 seconds)
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        if (currentMediaRef.current) {
          savePlaybackState(currentMediaRef.current, queueRef.current, positionRef.current);
        }
      }, 5000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    nextMediaRef.current = nextMedia;
  });

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        currentMedia,
        position,
        duration,
        playbackStatus,
        queue,
        playMedia,
        pauseMedia,
        resumeMedia,
        stopMedia,
        seekMedia,
        nextMedia,
        previousMedia,
        addToQueue,
        removeFromQueue,
        clearQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
