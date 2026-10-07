// ============================================================
// MasterDataService — Excel import + template generation
// ============================================================
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
function getBasename(fp: string): string {
  const parts = fp.split(/[/\\]/);
  return parts[parts.length - 1] || fp;
}
import {
  MasterWorkbook,
  SocietyMaster,
  NormalizedMemberRecord,
  CommonFileRecord,
  FormIRecord,
  FormIShareHeldEntry,
  FormIShareTransferredEntry,
  FormJRecord,
  ShareRecord,
  NominationRecord,
  PropertyRecord,
  BankLineMarkRecord,
  VoucherRecord,
  ModuleId,
} from '../types';
import { FormMappingService } from './FormMappingService';
import { normalizeSerialKey } from './SerialRangeEngine';

// ── Helpers ──────────────────────────────────────────────────

/** Converts ExcelJS ArrayBuffer to Buffer in Node or Uint8Array in browser */
function toSafeBuffer(buf: any): Buffer {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(buf);
  }
  return new Uint8Array(buf) as unknown as Buffer;
}

/** Safe string: never returns null/undefined/"null"/"undefined"/"NaN" */
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s === 'null' || s === 'undefined' || s === 'NaN') return '';
  return s;
}

/** Safe number: returns null if not a real finite number */
function safeNum(val: unknown): number | null {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}

/** Preserves leading zeros in serial-like fields */
function preserveSerial(val: unknown): string {
  if (val === null || val === undefined) return '';
  // If XLSX gives us a number for "001", it's just 1 — use raw string from cell
  const s = String(val).trim();
  if (!s || s === '0' || s === 'null' || s === 'undefined') return '';
  return s;
}

