import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  useColorScheme,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import {
  Download,
  Link2,
  Music,
  Video,
  Settings,
  X,
  HelpCircle,
} from 'lucide-react-native';
import {
  downloadMedia,
  getCobaltEndpoint,
  setCobaltEndpoint,
  isDownloaded,
} from '@/services/DownloadService';
import { usePlayer } from '@/context/PlayerContext';

interface ActiveDownload {
  url: string;
  name: string;
  type: 'audio' | 'video';
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

export default function DownloaderScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { playMedia } = usePlayer();

  const [inputUrl, setInputUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [activeDownloads, setActiveDownloads] = useState<ActiveDownload[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState(getCobaltEndpoint());
  const [showHelp, setShowHelp] = useState(false);

  // List of fallback Cobalt servers in case the default is slow
  const alternativeServers = [
    'https://dog.kittycat.boo',
    'https://rue-cobalt.xenon.zone',
    'https://api.cobalt.tools',
  ];

  const handleSaveSettings = () => {
    if (!apiEndpoint.trim().startsWith('http')) {
      Alert.alert('Hata', 'Lütfen geçerli bir URL girin (http:// veya https:// ile başlamalıdır).');
      return;
    }
    setCobaltEndpoint(apiEndpoint.trim());
    setSettingsVisible(false);
  };

  const startDownload = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir bağlantı adresi girin.');
      return;
    }

    const url = inputUrl.trim();
    const name = customName.trim();
    const type = mediaType;

    // Check if already in active downloads
    if (activeDownloads.some(dl => dl.url === url && dl.status === 'downloading')) {
      Alert.alert('Bilgi', 'Bu dosya zaten indiriliyor.');
      return;
    }

    // Check if already downloaded
    const alreadyDownloaded = await isDownloaded(url);
    if (alreadyDownloaded) {
      Alert.alert('Bilgi', 'Bu dosya zaten kütüphanenizde mevcut.');
      return;
    }

    // Set download name to custom name or URL basename
    let displayName = name;
    if (!displayName) {
      try {
        const urlObj = new URL(url);
        displayName = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
      } catch {
        displayName = 'Medya Dosyası';
      }
    }
    if (!displayName) {
      displayName = `Dosya_${Date.now()}`;
    }

    // Add to active downloads
    const newDownload: ActiveDownload = {
      url,
      name: displayName,
      type,
      progress: 0,
      status: 'pending',
    };

    setActiveDownloads(prev => [newDownload, ...prev]);
    setInputUrl('');
    setCustomName('');
    Keyboard.dismiss();

    try {
      // Update status to downloading
      setActiveDownloads(prev =>
        prev.map(dl => (dl.url === url ? { ...dl, status: 'downloading' } : dl))
      );

      const downloadedItem = await downloadMedia(
        url,
        name, // Pass raw customName (empty string if they left it blank)
        type,
        (progress) => {
          setActiveDownloads(prev =>
            prev.map(dl => (dl.url === url ? { ...dl, progress } : dl))
          );
        }
      );

      // Update status to completed and set actual resolved name
      setActiveDownloads(prev =>
        prev.map(dl => (dl.url === url ? { ...dl, status: 'completed', progress: 1, name: downloadedItem.name } : dl))
      );

      Alert.alert(
        'Başarılı',
        `"${downloadedItem.name}" başarıyla indirildi. Şimdi dinlemek ister misiniz?`,
        [
          { text: 'Daha Sonra', style: 'cancel' },
          { text: 'Şimdi Oynat', onPress: () => playMedia(downloadedItem) },
        ]
      );
    } catch (error: any) {
      console.error(error);
      setActiveDownloads(prev =>
        prev.map(dl => (
          dl.url === url
            ? { ...dl, status: 'failed', error: error.message || 'İndirme hatası' }
            : dl
        ))
      );
      Alert.alert('İndirme Başarısız', `"${displayName}" indirilemedi. Lütfen bağlantıyı veya ayarlar kısmından API sunucusunu kontrol edin.`);
    }
  };

