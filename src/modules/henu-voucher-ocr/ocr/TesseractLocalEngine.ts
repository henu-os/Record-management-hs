/**
 * HENU VOUCHER OCR — LOCAL TESSERACT.JS OCR ENGINE
 * Module: Henu Voucher OCR
 * 
 * 100% Local / Offline OCR execution via Web Worker.
 * Strictly enforces user-selected languages per OCR job:
 * - English only: 'eng'
 * - Hindi only: 'hin'
 * - Marathi only: 'mar'
 * - Any specific combination selected by user (e.g. 'eng+hin')
 * 
 * Dynamic PSM (Page Segmentation Modes) and Character Whitelisting per field.
 */

import { createWorker, Worker } from 'tesseract.js';
import { IOcrEngine, OcrEngineResult, OcrRecognizeOptions } from './types';
import { OcrLineBox, OcrWordBox } from '../schema/types';
import { PreprocessingPipeline } from './PreprocessingPipeline';

export class TesseractLocalEngine implements IOcrEngine {
  private worker: Worker | null = null;
  private currentLangs: string = '';
  private initialized: boolean = false;
  private isInitializing: boolean = false;

  /**
   * Initializes or switches the worker to the EXACT requested languages for this job.
   */
  public async initialize(languages: ('eng' | 'hin' | 'mar')[] = ['eng']): Promise<void> {
    const validLangs = languages && languages.length > 0 ? languages : ['eng'];
    const langsString = validLangs.join('+');

    // If already initialized with the exact requested language set, reuse
    if (this.initialized && this.worker && this.currentLangs === langsString) {
      return;
    }

    // Wait if already initializing
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (this.initialized && this.worker && this.currentLangs === langsString) {
        return;
      }
    }

    this.isInitializing = true;
    try {
      // Terminate existing worker if switching languages
      if (this.worker) {
        try {
          await this.worker.terminate();
        } catch { }
        this.worker = null;
        this.initialized = false;
      }

      this.currentLangs = langsString;
      this.worker = await createWorker(this.currentLangs, 1, {
        logger: () => { },
      });
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize local Tesseract OCR engine for languages:', langsString, err);
      throw new Error(`Local OCR Initialization Error for [${langsString}]: ` + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.isInitializing = false;
    }
  }

  public isInitialized(): boolean {
    return this.initialized && this.worker !== null;
  }

  public getCurrentLanguages(): string {
    return this.currentLangs;
  }

  /**
   * Configures worker parameters (PSM, whitelists) before running an OCR pass
   */
  private async applyWorkerConfig(options?: OcrRecognizeOptions): Promise<void> {
    if (!this.worker) return;

    const params: { [key: string]: any } = {};

    if (options?.psm) {
      params['tessedit_pageseg_mode'] = options.psm;
    } else {
      params['tessedit_pageseg_mode'] = '3'; // Default automatic
    }

    if (options?.charWhitelist) {
      params['tessedit_char_whitelist'] = options.charWhitelist;
    } else if (options?.isNumericOnly) {
      params['tessedit_char_whitelist'] = '0123456789.,/-+=() ₹Rs०१२३४५६७८९';
    } else {
      params['tessedit_char_whitelist'] = ''; // Clear whitelist
    }

    try {
      await this.worker.setParameters(params);
    } catch {
      // Ignore non-critical parameter rejection
    }
  }

  public async recognize(
    imageInput: string | HTMLCanvasElement | ImageData | Blob,
    options?: OcrRecognizeOptions
  ): Promise<OcrEngineResult> {
    const startTime = performance.now();

    const targetLangs = options?.languages && options.languages.length > 0
      ? options.languages
      : (this.currentLangs ? (this.currentLangs.split('+') as any) : ['eng']);

    await this.initialize(targetLangs);

    if (!this.worker) {
      throw new Error('Tesseract worker is not available');
    }

    await this.applyWorkerConfig(options);

    let processedInput: any = imageInput;
    if (options?.preprocess) {
      processedInput = await PreprocessingPipeline.process(imageInput as any, {
        grayscale: true,
        enhanceContrast: true,
        removeShadows: true,
        scaleFactor: 1.5,
      });
    }

    const { data } = await this.worker.recognize(processedInput);

    const anyData = data as any;
    const lines: OcrLineBox[] = (anyData.lines || []).map((line: any) => ({
      text: (line.text || '').trim(),
      confidence: typeof line.confidence === 'number' ? line.confidence : 0,
      bbox: {
        x0: line.bbox?.x0 || 0,
        y0: line.bbox?.y0 || 0,
        x1: line.bbox?.x1 || 0,
        y1: line.bbox?.y1 || 0,
      },
      words: (line.words || []).map((w: any) => ({
        text: (w.text || '').trim(),
        confidence: typeof w.confidence === 'number' ? w.confidence : 0,
        bbox: {
          x0: w.bbox?.x0 || 0,
          y0: w.bbox?.y0 || 0,
          x1: w.bbox?.x1 || 0,
          y1: w.bbox?.y1 || 0,
        },
      })),
    }));

    const words: OcrWordBox[] = (anyData.words || []).map((w: any) => ({
      text: (w.text || '').trim(),
      confidence: typeof w.confidence === 'number' ? w.confidence : 0,
      bbox: {
        x0: w.bbox?.x0 || 0,
        y0: w.bbox?.y0 || 0,
        x1: w.bbox?.x1 || 0,
        y1: w.bbox?.y1 || 0,
      },
    }));

    const processingTimeMs = Math.round(performance.now() - startTime);

    return {
      fullText: data.text || '',
      lines,
      words,
      confidence: typeof data.confidence === 'number' ? Math.round(data.confidence) : 0,
      processingTimeMs,
    };
  }

