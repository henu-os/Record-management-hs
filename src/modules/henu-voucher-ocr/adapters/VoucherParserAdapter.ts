/**
 * HENU VOUCHER OCR — VOUCHER PARSER ADAPTER
 * Module: Henu Voucher OCR / Adapters
 *
 * Maps the internal 27-field VoucherProcessingRecord to the VoucherParser
 * Google Sheets 25-column schema. Performs mathematical verification.
 *
 * Architecture:
 *   VoucherProcessingRecord (internal) → VoucherParserAdapter → VoucherParserSheetRow (Google Sheets)
 *
 * Rules:
 * - null = field not found / unreadable (distinct from 0 = explicitly zero on voucher)
 * - Money, percentage, confidence are NEVER confused
 * - Scraping Timestamp = actual processing time, NOT the voucher date
 * - No guessing — if evidence is insufficient, value stays null
 * - Mathematical verification is independent of extraction (never invents a value)
 */

import { VoucherProcessingRecord, ExtractedVoucherFields, HenuVoucherData } from '../schema/types';

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

// ═══════════════════════════════════════════════════
// Rich Field Evidence (for report generation)
// ═══════════════════════════════════════════════════

export interface VoucherParserFieldEvidence {
  value: string | number | null;
  confidence: number;
  evidence: string;
  source: string;
  type: 'text' | 'currency' | 'percentage' | 'date' | 'identifier' | 'computed';
  status: 'EXTRACTED' | 'COMPUTED' | 'NOT_FOUND' | 'REVIEW_REQUIRED';
}

export interface VoucherParserResult {
  /** Flat row for Google Sheets insertion */
  sheetRow: VoucherParserSheetRow;

  /** Rich field evidence for report generation */
  evidence: Record<string, VoucherParserFieldEvidence>;

  /** Processing metadata */
  metadata: {
    job_id: string;
    image_sha256: string;
    processed_at: string;
    engine: string;
    workers_executed: string[];
    source_file: string;
    overall_confidence: number;
    review_required: boolean;
    validation_issues: string[];
  };

  /** Raw OCR text for debugging */
  rawText: string;

  /** Warnings */
  warnings: string[];
}

// ═══════════════════════════════════════════════════
// Column Header Order (for array-based Sheets APIs)
// ═══════════════════════════════════════════════════

export const VOUCHER_PARSER_COLUMN_ORDER: (keyof VoucherParserSheetRow)[] = [
  'Scraping Timestamp',
  'Voucher No',
  'SOC-Number',
  'Society Name',
  'Society Address',
  'To (Payee)',
  'Charge To',
  'Particulars',
  'Bank Name',
  'Cheque No',
  'Voucher Date',
  'Bill Amount',
  'Adv. Less/Paid',
  'Sub Total 1',
  'TDS %',
  'TDS Amount',
  'Sub Total 2',
  'CGST %',
  'CGST Amount',
  'Round Off (+/-)',
  'Other (Fine/Adj)',
  'Net Paid (Voucher)',
  'Calculated Net Paid',
  'Verification Status',
  'Discrepancy Notes',
];

// ═══════════════════════════════════════════════════
// Internal→Sheets Key Mapping
// ═══════════════════════════════════════════════════

const INTERNAL_TO_SHEET_MAP: Record<keyof HenuVoucherData, keyof VoucherParserSheetRow | null> = {
  society_name: 'Society Name',
  registration_no: 'SOC-Number',
  society_address: 'Society Address',
  voucher_no: 'Voucher No',
  voucher_date: 'Voucher Date',
  pay_to: 'To (Payee)',
  charge_to: 'Charge To',
  particulars: 'Particulars',
  bill_amount_1: 'Bill Amount',
  bill_amount_2: null, // Not in VoucherParser schema — absorbed into Bill Amount if single
  advance_paid: 'Adv. Less/Paid',
  total_1: 'Sub Total 1',
  tds_percentage: 'TDS %',
  tds_amount: 'TDS Amount',
  total_2: 'Sub Total 2',
  bill_no: null, // Not in VoucherParser schema
  bank_name: 'Bank Name',
  cheque_no: 'Cheque No',
  cheque_date: null, // Not in VoucherParser schema
  rupees: null, // Not in VoucherParser schema
  cgst_percentage: 'CGST %',
  cgst_amount: 'CGST Amount',
  sgst_percentage: null, // SGST merged into CGST in simplified schema
  sgst_amount: null, // SGST merged into CGST in simplified schema
  round_off: 'Round Off (+/-)',
  other_fine_adj: 'Other (Fine/Adj)',
  net_paid: 'Net Paid (Voucher)',
};

