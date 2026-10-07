/**
 * HENU CHECK OCR — FIELD EXTRACTOR
 * Module: Henu Check OCR
 * 
 * Maps raw extraction outputs (from Online Vision APIs or USB OCR Engine)
 * into canonical CheckProcessingRecord instances.
 */

import { CheckProcessingRecord, ExtractedCheckFields } from '../schema/types';
import { HENU_CHECK_FIELDS, createEmptyCheckFields } from '../schema/checkSchema';
import { CheckNormalizationEngine } from './CheckNormalizationEngine';
import { CheckValidationEngine } from './CheckValidationEngine';
import { CheckConfidenceEngine } from './CheckConfidenceEngine';
import { OcrApiExtractionResult } from '../../../main/services/ocr-api/types';

export class CheckFieldExtractor {
  /**
   * Maps an API extraction result into a canonical CheckProcessingRecord
   */
  public static extractFromApiResult(
    apiResult: OcrApiExtractionResult,
    sourceFileName: string,
    sourcePage: number = 1,
    totalPages: number = 1,
    imageDataUrl?: string
  ): CheckProcessingRecord {
    const fields: ExtractedCheckFields = createEmptyCheckFields();
    const rawJson = apiResult.rawResponseJson || {};
    const structured = apiResult.structuredFields || {};
    const isChequeFlag = rawJson.is_cheque !== false;

    for (const meta of HENU_CHECK_FIELDS) {
      const key = meta.key;
      let rawVal = '';
      let normVal: any = null;
      let conf = 0;

      if (structured[key]) {
        rawVal = structured[key].rawValue !== undefined ? String(structured[key].rawValue) : '';
        normVal = structured[key].normalizedValue !== undefined ? structured[key].normalizedValue : null;
        conf = structured[key].confidence || 0;
      } else if (rawJson[key] !== undefined) {
        normVal = rawJson[key];
        rawVal = normVal !== null && normVal !== undefined ? String(normVal) : '';
        conf = rawJson.confidence_scores?.[key] || 90;
      }

      // Re-normalize through strict type-aware NormalizationEngine
      const sanitized = normVal !== null && normVal !== undefined
        ? CheckNormalizationEngine.normalizeByExtractionType(String(normVal), meta.extractionType, key)
        : (rawVal ? CheckNormalizationEngine.normalizeByExtractionType(rawVal, meta.extractionType, key) : null);

      const hasVal = sanitized !== null && sanitized !== '';
      const finalConf = hasVal ? (conf > 0 ? conf : 85) : 0;

      (fields as any)[key] = {
        rawValue: rawVal,
        normalizedValue: sanitized,
        confidence: finalConf,
        validationStatus: hasVal ? 'valid' : 'warning',
        evidence: rawVal ? `${meta.label} ${rawVal}` : undefined,
        source: apiResult.sourceEngine || 'HENU_VISION_API',
        status: hasVal ? 'SINGLE_MODEL' : 'MISSING',
      };
    }

    const { issues, reviewRequired, isCheque } = CheckValidationEngine.validate(fields, isChequeFlag);
    const overallConfidence = isCheque ? CheckConfidenceEngine.calculateOverallConfidence(fields) : 0;

    return {
      id: `check-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sourceFile: sourceFileName,
      sourcePage,
      totalPages,
      processingStatus: apiResult.success ? 'completed' : 'failed',
      lifecycleStatus: isCheque ? (reviewRequired ? 'review_required' : 'approved') : 'review_required',
      isChequePage: isCheque,
      overallConfidence,
      reviewRequired,
      validationIssues: issues,
      fields,
      rawText: apiResult.rawText || '',
      processedAt: new Date().toISOString(),
      imageDataUrl,
      sourceEngine: apiResult.sourceEngine || 'HENU_VISION_API',
      modelsExecuted: [apiResult.model || 'HENU Vision API'],
    };
  }
}
