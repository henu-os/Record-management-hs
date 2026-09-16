// ============================================================
// ValidationEngine — Workbook and generation range validation
// ============================================================
import { MasterWorkbook, ValidationResult } from '../types';
import { validateSerialRange } from './SerialRangeEngine';

export class ValidationEngine {
  /**
   * Validates the full master workbook.
   * Errors BLOCK generation.
   * Warnings ALLOW generation but are shown to user.
   */
  static validateWorkbook(wb: MasterWorkbook): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Society Master ───────────────────────────────────────
    if (!wb.societyMaster) {
      warnings.push('Sheet: 01_Society_Master | Row: N/A | Column: N/A | Problem: Society Master sheet is missing or empty — Default society header will be used.');
    } else {
      const sm = wb.societyMaster;
      if ((!sm.societyName || sm.societyName.trim() === '') && (!sm.registrationNo || sm.registrationNo.trim() === '')) {
        errors.push('Sheet: 01_Society_Master | Row: 1 | Column: Society Name / Reg No | Problem: Society Name or Registration No. is required.');
      }
      if (!sm.registrationDate || sm.registrationDate.trim() === '') {
        warnings.push('Sheet: 01_Society_Master | Row: 2 | Column: Registration Date | Problem: Registration Date is blank.');
      }
      if (!sm.address || sm.address.trim() === '') {
        warnings.push('Sheet: 01_Society_Master | Row: 3 | Column: Address | Problem: Society Address is blank.');
      }
      if (!sm.email || sm.email.trim() === '') {
        warnings.push('Sheet: 01_Society_Master | Row: 4 | Column: Email | Problem: Society Email Id is blank.');
      }
      if (!sm.telephone || sm.telephone.trim() === '') {
        warnings.push('Sheet: 01_Society_Master | Row: 5 | Column: Telephone | Problem: Society Telephone or Mobile No. is blank.');
      }
      if (sm.totalUnits === 0) {
        warnings.push('Sheet: 01_Society_Master | Row: 6 | Column: Total Units | Problem: Total Unit breakdown is 0. Check Flat, Shop, Office, and Gala count.');
      }
    }

    // ── Common File ──────────────────────────────────────────
    if (wb.commonFile.length === 0) {
      errors.push('Sheet: 02_Common_Member_Master | Row: 1 | Column: All | Problem: Common Member Master sheet is missing or has no data rows.');
    } else {
      const seenSerials = new Set<string>();
      const seenMemberships = new Set<string>();

      wb.commonFile.forEach((rec, idx) => {
        const rowNum = idx + 2;
        if (!rec.srNo || rec.srNo.trim() === '') {
          warnings.push(`Sheet: 02_Common_Member_Master | Row: ${rowNum} | Column: Sr. No. | Problem: Row has an empty Sr. No. — this row will be skipped.`);
          return;
        }
        if (seenSerials.has(rec.srNo)) {
          warnings.push(`Sheet: 02_Common_Member_Master | Row: ${rowNum} | Column: Sr. No. | Problem: Duplicate Sr. No. "${rec.srNo}" found.`);
        }
        seenSerials.add(rec.srNo);

        if (rec.membershipNo && rec.membershipNo.trim() !== '') {
          if (seenMemberships.has(rec.membershipNo.trim())) {
            errors.push(`Sheet: 02_Common_Member_Master | Row: ${rowNum} | Column: Membership No. | Problem: Duplicate membership number "${rec.membershipNo}".`);
          }
          seenMemberships.add(rec.membershipNo.trim());
        }

        if (!rec.member1 && !rec.memberName) {
          warnings.push(`Sheet: 02_Common_Member_Master | Row: ${rowNum} | Column: Member Name | Problem: Row ${rowNum} (Sr. No. ${rec.srNo}) has no member name.`);
        }
      });
    }

    // ── Sheet presence warnings ──────────────────────────────
    if (wb.formIData.length === 0) warnings.push('Sheet: 03_Form_I | Row: N/A | Column: N/A | Problem: Form I sheet is empty or missing.');
    if (wb.formJData.length === 0) warnings.push('Sheet: 04_Form_J | Row: N/A | Column: N/A | Problem: Form J sheet is empty or missing.');
    if (wb.shareData.length === 0) warnings.push('Sheet: 05_Share_Register | Row: N/A | Column: N/A | Problem: Share Register sheet is empty or missing.');
    if (wb.nominationData.length === 0) warnings.push('Sheet: 06_Nomination_Register | Row: N/A | Column: N/A | Problem: Nomination Register sheet is empty or missing.');
    if (wb.propertyData.length === 0) warnings.push('Sheet: 07_Property_Register | Row: N/A | Column: N/A | Problem: Property Register sheet is empty or missing.');
    if (wb.bankLineMarkData.length === 0) warnings.push('Sheet: 08_Lien_Mark_Register | Row: N/A | Column: N/A | Problem: Bank Lien Mark Register sheet is empty or missing.');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a serial number range before generation.
   */
  static validateGenerationRange(from: string, to: string, nonSerialCount = 0): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const rangeError = validateSerialRange(from, to, nonSerialCount);
    if (rangeError) errors.push(rangeError);

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates that master data is loaded before generation.
   */
  static validateMasterDataLoaded(wb: MasterWorkbook | null): ValidationResult {
    if (!wb) {
      return {
        isValid: false,
        errors: ['No Master Data loaded. Please upload the Master Data Excel file first.'],
        warnings: [],
      };
    }
    return this.validateWorkbook(wb);
  }
}
