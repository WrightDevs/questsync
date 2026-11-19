const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = __dirname;
const STAGE = path.join(ROOT, 'dist-stage');
const RELEASE = path.join(ROOT, 'release');
const LICENSE_BAK = path.join(ROOT, 'license.config.json.bak');

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function obfuscateNodeJs(source) {
  return JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.9,
    target: 'node',
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
}

function obfuscateBrowserJs(source) {
  return JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.9,
    target: 'browser',
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
}

async function compileProtectedMain(name, electronPath) {
  const raw = fs.readFileSync(path.join(ROOT, name), 'utf8');
  const obf = obfuscateNodeJs(raw);
  const tmpJs = path.join(STAGE, `_tmp_${name}`);
  const outJsc = path.join(STAGE, name.replace(/\.js$/, '.jsc'));
  fs.writeFileSync(tmpJs, obf, 'utf8');
  await bytenode.compileFile({
    filename: tmpJs,
    output: outJsc,
    compileAsModule: true,
    electronMain: true,
    electronPath,
  });
  fs.unlinkSync(tmpJs);
}

async function main() {
  if (!fs.existsSync(LICENSE_BAK)) {
    throw new Error('Missing license.config.json.bak for distribution licensing.');
  }
  const licCfg = JSON.parse(fs.readFileSync(LICENSE_BAK, 'utf8'));
  if (!licCfg || !licCfg.url) {
    throw new Error('license.config.json.bak has no valid url.');
  }

  console.log('[1/5] Building production React UI...');
  execSync('npm run build:ui', { cwd: ROOT, stdio: 'inherit' });

  console.log('[2/5] Preparing clean staging directory...');
  cleanDir(STAGE);
  cleanDir(RELEASE);

  copyDirSync(path.join(ROOT, 'ui-dist'), path.join(STAGE, 'ui-dist'));

  // Bake license config inside protected app bundle (keeps local dev folder unlicensed)
  fs.writeFileSync(path.join(STAGE, 'license.config.json'), JSON.stringify(licCfg, null, 2), 'utf8');
  if (fs.existsSync(path.join(ROOT, 'update.config.json'))) {
    fs.copyFileSync(path.join(ROOT, 'update.config.json'), path.join(STAGE, 'update.config.json'));
  }

  // Runtime dependencies (bytenode + electron-updater and transitive runtime packages)
  const RUNTIME_PACKAGES = [
    'bytenode',
    'electron-updater',
    'builder-util-runtime',
    'fs-extra',
    'graceful-fs',
    'jsonfile',
    'universalify',
    'js-yaml',
    'argparse',
    'lazy-val',
    'semver',
    'sax',
    'debug',
    'ms',
    'lodash.escaperegexp',
    'lodash.isequal',
    'tiny-typed-emitter',
  ];

  const stageNodeModules = path.join(STAGE, 'node_modules');
  fs.mkdirSync(stageNodeModules, { recursive: true });
  for (const pkgName of RUNTIME_PACKAGES) {
    const src = path.join(ROOT, 'node_modules', pkgName);
    const dest = path.join(stageNodeModules, pkgName);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const electronPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'electron', 'package.json'), 'utf8'));

  fs.writeFileSync(
    path.join(STAGE, 'package.json'),
    JSON.stringify(
      {
        name: 'questsync',
        productName: 'QuestSync',
        version: pkg.version || '1.0.0',
        description: 'QuestSync - Multi-Account Synced Betting & Rapid Attack Engine',
        main: 'main.js',
        dependencies: {
          bytenode: '^2.1.0',
          'electron-updater': pkg.dependencies?.['electron-updater'] || '^6.3.9',
        },
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('[3/5] Obfuscating preloads and compiling main, updater, license into V8 bytecode (.jsc)...');
  const electronPath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');

  // Remove ELECTRON_RUN_AS_NODE if inherited so bytenode's electronMain spawns true Chromium main process
  delete process.env.ELECTRON_RUN_AS_NODE;

  await compileProtectedMain('main.js', electronPath);
  await compileProtectedMain('license.js', electronPath);
  await compileProtectedMain('site-adapters.js', electronPath);
  await compileProtectedMain('updater.js', electronPath);

  fs.writeFileSync(
    path.join(STAGE, 'main.js'),
    "'use strict';\nrequire('bytenode');\nrequire('./main.jsc');\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(STAGE, 'license.js'),
    "'use strict';\nmodule.exports = require('./license.jsc');\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(STAGE, 'site-adapters.js'),
    "'use strict';\nmodule.exports = require('./site-adapters.jsc');\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(STAGE, 'updater.js'),
    "'use strict';\nmodule.exports = require('./updater.jsc');\n",
    'utf8'
  );

  for (const preload of ['ui-preload.js', 'view-preload.js']) {
    const src = fs.readFileSync(path.join(ROOT, preload), 'utf8');
    fs.writeFileSync(path.join(STAGE, preload), obfuscateBrowserJs(src), 'utf8');
  }

  console.log('[4/5] Packaging Windows Setup Installer (.exe) with electron-builder...');
  const builderCfg = {
    appId: 'com.questsync.app',
    productName: 'QuestSync',
    electronVersion: electronPkg.version,
    electronDist: path.join(ROOT, 'node_modules', 'electron', 'dist'),
    directories: {
      app: STAGE,
      output: RELEASE,
      buildResources: path.join(ROOT, 'build'),
    },
    asar: true,
    npmRebuild: false,
    compression: 'maximum',
    win: {
      icon: path.join(ROOT, 'build', 'icon.ico'),
      target: [
        { target: 'nsis', arch: ['x64'] },
      ],
    },
    mac: {
      icon: path.join(ROOT, 'build', 'icon.icns'),
      target: ['dmg', 'zip'],
    },
    linux: {
      icon: path.join(ROOT, 'build', 'icons'),
      target: ['AppImage', 'deb'],
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      allowToChangeInstallationDirectory: false,
      deleteAppDataOnUninstall: false,
      installerIcon: path.join(ROOT, 'build', 'icon.ico'),
      uninstallerIcon: path.join(ROOT, 'build', 'icon.ico'),
      artifactName: `QuestSync-Setup-${pkg.version || '1.0.0'}.exe`,
    },
    publish: {
      provider: 'github',
      owner: 'WrightDevs',
      repo: 'questsync',
    },
  };

  const cfgPath = path.join(ROOT, 'electron-builder.dist.json');
  fs.writeFileSync(cfgPath, JSON.stringify(builderCfg, null, 2), 'utf8');

  const ebCli = path.join(ROOT, 'node_modules', 'electron-builder', 'cli.js');
  const res = spawnSync(process.execPath, [ebCli, '--win', '--x64', '--config', cfgPath], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (res.status !== 0) {
    throw new Error(`electron-builder exited with code ${res.status}`);
  }

  // Clean temporary staging dir and generated builder config
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.rmSync(cfgPath, { force: true });

  console.log('[5/5] Distribution build complete in:', RELEASE);

  const shouldPublish = process.argv.includes('--publish');
  if (shouldPublish) {
    console.log('[6/5] Automatically publishing release to GitHub (WrightDevs/questsync)...');
    const versionTag = `v${pkg.version || '1.0.0'}`;
    const exeName = `QuestSync-Setup-${pkg.version || '1.0.0'}.exe`;

    const ghArgs = [
      'release',
      'create',
      versionTag,
      path.join('release', exeName),
      path.join('release', `${exeName}.blockmap`),
      path.join('release', 'latest.yml'),
      '--repo',
      'WrightDevs/questsync',
      '--title',
      `QuestSync ${versionTag}`,
      '--notes',
      `Release ${versionTag}: Rapid bet placement confirmation observer, Betano monitor setting fix, and self-serve licensing portal integration.`,
    ];
    const pubRes = spawnSync('gh', ghArgs, { cwd: ROOT, stdio: 'inherit' });
    if (pubRes.status === 0) {
      console.log(`\nSuccessfully published ${versionTag} to GitHub Releases!`);
    } else {
      console.warn('\nWarning: Automatic upload via gh failed. Exit code:', pubRes.status);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
