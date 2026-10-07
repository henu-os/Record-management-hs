/**
 * HENU VOUCHER OCR — EXTENDED STATE & LIFECYCLE INTERFACES
 * Module: Henu Voucher OCR
 */

import { HenuVoucherData } from './types';

export type VoucherLifecycleStatus =
  | 'pending'
  | 'processing'
  | 'review_required'
  | 'draft'
  | 'approved'
  | 'rejected'
  | 'exported'
  | 'failed';

export interface VoucherCorrectionEntry {
  fieldKey: keyof HenuVoucherData;
  fieldLabel: string;
  previousValue: any;
  correctedValue: any;
  timestamp: string;
  source: 'user_edit' | 'auto_normalization' | 'rule_fix';
  author?: string;
  reason?: string;
}

export interface VoucherApprovalInfo {
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface VoucherExportInfo {
  exportedAt?: string;
  exportFormat?: 'xlsx' | 'json' | 'zip_package';
  fileName?: string;
  exportedBy?: string;
  destinationPath?: string;
}

export interface VoucherAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export interface VoucherOcrConfig {
  enabled: boolean;
  defaultProcessingMode: 'fast' | 'high_precision' | 'thorough';
  autoProcessOnUpload: boolean;
  reviewRequiredPolicy: 'always' | 'on_warning_only' | 'on_error_only';
  zeroGuessingPolicy: boolean;
  selectedLanguages: ('eng' | 'hin' | 'mar')[];
  enableLineSuppression: boolean;
  enableAdaptiveBinarization: boolean;
  contrastEnhancement: boolean;
  batchConcurrency: number;
}

export const DEFAULT_VOUCHER_OCR_CONFIG: VoucherOcrConfig = {
  enabled: true,
  defaultProcessingMode: 'high_precision',
  autoProcessOnUpload: true,
  reviewRequiredPolicy: 'on_warning_only',
  zeroGuessingPolicy: true,
  selectedLanguages: ['eng'],
  enableLineSuppression: true,
  enableAdaptiveBinarization: true,
  contrastEnhancement: true,
  batchConcurrency: 1,
};
