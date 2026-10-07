/**
 * HENU VOUCHER OCR — VOUCHER PARSER SERVICE (Main Process)
 * Module: Main Services
 *
 * Self-contained main-process service that:
 *   1. Receives voucher images via IPC or HTTP
 *   2. Routes to HENU AI USB via HenuAiEngineManager
 *   3. Maps USB response to Google Sheets 25-column schema
 *   4. Performs mathematical verification
 *
 * This file is entirely within src/main/services/ to comply
 * with the tsconfig.main.json rootDir constraint.
 *
 * Architecture:
 *   Image → HenuAiEngineManager → USB OCR → VoucherParserService (mapping + math) → Google Sheets JSON
 */

import crypto from 'crypto';
import http from 'http';
import { HenuAiEngineManager } from './HenuAiEngineManager';

// ═══════════════════════════════════════════════════
// Google Sheets Row Schema (exact 25-column match)
// ═══════════════════════════════════════════════════

export interface VoucherParserSheetRow {
  'Scraping Timestamp': string;
  'Voucher No': string;
  'SOC-Number': string;
  'Society Name': string;
  'Society Address': string;
  'To (Payee)': string;
  'Charge To': string;
  'Particulars': string;
  'Bank Name': string;
  'Cheque No': string;
  'Voucher Date': string;
  'Bill Amount': number | null;
  'Adv. Less/Paid': number | null;
  'Sub Total 1': number | null;
  'TDS %': number | null;
  'TDS Amount': number | null;
  'Sub Total 2': number | null;
  'CGST %': number | null;
  'CGST Amount': number | null;
  'Round Off (+/-)': number | null;
  'Other (Fine/Adj)': number | null;
  'Net Paid (Voucher)': number | null;
  'Calculated Net Paid': number | null;
  'Verification Status': string;
  'Discrepancy Notes': string;
}

export const VOUCHER_PARSER_COLUMN_ORDER: (keyof VoucherParserSheetRow)[] = [
  'Scraping Timestamp', 'Voucher No', 'SOC-Number', 'Society Name', 'Society Address',
  'To (Payee)', 'Charge To', 'Particulars', 'Bank Name', 'Cheque No', 'Voucher Date',
  'Bill Amount', 'Adv. Less/Paid', 'Sub Total 1', 'TDS %', 'TDS Amount', 'Sub Total 2',
  'CGST %', 'CGST Amount', 'Round Off (+/-)', 'Other (Fine/Adj)',
  'Net Paid (Voucher)', 'Calculated Net Paid', 'Verification Status', 'Discrepancy Notes',
];

// ═══════════════════════════════════════════════════
// Internal-to-Sheet Key Mapping
// ═══════════════════════════════════════════════════

const INTERNAL_TO_SHEET: Record<string, keyof VoucherParserSheetRow> = {
  society_name: 'Society Name',
  registration_no: 'SOC-Number',
  society_address: 'Society Address',
  voucher_no: 'Voucher No',
  voucher_date: 'Voucher Date',
  pay_to: 'To (Payee)',
  charge_to: 'Charge To',
  particulars: 'Particulars',
  bill_amount_1: 'Bill Amount',
  advance_paid: 'Adv. Less/Paid',
  total_1: 'Sub Total 1',
  tds_percentage: 'TDS %',
  tds_amount: 'TDS Amount',
  total_2: 'Sub Total 2',
  bank_name: 'Bank Name',
  cheque_no: 'Cheque No',
  cgst_percentage: 'CGST %',
  cgst_amount: 'CGST Amount',
  round_off: 'Round Off (+/-)',
  other_fine_adj: 'Other (Fine/Adj)',
  net_paid: 'Net Paid (Voucher)',
};

// Field aliases for USB response key matching
const FIELD_ALIASES: Record<string, string[]> = {
  bill_amount_1: ['bill_amount', 'bill_amount_1', 'bill_1', 'amount_1'],
  advance_paid: ['advance_amount', 'advance_paid', 'advance'],
  total_1: ['gross_amount', 'total_1', 'subtotal_1', 'total1'],
  tds_percentage: ['tds_percent', 'tds_percentage', 'tds_pct'],
  tds_amount: ['tds_amount', 'tds'],
  total_2: ['subtotal_2', 'total_2', 'total2'],
  pay_to: ['member_name', 'pay_to', 'payee', 'paid_to'],
  charge_to: ['account_head', 'charge_to', 'debit_to'],
  particulars: ['narration', 'particulars', 'description'],
  cheque_no: ['transaction_number', 'cheque_no', 'cheque_number', 'chq_no', 'ref_no'],
  voucher_date: ['date', 'voucher_date'],
  voucher_no: ['voucher_no', 'vch_no', 'voucher_number'],
  other_fine_adj: ['other_fine_adj', 'fine', 'penalty', 'adjustment', 'other_deduction'],
  net_paid: ['net_paid', 'net_amount', 'final_amount'],
};

