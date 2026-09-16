// HENU OS — Desktop App Launcher
const { spawn } = require('child_process');
const path = require('path');
const electronExe = require('electron');

const appRoot = path.join(__dirname, '..');

console.log('Starting HENU OS Records Management Desktop App...');
console.log('Electron:', electronExe);
console.log('App Root:', appRoot);

const proc = spawn(electronExe, [
  '.',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-gpu-shader-disk-cache',
  '--no-crashpad',
], {
  cwd: appRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_DISABLE_SANDBOX: '1',
  },
});

proc.on('error', err => {
  console.error('Failed to start Electron:', err.message);
  process.exit(1);
});

proc.on('close', code => {
  console.log('HENU OS closed with code:', code);
  process.exit(code || 0);
});
