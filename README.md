# Audio Repeater

A desktop app for language learners. It automatically segments any audio or video file into phrases and lets you loop individual segments for shadowing practice.

## Download

**macOS (Apple Silicon)**
[Download Audio Repeater v0.1.0 (.dmg)](https://github.com/kwgjjeffrey/audio-repeater/releases/download/v0.2.0/Audio.Repeater-0.1.0-arm64.dmg)

> Windows support is coming. For now, see [Build from Source](#build-from-source) below.

## Features

- **Auto-segmentation** — drop any MP3, MP4, MKV, or other media file; the app detects silence boundaries and splits it into clean phrases automatically
- **Phrase looping** — click any phrase to select it and loop it; adjust playback speed, loop count, and pause between repeats
- **URL download** — paste a YouTube (or other) URL and the app downloads + analyzes it in one step
- **Library sidebar** — recently opened files are saved with their phrase data so you can pick up where you left off
- **Phrase groups** — select multiple phrases and merge them into a single loopable segment
- **Bookmarks** — star phrases to filter your study list

## Usage

1. Open the app and click **Open** (or drag a file onto the window)
2. The app analyzes the file and shows detected phrases in the right sidebar
3. Click a phrase to jump to it and start looping — use the **Repeat** button in the toolbar to stay in loop mode
4. Use **←** / **→** arrow keys to step between phrases; **Space** to play/pause
5. Adjust **playback speed** and **loop settings** in the ⚙ Settings panel

## Build from Source

**Prerequisites:** Node.js 22+, npm

```bash
git clone https://github.com/kwgjjeffrey/audio-repeater.git
cd audio-repeater
npm install
npm run dev          # start in development mode
```

**Package for distribution:**

```bash
npm run package:mac  # produces release/*.dmg
npm run package:win  # produces release/*.exe
```

## Tech Stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) for silence detection
- [yt-dlp-wrap](https://github.com/foxesdocode/yt-dlp-wrap) for URL downloads
- [WaveSurfer.js](https://wavesurfer.xyz/) for waveform rendering
- [Zustand](https://zustand-demo.pmnd.rs/) for state management
