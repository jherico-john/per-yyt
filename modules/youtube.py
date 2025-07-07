import yt_dlp
import threading

class YouTubeDownloader:
    def __init__(self, url, save_path, progress_callback=None, status_callback=None, done_callback=None):
        """
        :param url: str, YouTube video or playlist URL
        :param save_path: str, folder path to save files
        :param progress_callback: function(current, total) to update progress UI
        :param status_callback: function(str) to update status UI
        :param done_callback: function() called when download finishes
        """
        self.url = url
        self.save_path = save_path
        self.progress_callback = progress_callback
        self.status_callback = status_callback
        self.done_callback = done_callback
        self.total = 0
        self.current = 0

    def download(self):
        """Starts the download in a separate thread."""
        thread = threading.Thread(target=self._download_thread, daemon=True)
        thread.start()

    def _download_thread(self):
        ydl_opts = {
            'outtmpl': f'{self.save_path}/%(title)s.%(ext)s',
            'progress_hooks': [self._progress_hook],
            'noplaylist': False,  # allow playlists
            'ignoreerrors': True,
            'quiet': True,
            'no_warnings': True,
        }

        if self.status_callback:
            self.status_callback("Fetching info...")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(self.url, download=False)
                if 'entries' in info:
                    self.total = len(info['entries'])
                    if self.status_callback:
                        self.status_callback(f"Playlist detected: {self.total} videos.")
                else:
                    self.total = 1
                    if self.status_callback:
                        self.status_callback("Single video detected.")

                ydl.download([self.url])
                if self.status_callback:
                    self.status_callback("Download completed.")
                if self.done_callback:
                    self.done_callback()

            except Exception as e:
                if self.status_callback:
                    self.status_callback(f"Error: {str(e)}")
                if self.done_callback:
                    self.done_callback()

    def _progress_hook(self, d):
        """
        Called by yt_dlp on download progress.
        The dictionary `d` contains status info.
        """
        if d['status'] == 'downloading':
            # partial download progress
            # percent is sometimes None, so we fallback to bytes received
            if d.get('total_bytes'):
                percent = d['downloaded_bytes'] / d['total_bytes']
                if self.progress_callback:
                    self.progress_callback(self.current + percent, self.total)
            else:
                if self.progress_callback:
                    self.progress_callback(self.current, self.total)

        elif d['status'] == 'finished':
            self.current += 1
            if self.progress_callback:
                self.progress_callback(self.current, self.total)
            if self.status_callback:
                self.status_callback(f"Finished {self.current} of {self.total}.")

