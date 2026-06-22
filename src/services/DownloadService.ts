import * as FileSystem from 'expo-file-system/legacy';

export interface DownloadItem {
  id: string;
  name: string;
  url: string; // Original URL
  localUri: string; // Saved file location
  type: 'audio' | 'video';
  mimeType: string;
  size: number;
  dateAdded: number;
}

const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;
const METADATA_FILE = `${DOWNLOAD_DIR}metadata.json`;

// Default Cobalt API endpoint. Can be customized in app settings.
let cobaltApiEndpoint = 'https://dog.kittycat.boo';

export const setCobaltEndpoint = (endpoint: string) => {
  cobaltApiEndpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
};

export const getCobaltEndpoint = () => cobaltApiEndpoint;

// Ensure download directory exists
const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
};

// Get list of all downloads
export const getDownloads = async (): Promise<DownloadItem[]> => {
  try {
    await ensureDirExists();
    const fileInfo = await FileSystem.getInfoAsync(METADATA_FILE);
    if (!fileInfo.exists) {
      return [];
    }
    const content = await FileSystem.readAsStringAsync(METADATA_FILE);
    const items = JSON.parse(content) as DownloadItem[];
    return items.map(item => {
      const fileName = item.localUri.split('/').pop();
      return {
        ...item,
        localUri: `${DOWNLOAD_DIR}${fileName}`
      };
    });
  } catch (error) {
    console.error('Error reading downloads metadata:', error);
    return [];
  }
};

// Save list of downloads
const saveMetadata = async (items: DownloadItem[]) => {
  await ensureDirExists();
  await FileSystem.writeAsStringAsync(METADATA_FILE, JSON.stringify(items, null, 2));
};

// Check if a file is already downloaded
export const isDownloaded = async (originalUrl: string): Promise<boolean> => {
  const downloads = await getDownloads();
  return downloads.some(item => item.url === originalUrl);
};

// Helper function to extract YouTube Video ID from various URL formats
const getYoutubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|^youtube.com\/shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  if (url.includes('youtube.com/shorts/')) {
    const shortsMatch = /\/shorts\/([a-zA-Z0-9\-\_]{11})/.exec(url);
    if (shortsMatch) return shortsMatch[1];
  }
  if (url.includes('youtu.be/')) {
    const youtubebeMatch = /\/([a-zA-Z0-9\-\_]{11})/.exec(url);
    if (youtubebeMatch) return youtubebeMatch[1];
  }
  return null;
};

// Custom resolver using ytmp3.mobi API to bypass YouTube blocks
const fetchYoutubeMediaLink = async (
  videoUrl: string,
  type: 'audio' | 'video'
): Promise<{ downloadUrl: string; filename: string }> => {
  const videoId = getYoutubeVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Geçersiz YouTube bağlantısı. Video ID bulunamadı.');
  }

  const format = type === 'audio' ? 'mp3' : 'mp4';

  // Step 1: Initialize session on a.ymcdn.org
  const initUrl = `https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`;
  const initResponse = await fetch(initUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Referer': 'https://ytmp3.mobi/'
    }
  });

  if (!initResponse.ok) {
    throw new Error('Dönüştürme sunucusu başlatılamadı (Init Hatası).');
  }

  const initData = await initResponse.json();
  if (initData.error > 0) {
    throw new Error(`Dönüştürme sunucusu hatası: ${initData.error}`);
  }

  const convertUrlBase = initData.convertURL;

  // Step 2: Trigger conversion process
  let currentConvertUrl = `${convertUrlBase}&v=${videoId}&f=${format}&_=${Math.random()}`;
  let convertResponse = await fetch(currentConvertUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Referer': 'https://ytmp3.mobi/'
    }
  });

  if (!convertResponse.ok) {
    throw new Error('Dönüştürme işlemi başlatılamadı.');
  }

  let convertData = await convertResponse.json();
  if (convertData.error > 0) {
    throw new Error(`Dönüştürme hatası: ${convertData.error}`);
  }

  // Handle redirects if any
  let redirectLimit = 3;
  while (convertData.redirect > 0 && convertData.redirectURL && redirectLimit > 0) {
    convertResponse = await fetch(convertData.redirectURL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Referer': 'https://ytmp3.mobi/'
      }
    });
    convertData = await convertResponse.json();
    redirectLimit--;
  }

  if (!convertData.progressURL) {
    throw new Error('Dönüştürme durumu takip bağlantısı alınamadı.');
  }

  const progressUrl = convertData.progressURL;
  const targetDownloadUrl = convertData.downloadURL;
  const videoTitle = convertData.title || `YouTube_Media_${Date.now()}`;

  // Step 3: Poll progress until completed
  let pollAttempts = 35;
  while (pollAttempts > 0) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pollResponse = await fetch(progressUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Referer': 'https://ytmp3.mobi/'
      }
    });

    if (!pollResponse.ok) {
      pollAttempts--;
      continue;
    }

    const pollData = await pollResponse.json();
    if (pollData.error > 0) {
      throw new Error(`Dönüştürme sırasında hata oluştu: ${pollData.error}`);
    }

    if (pollData.progress >= 3) {
      const downloadUrl = pollData.downloadURL || targetDownloadUrl;
      const filename = `${videoTitle}.${type === 'audio' ? 'mp3' : 'mp4'}`;
      return { downloadUrl, filename };
    }

    pollAttempts--;
  }

  throw new Error('Dönüştürme işlemi zaman aşımına uğradı.');
};

