/**
 * HENU CHECK OCR — NORMALIZATION ENGINE
 * Module: Henu Check OCR
 * 
 * Strict Zero-Guessing Normalization for Bank Cheque Fields:
 * - Preserves leading zeros for Account No. and Cheque No.
 * - Extracts clean decimal values for Amount in Figures
 * - Normalizes DDMMYYYY date formats
 * - Cleans MICR 22-digit bottom band
 */

import { ExtractionFieldType, HenuCheckData } from '../schema/types';

export class CheckNormalizationEngine {
  /**
   * Normalizes a raw OCR value based on the field's extraction type
   */
  public static normalizeByExtractionType(
    raw: string | null | undefined,
    type: ExtractionFieldType,
    fieldKey?: keyof HenuCheckData
  ): any {
    if (raw === null || raw === undefined) return null;
    const str = String(raw).trim();
    if (!str || str === 'null' || str === 'undefined' || str === '-' || str === 'N/A') return null;

    switch (type) {
      case 'date':
        return this.normalizeDate(str);
      case 'amount':
        return this.normalizeAmount(str);
      case 'reference_number':
        return this.normalizeIdentifier(str);
      case 'micr':
        return this.normalizeMicr(str);
      case 'name':
        return this.normalizeName(str, fieldKey);
      case 'address':
        return this.normalizeAddress(str);
      case 'words':
        return this.normalizeWords(str);
      case 'signature':
        return this.normalizeSignature(str);
      default:
        return str;
    }
  }

