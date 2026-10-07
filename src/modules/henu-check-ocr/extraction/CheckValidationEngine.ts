/**
 * HENU CHECK OCR — VALIDATION ENGINE
 * Module: Henu Check OCR
 * 
 * Banking and Cheque-Specific Validation Rules:
 * - Date format verification (DDMMYYYY)
 * - Amount in figure validity
 * - Account number and Cheque number presence
 * - MICR code format and length (expected 22 digits)
 * - Non-cheque page detection
 * - Conflicting or suspicious OCR values
 */

import { ExtractedCheckFields, CheckValidationIssue, HenuCheckData } from '../schema/types';

export class CheckValidationEngine {
  /**
   * Validates extracted cheque fields and flags issues for human review
   */
  public static validate(
    fields: ExtractedCheckFields,
    isChequePageHint?: boolean
  ): { issues: CheckValidationIssue[]; reviewRequired: boolean; isCheque: boolean } {
    const issues: CheckValidationIssue[] = [];

    const bank = fields.bank?.normalizedValue;
    const date = fields.date?.normalizedValue;
    const payee = fields.payee_name?.normalizedValue;
    const amountFig = fields.amount_in_figure?.normalizedValue;
    const rupeesWords = fields.rupees_in_words?.normalizedValue;
    const acNo = fields.account_no?.normalizedValue;
    const chqNo = fields.cheque_no?.normalizedValue;
    const micr = fields.micr_code?.normalizedValue;

    // 1. Non-Cheque Page Detection
    const detectedFieldCount = [bank, date, payee, amountFig, acNo, chqNo, micr].filter(Boolean).length;
    const isCheque = isChequePageHint !== false && detectedFieldCount >= 2;

    if (!isCheque) {
      issues.push({
        fieldKey: 'general',
        severity: 'warning',
        message: 'NON-CHEQUE / REVIEW: Document page does not appear to be a valid bank cheque.',
      });
      return { issues, reviewRequired: true, isCheque: false };
    }

    // 2. Bank Name Validation
    if (!bank || String(bank).trim().length < 3) {
      issues.push({
        fieldKey: 'bank',
        severity: 'warning',
        message: 'Bank name is missing or unreadable. Please verify issuing bank.',
      });
    }

    // 3. Cheque Date Validation (DDMMYYYY format)
    if (!date) {
      issues.push({
        fieldKey: 'date',
        severity: 'warning',
        message: 'Cheque date is missing or unreadable (DDMMYYYY expected).',
      });
    } else {
      const dStr = String(date);
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dStr) && !/^\d{8}$/.test(dStr)) {
        issues.push({
          fieldKey: 'date',
          severity: 'warning',
          message: `Date "${dStr}" does not match standard DD/MM/YYYY or DDMMYYYY format.`,
        });
      }
    }

    // 4. Payee Name Validation
    if (!payee || String(payee).trim().length < 2) {
      issues.push({
        fieldKey: 'payee_name',
        severity: 'warning',
        message: 'Pay / Payee Name is missing. Please verify payee line.',
      });
    }

    // 5. Amount in Figure Validation
    if (amountFig === null || amountFig === undefined || typeof amountFig !== 'number' || amountFig <= 0) {
      issues.push({
        fieldKey: 'amount_in_figure',
        severity: 'error',
        message: 'Amount in figure is missing or invalid. Financial amount is required.',
      });
    }

    // 6. Rupees in Words Validation
    if (!rupeesWords || String(rupeesWords).trim().length < 4) {
      issues.push({
        fieldKey: 'rupees_in_words',
        severity: 'warning',
        message: 'Rupees in Words is missing or unreadable.',
      });
    }

    // 7. Account Number Validation
    if (!acNo || String(acNo).trim().length < 4) {
      issues.push({
        fieldKey: 'account_no',
        severity: 'warning',
        message: 'A/c No. is missing or incomplete.',
      });
    }

    // 8. Cheque Number Validation
    if (!chqNo || String(chqNo).trim().length < 4) {
      issues.push({
        fieldKey: 'cheque_no',
        severity: 'warning',
        message: 'Cheque No. is missing or shorter than expected 4-6 digits.',
      });
    }

    // 9. MICR Code at bottom (expected 22 digits)
    if (!micr) {
      issues.push({
        fieldKey: 'micr_code',
        severity: 'warning',
        message: 'MICR Code at bottom was not identified. Please verify bottom band.',
      });
    } else {
      const micrDigits = String(micr).replace(/\D/g, '');
      if (micrDigits.length !== 22 && micrDigits.length !== 9 && micrDigits.length !== 6) {
        issues.push({
          fieldKey: 'micr_code',
          severity: 'warning',
          message: `MICR Code length (${micrDigits.length} digits) differs from standard 22-digit Indian CTS-2010 cheque band.`,
          actualValue: micrDigits.length,
          expectedValue: 22,
        });
      }
    }

    // 10. Low Confidence Field Warnings
    for (const [key, fieldObj] of Object.entries(fields)) {
      if (fieldObj && fieldObj.normalizedValue !== null && fieldObj.confidence < 60) {
        issues.push({
          fieldKey: key as keyof HenuCheckData,
          severity: 'warning',
          message: `Low OCR confidence (${fieldObj.confidence}%) for ${key}. Review recommended.`,
        });
      }
    }

    const reviewRequired = issues.length > 0;
    return { issues, reviewRequired, isCheque: true };
  }
}
