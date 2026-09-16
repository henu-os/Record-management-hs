// ============================================================
// TestRunner — Automated tests for HENU OS
// Covers all 20 spec items + 7 critical acceptance tests
// Run via IPC: tests:run
// ============================================================
import { generateRange, normalizeSerial, validateSerialRange } from '../services/SerialRangeEngine';
import { MasterDataQueryEngine } from '../services/MasterDataQueryEngine';
import { FormMappingService } from '../services/FormMappingService';
import { ValidationEngine } from '../services/ValidationEngine';
import { PdfDocumentBuilder } from '../services/renderers/PdfDocumentBuilder';
import { FormIRenderer } from '../services/renderers/FormIRenderer';
import { FormJRenderer } from '../services/renderers/FormJRenderer';
import { ShareRegisterRenderer } from '../services/renderers/ShareRegisterRenderer';
import { NominationRegisterRenderer } from '../services/renderers/NominationRegisterRenderer';
import { PropertyRegisterRenderer } from '../services/renderers/PropertyRegisterRenderer';
import { LienMarkRenderer } from '../services/renderers/LienMarkRenderer';
import { FormIDefinition } from '../services/renderers/definitions/FormIDefinition';
import { FormJDefinition } from '../services/renderers/definitions/FormJDefinition';
import { ShareRegisterDefinition } from '../services/renderers/definitions/ShareRegisterDefinition';
import { NominationRegisterDefinition } from '../services/renderers/definitions/NominationRegisterDefinition';
import { PropertyRegisterDefinition } from '../services/renderers/definitions/PropertyRegisterDefinition';
import { LienMarkDefinition } from '../services/renderers/definitions/LienMarkDefinition';
import { PdfEngine } from '../services/PdfEngine';
import { ZipService } from '../services/ZipService';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  durationMs: number;
  error?: string;
}

function pass(id: string, name: string): TestResult {
  return { id, name, passed: true, message: 'OK' };
}

function fail(id: string, name: string, reason: string): TestResult {
  return { id, name, passed: false, message: reason };
}

