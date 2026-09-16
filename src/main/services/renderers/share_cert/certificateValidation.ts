// ============================================================
// HENU OS — Share Certificate Validation Rules
// Ensures no field overflows, truncates or distorts locked geometry
// ============================================================

import { ShareCertificateFieldData } from './certificateFields';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ShareCertificateValidation {
  static validate(data: ShareCertificateFieldData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.societyName) {
      warnings.push('Society name is blank. Fallback default will be rendered.');
    }

    if (!data.serialNo) {
      warnings.push('Serial number is blank (Blank certificate generated).');
    }

    if (data.memberName && data.memberName.length > 80) {
      warnings.push('Member name is long (>80 chars). Font size will be dynamically reduced to fit underline without overflow.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