// ═══════════════════════════════════════════════════
// Adapter Class
// ═══════════════════════════════════════════════════

export class VoucherParserAdapter {
  /**
   * Converts a VoucherProcessingRecord into the VoucherParser Google Sheets format.
   * Performs mathematical verification and generates evidence metadata.
   */
  public static adapt(record: VoucherProcessingRecord): VoucherParserResult {
    const warnings: string[] = [];
    const fields = record.fields;

    // ─── Step 1: Map internal fields to sheet columns ───

    const sheetRow: VoucherParserSheetRow = {
      'Scraping Timestamp': new Date().toISOString(),
      'Voucher No': '',
      'SOC-Number': '',
      'Society Name': '',
      'Society Address': '',
      'To (Payee)': '',
      'Charge To': '',
      'Particulars': '',
      'Bank Name': '',
      'Cheque No': '',
      'Voucher Date': '',
      'Bill Amount': null,
      'Adv. Less/Paid': null,
      'Sub Total 1': null,
      'TDS %': null,
      'TDS Amount': null,
      'Sub Total 2': null,
      'CGST %': null,
      'CGST Amount': null,
      'Round Off (+/-)': null,
      'Other (Fine/Adj)': null,
      'Net Paid (Voucher)': null,
      'Calculated Net Paid': null,
      'Verification Status': '',
      'Discrepancy Notes': '',
    };

    const evidence: Record<string, VoucherParserFieldEvidence> = {};

    // Map each internal field to its corresponding sheet column
    for (const [internalKey, sheetKey] of Object.entries(INTERNAL_TO_SHEET_MAP)) {
      if (!sheetKey) continue;

      const fieldData = fields[internalKey as keyof ExtractedVoucherFields];
      if (!fieldData) continue;

      const normVal = fieldData.normalizedValue;
      const rawVal = fieldData.rawValue;
      const conf = fieldData.confidence || 0;
      const ev = fieldData.evidence || rawVal || '';
      const src = fieldData.source || record.sourceEngine || 'HENU AI';

      // Determine semantic type for evidence
      const isNumeric = typeof normVal === 'number';
      const isPercentage = internalKey.includes('percentage');
      const isDate = internalKey.includes('date');
      const isIdentifier = ['voucher_no', 'registration_no', 'cheque_no', 'bill_no'].includes(internalKey);

      let fieldType: VoucherParserFieldEvidence['type'] = 'text';
      if (isPercentage) fieldType = 'percentage';
      else if (isDate) fieldType = 'date';
      else if (isIdentifier) fieldType = 'identifier';
      else if (isNumeric) fieldType = 'currency';

      // Set sheet value
      if (normVal !== null && normVal !== undefined && normVal !== '') {
        (sheetRow as any)[sheetKey] = normVal;
      }

      // Store evidence
      evidence[sheetKey] = {
        value: normVal,
        confidence: conf,
        evidence: typeof ev === 'string' ? ev : String(ev),
        source: typeof src === 'string' ? src : 'HENU AI',
        type: fieldType,
        status: normVal !== null && normVal !== undefined && normVal !== '' ? 'EXTRACTED' : 'NOT_FOUND',
      };
    }

    // Format Voucher Date for display (DDMMYYYY → DD/MM/YYYY)
    if (sheetRow['Voucher Date'] && typeof sheetRow['Voucher Date'] === 'string') {
      const dateStr = sheetRow['Voucher Date'].replace(/[^0-9]/g, '');
      if (dateStr.length === 8) {
        sheetRow['Voucher Date'] = `${dateStr.substring(0, 2)}/${dateStr.substring(2, 4)}/${dateStr.substring(4, 8)}`;
      }
    }

    // ─── Step 2: Mathematical Verification ───

    const { calculatedNetPaid, verificationStatus, discrepancyNotes } =
      this.performMathVerification(sheetRow, warnings);

    sheetRow['Calculated Net Paid'] = calculatedNetPaid;
    sheetRow['Verification Status'] = verificationStatus;
    sheetRow['Discrepancy Notes'] = discrepancyNotes;

    // Store verification evidence
    evidence['Calculated Net Paid'] = {
      value: calculatedNetPaid,
      confidence: calculatedNetPaid !== null ? 100 : 0,
      evidence: `Computed from: Sub Total 2 + CGST Amount + Round Off + Other (Fine/Adj)`,
      source: 'SYSTEM',
      type: 'computed',
      status: 'COMPUTED',
    };
    evidence['Verification Status'] = {
      value: verificationStatus,
      confidence: 100,
      evidence: discrepancyNotes,
      source: 'SYSTEM',
      type: 'computed',
      status: 'COMPUTED',
    };
    evidence['Discrepancy Notes'] = {
      value: discrepancyNotes,
      confidence: 100,
      evidence: discrepancyNotes,
      source: 'SYSTEM',
      type: 'computed',
      status: 'COMPUTED',
    };

    // ─── Step 3: Build metadata ───

    const metadata = {
      job_id: record.id || `vp-${Date.now()}`,
      image_sha256: record.imageHash || '',
      processed_at: record.processedAt || new Date().toISOString(),
      engine: record.sourceEngine || 'HENU_AI_USB',
      workers_executed: record.modelsExecuted || [],
      source_file: record.sourceFile || '',
      overall_confidence: record.overallConfidence || 0,
      review_required: record.reviewRequired || false,
      validation_issues: (record.validationIssues || []).map(i => `${i.fieldKey}: ${i.message}`),
    };

    return {
      sheetRow,
      evidence,
      metadata,
      rawText: record.rawText || '',
      warnings,
    };
  }

