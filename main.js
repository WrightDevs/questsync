const { app, BrowserWindow, WebContentsView, ipcMain, dialog, shell, clipboard } = require('electron');
const { checkLicense } = require('./license');
const { initAutoUpdater, checkForUpdates, installUpdate, getUpdateStatus } = require('./updater');
const {
  normalizeSite,
  normalizeCountry,
  siteFromUrl,
  countryFromUrl,
  buildHomeUrl,
  buildOpenBetsUrl,
  normalizeUrlForProfile,
  rewriteCountryOnUrl,
  rewriteUrlForProfile,
  minStakeForProfile,
  FIND_STAKE_INPUT_JS,
  IS_CONFIRM_OPEN_JS,
  KEYBOARD_CONTAINER_SELECTOR,
  MONITOR_URLS,
  oddsReadCode,
  readFieldCode,
  FAST_REBET_CYCLE_JS,
  EXECUTE_ATTACK_CYCLE_JS,
  INSPECT_SINGLE_BET_STATE_JS,
  SINGLE_BET_PLACE_ONLY_JS,
  SINGLE_BET_CONFIRM_ONLY_JS,
  FAST_SET_STAKE_JS,
  NAV_OPEN_BETS_JS,
  INSPECT_OPEN_BETS_STATE_JS,
  PREPARE_CASHOUT_CLICK_JS,
  FIND_CASHOUT_CONFIRM_JS,
  CLICK_CASHOUT_CONFIRM_JS,
  loginCode,
} = require('./site-adapters');
const {
  extractBetanoMatchKey,
  createBetanoGoalTracker,
} = require('./betano-listener');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Prevent MaxListenersExceededWarning – Electron internally attaches listeners
// on executeJavaScript while pages navigate; 5-8 panes × multiple calls exceeds 10.
EventEmitter.defaultMaxListeners = 100;

// Some networks drop UDP/QUIC, which makes Google-hosted pages time out in Electron.
app.commandLine.appendSwitch('disable-quic');

// Bypass the Windows system proxy, which made page loads time out on this PC.
app.commandLine.appendSwitch('no-proxy-server');

const DEFAULT_BAR_HEIGHT = 148;
let currentBarHeight = DEFAULT_BAR_HEIGHT;
let currentAppRoute = '/software';
let isModalOpen = false;

function updateViewsVisibility() {
  const isSoftware = currentAppRoute === '/software' && !isModalOpen;
  if (!isSoftware) {
    views.forEach((v) => {
      try {
        if (typeof v.setVisible === 'function') v.setVisible(false);
        // Maintain a valid mobile viewport offscreen so DOM measurements and login inputs remain functional
        v.setBounds({ x: -10000, y: -10000, width: 380, height: 800 });
      } catch (_) { }
    });
    if (monitorView && !monitorView.webContents.isDestroyed()) {
      try {
        if (typeof monitorView.setVisible === 'function') monitorView.setVisible(false);
        monitorView.setBounds({ x: -10000, y: -10000, width: 380, height: 800 });
      } catch (_) { }
    }
  } else {
    views.forEach((v) => {
      try {
        if (typeof v.setVisible === 'function') v.setVisible(true);
      } catch (_) { }
    });
    if (monitorView && !monitorView.webContents.isDestroyed()) {
      try {
        if (typeof monitorView.setVisible === 'function') monitorView.setVisible(true);
      } catch (_) { }
    }
    layout();
  }
}

let win = null;
let monitorWin = null;  // floating monitor window (when monitorConfig.mode === 'float')
let monitorView = null; // docked monitor view inside main window (when monitorConfig.mode === 'dock')
let monitorBounds = null;
const monitorConfig = {
  site: 'betano',  // 'betano' | 'betpawa'
  country: 'ng',   // independent monitor country ('ng' | 'gh') - NEVER coupled to panes
  open: false,
  mode: 'dock',    // 'dock' | 'float'
  side: 'left',    // 'left' | 'right' (sidebar docked on left by default)
  width: 340,      // docked strip width in px (260..540)
  zoom: 0.65,      // independent monitor zoom (0.5..1.5)
  mobileUA: true,  // mobile User-Agent
};
const monitorListenerConfig = {
  goalBetAction: 'place_confirm', // 'place_confirm' | 'place_only' | 'rapid_attack'
  autoCashoutOnDrop: true,
};
const monitorGoalTracker = createBetanoGoalTracker();
const monitorWatchState = {
  armed: false,
  isMatchPage: false,
  score: '',
  prevScore: '',
  url: '',
  matchKey: '',
  lastEvent: '',
  lastTriggerAt: 0,
};

const MONITOR_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

let views = [];
let activePaneIndex = 0;
let layoutMode = 'row'; // 'auto' | 'row' | 'grid'
let currentUrl = 'about:blank';
let currentCountry = 'ng'; // batch/default country fallback ('ng' | 'gh')
let paneProfiles = []; // Array<{ site: 'sportybet' | 'football', country: 'ng' | 'gh', url: string }>
let hasSavedProfiles = false;
let savedWindowCount = 5;
let savedWindowBounds = null;
let wholeStakeOption = true;
const options = { mirror: true, typing: true, windowSync: true, autoAlign: true, autoAcceptOdds: false };
let savedOddsSel = '';
let savedStakeSel = '';
let hotkeysEnabled = true;
let cashoutBusy = false;
const cashoutConfig = {
  autoNavOpenBets: true,
};
let zoom = 0.65;

// Track per-view text input focus synchronously so Spacebar hotkey never triggers while typing
const viewEditableFocus = new Map();
let suppressFocusRelay = false; // true while applying stakes across panes so focus hops stay internal

// Dual profit targets per country (user-configurable from React UI)
const profitTargets = { gh: 200, ng: 7500 };

// Pre-calculated rebet stakes prepared immediately on Place Bet & Confirm
const preparedRebetStakes = new Map(); // Map<webContentsId, number>

// User-configurable Rebet Decrement Settings
const rebetConfig = {
  decrementNG: 10,
  decrementGH: 1.0,
  mode: 'fixed', // 'fixed' | 'tiered'
};

let autoRebetRunning = false;
let autoRebetCycle = 0;
let autoRebetTarget = 1;
let autoRebetOnSpace = true;
let autoRebetCycles = 3;
let singleBetClickMode = '1-click'; // '1-click' | '2-click' (applies to Single Bet mode only)
let singleBetInFlight = false;
let balanceAwareStake = true;
let savedAccounts = [];
let savedMonitorAccount = { phone: '', password: '' };
let autoLoginEnabled = true;
const initialAutoLoginPanes = new Set();

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'user-settings.json');
}

function getProfilesPath() {
  return path.join(app.getPath('userData'), 'pane-profiles.json');
}

function loadUserSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const s = JSON.parse(raw);
    if (s && typeof s === 'object') {
      if (Number.isInteger(s.windowCount) && s.windowCount >= 1 && s.windowCount <= 8) {
        savedWindowCount = s.windowCount;
      }
      if (Number.isInteger(s.count) && s.count >= 1 && s.count <= 8) {
        savedWindowCount = s.count;
      }
      if (s.layoutMode === 'auto' || s.layoutMode === 'row' || s.layoutMode === 'grid') {
        layoutMode = s.layoutMode;
      }
      if (s.layout === 'auto' || s.layout === 'row' || s.layout === 'grid') {
        layoutMode = s.layout;
      }
      if (typeof s.zoom === 'number' && s.zoom >= 0.5 && s.zoom <= 1.5) {
        zoom = s.zoom;
      }
      if (typeof s.mirror === 'boolean') options.mirror = s.mirror;
      if (typeof s.typing === 'boolean') options.typing = s.typing;
      if (typeof s.windowSync === 'boolean') options.windowSync = s.windowSync;
      if (typeof s.autoAlign === 'boolean') options.autoAlign = s.autoAlign;
      if (typeof s.autoAcceptOdds === 'boolean') options.autoAcceptOdds = s.autoAcceptOdds;
      if (typeof s.whole === 'boolean') wholeStakeOption = s.whole;
      if (typeof s.hotkeysEnabled === 'boolean') hotkeysEnabled = s.hotkeysEnabled;
      if (s.country === 'gh' || s.country === 'ng') currentCountry = s.country;
      if (s.url && typeof s.url === 'string' && s.url !== 'about:blank') currentUrl = s.url;
      if (typeof s.oddsSel === 'string') savedOddsSel = s.oddsSel;
      if (typeof s.stakeSel === 'string') savedStakeSel = s.stakeSel;
      if (s.profitTargets && typeof s.profitTargets === 'object') {
        const gh = parseFloat(s.profitTargets.gh);
        const ng = parseFloat(s.profitTargets.ng);
        if (gh > 0) profitTargets.gh = gh;
        if (ng > 0) profitTargets.ng = ng;
      }
      if (s.rebetConfig && typeof s.rebetConfig === 'object') {
        const dng = parseFloat(s.rebetConfig.decrementNG);
        const dgh = parseFloat(s.rebetConfig.decrementGH);
        if (dng > 0) rebetConfig.decrementNG = dng;
        if (dgh > 0) rebetConfig.decrementGH = dgh;
        if (s.rebetConfig.mode === 'fixed' || s.rebetConfig.mode === 'tiered') {
          rebetConfig.mode = s.rebetConfig.mode;
        }
      }
      if (s.monitorConfig && typeof s.monitorConfig === 'object') {
        Object.assign(monitorConfig, s.monitorConfig);
        if (s.monitorConfig.country === 'gh' || s.monitorConfig.country === 'ng') {
          monitorConfig.country = s.monitorConfig.country;
        }
      }
      if (s.monitorListenerConfig && typeof s.monitorListenerConfig === 'object') {
        if (['place_confirm', 'place_only', 'rapid_attack'].includes(s.monitorListenerConfig.goalBetAction)) {
          monitorListenerConfig.goalBetAction = s.monitorListenerConfig.goalBetAction;
        }
        if (typeof s.monitorListenerConfig.autoCashoutOnDrop === 'boolean') {
          monitorListenerConfig.autoCashoutOnDrop = s.monitorListenerConfig.autoCashoutOnDrop;
        }
      }
      if (s.cashoutConfig && typeof s.cashoutConfig === 'object') {
        Object.assign(cashoutConfig, s.cashoutConfig);
      }
      if (typeof s.balanceAwareStake === 'boolean') {
        balanceAwareStake = s.balanceAwareStake;
      }
      if (typeof s.autoRebetOnSpace === 'boolean') {
        autoRebetOnSpace = s.autoRebetOnSpace;
      }
      if (s.singleBetClickMode === '1-click' || s.singleBetClickMode === '2-click') {
        singleBetClickMode = s.singleBetClickMode;
      }
      if (typeof s.autoRebetCycles === 'number' && s.autoRebetCycles > 0) {
        autoRebetCycles = s.autoRebetCycles;
      } else if (s.autoRebetCycles === 'inf') {
        autoRebetCycles = 'inf';
      } else if (typeof s.autoRebetCycles === 'string' && parseInt(s.autoRebetCycles, 10) > 0) {
        autoRebetCycles = parseInt(s.autoRebetCycles, 10);
      }
      if (Array.isArray(s.accounts)) {
        savedAccounts = s.accounts.map((a) => ({
          phone: String(a?.phone || ''),
          password: String(a?.password || ''),
        }));
      }
      if (s.monitorAccount && typeof s.monitorAccount === 'object') {
        savedMonitorAccount = {
          phone: String(s.monitorAccount.phone || ''),
          password: String(s.monitorAccount.password || ''),
        };
      }
      if (typeof s.autoLoginEnabled === 'boolean') {
        autoLoginEnabled = s.autoLoginEnabled;
      }
      if (s.windowBounds && typeof s.windowBounds === 'object' && s.windowBounds.width && s.windowBounds.height) {
        savedWindowBounds = s.windowBounds;
      }
      if (Array.isArray(s.paneProfiles) && s.paneProfiles.length > 0) {
        paneProfiles = s.paneProfiles.slice(0, 8).map((p) => {
          const site = normalizeSite(p?.site);
          const country = normalizeCountry(p?.country);
          return { site, country, url: p.url || buildHomeUrl(site, country) };
        });
        hasSavedProfiles = true;
        currentCountry = paneProfiles[0].country;
        currentUrl = paneProfiles[0].url;
      }
    }
  } catch (_) { }
}

function saveUserSettings() {
  try {
    const s = {
      windowCount: views.length > 0 ? views.length : savedWindowCount,
      count: views.length > 0 ? views.length : savedWindowCount,
      layoutMode,
      layout: layoutMode,
      zoom,
      tileSize: Math.round(zoom * 100),
      mirror: options.mirror,
      typing: options.typing,
      windowSync: options.windowSync !== false,
      autoAlign: options.autoAlign !== false,
      autoAcceptOdds: options.autoAcceptOdds === true,
      whole: wholeStakeOption,
      hotkeysEnabled,
      profitTargets: { ...profitTargets },
      rebetConfig: { ...rebetConfig },
      monitorConfig: { ...monitorConfig },
      monitorListenerConfig: { ...monitorListenerConfig },
      cashoutConfig: { ...cashoutConfig },
      balanceAwareStake,
      autoRebetOnSpace,
      autoRebetCycles,
      singleBetClickMode,
      country: currentCountry,
      url: currentUrl,
      oddsSel: savedOddsSel || '',
      stakeSel: savedStakeSel || '',
      accounts: savedAccounts,
      monitorAccount: savedMonitorAccount,
      autoLoginEnabled,
      paneProfiles: paneProfiles.slice(0, 8).map((p, i) => ({
        site: normalizeSite(p?.site),
        country: normalizeCountry(p?.country),
        url: getLiveUrl(views[i]) || p?.url || buildHomeUrl(p?.site, p?.country),
      })),
      windowBounds: win && !win.isDestroyed() ? win.getBounds() : savedWindowBounds,
    };
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), 'utf8');
  } catch (_) { }
}

function loadSavedProfiles() {
  loadUserSettings();
  try {
    const raw = fs.readFileSync(getProfilesPath(), 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.profiles) ? parsed.profiles : (Array.isArray(parsed) ? parsed : null);
    if (list && list.length > 0) {
      paneProfiles = list.slice(0, 8).map((p) => {
        const site = normalizeSite(p?.site);
        const country = normalizeCountry(p?.country);
        return { site, country, url: buildHomeUrl(site, country) };
      });
      hasSavedProfiles = true;
      currentCountry = paneProfiles[0].country;
      currentUrl = paneProfiles[0].url;
    }
  } catch (_) { }
}

function saveProfiles() {
  try {
    const compact = paneProfiles.slice(0, 8).map((p) => ({
      site: normalizeSite(p?.site),
      country: normalizeCountry(p?.country),
    }));
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(getProfilesPath(), JSON.stringify({ profiles: compact }, null, 2), 'utf8');
  } catch (_) { }
  saveUserSettings();
}

function ensurePaneProfile(i) {
  if (!paneProfiles[i]) {
    const fallback = paneProfiles[activePaneIndex] || paneProfiles[0] || { site: 'sportybet', country: currentCountry };
    const site = normalizeSite(fallback.site);
    const country = normalizeCountry(fallback.country);
    paneProfiles[i] = {
      site,
      country,
      url: hasSavedProfiles ? buildHomeUrl(site, country) : currentUrl,
    };
  }
  return paneProfiles[i];
}

function getLiveUrl(v) {
  try {
    return !v || v.webContents.isDestroyed() ? '' : v.webContents.getURL();
  } catch (_) {
    return '';
  }
}

function getPaneProfile(i) {
  const saved = ensurePaneProfile(i);
  const url = getLiveUrl(views[i]) || saved.url;
  return {
    site: siteFromUrl(url, saved.site),
    country: countryFromUrl(url, saved.country),
    url,
  };
}

function syncProfileFromView(i) {
  const v = views[i];
  const url = getLiveUrl(v);
  if (!url || url === 'about:blank') return;
  const p = ensurePaneProfile(i);
  const nextSite = siteFromUrl(url, p.site);
  const nextCountry = countryFromUrl(url, p.country);
  const changed = nextSite !== p.site || nextCountry !== p.country;
  p.site = nextSite;
  p.country = nextCountry;
  p.url = url;
  if (i === activePaneIndex) {
    currentUrl = url;
    currentCountry = nextCountry;
  }
  if (changed) saveProfiles();
}

/** Push live pane metadata to the React control bar */
function sendPaneStates() {
  if (!win || win.isDestroyed()) return;
  const states = views.map((_v, i) => {
    const prof = getPaneProfile(i);
    return {
      index: i,
      site: prof.site,
      country: prof.country,
      target: profitTargets[prof.country] || profitTargets[currentCountry],
      url: prof.url,
      active: i === activePaneIndex,
    };
  });
  win.webContents.send('pane-states', states);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withTimeout = (p, ms, fallback) =>
  Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);

/** True when the view is usable for JS execution. */
function viewReady(v) {
  return v && !v.webContents.isDestroyed() && !v.webContents.isLoadingMainFrame();
}

