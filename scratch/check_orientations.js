const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function check() {
  const dir = path.join(process.cwd(), 'src', 'templates');
  const files = [
    'form-i.pdf',
    'form-j.pdf',
    'nomination-register.pdf',
    'property-register.pdf',
    'share-register.pdf'
  ];

  for (const f of files) {
    const filePath = path.join(dir, f);
    if (!fs.existsSync(filePath)) {
      console.log(`Missing: ${f}`);
      continue;
    }
    const bytes = fs.readFileSync(filePath);
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPages()[0];
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    console.log(`${f}: size = ${width.toFixed(2)} x ${height.toFixed(2)} pt, rotation = ${rotation}°`);
  }
}

check().catch(console.error);
