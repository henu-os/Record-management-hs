const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const scratchDir = 'C:/Users/henus/.gemini/antigravity-ide/brain/15f9847b-c668-4cdc-ad18-cfb8f2429df6/scratch';
const logPath = path.join(scratchDir, 'test_console.txt');
const logStream = fs.createWriteStream(logPath);

const electronPath = 'H:\\New folder\\electron.exe';
const appDir = 'g:\\Astro';

console.log('Spawning Electron test process...');

const child = spawn(electronPath, ['.'], {
  cwd: appDir,
  env: {
    ...process.env,
    RUN_QA_TESTS: '1',
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

child.stdout.on('data', (data) => {
  logStream.write(data);
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  logStream.write(data);
  process.stderr.write(data);
});

child.on('close', (code) => {
  console.log(`\nElectron process exited with code ${code}`);
  logStream.write(`\nElectron process exited with code ${code}`);
  logStream.end();
  process.exit(code);
});
