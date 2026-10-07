/**
 * HENU VOUCHER OCR — VOUCHER PARSER ENDPOINT
 * Module: Henu Voucher OCR / Adapters
 *
 * Orchestrates the complete voucher processing pipeline:
 *   Image → USB Validation → SHA-256 → HENU AI OCR → Adapter → Google Sheets JSON
 *
 * This endpoint is callable via:
 *   1. Electron IPC (from renderer process)
 *   2. Local HTTP API (from external automation like Opal/A2/Make.com)
 *
 * Architecture:
 *   VoucherParserEndpoint
 *     → HenuAiEngineManager (USB validation + OCR dispatch)
 *     → VoucherParserAdapter (internal → Google Sheets mapping)
 *     → VoucherParserResult (flat JSON + evidence + metadata)
 *
 * ABSOLUTE RULES:
 *   - USB must be connected and validated before processing
 *   - No fallback OCR (no browser OCR, no Windows OCR, no cached models)
 *   - No model installation (no downloads, no C: caches)
 *   - Image SHA-256 must be tracked through the entire job
 *   - Actual HENU AI USB response only — no mock/static data
 */

import crypto from 'crypto';
import { HenuAiEngineManager } from '../../../main/services/HenuAiEngineManager';
import {
  VoucherParserAdapter,
  VoucherParserResult,
  VoucherParserSheetRow,
  VOUCHER_PARSER_COLUMN_ORDER,
} from './VoucherParserAdapter';

export interface VoucherParserRequest {
  /** Base64-encoded image data (with or without data URL prefix) */
  base64Image: string;
  /** Original filename */
  fileName?: string;
  /** OCR languages (default: ['eng']) */
  languages?: string[];
}

export interface VoucherParserResponse {
  success: boolean;

  /** Flat row for Google Sheets (25 columns) */
  sheetRow?: VoucherParserSheetRow;

  /** Ordered array of values matching column headers */
  sheetArray?: (string | number | null)[];

  /** Column headers in order */
  columnHeaders?: string[];

  /** Rich evidence per field */
  evidence?: Record<string, any>;

  /** Processing metadata */
  metadata?: {
    job_id: string;
    image_sha256: string;
    processed_at: string;
    engine: string;
    workers_executed: string[];
    source_file: string;
    overall_confidence: number;
    review_required: boolean;
    validation_issues: string[];
  };

  /** Raw OCR text */
  rawText?: string;

  /** Warnings */
  warnings?: string[];

  /** Error info (if success=false) */
  error?: string;
  errorCategory?: 'USB_NOT_CONNECTED' | 'ENGINE_NOT_READY' | 'OCR_FAILED' | 'PROCESSING_ERROR';
}

export class VoucherParserEndpoint {
  /**
   * Main processing entry point.
   * Called from IPC or HTTP API.
   *
   * Flow:
   *   1. Validate USB connection
   *   2. Compute image SHA-256
   *   3. Send image to HENU AI USB via HenuAiEngineManager
   *   4. Receive raw OCR + structured fields
   *   5. Map through VoucherParserAdapter to Google Sheets schema
   *   6. Return complete result
   */
  public static async processImage(req: VoucherParserRequest): Promise<VoucherParserResponse> {
    const startTime = Date.now();

    // ─── Step 1: Validate USB Connection ───

    const engineManager = HenuAiEngineManager.getInstance();
    const auth = engineManager.validateOcrAuthorization();

    if (!auth.authorized) {
      const isDisconnected = auth.reason.includes('NOT CONNECTED');
      return {
        success: false,
        error: auth.reason,
        errorCategory: isDisconnected ? 'USB_NOT_CONNECTED' : 'ENGINE_NOT_READY',
      };
    }

    // ─── Step 2: Compute Image SHA-256 ───

    const cleanBase64 = req.base64Image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const imageSha256 = crypto.createHash('sha256').update(cleanBase64).digest('hex');
    const fileName = req.fileName || 'voucher.jpg';
    const languages = req.languages || ['eng'];

    // ─── Step 3: Send to HENU AI USB ───

    let usbResult: any;
    try {
      usbResult = await engineManager.processVoucher({
        base64Image: cleanBase64,
        fileName,
        languages,
      });
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'HENU AI USB Engine communication failure',
        errorCategory: 'OCR_FAILED',
        metadata: {
          job_id: `vp-${Date.now()}`,
          image_sha256: imageSha256,
          processed_at: new Date().toISOString(),
          engine: 'HENU_AI_USB',
          workers_executed: [],
          source_file: fileName,
          overall_confidence: 0,
          review_required: true,
          validation_issues: [err.message],
        },
      };
    }

    // ─── Step 4: Validate USB response ───

    if (!usbResult || (typeof usbResult !== 'object')) {
      return {
        success: false,
        error: 'HENU AI USB Engine returned an empty or invalid response.',
        errorCategory: 'OCR_FAILED',
      };
    }

    // ─── Step 5: Build VoucherProcessingRecord from USB result ───

    // The HenuAiEngineManager.processVoucher() returns raw USB daemon JSON.
    // We need to construct a VoucherProcessingRecord-compatible object for the adapter.
    // Import the mapping logic from OcrRouter internally.

    try {
      // Dynamically import OcrRouter to avoid circular dependency
      const { OcrRouter } = await import('../ocr/OcrRouter');

      // Create a minimal canvas-like object for processCanvas
      // Since we're in main process, we use the direct USB result mapping
      // Build a VoucherProcessingRecord from the raw USB result
      const record = (OcrRouter as any).mapUsbResultToRecord
        ? (OcrRouter as any).mapUsbResultToRecord(
            usbResult,
            fileName,
            1, // sourcePage
            1, // totalPages
            `data:image/jpeg;base64,${cleanBase64.substring(0, 50)}...` // truncated for metadata only
          )
        : null;

      if (!record) {
        return {
          success: false,
          error: 'Failed to map USB response to internal record format.',
          errorCategory: 'PROCESSING_ERROR',
        };
      }

      // Ensure image hash is set
      record.imageHash = usbResult.image_hash || imageSha256;
      record.modelsExecuted = usbResult.models_executed
        || (usbResult.model_selected ? [usbResult.model_selected] : ['HENU_AI']);

      // ─── Step 6: Adapt to Google Sheets schema ───

      const adapterResult: VoucherParserResult = VoucherParserAdapter.adapt(record);

      // Override image hash to our verified one
      adapterResult.metadata.image_sha256 = imageSha256;

      return {
        success: true,
        sheetRow: adapterResult.sheetRow,
        sheetArray: VoucherParserAdapter.toSheetArray(adapterResult.sheetRow),
        columnHeaders: [...VOUCHER_PARSER_COLUMN_ORDER],
        evidence: adapterResult.evidence,
        metadata: adapterResult.metadata,
        rawText: adapterResult.rawText,
        warnings: adapterResult.warnings,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Processing pipeline error: ${err.message}`,
        errorCategory: 'PROCESSING_ERROR',
      };
    }
  }

  /**
   * Returns the column headers for the Google Sheets schema.
   * Use this to set up the sheet header row.
   */
  public static getColumnHeaders(): string[] {
    return [...VOUCHER_PARSER_COLUMN_ORDER];
  }

  /**
   * Returns the current HENU AI USB status.
   */
  public static getEngineStatus(): any {
    return HenuAiEngineManager.getInstance().getStatusReport();
  }
}
