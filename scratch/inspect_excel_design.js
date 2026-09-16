// Inspect the authoritative Excel workbook for all sheet designs
const XLSX = require('xlsx');
const path = require('path');

// Try both possible filenames
const possiblePaths = [
  path.join(__dirname, '..', 'template design of all pdfs 6 forms.xlsx'),
  path.join(__dirname, '..', 'Society_Registers_Excel_Professional (1).xlsx'),
  path.join(__dirname, '..', 'Society_Registers_Excel_Professional.xlsx'),
];

let wb;
let usedPath;
for (const p of possiblePaths) {
  try {
    wb = XLSX.readFile(p, { cellStyles: true, cellDates: true, bookVBA: false });
    usedPath = p;
    break;
  } catch (e) {
    // try next
  }
}

if (!wb) {
  console.error('ERROR: Could not find Excel workbook. Tried:', possiblePaths);
  process.exit(1);
}

console.log('=== WORKBOOK LOADED ===');
console.log('Path:', usedPath);
console.log('Sheet Names:', JSON.stringify(wb.SheetNames));
console.log('');

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  console.log('========================================');
  console.log(`SHEET: "${sheetName}"`);
  console.log('========================================');

  // Get range
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  console.log(`Range: ${ws['!ref']}`);
  console.log(`Rows: ${range.e.r - range.s.r + 1} (${range.s.r + 1} to ${range.e.r + 1})`);
  console.log(`Cols: ${range.e.c - range.s.c + 1} (${XLSX.utils.encode_col(range.s.c)} to ${XLSX.utils.encode_col(range.e.c)})`);

  // Column widths
  if (ws['!cols']) {
    console.log('\nColumn Widths:');
    ws['!cols'].forEach((col, idx) => {
      if (col) {
        console.log(`  Col ${XLSX.utils.encode_col(idx)}: width=${col.wch || col.wpx || col.width || 'default'}, hidden=${col.hidden || false}`);
      }
    });
  } else {
    console.log('\nColumn Widths: (not set, using defaults)');
  }

  // Row heights
  if (ws['!rows']) {
    console.log('\nRow Heights:');
    ws['!rows'].forEach((row, idx) => {
      if (row) {
        console.log(`  Row ${idx + 1}: height=${row.hpt || row.hpx || 'default'}, hidden=${row.hidden || false}`);
      }
    });
  } else {
    console.log('\nRow Heights: (not set, using defaults)');
  }

  // Merged cells
  if (ws['!merges'] && ws['!merges'].length > 0) {
    console.log(`\nMerged Cells (${ws['!merges'].length}):`);
    ws['!merges'].forEach(merge => {
      const s = XLSX.utils.encode_cell(merge.s);
      const e = XLSX.utils.encode_cell(merge.e);
      console.log(`  ${s}:${e}`);
    });
  } else {
    console.log('\nMerged Cells: none');
  }

  // Print area and page setup
  if (ws['!print']) {
    console.log('\nPrint Settings:', JSON.stringify(ws['!print']));
  }

  // Page margins
  if (ws['!margins']) {
    console.log('\nMargins:', JSON.stringify(ws['!margins']));
  }

  // Dump all cell contents and styles
  console.log('\nCell Contents:');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && (cell.v !== undefined || cell.w !== undefined)) {
        let info = `  ${addr}: v="${cell.v}" w="${cell.w || ''}" t=${cell.t || ''}`;
        if (cell.s) {
          info += ` style=${JSON.stringify(cell.s)}`;
        }
        console.log(info);
      }
    }
  }

  // Convert to JSON for structure overview
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('\nGrid Overview (first 60 rows):');
  for (let i = 0; i < Math.min(json.length, 60); i++) {
    const row = json[i];
    if (row && row.some(c => c !== '')) {
      console.log(`  Row ${i + 1}: ${JSON.stringify(row)}`);
    } else {
      console.log(`  Row ${i + 1}: (empty)`);
    }
  }
  if (json.length > 60) {
    console.log(`  ... (${json.length - 60} more rows)`);
  }

  console.log('');
}
