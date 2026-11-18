import React, { useState, useEffect } from 'react';
import {
  LogIn,
  LogOut,
  Check,
  Eye,
  EyeOff,
  RotateCw,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';

const BOOKMAKERS = [
  { id: 'sportybet-ng', site: 'sportybet', country: 'ng', label: 'SportyBet (NG)' },
  { id: 'sportybet-gh', site: 'sportybet', country: 'gh', label: 'SportyBet (GH)' },
  { id: 'football-ng', site: 'football', country: 'ng', label: 'Football.com (NG)' },
  { id: 'football-gh', site: 'football', country: 'gh', label: 'Football.com (GH)' },
];

export default function AccountsPage({
  count = 5,
  paneStates = [],
  onSetPaneProfile,
  onNavigateHome,
}) {
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mfas:accounts') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (_) {
      return [];
    }
  });

  const [autoLogin, setAutoLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [bulkPhone, setBulkPhone] = useState('');
  const [bulkPassword, setBulkPassword] = useState('');
  const [accMsg, setAccMsg] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [loadingMap, setLoadingMap] = useState({});
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);

  // Monitor account credentials
  const [monitorAcc, setMonitorAcc] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('qs:monitorAcc') || '{"phone":"","password":""}');
    } catch (_) {
      return { phone: '', password: '' };
    }
  });

  const refreshAccountStatuses = async () => {
    if (window.api && window.api.getAccountStatuses) {
      setIsRefreshingBalances(true);
      try {
        const res = await window.api.getAccountStatuses();
        if (Array.isArray(res)) setStatuses(res);
      } catch (_) {}
      setIsRefreshingBalances(false);
    }
  };

  useEffect(() => {
    if (window.api && window.api.getAccounts) {
      window.api.getAccounts().then((accs) => {
        if (Array.isArray(accs) && accs.length > 0) {
          setAccounts(accs);
          localStorage.setItem('mfas:accounts', JSON.stringify(accs));
        }
      }).catch(() => {});
    }
    if (window.api && window.api.getAutoLogin) {
      window.api.getAutoLogin().then((val) => {
        if (typeof val === 'boolean') setAutoLogin(val);
      }).catch(() => {});
    }
    if (window.api && window.api.getUserSettings) {
      window.api.getUserSettings().then((s) => {
        if (s && s.monitorAccount && (s.monitorAccount.phone || s.monitorAccount.password)) {
          setMonitorAcc(s.monitorAccount);
          localStorage.setItem('qs:monitorAcc', JSON.stringify(s.monitorAccount));
        }
      }).catch(() => {});
    }
    refreshAccountStatuses();
  }, []);

  const rows = Array.from({ length: count }, (_, i) => accounts[i] || { phone: '', password: '' });

  const updateField = (idx, field, value) => {
    const next = Array.from({ length: Math.max(count, accounts.length) }, (_, i) => ({
      phone: '',
      password: '',
      ...(accounts[i] || {}),
    }));
    next[idx][field] = value;
    setAccounts(next);
    localStorage.setItem('mfas:accounts', JSON.stringify(next));
    if (window.api && window.api.saveAccounts) {
      window.api.saveAccounts(next);
    }
  };

  const handleApplyBulk = () => {
    if (!bulkPhone.trim() && !bulkPassword) {
      setAccMsg('Enter bulk phone and/or password first');
      return;
    }
    const next = Array.from({ length: Math.max(count, accounts.length) }, (_, i) => ({
      phone: bulkPhone.trim() || accounts[i]?.phone || '',
      password: bulkPassword || accounts[i]?.password || '',
    }));
    setAccounts(next);
    localStorage.setItem('mfas:accounts', JSON.stringify(next));
    if (window.api && window.api.saveAccounts) {
      window.api.saveAccounts(next);
    }
    setAccMsg(`Applied credentials across all ${count} panes`);
    setTimeout(() => setAccMsg(''), 2500);
  };

  const handleSave = () => {
    localStorage.setItem('mfas:accounts', JSON.stringify(accounts));
    if (window.api && window.api.saveAccounts) {
      window.api.saveAccounts(accounts);
    }
    setAccMsg('Credentials permanently saved');
    setTimeout(() => setAccMsg(''), 2500);
  };

  const handleToggleAutoLogin = (val) => {
    setAutoLogin(val);
    if (window.api && window.api.setAutoLogin) {
      window.api.setAutoLogin(val);
    }
    setAccMsg(val ? 'Auto-login on launch enabled' : 'Auto-login on launch disabled');
    setTimeout(() => setAccMsg(''), 2500);
  };

  const handleLoginOne = async (idx) => {
    const acc = rows[idx];
    if (!acc.phone.trim() || !acc.password) {
      setAccMsg(`Enter phone & password for Pane ${idx + 1}`);
      return;
    }
    setLoadingMap((m) => ({ ...m, [idx]: true }));
    setAccMsg(`Signing into Pane ${idx + 1}...`);
    try {
      const res = await window.api.loginAccount({
        windowIndex: idx,
        phone: acc.phone.trim(),
        password: acc.password,
      });
      setAccMsg(
        res.ok
          ? `Pane ${idx + 1}: ${res.alreadyLoggedIn ? 'Already signed in' : res.submitted ? 'Submitted credentials' : 'Credentials filled'}`
          : `Pane ${idx + 1}: ${res.reason || 'Login failed'}`
      );
      await refreshAccountStatuses();
    } catch (e) {
      setAccMsg(`Pane ${idx + 1} error: ${e.message}`);
    } finally {
      setLoadingMap((m) => ({ ...m, [idx]: false }));
    }
  };

  const handleLogoutOne = async (idx) => {
    setLoadingMap((m) => ({ ...m, [idx]: true }));
    setAccMsg(`Logging out Pane ${idx + 1}...`);
    try {
      if (window.api && window.api.logoutAccount) {
        await window.api.logoutAccount(idx);
      }
      setAccMsg(`Pane ${idx + 1} session cleared and logged out`);
      await refreshAccountStatuses();
    } catch (e) {
      setAccMsg(`Logout error: ${e.message}`);
    } finally {
      setLoadingMap((m) => ({ ...m, [idx]: false }));
    }
  };

  const handleLoginAll = async () => {
    localStorage.setItem('mfas:accounts', JSON.stringify(accounts));
    if (window.api && window.api.saveAccounts) {
      await window.api.saveAccounts(accounts);
    }
    setAccMsg('Opening login screens and signing into all panes...');
    try {
      const results = await window.api.loginAll(rows);
      const summary = results.map((r, i) => `P${i + 1}:${r.ok ? 'OK' : 'ERR'}`).join('  ');
      setAccMsg(`Sign-in results: ${summary}`);
      await refreshAccountStatuses();
    } catch (e) {
      setAccMsg(`Auto-login all error: ${e.message}`);
    }
  };

  return (
    <div className="full-page-view accounts-page">
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Account Management</h1>
          <p className="page-description">
            Configure bookmaker logins, monitor live account balances, and run automated multi-pane sign-in sessions.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-action"
            onClick={refreshAccountStatuses}
            disabled={isRefreshingBalances}
            title="Refresh live account balances"
          >
            <RotateCw size={13} className={isRefreshingBalances ? 'spin' : ''} />
            <span>Refresh Balances</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSave}
            title="Save all credentials"
          >
            <Check size={13} />
            <span>Save Credentials</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLoginAll}
            title="Auto-fill and log into all active panes simultaneously"
          >
            <LogIn size={14} />
            <span>Auto-Fill &amp; Sign In All Panes</span>
          </button>
        </div>
      </div>

      {/* ─── Status / Toast Notice ─── */}
      {accMsg && (
        <div className="page-notice-bar">
          <span className="notice-dot" />
          <span className="notice-text">{accMsg}</span>
        </div>
      )}

      {/* ─── Quick Batch Fill Card ─── */}
      <div className="content-card batch-card">
        <div className="card-header">
          <div className="card-title-group">
            <Layers size={14} className="card-title-icon" />
            <span className="card-title">Quick Batch Credential Fill</span>
          </div>
          <span className="card-subtitle">Fill once and apply across all active account panes simultaneously</span>
        </div>

        <div className="batch-inputs-row">
          <input
            className="inp inp-batch"
            type="tel"
            placeholder="Mobile / Phone Number"
            value={bulkPhone}
            onChange={(e) => setBulkPhone(e.target.value)}
          />

          <div className="password-input-wrap">
            <input
              className="inp inp-batch"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={bulkPassword}
              onChange={(e) => setBulkPassword(e.target.value)}
            />
            <button
              type="button"
              className="btn-eye"
              onClick={() => setShowPassword((s) => !s)}
              title={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleApplyBulk}
            title="Populate this phone and password across every pane row"
          >
            <span>Apply to All Panes</span>
          </button>

          <label className="checkbox-label" title="Keep saved credentials and sign in when QuestSync launches">
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => handleToggleAutoLogin(e.target.checked)}
            />
            <span>Auto-login on launch</span>
          </label>
        </div>
      </div>

      {/* ─── Main Accounts Grid Table ─── */}
      <div className="content-card table-card">
        <div className="card-header">
          <div className="card-title-group">
            <Shield size={14} className="card-title-icon" />
            <span className="card-title">Pane Accounts Matrix ({count} Active)</span>
          </div>
          <span className="card-subtitle">Per-pane bookmaker configuration, live balance sync, and authentication status</span>
        </div>

        <div className="accounts-table-container">
          <table className="accounts-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Pane</th>
                <th style={{ width: '190px' }}>Bookmaker</th>
                <th>Phone / Mobile Number</th>
                <th>Password</th>
                <th style={{ width: '130px' }}>Live Balance</th>
                <th style={{ width: '140px' }}>Session Status</th>
                <th style={{ width: '170px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((acc, i) => {
                const pane = paneStates[i] || {};
                const currentSite = pane.site || 'sportybet';
                const currentCountry = pane.country || 'ng';
                const currentBookmakerId = `${currentSite}-${currentCountry}`;
                const paneStatus = statuses.find((s) => s.index === i) || {};
                const isLoading = !!loadingMap[i];
                const sym = currentCountry === 'gh' ? 'GH₵' : '₦';

                const balanceDisplay =
                  paneStatus.balance != null
                    ? `${sym}${Number(paneStatus.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '--';

                const isLoggedIn = !!paneStatus.isLoggedIn;

                return (
                  <tr key={i} className="account-table-row">
                    {/* Pane Badge */}
                    <td>
                      <span className="pane-number-badge">Pane {i + 1}</span>
                    </td>

                    {/* Bookmaker Selector */}
                    <td>
                      <select
                        className="select-bookmaker"
                        value={currentBookmakerId}
                        onChange={(e) => {
                          const opt = BOOKMAKERS.find((b) => b.id === e.target.value);
                          if (opt && onSetPaneProfile) {
                            onSetPaneProfile(i, { site: opt.site, country: opt.country });
                          }
                        }}
                      >
                        {BOOKMAKERS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Phone Input */}
                    <td>
                      <input
                        className="inp inp-table"
                        type="tel"
                        placeholder="Mobile number"
                        value={acc.phone || ''}
                        onChange={(e) => updateField(i, 'phone', e.target.value)}
                        spellCheck={false}
                      />
                    </td>

                    {/* Password Input */}
                    <td>
                      <div className="password-input-wrap">
                        <input
                          className="inp inp-table"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Password"
                          value={acc.password || ''}
                          onChange={(e) => updateField(i, 'password', e.target.value)}
                          spellCheck={false}
                        />
                      </div>
                    </td>

                    {/* Live Balance */}
                    <td>
                      <span className={`balance-badge ${paneStatus.balance != null ? 'has-balance' : ''}`}>
                        {balanceDisplay}
                      </span>
                    </td>

                    {/* Session Status */}
                    <td>
                      {isLoading ? (
                        <span className="status-badge is-loading">
                          <RotateCw size={10} className="spin" />
                          <span>Connecting</span>
                        </span>
                      ) : isLoggedIn ? (
                        <span className="status-badge is-logged-in">
                          <span className="status-bullet is-online" />
                          <span>Active Session</span>
                        </span>
                      ) : (
                        <span className="status-badge is-logged-out">
                          <span className="status-bullet is-offline" />
                          <span>Not Logged In</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions-group">
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={() => handleLoginOne(i)}
                          disabled={isLoading}
                          title={`Log into Pane ${i + 1}`}
                        >
                          <LogIn size={11} />
                          <span>Sign In</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => handleLogoutOne(i)}
                          disabled={isLoading}
                          title={`Clear session and sign out of Pane ${i + 1}`}
                        >
                          <LogOut size={11} />
                          <span>Logout</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Odds Monitor Account Card ─── */}
      <div className="content-card monitor-acc-card">
        <div className="card-header">
          <div className="card-title-group">
            <Shield size={14} className="card-title-icon" />
            <span className="card-title">Odds Benchmark Monitor Account (Betano / betPawa)</span>
          </div>
          <span className="card-subtitle">Credentials for reference monitor odds streams and automation</span>
        </div>

        <div className="batch-inputs-row">
          <input
            className="inp inp-batch"
            type="tel"
            placeholder="Monitor Phone / Username"
            value={monitorAcc.phone || ''}
            onChange={(e) => {
              const updated = { ...monitorAcc, phone: e.target.value };
              setMonitorAcc(updated);
              localStorage.setItem('qs:monitorAcc', JSON.stringify(updated));
            }}
          />

          <div className="password-input-wrap">
            <input
              className="inp inp-batch"
              type={showPassword ? 'text' : 'password'}
              placeholder="Monitor Password"
              value={monitorAcc.password || ''}
              onChange={(e) => {
                const updated = { ...monitorAcc, password: e.target.value };
                setMonitorAcc(updated);
                localStorage.setItem('qs:monitorAcc', JSON.stringify(updated));
              }}
            />
            <button
              type="button"
              className="btn-eye"
              onClick={() => setShowPassword((s) => !s)}
              title={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              localStorage.setItem('qs:monitorAcc', JSON.stringify(monitorAcc));
              if (window.api && window.api.saveUserSettings) {
                window.api.saveUserSettings({ monitorAccount: monitorAcc });
              }
              setAccMsg('Monitor credentials saved');
              setTimeout(() => setAccMsg(''), 2500);
            }}
          >
            <Check size={13} />
            <span>Save Monitor Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}

