/**
 * HENU CHECK OCR — 3-COLUMN PROFESSIONAL SPLIT REVIEW & VERIFICATION
 * 
 * Layout:
 * - LEFT: Original Bank Cheque Document Viewer (Zoom, Rotate, Reset, Pan)
 * - CENTER: Editable Canonical Fields with exact requested labels
 * - RIGHT: Validation & Evidence Panel (Confidence, Rules, Issues, Correction log, Approval actions)
 */

import React, { useState } from 'react';
import {
  ZoomIn, ZoomOut, RotateCw, CheckCircle2, AlertTriangle, ArrowLeft, Download,
  RefreshCw, FileCheck, ShieldCheck, XCircle, Clock, Info, Check, RotateCcw, AlertCircle
} from 'lucide-react';
import { CheckProcessingRecord, HenuCheckData, CheckFieldMetadata } from '../../../../modules/henu-check-ocr/schema/types';
import { HENU_CHECK_FIELDS } from '../../../../modules/henu-check-ocr/schema/checkSchema';
import { CheckValidationEngine } from '../../../../modules/henu-check-ocr/extraction/CheckValidationEngine';
import { CheckConfidenceEngine } from '../../../../modules/henu-check-ocr/extraction/CheckConfidenceEngine';
import { CheckExcelExportService } from '../../../../modules/henu-check-ocr/excel/CheckExcelExportService';

interface CheckReviewScreenProps {
  record: CheckProcessingRecord;
  onSave: (updatedRecord: CheckProcessingRecord) => void;
  onBack: () => void;
}

