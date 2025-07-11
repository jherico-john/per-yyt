"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const os = require("os");
const fs = require("fs");
const https = require("https");
const icon = path.join(__dirname, "../../resources/icon.png");
const BIN_VERSION = "2025.06.30";
const BASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${BIN_VERSION}`;
const BIN_FOLDER = path.resolve(__dirname, "../../resources/bin");
const getBinaryInfo = () => {
  const platform = os.platform();
  const arch = os.arch();
  switch (platform) {
    case "win32":
      return {
        name: "yt-dlp.exe",
        url: `${BASE_URL}/yt-dlp.exe`
      };
    case "darwin":
      return {
        name: "yt-dlp_macos",
        url: `${BASE_URL}/yt-dlp_macos`
      };
    case "linux":
      return {
        name: `yt-dlp_linux_${arch}`,
        url: `${BASE_URL}/yt-dlp_linux_${arch}`
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};
const downloadBinary = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath, { mode: 493 });
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(
          new Error(`Download failed: ${response.statusCode} - ${url}`)
        );
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlinkSync(outputPath);
      reject(err);
    });
  });
};
const checkAndInstallYtDlp = async () => {
  try {
    const { name, url } = getBinaryInfo();
    const binaryPath = path.join(BIN_FOLDER, name);
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
    return binaryPath;
  } catch (err) {
    console.error("Failed to setup yt-dlp binary:", err);
    throw err;
  }
};
checkAndInstallYtDlp().then((binaryPath) => {
  console.log("yt-dlp ready at:", binaryPath);
}).catch((_err) => {
});
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    icon: path.join(__dirname, "resources", "icon.png"),
    // or .ico for Windows
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