  const removeActiveDownload = (url: string) => {
    setActiveDownloads(prev => prev.filter(dl => dl.url !== url));
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark ? styles.textLight : styles.textDark]}>
            Müzik İndirici
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={() => setShowHelp(true)}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <HelpCircle size={24} color={isDark ? '#E53E3E' : '#C53030'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSettingsVisible(true)}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Settings size={24} color={isDark ? '#E53E3E' : '#C53030'} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Paste Section */}
          <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.cardLabel, isDark ? styles.textLight : styles.textDark]}>
              Bağlantı Adresi (URL)
            </Text>
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}><Link2 size={20} color="#718096" /></View>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="YouTube, SoundCloud, MP3/MP4 bağlantısı..."
                placeholderTextColor="#A0AEC0"
                value={inputUrl}
                onChangeText={setInputUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Custom Name Section */}
            <Text style={[styles.cardLabel, { marginTop: 15 }, isDark ? styles.textLight : styles.textDark]}>
              Özel Dosya Adı (İsteğe bağlı)
            </Text>
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}><Music size={20} color="#718096" /></View>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Boş bırakılırsa otomatik adlandırılır..."
                placeholderTextColor="#A0AEC0"
                value={customName}
                onChangeText={setCustomName}
              />
            </View>

            {/* Format Selection (Segmented Control) */}
            <Text style={[styles.cardLabel, { marginTop: 15 }, isDark ? styles.textLight : styles.textDark]}>
              İndirme Formatı
            </Text>
            <View style={[styles.segmentContainer, isDark ? styles.segmentDark : styles.segmentLight]}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  mediaType === 'audio' && (isDark ? styles.segmentActiveDark : styles.segmentActiveLight),
                ]}
                onPress={() => setMediaType('audio')}
                activeOpacity={0.8}
              >
                <View style={styles.segmentIcon}><Music size={16} color={mediaType === 'audio' ? '#fff' : '#718096'} /></View>
                <Text
                  style={[
                    styles.segmentText,
                    mediaType === 'audio' ? styles.textActive : styles.textInactive,
                  ]}
                >
                  Ses (MP3)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  mediaType === 'video' && (isDark ? styles.segmentActiveDark : styles.segmentActiveLight),
                ]}
                onPress={() => setMediaType('video')}
                activeOpacity={0.8}
              >
                <View style={styles.segmentIcon}><Video size={16} color={mediaType === 'video' ? '#fff' : '#718096'} /></View>
                <Text
                  style={[
                    styles.segmentText,
                    mediaType === 'video' ? styles.textActive : styles.textInactive,
                  ]}
                >
                  Video (MP4)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Download Button */}
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={startDownload}
              activeOpacity={0.8}
            >
              <View style={{ marginRight: 8 }}><Download size={20} color="#fff" /></View>
              <Text style={styles.downloadButtonText}>İndirmeyi Başlat</Text>
            </TouchableOpacity>
          </View>

          {/* Active Downloads List */}
          {activeDownloads.length > 0 && (
            <View style={styles.activeSection}>
              <Text style={[styles.sectionTitle, isDark ? styles.textLight : styles.textDark]}>
                Aktif İndirmeler
              </Text>
              {activeDownloads.map((dl, index) => (
                <View
                  key={dl.url}
                  style={[
                    styles.downloadCard,
                    isDark ? styles.downloadCardDark : styles.downloadCardLight,
                  ]}
                >
                  <View style={styles.downloadHeader}>
                    <View style={styles.downloadInfo}>
                      {dl.type === 'audio' ? (
                        <View style={styles.dlTypeIcon}><Music size={18} color="#E53E3E" /></View>
                      ) : (
                        <View style={styles.dlTypeIcon}><Video size={18} color="#3182CE" /></View>
                      )}
                      <Text
                        style={[
                          styles.dlName,
                          isDark ? styles.textLight : styles.textDark,
                        ]}
                        numberOfLines={1}
                      >
                        {dl.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeActiveDownload(dl.url)}
                      style={styles.dlClose}
                    >
                      <X size={16} color="#718096" />
                    </TouchableOpacity>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressContainer}>
                    <View style={[styles.progressBarBg, isDark ? styles.progressBgDark : styles.progressBgLight]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${dl.progress * 100}%` },
                          dl.status === 'failed' && styles.fillFailed,
                          dl.status === 'completed' && styles.fillCompleted,
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressPercent, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                      {dl.status === 'pending' && 'Bekliyor...'}
                      {dl.status === 'downloading' && `${Math.round(dl.progress * 100)}%`}
                      {dl.status === 'completed' && 'Tamamlandı'}
                      {dl.status === 'failed' && 'Başarısız'}
                    </Text>
                  </View>

                  {dl.status === 'failed' && (
                    <Text style={styles.errorText} numberOfLines={1}>
                      Hata: {dl.error}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Settings Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={settingsVisible}
          onRequestClose={() => setSettingsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDark ? styles.modalDark : styles.modalLight]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isDark ? styles.textLight : styles.textDark]}>
                  API Ayarları
                </Text>
                <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                  <X size={24} color={isDark ? '#fff' : '#000'} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                Cobalt API Sunucusu (YouTube, SoundCloud indirmeleri için dönüştürücü sunucu):
              </Text>

              <TextInput
                style={[styles.modalInput, isDark ? styles.inputDark : styles.inputLight]}
                value={apiEndpoint}
                onChangeText={setApiEndpoint}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.modalLabel, { marginTop: 15 }, isDark ? styles.textLight : styles.textDark]}>
                Alternatif Sunucular (Tıklayıp Seçin):
              </Text>

              {alternativeServers.map(server => (
                <TouchableOpacity
                  key={server}
                  style={[
                    styles.serverOption,
                    apiEndpoint === server && styles.serverOptionActive,
                  ]}
                  onPress={() => setApiEndpoint(server)}
                >
                  <Text
                    style={[
                      styles.serverOptionText,
                      apiEndpoint === server ? styles.textActive : (isDark ? styles.textLight : styles.textDark),
                    ]}
                  >
                    {server}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveSettings}
              >
                <Text style={styles.saveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Help Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showHelp}
          onRequestClose={() => setShowHelp(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDark ? styles.modalDark : styles.modalLight]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isDark ? styles.textLight : styles.textDark]}>
                  Nasıl İndirilir?
                </Text>
                <TouchableOpacity onPress={() => setShowHelp(false)}>
                  <X size={24} color={isDark ? '#fff' : '#000'} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 300, marginTop: 10 }}>
                <Text style={[styles.helpParagraph, isDark ? styles.textLight : styles.textDark]}>
                  <Text style={styles.boldText}>1. Doğrudan Dosya İndirme:</Text>{'\n'}
                  Sonu .mp3, .mp4, .wav, .m4a olan doğrudan bağlantıları buraya yapıştırıp hızlıca cihazınıza indirebilirsiniz.
                </Text>

                <Text style={[styles.helpParagraph, isDark ? styles.textLight : styles.textDark, { marginTop: 15 }]}>
                  <Text style={styles.boldText}>2. YouTube ve SoundCloud İndirme:</Text>{'\n'}
                  İstediğiniz YouTube videosunun veya SoundCloud şarkısının linkini yapıştırın. Arka planda çalışan API sunucumuz bu dosyayı ses (MP3) veya video (MP4) olarak dönüştürecek ve telefonunuza indirecektir.
                </Text>

                <Text style={[styles.helpParagraph, isDark ? styles.textLight : styles.textDark, { marginTop: 15 }]}>
                  <Text style={styles.boldText}>3. API Sunucusu Hatası Alırsanız:</Text>{'\n'}
                  Cobalt sunucuları aşırı yoğunluk nedeniyle bazen hata verebilir. Dişli çark (ayarlar) simgesine basıp alternatif bir sunucu adresi seçerek indirmeyi yeniden deneyebilirsiniz.
                </Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => setShowHelp(false)}
              >
                <Text style={styles.saveButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgDark: {
    backgroundColor: '#000000',
  },
  bgLight: {
    backgroundColor: '#F7FAFC',
  },
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#1A202C',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F4E65',
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  inputDark: {
    color: '#FFFFFF',
  },
  inputLight: {
    color: '#1A202C',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    height: 48,
    alignItems: 'center',
  },
  segmentDark: {
    backgroundColor: '#2D3748',
  },
  segmentLight: {
    backgroundColor: '#EDF2F7',
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    borderRadius: 10,
  },
  segmentActiveDark: {
    backgroundColor: '#E53E3E',
  },
  segmentActiveLight: {
    backgroundColor: '#C53030',
  },
  segmentIcon: {
    marginRight: 6,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textActive: {
    color: '#FFFFFF',
  },
  textInactive: {
    color: '#718096',
  },
  downloadButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeSection: {
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  downloadCard: {
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  downloadCardDark: {
    backgroundColor: '#1A202C',
    borderColor: '#2D3748',
  },
  downloadCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  downloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  downloadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dlTypeIcon: {
    marginRight: 8,
  },
  dlName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  dlClose: {
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressBgDark: {
    backgroundColor: '#2D3748',
  },
  progressBgLight: {
    backgroundColor: '#E2E8F0',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#48BB78',
    borderRadius: 4,
  },
  fillFailed: {
    backgroundColor: '#E53E3E',
  },
  fillCompleted: {
    backgroundColor: '#3182CE',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
    width: 65,
    textAlign: 'right',
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 12,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1A202C',
  },
  modalLight: {
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A5568',
    height: 48,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 15,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  serverOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A5568',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 8,
  },
  serverOptionActive: {
    borderColor: '#E53E3E',
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
  },
  serverOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  helpParagraph: {
    fontSize: 14,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#E53E3E',
  },
});
