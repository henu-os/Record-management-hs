/**
 * HENU VOUCHER OCR — OCR TYPES & ABSTRACTIONS
 * Module: Henu Voucher OCR
 */

import { OcrLineBox, OcrWordBox } from '../schema/types';

export type PageSegMode =
  | '1' // Automatic page segmentation with OSD
  | '3' // Fully automatic page segmentation (Default)
  | '4' // Assume a single column of text of variable sizes
  | '6' // Assume a single uniform block of text
  | '7' // Treat the image as a single text line
  | '8' // Treat the image as a single word
  | '11'; // Sparse text. Find as much text as possible in no particular order

export interface OcrRecognizeOptions {
  languages?: ('eng' | 'hin' | 'mar')[];
  onProgress?: (progress: { status: string; progress: number }) => void;
  roi?: { x: number; y: number; width: number; height: number };
  preprocess?: boolean;
  psm?: PageSegMode;
  charWhitelist?: string;
  isNumericOnly?: boolean;
}

export interface OcrEngineResult {
  fullText: string;
  lines: OcrLineBox[];
  words: OcrWordBox[];
  confidence: number; // 0 to 100
  processingTimeMs: number;
}

export interface IOcrEngine {
  initialize(languages?: ('eng' | 'hin' | 'mar')[]): Promise<void>;
  recognize(imageInput: string | HTMLCanvasElement | ImageData | Blob, options?: OcrRecognizeOptions): Promise<OcrEngineResult>;
  recognizeFieldCrop(cropCanvas: HTMLCanvasElement, options?: OcrRecognizeOptions): Promise<OcrEngineResult>;
  terminate(): Promise<void>;
  isInitialized(): boolean;
}
