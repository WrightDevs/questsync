import React from 'react';
import { IconAccounts, IconBack, IconLogs, IconReload, IconSettings, IconSync } from './Icons.jsx';

export default function TopBar({
  countryStatus,
  onSwitchCountry,
  siteStatus = 'sportybet',
  onSwitchSite,
  url,
  urlScope,
  activePaneIndex,
  onToggleUrlScope,
  onUrlChange,
  onLoadUrl,
  onBack,
  onReload,
  count,
  onCountChange,
  layoutMode,
  onLayoutChange,
  mirror,
  onToggleMirror,
  windowSync = true,
  onToggleWindowSync,
  autoAlign = true,
  onToggleAutoAlign,
  rebetActive = false,
  onToggleRebet,
  autoRebetState = {},
  todayBets = 0,
  todayTotal = '0.00',
  lastCopyMs = 302,
  tileSize = 65,
  onTileSizeChange,
  monitorSite = 'betano',
  betanoOpen,
  onToggleBetano,
  accountsOpen,
  onToggleAccounts,
  settingsOpen,
  onToggleSettings,
  logsOpen,
  onToggleLogs,
  statusMsg,
}) {
  const scopeLabel = urlScope === 'active' ? `W${(activePaneIndex || 0) + 1}` : 'ALL';
  const monitorLabel = monitorSite === 'betpawa' ? 'betPawa' : 'Betano';

  const isStopped = !autoRebetState?.running;
  const statusPillText = isStopped ? 'STOPPED' : 'ACTIVE';
  const statusDescText = isStopped
    ? 'Emergency stop engaged. Every automatic rebet is stopped. Bets SportyBet already accepted stay as they are.'
    : `Multi-Attack Cycle ${autoRebetState?.cycle || 1}/${autoRebetState?.target || 3} running across all panes.`;

  return (
    <div className="top-banner-deck">
      {/* ─── Top Main Row (Header, Emergency Status & Action Controls) ─── */}
      <div className="top-headline-row">
        {/* Left: Title & Subtitle */}
        <div className="header-brand-block">
          <div className="header-title">QuestSync</div>
          <div className="header-subtitle">Multi-Account Synced Betting Engine</div>
        </div>

        {/* Emergency Stop / Status Banner */}
        <div className="status-announcement-card">
          <span className={`status-pill ${isStopped ? 'pill-stopped' : 'pill-active'}`}>
            {statusPillText}
          </span>
          <span className="status-announcement-text" title={statusMsg || statusDescText}>
            {statusDescText}
          </span>
        </div>

        {/* Center / Right: Interactive Toggles, Metrics & Action Buttons */}
        <div className="top-switches-group">
          {/* Window Sync Switch */}
          <div
            className={`switch-badge ${windowSync ? 'is-on' : 'is-off'}`}
            onClick={onToggleWindowSync}
            title="Window sync: align odds and selections across windows"
          >
            <span className="switch-label">Window sync</span>
            <span className="switch-thumb">{windowSync ? 'ON' : 'OFF'}</span>
          </div>

          {/* Auto-Align Switch */}
          <div
            className={`switch-badge ${autoAlign ? 'is-on' : 'is-off'}`}
            onClick={onToggleAutoAlign}
            title="Auto-align: calculate exact stake for target profit"
          >
            <span className="switch-label">Auto-align</span>
            <span className="switch-thumb">{autoAlign ? 'E-1100 ON' : 'OFF'}</span>
          </div>

          {/* Mirror Switch */}
          <div
            className={`switch-badge ${mirror ? 'is-on-red' : 'is-off'}`}
            onClick={onToggleMirror}
            title="Click Mirroring: replicates clicks from active pane to followers"
          >
            <span className="switch-label">Mirror</span>
            <span className="switch-thumb">{mirror ? 'ON' : 'OFF'}</span>
          </div>

          {/* Rebet Switch */}
          <div
            className={`switch-badge ${rebetActive ? 'is-on-red' : 'is-off'}`}
            onClick={onToggleRebet}
            title="Continuous Rebet: auto-place bet and confirm on odds update"
          >
            <span className="switch-label">Rebet</span>
            <span className="switch-thumb">{rebetActive ? 'ON' : 'OFF'}</span>
          </div>

          {/* Metrics: Today Bets */}
          <div className="metric-chip" title="Today's total accepted bets and volume">
            <span>Today:</span>
            <strong>{todayBets} bets · ₦{todayTotal}</strong>
          </div>

          {/* Metrics: Latency Badge */}
          <div className="latency-badge" title="Last cross-pane mirror replication latency">
            <span>Last copy:</span>
            <span className="latency-pill">all {lastCopyMs} ms</span>
          </div>

          {/* Tile Size Slider */}
          <div className="tile-size-widget" title="Adjust pane zoom / tile width">
            <span className="slider-label">Tile size</span>
            <input
              type="range"
              min="40"
              max="100"
              step="5"
              value={tileSize}
              onChange={(e) => onTileSizeChange?.(parseInt(e.target.value, 10))}
              className="tile-slider"
            />
            <span className="slider-pct">{tileSize}%</span>
          </div>

          {/* Hide/Show Monitor Button */}
          <button
            type="button"
            className={`btn btn-sm ${betanoOpen ? 'btn-monitor-active' : 'btn-monitor'}`}
            onClick={onToggleBetano}
            title={betanoOpen ? `Hide ${monitorLabel} monitor sidebar` : `Show ${monitorLabel} monitor sidebar`}
          >
            <span>{betanoOpen ? `Hide ${monitorLabel}` : `Show ${monitorLabel}`}</span>
          </button>

          {/* All Logs Button */}
          <button
            type="button"
            className={`btn btn-sm ${logsOpen ? 'btn-primary' : 'btn-outline'}`}
            onClick={onToggleLogs}
            title="Open Activity & System Logs Drawer"
          >
            <IconLogs size={12} />
            <span>All logs</span>
          </button>

          {/* Accounts & Logins Button (Prominent & Labeled) */}
          <button
            type="button"
            className={`btn btn-sm ${accountsOpen ? 'btn-primary' : 'btn-accounts'}`}
            onClick={onToggleAccounts}
            title="Open Accounts & Auto-Login Drawer"
          >
            <IconAccounts size={13} />
            <span>Accounts &amp; Logins</span>
          </button>

          {/* Settings Button (Prominent & Labeled) */}
          <button
            type="button"
            className={`btn btn-sm ${settingsOpen ? 'btn-primary' : 'btn-settings'}`}
            onClick={onToggleSettings}
            title="Open Settings &amp; Parameters"
          >
            <IconSettings size={13} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* ─── Global Navigation & Switching Strip ─── */}
      <div className="top-nav-strip">
        {/* Global Site Selector (SportyBet / Football.com) */}
        <span className="field-lbl">Site:</span>
        <div className="seg-group" title="Global Site: Switch all panes between SportyBet and Football.com">
          <button
            type="button"
            className={`seg-btn ${siteStatus === 'sportybet' ? 'active is-sb' : ''}`}
            onClick={() => onSwitchSite?.('sportybet')}
          >
            SportyBet
          </button>
          <button
            type="button"
            className={`seg-btn ${siteStatus === 'football' ? 'active is-fb' : ''}`}
            onClick={() => onSwitchSite?.('football')}
          >
            Football.com
          </button>
        </div>

        {/* Global Country Selector (NG / GH) */}
        <span className="field-lbl">Country:</span>
        <div className="seg-group" title="Global Country: Switch all panes (/ng or /gh)">
          <button
            type="button"
            className={`seg-btn ${countryStatus === 'ng' ? 'is-ng' : ''}`}
            onClick={() => onSwitchCountry('ng')}
          >
            NG
          </button>
          <button
            type="button"
            className={`seg-btn ${countryStatus === 'gh' ? 'is-gh' : ''}`}
            onClick={() => onSwitchCountry('gh')}
          >
            GH
          </button>
          {countryStatus === 'mixed' && <span className="seg-btn is-mixed">MIX</span>}
        </div>

        <div className="sep" />

        {/* URL Scope */}
        <button
          type="button"
          className={`btn btn-scope ${urlScope === 'active' ? 'is-active' : ''}`}
          onClick={onToggleUrlScope}
          title={`URL scope: ${urlScope === 'active' ? `Window ${(activePaneIndex || 0) + 1} only` : 'All Panes'}`}
        >
          {scopeLabel}
        </button>

        {/* URL Input */}
        <input
          className="inp inp-url"
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLoadUrl()}
          placeholder="sportybet.com/ng/m/ or football.com/ng/m/"
          spellCheck={false}
        />

        <button type="button" className="btn btn-sm btn-primary" onClick={onLoadUrl}>
          Load
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={onBack}
          title="Back"
          aria-label="Back"
        >
          <IconBack size={12} />
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={onReload}
          title="Reload"
          aria-label="Reload"
        >
          <IconReload size={12} />
        </button>

        <div className="sep" />

        {/* Window Count Selector */}
        <span className="field-lbl">Panes:</span>
        <div className="seg-group">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              className={`seg-btn ${count === n ? 'active' : ''}`}
              onClick={() => onCountChange(n)}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Layout Mode */}
        <div className="seg-group">
          <button
            type="button"
            className={`seg-btn ${layoutMode === 'row' ? 'active' : ''}`}
            onClick={() => onLayoutChange('row')}
            title="Row Layout"
          >
            Row
          </button>
          <button
            type="button"
            className={`seg-btn ${layoutMode === 'grid' ? 'active' : ''}`}
            onClick={() => onLayoutChange('grid')}
            title="Grid Layout"
          >
            Grid
          </button>
        </div>
      </div>
    </div>
  );
}
