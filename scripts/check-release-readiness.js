import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  const raw = readText(filePath);
  return {
    raw,
    json: JSON.parse(raw.replace(/^\uFEFF/, '')),
    hasBom: raw.charCodeAt(0) === 0xfeff,
  };
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function fileSize(filePath) {
  return fs.statSync(filePath).size;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function pushCheck(checks, name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
}

function buildReport(args) {
  const root = process.cwd();
  const releaseDir = path.resolve(root, args['release-dir'] || 'release');
  const packagePath = path.join(root, 'package.json');
  const tauriConfigPath = path.join(root, 'src-tauri', 'tauri.conf.json');
  const latestPath = path.join(releaseDir, 'latest.json');
  const checks = [];

  pushCheck(checks, 'package.json exists', exists(packagePath), packagePath);
  pushCheck(checks, 'tauri.conf.json exists', exists(tauriConfigPath), tauriConfigPath);
  pushCheck(checks, 'release/latest.json exists', exists(latestPath), latestPath);

  if (!exists(packagePath) || !exists(tauriConfigPath) || !exists(latestPath)) {
    return { ok: false, releaseDir, checks };
  }

  const pkg = readJson(packagePath).json;
  const tauriConfig = readJson(tauriConfigPath).json;
  const latest = readJson(latestPath);
  const latestJson = latest.json;
  const version = String(args.version || pkg.version || '').trim();
  const platform = latestJson.platforms?.['windows-x86_64'];
  const endpoint = tauriConfig.plugins?.updater?.endpoints?.[0] || '';
  const expectedInstallerName = `Distill_${version}_x64-setup.exe`;
  const installerName = platform?.url ? path.basename(new URL(platform.url).pathname) : expectedInstallerName;
  const installerPath = path.join(releaseDir, installerName);
  const signaturePath = path.join(releaseDir, `${installerName}.sig`);
  const manifestPath = path.join(root, 'docs', `release_manifest_${version}.json`);
  const manifest = exists(manifestPath) ? readJson(manifestPath).json : null;

  pushCheck(checks, 'package version is set', Boolean(version), version || 'missing');
  pushCheck(checks, 'Tauri version matches package version', tauriConfig.version === version, `${tauriConfig.version || 'missing'} vs ${version}`);
  pushCheck(checks, 'latest.json has no BOM', !latest.hasBom, latestPath);
  pushCheck(checks, 'latest.json version matches package version', latestJson.version === version, `${latestJson.version || 'missing'} vs ${version}`);
  pushCheck(checks, 'latest.json has windows-x86_64 platform', Boolean(platform), 'platforms.windows-x86_64');
  pushCheck(checks, 'latest.json pub_date is parseable', !Number.isNaN(Date.parse(latestJson.pub_date || '')), latestJson.pub_date || 'missing');
  pushCheck(checks, 'updater endpoint points to latest.json', endpoint.endsWith('/latest.json'), endpoint || 'missing');
  pushCheck(checks, 'installer URL has expected versioned filename', installerName === expectedInstallerName, installerName);
  pushCheck(checks, 'installer file exists', exists(installerPath), installerPath);
  pushCheck(checks, 'signature file exists', exists(signaturePath), signaturePath);
  pushCheck(checks, 'latest.json signature is present', Boolean(platform?.signature), platform?.signature ? 'present' : 'missing');

  if (exists(installerPath)) {
    pushCheck(checks, 'installer file is non-empty', fileSize(installerPath) > 0, `${fileSize(installerPath)} bytes`);
  }

  if (exists(signaturePath) && platform?.signature) {
    const signature = readText(signaturePath).trim();
    pushCheck(checks, 'signature file matches latest.json', signature === platform.signature, signaturePath);
  }

  if (manifest) {
    pushCheck(checks, 'release manifest version matches package version', manifest.version === version, `${manifest.version || 'missing'} vs ${version}`);
    pushCheck(checks, 'release manifest artifact path matches installer', path.normalize(manifest.artifact || '') === path.normalize(path.relative(root, installerPath)), manifest.artifact || 'missing');
    pushCheck(checks, 'release manifest signature path matches signature file', path.normalize(manifest.signature || '') === path.normalize(path.relative(root, signaturePath)), manifest.signature || 'missing');
    pushCheck(checks, 'release manifest latestJson path matches latest.json', path.normalize(manifest.latestJson || '') === path.normalize(path.relative(root, latestPath)), manifest.latestJson || 'missing');
    if (exists(installerPath)) {
      pushCheck(checks, 'release manifest sha256 matches installer', String(manifest.sha256 || '').toUpperCase() === sha256(installerPath), manifest.sha256 || 'missing');
      pushCheck(checks, 'release manifest byte count matches installer', Number(manifest.bytes) === fileSize(installerPath), `${manifest.bytes || 'missing'} vs ${fileSize(installerPath)}`);
    }
    pushCheck(checks, 'release manifest updateUrl matches latest.json URL', manifest.updateUrl === platform?.url, manifest.updateUrl || 'missing');
  } else {
    pushCheck(checks, 'release manifest exists', false, manifestPath);
  }

  return {
    ok: checks.every((check) => check.ok),
    version,
    releaseDir,
    installer: exists(installerPath)
      ? {
          path: path.relative(root, installerPath),
          bytes: fileSize(installerPath),
          sha256: sha256(installerPath),
        }
      : null,
    latestJson: path.relative(root, latestPath),
    updaterEndpoint: endpoint,
    checks,
    safety: {
      builds: false,
      signs: false,
      uploads: false,
      mutatesReleaseFiles: false,
    },
  };
}

function formatReport(report) {
  const lines = [
    `Distill release readiness: ${report.ok ? 'ok' : 'needs_attention'}`,
    `Version: ${report.version || '-'}`,
    `Release dir: ${report.releaseDir}`,
    '',
    ...report.checks.map((check) => `${check.ok ? '[ok]' : '[fail]'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`),
  ];
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
let report;
try {
  report = buildReport(args);
} catch (error) {
  report = {
    ok: false,
    error: error.message,
    checks: [{ name: 'release readiness script', ok: false, detail: error.message }],
  };
}

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatReport(report));
}

if (!report.ok) {
  process.exitCode = 1;
}
