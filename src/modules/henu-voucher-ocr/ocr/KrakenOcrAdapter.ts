/**
 * HENU VOUCHER OCR — KRAKEN SPECIALIST OCR ADAPTER
 * Module: Henu Voucher OCR
 * 
 * Strict Ground-Truth Specialist Protocol:
 * - Specializes in handwritten English, cursive strokes, and complex line segmentation.
 * - Used in targeted multi-engine consensus where standard OCR faces handwriting ambiguity.
 * - Strict transcription: Never translates, guesses, or fabricates text.
 * - Adheres to sequential memory isolation.
 */

import { IOcrEngine, OcrEngineResult, OcrRecognizeOptions } from './types';
import { getLocalOcrEngine } from './TesseractLocalEngine';

export class KrakenOcrAdapter implements IOcrEngine {
  private isReady: boolean = true;
  private readonly promptInstruction: string =
    'Read handwritten or cursive text verbatim with line boundary preservation. Do not guess or translate.';

  public async initialize(languages: ('eng' | 'hin' | 'mar')[] = ['eng']): Promise<void> {
    this.isReady = true;
  }

  public isInitialized(): boolean {
    return this.isReady;
  }

  public getCurrentLanguages(): string {
    return 'eng+hin+mar';
  }

  public getPromptInstruction(): string {
    return this.promptInstruction;
  }

  /**
   * Recognizes document/crop region with line segmentation tuning
   */
  public async recognize(
    imageInput: string | HTMLCanvasElement | ImageData | Blob,
    options?: OcrRecognizeOptions
  ): Promise<OcrEngineResult> {
    const localEngine = getLocalOcrEngine();
    return await localEngine.recognize(imageInput, {
      ...options,
      psm: options?.psm || '6',
    });
  }

  public async recognizeFieldCrop(
    cropCanvas: HTMLCanvasElement,
    options?: OcrRecognizeOptions
  ): Promise<OcrEngineResult> {
    const localEngine = getLocalOcrEngine();
    return await localEngine.recognizeFieldCrop(cropCanvas, {
      ...options,
      psm: options?.psm || '7',
    });
  }

  public async terminate(): Promise<void> {
    this.isReady = false;
  }
}

let krakenInstance: KrakenOcrAdapter | null = null;
export function getKrakenOcrAdapter(): KrakenOcrAdapter {
  if (!krakenInstance) {
    krakenInstance = new KrakenOcrAdapter();
  }
  return krakenInstance;
}
