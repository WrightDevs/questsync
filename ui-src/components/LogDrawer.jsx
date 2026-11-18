import React, { useEffect, useRef } from 'react';
import { IconClose } from './Icons.jsx';

export default function LogDrawer({ logs = [], onClear, onClose }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-box log-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>Activity & System Logs</h3>
            <span className="drawer-sub">Real-time audit log of stake syncs, attack cycles, and accounts</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {logs.length > 0 && (
              <button type="button" className="btn btn-sm" onClick={onClear}>
                Clear
              </button>
            )}
            <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
              <IconClose size={13} />
            </button>
          </div>
        </div>

        <div className="drawer-body" ref={listRef} style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No log messages yet. Actions and events will be recorded here.
            </div>
          ) : (
            <div className="log-list">
              {logs.map((log) => {
                const isErr = log.type === 'error' || /fail|error|blocked|lock/i.test(log.text);
                const isSuccess = log.type === 'success' || /placed|confirmed|submitted|success/i.test(log.text);
                const isRebet = /rebet|cycle|attack/i.test(log.text);
                const isStake = /stake/i.test(log.text);

                let badgeCls = 'log-badge-info';
                let badgeTxt = 'INFO';
                if (isErr) { badgeCls = 'log-badge-err'; badgeTxt = 'ERR'; }
                else if (isRebet) { badgeCls = 'log-badge-rebet'; badgeTxt = 'REBET'; }
                else if (isStake) { badgeCls = 'log-badge-stake'; badgeTxt = 'STAKE'; }
                else if (isSuccess) { badgeCls = 'log-badge-ok'; badgeTxt = 'OK'; }

                return (
                  <div key={log.id} className="log-item">
                    <span className="log-time">{log.time}</span>
                    <span className={`log-badge ${badgeCls}`}>{badgeTxt}</span>
                    <span className="log-msg">{log.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Showing {logs.length} logged events
          </span>
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

