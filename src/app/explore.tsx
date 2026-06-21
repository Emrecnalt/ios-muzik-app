import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  StatusBar,
  useColorScheme,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Play,
  Pause,
  Trash2,
  Search,
  FileAudio,
  FileVideo,
  FolderOpen,
  MoreVertical,
  Plus,
  X,
  ListMusic,
} from 'lucide-react-native';
import {
  getDownloads,
  deleteDownload,
  DownloadItem,
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  addItemToPlaylist,
  removeItemFromPlaylist,
  Playlist,
} from '@/services/DownloadService';
import { usePlayer } from '@/context/PlayerContext';

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { currentMedia, isPlaying, playMedia, pauseMedia, resumeMedia } = usePlayer();

  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'audio' | 'video' | 'playlists'>('all');

  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addToPlaylistModalVisible, setAddToPlaylistModalVisible] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<DownloadItem | null>(null);
  const [playlistViewerVisible, setPlaylistViewerVisible] = useState(false);
  const [activeViewerPlaylist, setActiveViewerPlaylist] = useState<Playlist | null>(null);

  // Load downloads and playlists when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadData = async () => {
        const list = await getDownloads();
        const pList = await getPlaylists();
        if (isMounted) {
          setDownloads(list);
          setPlaylists(pList);
        }
      };
      loadData();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const handleDelete = (item: DownloadItem) => {
    Alert.alert(
      'Medyayı Sil',
      `"${item.name}" dosyasını cihazınızdan kalıcı olarak silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteDownload(item.id);
            setDownloads(updated);
            // Refresh playlists as items inside them might have been deleted
            const pList = await getPlaylists();
            setPlaylists(pList);
          },
        },
      ]
    );
  };

  const handlePlayPress = async (item: DownloadItem) => {
    if (currentMedia?.id === item.id) {
      if (isPlaying) {
        await pauseMedia();
      } else {
        await resumeMedia();
      }
    } else {
      const filteredQueue = downloads.filter(
        d => activeTab === 'all' || d.type === activeTab
      );
      await playMedia(item, filteredQueue);
    }
  };

  // Playlist handlers
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir oynatma listesi adı girin.');
      return;
    }
    const updated = await createPlaylist(newPlaylistName.trim());
    setPlaylists(updated);
    setNewPlaylistName('');
    setCreateModalVisible(false);
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      'Listeyi Sil',
      `"${playlist.name}" oynatma listesini silmek istediğinizden emin misiniz? (İçindeki indirilen dosyalar silinmez)`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const updated = await deletePlaylist(playlist.id);
            setPlaylists(updated);
          },
        },
      ]
    );
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!selectedTrackForPlaylist) return;
    const updated = await addItemToPlaylist(playlistId, selectedTrackForPlaylist.id);
    setPlaylists(updated);
    setAddToPlaylistModalVisible(false);
    setSelectedTrackForPlaylist(null);
    Alert.alert('Başarılı', 'Medya oynatma listesine eklendi.');
  };

  const handleRemoveFromPlaylist = async (playlistId: string, itemId: string) => {
    const updated = await removeItemFromPlaylist(playlistId, itemId);
    setPlaylists(updated);
    // Refresh the viewer modal
    const updatedViewer = updated.find(p => p.id === playlistId) || null;
    setActiveViewerPlaylist(updatedViewer);
  };

  const playPlaylist = async (playlist: Playlist) => {
    const tracks = downloads.filter(d => playlist.itemIds.includes(d.id));
    if (tracks.length === 0) {
      Alert.alert('Bilgi', 'Bu oynatma listesi boş.');
      return;
    }
    await playMedia(tracks[0], tracks);
    setPlaylistViewerVisible(false);
  };

  // Helper: Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper: Format timestamp
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filtering downloads based on tab and search query
  const filteredDownloads = downloads.filter(item => {
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const renderQualityBadge = (item: DownloadItem) => {
    const isLossless = item.mimeType?.includes('audio/wav') || 
                       item.mimeType?.includes('audio/x-wav') || 
                       item.mimeType?.includes('audio/flac') || 
                       item.name.toLowerCase().endsWith('.wav') || 
                       item.name.toLowerCase().endsWith('.flac') || 
                       (item.type === 'audio' && item.size > 20 * 1024 * 1024);

    let label = 'HQ MP3';
    let bgColor = isDark ? '#2D3748' : '#EDF2F7';
    let textColor = isDark ? '#A0AEC0' : '#4A5568';

    if (item.type === 'video') {
      label = 'HD Video';
      bgColor = isDark ? 'rgba(49, 130, 206, 0.2)' : '#EBF8FF';
      textColor = isDark ? '#63B3ED' : '#2B6CB0';
    } else if (isLossless) {
      label = 'Kayıpsız';
      bgColor = isDark ? 'rgba(229, 62, 62, 0.2)' : '#FFF5F5';
      textColor = isDark ? '#FC8181' : '#C53030';
    }

    return (
      <View style={[styles.badge, { backgroundColor: bgColor }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: DownloadItem }) => {
    const isCurrentPlaying = currentMedia?.id === item.id;

    return (
      <View
        style={[
          styles.itemCard,
          isDark ? styles.itemCardDark : styles.itemCardLight,
          isCurrentPlaying && (isDark ? styles.playingItemDark : styles.playingItemLight),
        ]}
      >
        <TouchableOpacity
          style={styles.itemInfoContainer}
          onPress={() => handlePlayPress(item)}
          activeOpacity={0.7}
        >
          {item.type === 'audio' ? (
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(229, 62, 62, 0.1)' }]}>
              <FileAudio size={22} color="#E53E3E" />
            </View>
          ) : (
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(49, 130, 206, 0.1)' }]}>
              <FileVideo size={22} color="#3182CE" />
            </View>
          )}

          <View style={styles.itemMeta}>
            <Text
              style={[
                styles.itemName,
                isDark ? styles.textLight : styles.textDark,
                isCurrentPlaying && styles.playingText,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.subtextRow}>
              <Text 
                style={[styles.itemSubtext, isDark ? styles.textSecondaryDark : styles.textSecondaryLight, { flexShrink: 1 }]}
                numberOfLines={1}
              >
                {formatBytes(item.size)} • {formatDate(item.dateAdded)}
              </Text>
              {renderQualityBadge(item)}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => handlePlayPress(item)}
          >
            {isCurrentPlaying && isPlaying ? (
              <Pause size={18} color="#E53E3E" fill="#E53E3E" />
            ) : (
              <Play size={18} color={isDark ? '#FFF' : '#1A202C'} fill={isDark ? '#FFF' : '#1A202C'} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => {
              setSelectedTrackForPlaylist(item);
              setAddToPlaylistModalVisible(true);
            }}
          >
            <MoreVertical size={18} color={isDark ? '#A0AEC0' : '#4A5568'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Trash2 size={18} color="#E53E3E" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPlaylistCard = ({ item }: { item: Playlist }) => {
    return (
      <View style={[styles.itemCard, isDark ? styles.itemCardDark : styles.itemCardLight]}>
        <TouchableOpacity
          style={styles.itemInfoContainer}
          onPress={() => {
            setActiveViewerPlaylist(item);
            setPlaylistViewerVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(217, 70, 239, 0.1)' }]}>
            <ListMusic size={22} color="#D946EF" />
          </View>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemName, isDark ? styles.textLight : styles.textDark]}>
              {item.name}
            </Text>
            <Text style={[styles.itemSubtext, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {item.itemIds.length} Dosya
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => playPlaylist(item)}
          >
            <Play size={18} color="#D946EF" fill="#D946EF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeletePlaylist(item)}
          >
            <Trash2 size={18} color="#E53E3E" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, isDark ? styles.textLight : styles.textDark]}>
          Kütüphane
        </Text>
      </View>

      {/* Search Input */}
      {activeTab !== 'playlists' && (
        <View style={styles.searchSection}>
          <View style={[styles.searchContainer, isDark ? styles.searchDark : styles.searchLight]}>
            <View style={styles.searchIcon}><Search size={18} color="#718096" /></View>
            <TextInput
              style={[styles.searchInput, isDark ? styles.textLight : styles.textDark]}
              placeholder="İndirilenlerde ara..."
              placeholderTextColor="#A0AEC0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      )}

      {/* Category Tabs */}
      <View style={{ marginBottom: 15 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {(['all', 'audio', 'video', 'playlists'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && (isDark ? styles.tabActiveDark : styles.tabActiveLight),
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab
                    ? styles.tabTextActive
                    : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                ]}
              >
                {tab === 'all' && 'Hepsi'}
                {tab === 'audio' && 'Müzikler'}
                {tab === 'video' && 'Videolar'}
                {tab === 'playlists' && 'Oynatma Listeleri'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Playlists Creation Header (only in playlists tab) */}
      {activeTab === 'playlists' && (
        <TouchableOpacity
          style={[styles.createPlaylistCard, isDark ? styles.createPlaylistCardDark : styles.createPlaylistCardLight]}
          onPress={() => setCreateModalVisible(true)}
        >
          <View style={{ marginRight: 8 }}><Plus size={20} color="#D946EF" /></View>
          <Text style={styles.createPlaylistText}>Yeni Oynatma Listesi Oluştur</Text>
        </TouchableOpacity>
      )}

      {/* Main List Area */}
      {activeTab === 'playlists' ? (
        playlists.length > 0 ? (
          <FlatList
            data={playlists}
            keyExtractor={item => item.id}
            renderItem={renderPlaylistCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 15 }}><ListMusic size={64} color="#718096" /></View>
            <Text style={[styles.emptyTitle, isDark ? styles.textLight : styles.textDark]}>
              Oynatma Listesi Yok
            </Text>
            <Text style={[styles.emptySubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Henüz hiçbir oynatma listesi oluşturmadınız. Yukarıdaki butona tıklayarak ilk listenizi oluşturun!
            </Text>
          </View>
        )
      ) : (
        filteredDownloads.length > 0 ? (
          <FlatList
            data={filteredDownloads}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 15 }}><FolderOpen size={64} color="#718096" /></View>
            <Text style={[styles.emptyTitle, isDark ? styles.textLight : styles.textDark]}>
              Dosya Bulunamadı
            </Text>
            <Text style={[styles.emptySubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {downloads.length === 0
                ? 'Henüz hiçbir medya indirmediniz. İndirici sekmesinden başlayın!'
                : 'Arama kriterlerinize uygun dosya bulunamadı.'}
            </Text>
          </View>
        )
      )}

      {/* Modal 1: Create Playlist */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogBox, isDark ? styles.dialogDark : styles.dialogLight]}>
            <View style={styles.dialogHeader}>
              <Text style={[styles.dialogTitle, isDark ? styles.textLight : styles.textDark]}>Yeni Liste Oluştur</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <X size={20} color={isDark ? '#A0AEC0' : '#4A5568'} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.dialogInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Liste adı..."
              placeholderTextColor="#A0AEC0"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: '#718096' }]}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={styles.dialogBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: '#D946EF' }]}
                onPress={handleCreatePlaylist}
              >
                <Text style={styles.dialogBtnText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Add Track to Playlist */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addToPlaylistModalVisible}
        onRequestClose={() => {
          setAddToPlaylistModalVisible(false);
          setSelectedTrackForPlaylist(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogBox, isDark ? styles.dialogDark : styles.dialogLight, { maxHeight: '60%' }]}>
            <View style={styles.dialogHeader}>
              <Text style={[styles.dialogTitle, isDark ? styles.textLight : styles.textDark]} numberOfLines={1}>
                Listeye Ekle: {selectedTrackForPlaylist?.name}
              </Text>
              <TouchableOpacity onPress={() => {
                setAddToPlaylistModalVisible(false);
                setSelectedTrackForPlaylist(null);
              }}>
                <X size={20} color={isDark ? '#A0AEC0' : '#4A5568'} />
              </TouchableOpacity>
            </View>
            {playlists.length > 0 ? (
              <ScrollView style={{ marginVertical: 10 }}>
                {playlists.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playlistSelectRow, isDark ? styles.selectRowDark : styles.selectRowLight]}
                    onPress={() => handleAddToPlaylist(p.id)}
                  >
                    <View style={{ marginRight: 10 }}><ListMusic size={18} color="#D946EF" /></View>
                    <Text style={[styles.playlistSelectName, isDark ? styles.textLight : styles.textDark]}>
                      {p.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#718096' }}>
                      ({p.itemIds.length} Dosya)
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: '#718096', marginBottom: 10, textAlign: 'center' }}>
                  Oynatma listeniz bulunmamaktadır. Önce liste oluşturun.
                </Text>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: '#D946EF' }]}
                  onPress={() => {
                    setAddToPlaylistModalVisible(false);
                    setCreateModalVisible(true);
                  }}
                >
                  <Text style={styles.dialogBtnText}>Oluştur</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal 3: Playlist Tracks Viewer */}
      <Modal
        animationType="slide"
        visible={playlistViewerVisible}
        onRequestClose={() => {
          setPlaylistViewerVisible(false);
          setActiveViewerPlaylist(null);
        }}
      >
        <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={() => {
              setPlaylistViewerVisible(false);
              setActiveViewerPlaylist(null);
            }} style={styles.viewerCloseBtn}>
              <X size={24} color={isDark ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.viewerTitle, isDark ? styles.textLight : styles.textDark]} numberOfLines={1}>
              {activeViewerPlaylist?.name}
            </Text>
            {activeViewerPlaylist && activeViewerPlaylist.itemIds.length > 0 ? (
              <TouchableOpacity
                onPress={() => activeViewerPlaylist && playPlaylist(activeViewerPlaylist)}
                style={styles.viewerPlayAllBtn}
              >
                <Play size={20} color="#FFF" fill="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {activeViewerPlaylist && downloads.filter(d => activeViewerPlaylist.itemIds.includes(d.id)).length > 0 ? (
            <FlatList
              data={downloads.filter(d => activeViewerPlaylist.itemIds.includes(d.id))}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isCurrentPlaying = currentMedia?.id === item.id;
                return (
                  <View style={[styles.itemCard, isDark ? styles.itemCardDark : styles.itemCardLight]}>
                    <TouchableOpacity
                      style={styles.itemInfoContainer}
                      onPress={() => {
                        // Play from this playlist context
                        const playlistTracks = downloads.filter(d => activeViewerPlaylist.itemIds.includes(d.id));
                        playMedia(item, playlistTracks);
                      }}
                      activeOpacity={0.7}
                    >
                      {item.type === 'audio' ? (
                        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(229, 62, 62, 0.1)' }]}>
                          <FileAudio size={22} color="#E53E3E" />
                        </View>
                      ) : (
                        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(49, 130, 206, 0.1)' }]}>
                          <FileVideo size={22} color="#3182CE" />
                        </View>
                      )}
                      <View style={styles.itemMeta}>
                        <Text style={[styles.itemName, isDark ? styles.textLight : styles.textDark, isCurrentPlaying && styles.playingText]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.subtextRow}>
                          <Text style={[styles.itemSubtext, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                            {formatBytes(item.size)}
                          </Text>
                          {renderQualityBadge(item)}
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => activeViewerPlaylist && handleRemoveFromPlaylist(activeViewerPlaylist.id, item.id)}
                      >
                        <X size={18} color="#E53E3E" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={{ marginBottom: 15 }}><ListMusic size={64} color="#718096" /></View>
              <Text style={[styles.emptyTitle, isDark ? styles.textLight : styles.textDark]}>
                Liste Boş
              </Text>
              <Text style={[styles.emptySubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                Bu oynatma listesinde henüz hiçbir dosya bulunmamaktadır. Kütüphane ekranındaki dosyalardan "Oynatma Listesine Ekle" seçeneği ile ekleyin!
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchDark: {
    backgroundColor: '#1A202C',
  },
  searchLight: {
    backgroundColor: '#EDF2F7',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#718096',
  },
  tabActiveDark: {
    backgroundColor: '#E53E3E',
    borderColor: '#E53E3E',
  },
  tabActiveLight: {
    backgroundColor: '#C53030',
    borderColor: '#C53030',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Make room for player controls
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  itemCardDark: {
    backgroundColor: '#1A202C',
    borderColor: '#2D3748',
  },
  itemCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  playingItemDark: {
    borderColor: '#E53E3E',
    backgroundColor: 'rgba(229, 62, 62, 0.05)',
  },
  playingItemLight: {
    borderColor: '#C53030',
    backgroundColor: 'rgba(197, 48, 48, 0.05)',
  },
  itemInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 24,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  playingText: {
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  itemSubtext: {
    fontSize: 12,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexShrink: 1,
  },
  badge: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
    marginLeft: 6,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    padding: 8,
    marginRight: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  moreButton: {
    padding: 8,
    marginRight: 4,
  },
  createPlaylistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  createPlaylistCardDark: {
    backgroundColor: 'rgba(217, 70, 239, 0.05)',
    borderColor: '#D946EF',
  },
  createPlaylistCardLight: {
    backgroundColor: 'rgba(217, 70, 239, 0.02)',
    borderColor: '#D946EF',
  },
  createPlaylistText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D946EF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogBox: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  dialogDark: {
    backgroundColor: '#1A202C',
    borderColor: '#2D3748',
  },
  dialogLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  dialogInput: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 15,
  },
  inputDark: {
    backgroundColor: '#2D3748',
    borderColor: '#4A5568',
    color: '#FFFFFF',
  },
  inputLight: {
    backgroundColor: '#EDF2F7',
    borderColor: '#CBD5E0',
    color: '#1A202C',
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playlistSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  selectRowDark: {
    backgroundColor: '#2D3748',
  },
  selectRowLight: {
    backgroundColor: '#EDF2F7',
  },
  playlistSelectName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  viewerCloseBtn: {
    padding: 5,
  },
  viewerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  viewerPlayAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D946EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
