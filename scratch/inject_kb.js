const fs = require('fs');
const path = require('path');

const base = path.join('G:', 'Astro', 'WEBSITE');
const files = fs.readdirSync(base).filter(f => f.endsWith('.html'));

files.forEach(f => {
  const p = path.join(base, f);
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('data/knowledge-base.js')) {
    c = c.replace('<script src="js/main.js"></script>', '<script src="data/knowledge-base.js"></script>\n  <script src="js/main.js"></script>');
    fs.writeFileSync(p, c, 'utf8');
    console.log('✓ Injected knowledge-base.js into', f);
  }
});
