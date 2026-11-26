import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppNav from './components/AppNav.jsx';
import SoftwareToolbar from './components/SoftwareToolbar.jsx';
import PaneStrip from './components/PaneStrip.jsx';
import AccountsPage from './components/AccountsPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import NotificationBoard from './components/NotificationBoard.jsx';

const saved = (k, fallback) => {
  const v = localStorage.getItem('ui:' + k);
  return v !== null ? v : fallback;
};

const savedJson = (k, fallback) => {
  try {
    const raw = localStorage.getItem('ui:' + k);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch (_) {
    return fallback;
  }
};

const DEFAULT_BETANO_CFG = {
  open: false,
  mode: 'dock',
  side: 'left',
  width: 340,
  zoom: 0.65,
  mobileUA: true,
};

const DEFAULT_CASHOUT_CFG = {
  autoNavOpenBets: true,
};

function getInitialRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'accounts' || hash === 'settings') return hash;
  return 'software';
}

export default function App() {
  const shellRef = useRef(null);

  // ─── Routing State ───
  const [route, setRoute] = useState(getInitialRoute);

  const navigateTo = useCallback((nextRoute) => {
    const cleanRoute = (nextRoute || 'software').replace(/^#\/?/, '').toLowerCase();
    setRoute(cleanRoute);
    window.location.hash = `#/${cleanRoute}`;
    if (window.api && window.api.setRoute) {
      window.api.setRoute(`/${cleanRoute}`);
    }
  }, []);

  // Listen to browser hash changes
  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (h === 'accounts' || h === 'settings' || h === 'software') {
        setRoute(h);
        if (window.api && window.api.setRoute) {
          window.api.setRoute(`/${h}`);
        }
      }
    };
    window.addEventListener('hashchange', onHashChange);
    // Initialize IPC route on mount
    if (window.api && window.api.setRoute) {
      window.api.setRoute(`/${route}`);
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [route]);

  // ─── Core App State ───
  const [country, setCountry] = useState(() => (saved('country', 'ng') === 'gh' ? 'gh' : 'ng'));
  const [url, setUrl] = useState(() => saved('url', 'https://www.sportybet.com/ng/m/'));
  const [urlScope, setUrlScope] = useState(() => (saved('urlScope', 'all') === 'active' ? 'active' : 'all'));
  const [count, setCount] = useState(() => Math.min(8, Math.max(1, parseInt(saved('count', '5'), 10) || 5)));
  const [layoutMode, setLayoutMode] = useState(() => saved('layout', 'row'));
  const [zoom, setZoom] = useState(0.65);

  const [mirror, setMirror] = useState(true);
  const [typing, setTyping] = useState(() => saved('typing', '1') !== '0');
  const [autoAcceptOdds, setAutoAcceptOdds] = useState(() => saved('autoAcceptOdds', '0') === '1');

  const [targetGH, setTargetGH] = useState(() => saved('targetGH', '200'));
  const [targetNG, setTargetNG] = useState(() => saved('targetNG', '7500'));
  const [whole, setWhole] = useState(() => saved('whole', '1') !== '0');
  const [autoUpdate, setAutoUpdate] = useState(() => saved('autoUpdate', '0') === '1');

  // Rebet Decrement Settings
  const [rebetConfig, setRebetConfig] = useState(() => ({
    decrementNG: parseFloat(saved('rebetDecNG', '10')) || 10,
    decrementGH: parseFloat(saved('rebetDecGH', '1.0')) || 1.0,
    mode: saved('rebetDecMode', 'fixed'),
  }));

  // Auto-Rebet Continuous Engine
  const [autoRebetCycles, setAutoRebetCycles] = useState(() => saved('autoRebetCycles', '3'));
  const [autoRebetOnSpace, setAutoRebetOnSpace] = useState(() => saved('autoRebetOnSpace', '1') !== '0');
  const [singleBetClickMode, setSingleBetClickMode] = useState(() => {
    const v = saved('singleBetClickMode', '1-click');
    return v === '2-click' ? '2-click' : '1-click';
  });
  const [autoRebetState, setAutoRebetState] = useState({ running: false, cycle: 0, target: 1, status: 'Idle' });

  const [oddsSel, setOddsSel] = useState(() => saved('oddsSel', ''));
  const [stakeSel, setStakeSel] = useState(() => saved('stakeSel', ''));

  const [hotkeysEnabled, setHotkeysEnabled] = useState(() => saved('hotkeys', '1') !== '0');
  const [betanoOpen, setBetanoOpen] = useState(false);
  const [betanoConfig, setBetanoConfig] = useState(() => ({
    site: 'betano',
    ...savedJson('betanoCfg', DEFAULT_BETANO_CFG),
    open: false,
  }));
  const [cashoutConfig, setCashoutConfig] = useState(() => savedJson('cashoutCfg', DEFAULT_CASHOUT_CFG));
  const [balanceAwareStake, setBalanceAwareStake] = useState(() => saved('balanceAware', '1') !== '0');

  // Toolbar & metrics state
  const [windowSync, setWindowSync] = useState(() => saved('windowSync', '1') !== '0');
  const [autoAlign, setAutoAlign] = useState(() => saved('autoAlign', '1') !== '0');
  const [tileSize, setTileSize] = useState(() => parseInt(saved('tileSize', '65'), 10) || 65);
  const [todayBets, setTodayBets] = useState(() => parseInt(saved('todayBets', '0'), 10) || 0);
  const [todayTotal, setTodayTotal] = useState(() => saved('todayTotal', '0.00'));
  const [logs, setLogs] = useState(() => [
    { id: 1, time: new Date().toLocaleTimeString(), text: 'QuestSync initialized' },
    { id: 2, time: new Date().toLocaleTimeString(), text: 'Click mirroring & instant stake sync online' },
  ]);

  const [paneStates, setPaneStates] = useState([]);
  const [profitRows, setProfitRows] = useState([]);
  const [layoutGeometry, setLayoutGeometry] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Ready | Enter: Single Bet | Space: Armed Mode | Alt+C: Cashout All');

  // ─── Welcome / Notification Board Guide Modal ───
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('ui:guideDismissed') !== '1';
  });

  useEffect(() => {
    if (window.api && window.api.setModalOpen) {
      window.api.setModalOpen(showGuide);
    }
  }, [showGuide]);

  const handleCloseGuide = useCallback((dontShowAgain) => {
    if (dontShowAgain) {
      localStorage.setItem('ui:guideDismissed', '1');
    } else {
      localStorage.removeItem('ui:guideDismissed');
    }
    setShowGuide(false);
  }, []);

  const handleOpenGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  // ─── In-App Auto-Update State ───
  const [updateStatus, setUpdateStatus] = useState({ status: 'idle', currentVersion: '1.0.3' });

  useEffect(() => {
    if (window.api && window.api.onUpdateStatus) {
      const unsub = window.api.onUpdateStatus((s) => {
        if (s && typeof s === 'object') {
          setUpdateStatus((prev) => ({
            ...prev,
            ...s,
            currentVersion: s.currentVersion || prev.currentVersion || '1.0.1',
          }));
          if (s.status === 'downloaded') {
            setStatusMsg(`Update v${s.version || ''} ready to install · Click Update in top bar`);
          }
        }
      });
      return () => unsub && unsub();
    }
  }, []);

  useEffect(() => {
    if (window.api && window.api.getUpdateStatus) {
      window.api.getUpdateStatus().then((s) => {
        if (s && typeof s === 'object') {
          setUpdateStatus((prev) => ({
            ...prev,
            ...s,
            currentVersion: s.currentVersion || prev.currentVersion || '1.0.1',
          }));
        }
      }).catch(() => {});
    }
  }, []);

  const handleInstallUpdate = useCallback(() => {
    if (window.api && window.api.installUpdate) {
      window.api.installUpdate();
    }
  }, []);

  const handleCheckForUpdates = useCallback(() => {
    if (window.api && window.api.checkForUpdates) {
      window.api.checkForUpdates();
    }
  }, []);

  // Sync toolbar height to Electron main process when on software workspace
  useEffect(() => {
    if (route !== 'software') return;
    const el = shellRef.current;
    if (!el) return;
    const pushHeight = () => {
      const rect = el.getBoundingClientRect();
      // rect.bottom accurately measures the distance from the top of the window (y=0)
      // down through AppNav, SoftwareToolbar, and PaneStrip, ensuring WebContents start
      // directly underneath the pane title cards without covering the game name banner.
      const h = Math.ceil(rect.bottom);
      if (h > 0 && window.api && window.api.setBarHeight) {
        window.api.setBarHeight(h);
      }
    };
    pushHeight();
    const ro = new ResizeObserver(pushHeight);
    ro.observe(el);
    window.addEventListener('resize', pushHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', pushHeight);
    };
  }, [route, paneStates.length, layoutGeometry]);

  const buildCfg = useCallback(
    (override = {}) => ({
      oddsSel: (override.oddsSel ?? oddsSel).trim(),
      stakeSel: (override.stakeSel ?? stakeSel).trim(),
      whole: override.whole ?? whole,
    }),
    [oddsSel, stakeSel, whole]
  );

  // Push targets, preferences & auto-load on startup
  useEffect(() => {
    // 1. Hydrate saved settings from Electron main process persistent storage first
    window.api.getUserSettings().then((s) => {
      if (!s || typeof s !== 'object') return;

      const countVal = typeof s.count === 'number' ? s.count : (typeof s.windowCount === 'number' ? s.windowCount : null);
      if (countVal && countVal >= 1 && countVal <= 8) {
        setCount(countVal);
        localStorage.setItem('ui:count', String(countVal));
      }

      const layoutVal = s.layoutMode || s.layout;
      if (layoutVal && ['auto', 'row', 'grid'].includes(layoutVal)) {
        setLayoutMode(layoutVal);
        localStorage.setItem('ui:layout', layoutVal);
        window.api.setLayout(layoutVal);
      }

      if (typeof s.zoom === 'number') {
        setZoom(s.zoom);
        setTileSize(Math.round(s.zoom * 100));
        localStorage.setItem('ui:tileSize', String(Math.round(s.zoom * 100)));
      }
      if (typeof s.tileSize === 'number') {
        setTileSize(s.tileSize);
        localStorage.setItem('ui:tileSize', String(s.tileSize));
      }
      if (typeof s.mirror === 'boolean') {
        setMirror(s.mirror);
        localStorage.setItem('ui:mirror', s.mirror ? '1' : '0');
      }
      if (typeof s.autoAcceptOdds === 'boolean') {
        setAutoAcceptOdds(s.autoAcceptOdds);
        localStorage.setItem('ui:autoAcceptOdds', s.autoAcceptOdds ? '1' : '0');
      }
      if (typeof s.typing === 'boolean') {
        setTyping(s.typing);
        localStorage.setItem('ui:typing', s.typing ? '1' : '0');
      }
      if (typeof s.windowSync === 'boolean') {
        setWindowSync(s.windowSync);
        localStorage.setItem('ui:windowSync', s.windowSync ? '1' : '0');
      }
      if (typeof s.autoAlign === 'boolean') {
        setAutoAlign(s.autoAlign);
        localStorage.setItem('ui:autoAlign', s.autoAlign ? '1' : '0');
      }
      if (typeof s.whole === 'boolean') {
        setWhole(s.whole);
        localStorage.setItem('ui:whole', s.whole ? '1' : '0');
      }
      if (typeof s.hotkeysEnabled === 'boolean') {
        setHotkeysEnabled(s.hotkeysEnabled);
        localStorage.setItem('ui:hotkeys', s.hotkeysEnabled ? '1' : '0');
        window.api.setHotkeysEnabled(s.hotkeysEnabled);
      }
      if (s.profitTargets) {
        if (s.profitTargets.gh) {
          setTargetGH(String(s.profitTargets.gh));
          localStorage.setItem('ui:targetGH', String(s.profitTargets.gh));
        }
        if (s.profitTargets.ng) {
          setTargetNG(String(s.profitTargets.ng));
          localStorage.setItem('ui:targetNG', String(s.profitTargets.ng));
        }
        const gh = parseFloat(s.profitTargets.gh) || 200;
        const ng = parseFloat(s.profitTargets.ng) || 7500;
        window.api.setTargets({ gh, ng });
      }
      if (s.rebetConfig && typeof s.rebetConfig === 'object') {
        setRebetConfig((prev) => ({ ...prev, ...s.rebetConfig }));
        if (s.rebetConfig.decrementNG) localStorage.setItem('ui:rebetDecNG', String(s.rebetConfig.decrementNG));
        if (s.rebetConfig.decrementGH) localStorage.setItem('ui:rebetDecGH', String(s.rebetConfig.decrementGH));
        if (s.rebetConfig.mode) localStorage.setItem('ui:rebetDecMode', s.rebetConfig.mode);
        if (window.api.setRebetDecrement) window.api.setRebetDecrement(s.rebetConfig).catch(() => {});
      }
      if (typeof s.autoRebetOnSpace === 'boolean') {
        setAutoRebetOnSpace(s.autoRebetOnSpace);
        localStorage.setItem('ui:autoRebetOnSpace', s.autoRebetOnSpace ? '1' : '0');
      }
      if (s.singleBetClickMode === '1-click' || s.singleBetClickMode === '2-click') {
        setSingleBetClickMode(s.singleBetClickMode);
        localStorage.setItem('ui:singleBetClickMode', s.singleBetClickMode);
      }
      if (typeof s.autoRebetCycles === 'number' || typeof s.autoRebetCycles === 'string') {
        setAutoRebetCycles(String(s.autoRebetCycles));
        localStorage.setItem('ui:autoRebetCycles', String(s.autoRebetCycles));
      }
      if (typeof s.balanceAwareStake === 'boolean') {
        setBalanceAwareStake(s.balanceAwareStake);
        localStorage.setItem('ui:balanceAware', s.balanceAwareStake ? '1' : '0');
      }
      if (s.monitorConfig) {
        setBetanoConfig((prev) => ({ ...prev, ...s.monitorConfig }));
        setBetanoOpen(!!s.monitorConfig.open);
      }
      if (s.cashoutConfig) {
        setCashoutConfig(s.cashoutConfig);
        window.api.setCashoutConfig(s.cashoutConfig).catch(() => {});
      }
      if (s.country === 'ng' || s.country === 'gh') {
        setCountry(s.country);
        localStorage.setItem('ui:country', s.country);
      }
      if (s.url && typeof s.url === 'string' && s.url !== 'about:blank') {
        setUrl(s.url);
        localStorage.setItem('ui:url', s.url);
      }
      if (s.oddsSel) {
        setOddsSel(s.oddsSel);
        localStorage.setItem('ui:oddsSel', s.oddsSel);
      }
      if (s.stakeSel) {
        setStakeSel(s.stakeSel);
        localStorage.setItem('ui:stakeSel', s.stakeSel);
      }
    }).catch(() => {});

    const t = setTimeout(async () => {
      try {
        if (localStorage.getItem('ui:count') !== null && count !== 5) {
          await window.api.setCount(count);
        }
        const states = await window.api.getPaneStates().catch(() => null);
        if (Array.isArray(states) && states.length) {
          setPaneStates(states);
          const act = states.find((p) => p.active) || states[0];
          if (act?.url && act.url !== 'about:blank') setUrl(act.url);
        }
        const cur = await window.api.getCurrentUrl();
        if (!cur || cur === 'about:blank') {
          const initial = (url || '').trim() || `https://www.sportybet.com/${country}/m/`;
          const loaded = await window.api.load({ url: initial, scope: 'all' });
          setUrl(loaded);
        }
      } catch (_) {}
      if (autoUpdate) window.api.profitAuto(buildCfg());
    }, 350);
    return () => clearTimeout(t);
  }, []);

  // Subscribe to IPC events from main process
  useEffect(() => {
    const unsubs = [
      window.api.onProfit((rows) => {
        if (Array.isArray(rows)) setProfitRows(rows);
      }),
      window.api.onPaneStates((states) => {
        if (Array.isArray(states)) {
          setPaneStates(states);
          const editingUrl = document.activeElement?.classList?.contains('inp-url');
          if (!editingUrl) {
            const act = states.find((p) => p.active) || states[0];
            if (act?.url && act.url !== 'about:blank') setUrl(act.url);
          }
        }
      }),
      window.api.onZoom((z) => setZoom(z)),
      window.api.onLoadError((msg) => setStatusMsg(msg)),
      window.api.onAccStatus((d) => {
        if (d && d.msg) {
          setStatusMsg(d.msg);
          setLogs((prev) => [
            ...prev.slice(-200),
            { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), text: d.msg },
          ]);
          if (/confirmed|placed|accepted/i.test(d.msg)) {
            setTodayBets((b) => {
              const next = b + 1;
              localStorage.setItem('ui:todayBets', String(next));
              return next;
            });
          }
        }
      }),
      window.api.onMonitorState && window.api.onMonitorState((open) => setBetanoOpen(!!open)),
      window.api.onMonitorConfig && window.api.onMonitorConfig((cfg) => {
        if (!cfg || typeof cfg !== 'object') return;
        setBetanoConfig(cfg);
        setBetanoOpen(!!cfg.open);
        const { open: _o, ...prefs } = cfg;
        localStorage.setItem('ui:betanoCfg', JSON.stringify(prefs));
      }),
      window.api.onStakeSynced && window.api.onStakeSynced((stk) => {
        setProfitRows((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) {
            return (paneStates.length ? paneStates : [1, 2, 3, 4, 5]).map(() => ({ stake: stk, ok: true }));
          }
          return prev.map((r) => ({ ...r, stake: stk, ok: true }));
        });
        setStatusMsg(`Stake synced across panes: ${stk}`);
      }),
      window.api.onAutoRebetState && window.api.onAutoRebetState((state) => {
        if (!state || typeof state !== 'object') return;
        setAutoRebetState(state);
        if (state.status) setStatusMsg(state.status);
      }),
      window.api.onPicked && window.api.onPicked((p) => {
        if (!p) return;
        const val = p.selector || '';
        if (p.kind === 'odds') {
          setOddsSel(val);
          localStorage.setItem('ui:oddsSel', val);
          setStatusMsg(`Picked odds: "${p.sample}"`);
          if (autoUpdate) window.api.profitAuto(buildCfg({ oddsSel: val }));
        } else {
          setStakeSel(val);
          localStorage.setItem('ui:stakeSel', val);
          setStatusMsg(`Picked stake box: ${p.tag}`);
          if (autoUpdate) window.api.profitAuto(buildCfg({ stakeSel: val }));
        }
      }),
      window.api.onLayoutGeometry && window.api.onLayoutGeometry((geom) => {
        if (geom && typeof geom === 'object') setLayoutGeometry(geom);
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [autoUpdate, buildCfg]);

  // Keep auto profit config synced
  useEffect(() => {
    const t = setTimeout(() => {
      window.api.profitAuto(autoUpdate ? buildCfg() : null);
    }, 300);
    return () => clearTimeout(t);
  }, [autoUpdate, oddsSel, stakeSel, whole, buildCfg]);

  // Global Keyboard Shortcuts (Space = Rapid Attack, Enter = Rebet, Escape = Stop, Alt+C = Cashout)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && autoRebetState.running) {
        e.preventDefault();
        window.api.stopAutoRebet && window.api.stopAutoRebet();
        return;
      }
      if (!hotkeysEnabled || e.repeat) return;
      const tag = document.activeElement?.tagName;
      const isControl = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag) || (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement);
      if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        if (!isControl) {
          e.preventDefault();
          if (autoRebetState.running) {
            if (autoRebetOnSpace) handleStopAutoRebet();
            // In Single Bet mode, ignore extra Spacebar presses while a pass/step is in-flight
          } else if (autoRebetOnSpace) {
            handleStartAutoRebet('Hotkey: Spacebar (UI - Rapid Attack)');
          } else {
            handlePlaceBet('Hotkey: Spacebar (UI - Single Bet)');
          }
        }
      } else if ((e.key === 'Enter' || e.code === 'NumpadEnter') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        if (!isControl) {
          event?.preventDefault ? event.preventDefault() : e.preventDefault();
          if (!autoRebetOnSpace) {
            // Single Bet mode: Enter triggers manual Rebet (repeating last placed bet)
            handleRebet();
          }
        }
      } else if ((e.altKey && e.key.toLowerCase() === 'c') || e.key === 'F9') {
        e.preventDefault();
        window.api.cashoutAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeysEnabled, autoRebetState.running, autoRebetOnSpace, autoRebetCycles]);

  const handleSwitchCountry = async (next) => {
    const c = next === 'gh' ? 'gh' : 'ng';
    setCountry(c);
    localStorage.setItem('ui:country', c);
    const res = await window.api.setCountry(c);
    if (res && res.url) {
      setUrl(res.url);
      localStorage.setItem('ui:url', res.url);
    }
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ country: c, url: res?.url });
    }
    setStatusMsg(c === 'gh' ? 'All panes -> Ghana (/gh) - Target GH₵200' : 'All panes -> Nigeria (/ng) - Target ₦7,500');
  };

  const handleSetPaneProfile = async (index, patch) => {
    const res = await window.api.setPaneProfile({ index, ...patch });
    if (res && res.url && index === activePaneIndex) {
      setUrl(res.url);
      localStorage.setItem('ui:url', res.url);
    }
    if (res) {
      const siteName = res.site === 'football' ? 'Football.com' : 'SportyBet';
      const cTag = (res.country || 'ng').toUpperCase();
      setStatusMsg(`W${index + 1} -> ${siteName} (${cTag})`);
    }
  };

  const handleToggleUrlScope = () => {
    const next = urlScope === 'active' ? 'all' : 'active';
    setUrlScope(next);
    localStorage.setItem('ui:urlScope', next);
    setStatusMsg(next === 'active' ? `URL bar targets W${activePaneIndex + 1} only` : 'URL bar targets All panes');
  };

  const handleLoadUrl = async () => {
    const activePane = paneStates[activePaneIndex];
    const fallbackSite = activePane?.site === 'football' ? 'football.com' : 'sportybet.com';
    const fallbackCountry = activePane?.country || country;
    let raw = url.trim();
    if (!raw) {
      raw = `https://www.${fallbackSite}/${fallbackCountry}/m/`;
    }
    const loaded = await window.api.load({ url: raw, scope: urlScope });
    setUrl(loaded);
    localStorage.setItem('ui:url', loaded);
    if (urlScope === 'all') {
      if (/\/gh(\/|$|\?)/i.test(loaded)) {
        setCountry('gh');
        localStorage.setItem('ui:country', 'gh');
      } else if (/\/ng(\/|$|\?)/i.test(loaded)) {
        setCountry('ng');
        localStorage.setItem('ui:country', 'ng');
      }
    }
    setStatusMsg(urlScope === 'active' ? `Loaded on W${activePaneIndex + 1}: ${loaded}` : `Loaded all: ${loaded}`);
  };

  const handleCountChange = async (val) => {
    const parsed = Math.min(8, Math.max(1, parseInt(val, 10) || 1));
    setCount(parsed);
    localStorage.setItem('ui:count', String(parsed));
    const n = await window.api.setCount(parsed);
    setCount(n);
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ windowCount: n, count: n });
    }
    setStatusMsg(`${n} pane${n === 1 ? '' : 's'} active`);
  };

  const handleLayoutChange = async (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('ui:layout', mode);
    await window.api.setLayout(mode);
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ layoutMode: mode, layout: mode });
    }
    setStatusMsg(`Layout: ${mode}`);
  };

  const handleToggleMirror = () => {
    const next = !mirror;
    setMirror(next);
    localStorage.setItem('ui:mirror', next ? '1' : '0');
    window.api.setOptions({ mirror: next, typing });
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ mirror: next });
    }
  };

  const handleToggleAutoAcceptOdds = async () => {
    const next = !autoAcceptOdds;
    setAutoAcceptOdds(next);
    localStorage.setItem('ui:autoAcceptOdds', next ? '1' : '0');
    if (window.api && window.api.toggleAutoAcceptOdds) {
      await window.api.toggleAutoAcceptOdds();
    } else if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ autoAcceptOdds: next });
    }
    setStatusMsg(next ? 'Auto-Accept Odds: ON (idle slips update odds automatically, no bet placed)' : 'Auto-Accept Odds: OFF');
  };

  const handleToggleTyping = () => {
    const next = !typing;
    setTyping(next);
    localStorage.setItem('ui:typing', next ? '1' : '0');
    window.api.setOptions({ mirror, typing: next });
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ typing: next });
    }
  };

  const handleTargetGH = (val) => {
    setTargetGH(val);
    localStorage.setItem('ui:targetGH', val);
    const num = parseFloat(val);
    if (num > 0) {
      window.api.setTargets({ gh: num, ng: parseFloat(targetNG) || 7500 });
      if (window.api && window.api.saveUserSettings) {
        window.api.saveUserSettings({ profitTargets: { gh: num, ng: parseFloat(targetNG) || 7500 } });
      }
    }
  };

  const handleTargetNG = (val) => {
    setTargetNG(val);
    localStorage.setItem('ui:targetNG', val);
    const num = parseFloat(val);
    if (num > 0) {
      window.api.setTargets({ gh: parseFloat(targetGH) || 200, ng: num });
      if (window.api && window.api.saveUserSettings) {
        window.api.saveUserSettings({ profitTargets: { gh: parseFloat(targetGH) || 200, ng: num } });
      }
    }
  };

  const handleUpdateRebetConfig = async (patch) => {
    setRebetConfig((prev) => {
      const merged = { ...prev, ...patch };
      if (patch.decrementNG != null) localStorage.setItem('ui:rebetDecNG', String(patch.decrementNG));
      if (patch.decrementGH != null) localStorage.setItem('ui:rebetDecGH', String(patch.decrementGH));
      if (patch.mode != null) localStorage.setItem('ui:rebetDecMode', patch.mode);
      return merged;
    });
    if (window.api.setRebetDecrement) {
      await window.api.setRebetDecrement(patch);
    }
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ rebetConfig: patch });
    }
  };

  const handleAutoRebetCycles = (val) => {
    setAutoRebetCycles(val);
    localStorage.setItem('ui:autoRebetCycles', String(val));
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ autoRebetCycles: val });
    }
  };

  const handleStartAutoRebet = async (src = 'UI Header: Rapid Attack Button') => {
    const cyc = autoRebetCycles === 'inf' ? 'inf' : (parseInt(autoRebetCycles, 10) || 1);
    setStatusMsg(`Rapid Attack running (${cyc} cycle${cyc === 1 ? '' : 's'})...`);
    if (window.api.startAutoRebet) {
      await window.api.startAutoRebet(cyc, src);
    }
  };

  const handlePlaceBet = async (src = 'UI Header: Place Bet Button') => {
    if (window.api && window.api.triggerSingleBetSpacebar) {
      await window.api.triggerSingleBetSpacebar(src);
    } else if (window.api && window.api.placeBet) {
      await window.api.placeBet();
    }
  };

  const handleSingleBetClickModeChange = async (mode) => {
    if (mode !== '1-click' && mode !== '2-click') return;
    setSingleBetClickMode(mode);
    localStorage.setItem('ui:singleBetClickMode', mode);
    if (window.api && window.api.setSingleBetClickMode) {
      await window.api.setSingleBetClickMode(mode);
    }
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ singleBetClickMode: mode });
    }
    setStatusMsg(
      mode === '2-click'
        ? 'Single Bet mode: 2-Click (Space 1 = Place Bet, Space 2 = Confirm)'
        : 'Single Bet mode: 1-Click (Space = Place Bet → Confirm)'
    );
  };

  const handleStopAutoRebet = async () => {
    setStatusMsg('Stopping Rapid Attack...');
    if (window.api.stopAutoRebet) {
      await window.api.stopAutoRebet();
    }
  };

  const handleToggleAutoRebetOnSpace = async () => {
    const next = !autoRebetOnSpace;
    setAutoRebetOnSpace(next);
    localStorage.setItem('ui:autoRebetOnSpace', next ? '1' : '0');
    if (window.api.setAutoRebetOnSpace) {
      await window.api.setAutoRebetOnSpace(next);
    }
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ autoRebetOnSpace: next });
    }
    setStatusMsg(next ? 'Spacebar armed: Rapid Attack enabled' : 'Spacebar set to Single Bet (no rebet)');
  };

  const handleToggleWhole = () => {
    const next = !whole;
    setWhole(next);
    localStorage.setItem('ui:whole', next ? '1' : '0');
    if (window.api && window.api.setWholeStake) {
      window.api.setWholeStake(next);
    } else if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ whole: next });
    }
  };

  const handleSyncNow = async () => {
    setAutoUpdate(true);
    setStatusMsg('Syncing stakes across panes...');
    const res = await window.api.applyProfit(buildCfg());
    if (Array.isArray(res)) setProfitRows(res);
    setStatusMsg('Stakes synced. Auto Stake active.');
  };

  const handleMinStake = async () => {
    setAutoUpdate(false);
    setStatusMsg('Setting min stake across panes...');
    const res = await window.api.applyMinStake(buildCfg());
    if (Array.isArray(res)) setProfitRows(res);
    setStatusMsg('Min stake set | Auto Stake paused');
  };

  const handleToggleHotkeys = async () => {
    const next = !hotkeysEnabled;
    setHotkeysEnabled(next);
    localStorage.setItem('ui:hotkeys', next ? '1' : '0');
    await window.api.setHotkeysEnabled(next);
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ hotkeysEnabled: next });
    }
    setStatusMsg(next ? 'Hotkeys enabled (Enter = Single Bet, Space = Mode Action, Alt+C = Cashout)' : 'Hotkeys disabled');
  };

  const handleRebet = async () => {
    setStatusMsg('Executing Rebet across panes...');
    const r = await window.api.rebet();
    setStatusMsg(
      r.rebetCount > 0
        ? `Rebet clicked on ${r.rebetCount}/${r.total} pane(s)`
        : 'No Rebet button found'
    );
  };

  const handleCashoutAll = async () => {
    setStatusMsg('Scanning Open Bets & cashing out tickets...');
    const r = await window.api.cashoutAll();
    setStatusMsg(
      r.total > 0
        ? `Cashout confirmed on ${r.total} ticket(s)`
        : 'No open cashout tickets ready'
    );
  };

  const handleToggleBalanceAwareStake = async () => {
    const next = !balanceAwareStake;
    setBalanceAwareStake(next);
    localStorage.setItem('ui:balanceAware', next ? '1' : '0');
    if (window.api && window.api.setBalanceAwareStake) {
      await window.api.setBalanceAwareStake(next);
    }
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ balanceAwareStake: next });
    }
    setStatusMsg(next ? 'Auto Balance-Cap Stake enabled: uses full account balance until odds rise' : 'Auto Balance-Cap Stake disabled');
  };

  const handleToggleWindowSync = () => {
    setWindowSync((w) => {
      const next = !w;
      localStorage.setItem('ui:windowSync', next ? '1' : '0');
      if (window.api && window.api.saveUserSettings) {
        window.api.saveUserSettings({ windowSync: next });
      }
      return next;
    });
  };

  const handleToggleAutoAlign = () => {
    setAutoAlign((a) => {
      const next = !a;
      localStorage.setItem('ui:autoAlign', next ? '1' : '0');
      if (window.api && window.api.saveUserSettings) {
        window.api.saveUserSettings({ autoAlign: next });
      }
      return next;
    });
  };

  const handleTileSizeChange = (val) => {
    setTileSize(val);
    localStorage.setItem('ui:tileSize', String(val));
    const z = Math.round(val) / 100;
    setZoom(z);
    window.api.zoom(z);
    if (window.api && window.api.saveUserSettings) {
      window.api.saveUserSettings({ zoom: z, tileSize: val });
    }
  };

  const handleNavigateHome = async (idx) => {
    const p = paneStates[idx] || {};
    const country = p.country || 'ng';
    const homeUrl = `https://www.sportybet.com/${country}/m/`;
    await window.api.load({ url: homeUrl, scope: 'active' });
    setStatusMsg(`W${idx + 1} navigated to SportyBet home`);
  };

  const handleSyncPane = async (_idx) => {
    handleSyncNow();
  };

  const handleReloadPane = async (index) => {
    setStatusMsg(`Reloading W${index + 1}...`);
    await window.api.reloadPane(index);
    setStatusMsg(`W${index + 1} reloaded`);
  };

  const handleToggleBetano = async () => {
    const open = await window.api.toggleMonitor();
    setBetanoOpen(open);
    const label = (betanoConfig?.site === 'betpawa') ? 'betPawa' : 'Betano';
    setStatusMsg(open ? `${label} monitor opened` : `${label} monitor closed`);
  };

  const handleUpdateBetanoConfig = async (patch) => {
    const updated = await window.api.setMonitorConfig(patch);
    if (updated && typeof updated === 'object') {
      setBetanoConfig((prev) => ({ ...prev, ...updated }));
      setBetanoOpen(!!updated.open);
      const { open: _o, ...prefs } = updated;
      localStorage.setItem('ui:betanoCfg', JSON.stringify(prefs));
    }
  };

  const handleZoomBetano = async (action) => {
    const updated = await window.api.zoomMonitor(action);
    if (updated && typeof updated === 'object') {
      setBetanoConfig((prev) => ({ ...prev, ...updated }));
      const { open: _o, ...prefs } = updated;
      localStorage.setItem('ui:betanoCfg', JSON.stringify(prefs));
    }
  };

  const handleUpdateCashoutConfig = async (patch) => {
    const merged = { ...cashoutConfig, ...patch };
    setCashoutConfig(merged);
    localStorage.setItem('ui:cashoutCfg', JSON.stringify(merged));
    const savedCfg = await window.api.setCashoutConfig(merged);
    if (savedCfg && typeof savedCfg === 'object') {
      setCashoutConfig(savedCfg);
      localStorage.setItem('ui:cashoutCfg', JSON.stringify(savedCfg));
    }
  };

  const activePaneIndex = Math.max(0, paneStates.findIndex((p) => p.active));
  const distinctCountries = Array.from(new Set(paneStates.map((p) => p.country).filter(Boolean)));
  const countryStatus = distinctCountries.length > 1 ? 'mixed' : (distinctCountries[0] || country);
  const distinctSites = Array.from(new Set(paneStates.map((p) => p.site).filter(Boolean)));
  const siteStatus = distinctSites.length > 1 ? 'mixed' : (distinctSites[0] || 'sportybet');
  const hasGh = distinctCountries.length ? distinctCountries.includes('gh') : country === 'gh';
  const hasNg = distinctCountries.length ? distinctCountries.includes('ng') : country === 'ng';

  const handleSwitchSite = async (targetSite) => {
    const s = targetSite === 'football' ? 'football' : 'sportybet';
    for (let i = 0; i < count; i++) {
      await handleSetPaneProfile(i, { site: s });
    }
    setStatusMsg(`All panes -> ${s === 'football' ? 'Football.com' : 'SportyBet'}`);
  };

  const handlePaneLogin = async (idx) => {
    // When user clicks Login on a pane in /software, direct them to /accounts view
    navigateTo('accounts');
  };

  return (
    <div className="app-layout-root">
      {/* ─── Persistent Slim Top Navigation (All Routes) ─── */}
      <AppNav
        currentRoute={route}
        onNavigate={navigateTo}
        onOpenGuide={handleOpenGuide}
        autoRebetState={autoRebetState}
        todayBets={todayBets}
        todayTotal={todayTotal}
        mirror={mirror}
        onToggleMirror={handleToggleMirror}
        autoAcceptOdds={autoAcceptOdds}
        onToggleAutoAcceptOdds={handleToggleAutoAcceptOdds}
        statusMsg={statusMsg}
        updateStatus={updateStatus}
        onInstallUpdate={handleInstallUpdate}
      />

      {/* ─── Route: /software (Main Pane Workspace) ─── */}
      {route === 'software' && (
        <div ref={shellRef} className="software-workspace">
          <SoftwareToolbar
            url={url}
            urlScope={urlScope}
            activePaneIndex={activePaneIndex}
            onToggleUrlScope={handleToggleUrlScope}
            onUrlChange={(val) => {
              setUrl(val);
              localStorage.setItem('ui:url', val);
            }}
            onLoadUrl={handleLoadUrl}
            onBack={() => window.api.back(urlScope)}
            onReload={() => window.api.reload(urlScope)}
            count={count}
            onCountChange={handleCountChange}
            hasGh={hasGh}
            hasNg={hasNg}
            targetGH={targetGH}
            targetNG={targetNG}
            onTargetGHChange={handleTargetGH}
            onTargetNGChange={handleTargetNG}
            autoUpdate={autoUpdate}
            onToggleAutoUpdate={() => setAutoUpdate((a) => !a)}
            onSyncNow={handleSyncNow}
            onMinStake={handleMinStake}
            rebetActive={autoRebetState.running}
            autoRebetState={autoRebetState}
            autoRebetOnSpace={autoRebetOnSpace}
            onStartAutoRebet={handleStartAutoRebet}
            onStopAutoRebet={handleStopAutoRebet}
            onPlaceBet={handlePlaceBet}
            onRebet={handleRebet}
            onCashoutAll={handleCashoutAll}
          />

          <PaneStrip
            paneStates={paneStates}
            profitRows={profitRows}
            layoutGeometry={layoutGeometry}
            monitorConfig={betanoConfig}
            betanoOpen={betanoOpen}
            onToggleBetano={handleToggleBetano}
            onFocusPane={(idx) => window.api.focusPane(idx)}
            onSetPaneProfile={handleSetPaneProfile}
            onReloadPane={handleReloadPane}
            onNavigateHome={handleNavigateHome}
            onSyncPane={handleSyncPane}
            onOpenLogin={handlePaneLogin}
            statusMsg={statusMsg}
          />
        </div>
      )}

      {/* ─── Route: /accounts (Full-Page View) ─── */}
      {route === 'accounts' && (
        <AccountsPage
          count={count}
          paneStates={paneStates}
          onSetPaneProfile={handleSetPaneProfile}
          onNavigateHome={handleNavigateHome}
        />
      )}

      {/* ─── Route: /settings (Full-Page View) ─── */}
      {route === 'settings' && (
        <SettingsPage
          mirror={mirror}
          onToggleMirror={handleToggleMirror}
          typing={typing}
          onToggleTyping={handleToggleTyping}
          windowSync={windowSync}
          onToggleWindowSync={handleToggleWindowSync}
          autoAlign={autoAlign}
          onToggleAutoAlign={handleToggleAutoAlign}
          tileSize={tileSize}
          onTileSizeChange={handleTileSizeChange}
          layoutMode={layoutMode}
          onLayoutChange={handleLayoutChange}
          zoom={zoom}
          onZoom={(act) => window.api.zoom(act)}
          siteStatus={siteStatus}
          onSwitchSite={handleSwitchSite}
          countryStatus={countryStatus}
          onSwitchCountry={handleSwitchCountry}
          rebetConfig={rebetConfig}
          onUpdateRebetConfig={handleUpdateRebetConfig}
          autoRebetOnSpace={autoRebetOnSpace}
          onToggleAutoRebetOnSpace={handleToggleAutoRebetOnSpace}
          singleBetClickMode={singleBetClickMode}
          onSingleBetClickModeChange={handleSingleBetClickModeChange}
          autoRebetCycles={autoRebetCycles}
          onAutoRebetCyclesChange={handleAutoRebetCycles}
          balanceAwareStake={balanceAwareStake}
          onToggleBalanceAwareStake={handleToggleBalanceAwareStake}
          whole={whole}
          onToggleWhole={handleToggleWhole}
          hotkeysEnabled={hotkeysEnabled}
          onToggleHotkeys={handleToggleHotkeys}
          oddsSel={oddsSel}
          stakeSel={stakeSel}
          onOddsSelChange={(v) => {
            setOddsSel(v);
            localStorage.setItem('ui:oddsSel', v);
            if (window.api && window.api.saveUserSettings) {
              window.api.saveUserSettings({ oddsSel: v });
            }
          }}
          onStakeSelChange={(v) => {
            setStakeSel(v);
            localStorage.setItem('ui:stakeSel', v);
            if (window.api && window.api.saveUserSettings) {
              window.api.saveUserSettings({ stakeSel: v });
            }
          }}
          onPickOdds={() => {
            window.api.pick('odds');
            setStatusMsg('Click the odds number inside any betslip');
          }}
          onPickStake={() => {
            window.api.pick('stake');
            setStatusMsg('Click the stake input inside any betslip');
          }}
          betanoConfig={betanoConfig}
          onUpdateBetanoConfig={handleUpdateBetanoConfig}
          onReloadBetano={() => window.api.reloadMonitor()}
          onZoomBetano={handleZoomBetano}
          betanoOpen={betanoOpen}
          onToggleBetano={handleToggleBetano}
          cashoutConfig={cashoutConfig}
          onUpdateCashoutConfig={handleUpdateCashoutConfig}
          logs={logs}
          onClearLogs={() => setLogs([])}
          onOpenGuide={handleOpenGuide}
          updateStatus={updateStatus}
          onCheckForUpdates={handleCheckForUpdates}
          onInstallUpdate={handleInstallUpdate}
        />
      )}

      {/* ─── Notification Board Modal (Onboarding & Best Practices) ─── */}
      <NotificationBoard
        isOpen={showGuide}
        onClose={handleCloseGuide}
        onNavigateSettings={() => navigateTo('settings')}
      />
    </div>
  );
}
