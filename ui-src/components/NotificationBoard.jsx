import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function NotificationBoard({
  isOpen = false,
  onClose,
  onNavigateSettings,
}) {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose(dontShowAgain);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, dontShowAgain, onClose]);

  if (!isOpen) return null;

  return (
    <div className="guide-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="guide-modal-title">
      <div className="guide-modal-window">
        {/* Header: Single title + single short subtitle line. No pill badge. */}
        <div className="guide-modal-header">
          <div className="guide-header-text">
            <h2 id="guide-modal-title" className="guide-title">
              How to Use QuestSync
            </h2>
            <p className="guide-subtitle">
              Operational workflow, hotkey mapping, and bet placement rules.
            </p>
          </div>
          <button
            type="button"
            className="guide-close-btn"
            onClick={() => onClose(dontShowAgain)}
            title="Close Guide (Esc)"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content Body with right inset */}
        <div className="guide-modal-body">
          {/* Warning: Single concise paragraph with leading icon + plain inline step markers */}
          <div className="guide-card guide-warning-card">
            <div className="guide-warning-lead">
              <AlertTriangle size={15} className="guide-warning-icon" />
              <p className="guide-warning-text">
                <strong>Always expand the betslip before submitting:</strong> SportyBet mobile does not register bets or odds changes from the collapsed bottom preview strip. Tap the betslip bar to open full view before clicking Place Bet or pressing Space.
              </p>
            </div>
            <div className="guide-steps-row">
              <span className="guide-step-item">1. Select odds on Pane 1</span>
              <span className="guide-step-sep">→</span>
              <span className="guide-step-item guide-step-key">2. Tap bottom betslip to expand</span>
              <span className="guide-step-sep">→</span>
              <span className="guide-step-item">3. Press Space or click Place Bet</span>
            </div>
          </div>

          {/* Section Label: Style 2 */}
          <div className="guide-section-label">
            <span>CORE WORKFLOW</span>
          </div>

          {/* 2-Column Workflow Cards */}
          <div className="guide-cards-grid">
            <div className="guide-card">
              <h3 className="guide-card-title">Auto-Stake &amp; Target Profit</h3>
              <p className="guide-card-desc">
                Set a target profit in the toolbar (e.g. ₦7,500 or GH₵200). Click Auto Stake to calculate and populate exact stakes across all panes automatically.
              </p>
            </div>

            <div className="guide-card">
              <h3 className="guide-card-title">Multi-Pane Mirroring</h3>
              <p className="guide-card-desc">
                With Mirror enabled, match selections and navigation on Pane 1 replicate across all active panes simultaneously. Individual pane URLs remain adjustable in their title strips.
              </p>
            </div>

            <div className="guide-card">
              <h3 className="guide-card-title">Rapid Attack &amp; Hotkeys</h3>
              <div className="guide-hotkeys-list">
                <div className="guide-hotkey-row">
                  <kbd className="guide-kbd">Space</kbd>
                  <span>Rapid Attack (Synchronized bet submit)</span>
                </div>
                <div className="guide-hotkey-row">
                  <kbd className="guide-kbd">Enter</kbd>
                  <span>Rebet (Uses configured decrement)</span>
                </div>
                <div className="guide-hotkey-row">
                  <kbd className="guide-kbd">Alt + C</kbd>
                  <span>Cashout all open bets across panes</span>
                </div>
                <div className="guide-hotkey-row">
                  <kbd className="guide-kbd">Esc</kbd>
                  <span>Stop active Rapid Attack cycle</span>
                </div>
              </div>
            </div>

            <div className="guide-card">
              <h3 className="guide-card-title">Accounts &amp; Auto-Login</h3>
              <p className="guide-card-desc">
                Save phone numbers and passwords in the Accounts tab. Click Auto Login All to authenticate all panes simultaneously without manual credential entry.
              </p>
            </div>
          </div>

          {/* Section Label: Style 2 */}
          <div className="guide-section-label">
            <span>OPERATOR NOTES</span>
          </div>

          {/* Operator Notes: Same card styling */}
          <div className="guide-card guide-notes-card">
            <ul className="guide-notes-list">
              <li>Verify that live odds on all panes match before firing Rapid Attack.</li>
              <li>Keep the docked monitor open on the left to track live benchmark odds and market shifts early.</li>
              <li>Reopen this guide anytime via the Guide button in the top navigation bar or Settings.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="guide-modal-footer">
          <label className="guide-checkbox-wrap">
            <input
              type="checkbox"
              className="guide-checkbox-input"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span className="guide-checkbox-label">Don't show this guide on startup</span>
          </label>

          <div className="guide-footer-buttons">
            {onNavigateSettings && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose(dontShowAgain);
                  onNavigateSettings();
                }}
              >
                Settings
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onClose(dontShowAgain)}
            >
              Got it, let's start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
