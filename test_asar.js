const asar = require('@electron/asar');
const buf = asar.extractFile('C:/Users/DELL/AppData/Local/Programs/questsync/resources/app.asar', 'license.config.json');
console.log('license.config.json:', buf.toString('utf8'));
