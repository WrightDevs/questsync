'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let _autoUpdater = null;
let mainWindow = null;

let currentStatus = {
  status: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode'
  version: null,
  percent: 0,
  error: null,
  currentVersion: null,
};

function getAutoUpdater() {
  if (!_autoUpdater) {
    try {
      const eu = require('electron-updater');
      _autoUpdater = eu.autoUpdater;
    } catch (err) {
      console.error('[Updater] Failed to load electron-updater:', err);
    }
  }
  return _autoUpdater;
}

function broadcastStatus(patch) {
  let appVer = '1.1.0';
  try {
    appVer = app.getVersion() || '1.1.0';
  } catch (_) {}
  currentStatus = {
    ...currentStatus,
    currentVersion: appVer,
    ...patch,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('update-status', currentStatus);
    } catch (_) {}
  }
}

function getGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const updateCfgPath = path.join(__dirname, 'update.config.json');
    if (fs.existsSync(updateCfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(updateCfgPath, 'utf8'));
      if (cfg && cfg.token) return cfg.token;
    }
    const licCfgPath = path.join(__dirname, 'license.config.json');
    if (fs.existsSync(licCfgPath)) {
      const lic = JSON.parse(fs.readFileSync(licCfgPath, 'utf8'));
      if (lic && lic.githubToken) return lic.githubToken;
    }
  } catch (_) {}
  return null;
}

let currentFeedConfig = null;

function initAutoUpdater(win) {
  mainWindow = win;

  // In unpackaged development environment, don't run auto-updater unless forced
  if (!app.isPackaged && !process.env.FORCE_AUTO_UPDATE) {
    currentStatus = {
      status: 'dev-mode',
      version: app.getVersion(),
      percent: 0,
      error: null,
    };
    return;
  }

  const updater = getAutoUpdater();
  if (!updater) {
    broadcastStatus({ status: 'error', error: 'electron-updater module not available' });
    return;
  }

  const feedConfig = {
    provider: 'github',
    owner: 'WrightDevs',
    repo: 'questsync',
  };

  const token = getGitHubToken();
  if (token) {
    feedConfig.token = token;
  }
  currentFeedConfig = feedConfig;

  try {
    updater.setFeedURL(feedConfig);
  } catch (err) {
    console.error('[Updater] setFeedURL error:', err.message);
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = console;

  updater.on('checking-for-update', () => {
    broadcastStatus({ status: 'checking', error: null });
  });

  updater.on('update-available', (info) => {
    broadcastStatus({
      status: 'available',
      version: info?.version || null,
      releaseDate: info?.releaseDate || null,
      error: null,
    });
  });

  updater.on('update-not-available', (info) => {
    broadcastStatus({
      status: 'not-available',
      version: info?.version || app.getVersion(),
      error: null,
    });
  });

  updater.on('download-progress', (progressObj) => {
    broadcastStatus({
      status: 'downloading',
      percent: Math.round(progressObj.percent || 0),
      bytesPerSecond: progressObj.bytesPerSecond || 0,
      error: null,
    });
  });

  updater.on('update-downloaded', (info) => {
    broadcastStatus({
      status: 'downloaded',
      version: info?.version || null,
      releaseNotes: info?.releaseNotes || null,
      percent: 100,
      error: null,
    });
  });

  updater.on('error', (err) => {
    const msg = err ? (err.message || String(err)) : 'Unknown update error';
    console.error('[Updater] Error:', msg);
    broadcastStatus({
      status: 'error',
      error: msg,
    });
  });

  // Delay initial check by 8 seconds to allow betting views and UI to settle
  setTimeout(() => {
    checkForUpdates().catch((err) => {
      console.warn('[Updater] Auto startup check error:', err.message);
    });
  }, 8000);
}

async function checkForUpdates() {
  if (!app.isPackaged && !process.env.FORCE_AUTO_UPDATE) {
    broadcastStatus({ status: 'dev-mode', version: app.getVersion() });
    return { ok: false, reason: 'Auto-update disabled in dev mode' };
  }
  const updater = getAutoUpdater();
  if (!updater) {
    return { ok: false, error: 'electron-updater not available' };
  }
  try {
    broadcastStatus({ status: 'checking', error: null });
    const res = await updater.checkForUpdates();
    return { ok: true, updateInfo: res ? res.updateInfo : null };
  } catch (err) {
    // If GitHub returns 401 Bad credentials (e.g. stale/revoked token), retry unauthenticated for public repository
    if (/401|bad credentials/i.test(err.message) && currentFeedConfig && currentFeedConfig.token) {
      console.warn('[Updater] Token authentication returned 401, retrying unauthenticated against public repository...');
      delete currentFeedConfig.token;
      try {
        updater.setFeedURL(currentFeedConfig);
        const retryRes = await updater.checkForUpdates();
        return { ok: true, updateInfo: retryRes ? retryRes.updateInfo : null };
      } catch (retryErr) {
        broadcastStatus({ status: 'error', error: retryErr.message });
        return { ok: false, error: retryErr.message };
      }
    }
    broadcastStatus({ status: 'error', error: err.message });
    return { ok: false, error: err.message };
  }
}

function installUpdate() {
  const updater = getAutoUpdater();
  if (!updater) return { ok: false, error: 'electron-updater not available' };
  try {
    updater.quitAndInstall(false, true);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getUpdateStatus() {
  return {
    ...currentStatus,
    currentVersion: app.getVersion(),
  };
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  installUpdate,
  getUpdateStatus,
};