function setZoom(action) {
  if (typeof action === 'number' && action >= 0.25 && action <= 2.5) {
    zoom = Math.round(action * 100) / 100;
  } else {
    const step = action === 'in' ? 0.1 : action === 'out' ? -0.1 : 0;
    zoom = action === 'reset' ? 0.65 : Math.min(2, Math.max(0.25, Math.round((zoom + step) * 100) / 100));
  }
  views.forEach((v) => {
    if (!v.webContents.isDestroyed()) v.webContents.setZoomFactor(zoom);
  });
  if (win && !win.isDestroyed()) win.webContents.send('zoom-changed', zoom);
  saveUserSettings();
  return zoom;
}

function normalizeUrl(input, idx = activePaneIndex) {
  const p = paneProfiles[idx] || { site: 'sportybet', country: currentCountry };
  return normalizeUrlForProfile(input, p.site, p.country);
}

// ─── Layout ─────────────────────────────────────────────────────────────────

const PANE_GAP = 3;

function layout() {
  if (!win || win.isDestroyed()) return;
  if (currentAppRoute !== '/software' || isModalOpen) return;
  const [w, h] = win.getContentSize();
  const n = views.length || 1;
  const top = currentBarHeight;
  const availH = Math.max(0, h - top);

  const docked = !!(monitorConfig.open && monitorConfig.mode === 'dock' && monitorView && !monitorView.webContents.isDestroyed());
  const rawBw = Math.min(540, Math.max(260, parseInt(monitorConfig.width, 10) || 340));
  const bw = docked ? Math.min(rawBw, Math.floor(w * 0.45)) : 0;
  const sportyW = docked ? Math.max(260, w - bw - PANE_GAP) : w;
  const sportyX = docked && monitorConfig.side === 'left' ? (w - sportyW) : 0;

  let monitorBounds = null;
  if (docked && monitorView) {
    const bx = monitorConfig.side === 'left' ? 0 : (sportyW + PANE_GAP);
    const actualBw = monitorConfig.side === 'left' ? Math.max(0, sportyX - PANE_GAP) : Math.max(0, w - bx);
    monitorView.setBounds({ x: bx, y: top, width: actualBw, height: availH });
    monitorBounds = {
      open: true,
      site: monitorConfig.site || 'betano',
      side: monitorConfig.side || 'left',
      x: bx,
      width: actualBw,
    };
  }

  let cols = n;
  let rows = 1;
  if (layoutMode === 'grid') {
    cols = n <= 2 ? n : Math.ceil(n / 2);
    rows = Math.ceil(n / cols);
  } else if (layoutMode === 'auto') {
    const minRowWidth = 285;
    if (n >= 4 && Math.floor(sportyW / n) < minRowWidth) {
      cols = Math.ceil(n / 2);
      rows = 2;
    }
  }

  const rowH = Math.floor((availH - PANE_GAP * (rows - 1)) / rows);

  const paneBounds = [];
  views.forEach((v, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const isLastRow = r === rows - 1;
    const itemsInRow = isLastRow ? Math.max(1, n - r * cols) : cols;
    const colW = Math.floor((sportyW - PANE_GAP * (itemsInRow - 1)) / itemsInRow);
    const x = sportyX + c * (colW + PANE_GAP);
    const y = top + r * (rowH + PANE_GAP);
    const width = c === itemsInRow - 1 ? Math.max(0, sportyX + sportyW - x) : colW;
    const height = isLastRow ? Math.max(0, h - y) : rowH;
    v.setBounds({ x, y, width, height });
    paneBounds.push({ index: i, x, width, col: c, row: r, itemsInRow });
  });

  if (win && !win.isDestroyed()) {
    win.webContents.send('ui:layout-geometry', {
      totalWidth: w,
      docked,
      monitor: monitorBounds,
      sportyX,
      sportyW,
      paneBounds,
      cols,
      rows,
    });
  }
}

function stripHashAndParams(u) {
  try {
    const parsed = new URL(u);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch (_) {
    return (u || '').split(/[?#]/)[0].replace(/\/+$/, '');
  }
}

let isNavSyncing = false;
function syncNavigationFromLead(leadIndex, targetUrl) {
  if (!options.windowSync || isNavSyncing) return;
  const isLead = (activePaneIndex >= 0 ? leadIndex === activePaneIndex : leadIndex === 0);
  if (!isLead) return;
  if (!targetUrl || targetUrl === 'about:blank') return;
  if (/deposit|login|my_accounts|cashier|profile/i.test(targetUrl)) return;

  const leadProf = getPaneProfile(leadIndex);
  if (!leadProf) return;

  isNavSyncing = true;
  try {
    for (let j = 0; j < views.length; j++) {
      if (j === leadIndex) continue;
      const fView = views[j];
      if (!fView || fView.webContents.isDestroyed()) continue;
      const fProf = getPaneProfile(j);
      if (fProf.site !== leadProf.site) continue;

      const fCurUrl = fView.webContents.getURL();
      const synchedUrl = rewriteCountryOnUrl(targetUrl, fProf.site, fProf.country);

      // Do NOT trigger full page reload if follower is already on the same base page/match
      if (stripHashAndParams(fCurUrl) === stripHashAndParams(synchedUrl)) continue;

      if (fCurUrl !== synchedUrl) {
        fView.webContents.loadURL(synchedUrl).catch(() => { });
      }
    }
  } finally {
    setTimeout(() => { isNavSyncing = false; }, 600);
  }
}

function clearViews() {
  for (const v of views) {
    try {
      const idx = views.indexOf(v);
      if (idx >= 0) syncProfileFromView(idx);
    } catch (_) { }
    try {
      const vid = v.webContents?.id;
      if (vid) {
        viewEditableFocus.delete(vid);
        lastStakeByView.delete(vid);
        lastFailed.delete(vid);
        preparedRebetStakes.delete(vid);
      }
    } catch (_) { }
    try { win.contentView.removeChildView(v); } catch (_) { }
    try { v.webContents.close(); } catch (_) { }
  }
  views = [];
}

function createViews(count) {
  clearViews();
  if (activePaneIndex >= count) activePaneIndex = 0;
  for (let i = 0; i < count; i++) {
    const prof = ensurePaneProfile(i);
    const v = new WebContentsView({
      webPreferences: {
        partition: `persist:account-${i + 1}`,
        preload: path.join(__dirname, 'view-preload.js'),
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    v.webContents.setMaxListeners(100);
    viewEditableFocus.set(v.webContents.id, false);

    // Persist cookies to disk automatically on cookie changes
    const paneSession = v.webContents.session;
    if (paneSession && paneSession.cookies) {
      let flushTimer = null;
      paneSession.cookies.on('changed', () => {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          try { paneSession.cookies.flushStore().catch(() => { }); } catch (_) { }
        }, 1500);
      });
    }

    // Popups stay in the same pane, with strict protection against deposit redirects.
    v.webContents.setWindowOpenHandler(({ url }) => {
      if (url.includes('/deposit') || url.includes('/my_accounts/deposit')) {
        console.warn(`[WindowOpen Guard] Pane ${i + 1} blocked popup to deposit: ${url}`);
        return { action: 'deny' };
      }
      v.webContents.loadURL(url);
      return { action: 'deny' };
    });

    // Navigation guards: intercept and block any automated or accidental redirect to deposit
    v.webContents.on('will-navigate', (event, url) => {
      if (url.includes('/deposit') || url.includes('/my_accounts/deposit')) {
        event.preventDefault();
        console.warn(`[Navigation Guard] Blocked pane ${i + 1} redirect to deposit: ${url}`);
        if (win && !win.isDestroyed()) {
          win.webContents.send('acc-status', {
            msg: `Window ${i + 1}: Blocked redirect to Deposit page (Insufficient balance).`,
          });
        }
      }
    });

    v.webContents.on('did-navigate-in-page', (_e, url) => {
      if (url.includes('/deposit') || url.includes('/my_accounts/deposit')) {
        console.warn(`[SPA Navigation Guard] Pane ${i + 1} navigated in-page to deposit: ${url}. Restoring...`);
        v.webContents.goBack();
        if (win && !win.isDestroyed()) {
          win.webContents.send('acc-status', {
            msg: `Window ${i + 1}: Navigated back from Deposit page to betslip.`,
          });
        }
      }
    });

    // Hotkeys inside panes: Ctrl±/0 → zoom, Ctrl+Shift+I → DevTools,
    // Space → Place Bet (when not typing in text box), Alt+C / F9 → Cashout All
    v.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const k = input.key.toLowerCase();

      if (input.control) {
        if (input.shift && k === 'i') { v.webContents.toggleDevTools(); event.preventDefault(); }
        else if (k === '-') { setZoom('out'); event.preventDefault(); }
        else if (k === '=' || k === '+') { setZoom('in'); event.preventDefault(); }
        else if (k === '0') { setZoom('reset'); event.preventDefault(); }
        return;
      }

      if (!hotkeysEnabled) return;

      if (input.key === 'Escape') {
        if (autoRebetRunning) {
          event.preventDefault();
          stopAutoRebet();
          return;
        }
      }

      if (input.code === 'Space' && !input.alt && !input.meta && !input.shift) {
        if (!viewEditableFocus.get(v.webContents.id)) {
          event.preventDefault();
          if (!input.isAutoRepeat) {
            if (autoRebetOnSpace) {
              if (autoRebetRunning) {
                stopAutoRebet();
              } else {
                const runCyc = autoRebetCycles === 'inf' ? 'inf' : Math.max(1, parseInt(autoRebetCycles, 10) || 1);
                startAutoRebet(runCyc, `Hotkey: Spacebar (Pane ${i + 1} - Rapid Attack)`);
              }
            } else {
              // Single Bet mode: ignore repeated Spacebar presses while a pass/step is in-flight
              if (autoRebetRunning || singleBetInFlight) return;
              triggerSingleBetSpacebar(`Hotkey: Spacebar (Pane ${i + 1} - Single Bet ${singleBetClickMode})`);
            }
          }
        }
      } else if ((input.key === 'Enter' || input.code === 'NumpadEnter') && !input.alt && !input.meta && !input.shift) {
        if (!viewEditableFocus.get(v.webContents.id)) {
          event.preventDefault();
          if (!input.isAutoRepeat) {
            if (!autoRebetOnSpace) {
              // Single Bet mode: Enter triggers manual Rebet (repeating last placed bet)
              triggerRebet(`Hotkey: Enter (Pane ${i + 1} - Single Bet Manual Rebet)`);
            }
          }
        }
      } else if ((input.alt && k === 'c') || input.key === 'F9') {
        event.preventDefault();
        if (!input.isAutoRepeat) triggerCashoutAll(input.alt ? 'Alt+C' : 'F9');
      }
    });

    v.webContents.on('did-finish-load', () => {
      if (!v.webContents.isDestroyed()) {
        viewEditableFocus.set(v.webContents.id, false);
        v.webContents.setZoomFactor(zoom);
        try { v.webContents.send('set-auto-accept-odds', !!options.autoAcceptOdds); } catch (_) {}
      }
      syncProfileFromView(i);
      sendPaneStates();
      if (currentProfitConfig) scheduleApply(350, true);

      // Auto-login strictly on initial app launch ONLY (never re-run on subsequent page reloads/navigations)
      if (autoLoginEnabled && !initialAutoLoginPanes.has(i) && savedAccounts[i] && savedAccounts[i].phone && savedAccounts[i].password) {
        setTimeout(async () => {
          if (!viewReady(v) || initialAutoLoginPanes.has(i)) return;
          try {
            console.log(`[AutoLogin] Pane ${i + 1}: Checking login state on initial launch...`);
            const res = await performLogin(v, savedAccounts[i].phone, savedAccounts[i].password, i);
            if (res && res.ok) initialAutoLoginPanes.add(i);
          } catch (err) {
            console.error(`[AutoLogin] Pane ${i + 1} auto-login error:`, err);
          }
        }, 2200);
      }
    });
    v.webContents.on('did-navigate', (_e, url) => {
      if (!v.webContents.isDestroyed()) viewEditableFocus.set(v.webContents.id, false);
      syncProfileFromView(i);
      sendPaneStates();
      syncNavigationFromLead(i, url);
    });
    v.webContents.on('did-navigate-in-page', (_e, url) => {
      syncProfileFromView(i);
      sendPaneStates();
      // DO NOT call syncNavigationFromLead on in-page navigation:
      // In SPAs (Nuxt/Vue), hash & route changes are already mirrored via DOM clicks.
      // Calling loadURL here causes a violent full-page HTTP reload on other panes.
    });

    const idx = i + 1;
    v.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (!isMain || code === -3) return;
      const msg = `Window ${idx} failed: ${desc} (${code}) ${url}`;
      console.error(msg);
      if (win && !win.isDestroyed()) win.webContents.send('load-error', msg);
    });
    v.webContents.on('render-process-gone', (_e, d) => console.error(`Window ${idx} crashed: ${d.reason}`));
    v.webContents.on('preload-error', (_e, _p, err) => console.error(`Window ${idx} preload error: ${err}`));

    win.contentView.addChildView(v);
    views.push(v);
    const startUrl = prof.url && prof.url !== 'about:blank' ? prof.url : currentUrl;
    if (startUrl && startUrl !== 'about:blank') {
      v.webContents.loadURL(startUrl).catch(() => { });
    }
  }
  layout();
  sendPaneStates();
}

