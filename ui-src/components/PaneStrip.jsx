import React from 'react';
import { LogIn, RotateCw, RefreshCw, Home, X } from 'lucide-react';

const CURRENCY = { gh: 'GH₵', ng: '₦' };

export default function PaneStrip({
  paneStates = [],
  profitRows = [],
  layoutGeometry = null,
  monitorConfig = {},
  betanoOpen = false,
  onToggleBetano,
  monitorWatchStatus = null,
  onToggleMonitorWatch,
  onFocusPane,
  onSetPaneProfile,
  onReloadPane,
  onNavigateHome,
  onSyncPane,
  onOpenLogin,
  statusMsg,
}) {
  const count = Math.max(paneStates.length, profitRows.length);
  const mon = layoutGeometry?.monitor;
  const isMonDockedLeft = mon && mon.open && mon.side === 'left';
  const isMonDockedRight = mon && mon.open && mon.side === 'right';

  const rowsCount = layoutGeometry?.rows || 1;
  const colsCount = layoutGeometry?.cols || count;

  const renderMonitorTile = () => {
    const isBetpawa = (mon?.site || monitorConfig.site) === 'betpawa';
    const siteName = isBetpawa ? 'betPawa' : 'Betano';
    const widthStyle = mon?.width ? { width: `${mon.width}px`, flex: 'none' } : { width: '340px', flex: 'none' };
    const isArmed = !isBetpawa && !!monitorWatchStatus?.armed;
    const isMatch = !isBetpawa && !!monitorWatchStatus?.isMatchPage;
    const scoreText = !isBetpawa && monitorWatchStatus?.score ? monitorWatchStatus.score : '';
    const lastEvent = !isBetpawa ? String(monitorWatchStatus?.lastEvent || '') : '';
    const isDropEvent = lastEvent.startsWith('VAR Drop');
    const isGoalEvent = lastEvent.startsWith('Goal');

    let subLabel = 'Live Benchmark';
    let subClass = 'monitor-sub-tag';
    if (isArmed) {
      if (isDropEvent) {
        subLabel = scoreText ? `ARMED · ${scoreText} · VAR DROP` : 'ARMED · VAR DROP';
        subClass = 'monitor-sub-tag is-drop';
      } else if (isGoalEvent) {
        subLabel = scoreText ? `ARMED · ${scoreText} · GOAL` : 'ARMED · GOAL FIRED';
        subClass = 'monitor-sub-tag is-armed';
      } else {
        subLabel = scoreText ? `ARMED · ${scoreText}` : 'ARMED · WATCHING';
        subClass = 'monitor-sub-tag is-armed';
      }
    } else if (isDropEvent) {
      subLabel = scoreText ? `VAR DROP · ${scoreText}` : 'VAR DROP CASHOUT';
      subClass = 'monitor-sub-tag is-drop';
    } else if (isMatch) {
      subLabel = scoreText ? `Match · ${scoreText}` : 'Match Ready';
    }

    return (
      <div className="pane-header-box monitor-header-box" style={widthStyle}>
        <div className="pane-header-top">
          <div className="pane-name-tag">
            <span className="live-indicator-dot is-monitor-dot" />
            <span className="pane-title-text">{siteName} Monitor</span>
          </div>
          <div className="pane-pills-group">
            <span className="pane-toggle-pill is-sb">DOCK</span>
            <button
              type="button"
              className="pane-action-btn"
              onClick={onToggleBetano}
              title={`Close ${siteName} monitor`}
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
        </div>
        <div className="pane-header-actions-row monitor-sub-row">
          <span className={subClass}>{subLabel}</span>
          {!isBetpawa && onToggleMonitorWatch && (
            <button
              type="button"
              className={`monitor-watch-pill ${isArmed ? 'is-armed' : ''}`}
              disabled={!isMatch && !isArmed}
              onClick={onToggleMonitorWatch}
              title={
                isArmed
                  ? 'Stop Betano score listener'
                  : isMatch
                    ? 'Watch this Betano match score and trigger bets on goal'
                    : 'Open a Betano match page to arm goal listener'
              }
            >
              {isArmed ? 'Stop Watch' : isMatch ? 'Watch Goal' : 'Open Match'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderPaneTile = (i) => {
    const pane = paneStates[i] || { index: i, site: 'sportybet', country: 'ng', active: false };
    const row = profitRows[i] || {};
    const site = row.site || pane.site || 'sportybet';
    const country = row.country || pane.country || 'ng';
    const sym = CURRENCY[country] || '₦';
    const siteTag = site === 'football' ? 'FB' : 'SB';
    const countryTag = country.toUpperCase();
    const paneLabel = `Pane ${i + 1}`;

    const bound = layoutGeometry?.paneBounds?.[i];
    const tileStyle = bound?.width ? { width: `${bound.width}px`, flex: 'none' } : { flex: 1, minWidth: 0 };

    return (
      <div
        key={i}
        className={`pane-header-box ${pane.active ? 'is-active-pane' : ''}`}
        style={tileStyle}
        onClick={() => onFocusPane(i)}
      >
        {/* 1st Line: Pane N | SB/FB | NG/GH */}
        <div className="pane-header-top">
          <div className="pane-name-tag">
            <span className="live-indicator-dot" />
            <span className="pane-title-text">{paneLabel}</span>
          </div>

          <div className="pane-pills-group">
            {/* Per-Pane Site Switcher (SB / FB) */}
            <button
              type="button"
              className={`pane-toggle-pill ${site === 'football' ? 'is-fb' : 'is-sb'}`}
              onClick={(e) => {
                e.stopPropagation();
                onSetPaneProfile(i, { site: site === 'football' ? 'sportybet' : 'football' });
              }}
              title={`Site: ${site === 'football' ? 'Football.com' : 'SportyBet'} (Click to switch)`}
            >
              {siteTag}
            </button>

            {/* Per-Pane Country Switcher (NG / GH) */}
            <button
              type="button"
              className={`pane-toggle-pill ${country === 'gh' ? 'is-gh' : 'is-ng'}`}
              onClick={(e) => {
                e.stopPropagation();
                onSetPaneProfile(i, { country: country === 'gh' ? 'ng' : 'gh' });
              }}
              title={`Country: ${countryTag} (Click to switch NG / GH)`}
            >
              {countryTag}
            </button>
          </div>
        </div>

        {/* 2nd Line: Action Icons: Home, Reload, Sync Odds (plus Login & live Odds badge) */}
        <div className="pane-header-actions-row">
          <div className="pane-icons-strip">
            <button
              type="button"
              className="pane-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateHome?.(i);
              }}
              title={`Home (${paneLabel})`}
              aria-label="Home"
            >
              <Home size={12} />
            </button>

            <button
              type="button"
              className="pane-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onReloadPane?.(i);
              }}
              title={`Reload (${paneLabel})`}
              aria-label="Reload"
            >
              <RotateCw size={12} />
            </button>

            <button
              type="button"
              className="pane-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSyncPane?.(i);
              }}
              title={`Sync odds (${paneLabel})`}
              aria-label="Sync odds"
            >
              <RefreshCw size={12} />
            </button>

            <button
              type="button"
              className="pane-action-btn pane-login-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLogin?.(i);
              }}
              title={`Account & Login for ${paneLabel}`}
              aria-label="Login"
            >
              <LogIn size={11} />
              <span className="pane-login-text">Login</span>
            </button>
          </div>

          {/* Live Odds & Stake Tag if available */}
          {row.odds != null ? (
            <div className="pane-calc-badge" title={`Live Odds: ${row.odds} | Calculated Stake: ${sym}${row.stake}`}>
              <span className="odds-val">@{row.odds}</span>
              <span className="stake-val">
                {row.stake != null ? `${sym}${row.stake}` : '--'}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // Group pane indices into rows
  const rowIndices = Array.from({ length: rowsCount }, () => []);
  for (let i = 0; i < count; i++) {
    const bound = layoutGeometry?.paneBounds?.[i];
    const r = bound && typeof bound.row === 'number' ? bound.row : Math.floor(i / colsCount);
    const targetRow = Math.min(r, rowsCount - 1);
    rowIndices[targetRow].push(i);
  }

  return (
    <div className="pane-headers-deck">
      <div className="pane-deck-inner">
        {/* If monitor is docked on the left, position monitor header tile beside rows */}
        {isMonDockedLeft && renderMonitorTile()}

        <div className="panes-grid-flow">
          {rowIndices.map((indices, rIdx) => (
            <div key={rIdx} className="pane-headers-row">
              {indices.map((paneIdx) => renderPaneTile(paneIdx))}
            </div>
          ))}
        </div>

        {/* If monitor is docked on the right, position monitor header tile beside rows */}
        {isMonDockedRight && renderMonitorTile()}
      </div>
    </div>
  );
}