// ═══════════════════════════════════════════════════
// Response Interfaces
// ═══════════════════════════════════════════════════

export interface VoucherParserResponse {
  success: boolean;
  sheetRow?: VoucherParserSheetRow;
  sheetArray?: (string | number | null)[];
  columnHeaders?: string[];
  evidence?: Record<string, any>;
  metadata?: {
    job_id: string;
    image_sha256: string;
    processed_at: string;
    engine: string;
    workers_executed: string[];
    source_file: string;
  };
  rawText?: string;
  warnings?: string[];
  error?: string;
  errorCategory?: string;
}

// ═══════════════════════════════════════════════════
// Main Service Class
// ═══════════════════════════════════════════════════

export class VoucherParserService {
  /**
   * Process a voucher image through HENU AI USB and return Google Sheets-ready data.
   */
  public static async processImage(payload: {
    base64Image: string;
    fileName?: string;
    languages?: string[];
  }): Promise<VoucherParserResponse> {
    const engineManager = HenuAiEngineManager.getInstance();

    // 1. Validate USB
    const auth = engineManager.validateOcrAuthorization();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason,
        errorCategory: auth.reason.includes('NOT CONNECTED') ? 'USB_NOT_CONNECTED' : 'ENGINE_NOT_READY',
      };
    }

    // 2. Image SHA-256
    const cleanBase64 = payload.base64Image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const imageSha256 = crypto.createHash('sha256').update(cleanBase64).digest('hex');
    const fileName = payload.fileName || 'voucher.jpg';
    const languages = payload.languages || ['eng'];

    // 3. Send to USB HENU AI
    let usbResult: any;
    try {
      usbResult = await engineManager.processVoucher({ base64Image: cleanBase64, fileName, languages });
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'HENU AI USB Engine communication failure',
        errorCategory: 'OCR_FAILED',
      };
    }

    if (!usbResult || typeof usbResult !== 'object') {
      return { success: false, error: 'HENU AI USB returned empty response', errorCategory: 'OCR_FAILED' };
    }

    // 4. Map USB response to Google Sheets schema
    const warnings: string[] = [];
    const sheetRow = this.mapToSheetRow(usbResult, warnings);
    const evidence = this.buildEvidence(usbResult);

    // 5. Mathematical verification
    const { calculatedNetPaid, verificationStatus, discrepancyNotes } =
      this.performMathVerification(sheetRow, warnings);
    sheetRow['Calculated Net Paid'] = calculatedNetPaid;
    sheetRow['Verification Status'] = verificationStatus;
    sheetRow['Discrepancy Notes'] = discrepancyNotes;

    // 6. Build metadata
    const executedModels = usbResult.models_executed
      || (usbResult.model_selected ? [usbResult.model_selected] : ['HENU_AI']);

    return {
      success: true,
      sheetRow,
      sheetArray: VOUCHER_PARSER_COLUMN_ORDER.map(col => sheetRow[col] ?? null),
      columnHeaders: [...VOUCHER_PARSER_COLUMN_ORDER],
      evidence,
      metadata: {
        job_id: usbResult.job_id || `vp-${Date.now()}`,
        image_sha256: imageSha256,
        processed_at: new Date().toISOString(),
        engine: 'HENU_AI_USB',
        workers_executed: executedModels,
        source_file: fileName,
      },
      rawText: this.extractRawText(usbResult),
      warnings,
    };
  }

  /**
   * Maps raw USB result to the 25-column Google Sheets schema.
   */
  private static mapToSheetRow(usbResult: any, warnings: string[]): VoucherParserSheetRow {
    const row: VoucherParserSheetRow = {
      'Scraping Timestamp': new Date().toISOString(),
      'Voucher No': '', 'SOC-Number': '', 'Society Name': '', 'Society Address': '',
      'To (Payee)': '', 'Charge To': '', 'Particulars': '', 'Bank Name': '',
      'Cheque No': '', 'Voucher Date': '',
      'Bill Amount': null, 'Adv. Less/Paid': null, 'Sub Total 1': null,
      'TDS %': null, 'TDS Amount': null, 'Sub Total 2': null,
      'CGST %': null, 'CGST Amount': null, 'Round Off (+/-)': null,
      'Other (Fine/Adj)': null, 'Net Paid (Voucher)': null,
      'Calculated Net Paid': null, 'Verification Status': '', 'Discrepancy Notes': '',
    };

    // Source dictionaries from USB response
    const ext26 = usbResult.extracted_fields_26 || {};
    const v = usbResult.voucher || {};
    const f = usbResult.fields || {};

    const findValue = (key: string): any => {
      const aliases = FIELD_ALIASES[key] || [key];
      const sources = [ext26, f, v];
      for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        // Direct key
        if (src[key] !== undefined) return this.unwrapField(src[key]);
        // Aliases
        for (const alias of aliases) {
          if (src[alias] !== undefined) return this.unwrapField(src[alias]);
        }
      }
      return undefined;
    };

    // Map each internal field to its sheet column
    for (const [internalKey, sheetKey] of Object.entries(INTERNAL_TO_SHEET)) {
      const val = findValue(internalKey);
      if (val === undefined || val === null || val === '') continue;

      // Apply negative filters
      if (internalKey === 'pay_to') {
        if (/^(?:TOTAL|PAID\s*TOTAL|TAL|CASH|CHEQUE|DEBIT|RS\.?|RUPEES)$/i.test(String(val).trim())) {
          continue;
        }
      }

      // Monetary fields: reject % tokens
      const monetaryFields = ['bill_amount_1', 'advance_paid', 'total_1', 'total_2',
        'tds_amount', 'cgst_amount', 'round_off', 'other_fine_adj', 'net_paid'];
      if (monetaryFields.includes(internalKey) && String(val).includes('%')) {
        continue;
      }

      // Assign to sheet row
      const isNumericSheet = typeof row[sheetKey] === 'number' || row[sheetKey] === null;
      if (isNumericSheet && sheetKey !== 'Voucher No' && sheetKey !== 'Cheque No' && sheetKey !== 'SOC-Number') {
        const num = this.parseNumber(val);
        if (num !== null) {
          (row as any)[sheetKey] = num;
        }
      } else {
        (row as any)[sheetKey] = String(val).trim();
      }
    }

    // Format Voucher Date for display (DDMMYYYY → DD/MM/YYYY)
    if (row['Voucher Date']) {
      const dateStr = row['Voucher Date'].replace(/[^0-9]/g, '');
      if (dateStr.length === 8) {
        row['Voucher Date'] = `${dateStr.substring(0, 2)}/${dateStr.substring(2, 4)}/${dateStr.substring(4, 8)}`;
      }
    }

    // Extract Fine/Adj from raw text if not found in structured fields
    if (row['Other (Fine/Adj)'] === null) {
      const rawText = this.extractRawText(usbResult);
      const fineMatch = rawText.match(/(?:FINE|PENALTY|ADJUSTMENT|LESS\s*FINE)[^0-9]*(-?\d[\d,]*\.?\d*)/i);
      if (fineMatch && fineMatch[1]) {
        const cleanAmt = fineMatch[1].replace(/,/g, '');
        const parsed = parseFloat(cleanAmt);
        if (!isNaN(parsed) && parsed !== 0) {
          const isDeduction = /(?:LESS|DEDUCTION|FINE|PENALTY)/i.test(rawText.substring(
            Math.max(0, (rawText.search(/(?:FINE|PENALTY)/i) || 0) - 20),
            (rawText.search(/(?:FINE|PENALTY)/i) || 0) + 60
          )) && !/ADD/i.test(rawText.substring(
            Math.max(0, (rawText.search(/(?:FINE|PENALTY)/i) || 0) - 10),
            (rawText.search(/(?:FINE|PENALTY)/i) || 0) + 10
          ));
          row['Other (Fine/Adj)'] = isDeduction && parsed > 0 ? -parsed : parsed;
        }
      }
    }

    return row;
  }

  /**
   * Unwraps a field from various USB response formats.
   */
  private static unwrapField(item: any): any {
    if (item === undefined || item === null) return undefined;
    if (typeof item === 'object') {
      return item.value ?? item.val ?? item.normalizedValue ?? item.raw ?? item.rawValue ?? null;
    }
    return item;
  }

  /**
   * Parses a value to a number, handling currency formatting.
   */
  private static parseNumber(val: any): number | null {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return null;
    const str = String(val)
      .replace(/[₹$€£]/g, '')
      .replace(/Rs\.?/gi, '')
      .replace(/INR/gi, '')
      .replace(/,/g, '')
      .trim();
    if (!str || /^[a-zA-Z\s]+$/.test(str)) return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
  }

  /**
   * Extracts consolidated raw OCR text from USB response.
   */
  private static extractRawText(usbResult: any): string {
    let text = usbResult.raw_ocr?.full_text || usbResult.rawText || usbResult.raw_text || '';
    if (!text && usbResult.engine_results) {
      const parts: string[] = [];
      for (const eng of Object.values(usbResult.engine_results as Record<string, any>)) {
        if (eng && typeof eng === 'object') {
          if ((eng as any).raw_text) parts.push((eng as any).raw_text);
          else if ((eng as any).text) parts.push((eng as any).text);
        }
      }
      text = parts.join('\n\n');
    }
    return text;
  }

  /**
   * Builds field evidence from USB response.
   */
  private static buildEvidence(usbResult: any): Record<string, any> {
    const evidence: Record<string, any> = {};
    const ext26 = usbResult.extracted_fields_26 || {};
    const f = usbResult.fields || {};
    const v = usbResult.voucher || {};

    for (const [internalKey, sheetKey] of Object.entries(INTERNAL_TO_SHEET)) {
      const aliases = FIELD_ALIASES[internalKey] || [internalKey];
      let found: any = null;
      for (const src of [ext26, f, v]) {
        if (!src) continue;
        if (src[internalKey]) { found = src[internalKey]; break; }
        for (const alias of aliases) {
          if (src[alias]) { found = src[alias]; break; }
        }
        if (found) break;
      }
      evidence[sheetKey] = {
        value: found ? this.unwrapField(found) : null,
        confidence: found?.confidence ?? (found ? 85 : 0),
        evidence: found?.evidence || found?.raw_evidence || found?.rawValue || '',
        source: found?.source || usbResult.ai_engine || 'HENU AI',
        status: found ? 'EXTRACTED' : 'NOT_FOUND',
      };
    }
    return evidence;
  }

  /**
   * Mathematical verification: compare calculated net paid vs voucher's stated net paid.
   */
  private static performMathVerification(
    row: VoucherParserSheetRow,
    warnings: string[]
  ): { calculatedNetPaid: number | null; verificationStatus: string; discrepancyNotes: string } {
    const bill = row['Bill Amount'];
    const adv = row['Adv. Less/Paid'];
    const sub1 = row['Sub Total 1'];
    const tdsPct = row['TDS %'];
    const tdsAmt = row['TDS Amount'];
    const sub2 = row['Sub Total 2'];
    const cgst = row['CGST Amount'];
    const roundOff = row['Round Off (+/-)'];
    const otherFine = row['Other (Fine/Adj)'];
    const netVoucher = row['Net Paid (Voucher)'];

    let calcNet: number | null = null;

    // Strategy 1: Sub Total 2 available
    if (sub2 !== null) {
      calcNet = sub2;
      if (cgst !== null) calcNet += cgst;
      if (roundOff !== null) calcNet += roundOff;
      if (otherFine !== null) calcNet += otherFine;
    }
    // Strategy 2: Sub Total 1 + TDS Amount
    else if (sub1 !== null && tdsAmt !== null) {
      calcNet = sub1 - tdsAmt;
      if (cgst !== null) calcNet += cgst;
      if (roundOff !== null) calcNet += roundOff;
      if (otherFine !== null) calcNet += otherFine;
    }
    // Strategy 3: Bill Amount chain
    else if (bill !== null) {
      calcNet = bill;
      if (adv !== null) calcNet -= adv;
      if (tdsAmt !== null) calcNet -= tdsAmt;
      if (cgst !== null) calcNet += cgst;
      if (roundOff !== null) calcNet += roundOff;
      if (otherFine !== null) calcNet += otherFine;
    }

    if (calcNet !== null) calcNet = Math.round(calcNet * 100) / 100;

    // TDS consistency check
    if (tdsPct !== null && tdsAmt !== null) {
      const base = sub1 ?? bill;
      if (base !== null && base > 0) {
        const expected = Math.round(base * (tdsPct / 100) * 100) / 100;
        const diff = Math.abs(expected - tdsAmt);
        if (diff > 1) {
          warnings.push(`TDS: Expected ₹${expected} (${tdsPct}% of ₹${base}), found ₹${tdsAmt}`);
        }
      }
    }

    // Compare
    let status = '';
    let notes = '';

    if (calcNet === null && netVoucher === null) {
      status = 'REVIEW_REQUIRED';
      notes = 'Insufficient data for mathematical verification.';
    } else if (calcNet === null) {
      status = 'REVIEW_REQUIRED';
      notes = 'Cannot calculate Net Paid — insufficient financial components.';
    } else if (netVoucher === null) {
      status = 'REVIEW_REQUIRED';
      notes = `Calculated Net Paid = ₹${calcNet}, but Net Paid not found on voucher.`;
    } else {
      const diff = Math.round(Math.abs(calcNet - netVoucher) * 100) / 100;
      if (diff <= 1) {
        status = 'Verified ✔️';
        notes = 'Mathematically Accurate';
      } else {
        status = 'Issue ❌';
        notes = `Mismatch of ₹${diff}. Calculated: ₹${calcNet}, Voucher: ₹${netVoucher}`;
      }
    }

    return { calculatedNetPaid: calcNet, verificationStatus: status, discrepancyNotes: notes };
  }

  /**
   * Get column headers for sheet setup.
   */
  public static getColumnHeaders(): string[] {
    return [...VOUCHER_PARSER_COLUMN_ORDER];
  }

  /**
   * Get engine status.
   */
  public static getEngineStatus(): any {
    return HenuAiEngineManager.getInstance().getStatusReport();
  }
}