  /**
   * Normalizes Cheque Date: DDMMYYYY or DD/MM/YYYY
   */
  public static normalizeDate(raw: string): string | null {
    const clean = raw.replace(/[^\d\/\-\.\s]/g, '').trim();
    if (!clean) return null;

    // Pattern 1: 8 continuous digits DDMMYYYY
    const d8 = clean.replace(/\D/g, '');
    if (d8.length === 8) {
      const d = parseInt(d8.substring(0, 2), 10);
      const m = parseInt(d8.substring(2, 4), 10);
      const y = parseInt(d8.substring(4, 8), 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1990 && y <= 2099) {
        return `${d8.substring(0, 2)}/${d8.substring(2, 4)}/${d8.substring(4, 8)}`;
      }
    }

    // Pattern 2: DD/MM/YYYY or DD-MM-YYYY
    const slashMatch = clean.match(/^(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})$/);
    if (slashMatch) {
      let d = parseInt(slashMatch[1], 10);
      let m = parseInt(slashMatch[2], 10);
      let y = parseInt(slashMatch[3], 10);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1990 && y <= 2099) {
        const dd = String(d).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        return `${dd}/${mm}/${y}`;
      }
    }

    // Pattern 3: YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        const dd = String(d).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        return `${dd}/${mm}/${y}`;
      }
    }

    return null;
  }

  /**
   * Normalizes Amount in Figure: Returns numeric decimal (e.g. 100000.00)
   */
  public static normalizeAmount(raw: string): number | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // If string has non-currency alphabetic words (e.g. "invalid", "sample"), reject
    const nonCurrencyWords = trimmed.replace(/[₹\s,.\/=–\-\d]|Rs\.?|INR/gi, '');
    if (nonCurrencyWords.length > 2) {
      return null;
    }

    let clean = trimmed
      .replace(/₹|Rs\.?|INR/gi, '')
      .replace(/[\/=–\-]$/, '')
      .replace(/,/g, '')
      .trim();

    // Fix minor OCR confusion only if mostly digits
    if (/[a-zA-Z]/.test(clean) && clean.length <= 8) {
      clean = clean.replace(/[oO]/g, '0').replace(/[lI]/g, '1').replace(/[sS]/g, '5');
    }

    clean = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? null : parseFloat(num.toFixed(2));
  }

  /**
   * Preserves exact identifier digits & leading zeros (A/c No, Cheque No)
   */
  public static normalizeIdentifier(raw: string): string | null {
    if (!raw) return null;
    let clean = raw
      .replace(/^(?:A\/C\s*NO\.?|CHQ\s*NO\.?|CHEQUE\s*NO\.?|NO\.?)\s*[:\.\-]*/i, '')
      .replace(/[^0-9A-Za-z\-_]/g, '')
      .trim();

    // Check for negative filters / non-identifiers
    if (/^(?:TOTAL|PAY|BANK|DATE|RUPEES|NIL|NONE)$/i.test(clean) || clean.length === 0) {
      return null;
    }

    return clean;
  }

  /**
   * Normalizes MICR code: Removes delimiters, preserves 22-digit or clean MICR string
   */
  public static normalizeMicr(raw: string): string | null {
    if (!raw) return null;
    let clean = raw.replace(/[^0-9]/g, '').trim();
    if (clean.length < 6) return null;
    return clean;
  }

  /**
   * Normalizes names (Bank, Payee)
   */
  public static normalizeName(raw: string, fieldKey?: keyof HenuCheckData): string | null {
    if (!raw) return null;
    let clean = raw
      .replace(/^(?:PAY|PAYEE|TO|M\/S|BANK\s*NAME|BANK)\s*[:\.\-]*/i, '')
      .replace(/\s*(?:OR\s*BEARER|A\/C\s*PAYEE|AC\s*PAYEE|ONLY)\s*$/i, '')
      .replace(/[\*\_\#]/g, '')
      .trim();

    // Filter invalid name strings
    if (/^(?:TOTAL|AMOUNT|RUPEES|CASH|DATE|CHEQUE|SIGNATURE)$/i.test(clean) || clean.length < 2) {
      return null;
    }

    return clean;
  }

  /**
   * Normalizes address strings
   */
  public static normalizeAddress(raw: string): string | null {
    if (!raw) return null;
    let clean = raw
      .replace(/^(?:ADDRESS|BRANCH|LOCATION)\s*[:\.\-]*/i, '')
      .replace(/[\*\_\#]/g, '')
      .trim();

    if (clean.length < 4 || /^(?:NIL|NONE|NA|N\/A)$/i.test(clean)) {
      return null;
    }

    return clean;
  }

  /**
   * Normalizes Rupees in Words: Cleans up whitespace, ensures proper casing and 'Only' suffix
   */
  public static normalizeWords(raw: string): string | null {
    if (!raw) return null;
    let clean = raw
      .replace(/^(?:RUPEES|RS\.?|INR)\s*[:\.\-]*/i, '')
      .replace(/[\*\_\#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (clean.length < 4 || /^(?:RUPEES|AMOUNT|RS|TOTAL|CASH)$/i.test(clean)) {
      return null;
    }

    if (!clean.toLowerCase().endsWith('only')) {
      clean = `${clean} Only`;
    }

    return clean;
  }

  /**
   * Normalizes Signature By (zero-guessing rule)
   */
  public static normalizeSignature(raw: string): string | null {
    if (!raw) return null;
    let clean = raw
      .replace(/^(?:SIGNATURE\s*BY|SIGNATORY|AUTHORISED\s*SIGNATORY|FOR)\s*[:\.\-]*/i, '')
      .replace(/[\*\_\#]/g, '')
      .trim();

    if (
      !clean ||
      /^(?:AUTHORISED\s*SIGNATORY|SIGNATORY|SIGN|PLEASE\s*SIGN.*|.*ABOVE\s*THIS\s*LINE.*|NIL|NONE|UNKNOWN|HANDWRITTEN)$/i.test(clean) ||
      /\b(?:LIMITED|PVT|LTD|COMPANY|CORP|INC|ENTERPRISES|SOCIETY|TRUST|BANK|LLP)\b/i.test(clean) ||
      clean.length < 3
    ) {
      return null; // Do not guess handwritten signatory or corporate entity as person
    }

    return clean;
  }
}
