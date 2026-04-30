#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const ROOT = __dirname;
const FRONTEND = path.join(ROOT, 'frontend');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function color(code, s) {
  return `\x1b[${code}m${s}\x1b[0m`;
}
const c = {
  blue: (s) => color('34', s),
  green: (s) => color('32', s),
  yellow: (s) => color('33', s),
  red: (s) => color('31', s),
  gray: (s) => color('90', s),
  bold: (s) => color('1', s),
};

function log(label, ...args) {
  const tag =
    label === 'backend' ? c.blue('[backend] ') :
    label === 'frontend' ? c.green('[frontend]') :
    label === 'mongo' ? c.yellow('[mongo]   ') :
    c.gray(`[${label}]`.padEnd(10));
  console.log(tag, ...args);
}

function pingPort(host, port, timeout = 600) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    sock.setTimeout(timeout);
    sock.once('connect', () => { done = true; sock.destroy(); resolve(true); });
    sock.once('timeout', () => { if (!done) { sock.destroy(); resolve(false); } });
    sock.once('error', () => { if (!done) resolve(false); });
    sock.connect(port, host);
  });
}

async function findFreePort(start, end) {
  for (let p = start; p <= end; p++) {
    const inUse = await pingPort('127.0.0.1', p, 300);
    if (!inUse) return p;
  }
  return null;
}

async function ensureMongo() {
  const ok = await pingPort('127.0.0.1', 27017, 800);
  if (ok) {
    log('mongo', 'reachable on 127.0.0.1:27017 ✓');
    return;
  }
  log('mongo', c.yellow('not reachable — attempting to start mongod (Windows service)…'));
  if (isWin) {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Service MongoDB'], {
      stdio: 'ignore',
    });
    if (r.status === 0) {
      log('mongo', 'service start requested');
    } else {
      log('mongo', c.red('could not auto-start. Make sure mongod is running on 27017.'));
    }
  } else {
    log('mongo', c.red('please start mongod manually (e.g. `brew services start mongodb-community`).'));
  }
}

function ensureDeps() {
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    log('install', 'backend deps missing — running npm install …');
    const r = spawnSync(npmCmd, ['install', '--no-audit', '--no-fund'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  if (!fs.existsSync(path.join(FRONTEND, 'node_modules'))) {
    log('install', 'frontend deps missing — running npm install (frontend)…');
    const r = spawnSync(npmCmd, ['install', '--no-audit', '--no-fund'], {
      cwd: FRONTEND,
      stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
}

function ensureEnv() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    log('env', '.env created from .env.example');
  }
}

function startProc(label, cmd, args, opts) {
  const proc = spawn(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}), FORCE_COLOR: '1' },
    shell: isWin,
  });
  const tagger = (line) => {
    if (!line) return;
    line.split(/\r?\n/).forEach((l) => {
      if (l.length === 0) return;
      log(label, l);
    });
  };
  proc.stdout.on('data', (d) => tagger(d.toString()));
  proc.stderr.on('data', (d) => tagger(d.toString()));
  proc.on('exit', (code) => {
    log(label, c.red(`exited with code ${code}`));
    shutdown(code || 0);
  });
  return proc;
}

let children = [];
let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const ch of children) {
    try { ch.kill(isWin ? undefined : 'SIGTERM'); } catch {}
  }
  setTimeout(() => process.exit(code), 600);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function maybeOpenBrowser(url) {
  if (process.env.NO_OPEN === '1') return;
  setTimeout(() => {
    if (isWin) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }, 2500);
}

function patchVitePort(backendPort) {
  const cfg = path.join(FRONTEND, 'vite.config.js');
  if (!fs.existsSync(cfg)) return;
  const src = fs.readFileSync(cfg, 'utf-8');
  const next = src.replace(/'\/api':\s*'http:\/\/localhost:\d+'/, `'/api': 'http://localhost:${backendPort}'`);
  if (next !== src) fs.writeFileSync(cfg, next);
}

(async function main() {
  console.log(c.bold('\n  JobFinder — local launch\n'));
  ensureEnv();
  ensureDeps();
  await ensureMongo();

  const desiredBackend = parseInt(process.env.PORT || '5275', 10);
  let backendPort = desiredBackend;
  if (await pingPort('127.0.0.1', backendPort, 400)) {
    log('port', c.yellow(`backend port ${desiredBackend} is busy, hunting for a free one…`));
    backendPort = await findFreePort(desiredBackend + 1, desiredBackend + 30);
    if (!backendPort) {
      log('port', c.red('no free port found in range — aborting.'));
      process.exit(1);
    }
    log('port', `using backend port ${backendPort}`);
  }
  // Always rewrite vite proxy so it can't drift out of sync
  patchVitePort(backendPort);

  const backend = startProc('backend', 'node', ['backend/server.js'], {
    cwd: ROOT,
    env: { PORT: String(backendPort) },
  });
  children.push(backend);

  const frontend = startProc('frontend', npmCmd, ['run', 'dev', '--', '--host'], { cwd: FRONTEND });
  children.push(frontend);

  log('ready', c.green('starting up — UI will open in your browser shortly'));
  maybeOpenBrowser('http://localhost:5173');
})().catch((err) => {
  console.error(err);
  shutdown(1);
});
