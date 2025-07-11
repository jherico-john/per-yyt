import YouTubeDownloader, { DownloadOptions, VideoInfo, BulkDownloadResult } from './youtube_downloader';
import path from 'path';
import os from 'os';

// Initialize the downloader
const downloader = new YouTubeDownloader();

// UI Elements (assuming they exist in your HTML)
declare const urlInput: HTMLInputElement;
declare const downloadSection: HTMLElement;
declare const countText: HTMLElement;
declare const downloadStatusText: HTMLElement;
declare const downloadProgress: HTMLProgressElement;
declare const downloadBtn: HTMLButtonElement;
declare const slashIcon: HTMLElement;
declare const progressCircle: HTMLElement;
declare const saveLocationInput: HTMLInputElement;

// Constants
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 45;

// State
let currentDownload: Promise<BulkDownloadResult> | null = null;
let isDownloading = false;

// Initialize downloader
async function initializeDownloader() {
  try {
    downloadStatusText.textContent = 'Initializing YouTube downloader...';
    await downloader.initialize();
    console.log('YouTube downloader initialized successfully');
  } catch (error) {
    console.error('Failed to initialize downloader:', error);
    downloadStatusText.textContent = 'Failed to initialize downloader';
  }
}

// Set up event listeners
function setupEventListeners() {
  // Download progress
  downloader.on('progress', (progress) => {
    updateProgressUI(progress.percent);
    downloadStatusText.textContent = `Downloading: ${progress.title} (${progress.percent.toFixed(1)}%)`;
  });

  // Status updates
  downloader.on('status', (status) => {
    downloadStatusText.textContent = status;
  });

  // Individual video completion
  downloader.on('videoComplete', (event) => {
    const { index, total, video, success, error } = event;
    updateCountUI(index, total);
    
    if (!success) {
      showError(`Failed: ${video.title}`);
      if (error) {
        console.error(`Error downloading ${video.title}:`, error);
      }
    }
  });

  // Download completion
  downloader.on('downloadComplete', (result: BulkDownloadResult) => {
    handleDownloadComplete(result);
  });

  // Error log generated
  downloader.on('errorLogGenerated', (logPath) => {
    console.log(`Error log generated at: ${logPath}`);
  });

  // Initialization complete
  downloader.on('initialized', (version) => {
    console.log(`yt-dlp version: ${version}`);
  });
}

// Update progress circle
function updateProgressUI(percent: number) {
  const offset = CIRCLE_CIRCUMFERENCE * (1 - percent / 100);
  progressCircle.style.strokeDashoffset = offset.toString();
  downloadProgress.value = percent;
  downloadProgress.setAttribute('aria-valuenow', percent.toFixed(0));
}

// Update count display
function updateCountUI(current: number, total: number) {
  countText.textContent = `${current}/${total}`;
}

// Show error indicator
function showError(message: string) {
  slashIcon.style.display = 'block';
  downloadStatusText.textContent = message;
  setTimeout(() => {
    slashIcon.style.display = 'none';
  }, 2000);
}

// Handle download completion
function handleDownloadComplete(result: BulkDownloadResult) {
  isDownloading = false;
  downloadBtn.disabled = false;
  
  updateProgressUI(100);
  updateCountUI(result.totalVideos, result.totalVideos);
  
  let statusMessage = `Download completed! `;
  statusMessage += `Success: ${result.successfulDownloads}, `;
  statusMessage += `Failed: ${result.failedDownloads}`;
  
  if (result.failedDownloads > 0) {
    statusMessage += ` (Check error_log.txt in output folder)`;
    slashIcon.style.display = 'block';
  }
  
  statusMessage += `\nSaved to: ${result.outputDirectory}`;
  downloadStatusText.textContent = statusMessage;
  
  // Log detailed results
  console.log('Download Results:', result);
  
  if (result.errors.length > 0) {
    console.warn('Failed downloads:', result.errors);
  }
}

// Get default download directory
function getDefaultDownloadDirectory(): string {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'win32':
      return path.join(homeDir, 'Downloads', 'YouTube_Downloader');
    case 'darwin':
      return path.join(homeDir, 'Downloads', 'YouTube_Downloader');
    case 'linux':
      return path.join(homeDir, 'Downloads', 'YouTube_Downloader');
    default:
      return path.join(homeDir, 'Downloads', 'YouTube_Downloader');
  }
}

// Parse YouTube URL
function parseYouTubeUrl(url: string): { type: 'video' | 'playlist' | null; id: string | null } {
  return downloader.parseYouTubeUrl(url);
}