export const CheckReviewScreen: React.FC<CheckReviewScreenProps> = ({ record, onSave, onBack }) => {
  const [currentRecord, setCurrentRecord] = useState<CheckProcessingRecord>(JSON.parse(JSON.stringify(record)));
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [selectedFieldKey, setSelectedFieldKey] = useState<keyof HenuCheckData | null>('payee_name');

  const handleFieldChange = (key: keyof HenuCheckData, value: string) => {
    const updated = { ...currentRecord };
    const fieldMeta = HENU_CHECK_FIELDS.find((f: CheckFieldMetadata) => f.key === key);
    const prevVal = (updated.fields as any)[key]?.normalizedValue;

    let normVal: any = value;
    if (fieldMeta?.dataType === 'number') {
      const clean = value.replace(/[₹,]/g, '').trim();
      const parsed = parseFloat(clean);
      normVal = clean === '' || isNaN(parsed) ? (clean === '' ? null : value) : parsed;
    }

    // Record correction in history
    const correctionHistory = updated.correctionHistory ? [...updated.correctionHistory] : [];
    const existingIdx = correctionHistory.findIndex(c => c.fieldKey === key);
    const newEntry = {
      fieldKey: key,
      fieldLabel: fieldMeta?.label || String(key),
      previousValue: existingIdx >= 0 ? correctionHistory[existingIdx].previousValue : prevVal,
      correctedValue: normVal,
      timestamp: new Date().toISOString(),
      source: 'user_edit' as const,
      author: 'User',
    };
    if (existingIdx >= 0) {
      correctionHistory[existingIdx] = newEntry;
    } else {
      correctionHistory.push(newEntry);
    }

    (updated.fields as any)[key] = {
      ...updated.fields[key],
      normalizedValue: normVal,
      isUserEdited: true,
      confidence: 100, // User verified
      validationStatus: 'valid',
    };

    updated.correctionHistory = correctionHistory;

    // Recalculate validation
    const { issues, reviewRequired, isCheque } = CheckValidationEngine.validate(updated.fields);
    updated.validationIssues = issues;
    updated.reviewRequired = reviewRequired;
    updated.isChequePage = isCheque;
    updated.overallConfidence = CheckConfidenceEngine.calculateOverallConfidence(updated.fields);

    setCurrentRecord(updated);
  };

  const handleApprove = () => {
    const finalized: CheckProcessingRecord = {
      ...currentRecord,
      reviewRequired: false,
      validationIssues: [],
      lifecycleStatus: 'approved',
      approvalInfo: {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Human Reviewer',
      },
    };
    onSave(finalized);
    onBack();
  };

  const handleSaveDraft = () => {
    const draftRecord: CheckProcessingRecord = {
      ...currentRecord,
      lifecycleStatus: 'draft',
    };
    onSave(draftRecord);
    onBack();
  };

  const handleReject = () => {
    const rejectedRecord: CheckProcessingRecord = {
      ...currentRecord,
      lifecycleStatus: 'rejected',
      approvalInfo: {
        status: 'rejected',
        rejectionReason: 'Flagged for re-scan or invalid cheque document',
      },
    };
    onSave(rejectedRecord);
    onBack();
  };

  const formatDisplayValue = (meta: CheckFieldMetadata, rawVal: any): string => {
    if (rawVal === null || rawVal === undefined) return '';
    return String(rawVal);
  };

  const renderFieldInput = (meta: CheckFieldMetadata) => {
    const key = meta.key;
    const field = currentRecord.fields[key];
    const val = formatDisplayValue(meta, field?.normalizedValue);
    const status = field?.validationStatus;
    const hasErr = status === 'error';
    const isWarn = status === 'warning';
    const isSelected = selectedFieldKey === key;

    return (
      <div
        key={key}
        className="check-field-group"
        onClick={() => setSelectedFieldKey(key)}
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: isSelected ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
          border: isSelected ? '1px solid var(--accent-light)' : '1px solid transparent',
          marginBottom: 8,
        }}
      >
        <label className="check-field-label">
          <span>{meta.label}</span>
          <span style={{
            fontSize: 10,
            color: field?.isUserEdited ? 'var(--accent)' : (field?.confidence >= 80 ? '#10B981' : '#F59E0B'),
          }}>
            {field?.isUserEdited ? '✓ Manually Verified' : `Conf: ${field?.confidence || 0}%`}
          </span>
        </label>

        <input
          type="text"
          className={`check-input${hasErr ? ' has-error' : (isWarn ? ' has-warning' : ' is-valid')}`}
          value={val}
          onChange={e => handleFieldChange(key, e.target.value)}
          placeholder={`Enter ${meta.label.replace(':', '')}...`}
          style={{
            fontWeight: key === 'amount_in_figure' ? 700 : 500,
            fontSize: key === 'amount_in_figure' ? 14 : 12,
            fontFamily: (key === 'account_no' || key === 'cheque_no' || key === 'micr_code') ? 'monospace' : 'inherit',
          }}
        />
      </div>
    );
  };

  const selectedFieldEvidence = selectedFieldKey ? currentRecord.fields[selectedFieldKey]?.evidence : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-secondary btn-sm flex items-center gap-4"
            onClick={onBack}
          >
            <ArrowLeft size={14} /> Back to Inbox
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Review: {currentRecord.sourceFile} {currentRecord.totalPages > 1 && `(Page ${currentRecord.sourcePage}/${currentRecord.totalPages})`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Overall Confidence: <strong>{currentRecord.overallConfidence}%</strong> · Engine: {currentRecord.sourceEngine || 'HENU OCR'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReject}
            style={{ color: 'var(--error)' }}
          >
            Flag / Reject
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSaveDraft}
          >
            Save Draft
          </button>
          <button
            className="btn btn-primary btn-sm flex items-center gap-6"
            onClick={handleApprove}
            style={{ fontWeight: 700 }}
          >
            <CheckCircle2 size={14} /> Approve Cheque Data
          </button>
        </div>
      </div>

      {/* 3-Column Verification Layout */}
      <div className="check-3col-view">
        {/* COLUMN 1: Original Cheque Document Viewer */}
        <div className="check-card">
          <div className="check-card-header">
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Cheque Document Viewer
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
                style={{ padding: '3px 8px' }}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setZoom(z => Math.min(3.0, z + 0.2))}
                style={{ padding: '3px 8px' }}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setRotation(r => (r + 90) % 360)}
                style={{ padding: '3px 8px' }}
                title="Rotate Clockwise"
              >
                <RotateCw size={13} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setZoom(1.0); setRotation(0); }}
                style={{ padding: '3px 8px' }}
                title="Reset View"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="check-image-viewport">
            {currentRecord.imageDataUrl ? (
              <img
                src={currentRecord.imageDataUrl}
                alt="Bank Cheque"
                className="check-preview-img"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                <FileCheck size={40} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div>No cheque preview image available</div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: Editable Extracted Fields */}
        <div className="check-card">
          <div className="check-card-header">
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Extracted Bank Cheque Fields (10 Canonical Fields)
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Click field to inspect evidence
            </span>
          </div>

          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            {HENU_CHECK_FIELDS.map(meta => renderFieldInput(meta))}
          </div>
        </div>

        {/* COLUMN 3: Validation, Evidence & Diagnostics Panel */}
        <div className="check-card">
          <div className="check-card-header">
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Validation & OCR Evidence
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: currentRecord.overallConfidence >= 80 ? '#10B981' : '#F59E0B',
            }}>
              {currentRecord.overallConfidence}% Conf.
            </span>
          </div>

          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Validation Issues Alert Box */}
            {currentRecord.validationIssues.length > 0 ? (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertTriangle size={14} /> Attention Items ({currentRecord.validationIssues.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--text-primary)' }}>
                  {currentRecord.validationIssues.map((issue, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#10B981',
                fontSize: 12,
                fontWeight: 600,
              }}>
                <CheckCircle2 size={16} /> All banking validation rules satisfied.
              </div>
            )}

            {/* Active Field Evidence Snippet */}
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>
                Active Field Evidence ({selectedFieldKey ? HENU_CHECK_FIELDS.find(m => m.key === selectedFieldKey)?.label : 'None'})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: selectedFieldEvidence ? 'normal' : 'italic' }}>
                {selectedFieldEvidence || 'No raw OCR evidence snippet captured for this field.'}
              </div>
            </div>

            {/* Raw OCR Text Preview */}
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 14px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Raw OCR Text Stream
              </div>
              <textarea
                readOnly
                value={currentRecord.rawText || '(Empty OCR Stream)'}
                style={{
                  flex: 1,
                  minHeight: 140,
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  padding: 8,
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
