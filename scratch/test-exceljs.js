const ExcelJS = require('exceljs');
const fs = require('fs');

async function test() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HENU OS';
  wb.lastModifiedBy = 'HENU OS';
  wb.created = new Date();

  const ws = wb.addWorksheet('07_Property_Register', {
    views: [{ state: 'frozen', ySplit: 2 }]
  });

  const row1 = ws.addRow([
    'Sr. No.', 'Name of Co-partner Member', '', '', '', '', '', 'Date of Possession', 'Distinguishing No. of Tenement', '', 'Description of Tenement', 'Area of Tenement', 'Cost of Tenement', '', 'Annual Ground Rent Rs.', 'Date of Cessation of Membership', 'Signature Chairman / Hon. Secretary', 'Remarks (Reason of Cessation / Transfer to Sr. No. and Date)'
  ]);

  const row2 = ws.addRow([
    '', '1', '2', '3', '4', '5', '6', '', 'Flat No.', 'Floor No.', '', '', 'Land Rs.', 'Const. Rs.', '', '', '', ''
  ]);

  // Style header rows
  const purpleFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF5A4579' } // or 'FF5C2D91'
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

  [row1, row2].forEach(row => {
    row.height = 28;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = purpleFill;
      cell.font = headerFont;
      cell.alignment = headerAlign;
      cell.border = headerBorder;
    });
  });

  // Set column widths
  ws.columns.forEach(col => {
    col.width = 22;
  });

  const buffer = await wb.xlsx.writeBuffer();
  fs.writeFileSync('scratch/test_styled.xlsx', Buffer.from(buffer));
  console.log('Successfully wrote styled excel file, size:', buffer.byteLength);
}

test();