/** Converts XLSX date serial or string to DD/MM/YYYY */
function excelDate(val: unknown): string {
  if (val === null || val === undefined || String(val).trim() === '') return '';

  // Already a string date
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return '';
    // Try to parse DD/MM/YYYY or D/M/YYYY
    const ddmm = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const m = ddmm.exec(s);
    if (m) {
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${d}/${mo}/${y}`;
    }
    // Try ISO
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) {
      return `${iso[3]}/${iso[2]}/${iso[1]}`;
    }
    // Numeric serial formatted as string (e.g. "46084")
    if (/^\d{4,5}(\.\d+)?$/.test(s)) {
      try {
        const date = XLSX.SSF.parse_date_code(parseFloat(s));
        if (date) {
          const d = String(date.d).padStart(2, '0');
          const mo = String(date.m).padStart(2, '0');
          const y = String(date.y);
          return `${d}/${mo}/${y}`;
        }
      } catch {}
    }
    return s;
  }

  // Numeric Excel serial
  if (typeof val === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        const d = String(date.d).padStart(2, '0');
        const mo = String(date.m).padStart(2, '0');
        const y = String(date.y);
        return `${d}/${mo}/${y}`;
      }
    } catch {}
  }

  return safeStr(val);
}

/** Get a sheet by exact or case-insensitive name */
function findSheet(wb: XLSX.WorkBook, names: string[]): XLSX.WorkSheet | null {
  for (const name of names) {
    // Exact
    if (wb.SheetNames.includes(name)) return wb.Sheets[name];
    // Case-insensitive
    const found = wb.SheetNames.find(s => s.trim().toLowerCase() === name.toLowerCase());
    if (found) return wb.Sheets[found];
  }
  return null;
}

/** Get rows from a sheet as plain objects, handling multi-tier header rows cleanly */
function getRows(sheet: XLSX.WorkSheet | null): Record<string, unknown>[] {
  if (!sheet) return [];
  try {
    const rawAoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (rawAoa.length === 0) return [];

    // Find the header row (containing 'Sr. No.' or 'Serial No' or 'Serial Number' or 'Voucher No')
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawAoa.length, 10); r++) {
      const rowArr = rawAoa[r] as unknown[];
      if (!Array.isArray(rowArr)) continue;
      const hasSr = rowArr.some(cell => {
        const s = String(cell || '').trim().toLowerCase();
        return s.includes('sr. no') || s.includes('sr no') || s.includes('serial no') || s.includes('serial number') || s.includes('sr_no') || s.includes('voucher no') || s.includes('voucher number') || s.includes('vch no');
      });
      if (hasSr) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const topHeader = (rawAoa[headerRowIdx] || []) as unknown[];
    const candidateSub = (headerRowIdx + 1 < rawAoa.length ? rawAoa[headerRowIdx + 1] : []) as unknown[];

    // Helper to detect visual column-numbering helper rows (e.g., 1, 2, 3, 4, 5... 17)
    const isHelperNumberingRow = (arr: unknown[]): boolean => {
      if (!Array.isArray(arr) || arr.length < 3) return false;
      let matchCount = 0;
      for (let c = 0; c < Math.min(arr.length, 12); c++) {
        const v = String(arr[c] || '').trim();
        if (v === String(c + 1)) matchCount++;
      }
      return matchCount >= 3;
    };

    // A row is a sub-header ONLY if it is not a data row and not a visual helper row.
    const isLikelyDataRow = (arr: unknown[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      const firstCell = String(arr[0] || '').trim();
      if (typeof arr[0] === 'number') return true;
      if (/^(vch|sr|m)?[-\s_]*\d+$/i.test(firstCell)) return true;
      return false;
    };

    const isSubHeader = candidateSub.length > 0 && !isLikelyDataRow(candidateSub) && !isHelperNumberingRow(candidateSub);
    const subHeader = isSubHeader ? candidateSub : [];

    // Determine column keys
    const colKeys: string[] = [];
    const maxCols = Math.max(topHeader.length, subHeader.length);
    let lastTop = '';

    for (let c = 0; c < maxCols; c++) {
      const topCell = String(topHeader[c] || '').trim();
      const subCell = String(subHeader[c] || '').trim();
      if (topCell) lastTop = topCell;

      if (topCell && subCell && topCell.toLowerCase() !== subCell.toLowerCase()) {
        colKeys.push(`${topCell} ${subCell}`);
      } else if (subCell && lastTop && lastTop.toLowerCase() !== subCell.toLowerCase()) {
        colKeys.push(`${lastTop} ${subCell}`);
      } else {
        colKeys.push(topCell || subCell || `Col_${c + 1}`);
      }
    }

    // Determine start of data rows
    let dataStartIdx = isSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;

    const records: Record<string, unknown>[] = [];
    for (let r = dataStartIdx; r < rawAoa.length; r++) {
      const rowArr = rawAoa[r] as unknown[];
      if (!Array.isArray(rowArr) || rowArr.length === 0) continue;
      if (isHelperNumberingRow(rowArr)) continue; // Skip visual helper numbering rows

      const obj: Record<string, unknown> = {};
      let hasAnyVal = false;
      for (let c = 0; c < maxCols; c++) {
        const val = rowArr[c];
        const key = colKeys[c] || `Col_${c + 1}`;
        obj[key] = val !== undefined ? val : '';

        // Also map topHeader key alone if present
        const topKey = String(topHeader[c] || '').trim();
        if (topKey && !obj[topKey]) obj[topKey] = val !== undefined ? val : '';
        // Also map subHeader key alone if present
        const subKey = String(subHeader[c] || '').trim();
        if (subKey && !obj[subKey]) obj[subKey] = val !== undefined ? val : '';

        if (val !== undefined && String(val).trim() !== '') hasAnyVal = true;
      }

      if (hasAnyVal) {
        records.push(obj);
      }
    }

    return records;
  } catch {
    return [];
  }
}

// ── Column name matchers (tolerant & semantic) ──────────────────────────

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function col(row: Record<string, unknown>, ...candidates: string[]): string {
  const keys = Object.keys(row);
  if (keys.length === 0) return '';

  const normKeys = keys.map(k => ({ orig: k, norm: normalizeHeader(k) }));

  // 1. Exact normalized match
  for (const cand of candidates) {
    const normCand = normalizeHeader(cand);
    const found = normKeys.find(k => k.norm === normCand);
    if (found && safeStr(row[found.orig]) !== '') return safeStr(row[found.orig]);
  }

  // 2. Substring match (skip very short strings unless explicit numeric candidate)
  for (const cand of candidates) {
    const normCand = normalizeHeader(cand);
    if (normCand.length < 2) continue;
    const found = normKeys.find(k => k.norm.includes(normCand) || normCand.includes(k.norm));
    if (found && safeStr(row[found.orig]) !== '') return safeStr(row[found.orig]);
  }

  return '';
}

function colDate(row: Record<string, unknown>, ...candidates: string[]): string {
  const val = col(row, ...candidates);
  return val ? excelDate(val) : '';
}

function colSerial(row: Record<string, unknown>, ...candidates: string[]): string {
  const serialCands = [
    ...candidates,
    'Sr. No.', 'sr. no.', 'Sr No', 'Serial No', 'Serial Number', 'sr_no', 'Serial',
    'Member Serial', 'S.No', 'S No', 'Sr.No.', 'SrNo', 'Serial_No', 'Serial_Number',
  ];
  const val = col(row, ...serialCands);
  return val ? preserveSerial(val) : '';
}

// ── Sheet parsers ─────────────────────────────────────────────

function parseSocietyMaster(sheet: XLSX.WorkSheet | null): SocietyMaster | null {
  if (!sheet) return null;

  const rawAoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (rawAoa.length === 0) return null;

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
  const getCellStr = (r: number, c: number): string => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (!cell) return '';
    if (cell.w && cell.w.trim()) return cell.w.trim();
    if (cell.v !== null && cell.v !== undefined) {
      const s = String(cell.v).trim();
      return (s === 'null' || s === 'undefined' || s === 'NaN') ? '' : s;
    }
    return '';
  };

  const kvMap = new Map<string, string>();

  const isHeaderWord = (s: string) => {
    const norm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm === 'field' || norm === 'value' || norm === 'srno' || norm === 'serialno' || (norm.startsWith('line') && norm.length <= 6);
  };

  // Strategy A: Key-Value vertical pair scan across columns
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const kStr = getCellStr(r, c);
      if (!kStr) continue;

      let vStr = getCellStr(r, c + 1);
      if ((!vStr || isHeaderWord(vStr)) && c + 2 <= range.e.c) {
        vStr = getCellStr(r, c + 2);
      }

      if (kStr && vStr && !isHeaderWord(vStr)) {
        const normK = kStr.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!kvMap.has(normK)) {
          kvMap.set(normK, vStr);
        }
      }
    }
  }

  // Strategy B: Horizontal tabular rows (Row 1 headers, Row 2 values)
  if (rawAoa.length >= 2) {
    const headerRow = (rawAoa[0] || []) as unknown[];
    const valRow = (rawAoa[1] || []) as unknown[];
    for (let c = 0; c < Math.max(headerRow.length, valRow.length); c++) {
      const kStr = String(headerRow[c] || '').trim();
      const vStr = String(valRow[c] || '').trim();
      if (kStr && vStr && !isHeaderWord(vStr)) {
        const normK = kStr.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!kvMap.has(normK)) {
          kvMap.set(normK, vStr);
        }
      }
    }
  }

  const findVal = (candidates: string[]): string => {
    for (const cand of candidates) {
      const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [k, v] of kvMap.entries()) {
        if (k === normCand || k.includes(normCand) || normCand.includes(k)) {
          if (v && v.trim() !== '' && !isHeaderWord(v)) {
            return v.trim();
          }
        }
      }
    }
    return '';
  };

  const societyName = findVal([
    'societyregistrationname', 'societyname', 'nameofsociety', 'name', 'society', 'socname',
    'societytitle', 'fullsocietyname', 'societymaster'
  ]);

  const registrationNo = findVal([
    'societyregistrationno', 'registrationno', 'regno', 'registrationnumber',
    'regnumber', 'registration'
  ]);

  const registrationDate = findVal([
    'societyregistrationdate', 'registrationdate', 'dateofregistration', 'regdate', 'date', 'dated'
  ]);

  const headerAddress = findVal([
    'hedderaddress', 'headeraddress', 'hedder address', 'header address', 'societyhedderaddress', 'societyheaderaddress'
  ]);

  const address = findVal([
    'societyaddress', 'address', 'registeredaddress', 'officeaddress', 'location'
  ]);

  // 1. Check if the sheet has a header row with 'Line 1'..'Line 6' columns
  let colIdxLine1 = -1, colIdxLine2 = -1, colIdxLine3 = -1, colIdxLine4 = -1, colIdxLine5 = -1, colIdxLine6 = -1;
  for (let r = 0; r < Math.min(rawAoa.length, 5); r++) {
    const rowArr = (rawAoa[r] || []) as unknown[];
    for (let c = 0; c < rowArr.length; c++) {
      const hStr = String(rowArr[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (hStr === 'line1' || hStr === 'addressline1' || hStr === 'societyaddressline1') colIdxLine1 = c;
      if (hStr === 'line2' || hStr === 'addressline2' || hStr === 'societyaddressline2') colIdxLine2 = c;
      if (hStr === 'line3' || hStr === 'addressline3' || hStr === 'societyaddressline3') colIdxLine3 = c;
      if (hStr === 'line4' || hStr === 'addressline4' || hStr === 'societyaddressline4') colIdxLine4 = c;
      if (hStr === 'line5' || hStr === 'addressline5' || hStr === 'societyaddressline5') colIdxLine5 = c;
      if (hStr === 'line6' || hStr === 'addressline6' || hStr === 'societyaddressline6') colIdxLine6 = c;
    }
  }

  let line1 = '', line2 = '', line3 = '', line4 = '', line5 = '', line6 = '';

  // 2. Scan rows for 'Society Address'
  for (let r = 0; r < rawAoa.length; r++) {
    const rowArr = (rawAoa[r] || []) as unknown[];
    const rowText = rowArr.map(x => String(x || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');
    if (rowText.includes('societyaddress') || (rowText.includes('5') && rowText.includes('address'))) {
      if (colIdxLine1 >= 0 && getCellStr(r, colIdxLine1)) line1 = getCellStr(r, colIdxLine1);
      if (colIdxLine2 >= 0 && getCellStr(r, colIdxLine2)) line2 = getCellStr(r, colIdxLine2);
      if (colIdxLine3 >= 0 && getCellStr(r, colIdxLine3)) line3 = getCellStr(r, colIdxLine3);
      if (colIdxLine4 >= 0 && getCellStr(r, colIdxLine4)) line4 = getCellStr(r, colIdxLine4);
      if (colIdxLine5 >= 0 && getCellStr(r, colIdxLine5)) line5 = getCellStr(r, colIdxLine5);
      if (colIdxLine6 >= 0 && getCellStr(r, colIdxLine6)) line6 = getCellStr(r, colIdxLine6);

      // If column indices weren't found in header, grab consecutive non-label cells
      if (!line1 && !line2 && !line3 && !line4 && !line5 && !line6) {
        const meaningful = rowArr
          .map((v, c) => getCellStr(r, c))
          .filter(v => {
            const nv = v.toLowerCase().replace(/[^a-z0-9]/g, '');
            return nv !== '5' && nv !== 'societyaddress' && nv !== 'field' && nv !== 'value' && !nv.startsWith('line') && v.trim() !== '';
          });
        if (meaningful[0]) line1 = meaningful[0];
        if (meaningful[1]) line2 = meaningful[1];
        if (meaningful[2]) line3 = meaningful[2];
        if (meaningful[3]) line4 = meaningful[3];
        if (meaningful[4]) line5 = meaningful[4];
        if (meaningful[5]) line6 = meaningful[5];
      }
    }
  }

  // 3. Fallback to kvMap
  if (!line1) line1 = findVal(['societyaddressline1', 'addressline1', 'line1', 'societyaddress1', 'address1']);
  if (!line2) line2 = findVal(['societyaddressline2', 'addressline2', 'line2', 'societyaddress2', 'address2']);
  if (!line3) line3 = findVal(['societyaddressline3', 'addressline3', 'line3', 'societyaddress3', 'address3']);
  if (!line4) line4 = findVal(['societyaddressline4', 'addressline4', 'line4', 'societyaddress4', 'address4']);
  if (!line5) line5 = findVal(['societyaddressline5', 'addressline5', 'line5', 'societyaddress5', 'address5']);
  if (!line6) line6 = findVal(['societyaddressline6', 'addressline6', 'line6', 'societyaddress6', 'address6']);

  // If separate line columns were not present, split multiline address into 6 lines
  if (!line1 && !line2 && !line3 && !line4 && !line5 && !line6 && address) {
    const parts = address.split(/[\r\n]+/).map(p => p.trim());
    line1 = parts[0] || '';
    line2 = parts[1] || '';
    line3 = parts[2] || '';
    line4 = parts[3] || '';
    line5 = parts[4] || '';
    line6 = parts[5] || '';
  }

  const societyAddress = {
    line1: line1 || '',
    line2: line2 || '',
    line3: line3 || '',
    line4: line4 || '',
    line5: line5 || '',
    line6: line6 || '',
  };

  const combinedAddressLines = [
    societyAddress.line1,
    societyAddress.line2,
    societyAddress.line3,
    societyAddress.line4,
    societyAddress.line5,
    societyAddress.line6,
  ].filter(l => l.trim() !== '');

  const finalCombinedAddress = combinedAddressLines.length > 0
    ? combinedAddressLines.join('\n')
    : (address || headerAddress || '');

  const email = findVal([
    'societyemailid', 'societyemail', 'emailid', 'email', 'emailaddress', 'e_mail'
  ]);

  const telephone = findVal([
    'societytelephonemobileno', 'societytelephoneormobileno', 'telephonemobileno',
    'telephone', 'mobile', 'phone', 'contact', 'mobileno', 'phoneno'
  ]);

  const rawFlat = findVal(['noofflatorroom', 'noofflat', 'flat', 'room', 'flats', 'unitsflat']);
  const rawShop = findVal(['noshop', 'shop', 'shops', 'unitsshop']);
  const rawOffice = findVal(['nooffice', 'office', 'offices', 'unitsoffice']);
  const rawGala = findVal(['nogalas', 'noofgalas', 'gala', 'galas', 'unitsgala']);
  const rawBlank = findVal(['noofprintblankextrasrno', 'noofprintblank', 'printblanks', 'printblank', 'extrasr', 'blank']);

  const unitsFlat = parseInt(rawFlat || '0', 10) || 0;
  const unitsShop = parseInt(rawShop || '0', 10) || 0;
  const unitsOffice = parseInt(rawOffice || '0', 10) || 0;
  const unitsGala = parseInt(rawGala || '0', 10) || 0;
  const printBlanks = parseInt(rawBlank || '0', 10) || 0;
  const totalUnits = unitsFlat + unitsShop + unitsOffice + unitsGala;

  // Strategy C: Loose Text Search Fallback for Society Name if still blank
  let finalSocietyName = societyName;
  if (!finalSocietyName) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const txt = getCellStr(r, c);
        if (txt && txt.length > 5) {
          const upper = txt.toUpperCase();
          if (
            upper.includes('CO-OP') ||
            upper.includes('HSG') ||
            upper.includes('SOC') ||
            upper.includes('LIMITED') ||
            upper.includes('LTD') ||
            upper.includes('HOUSING')
          ) {
            finalSocietyName = txt;
            break;
          }
        }
      }
      if (finalSocietyName) break;
    }
  }

  if (!finalSocietyName && kvMap.size > 0) {
    for (const [k, v] of kvMap.entries()) {
      if (k !== 'field' && k !== 'value' && v && v.length > 3) {
        finalSocietyName = v;
        break;
      }
    }
  }

  // Return SocietyMaster if any key-value pairs or text exists
  if (!finalSocietyName && !registrationNo && !address && !headerAddress && !email && !telephone && kvMap.size === 0) {
    return null;
  }

  return {
    societyName: finalSocietyName || '',
    registrationNo: registrationNo || '',
    registrationDate: excelDate(registrationDate) || registrationDate,
    headerAddress: headerAddress || finalCombinedAddress || '',
    address: finalCombinedAddress || '',
    societyAddress,
    email: email || '',
    telephone: telephone || '',
    totalUnits,
    unitsFlat,
    unitsShop,
    unitsOffice,
    unitsGala,
    printBlanks,
  };
}

function parseCommonFile(sheet: XLSX.WorkSheet | null): CommonFileRecord[] {
  const rows = getRows(sheet);
  return rows
    .filter(r => colSerial(r))
    .map(r => {
      const srNo = colSerial(r);
      const base = FormMappingService.createBlankRecord(srNo);
      return {
        ...base,
        srNo,
        membershipNo: col(r, 'Membership No.', 'Membership No', 'membership_no', 'Membership Number'),
        shareCertificateNo: col(r, 'Share Certificate No.', 'Share Certificate No', 'share_cert_no', 'Share Certificate Number', 'Serial No. of Share Certificate'),
        noOfShares: col(r, 'No. of Shares', 'No of Shares', 'no_of_shares', 'Number of Shares', 'Share Count'),
        valueOfOneShare: col(r, 'Value of One Share', 'value_of_one_share'),
        valueOfShares: col(r, 'Value of Shares', 'Value of Shares (Rs.)', 'Value of Shares Rs.', 'value_of_shares', 'Share Value'),
        sharesFrom: colDate(r, 'From', 'shares_from'),
        sharesTo: colDate(r, 'To', 'shares_to'),
        memberName: col(r, 'Members Name Full', 'Member Name', 'Full Name of Member', 'Full Name of the Member', 'Full Name', 'member_name'),
        member1: col(r, 'Members Name Full 1', 'Members Name 1', 'Member 1', 'member_1', '1'),
        member2: col(r, 'Members Name Full 2', 'Members Name 2', 'Member 2', 'member_2', '2'),
        member3: col(r, 'Members Name Full 3', 'Members Name 3', 'Member 3', 'member_3', '3'),
        member4: col(r, 'Members Name Full 4', 'Members Name 4', 'Member 4', 'member_4', '4'),
        member5: col(r, 'Members Name Full 5', 'Members Name 5', 'Member 5', 'member_5', '5'),
        member6: col(r, 'Members Name Full 6', 'Members Name 6', 'Member 6', 'member_6', '6'),
        permanentAddress: col(r, 'Address Permanent', 'Address (Permanent)', 'Permanent Address', 'permanent_address', 'Address'),
        flatNo: col(r, 'Address Permanent Flat/Room/Shop/Office/Gala No.', 'Flat/Room/Shop/Office/Gala No.', 'Flat No./Room No./ Shop No./Office No. / Gala No.', 'Flat/Tenement No.', 'Flat No', 'flat_no', 'Flat Number'),
        wingNo: col(r, 'Address Permanent Wing No.', 'Wing No.', 'Wing No', 'wing_no', 'Wing'),
        residentialAddress: col(r, 'Address Residential / Care of', 'Address (Residential / Care off)', 'Residential Address', 'residential_address', 'New Address / As Above'),
        occupation: col(r, 'Occupation/Profession', 'Occupation', 'occupation', 'Profession'),
        age: col(r, 'Age on Admission', 'Age', 'age'),
        dateOfAdmission: colDate(r, 'Date of Admission', 'Date of admission', 'date_of_admission', 'Admission Date'),
        dateOfEntranceFee: colDate(r, 'Date of Payment of entrance fee', 'Entrance Fee Date', 'Date of Entrance Fee', 'date_of_entrance_fee'),
        nomineeName: col(r, 'Nominee Name', 'Full Name of Nominee', 'Name of Nominee', 'nominee_name'),
        nomineeAddress: col(r, 'Nominee Address', 'Address of Nominee', 'nominee_address'),
        nominee1: col(r, 'Nominee 1', 'Nominee Name 1', 'Nominee1', 'nominee_1', '1. Nominee'),
        nominee2: col(r, 'Nominee 2', 'Nominee Name 2', 'Nominee2', 'nominee_2', '2. Nominee'),
        nominee3: col(r, 'Nominee 3', 'Nominee Name 3', 'Nominee3', 'nominee_3', '3. Nominee'),
        nominee4: col(r, 'Nominee 4', 'Nominee Name 4', 'Nominee4', 'nominee_4', '4. Nominee'),
        nominee5: col(r, 'Nominee 5', 'Nominee Name 5', 'Nominee5', 'nominee_5', '5. Nominee'),
        nominee6: col(r, 'Nominee 6', 'Nominee Name 6', 'Nominee6', 'nominee_6', '6. Nominee'),
        nomineePercentage1: col(r, 'Percentage 1', 'Percentage1', 'Nominee 1 %', 'nominee_percentage_1'),
        nomineePercentage2: col(r, 'Percentage 2', 'Percentage2', 'Nominee 2 %', 'nominee_percentage_2'),
        nomineePercentage3: col(r, 'Percentage 3', 'Percentage3', 'Nominee 3 %', 'nominee_percentage_3'),
        nomineePercentage4: col(r, 'Percentage 4', 'Percentage4', 'Nominee 4 %', 'nominee_percentage_4'),
        nomineePercentage5: col(r, 'Percentage 5', 'Percentage5', 'Nominee 5 %', 'nominee_percentage_5'),
        nomineePercentage6: col(r, 'Percentage 6', 'Percentage6', 'Nominee 6 %', 'nominee_percentage_6'),
        dateOfNomination: colDate(r, 'Date of Nomination', 'date_of_nomination', 'Nomination Date'),
        propertyRemarks: col(r, 'Property Details/Tenement Cost', 'Property Information', 'Description of Tenement'),
        remarks: col(r, 'Remarks', 'Remark', 'remarks'),
      };
    });
}

function parseFormI(sheet: XLSX.WorkSheet | null, common: CommonFileRecord[]): FormIRecord[] {
  const rows = getRows(sheet);
  const commonMap = new Map<string, CommonFileRecord>();
  for (const c of common) {
    if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
  }

  return rows
    .filter(r => colSerial(r, 'Sr. No.', 'sr. no.', 'Serial No'))
    .map(r => {
      const srNo = colSerial(r, 'Sr. No.', 'sr. no.', 'Serial No');
      const base = commonMap.get(normalizeSerialKey(srNo)) || FormMappingService.createBlankRecord(srNo);

      // Parse up to 5 entries of Shares Held
      const sharesHeldEntries: FormIShareHeldEntry[] = [];
      for (let i = 1; i <= 5; i++) {
        const entry: FormIShareHeldEntry = {
          date: colDate(r, `Particulars of Shares Held - Entry ${i}_Date`, `Shares Held ${i} Date`, i === 1 ? 'Share Allotment Date' : `Shares Held Date ${i}`, i === 1 ? 'Date' : `Date_${i}`),
          cashBookFolio: col(r, `Particulars of Shares Held - Entry ${i}_Cash Book Folio No.`, `Shares Held ${i} Cash Book Folio`, i === 1 ? 'Cash Book Folio No.' : `Cash Book Folio_${i}`, i === 1 ? 'Cash Book Folio' : `CBF_${i}`),
          application: col(r, `Particulars of Shares Held - Entry ${i}_Application`, `Shares Held ${i} Application`, i === 1 ? 'Application' : `Application_${i}`),
          allotment: col(r, `Particulars of Shares Held - Entry ${i}_Allotment`, `Shares Held ${i} Allotment`, i === 1 ? 'Allotment' : `Allotment_${i}`),
          call1st: col(r, `Particulars of Shares Held - Entry ${i}_Amount Received 1st Call`, `Shares Held ${i} 1st Call`, i === 1 ? '1st Call' : `1st Call_${i}`, i === 1 ? 'Amount Received_1st Call' : `Amount Received 1st Call_${i}`),
          call2nd: col(r, `Particulars of Shares Held - Entry ${i}_Amount Received 2nd Call`, `Shares Held ${i} 2nd Call`, i === 1 ? '2nd Call' : `2nd Call_${i}`, i === 1 ? 'Amount Received_2nd Call' : `Amount Received 2nd Call_${i}`),
          totalAmountReceived: col(r, `Particulars of Shares Held - Entry ${i}_Total Amount Received`, `Shares Held ${i} Total Amount Received`, i === 1 ? 'Total Amount Received' : `Total Amount Received_${i}`, i === 1 ? 'Amount Received' : `Amount Received_${i}`),
          noOfShares: col(r, `Particulars of Shares Held - Entry ${i}_No. of Shares Held`, `Shares Held ${i} No. of Shares`, i === 1 ? 'No. of Shares' : `No. of Shares_${i}`, i === 1 ? 'No. of Shares Held' : `No. of Shares Held_${i}`) || (i === 1 ? base.noOfShares : ''),
          sharesFrom: col(r, `Particulars of Shares Held - Entry ${i}_Shares From`, `Shares Held ${i} Shares From`, i === 1 ? 'From' : `From_${i}`, i === 1 ? 'Shares From' : `Shares From_${i}`) || (i === 1 ? base.sharesFrom : ''),
          sharesTo: col(r, `Particulars of Shares Held - Entry ${i}_Shares To`, `Shares Held ${i} Shares To`, i === 1 ? 'To' : `To_${i}`, i === 1 ? 'Shares To' : `Shares To_${i}`) || (i === 1 ? base.sharesTo : ''),
          shareCertificateNo: col(r, `Particulars of Shares Held - Entry ${i}_Share Certificate No.`, `Shares Held ${i} Share Certificate No.`, i === 1 ? 'Share Certificate No.' : `Share Certificate No._${i}`, i === 1 ? 'Serial No. of Share Certificate' : `Serial No. of Share Certificate_${i}`) || (i === 1 ? (base.serialNoOfShareCertificate || base.shareCertificateNo) : ''),
        };
        sharesHeldEntries.push(entry);
      }

      // Parse up to 5 entries of Shares Transferred
      const sharesTransferredEntries: FormIShareTransferredEntry[] = [];
      for (let i = 1; i <= 5; i++) {
        const entry: FormIShareTransferredEntry = {
          date: colDate(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Date`, `Shares Transferred ${i} Date`, i === 1 ? 'Date of transfer / refund' : `Transfer Date ${i}`, i === 1 ? 'Transfer Date' : `Transfer Date_${i}`),
          cashBookFolio: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Cash Book Folio No.`, `Shares Transferred ${i} Cash Book Folio`, i === 1 ? 'Transfer Cash Book Folio' : `Transfer CBF_${i}`),
          transferDate: colDate(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Transfer Date`, `Shares Transferred ${i} Transfer Date`, i === 1 ? 'Date of Transfer' : `Date of Transfer_${i}`),
          shareCertificateNo: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Share Certificate No. Transferred`, `Shares Transferred ${i} Cert No`, i === 1 ? 'Share Certificate No. transferred or refunded' : `Share Cert No Transferred_${i}`, i === 1 ? 'Transfer Certificate No.' : `Transfer Cert No_${i}`),
          noOfSharesTransferred: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_No. of Shares Transferred / Refunded`, `Shares Transferred ${i} No of Shares`, i === 1 ? 'No. of Shares Transferred' : `No of Shares Transferred_${i}`, i === 1 ? 'No. of Shares Transferred/Refunded From' : `No. of Shares Transferred From_${i}`),
          balanceNoOfShares: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Balances - No. of Shares Held`, `Shares Transferred ${i} Balance Shares`, i === 1 ? 'Balance No. of Shares' : `Balance No. of Shares_${i}`),
          balanceSerialNoCertificate: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Balances - Serial No. of Share Cert.`, `Shares Transferred ${i} Balance Cert`, i === 1 ? 'Balance Serial No. of Share Certificate' : `Balance Serial No Certificate_${i}`),
          amountRs: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Amount Rs`, `Shares Transferred ${i} Amount Rs`, i === 1 ? 'Balance Amount Rs' : `Balance Amount Rs_${i}`),
          amountP: col(r, `Particulars of Shares Transferred or Surrendered - Entry ${i}_Amount P`, `Shares Transferred ${i} Amount P`, i === 1 ? 'Balance Amount P' : `Balance Amount P_${i}`),
        };
        sharesTransferredEntries.push(entry);
      }

      return {
        ...base,
        srNo,
        dateOfAdmission: colDate(r, 'Date of Admission', 'Date of admission', 'date_of_admission') || base.dateOfAdmission,
        dateOfEntranceFee: colDate(r, 'Date of Payment of Entrance Fees', 'Date of Payment of entrance fee', 'date_of_entrance_fee') || base.dateOfEntranceFee,
        occupation: col(r, 'Occupation', 'occupation') || base.occupation,
        age: col(r, 'Age on the Date of Admission', 'Age on Admission', 'Age', 'age') || base.age,
        nomineeName: col(r, 'Nominee Name Full', 'Nominee Name', 'Full Name of Nominee', 'nominee_name') || base.nomineeName,
        nomineeAddress: col(r, 'Nominee Address', 'Address of Nominee', 'nominee_address') || base.nomineeAddress,
        dateOfNomination: colDate(r, 'Date of Nomination', 'date_of_nomination') || base.dateOfNomination,
        dateOfCessation: colDate(r, 'Date of Cessation of Membership', 'Date of Cessation', 'date_of_cessation') || base.dateOfCessation,
        reasonForCessation: col(r, 'Reason for Cessation', 'reason_for_cessation') || base.reasonForCessation,
        remarks: col(r, 'Remark', 'Remarks', 'remarks') || base.remarks,
        dateOfAllotment: sharesHeldEntries[0]?.date || colDate(r, 'Share Allotment Date', 'share_allotment_date') || base.dateOfAllotment,
        cashBookFolio: sharesHeldEntries[0]?.cashBookFolio || col(r, 'Cash Book Folio No.', 'Cash Book Folio', 'cash_book_folio') || base.cashBookFolio,
        shareApplication: sharesHeldEntries[0]?.application || col(r, 'Application', 'share_application') || base.shareApplication,
        shareAllotment: sharesHeldEntries[0]?.allotment || col(r, 'Allotment', 'share_allotment') || base.shareAllotment,
        share1stCall: sharesHeldEntries[0]?.call1st || col(r, '1st Call', 'share_1st_call') || base.share1stCall,
        share2ndCall: sharesHeldEntries[0]?.call2nd || col(r, '2nd Call', 'share_2nd_call') || base.share2ndCall,
        totalAmountReceived: sharesHeldEntries[0]?.totalAmountReceived || col(r, 'Total Amount Received', 'Amount Received', 'total_amount_received') || base.totalAmountReceived,
        serialNoOfShareCertificate: sharesHeldEntries[0]?.shareCertificateNo || col(r, 'Share Certificate No.', 'Serial No. of Share Certificate', 'serial_no_of_share_cert') || base.serialNoOfShareCertificate,
        sharesFrom: sharesHeldEntries[0]?.sharesFrom || col(r, 'From', 'shares_from') || base.sharesFrom,
        sharesTo: sharesHeldEntries[0]?.sharesTo || col(r, 'To', 'shares_to') || base.sharesTo,
        sharesHeldEntries,
        sharesTransferredEntries,
      };
    });
}

function parseFormJ(sheet: XLSX.WorkSheet | null, common: CommonFileRecord[]): FormJRecord[] {
  const rows = getRows(sheet);
  const commonMap = new Map<string, CommonFileRecord>();
  for (const c of common) {
    if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
  }

  return rows
    .filter(r => colSerial(r, 'Sr. No.', 'Serial No'))
    .map(r => {
      const srNo = colSerial(r, 'Sr. No.', 'Serial No');
      const base = commonMap.get(normalizeSerialKey(srNo)) || FormMappingService.createBlankRecord(srNo);
      return {
        ...base,
        srNo,
        classOfMember: col(r, 'Class of Member', 'class_of_member') || base.classOfMember,
      };
    });
}

function parseShareRegister(sheet: XLSX.WorkSheet | null, common: CommonFileRecord[]): ShareRecord[] {
  const rows = getRows(sheet);
  const commonMap = new Map<string, CommonFileRecord>();
  for (const c of common) {
    if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
  }

  return rows
    .filter(r => colSerial(r, 'Sr. No.', 'Serial No'))
    .map(r => {
      const srNo = colSerial(r, 'Sr. No.', 'Serial No');
      const base = commonMap.get(normalizeSerialKey(srNo)) || FormMappingService.createBlankRecord(srNo);
      return {
        ...base,
        srNo,
        dateOfAllotment: colDate(r, 'Date of allotment of Share', 'Date of Allotment', 'date_of_allotment') || base.dateOfAllotment,
        cashBookFolio: col(r, 'Cash Book folio No.', 'Cash Book Folio No.', 'cash_book_folio_no') || base.cashBookFolio,
        dateOfTransferRefund: colDate(r, 'Date of transfer / refund', 'Date of Transfer/Refund', 'date_of_transfer') || base.dateOfTransferRefund,
        transferJournalFolioNo: col(r, 'Cash Book Journal Folio No.', 'transfer_journal_folio_no') || base.transferJournalFolioNo,
        noOfSharesTransferredRefunded: col(r, 'No. of Shares Transferred/Refunded From', 'no_of_shares_transferred') || base.noOfSharesTransferredRefunded,
        shareCertTransferred: col(r, 'Share Certificate No. transferred or refunded', 'share_cert_transferred') || base.shareCertTransferred,
        sharesValueTransferred: col(r, 'Share Value transferred or refunded Rs.', 'shares_value_transferred') || base.sharesValueTransferred,
        nameOfTransferee: col(r, 'Name of the transferee or person receiving refund', 'name_of_transferee') || base.nameOfTransferee,
        authorityForTransfer: col(r, 'Authority for transfer or refund', 'authority_for_transfer') || base.authorityForTransfer,
        remarks: col(r, 'Remark', 'Remarks', 'remark') || base.remarks,
      };
    });
}

function parseNominationRegister(sheet: XLSX.WorkSheet | null, common: CommonFileRecord[]): NominationRecord[] {
  const rows = getRows(sheet);
  const commonMap = new Map<string, CommonFileRecord>();
  for (const c of common) {
    if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
  }

  return rows
    .filter(r => colSerial(r, 'Sr. No.', 'Serial No'))
    .map(r => {
      const srNo = colSerial(r, 'Sr. No.', 'Serial No');
      const base = commonMap.get(normalizeSerialKey(srNo)) || FormMappingService.createBlankRecord(srNo);
      return {
        ...base,
        srNo,
        dateOfNomination: colDate(r, 'Date of Nomination', 'date_of_nomination') || base.dateOfNomination,
        nomineeName: col(r, 'Name/s of Nominee/s & Address/es of Nominee/s', 'Name of Nominee', 'nominee_name') || base.nomineeName,
        nomineeAddress: col(r, 'Address of Nominee', 'Nominee Address', 'nominee_address') || base.nomineeAddress,
        nominee1: col(r, 'Nominee 1', 'Nominee Name 1', 'Nominee1', 'nominee_1', '1. Nominee') || base.nominee1,
        nominee2: col(r, 'Nominee 2', 'Nominee Name 2', 'Nominee2', 'nominee_2', '2. Nominee') || base.nominee2,
        nominee3: col(r, 'Nominee 3', 'Nominee Name 3', 'Nominee3', 'nominee_3', '3. Nominee') || base.nominee3,
        nominee4: col(r, 'Nominee 4', 'Nominee Name 4', 'Nominee4', 'nominee_4', '4. Nominee') || base.nominee4,
        nominee5: col(r, 'Nominee 5', 'Nominee Name 5', 'Nominee5', 'nominee_5', '5. Nominee') || base.nominee5,
        nominee6: col(r, 'Nominee 6', 'Nominee Name 6', 'Nominee6', 'nominee_6', '6. Nominee') || base.nominee6,
        nomineePercentage: col(r, 'Percentage %', 'Percentage', 'nominee_percentage') || base.nomineePercentage,
        nomineePercentage1: col(r, 'Percentage 1', 'Percentage1', 'Nominee 1 %', 'nominee_percentage_1') || base.nomineePercentage1,
        nomineePercentage2: col(r, 'Percentage 2', 'Percentage2', 'Nominee 2 %', 'nominee_percentage_2') || base.nomineePercentage2,
        nomineePercentage3: col(r, 'Percentage 3', 'Percentage3', 'Nominee 3 %', 'nominee_percentage_3') || base.nomineePercentage3,
        nomineePercentage4: col(r, 'Percentage 4', 'Percentage4', 'Nominee 4 %', 'nominee_percentage_4') || base.nomineePercentage4,
        nomineePercentage5: col(r, 'Percentage 5', 'Percentage5', 'Nominee 5 %', 'nominee_percentage_5') || base.nomineePercentage5,
        nomineePercentage6: col(r, 'Percentage 6', 'Percentage6', 'Nominee 6 %', 'nominee_percentage_6') || base.nomineePercentage6,
        mcMeetingDate: colDate(r, 'Date of Managing Committee Meeting in which Nomination was recorded', 'mc_meeting_date') || base.mcMeetingDate,
        subsequentRevocation: colDate(r, 'Date of subsequent revocation of Nomination', 'subsequent_revocation') || base.subsequentRevocation,
        remarks: col(r, 'Remark', 'Remarks') || base.remarks,
      };
    });
}

function parsePropertyRegister(sheet: XLSX.WorkSheet | null, common: CommonFileRecord[]): PropertyRecord[] {
  const rows = getRows(sheet);
  const commonMap = new Map<string, CommonFileRecord>();
  for (const c of common) {
    if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
  }

  return rows
    .filter(r => colSerial(r, 'Sr. No.', 'Serial No'))
    .map(r => {
      const srNo = colSerial(r, 'Sr. No.', 'Serial No');
      const base = commonMap.get(normalizeSerialKey(srNo)) || FormMappingService.createBlankRecord(srNo);
      return {
        ...base,
        srNo,
        dateOfPossession: colDate(r, 'Date of Possession', 'date_of_possession') || base.dateOfPossession,
        distinguishingNo: col(r, 'Distinguishing No. of Tenement', 'distinguishing_no') || base.distinguishingNo,
        descriptionOfTenement: col(r, 'Description of Tenement', 'description_of_tenement') || base.descriptionOfTenement,
        area: col(r, 'Area of Tenement', 'area_of_tenement') || base.area,
        floor: col(r, 'Address Floor', 'Floor', 'floor') || base.floor,
        landCost: col(r, 'Cost of Tenement Land Rs.', 'Land Rs.', 'Land Cost', 'land_cost') || base.landCost,
        constructionCost: col(r, 'Cost of Tenement Construction Rs.', 'Construction Rs.', 'construction_cost') || base.constructionCost,
        costOfTenement: col(r, 'Cost of Tenement', 'cost_of_tenement') || base.costOfTenement,
        annualGroundRent: col(r, 'Annual Ground Rent Rs.', 'annual_ground_rent') || base.annualGroundRent,
        dateOfCessation: colDate(r, 'Date of Cessation of Membership', 'date_of_cessation') || base.dateOfCessation,
        signature: col(r, 'Signature Chairman / Hon. Secretary', 'signature') || base.signature,
        propertyRemarks: col(r, 'Remark', 'Reason of Cessation / Transfer to Sr. No. and Date', 'Remarks') || base.propertyRemarks,
      };
    });
}

function parseBankLineMarkRegister(sheet: XLSX.WorkSheet | null, common: CommonFileRecord[]): BankLineMarkRecord[] {
  const rows = getRows(sheet);
  const commonMap = new Map<string, CommonFileRecord>();
  for (const c of common) {
    if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
  }

  return rows
    .filter(r => colSerial(r, 'Sr. No.', 'Serial No'))
    .map(r => {
      const srNo = colSerial(r, 'Sr. No.', 'Serial No');
      const base = commonMap.get(normalizeSerialKey(srNo)) || FormMappingService.createBlankRecord(srNo);
      return {
        ...base,
        srNo,
        area: col(r, 'Permanent Address Area', 'Area', 'area') || base.area,
        carpetBuildupSqFt: col(r, 'Permanent Address Carpet/Built-up Sq.Ft.', 'Carpet/Built-up Sq.Ft.', 'carpet_buildup_sqft') || base.carpetBuildupSqFt,
        dateOfLoanSanction: colDate(r, 'Date of Loan Sanction Letter', 'date_of_loan_sanction') || base.dateOfLoanSanction,
        bankName: col(r, 'Bank Name', 'bank_name') || base.bankName,
        bankAddress: col(r, 'Bank Address', 'bank_address') || base.bankAddress,
        loanAmount: col(r, 'Loan Amount', 'loan_amount') || base.loanAmount,
        loanPeriod: col(r, 'Loan Period', 'loan_period') || base.loanPeriod,
        mcMeetingApprovalDate: colDate(r, 'Approval of Managing Committee Meeting Date', 'mc_meeting_approval_date') || base.mcMeetingApprovalDate,
        resolutionNo: col(r, 'Resolution No.', 'resolution_no') || base.resolutionNo,
        dateOfNOC: colDate(r, 'Date of NOC given by Society', 'date_of_noc') || base.dateOfNOC,
        dateOfLienCancellation: colDate(r, 'Date of Documents of Lien Cancellation', 'date_of_lien_cancellation') || base.dateOfLienCancellation,
      };
    });
}

export function sanitizeAndCalculateVoucher(v: VoucherRecord): VoucherRecord {
  const cleanVal = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str.toUpperCase().startsWith('TEST-') || str.toUpperCase().includes('_PAYMENT_')) return '';
    return str;
  };

  const toNum = (val: any) => {
    const s = cleanVal(val).replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const bill1 = toNum(v.billAmount);
  const bill2 = toNum(v.billAmount2);
  const adv = toNum(v.advLessPaid);

  const cleanSub1 = cleanVal(v.subTotal1);
  const sub1 = cleanSub1 !== '' && !isNaN(Number(cleanSub1)) ? toNum(cleanSub1) : (bill1 + bill2 - adv);

  const tdsPct = toNum(v.tdsPercent);
  const cleanTdsAmt = cleanVal(v.tdsAmount);
  const tdsAmt = cleanTdsAmt !== '' && !isNaN(Number(cleanTdsAmt)) ? toNum(cleanTdsAmt) : (tdsPct > 0 ? (sub1 * tdsPct / 100) : 0);

  const cleanSub2 = cleanVal(v.subTotal2);
  const sub2 = cleanSub2 !== '' && !isNaN(Number(cleanSub2)) ? toNum(cleanSub2) : (sub1 - tdsAmt);

  const cgstPct = toNum(v.cgstPercent);
  const cleanCgstAmt = cleanVal(v.cgstAmount);
  const cgstAmt = cleanCgstAmt !== '' && !isNaN(Number(cleanCgstAmt)) ? toNum(cleanCgstAmt) : (cgstPct > 0 ? (sub2 * cgstPct / 100) : 0);

  const sgstPct = toNum(v.sgstPercent);
  const cleanSgstAmt = cleanVal(v.sgstAmount);
  const sgstAmt = cleanSgstAmt !== '' && !isNaN(Number(cleanSgstAmt)) ? toNum(cleanSgstAmt) : (sgstPct > 0 ? (sub2 * sgstPct / 100) : 0);

  const round = toNum(v.roundOff);
  const other = toNum(v.otherFineAdj);

  const cleanNet = cleanVal(v.netPaid);
  const net = cleanNet !== '' && !isNaN(Number(cleanNet)) ? toNum(cleanNet) : (sub2 + cgstAmt + sgstAmt + round + other);

  return {
    ...v,
    voucherNo: cleanVal(v.voucherNo) || cleanVal(v.srNo),
    srNo: cleanVal(v.srNo) || cleanVal(v.voucherNo),
    socNumber: cleanVal(v.socNumber),
    societyName: cleanVal(v.societyName),
    societyAddress: cleanVal(v.societyAddress),
    toPayee: cleanVal(v.toPayee),
    chargeTo: cleanVal(v.chargeTo),
    particulars: cleanVal(v.particulars),
    bankName: cleanVal(v.bankName),
    chequeNo: cleanVal(v.chequeNo),
    voucherDate: cleanVal(v.voucherDate),
    billNo: cleanVal(v.billNo),
    billAmount: bill1 > 0 ? String(bill1) : cleanVal(v.billAmount),
    billAmount2: bill2 > 0 ? String(bill2) : cleanVal(v.billAmount2),
    advLessPaid: adv !== 0 ? String(adv) : cleanVal(v.advLessPaid),
    subTotal1: sub1 > 0 ? String(sub1) : cleanVal(v.subTotal1),
    tdsPercent: tdsPct > 0 ? String(tdsPct) : cleanVal(v.tdsPercent),
    tdsAmount: tdsAmt > 0 ? String(tdsAmt) : cleanVal(v.tdsAmount),
    subTotal2: sub2 > 0 ? String(sub2) : cleanVal(v.subTotal2),
    cgstPercent: cgstPct > 0 ? String(cgstPct) : cleanVal(v.cgstPercent),
    cgstAmount: cgstAmt > 0 ? String(cgstAmt) : cleanVal(v.cgstAmount),
    sgstPercent: sgstPct > 0 ? String(sgstPct) : cleanVal(v.sgstPercent),
    sgstAmount: sgstAmt > 0 ? String(sgstAmt) : cleanVal(v.sgstAmount),
    roundOff: round !== 0 ? String(round) : cleanVal(v.roundOff),
    otherFineAdj: other !== 0 ? String(other) : cleanVal(v.otherFineAdj),
    netPaid: net > 0 ? String(net) : cleanVal(v.netPaid),
  };
}

export function cleanMemberVal(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (
    str.toUpperCase().startsWith('TEST-02_COMMO') ||
    str.toUpperCase().startsWith('TEST-03_FORM') ||
    str.toUpperCase().startsWith('TEST-04_FORM') ||
    str.toUpperCase().startsWith('TEST-05_') ||
    str.toUpperCase().startsWith('TEST-06_') ||
    str.toUpperCase().startsWith('TEST-07_') ||
    str.toUpperCase().startsWith('TEST-08_') ||
    str.toUpperCase().startsWith('TEST-09_') ||
    str.toUpperCase().startsWith('TEST-10_') ||
    str.toUpperCase().includes('TEST-02_')
  ) {
    return '';
  }
  return str;
}

export function sanitizeAndCleanMember(m: any): any {
  if (!m || typeof m !== 'object') return m;
  const cleaned: any = { ...m };
  for (const k of Object.keys(cleaned)) {
    if (typeof cleaned[k] === 'string') {
      cleaned[k] = cleanMemberVal(cleaned[k]);
    }
  }

  // Convert raw Excel numeric dates (e.g. 45293) to DD/MM/YYYY
  const dateKeys = [
    'dateOfAdmission',
    'dateOfEntranceFee',
    'dateOfNomination',
    'dateOfCessation',
    'sharesHeld_date_1', 'sharesHeld_date_2', 'sharesHeld_date_3', 'sharesHeld_date_4', 'sharesHeld_date_5',
    'sharesTransferred_date_1', 'sharesTransferred_date_2', 'sharesTransferred_date_3', 'sharesTransferred_date_4', 'sharesTransferred_date_5',
    'sharesTransferred_transferDate_1', 'sharesTransferred_transferDate_2', 'sharesTransferred_transferDate_3', 'sharesTransferred_transferDate_4', 'sharesTransferred_transferDate_5',
    'dateOfLoanSanction', 'mcMeetingApprovalDate', 'dateOfNOC', 'dateOfLienCancellation', 'transferDate'
  ];

  for (const dk of dateKeys) {
    if (cleaned[dk]) {
      cleaned[dk] = excelDate(cleaned[dk]);
    }
  }

  if (!cleaned.memberName && cleaned.member1) cleaned.memberName = cleaned.member1;
  if (!cleaned.member1 && cleaned.memberName) cleaned.member1 = cleaned.memberName;
  return cleaned;
}

export function synchronizeMasterWorkbook(wb: MasterWorkbook): MasterWorkbook {
  if (!wb) return wb;
  if (!wb.commonFile) wb.commonFile = [];

  const regKeys: (keyof MasterWorkbook)[] = [
    'formIData',
    'formJData',
    'shareData',
    'nominationData',
    'propertyData',
    'bankLineMarkData',
  ];

  // 1. Sanitize commonFile & all registers
  wb.commonFile = wb.commonFile.map(m => sanitizeAndCleanMember(m));
  for (const regKey of regKeys) {
    if (Array.isArray((wb as any)[regKey])) {
      (wb as any)[regKey] = (wb as any)[regKey].map((r: any) => sanitizeAndCleanMember(r));
    }
  }

  // 2. Sanitize & calculate all vouchers
  if (Array.isArray(wb.voucherData)) {
    wb.voucherData = wb.voucherData.map(v => sanitizeAndCalculateVoucher(v));
  }

  // 3. Determine max record count across commonFile & registers
  let maxCount = wb.commonFile.length;
  for (const regKey of regKeys) {
    const list = (wb as any)[regKey];
    if (Array.isArray(list) && list.length > maxCount) {
      maxCount = list.length;
    }
  }

  // 4. Perform universal lockstep unification per serial/index
  const unifiedMembers: NormalizedMemberRecord[] = [];

  for (let idx = 0; idx < maxCount; idx++) {
    const cItem = wb.commonFile[idx] || null;
    const fIItem = wb.formIData && wb.formIData[idx] ? wb.formIData[idx] : null;
    const fJItem = wb.formJData && wb.formJData[idx] ? wb.formJData[idx] : null;
    const shItem = wb.shareData && wb.shareData[idx] ? wb.shareData[idx] : null;
    const nomItem = wb.nominationData && wb.nominationData[idx] ? wb.nominationData[idx] : null;
    const propItem = wb.propertyData && wb.propertyData[idx] ? wb.propertyData[idx] : null;
    const bankItem = wb.bankLineMarkData && wb.bankLineMarkData[idx] ? wb.bankLineMarkData[idx] : null;

    const sources = [fIItem, fJItem, shItem, nomItem, propItem, bankItem, cItem].filter(Boolean);

    // Pick first non-empty value for each common attribute.
    // PRIORITY: commonFile (cItem) first, then the registers as fallback.
    // Common File is the single source of truth for shared member fields — BOTH editors
    // (SpreadsheetEditor and the Quick Search & Edit modal) write edits into commonFile,
    // so it must win. Registers are only used to fill a value commonFile does not have
    // yet (e.g. right after a single-register import), and pickFirst skips empty values,
    // so that fallback still works when commonFile is blank for a field.
    const pickFirst = (...candidates: any[]) => {
      for (const val of candidates) {
        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
      }
      return '';
    };

    const srNo = pickFirst(cItem?.srNo, fIItem?.srNo, fJItem?.srNo, String(idx + 1).padStart(3, '0'));
    const memberName = pickFirst(cItem?.memberName, fIItem?.memberName, fJItem?.memberName, cItem?.member1, fIItem?.member1, fJItem?.member1);
    const member1 = pickFirst(cItem?.member1, fIItem?.member1, fJItem?.member1, memberName);
    const member2 = pickFirst(cItem?.member2, fIItem?.member2, fJItem?.member2);
    const member3 = pickFirst(cItem?.member3, fIItem?.member3, fJItem?.member3);
    const member4 = pickFirst(cItem?.member4, fIItem?.member4, fJItem?.member4);
    const member5 = pickFirst(cItem?.member5, fIItem?.member5, fJItem?.member5);
    const member6 = pickFirst(cItem?.member6, fIItem?.member6, fJItem?.member6);

    const flatNo = pickFirst(cItem?.flatNo, propItem?.flatNo, fIItem?.flatNo, fJItem?.flatNo);
    const wingNo = pickFirst(cItem?.wingNo, propItem?.wingNo, fIItem?.wingNo, fJItem?.wingNo);
    const floor = pickFirst(cItem?.floor, propItem?.floor);
    const membershipNo = pickFirst(cItem?.membershipNo, fIItem?.membershipNo, fJItem?.membershipNo, shItem?.membershipNo);
    const shareCertificateNo = pickFirst(cItem?.shareCertificateNo, shItem?.shareCertificateNo, fIItem?.shareCertificateNo);
    const noOfShares = pickFirst(cItem?.noOfShares, shItem?.noOfShares, fIItem?.noOfShares);
    const valueOfOneShare = pickFirst(cItem?.valueOfOneShare, shItem?.valueOfOneShare, fIItem?.valueOfOneShare);
    const valueOfShares = pickFirst(cItem?.valueOfShares, shItem?.valueOfShares, fIItem?.valueOfShares);
    const sharesFrom = pickFirst(cItem?.sharesFrom, shItem?.sharesFrom, fIItem?.sharesFrom);
    const sharesTo = pickFirst(cItem?.sharesTo, shItem?.sharesTo, fIItem?.sharesTo);

    const dateOfAdmission = pickFirst(cItem?.dateOfAdmission, fIItem?.dateOfAdmission, fJItem?.dateOfAdmission);
    const dateOfEntranceFee = pickFirst(cItem?.dateOfEntranceFee, fIItem?.dateOfEntranceFee, fJItem?.dateOfEntranceFee);
    const residentialAddress = pickFirst(cItem?.residentialAddress, fIItem?.residentialAddress, fJItem?.residentialAddress);
    const permanentAddress = pickFirst(cItem?.permanentAddress, fIItem?.permanentAddress, fJItem?.permanentAddress);
    const occupation = pickFirst(cItem?.occupation, fIItem?.occupation);
    const age = pickFirst(cItem?.age, fIItem?.age);

    const nomineeName = pickFirst(cItem?.nomineeName, nomItem?.nomineeName, fIItem?.nomineeName);
    const nomineeAddress = pickFirst(cItem?.nomineeAddress, nomItem?.nomineeAddress, fIItem?.nomineeAddress);
    const nomineeRelationship = pickFirst(cItem?.nomineeRelationship, nomItem?.nomineeRelationship);
    const dateOfNomination = pickFirst(cItem?.dateOfNomination, nomItem?.dateOfNomination, fIItem?.dateOfNomination);

    // Merge base record. commonFile (cItem) is spread LAST so that for any field it
    // holds it overrides the registers — commonFile is the single source of truth, and
    // this makes edits to non-explicitly-tracked fields (e.g. remark, dateOfCessation)
    // survive too. The explicitly-resolved common fields below still override everything.
    const baseUnified: any = {
      ...(fIItem || {}),
      ...(fJItem || {}),
      ...(shItem || {}),
      ...(nomItem || {}),
      ...(propItem || {}),
      ...(bankItem || {}),
      ...(cItem || {}),
      srNo,
      memberName,
      member1,
      member2,
      member3,
      member4,
      member5,
      member6,
      flatNo,
      wingNo,
      floor,
      membershipNo,
      shareCertificateNo,
      noOfShares,
      valueOfOneShare,
      valueOfShares,
      sharesFrom,
      sharesTo,
      dateOfAdmission: excelDate(dateOfAdmission),
      dateOfEntranceFee: excelDate(dateOfEntranceFee),
      residentialAddress,
      permanentAddress,
      occupation,
      age,
      nomineeName,
      nomineeAddress,
      nomineeRelationship,
      dateOfNomination: excelDate(dateOfNomination),
    };

    unifiedMembers.push(baseUnified);
  }

  // 5. Update commonFile and all register lists in lockstep
  wb.commonFile = unifiedMembers.map(m => ({ ...m }));
  for (const regKey of regKeys) {
    (wb as any)[regKey] = unifiedMembers.map(m => ({ ...m }));
  }

  return wb;
}

function parseVoucherRegister(sheet: XLSX.WorkSheet | null): VoucherRecord[] {
  const rows = getRows(sheet);
  if (!rows || rows.length === 0) return [];

  return rows
    .filter(r => col(r, 'Voucher No', 'Voucher No.', 'Voucher Number', 'Sr. No.', 'Serial No', 'To (Payee)', 'Pay To', 'Particulars'))
    .map((r, idx) => {
      const vchNo = col(r, 'Voucher No', 'Voucher No.', 'Voucher Number', 'Voucher', 'Sr. No.', 'Serial No') || String(idx + 1).padStart(3, '0');
      const raw: VoucherRecord = {
        srNo: colSerial(r, 'Sr. No.', 'Serial No') || vchNo,
        voucherNo: vchNo,
        socNumber: col(r, 'SOC-Number', 'SOC Number', 'SOC No', 'Registration No.', 'Registration No', 'Reg No'),
        societyName: col(r, 'Society Name', 'Soc Name', 'Name of Society'),
        societyAddress: col(r, 'Society Address', 'Soc Address', 'Address', 'CTS No'),
        toPayee: col(r, 'To (Payee)', 'To Payee', 'Pay To', 'Payee', 'Paid To', 'To'),
        chargeTo: col(r, 'Charge To', 'Charge_To', 'Account Head', 'Head', 'Debit To'),
        particulars: col(r, 'Particulars', 'Narration', 'Description', 'Details'),
        bankName: col(r, 'Bank Name', 'Bank', 'bank_name'),
        chequeNo: col(r, 'Cheque No', 'Cheque No.', 'Cheque Number', 'Chq No', 'Cheque/DD No', 'Ref No'),
        voucherDate: colDate(r, 'Voucher Date', 'Date', 'Vch Date') || excelDate(r['Date'] || r['Voucher Date']),
        billNo: col(r, 'Bill No', 'Bill No.', 'Bill Number', 'Invoice No'),
        billAmount: col(r, 'Bill Amount', 'Bill Amount 1', 'Bill Amt', 'Gross Amount', 'Amount'),
        billAmount2: col(r, 'Bill Amount 2', 'Bill Amount (2)'),
        advLessPaid: col(r, 'Adv. Less/Paid', 'Adv Less/Paid', 'Adv. Less or Paid', 'Adv Less Paid', 'Advance Paid', 'Advance Less', 'Advance'),
        subTotal1: col(r, 'Sub Total 1', 'Sub Total (1)', 'SubTotal 1', 'Total 1', 'Total'),
        tdsPercent: col(r, 'TDS %', 'TDS Rate', 'TDS Percentage', 'TDS'),
        tdsAmount: col(r, 'TDS Amount', 'TDS Amt', 'Less TDS Amount', 'Less TDS'),
        subTotal2: col(r, 'Sub Total 2', 'Sub Total (2)', 'SubTotal 2', 'Total 2'),
        cgstPercent: col(r, 'CGST %', 'CGST Rate', 'CGST Percentage', 'CGST'),
        cgstAmount: col(r, 'CGST Amount', 'CGST Amt', 'Add CGST Amount', 'Add CGST'),
        sgstPercent: col(r, 'SGST %', 'SGST Rate', 'SGST Percentage', 'SGST'),
        sgstAmount: col(r, 'SGST Amount', 'SGST Amt', 'Add SGST Amount', 'Add SGST'),
        roundOff: col(r, 'Round Off (+/-)', 'Round Off', 'RoundOff', 'Round off (+/-)', 'Adj'),
        otherFineAdj: col(r, 'Other (Fine/Adj)', 'Other Fine/Adj', 'Other', 'Fine', 'Penalty'),
        netPaid: col(r, 'Net Paid (Voucher)', 'Net Paid', 'Net Paid =', 'Net Amount', 'Paid Amount', 'Total Paid'),
      };
      return sanitizeAndCalculateVoucher(raw);
    });
}

// ── Template generation ───────────────────────────────────────

const SOCIETY_MASTER_FIELDS = [
  ['Sr. No.', 'Field', 'Value', 'Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6'],
  ['1', 'Society Name', '', '', '', '', '', '', ''],
  ['2', 'Society Registration No.', '', '', '', '', '', '', ''],
  ['3', 'Society Registration Date', '', '', '', '', '', '', ''],
  ['4', 'Hedder Address', '', '', '', '', '', '', ''],
  ['5', 'Society Address', '', '', '', '', '', '', ''],
  ['6', 'Society Email Id', '', '', '', '', '', '', ''],
  ['7', 'Society Telephone or Mobile No.', '', '', '', '', '', '', ''],
  ['8', 'Total Unit', '', '', '', '', '', '', ''],
  ['', 'A) No. of Flat or Room', '', '', '', '', '', '', ''],
  ['', 'B) No. Shop', '', '', '', '', '', '', ''],
  ['', 'C) No. Office', '', '', '', '', '', '', ''],
  ['', 'D) No. Galas', '', '', '', '', '', '', ''],
  ['9', 'No. of Print Blank (EXTRA SR. No.)', '', '', '', '', '', '', ''],
  ['10', 'Total Unit', '', '', '', '', '', '', ''],
];

const NOTES_AND_RULES_ROWS = [
  ['HENU OS MASTER EXCEL TEMPLATE — OPERATIONAL INSTRUCTIONS & RULES'],
  [''],
  ['1. "Common File" is the MASTER SINGLE SOURCE OF TRUTH for all common member and unit details.'],
  ['2. "Society Master" provides the society identity (Name, Registration No., Date, Address) for all PDF headers.'],
  ['3. Register-specific information (Nomination, Transfers, Loan Lien details) should be entered in the respective register sheet.'],
  ['4. Data rows start on Row 4. Each following row represents the next member or unit record.'],
  ['5. Common fields in register sheets contain automatic Excel formulas linked to "Common File". Do not overwrite these formulas.'],
  ['6. Blank cells must remain blank. Never insert fake or dummy member data.'],
  ['7. THIS "Notes & Rules" SHEET IS FOR DOCUMENTATION ONLY AND IS EXPLICITLY IGNORED BY HENU OS DURING DATA EXTRACTION AND PDF GENERATION.'],
];

function getFormIHeaders(): [string[], string[]] {
  const r1: string[] = [
    'Sr. No.', 'Date of Admission', 'Date of Payment of Entrance Fees',
    'Members Name Full', '', '', '', '', '',
    'Address Permanent', '',
    'Address Residential / Care of',
    'Occupation', 'Age on the Date of Admission',
    'Nominee Name Full', '', '', '', '', '',
    'Date of Nomination', 'Date of Cessation of Membership', 'Reason for Cessation', 'Remark',
  ];
  const r2: string[] = [
    '', '', '',
    '1', '2', '3', '4', '5', '6',
    'Flat/Room/Shop/Office/Gala No.', 'Wing No.',
    'New Address / As Above',
    '', '',
    '1', '2', '3', '4', '5', '6',
    '', '', '', '',
  ];

  // 5 Entries for Particulars of Shares Held
  for (let i = 1; i <= 5; i++) {
    r1.push(`Particulars of Shares Held - Entry ${i}`, '', '', '', '', '', '', '', '', '', '');
    r2.push(
      'Date',
      'Cash Book Folio No.',
      'Application',
      'Allotment',
      'Amount Received 1st Call',
      'Amount Received 2nd Call',
      'Total Amount Received',
      'No. of Shares Held',
      'Shares From',
      'Shares To',
      'Share Certificate No.'
    );
  }

  // 5 Entries for Particulars of Shares Transferred or Surrendered
  for (let i = 1; i <= 5; i++) {
    r1.push(`Particulars of Shares Transferred or Surrendered - Entry ${i}`, '', '', '', '', '', '', '', '');
    r2.push(
      'Date',
      'Cash Book Folio No.',
      'Transfer Date',
      'Share Certificate No. Transferred',
      'No. of Shares Transferred / Refunded',
      'Balances - No. of Shares Held',
      'Balances - Serial No. of Share Cert.',
      'Amount Rs',
      'Amount P'
    );
  }

  return [r1, r2];
}

export class MasterDataService {
  /**
   * Helper to style worksheet header rows with rich purple background & bold white text.
   */
  private static styleWorksheetHeaders(ws: ExcelJS.Worksheet, rowCount: number, colCount: number) {
    const purpleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5A4579' }
    };

    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };

    const headerBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      right: { style: 'thin', color: { argb: 'FFD9E1F2' } }
    };

    const headerAlign: Partial<ExcelJS.Alignment> = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };

    for (let r = 1; r <= rowCount; r++) {
      const row = ws.getRow(r);
      row.height = 28;
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = purpleFill;
        cell.font = headerFont;
        cell.alignment = headerAlign;
        cell.border = headerBorder;
      }
    }
  }

  /**
   * Helper to populate formulas across data rows (Rows 3..23)
   */
  private static applyFormulasToSheet(
    ws: ExcelJS.Worksheet,
    formulaMap: Record<number, string>,
    startRow = 3,
    endRow = 23
  ) {
    for (let r = startRow; r <= endRow; r++) {
      const row = ws.getRow(r);
      for (const [colIdxStr, formulaTpl] of Object.entries(formulaMap)) {
        const colIdx = parseInt(colIdxStr, 10);
        const cell = row.getCell(colIdx + 1); // ExcelJS is 1-indexed
        const formula = formulaTpl.replace(/\{r\}/g, String(r));
        cell.value = { formula };
      }
    }
  }

  /**
   * Generates the blank Master Data Excel template with all 11 sheets and real purple styled headers.
   * Returns the buffer.
   */
  static async generateTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HENU OS Records Management';
    wb.lastModifiedBy = 'HENU OS Records Management';
    wb.created = new Date();

    // 1. Society Master (key-value layout)
    const smWs = wb.addWorksheet('01_Society_Master', { views: [{ state: 'frozen', ySplit: 1 }] });
    SOCIETY_MASTER_FIELDS.forEach(row => smWs.addRow(row));
    this.styleWorksheetHeaders(smWs, 1, 3);
    smWs.getColumn(1).width = 45;
    smWs.getColumn(2).width = 60;

    // 2. Common Member Master (Sheet 2)
    const cfRows = [
      ['Sr. No.', 'Membership No.', 'Share Certificate No.', 'No. of Shares', 'Value of One Share', 'Value of Shares', 'Share Certificate Range', '', 'Members Name Full', '', '', '', '', '', 'Address Permanent', '', 'Address Residential / Care of'],
      ['', '', '', '', '', '', 'From', 'To', '1', '2', '3', '4', '5', '6', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', 'New Address / As Above'],
    ];
    const cfWs = wb.addWorksheet('02_Common_Member_Master', { views: [{ state: 'frozen', ySplit: 2 }] });
    cfRows.forEach(row => cfWs.addRow(row));
    this.styleWorksheetHeaders(cfWs, 2, cfRows[0].length);
    for (let c = 1; c <= cfRows[0].length; c++) cfWs.getColumn(c).width = 22;

    // 3. I Form (Sheet 3)
    const f1Rows = getFormIHeaders();
    const f1Ws = wb.addWorksheet('03_Form_I', { views: [{ state: 'frozen', ySplit: 2 }] });
    f1Rows.forEach(row => f1Ws.addRow(row));
    this.styleWorksheetHeaders(f1Ws, 2, f1Rows[0].length);
    this.applyFormulasToSheet(f1Ws, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      3: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      4: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      5: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      6: "IF('02_Common_Member_Master'!L{r}=\"\",\"\",'02_Common_Member_Master'!L{r})",
      7: "IF('02_Common_Member_Master'!M{r}=\"\",\"\",'02_Common_Member_Master'!M{r})",
      8: "IF('02_Common_Member_Master'!N{r}=\"\",\"\",'02_Common_Member_Master'!N{r})",
      9: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
      10: "IF('02_Common_Member_Master'!P{r}=\"\",\"\",'02_Common_Member_Master'!P{r})",
      11: "IF('02_Common_Member_Master'!Q{r}=\"\",\"\",'02_Common_Member_Master'!Q{r})",
      31: "IF('02_Common_Member_Master'!D{r}=\"\",\"\",'02_Common_Member_Master'!D{r})",
      32: "IF('02_Common_Member_Master'!G{r}=\"\",\"\",'02_Common_Member_Master'!G{r})",
      33: "IF('02_Common_Member_Master'!H{r}=\"\",\"\",'02_Common_Member_Master'!H{r})",
      34: "IF('02_Common_Member_Master'!C{r}=\"\",\"\",'02_Common_Member_Master'!C{r})",
    });
    for (let c = 1; c <= f1Rows[0].length; c++) f1Ws.getColumn(c).width = 22;

    // 4. J Form (Sheet 4)
    const f2Rows = [
      ['Sr. No.', 'Members Name Full', '', '', '', '', '', 'Permanent Address', '', 'Class of Member'],
      ['', '1', '2', '3', '4', '5', '6', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', ''],
    ];
    const f2Ws = wb.addWorksheet('04_Form_J', { views: [{ state: 'frozen', ySplit: 2 }] });
    f2Rows.forEach(row => f2Ws.addRow(row));
    this.styleWorksheetHeaders(f2Ws, 2, f2Rows[0].length);
    this.applyFormulasToSheet(f2Ws, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      1: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      2: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      3: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      4: "IF('02_Common_Member_Master'!L{r}=\"\",\"\",'02_Common_Member_Master'!L{r})",
      5: "IF('02_Common_Member_Master'!M{r}=\"\",\"\",'02_Common_Member_Master'!M{r})",
      6: "IF('02_Common_Member_Master'!N{r}=\"\",\"\",'02_Common_Member_Master'!N{r})",
      7: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
      8: "IF('02_Common_Member_Master'!P{r}=\"\",\"\",'02_Common_Member_Master'!P{r})",
    });
    for (let c = 1; c <= f2Rows[0].length; c++) f2Ws.getColumn(c).width = 22;

    // 5. Share Register (Sheet 5)
    const srRows = [
      ['Sr. No.', 'Date of allotment of Share', 'Cash Book folio No.', 'Share Certificate No.', 'No. of Shares', 'Value of One Share', 'Value of Shares', 'Address', '', 'Members Name Full', '', '', '', '', '', 'Details of Shares Transferred or Refunded', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', '1', '2', '3', '4', '5', '6', 'Date of transfer / refund', 'Cash Book Journal Folio No.', 'No. of Shares Transferred/Refunded From', 'No. of Shares Transferred/Refunded To', 'Share Certificate No. transferred or refunded', 'Share Value transferred or refunded Rs.', 'Name of the transferee or person receiving refund', 'Authority for transfer or refund', 'Remark'],
    ];
    const srWs = wb.addWorksheet('05_Share_Register', { views: [{ state: 'frozen', ySplit: 2 }] });
    srRows.forEach(row => srWs.addRow(row));
    this.styleWorksheetHeaders(srWs, 2, srRows[0].length);
    this.applyFormulasToSheet(srWs, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      3: "IF('02_Common_Member_Master'!C{r}=\"\",\"\",'02_Common_Member_Master'!C{r})",
      4: "IF('02_Common_Member_Master'!D{r}=\"\",\"\",'02_Common_Member_Master'!D{r})",
      5: "IF('02_Common_Member_Master'!E{r}=\"\",\"\",'02_Common_Member_Master'!E{r})",
      6: "IF('02_Common_Member_Master'!F{r}=\"\",\"\",'02_Common_Member_Master'!F{r})",
      7: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
      8: "IF('02_Common_Member_Master'!P{r}=\"\",\"\",'02_Common_Member_Master'!P{r})",
      9: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      10: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      11: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      12: "IF('02_Common_Member_Master'!L{r}=\"\",\"\",'02_Common_Member_Master'!L{r})",
      13: "IF('02_Common_Member_Master'!M{r}=\"\",\"\",'02_Common_Member_Master'!M{r})",
      14: "IF('02_Common_Member_Master'!N{r}=\"\",\"\",'02_Common_Member_Master'!N{r})",
    });
    for (let c = 1; c <= srRows[0].length; c++) srWs.getColumn(c).width = 22;

    // 6. Nomination Register (Sheet 6)
    const nomRows = [
      ['Sr. No.', 'Member Name', '', '', '', '', '', 'Flat / Wing', '', 'Date of Nomination', 'Name/s of Nominee/s & Addresses of the Nominee/s', '', '', '', '', '', 'Percentage %', '', '', '', '', '', 'Managing Committee Meeting Date', 'Revocation Date', 'Remarks'],
      ['', '1', '2', '3', '4', '5', '6', 'Flat No.', 'Wing No.', '', '1', '2', '3', '4', '5', '6', '1', '2', '3', '4', '5', '6', '', '', ''],
    ];
    const nomWs = wb.addWorksheet('06_Nomination_Register', { views: [{ state: 'frozen', ySplit: 2 }] });
    nomRows.forEach(row => nomWs.addRow(row));
    this.styleWorksheetHeaders(nomWs, 2, nomRows[0].length);
    this.applyFormulasToSheet(nomWs, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      1: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      2: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      3: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      4: "IF('02_Common_Member_Master'!L{r}=\"\",\"\",'02_Common_Member_Master'!L{r})",
      5: "IF('02_Common_Member_Master'!M{r}=\"\",\"\",'02_Common_Member_Master'!M{r})",
      6: "IF('02_Common_Member_Master'!N{r}=\"\",\"\",'02_Common_Member_Master'!N{r})",
      7: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
      8: "IF('02_Common_Member_Master'!P{r}=\"\",\"\",'02_Common_Member_Master'!P{r})",
    });
    for (let c = 1; c <= nomRows[0].length; c++) nomWs.getColumn(c).width = 22;

    // 7. Property Register (Sheet 7)
    const propRows = [
      ['Sr. No.', 'Name of Co-partner Member', '', '', '', '', '', 'Date of Possession', 'Distinguishing No. of Tenement', '', 'Description of Tenement', 'Area of Tenement', 'Cost of Tenement', '', 'Annual Ground Rent Rs.', 'Date of Cessation of Membership', 'Signature Chairman / Hon. Secretary', 'Remarks (Reason of Cessation / Transfer to Sr. No. and Date)'],
      ['', '1', '2', '3', '4', '5', '6', '', 'Flat No.', 'Floor No.', '', '', 'Land Rs.', 'Const. Rs.', '', '', '', ''],
    ];
    const propWs = wb.addWorksheet('07_Property_Register', { views: [{ state: 'frozen', ySplit: 2 }] });
    propRows.forEach(row => propWs.addRow(row));
    this.styleWorksheetHeaders(propWs, 2, propRows[0].length);
    this.applyFormulasToSheet(propWs, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      1: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      2: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      3: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      4: "IF('02_Common_Member_Master'!L{r}=\"\",\"\",'02_Common_Member_Master'!L{r})",
      5: "IF('02_Common_Member_Master'!M{r}=\"\",\"\",'02_Common_Member_Master'!M{r})",
      6: "IF('02_Common_Member_Master'!N{r}=\"\",\"\",'02_Common_Member_Master'!N{r})",
      8: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
    });
    for (let c = 1; c <= propRows[0].length; c++) propWs.getColumn(c).width = 22;

    // 8. Bank Line Mark Register (Sheet 8)
    const blmRows = [
      [
        'Sr. No.', 'Wing / Flat No.', '', 'Members Name', '', '', '', '', '', 'Flat Area', 'Type of Membership', 'Remarks',
        'PARTICULARS OF LOAN - 1st LOAN', '', '', '', '', '', '', '', '',
        'PARTICULARS OF LOAN - 2nd LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', '',
        'PARTICULARS OF LOAN - 3rd LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', '',
        'PARTICULARS OF LOAN - 4th LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', ''
      ],
      [
        '', 'Wing No.', 'Flat No.', '1', '2', '3', '4', '5', '6', '', '', '',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks'
      ]
    ];
    const blmWs = wb.addWorksheet('08_Lien_Mark_Register', { views: [{ state: 'frozen', ySplit: 2 }] });
    blmRows.forEach(row => blmWs.addRow(row));
    this.styleWorksheetHeaders(blmWs, 2, blmRows[0].length);
    this.applyFormulasToSheet(blmWs, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      1: "IF('02_Common_Member_Master'!P{r}=\"\",\"\",'02_Common_Member_Master'!P{r})",
      2: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
      3: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      4: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      5: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      6: "IF('02_Common_Member_Master'!L{r}=\"\",\"\",'02_Common_Member_Master'!L{r})",
      7: "IF('02_Common_Member_Master'!M{r}=\"\",\"\",'02_Common_Member_Master'!M{r})",
      8: "IF('02_Common_Member_Master'!N{r}=\"\",\"\",'02_Common_Member_Master'!N{r})",
    });
    for (let c = 1; c <= blmRows[0].length; c++) blmWs.getColumn(c).width = 22;

    // 9. Share Certificate (Sheet 9)
    const scRows = [
      [
        'Sr. No.', 'Share Certificate No.', 'No. of Shares', "Member's Register No.", 'Flat No.',
        'Authorised Capital Details', '', '',
        'Members Name Full (Ownership Details)', '', '',
        'Share Distinctive Numbers', '', 'Total Value of Shares Rs.',
        'In Lieu of Old Certificate', '',
        'MEMORANDUM OF TRANSFERS - 1st TRANSFER', '', '', '', '',
        'MEMORANDUM OF TRANSFERS - 2nd TRANSFER', '', '', '', '',
        'MEMORANDUM OF TRANSFERS - 3rd TRANSFER', '', '', '', '',
        'MEMORANDUM OF TRANSFERS - 4th TRANSFER', '', '', '', ''
      ],
      [
        '', '', '', '', '',
        'Authorised Share Capital Rs.', 'Total Authorised Shares', 'Value of One Share',
        '1st Owner', '2nd Owner', '3rd Owner',
        'From', 'To', '',
        'Old Share Certificate No.', 'Date of Issue',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee'
      ]
    ];
    const scWs = wb.addWorksheet('09_Share_Certificate', { views: [{ state: 'frozen', ySplit: 2 }] });
    scRows.forEach(row => scWs.addRow(row));
    this.styleWorksheetHeaders(scWs, 2, scRows[0].length);
    this.applyFormulasToSheet(scWs, {
      0: "IF('02_Common_Member_Master'!A{r}=\"\",\"\",'02_Common_Member_Master'!A{r})",
      1: "IF('02_Common_Member_Master'!C{r}=\"\",\"\",'02_Common_Member_Master'!C{r})",
      2: "IF('02_Common_Member_Master'!D{r}=\"\",\"\",'02_Common_Member_Master'!D{r})",
      3: "IF('02_Common_Member_Master'!B{r}=\"\",\"\",'02_Common_Member_Master'!B{r})",
      4: "IF('02_Common_Member_Master'!O{r}=\"\",\"\",'02_Common_Member_Master'!O{r})",
      7: "IF('02_Common_Member_Master'!E{r}=\"\",\"\",'02_Common_Member_Master'!E{r})",
      8: "IF('02_Common_Member_Master'!I{r}=\"\",\"\",'02_Common_Member_Master'!I{r})",
      9: "IF('02_Common_Member_Master'!J{r}=\"\",\"\",'02_Common_Member_Master'!J{r})",
      10: "IF('02_Common_Member_Master'!K{r}=\"\",\"\",'02_Common_Member_Master'!K{r})",
      11: "IF('02_Common_Member_Master'!G{r}=\"\",\"\",'02_Common_Member_Master'!G{r})",
      12: "IF('02_Common_Member_Master'!H{r}=\"\",\"\",'02_Common_Member_Master'!H{r})",
      13: "IF('02_Common_Member_Master'!F{r}=\"\",\"\",'02_Common_Member_Master'!F{r})",
    });
    for (let c = 1; c <= scRows[0].length; c++) scWs.getColumn(c).width = 22;

    // 10. Payment Voucher Register (Sheet 10)
    const vchRows = [
      [
        'Voucher No', 'SOC-Number', 'Society Name', 'Society Address', 'To (Payee)', 'Charge To',
        'Particulars', 'Bank Name', 'Cheque No', 'Voucher Date', 'Bill Amount', 'Adv. Less/Paid',
        'Sub Total 1', 'TDS %', 'TDS Amount', 'Sub Total 2', 'CGST %', 'CGST Amount',
        'Round Off (+/-)', 'Other (Fine/Adj)', 'Net Paid (Voucher)'
      ]
    ];
    const vchWs = wb.addWorksheet('10_Payment_Voucher', { views: [{ state: 'frozen', ySplit: 1 }] });
    vchRows.forEach(row => vchWs.addRow(row));
    this.styleWorksheetHeaders(vchWs, 1, vchRows[0].length);
    for (let c = 1; c <= vchRows[0].length; c++) vchWs.getColumn(c).width = 22;

    // 11. Notes & Rules (Sheet 11 — Documentation Only)
    const notesWs = wb.addWorksheet('Notes & Rules');
    NOTES_AND_RULES_ROWS.forEach(row => notesWs.addRow(row));
    this.styleWorksheetHeaders(notesWs, 1, 1);
    notesWs.getColumn(1).width = 110;

    const buffer = await wb.xlsx.writeBuffer();
    return toSafeBuffer(buffer);
  }

  /**
   * Parses an uploaded .xlsx/.xls workbook into a MasterWorkbook.
   * Preserves leading zeros, converts dates, normalizes blank cells.
   */
  static parseWorkbook(filePath: string): MasterWorkbook {
    let rawWb: XLSX.WorkBook;
    try {
      rawWb = XLSX.readFile(filePath, { cellDates: false, raw: false });
    } catch (err: any) {
      return {
        societyMaster: null,
        commonFile: [],
        formIData: [],
        formJData: [],
        shareData: [],
        nominationData: [],
        propertyData: [],
        bankLineMarkData: [],
        voucherData: [],
        loadedAt: new Date().toISOString(),
        fileName: getBasename(filePath),
        validationErrors: [`Failed to read workbook: ${err.message}`],
        validationWarnings: [],
      };
    }
    return this.parseXlsxWorkbook(rawWb, getBasename(filePath));
  }

  /**
   * Core parsing logic taking an already loaded XLSX WorkBook object.
   * Accessible in both main (Electron) and renderer (Web fallback) processes.
   */
  static parseXlsxWorkbook(rawWb: XLSX.WorkBook, fileName: string): MasterWorkbook {
    const smSheet = findSheet(rawWb, ['01_Society_Master', 'Society Master', 'Society_Master', 'SocietyMaster', 'Society']);
    const cfSheet = findSheet(rawWb, ['02_Common_Member_Master', 'Common Member Master', 'Common_Member_Master', 'Common File', 'Common_File', 'CommonFile', 'Common Field', 'Common_Field', 'CommonField', 'Common', 'Members', 'Member List', 'Master', 'Template', 'Sheet1']);
    const f1Sheet = findSheet(rawWb, ['03_Form_I', 'I Form', 'Form I', 'I form', 'I Form Data', 'FormI', 'FORM I', 'Form I Data', 'Form I Register', 'Form I Member Register']);
    const f2Sheet = findSheet(rawWb, ['04_Form_J', 'J Form', 'Form J', 'J form', 'J Form Data', 'FormJ', 'FORM J', 'Form J Data', 'Form J List', 'List of Members']);
    const srSheet = findSheet(rawWb, ['05_Share_Register', 'Share Register', 'Share_Register', 'ShareRegister', 'Share Data', 'Shares']);
    const nomSheet = findSheet(rawWb, ['06_Nomination_Register', 'Nomination Register', 'Nomination_Register', 'NominationRegister', 'Nomination Data', 'Nomination', 'Nominee']);
    const propSheet = findSheet(rawWb, ['07_Property_Register', 'Property Register', 'Property_Register', 'PropertyRegister', 'Property Data', 'Property']);
    const blmSheet = findSheet(rawWb, ['08_Lien_Mark_Register', 'Bank Line Mark Register', 'Lien Mark Register', 'Bank Line Mark', 'BankLineMark', 'Bank Lien Mark', 'Bank_Lien_Mark', 'BankLienMark', 'Bank Data', 'Lien Mark', 'Lien Mark Register']);
    const vchSheet = findSheet(rawWb, ['10_Payment_Voucher', '09_Voucher', 'Voucher', 'VOUCHER', 'Vouchers', 'Payment Voucher', 'Payment_Voucher', 'Voucher Register', 'Voucher_Register', 'Voucher Data']);

    const societyMaster = parseSocietyMaster(smSheet);
    let commonFile = parseCommonFile(cfSheet);

    if (commonFile.length === 0 && f1Sheet) {
      commonFile = parseCommonFile(f1Sheet);
    }

    const formIData = parseFormI(f1Sheet || cfSheet, commonFile);
    const formJData = parseFormJ(f2Sheet || cfSheet, commonFile);
    const shareData = parseShareRegister(srSheet || cfSheet, commonFile);
    const nominationData = parseNominationRegister(nomSheet || cfSheet, commonFile);
    const propertyData = parsePropertyRegister(propSheet || cfSheet, commonFile);
    const bankLineMarkData = parseBankLineMarkRegister(blmSheet || cfSheet, commonFile);
    const voucherData = parseVoucherRegister(vchSheet || (cfSheet && !smSheet && !f1Sheet ? cfSheet : (rawWb.Sheets[rawWb.SheetNames[0]] || null)));

    if (commonFile.length === 0) {
      const mergedMap = new Map<string, NormalizedMemberRecord>();
      const allSpecific = [...formIData, ...formJData, ...shareData, ...nominationData, ...propertyData, ...bankLineMarkData];
      for (const rec of allSpecific) {
        if (!rec.srNo) continue;
        const key = normalizeSerialKey(rec.srNo);
        const existing = mergedMap.get(key);
        mergedMap.set(key, { ...(existing || FormMappingService.createBlankRecord(rec.srNo)), ...rec });
      }
      commonFile = Array.from(mergedMap.values());
    }

    const warnings: string[] = [];
    if (!smSheet) warnings.push('Sheet "Society Master" not found.');
    if (!cfSheet && !f1Sheet && !vchSheet) warnings.push('Sheet "Common File" not found.');

    return {
      societyMaster,
      commonFile,
      formIData,
      formJData,
      shareData,
      nominationData,
      propertyData,
      bankLineMarkData,
      voucherData,
      loadedAt: new Date().toISOString(),
      fileName,
      validationErrors: [],
      validationWarnings: warnings,
    };
  }

  /** Detects module type from single uploaded Excel workbook */
  static detectModuleType(rawWb: XLSX.WorkBook): ModuleId | null {
    if (!rawWb || !rawWb.SheetNames || rawWb.SheetNames.length === 0) return null;

    for (const name of rawWb.SheetNames) {
      const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normName.includes('societymaster') || normName.includes('01society')) return 'SOCIETY_MASTER';
      if (normName.includes('commonmember') || normName.includes('02common') || normName.includes('commonfile')) return 'COMMON_MEMBER_MASTER';
      if (normName.includes('03formi') || normName.includes('formi') || normName.includes('iform')) return 'FORM_I';
      if (normName.includes('04formj') || normName.includes('formj') || normName.includes('jform')) return 'FORM_J';
      if (normName.includes('05shareregister') || normName.includes('shareregister')) return 'FORM_SHARE';
      if (normName.includes('06nomination') || normName.includes('nominationregister')) return 'FORM_NOM';
      if (normName.includes('07property') || normName.includes('propertyregister')) return 'FORM_PROP';
      if (normName.includes('08lien') || normName.includes('lienmark') || normName.includes('banklinemark')) return 'FORM_BANK';
      if (normName.includes('09sharecert') || normName.includes('sharecertificate')) return 'FORM_SHARE_CERT';
      if (normName.includes('10paymentvoucher') || normName.includes('voucher')) return 'FORM_VOUCHER';
    }

    const sheet = rawWb.Sheets[rawWb.SheetNames[0]];
    const rawAoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const headerStr = JSON.stringify(rawAoa.slice(0, 3)).toLowerCase();

    if (headerStr.includes('society registration name') || headerStr.includes('society name')) return 'SOCIETY_MASTER';
    if (headerStr.includes('value of one share') && headerStr.includes('address permanent')) return 'COMMON_MEMBER_MASTER';
    if (headerStr.includes('date of payment of entrance fee')) return 'FORM_I';
    if (headerStr.includes('class of member')) return 'FORM_J';
    if (headerStr.includes('distinguishing no') || headerStr.includes('share certificate no.')) return 'FORM_SHARE';
    if (headerStr.includes('subsequent revocation') || headerStr.includes('date of nomination')) return 'FORM_NOM';
    if (headerStr.includes('cost of tenement') || headerStr.includes('annual ground rent')) return 'FORM_PROP';
    if (headerStr.includes('date of loan sanction') || headerStr.includes('lien cancellation')) return 'FORM_BANK';
    if (headerStr.includes('old share certificate no') || headerStr.includes('memorandum of transfers')) return 'FORM_SHARE_CERT';
    if (headerStr.includes('voucher no') || headerStr.includes('charge to') || headerStr.includes('net paid')) return 'FORM_VOUCHER';

    return null;
  }

  /** Generates an individual template for a single module */
  static async generateIndividualTemplate(moduleId: ModuleId): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HENU OS Records Management';
    wb.lastModifiedBy = 'HENU OS Records Management';
    wb.created = new Date();

    const sheetMap: Record<ModuleId, { name: string; headers: unknown[][]; headerRows: number }> = {
      SOCIETY_MASTER: { name: '01_Society_Master', headers: SOCIETY_MASTER_FIELDS, headerRows: 1 },
      COMMON_MEMBER_MASTER: {
        name: '02_Common_Member_Master',
        headerRows: 2,
        headers: [
          ['Sr. No.', 'Membership No.', 'Share Certificate No.', 'No. of Shares', 'Value of One Share', 'Value of Shares', 'Share Certificate Range', '', 'Members Name Full', '', '', '', '', '', 'Address Permanent', '', 'Address Residential / Care of'],
          ['', '', '', '', '', '', 'From', 'To', '1', '2', '3', '4', '5', '6', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', 'New Address / As Above'],
        ]
      },
      FORM_I: {
        name: '03_Form_I',
        headerRows: 2,
        headers: getFormIHeaders(),
      },
      FORM_J: {
        name: '04_Form_J',
        headerRows: 2,
        headers: [
          ['Sr. No.', 'Members Name Full', '', '', '', '', '', 'Permanent Address', '', 'Class of Member'],
          ['', '1', '2', '3', '4', '5', '6', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', ''],
        ]
      },
      FORM_SHARE: {
        name: '05_Share_Register',
        headerRows: 2,
        headers: [
          ['Sr. No.', 'Members Name Full', '', '', '', '', '', 'No. of Shares', 'Share Certificate No.', 'Shares Value', 'Shares Range', '', 'Date of Allotment'],
          ['', '1', '2', '3', '4', '5', '6', '', '', '', 'From', 'To', ''],
        ]
      },
      FORM_NOM: {
        name: '06_Nomination_Register',
        headerRows: 2,
        headers: [
          ['Sr. No.', 'Member Name', '', '', '', '', '', 'Flat / Wing', '', 'Date of Nomination', 'Name/s of Nominee/s & Addresses of the Nominee/s', '', '', '', '', '', 'Percentage %', '', '', '', '', '', 'Managing Committee Meeting Date', 'Revocation Date', 'Remarks'],
          ['', '1', '2', '3', '4', '5', '6', 'Flat No.', 'Wing No.', '', '1', '2', '3', '4', '5', '6', '1', '2', '3', '4', '5', '6', '', '', ''],
        ]
      },
      FORM_PROP: {
        name: '07_Property_Register',
        headerRows: 2,
        headers: [
          ['Sr. No.', 'Name of Co-partner Member', '', '', '', '', '', 'Date of Possession', 'Distinguishing No. of Tenement', '', 'Description of Tenement', 'Area of Tenement', 'Cost of Tenement', '', 'Annual Ground Rent Rs.', 'Date of Cessation of Membership', 'Signature Chairman / Hon. Secretary', 'Remarks (Reason of Cessation / Transfer to Sr. No. and Date)'],
          ['', '1', '2', '3', '4', '5', '6', '', 'Flat No.', 'Floor No.', '', '', 'Land Rs.', 'Const. Rs.', '', '', '', ''],
        ]
      },
      FORM_BANK: {
        name: '08_Lien_Mark_Register',
        headerRows: 2,
        headers: [
          [
            'Sr. No.', 'Wing / Flat No.', '', 'Members Name', '', '', '', '', '', 'Flat Area', 'Type of Membership', 'Remarks',
            'PARTICULARS OF LOAN - 1st LOAN', '', '', '', '', '', '', '', '',
            'PARTICULARS OF LOAN - 2nd LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', '',
            'PARTICULARS OF LOAN - 3rd LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', '',
            'PARTICULARS OF LOAN - 4th LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', ''
          ],
          [
            '', 'Wing No.', 'Flat No.', '1', '2', '3', '4', '5', '6', '', '', '',
            'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
            'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
            'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
            'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks'
          ]
        ]
      },
      FORM_SHARE_CERT: {
        name: '09_Share_Certificate',
        headerRows: 2,
        headers: [
          [
            'Sr. No.', 'Share Certificate No.', 'No. of Shares', "Member's Register No.", 'Flat No.',
            'Authorised Capital Details', '', '',
            'Members Name Full (Ownership Details)', '', '',
            'Share Distinctive Numbers', '', 'Total Value of Shares Rs.',
            'In Lieu of Old Certificate', '',
            'MEMORANDUM OF TRANSFERS - 1st TRANSFER', '', '', '', '',
            'MEMORANDUM OF TRANSFERS - 2nd TRANSFER', '', '', '', '',
            'MEMORANDUM OF TRANSFERS - 3rd TRANSFER', '', '', '', '',
            'MEMORANDUM OF TRANSFERS - 4th TRANSFER', '', '', '', ''
          ],
          [
            '', '', '', '', '',
            'Authorised Share Capital Rs.', 'Total Authorised Shares', 'Value of One Share',
            '1st Owner', '2nd Owner', '3rd Owner',
            'From', 'To', '',
            'Old Share Certificate No.', 'Date of Issue',
            'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
            'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
            'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
            'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee'
          ]
        ]
      },
      FORM_VOUCHER: {
        name: '10_Payment_Voucher',
        headerRows: 1,
        headers: [
          [
            'Voucher No', 'SOC-Number', 'Society Name', 'Society Address', 'To (Payee)', 'Charge To',
            'Particulars', 'Bank Name', 'Cheque No', 'Voucher Date', 'Bill Amount', 'Adv. Less/Paid',
            'Sub Total 1', 'TDS %', 'TDS Amount', 'Sub Total 2', 'CGST %', 'CGST Amount',
            'Round Off (+/-)', 'Other (Fine/Adj)', 'Net Paid (Voucher)'
          ]
        ]
      },
    };

    const target = sheetMap[moduleId] || { name: 'Template', headers: [['Sr. No.']], headerRows: 1 };
    const ws = wb.addWorksheet(target.name, { views: [{ state: 'frozen', ySplit: target.headerRows }] });
    target.headers.forEach(row => ws.addRow(row));
    this.styleWorksheetHeaders(ws, target.headerRows, (target.headers[0] || []).length);
    for (let c = 1; c <= (target.headers[0] || []).length; c++) {
      ws.getColumn(c).width = moduleId === 'SOCIETY_MASTER' && c === 1 ? 45 : (moduleId === 'SOCIETY_MASTER' && c === 2 ? 60 : 22);
    }

    const buffer = await wb.xlsx.writeBuffer();
    return toSafeBuffer(buffer);
  }

  /** Exports the entire MasterWorkbook into a single unified Excel file */
  static async exportMasterWorkbook(masterWb: MasterWorkbook): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HENU OS Records Management';
    wb.lastModifiedBy = 'HENU OS Records Management';
    wb.created = new Date();

    const exportTable = (sheetName: string, headers: unknown[][], rows: unknown[][], headerRows = 2) => {
      const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: headerRows }] });
      headers.forEach(h => ws.addRow(h));
      rows.forEach(r => ws.addRow(r));
      const colCount = (headers[0] || rows[0] || []).length;
      this.styleWorksheetHeaders(ws, headerRows, colCount);
      for (let c = 1; c <= colCount; c++) ws.getColumn(c).width = 22;
    };

    // 1. Society Master
    const sm = masterWb.societyMaster;
    const smRows: unknown[][] = [
      ['1', 'Society Name', sm?.societyName || ''],
      ['2', 'Society Registration No.', sm?.registrationNo || ''],
      ['3', 'Society Registration Date', sm?.registrationDate || ''],
      ['4', 'Hedder Address', sm?.headerAddress || ''],
      ['5', 'Society Address', sm?.address || '', sm?.societyAddress?.line1 || '', sm?.societyAddress?.line2 || '', sm?.societyAddress?.line3 || '', sm?.societyAddress?.line4 || '', sm?.societyAddress?.line5 || '', sm?.societyAddress?.line6 || ''],
      ['6', 'Society Email Id', sm?.email || ''],
      ['7', 'Society Telephone or Mobile No.', sm?.telephone || ''],
      ['8', 'Total Unit', sm?.totalUnits || 0],
      ['', 'A) No. of Flat or Room', sm?.unitsFlat || 0],
      ['', 'B) No. Shop', sm?.unitsShop || 0],
      ['', 'C) No. Office', sm?.unitsOffice || 0],
      ['', 'D) No. Galas', sm?.unitsGala || 0],
      ['9', 'No. of Print Blank (EXTRA SR. No.)', sm?.printBlanks || 0],
      ['10', 'Total Unit', sm?.totalUnits || 0],
    ];
    const smWs = wb.addWorksheet('01_Society_Master', { views: [{ state: 'frozen', ySplit: 1 }] });
    smWs.addRow(SOCIETY_MASTER_FIELDS[0]);
    smRows.forEach(r => smWs.addRow(r));
    this.styleWorksheetHeaders(smWs, 1, 3);
    smWs.getColumn(1).width = 45;
    smWs.getColumn(2).width = 60;

    // 2. Common Member Master
    const cfHeaders = [
      ['Sr. No.', 'Membership No.', 'Share Certificate No.', 'No. of Shares', 'Value of One Share', 'Value of Shares', 'Share Certificate Range', '', 'Members Name Full', '', '', '', '', '', 'Address Permanent', '', 'Address Residential / Care of'],
      ['', '', '', '', '', '', 'From', 'To', '1', '2', '3', '4', '5', '6', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', 'New Address / As Above'],
    ];
    const cfRows = masterWb.commonFile.map(m => [
      m.srNo, m.membershipNo, m.shareCertificateNo, m.noOfShares, m.valueOfOneShare, m.valueOfShares,
      m.sharesFrom, m.sharesTo, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
      m.flatNo, m.wingNo, m.residentialAddress,
    ]);
    exportTable('02_Common_Member_Master', cfHeaders, cfRows, 2);

    // 3. Form I
    const f1Headers = getFormIHeaders();
    const f1Rows = masterWb.commonFile.map(m => {
      const row: unknown[] = [
        m.srNo, m.dateOfAdmission, m.dateOfEntranceFee, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
        m.flatNo, m.wingNo, m.residentialAddress, m.occupation, m.age, m.nominee1 || m.nomineeName, m.nominee2, m.nominee3, m.nominee4, m.nominee5, m.nominee6,
        m.dateOfNomination, m.dateOfCessation, m.reasonForCessation, m.remarks,
      ];
      // 5 entries for Shares Held
      for (let i = 0; i < 5; i++) {
        const sh = m.sharesHeldEntries?.[i] || (i === 0 ? {
          date: m.dateOfAllotment,
          cashBookFolio: m.cashBookFolio,
          application: m.shareApplication,
          allotment: m.shareAllotment,
          call1st: m.share1stCall,
          call2nd: m.share2ndCall,
          totalAmountReceived: m.totalAmountReceived,
          noOfShares: m.noOfShares,
          sharesFrom: m.sharesFrom,
          sharesTo: m.sharesTo,
          shareCertificateNo: m.serialNoOfShareCertificate || m.shareCertificateNo,
        } : null);
        row.push(
          sh?.date || '',
          sh?.cashBookFolio || '',
          sh?.application || '',
          sh?.allotment || '',
          sh?.call1st || '',
          sh?.call2nd || '',
          sh?.totalAmountReceived || '',
          sh?.noOfShares || '',
          sh?.sharesFrom || '',
          sh?.sharesTo || '',
          sh?.shareCertificateNo || ''
        );
      }
      // 5 entries for Shares Transferred
      for (let i = 0; i < 5; i++) {
        const st = m.sharesTransferredEntries?.[i] || (i === 0 ? {
          date: m.dateOfTransferRefund || m.transferDate,
          cashBookFolio: m.transferCashBookFolio || m.cashBookFolio,
          transferDate: m.transferDate,
          shareCertificateNo: m.shareCertTransferred || m.transferCertificateNo,
          noOfSharesTransferred: m.noOfSharesTransferredRefunded || m.noOfSharesTransferred,
          balanceNoOfShares: m.balanceNoOfShares,
          balanceSerialNoCertificate: m.balanceSerialNoCertificate,
          amountRs: m.balanceAmountRs,
          amountP: '',
        } : null);
        row.push(
          st?.date || '',
          st?.cashBookFolio || '',
          st?.transferDate || '',
          st?.shareCertificateNo || '',
          st?.noOfSharesTransferred || '',
          st?.balanceNoOfShares || '',
          st?.balanceSerialNoCertificate || '',
          st?.amountRs || '',
          st?.amountP || ''
        );
      }
      return row;
    });
    exportTable('03_Form_I', f1Headers, f1Rows, 2);

    // 4. Form J
    const f2Headers = [
      ['Sr. No.', 'Members Name Full', '', '', '', '', '', 'Permanent Address', '', 'Class of Member'],
      ['', '1', '2', '3', '4', '5', '6', 'Flat/Room/Shop/Office/Gala No.', 'Wing No.', ''],
    ];
    const f2Rows = masterWb.commonFile.map(m => [
      m.srNo, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
      m.flatNo, m.wingNo, m.classOfMember,
    ]);
    exportTable('04_Form_J', f2Headers, f2Rows, 2);

    // 5. Share Register
    const srHeaders = [
      ['Sr. No.', 'Members Name Full', '', '', '', '', '', 'No. of Shares', 'Share Certificate No.', 'Shares Value', 'Shares Range', '', 'Date of Allotment'],
      ['', '1', '2', '3', '4', '5', '6', '', '', '', 'From', 'To', ''],
    ];
    const srRows = masterWb.commonFile.map(m => [
      m.srNo, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
      m.noOfShares, m.shareCertificateNo, m.valueOfShares, m.sharesFrom, m.sharesTo, m.dateOfAllotment,
    ]);
    exportTable('05_Share_Register', srHeaders, srRows, 2);

    // 6. Nomination Register
    const nomHeaders = [
      ['Sr. No.', 'Member Name', '', '', '', '', '', 'Flat / Wing', '', 'Date of Nomination', 'Name/s of Nominee/s & Addresses of the Nominee/s', '', '', '', '', '', 'Percentage %', '', '', '', '', '', 'Managing Committee Meeting Date', 'Revocation Date', 'Remarks'],
      ['', '1', '2', '3', '4', '5', '6', 'Flat No.', 'Wing No.', '', '1', '2', '3', '4', '5', '6', '1', '2', '3', '4', '5', '6', '', '', ''],
    ];
    const nomRows = masterWb.commonFile.map(m => [
      m.srNo, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
      m.flatNo, m.wingNo, m.dateOfNomination,
      m.nominee1 || m.nomineeName, m.nominee2, m.nominee3, m.nominee4, m.nominee5, m.nominee6,
      '100%', '', '', '', '', '',
      '', m.subsequentRevocation, m.remarks,
    ]);
    exportTable('06_Nomination_Register', nomHeaders, nomRows, 2);

    // 7. Property Register
    const propHeaders = [
      ['Sr. No.', 'Name of Co-partner Member', '', '', '', '', '', 'Date of Possession', 'Distinguishing No. of Tenement', '', 'Description of Tenement', 'Area of Tenement', 'Cost of Tenement', '', 'Annual Ground Rent Rs.', 'Date of Cessation of Membership', 'Signature Chairman / Hon. Secretary', 'Remarks (Reason of Cessation / Transfer to Sr. No. and Date)'],
      ['', '1', '2', '3', '4', '5', '6', '', 'Flat No.', 'Floor No.', '', '', 'Land Rs.', 'Const. Rs.', '', '', '', ''],
    ];
    const propRows = masterWb.commonFile.map(m => [
      m.srNo, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
      m.dateOfPossession, m.flatNo, '', m.descriptionOfTenement, m.area, '', '', m.annualGroundRent,
      m.dateOfCessation, '', m.remarks,
    ]);
    exportTable('07_Property_Register', propHeaders, propRows, 2);

    // 8. Lien Mark Register
    const blmHeaders = [
      [
        'Sr. No.', 'Wing / Flat No.', '', 'Members Name', '', '', '', '', '', 'Flat Area', 'Type of Membership', 'Remarks',
        'PARTICULARS OF LOAN - 1st LOAN', '', '', '', '', '', '', '', '',
        'PARTICULARS OF LOAN - 2nd LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', '',
        'PARTICULARS OF LOAN - 3rd LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', '',
        'PARTICULARS OF LOAN - 4th LOAN OR LOAN TOP-UP', '', '', '', '', '', '', '', ''
      ],
      [
        '', 'Wing No.', 'Flat No.', '1', '2', '3', '4', '5', '6', '', '', '',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks',
        'Name of the Bank', 'Bank Address', 'Loan Amount', 'Period of Loan', 'Managing Committee Meeting Date', 'Resolution No.', 'Date of NOC given by Society', 'Date of Documents of Lien Cancellation', 'Remarks'
      ]
    ];
    const blmRows = masterWb.commonFile.map(m => [
      m.srNo, m.wingNo, m.flatNo, m.member1 || m.memberName, m.member2, m.member3, m.member4, m.member5, m.member6,
      m.area, 'Ordinary', '',
      m.bankName, m.bankAddress, m.loanAmount, m.loanPeriod, '', '', '', m.dateOfLienCancellation, '',
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
    ]);
    exportTable('08_Lien_Mark_Register', blmHeaders, blmRows, 2);

    // 9. Share Certificate
    const scHeaders = [
      [
        'Sr. No.', 'Share Certificate No.', 'No. of Shares', "Member's Register No.", 'Flat No.',
        'Authorised Capital Details', '', '',
        'Members Name Full (Ownership Details)', '', '',
        'Share Distinctive Numbers', '', 'Total Value of Shares Rs.',
        'In Lieu of Old Certificate', '',
        'MEMORANDUM OF TRANSFERS - 1st TRANSFER', '', '', '', '',
        'MEMORANDUM OF TRANSFERS - 2nd TRANSFER', '', '', '', '',
        'MEMORANDUM OF TRANSFERS - 3rd TRANSFER', '', '', '', '',
        'MEMORANDUM OF TRANSFERS - 4th TRANSFER', '', '', '', ''
      ],
      [
        '', '', '', '', '',
        'Authorised Share Capital Rs.', 'Total Authorised Shares', 'Value of One Share',
        '1st Owner', '2nd Owner', '3rd Owner',
        'From', 'To', '',
        'Old Share Certificate No.', 'Date of Issue',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee',
        'Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transfered', 'Register No. of transferee'
      ]
    ];
    const scRows = masterWb.commonFile.map(m => [
      m.srNo, m.shareCertificateNo, m.noOfShares, m.membershipNo, m.flatNo,
      '', '', m.valueOfOneShare,
      m.member1 || m.memberName, m.member2, m.member3,
      m.sharesFrom, m.sharesTo, m.valueOfShares,
      '', '',
      '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', '', ''
    ]);
    exportTable('09_Share_Certificate', scHeaders, scRows, 2);

    // 10. Voucher Register
    const vchHeaders = [
      [
        'Voucher No', 'SOC-Number', 'Society Name', 'Society Address', 'To (Payee)', 'Charge To',
        'Particulars', 'Bank Name', 'Cheque No', 'Voucher Date', 'Bill Amount', 'Adv. Less/Paid',
        'Sub Total 1', 'TDS %', 'TDS Amount', 'Sub Total 2', 'CGST %', 'CGST Amount',
        'Round Off (+/-)', 'Other (Fine/Adj)', 'Net Paid (Voucher)'
      ]
    ];
    const vchRows = (masterWb.voucherData || []).map(v => [
      v.voucherNo, v.socNumber, v.societyName, v.societyAddress, v.toPayee, v.chargeTo,
      v.particulars, v.bankName, v.chequeNo, v.voucherDate, v.billAmount, v.advLessPaid,
      v.subTotal1, v.tdsPercent, v.tdsAmount, v.subTotal2, v.cgstPercent, v.cgstAmount,
      v.roundOff, v.otherFineAdj, v.netPaid,
    ]);
    exportTable('10_Payment_Voucher', vchHeaders, vchRows, 1);

    const buffer = await wb.xlsx.writeBuffer();
    return toSafeBuffer(buffer);
  }

  /** Exports a single module into an Excel file */
  static async exportIndividualModule(masterWb: MasterWorkbook, moduleId: ModuleId | string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HENU OS Records Management';
    wb.lastModifiedBy = 'HENU OS Records Management';
    wb.created = new Date();

    const fullBuffer = await this.exportMasterWorkbook(masterWb);
    const fullWb = new ExcelJS.Workbook();
    await fullWb.xlsx.load(fullBuffer as any);

    const sheetNameMap: Record<string, string> = {
      SOCIETY_MASTER: '01_Society_Master',
      COMMON_MEMBER_MASTER: '02_Common_Member_Master',
      FORM_I: '03_Form_I',
      FORM_J: '04_Form_J',
      FORM_SHARE: '05_Share_Register',
      FORM_NOM: '06_Nomination_Register',
      FORM_PROP: '07_Property_Register',
      FORM_BANK: '08_Lien_Mark_Register',
      FORM_SHARE_CERT: '09_Share_Certificate',
      FORM_VOUCHER: '10_Payment_Voucher',
      '01_Society_Master': '01_Society_Master',
      '02_Common_Member_Master': '02_Common_Member_Master',
      '03_Form_I': '03_Form_I',
      '04_Form_J': '04_Form_J',
      '05_Share_Register': '05_Share_Register',
      '06_Nomination_Register': '06_Nomination_Register',
      '07_Property_Register': '07_Property_Register',
      '08_Lien_Mark_Register': '08_Lien_Mark_Register',
      '09_Share_Certificate': '09_Share_Certificate',
      '10_Voucher': '10_Payment_Voucher',
      '10_Payment_Voucher': '10_Payment_Voucher',
      formI: '03_Form_I',
      formJ: '04_Form_J',
      share: '05_Share_Register',
      nomination: '06_Nomination_Register',
      property: '07_Property_Register',
      bankLineMark: '08_Lien_Mark_Register',
      shareCert: '09_Share_Certificate',
      voucher: '10_Payment_Voucher',
    };

    const targetName = sheetNameMap[moduleId] || sheetNameMap[String(moduleId).toUpperCase()] || '02_Common_Member_Master';
    const sourceWs = fullWb.getWorksheet(targetName);
    if (sourceWs) {
      const destWs = wb.addWorksheet(targetName, { views: sourceWs.views });
      sourceWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const destRow = destWs.getRow(rowNumber);
        destRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const destCell = destRow.getCell(colNumber);
          destCell.value = cell.value;
          destCell.style = cell.style;
        });
      });
      sourceWs.columns?.forEach((col, idx) => {
        if (col.width) destWs.getColumn(idx + 1).width = col.width;
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return toSafeBuffer(buffer);
  }
}
