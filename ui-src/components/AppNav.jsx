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

        {/* Mirroring Indicator */}
        <span className={`nav-badge ${mirror ? 'nav-badge-mirror-on' : 'nav-badge-muted'}`} title="Click Mirroring Status">
          Mirror {mirror ? 'ON' : 'OFF'}
        </span>

        {/* Daily Bets Volume */}
        <div className="nav-metric-pill" title="Today's total bets placed and volume">
          <span className="nav-metric-label">Today</span>
          <span className="nav-metric-val">{todayBets} bets · ₦{todayTotal}</span>
        </div>
      </div>
    </nav>
  );
}

