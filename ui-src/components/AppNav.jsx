import React from 'react';
import { LayoutGrid, Users, SlidersHorizontal, Zap, BookOpen, ArrowDownCircle } from 'lucide-react';

export default function AppNav({
  currentRoute = 'software',
  onNavigate,
  onOpenGuide,
  autoRebetState = { running: false, cycle: 0, target: 1 },
  todayBets = 0,
  todayTotal = '0.00',
  mirror = true,
  onToggleMirror,
  autoAcceptOdds = false,
  onToggleAutoAcceptOdds,
  statusMsg = '',
  updateStatus = { status: 'idle' },
  onInstallUpdate,
}) {
  const isAttacking = !!autoRebetState?.running;

  return (
    <nav className="app-nav-bar" role="navigation" aria-label="Main Navigation">
      {/* Brand & Identity */}
      <div className="nav-brand-section">
        <span className="nav-brand-title">QuestSync</span>
        <span className="nav-brand-badge">PRO</span>
      </div>

      <div className="nav-divider" />

      {/* Primary Route Navigation Tabs */}
      <div className="nav-routes-group">
        <button
          type="button"
          className={`nav-tab-btn ${currentRoute === 'software' ? 'is-active' : ''}`}
          onClick={() => onNavigate('software')}
          title="Panes Workspace (Main Betting Grid)"
        >
          <LayoutGrid size={14} className="nav-tab-icon" />
          <span>Software</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${currentRoute === 'accounts' ? 'is-active' : ''}`}
          onClick={() => onNavigate('accounts')}
          title="Account Management & Logins"
        >
          <Users size={14} className="nav-tab-icon" />
          <span>Accounts</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${currentRoute === 'settings' ? 'is-active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Application Settings & Parameters"
        >
          <SlidersHorizontal size={14} className="nav-tab-icon" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          className="nav-tab-btn"
          onClick={onOpenGuide}
          title="Operator Guide & How to Use (Quick Start)"
        >
          <BookOpen size={14} className="nav-tab-icon" />
          <span>Guide</span>
        </button>
      </div>

      {/* Center Ticker / Status Message */}
      <div className="nav-ticker-section" title={statusMsg}>
        <span className="nav-ticker-text">{statusMsg || 'Ready'}</span>
      </div>

      {/* Right System Indicators & Metrics */}
      <div className="nav-meta-section">
        {/* In-App Update Downloaded Notification */}
        {updateStatus?.status === 'downloaded' && (
          <button
            type="button"
            className="nav-badge nav-badge-update-ready"
            onClick={onInstallUpdate}
            title={`QuestSync v${updateStatus.version || ''} downloaded. Click to restart and apply update now.`}
          >
            <ArrowDownCircle size={12} className="nav-pulse-icon" />
            <span>Update v{updateStatus.version || ''} Ready · Restart</span>
          </button>
        )}
        {updateStatus?.status === 'downloading' && (
          <span className="nav-badge nav-badge-muted" title={`Downloading update v${updateStatus.version || ''}: ${updateStatus.percent || 0}%`}>
            <span>Update {updateStatus.percent || 0}%</span>
          </span>
        )}

        {/* Rapid Attack State Pill */}
        {isAttacking ? (
          <span className="nav-badge nav-badge-active" title="Rapid Attack Active">
            <Zap size={11} className="nav-pulse-icon" />
            <span>Cycle {autoRebetState.cycle}/{autoRebetState.target}</span>
          </span>
        ) : (
          <span className="nav-badge nav-badge-idle" title="System Idle">
            IDLE
          </span>
        )}

        {/* Mirroring Indicator (One-Click Toggle) */}
        <button
          type="button"
          onClick={onToggleMirror}
          className={`nav-badge nav-badge-clickable ${mirror ? 'nav-badge-mirror-on' : 'nav-badge-muted'}`}
          title={`Click Mirroring is ${mirror ? 'ACTIVE (Click to Pause)' : 'PAUSED (Click to Enable)'}`}
          aria-label={`Toggle click mirroring. Current status: ${mirror ? 'ON' : 'OFF'}`}
        >
          Mirror {mirror ? 'ON' : 'OFF'}
        </button>

        {/* Auto-Accept Odds Changes Toggle */}
        <button
          type="button"
          onClick={onToggleAutoAcceptOdds}
          className={`nav-badge nav-badge-clickable ${autoAcceptOdds ? 'nav-badge-auto-accept-on' : 'nav-badge-muted'}`}
          title={`Auto-Accept Odds Changes is ${autoAcceptOdds ? 'ACTIVE (Updates idle betslip odds automatically without placing bets)' : 'OFF (Manual click required)'}`}
          aria-label={`Toggle Auto-Accept Odds. Current status: ${autoAcceptOdds ? 'ON' : 'OFF'}`}
        >
          Auto-Accept Odds {autoAcceptOdds ? 'ON' : 'OFF'}
        </button>

        {/* Daily Bets Volume */}
        <div className="nav-metric-pill" title="Today's total bets placed and volume">
          <span className="nav-metric-label">Today</span>
          <span className="nav-metric-val">{todayBets} bets · ₦{todayTotal}</span>
        </div>
      </div>
    </nav>
  );
}

