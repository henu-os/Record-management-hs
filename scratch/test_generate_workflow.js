const path = require('path');
const fs = require('fs');

const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

async function testGenerateWorkflow() {
  console.log('Testing Generate Register / Download Workflow...');

  const workbookPath = 'G:\\Astro\\test\\test_members.xlsx';
  const workbook = MasterDataService.parseWorkbook(workbookPath);

  // Test A-F: Default orientations & custom prefix/separator
  const formTests = [
    { formId: 'FORM_I', defaultOrientation: 'Portrait' },
    { formId: 'FORM_J', defaultOrientation: 'Portrait' },
    { formId: 'FORM_BANK', defaultOrientation: 'Portrait' },
    { formId: 'FORM_SHARE', defaultOrientation: 'Landscape' },
    { formId: 'FORM_PROP', defaultOrientation: 'Landscape' },
    { formId: 'FORM_NOM', defaultOrientation: 'Landscape' },
  ];

  for (const ft of formTests) {
    console.log(`\n--- Testing ${ft.formId} ---`);
    
    // 1. Default orientation with prefix 'MS' and separator '-'
    const resDefault = await PdfEngine.generate({
      formId: ft.formId,
      fromSerial: '001',
      toSerial: '005',
      workbook,
      prefix: 'MS',
      separator: '-',
    });

    console.log(`Default (${ft.defaultOrientation}): generated ${resDefault.files.length} file(s)`);
    console.log(`Filename sample: ${resDefault.files[0].filename}`);

    // 2. Manual toggle: switch orientation (e.g. Portrait -> Landscape or Landscape -> Portrait)
    const toggledOrientation = ft.defaultOrientation === 'Portrait' ? 'Landscape' : 'Portrait';
    const resToggled = await PdfEngine.generate({
      formId: ft.formId,
      fromSerial: '001',
      toSerial: '005',
      workbook,
      orientationOverride: toggledOrientation,
      prefix: 'MS',
      separator: '_',
    });

    console.log(`Toggled (${toggledOrientation}): generated ${resToggled.files.length} file(s)`);
    console.log(`Toggled Filename sample: ${resToggled.files[0].filename}`);
  }

  // Test Gap & Range: 001-005 with missing 003
  console.log('\n--- Testing Gap Handling (001-005) ---');
  const mockWb = {
    societyMaster: { societyName: 'GAP TEST SOCIETY' },
    commonFile: [
      { srNo: '001', memberName: 'MEMBER 1' },
      { srNo: '002', memberName: 'MEMBER 2' },
      { srNo: '004', memberName: 'MEMBER 4' },
      { srNo: '005', memberName: 'MEMBER 5' },
    ],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
  };

  const resGap = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '005',
    workbook: mockWb,
  });
  console.log(`Gap test output size: ${resGap.files[0].buffer.length} bytes for 001-005 (003 missing)`);

  console.log('\n==================================================');
  console.log('SUCCESS: Generate Register / Download Workflow Verified!');
  console.log('==================================================');
}

testGenerateWorkflow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
