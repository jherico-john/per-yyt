import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import YTDlpWrap from 'yt-dlp-wrap';
import { checkAndInstallYtDlp } from '../app/dev/check.builtin.app';

// Types
interface VideoInfo {
  id: string;
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  upload_date?: string;
  view_count?: number;
  description?: string;
  format?: string;
  filesize?: number;
}

interface PlaylistInfo {
  id: string;
  title: string;
  uploader: string;
  entries: VideoInfo[];
}

interface DownloadProgress {
  videoId: string;
  title: string;
  percent: number;
  speed: string;
  eta: string;
  totalSize: string;
  downloadedBytes: string;
  status: 'downloading' | 'finished' | 'error' | 'skipped';
}

interface DownloadResult {
  success: boolean;
  videoId: string;
  title: string;
  outputPath?: string;
  error?: string;
}

interface BulkDownloadResult {
  totalVideos: number;
  successfulDownloads: number;
  failedDownloads: number;
  skippedVideos: number;
  errors: Array<{ videoId: string; title: string; error: string }>;
  outputDirectory: string;
}

interface DownloadOptions {
  outputDirectory: string;
  quality?: 'best' | 'worst' | 'bestaudio' | 'bestvideo' | string;
  format?: string;
  audioOnly?: boolean;
  subtitles?: boolean;
  maxRetries?: number;
  continueOnError?: boolean;
  customArgs?: string[];
}

class YouTubeDownloader extends EventEmitter {
  private ytDlpPath: string = '';
  private ytDlpWrap: YTDlpWrap | null = null;
  private currentDownloads: Map<string, ChildProcess> = new Map();
  private downloadQueue: Array<{ video: VideoInfo; options: DownloadOptions }> = [];
  private isInitialized: boolean = false;
  private errorLog: Array<{ timestamp: string; videoId: string; title: string; error: string }> = [];

  constructor() {
    super();
  }

