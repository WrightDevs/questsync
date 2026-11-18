import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  Plus,
  Minus,
  Crosshair,
  Trash2,
  Copy,
  Search,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  Monitor,
  Check,
  SlidersHorizontal,
  BookOpen,
  DownloadCloud,
  ArrowDownCircle,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage({
  // Sync
  mirror,
  onToggleMirror,
  typing,
  onToggleTyping,
  windowSync = true,
  onToggleWindowSync,
  autoAlign = true,
  onToggleAutoAlign,

  // Layout
  tileSize = 60,
  onTileSizeChange,
  layoutMode = 'auto',
  onLayoutChange,
  zoom = 1,
  onZoom,
  siteStatus = 'sportybet',
  onSwitchSite,
  countryStatus = 'ng',
  onSwitchCountry,

  // Betting Defaults
  rebetConfig = { decrementNG: 10, decrementGH: 1.0, mode: 'fixed' },
  onUpdateRebetConfig,
  autoRebetOnSpace = true,
  onToggleAutoRebetOnSpace,
  autoRebetCycles = 3,
  onAutoRebetCyclesChange,
  balanceAwareStake = true,
  onToggleBalanceAwareStake,
  whole = true,
  onToggleWhole,
  hotkeysEnabled = true,
  onToggleHotkeys,
  oddsSel = '',
  stakeSel = '',
  onOddsSelChange,
  onStakeSelChange,
  onPickOdds,
  onPickStake,

  // Monitor
  betanoConfig = {},
  onUpdateBetanoConfig,
  onReloadBetano,
  onZoomBetano,
  betanoOpen = false,
  onToggleBetano,
  degenArmed = false,
  onToggleDegen,

  // Cashout
  autoCashout = false,
  onToggleAutoCashout,
  cashoutConfig = {},
  onUpdateCashoutConfig,

  // Logs
  logs = [],
  onClearLogs,
  onOpenGuide,

  // Updates
  updateStatus = { status: 'idle' },
  onCheckForUpdates,
  onInstallUpdate,
}) {
  const [logFilter, setLogFilter] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const logContainerRef = useRef(null);

  const mSite = betanoConfig?.site || 'betano';
  const bMode = betanoConfig?.mode || 'dock';
  const bSide = betanoConfig?.side || 'right';
  const bWidth = betanoConfig?.width ?? 340;
  const bZoom = betanoConfig?.zoom ?? 0.9;
  const bMobileUA = betanoConfig?.mobileUA !== false;

  const cAutoNav = cashoutConfig?.autoNavOpenBets !== false;
  const cDisarm = !!cashoutConfig?.disarmOnHit;
  const cPoll = cashoutConfig?.pollMs ?? 1200;

  const filteredLogs = logs.filter((l) =>
    logFilter ? l.text?.toLowerCase().includes(logFilter.toLowerCase()) : true
  );

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyNotice('Logs copied to clipboard');
      setTimeout(() => setCopyNotice(''), 2000);
    });
  };

  return (
    <div className="full-page-view settings-page">
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Settings &amp; Configuration</h1>
          <p className="page-description">
            Customize synchronization engines, display layout, odds benchmark monitors, and automated betting defaults.
          </p>
        </div>
        {onOpenGuide && (
          <div className="page-header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenGuide}
              title="Open Operator Guide & Quick Start"
            >
              <BookOpen size={14} />
              <span>Operator Guide</span>
            </button>
          </div>
        )}
      </div>

      <div className="settings-grid">
        {/* ─── 1. Sync & Mirroring ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <RotateCw size={14} className="card-title-icon" />
              <span className="card-title">Sync &amp; Mirroring</span>
            </div>
            <span className="card-subtitle">Real-time cross-window coordination</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Window Sync</span>
                <span className="row-desc">Align odds and bet selections across panes automatically</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${windowSync ? 'is-on' : ''}`}
                onClick={onToggleWindowSync}
              >
                <span className="indicator" />
                <span>{windowSync ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Auto-Align Stakes</span>
                <span className="row-desc">Continuously compute exact stake per pane to match profit targets</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${autoAlign ? 'is-on' : ''}`}
                onClick={onToggleAutoAlign}
              >
                <span className="indicator" />
                <span>{autoAlign ? 'E-1100 ON' : 'Disabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Click Mirroring</span>
                <span className="row-desc">Replicate mouse clicks and selection actions across panes</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${mirror ? 'is-on' : ''}`}
                onClick={onToggleMirror}
              >
                <span className="indicator" />
                <span>{mirror ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Keystroke Mirroring</span>
                <span className="row-desc">Replicate keyboard input across panes (use with caution)</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${typing ? 'is-on warn' : ''}`}
                onClick={onToggleTyping}
              >
                <span className="indicator" />
                <span>{typing ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── 2. Layout & Display ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <Layers size={14} className="card-title-icon" />
              <span className="card-title">Layout &amp; Display</span>
            </div>
            <span className="card-subtitle">Grid dimensions, tile scale, and zoom</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Tile Size / Scale</span>
                <span className="row-desc">Adjust viewport scaling factor across all pane webviews</span>
              </div>
              <div className="slider-control-group">
                <input
                  type="range"
                  min="40"
                  max="100"
                  step="5"
                  value={tileSize}
                  onChange={(e) => onTileSizeChange?.(parseInt(e.target.value, 10))}
                  className="settings-slider"
                />
                <span className="slider-value-pill">{tileSize}%</span>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Layout Mode</span>
                <span className="row-desc">Arrange account panes horizontally or in a multi-row grid</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${layoutMode === 'auto' ? 'active' : ''}`}
                  onClick={() => onLayoutChange('auto')}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={`seg-btn ${layoutMode === 'row' ? 'active' : ''}`}
                  onClick={() => onLayoutChange('row')}
                >
                  Row
                </button>
                <button
                  type="button"
                  className={`seg-btn ${layoutMode === 'grid' ? 'active' : ''}`}
                  onClick={() => onLayoutChange('grid')}
                >
                  Grid
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">SportyBet Zoom</span>
                <span className="row-desc">Fine-tune inner webview rendering zoom factor</span>
              </div>
              <div className="seg-group">
                <button type="button" className="seg-btn" onClick={() => onZoom('out')} title="Zoom Out">
                  <Minus size={12} />
                </button>
                <button
                  type="button"
                  className="seg-btn"
                  style={{ minWidth: '45px' }}
                  onClick={() => onZoom('reset')}
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button type="button" className="seg-btn" onClick={() => onZoom('in')} title="Zoom In">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Global Site Default</span>
                <span className="row-desc">Quickly point all panes to SportyBet or Football.com</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${siteStatus === 'sportybet' ? 'active' : ''}`}
                  onClick={() => onSwitchSite?.('sportybet')}
                >
                  SportyBet
                </button>
                <button
                  type="button"
                  className={`seg-btn ${siteStatus === 'football' ? 'active' : ''}`}
                  onClick={() => onSwitchSite?.('football')}
                >
                  Football.com
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Global Country Default</span>
                <span className="row-desc">Switch all panes between Nigeria and Ghana</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${countryStatus === 'ng' ? 'active' : ''}`}
                  onClick={() => onSwitchCountry?.('ng')}
                >
                  Nigeria (NG)
                </button>
                <button
                  type="button"
                  className={`seg-btn ${countryStatus === 'gh' ? 'active' : ''}`}
                  onClick={() => onSwitchCountry?.('gh')}
                >
                  Ghana (GH)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3. Betting Defaults & Calculations ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <SlidersHorizontal size={14} className="card-title-icon" />
              <span className="card-title">Betting Defaults &amp; Math</span>
            </div>
            <span className="card-subtitle">Stake decrement rules, cycle targets, and hotkey bindings</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Nigeria Stake Step (-₦)</span>
                <span className="row-desc">Amount decremented per rebet cycle on Nigerian accounts</span>
              </div>
              <input
                className="inp inp-num"
                type="number"
                min={1}
                step={5}
                value={rebetConfig.decrementNG || 10}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0) onUpdateRebetConfig({ decrementNG: v });
                }}
              />
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Ghana Stake Step (-GH₵)</span>
                <span className="row-desc">Amount decremented per rebet cycle on Ghanaian accounts</span>
              </div>
              <input
                className="inp inp-num"
                type="number"
                min={0.1}
                step={0.5}
                value={rebetConfig.decrementGH || 1.0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0) onUpdateRebetConfig({ decrementGH: v });
                }}
              />
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Decrement Mode</span>
                <span className="row-desc">Fixed uniform deduction or tiered steps for large amounts</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${rebetConfig.mode !== 'tiered' ? 'active' : ''}`}
                  onClick={() => onUpdateRebetConfig({ mode: 'fixed' })}
                >
                  Fixed Step
                </button>
                <button
                  type="button"
                  className={`seg-btn ${rebetConfig.mode === 'tiered' ? 'active' : ''}`}
                  onClick={() => onUpdateRebetConfig({ mode: 'tiered' })}
                >
                  Tiered
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Rapid Attack Cycles</span>
                <span className="row-desc">Number of consecutive Place Bet → Confirm → Rebet cycles</span>
              </div>
              <input
                className="inp inp-num"
                type="number"
                min={1}
                max={99}
                value={autoRebetCycles}
                onChange={(e) => onAutoRebetCyclesChange(e.target.value)}
              />
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Spacebar Rapid Attack</span>
                <span className="row-desc">Hitting Spacebar triggers full Rapid Attack cycles</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${autoRebetOnSpace ? 'is-on' : ''}`}
                onClick={onToggleAutoRebetOnSpace}
              >
                <span className="indicator" />
                <span>{autoRebetOnSpace ? 'Armed' : 'Single Bet'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Balance-Aware Stake</span>
                <span className="row-desc">If calculated stake exceeds account balance, use full account balance</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${balanceAwareStake !== false ? 'is-on' : ''}`}
                onClick={onToggleBalanceAwareStake}
              >
                <span className="indicator" />
                <span>{balanceAwareStake !== false ? 'Auto Balance-Cap' : 'Disabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Whole Stakes</span>
                <span className="row-desc">Round computed stakes down to whole integers</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${whole ? 'is-on' : ''}`}
                onClick={onToggleWhole}
              >
                <span className="indicator" />
                <span>{whole ? 'Whole Only' : 'Decimals Allowed'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Global Hotkeys</span>
                <span className="row-desc">Space = Rapid Attack, Enter = Rebet, Alt+C = Cashout</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${hotkeysEnabled ? 'is-on' : ''}`}
                onClick={onToggleHotkeys}
              >
                <span className="indicator" />
                <span>{hotkeysEnabled ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── 4. Odds Benchmark Monitor ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <Monitor size={14} className="card-title-icon" />
              <span className="card-title">Odds Benchmark Monitor ({mSite})</span>
            </div>
            <span className="card-subtitle">Docked sidebar or floating companion window for live reference odds</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Monitor Provider</span>
                <span className="row-desc">Select benchmark site for odds comparison</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${mSite === 'betano' ? 'active' : ''}`}
                  onClick={() => onUpdateBetanoConfig({ site: 'betano' })}
                >
                  Betano
                </button>
                <button
                  type="button"
                  className={`seg-btn ${mSite === 'betpawa' ? 'active' : ''}`}
                  onClick={() => onUpdateBetanoConfig({ site: 'betpawa' })}
                >
                  betPawa
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Monitor Display State</span>
                <span className="row-desc">Show or hide the odds monitor panel</span>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${betanoOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={onToggleBetano}
              >
                <span>{betanoOpen ? `Hide ${mSite}` : `Show ${mSite}`}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Window Mode</span>
                <span className="row-desc">Dock inside main workspace or float as an independent window</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${bMode === 'dock' ? 'active' : ''}`}
                  onClick={() => onUpdateBetanoConfig({ mode: 'dock' })}
                >
                  Docked
                </button>
                <button
                  type="button"
                  className={`seg-btn ${bMode === 'float' ? 'active' : ''}`}
                  onClick={() => onUpdateBetanoConfig({ mode: 'float' })}
                >
                  Floating
                </button>
              </div>
            </div>

            {bMode === 'dock' && (
              <div className="settings-row">
                <div className="row-info">
                  <span className="row-title">Dock Position &amp; Width</span>
                  <span className="row-desc">Sidebar placement and pixel width</span>
                </div>
                <div className="dock-controls-group">
                  <div className="seg-group">
                    <button
                      type="button"
                      className={`seg-btn ${bSide === 'left' ? 'active' : ''}`}
                      onClick={() => onUpdateBetanoConfig({ side: 'left' })}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${bSide === 'right' ? 'active' : ''}`}
                      onClick={() => onUpdateBetanoConfig({ side: 'right' })}
                    >
                      Right
                    </button>
                  </div>
                  <input
                    type="range"
                    min={260}
                    max={520}
                    step={20}
                    value={bWidth}
                    onChange={(e) => onUpdateBetanoConfig({ width: parseInt(e.target.value, 10) })}
                    className="settings-slider"
                  />
                  <span className="slider-value-pill">{bWidth}px</span>
                </div>
              </div>
            )}

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Mobile User-Agent</span>
                <span className="row-desc">Render compact mobile layout inside monitor</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${bMobileUA ? 'is-on' : ''}`}
                onClick={() => onUpdateBetanoConfig({ mobileUA: !bMobileUA })}
              >
                <span className="indicator" />
                <span>{bMobileUA ? 'Mobile Layout' : 'Desktop Layout'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Degen Mode</span>
                <span className="row-desc">Automatically fire bets across all panes when BetPawa suspends</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${degenArmed ? 'is-on warn' : ''}`}
                onClick={onToggleDegen}
              >
                <span className="indicator" />
                <span>{degenArmed ? 'Armed' : 'Disarmed'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Monitor Actions</span>
                <span className="row-desc">Reload or zoom monitor frame</span>
              </div>
              <div className="btn-group">
                <button type="button" className="btn btn-sm btn-secondary" onClick={onReloadBetano}>
                  <RotateCw size={12} />
                  <span>Reload</span>
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onZoomBetano('out')}>
                  <Minus size={12} />
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onZoomBetano('reset')}>
                  {Math.round(bZoom * 100)}%
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onZoomBetano('in')}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 5. Cashout Automation ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <Shield size={14} className="card-title-icon" />
              <span className="card-title">Cashout Automation</span>
            </div>
            <span className="card-subtitle">Continuous open bets polling and rapid ticket cashing</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Auto-Cashout Engine</span>
                <span className="row-desc">Continuously scan Open Bets and cash out winning tickets</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${autoCashout ? 'is-on alert' : ''}`}
                onClick={onToggleAutoCashout}
              >
                <span className="indicator" />
                <span>{autoCashout ? 'Scanning Active' : 'Disabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Auto-Open Bets Tab</span>
                <span className="row-desc">Navigate directly to Open Bets view when cashout starts</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${cAutoNav ? 'is-on' : ''}`}
                onClick={() => onUpdateCashoutConfig({ autoNavOpenBets: !cAutoNav })}
              >
                <span className="indicator" />
                <span>{cAutoNav ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Disarm On Cashout</span>
                <span className="row-desc">Stop auto-cashout loop immediately upon successful cashout</span>
              </div>
              <button
                type="button"
                className={`toggle-switch ${cDisarm ? 'is-on warn' : ''}`}
                onClick={() => onUpdateCashoutConfig({ disarmOnHit: !cDisarm })}
              >
                <span className="indicator" />
                <span>{cDisarm ? 'Enabled' : 'Keep Scanning'}</span>
              </button>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Poll Frequency</span>
                <span className="row-desc">Interval between tickets scan cycles (milliseconds)</span>
              </div>
              <div className="input-with-unit">
                <input
                  className="inp inp-num"
                  type="number"
                  min={600}
                  max={5000}
                  step={200}
                  value={cPoll}
                  onChange={(e) => onUpdateCashoutConfig({ pollMs: parseInt(e.target.value, 10) || 1200 })}
                />
                <span className="unit-label">ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 6. Custom Selectors (Advanced) ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <Crosshair size={14} className="card-title-icon" />
              <span className="card-title">DOM Target Selectors (Advanced)</span>
            </div>
            <span className="card-subtitle">Override automated odds and stake input element matching</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Odds Value Selector</span>
                <span className="row-desc">CSS selector for reading odds in slip</span>
              </div>
              <div className="selector-input-group">
                <input
                  className="inp inp-mono"
                  type="text"
                  placeholder="Auto-detected (e.g. .m-odds-val)"
                  value={oddsSel}
                  onChange={(e) => onOddsSelChange(e.target.value)}
                  spellCheck={false}
                />
                <button type="button" className="btn btn-sm btn-secondary" onClick={onPickOdds} title="Click to pick from slip">
                  <Crosshair size={12} />
                  <span>Pick</span>
                </button>
                {oddsSel && (
                  <button type="button" className="btn btn-sm btn-icon" onClick={() => onOddsSelChange('')} title="Reset">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Stake Input Selector</span>
                <span className="row-desc">CSS selector for writing stake in slip</span>
              </div>
              <div className="selector-input-group">
                <input
                  className="inp inp-mono"
                  type="text"
                  placeholder="Auto-detected (e.g. input.stake-input)"
                  value={stakeSel}
                  onChange={(e) => onStakeSelChange(e.target.value)}
                  spellCheck={false}
                />
                <button type="button" className="btn btn-sm btn-secondary" onClick={onPickStake} title="Click to pick from slip">
                  <Crosshair size={12} />
                  <span>Pick</span>
                </button>
                {stakeSel && (
                  <button type="button" className="btn btn-sm btn-icon" onClick={() => onStakeSelChange('')} title="Reset">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 7. Software Updates ─── */}
        <div className="content-card settings-card">
          <div className="card-header">
            <div className="card-title-group">
              <DownloadCloud size={14} className="card-title-icon" />
              <span className="card-title">Software Updates</span>
            </div>
            <span className="card-subtitle">Automated background updates via GitHub Releases</span>
          </div>

          <div className="settings-rows-list">
            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Installed Version</span>
                <span className="row-desc">Current application client build</span>
              </div>
              <div className="row-value-badge">
                <span>v{updateStatus?.currentVersion || '1.0.2'}</span>
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <span className="row-title">Update Status</span>
                <span className="row-desc">
                  {updateStatus?.status === 'checking' && 'Checking for newer releases...'}
                  {updateStatus?.status === 'downloading' && `Downloading update v${updateStatus.version || ''} (${updateStatus.percent || 0}%)...`}
                  {updateStatus?.status === 'downloaded' && `Version ${updateStatus.version || ''} downloaded and ready to apply.`}
                  {updateStatus?.status === 'available' && `New version v${updateStatus.version || ''} found. Downloading...`}
                  {updateStatus?.status === 'not-available' && 'QuestSync is up to date.'}
                  {updateStatus?.status === 'dev-mode' && 'Development build (auto-updates active in packaged build).'}
                  {updateStatus?.status === 'error' && `Error: ${updateStatus.error || 'Failed to check'}`}
                  {(!updateStatus?.status || updateStatus?.status === 'idle') && 'Automated background check enabled.'}
                </span>
              </div>
              <div className="update-actions-group">
                {updateStatus?.status === 'downloaded' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={onInstallUpdate}
                  >
                    <ArrowDownCircle size={12} />
                    <span>Restart &amp; Install</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={onCheckForUpdates}
                    disabled={updateStatus?.status === 'checking' || updateStatus?.status === 'downloading'}
                  >
                    <RefreshCw size={12} className={updateStatus?.status === 'checking' ? 'spin' : ''} />
                    <span>{updateStatus?.status === 'checking' ? 'Checking...' : 'Check Now'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 8. Full Activity & System Logs Viewer ─── */}
        <div className="content-card settings-card full-width-card">
          <div className="card-header">
            <div className="card-title-group">
              <Activity size={14} className="card-title-icon" />
              <span className="card-title">Activity &amp; Audit Logs</span>
            </div>
            <div className="card-header-actions">
              {copyNotice && <span className="copy-notice-text">{copyNotice}</span>}
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleCopyLogs} title="Copy all log rows">
                <Copy size={12} />
                <span>Copy Logs</span>
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={onClearLogs} title="Clear logs">
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="logs-toolbar-row">
            <div className="search-input-wrap">
              <Search size={13} className="search-icon" />
              <input
                className="inp inp-search"
                type="text"
                placeholder="Search log messages..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
              />
            </div>
            <span className="logs-count-meta">Showing {filteredLogs.length} of {logs.length} logged events</span>
          </div>

          <div className="logs-terminal-viewport" ref={logContainerRef}>
            {filteredLogs.length === 0 ? (
              <div className="logs-empty-state">
                <span>No matching log entries recorded.</span>
              </div>
            ) : (
              <div className="logs-entries-list">
                {filteredLogs.map((log) => {
                  const isErr = log.type === 'error' || /fail|error|blocked|lock/i.test(log.text);
                  const isSuccess = log.type === 'success' || /placed|confirmed|submitted|success/i.test(log.text);
                  const isRebet = /rebet|cycle|attack/i.test(log.text);
                  const isStake = /stake/i.test(log.text);

                  let badgeCls = 'log-badge-info';
                  let badgeTxt = 'INFO';
                  if (isErr) { badgeCls = 'log-badge-err'; badgeTxt = 'ERR'; }
                  else if (isRebet) { badgeCls = 'log-badge-rebet'; badgeTxt = 'REBET'; }
                  else if (isStake) { badgeCls = 'log-badge-stake'; badgeTxt = 'STAKE'; }
                  else if (isSuccess) { badgeCls = 'log-badge-ok'; badgeTxt = 'OK'; }

                  return (
                    <div key={log.id} className="log-entry-row">
                      <span className="log-timestamp">{log.time}</span>
                      <span className={`log-type-tag ${badgeCls}`}>{badgeTxt}</span>
                      <span className="log-message-content">{log.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