// Validate URL and show/hide download section
async function handleUrlChange() {
  const url = urlInput.value.trim();
  
  if (!url) {
    downloadSection.classList.add('hidden');
    return;
  }
  
  const urlInfo = parseYouTubeUrl(url);
  
  if (!urlInfo.type) {
    downloadSection.classList.add('hidden');
    return;
  }
  
  // Show download section
  downloadSection.classList.remove('hidden');
  downloadStatusText.textContent = 'Fetching video information...';
  downloadBtn.disabled = true;
  
  try {
    let videoCount = 0;
    
    if (urlInfo.type === 'video') {
      const videoInfo = await downloader.getVideoInfo(url);
      videoCount = videoInfo ? 1 : 0;
      downloadBtn.textContent = 'Download Video';
    } else if (urlInfo.type === 'playlist') {
      const playlistInfo = await downloader.getPlaylistInfo(url);
      videoCount = playlistInfo ? playlistInfo.entries.length : 0;
      downloadBtn.textContent = 'Download Playlist';
    }
    
    if (videoCount === 0) {
      downloadStatusText.textContent = 'No videos found for this URL';
      downloadBtn.disabled = true;
      return;
    }
    
    updateCountUI(0, videoCount);
    updateProgressUI(0);
    downloadStatusText.textContent = `Ready to download ${videoCount} video(s)`;
    downloadBtn.disabled = false;
    
  } catch (error) {
    console.error('Error fetching video info:', error);
    downloadStatusText.textContent = 'Error fetching video information';
    downloadBtn.disabled = true;
  }
}

// Start download process
async function startDownload() {
  if (isDownloading || currentDownload) {
    return;
  }
  
  const url = urlInput.value.trim();
  const outputDir = saveLocationInput.value.trim() || getDefaultDownloadDirectory();
  
  if (!url) {
    alert('Please enter a YouTube URL');
    return;
  }
  
  if (!outputDir) {
    alert('Please select a save location');
    return;
  }
  
  const urlInfo = parseYouTubeUrl(url);
  
  if (!urlInfo.type) {
    alert('Please enter a valid YouTube URL');
    return;
  }
  
  isDownloading = true;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Downloading...';
  
  // Reset UI
  updateProgressUI(0);
  updateCountUI(0, 1);
  slashIcon.style.display = 'none';
  
  // Download options
  const options: DownloadOptions = {
    outputDirectory: outputDir,
    quality: 'best[height<=720]/best', // Default to 720p or lower
    continueOnError: true,
    maxRetries: 2,
    subtitles: false,
    audioOnly: false
  };
  
  try {
    currentDownload = downloader.downloadBulk(url, options);
    const result = await currentDownload;
    
    // Download completed, result is handled in event listener
    console.log('Download process completed:', result);
    
  } catch (error) {
    console.error('Download failed:', error);
    downloadStatusText.textContent = `Download failed: ${error.message || 'Unknown error'}`;
    slashIcon.style.display = 'block';
    
    isDownloading = false;
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download';
  } finally {
    currentDownload = null;
  }
}

// Cancel download
function cancelDownload() {
  if (currentDownload) {
    downloader.cancelAllDownloads();
    downloadStatusText.textContent = 'Download cancelled';
    isDownloading = false;
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download';
    currentDownload = null;
  }
}

// Setup UI event listeners
function setupUIEventListeners() {
  // URL input change
  urlInput.addEventListener('input', handleUrlChange);
  
  // Download button click
  downloadBtn.addEventListener('click', startDownload);
  
  // Optional: Add cancel button functionality
  // cancelBtn.addEventListener('click', cancelDownload);
  
  // Set default save location
  if (!saveLocationInput.value) {
    saveLocationInput.value = getDefaultDownloadDirectory();
  }
}

// Initialize everything
async function initialize() {
  console.log('Starting YouTube Downloader initialization...');
  
  // Initialize progress circle
  progressCircle.style.strokeDasharray = CIRCLE_CIRCUMFERENCE.toString();
  progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE.toString();
  
  // Setup event listeners
  setupEventListeners();
  setupUIEventListeners();
  
  // Initialize downloader
  await initializeDownloader();
  
  console.log('YouTube Downloader ready!');
}

// Export functions for use in HTML
export {
  initialize,
  startDownload,
  cancelDownload,
  handleUrlChange,
  parseYouTubeUrl,
  getDefaultDownloadDirectory
};

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initialize);
}

// Example usage function
export async function exampleUsage() {
  const downloader = new YouTubeDownloader();
  
  try {
    // Initialize
    await downloader.initialize();
    
    // Example 1: Download a single video
    const singleVideoResult = await downloader.downloadBulk(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      {
        outputDirectory: './downloads',
        quality: 'best[height<=720]/best',
        continueOnError: true,
        maxRetries: 2
      }
    );
    
    console.log('Single video download result:', singleVideoResult);
    
    // Example 2: Download a playlist
    const playlistResult = await downloader.downloadBulk(
      'https://www.youtube.com/playlist?list=PLxxxxxxxxxxx',
      {
        outputDirectory: './downloads/playlist',
        quality: 'best[height<=480]/best',
        continueOnError: true,
        maxRetries: 3,
        subtitles: true
      }
    );
    
    console.log('Playlist download result:', playlistResult);
    
  } catch (error) {
    console.error('Download failed:', error);
  }
}