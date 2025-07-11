import os from 'os';
import path from 'path';
import fs from 'fs';
import https from 'https';

const BIN_VERSION = '2025.06.30';
const BASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${BIN_VERSION}`;
const BIN_FOLDER = path.resolve(__dirname, '../../resources/bin');

const getBinaryInfo = (): { name: string; url: string } => {
  const platform = os.platform();
  const arch = os.arch();

  switch (platform) {
    case 'win32':
      return {
        name: 'yt-dlp.exe',
        url: `${BASE_URL}/yt-dlp.exe`,
      };
    case 'darwin':
      return {
        name: 'yt-dlp_macos',
        url: `${BASE_URL}/yt-dlp_macos`,
      };
    case 'linux':
      return {
        name: `yt-dlp_linux_${arch}`,
        url: `${BASE_URL}/yt-dlp_linux_${arch}`,
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

const downloadBinary = (url: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath, { mode: 0o755 });
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(
          new Error(`Download failed: ${response.statusCode} - ${url}`)
        );
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(outputPath);
      reject(err);
    });
  });
};

export const checkAndInstallYtDlp = async (): Promise<string> => {
  try {
    const { name, url } = getBinaryInfo();
    const binaryPath = path.join(BIN_FOLDER, name);

    // Show preload popup UI here (Electron: create a loading window or dialog)

    if (!fs.existsSync(binaryPath)) {
      console.log(`yt-dlp binary not found. Downloading from: ${url}`);

      if (!fs.existsSync(BIN_FOLDER)) {
        fs.mkdirSync(BIN_FOLDER, { recursive: true });
      }

      await downloadBinary(url, binaryPath);
      console.log(`yt-dlp saved to ${binaryPath}`);
    } else {
      console.log(`yt-dlp already exists at ${binaryPath}`);
    }

    // Hide popup UI after success

    return binaryPath;
  } catch (err) {
    console.error('Failed to setup yt-dlp binary:', err);
    // Optionally show error UI
    throw err;
  }
};
