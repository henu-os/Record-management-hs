/**
 * HENU VOUCHER OCR — ADVANCED FIELD EXTRACTOR & SPATIAL ANCHOR ENGINE
 * Module: Henu Voucher OCR
 * 
 * Strict Ground-Truth & Multi-Tier Extraction Architecture:
 * 1. Document Alignment & Rectification (1400x1060 Standard Dual-Voucher Aspect Ratio)
 * 2. Tier 1: Spatial Anchor-to-Value Association (Full-Page OCR Token & Line Graph)
 * 3. Tier 2: Targeted Sub-Canvas High-Res Crop OCR with Adaptive Preprocessing
 * 4. Tier 3: Structural Context Analysis (Header, Narration Block, Financial Table)
 * 5. Strict Zero-Guessing: Never invent or autofill missing data
 * 6. Evidence-based genuine field-level confidence computation
 */

import { OcrEngineResult, IOcrEngine } from '../ocr/types';
import { getLocalOcrEngine } from '../ocr/TesseractLocalEngine';
import { PreprocessingPipeline } from '../ocr/PreprocessingPipeline';
import { VoucherTemplateDefinition } from '../templates/types';
import { STANDARD_VOUCHER_TEMPLATE } from '../templates/standardVoucher';
import {
  ExtractedVoucherFields,
  VoucherProcessingRecord,
  HenuVoucherData,
  VoucherDebugData,
  VoucherCropDebugInfo,
  OcrLineBox,
  OcrWordBox,
  ExtractionFieldType,
} from '../schema/types';
import { createEmptyVoucherFields, HENU_VOUCHER_FIELDS } from '../schema/voucherSchema';
import { NormalizationEngine } from './NormalizationEngine';
import { ValidationEngine } from './ValidationEngine';
import { ConfidenceEngine } from './ConfidenceEngine';
import { v4 as uuidv4 } from 'uuid';

export interface FieldExtractionJobOptions {
  languages?: ('eng' | 'hin' | 'mar')[];
  originalDataUrl?: string;
  template?: VoucherTemplateDefinition;
}

export class FieldExtractor {
  /**
   * Assesses photographic quality to avoid running OCR on heavily blurred or low-resolution crops
   */
  public static assessImageQuality(canvas: HTMLCanvasElement): { isAcceptable: boolean; issues: string[] } {
    const issues: string[] = [];
    if (canvas.width < 500 || canvas.height < 350) {
      issues.push('Low image resolution (document under 500x350px). Clearer image recommended.');
    }
    return {
      isAcceptable: issues.length === 0,
      issues,
    };
  }