function createWindow() {
  loadSavedProfiles();
  const initBounds = savedWindowBounds || { width: 1600, height: 920 };
  win = new BrowserWindow({
    width: initBounds.width || 1600,
    height: initBounds.height || 920,
    x: initBounds.x,
    y: initBounds.y,
    backgroundColor: '#0b0e14',
    title: 'QuestSync',
    webPreferences: {
      preload: path.join(__dirname, 'ui-preload.js'),
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui-dist', 'index.html'));
  win.on('resize', () => {
    layout();
    saveUserSettings();
  });
  win.on('maximize', () => {
    layout();
    saveUserSettings();
  });
  win.on('unmaximize', () => {
    layout();
    saveUserSettings();
  });
  win.on('move', () => {
    saveUserSettings();
  });
  win.on('close', () => {
    saveProfiles();
    saveUserSettings();
    destroyMonitorView();
    destroyMonitorWin();
  });
  win.webContents.once('did-finish-load', () => {
    const initialCount = savedWindowCount || (hasSavedProfiles && paneProfiles.length > 0 ? paneProfiles.length : 5);
    createViews(initialCount);
    if (monitorConfig.open) {
      ensureMonitorOpen();
    }
    initAutoUpdater(win);
  });
}

// ─── IPC: navigation & UI controls ─────────────────────────────────────────

ipcMain.handle('ui:load', (_e, urlOrOpts, maybeScope) => {
  const isObj = urlOrOpts && typeof urlOrOpts === 'object';
  const rawUrl = isObj ? urlOrOpts.url : urlOrOpts;
  const scope = (isObj ? urlOrOpts.scope : maybeScope) === 'active' ? 'active' : 'all';

  if (scope === 'active' && views[activePaneIndex] && !views[activePaneIndex].webContents.isDestroyed()) {
    const i = activePaneIndex;
    const loaded = normalizeUrl(rawUrl, i);
    const p = ensurePaneProfile(i);
    p.site = siteFromUrl(loaded, p.site);
    p.country = countryFromUrl(loaded, p.country);
    p.url = loaded;
    currentUrl = loaded;
    currentCountry = p.country;
    lastApplied.delete(views[i].webContents.id);
    lastFailed.delete(views[i].webContents.id);
    lastStakeByView.delete(views[i].webContents.id);
    views[i].webContents.loadURL(loaded).catch(() => { });
    saveProfiles();
    sendPaneStates();
    return loaded;
  }

  const nextUrl = normalizeUrl(rawUrl, activePaneIndex);
  currentUrl = nextUrl;
  const nextSite = siteFromUrl(nextUrl, 'sportybet');
  const nextCountry = countryFromUrl(nextUrl, currentCountry);
  currentCountry = nextCountry;
  lastApplied.clear();
  lastFailed.clear();
  lastStakeByView.clear();
  views.forEach((v, i) => {
    const p = ensurePaneProfile(i);
    p.site = nextSite;
    p.country = nextCountry;
    p.url = nextUrl;
    if (!v.webContents.isDestroyed()) v.webContents.loadURL(nextUrl).catch(() => { });
  });
  saveProfiles();
  sendPaneStates();
  return nextUrl;
});

ipcMain.handle('ui:back', (_e, scope) => {
  const targetViews = scope === 'active' && views[activePaneIndex] ? [views[activePaneIndex]] : views;
  targetViews.forEach((v) => {
    if (!v.webContents.isDestroyed() && v.webContents.navigationHistory.canGoBack()) {
      v.webContents.navigationHistory.goBack();
    }
  });
});

ipcMain.handle('ui:reload', (_e, scope) => {
  const targetViews = scope === 'active' && views[activePaneIndex] ? [views[activePaneIndex]] : views;
  targetViews.forEach((v) => {
    if (!v.webContents.isDestroyed()) v.webContents.reload();
  });
});

ipcMain.handle('ui:reload-pane', (_e, index) => {
  const idx = parseInt(index, 10);
  if (!Number.isNaN(idx) && views[idx] && !views[idx].webContents.isDestroyed()) {
    views[idx].webContents.reload();
    return true;
  }
  return false;
});

ipcMain.handle('ui:get-user-settings', () => ({
  windowCount: views.length > 0 ? views.length : savedWindowCount,
  count: views.length > 0 ? views.length : savedWindowCount,
  layoutMode,
  layout: layoutMode,
  zoom,
  tileSize: Math.round(zoom * 100),
  mirror: options.mirror,
  typing: options.typing,
  windowSync: options.windowSync !== false,
  autoAlign: options.autoAlign !== false,
  autoAcceptOdds: options.autoAcceptOdds === true,
  whole: wholeStakeOption,
  hotkeysEnabled,
  profitTargets: { ...profitTargets },
  rebetConfig: { ...rebetConfig },
  monitorConfig: { ...monitorConfig },
  monitorListenerConfig: { ...monitorListenerConfig },
  cashoutConfig: { ...cashoutConfig },
  balanceAwareStake,
  autoRebetOnSpace,
  autoRebetCycles,
  singleBetClickMode,
  country: currentCountry,
  url: currentUrl,
  oddsSel: savedOddsSel || '',
  stakeSel: savedStakeSel || '',
  accounts: savedAccounts,
  monitorAccount: savedMonitorAccount,
  autoLoginEnabled,
  paneProfiles: paneProfiles.slice(0, 8).map((p, i) => ({
    site: normalizeSite(p?.site),
    country: normalizeCountry(p?.country),
    url: getLiveUrl(views[i]) || p?.url || buildHomeUrl(p?.site, p?.country),
  })),
}));

ipcMain.handle('ui:save-user-settings', (_e, patch) => {
  if (patch && typeof patch === 'object') {
    if (patch.layoutMode || patch.layout) {
      const mode = patch.layoutMode || patch.layout;
      if (['auto', 'row', 'grid'].includes(mode)) {
        layoutMode = mode;
        layout();
      }
    }
    if (patch.windowCount || patch.count) {
      const c = parseInt(patch.windowCount || patch.count, 10);
      if (c >= 1 && c <= 8) savedWindowCount = c;
    }
    if (typeof patch.zoom === 'number') zoom = patch.zoom;
    if (typeof patch.mirror === 'boolean') options.mirror = patch.mirror;
    if (typeof patch.typing === 'boolean') options.typing = patch.typing;
    if (typeof patch.windowSync === 'boolean') options.windowSync = patch.windowSync;
    if (typeof patch.autoAlign === 'boolean') options.autoAlign = patch.autoAlign;
    if (typeof patch.autoAcceptOdds === 'boolean') {
      options.autoAcceptOdds = patch.autoAcceptOdds;
      broadcastAutoAcceptOdds();
    }
    if (typeof patch.whole === 'boolean') wholeStakeOption = patch.whole;
    if (typeof patch.hotkeysEnabled === 'boolean') hotkeysEnabled = patch.hotkeysEnabled;
    if (patch.country === 'ng' || patch.country === 'gh') currentCountry = patch.country;
    if (patch.url) currentUrl = patch.url;
    if (patch.oddsSel !== undefined) savedOddsSel = String(patch.oddsSel || '');
    if (patch.stakeSel !== undefined) savedStakeSel = String(patch.stakeSel || '');
    if (patch.profitTargets) {
      if (patch.profitTargets.gh > 0) profitTargets.gh = parseFloat(patch.profitTargets.gh);
      if (patch.profitTargets.ng > 0) profitTargets.ng = parseFloat(patch.profitTargets.ng);
    }
    if (patch.rebetConfig && typeof patch.rebetConfig === 'object') {
      const dng = parseFloat(patch.rebetConfig.decrementNG);
      const dgh = parseFloat(patch.rebetConfig.decrementGH);
      if (dng > 0) rebetConfig.decrementNG = dng;
      if (dgh > 0) rebetConfig.decrementGH = dgh;
      if (patch.rebetConfig.mode === 'fixed' || patch.rebetConfig.mode === 'tiered') {
        rebetConfig.mode = patch.rebetConfig.mode;
      }
    }
    if (patch.monitorConfig) Object.assign(monitorConfig, patch.monitorConfig);
    if (patch.monitorListenerConfig && typeof patch.monitorListenerConfig === 'object') {
      if (['place_confirm', 'place_only', 'rapid_attack'].includes(patch.monitorListenerConfig.goalBetAction)) {
        monitorListenerConfig.goalBetAction = patch.monitorListenerConfig.goalBetAction;
      }
      if (typeof patch.monitorListenerConfig.autoCashoutOnDrop === 'boolean') {
        monitorListenerConfig.autoCashoutOnDrop = patch.monitorListenerConfig.autoCashoutOnDrop;
      }
    }
    if (patch.cashoutConfig) Object.assign(cashoutConfig, patch.cashoutConfig);
    if (typeof patch.autoRebetOnSpace === 'boolean') autoRebetOnSpace = patch.autoRebetOnSpace;
    if (patch.singleBetClickMode === '1-click' || patch.singleBetClickMode === '2-click') {
      singleBetClickMode = patch.singleBetClickMode;
    }
    if (typeof patch.balanceAwareStake === 'boolean') balanceAwareStake = patch.balanceAwareStake;
    if (patch.autoRebetCycles !== undefined) {
      if (patch.autoRebetCycles === 'inf' || patch.autoRebetCycles === 0 || patch.autoRebetCycles === '0') {
        autoRebetCycles = 'inf';
      } else {
        const cyc = parseInt(patch.autoRebetCycles, 10);
        if (cyc > 0) autoRebetCycles = cyc;
      }
    }
    if (Array.isArray(patch.accounts)) {
      savedAccounts = patch.accounts.map((a) => ({
        phone: String(a?.phone || ''),
        password: String(a?.password || ''),
      }));
    }
    if (patch.monitorAccount && typeof patch.monitorAccount === 'object') {
      savedMonitorAccount = {
        phone: String(patch.monitorAccount.phone || ''),
        password: String(patch.monitorAccount.password || ''),
      };
    }
    if (typeof patch.autoLoginEnabled === 'boolean') {
      autoLoginEnabled = patch.autoLoginEnabled;
    }
  }
  saveUserSettings();
  return true;
});

ipcMain.handle('ui:get-accounts', () => savedAccounts);
ipcMain.handle('ui:save-accounts', (_e, list) => {
  if (Array.isArray(list)) {
    savedAccounts = list.map((a) => ({
      phone: String(a?.phone || ''),
      password: String(a?.password || ''),
    }));
    saveUserSettings();
  }
  return savedAccounts;
});
ipcMain.handle('ui:set-auto-login', (_e, enabled) => {
  autoLoginEnabled = !!enabled;
  saveUserSettings();
  return autoLoginEnabled;
});
ipcMain.handle('ui:get-auto-login', () => autoLoginEnabled);

ipcMain.handle('ui:set-count', (_e, n) => {
  const count = Math.min(8, Math.max(1, parseInt(n, 10) || 1));
  savedWindowCount = count;
  createViews(count);
  saveProfiles();
  saveUserSettings();
  return count;
});

ipcMain.handle('ui:set-layout', (_e, mode) => {
  layoutMode = ['auto', 'row', 'grid'].includes(mode) ? mode : 'auto';
  layout();
  saveUserSettings();
  return layoutMode;
});

ipcMain.handle('ui:focus-pane', (_e, idx) => {
  const i = parseInt(idx, 10);
  if (views[i] && !views[i].webContents.isDestroyed()) {
    activePaneIndex = i;
    const prof = getPaneProfile(i);
    currentUrl = prof.url;
    currentCountry = prof.country;
    views[i].webContents.focus();
    sendPaneStates();
  }
});

ipcMain.handle('ui:pick', (_e, kind) => {
  views.forEach((v) => v.webContents.send('pick-mode', kind));
});

ipcMain.on('picked', (_e, info) => {
  views.forEach((v) => v.webContents.send('pick-mode', null));
  if (win && !win.isDestroyed()) win.webContents.send('picked', info);
});

ipcMain.handle('ui:zoom', (_e, action) => setZoom(action));

function broadcastAutoAcceptOdds() {
  for (const v of views) {
    if (v && !v.webContents.isDestroyed()) {
      try { v.webContents.send('set-auto-accept-odds', !!options.autoAcceptOdds); } catch (_) {}
    }
  }
}

ipcMain.handle('ui:set-options', (_e, opts) => {
  if (opts && typeof opts === 'object') {
    Object.assign(options, opts);
    saveUserSettings();
    if ('autoAcceptOdds' in opts) broadcastAutoAcceptOdds();
  }
  return { ...options };
});

ipcMain.handle('ui:toggle-auto-accept-odds', () => {
  options.autoAcceptOdds = !options.autoAcceptOdds;
  saveUserSettings();
  broadcastAutoAcceptOdds();
  return options.autoAcceptOdds;
});

ipcMain.handle('ui:get-auto-accept-odds', () => options.autoAcceptOdds);

ipcMain.handle('ui:set-auto-accept-odds', (_e, val) => {
  options.autoAcceptOdds = !!val;
  saveUserSettings();
  broadcastAutoAcceptOdds();
  return options.autoAcceptOdds;
});

ipcMain.handle('ui:set-whole-stake', (_e, whole) => {
  wholeStakeOption = !!whole;
  saveUserSettings();
  return wholeStakeOption;
});

ipcMain.handle('ui:set-bar-height', (_e, h) => {
  currentBarHeight = Math.max(88, parseInt(h, 10) || DEFAULT_BAR_HEIGHT);
  layout();
  return currentBarHeight;
});

ipcMain.handle('ui:set-route', (_e, route) => {
  currentAppRoute = route || '/software';
  updateViewsVisibility();
  return currentAppRoute;
});

ipcMain.handle('ui:set-modal-open', (_e, open) => {
  isModalOpen = !!open;
  updateViewsVisibility();
  return isModalOpen;
});

ipcMain.handle('ui:check-for-updates', async () => {
  return await checkForUpdates();
});

ipcMain.handle('ui:install-update', () => {
  return installUpdate();
});

ipcMain.handle('ui:get-update-status', () => {
  return getUpdateStatus();
});

ipcMain.handle('ui:get-route', () => currentAppRoute);

ipcMain.handle('ui:logout-account', async (_e, windowIndex) => {
  const v = views[windowIndex];
  if (!v) return { ok: false, reason: 'Window not found' };
  try {
    if (v.webContents && !v.webContents.isDestroyed()) {
      await v.webContents.session.clearStorageData();
      const prof = getPaneProfile(windowIndex);
      const home = buildHomeUrl(prof.site, prof.country);
      await v.webContents.loadURL(home);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('ui:get-account-statuses', async () => {
  const statuses = [];
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const prof = getPaneProfile(i);
    let balance = null;
    let isLoggedIn = false;
    if (viewReady(v)) {
      try {
        const balRes = await v.webContents.executeJavaScript(READ_BALANCE_JS).catch(() => null);
        if (balRes && balRes.balance != null) {
          balance = balRes.balance;
          isLoggedIn = true;
        } else {
          const chk = await v.webContents.executeJavaScript(`(() => {
            const isVis = (el) => {
              if (!el) return false;
              const st = window.getComputedStyle(el);
              if (st.visibility === 'hidden' || st.display === 'none') return false;
              return (el.offsetWidth > 0 && el.offsetHeight > 0) || window.innerWidth <= 1;
            };
            const balanceEl = Array.from(document.querySelectorAll(
              '.m-balance-val, .m-balance-num, [data-op="header-balance"], .header-balance, .af-balance, .balance-num, [data-op="user-balance"]'
            )).find(isVis);
            const hasLogin = Array.from(document.querySelectorAll('.m-login-not, [data-op="nav-login"], .m-btn-login')).some(isVis);
            return !!balanceEl || !hasLogin;
          })()`).catch(() => false);
          isLoggedIn = chk;
        }
      } catch (_) { }
    }
    statuses.push({ index: i, site: prof.site, country: prof.country, balance, isLoggedIn });
  }
  return statuses;
});

// ─── IPC: per-pane & batch site/country switching ──────────────────────────

ipcMain.handle('ui:set-pane-profile', (_e, payload) => {
  const idx = parseInt(payload?.index, 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= views.length) return null;
  const v = views[idx];
  const prev = getPaneProfile(idx);
  const nextSite = payload.site !== undefined ? normalizeSite(payload.site, prev.site) : prev.site;
  const nextCountry = payload.country !== undefined ? normalizeCountry(payload.country, prev.country) : prev.country;
  const nextUrl = rewriteUrlForProfile(prev.url, nextSite, nextCountry);

  const prof = ensurePaneProfile(idx);
  prof.site = nextSite;
  prof.country = nextCountry;
  prof.url = nextUrl;

  if (idx === activePaneIndex) {
    currentUrl = nextUrl;
    currentCountry = nextCountry;
  }

  if (v && !v.webContents.isDestroyed()) {
    lastApplied.delete(v.webContents.id);
    lastFailed.delete(v.webContents.id);
    lastStakeByView.delete(v.webContents.id);
    v.webContents.loadURL(nextUrl).catch(() => { });
  }
  saveProfiles();
  sendPaneStates();
  return { index: idx, site: nextSite, country: nextCountry, url: nextUrl };
});

ipcMain.handle('ui:set-country', (_e, country) => {
  currentCountry = normalizeCountry(country, currentCountry);
  lastApplied.clear();
  lastFailed.clear();
  lastStakeByView.clear();

  views.forEach((v, i) => {
    const prof = getPaneProfile(i);
    const nextUrl = rewriteCountryOnUrl(prof.url, prof.site, currentCountry);
    const p = ensurePaneProfile(i);
    p.site = prof.site;
    p.country = currentCountry;
    p.url = nextUrl;
    if (i === activePaneIndex) currentUrl = nextUrl;
    if (v && !v.webContents.isDestroyed()) v.webContents.loadURL(nextUrl).catch(() => { });
  });
  saveProfiles();
  sendPaneStates();
  return { country: currentCountry, url: currentUrl };
});

ipcMain.handle('ui:get-country', () => currentCountry);
ipcMain.handle('ui:get-current-url', () => currentUrl);
ipcMain.handle('ui:get-pane-states', () =>
  views.map((_v, i) => {
    const prof = getPaneProfile(i);
    return {
      index: i,
      site: prof.site,
      country: prof.country,
      target: profitTargets[prof.country] || profitTargets[currentCountry],
      url: prof.url,
      active: i === activePaneIndex,
    };
  })
);

// ─── IPC: focus & editable-state management ────────────────────────────────

ipcMain.on('view:focus', (e) => {
  if (suppressFocusRelay) return;
  const idx = views.findIndex((vw) => vw.webContents.id === e.sender.id);
  if (idx >= 0) {
    const v = views[idx];
    if (v && !v.webContents.isDestroyed()) v.webContents.focus();
    if (activePaneIndex !== idx) {
      activePaneIndex = idx;
      sendPaneStates();
    }
  }
});

ipcMain.on('view:typing-focus', (e, isEditable) => {
  viewEditableFocus.set(e.sender.id, !!isEditable);
});

// ─── IPC: automated account login ──────────────────────────────────────────

let isLoggingIn = 0; // >0 only while account auto-login runs

async function performLogin(v, phone, password, paneIndex = -1) {
  if (!viewReady(v)) return { ok: false, reason: 'Window not ready' };
  isLoggingIn++;
  try {
    const idx = paneIndex >= 0 ? paneIndex : views.indexOf(v);
    const prof = getPaneProfile(idx >= 0 ? idx : 0);
    const country = prof.country || 'ng';
    const site = prof.site || 'sportybet';

    // 1. Strict logged-in check: ONLY logged in if real account balance is visible AND no login button is displayed
    const checkState = await v.webContents.executeJavaScript(`(() => {
      const isVis = (el) => {
        if (!el) return false;
        const st = window.getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') return false;
        return (el.offsetWidth > 0 && el.offsetHeight > 0) || window.innerWidth <= 1;
      };
      const balanceEl = Array.from(document.querySelectorAll(
        '.m-balance-val, .m-balance-num, [data-op="header-balance"], .header-balance, .af-balance, .balance-num, [data-op="user-balance"]'
      )).find(isVis);
      const hasLoginNot = Array.from(document.querySelectorAll('.m-login-not, [data-op="nav-login"], .m-btn-login')).some(isVis);
      const phoneInp = !!Array.from(document.querySelectorAll('input[type="tel"], input[name="phone"], input[placeholder*="Mobile" i], input[placeholder*="Phone" i]')).find(isVis);
      const passInp = !!Array.from(document.querySelectorAll('input[type="password"], input[name="password"]')).find(isVis);
      const isLoginReady = phoneInp && passInp;
      const isLoggedIn = !!balanceEl && !hasLoginNot && !isLoginReady;
      return { isLoggedIn, isLoginReady, hash: location.hash || '', url: location.href || '' };
    })()`).catch(() => ({ isLoggedIn: false, isLoginReady: false, hash: '', url: '' }));

    if (checkState.isLoggedIn) {
      console.log(`[AutoLogin] Pane ${idx + 1}: Already logged in.`);
      return { ok: true, alreadyLoggedIn: true, reason: 'Already logged in' };
    }

    // 2. If login inputs not ready, ensure on mobile site and trigger login dialog/page
    if (!checkState.isLoginReady) {
      const curUrl = checkState.url || '';
      if (site === 'sportybet') {
        const homeUrl = `https://www.sportybet.com/${country}/m/`;
        const isHome = curUrl === homeUrl || curUrl === `https://www.sportybet.com/${country}/m` || curUrl.startsWith(`${homeUrl}#`);
        if (!isHome) {
          console.log(`[AutoLogin] Pane ${idx + 1}: Navigating to login home: ${homeUrl}`);
          await v.webContents.loadURL(homeUrl).catch(() => { });
          await sleep(2000);
        }
        // Force-open the SportyBet login dialog:
        await v.webContents.executeJavaScript(`(() => {
          if (typeof window.login !== 'undefined' && typeof window.login.showType === 'function') {
            try { window.login.showType('login'); } catch (_) {}
          } else if (typeof window.login !== 'undefined' && typeof window.login.show === 'function') {
            try { window.login.show(); } catch (_) {}
          }
          try { location.hash = '#login'; } catch (_) {}
          const btn = document.querySelector('[data-op="nav-login"], .m-btn-login, .m-btn--login, [data-cms-key="login"]');
          if (btn) try { btn.click(); } catch (_) {}
        })()`).catch(() => { });
        await sleep(500);
      } else {
        const loginUrl = `https://www.football.com/${country}/m/login`;
        if (!curUrl.includes('login')) {
          console.log(`[AutoLogin] Pane ${idx + 1}: Loading login page: ${loginUrl}`);
          await v.webContents.loadURL(loginUrl).catch(() => { });
          await sleep(2000);
        }
      }
    }

    const loginRes = await v.webContents.executeJavaScript(loginCode(phone, password));
    console.log(`[AutoLogin] Pane ${idx + 1} result:`, loginRes);
    return loginRes;
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    isLoggingIn--;
  }
}

ipcMain.handle('ui:login-account', async (_e, { windowIndex, phone, password }) => {
  const v = views[windowIndex];
  if (!v) return { ok: false, reason: 'Window not found' };
  return performLogin(v, phone, password, windowIndex);
});

ipcMain.handle('ui:login-all', async (_e, accounts) => {
  // Concurrently auto-login across all panes simultaneously
  const promises = accounts.map(async (acc, i) => {
    const v = views[i];
    if (!v || !acc || !acc.phone || !acc.password) {
      return { ok: false, reason: 'Empty' };
    }
    return await performLogin(v, acc.phone, acc.password, i);
  });
  return await Promise.all(promises);
});

// ─── Target profit engine ───────────────────────────────────────────────────

function stakeFor(target, odds, whole) {
  if (!(odds > 1) || !(target > 0)) return null;
  const factor = whole ? 1 : 100;
  const s = Math.floor((target / (odds - 1)) * factor + 1e-9) / factor;
  return s > 0 ? s : null;
}

const READ_BALANCE_JS = `(() => {
  const isVis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  };
  const balanceEl = Array.from(document.querySelectorAll(
    '.m-balance-val, .m-balance-num, [data-op="header-balance"], .header-balance, .af-balance, .balance-num, [data-op="user-balance"], .balance, [data-op="account-balance"]'
  )).find(isVis);
  if (!balanceEl) return null;
  const raw = String(balanceEl.textContent || balanceEl.innerText || '').replace(/,/g, '');
  const m = raw.match(/\\d+(\\.\\d+)?/);
  return m ? parseFloat(m[0]) : null;
})()`;

async function readAccountBalance(v) {
  if (!viewReady(v)) return null;
  return await v.webContents.executeJavaScript(READ_BALANCE_JS).catch(() => null);
}

function stakesMatch(curVal, targetText) {
  if (curVal === null || curVal === undefined) return false;
  const cleaned = String(curVal).replace(/,/g, '').trim();
  if (!cleaned) return false;
  const curNum = parseFloat(cleaned);
  const targetStr = String(targetText || '').replace(/,/g, '').trim();
  const targetNum = parseFloat(targetStr);
  if (isNaN(curNum) || isNaN(targetNum) || targetNum <= 0) return false;
  const hasDecimal = cleaned.includes('.') || targetStr.includes('.');
  const tol = hasDecimal ? 0.004 : 0.5;
  return Math.abs(curNum - targetNum) < tol;
}

async function readStakeState(v, stakeSel) {
  if (!viewReady(v)) return { kind: 'none', curVal: '', kbOpen: false };
  return await v.webContents.executeJavaScript(`
    (() => {
      const isVis = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      let el = null;
      const sel = ${JSON.stringify(stakeSel || '')};
      if (sel) { try { el = document.querySelector(sel); } catch (_) {} }
      if (!el) el = (${FIND_STAKE_INPUT_JS});
      if (!el) return { kind: 'none', curVal: '', kbOpen: false };

      const inp = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
        ? el
        : el.querySelector('input:not([type="hidden"]), textarea');
      if (inp && isVis(inp)) {
        return { kind: 'input', curVal: String(inp.value || '').trim(), kbOpen: false };
      }

      const innerKbInp = el.matches('[data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i]')
        ? el
        : el.querySelector('[data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i]');
      if (innerKbInp && isVis(innerKbInp)) el = innerKbInp;

      const isPlaceholder = el.classList && el.classList.contains('m-input--placeholder');
      let raw = String(el.textContent || '').trim();

      // Verify with Vue 3 reactive model if present (prevent stale DOM-only reads)
      let cur = el;
      while (cur && cur !== document.documentElement) {
        const comp = cur.__vueParentComponent || cur.__vnode?.component || cur._vnode?.component;
        if (comp) {
          const proxy = comp.proxy || comp.ctx || comp.setupState;
          if (proxy && proxy.singleStake && proxy.bet && proxy.bet.key) {
            const vState = String(proxy.singleStake[proxy.bet.key] || '').trim();
            if (vState !== undefined && vState !== '') {
              raw = vState;
              break;
            }
          }
        }
        cur = cur.parentElement;
      }

      const curVal = (isPlaceholder || /^min\\.?\\s*\\d/i.test(raw) || /^stake$/i.test(raw) || /^enter/i.test(raw)) ? '' : raw;
      const kb = Array.from(document.querySelectorAll(${JSON.stringify(KEYBOARD_CONTAINER_SELECTOR)})).find(isVis);
      return { kind: 'keyboard', curVal, kbOpen: !!kb };
    })()
  `).catch(() => ({ kind: 'none', curVal: '', kbOpen: false }));
}

async function sendTrustedKey(v, keyCode, withChar = false) {
  if (!viewReady(v)) return;
  v.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  if (withChar) v.webContents.sendInputEvent({ type: 'char', keyCode });
  v.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  await sleep(10);
}

async function clickKeypadSequence(v, stakeSel, val, clearCount) {
  if (!viewReady(v)) return false;
  const info = await v.webContents.executeJavaScript(`
    (async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const isVis = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      let el = null;
      const sel = ${JSON.stringify(stakeSel || '')};
      if (sel) { try { el = document.querySelector(sel); } catch (_) {} }
      if (!el) el = (${FIND_STAKE_INPUT_JS});
      if (!el) return null;
      const innerKbInp = el.matches('[data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i]')
        ? el
        : el.querySelector('[data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i]');
      if (innerKbInp && isVis(innerKbInp)) el = innerKbInp;

      const findKb = () => Array.from(document.querySelectorAll(${JSON.stringify(KEYBOARD_CONTAINER_SELECTOR)})).find(isVis);

      let kb = findKb();
      if (!kb) {
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); el.click(); } catch (_) {}
        for (let t = 0; t < 14; t++) {
          await wait(50);
          kb = findKb();
          if (kb) break;
        }
      }
      if (!kb) return null;

      try { kb.scrollIntoView({ block: 'end', inline: 'nearest' }); } catch (_) {}
      // Wait for CSS slide-up transition so keypad keys settle
      for (let t = 0; t < 8; t++) {
        const r = kb.getBoundingClientRect();
        if (r.height > 40 && r.top >= 0 && r.bottom <= window.innerHeight + 4) break;
        await wait(45);
      }

      const kbR = kb.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const toPt = (node) => {
        if (!isVis(node)) return null;
        const r = node.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        if (x < kbR.left || x > kbR.right || y < kbR.top || y > kbR.bottom) return null;
        const inVp = x >= 0 && x < vw && y >= 0 && y < vh;
        const hit = inVp ? document.elementFromPoint(x, y) : null;
        const canPointerClick = Boolean(inVp && hit && (node.contains(hit) || hit.contains(node) || kb.contains(hit)));
        return { x, y, inVp: canPointerClick };
      };

      const keys = {};
      // SportyBet [data-key] keypad buttons
      kb.querySelectorAll('[data-key]').forEach((node) => {
        const dk = node.getAttribute('data-key');
        const pt = toPt(node);
        // Overwrite so actual digit keypad buttons override any top preset pill with the same data-key (e.g. 3, 5, 10, 100)
        if (dk && pt) keys[dk] = pt;
      });

      // Football.com .stake-keyboard [data-op] buttons
      const clearOp = kb.querySelector('[data-op="clearAll"]');
      if (clearOp) {
        const pt = toPt(clearOp);
        if (pt) keys.clear = pt;
      }
      const delOp = kb.querySelector('[data-op="removeLast"]');
      if (delOp) {
        const pt = toPt(delOp);
        if (pt) keys.delete = pt;
      }
      kb.querySelectorAll('[data-op="appendKey"]').forEach((node) => {
        const t = (node.textContent || '').trim();
        if (t.length === 1 && '0123456789.'.includes(t)) {
          const pt = toPt(node);
          if (pt) keys[t] = pt;
        }
      });

      // Text/icon fallbacks strictly inside this keypad container if data-key/data-op is absent
      if (!keys.delete) {
        const delNode = Array.from(kb.querySelectorAll('span, div, button')).find((n) => {
          const dk = (n.getAttribute('data-key') || '').toLowerCase();
          const c = String(n.className || '').toLowerCase();
          const t = (n.textContent || '').trim().toLowerCase();
          return dk === 'delete' || dk === 'del' || c.includes('delete') || c.includes('backspace')
            || t === 'del' || t === '⌫' || t === '←';
        });
        const pt = toPt(delNode);
        if (pt) keys.delete = pt;
      }
      for (const ch of '0123456789.') {
        if (keys[ch]) continue;
        const chNode = Array.from(kb.querySelectorAll('span, div, button')).find((n) =>
          n.children.length === 0 && (n.textContent || '').trim() === ch
        );
        const pt = toPt(chNode);
        if (pt) keys[ch] = pt;
      }
      return keys;
    })()
  `).catch(() => null);

  if (!info) return false;
  const tap = async (pt, keyName) => {
    if (!pt || !viewReady(v)) return;
    if (pt.inVp) {
      v.webContents.sendInputEvent({ type: 'mouseDown', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      v.webContents.sendInputEvent({ type: 'mouseUp', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await sleep(18);
      return;
    }
    // Viewport-clipped keypad fallback (e.g., short grid pane height): click inside DOM
    await v.webContents.executeJavaScript(`(() => {
      const kbs = Array.from(document.querySelectorAll(${JSON.stringify(KEYBOARD_CONTAINER_SELECTOR)}));
      const kb = kbs.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (!kb) return false;
      const k = ${JSON.stringify(keyName)};
      let btn = null;
      if (k === 'clear') {
        btn = kb.querySelector('[data-op="clearAll"], [data-key="clear"]');
      } else if (k === 'delete') {
        btn = kb.querySelector('[data-op="removeLast"], [data-key="delete"], [data-key="del"]');
      } else {
        btn = Array.from(kb.querySelectorAll('[data-key]')).reverse().find(n => n.getAttribute('data-key') === k)
          || Array.from(kb.querySelectorAll('[data-op="appendKey"]')).find(n => (n.textContent || '').trim() === k)
          || Array.from(kb.querySelectorAll('span, div, button')).find(n => n.children.length === 0 && (n.textContent || '').trim() === k);
      }
      if (btn) { btn.click(); return true; }
      return false;
    })()`).catch(() => false);
    await sleep(18);
  };

  if (info.clear) {
    await tap(info.clear, 'clear');
    await sleep(25);
  } else if (info.delete) {
    for (let i = 0; i < clearCount; i++) await tap(info.delete, 'delete');
    await sleep(25);
  }
  for (const ch of val) {
    if (!info[ch]) return false;
    await tap(info[ch], ch);
  }
  await sleep(50);
  return true;
}

async function closeKeypadInView(v) {
  if (!viewReady(v)) return;
  const donePt = await v.webContents.executeJavaScript(`
    (() => {
      try {
        const isVis = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const kb = Array.from(document.querySelectorAll(${JSON.stringify(KEYBOARD_CONTAINER_SELECTOR)})).find(isVis);
        if (kb) {
          const done = kb.querySelector('[data-key="done"], [data-op="done-bottom"], [data-key="ok"], [data-key="hide"], .m-keyboard-hide, .m-keyboard-done, [class*="hide" i], [class*="done" i], [class*="close" i]');
          if (done && isVis(done)) {
            const kbR = kb.getBoundingClientRect();
            const r = done.getBoundingClientRect();
            const x = Math.round(r.left + r.width / 2);
            const y = Math.round(r.top + r.height / 2);
            if (x >= kbR.left && x <= kbR.right && y >= kbR.top && y <= kbR.bottom && x >= 0 && x < window.innerWidth && y >= 0 && y < window.innerHeight) {
              return { x, y };
            }
            done.click();
            return null;
          }
          if (typeof kb.blur === 'function') kb.blur();
        }
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        try { document.querySelector('.m-bet-slip-title, .m-betslip-header')?.click(); } catch (_) {}
      } catch (_) {}
      return null;
    })()
  `).catch(() => null);
  if (donePt && viewReady(v)) {
    v.webContents.sendInputEvent({ type: 'mouseDown', x: donePt.x, y: donePt.y, button: 'left', clickCount: 1 });
    v.webContents.sendInputEvent({ type: 'mouseUp', x: donePt.x, y: donePt.y, button: 'left', clickCount: 1 });
    await sleep(35);
    await v.webContents.executeJavaScript(`
      (() => {
        const kb = Array.from(document.querySelectorAll(${JSON.stringify(KEYBOARD_CONTAINER_SELECTOR)})).find(el => {
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        });
        if (kb) {
          try { kb.querySelector('[data-key="done"], [data-op="done-bottom"]')?.click(); } catch (_) {}
          try { kb.blur(); } catch (_) {}
        }
      })()
    `).catch(() => { });
  }
  await sleep(75);
}

async function setStakeInView(v, stakeSel, text) {
  if (!viewReady(v)) return false;
  const val = String(text);
  // Fast path: direct zero-delay DOM/Vue injection without manual keypad delays
  const fastOk = await v.webContents.executeJavaScript(FAST_SET_STAKE_JS(val)).catch(() => false);
  if (fastOk) return true;

  // Never fall back to focus/clicks/keypad while Confirm is open, because clicking
  // the stake box, opening/closing the keypad, or clicking the betslip header drops Confirm.
  const confirmOpen = await v.webContents.executeJavaScript(IS_CONFIRM_OPEN_JS).catch(() => false);
  if (confirmOpen) return false;

  try {
    v.webContents.send('set-suppress-capture', true);
    await sleep(25);

    let state = await readStakeState(v, stakeSel);
    if (state.kind === 'none') {
      await sleep(170);
      state = await readStakeState(v, stakeSel);
    }
    if (state.kind === 'none') return false;
    if (stakesMatch(state.curVal, val)) return true;

    if (state.kind === 'input') {
      // Standard <input>/<textarea>: native value setter first, trusted keystrokes if framework ignores it
      await v.webContents.executeJavaScript(`
        (() => {
          let el = null;
          const sel = ${JSON.stringify(stakeSel || '')};
          if (sel) { try { el = document.querySelector(sel); } catch (_) {} }
          if (!el) el = (${FIND_STAKE_INPUT_JS});
          if (!el) return false;
          const inp = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
            ? el
            : el.querySelector('input:not([type="hidden"]), textarea');
          if (!inp) return false;
          if (inp.readOnly) try { inp.removeAttribute('readonly'); } catch (_) {}
          try { inp.focus(); } catch (_) {}
          const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          if (desc && desc.set) desc.set.call(inp, ${JSON.stringify(val)});
          else inp.value = ${JSON.stringify(val)};
          inp.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ${JSON.stringify(val)} }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()
      `).catch(() => false);
      await sleep(45);
      let after = await readStakeState(v, stakeSel);
      if (stakesMatch(after.curVal, val)) return true;

      try { v.webContents.focus(); } catch (_) { }
      await v.webContents.executeJavaScript(`
        (() => {
          let el = null;
          const sel = ${JSON.stringify(stakeSel || '')};
          if (sel) { try { el = document.querySelector(sel); } catch (_) {} }
          if (!el) el = (${FIND_STAKE_INPUT_JS});
          const inp = el && ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
            ? el
            : el.querySelector('input:not([type="hidden"]), textarea'));
          if (!inp) return false;
          inp.focus();
          try { inp.select(); } catch (_) {}
          return true;
        })()
      `).catch(() => false);
      for (let i = 0; i < 12; i++) await sendTrustedKey(v, 'Backspace', false);
      for (const ch of val) await sendTrustedKey(v, ch, true);
      await sleep(45);
      after = await readStakeState(v, stakeSel);
      return stakesMatch(after.curVal, val);
    }

    // Mobile custom keypad element (SportyBet span.m-keybord-input + div.m-keyboard OR Football.com betslip-keyboard-trigger + div.stake-keyboard)
    // Two attempts handle first-blur default-stake reset (e.g. NG resetting min placeholder -> 100).
    const wasKbOpen = !!state.kbOpen;
    let after = state;

    for (let attempt = 0; attempt < 2; attempt++) {
      const clearCount = Math.min(14, Math.max((after.curVal || '').length + 4, 8));

      try { v.webContents.focus(); } catch (_) { }
      await sleep(45);

      const kbPrep = await v.webContents.executeJavaScript(`
        (async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const isVis = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const st = window.getComputedStyle(el);
            return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
          };
          let el = null;
          const sel = ${JSON.stringify(stakeSel || '')};
          if (sel) { try { el = document.querySelector(sel); } catch (_) {} }
          if (!el) el = (${FIND_STAKE_INPUT_JS});
          if (!el) return { kbOpen: false, hasFocus: false, isStakeKeyboard: false };
          const innerKbInp = el.matches('[data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i]')
            ? el
            : el.querySelector('[data-op="betslip-keyboard-trigger"], [class*="keybord-input" i], [class*="keyboard-input" i]');
          if (innerKbInp && isVis(innerKbInp)) el = innerKbInp;

          const findKb = () => Array.from(document.querySelectorAll(${JSON.stringify(KEYBOARD_CONTAINER_SELECTOR)})).find(isVis);

          let kb = findKb();
          if (!kb) {
            try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); el.click(); } catch (_) {}
            await wait(160);
            kb = findKb();
          }
          if (kb) {
            try { kb.focus({ preventScroll: true }); } catch (_) {}
          }
          return {
            kbOpen: !!kb,
            hasFocus: document.hasFocus(),
            isStakeKeyboard: !!(kb && kb.matches('.stake-keyboard, [data-op="stake-keyboard"]')),
          };
        })()
      `).catch(() => ({ kbOpen: false, hasFocus: false, isStakeKeyboard: false }));

      if (kbPrep.kbOpen && kbPrep.hasFocus && !kbPrep.isStakeKeyboard) {
        await sleep(20);
        for (let i = 0; i < clearCount; i++) await sendTrustedKey(v, 'Backspace', false);
        await sleep(20);
        for (const ch of val) await sendTrustedKey(v, ch, true);
        await sleep(50);
      }

      after = await readStakeState(v, stakeSel);
      if (!stakesMatch(after.curVal, val)) {
        const clicked = await clickKeypadSequence(v, stakeSel, val, clearCount);
        if (clicked) after = await readStakeState(v, stakeSel);
      }

      if (stakesMatch(after.curVal, val)) {
        await closeKeypadInView(v);
        after = await readStakeState(v, stakeSel);
      }

      if (stakesMatch(after.curVal, val)) return true;
    }

    return stakesMatch(after.curVal, val);
  } finally {
    try { v.webContents.send('set-suppress-capture', false); } catch (_) { }
  }
}

const lastApplied = new Map();
const lastFailed = new Map(); // Map<webContentsId, Map<key, number>>
const lastStakeByView = new Map(); // Map<webContentsId, number>
let applying = false;
let pendingApply = null; // { onlyChanged: boolean } | null
let applyTimer = null;
let followUpTimer = null;
let currentProfitConfig = null;
let rebetInFlight = 0;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function formatStakeStr(n) {
  return Number(round2(n).toFixed(2)).toString();
}

function parsePositiveStake(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return (!isNaN(num) && num > 0) ? round2(num) : null;
}

async function applyStakesToViews(cfg, { onlyChanged = false, useMinStake = false } = {}) {
  const leadView = views[activePaneIndex] || views[0];
  const winFocused = !!(win && !win.isDestroyed() && win.isFocused());
  suppressFocusRelay = true;
  const out = new Array(views.length);

  try {
    const tasks = views.map(async (v, i) => {
      if (!viewReady(v)) return { idx: i, row: { odds: null, stake: null }, touched: null };

      const prof = getPaneProfile(i);
      const country = prof.country;
      const site = prof.site;
      const effectiveTarget = profitTargets[country] || profitTargets[currentCountry];

      const odds = await v.webContents.executeJavaScript(oddsReadCode(cfg.oddsSel || '')).catch(() => null);
      let text = null;
      if (useMinStake) {
        text = minStakeForProfile(site, country);
      } else {
        const stake = stakeFor(effectiveTarget, odds, cfg.whole);
        if (stake === null) {
          return { idx: i, row: { odds, stake: null, site, country, target: effectiveTarget }, touched: null };
        }
        let effectiveStake = stake;
        if (balanceAwareStake) {
          const balance = await readAccountBalance(v);
          if (balance !== null && balance > 0 && stake > balance) {
            effectiveStake = cfg.whole ? Math.floor(balance) : Math.floor(balance * 100) / 100;
            console.log(`[QuestSync BalanceCap] Pane ${i + 1}: Required stake (${stake}) > Balance (${balance}). Using full balance: ${effectiveStake}`);
          }
        }
        text = cfg.whole ? String(effectiveStake) : effectiveStake.toFixed(2);
      }

      const key = `${site}|${useMinStake ? 'min' : effectiveTarget}|${odds}|${text}`;

      let failMap = lastFailed.get(v.webContents.id);
      if (!failMap) { failMap = new Map(); lastFailed.set(v.webContents.id, failMap); }
      const failCount = failMap.get(key) || 0;

      // Even when onlyChanged=true, verify live DOM field hasn't been wiped empty by slip refresh
      if (onlyChanged && lastApplied.get(v.webContents.id) === key) {
        const curField = await v.webContents.executeJavaScript(readFieldCode(cfg.stakeSel || '')).catch(() => null);
        if (stakesMatch(curField, text)) {
          const n = parsePositiveStake(curField) || parsePositiveStake(text);
          if (n) lastStakeByView.set(v.webContents.id, n);
          return { idx: i, row: { odds, stake: text, ok: true, site, country, target: effectiveTarget }, touched: null };
        }
      }
      if (onlyChanged && failCount >= 4) {
        return { idx: i, row: { odds, stake: text, ok: false, site, country, target: effectiveTarget }, touched: null };
      }

      let ok = await setStakeInView(v, cfg.stakeSel || '', text);

      if (ok) {
        const verify = await v.webContents.executeJavaScript(readFieldCode(cfg.stakeSel || '')).catch(() => null);
        if (!stakesMatch(verify, text)) ok = false;
      }

      let touchedItem = null;
      if (ok) {
        lastApplied.set(v.webContents.id, key);
        const n = parsePositiveStake(text);
        if (n) lastStakeByView.set(v.webContents.id, n);
        failMap.delete(key);
        touchedItem = { i, v, text, key, failMap, failCount, site, country, effectiveTarget, odds };
      } else {
        failMap.set(key, failCount + 1);
      }

      return {
        idx: i,
        row: { odds, stake: text, ok, site, country, target: effectiveTarget },
        touched: touchedItem,
      };
    });

    const results = await Promise.all(tasks);
    const touched = [];
    for (const res of results) {
      out[res.idx] = res.row;
      if (res.touched) touched.push(res.touched);
    }

    // Parallel audit after settle
    if (touched.length > 0) {
      await sleep(100);
      await Promise.all(
        touched.map(async (item) => {
          if (!viewReady(item.v)) return;
          const curField = await item.v.webContents.executeJavaScript(readFieldCode(cfg.stakeSel || '')).catch(() => null);
          if (stakesMatch(curField, item.text)) return;
          const retryOk = await setStakeInView(item.v, cfg.stakeSel || '', item.text);
          if (!retryOk) {
            lastApplied.delete(item.v.webContents.id);
            item.failMap.set(item.key, item.failCount + 1);
            out[item.i] = { odds: item.odds, stake: item.text, ok: false, site: item.site, country: item.country, target: item.effectiveTarget };
          }
        })
      );
    }
  } finally {
    suppressFocusRelay = false;
    if (winFocused && leadView && viewReady(leadView)) {
      try { leadView.webContents.focus(); } catch (_) { }
    }
  }
  return out;
}

function applyProfit(cfg, onlyChanged) {
  return applyStakesToViews(cfg, { onlyChanged, useMinStake: false });
}

function applyMinStake(cfg) {
  return applyStakesToViews(cfg, { onlyChanged: false, useMinStake: true });
}

async function runApplyQueue(onlyChanged) {
  if (!currentProfitConfig) return;
  if (applying) {
    pendingApply = { onlyChanged: pendingApply ? (pendingApply.onlyChanged && onlyChanged) : onlyChanged };
    return;
  }
  applying = true;
  try {
    const res = await withTimeout(applyProfit(currentProfitConfig, onlyChanged), 15000, null);
    if (res && win && !win.isDestroyed()) win.webContents.send('profit-status', res);
  } finally {
    applying = false;
    if (pendingApply) {
      const next = pendingApply;
      pendingApply = null;
      setImmediate(() => runApplyQueue(next.onlyChanged));
    }
  }
}

function scheduleApply(delayMs, onlyChanged) {
  if (!currentProfitConfig || rebetInFlight > 0) return;
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    if (rebetInFlight > 0) return;
    runApplyQueue(onlyChanged);
  }, delayMs);
}

async function runExclusiveStakeBatch(nextProfitConfig, worker) {
  currentProfitConfig = nextProfitConfig;
  lastApplied.clear();
  lastFailed.clear();
  clearTimeout(applyTimer);
  clearTimeout(followUpTimer);
  pendingApply = null;
  while (applying) await sleep(30);
  applying = true;
  try {
    const res = await withTimeout(worker(), 30000, []);
    if (res && win && !win.isDestroyed()) win.webContents.send('profit-status', res);
    return res;
  } finally {
    applying = false;
    if (pendingApply) {
      const next = pendingApply;
      pendingApply = null;
      setImmediate(() => runApplyQueue(next.onlyChanged));
    }
  }
}

ipcMain.handle('ui:apply-profit', (_e, cfg) =>
  runExclusiveStakeBatch(cfg, () => applyProfit(cfg || {}, false))
);

ipcMain.handle('ui:apply-min-stake', (_e, cfg) =>
  runExclusiveStakeBatch(null, () => applyMinStake(cfg || {}))
);

ipcMain.handle('ui:profit-auto', (_e, cfg) => {
  currentProfitConfig = cfg || null;
  lastFailed.clear();
  if (currentProfitConfig) scheduleApply(150, true);
  return true;
});

ipcMain.handle('ui:set-targets', (_e, targets) => {
  if (targets) {
    const gh = parseFloat(targets.gh);
    const ng = parseFloat(targets.ng);
    if (gh > 0) profitTargets.gh = gh;
    if (ng > 0) profitTargets.ng = ng;
    saveUserSettings();
  }
  lastApplied.clear();
  lastFailed.clear();
  sendPaneStates();
  if (currentProfitConfig) scheduleApply(80, false);
  return { ...profitTargets };
});

ipcMain.handle('ui:get-targets', () => ({ ...profitTargets }));

// Passive betslip DOM observer notification from view-preload.js
ipcMain.on('betslip-changed', () => {
  if (!currentProfitConfig || rebetInFlight > 0) return;
  scheduleApply(120, true);
});

ipcMain.on('view:stake-seen', (e, rawStake) => {
  const num = parsePositiveStake(rawStake);
  if (num) {
    lastStakeByView.set(e.sender.id, num);
    const idx = views.findIndex((v) => v.webContents.id === e.sender.id);
    if (idx >= 0) {
      const prof = getPaneProfile(idx);
      const isGh = prof.country === 'gh';
      const minStakeNum = parseFloat(minStakeForProfile(prof.site, prof.country)) || (isGh ? 0.1 : 10);
      const nextStake = calculateRebetDecrement(num, isGh, minStakeNum);
      preparedRebetStakes.set(e.sender.id, nextStake);
    }
  }
  // Snapshot sibling panes too before mirrored Place Bet closes their slips
  views.forEach((v, i) => {
    if (!viewReady(v) || v.webContents.id === e.sender.id) return;
    v.webContents.executeJavaScript(readFieldCode('')).then((raw) => {
      const siblingNum = parsePositiveStake(raw);
      if (siblingNum) {
        lastStakeByView.set(v.webContents.id, siblingNum);
        const prof = getPaneProfile(i);
        const isGh = prof.country === 'gh';
        const minStakeNum = parseFloat(minStakeForProfile(prof.site, prof.country)) || (isGh ? 0.1 : 10);
        const nextStake = calculateRebetDecrement(siblingNum, isGh, minStakeNum);
        preparedRebetStakes.set(v.webContents.id, nextStake);
      }
    }).catch(() => { });
  });
});

function calculateRebetDecrement(curNum, isGh, minStakeNum) {
  if (!curNum || curNum <= 0) return minStakeNum;
  if (isGh) {
    const step = rebetConfig.decrementGH || 1.0;
    return Math.max(minStakeNum, round2(curNum - step));
  } else {
    const step = rebetConfig.decrementNG || 10;
    if (rebetConfig.mode === 'tiered') {
      if (curNum <= 100) return Math.max(minStakeNum, Math.round(curNum - step));
      return Math.max(minStakeNum, Math.round(curNum - Math.max(step * 10, 100)));
    }
    return Math.max(minStakeNum, Math.round(curNum - step));
  }
}

let currentSharedStake = null;

ipcMain.on('view:stake-sync', (e, payload) => {
  const val = payload && payload.value ? String(payload.value).trim() : null;
  if (!val || val === currentSharedStake) return;
  currentSharedStake = val;

  const senderId = e.sender.id;
  // Concurrently inject this updated stake into all follower views INSTANTLY without manual keypad delays!
  views.forEach((v) => {
    if (!v || v.webContents.isDestroyed() || v.webContents.id === senderId) return;
    v.webContents.executeJavaScript(FAST_SET_STAKE_JS(val)).catch(() => { });
  });

  // Pre-calculate decremented rebet stake based on this typed value
  const num = parsePositiveStake(val);
  if (num) {
    views.forEach((v, i) => {
      if (!v || v.webContents.isDestroyed()) return;
      const prof = getPaneProfile(i);
      const isGh = prof.country === 'gh';
      const minStakeNum = parseFloat(minStakeForProfile(prof.site, prof.country)) || (isGh ? 0.1 : 10);
      const nextRebet = calculateRebetDecrement(num, isGh, minStakeNum);
      preparedRebetStakes.set(v.webContents.id, nextRebet);
    });
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('stake-synced', val);
    win.webContents.send('acc-status', { msg: `Stake synced across panes: ${val}` });
  }
});

ipcMain.on('view:slip-cleared', (e) => {
  lastStakeByView.delete(e.sender.id);
  preparedRebetStakes.delete(e.sender.id);
});

// ─── Mirror relay ───────────────────────────────────────────────────────────
// The pane you interact with is the lead; actions replay cleanly in the others.
// Replay is handled strictly in view-preload via DOM events to prevent echo loops
// and avoid duplicate clicks. Follows your mouse clicks strictly.

ipcMain.on('mirror-event', (e, payload) => {
  if (!options.mirror) return;
  if (payload.type === 'input' && !options.typing) return;

  // Form inputs (phone/password/search) → don't mirror so other panes don't steal focus
  if (payload.type === 'click' && payload.isFormInput && !payload.isStakeField) return;

  // SAFETY: Never mirror bet placement or confirmation across panes!
  // Bet placement is strictly managed across all panes by main process hotkey/UI triggers.
  const isPlaceOrConfirm = /place[-]?bet|confirm-to-pay|betslip-placebet|betslip-confirm|single-placebet/i.test(
    `${payload.clickableSelector || ''} ${payload.selector || ''} ${payload.smartSelector || ''} ${payload.semantic?.action || ''}`
  );
  if (isPlaceOrConfirm) {
    console.log('[SAFETY] Suppressed mirrored bet-placement/confirm action from sender pane');
    return;
  }

  // Auto-Accept Odds: Suppress mirrored odds acceptance so each pane handles odds changes independently
  if (payload.semantic?.action === 'accept-odds' || payload.semantic?.action === 'accept-change') {
    return;
  }

  // Only suppress clicks on actual individual numeric keypad keys (0-9, clear, done, del)
  const isKeypadKey = (
    /appendkey|clearall|removelast|done-bottom|m-keyboard-key/i.test(payload.clickableSelector || '') ||
    /appendkey|clearall|removelast|done-bottom|m-keyboard-key/i.test(payload.selector || '')
  ) && !/remove-all|outcome/i.test(`${payload.clickableSelector || ''} ${payload.selector || ''} ${payload.semantic || ''}`);
  if (isKeypadKey) return;

  const senderIdx = views.findIndex((v) => v.webContents.id === e.sender.id);
  const senderView = senderIdx >= 0 ? views[senderIdx] : null;
  const srcSite = senderIdx >= 0 ? getPaneProfile(senderIdx).site : siteFromUrl(payload.url);
  const forwarded = { ...payload, srcSite };

  // Relay strictly to follower panes
  for (const v of views) {
    if (v.webContents.id === e.sender.id || v.webContents.isDestroyed()) continue;
    v.webContents.send('mirror-replay', forwarded);
  }

  // Keep mouse and keyboard focus strictly on the pane the user touched
  if (senderView && !senderView.webContents.isDestroyed()) {
    senderView.webContents.focus();
    if (activePaneIndex !== senderIdx) {
      activePaneIndex = senderIdx;
      sendPaneStates();
    }
  }

  // When user clicks an odd or match selection, update stake quickly + staggered recheck
  if (payload.type === 'click' && currentProfitConfig && !payload.isInsideModal && rebetInFlight === 0) {
    lastFailed.clear();
    lastApplied.clear();
    scheduleApply(260, false);
    clearTimeout(followUpTimer);
    followUpTimer = setTimeout(() => {
      if (currentProfitConfig) runApplyQueue(true);
    }, 950);
  }
});

// ─── Odds Benchmark Monitor (Docked WebContentsView or Floating Window) ──────

let defaultDesktopUA = null;

function emitMonitorState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('monitor-state', !!monitorConfig.open);
  win.webContents.send('monitor-config', { ...monitorConfig });
}

function getActiveMonitorWebContents() {
  if (monitorView && !monitorView.webContents.isDestroyed()) return monitorView.webContents;
  if (monitorWin && !monitorWin.isDestroyed() && !monitorWin.webContents.isDestroyed()) return monitorWin.webContents;
  return null;
}

function getMonitorTargetUrl(site = monitorConfig.site) {
  const s = site === 'betpawa' ? 'betpawa' : 'betano';
  const c = monitorConfig.country === 'gh' ? 'gh' : 'ng';
  return (MONITOR_URLS[s] && MONITOR_URLS[s][c]) || (s === 'betpawa' ? 'https://www.betpawa.ng/' : 'https://www.betano.ng/');
}

function getMonitorUrl() {
  const wc = getActiveMonitorWebContents();
  if (!wc) return getMonitorTargetUrl();
  try {
    const u = wc.getURL();
    return u && u !== 'about:blank' ? u : getMonitorTargetUrl();
  } catch (_) {
    return getMonitorTargetUrl();
  }
}

function applyMonitorUA(wc) {
  if (!wc || wc.isDestroyed()) return;
  if (!defaultDesktopUA) {
    try { defaultDesktopUA = wc.getUserAgent() || app.userAgentFallback; } catch (_) { }
  }
  wc.setUserAgent(monitorConfig.mobileUA ? MONITOR_MOBILE_UA : (defaultDesktopUA || app.userAgentFallback));
}

function adjustMonitorZoom(actionOrValue) {
  let next = monitorConfig.zoom;
  if (actionOrValue === 'in') next = Math.min(1.5, Math.round((next + 0.1) * 100) / 100);
  else if (actionOrValue === 'out') next = Math.max(0.5, Math.round((next - 0.1) * 100) / 100);
  else if (actionOrValue === 'reset') next = 0.65;
  else if (typeof actionOrValue === 'number' && !Number.isNaN(actionOrValue)) {
    next = Math.min(1.5, Math.max(0.5, Math.round(actionOrValue * 100) / 100));
  }
  monitorConfig.zoom = next;
  const wc = getActiveMonitorWebContents();
  if (wc) wc.setZoomFactor(next);
  emitMonitorState();
  saveUserSettings();
  return { ...monitorConfig };
}

function emitMonitorWatchStatus() {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('monitor-watch-status', {
      ...monitorWatchState,
      ...monitorListenerConfig,
    });
  } catch (_) {}
}

function pushMonitorWatchToView(wc) {
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send('monitor:watch-state', { armed: !!monitorWatchState.armed });
  } catch (_) {}
}

function setMonitorWatchArmed(armed, reason = '') {
  monitorWatchState.armed = !!armed;
  if (!monitorWatchState.armed) {
    monitorWatchState.prevScore = '';
  }
  if (reason) monitorWatchState.lastEvent = reason;
  pushMonitorWatchToView(getActiveMonitorWebContents());
  emitMonitorWatchStatus();
}

async function triggerBetanoGoalAction(transition, matchKey) {
  const action = monitorListenerConfig.goalBetAction || 'place_confirm';
  const sourceLabel = `Betano Goal (${transition.prev} -> ${transition.next} | ${matchKey})`;
  monitorWatchState.lastTriggerAt = Date.now();
  monitorWatchState.lastEvent = `Goal ${transition.prev} → ${transition.next} (${action})`;
  emitMonitorWatchStatus();

  if (autoRebetRunning || singleBetInFlight) {
    console.warn(`[BetanoWatch] Skipped trigger (${sourceLabel}): bet execution already in flight`);
    if (win && !win.isDestroyed()) {
      win.webContents.send('acc-status', { msg: `${sourceLabel}: Skipped (betting busy)` });
    }
    return;
  }

  console.log(`[SAFETY][BetTrigger] ${sourceLabel} | Action: ${action}`);
  if (win && !win.isDestroyed()) {
    win.webContents.send('acc-status', { msg: `⚽ ${sourceLabel} — triggering selected game bets...` });
  }

  if (action === 'place_only') {
    singleBetInFlight = true;
    emitAutoRebetState(`Goal Trigger: Placing bets (leaving Confirm)...`);
    try {
      const results = await Promise.all(
        views.map((v) => {
          if (!viewReady(v)) return Promise.resolve(null);
          return withTimeout(v.webContents.executeJavaScript(SINGLE_BET_PLACE_ONLY_JS), 3000, null).catch(() => null);
        })
      );
      const placedCount = results.filter((r) => r && r.placed).length;
      emitAutoRebetState(`Goal Trigger: Placed on ${placedCount}/${views.length} pane(s) (Confirm left for you)`);
    } finally {
      singleBetInFlight = false;
    }
    return;
  }

  if (action === 'rapid_attack') {
    const runCyc = autoRebetCycles === 'inf' ? 'inf' : Math.max(1, parseInt(autoRebetCycles, 10) || 1);
    await startAutoRebet(runCyc, sourceLabel);
    return;
  }

  // Default: 'place_confirm' — 1-Pass Place Bet -> Confirm on whatever selection is ready in each pane
  await startAutoRebet(1, sourceLabel);
}

async function triggerBetanoScoreDropCashout(transition, matchKey, rearmedCount) {
  const label = `Betano Score Drop (${transition.prev} → ${transition.next} | ${matchKey})`;
  monitorWatchState.lastEvent = `VAR Drop ${transition.prev} → ${transition.next}${monitorListenerConfig.autoCashoutOnDrop ? ' · Auto-Cashout' : ''}`;
  emitMonitorWatchStatus();

  console.log(`[BetanoWatch] ${label} | Re-armed ${rearmedCount} goal transition(s) for next goal`);

  if (!monitorListenerConfig.autoCashoutOnDrop) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('acc-status', { msg: `⚠ ${label} — goal lock cleared for next goal` });
    }
    return;
  }

  for (let w = 0; w < 20 && cashoutBusy; w++) {
    await sleep(100);
  }
  await triggerCashoutAll(`VAR Drop ${transition.prev} -> ${transition.next}`);
}

function attachMonitorInputHandlers(wc) {
  if (!wc || wc.isDestroyed()) return;
  wc.setMaxListeners(50);

  wc.setWindowOpenHandler(({ url }) => {
    if (url && !wc.isDestroyed()) wc.loadURL(url).catch(() => { });
    return { action: 'deny' };
  });

  wc.on('dom-ready', () => {
    if (!wc.isDestroyed()) {
      wc.setZoomFactor(monitorConfig.zoom);
      pushMonitorWatchToView(wc);
    }
  });

  wc.on('did-finish-load', () => {
    if (!wc.isDestroyed()) {
      wc.setZoomFactor(monitorConfig.zoom);
      pushMonitorWatchToView(wc);
    }
  });

  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || wc.isDestroyed()) return;
    const k = input.key.toLowerCase();
    if (input.control) {
      if (k === 'r') { wc.reload(); event.preventDefault(); }
      else if (input.shift && k === 'i') { wc.toggleDevTools(); event.preventDefault(); }
      else if (k === '-') { adjustMonitorZoom('out'); event.preventDefault(); }
      else if (k === '=' || k === '+') { adjustMonitorZoom('in'); event.preventDefault(); }
      else if (k === '0') { adjustMonitorZoom('reset'); event.preventDefault(); }
      return;
    }
    if (input.alt && input.key === 'ArrowLeft') {
      if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
      event.preventDefault();
    } else if (hotkeysEnabled && ((input.alt && k === 'c') || input.key === 'F9')) {
      event.preventDefault();
      if (!input.isAutoRepeat) triggerCashoutAll(input.alt ? 'Alt+C' : 'F9');
    }
  });

  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    if (win && !win.isDestroyed()) win.webContents.send('load-error', `${monitorConfig.site} monitor failed: ${desc} (${code}) ${url}`);
  });
}

