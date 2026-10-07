/**
 * HENU CHECK OCR — UNIFIED CHECK OCR ROUTER
 * Module: Henu Check OCR
 * 
 * Routes Bank Cheque extraction requests to either:
 *  1. HENU AI (USB Local Offline Engine: Tesseract / GLM-OCR / FireRed-OCR on connected USB)
 *  2. APIs (Configured External AI Vision APIs: Gemini / Grok / DeepSeek / OpenRouter)
 * 
 * Strictly adheres to:
 *  - Shared OCR API configuration with Voucher OCR
 *  - Dynamic USB brain detection
 *  - Zero-guessing and full field evidence
 *  - Cheque zoning and anchor isolation
 */

import { CheckProcessingRecord, ExtractedCheckFields, HenuCheckData } from '../schema/types';
import { HENU_CHECK_FIELDS, createEmptyCheckFields } from '../schema/checkSchema';
import { CheckNormalizationEngine } from '../extraction/CheckNormalizationEngine';
import { CheckValidationEngine } from '../extraction/CheckValidationEngine';
import { CheckConfidenceEngine } from '../extraction/CheckConfidenceEngine';
import { CheckFieldExtractor } from '../extraction/CheckFieldExtractor';
import { ClientOcrApiBridge } from '../../../renderer/pages/voucher-ocr/services/ClientOcrApiBridge';

export interface CheckOcrRouterOptions {
  languages?: ('eng' | 'hin' | 'mar')[];
  originalDataUrl?: string;
}

export class CheckOcrRouter {
  /**
   * Process a canvas/image using the currently active OCR mode.
   */
  public static async processCanvas(
    canvas: HTMLCanvasElement,
    fileName: string,
    sourcePage: number = 1,
    totalPages: number = 1,
    options?: CheckOcrRouterOptions
  ): Promise<CheckProcessingRecord> {
    const dataUrl = options?.originalDataUrl || canvas.toDataURL('image/png');

    // 1. Check Global OCR Execution Mode (Shared with Voucher OCR)
    let mode: 'HENU_AI' | 'APIS' = 'HENU_AI';
    try {
      const config = await ClientOcrApiBridge.getConfig();
      if (config?.mode) {
        mode = config.mode;
      }
    } catch (err) {
      console.warn('CheckOcrRouter: Failed to query OCR API config, falling back to HENU_AI mode:', err);
    }

    // 2. Route by Mode
    if (mode === 'APIS') {
      return this.processViaApi(dataUrl, fileName, sourcePage, totalPages);
    } else {
      return this.processViaHenuAiLocal(canvas, fileName, sourcePage, totalPages, options);
    }
  }

  /**
   * HENU AI Mode: Local USB-based OCR execution directly through connected USB AI Brain.
   */
  private static async processViaHenuAiLocal(
    canvas: HTMLCanvasElement,
    fileName: string,
    sourcePage: number,
    totalPages: number,
    options?: CheckOcrRouterOptions
  ): Promise<CheckProcessingRecord> {
    const api = (typeof window !== 'undefined' ? (window as any).api : null);

    // 1. Dynamic USB Validation check
    if (api?.henuAi?.getStatus) {
      const status = await api.henuAi.getStatus();
      if (!status?.isUsbConnected) {
        throw new Error(
          'HENU AI USB NOT CONNECTED. Connect the HENU AI USB to use OCR. The AI engine and OCR models are available only from the connected HENU AI USB.'
        );
      }
      if (!status?.isEngineOn) {
        throw new Error('HENU AI Engine is switched OFF. Turn ON before processing cheques.');
      }
      if (status?.state !== 'ENGINE_READY') {
        throw new Error(`HENU AI Engine is not ready (Status: ${status?.state || 'NOT_READY'}). Please verify the USB connection.`);
      }
    } else {
      // In browser / web environment without Electron API, check USB daemon directly
      try {
        const res = await fetch('http://127.0.0.1:8080/health', { signal: AbortSignal.timeout(2500) }).catch(() => null);
        if (!res || !res.ok) {
          throw new Error('USB_DISCONNECTED');
        }
        const json = await res.json().catch(() => ({}));
        if (json.status !== 'ENGINE_READY' && json.status !== 'READY') {
          throw new Error('USB_NOT_READY');
        }
      } catch {
        throw new Error(
          'HENU AI USB NOT CONNECTED. Connect the HENU AI USB to use OCR. The AI engine and OCR models are available only from the connected HENU AI USB.'
        );
      }
    }

    const dataUrl = options?.originalDataUrl || canvas.toDataURL('image/png');
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    const base64Image = match ? match[2] : dataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const targetLangs = options?.languages && options.languages.length > 0 ? options.languages : ['eng'];

    // 2. Call USB AI Brain Service (GLM-OCR + FireRed-OCR on USB)
    try {
      let usbResult: any = null;

      if (api?.henuAi?.processVoucher) {
        usbResult = await api.henuAi.processVoucher({
          base64Image,
          fileName,
          languages: targetLangs,
        });
      } else {
        const res = await fetch('http://127.0.0.1:8080/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: fileName, image_base64: base64Image, languages: targetLangs }),
        });
        if (res.ok) {
          usbResult = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
      }

      if (usbResult) {
        return this.mapUsbResultToCheckRecord(usbResult, fileName, sourcePage, totalPages, dataUrl);
      }

      throw new Error('HENU AI USB Engine returned an empty response.');
    } catch (err: any) {
      throw new Error(
        `HENU AI USB Engine execution failed: ${err.message || 'Connection refused'}. ` +
        'Please ensure the USB is securely attached and the HENU AI service is active.'
      );
    }
  }

