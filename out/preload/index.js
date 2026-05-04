"use strict";
const electron = require("electron");
const api = {
  openFile: () => electron.ipcRenderer.invoke("open-file"),
  openPath: (filePath) => electron.ipcRenderer.invoke("open-path", filePath),
  analyze: (filePath, mediaHash, options) => electron.ipcRenderer.invoke("analyze", filePath, mediaHash, options),
  loadProject: (mediaHash) => electron.ipcRenderer.invoke("load-project", mediaHash),
  saveProject: (project) => electron.ipcRenderer.invoke("save-project", project),
  listProjects: () => electron.ipcRenderer.invoke("list-projects"),
  platform: process.platform,
  onAnalysisProgress(cb) {
    const handler = (_event, pct) => cb(pct);
    electron.ipcRenderer.on("analysis-progress", handler);
    return () => electron.ipcRenderer.removeListener("analysis-progress", handler);
  },
  downloadUrl: (url) => electron.ipcRenderer.invoke("download-url", url),
  onDownloadProgress(cb) {
    const handler = (_event, progress) => cb(progress);
    electron.ipcRenderer.on("download-progress", handler);
    return () => electron.ipcRenderer.removeListener("download-progress", handler);
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