function destroyMonitorView() {
  const v = monitorView;
  monitorView = null;
  if (!v) return;
  try { if (win && !win.isDestroyed()) win.contentView.removeChildView(v); } catch (_) { }
  try { if (!v.webContents.isDestroyed()) v.webContents.close(); } catch (_) { }
}

function destroyMonitorWin() {
  const w = monitorWin;
  monitorWin = null;
  if (!w) return;
  try {
    if (!w.isDestroyed()) {
      monitorBounds = w.getBounds();
      w.close();
    }
  } catch (_) { }
}

function ensureMonitorOpen(preserveUrl) {
  monitorConfig.open = true;
  const targetUrl = preserveUrl || getMonitorTargetUrl();

  if (monitorConfig.mode === 'dock') {
    destroyMonitorWin();
    let v = monitorView;
    if (!v || v.webContents.isDestroyed()) {
      if (!win || win.isDestroyed()) return;
      v = new WebContentsView({
        webPreferences: {
          partition: 'persist:monitor-panel',
          preload: path.join(__dirname, 'monitor-preload.js'),
          contextIsolation: true,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
      monitorView = v;
      applyMonitorUA(v.webContents);
      v.webContents.setZoomFactor(monitorConfig.zoom);
      attachMonitorInputHandlers(v.webContents);
      win.contentView.addChildView(v);
      v.webContents.loadURL(targetUrl).catch(() => { });
    } else {
      v.webContents.setZoomFactor(monitorConfig.zoom);
      const cur = v.webContents.getURL();
      if (!cur || cur === 'about:blank' || (preserveUrl && cur !== preserveUrl)) {
        v.webContents.loadURL(targetUrl).catch(() => { });
      }
    }
    layout();
  } else {
    destroyMonitorView();
    layout();
    let bw = monitorWin;
    if (!bw || bw.isDestroyed()) {
      let initX;
      let initY;
      if (monitorBounds) {
        initX = monitorBounds.x;
        initY = monitorBounds.y;
      } else if (win && !win.isDestroyed()) {
        const wb = win.getBounds();
        initX = Math.max(0, wb.x + wb.width - 420);
        initY = Math.max(0, wb.y + 70);
      }
      bw = new BrowserWindow({
        width: (monitorBounds && monitorBounds.width) || 400,
        height: (monitorBounds && monitorBounds.height) || 740,
        x: initX,
        y: initY,
        parent: win && !win.isDestroyed() ? win : undefined,
        title: monitorConfig.site === 'betpawa' ? 'betPawa - Odds Monitor' : 'Betano.ng - Odds Monitor',
        alwaysOnTop: true,
        backgroundColor: '#0f1420',
        webPreferences: {
          partition: 'persist:monitor-panel',
          preload: path.join(__dirname, 'monitor-preload.js'),
          contextIsolation: true,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
      monitorWin = bw;
      bw.setMenuBarVisibility(false);
      applyMonitorUA(bw.webContents);
      bw.webContents.setZoomFactor(monitorConfig.zoom);
      attachMonitorInputHandlers(bw.webContents);
      bw.on('move', () => { if (monitorWin === bw && !bw.isDestroyed()) { monitorBounds = bw.getBounds(); } });
      bw.on('resize', () => { if (monitorWin === bw && !bw.isDestroyed()) { monitorBounds = bw.getBounds(); } });
      bw.on('closed', () => {
        if (monitorWin === bw) {
          monitorWin = null;
          monitorConfig.open = false;
          layout();
          emitMonitorState();
          saveUserSettings();
        }
      });
      bw.loadURL(targetUrl).catch(() => { });
    }
  }

  emitMonitorState();
  saveUserSettings();
}

function closeMonitor() {
  monitorConfig.open = false;
  setMonitorWatchArmed(false, 'Monitor closed');
  destroyMonitorView();
  destroyMonitorWin();
  layout();
  emitMonitorState();
  saveUserSettings();
  return false;
}

function openOrToggleMonitor(forceOpen) {
  const isAlive = !!getActiveMonitorWebContents();
  if (forceOpen === true || !monitorConfig.open || !isAlive) {
    ensureMonitorOpen(isAlive ? getMonitorUrl() : getMonitorTargetUrl());
    return true;
  }
  return closeMonitor();
}

// IPC handles for monitor
ipcMain.handle('ui:toggle-monitor', () => openOrToggleMonitor());
ipcMain.handle('ui:get-monitor-state', () => !!monitorConfig.open);
ipcMain.handle('ui:get-monitor-config', () => ({ ...monitorConfig }));
ipcMain.handle('ui:set-monitor-site', (_e, site) => {
  const nextSite = site === 'betpawa' ? 'betpawa' : 'betano';
  monitorConfig.site = nextSite;
  if (monitorConfig.open) {
    ensureMonitorOpen(getMonitorTargetUrl(nextSite));
  } else {
    emitMonitorState();
  }
  saveUserSettings();
  return { ...monitorConfig };
});

ipcMain.handle('ui:set-monitor-config', (_e, patch) => {
  if (!patch || typeof patch !== 'object') return { ...monitorConfig };
  const prevMode = monitorConfig.mode;
  const prevUA = monitorConfig.mobileUA;
  const prevSite = monitorConfig.site;
  const prevCountry = monitorConfig.country;

  if (patch.site === 'betano' || patch.site === 'betpawa') monitorConfig.site = patch.site;
  if (patch.country === 'ng' || patch.country === 'gh') monitorConfig.country = patch.country;
  if (patch.mode === 'dock' || patch.mode === 'float') monitorConfig.mode = patch.mode;
  if (patch.side === 'left' || patch.side === 'right') monitorConfig.side = patch.side;
  if (patch.width !== undefined) {
    const w = parseInt(patch.width, 10);
    if (!Number.isNaN(w)) monitorConfig.width = Math.min(540, Math.max(260, w));
  }
  if (patch.zoom !== undefined) {
    const z = parseFloat(patch.zoom);
    if (!Number.isNaN(z)) monitorConfig.zoom = Math.min(1.5, Math.max(0.5, Math.round(z * 100) / 100));
  }
  if (typeof patch.mobileUA === 'boolean') monitorConfig.mobileUA = patch.mobileUA;
  if (typeof patch.open === 'boolean') monitorConfig.open = patch.open;

  if (!monitorConfig.open) {
    closeMonitor();
    return { ...monitorConfig };
  }

  const isAlive = !!getActiveMonitorWebContents();
  const siteChanged = prevSite !== monitorConfig.site;
  const countryChanged = prevCountry !== monitorConfig.country;
  if (siteChanged || countryChanged) {
    setMonitorWatchArmed(false, 'Monitor provider/country changed');
  }
  if (!isAlive || prevMode !== monitorConfig.mode || siteChanged || countryChanged) {
    ensureMonitorOpen((siteChanged || countryChanged) ? getMonitorTargetUrl() : getMonitorUrl());
  } else {
    const wc = getActiveMonitorWebContents();
    if (wc) {
      wc.setZoomFactor(monitorConfig.zoom);
      if (prevUA !== monitorConfig.mobileUA) {
        applyMonitorUA(wc);
        wc.reload();
      }
    }
    layout();
    emitMonitorState();
  }
  saveUserSettings();
  return { ...monitorConfig };
});

ipcMain.handle('ui:reload-monitor', () => {
  const wc = getActiveMonitorWebContents();
  if (wc) wc.reload();
  return !!wc;
});

ipcMain.handle('ui:toggle-monitor-watch', () => {
  if (!monitorWatchState.armed && !monitorWatchState.isMatchPage) {
    return { ...monitorWatchState, ...monitorListenerConfig, error: 'Open a Betano live match page first' };
  }
  setMonitorWatchArmed(!monitorWatchState.armed, !monitorWatchState.armed ? 'Armed from UI' : 'Disarmed from UI');
  return { ...monitorWatchState, ...monitorListenerConfig };
});

ipcMain.handle('ui:get-monitor-watch-state', () => ({
  ...monitorWatchState,
  ...monitorListenerConfig,
}));

ipcMain.handle('ui:set-monitor-listener-config', (_e, patch) => {
  if (patch && typeof patch === 'object') {
    if (['place_confirm', 'place_only', 'rapid_attack'].includes(patch.goalBetAction)) {
      monitorListenerConfig.goalBetAction = patch.goalBetAction;
    }
    if (typeof patch.autoCashoutOnDrop === 'boolean') {
      monitorListenerConfig.autoCashoutOnDrop = patch.autoCashoutOnDrop;
    }
    saveUserSettings();
    emitMonitorWatchStatus();
  }
  return { ...monitorWatchState, ...monitorListenerConfig };
});

ipcMain.on('monitor:page-info', (_e, info) => {
  if (!info || typeof info !== 'object') return;
  monitorWatchState.url = String(info.url || '');
  monitorWatchState.isMatchPage = !!info.isMatchPage;
  monitorWatchState.matchKey = info.isMatchPage ? extractBetanoMatchKey(monitorWatchState.url) : '';
  if (info.score) monitorWatchState.score = String(info.score);
  else if (!info.isMatchPage) monitorWatchState.score = '';
  emitMonitorWatchStatus();
});

ipcMain.on('monitor:watch-toggle', (_e, info) => {
  if (info && typeof info === 'object') {
    monitorWatchState.url = String(info.url || monitorWatchState.url || '');
    monitorWatchState.isMatchPage = info.isMatchPage !== undefined ? !!info.isMatchPage : monitorWatchState.isMatchPage;
    monitorWatchState.matchKey = monitorWatchState.isMatchPage ? extractBetanoMatchKey(monitorWatchState.url) : '';
    if (info.score) monitorWatchState.score = String(info.score);
  }
  if (!monitorWatchState.armed && !monitorWatchState.isMatchPage) return;
  const next = !monitorWatchState.armed;
  setMonitorWatchArmed(next, next ? 'Watch armed' : 'Watch stopped');
  if (win && !win.isDestroyed()) {
    win.webContents.send('acc-status', {
      msg: next
        ? `Betano Watch ARMED (${monitorWatchState.score || 'waiting for score'})`
        : 'Betano Watch stopped',
    });
  }
});

ipcMain.on('monitor:watch-auto-off', (_e, info) => {
  monitorWatchState.url = String(info?.url || '');
  monitorWatchState.isMatchPage = !!info?.isMatchPage;
  monitorWatchState.matchKey = monitorWatchState.isMatchPage ? extractBetanoMatchKey(monitorWatchState.url) : '';
  monitorWatchState.score = '';
  setMonitorWatchArmed(false, 'Auto-disarmed on navigation');
});

ipcMain.on('monitor:score-update', (_e, data) => {
  if (!monitorWatchState.armed || !data || !data.score) return;
  const url = String(data.url || monitorWatchState.url || '');
  const matchKey = extractBetanoMatchKey(url);
  const nextScore = String(data.score);
  const prevScore = data.isInitial ? '' : String(data.prev || monitorWatchState.prevScore || '');

  monitorWatchState.url = url;
  monitorWatchState.matchKey = matchKey;
  monitorWatchState.prevScore = prevScore;
  monitorWatchState.score = nextScore;

  if (!prevScore || data.isInitial) {
    monitorWatchState.lastEvent = `Baseline ${nextScore}`;
    emitMonitorWatchStatus();
    console.log(`[BetanoWatch] Baseline initialized at ${nextScore} (${matchKey})`);
    return;
  }

  const outcome = monitorGoalTracker.handleTransition(matchKey, prevScore, nextScore);
  if (outcome.shouldFireBet) {
    if (Date.now() - monitorWatchState.lastTriggerAt < 1000) {
      console.warn('[BetanoWatch] Trigger suppressed by 1s safety cooldown');
      return;
    }
    triggerBetanoGoalAction(outcome.transition, matchKey).catch((err) => {
      console.error('[BetanoWatch] Goal trigger error:', err);
    });
  } else if (outcome.shouldCashout) {
    triggerBetanoScoreDropCashout(outcome.transition, matchKey, outcome.rearmedCount).catch((err) => {
      console.error('[BetanoWatch] Score drop cashout error:', err);
    });
  } else {
    emitMonitorWatchStatus();
  }
});

ipcMain.handle('ui:zoom-monitor', (_e, actionOrValue) => adjustMonitorZoom(actionOrValue));

// ─── IPC: Place bet via UI / Single Bet Spacebar ────────────────────────────

ipcMain.handle('ui:place-bet', () => triggerSingleBetSpacebar('UI Header Button: Place Bet'));
ipcMain.handle('ui:trigger-single-bet-spacebar', (_e, sourceLabel) =>
  triggerSingleBetSpacebar(sourceLabel || 'UI Hotkey: Spacebar (Single Bet)')
);

async function triggerRebet(sourceLabel = 'UI') {
  rebetInFlight++;
  clearTimeout(applyTimer);
  clearTimeout(followUpTimer);

  // Snapshot stakes before firing so each pane gets the correct decrement
  const prevSnapshots = views.map((v, i) => {
    const id = (v && !v.webContents.isDestroyed()) ? v.webContents.id : null;
    const prof = getPaneProfile(i);
    const isGh = prof.country === 'gh';
    const minStakeNum = parseFloat(minStakeForProfile(prof.site, prof.country)) || (isGh ? 0.1 : 10);
    const prepared = id ? preparedRebetStakes.get(id) : null;
    return { id, prof, isGh, minStakeNum, prepared: (prepared && prepared > 0) ? prepared : null };
  });

  // Pre-warm the MutationObserver across all views BEFORE firing so any mounting Rebet button is caught instantly
  views.forEach((v) => {
    if (v && !v.webContents.isDestroyed()) {
      try { v.webContents.send('set-auto-rebet-armed', true); } catch (_) {}
    }
  });

  try {
    lastApplied.clear();
    lastFailed.clear();

    // ── PHASE 1: Fire FAST_REBET_CYCLE_JS in ALL panes simultaneously, don't wait for each other ──
    // Each pane handles its own pre-warmed MutationObserver + click independently (<0.5ms).
    // We collect the promises but DON'T await them here — we race against a 10s timeout.
    let rebetCount = 0;
    const panePromises = views.map(async (v, i) => {
      const snap = prevSnapshots[i];
      if (!viewReady(v)) return { ok: false };

      const id = v.webContents.id;
      const isGh = snap.isGh;
      let targetStake = snap.prepared;
      if (!targetStake || targetStake <= 0) {
        const lastStk = lastStakeByView.get(id);
        targetStake = calculateRebetDecrement(lastStk || 100, isGh, snap.minStakeNum);
      }
      const targetStr = formatStakeStr(targetStake);

      // Fire click immediately — armed MutationObserver catches button in <0.5ms with polling loop as fallback
      const fastRes = await v.webContents.executeJavaScript(FAST_REBET_CYCLE_JS(targetStr)).catch(() => null);
      const clicked = fastRes && fastRes.ok;

      if (clicked) {
        const method = fastRes?.detectionMethod || 'observer';
        console.log(`[Rebet] Pane ${i + 1}: Rebet clicked via [${method}] | Source: "${sourceLabel}"`);
        // Set stake in background — doesn't block the main loop
        (async () => {
          lastStakeByView.set(id, targetStake);
          const subsequent = calculateRebetDecrement(targetStake, isGh, snap.minStakeNum);
          preparedRebetStakes.set(id, subsequent);
          // Brief wait for betslip stake input to remount after rebet, then set stake
          for (let a = 0; a < 20; a++) {
            if (!viewReady(v)) return;
            const hasInp = await v.webContents.executeJavaScript(`(() => {
              const el = (${FIND_STAKE_INPUT_JS})();
              return !!(el && el.getBoundingClientRect().width > 0);
            })()`).catch(() => false);
            if (hasInp) break;
            await sleep(30);
          }
          if (viewReady(v)) {
            await setStakeInView(v, currentProfitConfig?.stakeSel || '', targetStr);
          }
        })();
      }

      return { ok: clicked, stake: targetStr, site: snap.prof.site, country: snap.prof.country };
    });

    // Race: return as soon as ALL panes have fired (or 10s timeout — whichever first)
    const raceTimeout = sleep(10000).then(() => null);
    const statusRows = await Promise.race([
      Promise.all(panePromises),
      raceTimeout.then(() => panePromises.map(() => ({ ok: false }))),
    ]);

    rebetCount = (statusRows || []).filter(r => r && r.ok).length;

    if (win && !win.isDestroyed()) {
      win.webContents.send('acc-status', {
        msg: rebetCount > 0
          ? `Rebet fired on ${rebetCount}/${views.length} pane(s) [${sourceLabel}]`
          : `No Rebet button found [${sourceLabel}]`,
      });
    }

    return { rebetCount, total: views.length };
  } finally {
    rebetInFlight = Math.max(0, rebetInFlight - 1);
    views.forEach((v) => {
      if (v && !v.webContents.isDestroyed()) {
        try { v.webContents.send('set-auto-rebet-armed', false); } catch (_) {}
      }
    });
  }
}

ipcMain.handle('ui:rebet', () => triggerRebet('Click'));

// ─── Auto-Rebet Engine (Continuous Independent Attack Loop) ──────────────

function emitAutoRebetState(statusMsg) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('auto-rebet-state', {
      running: autoRebetRunning,
      cycle: autoRebetCycle,
      target: autoRebetTarget,
      status: statusMsg || (autoRebetRunning ? `Cycle ${autoRebetCycle}/${autoRebetTarget}` : 'Idle'),
    });
  }
}

async function runPaneAttackLoop(v, i, targetCycles) {
  let completedCycles = 0;
  const prof = getPaneProfile(i);
  const isGh = prof.country === 'gh';
  const minStakeNum = parseFloat(minStakeForProfile(prof.site, prof.country)) || (isGh ? 0.1 : 10);

  // Arm instant Rebet watcher in this view's preload (<0.1ms mutation observer)
  try { v.webContents.send('set-auto-rebet-armed', true); } catch (_) { }
  try { await v.webContents.executeJavaScript('window.__mfas_auto_rebet_stop = false;').catch(() => { }); } catch (_) { }

  // Pre-flight check: if this pane already has a Bet Successful modal open, click Rebet immediately
  try {
    const hasModal = await v.webContents.executeJavaScript(`(() => {
      const btn = document.querySelector('button[data-op="betslip-success-rebet"], [data-op="betslip-success-rebet"], button.rebet, [data-cms-key="rebet"]');
      if (btn && btn.offsetParent !== null) { btn.click(); return true; }
      return false;
    })()`).catch(() => false);
    if (hasModal) await sleep(120);
  } catch (_) { }

  let currentStake = lastStakeByView.get(v.webContents.id) || parsePositiveStake(currentSharedStake) || 10.0;

  while (autoRebetRunning) {
    if (!viewReady(v)) break;
    if (targetCycles !== 'inf' && completedCycles >= targetCycles) {
      console.log(`[AutoRebet] Pane ${i + 1}: Completed all ${targetCycles} cycle(s)!`);
      break;
    }

    const currentCycleNum = completedCycles + 1;
    const isFinalCycle = (targetCycles !== 'inf' && currentCycleNum >= targetCycles);

    // If final cycle, disarm rebet watcher in preload so it doesn't click Rebet after confirming
    try { v.webContents.send('set-auto-rebet-armed', !isFinalCycle); } catch (_) { }

    if (currentCycleNum > autoRebetCycle) {
      autoRebetCycle = currentCycleNum;
      emitAutoRebetState(`Cycle #${autoRebetCycle}${targetCycles === 'inf' ? '' : '/' + targetCycles}: Rapid attacking across panes...`);
    }

    // Requirement: after 2 cycles...edit stake by +0.1 across panes
    let stakeToApply = null;
    if (completedCycles > 0 && completedCycles % 2 === 0) {
      currentStake = Math.round((currentStake + 0.1) * 100) / 100;
      stakeToApply = String(currentStake);
      lastStakeByView.set(v.webContents.id, currentStake);
      currentSharedStake = stakeToApply;
      console.log(`[AutoRebet] Pane ${i + 1}: After 2 cycles, incremented stake to ${currentStake}`);

      // Keep all panes synchronized at the same ms without using manual keypad
      views.forEach((otherV) => {
        if (!otherV || otherV.webContents.isDestroyed() || otherV.webContents.id === v.webContents.id) return;
        otherV.webContents.executeJavaScript(FAST_SET_STAKE_JS(stakeToApply)).catch(() => { });
      });
    }

    // Run rapid cycle (Place Bet -> Confirm -> Rebet -> Betslip ready)
    let res = null;
    try {
      res = await v.webContents.executeJavaScript(EXECUTE_ATTACK_CYCLE_JS(stakeToApply, isFinalCycle));
      if (res && res.traceLogs && res.traceLogs.length > 0) {
        console.log(`[AutoRebet:Trace:Pane ${i + 1}]\n  ` + res.traceLogs.join('\n  '));
      }
    } catch (err) {
      console.error(`[AutoRebet] Pane ${i + 1} cycle error:`, err);
    }

    if (!autoRebetRunning) break;

    if (res && res.aborted) {
      break;
    }

    if (res && res.insufficientBalance) {
      emitAutoRebetState(`Pane ${i + 1} stopped: Insufficient balance.`);
      break;
    }

    if (res && res.oddsLocked) {
      emitAutoRebetState(`Pane ${i + 1} stopped: Selection suspended or odds locked.`);
      break;
    }

    if (res && res.cycleCompleted) {
      completedCycles++;
      lastStakeByView.set(v.webContents.id, currentStake);

      console.log(`[AutoRebet] Pane ${i + 1}: Finished cycle ${completedCycles}/${targetCycles}`);
      if (targetCycles !== 'inf' && completedCycles >= targetCycles) {
        break;
      }
      // Zero delay transition - immediate next cycle fires!
    } else {
      console.warn(`[AutoRebet] Pane ${i + 1}: Cycle did not complete:`, res?.error);
      // Single Bet mode: exactly ONE pass, never loop or retry regardless of outcome
      if (targetCycles === 1) {
        console.warn(`[AutoRebet] Pane ${i + 1}: Single bet attempt finished (status: ${res?.error || 'unconfirmed'}). Stopping.`);
        break;
      }
      await sleep(80);
      if (!res || res.error === 'timeout_waiting_for_place_btn') {
        if (!viewReady(v)) break;
      }
    }
  }

  try { v.webContents.send('set-auto-rebet-armed', false); } catch (_) { }
}

async function startAutoRebet(cycles, sourceLabel = 'Unknown') {
  console.log(`[SAFETY][BetTrigger] startAutoRebet invoked | Source: "${sourceLabel}" | Cycles: ${cycles} | Timestamp: ${new Date().toISOString()}`);
  if (autoRebetRunning) return { ok: false, msg: 'Already running' };
  autoRebetRunning = true;
  autoRebetCycle = 0;
  autoRebetTarget = (cycles === 'inf' || cycles === 0 || cycles === '0') ? 'inf' : Math.max(1, parseInt(cycles, 10) || 1);

  const targetDesc = autoRebetTarget === 'inf' ? 'Continuous Attack' : (autoRebetTarget === 1 ? 'Single Bet' : `${autoRebetTarget} cycles`);
  emitAutoRebetState(autoRebetTarget === 1 ? 'Single Bet: Placing & confirming bet...' : `Auto-Rebet attacking (${targetDesc}) - Independent rapid fire...`);

  // Ensure stop flag is reset across all views, arm rebet watcher only if more than 1 cycle
  views.forEach((v) => {
    try {
      v.webContents.executeJavaScript('window.__mfas_auto_rebet_stop = false;').catch(() => { });
      v.webContents.send('set-auto-rebet-armed', autoRebetTarget !== 1);
    } catch (_) { }
  });

  // Launch independent, parallel, non-blocking attack loop for EVERY view simultaneously!
  // No view ever waits for another view to confirm or rebet!
  const panePromises = views.map((v, i) => runPaneAttackLoop(v, i, autoRebetTarget));

  Promise.all(panePromises).finally(() => {
    autoRebetRunning = false;
    emitAutoRebetState(autoRebetTarget === 1 ? 'Single bet completed' : (autoRebetCycle > 0 ? `Auto-Rebet attack completed (${autoRebetCycle} cycles)` : 'Auto-Rebet stopped'));
  });

  return { ok: true, running: true, target: autoRebetTarget };
}

function stopAutoRebet() {
  autoRebetRunning = false;
  views.forEach((v) => {
    try {
      v.webContents.send('set-auto-rebet-armed', false);
      v.webContents.executeJavaScript('window.__mfas_auto_rebet_stop = true;').catch(() => { });
    } catch (_) { }
  });
  emitAutoRebetState('Auto-Rebet stopped');
  return { ok: true, running: false };
}

ipcMain.handle('ui:start-auto-rebet', (_e, cycles, sourceLabel) => startAutoRebet(cycles, sourceLabel || 'UI Request'));
ipcMain.handle('ui:stop-auto-rebet', () => stopAutoRebet());
ipcMain.handle('ui:get-auto-rebet-state', () => ({
  running: autoRebetRunning,
  cycle: autoRebetCycle,
  target: autoRebetTarget,
}));

ipcMain.handle('ui:set-rebet-decrement', (_e, patch) => {
  if (patch && typeof patch === 'object') {
    const dng = parseFloat(patch.decrementNG);
    const dgh = parseFloat(patch.decrementGH);
    if (!Number.isNaN(dng) && dng > 0) rebetConfig.decrementNG = dng;
    if (!Number.isNaN(dgh) && dgh > 0) rebetConfig.decrementGH = dgh;
    if (patch.mode === 'fixed' || patch.mode === 'tiered') {
      rebetConfig.mode = patch.mode;
    }
    saveUserSettings();
  }
  return { ...rebetConfig };
});

ipcMain.handle('ui:get-rebet-decrement', () => ({ ...rebetConfig }));

ipcMain.handle('ui:set-auto-rebet-on-space', (_e, enabled) => {
  autoRebetOnSpace = !!enabled;
  saveUserSettings();
  return autoRebetOnSpace;
});

ipcMain.handle('ui:get-auto-rebet-on-space', () => autoRebetOnSpace);

ipcMain.handle('ui:set-single-bet-click-mode', (_e, mode) => {
  if (mode === '1-click' || mode === '2-click') {
    singleBetClickMode = mode;
    saveUserSettings();
  }
  return singleBetClickMode;
});

ipcMain.handle('ui:get-single-bet-click-mode', () => singleBetClickMode);

async function triggerSingleBetSpacebar(sourceLabel = 'Hotkey: Spacebar') {
  if (autoRebetRunning || singleBetInFlight) {
    return { ok: false, ignored: true, reason: 'in_flight' };
  }
  if (singleBetClickMode === '1-click') {
    return startAutoRebet(1, sourceLabel);
  }

  singleBetInFlight = true;
  try {
    const states = await Promise.all(
      views.map(async (v) => {
        if (!viewReady(v)) return { state: 'not_ready' };
        try {
          const res = await withTimeout(v.webContents.executeJavaScript(INSPECT_SINGLE_BET_STATE_JS), 1200, { state: 'error' });
          return res || { state: 'idle_empty' };
        } catch (_) {
          return { state: 'error' };
        }
      })
    );

    const awaitingConfirmIndices = [];
    const placeableIndices = [];
    states.forEach((st, idx) => {
      if (st?.state === 'awaiting_confirm') awaitingConfirmIndices.push(idx);
      else if (st?.state === 'placeable') placeableIndices.push(idx);
    });

    if (awaitingConfirmIndices.length > 0) {
      console.log(`[SAFETY][BetTrigger] 2-Click Single Bet: Confirm ONLY on ${awaitingConfirmIndices.length} pane(s) | Source: "${sourceLabel}"`);
      emitAutoRebetState('Single Bet (2-Click): Confirming bet...');
      await Promise.all(
        awaitingConfirmIndices.map((idx) => {
          const v = views[idx];
          if (!viewReady(v)) return Promise.resolve(null);
          return withTimeout(v.webContents.executeJavaScript(SINGLE_BET_CONFIRM_ONLY_JS), 2500, null).catch(() => null);
        })
      );
      emitAutoRebetState('Single Bet (2-Click): Confirmed');
      return { ok: true, step: 'confirm', panes: awaitingConfirmIndices.length };
    }

    if (placeableIndices.length > 0) {
      console.log(`[SAFETY][BetTrigger] 2-Click Single Bet: Place Bet ONLY on ${placeableIndices.length} pane(s) | Source: "${sourceLabel}"`);
      emitAutoRebetState('Single Bet (2-Click): Placing bet (awaiting Confirm)...');
      await Promise.all(
        placeableIndices.map((idx) => {
          const v = views[idx];
          if (!viewReady(v)) return Promise.resolve(null);
          return withTimeout(v.webContents.executeJavaScript(SINGLE_BET_PLACE_ONLY_JS), 3000, null).catch(() => null);
        })
      );
      emitAutoRebetState('Single Bet (2-Click): Placed — press Spacebar again to Confirm');
      return { ok: true, step: 'place', panes: placeableIndices.length };
    }

    return { ok: true, step: 'noop', reason: 'no_placeable_or_confirm_state' };
  } finally {
    singleBetInFlight = false;
  }
}

ipcMain.handle('ui:set-balance-aware-stake', (_e, enabled) => {
  balanceAwareStake = !!enabled;
  saveUserSettings();
  return balanceAwareStake;
});

ipcMain.handle('ui:get-balance-aware-stake', () => balanceAwareStake);

// ─── IPC: Cross-tab navigation & two-step confirmed Cashout ─────────────────

async function sendTrustedTap(v, cssX, cssY) {
  if (!viewReady(v)) return;
  let z = 1;
  try { z = v.webContents.getZoomFactor() || 1; } catch (_) { }
  const x = Math.max(1, Math.round(cssX * z));
  const y = Math.max(1, Math.round(cssY * z));
  v.webContents.sendInputEvent({ type: 'mouseMove', x, y });
  await sleep(15);
  v.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  await sleep(20);
  v.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
}

function waitForFinishLoad(v, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!v || v.webContents.isDestroyed()) return resolve(false);
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.webContents.removeListener('did-finish-load', onLoad);
      resolve(ok);
    };
    const onLoad = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    v.webContents.once('did-finish-load', onLoad);
  });
}

