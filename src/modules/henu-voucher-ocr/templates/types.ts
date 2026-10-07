/**
 * HENU VOUCHER OCR — TEMPLATE & LAYOUT TYPES
 * Module: Henu Voucher OCR
 */

import { HenuVoucherData, ExtractionFieldType } from '../schema/types';
import { PageSegMode } from '../ocr/types';

export interface NormalizedZone {
  // Normalized 0.0 to 1.0 bounding box relative to the rectified voucher container
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface FieldZoneDefinition {
  fieldKey: keyof HenuVoucherData;
  label: string;
  zone: NormalizedZone;
  anchorKeywords?: string[];
  expectedType: 'string' | 'number' | 'date';
  extractionType?: ExtractionFieldType;
  regexPatterns?: RegExp[];
  psm?: PageSegMode;
  isNumericOnly?: boolean;
  charWhitelist?: string;
  suppressRulingLines?: boolean;
  priority: number;
}

export interface VoucherTemplateDefinition {
  id: string;
  name: string;
  description: string;
  aspectRatio: number; // Width / Height (e.g. 520 / 395 = ~1.32 for 2-per-page A4)
  headerAnchors: string[];
  fieldZones: FieldZoneDefinition[];
}
