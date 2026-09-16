const ExcelJS = require('exceljs');
const fs = require('fs');

async function testFullMaster() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HENU OS Records Management';
  wb.lastModifiedBy = 'HENU OS Records Management';
  wb.created = new Date();

  const purpleFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF5A4579' }
  };

  const headerFont = {
    name: 'Segoe UI',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };

  const headerBorder = {
    top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    right: { style: 'thin', color: { argb: 'FFD9E1F2' } }
  };

  const headerAlign = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true
  };

  const styleHeaders = (ws, rowCount, colCount) => {
    for (let r = 1; r <= rowCount; r++) {
      const row = ws.getRow(r);
      row.height = 28;
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = purpleFill;
        cell.font = headerFont;
        cell.alignment = headerAlign;
        cell.border = headerBorder;
      }
    }
  };

  const applyFormulas = (ws, formulaMap, startRow = 3, endRow = 23) => {
    for (let r = startRow; r <= endRow; r++) {
      const row = ws.getRow(r);
      for (const [colIdxStr, formulaTpl] of Object.entries(formulaMap)) {
        const colIdx = parseInt(colIdxStr, 10);
        const cell = row.getCell(colIdx + 1);
        const formula = formulaTpl.replace(/\{r\}/g, String(r));
        cell.value = { formula };
      }
    }
  };

  // 1. Property Register
  const propWs = wb.addWorksheet('07_Property_Register', { views: [{ state: 'frozen', ySplit: 2 }] });
  propWs.addRow([
    'Sr. No.', 'Name of Co-partner Member', '', '', '', '', '', 'Date of Possession', 'Distinguishing No. of Tenement', '', 'Description of Tenement', 'Area of Tenement', 'Cost of Tenement', '', 'Annual Ground Rent Rs.', 'Date of Cessation of Membership', 'Signature Chairman / Hon. Secretary', 'Remarks (Reason of Cessation / Transfer to Sr. No. and Date)'
  ]);
  propWs.addRow([
    '', '1', '2', '3', '4', '5', '6', '', 'Flat No.', 'Floor No.', '', '', 'Land Rs.', 'Const. Rs.', '', '', '', ''
  ]);
  styleHeaders(propWs, 2, 18);
  applyFormulas(propWs, {
    0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
    1: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
  });
  for (let i = 1; i <= 18; i++) {
    propWs.getColumn(i).width = 22;
  }

  const buffer = await wb.xlsx.writeBuffer();
  fs.writeFileSync('scratch/full_styled_test.xlsx', Buffer.from(buffer));
  console.log('Successfully generated full styled test xlsx, size:', buffer.byteLength);
}

testFullMaster();
