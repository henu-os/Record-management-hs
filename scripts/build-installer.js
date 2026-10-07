const fs = require('fs');
const path = require('path');
const cp = require('child_process');

console.log('=== Step 1: Building Renderer & Main ===');
cp.execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

console.log('\n=== Step 2: Packaging Windows NSIS Installer ===');
const releaseDir = path.resolve(__dirname, '..', 'release');
if (fs.existsSync(releaseDir)) {
  for (const f of fs.readdirSync(releaseDir)) {
    if (f.endsWith('.7z') || f.endsWith('.blockmap')) {
      try { fs.unlinkSync(path.join(releaseDir, f)); } catch (_) {}
    }
  }
}

const builderBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'electron-builder.cmd');
cp.execSync(`"${builderBin}" --win nsis`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

console.log('\n=== Step 3: Verifying and copying output ===');
const setupExe = path.join(releaseDir, 'HENU OS RECMA Setup.exe');
const rootSetupExe = path.resolve(__dirname, '..', 'HENU OS RECMA Setup.exe');

if (fs.existsSync(setupExe)) {
  fs.copyFileSync(setupExe, rootSetupExe);
  const sizeMB = (fs.statSync(rootSetupExe).size / (1024 * 1024)).toFixed(2);
  console.log(`\n========================================================`);
  console.log(`🎉 SUCCESS! Windows Desktop Installer Generated:`);
  console.log(`- Project Root: ${rootSetupExe}`);
  console.log(`- Release Dir:  ${setupExe}`);
  console.log(`- File Size:    ${sizeMB} MB`);
  console.log(`========================================================\n`);
} else {
  console.log('Files in release:', fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir) : 'none');
}
