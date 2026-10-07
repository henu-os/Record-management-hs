/**
 * HENU CHECK OCR — TYPES & INTERFACES
 * Module: Henu Check OCR (Bank Cheque OCR & Verification)
 */

export type ExtractionFieldType =
  | 'name'
  | 'address'
  | 'words'
  | 'amount'
  | 'date'
  | 'reference_number'
  | 'micr'
  | 'signature';

export type FieldSemanticCategory = 'TEXT' | 'IDENTIFIER' | 'DATE' | 'MONEY' | 'BANKING';

export interface CheckFieldMetadata {
  key: keyof HenuCheckData;
  label: string;
  category: 'header' | 'parties' | 'financials' | 'banking_identifiers' | 'signature';
  semanticType?: FieldSemanticCategory;
  dataType: 'string' | 'number' | 'date';
  extractionType: ExtractionFieldType;
  required?: boolean;
  description: string;
  excelColumn: string;
  excelWidth: number;
  format?: 'currency' | 'date' | 'text' | 'integer';
  likelyLabels?: string[];
  likelyLocation?: string;
  extractionStrategy?: string;
  validationStrategy?: string;
  normalizationStrategy?: string;
  confidenceStrategy?: string;
}

/** Canonical Business Fields for Bank Cheques */
export interface HenuCheckData {
  bank: string;
  address: string;
  date: string;
  payee_name: string;
  rupees_in_words: string;
  amount_in_figure: number | null;
  account_no: string;
  cheque_no: string;
  micr_code: string;
  signature_by: string;
}

/** Field-level Extraction Result with Raw OCR and Confidence */
export interface ExtractedFieldResult<T = string | number | null> {
  rawValue: string;
  normalizedValue: T;
  confidence: number; // 0 to 100
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessage?: string;
  isUserEdited?: boolean;
  boundingBox?: BoundingBox;
  evidence?: string;
  source?: string;
  sourceModels?: string[];
  status?: 'CONSENSUS' | 'SINGLE_MODEL' | 'REVIEW_REQUIRED' | 'MISSING';
}

export type ExtractedCheckFields = {
  [K in keyof HenuCheckData]: ExtractedFieldResult<HenuCheckData[K]>;
};

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CheckValidationIssue {
  fieldKey: keyof HenuCheckData | 'general';
  severity: 'warning' | 'error';
  message: string;
  expectedValue?: string | number;
  actualValue?: string | number;
}

export interface CheckCropDebugInfo {
  fieldKey: string;
  label: string;
  fieldType: ExtractionFieldType;
  zone: { xMin: number; yMin: number; xMax: number; yMax: number };
  cropDataUrl?: string;
  rawOcrText: string;
  finalValue?: any;
  confidence: number;
  validationStatus?: 'valid' | 'warning' | 'error';
}

export interface CheckProcessingRecord {
  id: string;
  sourceFile: string;
  sourcePage: number;
  totalPages: number;
  processingStatus: 'pending' | 'preprocessing' | 'ocr_running' | 'extracting' | 'completed' | 'failed';
  lifecycleStatus?: 'pending' | 'processing' | 'review_required' | 'draft' | 'approved' | 'rejected' | 'exported' | 'failed';
  isChequePage?: boolean;
  overallConfidence: number;
  reviewRequired: boolean;
  validationIssues: CheckValidationIssue[];
  fields: ExtractedCheckFields;
  rawText: string;
  processedAt: string;
  imageDataUrl?: string;
  sourceEngine?: string;
  imageHash?: string;
  modelsExecuted?: string[];
  errorMessage?: string;
  correctionHistory?: Array<{
    fieldKey: keyof HenuCheckData;
    fieldLabel: string;
    previousValue: any;
    correctedValue: any;
    timestamp: string;
    source: 'user_edit' | 'auto_normalization' | 'rule_fix';
    author?: string;
  }>;
  approvalInfo?: {
    status: 'draft' | 'pending_review' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    notes?: string;
  };
  exportInfo?: {
    exportedAt?: string;
    exportFormat?: 'xlsx' | 'json' | 'zip_package';
    fileName?: string;
  };
}
