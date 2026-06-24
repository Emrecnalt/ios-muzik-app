import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  useColorScheme,
  Animated,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Download,
  Music,
  Video,
  X,
  Play,
} from 'lucide-react-native';
import { usePlayer } from '@/context/PlayerContext';
import { downloadMedia, isDownloaded } from '@/services/DownloadService';


// Ad blocker Javascript to be injected into YouTube
const AD_BLOCKER_SCRIPT = `
  (function() {
    const skipAds = () => {
      // 1. Inject custom CSS styles to hide common ad zones and overlays
      let adStyles = document.getElementById('app-ad-blocker-styles');
      if (!adStyles) {
        adStyles = document.createElement('style');
        adStyles.id = 'app-ad-blocker-styles';
        adStyles.innerHTML = \`
          .ad-showing, .ad-interrupting, .ytp-ad-overlay-container, 
          .ytp-ad-message-container, #player-ads, .ad-container, 
          .ad-div, .ad-image, ytm-companion-ad-renderer, 
          ytm-promoted-sparkles-web-renderer, ytd-companion-card-renderer,
          .ytm-promoted-video-renderer, .ytm-display-ad-renderer,
          .ytp-ad-action-interstitial, .ytp-ad-player-overlay-flyout-wip,
          ytm-mealbar-promo-renderer, ytm-single-column-watch-next-results-renderer ytm-companion-ad-renderer {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
          }
        \`;
        document.head.appendChild(adStyles);
      }

      // 2. Find video element and speed up / skip if ad is playing
      const video = document.querySelector('video');
      if (!video) return;

      // Determine if an ad is currently active
      const isAdActive = document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .video-ads') || 
                         (window.location.href.includes('watch') && document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-text'));

      if (isAdActive) {
        // Mute video and speed it up to 16x
        video.playbackRate = 16;
        video.muted = true;

        // Skip to the end of the ad segment
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration - 0.1;
        }

        // Programmatically click skip buttons
        const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot, button[class*="skip-button"]');
        skipButtons.forEach(btn => {
          if (btn) {
            btn.click();
          }
        });
      }
    };

    // Run every 250ms for responsiveness
    skipAds();
    setInterval(skipAds, 250);
  })();
  true; // Return value for WebView injection success
`;

