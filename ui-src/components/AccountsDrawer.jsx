import React, { useState, useEffect } from 'react';
import { IconClose, IconLogIn } from './Icons.jsx';

export default function AccountsDrawer({ count, paneStates = [], onClose }) {
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mfas:accounts') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (_) {
      return [];
    }
  });
  const [autoLogin, setAutoLogin] = useState(true);
  const [accMsg, setAccMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bulkPhone, setBulkPhone] = useState('');
  const [bulkPassword, setBulkPassword] = useState('');

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
    setAccMsg(`Copied credentials across all ${count} panes`);
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
    setAccMsg(`Logging into Pane ${idx + 1}...`);
    const res = await window.api.loginAccount({
      windowIndex: idx,
      phone: acc.phone.trim(),
      password: acc.password,
    });
    setAccMsg(
      res.ok
        ? `Pane ${idx + 1}: ${res.alreadyLoggedIn ? 'Already logged in' : res.submitted ? 'Submitted' : 'Filled'}`
        : `Pane ${idx + 1}: ${res.reason}`
    );
  };

  const handleLoginAll = async () => {
    localStorage.setItem('mfas:accounts', JSON.stringify(accounts));
    if (window.api && window.api.saveAccounts) {
      await window.api.saveAccounts(accounts);
    }
    setAccMsg('Opening login pages and logging into all panes...');
    const results = await window.api.loginAll(rows);
    const summary = results.map((r, i) => `Pane ${i + 1}:${r.ok ? 'OK' : 'ERR'}`).join('  ');
    setAccMsg(`Results: ${summary}`);
  };

  return (
    <div className="drawer-panel">
      <div className="drawer-head">
        <div>
          <h3>QuestSync Account Manager</h3>
          <span className="drawer-sub">Configure credentials once. Click Auto-Login to fill and sign in across all panes.</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <IconClose size={12} />
          <span>Close</span>
        </button>
      </div>

      {/* Quick Bulk Fill Bar */}
      <div className="acc-bulk-bar" style={{ display: 'flex', gap: '8px', padding: '10px 16px', background: '#131824', borderBottom: '1px solid #232c3d', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Quick Copy to All:</span>
        <input
          className="inp"
          style={{ width: '130px' }}
          type="tel"
          placeholder="Phone"
          value={bulkPhone}
          onChange={(e) => setBulkPhone(e.target.value)}
        />
        <input
          className="inp"
          style={{ width: '130px' }}
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={bulkPassword}
          onChange={(e) => setBulkPassword(e.target.value)}
        />
        <button type="button" className="btn btn-sm" onClick={handleApplyBulk} title="Apply this phone/password to all pane rows">
          Apply to All Panes
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowPassword((s) => !s)}>
          {showPassword ? 'Hide Passwords' : 'Show Passwords'}
        </button>
      </div>

      <div className="acc-table">
        {rows.map((acc, i) => {
          const pane = paneStates[i] || {};
          const siteShort = pane.site === 'football' ? 'FB' : 'SB';
          const countryTag = (pane.country || 'ng').toUpperCase();
          const paneLabel = `Pane ${i + 1}`;
          return (
            <div key={i} className="acc-row-item">
              <span className="pane-idx" style={{ minWidth: '55px', fontWeight: 700 }}>{paneLabel}</span>
              <span className="field-lbl" style={{ minWidth: '60px' }}>{siteShort} {countryTag}</span>
              <input
                className="inp"
                style={{ flex: 1 }}
                type="tel"
                placeholder="Phone / Mobile Number"
                value={acc.phone || ''}
                onChange={(e) => updateField(i, 'phone', e.target.value)}
                spellCheck={false}
              />
              <input
                className="inp"
                style={{ flex: 1 }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={acc.password || ''}
                onChange={(e) => updateField(i, 'password', e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleLoginOne(i)}
                title={`Log into ${paneLabel}`}
              >
                <IconLogIn size={12} />
                <span>Login</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="drawer-footer">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleLoginAll} style={{ padding: '6px 14px', fontWeight: 700 }}>
            <IconLogIn size={13} />
            <span>Auto-Fill &amp; Login All Panes</span>
          </button>
          <button type="button" className="btn btn-sm" onClick={handleSave}>
            Save
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', marginLeft: '12px' }}>
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => handleToggleAutoLogin(e.target.checked)}
            />
            <span>Auto-Login on launch</span>
          </label>
        </div>
        <span className="status-ticker-line" style={{ fontWeight: 600 }}>{accMsg}</span>
      </div>
    </div>
  );
}