async function waitForOpenBetsTicketsReady(v, maxWaitMs = 4200) {
  const started = Date.now();
  let emptyStreak = 0;
  while (Date.now() - started < maxWaitMs) {
    if (!v || v.webContents.isDestroyed()) return { ready: false, state: 'destroyed' };
    if (v.webContents.isLoadingMainFrame()) {
      await sleep(140);
      continue;
    }
    const st = await withTimeout(v.webContents.executeJavaScript(INSPECT_OPEN_BETS_STATE_JS).catch(() => null), 1500, null);
    if (st && (st.state === 'confirm-open' || st.state === 'has-tickets')) {
      return { ready: true, state: st.state };
    }
    if (st && st.state === 'logged-out') {
      return { ready: false, state: 'logged-out' };
    }
    if (st && st.state === 'empty') {
      emptyStreak++;
      if (emptyStreak >= 3 && Date.now() - started >= 500) {
        return { ready: true, state: 'empty' };
      }
    } else {
      emptyStreak = 0;
    }
    await sleep(130);
  }
  return { ready: true, state: 'timeout' };
}

async function ensureOpenBetsInView(v) {
  if (!v || v.webContents.isDestroyed()) return false;
  if (v.webContents.isLoadingMainFrame()) {
    await waitForFinishLoad(v, 3500);
  }
  const nav = await withTimeout(v.webContents.executeJavaScript(NAV_OPEN_BETS_JS).catch(() => null), 2500, null);
  if (!nav) return false;
  if (nav.status === 'ready') {
    await waitForOpenBetsTicketsReady(v, 2200);
    return true;
  }

  let latestNav = nav;
  if (nav.status === 'navigated') {
    let becameReady = false;
    for (let i = 0; i < 6; i++) {
      await sleep(180);
      if (!viewReady(v)) continue;
      const check = await withTimeout(v.webContents.executeJavaScript(NAV_OPEN_BETS_JS).catch(() => null), 1500, null);
      if (check) latestNav = check;
      if (check && check.status === 'ready') {
        becameReady = true;
        break;
      }
    }
    if (becameReady) {
      await waitForOpenBetsTicketsReady(v, 3600);
      return true;
    }
  }

  // Fallback for 'need-url' OR if bottom-nav click did not navigate onto /open_bets (e.g. blocked by betslip overlay)
  const idx = views.indexOf(v);
  const prof = idx >= 0 ? getPaneProfile(idx) : { site: 'sportybet', country: currentCountry };
  const curHref = latestNav?.href || nav.href || v.webContents.getURL();
  const site = latestNav?.site || nav.site || siteFromUrl(curHref, prof.site);
  const country = latestNav?.country || nav.country || countryFromUrl(curHref, prof.country);
  if (site) {
    const targetUrl = buildOpenBetsUrl(site, country);
    const loadDone = waitForFinishLoad(v, 5000);
    v.webContents.loadURL(targetUrl).catch(() => { });
    await loadDone;
    await sleep(250);
    await withTimeout(v.webContents.executeJavaScript(NAV_OPEN_BETS_JS).catch(() => null), 1500, null);
    await waitForOpenBetsTicketsReady(v, 4200);
  }

  return true;
}

