import React from 'react';
import { LayoutGrid, Users, SlidersHorizontal, Zap, BookOpen, ArrowDownCircle } from 'lucide-react';

export default function AppNav({
  currentRoute = 'software',
  onNavigate,
  onOpenGuide,
  onOpenSplash,
  appVersion = '1.1.0',
  autoRebetState = { running: false, cycle: 0, target: 1 },
  todayBets = 0,
  todayTotal = '0.00',
  mirror = true,
  onToggleMirror,
  autoAcceptOdds = false,
  onToggleAutoAcceptOdds,
  autoRebetOnSpace = true,
  singleBetClickMode = '1-click',
  onToggleSingleBetClickMode,
  statusMsg = '',
  updateStatus = { status: 'idle' },
  onInstallUpdate,
}) {
  const isAttacking = !!autoRebetState?.running;
  const isTwoClick = singleBetClickMode === '2-click';

  return (
    <nav className="app-nav-bar" role="navigation" aria-label="Main Navigation">
      {/* Zone A: Brand Wordmark + Subtle Version + Route Navigation */}
      <div className="nav-brand-section">
        <span className="nav-brand-title">QuestSync</span>
        <span className="nav-brand-badge">PRO</span>
        {onOpenSplash && (
          <button
            type="button"
            className="nav-version-link"
            onClick={onOpenSplash}
            title={`View Release Notes & Features (QuestSync v${appVersion})`}
          >
            v{appVersion}
          </button>
        )}
      </div>

      <div className="nav-divider" />

      <div className="nav-routes-group">
        <button
          type="button"
          className={`nav-tab-btn ${currentRoute === 'software' ? 'is-active' : ''}`}
          onClick={() => onNavigate('software')}
          title="Panes Workspace (Main Betting Grid)"
        >
          <LayoutGrid size={13} className="nav-tab-icon" />
          <span>Software</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${currentRoute === 'accounts' ? 'is-active' : ''}`}
          onClick={() => onNavigate('accounts')}
          title="Account Management & Logins"
        >
          <Users size={13} className="nav-tab-icon" />
          <span>Accounts</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${currentRoute === 'settings' ? 'is-active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Application Settings & Parameters"
        >
          <SlidersHorizontal size={13} className="nav-tab-icon" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          className="nav-tab-btn is-ghost"
          onClick={onOpenGuide}
          title="Operator Guide & Quick Start"
        >
          <BookOpen size={13} className="nav-tab-icon" />
          <span>Guide</span>
        </button>
      </div>

      {/* Zone B: Center Status Ticker */}
      <div className="nav-ticker-section" title={statusMsg}>
        <span className="nav-ticker-text">{statusMsg || 'Ready'}</span>
      </div>

      {/* Zone C + D: Mode Controls Cluster & Session Telemetry Cluster */}
      <div className="nav-right-clusters">
        {updateStatus?.status === 'downloaded' && (
          <button
            type="button"
            className="nav-update-action"
            onClick={onInstallUpdate}
            title={`QuestSync v${updateStatus.version || ''} downloaded. Click to restart and apply update now.`}
          >
            <ArrowDownCircle size={12} />
            <span>Restart v{updateStatus.version || ''}</span>
          </button>
        )}
        {updateStatus?.status === 'downloading' && (
          <span className="nav-update-progress" title={`Downloading update v${updateStatus.version || ''}: ${updateStatus.percent || 0}%`}>
            Update {updateStatus.percent || 0}%
          </span>
        )}

        {/* Zone C: Unified Live Mode Cluster (Mirror, Auto-Accept, Single Bet Click Mode) */}
        <div className="nav-mode-cluster" role="group" aria-label="Live Mode Toggles">
          <button
            type="button"
            onClick={onToggleMirror}
            className={`mode-pill ${mirror ? 'is-on' : ''}`}
            title={`Click Mirroring is ${mirror ? 'ON (Click to pause)' : 'OFF (Click to resume)'}`}
            aria-pressed={!!mirror}
          >
            <span className="mode-dot" />
            <span>Mirror</span>
          </button>

          <button
            type="button"
            onClick={onToggleAutoAcceptOdds}
            className={`mode-pill ${autoAcceptOdds ? 'is-on is-salient' : ''}`}
            title={`Auto-Accept Odds Changes is ${autoAcceptOdds ? 'ON (Silently updates idle slip odds — caution during Rapid Attack)' : 'OFF (Manual accept required)'}`}
            aria-pressed={!!autoAcceptOdds}
          >
            <span className="mode-dot" />
            <span>Auto-Accept</span>
          </button>

          <button
            type="button"
            disabled={autoRebetOnSpace}
            onClick={onToggleSingleBetClickMode}
            className={`mode-pill ${!autoRebetOnSpace && isTwoClick ? 'is-on' : ''}`}
            title={
              autoRebetOnSpace
                ? '1-Click / 2-Click applies only in Single Bet mode (currently set to Rapid Attack)'
                : isTwoClick
                  ? 'Single Bet 2-Click ON (Space 1 = Place Bet, Space 2 = Confirm). Click to switch to 1-Click.'
                  : 'Single Bet 1-Click (One Spacebar press places & confirms). Click to switch to 2-Click.'
            }
            aria-pressed={!autoRebetOnSpace && isTwoClick}
          >
            <span className="mode-dot" />
            <span>{isTwoClick ? '2-Click' : '1-Click'}</span>
          </button>
        </div>

        {/* Zone D: Unified Read-Only Session Telemetry (State + Daily Volume) */}
        <div className="nav-telemetry-cluster" title={isAttacking ? `Rapid Attack running cycle ${autoRebetState.cycle}/${autoRebetState.target}` : `System idle · ${todayBets} bets placed today (₦${todayTotal})`}>
          <span className={`telemetry-state ${isAttacking ? 'is-live' : ''}`}>
            {isAttacking ? <Zap size={10} className="telemetry-live-icon" /> : <span className="telemetry-dot" />}
            <span>{isAttacking ? `${autoRebetState.cycle}/${autoRebetState.target}` : 'IDLE'}</span>
          </span>
          <span className="telemetry-sep" aria-hidden="true" />
          <span className="telemetry-volume">
            <span className="telemetry-num">{todayBets}</span>
            <span className="telemetry-unit">bets</span>
            <span className="telemetry-mid">·</span>
            <span className="telemetry-num">₦{todayTotal}</span>
          </span>
        </div>
      </div>
    </nav>
  );
}