export default function YouTubeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isPlaying, pauseMedia, playMedia } = usePlayer();

  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState('https://m.youtube.com');
  const [pageTitle, setPageTitle] = useState('YouTube');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Download states
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [videoTitleToDownload, setVideoTitleToDownload] = useState('YouTube Videosu');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed' | 'failed'>('idle');
  const [downloadedItemRef, setDownloadedItemRef] = useState<any>(null);
  const [activeDownloadName, setActiveDownloadName] = useState('');

  // Pulse animation for download button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isYoutubeVideo(currentUrl)) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [currentUrl, pulseAnim]);

  // Pause local player when entering the tab
  useFocusEffect(
    React.useCallback(() => {
      if (isPlaying) {
        pauseMedia();
      }
    }, [isPlaying, pauseMedia])
  );

  const isYoutubeVideo = (url: string): boolean => {
    return url.includes('watch?v=') || url.includes('youtube.com/shorts/') || url.includes('youtu.be/');
  };

  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setIsLoading(navState.loading);
    if (navState.title && navState.title !== 'm.youtube.com') {
      // Clean up YouTube's suffix from titles
      const cleanTitle = navState.title.replace(' - YouTube', '');
      setPageTitle(cleanTitle);
      if (isYoutubeVideo(navState.url)) {
        setVideoTitleToDownload(cleanTitle);
      }
    }
  };

  // Browser Actions
  const goBack = () => webViewRef.current?.goBack();
  const goForward = () => webViewRef.current?.goForward();
  const reload = () => webViewRef.current?.reload();
  const goHome = () => {
    const homeUrl = 'https://m.youtube.com';
    webViewRef.current?.injectJavaScript(`window.location.href = "${homeUrl}"; true;`);
  };

  // Download Trigger
  const handleDownloadPress = async () => {
    const alreadyDownloaded = await isDownloaded(currentUrl);
    if (alreadyDownloaded) {
      Alert.alert('Bilgi', 'Bu video zaten kütüphanenizde mevcut.');
      return;
    }
    setDownloadModalVisible(true);
  };

  const startDownload = async (type: 'audio' | 'video') => {
    setDownloadModalVisible(false);
    setDownloadStatus('downloading');
    setDownloadProgress(0);
    setActiveDownloadName(videoTitleToDownload);

    try {
      const downloadedItem = await downloadMedia(
        currentUrl,
        videoTitleToDownload,
        type,
        (progress) => {
          setDownloadProgress(progress);
        }
      );
      setDownloadedItemRef(downloadedItem);
      setDownloadStatus('completed');
    } catch (error: any) {
      console.error('YouTube download failed:', error);
      setDownloadStatus('failed');
      Alert.alert('İndirme Hatası', error.message || 'Video dönüştürülüp indirilemedi.');
    }
  };

  const playDownloadedItem = () => {
    if (downloadedItemRef) {
      playMedia(downloadedItemRef);
      setDownloadStatus('idle');
      setDownloadedItemRef(null);
    }
  };

  const styles = getStyles(isDark);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#1A202C' : '#FFFFFF'} />
      
      {/* Header Browser Controls */}
      <View style={styles.header}>
        <View style={styles.navigationButtons}>
          <TouchableOpacity onPress={goBack} disabled={!canGoBack} style={[styles.navButton, !canGoBack && styles.disabledButton]}>
            <ArrowLeft size={20} color={canGoBack ? (isDark ? '#E2E8F0' : '#2D3748') : (isDark ? '#4A5568' : '#CBD5E0')} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goForward} disabled={!canGoForward} style={[styles.navButton, !canGoForward && styles.disabledButton]}>
            <ArrowRight size={20} color={canGoForward ? (isDark ? '#E2E8F0' : '#2D3748') : (isDark ? '#4A5568' : '#CBD5E0')} />
          </TouchableOpacity>
          <TouchableOpacity onPress={reload} style={styles.navButton}>
            <RotateCw size={18} color={isDark ? '#E2E8F0' : '#2D3748'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goHome} style={styles.navButton}>
            <Home size={18} color={isDark ? '#E2E8F0' : '#2D3748'} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.titleContainer}>
          <Text numberOfLines={1} style={styles.titleText}>{isLoading ? 'Yükleniyor...' : pageTitle}</Text>
        </View>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.progressBarContainer}>
          <ActivityIndicator size="small" color="#E53E3E" />
        </View>
      )}

      {/* WebView Container */}
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://m.youtube.com' }}
          onNavigationStateChange={handleNavigationStateChange}
          injectedJavaScript={AD_BLOCKER_SCRIPT}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          style={styles.webView}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        />
      </View>

      {/* Floating Download Button */}
      {isYoutubeVideo(currentUrl) && downloadStatus !== 'downloading' && (
        <Animated.View style={[styles.floatingButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={styles.floatingButton} onPress={handleDownloadPress} activeOpacity={0.8}>
            <Download size={24} color="#FFFFFF" />
            <Text style={styles.floatingButtonText}>İndir</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom Download Status Panel */}
      {downloadStatus !== 'idle' && (
        <View style={styles.downloadPanel}>
          <View style={styles.downloadPanelInfo}>
            <Text numberOfLines={1} style={styles.downloadPanelTitle}>{activeDownloadName}</Text>
            {downloadStatus === 'downloading' ? (
              <Text style={styles.downloadPanelProgressText}>
                {downloadProgress > 0 ? `İndiriliyor: %${Math.round(downloadProgress * 100)}` : 'Dönüştürülüyor...'}
              </Text>
            ) : downloadStatus === 'completed' ? (
              <Text style={styles.downloadPanelSuccessText}>İndirme Tamamlandı!</Text>
            ) : (
              <Text style={styles.downloadPanelFailedText}>İndirme Başarısız.</Text>
            )}
          </View>

          {downloadStatus === 'downloading' ? (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${downloadProgress * 100}%` }]} />
            </View>
          ) : (
            <View style={styles.downloadPanelActions}>
              {downloadStatus === 'completed' && (
                <TouchableOpacity style={styles.playButton} onPress={playDownloadedItem}>
                  <Play size={14} color="#FFFFFF" />
                  <Text style={styles.playButtonText}>Oynat</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closePanelButton} onPress={() => setDownloadStatus('idle')}>
                <X size={18} color={isDark ? '#E2E8F0' : '#2D3748'} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Download Options Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={downloadModalVisible}
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>İndirme Seçenekleri</Text>
              <TouchableOpacity onPress={() => setDownloadModalVisible(false)}>
                <X size={20} color={isDark ? '#A0AEC0' : '#718096'} />
              </TouchableOpacity>
            </View>

            <Text numberOfLines={2} style={styles.modalVideoTitle}>{videoTitleToDownload}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.downloadOptionButton} onPress={() => startDownload('audio')}>
                <Music size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <View>
                  <Text style={styles.buttonTextPrimary}>Ses Olarak İndir</Text>
                  <Text style={styles.buttonTextSecondary}>MP3 Formatında (Şarkılar için)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.downloadOptionButton} onPress={() => startDownload('video')}>
                <Video size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <View>
                  <Text style={styles.buttonTextPrimary}>Video Olarak İndir</Text>
                  <Text style={styles.buttonTextSecondary}>MP4 Formatında (Klipler için)</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDark ? '#1A202C' : '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2D3748' : '#E2E8F0',
    backgroundColor: isDark ? '#1A202C' : '#FFFFFF',
  },
  navigationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#E2E8F0' : '#2D3748',
  },
  progressBarContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingVertical: 2,
    backgroundColor: isDark ? 'rgba(26,32,44,0.8)' : 'rgba(255,255,255,0.8)',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: isDark ? '#1A202C' : '#FFFFFF',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 20,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E53E3E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
  downloadPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isDark ? '#2D3748' : '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#4A5568' : '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  downloadPanelInfo: {
    flex: 1,
    marginRight: 12,
  },
  downloadPanelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isDark ? '#E2E8F0' : '#2D3748',
  },
  downloadPanelProgressText: {
    fontSize: 12,
    color: '#E53E3E',
    marginTop: 2,
  },
  downloadPanelSuccessText: {
    fontSize: 12,
    color: '#38A169',
    fontWeight: '600',
    marginTop: 2,
  },
  downloadPanelFailedText: {
    fontSize: 12,
    color: '#E53E3E',
    fontWeight: '600',
    marginTop: 2,
  },
  downloadPanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressContainer: {
    width: 80,
    height: 6,
    backgroundColor: isDark ? '#4A5568' : '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#E53E3E',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38A169',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginRight: 8,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  closePanelButton: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDark ? '#2D3748' : '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDark ? '#E2E8F0' : '#2D3748',
  },
  modalVideoTitle: {
    fontSize: 14,
    color: isDark ? '#A0AEC0' : '#4A5568',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalButtons: {
    gap: 12,
  },
  downloadOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E53E3E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonIcon: {
    marginRight: 16,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
});
