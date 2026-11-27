import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  RefreshCw,
  MousePointerClick,
  Layers,
  TrendingUp,
  Keyboard,
  Lock,
  Activity,
  ArrowRight,
  BookOpen,
  SlidersHorizontal,
  Radio,
  Target,
  X,
} from 'lucide-react';

const WHATS_NEW_ITEMS = [
  {
    badge: 'NEW',
    tone: 'amber',
    title: 'Betano Live-Score Listener & VAR Cashout',
    desc: 'Sleek glass "Watch this match" overlay on Betano match pages auto-triggers pane bets on goals, or runs 2-step Cashout + Confirm & re-arms on VAR score drops.',
    icon: Radio,
  },
  {
    badge: 'UPGRADED',
    tone: 'blue',
    title: 'Redesigned Header, Mode Cluster & Toolbar',
    desc: '4-zone header with unified Mirror / Auto-Accept / 1-Click·2-Click toggles, read-only IDLE/volume telemetry, single-row workspace toolbar, and Panes 1–8 in Settings.',
    icon: SlidersHorizontal,
  },
  {
    badge: 'FIXED',
    tone: 'emerald',
    title: 'Two-Step Cashout All & Open Bets Sync',
    desc: 'Reliable Alt+C & VAR cashout matching SportyBet openbet__cashout_btn → open_bets__cashout_confirm with XHR load wait and blocked-nav URL fallback.',
    icon: ShieldCheck,
  },
  {
    badge: 'UPGRADED',
    tone: 'blue',
    title: 'Idempotent Structural Mirror Clicking',
    desc: 'Cross-pane mirror resolution now uses strict single-odds outcome boundaries, entity ID tuples, desired-state parity guards, and 350ms lead reconciliation.',
    icon: Target,
  },
  {
    badge: 'NEW',
    tone: 'blue',
    title: '1-Click & 2-Click Single Bet Mode',
    desc: 'Switch 1-Click (Place → Confirm) or state-based 2-Click (Space 1 places, Space 2 confirms) directly from the top mode cluster or in Settings.',
    icon: MousePointerClick,
  },
  {
    badge: 'NEW',
    tone: 'emerald',
    title: 'Auto-Accept Odds & Prompt Guard',
    desc: 'Top-nav toggle silently accepts idle betslip odds changes without firing bets and auto-clicks Yes on SportyBet’s native auto-accept prompt.',
    icon: RefreshCw,
  },
  {
    badge: 'SPEED',
    tone: 'amber',
    title: 'Zero-Delay Instant Enter Manual Rebet',
    desc: 'Pre-warmed microtask MutationObserver catches and clicks Rebet in <0.5ms on Enter in Single Bet mode, backed by polling fallback.',
    icon: Zap,
  },
  {
    badge: 'FIXED',
    tone: 'emerald',
    title: 'Confirm-Safe Auto-Stake Updates',
    desc: 'Odds shifts while sitting on Confirm now update stakes silently in the reactive store/DOM without opening the keypad or dropping Confirm.',
    icon: ShieldCheck,
  },
  {
    badge: 'FIXED',
    tone: 'emerald',
    title: 'Spacebar Reliability Fix',
    desc: 'Fixed Spacebar scrolling market options instead of placing bets when the betslip stake wrapper is open or during auto-stake sync.',
    icon: Keyboard,
  },
  {
    badge: 'IMPROVED',
    tone: 'blue',
    title: 'Smooth Scroll Sync & Leaner Engine',
    desc: 'Synchronized multi-pane vertical scroll without echo loops, fast market-switch retries, strict user-only bet triggers, and dead-code cleanup.',
    icon: Activity,
  },
];

const CORE_FEATURES = [
  {
    title: '1–8 Synced Account Panes',
    desc: 'Run independent SportyBet & Football.com sessions side-by-side (NG & GH) with instant click, navigation, and scroll mirroring.',
    icon: Layers,
  },
  {
    title: 'Target Profit & Balance-Aware Stake',
    desc: 'Set target profit per currency (₦ / GH₵) to auto-compute and inject stakes across all panes, capping safely at account balance.',
    icon: TrendingUp,
  },
  {
    title: 'Rapid Attack & Rebet Engine',
    desc: 'Fire continuous Spacebar multi-cycles or Single Bet passes, plus automated decrementing Rebet and instant Esc cycle cancellation.',
    icon: Zap,
  },
  {
    title: 'Live Benchmark Monitor & Cashout',
    desc: 'Dock or float the live Betano / BetPawa odds monitor alongside panes, auto-login all accounts, and trigger Cashout All via Alt+C / F9.',
    icon: Lock,
  },
];

