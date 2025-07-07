# 🎬 YouTube Downloader

A desktop GUI application to download YouTube videos or playlists using a beautiful Kivy-based interface.

Currently supports **YouTube only**. Facebook and Instagram buttons are placeholders for future support.

---

## 🚀 Features

- ✅ Download individual YouTube videos or full playlists
- ✅ Clean and modern Kivy interface
- ✅ Choose custom save location (default: Downloads folder)
- ✅ Progress tracking with visual circle and progress bar
- 🚧 Facebook & Instagram buttons are UI-only for now

---

## 🖥️ Screenshots

Coming soon...

---

## 📦 Installation

Make sure you have Python 3.7+ installed. Then run:

```bash
python -m pip install "kivy[base,media]" kivy_examples yt-dlp
````

> 💡 Full Kivy installation guide: [kivy.org Installation Docs](https://kivy.org/doc/stable/gettingstarted/installation.html#install-pip)

---

## ▶️ Usage

Clone or download this repository, then run:

```bash
python main.py
```

Replace `main.py` with your actual script filename if different.

---

## 📁 Default Save Location

* The app uses your system's **Downloads folder** by default.
* You can change the destination using the 📁 **Open** button.

---

## 📝 Notes

* Paste your YouTube **video** or **playlist** link in the input box.
* The app uses `yt-dlp` under the hood for downloading.
* Facebook and Instagram features are not yet implemented.

---

## 📋 TODO

* [ ] Add real download logic using `yt-dlp`
* [ ] Add support for Facebook and Instagram
* [ ] Add video/audio format selection
* [ ] Add dark mode

---

## 📖 License

MIT License

---

## 💡 Credits

* [Kivy](https://kivy.org/)
* [yt-dlp](https://github.com/yt-dlp/yt-dlp)

Let me know if you want:
- A GitHub-style project structure
- Setup script (`setup.py`)
- Auto-updating features
- Cross-platform packaging instructions (Windows `.exe`, Mac `.app`, etc.)
```