  /**
   * API Mode: Secure main-process or resilient direct API routing.
   */
  private static async processViaApi(
    dataUrl: string,
    fileName: string,
    sourcePage: number,
    totalPages: number
  ): Promise<CheckProcessingRecord> {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/png';
    const base64Image = match ? match[2] : dataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const apiResult = await ClientOcrApiBridge.processCheck({
      base64Image,
      mimeType,
      fileName,
    });

    if (!apiResult.success) {
      const category = apiResult.errorCategory || 'API_ERROR';
      const msg = apiResult.errorMessage || 'Cheque API processing failed.';
      throw new Error(`[${category}] ${msg}`);
    }

    return CheckFieldExtractor.extractFromApiResult(
      apiResult,
      fileName,
      sourcePage,
      totalPages,
      dataUrl
    );
  }

  /**
   * Maps USB OCR output (raw text & engine segments) to Bank Cheque schema
   */
  public static mapUsbResultToCheckRecord(
    usbResult: any,
    fileName: string,
    sourcePage: number,
    totalPages: number,
    originalDataUrl: string
  ): CheckProcessingRecord {
    const fields: ExtractedCheckFields = createEmptyCheckFields();

    let fullRawText = usbResult.raw_ocr?.full_text || usbResult.raw_text || usbResult.rawText || '';
    if (!fullRawText && usbResult.engine_results && typeof usbResult.engine_results === 'object') {
      const parts: string[] = [];
      for (const eng of Object.values(usbResult.engine_results as Record<string, any>)) {
        if (eng && typeof eng === 'object') {
          if (eng.raw_text) parts.push(eng.raw_text);
          else if (eng.text) parts.push(eng.text);
        }
      }
      fullRawText = parts.join('\n\n');
    }

    // High-Precision Cheque Semantic Anchor Extraction
    const anchorMap = CheckOcrRouter.extractAnchorsFromRawText(fullRawText);

    for (const meta of HENU_CHECK_FIELDS) {
      const key = meta.key;
      const anchor = anchorMap[key];

      let rawVal = anchor?.rawValue || '';
      let normVal: any = anchor?.rawValue || null;
      let conf = anchor?.confidence || 0;

      const normalized = normVal !== null && normVal !== undefined
        ? CheckNormalizationEngine.normalizeByExtractionType(String(normVal), meta.extractionType, key)
        : null;

      const hasVal = normalized !== null && normalized !== '';
      const finalConf = hasVal ? (conf > 0 ? conf : 85) : 0;

      (fields as any)[key] = {
        rawValue: rawVal,
        normalizedValue: normalized,
        confidence: finalConf,
        validationStatus: hasVal ? 'valid' : 'warning',
        evidence: anchor?.evidence || (rawVal ? `${meta.label} ${rawVal}` : undefined),
        source: 'HENU_AI_USB',
        status: hasVal ? 'SINGLE_MODEL' : 'MISSING',
      };
    }

    const { issues, reviewRequired, isCheque } = CheckValidationEngine.validate(fields);
    const overallConfidence = isCheque ? CheckConfidenceEngine.calculateOverallConfidence(fields) : 0;

    return {
      id: usbResult.job_id || `check-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sourceFile: fileName,
      sourcePage,
      totalPages,
      processingStatus: usbResult.status === 'FAILED' ? 'failed' : 'completed',
      lifecycleStatus: isCheque ? (reviewRequired ? 'review_required' : 'approved') : 'review_required',
      isChequePage: isCheque,
      overallConfidence,
      reviewRequired,
      validationIssues: issues,
      fields,
      rawText: fullRawText,
      processedAt: usbResult.processed_at || new Date().toISOString(),
      imageDataUrl: originalDataUrl,
      sourceEngine: 'HENU_AI_USB',
      modelsExecuted: usbResult.models_executed || ['GLM-OCR / FireRed-OCR (USB)'],
    };
  }

  /**
   * High-precision semantic anchor extractor for Bank Cheques
   */
  public static extractAnchorsFromRawText(rawText: string): Partial<Record<keyof HenuCheckData, { rawValue: string; evidence: string; confidence: number }>> {
    const result: Partial<Record<keyof HenuCheckData, { rawValue: string; evidence: string; confidence: number }>> = {};
    if (!rawText) return result;

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Bank Name
      const bankMatch = line.match(/(INDIAN\s*BANK|STATE\s*BANK\s*OF\s*INDIA|SBI|HDFC\s*BANK|ICICI\s*BANK|AXIS\s*BANK|BANK\s*OF\s*BARODA|PUNJAB\s*NATIONAL\s*BANK|PNB|CANARA\s*BANK|UNION\s*BANK\s*OF\s*INDIA|BANK\s*OF\s*INDIA|BOI|KOTAK\s*MAHINDRA\s*BANK|INDUSIND\s*BANK|IDBI\s*BANK|FEDERAL\s*BANK|CENTRAL\s*BANK\s*OF\s*INDIA|SARASWAT\s*(?:CO-OP\s*)?BANK|TJSB\s*BANK|COSMOS\s*BANK|[A-Z\s]+(?:BANK|CO-OP\s*BANK)\s*(?:LTD|LIMITED)?)/i);
      if (bankMatch && bankMatch[1] && !result.bank) {
        const bName = bankMatch[1].trim();
        if (bName.length > 3 && !/^(?:A\/C|PAY|RUPEES|CHEQUE)/i.test(bName)) {
          result.bank = {
            rawValue: bName,
            evidence: line,
            confidence: 94,
          };
        }
      }

      // 2. Address / Branch
      if (/(?:BRANCH|IFSC|ROAD|MARG|STREET|NAGAR|MUMBAI|DELHI|PUNE|CHENNAI|KOLKATA|BENGALURU|AHMEDABAD|\b\d{6}\b)/i.test(line) && !result.address) {
        if (!/^(?:PAY|RUPEES|FOR|AUTHORISED)/i.test(line) && !line.includes('₹')) {
          result.address = {
            rawValue: line.replace(/^(?:BRANCH|ADDRESS)[\s\:\.]*/i, '').trim(),
            evidence: line,
            confidence: 88,
          };
        }
      }

      // 3. Date (DDMMYYYY)
      const dateBoxMatch = line.match(/(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})/)
        || line.match(/\b(\d{8})\b/);
      if (dateBoxMatch && dateBoxMatch[1] && !result.date) {
        // Verify it looks like a valid date
        const dtStr = dateBoxMatch[1].trim();
        if (!/^\d{22}$/.test(dtStr) && !dtStr.startsWith('0000')) {
          result.date = {
            rawValue: dtStr,
            evidence: line,
            confidence: 92,
          };
        }
      }

      // 4. Pay / Payee Name
      const payMatch = line.match(/(?:PAY|PAY\s*TO|PAYEE)\s*[:\.\-]*\s*([^,\n\r]+?)(?:\s+OR\s*BEARER|\s+A\/C\s*PAYEE|\s+RUPEES|$)/i);
      if (payMatch && payMatch[1] && !result.payee_name) {
        let pName = payMatch[1].trim();
        pName = pName.replace(/\s*(?:OR\s*BEARER|A\/C\s*PAYEE|RUPEES).*$/i, '').trim();
        if (pName.length > 2 && !/^(?:TOTAL|SELF|CASH|RUPEES)$/i.test(pName)) {
          result.payee_name = {
            rawValue: pName,
            evidence: line,
            confidence: 90,
          };
        }
      }

      // 5. Rupees in Words
      const wordsMatch = line.match(/(?:RUPEES|AMOUNT\s*IN\s*WORDS|^RUPEES)\s*[:\.\-]*\s*([A-Za-z\s]+?(?:ONLY)?)/i);
      if (wordsMatch && wordsMatch[1] && !result.rupees_in_words) {
        const words = wordsMatch[1].trim();
        if (words.length > 5 && !/^(?:RS|PAID|TOTAL)$/i.test(words)) {
          result.rupees_in_words = {
            rawValue: words,
            evidence: line,
            confidence: 91,
          };
        }
      }

      // 6. Amount in Figure: ₹
      const figMatch = line.match(/(?:₹|RS\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i)
        || line.match(/\b([\d,]{3,12}\.\d{2})\b/);
      if (figMatch && figMatch[1] && !result.amount_in_figure) {
        const cleanAmt = figMatch[1].replace(/,/g, '');
        if (parseFloat(cleanAmt) > 0 && !line.includes('%')) {
          result.amount_in_figure = {
            rawValue: figMatch[1],
            evidence: line,
            confidence: 95,
          };
        }
      }

      // 7. Account Number
      const acMatch = line.match(/(?:A\/C\s*(?:NO|NUM|NUMBER)?|ACCOUNT\s*(?:NO|NUM|NUMBER)?)\s*[:\.\#\-]*\s*([0-9]{8,18})/i)
        || line.match(/\b([0-9]{9,18})\b/);
      if (acMatch && acMatch[1] && !result.account_no) {
        const acNum = acMatch[1].trim();
        if (acNum.length >= 8 && acNum.length <= 18 && acNum.length !== 22) {
          result.account_no = {
            rawValue: acNum,
            evidence: line,
            confidence: 92,
          };
        }
      }

      // 8. Cheque Number & MICR Code from bottom line
      const micr22Match = line.match(/\b([0-9]{22})\b/);
      if (micr22Match && micr22Match[1]) {
        result.micr_code = {
          rawValue: micr22Match[1],
          evidence: line,
          confidence: 96,
        };
        if (!result.cheque_no) {
          // Starting 6 or 4 digits of MICR line are typically the cheque number
          result.cheque_no = {
            rawValue: micr22Match[1].substring(0, 6),
            evidence: `Extracted from starting digits of MICR line: ${micr22Match[1]}`,
            confidence: 94,
          };
        }
      }

      // Cheque No Anchor (e.g. "004582")
      const chqAnchorMatch = line.match(/(?:CHEQUE\s*(?:NO|NUM|NUMBER)|CHQ\s*NO|CHQ)\s*[:\.\#\-]*\s*([0-9]{4,8})/i);
      if (chqAnchorMatch && chqAnchorMatch[1] && !result.cheque_no) {
        result.cheque_no = {
          rawValue: chqAnchorMatch[1].trim(),
          evidence: line,
          confidence: 93,
        };
      }

      // 9. Signatory / Signature By
      const sigMatch = line.match(/(?:FOR|AUTHORISED\s*SIGNATORY|SIGNATORY)\s*[:\.\-]*\s*([A-Za-z\s\.\,\(\)]+)/i);
      if (sigMatch && sigMatch[1] && !result.signature_by) {
        const cand = sigMatch[1].trim();
        if (cand.length > 3 && !/^(?:SIGNATURE|PLEASE\s*SIGN|SIGN\s*ABOVE)/i.test(cand)) {
          result.signature_by = {
            rawValue: cand,
            evidence: line,
            confidence: 85,
          };
        }
      }
    }

    return result;
  }
}