// Fetch download URL from Cobalt API or ytmp3.mobi bypass
export const fetchMediaLink = async (
  videoUrl: string,
  type: 'audio' | 'video'
): Promise<{ downloadUrl: string; filename: string }> => {
  // Check if it is a YouTube URL
  const isYouTube = videoUrl.match(/(youtube\.com|youtu\.be|youtube-nocookie\.com)/i);
  if (isYouTube) {
    try {
      console.log('YouTube link detected. Using ytmp3.mobi bypass API...');
      return await fetchYoutubeMediaLink(videoUrl, type);
    } catch (error) {
      console.warn('YouTube bypass API failed, trying Cobalt API fallback...', error);
      // Fall through to Cobalt API fallback below
    }
  }

  console.log('Non-YouTube link. Using Cobalt API fallback...');
  try {
    const response = await fetch(cobaltApiEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        downloadMode: type === 'audio' ? 'audio' : 'auto',
        audioFormat: 'mp3',
        filenameStyle: 'pretty',
        videoQuality: '720',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.error?.code || 'Unknown Cobalt API error');
    }

    if (data.status === 'redirect' || data.status === 'stream' || data.status === 'tunnel') {
      const filename = data.filename || `downloaded_media_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`;
      return { downloadUrl: data.url, filename };
    }

    if (data.status === 'picker' && data.picker && data.picker.length > 0) {
      const item = data.picker.find((p: any) => type === 'audio' ? p.type === 'audio' : p.type === 'video') || data.picker[0];
      return { downloadUrl: item.url, filename: `media_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}` };
    }

    throw new Error('Unsupported response status from downloader API');
  } catch (error: any) {
    console.error('fetchMediaLink error:', error);
    throw error;
  }
};