  /**
   * Initialize the YouTube downloader
   */
  async initialize(): Promise<void> {
    try {
      // Setup yt-dlp binary
      this.ytDlpPath = await checkAndInstallYtDlp();
      this.ytDlpWrap = new YTDlpWrap(this.ytDlpPath);
      
      // Verify yt-dlp is working
      const version = await this.ytDlpWrap.getVersion();
      console.log(`yt-dlp version: ${version}`);
      
      this.isInitialized = true;
      this.emit('initialized', version);
    } catch (error) {
      console.error('Failed to initialize YouTube downloader:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Parse YouTube URL and determine if it's a video or playlist
   */
  parseYouTubeUrl(url: string): { type: 'video' | 'playlist' | null; id: string | null } {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Handle different YouTube domains
      if (!['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com'].includes(hostname)) {
        return { type: null, id: null };
      }

      // Handle youtu.be short links
      if (hostname === 'youtu.be') {
        const videoId = urlObj.pathname.slice(1);
        return videoId ? { type: 'video', id: videoId } : { type: null, id: null };
      }

      // Handle regular YouTube URLs
      if (urlObj.pathname === '/watch') {
        const videoId = urlObj.searchParams.get('v');
        return videoId ? { type: 'video', id: videoId } : { type: null, id: null };
      }

      if (urlObj.pathname === '/playlist') {
        const playlistId = urlObj.searchParams.get('list');
        return playlistId ? { type: 'playlist', id: playlistId } : { type: null, id: null };
      }

      return { type: null, id: null };
    } catch (error) {
      console.error('Error parsing YouTube URL:', error);
      return { type: null, id: null };
    }
  }

  /**
   * Get video information
   */
  async getVideoInfo(url: string): Promise<VideoInfo | null> {
    if (!this.isInitialized || !this.ytDlpWrap) {
      throw new Error('YouTube downloader not initialized');
    }

    try {
      const metadata = await this.ytDlpWrap.getVideoInfo(url);
      
      return {
        id: metadata.id,
        title: metadata.title || 'Unknown Title',
        url: metadata.webpage_url || url,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        uploader: metadata.uploader,
        upload_date: metadata.upload_date,
        view_count: metadata.view_count,
        description: metadata.description,
        format: metadata.format,
        filesize: metadata.filesize
      };
    } catch (error) {
      console.error('Error getting video info:', error);
      return null;
    }
  }

  /**
   * Get playlist information
   */
  async getPlaylistInfo(url: string): Promise<PlaylistInfo | null> {
    if (!this.isInitialized || !this.ytDlpWrap) {
      throw new Error('YouTube downloader not initialized');
    }

    try {
      const metadata = await this.ytDlpWrap.getVideoInfo(url);
      
      if (!metadata.entries || !Array.isArray(metadata.entries)) {
        return null;
      }

      const entries: VideoInfo[] = metadata.entries
        .filter(entry => entry && entry.id)
        .map(entry => ({
          id: entry.id,
          title: entry.title || 'Unknown Title',
          url: entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
          duration: entry.duration,
          thumbnail: entry.thumbnail,
          uploader: entry.uploader,
          upload_date: entry.upload_date,
          view_count: entry.view_count,
          description: entry.description,
          format: entry.format,
          filesize: entry.filesize
        }));

      return {
        id: metadata.id,
        title: metadata.title || 'Unknown Playlist',
        uploader: metadata.uploader || 'Unknown Uploader',
        entries
      };
    } catch (error) {
      console.error('Error getting playlist info:', error);
      return null;
    }
  }

  /**
   * Download a single video
   */
  async downloadVideo(video: VideoInfo, options: DownloadOptions): Promise<DownloadResult> {
    if (!this.isInitialized || !this.ytDlpWrap) {
      throw new Error('YouTube downloader not initialized');
    }

    const sanitizedTitle = this.sanitizeFilename(video.title);
    const outputPath = path.join(options.outputDirectory, `${sanitizedTitle}.%(ext)s`);
    
    // Prepare download arguments
    const args = [
      video.url,
      '-o', outputPath,
      '--no-warnings',
      '--extract-flat', 'false'
    ];

    // Add format selection
    if (options.audioOnly) {
      args.push('-f', 'bestaudio[ext=m4a]/bestaudio');
    } else if (options.quality) {
      args.push('-f', options.quality);
    } else {
      args.push('-f', 'best[height<=720]/best');
    }

    // Add subtitles if requested
    if (options.subtitles) {
      args.push('--write-subs', '--write-auto-subs', '--sub-lang', 'en');
    }

    // Add custom arguments
    if (options.customArgs) {
      args.push(...options.customArgs);
    }

    return new Promise((resolve) => {
      const emitter = this.ytDlpWrap!.exec(args);
      
      emitter.on('progress', (progress: any) => {
        const downloadProgress: DownloadProgress = {
          videoId: video.id,
          title: video.title,
          percent: parseFloat(progress.percent?.toString() || '0') || 0,
          speed: progress.currentSpeed || '0B/s',
          eta: progress.eta || 'Unknown',
          totalSize: progress.totalSize || 'Unknown',
          downloadedBytes: progress.downloaded || '0B',
          status: 'downloading'
        };
        
        this.emit('progress', downloadProgress);
      });

      emitter.on('close', (code) => {
        this.currentDownloads.delete(video.id);
        
        if (code === 0) {
          resolve({
            success: true,
            videoId: video.id,
            title: video.title,
            outputPath: options.outputDirectory
          });
        } else {
          const error = `Download failed with exit code ${code}`;
          this.logError(video.id, video.title, error);
          resolve({
            success: false,
            videoId: video.id,
            title: video.title,
            error
          });
        }
      });

      emitter.on('error', (error) => {
        this.currentDownloads.delete(video.id);
        const errorMessage = error.message || 'Unknown error occurred';
        this.logError(video.id, video.title, errorMessage);
        resolve({
          success: false,
          videoId: video.id,
          title: video.title,
          error: errorMessage
        });
      });

      // Store the process for potential cancellation
      if (emitter.ytDlpProcess) {
        this.currentDownloads.set(video.id, emitter.ytDlpProcess);
      }
    });
  }

  /**
   * Download videos in bulk (playlist or multiple videos)
   */
  async downloadBulk(url: string, options: DownloadOptions): Promise<BulkDownloadResult> {
    if (!this.isInitialized) {
      throw new Error('YouTube downloader not initialized');
    }

    // Ensure output directory exists
    if (!fs.existsSync(options.outputDirectory)) {
      fs.mkdirSync(options.outputDirectory, { recursive: true });
    }

    const urlInfo = this.parseYouTubeUrl(url);
    let videos: VideoInfo[] = [];

    this.emit('status', 'Fetching video information...');

    if (urlInfo.type === 'video') {
      const videoInfo = await this.getVideoInfo(url);
      if (videoInfo) {
        videos = [videoInfo];
      }
    } else if (urlInfo.type === 'playlist') {
      const playlistInfo = await this.getPlaylistInfo(url);
      if (playlistInfo) {
        videos = playlistInfo.entries;
      }
    }

    if (videos.length === 0) {
      throw new Error('No videos found for the provided URL');
    }

    this.emit('status', `Found ${videos.length} video(s) to download`);

    const result: BulkDownloadResult = {
      totalVideos: videos.length,
      successfulDownloads: 0,
      failedDownloads: 0,
      skippedVideos: 0,
      errors: [],
      outputDirectory: options.outputDirectory
    };

    const maxRetries = options.maxRetries || 1;
    const failedVideos: VideoInfo[] = [];

    // First pass: Download all videos
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      this.emit('status', `Downloading ${i + 1}/${videos.length}: ${video.title}`);

      try {
        const downloadResult = await this.downloadVideo(video, options);
        
        if (downloadResult.success) {
          result.successfulDownloads++;
          this.emit('videoComplete', { 
            index: i + 1, 
            total: videos.length, 
            video, 
            success: true 
          });
        } else {
          result.failedDownloads++;
          failedVideos.push(video);
          result.errors.push({
            videoId: video.id,
            title: video.title,
            error: downloadResult.error || 'Unknown error'
          });
          
          this.emit('videoComplete', { 
            index: i + 1, 
            total: videos.length, 
            video, 
            success: false, 
            error: downloadResult.error 
          });

          if (!options.continueOnError) {
            break;
          }
        }
      } catch (error) {
        result.failedDownloads++;
        failedVideos.push(video);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          videoId: video.id,
          title: video.title,
          error: errorMessage
        });
        
        this.emit('videoComplete', { 
          index: i + 1, 
          total: videos.length, 
          video, 
          success: false, 
          error: errorMessage 
        });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    // Retry failed videos
    if (failedVideos.length > 0 && maxRetries > 1) {
      this.emit('status', `Retrying ${failedVideos.length} failed video(s)...`);
      
      for (let retry = 1; retry < maxRetries; retry++) {
        const stillFailing: VideoInfo[] = [];
        
        for (const video of failedVideos) {
          this.emit('status', `Retry ${retry}/${maxRetries - 1}: ${video.title}`);
          
          try {
            const downloadResult = await this.downloadVideo(video, options);
            
            if (downloadResult.success) {
              result.successfulDownloads++;
              result.failedDownloads--;
              // Remove from errors array
              result.errors = result.errors.filter(e => e.videoId !== video.id);
              this.emit('videoRetrySuccess', { video, retry });
            } else {
              stillFailing.push(video);
            }
          } catch (error) {
            stillFailing.push(video);
          }
        }
        
        if (stillFailing.length === 0) break;
        failedVideos.length = 0;
        failedVideos.push(...stillFailing);
      }
    }

    // Generate error log if there are persistent errors
    if (result.errors.length > 0) {
      await this.generateErrorLog(result.errors, options.outputDirectory);
    }

    this.emit('downloadComplete', result);
    return result;
  }

  /**
   * Cancel a specific download
   */
  cancelDownload(videoId: string): boolean {
    const process = this.currentDownloads.get(videoId);
    if (process) {
      process.kill('SIGTERM');
      this.currentDownloads.delete(videoId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active downloads
   */
  cancelAllDownloads(): void {
    for (const [videoId, process] of this.currentDownloads) {
      process.kill('SIGTERM');
    }
    this.currentDownloads.clear();
  }

  /**
   * Sanitize filename for filesystem compatibility
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Log error with timestamp
   */
  private logError(videoId: string, title: string, error: string): void {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      videoId,
      title,
      error
    };
    
    this.errorLog.push(errorEntry);
    console.error(`Error downloading ${title} (${videoId}):`, error);
  }

  /**
   * Generate error log file
   */
  private async generateErrorLog(errors: Array<{ videoId: string; title: string; error: string }>, outputDir: string): Promise<void> {
    const logPath = path.join(outputDir, 'error_log.txt');
    const timestamp = new Date().toISOString();
    
    let logContent = `YouTube Downloader Error Log\n`;
    logContent += `Generated: ${timestamp}\n`;
    logContent += `Total Errors: ${errors.length}\n`;
    logContent += `${'='.repeat(50)}\n\n`;
    
    for (const error of errors) {
      logContent += `Video ID: ${error.videoId}\n`;
      logContent += `Title: ${error.title}\n`;
      logContent += `Error: ${error.error}\n`;
      logContent += `${'='.repeat(30)}\n\n`;
    }
    
    logContent += `\nInstructions:\n`;
    logContent += `1. Copy the error messages above\n`;
    logContent += `2. Report these errors to the development team\n`;
    logContent += `3. Include the Video ID and error message for each failed download\n`;
    
    try {
      await fs.promises.writeFile(logPath, logContent, 'utf8');
      console.log(`Error log saved to: ${logPath}`);
      this.emit('errorLogGenerated', logPath);
    } catch (error) {
      console.error('Failed to write error log:', error);
    }
  }

  /**
   * Get current download statistics
   */
  getDownloadStats(): { activeDownloads: number; totalErrors: number } {
    return {
      activeDownloads: this.currentDownloads.size,
      totalErrors: this.errorLog.length
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog.length = 0;
  }
}

export default YouTubeDownloader;
export { VideoInfo, PlaylistInfo, DownloadProgress, DownloadResult, BulkDownloadResult, DownloadOptions };