/**
 * HENU VOUCHER OCR — CONFIDENCE ENGINE
 * Module: Henu Voucher OCR
 * 
 * Computes individual field confidence and aggregate voucher confidence scores.
 * Categorizes confidence into HIGH (>= 85%), MEDIUM (60-84%), and LOW (< 60%).
 */

import { ExtractedVoucherFields, HenuVoucherData, ExtractedFieldResult } from '../schema/types';
import { HENU_VOUCHER_FIELDS } from '../schema/voucherSchema';

export interface FieldEvidenceContext {
  baseOcrConfidence: number;
  engineAgreementCount?: number;
  isFormatValid?: boolean;
  isSpatialMatch?: boolean;
  isArithmeticConsistent?: boolean;
  isUserCorrected?: boolean;
}

export class ConfidenceEngine {
  /**
   * Computes evidence-based field confidence from multi-factor evidence
   */
  public static computeFieldConfidence(
    rawValue: string,
    normalizedValue: any,
    extractionType: string,
    context: FieldEvidenceContext
  ): number {
    if (normalizedValue === null || normalizedValue === '' || normalizedValue === undefined) {
      return 0; // Not detected
    }

    if (context.isUserCorrected) {
      return 100;
    }

    let score = context.baseOcrConfidence > 0 ? context.baseOcrConfidence : 75;

    // Multi-engine agreement bonus (+10%)
    if (context.engineAgreementCount && context.engineAgreementCount >= 2) {
      score = Math.min(98, score + 10);
    }

    // Spatial anchor proximity bonus (+5%)
    if (context.isSpatialMatch) {
      score = Math.min(95, score + 5);
    }

    // Format validity bonus (+5%)
    if (context.isFormatValid) {
      if (extractionType === 'date' && /^\d{8}$/.test(String(normalizedValue))) {
        score = Math.min(96, score + 8);
      } else if (['amount', 'number'].includes(extractionType) && typeof normalizedValue === 'number') {
        score = Math.min(95, score + 6);
      } else if (extractionType === 'percentage' && typeof normalizedValue === 'number' && normalizedValue <= 100) {
        score = Math.min(95, score + 6);
      }
    }

    // Accounting arithmetic consistency bonus (+5%)
    if (context.isArithmeticConsistent) {
      score = Math.min(99, score + 5);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  public static calculateOverallConfidence(fields: ExtractedVoucherFields): number {
    let totalScore = 0;
    let weightSum = 0;

    for (const meta of HENU_VOUCHER_FIELDS) {
      const field = fields[meta.key];
      if (!field) continue;

      // Required fields carry higher weight (3x)
      const weight = meta.required ? 3 : 1;
      let fieldConf = Math.max(0, Math.min(100, field.confidence || 0));

      // Penalize fields with validation errors
      if (field.validationStatus === 'error') {
        fieldConf = Math.min(fieldConf, 40);
      } else if (field.validationStatus === 'warning') {
        fieldConf = Math.min(fieldConf, 70);
      }

      totalScore += fieldConf * weight;
      weightSum += weight;
    }

    return weightSum > 0 ? Math.max(0, Math.min(100, Math.round(totalScore / weightSum))) : 0;
  }

  public static getConfidenceLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'REVIEW' {
    if (score >= 85) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    if (score > 0) return 'LOW';
    return 'REVIEW';
  }

  public static getConfidenceColor(score: number): string {
    if (score >= 85) return '#10B981'; // Green
    if (score >= 60) return '#F59E0B'; // Amber / Yellow
    return '#EF4444'; // Red
  }
}