// ═══════════════════════════════════════════════════
// Local HTTP API Server for External Automation
// ═══════════════════════════════════════════════════

const MAX_BODY_SIZE = 50 * 1024 * 1024;
let httpServer: http.Server | null = null;
let activePort = 0;

export function startVoucherParserApiServer(port: number = 8090): Promise<number> {
  return new Promise((resolve, reject) => {
    if (httpServer) { resolve(activePort); return; }

    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      const url = req.url || '/';
      try {
        if (req.method === 'GET' && url === '/api/health') {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok', service: 'HENU VoucherParser API', timestamp: new Date().toISOString() }));
          return;
        }
        if (req.method === 'GET' && url === '/api/voucher-parse/columns') {
          res.writeHead(200);
          res.end(JSON.stringify({ columns: VoucherParserService.getColumnHeaders() }));
          return;
        }
        if (req.method === 'GET' && url === '/api/voucher-parse/status') {
          res.writeHead(200);
          res.end(JSON.stringify(VoucherParserService.getEngineStatus()));
          return;
        }
        if (req.method === 'POST' && url === '/api/voucher-parse') {
          const body = await readBody(req);
          let payload: any;
          try { payload = JSON.parse(body); } catch {
            res.writeHead(400); res.end(JSON.stringify({ success: false, error: 'Invalid JSON' })); return;
          }
          if (!payload.base64Image) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Missing base64Image' }));
            return;
          }
          const result = await VoucherParserService.processImage(payload);
          res.writeHead(result.success ? 200 : 500);
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found', endpoints: {
          'POST /api/voucher-parse': 'Process voucher image',
          'GET /api/voucher-parse/columns': 'Column headers',
          'GET /api/voucher-parse/status': 'Engine status',
          'GET /api/health': 'Health check',
        }}));
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });

    server.listen(port, '127.0.0.1', () => {
      httpServer = server; activePort = port;
      console.log(`[VoucherParser API] Started on http://127.0.0.1:${port}`);
      resolve(port);
    });
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        server.close();
        startVoucherParserApiServer(port + 1).then(resolve).catch(reject);
      } else { reject(err); }
    });
  });
}

export function stopVoucherParserApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (httpServer) { httpServer.close(() => { httpServer = null; activePort = 0; resolve(); }); }
    else { resolve(); }
  });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) { req.destroy(); reject(new Error('Body too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