const KEYBINDS = [
  { key: 'Space', label: 'Place Bet / Rapid Attack / Confirm (2-Click)' },
  { key: 'Enter', label: 'Instant Manual Rebet (Single Bet mode)' },
  { key: 'Alt + C / F9', label: 'Two-Step Cashout All across panes' },
  { key: 'Esc', label: 'Emergency stop active Rapid Attack cycle' },
];

export default function ReleaseSplash({
  isOpen = false,
  version = '1.1.0',
  onClose,
  onOpenGuide,
  onNavigateSettings,
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'whats-new' | 'features'
  const [dontShowForVersion, setDontShowForVersion] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose(dontShowForVersion);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, dontShowForVersion, onClose]);

  if (!isOpen) return null;

  const showWhatsNew = activeTab === 'all' || activeTab === 'whats-new';
  const showFeatures = activeTab === 'all' || activeTab === 'features';

  return (
    <div className="splash-backdrop" role="dialog" aria-modal="true" aria-labelledby="splash-title">
      <div className="splash-window">
        {/* Hero Header */}
        <div className="splash-hero">
          <div className="splash-hero-top">
            <div className="splash-brand-row">
              <div className="splash-logo-mark" aria-hidden="true">
                QS
              </div>
              <div className="splash-title-group">
                <div className="splash-title-line">
                  <h2 id="splash-title" className="splash-title">QuestSync Pro</h2>
                  <span className="splash-version-pill">
                    <Sparkles size={11} />
                    <span>v{version} Release</span>
                  </span>
                </div>
                <p className="splash-subtitle">
                  Multi-account synced execution engine — release highlights, fixes, and full feature suite.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="guide-close-btn"
              onClick={() => onClose(dontShowForVersion)}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Segmented View Tabs */}
          <div className="splash-tabs-bar" role="tablist" aria-label="Splash screen sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              className={`splash-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Highlights
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'whats-new'}
              className={`splash-tab-btn ${activeTab === 'whats-new' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('whats-new')}
            >
              What&apos;s New in v{version}
              <span className="splash-tab-count">{WHATS_NEW_ITEMS.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'features'}
              className={`splash-tab-btn ${activeTab === 'features' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('features')}
            >
              Core Features &amp; Keys
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="splash-body">
          {showWhatsNew && (
            <section className="splash-section">
              <div className="splash-section-head">
                <span className="splash-section-label">WHAT&apos;S NEW IN v{version}</span>
                <span className="splash-section-meta">Latest additions, speed upgrades &amp; fixes</span>
              </div>
              <div className="splash-updates-grid">
                {WHATS_NEW_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="splash-card splash-update-card">
                      <div className="splash-card-top">
                        <span className={`splash-tag splash-tag-${item.tone}`}>{item.badge}</span>
                        <Icon size={14} className="splash-card-icon" />
                      </div>
                      <h3 className="splash-card-title">{item.title}</h3>
                      <p className="splash-card-desc">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {showFeatures && (
            <>
              <section className="splash-section">
                <div className="splash-section-head">
                  <span className="splash-section-label">CORE PLATFORM CAPABILITIES</span>
                  <span className="splash-section-meta">SportyBet &amp; Football.com · Auto-Updater</span>
                </div>
                <div className="splash-features-grid">
                  {CORE_FEATURES.map((feat) => {
                    const Icon = feat.icon;
                    return (
                      <div key={feat.title} className="splash-card splash-feature-card">
                        <div className="splash-feature-head">
                          <div className="splash-feature-icon-box">
                            <Icon size={14} />
                          </div>
                          <h3 className="splash-card-title">{feat.title}</h3>
                        </div>
                        <p className="splash-card-desc">{feat.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="splash-section">
                <div className="splash-section-head">
                  <span className="splash-section-label">EXECUTION HOTKEYS</span>
                </div>
                <div className="splash-keybinds-bar">
                  {KEYBINDS.map((kb) => (
                    <div key={kb.key} className="splash-keybind-item">
                      <kbd className="guide-kbd">{kb.key}</kbd>
                      <span>{kb.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="splash-footer">
          <label className="guide-checkbox-wrap">
            <input
              type="checkbox"
              className="guide-checkbox-input"
              checked={dontShowForVersion}
              onChange={(e) => setDontShowForVersion(e.target.checked)}
            />
            <span className="guide-checkbox-label">Don&apos;t show again for v{version}</span>
          </label>

          <div className="splash-footer-actions">
            {onOpenGuide && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose(dontShowForVersion);
                  onOpenGuide();
                }}
              >
                <BookOpen size={13} />
                <span>Guide</span>
              </button>
            )}
            {onNavigateSettings && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose(dontShowForVersion);
                  onNavigateSettings();
                }}
              >
                <SlidersHorizontal size={13} />
                <span>Settings</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary splash-cta-btn"
              onClick={() => onClose(dontShowForVersion)}
            >
              <span>Launch Workspace</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
