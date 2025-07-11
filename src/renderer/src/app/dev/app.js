(() => {
    // Elements
    const urlInput = document.getElementById('urlInput');
    const downloadSection = document.getElementById('downloadSection');
    const countText = document.getElementById('countText');
    const downloadStatusText = document.getElementById('downloadStatusText');
    const downloadProgress = document.getElementById('downloadProgress');
    const downloadBtn = document.getElementById('downloadBtn');
    const slashIcon = document.getElementById('slashIcon');
    const progressCircle = document.getElementById('progressCircle');
    const saveLocationInput = document.getElementById('saveLocation');
    const openFolderBtn = document.getElementById('openFolderBtn');

    // Constants
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 45; // r=45

    // State
    let videosToDownload = [];
    let currentIndex = 0;
    let errors = [];
    let isDownloading = false;
    let selectedDirectoryHandle = null;

    // Initialize default save location
    function getDefaultSaveLocation() {
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      
      if (platform.includes('Win')) {
        return 'C:\\Users\\' + (navigator.userAgent.includes('Chrome') ? 'User' : 'acer') + '\\Downloads\\YouTube_Downloader';
      } else if (platform.includes('Mac')) {
        return '/Users/' + (navigator.userAgent.includes('Chrome') ? 'User' : 'user') + '/Downloads/YouTube_Downloader';
      } else {
        return '/home/' + (navigator.userAgent.includes('Chrome') ? 'User' : 'user') + '/Downloads/YouTube_Downloader';
      }
    }

    // Set initial save location
    saveLocationInput.value = getDefaultSaveLocation();

    // Folder selection handler
    async function handleFolderSelection() {
      try {
        // Check if File System Access API is supported
        if ('showDirectoryPicker' in window) {
          try {
            // Use modern File System Access API
            const directoryHandle = await window.showDirectoryPicker({
              mode: 'readwrite',
              startIn: 'downloads'
            });
            
            selectedDirectoryHandle = directoryHandle;
            saveLocationInput.value = directoryHandle.name;
            
            // Show success feedback
            const originalColor = saveLocationInput.style.borderColor;
            saveLocationInput.style.borderColor = '#10b981';
            setTimeout(() => {
              saveLocationInput.style.borderColor = originalColor;
            }, 1000);
            
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('Error selecting directory:', err);
              alert('Error selecting directory. Please try again.');
            }
          }
        } else {
          // Fallback for browsers without File System Access API
          const input = document.createElement('input');
          input.type = 'file';
          input.webkitdirectory = true;
          input.multiple = true;
          input.style.display = 'none';
          
          const promise = new Promise((resolve, reject) => {
            input.addEventListener('change', (e) => {
              if (e.target.files.length > 0) {
                const file = e.target.files[0];
                let folderPath = '';
                
                if (file.webkitRelativePath) {
                  const pathParts = file.webkitRelativePath.split('/');
                  folderPath = pathParts[0];
                } else if (file.path) {
                  folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                } else {
                  folderPath = 'Selected Folder';
                }
                
                saveLocationInput.value = folderPath;
                resolve(folderPath);
              } else {
                reject(new Error('No folder selected'));
              }
              document.body.removeChild(input);
            });
            
            input.addEventListener('cancel', () => {
              document.body.removeChild(input);
              reject(new Error('User cancelled'));
            });
          });
          
          document.body.appendChild(input);
          input.click();
          
          try {
            await promise;
            // Show success feedback
            const originalColor = saveLocationInput.style.borderColor;
            saveLocationInput.style.borderColor = '#10b981';
            setTimeout(() => {
              saveLocationInput.style.borderColor = originalColor;
            }, 1000);
          } catch (err) {
            if (err.message !== 'User cancelled') {
              console.error('Error selecting folder:', err);
              alert('Error selecting folder. Please try again.');
            }
          }
        }
      } catch (error) {
        console.error('Unexpected error in folder selection:', error);
        alert('An unexpected error occurred. Please try again.');
      }
    }

    // Utility: Update progress circle stroke dashoffset
    function setProgress(percent) {
      const offset = CIRCLE_CIRCUMFERENCE * (1 - percent / 100);
      progressCircle.style.strokeDashoffset = offset;
    }

    // Utility: Validate YouTube URL (video or playlist)
    function parseYouTubeUrl(url) {
      try {
        const u = new URL(url);
        if (
          (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'youtu.be') &&
          (u.pathname === '/watch' || u.pathname === '/playlist' || u.hostname === 'youtu.be')
        ) {
          // Check if video or playlist
          if (u.hostname === 'youtu.be') {
            // Short video link
            const videoId = u.pathname.slice(1);
            if (videoId) return { type: 'video', id: videoId };
          } else if (u.pathname === '/watch') {
            const v = u.searchParams.get('v');
            if (v) return { type: 'video', id: v };
          } else if (u.pathname === '/playlist') {
            const list = u.searchParams.get('list');
            if (list) return { type: 'playlist', id: list };
          }
        }
        return null;
      } catch {
        return null;
      }
    }

    // Simulate fetching video list from YouTube link (video or playlist)
    function fetchVideosFromLink(linkInfo) {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (linkInfo.type === 'video') {
            resolve([{ id: linkInfo.id, title: `Video ID: ${linkInfo.id}` }]);
          } else if (linkInfo.type === 'playlist') {
            // Simulate playlist with 24 videos
            const videos = [];
            for (let i = 1; i <= 24; i++) {
              videos.push({ id: `${linkInfo.id}_video${i}`, title: `Playlist Video ${i}` });
            }
            resolve(videos);
          } else {
            resolve([]);
          }
        }, 600);
      });
    }

    // Simulate download of a single video with random error chance
    function downloadVideo(video) {
      return new Promise((resolve) => {
        // Simulate download time 300-800ms
        const time = 300 + Math.random() * 500;
        setTimeout(() => {
          // 15% chance to fail download
          const fail = Math.random() < 0.15;
          resolve(!fail);
        }, time);
      });
    }

    // Update UI for current download progress
    function updateDownloadUI() {
      countText.textContent = `${currentIndex + 1}/${videosToDownload.length}`;
      const percent = ((currentIndex) / videosToDownload.length) * 100;
      setProgress(percent);
      downloadProgress.value = percent;
      downloadProgress.setAttribute('aria-valuenow', percent.toFixed(0));
    }

    // Reset UI and state
    function resetDownloadUI() {
      currentIndex = 0;
      errors = [];
      isDownloading = false;
      setProgress(0);
      downloadProgress.value = 0;
      downloadProgress.setAttribute('aria-valuenow', 0);
      countText.textContent = `0/0`;
      downloadStatusText.textContent = 'Processing download...';
      slashIcon.style.display = 'none';
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Download';
    }

    // Start bulk download workflow
    async function startDownload() {
      if (isDownloading) return;
      
      // Check if save location is selected
      if (!saveLocationInput.value.trim()) {
        alert('Please select a save location first.');
        return;
      }
      
      isDownloading = true;
      downloadBtn.disabled = true;
      downloadStatusText.textContent = 'Starting download...';
      slashIcon.style.display = 'none';

      // Download videos sequentially, skipping errors
      for (; currentIndex < videosToDownload.length; currentIndex++) {
        updateDownloadUI();
        downloadStatusText.textContent = `Downloading: ${videosToDownload[currentIndex].title}`;
        const success = await downloadVideo(videosToDownload[currentIndex]);
        if (!success) {
          errors.push(videosToDownload[currentIndex]);
          // Show slash icon on circle to indicate error on current video
          slashIcon.style.display = 'block';
          downloadStatusText.textContent = `Error downloading: ${videosToDownload[currentIndex].title}, skipping...`;
          // Wait 1s so user can see error
          await new Promise((r) => setTimeout(r, 1000));
          slashIcon.style.display = 'none';
        }
        updateDownloadUI();
      }

      // After first pass, if errors exist, retry errors once
      if (errors.length > 0) {
        downloadStatusText.textContent = `Retrying ${errors.length} failed video(s)...`;
        const retryErrors = [];
        for (let i = 0; i < errors.length; i++) {
          const video = errors[i];
          updateDownloadUI();
          downloadStatusText.textContent = `Retrying: ${video.title}`;
          const success = await downloadVideo(video);
          if (!success) {
            retryErrors.push(video);
            slashIcon.style.display = 'block';
            downloadStatusText.textContent = `Error downloading again: ${video.title}`;
            await new Promise((r) => setTimeout(r, 1000));
            slashIcon.style.display = 'none';
          }
        }
        errors = retryErrors;
      }

      // Final UI update
      setProgress(100);
      downloadProgress.value = 100;
      downloadProgress.setAttribute('aria-valuenow', 100);
      countText.textContent = `${videosToDownload.length}/${videosToDownload.length}`;
      if (errors.length > 0) {
        downloadStatusText.textContent = `Completed with ${errors.length} error(s). Files saved to: ${saveLocationInput.value}`;
        slashIcon.style.display = 'block';
        console.warn('Videos failed to download:', errors);
      } else {
        downloadStatusText.textContent = `Download completed successfully! Files saved to: ${saveLocationInput.value}`;
        slashIcon.style.display = 'none';
      }
      downloadBtn.disabled = false;
      isDownloading = false;
    }

    // Handle URL input changes
    urlInput.addEventListener('input', async () => {
      resetDownloadUI();
      const val = urlInput.value.trim();
      if (!val) {
        downloadSection.classList.add('hidden');
        return;
      }
      const linkInfo = parseYouTubeUrl(val);
      if (!linkInfo) {
        downloadSection.classList.add('hidden');
        return;
      }
      // Show download section
      downloadSection.classList.remove('hidden');
      downloadStatusText.textContent = 'Fetching video info...';
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Download';

      // Fetch videos list
      videosToDownload = await fetchVideosFromLink(linkInfo);
      if (videosToDownload.length === 0) {
        downloadStatusText.textContent = 'No videos found for this link.';
        downloadBtn.disabled = true;
        return;
      }

      // Update count text and button text
      countText.textContent = `0/${videosToDownload.length}`;
      setProgress(0);
      downloadProgress.value = 0;
      downloadProgress.setAttribute('aria-valuenow', 0);
      if (linkInfo.type === 'playlist') {
        downloadBtn.textContent = 'Download all';
      } else {
        downloadBtn.textContent = 'Download';
      }
      downloadBtn.disabled = false;
    });

    // Download button click
    downloadBtn.addEventListener('click', startDownload);

    // Open folder button click
    openFolderBtn.addEventListener('click', handleFolderSelection);

    // Initialize progress circle stroke dasharray and offset
    progressCircle.style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
  })();