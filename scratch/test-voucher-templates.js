const fs = require('fs');
const path = require('path');
const { VoucherRenderer } = require('../dist/main/services/renderers/VoucherRenderer.js');

async function test() {
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
      particulars: 'Being security and housekeeping charges for the current month of January 2025.',
      bankName: 'State Bank of India',
      chequeNo: '102938',
      voucherDate: '15/01/2025',
      billNo: 'INV-001',
      billAmount: '25000',
      billAmount2: '',
      advLessPaid: '',
      subTotal1: '25000',
      tdsPercent: '2',
      tdsAmount: '500',
      subTotal2: '24500',
      cgstPercent: '9',
      cgstAmount: '2205',
      sgstPercent: '9',
      sgstAmount: '2205',
      roundOff: '',
      otherFineAdj: '',
      netPaid: '28910'
    },
    {
      voucherNo: '002',
      toPayee: 'Super Power Electricals',
      chargeTo: 'Lift & Common Repairs',
      particulars: 'Lift inverter battery replacement and motor inspection charges.',
      bankName: 'HDFC Bank Ltd.',
      chequeNo: '584920',
      voucherDate: '18/01/2025',
      billNo: 'INV-782',
      billAmount: '12400',
      netPaid: '12400'
    },
    {
      voucherNo: '003',
      toPayee: 'Shree Krishna Water Supply',
      chargeTo: 'Water Charges',
      particulars: '4 tanker water supply during municipal line maintenance.',
      bankName: 'ICICI Bank',
      chequeNo: '302911',
      voucherDate: '22/01/2025',
      billNo: 'WT-441',
      billAmount: '6000',
      netPaid: '6000'
    }
  ];

  // Render Template 1 (No Logo)
  console.log('Rendering Template 1 (No Logo)...');
  const bufT1NoLogo = await VoucherRenderer.render(dummyVouchers, dummySociety, { templateId: 'TEMPLATE_1' });
  const t1NoLogoPath = path.join(__dirname, 'voucher_t1_nologo.pdf');
  fs.writeFileSync(t1NoLogoPath, bufT1NoLogo);
  console.log('Saved:', t1NoLogoPath);

  // Render Template 2 (No Logo)
  console.log('Rendering Template 2 (No Logo)...');
  const bufT2NoLogo = await VoucherRenderer.render(dummyVouchers, dummySociety, { templateId: 'TEMPLATE_2' });
  const t2NoLogoPath = path.join(__dirname, 'voucher_t2_nologo.pdf');
  fs.writeFileSync(t2NoLogoPath, bufT2NoLogo);
  console.log('Saved:', t2NoLogoPath);
}

test().catch(console.error);
