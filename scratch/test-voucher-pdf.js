const { VoucherRenderer } = require('../dist/main/services/renderers/VoucherRenderer');
const fs = require('fs');
const path = require('path');

async function testVoucher() {
  const sampleVouchers = [
    {
      srNo: '001',
      voucherNo: '001',
      socNumber: 'M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023',
      societyName: 'Aishwarya Heights Co-op. Housing Society Ltd.',
      societyAddress: 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.',
      toPayee: 'Apex Security & Facility Management Services',
      chargeTo: 'Security Charges A/c',
      particulars: 'Being security guard charges paid for the month of January 2025 as per bill attached.',
      bankName: 'State Bank of India (Mulund East Branch)',
      chequeNo: '482910',
      voucherDate: '15/01/2025',
      billNo: 'INV-2025-089',
      billAmount: '45000',
      billAmount2: '',
      advLessPaid: '5000',
      subTotal1: '40000',
      tdsPercent: '2',
      tdsAmount: '900',
      subTotal2: '39100',
      cgstPercent: '9',
      cgstAmount: '3600',
      sgstPercent: '9',
      sgstAmount: '3600',
      roundOff: '-0.50',
      otherFineAdj: '',
      netPaid: '46299.50'
    },
    {
      srNo: '002',
      voucherNo: '002',
      socNumber: 'M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023',
      societyName: 'Aishwarya Heights Co-op. Housing Society Ltd.',
      societyAddress: 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.',
      toPayee: 'Shree Ganesh Housekeeping & Cleaning Services',
      chargeTo: 'Housekeeping Expenses',
      particulars: 'Being monthly cleaning and sanitation charges for common areas and clubhouse.',
      bankName: 'HDFC Bank Ltd.',
      chequeNo: '109283',
      voucherDate: '20/01/2025',
      billNo: 'SGH-882',
      billAmount: '28000',
      billAmount2: '',
      advLessPaid: '',
      subTotal1: '28000',
      tdsPercent: '1',
      tdsAmount: '280',
      subTotal2: '27720',
      cgstPercent: '9',
      cgstAmount: '2494.80',
      sgstPercent: '9',
      sgstAmount: '2494.80',
      roundOff: '0.40',
      otherFineAdj: '',
      netPaid: '32710'
    },
    {
      srNo: '003',
      voucherNo: '003',
      socNumber: 'M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023',
      societyName: 'Aishwarya Heights Co-op. Housing Society Ltd.',
      societyAddress: 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.',
      toPayee: 'Tata Power Ltd.',
      chargeTo: 'Electricity Charges (Common Pump & Lift)',
      particulars: 'Electricity consumption bill payment for Meter No. 90283011 for Dec-Jan cycle.',
      bankName: 'ICICI Bank Ltd.',
      chequeNo: '774812',
      voucherDate: '25/01/2025',
      billNo: 'TP-908123',
      billAmount: '18450',
      billAmount2: '',
      advLessPaid: '',
      subTotal1: '18450',
      tdsPercent: '',
      tdsAmount: '',
      subTotal2: '18450',
      cgstPercent: '',
      cgstAmount: '',
      sgstPercent: '',
      sgstAmount: '',
      roundOff: '',
      otherFineAdj: '',
      netPaid: '18450'
    }
  ];

  const society = {
    societyName: 'Aishwarya Heights Co-op. Housing Society Ltd.',
    registrationNo: 'M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023',
    registrationDate: '02.01.2023',
    address: 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.'
  };

  const buffer = await VoucherRenderer.render(sampleVouchers, society);
  const outPath = path.join(__dirname, 'test_voucher.pdf');
  fs.writeFileSync(outPath, buffer);
  console.log('Successfully generated test voucher PDF at:', outPath);
}

testVoucher().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
