// Download prebuilt better-sqlite3 binary for Electron v31 (ABI 127)
// Run: node scripts/fetch-bsql.js
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RELEASE_URL = 'https://api.github.com/repos/WiseLibs/better-sqlite3/releases/tags/v13.0.3';
const TARGET_DIR = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'prebuilds', 'win32-x64');

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'node' }, ...opts }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location, opts).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log('Fetching release info...');
  const info = JSON.parse(await fetch(RELEASE_URL));
  const assets = info.assets || [];
  
  console.log('Available assets:');
  assets.forEach(a => console.log(' -', a.name));
  
  // Look for electron + win32-x64 asset
  const target = assets.find(a => a.name.includes('electron') && a.name.includes('win32-x64'));
  if (!target) {
    console.error('No matching electron win32-x64 prebuilt found');
    process.exit(1);
  }
  
  console.log('Downloading:', target.name);
  const buf = await fetch(target.browser_download_url);
  const tarPath = path.join(require('os').tmpdir(), target.name);
  fs.writeFileSync(tarPath, buf);
  console.log('Downloaded:', buf.length, 'bytes to', tarPath);
  
  // Extract using tar
  const { execSync } = require('child_process');
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  execSync(`tar -xzf "${tarPath}" -C "${TARGET_DIR}" --strip-components=1`);
  console.log('Extracted to:', TARGET_DIR);
  
  // Copy .node file to the expected location
  const nodeBins = fs.readdirSync(TARGET_DIR).filter(f => f.endsWith('.node'));
  console.log('Node binaries found:', nodeBins);
  
  const srcBin = path.join(TARGET_DIR, nodeBins[0]);
  const destBin = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  fs.mkdirSync(path.dirname(destBin), { recursive: true });
  fs.copyFileSync(srcBin, destBin);
  console.log('Copied binary to:', destBin);
  console.log('Done! better-sqlite3 is now ready for Electron.');
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
