const fs = require('fs');
const { FormIRenderer } = require('../dist/main/services/renderers/FormIRenderer.js');
const { FormJRenderer } = require('../dist/main/services/renderers/FormJRenderer.js');
const { ShareRegisterRenderer } = require('../dist/main/services/renderers/ShareRegisterRenderer.js');
const { NominationRegisterRenderer } = require('../dist/main/services/renderers/NominationRegisterRenderer.js');
const { PropertyRegisterRenderer } = require('../dist/main/services/renderers/PropertyRegisterRenderer.js');
const { LienMarkRenderer } = require('../dist/main/services/renderers/LienMarkRenderer.js');

async function testFooters() {
  const dummySociety = {
    id: 'soc-1',
    societyName: 'HENU OS PVT LTD CO-SOC',
    registrationNo: 'U62099RJ2025PTC109150',
    registrationDate: '02/12/2020',
    address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home',
    createdAt: new Date().toISOString()
  };

  const dummyItem = {
    serial: '001',
    record: {
      memberName: 'RAMESH PATEL',
      flatNo: 'A-101',
      sharesHeld: 5,
      dateOfAdmission: '01/01/2021'
    }
  };

  const customSettings = {
    brandingText: 'HENU OS - SIDD Managerr',
    brandingAlign: 'right',
    pageNumberAlign: 'center'
  };

  console.log('Testing Form I...');
  const fIBufs = await FormIRenderer.render([dummyItem], dummySociety, { settings: customSettings });
  fs.writeFileSync('scratch/test_form_i_footer.pdf', fIBufs[0]);

  console.log('Testing Form J...');
  const fJBuf = await FormJRenderer.render([dummyItem], dummySociety, { settings: customSettings });
  fs.writeFileSync('scratch/test_form_j_footer.pdf', fJBuf);

  console.log('Testing Share Register...');
  const fSBuf = await ShareRegisterRenderer.render([dummyItem], dummySociety, { settings: customSettings });
  fs.writeFileSync('scratch/test_form_share_footer.pdf', fSBuf);

  console.log('Testing Nomination Register...');
  const fNBuf = await NominationRegisterRenderer.render([dummyItem], dummySociety, { settings: customSettings });
  fs.writeFileSync('scratch/test_form_nom_footer.pdf', fNBuf);

  console.log('Testing Property Register...');
  const fPBuf = await PropertyRegisterRenderer.render([dummyItem], dummySociety, { settings: customSettings });
  fs.writeFileSync('scratch/test_form_prop_footer.pdf', fPBuf);

  console.log('Testing Bank Lien Mark...');
  const fLBuf = await LienMarkRenderer.render([dummyItem], dummySociety, { settings: customSettings });
  fs.writeFileSync('scratch/test_form_bank_footer.pdf', fLBuf);

  console.log('All 6 forms rendered with custom footer successfully!');
}

testFooters().catch(console.error);
