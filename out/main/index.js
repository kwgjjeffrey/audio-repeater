"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mime = require("mime-types");
const child_process = require("child_process");
const https = require("https");
const http = require("http");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const https__namespace = /* @__PURE__ */ _interopNamespaceDefault(https);
const http__namespace = /* @__PURE__ */ _interopNamespaceDefault(http);
const VIDEO_EXTS = ["mp4", "mkv", "mov", "webm", "avi", "m4v"];
const AUDIO_EXTS = ["mp3", "m4a", "wav", "aac", "ogg", "flac", "opus"];
function registerFileHandlers(ipcMain) {
  ipcMain.handle("open-file", async () => {
    const result = await electron.dialog.showOpenDialog({
      title: "Open Media File",
      properties: ["openFile"],
      filters: [
        { name: "Media", extensions: [...VIDEO_EXTS, ...AUDIO_EXTS] },
        { name: "Video", extensions: VIDEO_EXTS },
        { name: "Audio", extensions: AUDIO_EXTS }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const mediaHash = await hashFile(filePath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    return { filePath, mediaHash, mimeType };
  });
  ipcMain.handle("open-path", async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const mediaHash = await hashFile(filePath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    return { filePath, mediaHash, mimeType };
  });
}
async function hashFile(filePath) {
  const stats = fs.statSync(filePath);
  const size = stats.size;
  const chunkSize = Math.min(1024 * 1024, Math.floor(size / 2));
  const hash = crypto.createHash("sha1");
  hash.update(String(size));
  await readChunk(filePath, 0, chunkSize, hash);
  if (size > chunkSize * 2) {
    await readChunk(filePath, size - chunkSize, chunkSize, hash);
  }
  return hash.digest("hex");
}
function readChunk(filePath, start, length, hash) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { start, end: start + length - 1 });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
}
function getFfmpegPath() {
  const resourcesFfmpeg = path.join(process.resourcesPath ?? "", "ffmpeg");
  if (fs.existsSync(resourcesFfmpeg)) return resourcesFfmpeg;
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  } catch {
  }
  return "ffmpeg";
}
function runFfmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath();
    const proc = child_process.spawn(bin, ["-stats_period", "0.5", ...args]);
    let stdout = "";
    let stderr = "";
    let totalDurationSec = 0;
    function handleChunk(chunk) {
      const text = chunk.toString();
      stderr += text;
      if (totalDurationSec === 0) {
        const m = text.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m) {
          totalDurationSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        }
      }
      if (onProgress && totalDurationSec > 0) {
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (timeMatch) {
          const elapsed = Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3]);
          const pct = Math.min(99, Math.round(elapsed / totalDurationSec * 100));
          onProgress(pct);
        }
      }
    }
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", handleChunk);
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}
${stderr}`));
        return;
      }
      const durationSec = parseDuration(stderr);
      if (onProgress) onProgress(100);
      resolve({ stdout, stderr, durationSec });
    });
  });
}
function parseDuration(stderr) {
  const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
async function detectSilence(filePath, noiseDb, durationSec, onProgress) {
  const filter = `silencedetect=noise=${noiseDb}dB:d=${durationSec}`;
  const { stderr, durationSec: totalDuration } = await runFfmpeg(
    [
      "-i",
      filePath,
      "-vn",
      // skip video decoding — massive speedup for video files
      "-ar",
      "8000",
      // downsample to 8kHz; silence detection needs no more
      "-ac",
      "1",
      // mono; halves data again
      "-af",
      filter,
      "-f",
      "null",
      "-"
    ],
    onProgress
  );
  const silences = parseSilenceEvents(stderr);
  return { silences, durationSec: totalDuration };
}
function parseSilenceEvents(stderr) {
  const lines = stderr.split("\n");
  const events = [];
  let pendingStart = null;
  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      pendingStart = Number(startMatch[1]);
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && pendingStart !== null) {
      events.push({ startSec: pendingStart, endSec: Number(endMatch[1]) });
      pendingStart = null;
    }
  }
  return events;
}
function buildSegments(silences, durationSec, opts) {
  const { minSegmentMs, maxSegmentMs } = opts;
  const raw = speechIntervalsFromSilences(silences, durationSec);
  const merged = mergeShort(raw, minSegmentMs);
  const split = splitLong(merged, maxSegmentMs);
  return split.map(([startMs, endMs]) => ({
    id: crypto.randomUUID(),
    startMs,
    endMs,
    source: "silence"
  }));
}
function speechIntervalsFromSilences(silences, durationSec) {
  const intervals = [];
  let cursor = 0;
  for (const s of silences) {
    const speechStart = cursor;
    const speechEnd = Math.round(s.startSec * 1e3);
    if (speechEnd > speechStart) {
      intervals.push([speechStart, speechEnd]);
    }
    cursor = Math.round(s.endSec * 1e3);
  }
  const totalMs = Math.round(durationSec * 1e3);
  if (totalMs > cursor) {
    intervals.push([cursor, totalMs]);
  }
  return intervals;
}
function mergeShort(intervals, minMs) {
  if (intervals.length === 0) return [];
  let pending = null;
  const result = [];
  for (const [start, end] of intervals) {
    if (pending !== null) {
      pending = [pending[0], end];
      if (pending[1] - pending[0] >= minMs) {
        result.push(pending);
        pending = null;
      }
    } else if (end - start < minMs) {
      pending = [start, end];
    } else {
      result.push([start, end]);
    }
  }
  if (pending !== null) {
    if (result.length > 0) {
      const last = result[result.length - 1];
      result[result.length - 1] = [last[0], pending[1]];
    } else {
      result.push(pending);
    }
  }
  return result;
}
function splitLong(intervals, maxMs) {
  const result = [];
  for (const [start, end] of intervals) {
    if (end - start <= maxMs) {
      result.push([start, end]);
    } else {
      const mid = Math.round((start + end) / 2);
      result.push([start, mid], [mid, end]);
    }
  }
  return result;
}
function registerAnalyzeHandlers(ipcMain) {
  ipcMain.handle(
    "analyze",
    async (event, filePath, mediaHash, options) => {
      const { noiseDb, silenceDurationSec, minSegmentMs, maxSegmentMs } = options;
      const sender = electron.BrowserWindow.fromWebContents(event.sender);
      function sendProgress(pct) {
        if (sender && !sender.isDestroyed()) {
          sender.webContents.send("analysis-progress", pct);
        }
      }
      const { silences, durationSec } = await detectSilence(
        filePath,
        noiseDb,
        silenceDurationSec,
        sendProgress
      );
      const segments = buildSegments(silences, durationSec, { minSegmentMs, maxSegmentMs });
      const now = Date.now();
      const project = {
        id: crypto.randomUUID(),
        mediaPath: filePath,
        mediaHash,
        durationMs: Math.round(durationSec * 1e3),
        segments,
        createdAt: now,
        updatedAt: now
      };
      return project;
    }
  );
}
function getProjectsDir() {
  const dir = path.join(electron.app.getPath("userData"), "projects");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function projectPath(mediaHash) {
  return path.join(getProjectsDir(), `${mediaHash}.json`);
}
function registerProjectHandlers(ipcMain) {
  ipcMain.handle("load-project", async (_event, mediaHash) => {
    const p = projectPath(mediaHash);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      return null;
    }
  });
  ipcMain.handle("save-project", async (_event, project) => {
    const p = projectPath(project.mediaHash);
    fs.writeFileSync(p, JSON.stringify(project, null, 2), "utf-8");
  });
  ipcMain.handle("list-projects", async () => {
    const dir = getProjectsDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files.flatMap((f) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"))];
      } catch {
        return [];
      }
    });
  });
}
const YTDlpWrap = require("yt-dlp-wrap").default;
const MEDIA_EXT_RE = /\.(mp3|mp4|m4a|wav|ogg|webm|flac|aac|mkv|mov|avi)(\?|#|$)/i;
const MEDIA_CONTENT_TYPE_RE = /^(audio|video)\//;
function getDownloadDir() {
  const dir = path__namespace.join(electron.app.getPath("downloads"), "AudioRepeater");
  fs__namespace.mkdirSync(dir, { recursive: true });
  return dir;
}
async function downloadYtDlpStandalone(destPath) {
  const assetName = process.platform === "win32" ? "yt-dlp.exe" : process.platform === "darwin" ? "yt-dlp_macos" : "yt-dlp_linux";
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;
  await new Promise((resolve, reject) => {
    const follow = (u) => {
      const proto = u.startsWith("https") ? https__namespace : http__namespace;
      proto.get(u, { headers: { "User-Agent": "audio-repeater-app" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} downloading yt-dlp`));
        const out = fs__namespace.createWriteStream(destPath);
        res.pipe(out);
        out.on("finish", () => out.close(() => resolve()));
        out.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}
