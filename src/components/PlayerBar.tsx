import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import Slider from '@react-native-community/slider';
import {
  ChevronDown,
  ChevronRight,
  ListMusic,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Video as VideoIcon,
  X,
} from 'lucide-react-native';

import { usePlayer } from '@/context/PlayerContext';
import { DownloadItem } from '@/services/DownloadService';

export default function PlayerBar() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const mediaSize = Math.min(width - 60, 320);

  const {
    currentMedia,
    isPlaying,
    position,
    duration,
    queue,
    playMedia,
    pauseMedia,
    resumeMedia,
    stopMedia,
    seekMedia,
    nextMedia,
    previousMedia,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (!videoRef.current || currentMedia?.type !== 'video') return;

    if (isPlaying) {
      videoRef.current.playAsync();
    } else {
      videoRef.current.pauseAsync();
    }
  }, [isPlaying, currentMedia]);

  if (!currentMedia) return null;

  const progressValue = duration > 0 ? position / duration : 0;

  const formatTime = (millis: number) => {
    if (Number.isNaN(millis) || millis < 0) return '00:00';
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (num: number) => (num < 10 ? `0${num}` : `${num}`);
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleSliderValueChange = (value: number) => {
    setIsSliding(true);
    setSliderValue(value);
  };

  const handleSliderSlidingComplete = async (value: number) => {
    const targetPosition = value * duration;
    await seekMedia(targetPosition);
    setIsSliding(false);
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pauseMedia();
    } else {
      await resumeMedia();
    }
  };

  const playQueueItem = async (item: DownloadItem) => {
    await playMedia(item, queue);
  };

  return (
    <>
      {!expanded && (
        <TouchableOpacity
          style={[
            styles.miniPlayer,
            isDark ? styles.miniPlayerDark : styles.miniPlayerLight,
            { bottom: Platform.OS === 'ios' ? 76 : 52 },
          ]}
          onPress={() => setExpanded(true)}
          activeOpacity={0.9}
        >
          <View style={styles.miniLeft}>
            {currentMedia.type === 'audio' ? (
              <View style={[styles.miniArt, { backgroundColor: '#E53E3E' }]}>
                <Music size={16} color="#FFF" />
              </View>
            ) : (
              <View style={[styles.miniArt, { backgroundColor: '#3182CE' }]}>
                <VideoIcon size={16} color="#FFF" />
              </View>
            )}
            <View style={styles.miniMeta}>
              <Text
                style={[styles.miniTitle, isDark ? styles.textLight : styles.textDark]}
                numberOfLines={1}
              >
                {currentMedia.name}
              </Text>
              <Text style={[styles.miniSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                {currentMedia.type === 'audio' ? 'Ses Dosyasi' : 'Video Dosyasi'}
              </Text>
            </View>
          </View>

          <View style={styles.miniControls}>
            <TouchableOpacity onPress={handlePlayPause} style={styles.miniButton}>
              {isPlaying ? (
                <Pause size={20} color={isDark ? '#FFF' : '#1A202C'} fill={isDark ? '#FFF' : '#1A202C'} />
              ) : (
                <Play size={20} color={isDark ? '#FFF' : '#1A202C'} fill={isDark ? '#FFF' : '#1A202C'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMedia} style={styles.miniButton}>
              <SkipForward size={20} color={isDark ? '#FFF' : '#1A202C'} fill={isDark ? '#FFF' : '#1A202C'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={stopMedia} style={styles.miniButton}>
              <X size={20} color="#718096" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <Modal animationType="slide" visible={expanded} onRequestClose={() => setExpanded(false)}>
        <SafeAreaView style={[styles.expandedContainer, isDark ? styles.bgDark : styles.bgLight]}>
          <View style={styles.expandedHeader}>
            <TouchableOpacity onPress={() => setExpanded(false)} style={styles.headerButton}>
              <ChevronDown size={28} color={isDark ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.expandedHeaderTitle, isDark ? styles.textLight : styles.textDark]}>
              Simdi Caliyor
            </Text>
            <TouchableOpacity
              onPress={() => setShowQueue(!showQueue)}
              style={[styles.headerButton, showQueue && styles.headerButtonActive]}
            >
              <ListMusic size={24} color={showQueue ? '#E53E3E' : (isDark ? '#FFF' : '#000')} />
            </TouchableOpacity>
          </View>

          {!showQueue ? (
            <View style={styles.playerMainView}>
              <View style={[styles.mediaContainer, { width: mediaSize, height: mediaSize }]}>
                {currentMedia.type === 'video' ? (
                  <Video
                    ref={videoRef}
                    style={styles.videoPlayer}
                    source={{ uri: currentMedia.localUri }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    isLooping
                  />
                ) : (
                  <View style={[styles.largeArt, isDark ? styles.largeArtDark : styles.largeArtLight]}>
                    <Music size={80} color="#E53E3E" />
                  </View>
                )}
              </View>

              <View style={styles.metaContainer}>
                <Text
                  style={[styles.songTitle, isDark ? styles.textLight : styles.textDark]}
                  numberOfLines={2}
                >
                  {currentMedia.name}
                </Text>
                <Text style={[styles.songArtist, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  {currentMedia.type === 'audio' ? 'Yerel Ses Dosyasi' : 'Yerel Video Dosyasi'}
                </Text>
              </View>

              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  value={isSliding ? sliderValue : progressValue}
                  minimumValue={0}
                  maximumValue={1}
                  minimumTrackTintColor="#E53E3E"
                  maximumTrackTintColor={isDark ? '#4A5568' : '#CBD5E0'}
                  thumbTintColor="#E53E3E"
                  onValueChange={handleSliderValueChange}
                  onSlidingComplete={handleSliderSlidingComplete}
                />
                <View style={styles.timeContainer}>
                  <Text style={[styles.timeText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    {formatTime(position)}
                  </Text>
                  <Text style={[styles.timeText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    {formatTime(duration)}
                  </Text>
                </View>
              </View>

              <View style={styles.controlsContainer}>
                <TouchableOpacity onPress={previousMedia} style={styles.controlButton}>
                  <SkipBack size={36} color={isDark ? '#FFF' : '#1A202C'} fill={isDark ? '#FFF' : '#1A202C'} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePlayPause}
                  style={[styles.playPauseButton, isDark ? styles.btnPlayDark : styles.btnPlayLight]}
                >
                  {isPlaying ? (
                    <Pause size={32} color="#FFF" fill="#FFF" />
                  ) : (
                    <View style={{ marginLeft: 4 }}>
                      <Play size={32} color="#FFF" fill="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={nextMedia} style={styles.controlButton}>
                  <SkipForward size={36} color={isDark ? '#FFF' : '#1A202C'} fill={isDark ? '#FFF' : '#1A202C'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.queueContainer}>
              <Text style={[styles.queueTitle, isDark ? styles.textLight : styles.textDark]}>
                Siradaki Parcalar ({queue.length})
              </Text>
              <FlatList
                data={queue}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isActive = item.id === currentMedia.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.queueItem,
                        isActive && (isDark ? styles.queueActiveDark : styles.queueActiveLight),
                      ]}
                      onPress={() => playQueueItem(item)}
                    >
                      <View style={styles.queueItemLeft}>
                        {item.type === 'audio' ? (
                          <Music size={16} color={isActive ? '#E53E3E' : '#718096'} />
                        ) : (
                          <VideoIcon size={16} color={isActive ? '#3182CE' : '#718096'} />
                        )}
                        <Text
                          style={[
                            styles.queueItemName,
                            isDark ? styles.textLight : styles.textDark,
                            isActive && styles.queueActiveText,
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </View>
                      <ChevronRight size={18} color="#718096" />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={[styles.emptyQueue, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    Sirada baska parca yok.
                  </Text>
                }
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#1A202C',
  },
  textSecondaryDark: {
    color: '#A0AEC0',
  },
  textSecondaryLight: {
    color: '#718096',
  },
  bgDark: {
    backgroundColor: '#000000',
  },
  bgLight: {
    backgroundColor: '#F7FAFC',
  },
  miniPlayer: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  miniPlayerDark: {
    backgroundColor: '#1E2530',
  },
  miniPlayerLight: {
    backgroundColor: '#FFFFFF',
  },
  miniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  miniArt: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniMeta: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  miniSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniButton: {
    padding: 8,
    marginLeft: 4,
  },
  expandedContainer: {
    flex: 1,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerButtonActive: {
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
  },
  expandedHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerMainView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingBottom: 40,
    paddingTop: 10,
  },
  mediaContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  largeArt: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  largeArtDark: {
    backgroundColor: '#1A202C',
  },
  largeArtLight: {
    backgroundColor: '#EDF2F7',
  },

  metaContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  songArtist: {
    fontSize: 15,
    marginTop: 6,
  },
  sliderContainer: {
    width: '100%',
    paddingHorizontal: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 40,
    marginVertical: 10,
  },
  controlButton: {
    padding: 10,
  },
  playPauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  btnPlayDark: {
    backgroundColor: '#E53E3E',
  },
  btnPlayLight: {
    backgroundColor: '#C53030',
  },
  queueContainer: {
    flex: 1,
    padding: 20,
  },
  queueTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  queueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  queueActiveDark: {
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
    borderColor: 'rgba(229, 62, 62, 0.3)',
  },
  queueActiveLight: {
    backgroundColor: 'rgba(197, 48, 48, 0.1)',
    borderColor: 'rgba(197, 48, 48, 0.3)',
  },
  queueItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  queueItemName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  queueActiveText: {
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  emptyQueue: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
});
