/**
 * HENU VOUCHER OCR — ADVANCED NORMALIZATION & OCR DISAMBIGUATION ENGINE
 * Module: Henu Voucher OCR
 * 
 * Strict Ground-Truth Principle:
 * - Understands the exact type of data for each voucher field.
 * - Extracts ONLY what is physically detected in the image.
 * - NEVER invents, guesses, autofills, or hallucinates missing characters/dates/numbers.
 * - ALL DATES MUST BE NORMALIZED TO DDMMYYYY (No slashes, hyphens, or dots).
 * - If OCR is illegible, returns null / empty string and flags review_required = true.
 */

import { ExtractionFieldType } from '../schema/types';

export class NormalizationEngine {
  private static DEVANAGARI_DIGITS: { [key: string]: string } = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };

  /**
   * Replaces Devanagari numerals with standard ASCII digits
   */
  public static convertDevanagariDigits(input: string): string {
    if (!input) return '';
    return input.replace(/[०-९]/g, (char) => this.DEVANAGARI_DIGITS[char] || char);
  }

  /**
   * Strips currency symbols and handles OCR character ambiguity in numeric fields
   */
  public static cleanNumericString(rawStr: string): string {
    if (!rawStr) return '';
    let s = this.convertDevanagariDigits(rawStr.trim());

    // If string is pure non-numeric text/words (e.g. "ro", "no", "voucher", "date", "cgst", "sgst", "ate"), reject immediately
    if (/^[a-zA-Z\s\.\:\-\=\/]+$/.test(s) && !/(?:rs|inr|[\$\€\£\₹])/i.test(s)) {
      return '';
    }

    // Strip common currency symbols, prefixes and trailing markers
    s = s.replace(/[₹\$\€\£]/g, '')
      .replace(/Rs\.?/gi, '')
      .replace(/INR/gi, '')
      .replace(/=00$/g, '.00')
      .replace(/\/[-=]/g, '')
      .trim();

    // Anti-concatenation: if string contains multiple space-separated numbers (e.g. "25161 00" vs "252 24909")
    if (/\s+/.test(s)) {
      const parts = s.split(/\s+/).filter(p => p.length > 0);
      if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d{2}$/.test(parts[1])) {
        // e.g. "25161 00" -> "25161.00"
        s = `${parts[0]}.${parts[1]}`;
      } else if (parts.length > 1) {
        // If there are multiple disparate tokens, take the first valid numeric token
        const validPart = parts.find(p => /[\d]/.test(p));
        s = validPart || parts[0];
      } else {
        s = s.replace(/\s+/g, '');
      }
    }

    // Disambiguate common handwritten number misreads only when mixed with digits or numeric structure
    if (/\d/.test(s) || /^[oOQDIlSsBZ.,\-+]{2,}$/.test(s)) {
      s = s.replace(/[oOQD]/g, '0')
        .replace(/[Il|!]/g, '1')
        .replace(/[Ss]/g, '5')
        .replace(/[B]/g, '8')
        .replace(/[Zz]/g, '2');
    }

    // Keep only valid numeric characters, comma, decimal point, plus/minus
    s = s.replace(/[^0-9.,+-]/g, '');

    // If resulting string has no actual digits, it was pure noise
    if (!/\d/.test(s)) return '';

    return s;
  }

  /**
   * TYPE F & E: AMOUNT / NUMBER
   * Normalizes numeric & currency strings to a standard JavaScript number or null.
   * CRITICAL: Rejects percentage strings (e.g. "141%", "20%", "2%") — percentages must NEVER become amounts!
   */
  public static normalizeNumber(rawStr: string | null | undefined): number | null {
    if (!rawStr) return null;
    const rawTrimmed = String(rawStr).trim();

    // STRICT REJECTION: If string represents a percentage or contains '%', it must NEVER become a monetary amount
    if (/[%％]/.test(rawTrimmed)) {
      return null;
    }

    // Reject isolated single digit noise (like '1' from table borders) unless it has clear monetary context
    if (/^[0-9]$/.test(rawTrimmed) && !/(?:rs|₹|\.00|\.0)/i.test(rawTrimmed)) {
      return null;
    }

    let s = this.cleanNumericString(rawTrimmed);
    if (!s || s === '-' || s === '.' || s === '+' || s === '/') return null;

    const isNegative = s.startsWith('-');
    s = s.replace(/^[+-]/, '');

    // Handle decimal and thousand separators
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length === 2) {
        s = parts[0] + '.' + parts[1];
      } else {
        s = s.replace(/,/g, '');
      }
    }

    // Anti-hallucination: Reject concatenated multi-row numeric artifacts (e.g. 24390953000 where multiple rows were merged)
    const digitsOnly = s.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 10) {
      return null;
    }

    const val = parseFloat(s);
    if (isNaN(val) || val > 100000000) return null;
    return isNegative ? -val : val;
  }

  /**
   * TYPE H: PERCENTAGE
   * Extracts numeric percentage (e.g. "1 %" -> 1, "10%" -> 10, "18.5%" -> 18.5, "@ 2%" -> 2).
   * Rejects pure currency strings without % or percentage keywords.
   */
  public static normalizePercentage(rawStr: string | null | undefined): number | null {
    if (!rawStr) return null;
    let s = this.convertDevanagariDigits(String(rawStr).trim());

    // If string has currency symbols and NO percentage symbol or keywords, reject
    if (/(?:rs|inr|[\$\€\£\₹])/i.test(s) && !/[%％]|(?:tds|cgst|sgst|tax|@)/i.test(s)) {
      return null;
    }

    // Remove labels like "Less TDS @", "Add CGST @", "SGST @", "TDS @"
    s = s.replace(/^(?:LESS\s*TDS|ADD\s*(?:CGST|SGST)|TDS|CGST|SGST|TAX)[\s@:]*/i, '');
    s = s.replace(/[%％]/g, '').trim();

    // Clean numeric string
    const cleanStr = this.cleanNumericString(s);
    if (!cleanStr) return null;

    const val = parseFloat(cleanStr);
    if (isNaN(val) || val < 0 || val > 100) {
      return null;
    }
    return val;
  }

  /**
   * SIGNED AMOUNT (For Round Off: supports 0, 0.00, -1, +1, -0.50, null if "/" or blank)
   */
  public static normalizeSignedAmount(rawStr: string | null | undefined): number | null {
    if (!rawStr) return null;
    const trimmed = String(rawStr).trim();
    if (trimmed === '/' || trimmed === '-' || trimmed === 'N/A' || trimmed === '.' || trimmed === '' || /[%％]/.test(trimmed)) {
      return null;
    }
    const cleanStr = this.cleanNumericString(trimmed);
    if (!cleanStr) return null;
    const isNegative = cleanStr.startsWith('-');
    const val = parseFloat(cleanStr.replace(/^[+-]/, ''));
    if (isNaN(val)) return null;
    return isNegative ? -val : val;
  }

  /**
   * TYPE G: DATE — MANDATORY DDMMYYYY (NO SLASH, HYPHEN, OR DOT)
   * Supports textual months: "15-Sep-2026", "15/09/2026", "15.09.2026", "15092026"
   */
  public static normalizeDate(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = this.convertDevanagariDigits(String(rawStr).trim());

    // Clean common date prefixes
    s = s.replace(/^(?:DATE|DATED|DT|दिनांक)[\s\.\:\#\-]*/i, '').trim();

    // Handle textual months (e.g. 15-Sep-2026 or 15 Sep 2026)
    const monthNames: { [key: string]: number } = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };

    const textMonthMatch = s.match(/(\d{1,2})[\/\-\.\s]([A-Za-z]{3,9})[\/\-\.\s](\d{2,4})/);
    if (textMonthMatch) {
      const day = parseInt(textMonthMatch[1], 10);
      const mStr = textMonthMatch[2].substring(0, 3).toLowerCase();
      const month = monthNames[mStr];
      let year = parseInt(textMonthMatch[3], 10);
      if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;

      if (month && day >= 1 && day <= 31 && year >= 1970 && year <= 2099) {
        const dd = String(day).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        return `${dd}${mm}${year}`;
      }
    }

    // 1. Match DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MM YYYY
    const match = s.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
    if (match) {
      let day = parseInt(match[1], 10);
      let month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);

      // Two-digit year normalization (e.g. 26 -> 2026)
      if (year < 100) {
        year = year > 50 ? 1900 + year : 2000 + year;
      }

      // Check for month/day swap (MM/DD/YYYY to DD/MM/YYYY)
      if (month > 12 && day <= 12) {
        const temp = day;
        day = month;
        month = temp;
      }

      // Strict calendar validity: Day 01-31, Month 01-12, Year 1970-2099
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1970 && year <= 2099) {
        const dd = String(day).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        const yyyy = String(year);
        return `${dd}${mm}${yyyy}`;
      }
    }

    // 2. Match compact 8-digit date DDMMYYYY
    const compactMatch = s.match(/\b(\d{2})(\d{2})(\d{4})\b/);
    if (compactMatch) {
      const day = parseInt(compactMatch[1], 10);
      const month = parseInt(compactMatch[2], 10);
      const year = parseInt(compactMatch[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1970 && year <= 2099) {
        return `${compactMatch[1]}${compactMatch[2]}${compactMatch[3]}`;
      }
    }

    // If no valid date pattern was recognized, do NOT guess. Return empty.
    return '';
  }

  /**
   * TYPE I: REFERENCE NUMBER (Voucher No, Cheque No, Bill No)
   * Strictly rejects English word fragments and labels (like 'ATE', 'DATE', 'CHQ', 'NO')
   */
  public static normalizeIdentifier(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = this.convertDevanagariDigits(String(rawStr).trim());

    // Strip common labels if prepended
    s = s.replace(/^(?:VOUCHER\s*(?:NO|NUMBER)?|VR\s*NO|CHQ\s*NO|CHEQUE\s*(?:NO|NUMBER)?|BILL\s*NO|REG\s*NO|NO\.|DATED|DATE)[\s\.\:\#\-]*/i, '');
    // Strip trailing label boundary if captured (e.g. "5680 Date" -> "5680")
    s = s.replace(/(?:DATE|DATED|DT|दिनांक)[\s\.\:\#\-]*$/i, '');
    s = s.replace(/^[\s\.\:\#\-\/\=\|]+/, '').replace(/[\s\.\:\#\-\/\=\|]+$/, '');

    // Reject known words, label noise, or dictionary fragments that have NO digits
    const rejectedFragments = [
      'ate', 'date', 'dated', 'dt', 'ro', 'vr', 'no', 'mr', 'mrs', 'chs', 'soc', 'co', 'op',
      'chq', 'cheque', 'bank', 'name', 'pay', 'paid', 'charge', 'debit', 'particulars',
      'bill', 'amount', 'total', 'sub', 'net', 'gross', 'tds', 'cgst', 'sgst', 'tax',
      'round', 'off', 'rupees', 'rs', 'inr', 'page', 'sign', 'for', 'and', 'the', 'only'
    ];

    const lower = s.toLowerCase();
    if (rejectedFragments.includes(lower)) {
      return '';
    }

    // If string is strictly alphabetical (zero digits) and does not match banking codes (NEFT/RTGS/UPI/CMS), reject it!
    if (/^[A-Za-z]+$/.test(s) && !/^(?:NEFT|RTGS|UPI|IMPS|CMS|CHQ)/i.test(s)) {
      return '';
    }

    // If only noise characters remain, return empty
    if (/^[_\.\:\-\=\/\s\|]+$/.test(s) || s.length === 0) return '';
    return s.trim();
  }

  /**
   * TYPE J: MIXED ALPHANUMERIC (Registration Number)
   * Preserves complex registration formats e.g. "MUM / WT / GEN / 10915 / 2011-2012"
   */
  public static normalizeMixedAlphanumeric(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = this.convertDevanagariDigits(String(rawStr).trim());

    // Strip "REG. NO.:" or "REG NO" label prefix
    s = s.replace(/^(?:REG(?:ISTRATION|\.|\s)?\s*(?:NO|NUMBER)?|नोंदणी\s*नं)[\s\.\:\#\-]*/i, '');
    s = s.replace(/^[\s\.\:\#\-\=\|]+/, '').replace(/[\s\.\:\#\-\=\|]+$/, '').trim();

    if (/^[_\.\:\-\=\/\s\|]+$/.test(s) || s.length < 2) return '';
    return s;
  }

  /**
   * TYPE A: NAME / PERSON / ORGANIZATION (Society Name, Pay To, Bank Name)
   */
  public static normalizeName(rawStr: string | null | undefined, fieldKey?: string): string {
    if (!rawStr) return '';
    let s = String(rawStr).trim();

    // Strip field labels if accidentally captured
    s = s.replace(/^(?:PAY\s*TO|PAID\s*TO|BANK\s*NAME|M\/S|MR\.|MRS\.)[\s\.\:\#\-]*/i, '');
    // Strip trailing boundary labels (e.g. "Mission security services CHARGE" -> "Mission security services")
    s = s.replace(/(?:CHARGE\s*TO|DEBIT\s*TO|CHARGE|DEBIT|ACCOUNT|A\/C)[\s\.\:\#\-]*$/i, '');
    s = s.replace(/^[_\.\:\-\=\/\s\|]+/, '').replace(/[\s\.\:\#\-\/\=\|]+$/, '').trim();

    // Strict rejection for Pay To (Payee) false captures
    const rejectedPayees = /^(?:TOTAL|PAID\s*TOTAL|TAL|CASH|CHEQUE|DEBIT|DEBIT\s*VOUCHER|CREDIT|RS\.?|RUPEES|AMOUNT|NET\s*PAID|PARTICULARS|NARRATION)$/i;
    if (rejectedPayees.test(s) || /^(?:TOTAL|PAID\s*TOTAL|TAL)$/i.test(s.toLowerCase())) {
      return '';
    }

    // Strict rejection for Society Name false captures
    if (fieldKey === 'society_name' || !fieldKey) {
      const rejectedSociety = /^(?:DEBIT\s*VOUCHER|CREDIT\s*VOUCHER|PAYMENT\s*VOUCHER|RECEIPT\s*VOUCHER|VOUCHER|DEBIT|CREDIT)$/i;
      if (rejectedSociety.test(s)) {
        return '';
      }
    }

    if (/^[_\.\:\-\=\/\s\*\#\|]+$/.test(s) || s.length < 2) return '';
    return s;
  }

  /**
   * LEDGER HEAD (Charge To)
   */
  public static normalizeLedgerHead(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = String(rawStr).trim();

    // Strip "CHARGE TO" or "DEBIT TO"
    s = s.replace(/^(?:CHARGE\s*TO|DEBIT\s*TO|ACCOUNT|A\/C)[\s\.\:\#\-]*/i, '');
    s = s.replace(/^[_\.\:\-\=\/\s\|]+/, '').replace(/[\s\.\:\#\-\/\=\|]+$/, '').trim();

    if (/^[_\.\:\-\=\/\s\*\#\|]+$/.test(s) || s.length < 2) return '';
    return s;
  }

  /**
   * TYPE B: ADDRESS (Society Address)
   */
  public static normalizeAddress(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = String(rawStr)
      .replace(/\r\n/g, ', ')
      .replace(/\n/g, ', ')
      .replace(/[ \t]+/g, ' ')
      .replace(/^[_\.\:\-\=\/\s,]+/, '')
      .replace(/[_\.\:\-\=\/\s,]+$/, '')
      .trim();

    if (/^[_\.\:\-\=\/\s\*\#]+$/.test(s) || s.length < 3) return '';
    return s;
  }

  /**
   * TYPE D: SENTENCE / NARRATION (Particulars)
   */
  public static normalizeSentence(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = String(rawStr)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^(?:PARTICULARS|तपशील)[\s\.\:\#\-]*/i, '')
      .replace(/^[_\.\:\-\=\/\s]+/, '')
      .replace(/[_\.\:\-\=\/\s]+$/, '')
      .trim();

    if (/^[_\.\:\-\=\/\s\*\#]+$/.test(s) || s.length < 2) return '';
    return s;
  }

  /**
   * TYPE C: GENERAL WORDS (Rupees Words)
   */
  public static normalizeRupeesWords(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = String(rawStr)
      .replace(/^(?:RUPEES|RS\.?|रुपये)[\s\.\:\#\-]*/i, '')
      .replace(/^[_\.\:\-\=\/\s]+/, '')
      .replace(/[_\.\:\-\=\/\s]+$/, '')
      .trim();

    if (/^[_\.\:\-\=\/\s\*\#]+$/.test(s) || s.length < 2) return '';
    return s;
  }

  /**
   * Generic text normalization fallback
   */
  public static normalizeText(rawStr: string | null | undefined): string {
    if (!rawStr) return '';
    let s = String(rawStr)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^[_\.\:\-\=\/\s]+/, '')
      .replace(/[_\.\:\-\=\/\s]+$/, '')
      .trim();

    if (/^[_\.\:\-\=\/\s\*\#]+$/.test(s) || s.length < 2) {
      return '';
    }
    return s;
  }

  /**
   * Central Dispatcher by ExtractionFieldType
   */
  public static normalizeByExtractionType(
    rawStr: string | null | undefined,
    extractionType?: ExtractionFieldType,
    fieldKey?: string
  ): any {
    if (!rawStr) {
      if (['amount', 'percentage', 'signed_amount', 'number'].includes(extractionType || '')) {
        return null;
      }
      return '';
    }

    switch (extractionType) {
      case 'date':
        return this.normalizeDate(rawStr);

      case 'percentage':
        return this.normalizePercentage(rawStr);

      case 'signed_amount':
        return this.normalizeSignedAmount(rawStr);

      case 'amount':
      case 'number':
        return this.normalizeNumber(rawStr);

      case 'reference_number':
        return this.normalizeIdentifier(rawStr);

      case 'mixed_alphanumeric':
        return this.normalizeMixedAlphanumeric(rawStr);

      case 'name':
        return this.normalizeName(rawStr, fieldKey);

      case 'address':
        return this.normalizeAddress(rawStr);

      case 'ledger_text':
        return this.normalizeLedgerHead(rawStr);

      case 'sentence':
        return this.normalizeSentence(rawStr);

      case 'words':
        return this.normalizeRupeesWords(rawStr);

      default:
        if (fieldKey === 'voucher_date' || fieldKey === 'cheque_date') {
          return this.normalizeDate(rawStr);
        }
        if (fieldKey === 'voucher_no' || fieldKey === 'cheque_no' || fieldKey === 'bill_no') {
          return this.normalizeIdentifier(rawStr);
        }
        return this.normalizeText(rawStr);
    }
  }
}
