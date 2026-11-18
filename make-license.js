// Usage:
//   Lock to one computer (recommended):
//     node make-license.js "Friend name" 30 3F9A-0C12-B7D4
//       (30 = days of access, use 0 for no expiry; the last part is the computer ID the app shows him)
//   Or a plain key that works on any computer:
//     node make-license.js "Friend name" 30
// Paste the printed line into the "keys" part of the licenses file you host.
const crypto = require('crypto');
const { machineEntryId } = require('./license');

const name = process.argv[2] || 'friend';
const days = parseInt(process.argv[3] || '0', 10);
const mid = (process.argv[4] || '').toUpperCase();

const entry = { active: true, note: name };
if (days > 0) entry.expires = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

if (mid) {
  if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){2}$/.test(mid)) {
    console.error('That computer ID does not look right. It should look like 3F9A-0C12-B7D4.');
    process.exit(1);
  }
  console.log('\nApproving computer ' + mid + ' for ' + name + '. No key file is needed.');
  console.log('\nLine to add inside "keys" in your hosted licenses file:\n  "' + machineEntryId(mid) + '": ' + JSON.stringify(entry) + '\n');
} else {
  const key = crypto.randomBytes(9).toString('hex').toUpperCase().match(/.{1,6}/g).join('-');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  console.log('\nKEY for ' + name + ' (put this in their license.key file):\n  ' + key);
  console.log('\nLine to add inside "keys" in your hosted licenses file:\n  "' + hash + '": ' + JSON.stringify(entry) + '\n');
}
