/**
 * HENU CHECK OCR — CONFIDENCE ENGINE
 * Module: Henu Check OCR
 */

import { ExtractedCheckFields } from '../schema/types';

export class CheckConfidenceEngine {
  private static readonly FIELD_WEIGHTS: Record<string, number> = {
    bank: 0.15,
    date: 0.15,
    payee_name: 0.15,
    amount_in_figure: 0.20,
    rupees_in_words: 0.10,
    account_no: 0.10,
    cheque_no: 0.10,
    micr_code: 0.05,
  };

  /**
   * Calculates overall weighted confidence percentage (0 to 100)
   */
  public static calculateOverallConfidence(fields: ExtractedCheckFields): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, weight] of Object.entries(this.FIELD_WEIGHTS)) {
      const field = (fields as any)[key];
      if (field) {
        const conf = typeof field.confidence === 'number' ? field.confidence : 0;
        const hasVal = field.normalizedValue !== null && field.normalizedValue !== undefined && field.normalizedValue !== '';
        const effectiveConf = hasVal ? conf : 0;

        weightedSum += effectiveConf * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0;
    return Math.round(weightedSum / totalWeight);
  }
}