async function getYtDlpBinaryPath() {
  const binDir = path__namespace.join(electron.app.getPath("userData"), "yt-dlp-bin");
  fs__namespace.mkdirSync(binDir, { recursive: true });
  const bin = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const binPath = path__namespace.join(binDir, bin);
  if (!fs__namespace.existsSync(binPath)) {
    await downloadYtDlpStandalone(binPath);
    if (process.platform !== "win32") fs__namespace.chmodSync(binPath, 493);
  }
  return binPath;
}
async function sniffContentType(url) {
  return new Promise((resolve) => {
    const proto = url.startsWith("https") ? https__namespace : http__namespace;
    const req = proto.request(url, { method: "HEAD" }, (res) => {
      const ct = (res.headers["content-type"] ?? "").split(";")[0].trim();
      resolve(ct);
    });
    req.on("error", () => resolve(""));
    req.setTimeout(6e3, () => {
      req.destroy();
      resolve("");
    });
    req.end();
  });
}
async function downloadDirect(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https__namespace : http__namespace;
    const req = proto.get(url, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return downloadDirect(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers["content-length"] ?? "0", 10);
      let received = 0;
      const file = fs__namespace.createWriteStream(destPath);
      res.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0) onProgress(Math.round(received / total * 90));
      });
      res.pipe(file);
      file.on("finish", () => file.close(() => {
        onProgress(100);
        resolve();
      }));
      file.on("error", reject);
    });
    req.on("error", reject);
  });
}
function detectAvailableBrowsers() {
  const browsers = [];
  if (process.platform === "darwin") {
    if (fs__namespace.existsSync("/Applications/Google Chrome.app")) browsers.push("chrome");
    if (fs__namespace.existsSync("/Applications/Chromium.app")) browsers.push("chromium");
    if (fs__namespace.existsSync("/Applications/Brave Browser.app")) browsers.push("brave");
    if (fs__namespace.existsSync("/Applications/Microsoft Edge.app")) browsers.push("edge");
    if (fs__namespace.existsSync("/Applications/Firefox.app")) browsers.push("firefox");
    browsers.push("safari");
  } else if (process.platform === "win32") {
    browsers.push("chrome", "edge", "brave", "chromium", "firefox");
  } else {
    browsers.push("chrome", "chromium", "brave", "firefox");
  }
  return browsers;
}
async function downloadWithYtDlp(url, onProgress) {
  const binPath = await getYtDlpBinaryPath();
  const ytDlp = new YTDlpWrap(binPath);
  const dir = getDownloadDir();
  const uniqueId = `ytdl-${Date.now()}`;
  const outputTemplate = path__namespace.join(dir, `${uniqueId}.%(ext)s`);
  const baseArgs = [
    url,
    "-o",
    outputTemplate,
    "--format",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best/18",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--newline",
    "--extractor-retries",
    "3",
    "--fragment-retries",
    "3"
  ];
  const browsers = detectAvailableBrowsers();
  const attempts = [
    [],
    ...browsers.length > 0 ? [["--cookies-from-browser", browsers[0]]] : []
  ];
  let lastError = new Error("yt-dlp failed");
  for (const cookieArgs of attempts) {
    const args = [...baseArgs, ...cookieArgs];
    const result = await new Promise((resolve) => {
      const stderrLines = [];
      const proc = ytDlp.exec(args);
      proc.on("progress", (p) => {
        if (p.percent != null) {
          onProgress({ phase: "downloading", percent: Math.round(p.percent) });
        }
      });
      proc.on("ytDlpEvent", (eventType) => {
        if (eventType === "ffmpeg" || eventType === "merger") {
          onProgress({ phase: "processing", percent: 99 });
        }
      });
      proc.ytDlpProcess?.stderr?.on("data", (chunk) => {
        stderrLines.push(chunk.toString());
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          const errText = stderrLines.join("").slice(-1e3);
          lastError = new Error(
            errText.includes("Sign in to confirm") || errText.includes("age-restricted") ? "YouTube requires sign-in. Log in to YouTube in Chrome or Safari first, then try again." : errText.includes("429") || errText.includes("Too Many Requests") ? "YouTube is rate-limiting requests. Wait a minute and try again." : errText.includes("Video unavailable") || errText.includes("Private video") ? "Video is unavailable or private." : errText.trim() || `yt-dlp exited with code ${code}`
          );
          return resolve(null);
        }
        const files = fs__namespace.readdirSync(dir).filter((f) => f.startsWith(uniqueId)).map((f) => path__namespace.join(dir, f));
        if (files.length === 0) {
          lastError = new Error("yt-dlp finished but no output file was found");
          return resolve(null);
        }
        const filePath = files[0];
        const ext = path__namespace.extname(filePath).slice(1).toLowerCase();
        const mimeType = ["mp4", "mkv", "webm", "mov", "avi"].includes(ext) ? `video/${ext === "mkv" ? "x-matroska" : ext}` : `audio/${ext}`;
        resolve({ filePath, mimeType });
      });
      proc.on("error", (err) => {
        lastError = err;
        resolve(null);
      });
    });
    if (result) return result;
    if (cookieArgs.length > 0) {
      onProgress({ phase: "downloading", percent: 0 });
    }
  }
  throw lastError;
}
async function downloadMediaFromUrl(url, onProgress) {
  onProgress({ phase: "detecting", percent: 0 });
  const isDirectExt = MEDIA_EXT_RE.test(url);
  const contentType = isDirectExt ? "" : await sniffContentType(url);
  const isDirectMedia = isDirectExt || MEDIA_CONTENT_TYPE_RE.test(contentType);
  if (isDirectMedia) {
    const extMatch = url.match(MEDIA_EXT_RE);
    const ext = extMatch ? extMatch[1] : contentType.split("/")[1] ?? "mp4";
    const filename = `download-${Date.now()}.${ext}`;
    const filePath = path__namespace.join(getDownloadDir(), filename);
    const mime2 = contentType || (MEDIA_EXT_RE.test(`.${ext}`) ? `audio/${ext}` : `video/${ext}`);
    onProgress({ phase: "downloading", percent: 5 });
    await downloadDirect(url, filePath, (pct) => {
      onProgress({ phase: "downloading", percent: pct });
    });
    return { filePath, mimeType: mime2 };
  }
  onProgress({ phase: "downloading", percent: 0 });
  return downloadWithYtDlp(url, onProgress);
}
function registerDownloadHandlers(mainWindow2) {
  electron.ipcMain.handle("download-url", async (_, url) => {
    const result = await downloadMediaFromUrl(url, (progress) => {
      mainWindow2.webContents.send("download-progress", progress);
    });
    const hash = crypto.createHash("sha1");
    const stream = fs__namespace.createReadStream(result.filePath, { start: 0, end: 512 * 1024 });
    await new Promise((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const mediaHash = hash.digest("hex");
    const resolvedMime = result.mimeType || mime.lookup(result.filePath) || "video/mp4";
    return {
      filePath: result.filePath,
      mediaHash,
      mimeType: resolvedMime
    };
  });
}
let mainWindow = null;
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Allow file:// media in dev (renderer served from http://localhost).
      // This is safe for a local-only desktop app that only reads the user's own files.
      webSecurity: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow = win;
}
electron.app.whenReady().then(() => {
  registerFileHandlers(electron.ipcMain);
  registerAnalyzeHandlers(electron.ipcMain);
  registerProjectHandlers(electron.ipcMain);
  createWindow();
  if (mainWindow) registerDownloadHandlers(mainWindow);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
