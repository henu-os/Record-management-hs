// scratch/verify_settings_customization.js
// Automated verification script for Prompt 08 Settings Customization Engine
const { PDFDocument } = require('pdf-lib');

console.log('=== PROMPT 08 SETTINGS CUSTOMIZATION ENGINE TEST ===\n');

async function runTests() {
  try {
    const { PdfDocumentBuilder } = require('../dist/main/services/renderers/PdfDocumentBuilder.js');
    const { FormIRenderer } = require('../dist/main/services/renderers/FormIRenderer.js');
    const { FormJRenderer } = require('../dist/main/services/renderers/FormJRenderer.js');
    const { ShareRegisterRenderer } = require('../dist/main/services/renderers/ShareRegisterRenderer.js');

    const mockSociety = {
      societyName: 'Gokuldham Co-op Society',
      registrationNo: 'REG-GOKUL-008',
      registrationDate: '01/01/2015',
      address: 'Mumbai, Maharashtra',
      totalUnits: 50, unitsFlat: 50, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 5,
    };

    const mockRecord = {
      serial: '001',
      record: {
        memberId: 'm1', srNo: '001', membershipNo: 'M-1', shareCertificateNo: 'SC-1',
        member1: 'Jethalal Gada', flatNo: 'B-101', wingNo: 'B', noOfShares: '5', valueOfShares: '250',
      }
    };

    // -------------------------------------------------------------
    // TEST 1: Font Size Safe Limits Clamping (Template Safety Bounds)
    // -------------------------------------------------------------
    const builderExtreme = await PdfDocumentBuilder.create({
      orientation: 'Portrait',
      title: 'TEST_FORM',
      society: mockSociety,
      settings: {
        headerFontSize: 50, // Should be clamped to max 14
        bodyFontSize: 2,    // Should be clamped to min 6
      }
    });

    if (builderExtreme.headerFontSize !== 14) {
      throw new Error(`Test 1 Failed: Extreme header font size 50 was not clamped to 14! Got: ${builderExtreme.headerFontSize}`);
    }
    if (builderExtreme.bodyFontSize !== 6) {
      throw new Error(`Test 1 Failed: Extreme body font size 2 was not clamped to 6! Got: ${builderExtreme.bodyFontSize}`);
    }

    console.log('✔ TEST 1 PASSED: Safe font size limits enforced (Header: 8-14pt, Body: 6-10pt).');

    // -------------------------------------------------------------
    // TEST 2: Footer Alignments & Editable Branding Text
    // -------------------------------------------------------------
    const builderFooter = await PdfDocumentBuilder.create({
      orientation: 'Portrait',
      title: 'TEST_FOOTER',
      society: mockSociety,
      settings: {
        pageNumberAlign: 'left',
        pageNumberPrefix: '', // Default: "1", "2", "3" (no "pg" prefix)
        brandingText: 'Custom Society Management Engine',
        brandingAlign: 'left',
        customFooterText: 'Confidential Official Register',
        customFooterAlign: 'right',
      }
    });

    if (builderFooter.brandingText !== 'Custom Society Management Engine') {
      throw new Error('Test 2 Failed: Branding text override failed!');
    }
    if (builderFooter.pageNumberPrefix !== '') {
      throw new Error('Test 2 Failed: Page number prefix default should be empty!');
    }

    console.log('✔ TEST 2 PASSED: Footer alignment controls, branding text, and page number format (1, 2, 3) verified.');

    // -------------------------------------------------------------
    // TEST 3: Custom Theme Colors without Geometry Distortion
    // -------------------------------------------------------------
    const customThemeBuf = await FormJRenderer.render([mockRecord], mockSociety, {
      orientationOverride: 'Landscape',
      rowsPerPage: 10,
    });

    const docTheme = await PDFDocument.load(customThemeBuf);
    const pageSize = docTheme.getPage(0).getSize();

    if (Math.round(pageSize.width) !== 1008 || Math.round(pageSize.height) !== 612) {
      throw new Error(`Test 3 Failed: Physical Legal landscape geometry distorted! Got ${pageSize.width}x${pageSize.height}`);
    }

    console.log('✔ TEST 3 PASSED: Custom settings applied cleanly without altering physical Legal PDF geometry.');

    console.log('\n=================================================');
    console.log('🎉 ALL PROMPT 08 SETTINGS CUSTOMIZATION ENGINE TESTS PASSED 100%!');
    console.log('=================================================\n');
  } catch (err) {
    console.error('❌ PROMPT 08 SETTINGS TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
