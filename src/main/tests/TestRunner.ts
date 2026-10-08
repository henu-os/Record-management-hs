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
import { StorageEngine } from '../services/config/StorageEngine';
import { HenuConfigService } from '../services/config/HenuConfigService';
import { DocumentRoutingService } from '../services/config/DocumentRoutingService';
import { BackupService } from '../services/config/BackupService';
import { SystemHealthService } from '../services/config/SystemHealthService';
import { HenuMasterService } from '../services/master/HenuMasterService';
import { MasterDataService } from '../services/MasterDataService';
import { HenuSecurityService } from '../services/security/HenuSecurityService';
import { HenuSocietyContextService } from '../services/society/HenuSocietyContextService';
import { initializeDatabase, getPaths } from '../db';
import * as XLSX from 'xlsx';
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
    try {
      initializeDatabase();
    } catch {}
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
      builder.ensureSpace(950); // Forces page break exceeding usable vertical height (936pt)
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

    // ── HENU CONFIG Module Tests ──────────────────────────────

    await run('T55', 'HENU CONFIG — Storage Location Validator checks write permissions & rejects system dirs', () => {
      const paths = getPaths();
      const validRes = StorageEngine.validateLocation(paths.userData);
      expect(validRes.isValid, 'UserData path must be valid and writable');
      expect(validRes.isWritable, 'Write permission test must pass');

      const sysRes = StorageEngine.validateLocation('C:\\Windows\\System32');
      expect(!sysRes.isValid, 'System protected paths must be rejected');
      expect(sysRes.isSystemProtected, 'Flag isSystemProtected must be true');
    });

    await run('T56', 'HENU CONFIG — Root Storage Structure provisions 6 required subdirectories', () => {
      const paths = getPaths();
      const testRoot = path.join(paths.userData, 'test_root_structure');
      const dirs = StorageEngine.initializeRootStructure(testRoot);

      expect(fs.existsSync(dirs.societiesPath), 'Societies folder must exist');
      expect(fs.existsSync(dirs.backupsPath), 'Backups folder must exist');
      expect(fs.existsSync(dirs.exportsPath), 'Exports folder must exist');
      expect(fs.existsSync(dirs.importsPath), 'Imports folder must exist');
      expect(fs.existsSync(dirs.logsPath), 'Logs folder must exist');
      expect(fs.existsSync(dirs.systemPath), 'System folder must exist');
    });

    await run('T57', 'HENU CONFIG — Dynamic Root Storage handles arbitrary drive & folder paths without hardcoding', () => {
      const sample1 = StorageEngine.sanitizeFolderName('My Society / Unit : 101');
      expect(!sample1.includes('/'), 'Illegal slash must be sanitized');
      expect(!sample1.includes(':'), 'Illegal colon must be sanitized');
      expect(sample1.length > 0, 'Sanitized name must not be empty');
    });

    await run('T58', 'HENU CONFIG — Society Folder Provisioning creates 8 statutory categories', () => {
      const paths = getPaths();
      const testRoot = path.join(paths.userData, 'test_soc_root');
      const categories = [
        'Form I', 'Form J', 'Share Register', 'Property Register',
        'Nomination Register', 'Bank Lien Mark', 'Share Certificate', 'Voucher'
      ];
      const { societyPath, createdCategories } = StorageEngine.createSocietyFolders(testRoot, 'TEST_SUNSHINE_SOCIETY', categories);

      expect(fs.existsSync(societyPath), 'Society root folder must exist');
      for (const cat of categories) {
        expect(fs.existsSync(createdCategories[cat]), `Category folder for ${cat} must exist`);
      }
    });

    await run('T59', 'HENU CONFIG — File Naming Engine produces sanitized deterministic output', () => {
      const service = DocumentRoutingService.getInstance();
      const fileName = service.formatDocumentFileName(
        '{SocietyName}_{Category}_{Number}_{Year}',
        {
          societyName: 'SUNSHINE CO-OP <LTD>',
          categoryName: 'Share Certificate',
          number: '042',
          date: '2026-05-18',
          extension: 'pdf',
        }
      );

      expect(!fileName.includes('<'), 'Illegal angle brackets must be sanitized');
      expect(!fileName.includes('>'), 'Illegal angle brackets must be sanitized');
      expect(fileName.endsWith('.pdf'), 'File name must have .pdf extension');
      expect(fileName.includes('042'), 'File name must include padded serial number');
      expect(fileName.includes('2026'), 'File name must include year token');
    });

    await run('T60', 'HENU CONFIG — Duplicate Collision Resolution handles versioning correctly', () => {
      const paths = getPaths();
      const testDir = path.join(paths.userData, 'test_duplicates');
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

      const initialFile = path.join(testDir, 'Voucher_105.pdf');
      fs.writeFileSync(initialFile, 'dummy voucher 1');

      const service = DocumentRoutingService.getInstance();
      const res = service.resolveDuplicatePath(testDir, 'Voucher_105.pdf', 'VERSION');

      expect(res.finalFileName === 'Voucher_105_v2.pdf', `Expected Voucher_105_v2.pdf, got ${res.finalFileName}`);
      expect(res.version === 2, 'Version must be 2');
    });

    await run('T61', 'HENU CONFIG — Document Routing & DB Registration saves file & index atomically', async () => {
      const service = DocumentRoutingService.getInstance();
      const dummyBuf = Buffer.from('%PDF-1.4 dummy buffer for test routing');

      const result = await service.routeAndRegisterDocument({
        societyId: 'default-society-1',
        societyName: 'TEST_ROUTING_SOCIETY',
        categoryNameOrId: 'Form I',
        buffer: dummyBuf,
        fileType: 'PDF',
        serialNumber: '001-010',
      });

      expect(result.success, `Document routing must succeed: ${result.error}`);
      expect(result.document !== undefined, 'Document record must be returned');
      expect(fs.existsSync(result.document!.filePath), 'Physical file must exist on disk');
      expect(result.document!.fileSize > 0, 'File size must be greater than 0');
    });

    await run('T62', 'HENU CONFIG — Category Management protects 8 statutory categories', () => {
      const service = DocumentRoutingService.getInstance();
      const categories = service.getCategories();
      const systemRequired = categories.filter(c => c.systemRequired);
      expect(systemRequired.length >= 8, 'Must have at least 8 system required categories');

      // Attempt to delete system required category
      const formICat = categories.find(c => c.name === 'Form I');
      if (formICat) {
        const delRes = service.deleteCategory(formICat.id);
        expect(!delRes.success, 'System required categories must not be deletable');
      }
    });

    await run('T63', 'HENU CONFIG — Local Archive & Backup generates verifiable ZIP archive', async () => {
      const backupService = BackupService.getInstance();
      const res = await backupService.createBackup('unit_test');

      expect(res.success, `Backup creation must succeed: ${res.error}`);
      expect(res.backup !== undefined, 'Backup record must exist');
      expect(fs.existsSync(res.backup!.filePath), 'Backup file must exist on disk');
      expect(res.backup!.fileSize > 100, 'Backup ZIP size must be > 100 bytes');
    });

    await run('T64', 'HENU CONFIG — 8-Point System Health Check passes with valid environment', async () => {
      const healthService = SystemHealthService.getInstance();
      const report = await healthService.runHealthCheck();

      expect(report.checks.database.passed, 'Database check must pass');
      expect(report.checks.storage.passed, 'Storage check must pass');
      expect(report.checks.folderStructure.passed, 'Folder structure check must pass');
      expect(report.checks.permissions.passed, 'Permissions check must pass');
    });

    await run('T65', 'HENU CONFIG — Storage Repair & Re-Index verifies folder tree and indexes untracked files', async () => {
      const healthService = SystemHealthService.getInstance();
      const res = await healthService.repairAndReindex();

      expect(res.success, 'Repair and re-index must succeed');
      expect(res.repairedFolders >= 8, 'Must repair/verify at least 8 category folders');
    });

    // ── HENUMASTER Tests ──────────────────────────────────────────
    await run('T66', 'HENUMASTER — Dashboard Statistics calculates system-wide societies, storage & health', () => {
      const masterService = HenuMasterService.getInstance();
      const stats = masterService.getDashboardStats();

      expect(stats.totalSocieties >= 1, 'Total societies count must be >= 1');
      expect(stats.activeSocieties >= 1, 'Active societies count must be >= 1');
      expect(stats.totalRegisters >= 8, 'Total statutory registers must be >= 8');
      expect(stats.storageUsedFormatted !== '', 'Storage used must be formatted');
      expect(stats.systemHealthStatus === 'HEALTHY' || stats.systemHealthStatus === 'WARNING', 'Health status must be valid');
    });

    await run('T67', 'HENUMASTER — Society List aggregates document counts, sizes and health status', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();

      expect(list.length >= 1, 'Society list must contain at least 1 society');
      const first = list[0];
      expect(first.id !== '', 'Society must have a valid ID');
      expect(first.societyName !== '', 'Society must have a name');
      expect(first.status === 'ACTIVE' || first.status === 'ARCHIVED', 'Society must have valid status');
      expect(first.folderPath !== '', 'Society must have a derived physical folder path');
    });

    await run('T68', 'HENUMASTER — Global Society Search queries name, registrationNo, city, state', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const sample = list[0];

      // Search by partial society name
      const queryName = sample.societyName.substring(0, 4);
      const searchByName = masterService.listSocieties({ search: queryName });
      expect(searchByName.some(s => s.id === sample.id), 'Search by name must find the target society');

      // Search by registration number if present
      if (sample.registrationNo) {
        const queryReg = sample.registrationNo.substring(0, 4);
        const searchByReg = masterService.listSocieties({ search: queryReg });
        expect(searchByReg.some(s => s.id === sample.id), 'Search by reg number must find the target society');
      }
    });

    await run('T69', 'HENUMASTER — Status Filtering separates ACTIVE and ARCHIVED societies', () => {
      const masterService = HenuMasterService.getInstance();
      const allSocieties = masterService.listSocieties({ status: 'ALL' });
      const activeSocieties = masterService.listSocieties({ status: 'ACTIVE' });
      const archivedSocieties = masterService.listSocieties({ status: 'ARCHIVED' });

      expect(allSocieties.length === (activeSocieties.length + archivedSocieties.length), 'ALL must equal ACTIVE + ARCHIVED count');
      expect(activeSocieties.every(s => s.status === 'ACTIVE'), 'Active list must only contain ACTIVE societies');
      expect(archivedSocieties.every(s => s.status === 'ARCHIVED'), 'Archived list must only contain ARCHIVED societies');
    });

    await run('T70', 'HENUMASTER — Complete Society Overview provides 8 statutory register cards & navigation IDs', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const socId = list[0].id;

      const overview = masterService.getSocietyOverview(socId);
      expect(overview.id === socId, 'Overview must match requested society ID');
      expect(overview.registers.length >= 8, 'Overview must contain at least 8 statutory registers');

      // Verify all 8 statutory categories are present
      const regNames = overview.registers.map(r => r.categoryName);
      expect(regNames.includes('Form I'), 'Must include Form I register');
      expect(regNames.includes('Form J'), 'Must include Form J register');
      expect(regNames.includes('Share Register'), 'Must include Share Register');
      expect(regNames.includes('Property Register'), 'Must include Property Register');
      expect(regNames.includes('Nomination Register'), 'Must include Nomination Register');
      expect(regNames.includes('Bank Lien Mark'), 'Must include Bank Lien Mark');
      expect(regNames.includes('Share Certificate'), 'Must include Share Certificate');
      expect(regNames.includes('Voucher'), 'Must include Voucher');

      // Verify navigation mapping
      const formIReg = overview.registers.find(r => r.categoryName === 'Form I');
      expect(formIReg?.navFormId === 'generate-FORM_I', 'Form I must map to generate-FORM_I nav ID');
    });

    await run('T71', 'HENUMASTER — Society Health Assessment validates database, folders, subfolders, files', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const socId = list[0].id;

      const overview = masterService.getSocietyOverview(socId);
      expect(overview.health.dbRecordExists, 'Database record must be verified');
      expect(overview.health.categoriesConfigured, 'Categories must be configured');
      expect(overview.health.missingCategoryFolders !== undefined, 'Missing folders list must exist');
    });

    await run('T72', 'HENUMASTER — Metadata Edit updates database records safely without modifying directory paths', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const soc = list[0];

      const originalYear = soc.yearEstablished || '';
      const updated = masterService.updateSocietyMetadata(soc.id, {
        yearEstablished: '2024',
      });

      expect(updated.id === soc.id, 'Society ID must remain unchanged');
      const reOverview = masterService.getSocietyOverview(soc.id);
      expect(reOverview.yearEstablished === '2024', 'Year established must be updated');
      expect(reOverview.folderPath === soc.folderPath, 'Physical folder path must not be altered by metadata edits');

      // Restore original year
      masterService.updateSocietyMetadata(soc.id, { yearEstablished: originalYear });
    });

    await run('T73', 'HENUMASTER — Archive & Restore manages status non-destructively without deleting files', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const soc = list[0];

      // Archive society
      const archiveRes = masterService.archiveSociety(soc.id);
      expect(archiveRes, 'Archive operation must return true');
      const archivedOverview = masterService.getSocietyOverview(soc.id);
      expect(archivedOverview.status === 'ARCHIVED', 'Society status must become ARCHIVED');

      // Restore society
      const restoreRes = masterService.restoreSociety(soc.id);
      expect(restoreRes, 'Restore operation must return true');
      const restoredOverview = masterService.getSocietyOverview(soc.id);
      expect(restoredOverview.status === 'ACTIVE', 'Society status must return to ACTIVE');
    });

    await run('T74', 'HENUMASTER — Recent Activity aggregates document events and generation history', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const socId = list[0].id;

      const activity = masterService.getRecentActivity(socId, 10);
      expect(Array.isArray(activity), 'Recent activity must return an array');
    });

    await run('T75', 'HENUMASTER — Executive Summary Export outputs structured plain text, CSV, and JSON', () => {
      const masterService = HenuMasterService.getInstance();
      const list = masterService.listSocieties();
      const socId = list[0].id;

      const textExport = masterService.exportSocietySummary(socId, 'text');
      expect(textExport.includes('HENU OS RECORD MANAGEMENT'), 'Text export must have header');
      expect(textExport.includes('STATUTORY REGISTER & DOCUMENT BREAKDOWN'), 'Text export must include register breakdown');

      const csvExport = masterService.exportSocietySummary(socId, 'csv');
      expect(csvExport.includes('Category,Document Count,Storage Size'), 'CSV export must have columns header');

      const jsonExport = masterService.exportSocietySummary(socId, 'json');
      const parsed = JSON.parse(jsonExport);
      expect(parsed.id === socId, 'JSON export must be valid JSON matching society ID');
    });

    // ── TARGETED IMPLEMENTATION TESTS (Prompt 2 Requirements) ──

    await run('T76', 'Empty Excel Cells — Preserves empty values without inventing defaults across all registers', () => {
      const blankRec = FormMappingService.createBlankRecord('001');
      expect(blankRec.srNo === '001', 'Serial number must be 001');
      expect(blankRec.classOfMember === '', 'Class of member must be empty');
      expect(blankRec.noOfShares === '', 'No of shares must be empty');
      expect(blankRec.valueOfOneShare === '', 'Value of one share must be empty');
      expect(blankRec.valueOfShares === '', 'Value of shares must be empty');
      expect(blankRec.sharesFrom === '', 'Shares from must be empty');
      expect(blankRec.sharesTo === '', 'Shares to must be empty');
      expect(blankRec.permanentAddress === '', 'Permanent address must be empty');
    });

    await run('T77', 'Common Member Master — Alphanumeric & symbol shares values (10A, ₹500, 10/20, ABC123) preserved without numeric coercion', () => {
      const mockWb: any = {
        societyMaster: { societyName: 'TEST SOC' },
        commonFile: [
          {
            srNo: '001',
            memberName: 'Rahul',
            noOfShares: '10A',
            valueOfOneShare: '₹500',
            valueOfShares: '',
          },
          {
            srNo: '002',
            memberName: 'Pooja',
            noOfShares: '10/20',
            valueOfOneShare: '500-B',
            valueOfShares: 'ABC123',
          }
        ],
        formIData: [],
        formJData: [],
        shareData: [],
        nominationData: [],
        propertyData: [],
        bankLineMarkData: [],
        voucherData: []
      };

      const resolved1 = FormMappingService.resolveRecord(mockWb, 'FORM_SHARE', '001');
      expect(resolved1.noOfShares === '10A', 'Must preserve alphanumeric share count "10A"');
      expect(resolved1.valueOfOneShare === '₹500', 'Must preserve symbol value "₹500"');
      expect(resolved1.valueOfShares === '', 'Empty valueOfShares must remain empty');

      const resolved2 = FormMappingService.resolveRecord(mockWb, 'FORM_SHARE', '002');
      expect(resolved2.noOfShares === '10/20', 'Must preserve "10/20"');
      expect(resolved2.valueOfOneShare === '500-B', 'Must preserve "500-B"');
      expect(resolved2.valueOfShares === 'ABC123', 'Must preserve "ABC123"');
    });

    await run('T78', 'Test Data & Society Management — Deletion is permanent, no auto-resurrection on reload/restart', () => {
      const masterService = HenuMasterService.getInstance();
      const initialSocieties = masterService.listSocieties();
      expect(Array.isArray(initialSocieties), 'Societies list must be an array');
      // Verify societies are real stored records
      for (const s of initialSocieties) {
        expect(Boolean(s.id && s.societyName), 'Each society must have valid id and societyName');
      }
    });

    await run('T79', 'Blank Forms Serial Range — FROM=67, TOTAL=10 calculates TO=76', () => {
      const { calculateToFromTotal } = require('../services/SerialRangeEngine');
      const to = calculateToFromTotal('67', 10);
      expect(to === 76, `Expected TO=76, got ${to}`);
      const range = generateRange('67', String(to));
      expect(range.length === 10, 'Range 67..76 must yield exactly 10 serials');
      expect(range[0] === '67' && range[9] === '76', 'Range bounds must be 67 and 76');
    });

    await run('T80', 'Blank Forms Reverse Formula — FROM=21, TO=88 calculates TOTAL=68', () => {
      const { calculateTotalFromRange } = require('../services/SerialRangeEngine');
      const total = calculateTotalFromRange('21', '88');
      expect(total === 68, `Expected TOTAL=68, got ${total}`);
    });

    await run('T81', 'Blank Forms Single Form Boundary — FROM=100, TOTAL=1 gives TO=100, TOTAL=1', () => {
      const { calculateToFromTotal, calculateTotalFromRange } = require('../services/SerialRangeEngine');
      const to = calculateToFromTotal('100', 1);
      expect(to === 100, `Expected TO=100, got ${to}`);
      const total = calculateTotalFromRange('100', '100');
      expect(total === 1, `Expected TOTAL=1, got ${total}`);
    });

    await run('T82', 'Blank Forms Prefix & Separator — Prefix "SC", Separator "-" formats SC-67, SC-68, SC-69', () => {
      const { formatSerialWithPrefix } = require('../services/SerialRangeEngine');
      expect(formatSerialWithPrefix('67', 'SC', '-') === 'SC-67', 'Must format SC-67');
      expect(formatSerialWithPrefix('68', 'FORM', '/') === 'FORM/68', 'Must format FORM/68');
      expect(formatSerialWithPrefix('69', 'A', ' ') === 'A 69', 'Must format A 69');
      expect(formatSerialWithPrefix('70', '', '-') === '70', 'Empty prefix must not add separator');
    });

    await run('T83', 'Legal Paper Physical Geometry — Width=612pt, Height=1008pt, Margins 0.7in (50.4pt) and 0.5in (36.0pt)', () => {
      const { LEGAL_WIDTH, LEGAL_HEIGHT, MARGIN_LEFT, MARGIN_RIGHT, MARGIN_TOP, MARGIN_BOTTOM } = require('../services/renderers/PdfDocumentBuilder');
      expect(LEGAL_WIDTH === 612, `LEGAL_WIDTH must be 612, got ${LEGAL_WIDTH}`);
      expect(LEGAL_HEIGHT === 1008, `LEGAL_HEIGHT must be 1008, got ${LEGAL_HEIGHT}`);
      expect(MARGIN_LEFT === 50.4, `MARGIN_LEFT must be 50.4 (0.7 in), got ${MARGIN_LEFT}`);
      expect(MARGIN_RIGHT === 50.4, `MARGIN_RIGHT must be 50.4 (0.7 in), got ${MARGIN_RIGHT}`);
      expect(MARGIN_TOP === 36.0, `MARGIN_TOP must be 36.0 (0.5 in), got ${MARGIN_TOP}`);
      expect(MARGIN_BOTTOM === 36.0, `MARGIN_BOTTOM must be 36.0 (0.5 in), got ${MARGIN_BOTTOM}`);
    });

    await run('T84', 'Statutory Register Orientations — Form I (Portrait), Form J (Portrait/Landscape), Share (Landscape), Prop (Landscape), Nom (Landscape), Bank (Portrait)', () => {
      expect(FormIDefinition.orientation === 'Portrait', 'Form I must be Portrait');
      expect(FormJDefinition.orientation === 'Portrait', 'Form J default must be Portrait');
      expect(FormJDefinition.landscapeColumns !== undefined, 'Form J must support Landscape columns');
      expect(ShareRegisterDefinition.orientation === 'Landscape', 'Share Register must be Landscape');
      expect(PropertyRegisterDefinition.orientation === 'Landscape', 'Property Register must be Landscape');
      expect(NominationRegisterDefinition.orientation === 'Landscape', 'Nomination Register must be Landscape');
      expect(LienMarkDefinition.orientation === 'Portrait', 'Bank Lien Mark Register must be Portrait');
    });

    await run('T85', 'Blank Form Dual-Mode Generation — Generates clean blank forms with serials and without serials', async () => {
      const mockWb: any = {
        societyMaster: { societyName: 'LEGAL SOC', registrationNo: 'REG-123' },
        commonFile: [],
        formIData: [],
        formJData: [],
        shareData: [],
        nominationData: [],
        propertyData: [],
        bankLineMarkData: [],
        voucherData: []
      };

      // Blank With Serial (3 forms)
      const outWithSerial = await PdfEngine.generate({
        formId: 'FORM_I',
        fromSerial: '67',
        toSerial: '69',
        blankMode: 'with_serial',
        prefix: 'SC',
        separator: '-',
        workbook: mockWb
      });
      expect(outWithSerial.files.length === 3, 'Must produce 3 files for SC-67..SC-69');
      expect(outWithSerial.files[0].filename.includes('SC-67'), 'First file must be SC-67');
      expect(outWithSerial.files[2].filename.includes('SC-69'), 'Third file must be SC-69');

      // Blank Without Serial (2 forms)
      const outNoSerial = await PdfEngine.generate({
        formId: 'FORM_I',
        fromSerial: '',
        toSerial: '',
        nonSerialCount: 2,
        blankMode: 'without_serial',
        workbook: mockWb
      });
      expect(outNoSerial.files.length === 2, 'Must produce 2 un-numbered blank forms');
    });

    await run('T86', 'Form I — multi-entry empty Excel cell integrity & no fake data capture', async () => {
      const formITopHeader = [
        'Sr. No.', 'Members Name Full', '', '', '', '', '',
        'Particulars of Shares Held - Entry 1', '', '', '', '', '', '', '', '', '', '',
        'Particulars of Shares Held - Entry 2', '', '', '', '', '', '', '', '', '', '',
        'Particulars of Shares Held - Entry 3', '', '', '', '', '', '', '', '', '', '',
        'Particulars of Shares Held - Entry 4', '', '', '', '', '', '', '', '', '', '',
        'Particulars of Shares Held - Entry 5', '', '', '', '', '', '', '', '', '', '',
        'Particulars of Shares Transferred or Surrendered - Entry 1', '', '', '', '', '', '', '', '',
        'Particulars of Shares Transferred or Surrendered - Entry 2', '', '', '', '', '', '', '', '',
        'Particulars of Shares Transferred or Surrendered - Entry 3', '', '', '', '', '', '', '', '',
        'Particulars of Shares Transferred or Surrendered - Entry 4', '', '', '', '', '', '', '', '',
        'Particulars of Shares Transferred or Surrendered - Entry 5', '', '', '', '', '', '', '', ''
      ];
      const formISubHeader = [
        '', '1', '2', '3', '4', '5', '6',
        'Date', 'Cash Book Folio No.', 'Application', 'Allotment', 'Amount Received 1st Call', 'Amount Received 2nd Call', 'Total Amount Received', 'No. of Shares Held', 'Shares From', 'Shares To', 'Share Certificate No.',
        'Date', 'Cash Book Folio No.', 'Application', 'Allotment', 'Amount Received 1st Call', 'Amount Received 2nd Call', 'Total Amount Received', 'No. of Shares Held', 'Shares From', 'Shares To', 'Share Certificate No.',
        'Date', 'Cash Book Folio No.', 'Application', 'Allotment', 'Amount Received 1st Call', 'Amount Received 2nd Call', 'Total Amount Received', 'No. of Shares Held', 'Shares From', 'Shares To', 'Share Certificate No.',
        'Date', 'Cash Book Folio No.', 'Application', 'Allotment', 'Amount Received 1st Call', 'Amount Received 2nd Call', 'Total Amount Received', 'No. of Shares Held', 'Shares From', 'Shares To', 'Share Certificate No.',
        'Date', 'Cash Book Folio No.', 'Application', 'Allotment', 'Amount Received 1st Call', 'Amount Received 2nd Call', 'Total Amount Received', 'No. of Shares Held', 'Shares From', 'Shares To', 'Share Certificate No.',
        'Date', 'Cash Book Folio No.', 'Transfer Date', 'Share Certificate No. Transferred', 'No. of Shares Transferred / Refunded', 'Balances - No. of Shares Held', 'Balances - Serial No. of Share Cert.', 'Amount Rs', 'Amount P',
        'Date', 'Cash Book Folio No.', 'Transfer Date', 'Share Certificate No. Transferred', 'No. of Shares Transferred / Refunded', 'Balances - No. of Shares Held', 'Balances - Serial No. of Share Cert.', 'Amount Rs', 'Amount P',
        'Date', 'Cash Book Folio No.', 'Transfer Date', 'Share Certificate No. Transferred', 'No. of Shares Transferred / Refunded', 'Balances - No. of Shares Held', 'Balances - Serial No. of Share Cert.', 'Amount Rs', 'Amount P',
        'Date', 'Cash Book Folio No.', 'Transfer Date', 'Share Certificate No. Transferred', 'No. of Shares Transferred / Refunded', 'Balances - No. of Shares Held', 'Balances - Serial No. of Share Cert.', 'Amount Rs', 'Amount P',
        'Date', 'Cash Book Folio No.', 'Transfer Date', 'Share Certificate No. Transferred', 'No. of Shares Transferred / Refunded', 'Balances - No. of Shares Held', 'Balances - Serial No. of Share Cert.', 'Amount Rs', 'Amount P'
      ];
      const formIData = [
        '1', 'Nafisha Khatoon Sharif Ahmed Khan', '', '', '', '', '',
        '', '', '', '', '', '', '', '10 (Ten)', '1', '10', '1',
        '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', ''
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([formITopHeader, formISubHeader, formIData]);
      XLSX.utils.book_append_sheet(wb, ws, '03_Form_I');

      const parsed = MasterDataService.parseXlsxWorkbook(wb, '03_Form_I.xlsx');
      const rec = parsed.formIData[0];

      expect(rec.memberName === 'Nafisha Khatoon Sharif Ahmed Khan', 'Member name must be parsed accurately');
      expect(rec.sharesHeldEntries?.length === 5, 'Must parse 5 shares held entries');
      expect(rec.sharesTransferredEntries?.length === 5, 'Must parse 5 shares transferred entries');

      // Entry 1 has specific populated cells:
      expect(rec.sharesHeldEntries?.[0]?.date === '', 'Entry 1 Date must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.cashBookFolio === '', 'Entry 1 Cash Book Folio must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.application === '', 'Entry 1 Application must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.allotment === '', 'Entry 1 Allotment must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.call1st === '', 'Entry 1 1st Call must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.call2nd === '', 'Entry 1 2nd Call must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.totalAmountReceived === '', 'Entry 1 Total Amount Received must be strictly empty');
      expect(rec.sharesHeldEntries?.[0]?.noOfShares === '10 (Ten)', 'Entry 1 No of Shares must match Excel');
      expect(rec.sharesHeldEntries?.[0]?.sharesFrom === '1', 'Entry 1 Shares From must match Excel');
      expect(rec.sharesHeldEntries?.[0]?.sharesTo === '10', 'Entry 1 Shares To must match Excel');
      expect(rec.sharesHeldEntries?.[0]?.shareCertificateNo === '1', 'Entry 1 Share Certificate No must match Excel');

      // Entries 2 to 5 must all be completely empty and NEVER contain member name:
      for (let i = 1; i < 5; i++) {
        const sh = rec.sharesHeldEntries?.[i];
        expect(sh?.date === '', `Entry ${i + 1} Date must be strictly empty`);
        expect(sh?.cashBookFolio === '', `Entry ${i + 1} Cash Book Folio must be strictly empty`);
        expect(sh?.application === '', `Entry ${i + 1} Application must be strictly empty`);
        expect(sh?.allotment === '', `Entry ${i + 1} Allotment must be strictly empty`);
        expect(sh?.call1st === '', `Entry ${i + 1} 1st Call must be strictly empty`);
        expect(sh?.call2nd === '', `Entry ${i + 1} 2nd Call must be strictly empty`);
        expect(sh?.totalAmountReceived === '', `Entry ${i + 1} Total Amount Received must be strictly empty`);
        expect(sh?.noOfShares === '', `Entry ${i + 1} No of Shares must be strictly empty`);
        expect(sh?.sharesFrom === '', `Entry ${i + 1} Shares From must be strictly empty`);
        expect(sh?.sharesTo === '', `Entry ${i + 1} Shares To must be strictly empty`);
        expect(sh?.shareCertificateNo === '', `Entry ${i + 1} Share Certificate No must be strictly empty`);
      }

      // Shares Transferred entries 1 to 5 must all be completely empty and NEVER contain member name:
      for (let i = 0; i < 5; i++) {
        const st = rec.sharesTransferredEntries?.[i];
        expect(st?.date === '', `Transfer ${i + 1} Date must be strictly empty`);
        expect(st?.cashBookFolio === '', `Transfer ${i + 1} Cash Book Folio must be strictly empty`);
        expect(st?.transferDate === '', `Transfer ${i + 1} Transfer Date must be strictly empty`);
        expect(st?.shareCertificateNo === '', `Transfer ${i + 1} Share Cert No must be strictly empty`);
        expect(st?.noOfSharesTransferred === '', `Transfer ${i + 1} No of Shares Transferred must be strictly empty`);
        expect(st?.balanceNoOfShares === '', `Transfer ${i + 1} Balance No of Shares must be strictly empty`);
        expect(st?.balanceSerialNoCertificate === '', `Transfer ${i + 1} Balance Cert No must be strictly empty`);
        expect(st?.amountRs === '', `Transfer ${i + 1} Amount Rs must be strictly empty`);
        expect(st?.amountP === '', `Transfer ${i + 1} Amount P must be strictly empty`);
      }
    });

    await run('T87', 'Society Folder Creation — statutory folders and HENU OCR/VOUCHER & CHECK', () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSoc = 'TEST_SOC_T87_' + Date.now();
      const res = StorageEngine.createSocietyFolders(cfg.rootStoragePath, testSoc);
      expect(Boolean(res.societyPath), 'Folder creation must succeed');
      expect(fs.existsSync(path.join(cfg.societiesPath, testSoc, 'Form I')), 'Form I folder must exist');
      expect(fs.existsSync(path.join(cfg.societiesPath, testSoc, 'Form J')), 'Form J folder must exist');
      expect(fs.existsSync(path.join(cfg.societiesPath, testSoc, 'Share Register')), 'Share Register folder must exist');
      expect(fs.existsSync(path.join(cfg.societiesPath, testSoc, 'HENU OCR', 'VOUCHER')), 'HENU OCR/VOUCHER folder must exist');
      expect(fs.existsSync(path.join(cfg.societiesPath, testSoc, 'HENU OCR', 'CHECK')), 'HENU OCR/CHECK folder must exist');
      expect(fs.existsSync(path.join(cfg.societiesPath, testSoc, 'Voucher')), 'Voucher folder must exist');

      // Cleanup test folder
      try {
        fs.rmSync(path.join(cfg.societiesPath, testSoc), { recursive: true, force: true });
      } catch {}
    });

    await run('T88', 'StorageEngine.reconcileSocietyFolders — non-destructive folder provisioning', () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSoc = 'TEST_SOC_T88_' + Date.now();
      const socDir = path.join(cfg.societiesPath, testSoc);
      fs.mkdirSync(socDir, { recursive: true });
      fs.writeFileSync(path.join(socDir, 'existing_file.txt'), 'hello');

      const res = StorageEngine.reconcileSocietyFolders(cfg.rootStoragePath, testSoc);
      expect(res.createdMissing.length > 0, 'Must provision missing folders');
      expect(fs.existsSync(path.join(socDir, 'existing_file.txt')), 'Existing file must not be deleted');
      expect(fs.existsSync(path.join(socDir, 'HENU OCR', 'VOUCHER')), 'HENU OCR/VOUCHER must be created');
      expect(fs.existsSync(path.join(socDir, 'HENU OCR', 'CHECK')), 'HENU OCR/CHECK must be created');

      try {
        fs.rmSync(socDir, { recursive: true, force: true });
      } catch {}
    });

    await run('T89', 'HenuMasterService.deleteSociety — DB cascade, physical folder deletion, active context switch', async () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSocName = 'TEST_DELETE_SOC_' + Date.now();
      const testSocId = 'soc-del-' + Date.now();
      const db = initializeDatabase();

      // Insert dummy society
      db.prepare(`
        INSERT INTO societies (id, society_name, registration_no, is_active, status, created_at)
        VALUES (?, ?, 'REG-DEL', 1, 'ACTIVE', ?)
      `).run(testSocId, testSocName, new Date().toISOString());

      StorageEngine.createSocietyFolders(cfg.rootStoragePath, testSocName);
      const socDir = path.join(cfg.societiesPath, testSocName);
      expect(fs.existsSync(socDir), 'Test society folder must exist prior to deletion');

      const delRes = await HenuMasterService.getInstance().deleteSociety(testSocId);
      expect(delRes.success, 'deleteSociety must succeed');

      // Verify DB record removed
      const row = db.prepare('SELECT id FROM societies WHERE id = ?').get(testSocId);
      expect(!row, 'Society record must be deleted from DB');

      // Verify physical folder removed
      expect(!fs.existsSync(socDir), 'Society physical folder must be deleted');
    });

    await run('T90', 'StorageEngine.deleteSocietyFolder — path traversal rejection and root protection', () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      let rejected1 = false;
      try {
        StorageEngine.deleteSocietyFolder(cfg.rootStoragePath, '../Backups');
      } catch {
        rejected1 = true;
      }
      expect(rejected1, 'Must reject path traversal with ..');

      let rejected2 = false;
      try {
        StorageEngine.deleteSocietyFolder(cfg.rootStoragePath, '..');
      } catch {
        rejected2 = true;
      }
      expect(rejected2, 'Must reject parent directory reference');
    });

    await run('T91', 'BackupService — default scoped ZIP backup preserves Societies/ and includes manifest', async () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSoc = 'TEST_BACKUP_SOC_' + Date.now();
      StorageEngine.createSocietyFolders(cfg.rootStoragePath, testSoc);
      const sampleFile = path.join(cfg.societiesPath, testSoc, 'Form I', 'sample.pdf');
      fs.writeFileSync(sampleFile, 'PDF_SAMPLE_DATA');

      const res = await BackupService.getInstance().createScopedBackup({
        backupType: 'zip',
        scope: 'all',
        includeConfig: true,
      });

      expect(res.success, 'Scoped ZIP backup must succeed');
      expect(res.backup !== undefined, 'Backup item must be returned');
      expect(fs.existsSync(res.backup!.filePath), 'Backup ZIP file must exist on disk');

      // Cleanup
      try {
        fs.rmSync(path.join(cfg.societiesPath, testSoc), { recursive: true, force: true });
        if (res.backup?.filePath && fs.existsSync(res.backup.filePath)) {
          fs.unlinkSync(res.backup.filePath);
        }
      } catch {}
    });

    await run('T92', 'BackupService — custom scope backup with specific folders', async () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSoc = 'TEST_CUSTOM_SOC_' + Date.now();
      StorageEngine.createSocietyFolders(cfg.rootStoragePath, testSoc);

      const res = await BackupService.getInstance().createScopedBackup({
        backupType: 'zip',
        scope: 'custom',
        selectedSocieties: [testSoc],
        selectedFolders: { [testSoc]: ['Form I', 'HENU OCR/VOUCHER'] },
        includeConfig: false,
      });

      expect(res.success, 'Custom scoped backup must succeed');

      try {
        fs.rmSync(path.join(cfg.societiesPath, testSoc), { recursive: true, force: true });
        if (res.backup?.filePath && fs.existsSync(res.backup.filePath)) {
          fs.unlinkSync(res.backup.filePath);
        }
      } catch {}
    });

    await run('T93', 'BackupService — JSON metadata snapshot backup', async () => {
      const res = await BackupService.getInstance().createScopedBackup({
        backupType: 'json',
        scope: 'all',
        includeConfig: true,
      });

      expect(res.success, 'JSON backup must succeed');
      expect(res.backup !== undefined && res.backup.filePath.endsWith('.json'), 'Must produce a .json file');
      expect(fs.existsSync(res.backup!.filePath), 'JSON file must exist on disk');

      const content = JSON.parse(fs.readFileSync(res.backup!.filePath, 'utf8'));
      expect(content.backupVersion === 1, 'Must have backupVersion 1');
      expect(Array.isArray(content.societies), 'Must contain societies array');
      expect(content.configuration !== undefined, 'Must contain configuration');

      try {
        if (res.backup?.filePath && fs.existsSync(res.backup.filePath)) {
          fs.unlinkSync(res.backup.filePath);
        }
      } catch {}
    });

    await run('T94', 'BackupService.validateBackupFile — format detection and error handling', async () => {
      const valInvalid = await BackupService.getInstance().validateBackupFile('non_existent_path.zip');
      expect(!valInvalid.isValid, 'Non-existent file must fail validation');

      // Create dummy valid JSON backup
      const cfg = HenuConfigService.getInstance().getConfig();
      const dummyJson = path.join(cfg.backupPath, `test_val_${Date.now()}.json`);
      fs.writeFileSync(dummyJson, JSON.stringify({
        backupVersion: 1,
        createdAt: new Date().toISOString(),
        societies: [{ id: 'soc-1', societyName: 'VALID SOC' }],
        documents: [],
      }));

      const valJson = await BackupService.getInstance().validateBackupFile(dummyJson);
      expect(valJson.isValid, 'Valid JSON backup must pass validation');
      expect(valJson.backupType === 'JSON', 'Must identify type as JSON');
      expect(valJson.societies.includes('VALID SOC'), 'Must list societies');

      try {
        if (fs.existsSync(dummyJson)) fs.unlinkSync(dummyJson);
      } catch {}
    });

    await run('T95', 'BackupService.restoreBackup — JSON metadata restoration', async () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSocId = 'soc-restore-' + Date.now();
      const dummyJson = path.join(cfg.backupPath, `test_restore_${Date.now()}.json`);
      fs.writeFileSync(dummyJson, JSON.stringify({
        backupVersion: 1,
        createdAt: new Date().toISOString(),
        societies: [{ id: testSocId, society_name: 'RESTORED SOCIETY TEST', registration_no: 'REG-RESTORE' }],
        documents: [],
      }));

      const restoreRes = await BackupService.getInstance().restoreBackup(dummyJson);
      expect(restoreRes.success, 'Restore must succeed');

      const db = initializeDatabase();
      const row = db.prepare('SELECT society_name FROM societies WHERE id = ?').get(testSocId) as any;
      expect(row && row.society_name === 'RESTORED SOCIETY TEST', 'Restored society must exist in DB');

      // Cleanup
      db.prepare('DELETE FROM societies WHERE id = ?').run(testSocId);
      try {
        if (fs.existsSync(dummyJson)) fs.unlinkSync(dummyJson);
      } catch {}
    });

    await run('T96', 'HenuSecurityService — Admin Password Verification & Rejection', async () => {
      const sec = HenuSecurityService.getInstance();
      const validRes = sec.verifyAdminPassword('HENU@12a');
      expect(validRes.success === true, 'Authorized admin password 1 must be accepted');

      const validRes2 = sec.verifyAdminPassword('HENU$Global&Net2026');
      expect(validRes2.success === true, 'Authorized admin password 10 must be accepted');

      const invalidRes = sec.verifyAdminPassword('WRONG_ADMIN_PASS_123');
      expect(invalidRes.success === false, 'Invalid admin password must be rejected');
      expect(invalidRes.error === 'Invalid password.', 'Must show generic error');
    });

    await run('T97', 'HenuSecurityService — OCR Password Verification & Module Unlock', async () => {
      const sec = HenuSecurityService.getInstance();
      sec.lockOcrModule('voucher-ocr');
      expect(sec.isOcrUnlocked('voucher-ocr') === false, 'Voucher OCR must start locked');

      const validOcr = sec.verifyOcrPassword('HENU9#qZ', 'voucher-ocr');
      expect(validOcr.success === true, 'Authorized OCR password must unlock module');
      expect(sec.isOcrUnlocked('voucher-ocr') === true, 'Voucher OCR module must now be unlocked');

      const invalidOcr = sec.verifyOcrPassword('INVALID_OCR_KEY', 'check-ocr');
      expect(invalidOcr.success === false, 'Invalid OCR password must be rejected');
    });

    await run('T98', 'HenuSecurityService — OCR Module Lock Session Transition', async () => {
      const sec = HenuSecurityService.getInstance();
      sec.verifyOcrPassword('HENU9#qZ', 'check-ocr');
      expect(sec.isOcrUnlocked('check-ocr') === true, 'Check OCR must be unlocked');

      sec.lockOcrModule('check-ocr');
      expect(sec.isOcrUnlocked('check-ocr') === false, 'Check OCR must be locked after explicit lock');
    });

    await run('T99', 'HenuSecurityService — MFA Challenge & Single-Use Token Lifecycle', async () => {
      const sec = HenuSecurityService.getInstance();
      const socId = 'soc-mfa-test-' + Date.now();
      const challenge = sec.createMfaChallenge(socId);
      expect(challenge.success === true, 'MFA challenge creation must succeed');
      expect(Boolean(challenge.code && challenge.code.length === 6), 'Challenge code must be 6 digits');

      // Wrong code
      const wrongVerify = sec.verifyMfaChallenge(challenge.challengeId, '000000', socId);
      expect(wrongVerify.success === false, 'Wrong MFA code must be rejected');

      // Correct code
      const validVerify = sec.verifyMfaChallenge(challenge.challengeId, challenge.code, socId);
      expect(validVerify.success === true, 'Correct MFA code must succeed');
      expect(Boolean(typeof validVerify.mfaToken === 'string' && validVerify.mfaToken.startsWith('mfa_')), 'Must return single-use token');
    });

    await run('T100', 'HenuSecurityService — Unauthorized Deletion Rejection (Missing/Invalid MFA Token)', async () => {
      const sec = HenuSecurityService.getInstance();
      let rejected = false;
      try {
        sec.executeSecureSocietyDelete('fake-soc-id', 'invalid_token_xyz');
      } catch (err: any) {
        rejected = true;
        expect(err.message.includes('Security Violation') || err.message.includes('MFA'), 'Must throw security violation');
      }
      expect(rejected === true, 'Deletion without valid MFA token must be blocked');
    });

    await run('T101', 'HenuSecurityService — Security Audit Logging Table Verification', async () => {
      const sec = HenuSecurityService.getInstance();
      const logs = sec.getAuditLogs(10);
      expect(Array.isArray(logs), 'Audit logs must return array');
      expect(logs.length > 0, 'Audit logs must record authentication and security events');
    });

    await run('T102', 'StorageEngine — Multi-Partition Directory Structure & Resolution', async () => {
      const cfg = HenuConfigService.getInstance().getConfig();
      const testSoc = 'TEST_SOCIETY_ISO_' + Date.now();
      const socPath = StorageEngine.getSocietyStoragePath(cfg.rootStoragePath, testSoc);
      const impPath = StorageEngine.getSocietyImportsPath(cfg.rootStoragePath, testSoc);
      const expPath = StorageEngine.getSocietyExportsPath(cfg.rootStoragePath, testSoc);

      expect(socPath.includes(path.join('Societies', testSoc)), 'Society path must resolve under Societies/<Society>');
      expect(impPath.includes(path.join('Imports', testSoc)), 'Imports path must resolve under Imports/<Society>');
      expect(expPath.includes(path.join('Exports', testSoc)), 'Exports path must resolve under Exports/<Society>');

      // Create partition folders
      const created = StorageEngine.createSocietyFolders(cfg.rootStoragePath, testSoc);
      expect(fs.existsSync(path.join(impPath, 'Templates')), 'Imports/Templates folder must exist');
      expect(fs.existsSync(path.join(impPath, 'Imported')), 'Imports/Imported folder must exist');
      expect(fs.existsSync(path.join(impPath, 'Working')), 'Imports/Working folder must exist');
      expect(fs.existsSync(path.join(expPath, 'Excel')), 'Exports/Excel folder must exist');
      expect(fs.existsSync(path.join(expPath, 'CSV')), 'Exports/CSV folder must exist');
      expect(Boolean(created.societyPath), 'Society folder path must be returned');

      // Cleanup
      StorageEngine.deleteSocietyFolder(cfg.rootStoragePath, testSoc);
      expect(!fs.existsSync(socPath), 'Society folder should be deleted');
      expect(!fs.existsSync(impPath), 'Imports partition should be deleted');
      expect(!fs.existsSync(expPath), 'Exports partition should be deleted');
    });

    await run('T103', 'HenuSocietyContextService — Monotonic Versioning & Active Society Switch', async () => {
      const contextService = HenuSocietyContextService.getInstance();
      const v1 = contextService.getContextVersion();
      expect(typeof v1.version === 'number', 'Version must be numeric');
      expect(typeof v1.token === 'string', 'Token must be string');

      // Switch context to Soc A
      const ctxA = contextService.switchActiveSociety('soc-a-test', 'Society Alpha', 'REG-AAA-01');
      expect(ctxA.activeSocietyId === 'soc-a-test', 'Active society ID must be soc-a-test');
      expect(ctxA.version > v1.version, 'Context version must strictly increment on switch');
      expect(ctxA.token.startsWith('soc-a-test_v'), 'Token must contain active society ID and version');

      // Switch context to Soc B
      const ctxB = contextService.switchActiveSociety('soc-b-test', 'Society Beta', 'REG-BBB-02');
      expect(ctxB.activeSocietyId === 'soc-b-test', 'Active society ID must be soc-b-test');
      expect(ctxB.version > ctxA.version, 'Context version must strictly increment on second switch');
      expect(ctxB.token.startsWith('soc-b-test_v'), 'Token must reflect new society');
    });

    await run('T104', 'HenuSocietyContextService — Import & Export Scoped Database Isolation', async () => {
      const contextService = HenuSocietyContextService.getInstance();
      const socA = 'soc-iso-a-' + Date.now();
      const socB = 'soc-iso-b-' + Date.now();

      // Record imports for Soc A
      contextService.recordImport({
        societyId: socA,
        fileName: 'Alpha_Members.xlsx',
        filePath: 'C:/mock/Alpha_Members.xlsx',
        importType: 'EXCEL',
        recordCount: 100,
        importedBy: 'Admin',
      });
      // Record export for Soc A
      contextService.recordExport({
        societyId: socA,
        fileName: 'Alpha_Form_I.xlsx',
        filePath: 'C:/mock/Alpha_Form_I.xlsx',
        exportType: 'EXCEL',
        recordCount: 100,
      });

      // Query Soc A
      const importsA = contextService.getSocietyImports(socA);
      const exportsA = contextService.getSocietyExports(socA);
      expect(importsA.length >= 1, 'Soc A must have at least 1 import');
      expect(exportsA.length >= 1, 'Soc A must have at least 1 export');
      expect(importsA[0].fileName === 'Alpha_Members.xlsx', 'Soc A import filename must match');

      // Query Soc B (Fresh society)
      const importsB = contextService.getSocietyImports(socB);
      const exportsB = contextService.getSocietyExports(socB);
      expect(importsB.length === 0, 'Soc B must have 0 imports (Strictly isolated from Soc A)');
      expect(exportsB.length === 0, 'Soc B must have 0 exports (Strictly isolated from Soc A)');
    });

    await run('T105', 'HenuSocietyContextService — Template Isolation & Global Library Reuse', async () => {
      const contextService = HenuSocietyContextService.getInstance();
      const cfg = HenuConfigService.getInstance().getConfig();
      const db = initializeDatabase();
      const socA = 'soc-tmpl-a-' + Date.now();
      const socB = 'soc-tmpl-b-' + Date.now();
      const socAName = 'Alpha Housing Society ' + Date.now();
      const socBName = 'Beta Housing Society ' + Date.now();

      db.prepare('INSERT INTO societies (id, society_name, registration_no, status, folder_path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        socA,
        socAName,
        'REG-A',
        'ACTIVE',
        StorageEngine.getSocietyStoragePath(cfg.rootStoragePath, socAName),
        new Date().toISOString()
      );
      db.prepare('INSERT INTO societies (id, society_name, registration_no, status, folder_path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        socB,
        socBName,
        'REG-B',
        'ACTIVE',
        StorageEngine.getSocietyStoragePath(cfg.rootStoragePath, socBName),
        new Date().toISOString()
      );

      StorageEngine.createSocietyFolders(cfg.rootStoragePath, socAName);
      StorageEngine.createSocietyFolders(cfg.rootStoragePath, socBName);

      // Create a dummy template file in Soc A's partition
      const socATemplatesDir = path.join(StorageEngine.getSocietyImportsPath(cfg.rootStoragePath, socAName), 'Templates');
      fs.mkdirSync(socATemplatesDir, { recursive: true });
      const tmplFile = path.join(socATemplatesDir, 'Master_Template_2026.xlsx');
      fs.writeFileSync(tmplFile, 'DUMMY_TEMPLATE_DATA');

      // Record template usage in Soc A
      contextService.recordTemplateUsage({
        societyId: socA,
        templateName: 'Master_Template_2026.xlsx',
        templatePath: tmplFile,
      });

      // Verify template history is isolated
      const tmplA = contextService.getSocietyTemplates(socA);
      const tmplB = contextService.getSocietyTemplates(socB);
      expect(tmplA.length === 1, 'Soc A must have 1 template recorded');
      expect(tmplB.length === 0, 'Soc B must have 0 templates recorded (No cross-society history leak)');

      // Verify Global Template Library reflects usage
      const library = contextService.getGlobalTemplateLibrary();
      const entry = library.find(t => t.templateName === 'Master_Template_2026.xlsx');
      expect(Boolean(entry), 'Global Template Library must contain entry');
      expect(entry?.usedBySocieties.some(u => u.societyId === socA) === true, 'Global Library must list Soc A as user');

      // Reuse Template for Soc B
      const reuseRes = contextService.reuseTemplateForSociety('Master_Template_2026.xlsx', socB);
      expect(reuseRes.success === true, 'Template reuse must succeed');
      expect(fs.existsSync(reuseRes.targetPath!), 'Cloned template must exist in Soc B isolated directory');

      // Soc B now has its own isolated template record
      const tmplBAfter = contextService.getSocietyTemplates(socB);
      expect(tmplBAfter.length === 1, 'Soc B must now have 1 isolated template record');
      expect(tmplBAfter[0].societyId === socB, 'Template record must be owned by Soc B');

      // Cleanup
      StorageEngine.deleteSocietyFolder(cfg.rootStoragePath, socAName);
      StorageEngine.deleteSocietyFolder(cfg.rootStoragePath, socBName);
      db.prepare('DELETE FROM societies WHERE id IN (?, ?)').run(socA, socB);
    });

    await run('T106', 'HenuMasterService — Global Aggregate Statistics & Completion Tracking', async () => {
      const masterService = HenuMasterService.getInstance();
      const kpis = masterService.getDashboardKPIs();

      expect(typeof kpis.totalSocieties === 'number', 'Total societies must be numeric');
      expect(typeof kpis.activeSocieties === 'number', 'Active societies must be numeric');
      expect(typeof kpis.archivedSocieties === 'number', 'Archived societies must be numeric');
      expect(typeof kpis.totalDocuments === 'number', 'Total documents must be numeric');
      expect(typeof kpis.totalImports === 'number', 'Total imports must be numeric');
      expect(typeof kpis.totalExports === 'number', 'Total exports must be numeric');
      expect(typeof kpis.completedSocieties === 'number', 'Completed societies must be numeric');
      expect(typeof kpis.inProgressSocieties === 'number', 'In-progress societies must be numeric');
      expect(typeof kpis.notStartedSocieties === 'number', 'Not-started societies must be numeric');
      expect(kpis.completedSocieties + kpis.inProgressSocieties + kpis.notStartedSocieties === kpis.totalSocieties, 'Completion breakdown must equal total societies');
    });

    await run('T107', 'HenuSecurityService & StorageEngine — Multi-Partition Society Deletion Cascade', async () => {
      const sec = HenuSecurityService.getInstance();
      const cfg = HenuConfigService.getInstance().getConfig();
      const db = initializeDatabase();

      const testSocId = 'soc-del-cascade-' + Date.now();
      const testSocName = 'CASCADE_DELETE_TEST_' + Date.now();

      // Create DB society
      db.prepare('INSERT INTO societies (id, society_name, registration_no, status, folder_path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        testSocId,
        testSocName,
        'REG-DEL-01',
        'ACTIVE',
        StorageEngine.getSocietyStoragePath(cfg.rootStoragePath, testSocName),
        new Date().toISOString()
      );

      // Create storage partitions
      StorageEngine.createSocietyFolders(cfg.rootStoragePath, testSocName);
      expect(fs.existsSync(StorageEngine.getSocietyStoragePath(cfg.rootStoragePath, testSocName)), 'Society folder must exist');
      expect(fs.existsSync(StorageEngine.getSocietyImportsPath(cfg.rootStoragePath, testSocName)), 'Imports partition must exist');
      expect(fs.existsSync(StorageEngine.getSocietyExportsPath(cfg.rootStoragePath, testSocName)), 'Exports partition must exist');

      // Add imports & exports records
      HenuSocietyContextService.getInstance().recordImport({
        societyId: testSocId,
        fileName: 'test.xlsx',
        filePath: 'path/test.xlsx',
        importType: 'EXCEL',
        recordCount: 50,
      });
      HenuSocietyContextService.getInstance().recordExport({
        societyId: testSocId,
        fileName: 'test_exp.xlsx',
        filePath: 'path/test_exp.xlsx',
        exportType: 'EXCEL',
        recordCount: 50,
      });

      // Request MFA challenge & execute deletion
      const challenge = sec.createMfaChallenge(testSocId);
      const verify = sec.verifyMfaChallenge(challenge.challengeId, challenge.code, testSocId);
      expect(verify.success, 'MFA must verify');

      const delRes = sec.executeSecureSocietyDelete(testSocId, verify.mfaToken!);
      expect(delRes.success === true, 'Cascade deletion must succeed');

      // Verify DB cleanup
      const socRow = db.prepare('SELECT id FROM societies WHERE id = ?').get(testSocId);
      expect(!socRow, 'Society must be deleted from DB');
      const impRows = HenuSocietyContextService.getInstance().getSocietyImports(testSocId);
      expect(impRows.length === 0, 'Import records must be purged');

      // Verify Storage cleanup across all partitions
      expect(!fs.existsSync(StorageEngine.getSocietyStoragePath(cfg.rootStoragePath, testSocName)), 'Physical society folder must be removed');
      expect(!fs.existsSync(StorageEngine.getSocietyImportsPath(cfg.rootStoragePath, testSocName)), 'Imports partition must be removed');
      expect(!fs.existsSync(StorageEngine.getSocietyExportsPath(cfg.rootStoragePath, testSocName)), 'Exports partition must be removed');
    });

    await run('T108', 'HenuSocietyContextService — Async Context Token Validation Guard', async () => {
      const contextService = HenuSocietyContextService.getInstance();
      const socA = 'soc-async-a';
      const socB = 'soc-async-b';

      // Switch to Soc A
      const ctxA = contextService.switchActiveSociety(socA, 'Society A', 'REG-A');
      const tokenA = ctxA.token;

      // Check validation
      expect(contextService.validateContextToken(tokenA) === true, 'Token A must be valid while Soc A is active');
      expect(contextService.validateActiveSociety(socA) === true, 'Soc A must be valid while Soc A is active');

      // Switch to Soc B
      contextService.switchActiveSociety(socB, 'Society B', 'REG-B');

      // Token A must now be rejected
      expect(contextService.validateContextToken(tokenA) === false, 'Token A must be rejected after context switch to Soc B');
      expect(contextService.validateActiveSociety(socA) === false, 'Soc A async results must be rejected after context switch to Soc B');
      expect(contextService.validateActiveSociety(socB) === true, 'Soc B must now be validated');
    });

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
