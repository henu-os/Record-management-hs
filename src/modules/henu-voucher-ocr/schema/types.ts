/**
 * HENU VOUCHER OCR — TYPES & INTERFACES
 * Module: Henu Voucher OCR (Isolated Subsystem)
 */

export type ExtractionFieldType =
  | 'name'
  | 'address'
  | 'words'
  | 'sentence'
  | 'number'
  | 'amount'
  | 'date'
  | 'percentage'
  | 'reference_number'
  | 'mixed_alphanumeric'
  | 'signed_amount'
  | 'ledger_text';

export type FieldSemanticCategory = 'TEXT' | 'IDENTIFIER' | 'DATE' | 'MONEY' | 'PERCENTAGE';

export interface VoucherFieldMetadata {
  key: keyof HenuVoucherData;
  label: string;
  category: 'header' | 'voucher_info' | 'parties' | 'particulars' | 'financials' | 'payment_details' | 'tax' | 'net';
  semanticType?: FieldSemanticCategory;
  dataType: 'string' | 'number' | 'date';
  extractionType: ExtractionFieldType;
  required?: boolean;
  description: string;
  excelColumn: string;
  excelWidth: number;
  format?: 'currency' | 'date' | 'percentage' | 'text' | 'integer';
  likelyLabels?: string[];
  likelyLocation?: string;
  extractionStrategy?: string;
  ocrEnginePreference?: 'glm' | 'firered' | 'kraken' | 'consensus';
  validationStrategy?: string;
  normalizationStrategy?: string;
  confidenceStrategy?: string;
}

/** Canonical Business Fields (Fixed Master Schema) */
export interface HenuVoucherData {
  society_name: string;
  registration_no: string;
  society_address: string;
  voucher_no: string;
  voucher_date: string;
  pay_to: string;
  charge_to: string;
  particulars: string;
  bill_amount_1: number | null;
  bill_amount_2: number | null;
  advance_paid: number | null;
  total_1: number | null;
  tds_percentage: number | null;
  tds_amount: number | null;
  total_2: number | null;
  bill_no: string;
  bank_name: string;
  cheque_no: string;
  cheque_date: string;
  rupees: string;
  cgst_percentage: number | null;
  cgst_amount: number | null;
  sgst_percentage: number | null;
  sgst_amount: number | null;
  round_off: number | null;
  net_paid: number | null;
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

export type ExtractedVoucherFields = {
  [K in keyof HenuVoucherData]: ExtractedFieldResult<HenuVoucherData[K]>;
};

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWordBox {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  language?: string;
}

export interface OcrLineBox {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OcrWordBox[];
}

export interface ValidationIssue {
  fieldKey: keyof HenuVoucherData;
  severity: 'warning' | 'error';
  message: string;
  expectedValue?: string | number;
  actualValue?: string | number;
}

export interface VoucherCropDebugInfo {
  fieldKey: string;
  label: string;
  fieldType: ExtractionFieldType;
  zone: { xMin: number; yMin: number; xMax: number; yMax: number };
  cropDataUrl?: string;
  selectedVariant?: string;
  engineName?: string;
  languages?: string[];
  rawOcrText: string;
  finalValue?: any;
  confidence: number;
  validationStatus?: 'valid' | 'warning' | 'error';
  reviewReason?: string;
}



export interface VoucherDebugData {
  originalDataUrl?: string;
  rectifiedDataUrl?: string;
  selectedLanguages: ('eng' | 'hin' | 'mar')[];
  rawOcrText: string;
  rawWords: OcrWordBox[];
  rawLines: OcrLineBox[];
  fieldCrops: VoucherCropDebugInfo[];
}

export interface VoucherProcessingRecord {
  id: string;
  sourceFile: string;
  sourcePage: number;
  totalPages: number;
  processingStatus: 'pending' | 'preprocessing' | 'ocr_running' | 'extracting' | 'completed' | 'failed';
  lifecycleStatus?: 'pending' | 'processing' | 'review_required' | 'draft' | 'approved' | 'rejected' | 'exported' | 'failed';
  overallConfidence: number;
  reviewRequired: boolean;
  validationIssues: ValidationIssue[];
  fields: ExtractedVoucherFields;
  rawText: string;
  processedAt: string;
  imageDataUrl?: string; // Preview image data URL (for single view / review)
  sourceEngine?: string;
  imageHash?: string;
  modelsExecuted?: string[];
  modelStatus?: Record<string, string>;
  errorMessage?: string;
  debugInfo?: VoucherDebugData;
  correctionHistory?: Array<{
    fieldKey: keyof HenuVoucherData;
    fieldLabel: string;
    previousValue: any;
    correctedValue: any;
    timestamp: string;
    source: 'user_edit' | 'auto_normalization' | 'rule_fix';
    author?: string;
    reason?: string;
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
    exportedBy?: string;
    destinationPath?: string;
  };
  auditTrail?: Array<{
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    details: string;
  }>;
}

export interface ProcessingProgressUpdate {
  stage: string;
  progressPercent: number;
  currentPage: number;
  totalPages: number;
  currentFileName: string;
  extractedCount: number;
  reviewCount: number;
}

export type HenuAiEngineState =
  | 'ENGINE_READY'
  | 'ENGINE_STANDBY'
  | 'ENGINE_OFF'
  | 'USB_DISCONNECTED'
  | 'MODELS_UNAVAILABLE'
  | 'INSUFFICIENT_PRIVILEGES'
  | 'ENGINE_ERROR';

export interface HenuAiEngineStatusReport {
  state: HenuAiEngineState;
  isEngineOn: boolean;
  isUsbConnected: boolean;
  usbDriveLetter: string;
  engineRootPath: string;
  modelsDirectory: string;
  tempDirectory: string;
  runtimeStatus: 'OPERATIONAL' | 'OFFLINE' | 'DEGRADED' | 'ERROR';
  statusMessage: string;
  lastHealthCheck: string;
  models: {
    tesseract: { name: string; key: string; status: 'READY' | 'STANDBY' | 'ERROR'; modelPath: string; lastChecked: string; isAvailable: boolean };
    glmOcr: { name: string; key: string; status: 'READY' | 'STANDBY' | 'ERROR'; modelPath: string; lastChecked: string; isAvailable: boolean };
    fireRedOcr: { name: string; key: string; status: 'READY' | 'STANDBY' | 'ERROR'; modelPath: string; lastChecked: string; isAvailable: boolean };
    kraken: { name: string; key: string; status: 'READY' | 'STANDBY' | 'ERROR'; modelPath: string; lastChecked: string; isAvailable: boolean };
    llamaVision?: { name: string; key: string; status: 'READY' | 'STANDBY' | 'ERROR'; modelPath: string; lastChecked: string; isAvailable: boolean };
    qwen3Coder?: { name: string; key: string; status: 'READY' | 'STANDBY' | 'ERROR'; modelPath: string; lastChecked: string; isAvailable: boolean };
  };
  diagnostics: {
    offlineMode: boolean;
    zeroCloudTelemetry: boolean;
    activeJobsCount: number;
    memoryCleanupEnabled: boolean;
    sequentialExecution: boolean;
  };
}


