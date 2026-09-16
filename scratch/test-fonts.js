const fs = require('fs');
const path = require('path');
const { VoucherRenderer } = require('../dist/main/services/renderers/VoucherRenderer.js');
const { ShareCertificateRenderer } = require('../dist/main/services/renderers/ShareCertificateRenderer.js');

async function testAllFonts() {
  const dummySociety = {
    id: 'soc-1',
    societyName: 'HENU OS PVT LTD CO-SOC',
    registrationNo: 'U62099RJ2025PTC109150',
    registrationDate: '02/12/2020',
    address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home',
    createdAt: new Date().toISOString()
  };

  const dummyVouchers = [
    {
      voucherNo: '001',
      toPayee: 'Apex Facility Management',
      chargeTo: 'Maintenance Expenses',
      particulars: 'Security and housekeeping services for current month.',
      bankName: 'State Bank of India',
      chequeNo: '102938',
      voucherDate: '15/01/2025',
      billNo: 'INV-001',
      billAmount: '25000',
      netPaid: '28910'
    }
  ];

  const dummyShareCertItems = [
    {
      serial: '001',
      record: {
        certificateNo: '001',
        shareNumbersFrom: '1',
        shareNumbersTo: '5',
        totalShares: '5',
        memberName: 'RAJESH KUMAR SHARMA',
        flatNo: 'A-101',
        folioNo: 'F-001'
      }
    }
  ];

  const fontsToTest = ['Times-Roman', 'Helvetica', 'Courier', 'Helvetica-Bold', 'Indie_Flower', 'Merriweather'];

  for (const font of fontsToTest) {
    console.log(`Testing font: ${font} for Voucher...`);
    const vchBuf = await VoucherRenderer.render(dummyVouchers, dummySociety, {
      fontFamily: font,
      templateId: 'TEMPLATE_1'
    });
    fs.writeFileSync(`scratch/vch_${font}.pdf`, vchBuf);
    console.log(`  -> Saved scratch/vch_${font}.pdf`);

    console.log(`Testing font: ${font} for Share Certificate...`);
    const scBuf = await ShareCertificateRenderer.render(dummyShareCertItems, dummySociety, {
      fontFamily: font,
      templateId: 'HENU_OS_DEFAULT'
    });
    fs.writeFileSync(`scratch/sc_${font}.pdf`, scBuf);
    console.log(`  -> Saved scratch/sc_${font}.pdf`);
  }

  console.log('All 6 fonts rendered successfully for both Voucher and Share Certificate!');
}

testAllFonts().catch(console.error);