async function confirmOpenCashoutSheet(v, fallbackX = 0, fallbackY = 0) {
  let cRes = await withTimeout(v.webContents.executeJavaScript(CLICK_CASHOUT_CONFIRM_JS).catch(() => null), 2000, null);
  if (cRes && cRes.clicked && cRes.dismissed) return true;

  await sleep(160);
  let stillOpen = await withTimeout(v.webContents.executeJavaScript(FIND_CASHOUT_CONFIRM_JS).catch(() => null), 1200, null);
  if (!stillOpen || !stillOpen.found) return true;

  const tapX = stillOpen.x || (cRes && cRes.x) || fallbackX;
  const tapY = stillOpen.y || (cRes && cRes.y) || fallbackY;
  if (tapX && tapY) {
    await sendTrustedTap(v, tapX, tapY);
    await sleep(320);
    stillOpen = await withTimeout(v.webContents.executeJavaScript(FIND_CASHOUT_CONFIRM_JS).catch(() => null), 1200, null);
    if (!stillOpen || !stillOpen.found) return true;
  }

  // Final retry in case the confirm value updated cleanly mid-sheet (e.g. VAR / odds shift)
  cRes = await withTimeout(v.webContents.executeJavaScript(CLICK_CASHOUT_CONFIRM_JS).catch(() => null), 2000, null);
  if (cRes && cRes.clicked && cRes.dismissed) return true;
  const retryX = (cRes && cRes.x) || stillOpen.x || fallbackX;
  const retryY = (cRes && cRes.y) || stillOpen.y || fallbackY;
  if (retryX && retryY) await sendTrustedTap(v, retryX, retryY);
  await sleep(360);
  stillOpen = await withTimeout(v.webContents.executeJavaScript(FIND_CASHOUT_CONFIRM_JS).catch(() => null), 1200, null);
  return !stillOpen || !stillOpen.found;
}

