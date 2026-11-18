const { machineId, machineEntryId } = require('./license');
const mid = machineId();
console.log('machineId:', mid);
console.log('entryId:', machineEntryId(mid));