// Download file to local storage
export const downloadMedia = async (
  url: string,
  customName: string,
  type: 'audio' | 'video',
  onProgress?: (progress: number) => void
): Promise<DownloadItem> => {
  await ensureDirExists();

  let finalDownloadUrl = url;
  let filename = customName.trim();

  // If it's not a direct file link, resolve it using the appropriate resolver
  const isDirectLink = url.match(/\.(mp3|mp4|wav|m4a|mov|avi|flac|ogg|opus)(\?.*)?$/i);
  if (!isDirectLink) {
    const resolved = await fetchMediaLink(url, type);
    finalDownloadUrl = resolved.downloadUrl;
    if (!filename) {
      filename = resolved.filename.replace(/\.[^/.]+$/, ""); // Strip extension
    }
  } else if (!filename) {
    // Extract name from direct link
    try {
      const urlObj = new URL(url);
      const base = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
      filename = base.replace(/\.[^/.]+$/, ""); // Strip extension
    } catch {
      filename = 'Medya Dosyası';
    }
  }

  if (!filename) {
    filename = `Media_${Date.now()}`;
  }

  // Sanitize filename
  const safeFilename = filename.replace(/[/\\?%*:|"<>]/g, '-');
  const extension = type === 'audio' ? 'mp3' : 'mp4';
  const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const localFilename = `${fileId}.${extension}`;
  const localUri = `${DOWNLOAD_DIR}${localFilename}`;

  // Initialize download
  const downloadResumable = FileSystem.createDownloadResumable(
    finalDownloadUrl,
    localUri,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      if (onProgress) {
        onProgress(isNaN(progress) ? 0 : progress);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Download failed: file path empty');
  }

  // Get file size
  const fileInfo = await FileSystem.getInfoAsync(result.uri);
  const size = fileInfo.exists ? fileInfo.size : 0;

  // Add to metadata
  const newItem: DownloadItem = {
    id: fileId,
    name: safeFilename,
    url: url,
    localUri: result.uri,
    type: type,
    mimeType: type === 'audio' ? 'audio/mpeg' : 'video/mp4',
    size: size || 0,
    dateAdded: Date.now(),
  };

  const downloads = await getDownloads();
  downloads.push(newItem);
  await saveMetadata(downloads);

  return newItem;
};

// Delete a download
export const deleteDownload = async (id: string): Promise<DownloadItem[]> => {
  const downloads = await getDownloads();
  const itemToDelete = downloads.find(item => item.id === id);

  if (itemToDelete) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(itemToDelete.localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(itemToDelete.localUri);
      }
    } catch (error) {
      console.warn(`Could not delete file at ${itemToDelete.localUri}:`, error);
    }
  }

  const updatedDownloads = downloads.filter(item => item.id !== id);
  await saveMetadata(updatedDownloads);

  // Clean up playlists: remove the deleted download item from all playlists
  try {
    const playlists = await getPlaylists();
    let playlistChanged = false;
    const updatedPlaylists = playlists.map(p => {
      if (p.itemIds.includes(id)) {
        playlistChanged = true;
        return { ...p, itemIds: p.itemIds.filter(itemId => itemId !== id) };
      }
      return p;
    });
    if (playlistChanged) {
      await savePlaylists(updatedPlaylists);
    }
  } catch (err) {
    console.error('Error cleaning up deleted download from playlists:', err);
  }

  return updatedDownloads;
};

export interface Playlist {
  id: string;
  name: string;
  itemIds: string[];
  dateCreated: number;
}

const PLAYLISTS_FILE = `${DOWNLOAD_DIR}playlists.json`;

// Get list of all playlists
export const getPlaylists = async (): Promise<Playlist[]> => {
  try {
    await ensureDirExists();
    const fileInfo = await FileSystem.getInfoAsync(PLAYLISTS_FILE);
    if (!fileInfo.exists) {
      return [];
    }
    const content = await FileSystem.readAsStringAsync(PLAYLISTS_FILE);
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading playlists metadata:', error);
    return [];
  }
};

// Save list of playlists
const savePlaylists = async (playlists: Playlist[]) => {
  await ensureDirExists();
  await FileSystem.writeAsStringAsync(PLAYLISTS_FILE, JSON.stringify(playlists, null, 2));
};

// Create a new playlist
export const createPlaylist = async (name: string): Promise<Playlist[]> => {
  const playlists = await getPlaylists();
  const newPlaylist: Playlist = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || `Liste_${Date.now()}`,
    itemIds: [],
    dateCreated: Date.now()
  };
  playlists.push(newPlaylist);
  await savePlaylists(playlists);
  return playlists;
};

// Delete a playlist
export const deletePlaylist = async (id: string): Promise<Playlist[]> => {
  const playlists = await getPlaylists();
  const updated = playlists.filter(p => p.id !== id);
  await savePlaylists(updated);
  return updated;
};

// Add item to playlist
export const addItemToPlaylist = async (playlistId: string, itemId: string): Promise<Playlist[]> => {
  const playlists = await getPlaylists();
  const updated = playlists.map(p => {
    if (p.id === playlistId) {
      if (!p.itemIds.includes(itemId)) {
        return { ...p, itemIds: [...p.itemIds, itemId] };
      }
    }
    return p;
  });
  await savePlaylists(updated);
  return updated;
};

// Remove item from playlist
export const removeItemFromPlaylist = async (playlistId: string, itemId: string): Promise<Playlist[]> => {
  const playlists = await getPlaylists();
  const updated = playlists.map(p => {
    if (p.id === playlistId) {
      return { ...p, itemIds: p.itemIds.filter(id => id !== itemId) };
    }
    return p;
  });
  await savePlaylists(updated);
  return updated;
};