async function cashoutPane(v, paneIdx = 0) {
  const paneTag = `Pane ${paneIdx + 1}`;
  if (!viewReady(v)) {
    console.log(`[Cashout] ${paneTag}: Skipped (pane not ready)`);
    return 0;
  }

  let readyInfo = { ready: true, state: 'unknown' };
  if (cashoutConfig.autoNavOpenBets) {
    const ok = await ensureOpenBetsInView(v);
    if (!ok) {
      console.log(`[Cashout] ${paneTag}: Skipped (open bets view unavailable)`);
      return 0;
    }
  } else {
    readyInfo = await waitForOpenBetsTicketsReady(v, 1800);
    if (!readyInfo.ready) {
      console.log(`[Cashout] ${paneTag}: Skipped (${readyInfo.state || 'not ready'})`);
      return 0;
    }
  }

  let confirmedCount = 0;
  const MAX_TICKETS = 12;

  for (let pass = 0; pass < MAX_TICKETS; pass++) {
    if (!viewReady(v)) break;
    let step = await withTimeout(v.webContents.executeJavaScript(PREPARE_CASHOUT_CLICK_JS).catch(() => null), 2500, null);
    if ((!step || step.mode === 'none') && pass === 0) {
      await sleep(250);
      step = await withTimeout(v.webContents.executeJavaScript(PREPARE_CASHOUT_CLICK_JS).catch(() => null), 2500, null);
    }
    if (!step || step.mode === 'none') break;

    if (step.mode === 'confirm-only') {
      const ok = await confirmOpenCashoutSheet(v, step.x, step.y);
      if (!ok) break;
      confirmedCount++;
      await sleep(320);
      continue;
    }

    // step.mode === 'clicked-ticket': use instant MutationObserver match if available, else poll FIND_CASHOUT_CONFIRM_JS
    let confirmInfo = step.confirmReady
      ? { found: true, clickNow: true, x: step.confirmX, y: step.confirmY, label: step.confirmLabel }
      : null;

    if (!confirmInfo) {
      for (let tick = 0; tick < 16; tick++) {
        await sleep(110);
        confirmInfo = await withTimeout(v.webContents.executeJavaScript(FIND_CASHOUT_CONFIRM_JS).catch(() => null), 1200, null);
        if (confirmInfo && confirmInfo.found) break;
        // Only send a fallback trusted tap if neither Confirm button nor modal overlay has appeared yet
        if (tick === 2 && (!confirmInfo || !confirmInfo.overlayOpen) && step.x && step.y) {
          await sendTrustedTap(v, step.x, step.y);
        }
      }
    }

    if (confirmInfo && confirmInfo.found) {
      const ok = await confirmOpenCashoutSheet(v, confirmInfo.x || step.x, confirmInfo.y || step.y);
      if (!ok) {
        console.warn(`[Cashout] ${paneTag}: Clicked ticket (${step.label}), but confirm did not dismiss`);
        break;
      }
      confirmedCount++;
      await sleep(320);
    } else {
      // No confirm dialog popped up (could be suspended or blocked); stop looping this pane
      console.log(`[Cashout] ${paneTag}: Cashout clicked (${step.label}) but no confirm button appeared`);
      break;
    }
  }

  if (confirmedCount > 0) {
    console.log(`[Cashout] ${paneTag}: Confirmed ${confirmedCount} ticket(s)`);
  } else {
    console.log(`[Cashout] ${paneTag}: Skipped (no open cashout tickets ready)`);
  }
  return confirmedCount;
}

