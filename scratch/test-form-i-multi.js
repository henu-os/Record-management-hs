const path = require('path');
const { FormIRenderer } = require(path.resolve(__dirname, '../dist/main/services/renderers/FormIRenderer'));
const fs = require('fs');

async function testFormIMultiEntry() {
  const mockRecord = {
    srNo: '001',
    dateOfAdmission: '01/01/2020',
    dateOfEntranceFee: '01/01/2020',
    memberName: 'Rajesh Sharma',
    member1: 'Rajesh Sharma',
    member2: 'Pooja Sharma',
    flatNo: 'A-101',
    wingNo: 'A Wing',
    residentialAddress: 'Flat 101, Galaxy Enclave, Andheri West, Mumbai',
    occupation: 'Business',
    age: '42',
    nomineeName: 'Pooja Sharma',
    nominee1: 'Pooja Sharma',
    dateOfNomination: '05/01/2020',
    sharesHeldEntries: [
      {
        date: '10/01/2020',
        cashBookFolio: 'CBF-01',
        application: 'APP-101',
        allotment: 'ALL-101',
        call1st: '2500',
        call2nd: '2500',
        totalAmountReceived: '5000',
        noOfShares: '10',
        sharesFrom: '101',
        sharesTo: '110',
        shareCertificateNo: 'SC-101'
      },
      {
        date: '15/06/2021',
        cashBookFolio: 'CBF-05',
        application: 'APP-202',
        allotment: 'ALL-202',
        call1st: '1500',
        call2nd: '1500',
        totalAmountReceived: '3000',
        noOfShares: '6',
        sharesFrom: '201',
        sharesTo: '206',
        shareCertificateNo: 'SC-202'
      },
      {
        date: '20/11/2023',
        cashBookFolio: 'CBF-12',
        application: 'APP-303',
        allotment: 'ALL-303',
        call1st: '1000',
        call2nd: '1000',
        totalAmountReceived: '2000',
        noOfShares: '4',
        sharesFrom: '301',
        sharesTo: '304',
        shareCertificateNo: 'SC-303'
      }
    ],
    sharesTransferredEntries: [
      {
        date: '12/04/2022',
        cashBookFolio: 'CBF-TR-01',
        transferDate: '12/04/2022',
        shareCertificateNo: 'SC-101',
        noOfSharesTransferred: '5',
        balanceNoOfShares: '11',
        balanceSerialNoCertificate: 'SC-101-BAL',
        amountRs: '2500',
        amountP: '00'
      }
    ]
  };

  const bufs = await FormIRenderer.render([{ serial: '001', record: mockRecord }], null);
  fs.writeFileSync('scratch/test_form_i_multientry.pdf', bufs[0]);
  console.log('Form I Multi-entry PDF generated successfully! Size:', bufs[0].length);
}

testFormIMultiEntry();
