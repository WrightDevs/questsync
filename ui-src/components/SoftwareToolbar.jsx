import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Zap,
  Square,
  RotateCcw,
  DollarSign,
} from 'lucide-react';

export default function SoftwareToolbar({
  url = '',
  urlScope = 'all',
  activePaneIndex = 0,
  onToggleUrlScope,
  onUrlChange,
  onLoadUrl,
  onBack,
  onReload,
  count = 5,
  onCountChange,
  hasGh = true,
  hasNg = true,
  targetGH = '200',
  targetNG = '7500',
  onTargetGHChange,
  onTargetNGChange,
  autoUpdate = false,
  onToggleAutoUpdate,
  onSyncNow,
  onMinStake,
  rebetActive = false,
  autoRebetState = { running: false, cycle: 0, target: 1 },
  autoRebetOnSpace = true,
  onStartAutoRebet,
  onStopAutoRebet,
  onPlaceBet,
  onRebet,
  onCashoutAll,
}) {
  const scopeLabel = urlScope === 'active' ? `W${(activePaneIndex || 0) + 1}` : 'ALL';
  const isAttacking = !!autoRebetState?.running || rebetActive;

  return (
    <div className="software-toolbar-deck">
      <div className="software-toolbar-row">
        {/* ─── URL & Navigation Group ─── */}
        <div className="toolbar-group url-group">
          <button
            type="button"
            className={`btn btn-scope ${urlScope === 'active' ? 'is-active' : ''}`}
            onClick={onToggleUrlScope}
            title={`URL Scope: ${urlScope === 'active' ? `Pane ${(activePaneIndex || 0) + 1} only` : 'All Panes'}`}
          >
            {scopeLabel}
          </button>

          <input
            className="inp inp-url"
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLoadUrl()}
            placeholder="sportybet.com/ng/m/ or football.com/ng/m/"
            spellCheck={false}
          />

          <button
            type="button"
            className="btn btn-primary btn-load"
            onClick={onLoadUrl}
            title="Load URL"
          >
            <ArrowRight size={13} />
            <span>Load</span>
          </button>

          <button
            type="button"
            className="btn btn-icon"
            onClick={onBack}
            title="Go Back"
            aria-label="Back"
          >
            <ArrowLeft size={13} />
          </button>

          <button
            type="button"
            className="btn btn-icon"
            onClick={onReload}
            title="Reload Panes"
            aria-label="Reload"
          >
            <RotateCw size={13} />
          </button>
        </div>

        {/* ─── Panes Selector Group ─── */}
        <div className="toolbar-group panes-group">
          <span className="group-label">Panes:</span>
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
        </div>

        {/* ─── Stake Inputs Group ─── */}
        <div className="toolbar-group stakes-group">
          <div
            className={`stat-chip ${hasGh ? 'highlight-gh' : ''}`}
            title="Profit target for Ghana panes (/gh/)"
          >
            <span className="chip-tag">GH</span>
            <span className="chip-symbol">GH₵</span>
            <input
              className="inp-chip"
              type="number"
              min={1}
              value={targetGH}
              onChange={(e) => onTargetGHChange(e.target.value)}
            />
          </div>

          <div
            className={`stat-chip ${hasNg ? 'highlight-ng' : ''}`}
            title="Profit target for Nigeria panes (/ng/)"
          >
            <span className="chip-tag">NG</span>
            <span className="chip-symbol">₦</span>
            <input
              className="inp-chip"
              type="number"
              min={1}
              value={targetNG}
              onChange={(e) => onTargetNGChange(e.target.value)}
            />
          </div>

          <button
            type="button"
            className={`toggle-switch ${autoUpdate ? 'is-on' : ''}`}
            onClick={onToggleAutoUpdate}
            title="Automatically compute and write stakes into slips as odds update"
          >
            <span className="indicator" />
            <span>Auto Stake</span>
          </button>

          <button
            type="button"
            className="btn btn-action"
            onClick={onSyncNow}
            title="Recalculate and write profit target stakes into all panes immediately"
          >
            <RotateCw size={12} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            className="btn btn-action"
            onClick={onMinStake}
            title="Apply minimum stake across all panes (SB NG: ₦10, SB GH: GH₵0.1, FB: ₦1)"
          >
            <span>Min Stake</span>
          </button>
        </div>

        {/* ─── Execution Controls Group ─── */}
        <div className="toolbar-group execution-group">
          {isAttacking ? (
            <button
              type="button"
              className="btn btn-auto-rebet is-running"
              onClick={onStopAutoRebet}
              title="Stop continuous Rapid Attack [Space / Esc]"
            >
              <Square size={13} />
              <span>Stop Attack ({autoRebetState.cycle}/{autoRebetState.target})</span>
              <kbd>Space</kbd>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-place"
              onClick={autoRebetOnSpace ? onStartAutoRebet : onPlaceBet}
              title={autoRebetOnSpace ? "Trigger Rapid Attack cycle across all panes [Space]" : "Place Single Bet across all panes [Space]"}
            >
              <Zap size={14} />
              <span>{autoRebetOnSpace ? 'Rapid Attack' : 'Single Bet'}</span>
              <kbd>Space</kbd>
            </button>
          )}

          <button
            type="button"
            className="btn btn-rebet"
            onClick={onRebet}
            title="Execute Rebet across all panes [Enter]"
          >
            <RotateCcw size={13} />
            <span>Rebet</span>
            <kbd>Enter</kbd>
          </button>

          <button
            type="button"
            className="btn btn-cashout"
            onClick={onCashoutAll}
            title="Scan Open Bets and cash out tickets across all panes [Alt+C]"
          >
            <DollarSign size={14} />
            <span>Cashout All</span>
            <kbd>Alt+C</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

