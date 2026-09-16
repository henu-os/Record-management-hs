// copy-templates.js
// Copies PDF template files from src/templates to dist/main/templates
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src', 'templates');
const dest = path.join(__dirname, 'dist', 'main', 'templates');

if (!fs.existsSync(src)) {
  console.log('No templates directory found, skipping copy.');
  process.exit(0);
}

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

const files = fs.readdirSync(src);
const publicTemplatesDir = path.join(__dirname, 'src', 'renderer', 'public', 'templates');

if (!fs.existsSync(publicTemplatesDir)) {
  fs.mkdirSync(publicTemplatesDir, { recursive: true });
}

for (const file of files) {
  if (file.endsWith('.pdf') || file.endsWith('.ttf') || file.endsWith('.otf')) {
    // Copy to main dist
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
    // Copy to renderer public
    fs.copyFileSync(path.join(src, file), path.join(publicTemplatesDir, file));
    console.log(`Copied: ${file}`);
  }
}

// Copy images to dist/renderer/images if dist/renderer exists
const imagesSrc = path.join(__dirname, 'public', 'images');
const distImages = path.join(__dirname, 'dist', 'renderer', 'images');
if (fs.existsSync(imagesSrc)) {
  if (!fs.existsSync(distImages)) {
    fs.mkdirSync(distImages, { recursive: true });
  }
  const imgFiles = fs.readdirSync(imagesSrc);
  for (const img of imgFiles) {
    fs.copyFileSync(path.join(imagesSrc, img), path.join(distImages, img));
  }
}
console.log('Template & image copy complete.');

