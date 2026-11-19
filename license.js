// Optional access check. If there is no license.config.json next to this file, the app runs
// without any check (that is your own copy).
//
// Two modes, set in license.config.json:
//   "machineLock": true  -> the license belongs to ONE computer. The app shows that computer's ID
//                           when it is not approved yet; you approve the ID in your hosted file.
//                           Copying the app to another computer does not work.
//   otherwise            -> the license is a key stored in license.key.
// To cut someone off, set their entry to "active": false in the hosted file.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
};

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// A short, stable ID for this computer, e.g. 3F9A-0C12-B7D4.
function machineId() {
  let guid = '';
  if (process.platform === 'win32') {
    try {
      const out = require('child_process').execSync(
        'reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid',
        { encoding: 'utf8', windowsHide: true, timeout: 5000 }
      );
      const m = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
      if (m) guid = m[1];
    } catch (_) {}
  }
  const raw = guid || [os.hostname(), os.userInfo().username, (os.cpus()[0] || {}).model].join('|');
  return sha256('msb:' + raw).slice(0, 12).toUpperCase().match(/.{4}/g).join('-');
}

// What goes into the hosted file for a computer (used by make-license.js too).
const machineEntryId = (mid) => sha256('machine:' + mid);

async function checkLicense(deps = {}) {
  const baseDir = deps.baseDir || __dirname;
  const cfg = readJson(path.join(baseDir, 'license.config.json'));
  if (!cfg || !cfg.url) return { ok: true, skipped: true };

  const dataDir = deps.dataDir || require('electron').app.getPath('userData');
  const doFetch =
    deps.fetch ||
    ((u) => require('electron').net.fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(10000) }));
  const now = deps.now ? deps.now() : Date.now();

  let id;
  let mid = null;
  if (cfg.machineLock) {
    mid = deps.machineId || machineId();
    id = machineEntryId(mid);
  } else {
    let key = '';
    try {
      key = fs.readFileSync(path.join(baseDir, 'license.key'), 'utf8').trim();
    } catch (_) {}
    if (!key) return { ok: false, reason: 'No license key was found. Please contact the person who gave you this app.' };
    id = sha256(key); // only a hash is stored in the hosted file, so keys can't be read from it
  }

  const cachePath = path.join(dataDir, 'license-cache.json');

  try {
    const sep = cfg.url.includes('?') ? '&' : '?';
    const res = await doFetch(`${cfg.url}${sep}t=${now}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const entry = data && data.keys && data.keys[id];
    if (!entry) {
      return {
        ok: false,
        notApproved: true,
        mid,
        portalUrl: cfg.portalUrl || 'https://questsync-licensing-portal.vercel.app',
        reason: mid
          ? 'This computer is not approved yet.\n\nYour Computer ID: ' + mid
          : 'Your access to this app has been disabled.',
      };
    }
    if (entry.active === false) return { ok: false, reason: 'Your access to this app has been disabled.' };
    if (entry.expires && new Date(entry.expires + 'T23:59:59').getTime() < now) {
      return {
        ok: false,
        expired: true,
        mid,
        portalUrl: cfg.portalUrl || 'https://questsync-licensing-portal.vercel.app',
        reason: 'Your access to this app has expired.'
      };
    }
    try {
      fs.writeFileSync(cachePath, JSON.stringify({ lastOk: now }));
    } catch (_) {}
    return { ok: true };
  } catch (_) {
    // Could not reach the hosted file. Allow a short offline period, then block.
    const cache = readJson(cachePath);
    const graceMs = (cfg.graceHours == null ? 24 : cfg.graceHours) * 3600 * 1000;
    if (cache && now - cache.lastOk < graceMs) return { ok: true, offline: true };
    return { ok: false, reason: 'Could not verify your access. Please check your internet connection.' };
  }
}

module.exports = { checkLicense, machineId, machineEntryId };