  /**
   * Returns the sheet row as an ordered array of values matching column headers.
   * Use this for array-based Google Sheets APIs (Append Row).
   */
  public static toSheetArray(sheetRow: VoucherParserSheetRow): (string | number | null)[] {
    return VOUCHER_PARSER_COLUMN_ORDER.map(col => {
      const val = sheetRow[col];
      return val !== undefined ? val : null;
    });
  }

  /**
   * Mathematical Verification Engine
   *
   * Calculates Net Paid from available components and compares with voucher's stated Net Paid.
   *
   * Calculation:
   *   Sub Total 1 = Bill Amount - Adv. Less/Paid (if both available)
   *   Sub Total 2 = Sub Total 1 - TDS Amount (if both available)
   *   Calculated Net Paid = Sub Total 2 + CGST Amount + Round Off + Other (Fine/Adj)
   *
   * IMPORTANT: This NEVER invents missing values. If a component is null, it's excluded.
   */
  private static performMathVerification(
    row: VoucherParserSheetRow,
    warnings: string[]
  ): {
    calculatedNetPaid: number | null;
    verificationStatus: string;
    discrepancyNotes: string;
  } {
    const billAmount = row['Bill Amount'];
    const advLessPaid = row['Adv. Less/Paid'];
    const subTotal1 = row['Sub Total 1'];
    const tdsPercent = row['TDS %'];
    const tdsAmount = row['TDS Amount'];
    const subTotal2 = row['Sub Total 2'];
    const cgstAmount = row['CGST Amount'];
    const roundOff = row['Round Off (+/-)'];
    const otherFineAdj = row['Other (Fine/Adj)'];
    const netPaidVoucher = row['Net Paid (Voucher)'];

    // Try to calculate from available components
    let calculatedNetPaid: number | null = null;
    const notes: string[] = [];

    // Strategy 1: If Sub Total 2 is available, build from there
    if (subTotal2 !== null && subTotal2 !== undefined) {
      calculatedNetPaid = subTotal2;
      if (cgstAmount !== null && cgstAmount !== undefined) calculatedNetPaid += cgstAmount;
      if (roundOff !== null && roundOff !== undefined) calculatedNetPaid += roundOff;
      if (otherFineAdj !== null && otherFineAdj !== undefined) calculatedNetPaid += otherFineAdj;
    }
    // Strategy 2: If Sub Total 1 and TDS Amount are available, derive Sub Total 2
    else if (subTotal1 !== null && subTotal1 !== undefined && tdsAmount !== null && tdsAmount !== undefined) {
      const derivedSub2 = subTotal1 - tdsAmount;
      calculatedNetPaid = derivedSub2;
      if (cgstAmount !== null && cgstAmount !== undefined) calculatedNetPaid += cgstAmount;
      if (roundOff !== null && roundOff !== undefined) calculatedNetPaid += roundOff;
      if (otherFineAdj !== null && otherFineAdj !== undefined) calculatedNetPaid += otherFineAdj;
      notes.push('Sub Total 2 derived from Sub Total 1 - TDS Amount');
    }
    // Strategy 3: If Bill Amount available, try full chain
    else if (billAmount !== null && billAmount !== undefined) {
      let running = billAmount;
      if (advLessPaid !== null && advLessPaid !== undefined) running -= advLessPaid;
      if (tdsAmount !== null && tdsAmount !== undefined) running -= tdsAmount;
      if (cgstAmount !== null && cgstAmount !== undefined) running += cgstAmount;
      if (roundOff !== null && roundOff !== undefined) running += roundOff;
      if (otherFineAdj !== null && otherFineAdj !== undefined) running += otherFineAdj;
      calculatedNetPaid = running;
      notes.push('Calculated from Bill Amount chain');
    }

    // Round to 2 decimal places to avoid floating point issues
    if (calculatedNetPaid !== null) {
      calculatedNetPaid = Math.round(calculatedNetPaid * 100) / 100;
    }

    // Validate TDS consistency (if both % and amount are present)
    if (tdsPercent !== null && tdsPercent !== undefined && tdsAmount !== null && tdsAmount !== undefined) {
      const base = subTotal1 !== null ? subTotal1 : billAmount;
      if (base !== null && base !== undefined && base > 0) {
        const expectedTds = Math.round(base * (tdsPercent / 100) * 100) / 100;
        const tdsDiff = Math.abs(expectedTds - tdsAmount);
        if (tdsDiff > 1) {
          warnings.push(`TDS verification: Expected ₹${expectedTds} (${tdsPercent}% of ₹${base}), found ₹${tdsAmount}. Difference: ₹${tdsDiff}`);
        }
      }
    }

    // Compare with voucher's stated Net Paid
    let verificationStatus = '';
    let discrepancyNotes = '';

    if (calculatedNetPaid === null && netPaidVoucher === null) {
      verificationStatus = 'REVIEW_REQUIRED';
      discrepancyNotes = 'Insufficient data for mathematical verification. Both Net Paid and calculation components are missing.';
    } else if (calculatedNetPaid === null) {
      verificationStatus = 'REVIEW_REQUIRED';
      discrepancyNotes = 'Cannot calculate Net Paid — insufficient financial components extracted.';
    } else if (netPaidVoucher === null) {
      verificationStatus = 'REVIEW_REQUIRED';
      discrepancyNotes = `Calculated Net Paid = ₹${calculatedNetPaid}, but Net Paid not found on voucher.`;
    } else {
      const diff = Math.round(Math.abs(calculatedNetPaid - netPaidVoucher) * 100) / 100;
      if (diff <= 1) {
        // Within ₹1 tolerance (rounding)
        verificationStatus = 'Verified ✔️';
        discrepancyNotes = 'Mathematically Accurate';
      } else {
        verificationStatus = 'Issue ❌';
        discrepancyNotes = `Mismatch of ₹${diff}. Calculated: ₹${calculatedNetPaid}, Voucher: ₹${netPaidVoucher}`;
      }
    }

    if (notes.length > 0) {
      discrepancyNotes += (discrepancyNotes ? '. ' : '') + notes.join('. ');
    }

    return { calculatedNetPaid, verificationStatus, discrepancyNotes };
  }
}