  /**
   * Multi-pass recognition on an isolated sub-canvas field crop across multiple preprocessing candidates
   */
  public async recognizeFieldCrop(
    cropCanvas: HTMLCanvasElement,
    options: OcrRecognizeOptions = { psm: '6' }
  ): Promise<OcrEngineResult> {
    const targetLangs = options.languages && options.languages.length > 0
      ? options.languages
      : (this.currentLangs ? (this.currentLangs.split('+') as any) : ['eng']);

    await this.initialize(targetLangs);

    const candidates: { name: string; canvas: HTMLCanvasElement }[] = [];

    // Candidate 1: Standard enhanced grayscale crop
    candidates.push({ name: 'grayscale', canvas: cropCanvas });

    const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      // Candidate 2: Contrast stretched & sharpened
      const contrastCanvas = document.createElement('canvas');
      contrastCanvas.width = cropCanvas.width;
      contrastCanvas.height = cropCanvas.height;
      const cCtx = contrastCanvas.getContext('2d');
      if (cCtx) {
        let cData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
        cData = PreprocessingPipeline.enhanceContrastAndSharpen(cData);
        cCtx.putImageData(cData, 0, 0);
        candidates.push({ name: 'contrast_sharpen', canvas: contrastCanvas });
      }

      // Candidate 3: Adaptive Sauvola thresholding for faint/light handwriting
      const binCanvas = document.createElement('canvas');
      binCanvas.width = cropCanvas.width;
      binCanvas.height = cropCanvas.height;
      const binCtx = binCanvas.getContext('2d');
      if (binCtx) {
        let bData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
        bData = PreprocessingPipeline.applyAdaptiveSauvola(bData, 0.15, 128);
        binCtx.putImageData(bData, 0, 0);
        candidates.push({ name: 'sauvola_adaptive', canvas: binCanvas });
      }
    }

    let bestResult: OcrEngineResult = {
      fullText: '',
      lines: [],
      words: [],
      confidence: 0,
      processingTimeMs: 0,
    };
    let bestScore = -1;

    // PSMs to attempt in order
    const psmList: any[] = [options.psm || '6', '6', '7', '11'].filter((v, i, a) => a.indexOf(v) === i);

    for (const psm of psmList) {
      for (const cand of candidates) {
        try {
          const res = await this.recognize(cand.canvas, {
            ...options,
            psm,
            languages: targetLangs,
            preprocess: false,
          });

          const rawClean = (res.fullText || '').replace(/\s+/g, ' ').trim();
          if (!rawClean) continue;

          let score = res.confidence;

          if (options.isNumericOnly) {
            const digitCount = (rawClean.match(/\d/g) || []).length;
            if (digitCount > 0) {
              score += digitCount * 10;
            } else {
              score -= 60;
            }
          } else {
            // Text field: bonus for actual words
            if (rawClean.length >= 3 && /[A-Za-z0-9]/.test(rawClean)) {
              score += 15;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestResult = res;
          }

          // Early exit if high-confidence output is achieved
          if (res.confidence >= 75 && rawClean.length >= 3) {
            return res;
          }
        } catch {
          // Continue testing other candidates
        }
      }

      if (bestScore > 50) {
        break;
      }
    }

    return bestResult;
  }


  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.currentLangs = '';
    }
  }
}

let engineInstance: TesseractLocalEngine | null = null;

export function getLocalOcrEngine(): TesseractLocalEngine {
  if (!engineInstance) {
    engineInstance = new TesseractLocalEngine();
  }
  return engineInstance;
}
