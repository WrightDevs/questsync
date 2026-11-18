import React from 'react';
import { IconCheck, IconSync } from './Icons.jsx';

export default function ProfitEngineBar({
  hasGh,
  hasNg,
  targetGH,
  targetNG,
  onTargetGHChange,
  onTargetNGChange,
  rebetDecrementNG,
  rebetDecrementGH,
  onRebetDecrementNGChange,
  onRebetDecrementGHChange,
  autoUpdate,
  onToggleAutoUpdate,
  onSyncNow,
  onMinStake,
  onPlaceBet,
  onRebet,
  autoRebetOnSpace = true,
  onToggleAutoRebetOnSpace,
  autoRebetState = { running: false, cycle: 0, target: 1 },
  autoRebetCycles,
  onAutoRebetCyclesChange,
  onStartAutoRebet,
  onStopAutoRebet,
  degenArmed,
  onToggleDegen,
  onCashoutAll,
  autoCashout,
  onToggleAutoCashout,
}) {
  const isAutoRebetting = !!autoRebetState.running;

  return (
    <div className="bar-row nowrap">
      {/* Target Profit Inputs */}
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

      {/* Stake Sync Utilities */}
      <button
        type="button"
        className={`toggle-switch ${autoUpdate ? 'is-on' : ''}`}
        onClick={onToggleAutoUpdate}
        title="Automatically calculate and enter stakes as odds update"
      >
        <span className="indicator" />
        <span>Auto Stake</span>
      </button>

      <button
        type="button"
        className="btn"
        onClick={onSyncNow}
        title="Recalculate & write profit target stakes into all panes now"
      >
        <IconSync size={12} />
        <span>Sync</span>
      </button>

      <button
        type="button"
        className="btn"
        onClick={onMinStake}
        title="Apply minimum stake across all panes (SB NG: ₦10, SB GH: GH₵0.1, FB: ₦1)"
      >
        <span>Min Stake</span>
      </button>

      <div className="sep" />

      {/* Primary Betting Execution Controls */}
      {isAutoRebetting ? (
        <button
          type="button"
          className="btn btn-auto-rebet is-running"
          onClick={onStopAutoRebet}
          title="Click to stop Auto-Rebet immediately [Space / Esc]"
        >
          <span>⏹ Stop Rapid Attack ({autoRebetState.cycle}/{autoRebetState.target})</span>
          <kbd>Space / Esc</kbd>
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-place"
          onClick={onStartAutoRebet}
          title="Start continuous Rapid Attack [Space]"
        >
          <IconCheck size={13} />
          <span>⚡ Rapid Attack</span>
          <kbd>Space</kbd>
        </button>
      )}

      {/* Manual Single Rebet */}
      <button
        type="button"
        className="btn btn-rebet"
        onClick={onRebet}
        title="Click Rebet across panes and apply stake [Enter]"
      >
        <span>Rebet</span>
        <kbd>Enter</kbd>
      </button>

      <div className="sep" />

      {/* Cashout All */}
      <button
        type="button"
        className="btn btn-cashout"
        onClick={onCashoutAll}
        title="Check Open Bets and cash out tickets across all panes [Alt+C]"
      >
        <span>Cashout All</span>
        <kbd>Alt+C</kbd>
      </button>
    </div>
  );
}
