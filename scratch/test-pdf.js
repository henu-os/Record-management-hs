const fs = require('fs');
const path = require('path');
const { ShareCertificateRenderer } = require('../dist/main/services/renderers/ShareCertificateRenderer.js');

// Mock society master data
const society = {
  societyName: 'HENU OS PVT LTD CO-SOC CO-OPERATIVE HOUSING SOCIETY LIMITED.',
  address: 'HOME BHAGESAR, 10B-204 SECOND FLOOR, Registered under the Maharashtra Co-operative Societies Act, 1960',
  registrationNo: 'U62099RJ2025PTC109150',
  registrationDate: '02/12/2025',
  authorisedCapital: '1,00,000/-',
  totalAuthorisedShares: '2000',
  faceValue: '50/-'
};

// Mock member record
const record = {
  srNo: '001',
  shareCertificateNo: 'HENU-SH-001',
  membershipNo: 'HENU-MEM-001',
  noOfShares: '11',
  sharesInWords: 'ELEVEN',
  flatNo: 'A/102',
  wingNo: 'A',
  member1: 'AARAV01, VIKRAM01, RAJENDRA01',
  member2: '',
  member3: '',
  sharesFrom: '101',
  sharesTo: '101',
  valueOfShares: '550/-'
};

async function test() {
  try {
    console.log('Generating test PDF...');
    const buffer = await ShareCertificateRenderer.render(
      [{ serial: '001', record }],
      society,
      { templateId: 'HENU_OS_2' }
    );
    
    const outputPath = path.join(__dirname, 'test_output.pdf');
    fs.writeFileSync(outputPath, buffer);
    console.log('Test PDF successfully generated at:', outputPath);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
}

test();