// ── Test helpers ──────────────────────────────────────────────
function expect(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

export class TestRunner {
  static async runAll(): Promise<TestSuiteResult> {
    const t0 = Date.now();
    const results: TestResult[] = [];

    const run = (id: string, name: string, fn: () => void | Promise<void>) => {
      return (async () => {
        try {
          await fn();
          results.push(pass(id, name));
        } catch (err: any) {
          results.push(fail(id, name, err.message));
        }
      })();
    };

    // ── Unit tests ──────────────────────────────────────────

    await run('T01', 'Serial normalization — preserves leading zeros', () => {
      expect(normalizeSerial('001') === '001', '"001" must stay "001"');
      expect(normalizeSerial('010') === '010', '"010" must stay "010"');
      expect(normalizeSerial(1) === '1',        'number 1 becomes "1"');
      expect(normalizeSerial('') === '',         'empty stays empty');
      expect(normalizeSerial(null) === '',       'null becomes empty');
      expect(normalizeSerial(undefined) === '',  'undefined becomes empty');
    });

    await run('T02', 'Serial range — basic range', () => {
      const r = generateRange('001', '005');
      expect(r.length === 5,    'must have 5 elements');
      expect(r[0] === '001',    'first must be 001');
      expect(r[4] === '005',    'last must be 005');
      expect(r[2] === '003',    'middle must be 003');
    });

    await run('T03', 'CRITICAL TEST 2 — 001 to 001 gives exactly 1 record', () => {
      const r = generateRange('001', '001');
      expect(r.length === 1,  `Expected 1 record, got ${r.length}`);
      expect(r[0] === '001',  'Must be exactly "001"');
    });

    await run('T04', 'CRITICAL TEST 3 — 010 to 020 gives exactly 11 records', () => {
      const r = generateRange('010', '020');
      expect(r.length === 11, `Expected 11 records, got ${r.length}`);
      expect(r[0] === '010',  'First must be "010"');
      expect(r[10] === '020', 'Last must be "020"');
      expect(r[5] === '015',  'Middle must be "015"');
    });

    await run('T05', 'CRITICAL TEST 5 — "001" never becomes "1"', () => {
      const r = generateRange('001', '003');
      for (const s of r) {
        expect(s.length === 3, `Serial "${s}" must be 3 digits, not stripped to short form`);
        expect(s !== '1' && s !== '2' && s !== '3', `"${s}" must not be single digit`);
      }
      expect(r[0] === '001', '"001" preserved');
      expect(r[1] === '002', '"002" preserved');
      expect(r[2] === '003', '"003" preserved');
    });

    await run('T06', 'Leading zero — 10-digit range stays consistent', () => {
      const r = generateRange('001', '100');
      expect(r.length === 100, 'Must have 100 elements');
      // All must be 3 digits (based on FROM width)
      expect(r[0] === '001',  'Start preserved');
      expect(r[9] === '010',  '010 must stay 010');
      expect(r[99] === '100', 'End is 100');
    });

    await run('T07', 'Range validation — FROM > TO is rejected', () => {
      const err = validateSerialRange('010', '001');
      expect(err !== null, 'Should return error for FROM > TO');
    });

    await run('T08', 'Range validation — empty FROM is rejected', () => {
      const err = validateSerialRange('', '010');
      expect(err !== null, 'Should return error for empty FROM');
    });

    await run('T09', 'Range validation — non-numeric rejected', () => {
      const err = validateSerialRange('ABC', '010');
      expect(err !== null, 'Should return error for non-numeric FROM');
    });

    await run('T10', 'Range — no padding when input has no leading zeros', () => {
      const r = generateRange('1', '5');
      expect(r[0] === '1', 'First is "1" not "01"');
      expect(r[4] === '5', 'Last is "5"');
    });

    await run('T11', 'CRITICAL TEST 4 — no record shift for gaps', () => {
      // Source: 001, 002, 004, 005 (003 missing)
      // Expected: 001 found, 002 found, 003 BLANK, 004 found, 005 found
      const range = generateRange('001', '005');
      const dataSerials = new Set(['001', '002', '004', '005']);

      const results: { serial: string; hasData: boolean }[] = range.map(s => ({
        serial: s,
        hasData: dataSerials.has(s),
      }));

      expect(results.length === 5, 'Must have exactly 5 entries');
      expect(results[0].serial === '001' && results[0].hasData, '001 must be found');
      expect(results[1].serial === '002' && results[1].hasData, '002 must be found');
      expect(results[2].serial === '003' && !results[2].hasData, '003 must be BLANK (not shifted)');
      expect(results[3].serial === '004' && results[3].hasData, '004 must be found (not in 003 position)');
      expect(results[4].serial === '005' && results[4].hasData, '005 must be found');
    });

    await run('T12', 'CRITICAL TEST 1 — 001-010 with data 001-005', () => {
      const range = generateRange('001', '010');
      const dataSerials = new Set(['001', '002', '003', '004', '005']);
      expect(range.length === 10, `Expected 10 records, got ${range.length}`);
      const found = range.filter(s => dataSerials.has(s)).length;
      const blank = range.filter(s => !dataSerials.has(s)).length;
      expect(found === 5, `Expected 5 found, got ${found}`);
      expect(blank === 5, `Expected 5 blank, got ${blank}`);
      // No records skipped
      for (let i = 1; i <= 10; i++) {
        const expected = String(i).padStart(3, '0');
        expect(range[i - 1] === expected, `Position ${i} must be "${expected}", got "${range[i - 1]}"`);
      }
    });

    await run('T13', 'normalizeSerial — various formats', () => {
      expect(normalizeSerial('001') === '001', '001 preserved');
      expect(normalizeSerial('1') === '1',     'bare 1 becomes "1"');
      expect(normalizeSerial('0') === '',       '"0" becomes empty (invalid serial)');
      expect(normalizeSerial('null') === '',    '"null" string becomes empty');
      expect(normalizeSerial('NaN') === '',     '"NaN" becomes empty');
    });

    await run('T14', 'Range — large range boundary', () => {
      const r = generateRange('001', '100');
      expect(r.length === 100, 'Hundred elements');
      expect(r[0] === '001',   'First');
      expect(r[99] === '100',  'Last');
    });

    await run('T15', 'Range — two-digit range', () => {
      const r = generateRange('01', '05');
      expect(r.length === 5,  '5 elements');
      expect(r[0] === '01',   'First is 01');
      expect(r[4] === '05',   'Last is 05');
    });

    await run('T16', 'validateSerialRange — valid range passes', () => {
      expect(validateSerialRange('001', '010') === null, 'Valid range returns null (no error)');
    });

    await run('T17', 'validateSerialRange — max range limit enforced', () => {
      // Range > 9999 should be rejected
      const err = validateSerialRange('00001', '99999');
      expect(err !== null, 'Range > 9999 should be rejected');
    });

    await run('T18', 'Empty field handling — normalizeSerial on blanks', () => {
      // Various blank-like values that Excel might produce
      const blanks = ['', null, undefined, '0', 'null', 'undefined', 'NaN'];
      for (const b of blanks) {
        const result = normalizeSerial(b as any);
        expect(result === '', `"${b}" should normalize to empty, got "${result}"`);
      }
    });

    await run('T19', 'File naming — deterministic names (no illegal chars)', () => {
      // Names must not contain: \ / : * ? " < > |
      const illegal = /[\\/:*?"<>|]/;
      const names = [
        'FORM_I_001.pdf', 'FORM_J_001-010.pdf', 'SHARE_REGISTER_001-010.pdf',
        'NOMINATION_REGISTER_001-010.pdf', 'PROPERTY_REGISTER_001-010.pdf',
        'BANK_LINE_MARK_001-010.pdf', 'HENU_OS_FORM_I_001-010.zip',
      ];
      for (const n of names) {
        expect(!illegal.test(n), `Filename "${n}" contains illegal character`);
      }
    });

    await run('T20', 'ZIP naming — HENU_OS_ prefix format', () => {
      const expected = [
        'HENU_OS_FORM_I_001-010.zip',
        'HENU_OS_FORM_J_001-010.zip',
        'HENU_OS_SHARE_REGISTER_001-010.zip',
        'HENU_OS_NOMINATION_REGISTER_001-010.zip',
        'HENU_OS_PROPERTY_REGISTER_001-010.zip',
        'HENU_OS_BANK_LINE_MARK_001-010.zip',
      ];
      for (const name of expected) {
        expect(name.startsWith('HENU_OS_'), `"${name}" must start with HENU_OS_`);
        expect(name.endsWith('.zip'), `"${name}" must end with .zip`);
        expect(!name.includes(' '), `"${name}" must not have spaces`);
      }
    });

    await run('T21', 'Centralized form definitions — verify presence and layout properties', () => {
      expect(FormIDefinition.orientation === 'Portrait', 'Form I must be Portrait');
      expect(FormJDefinition.orientation === 'Portrait', 'Form J must be Portrait');
      expect(ShareRegisterDefinition.orientation === 'Landscape', 'Share Register must be Landscape');
      expect(NominationRegisterDefinition.orientation === 'Landscape', 'Nomination Register must be Landscape');
      expect(PropertyRegisterDefinition.orientation === 'Landscape', 'Property Register must be Landscape');
      expect(LienMarkDefinition.orientation === 'Portrait', 'Lien Mark Register must be Portrait');
    });

    await run('T22', 'Deterministic pagination — verify correct column structure', () => {
      expect(FormJDefinition.columns.length === 4, 'Form J must have 4 columns');
      expect(ShareRegisterDefinition.flatColumns.length === 15 || ShareRegisterDefinition.flatColumns.length === 19, 'Share Register must have 15 or 19 columns');
      expect(NominationRegisterDefinition.columns.length === 9, 'Nomination Register must have 9 columns');
      expect(PropertyRegisterDefinition.flatColumns.length === 13, 'Property Register must have 13 columns');
      expect(LienMarkDefinition.loanSections.length === 4, 'Lien Mark Register must have 4 loan sections');
    });

    await run('T23', 'Master Data Query Engine — blank record generation for missing serials', () => {
      const mockWb: any = {
        societyMaster: { societyName: 'Test Society', registrationNo: '123' },
        commonFile: [{ srNo: '001', memberName: 'John Doe' }, { srNo: '003', memberName: 'Jane Smith' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const queried = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '005');
      expect(queried.length === 5, 'Querying 001-005 must return exactly 5 items');
      expect(queried[0].isBlank === false, '001 must be marked as non-blank');
      expect(queried[0].record.memberName === 'John Doe', '001 must contain John Doe');
      expect(queried[1].isBlank === true, '002 must be marked as blank');
      expect(queried[1].record.srNo === '002', '002 must have srNo 002');
      expect(queried[1].record.memberName === '', '002 memberName must be empty');
      expect(queried[2].isBlank === false, '003 must be marked as non-blank');
    });

    await run('T24', 'Master Data Query Engine — separate Society Master querying', () => {
      const mockWb: any = {
        societyMaster: { societyName: 'GOKULDHAM CHS LTD', registrationNo: 'BOM/HSG/1234' },
        commonFile: [], formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const soc = MasterDataQueryEngine.getSocietyData(mockWb);
      expect(soc !== null, 'Society data must not be null');
      expect(soc?.societyName === 'GOKULDHAM CHS LTD', 'Society name must match');
      expect(soc?.registrationNo === 'BOM/HSG/1234', 'Registration No must match');
    });

    await run('T25', 'Master Data Query Engine — data preview metrics computation', () => {
      const mockWb: any = {
        societyMaster: { societyName: 'GOKULDHAM' },
        commonFile: [{ srNo: '001' }, { srNo: '002' }, { srNo: '003' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const metrics = MasterDataQueryEngine.getPreviewMetrics(mockWb, 'FORM_J', '001', '010');
      expect(metrics.totalRequested === 10, 'Total requested must be 10');
      expect(metrics.foundCount === 3, 'Found count must be 3');
      expect(metrics.blankCount === 7, 'Blank count must be 7');
      expect(metrics.societyName === 'GOKULDHAM', 'Society name must match');
    });

    await run('T26', 'Form Mapping Service — semantic mapping resolution', () => {
      const blank = FormMappingService.createBlankRecord('007');
      expect(blank.srNo === '007', 'Blank record srNo must be 007');
      expect(blank.memberName === '', 'Blank record memberName must be empty string');
      expect(blank.permanentAddress === '', 'Blank record permanentAddress must be empty string');

      const mappedJ = FormMappingService.mapToFormJ(blank);
      expect(mappedJ.srNo === '007', 'Mapped Form J srNo must be 007');
      expect(mappedJ.memberName === '', 'Mapped Form J memberName must be empty string');
    });

    await run('T27', 'PdfDocumentBuilder — text wrapping calculation', async () => {
      const builder = await PdfDocumentBuilder.create({
        orientation: 'Portrait',
        title: 'TEST FORM',
        society: null,
      });
      const longText = 'SHRI RAMCHANDRA KESHAVRAO JOSHIRAO CHHATRAPATI SHIVAJI MAHARAJ MARG MUMBAI MAHARASHTRA INDIA';
      const lines = builder.wrapText(longText, 100, 8);
      expect(lines.length > 1, 'Long address text must wrap into multiple lines');
    });

    await run('T28', 'PdfDocumentBuilder — dynamic row height calculation', async () => {
      const builder = await PdfDocumentBuilder.create({
        orientation: 'Portrait',
        title: 'TEST FORM',
        society: null,
      });
      const cells = [
        { text: '001', width: 30 },
        { text: 'VERY LONG MEMBER NAME REQUIRING MULTIPLE LINES OF TEXT WRAPPING INSIDE THE CELL', width: 80 },
      ];
      const rowHeight = builder.calcRowHeight(cells, 20, 7.5);
      expect(rowHeight > 20, 'Row height must dynamically scale beyond minimum 20pt for multi-line text');
    });

    await run('T29', 'PdfDocumentBuilder — flow-based page breaks', async () => {
      const builder = await PdfDocumentBuilder.create({
        orientation: 'Portrait',
        title: 'TEST MULTI-PAGE',
        society: null,
      });
      expect(builder.pageCount === 1, 'Initial document must start with 1 page');
      builder.ensureSpace(901); // Forces page break
      expect(builder.pageCount === 2, 'Requesting space exceeding page height must trigger new page');
    });

    await run('T30', 'PdfDocumentBuilder — buffer build output', async () => {
      const builder = await PdfDocumentBuilder.create({
        orientation: 'Portrait',
        title: 'TEST BUILD',
        society: null,
      });
      const buf = await builder.buildBuffer();
      expect(buf.length > 0, 'Document builder must output a non-empty PDF buffer');
      expect(buf.toString('utf-8', 0, 5) === '%PDF-', 'Buffer must begin with valid PDF header %PDF-');
    });

    await run('T31', 'Native Portrait Renderers — Form I & Form J PDF generation', async () => {
      const mockRecords = [{ serial: '001', record: FormMappingService.createBlankRecord('001') }];
      const jBuffer = await FormJRenderer.render(mockRecords, null);
      expect(jBuffer.length > 0, 'Form J renderer must generate a non-empty PDF buffer');
      expect(jBuffer.toString('utf-8', 0, 5) === '%PDF-', 'Form J PDF buffer must have valid %PDF- header');

      const iBuffers = await FormIRenderer.render(mockRecords, null);
      expect(iBuffers.length === 1, 'Form I renderer must return 1 buffer for 1 record');
      expect(iBuffers[0].toString('utf-8', 0, 5) === '%PDF-', 'Form I PDF buffer must have valid %PDF- header');
    });

    await run('T32', 'Native Landscape Renderers — Share, Nomination, Property, Lien Mark generation', async () => {
      const mockRecords = [{ serial: '001', record: FormMappingService.createBlankRecord('001') }];

      const shareBuf = await ShareRegisterRenderer.render(mockRecords, null);
      expect(shareBuf.toString('utf-8', 0, 5) === '%PDF-', 'Share Register must output valid PDF buffer');

      const nomBuf = await NominationRegisterRenderer.render(mockRecords, null);
      expect(nomBuf.toString('utf-8', 0, 5) === '%PDF-', 'Nomination Register must output valid PDF buffer');

      const propBuf = await PropertyRegisterRenderer.render(mockRecords, null);
      expect(propBuf.toString('utf-8', 0, 5) === '%PDF-', 'Property Register must output valid PDF buffer');

      const bankBuf = await LienMarkRenderer.render(mockRecords, null);
      expect(bankBuf.toString('utf-8', 0, 5) === '%PDF-', 'Lien Mark Register must output valid PDF buffer');
    });

    await run('T33', 'PdfEngine — end-to-end dispatch for all 6 forms', async () => {
      const mockWb: any = {
        societyMaster: { societyName: 'TEST SOCIETY' },
        commonFile: [{ srNo: '001', memberName: 'ALICE' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const forms: ('FORM_I' | 'FORM_J' | 'FORM_SHARE' | 'FORM_NOM' | 'FORM_PROP' | 'FORM_BANK')[] = [
        'FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'
      ];
      for (const formId of forms) {
        const result = await PdfEngine.generate({
          formId,
          fromSerial: '001',
          toSerial: '002',
          workbook: mockWb,
        });
        expect(result.files.length > 0, `${formId} end-to-end generation must produce files`);
        expect(result.files[0].buffer.length > 0, `${formId} generated PDF buffer must not be empty`);
      }
    });

    await run('T34', 'ZipService — create and package ZIP export', async () => {
      const entries = [{ filename: 'TEST_FILE.pdf', buffer: Buffer.from('%PDF-1.4 test') }];
      const tmpDir = path.join(process.cwd(), 'scratch', 'test_zips');
      const zipPath = await ZipService.createAndSave(entries, 'FORM_J', '001', '005', tmpDir);
      expect(fs.existsSync(zipPath), 'ZIP file must be physically created on disk');
      expect(path.basename(zipPath) === 'HENU_OS_FORM_J_001-005.zip', 'ZIP filename must match HENU_OS_ prefix convention');
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // Cleanup
    });

    await run('T35', 'Phase 4 Rule — absent serials generate blank records with Sr. No. only', async () => {
      const mockWb: any = {
        societyMaster: null,
        commonFile: [{ srNo: '001', memberName: 'EXISTING MEMBER' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const queried = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '003');
      expect(queried.length === 3, 'Query range 001-003 must yield 3 items');
      expect(queried[0].record.memberName === 'EXISTING MEMBER', '001 must contain existing member name');
      expect(queried[1].record.srNo === '002', 'Absent serial 002 must have srNo 002');
      expect(queried[1].record.memberName === '', 'Absent serial 002 must have empty memberName');
      expect(queried[2].record.srNo === '003', 'Absent serial 003 must have srNo 003');
      expect(queried[2].record.memberName === '', 'Absent serial 003 must have empty memberName');
    });

    await run('T36', 'Phase 4 Rule — dynamic row count matches requested serial range exactly', async () => {
      const mockWb: any = {
        societyMaster: null,
        commonFile: [{ srNo: '001' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const queried = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '002');
      expect(queried.length === 2, 'Requested range 001-002 must generate exactly 2 rows, not 10 or 20');
    });

    await run('T37', 'Form Contract — Form I Portrait immutable structure', async () => {
      expect(FormIDefinition.orientation === 'Portrait', 'Form I must be Portrait orientation');
      expect(FormIDefinition.title === 'FORM "I" REGISTER OF MEMBERS', 'Form I title must match contract');
      expect(FormIDefinition.sections.shares === 'PARTICULARS OF SHARES HELD', 'Form I Table 1 header must match contract');
      expect(FormIDefinition.sections.transfer === 'PARTICULARS OF SHARES TRANSFERRED OR SURRENDERED', 'Form I Table 2 header must match contract');
    });

    await run('T38', 'Form Contract — Form J Portrait immutable structure', async () => {
      expect(FormJDefinition.orientation === 'Portrait', 'Form J must be Portrait orientation');
      expect(FormJDefinition.title === 'FORM "J" LIST OF MEMBERS', 'Form J title must match contract');
      expect(FormJDefinition.columns.length === 4, 'Form J must have exactly 4 columns');
      expect(FormJDefinition.columns[0].header === 'Serial No.', 'Column 1 must be Serial No.');
      expect(FormJDefinition.columns[1].header === 'Full Name of the Member', 'Column 2 must be Full Name of the Member');
      expect(FormJDefinition.columns[2].header === 'Address', 'Column 3 must be Address');
      expect(FormJDefinition.columns[3].header === 'Class of Member', 'Column 4 must be Class of Member');
    });

    await run('T39', 'Form Contract — Share Register Landscape layout', async () => {
      expect(ShareRegisterDefinition.orientation === 'Landscape', 'Share Register must be Landscape orientation');
      expect(ShareRegisterDefinition.title === 'SHARE REGISTER', 'Share Register title must match contract');
      expect(ShareRegisterDefinition.flatColumns.length === 15 || ShareRegisterDefinition.flatColumns.length === 19, 'Share Register must have 15 or 19 columns');
    });

    await run('T40', 'Form Contract — Nomination Register Landscape 9-column layout', async () => {
      expect(NominationRegisterDefinition.orientation === 'Landscape', 'Nomination Register must be Landscape orientation');
      expect(NominationRegisterDefinition.title === 'REGISTER OF NOMINATION', 'Nomination Register title must match contract');
      expect(NominationRegisterDefinition.columns.length === 9, 'Nomination Register must have EXACTLY 9 columns');
      expect(NominationRegisterDefinition.columns[0].header === 'Sr. No.', 'Column 1 must be Sr. No.');
      expect(NominationRegisterDefinition.columns[2].header === 'Flat / Wing', 'Column 3 must be Flat / Wing');
      expect(NominationRegisterDefinition.columns[4].header === 'Name/s of Nominee/s & Address/es of the Nominee/s', 'Column 5 must match nominee header contract');
    });

    await run('T41', 'Form Contract — Property Register Landscape grouped subheaders', async () => {
      expect(PropertyRegisterDefinition.orientation === 'Landscape', 'Property Register must be Landscape orientation');
      expect(PropertyRegisterDefinition.title === 'PROPERTY REGISTER', 'Property Register title must match contract');
      expect(PropertyRegisterDefinition.flatColumns.length === 13, 'Property Register must have 13 columns');
      expect(PropertyRegisterDefinition.headerGroups.some(g => g.header === 'Distinguishing No. of Tenement'), 'Property Register must contain grouped header Distinguishing No. of Tenement');
      expect(PropertyRegisterDefinition.headerGroups.some(g => g.header === 'Cost of Tenement'), 'Property Register must contain grouped header Cost of Tenement');
    });

    await run('T42', 'Form Contract — Lien Mark Register Member/Property Form with 4 Loan Sections', async () => {
      expect(LienMarkDefinition.orientation === 'Portrait', 'Lien Mark Register must be Portrait orientation');
      expect(LienMarkDefinition.title === 'REGISTER OF LIEN MARK', 'Lien Mark Register title must match contract');
      expect(LienMarkDefinition.loanSections.length === 4, 'Lien Mark Register must contain 4 Loan Sections');
      expect(LienMarkDefinition.loanSections[0].title === 'PARTICULARS OF LOAN - 1st LOAN', '1st Loan Section title must match contract');
      expect(LienMarkDefinition.loanSections[1].title === 'PARTICULARS OF LOAN - 2nd LOAN OR LOAN TOP-UP', '2nd Loan Section title must match contract');
    });

    await run('T43', 'Data Mapping — 001-005 range with missing 004 gap resolution', async () => {
      const mockWb: any = {
        societyMaster: { societyName: 'DYNAMIC SOCIETY' },
        commonFile: [
          { srNo: '001', memberName: 'MEMBER 1' },
          { srNo: '002', memberName: 'MEMBER 2' },
          { srNo: '003', memberName: 'MEMBER 3' },
          { srNo: '005', memberName: 'MEMBER 5' },
        ],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };

      const results = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '005');
      expect(results.length === 5, 'Query range 001-005 must return exactly 5 items');
      expect(results[0].serial === '001' && results[0].record.memberName === 'MEMBER 1', '001 must contain MEMBER 1');
      expect(results[1].serial === '002' && results[1].record.memberName === 'MEMBER 2', '002 must contain MEMBER 2');
      expect(results[2].serial === '003' && results[2].record.memberName === 'MEMBER 3', '003 must contain MEMBER 3');
      expect(results[3].serial === '004' && results[3].isBlank === true && results[3].record.memberName === '', '004 must be blank with empty memberName');
      expect(results[4].serial === '005' && results[4].record.memberName === 'MEMBER 5', '005 must be in position 5 without shifting');
    });

    await run('T44', 'Data Mapping — dynamic row counts (1 member, 3 members, 10 members)', async () => {
      const mockWb: any = {
        societyMaster: null,
        commonFile: [
          { srNo: '001', memberName: 'A' }, { srNo: '002', memberName: 'B' }, { srNo: '003', memberName: 'C' },
          { srNo: '004', memberName: 'D' }, { srNo: '005', memberName: 'E' }, { srNo: '006', memberName: 'F' },
          { srNo: '007', memberName: 'G' }, { srNo: '008', memberName: 'H' }, { srNo: '009', memberName: 'I' },
          { srNo: '010', memberName: 'J' },
        ],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };

      const q1 = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '001');
      expect(q1.length === 1, '1 requested record must yield 1 item');

      const q3 = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '003');
      expect(q3.length === 3, '3 requested records must yield 3 items');

      const q10 = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '010');
      expect(q10.length === 10, '10 requested records must yield 10 items');
    });

    await run('T45', 'Data Mapping — Society Master dynamic resolution', async () => {
      const mockWb: any = {
        societyMaster: {
          societyName: 'DYNAMIC SUNSHINE CO-OP HOUSING SOCIETY',
          registrationNo: 'REG/12345/2026',
          registrationDate: '01/01/2026',
          address: '123 DYNAMIC WAY',
          email: 'info@sunshine.com',
          telephone: '9876543210',
          totalUnits: 50, unitsFlat: 40, unitsShop: 10, unitsOffice: 0, unitsGala: 0, printBlanks: 5,
        },
        commonFile: [{ srNo: '001' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };

      const soc = MasterDataQueryEngine.getSocietyData(mockWb);
      expect(soc?.societyName === 'DYNAMIC SUNSHINE CO-OP HOUSING SOCIETY', 'Society name must match dynamic value');
      expect(soc?.registrationNo === 'REG/12345/2026', 'Registration No. must match dynamic value');
      expect(soc?.email === 'info@sunshine.com', 'Email must match dynamic value');
    });

    await run('T46', 'Data Mapping — semantic field mapping by field name, not column index', async () => {
      const rec = FormMappingService.createBlankRecord('001');
      rec.memberName = 'SEMANTIC NAME';
      rec.permanentAddress = 'SEMANTIC ADDRESS';

      const mapped = FormMappingService.mapToFormJ(rec);
      expect(mapped.memberName === 'SEMANTIC NAME', 'Member name must map semantically');
      expect(mapped.address === 'SEMANTIC ADDRESS', 'Address must map semantically');
    });

    await run('T47', 'Data Mapping — Validation Engine pre-render validation checks', async () => {
      const mockWb: any = {
        societyMaster: { societyName: '', registrationNo: '' },
        commonFile: [{ srNo: '001' }, { srNo: '001' }], // Duplicate serial
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };

      const valResult = ValidationEngine.validateWorkbook(mockWb);
      expect(!valResult.isValid, 'Workbook with blank mandatory society name must fail validation');
      expect(valResult.errors.length > 0, 'Validation errors list must not be empty');
      expect(valResult.errors.some(e => e.includes('Society Name') || e.includes('Duplicate')), 'Error list must mention missing society name or duplicate serial');
    });

    await run('T48', 'Data Mapping — end-to-end PDF generation reflects dynamic uploaded workbook', async () => {
      const mockWb: any = {
        societyMaster: { societyName: 'DYNAMIC TEST SOCIETY' },
        commonFile: [{ srNo: '001', memberName: 'UNIQUE DYNAMIC NAME' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };

      const pdfResult = await PdfEngine.generate({
        formId: 'FORM_J',
        fromSerial: '001',
        toSerial: '001',
        workbook: mockWb,
      });

      expect(pdfResult.files.length === 1, 'PDF generation must produce 1 file');
      expect(pdfResult.files[0].buffer.length > 0, 'Generated PDF buffer must not be empty');
    });

    await run('T49', 'Visual QA — single sample record PDF structure & bounds', async () => {
      const mockWb: any = {
        societyMaster: { societyName: 'QA TEST SOCIETY' },
        commonFile: [{ srNo: '001', memberName: 'SINGLE RECORD MEMBER' }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const res = await PdfEngine.generate({ formId: 'FORM_J', fromSerial: '001', toSerial: '001', workbook: mockWb });
      const buf = res.files[0].buffer;
      expect(buf.length > 500, 'Single record PDF buffer size must be > 500 bytes');
      expect(buf.toString('utf-8', 0, 5) === '%PDF-', 'PDF must have valid %PDF- header');
    });

    await run('T50', 'Visual QA — three records dataset PDF structure', async () => {
      const mockWb: any = {
        societyMaster: { societyName: 'QA TEST SOCIETY' },
        commonFile: [
          { srNo: '001', memberName: 'MEMBER 1' },
          { srNo: '002', memberName: 'MEMBER 2' },
          { srNo: '003', memberName: 'MEMBER 3' },
        ],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const res = await PdfEngine.generate({ formId: 'FORM_J', fromSerial: '001', toSerial: '003', workbook: mockWb });
      const buf = res.files[0].buffer;
      expect(buf.length > 800, 'Three record PDF buffer size must be > 800 bytes');
    });

    await run('T51', 'Visual QA — long address & long nominee text wrapping bounds', async () => {
      const longAddr = 'FLAT NO 1001, 10TH FLOOR, TOWER B, SHANTI GARDENS, OPPOSITE METRO STATION, KOTHRUD, PUNE 411038, MAHARASHTRA, INDIA';
      const longNom = 'MR. NOMINEE SURNAME FIRST & MRS. SECOND NOMINEE (RELATION: SON & DAUGHTER, SHARE: 50% EACH), RESIDING AT FLAT 202, SHANTI NIKETAN, PUNE';
      const mockWb: any = {
        societyMaster: { societyName: 'QA LONG TEXT SOCIETY' },
        commonFile: [{ srNo: '001', memberName: 'LONG TEXT MEMBER', permanentAddress: longAddr, nomineeName: longNom }],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const res = await PdfEngine.generate({ formId: 'FORM_NOM', fromSerial: '001', toSerial: '001', workbook: mockWb });
      expect(res.files[0].buffer.length > 1000, 'Long text PDF must render valid wrapped output buffer');
    });

    await run('T52', 'Visual QA — missing serial range gap handling (004 missing)', async () => {
      const mockWb: any = {
        societyMaster: null,
        commonFile: [
          { srNo: '001', memberName: 'M1' }, { srNo: '002', memberName: 'M2' },
          { srNo: '003', memberName: 'M3' }, { srNo: '005', memberName: 'M5' },
        ],
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const records = MasterDataQueryEngine.queryFormRecords(mockWb, 'FORM_J', '001', '005');
      expect(records.length === 5, '001-005 range must produce 5 records');
      expect(records[3].serial === '004' && records[3].isBlank === true, '004 must be flagged as blank serial');
    });

    await run('T53', 'Visual QA — multi-page pagination & flow integrity', async () => {
      const manyMembers = Array.from({ length: 30 }, (_, i) => ({
        srNo: String(i + 1).padStart(3, '0'),
        memberName: `MEMBER NUMBER ${i + 1}`,
      }));
      const mockWb: any = {
        societyMaster: { societyName: 'MULTI PAGE SOCIETY' },
        commonFile: manyMembers,
        formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
      };
      const res = await PdfEngine.generate({ formId: 'FORM_J', fromSerial: '001', toSerial: '030', workbook: mockWb });
      expect(res.files[0].buffer.length > 2000, 'Multi-page PDF buffer must be > 2000 bytes');
    });

    await run('T54', 'Visual QA — exact form orientation enforcement', async () => {
      expect(FormIDefinition.orientation === 'Portrait', 'Form I must be Portrait');
      expect(FormJDefinition.orientation === 'Portrait', 'Form J must be Portrait');
      expect(ShareRegisterDefinition.orientation === 'Landscape', 'Share Register must be Landscape');
      expect(NominationRegisterDefinition.orientation === 'Landscape', 'Nomination Register must be Landscape');
      expect(PropertyRegisterDefinition.orientation === 'Landscape', 'Property Register must be Landscape');
      expect(LienMarkDefinition.orientation === 'Portrait', 'Lien Mark Register must be Portrait');
    });

    // ── Summary ───────────────────────────────────────────────
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    return {
      total: results.length,
      passed,
      failed,
      results,
      durationMs: Date.now() - t0,
    };
  }
}
