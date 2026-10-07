/**
 * HENU IDF — TYPES & INTERFACES
 * Module: HENU IDF (Local Image to PDF)
 */

export type PageSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Original';
export type Orientation = 'Auto' | 'Portrait' | 'Landscape';
export type ImageFit = 'Fit' | 'Fill' | 'Original';
export type MarginSize = 'None' | 'Small' | 'Medium' | 'Large';

export interface IdfImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  objectUrl: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
}

export interface IdfPdfSettings {
  pageSize: PageSize;
  orientation: Orientation;
  imageFit: ImageFit;
  margins: MarginSize;
  fileName: string;
}

export interface GenerationProgress {
  current: number;
  total: number;
  phase: 'reading' | 'processing' | 'assembling' | 'completed' | 'error';
  message: string;
}

export interface GeneratedPdfResult {
  blob: Blob;
  url: string;
  fileName: string;
  pageCount: number;
  fileSize: number;
  generatedAt: string;
}
