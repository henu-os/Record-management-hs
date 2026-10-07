/**
 * HENU VOUCHER OCR — VALIDATION ENGINE
 * Module: Henu Voucher OCR
 * 
 * Performs field-level and business arithmetic validation on extracted voucher fields:
 * - Total 1 = Bill Amount 1 + Bill Amount 2 - Advance
 * - TDS Amount = Total 1 * (TDS % / 100)
 * - Total 2 = Total 1 - TDS Amount
 * - CGST Amount = Total 2 * (CGST % / 100)
 * - SGST Amount = Total 2 * (SGST % / 100)
 * - Net Paid = Total 2 + CGST + SGST +/- Round Off
 */

import { ExtractedVoucherFields, ValidationIssue, HenuVoucherData } from '../schema/types';

export class ValidationEngine {
  /** Tolerance threshold for rounding differences in financial checks */
  private static readonly EPSILON = 1.01;

  public static validate(fields: ExtractedVoucherFields): {
    issues: ValidationIssue[];
    reviewRequired: boolean;
  } {
    const issues: ValidationIssue[] = [];

    const getVal = (key: keyof HenuVoucherData): any => fields[key]?.normalizedValue;

    // 1. Mandatory Field Checks
    if (!getVal('society_name') || String(getVal('society_name')).trim().length === 0) {
      issues.push({
        fieldKey: 'society_name',
        severity: 'warning',
        message: 'Society Name is empty or could not be detected with high confidence.',
      });
    }

    if (!getVal('voucher_no') || String(getVal('voucher_no')).trim().length === 0) {
      issues.push({
        fieldKey: 'voucher_no',
        severity: 'error',
        message: 'Voucher Number is missing.',
      });
    }

    const isValidDate = (dStr: string) => {
      if (!dStr) return false;
      const str = String(dStr).trim();
      if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str)) {
        const [year, month, day] = str.split(/[-/]/).map(Number);
        return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1970 && year <= 2099;
      }
      const clean = str.replace(/[^0-9]/g, '');
      if (clean.length !== 8) return false;
      const day = parseInt(clean.substring(0, 2), 10);
      const month = parseInt(clean.substring(2, 4), 10);
      const year = parseInt(clean.substring(4, 8), 10);
      return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1970 && year <= 2099;
    };

    const vDate = String(getVal('voucher_date') || '');
    if (!vDate || !isValidDate(vDate)) {
      issues.push({
        fieldKey: 'voucher_date',
        severity: 'warning',
        message: 'Voucher Date is missing or does not conform to DDMMYYYY.',
        actualValue: vDate,
      });
    }

    const cDate = String(getVal('cheque_date') || '');
    if (cDate && !isValidDate(cDate)) {
      issues.push({
        fieldKey: 'cheque_date',
        severity: 'warning',
        message: 'Cheque Date is invalid or does not conform to DDMMYYYY.',
        actualValue: cDate,
      });
    }

    if (!getVal('pay_to') || String(getVal('pay_to')).trim().length === 0) {
      issues.push({
        fieldKey: 'pay_to',
        severity: 'warning',
        message: 'Pay To (Payee Name) is empty.',
      });
    }

    const netPaid = getVal('net_paid');
    if (netPaid === null || netPaid === undefined || isNaN(netPaid)) {
      issues.push({
        fieldKey: 'net_paid',
        severity: 'warning',
        message: 'Net Paid Amount is not detected in document evidence. Please review or enter.',
      });
    }

    // 2. Arithmetic Financial Validations — Strict Zero vs Null Handling
    const b1 = getVal('bill_amount_1');
    const b2 = getVal('bill_amount_2');
    const adv = getVal('advance_paid');
    const tot1 = getVal('total_1');

    // Total 1 Math Check: Validate only if Total 1 and Bill 1 are actually known numbers
    if (typeof tot1 === 'number' && typeof b1 === 'number') {
      const b1Num = b1;
      const b2Num = typeof b2 === 'number' ? b2 : 0;
      const advNum = typeof adv === 'number' ? adv : 0;
      const calculatedTot1 = b1Num + b2Num - advNum;
      if (Math.abs(calculatedTot1 - tot1) > this.EPSILON) {
        issues.push({
          fieldKey: 'total_1',
          severity: 'warning',
          message: `Total 1 (${tot1}) does not match Bill 1 (${b1Num}) + Bill 2 (${b2Num}) - Adv (${advNum}) = ${calculatedTot1.toFixed(2)}.`,
          expectedValue: calculatedTot1,
          actualValue: tot1,
        });
      }
    }

    const tdsPct = getVal('tds_percentage');
    const tdsAmt = getVal('tds_amount');
    if (typeof tdsPct === 'number' && tdsPct > 0 && typeof tot1 === 'number' && typeof tdsAmt === 'number') {
      const expectedTds = (tot1 * tdsPct) / 100;
      if (Math.abs(expectedTds - tdsAmt) > this.EPSILON) {
        issues.push({
          fieldKey: 'tds_amount',
          severity: 'warning',
          message: `TDS Amount (${tdsAmt}) does not match ${tdsPct}% of Total 1 (${expectedTds.toFixed(2)}).`,
          expectedValue: expectedTds,
          actualValue: tdsAmt,
        });
      }
    }

    const tot2 = getVal('total_2');
    if (typeof tot1 === 'number' && typeof tdsAmt === 'number' && typeof tot2 === 'number') {
      const expectedTot2 = tot1 - tdsAmt;
      if (Math.abs(expectedTot2 - tot2) > this.EPSILON) {
        issues.push({
          fieldKey: 'total_2',
          severity: 'warning',
          message: `Total 2 (${tot2}) does not match Total 1 (${tot1}) - TDS (${tdsAmt}) = ${expectedTot2.toFixed(2)}.`,
          expectedValue: expectedTot2,
          actualValue: tot2,
        });
      }
    }

    const cgstPct = getVal('cgst_percentage');
    const cgstAmt = getVal('cgst_amount');
    if (typeof cgstPct === 'number' && cgstPct > 0 && typeof tot2 === 'number' && typeof cgstAmt === 'number') {
      const expectedCgst = (tot2 * cgstPct) / 100;
      if (Math.abs(expectedCgst - cgstAmt) > this.EPSILON) {
        issues.push({
          fieldKey: 'cgst_amount',
          severity: 'warning',
          message: `CGST Amount (${cgstAmt}) does not match ${cgstPct}% of Total 2 (${expectedCgst.toFixed(2)}).`,
          expectedValue: expectedCgst,
          actualValue: cgstAmt,
        });
      }
    }

    const sgstPct = getVal('sgst_percentage');
    const sgstAmt = getVal('sgst_amount');
    if (typeof sgstPct === 'number' && sgstPct > 0 && typeof tot2 === 'number' && typeof sgstAmt === 'number') {
      const expectedSgst = (tot2 * sgstPct) / 100;
      if (Math.abs(expectedSgst - sgstAmt) > this.EPSILON) {
        issues.push({
          fieldKey: 'sgst_amount',
          severity: 'warning',
          message: `SGST Amount (${sgstAmt}) does not match ${sgstPct}% of Total 2 (${expectedSgst.toFixed(2)}).`,
          expectedValue: expectedSgst,
          actualValue: sgstAmt,
        });
      }
    }

    // Check Net Paid aggregation if breakdown is present and reliable
    if (typeof tot2 === 'number' && typeof netPaid === 'number') {
      const cAmt = typeof cgstAmt === 'number' ? cgstAmt : 0;
      const sAmt = typeof sgstAmt === 'number' ? sgstAmt : 0;
      const roundVal = getVal('round_off');
      const roundNum = typeof roundVal === 'number' ? roundVal : 0;
      const calculatedNet = tot2 + cAmt + sAmt + roundNum;
      if (Math.abs(calculatedNet - netPaid) > this.EPSILON && (cAmt > 0 || sAmt > 0 || roundNum !== 0)) {
        issues.push({
          fieldKey: 'net_paid',
          severity: 'warning',
          message: `Net Paid (${netPaid}) does not match Total 2 (${tot2}) + CGST (${cAmt}) + SGST (${sAmt}) + Round (${roundNum}) = ${calculatedNet.toFixed(2)}.`,
          expectedValue: calculatedNet,
          actualValue: netPaid,
        });
      }
    }

    // 3. Amount in Words Cross-Validation (Phase 25 & 26)
    const rupeesWords = String(getVal('rupees') || '').toLowerCase().trim();
    if (rupeesWords && netPaid !== null && netPaid > 0) {
      const numWords: { [key: string]: number } = {
        lakh: 100000, lac: 100000, thousand: 1000, hundred: 100,
        twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
        nineteen: 19, eighteen: 18, seventeen: 17, sixteen: 16, fifteen: 15, fourteen: 14, thirteen: 13, twelve: 12, eleven: 11, ten: 10,
        nine: 9, eight: 8, seven: 7, six: 6, five: 5, four: 4, three: 3, two: 2, one: 1
      };

      // If words explicitly mention "thousand" but netPaid < 1000, or words mention "lakh" but netPaid < 100000, flag warning
      if (rupeesWords.includes('thousand') && netPaid < 900) {
        issues.push({
          fieldKey: 'rupees',
          severity: 'warning',
          message: `Amount in words ("${getVal('rupees')}") indicates thousands, but Net Paid is ${netPaid}.`,
        });
      } else if (rupeesWords.includes('lakh') && netPaid < 90000) {
        issues.push({
          fieldKey: 'rupees',
          severity: 'warning',
          message: `Amount in words ("${getVal('rupees')}") indicates lakhs, but Net Paid is ${netPaid}.`,
        });
      }
    }

    // Update field validation statuses
    for (const key of Object.keys(fields) as (keyof HenuVoucherData)[]) {
      const fieldIssue = issues.find(i => i.fieldKey === key);
      if (fieldIssue) {
        fields[key].validationStatus = fieldIssue.severity;
        fields[key].validationMessage = fieldIssue.message;
      } else {
        fields[key].validationStatus = 'valid';
        fields[key].validationMessage = undefined;
      }
    }

    const reviewRequired = issues.length > 0;

    return {
      issues,
      reviewRequired,
    };
  }
}
