import React from 'react';
import { IconClose, IconMinus, IconPick, IconPlus, IconReload } from './Icons.jsx';

export default function SettingsDrawer({
  mirror,
  onToggleMirror,
  typing,
  onToggleTyping,
  whole,
  onToggleWhole,
  hotkeysEnabled,
  onToggleHotkeys,
  zoom,
  onZoom,
  rebetConfig = { decrementNG: 10, decrementGH: 1.0, mode: 'fixed' },
  onUpdateRebetConfig,
  autoRebetOnSpace = true,
  onToggleAutoRebetOnSpace,
  autoRebetCycles = 3,
  onAutoRebetCyclesChange,
  balanceAwareStake = true,
  onToggleBalanceAwareStake,
  betanoConfig,
  onUpdateBetanoConfig,
  onReloadBetano,
  onZoomBetano,
  degenArmed,
  onToggleDegen,
  cashoutConfig,
  onUpdateCashoutConfig,
  autoCashout,
  onToggleAutoCashout,
  oddsSel,
  stakeSel,
  onOddsSelChange,
  onStakeSelChange,
  onPickOdds,
  onPickStake,
  onClose,
}) {
  const mSite = betanoConfig?.site || 'betano';
  const bMode = betanoConfig?.mode || 'dock';
  const bSide = betanoConfig?.side || 'right';
  const bWidth = betanoConfig?.width ?? 340;
  const bZoom = betanoConfig?.zoom ?? 0.65;
  const bMobileUA = betanoConfig?.mobileUA !== false;

  const cAutoNav = cashoutConfig?.autoNavOpenBets !== false;
  const cDisarm = !!cashoutConfig?.disarmOnHit;
  const cPoll = cashoutConfig?.pollMs ?? 1200;

  return (
    <div className="drawer-panel">
      <div className="drawer-head">
        <div>
          <h3>System Settings</h3>
          <span className="drawer-sub">Changes apply immediately and persist locally</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <IconClose size={12} />
          <span>Close</span>
        </button>
      </div>

      <div className="drawer-grid">
        {/* Rebet Decrement Configuration (Requirement 2) */}
        <div className="drawer-card">
          <div className="drawer-card-title">Rebet Decrement Settings</div>
          <div className="drawer-row">
            <span className="drawer-label">Nigeria Stake Step (-₦)</span>
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
          <div className="drawer-row">
            <span className="drawer-label">Ghana Stake Step (-GH₵)</span>
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
          <div className="drawer-row">
            <span className="drawer-label">Decrement Mode</span>
            <div className="seg-group">
              <button
                type="button"
                className={`seg-btn ${rebetConfig.mode !== 'tiered' ? 'is-active' : ''}`}
                onClick={() => onUpdateRebetConfig({ mode: 'fixed' })}
                title="Subtract exact configured step each rebet"
              >
                Fixed Step
              </button>
              <button
                type="button"
                className={`seg-btn ${rebetConfig.mode === 'tiered' ? 'is-active' : ''}`}
                onClick={() => onUpdateRebetConfig({ mode: 'tiered' })}
                title="Larger steps above ₦100"
              >
                Tiered
              </button>
            </div>
          </div>
          <div className="drawer-row">
            <span className="drawer-label">Auto-Rebet on Space Bar</span>
            <button
              type="button"
              className={`toggle-switch ${autoRebetOnSpace ? 'is-on' : ''}`}
              onClick={onToggleAutoRebetOnSpace}
              title="When enabled, hitting Space Bar automatically places, confirms, and rebets until cycles complete"
            >
              <span className="indicator" />
              <span>{autoRebetOnSpace ? 'Armed' : 'Single Bet'}</span>
            </button>
          </div>
          <div className={`drawer-row ${!autoRebetOnSpace ? 'is-disabled' : ''}`}>
            <span className="drawer-label">Auto-Rebet Cycles</span>
            <input
              className="inp inp-num"
              type="number"
              min={1}
              max={99}
              value={autoRebetCycles}
              disabled={!autoRebetOnSpace}
              onChange={(e) => onAutoRebetCyclesChange(e.target.value)}
            />
          </div>
          <div className="drawer-row">
            <span className="drawer-label">Balance-Aware Stake</span>
            <button
              type="button"
              className={`toggle-switch ${balanceAwareStake !== false ? 'is-on' : ''}`}
              onClick={onToggleBalanceAwareStake}
              title="When target stake exceeds account balance, use full account balance until odds rise"
            >
              <span className="indicator" />
              <span>{balanceAwareStake !== false ? 'Auto Balance-Cap (ON)' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Interaction & Hotkeys */}
        <div className="drawer-card">
          <div className="drawer-card-title">Input &amp; Hotkeys</div>
          <div className="drawer-row">
            <button
              type="button"
              className={`toggle-switch ${hotkeysEnabled ? 'is-on' : ''}`}
              onClick={onToggleHotkeys}
              title="Space = Place Bet & Confirm, Enter = Rebet, Alt+C = Cashout All"
            >
              <span className="indicator" />
              <span>Hotkeys (Space / Enter / Alt+C)</span>
            </button>
            <button
              type="button"
              className={`toggle-switch ${whole ? 'is-on' : ''}`}
              onClick={onToggleWhole}
              title="Round calculated stakes down to whole numbers"
            >
              <span className="indicator" />
              <span>Whole Stakes</span>
            </button>
          </div>

          <div className="drawer-row">
            <button
              type="button"
              className={`toggle-switch ${mirror ? 'is-on' : ''}`}
              onClick={onToggleMirror}
              title="Mirror mouse clicks and scrolling across panes"
            >
              <span className="indicator" />
              <span>Mirror Clicks</span>
            </button>
            <button
              type="button"
              className={`toggle-switch ${typing ? 'is-on warn' : ''}`}
              onClick={onToggleTyping}
              title="Mirror keystrokes across panes"
            >
              <span className="indicator" />
              <span>Mirror Typing</span>
            </button>
          </div>

          <div className="drawer-row">
            <span className="drawer-label">SportyBet Zoom</span>
            <div className="seg-group">
              <button type="button" className="seg-btn" onClick={() => onZoom('out')} aria-label="Zoom out">
                <IconMinus size={11} />
              </button>
              <button
                type="button"
                className="seg-btn"
                style={{ minWidth: '40px' }}
                onClick={() => onZoom('reset')}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="seg-btn" onClick={() => onZoom('in')} aria-label="Zoom in">
                <IconPlus size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Odds Reference Monitor */}
        <div className="drawer-card">
          <div className="drawer-card-title">Odds Monitor ({mSite})</div>
          <div className="drawer-row">
            <span className="drawer-label">Provider</span>
            <div className="seg-group">
              <button
                type="button"
                className={`seg-btn ${mSite === 'betano' ? 'is-active' : ''}`}
                onClick={() => onUpdateBetanoConfig({ site: 'betano' })}
              >
                Betano
              </button>
              <button
                type="button"
                className={`seg-btn ${mSite === 'betpawa' ? 'is-active' : ''}`}
                onClick={() => onUpdateBetanoConfig({ site: 'betpawa' })}
              >
                betPawa
              </button>
            </div>

            <div className="seg-group">
              <button
                type="button"
                className={`seg-btn ${bMode === 'dock' ? 'is-active' : ''}`}
                onClick={() => onUpdateBetanoConfig({ mode: 'dock' })}
              >
                Dock
              </button>
              <button
                type="button"
                className={`seg-btn ${bMode === 'float' ? 'is-active' : ''}`}
                onClick={() => onUpdateBetanoConfig({ mode: 'float' })}
              >
                Float
              </button>
            </div>
          </div>

          {bMode === 'dock' && (
            <div className="drawer-row">
              <span className="drawer-label">Dock Side &amp; Width</span>
              <div className="seg-group">
                <button
                  type="button"
                  className={`seg-btn ${bSide === 'left' ? 'is-active' : ''}`}
                  onClick={() => onUpdateBetanoConfig({ side: 'left' })}
                >
                  Left
                </button>
                <button
                  type="button"
                  className={`seg-btn ${bSide === 'right' ? 'is-active' : ''}`}
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
              />
              <span className="field-lbl">{bWidth}px</span>
            </div>
          )}

          <div className="drawer-row">
            <span className="drawer-label">Monitor Controls</span>
            <button
              type="button"
              className={`toggle-switch ${bMobileUA ? 'is-on' : ''}`}
              onClick={() => onUpdateBetanoConfig({ mobileUA: !bMobileUA })}
              title="Use mobile site layout"
            >
              <span className="indicator" />
              <span>Mobile UA</span>
            </button>
            <button type="button" className="btn btn-sm" onClick={onReloadBetano}>
              <IconReload size={11} /> Reload
            </button>
          </div>
        </div>

        {/* Cashout Automation */}
        <div className="drawer-card">
          <div className="drawer-card-title">Cashout &amp; Degen Engine</div>
          <div className="drawer-row">
            <button
              type="button"
              className={`toggle-switch ${autoCashout ? 'is-on alert' : ''}`}
              onClick={onToggleAutoCashout}
              title="Continuously scan Open Bets and cash out winning tickets"
            >
              <span className="indicator" />
              <span>Auto-Cashout</span>
            </button>
            <button
              type="button"
              className={`toggle-switch ${degenArmed ? 'is-on warn' : ''}`}
              onClick={onToggleDegen}
              title="Degen Mode: Automatically place bets when monitor suspends"
            >
              <span className="indicator" />
              <span>Degen Mode</span>
            </button>
          </div>
          <div className="drawer-row">
            <button
              type="button"
              className={`toggle-switch ${cAutoNav ? 'is-on' : ''}`}
              onClick={() => onUpdateCashoutConfig({ autoNavOpenBets: !cAutoNav })}
            >
              <span className="indicator" />
              <span>Auto-Open Bets Tab</span>
            </button>
            <button
              type="button"
              className={`toggle-switch ${cDisarm ? 'is-on warn' : ''}`}
              onClick={() => onUpdateCashoutConfig({ disarmOnHit: !cDisarm })}
            >
              <span className="indicator" />
              <span>Disarm On Hit</span>
            </button>
          </div>
          <div className="drawer-row">
            <span className="drawer-label">Poll Interval</span>
            <input
              className="inp inp-num"
              type="number"
              min={600}
              max={5000}
              step={200}
              value={cPoll}
              onChange={(e) => onUpdateCashoutConfig({ pollMs: parseInt(e.target.value, 10) || 1200 })}
            />
            <span className="field-lbl">ms</span>
          </div>
        </div>

        {/* DOM Selectors (Advanced) */}
        <div className="drawer-card" style={{ gridColumn: '1 / -1' }}>
          <div className="drawer-card-title">Custom DOM Selectors (Optional)</div>
          <div className="drawer-row">
            <span className="drawer-label" style={{ minWidth: '70px' }}>Odds Selector</span>
            <input
              className="inp inp-mono"
              style={{ flex: 1 }}
              type="text"
              placeholder="Auto-detected"
              value={oddsSel}
              onChange={(e) => onOddsSelChange(e.target.value)}
              spellCheck={false}
            />
            <button type="button" className="btn btn-sm" onClick={onPickOdds}>
              <IconPick size={12} /> Pick
            </button>
            {oddsSel && (
              <button type="button" className="btn btn-sm" onClick={() => onOddsSelChange('')}>
                <IconClose size={11} />
              </button>
            )}
          </div>
          <div className="drawer-row">
            <span className="drawer-label" style={{ minWidth: '70px' }}>Stake Selector</span>
            <input
              className="inp inp-mono"
              style={{ flex: 1 }}
              type="text"
              placeholder="Auto-detected"
              value={stakeSel}
              onChange={(e) => onStakeSelChange(e.target.value)}
              spellCheck={false}
            />
            <button type="button" className="btn btn-sm" onClick={onPickStake}>
              <IconPick size={12} /> Pick
            </button>
            {stakeSel && (
              <button type="button" className="btn btn-sm" onClick={() => onStakeSelChange('')}>
                <IconClose size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