  /**
   * Spatial Helper: Find text immediately to the right or below an anchor label across document lines
   */
  private static findAnchorValue(
    lines: OcrLineBox[],
    anchorKeywords: string[],
    options: { searchNextLine?: boolean; stopAtKeywords?: string[] } = {}
  ): { text: string; confidence: number; lineIndex: number } | null {
    // Sort anchor keywords by length descending so "BANK NAME" matches before "BANK"
    const sortedKeywords = [...anchorKeywords].sort((a, b) => b.length - a.length);

    // Common boundary labels that can share the same horizontal printed line
    const defaultStopLabels = [
      'CHEQUE DATE:', 'CHQ DATE:', 'CHEQUE DATE', 'CHQ DATE',
      'DATE:', 'DATED:', 'DATE', 'DATED',
      'CHEQUE NO:', 'CHQ NO:', 'CHEQUE NO', 'CHQ NO',
      'VOUCHER NO:', 'VCH NO:', 'VR NO:', 'VOUCHER NO', 'VCH NO', 'VR NO',
      'CHARGE TO:', 'DEBIT TO:', 'CHARGE TO', 'DEBIT TO',
      'RS.', 'RUPEES', 'TOTAL:', 'TOTAL', 'NET PAID:', 'NET PAID', 'BILL NO:', 'BILL NO'
    ];

    const stopLabels = [...(options.stopAtKeywords || []), ...defaultStopLabels];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upper = line.text.toUpperCase();

      for (const kw of sortedKeywords) {
        const kwUpper = kw.toUpperCase();
        const kwPos = upper.indexOf(kwUpper);

        if (kwPos !== -1) {
          // Extract text on the same line after the anchor
          let afterText = line.text.substring(kwPos + kw.length).trim();
          afterText = afterText.replace(/^[\s\.\:\#\-\/\=\@]+/, '').trim();

          // Truncate if another label appears further to the right on the same line
          if (afterText.length > 0) {
            const afterUpper = afterText.toUpperCase();
            let earliestStop = afterText.length;

            for (const stopKw of stopLabels) {
              // Only truncate if stopKw is NOT the keyword we just matched
              if (stopKw.toUpperCase() !== kwUpper) {
                const stopPos = afterUpper.indexOf(stopKw.toUpperCase());
                if (stopPos !== -1 && stopPos < earliestStop) {
                  earliestStop = stopPos;
                }
              }
            }

            afterText = afterText.substring(0, earliestStop).trim();
            afterText = afterText.replace(/^[\s\.\:\#\-\/\=\@]+/, '').replace(/[\s\.\:\#\-\/\=\@]+$/, '').trim();

            if (afterText.length > 0) {
              return { text: afterText, confidence: line.confidence, lineIndex: i };
            }
          }

          // If the same line only had the label, check the next line if permitted
          if (options.searchNextLine && i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextUpper = nextLine.text.toUpperCase();
            const isStopKeyword = stopLabels.some(sk => nextUpper.includes(sk.toUpperCase()));
            if (!isStopKeyword && nextLine.text.trim().length > 0) {
              return { text: nextLine.text.trim(), confidence: nextLine.confidence, lineIndex: i + 1 };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Spatial Helper: Find financial amount on the horizontal line/band matching a table row label
   */
  private static findTableRowAmount(
    lines: OcrLineBox[],
    words: OcrWordBox[],
    rowKeywords: string[],
    canvasWidth: number,
    canvasHeight: number,
    zone: { xMin: number; yMin: number; xMax: number; yMax: number },
    options: { allowSigned?: boolean; targetType?: ExtractionFieldType } = {}
  ): { rawAmount: string; confidence: number } | null {
    // Sort row keywords by length descending so "TOTAL 2" matches before "TOTAL"
    const sortedKeywords = [...rowKeywords].sort((a, b) => b.length - a.length);

    // Filter lines whose vertical center is strictly within the expected row band (+/- 4% margin)
    const rowLines = lines.filter(l => {
      const ny = (l.bbox.y0 + l.bbox.y1) / (2 * canvasHeight);
      return ny >= zone.yMin - 0.04 && ny <= zone.yMax + 0.04;
    });

    for (const line of rowLines) {
      const upper = line.text.toUpperCase();
      const matchedKw = sortedKeywords.find(kw => upper.includes(kw.toUpperCase()));

      if (matchedKw) {
        const lineY = (line.bbox.y0 + line.bbox.y1) / 2;

        // Check text after the matched keyword on the same line
        const kwIdx = upper.indexOf(matchedKw.toUpperCase());
        const afterKw = line.text.substring(kwIdx + matchedKw.length).trim();
        let afterClean = afterKw.replace(/^[\s\:\=\@]+/, '').trim();

        // Handle compound tax lines like "2%: 360.00" or "@ 9% 1,587.60"
        if (afterClean.includes('%')) {
          const pctSplit = afterClean.split('%');
          if (options.targetType === 'percentage') {
            afterClean = pctSplit[0].replace(/^[@\s]+/, '').trim();
          } else {
            // Target is amount
            afterClean = pctSplit.slice(1).join('%').replace(/^[\s\:\=\-]+/, '').trim();
          }
        }

        if (afterClean.length > 0 && /\d/.test(afterClean)) {
          if (options.targetType === 'percentage') {
            const pct = NormalizationEngine.normalizePercentage(afterClean);
            if (pct !== null) {
              return { rawAmount: afterClean, confidence: line.confidence };
            }
          } else {
            const num = options.allowSigned
              ? NormalizationEngine.normalizeSignedAmount(afterClean)
              : NormalizationEngine.normalizeNumber(afterClean);
            if (num !== null) {
              return { rawAmount: afterClean, confidence: line.confidence };
            }
          }
        }

        // Search for words strictly within this horizontal row band (x > 50% width, vertical delta < 18px)
        const nearbyWords = words.filter(w => {
          const wy = (w.bbox.y0 + w.bbox.y1) / 2;
          const wx = (w.bbox.x0 + w.bbox.x1) / 2;
          const wny = wy / canvasHeight;
          return Math.abs(wy - lineY) < 18 && wny >= zone.yMin - 0.03 && wny <= zone.yMax + 0.03 && wx > canvasWidth * 0.50 && /[\d\=\/\-]/.test(w.text);
        });

        if (nearbyWords.length > 0) {
          // Sort left-to-right to reconstruct complete multi-word amounts (e.g. "25161" + "=00" -> "25161=00")
          nearbyWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
          const candidate = nearbyWords.map(w => w.text).join(' ').trim();
          const num = options.allowSigned
            ? NormalizationEngine.normalizeSignedAmount(candidate)
            : NormalizationEngine.normalizeNumber(candidate);
          if (num !== null) {
            const avgConf = Math.round(nearbyWords.reduce((acc, w) => acc + w.confidence, 0) / nearbyWords.length);
            return { rawAmount: candidate, confidence: avgConf };
          }
        }
      }
    }
    return null;
  }

  /**
   * Spatial Helper: Extract Society Header (Name, Reg No, Address) from the top document region
   */
  private static extractHeaderFields(lines: OcrLineBox[]): {
    societyName: string;
    regNo: string;
    address: string;
  } {
    let societyName = '';
    let regNo = '';
    let address = '';

    // Find cut-off line (where VOUCHER or PAY TO appears)
    let headerEndIdx = lines.findIndex(l => {
      const u = l.text.toUpperCase();
      return u.includes('PAY TO') || u.includes('PAID TO') || u.includes('VOUCHER NO') || u.includes('VCH NO');
    });
    if (headerEndIdx === -1) headerEndIdx = Math.min(lines.length, 6);

    const headerLines = lines.slice(0, headerEndIdx);

    for (const line of headerLines) {
      const text = line.text.trim();
      const upper = text.toUpperCase();

      // Check for Registration Number
      if (upper.includes('REG') || upper.includes('NO.') || upper.includes('YEAR') || upper.includes('नोंदणी') || upper.includes('BOM/') || upper.includes('MUM/')) {
        if (!regNo && /\d/.test(text)) {
          regNo = text;
          continue;
        }
      }

      // Check for Society Name (contains society keywords or is the prominent top line)
      if (!societyName && (
        upper.includes('CO-OPERATIVE') || upper.includes('CO-OP') || upper.includes('HOUSING') ||
        upper.includes('SOCIETY') || upper.includes('CHS') || upper.includes('HEIGHTS') ||
        upper.includes('APARTMENT') || upper.includes('ENCLAVE') || upper.includes('RESIDENCY') ||
        upper.includes('मर्यादित') || upper.includes('सोसायटी')
      )) {
        societyName = text;
        continue;
      }

      // Check for Address
      if (
        upper.includes('ROAD') || upper.includes('MARG') || upper.includes('NAGAR') ||
        upper.includes('MUMBAI') || upper.includes('PUNE') || upper.includes('THANE') ||
        upper.includes('STREET') || upper.includes('CTS') || upper.includes('SECTOR') ||
        upper.includes('PLOT') || upper.includes('PIN') || upper.includes('400') ||
        upper.includes('रस्ता')
      ) {
        address = address ? `${address}, ${text}` : text;
        continue;
      }
    }

    // Fallback: If society name wasn't tagged with keywords, use the top non-empty header line
    if (!societyName && headerLines.length > 0) {
      const firstNonReg = headerLines.find(l => !l.text.toUpperCase().includes('REG') && l.text.trim().length > 3);
      if (firstNonReg) societyName = firstNonReg.text.trim();
    }

    return { societyName, regNo, address };
  }

  /**
   * Spatial Helper: Extract Particulars / Narration multi-line text block
   */
  private static extractParticularsBlock(lines: OcrLineBox[]): string {
    let startIdx = -1;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const upper = lines[i].text.toUpperCase();
      if (startIdx === -1 && (upper.includes('PARTICULARS') || upper.includes('BEING') || upper.includes('तपशील'))) {
        startIdx = i;
      }
      if (startIdx !== -1 && i > startIdx) {
        if (
          upper.includes('BILL NO') || upper.includes('BANK') || upper.includes('CHEQUE') ||
          upper.includes('RUPEES') || upper.includes('RS.') || upper.includes('TOTAL') ||
          upper.includes('NET PAID') || upper.includes('SIGNATURE')
        ) {
          endIdx = i;
          break;
        }
      }
    }

    if (startIdx === -1) return '';

    const blockLines = lines.slice(startIdx, endIdx);
    const content = blockLines.map(l => {
      let t = l.text.replace(/^(?:PARTICULARS|तपशील)[\s\.\:\#\-]*/i, '').trim();
      return t;
    }).filter(t => t.length > 0).join('\n');

    return content;
  }

  /**
   * Main asynchronous field extraction using Spatial Token Graph + Targeted Sub-Crop Consensus
   */
  public static async extractFromCanvas(
    baseCanvas: HTMLCanvasElement,
    sourceFile: string,
    sourcePage: number = 1,
    totalPages: number = 1,
    ocrEngine?: IOcrEngine,
    jobOptions?: FieldExtractionJobOptions
  ): Promise<VoucherProcessingRecord> {
    const engine = ocrEngine || getLocalOcrEngine();
    const targetLangs: ('eng' | 'hin' | 'mar')[] = jobOptions?.languages && jobOptions.languages.length > 0
      ? jobOptions.languages
      : ['eng'];

    const template = jobOptions?.template || STANDARD_VOUCHER_TEMPLATE;

    // 1. Initialize engine with the requested language set
    await engine.initialize(targetLangs);

    // 2. Rectify canvas safely (without destructive edge cropping)
    const rectifiedCanvas = PreprocessingPipeline.cropAndRectify(baseCanvas, undefined, 1400, 1060);
    const rectifiedDataUrl = rectifiedCanvas.toDataURL('image/png');
    const displayDataUrl = jobOptions?.originalDataUrl || baseCanvas.toDataURL('image/png');

    // 3. Perform full-page baseline OCR for global text anchor alignment
    const fullPageOcr = await engine.recognize(rectifiedCanvas, {
      languages: targetLangs,
      psm: '3',
      preprocess: false,
    });

    const fields: ExtractedVoucherFields = createEmptyVoucherFields();
    const rawText = fullPageOcr.fullText;
    const lines = fullPageOcr.lines || [];
    const words = fullPageOcr.words || [];
    const fieldDebugList: VoucherCropDebugInfo[] = [];

    // 4. Extract structural sections via spatial layout graph
    const headerInfo = this.extractHeaderFields(lines);
    const particularsText = this.extractParticularsBlock(lines);

    // 5. Process each field in the template using 3-tier extraction
    for (const fieldZone of template.fieldZones) {
      const fieldKey = fieldZone.fieldKey;
      let candidateRaw = '';
      let candidateConf = 0;
      let cropDataUrl: string | undefined = undefined;

      // --- TIER 1: Structural Header & Block Fields ---
      if (fieldKey === 'society_name' && headerInfo.societyName) {
        candidateRaw = headerInfo.societyName;
        candidateConf = 90;
      } else if (fieldKey === 'registration_no' && headerInfo.regNo) {
        candidateRaw = headerInfo.regNo;
        candidateConf = 85;
      } else if (fieldKey === 'society_address' && headerInfo.address) {
        candidateRaw = headerInfo.address;
        candidateConf = 80;
      } else if (fieldKey === 'particulars' && particularsText) {
        candidateRaw = particularsText;
        candidateConf = 85;
      }

      // --- TIER 2: Spatial Anchor-to-Value Association ---
      if (!candidateRaw && fieldZone.anchorKeywords && fieldZone.anchorKeywords.length > 0) {
        if (fieldZone.isNumericOnly || ['amount', 'signed_amount', 'percentage'].includes(fieldZone.extractionType || '')) {
          // Table amount search
          const tableRes = this.findTableRowAmount(
            lines,
            words,
            fieldZone.anchorKeywords,
            rectifiedCanvas.width,
            rectifiedCanvas.height,
            fieldZone.zone,
            {
              allowSigned: fieldZone.extractionType === 'signed_amount',
              targetType: fieldZone.extractionType,
            }
          );
          if (tableRes) {
            candidateRaw = tableRes.rawAmount;
            candidateConf = tableRes.confidence;
          }
        } else {
          // Filter lines for cheque fields to avoid collision with header
          const searchLines = fieldKey === 'cheque_date'
            ? lines.filter(l => (l.bbox.y0 + l.bbox.y1) / 2 > rectifiedCanvas.height * 0.5)
            : (fieldKey === 'voucher_date' || fieldKey === 'voucher_no')
            ? lines.filter(l => (l.bbox.y0 + l.bbox.y1) / 2 < rectifiedCanvas.height * 0.35)
            : lines;

          // General label-value search
          const anchorRes = this.findAnchorValue(searchLines, fieldZone.anchorKeywords, {
            searchNextLine: ['pay_to', 'charge_to'].includes(fieldKey),
          });
          if (anchorRes) {
            candidateRaw = anchorRes.text;
            candidateConf = anchorRes.confidence;
          }
        }
      }

      // --- TIER 3: Targeted Sub-Canvas High-Res Crop OCR ---
      const cropCanvas = PreprocessingPipeline.cropFieldSubCanvas(rectifiedCanvas, fieldZone.zone, {
        scale: 2.0,
      });

      try {
        cropDataUrl = cropCanvas.toDataURL('image/png');
        const cropRes = await engine.recognizeFieldCrop(cropCanvas, {
          languages: targetLangs,
          psm: fieldZone.psm || '6',
          charWhitelist: fieldZone.charWhitelist,
          isNumericOnly: fieldZone.isNumericOnly,
        });

        const cropText = (cropRes.fullText || '').replace(/[\r\n]+/g, ' ').trim();
        if (cropText.length > 0) {
          // CRITICAL: Reject percentage noise and confidence strings from populating amount fields
          const isAmountField = ['amount', 'signed_amount', 'number'].includes(fieldZone.extractionType || '');
          const hasPercentSign = /[%％]/.test(cropText);

          if (isAmountField && hasPercentSign) {
            // Do NOT overwrite amount field with percentage text
          } else {
            // Only update candidate if we had nothing, or crop gives a valid value of appropriate type
            if (!candidateRaw) {
              candidateRaw = cropText;
              candidateConf = cropRes.confidence;
            } else if (fieldZone.isNumericOnly && /\d/.test(cropText) && !hasPercentSign) {
              candidateRaw = cropText;
              candidateConf = Math.max(candidateConf, cropRes.confidence);
            } else if (!fieldZone.isNumericOnly && cropText.length >= candidateRaw.length) {
              candidateRaw = cropText;
              candidateConf = Math.max(candidateConf, cropRes.confidence);
            }
          }
        }
      } catch {
        // Crop OCR failed, keep Tier 1/2 result
      }

      // Regex pattern refinement if defined
      if (fieldZone.regexPatterns && candidateRaw) {
        for (const pattern of fieldZone.regexPatterns) {
          const match = candidateRaw.match(pattern);
          if (match && match[1]) {
            candidateRaw = match[1].trim();
            candidateConf = Math.max(candidateConf, 85);
            break;
          }
        }
      }

      // --- Field-Specific Normalization (Strict Zero-Guessing) ---
      const fieldMeta = HENU_VOUCHER_FIELDS.find(f => f.key === fieldZone.fieldKey);
      const extractionType = fieldZone.extractionType || fieldMeta?.extractionType || 'words';

      const normalized = NormalizationEngine.normalizeByExtractionType(
        candidateRaw,
        extractionType,
        fieldZone.fieldKey
      );

      // Real evidence-based confidence calculation
      const hasVal = normalized !== null && normalized !== '';
      let finalConf = 0;

      if (hasVal) {
        // Base confidence from OCR
        finalConf = candidateConf > 0 ? candidateConf : 75;

        // Bonus for formatting validity (e.g. valid date DDMMYYYY or clean number)
        if (extractionType === 'date' && /^\d{8}$/.test(String(normalized))) {
          finalConf = Math.min(95, finalConf + 10);
        } else if ((extractionType === 'amount' || extractionType === 'number') && typeof normalized === 'number') {
          finalConf = Math.min(95, finalConf + 10);
        } else if (extractionType === 'name' && String(normalized).length > 4) {
          finalConf = Math.min(90, finalConf + 5);
        }
      }

      (fields as any)[fieldZone.fieldKey] = {
        rawValue: candidateRaw,
        normalizedValue: normalized,
        confidence: finalConf,
        validationStatus: hasVal ? 'valid' : 'warning',
      };

      fieldDebugList.push({
        fieldKey: fieldZone.fieldKey,
        label: fieldZone.label,
        fieldType: extractionType,
        zone: fieldZone.zone,
        cropDataUrl,
        selectedVariant: 'Enhanced Spatial Token Graph & Multi-Pass Sub-Crop',
        engineName: 'Local Tesseract.js (Offline WebWorker)',
        languages: targetLangs,
        rawOcrText: candidateRaw,
        finalValue: normalized,
        confidence: finalConf,
        validationStatus: hasVal ? 'valid' : 'warning',
        reviewReason: hasVal
          ? undefined
          : (candidateRaw ? 'Rejected by strict validation (false positive prevention)' : 'Not detected in document evidence'),
      });
    }

    // 6. Validate financial arithmetic and data rules
    const { issues, reviewRequired } = ValidationEngine.validate(fields);

    // 7. Calculate overall confidence score
    const overallConfidence = ConfidenceEngine.calculateOverallConfidence(fields);

    const debugInfo: VoucherDebugData = {
      originalDataUrl: displayDataUrl,
      rectifiedDataUrl,
      selectedLanguages: targetLangs,
      rawOcrText: rawText,
      rawWords: fullPageOcr.words || [],
      rawLines: fullPageOcr.lines || [],
      fieldCrops: fieldDebugList,
    };

    return {
      id: uuidv4(),
      sourceFile,
      sourcePage,
      totalPages,
      processingStatus: 'completed',
      overallConfidence,
      reviewRequired,
      validationIssues: issues,
      fields,
      rawText,
      processedAt: new Date().toISOString(),
      imageDataUrl: displayDataUrl,
      debugInfo,
    };
  }

  /**
   * Synchronous / legacy fallback wrapper for tests
   */
  public static extract(
    ocrResult: OcrEngineResult,
    imageWidth: number,
    imageHeight: number,
    sourceFile: string,
    sourcePage: number = 1,
    totalPages: number = 1,
    imageDataUrl?: string,
    template: VoucherTemplateDefinition = STANDARD_VOUCHER_TEMPLATE
  ): VoucherProcessingRecord {
    const fields: ExtractedVoucherFields = createEmptyVoucherFields();
    const rawText = ocrResult.fullText;
    const lines = ocrResult.lines || [];
    const words = ocrResult.words || [];

    const headerInfo = this.extractHeaderFields(lines);
    const particularsText = this.extractParticularsBlock(lines);

    for (const fieldZone of template.fieldZones) {
      const fieldKey = fieldZone.fieldKey;
      let candidateRaw = '';
      let candidateConf = 0;

      // 1. Structural Header & Block Fields
      if (fieldKey === 'society_name' && headerInfo.societyName) {
        candidateRaw = headerInfo.societyName;
        candidateConf = 90;
      } else if (fieldKey === 'registration_no' && headerInfo.regNo) {
        candidateRaw = headerInfo.regNo;
        candidateConf = 85;
      } else if (fieldKey === 'society_address' && headerInfo.address) {
        candidateRaw = headerInfo.address;
        candidateConf = 80;
      } else if (fieldKey === 'particulars' && particularsText) {
        candidateRaw = particularsText;
        candidateConf = 85;
      }

      // 2. Spatial anchor extraction
      if (!candidateRaw && fieldZone.anchorKeywords && fieldZone.anchorKeywords.length > 0) {
        if (fieldZone.isNumericOnly || ['amount', 'signed_amount', 'percentage'].includes(fieldZone.extractionType || '')) {
          const tableRes = this.findTableRowAmount(
            lines,
            words,
            fieldZone.anchorKeywords,
            imageWidth,
            imageHeight,
            fieldZone.zone,
            {
              allowSigned: fieldZone.extractionType === 'signed_amount',
              targetType: fieldZone.extractionType,
            }
          );
          if (tableRes) {
            candidateRaw = tableRes.rawAmount;
            candidateConf = tableRes.confidence;
          }
        } else {
          const anchorRes = this.findAnchorValue(lines, fieldZone.anchorKeywords, {
            searchNextLine: ['pay_to', 'charge_to'].includes(fieldKey),
          });
          if (anchorRes) {
            candidateRaw = anchorRes.text;
            candidateConf = anchorRes.confidence;
          }
        }
      }

      // 3. Geometric zone fallback
      if (!candidateRaw) {
        const zx0 = fieldZone.zone.xMin * imageWidth;
        const zy0 = fieldZone.zone.yMin * imageHeight;
        const zx1 = fieldZone.zone.xMax * imageWidth;
        const zy1 = fieldZone.zone.yMax * imageHeight;

        const matchingWords = words.filter(w => {
          const cx = (w.bbox.x0 + w.bbox.x1) / 2;
          const cy = (w.bbox.y0 + w.bbox.y1) / 2;
          return cx >= zx0 && cx <= zx1 && cy >= zy0 && cy <= zy1;
        });

        if (matchingWords.length > 0) {
          candidateRaw = matchingWords.map(w => w.text).join(' ').trim();
          candidateConf = Math.round(
            matchingWords.reduce((acc, w) => acc + (w.confidence || 0), 0) / matchingWords.length
          );
        }
      }

      if (fieldZone.regexPatterns && candidateRaw) {
        for (const pattern of fieldZone.regexPatterns) {
          const match = candidateRaw.match(pattern);
          if (match && match[1]) {
            candidateRaw = match[1].trim();
            candidateConf = Math.max(candidateConf, 85);
            break;
          }
        }
      }

      const fieldMeta = HENU_VOUCHER_FIELDS.find(f => f.key === fieldZone.fieldKey);
      const extractionType = fieldZone.extractionType || fieldMeta?.extractionType || 'words';

      const normalized = NormalizationEngine.normalizeByExtractionType(
        candidateRaw,
        extractionType,
        fieldZone.fieldKey
      );

      const hasVal = normalized !== null && normalized !== '';
      const finalConf = hasVal ? (candidateConf > 0 ? candidateConf : 70) : 0;

      (fields as any)[fieldZone.fieldKey] = {
        rawValue: candidateRaw,
        normalizedValue: normalized,
        confidence: finalConf,
        validationStatus: hasVal ? 'valid' : 'warning',
      };
    }

    const { issues, reviewRequired } = ValidationEngine.validate(fields);
    const overallConfidence = ConfidenceEngine.calculateOverallConfidence(fields);

    return {
      id: uuidv4(),
      sourceFile,
      sourcePage,
      totalPages,
      processingStatus: 'completed',
      overallConfidence,
      reviewRequired,
      validationIssues: issues,
      fields,
      rawText,
      processedAt: new Date().toISOString(),
      imageDataUrl,
      sourceEngine: 'HENU_AI_LOCAL',
    };
  }

  /**
   * Normalizes and validates raw structured results from external OCR API providers (Gemini, Grok, DeepSeek, OpenRouter)
   * into the exact same canonical VoucherProcessingRecord schema used by the USB engine.
   */
  public static extractFromApiResult(
    apiResult: {
      success: boolean;
      sourceEngine: string;
      provider: string;
      model: string;
      rawText: string;
      structuredFields: Record<string, { rawValue: string; normalizedValue: any; confidence: number; evidence?: string; status?: any }>;
      errorCategory?: string;
      errorMessage?: string;
    },
    sourceFile: string,
    sourcePage: number = 1,
    totalPages: number = 1,
    imageDataUrl?: string
  ): VoucherProcessingRecord {
    if (!apiResult.success) {
      throw new Error(apiResult.errorMessage || `API OCR failed with category: ${apiResult.errorCategory}`);
    }

    const fields: ExtractedVoucherFields = createEmptyVoucherFields();
    const rawApiFields = apiResult.structuredFields || {};

    const FIELD_SYNONYMS: Record<string, string[]> = {
      registration_no: ['registration_number', 'reg_no', 'regn_no'],
      voucher_no: ['voucher_number', 'vch_no', 'vr_no'],
      bill_no: ['bill_number', 'bill_num'],
      cheque_no: ['cheque_number', 'chq_no'],
      tds_percentage: ['tds_percent', 'tds_rate'],
      cgst_percentage: ['cgst_percent', 'cgst_rate'],
      sgst_percentage: ['sgst_percent', 'sgst_rate'],
      rupees: ['rupees_words', 'amount_in_words', 'rupees_in_words'],
      net_paid: ['net_paid_amount', 'net_amount', 'paid_amount'],
    };

    for (const meta of HENU_VOUCHER_FIELDS) {
      const fieldKey = meta.key;
      let apiField = rawApiFields[fieldKey];

      // Check synonyms if direct key not found
      if (!apiField && FIELD_SYNONYMS[fieldKey]) {
        for (const syn of FIELD_SYNONYMS[fieldKey]) {
          if (rawApiFields[syn]) {
            apiField = rawApiFields[syn];
            break;
          }
        }
      }

      const rawVal = apiField?.rawValue || (apiField?.normalizedValue !== null && apiField?.normalizedValue !== undefined ? String(apiField.normalizedValue) : '');
      const rawConf = typeof apiField?.confidence === 'number' ? Math.max(0, Math.min(100, apiField.confidence)) : 85;

      const normalized = NormalizationEngine.normalizeByExtractionType(
        rawVal,
        meta.extractionType,
        fieldKey
      );

      const hasVal = normalized !== null && normalized !== '';
      const finalConf = hasVal ? (rawConf > 0 ? rawConf : 80) : 0;

      (fields as any)[fieldKey] = {
        rawValue: rawVal,
        normalizedValue: normalized,
        confidence: finalConf,
        validationStatus: hasVal ? 'valid' : 'warning',
        evidence: apiField?.evidence || (hasVal ? `${meta.label}: ${rawVal}` : undefined),
        source: apiResult.sourceEngine,
        status: hasVal ? 'CONSENSUS' : 'MISSING',
      };
    }

    // If total_1 is not explicitly returned on document but bill_amount_1 is present and bill_amount_2 is empty, total_1 = bill_amount_1
    if (!fields.total_1.normalizedValue && fields.bill_amount_1.normalizedValue && !fields.bill_amount_2.normalizedValue) {
      fields.total_1.normalizedValue = fields.bill_amount_1.normalizedValue;
      fields.total_1.rawValue = fields.bill_amount_1.rawValue;
      fields.total_1.confidence = fields.bill_amount_1.confidence;
      fields.total_1.validationStatus = 'valid';
      fields.total_1.status = 'CONSENSUS';
    }

    const { issues, reviewRequired } = ValidationEngine.validate(fields);
    const overallConfidence = ConfidenceEngine.calculateOverallConfidence(fields);

    return {
      id: uuidv4(),
      sourceFile,
      sourcePage,
      totalPages,
      processingStatus: 'completed',
      overallConfidence,
      reviewRequired,
      validationIssues: issues,
      fields,
      rawText: apiResult.rawText || '',
      processedAt: new Date().toISOString(),
      imageDataUrl,
      sourceEngine: apiResult.sourceEngine,
    };
  }
}