async function triggerCashoutAll(sourceLabel = 'Click') {
  if (cashoutBusy) return { total: 0, busy: true };
  cashoutBusy = true;
  try {
    const results = await Promise.all(views.map((v, idx) => cashoutPane(v, idx).catch(() => 0)));
    const total = results.reduce((s, n) => s + (n || 0), 0);
    console.log(`[Cashout] ${sourceLabel}: ${total > 0 ? `Confirmed ${total} ticket(s)` : 'No open cashout tickets ready'}`);
    if (win && !win.isDestroyed()) {
      win.webContents.send('acc-status', {
        msg: total > 0
          ? `Cashout confirmed on ${total} ticket(s) [${sourceLabel}]`
          : `No open cashout tickets ready [${sourceLabel}]`,
      });
    }
    return { total };
  } finally {
    cashoutBusy = false;
  }
}

ipcMain.handle('ui:cashout-all', () => triggerCashoutAll('Click'));

ipcMain.handle('ui:set-hotkeys', (_e, enabled) => {
  hotkeysEnabled = !!enabled;
  return hotkeysEnabled;
});

ipcMain.handle('ui:set-cashout-config', (_e, patch) => {
  if (patch && typeof patch === 'object') {
    if (typeof patch.autoNavOpenBets === 'boolean') cashoutConfig.autoNavOpenBets = patch.autoNavOpenBets;
    saveUserSettings();
  }
  return { ...cashoutConfig };
});

// ─── License check ──────────────────────────────────────────────────────────

async function enforceLicense() {
  const result = await checkLicense();
  if (!result.ok) {
    const portalUrl = result.portalUrl || 'https://questsync-licensing-portal.vercel.app';
    const mid = result.mid || (result.reason?.match(/[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/i)?.[0]) || '';

    const detailText = mid
      ? `This computer is not approved or your subscription has expired.\n\nComputer ID: ${mid}\n\nQuestSync Pro licenses are sold and renewed exclusively through authorized retailers.\nPlease copy your Computer ID and text it to the retailer who provided your software to activate or renew.`
      : (result.reason || 'Access not available.');

    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'QuestSync Pro — Subscription Required',
      message: 'Active Subscription Required',
      detail: detailText,
      buttons: ['Copy Computer ID', 'How to Activate', 'Check Again', 'Exit'],
      defaultId: 0,
      cancelId: 3,
      noLink: true
    });

    if (choice === 0) {
      if (mid) clipboard.writeText(mid);
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Copied to Clipboard',
        message: 'Computer ID Copied!',
        detail: `Computer ID: ${mid}\n\nSimply paste and text this Computer ID to the retailer who provided your software.\nOnce they activate it, click "Check Again".`
      });
      return await enforceLicense();
    } else if (choice === 1) {
      const guideUrl = mid ? `${portalUrl}/?mid=${encodeURIComponent(mid)}` : portalUrl;
      shell.openExternal(guideUrl);
      return await enforceLicense();
    } else if (choice === 2) {
      return await enforceLicense();
    } else {
      app.quit();
      return false;
    }
  }
  return true;
}

async function flushAllCookies() {
  try {
    const promises = views.map(v => {
      if (v && !v.webContents.isDestroyed() && v.webContents.session && v.webContents.session.cookies) {
        return v.webContents.session.cookies.flushStore().catch(() => { });
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
  } catch (_) { }
}

app.whenReady().then(async () => {
  if (!(await enforceLicense())) return;
  createWindow();
  setInterval(enforceLicense, 5 * 60 * 1000);
});
app.on('window-all-closed', async () => {
  await flushAllCookies();
  destroyMonitorView();
  destroyMonitorWin();
  app.quit();
});
app.on('before-quit', async () => {
  await flushAllCookies();
});
