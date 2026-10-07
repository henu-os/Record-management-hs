/**
 * HENU VOUCHER OCR — 3-COLUMN PROFESSIONAL SPLIT REVIEW & VERIFICATION
 * Layout:
 * - LEFT: Original Voucher Document Viewer (Zoom, Rotate, Reset, Pan)
 * - CENTER: Extracted Accounting Form (Header, Payee/Voucher, Narration, 10-Row Financials, Cheque/Bank)
 * - RIGHT: Validation & Evidence Panel (Confidence, Math rules, Issues, Correction log, Approval actions)
 */

import React, { useState } from 'react';
import {
  ZoomIn, ZoomOut, RotateCw, CheckCircle2, AlertTriangle, ArrowLeft, Download,
  RefreshCw, FileCheck, ShieldCheck, XCircle, Clock, Info, Check, History, RotateCcw
} from 'lucide-react';
import { VoucherProcessingRecord, HenuVoucherData, VoucherFieldMetadata } from '../../../../modules/henu-voucher-ocr/schema/types';
import { HENU_VOUCHER_FIELDS } from '../../../../modules/henu-voucher-ocr/schema/voucherSchema';
import { ValidationEngine } from '../../../../modules/henu-voucher-ocr/extraction/ValidationEngine';
import { ConfidenceEngine } from '../../../../modules/henu-voucher-ocr/extraction/ConfidenceEngine';
import { ExcelExportService } from '../../../../modules/henu-voucher-ocr/excel/ExcelExportService';

interface VoucherReviewScreenProps {
  record: VoucherProcessingRecord;
  onSave: (updatedRecord: VoucherProcessingRecord) => void;
  onBack: () => void;
}

export const VoucherReviewScreen: React.FC<VoucherReviewScreenProps> = ({ record, onSave, onBack }) => {
  const [currentRecord, setCurrentRecord] = useState<VoucherProcessingRecord>(JSON.parse(JSON.stringify(record)));
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // Field edit handler with tracked correction log
  const handleFieldChange = (key: keyof HenuVoucherData, value: string) => {
    const updated = { ...currentRecord };
    const fieldMeta = HENU_VOUCHER_FIELDS.find((f: VoucherFieldMetadata) => f.key === key);
    const prevVal = (updated.fields as any)[key]?.normalizedValue;

    let normVal: any = value;
    if (fieldMeta?.dataType === 'number') {
      const clean = value.replace(/,/g, '').trim();
      const parsed = parseFloat(clean);
      normVal = clean === '' || isNaN(parsed) ? (clean === '' ? null : value) : parsed;
    }

    // Record correction entry in history (deduplicated by fieldKey)
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
      validationMessage: undefined,
    };

    updated.correctionHistory = correctionHistory;

    // Recalculate mathematical validation
    const { issues, reviewRequired } = ValidationEngine.validate(updated.fields);
    updated.validationIssues = issues;
    updated.reviewRequired = reviewRequired;
    updated.overallConfidence = ConfidenceEngine.calculateOverallConfidence(updated.fields);

    setCurrentRecord(updated);
  };

  const handleExportSingle = async () => {
    const buffer = await ExcelExportService.generateWorkbook([currentRecord]);
    const vNo = currentRecord.fields.voucher_no?.normalizedValue || 'Voucher';
    ExcelExportService.downloadXlsx(buffer, `Voucher_${vNo}_Extracted.xlsx`);
  };

  const handleApprove = () => {
    const finalized: VoucherProcessingRecord = {
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
    const draftRecord: VoucherProcessingRecord = {
      ...currentRecord,
      lifecycleStatus: 'draft',
    };
    onSave(draftRecord);
    onBack();
  };

  const handleReject = () => {
    const rejectedRecord: VoucherProcessingRecord = {
      ...currentRecord,
      lifecycleStatus: 'rejected',
      approvalInfo: {
        status: 'rejected',
        rejectionReason: 'Flagged for re-scan / physical check',
      },
    };
    onSave(rejectedRecord);
    onBack();
  };

  const formatDisplayValue = (meta: VoucherFieldMetadata, rawVal: any): string => {
    if (rawVal === null || rawVal === undefined) return '';
    return String(rawVal);
  };

  const renderFieldInput = (key: keyof HenuVoucherData) => {
    const field = currentRecord.fields[key];
    const meta = HENU_VOUCHER_FIELDS.find((f: VoucherFieldMetadata) => f.key === key);
    if (!meta) return null;

    const val = formatDisplayValue(meta, field?.normalizedValue);

    const status = field?.validationStatus;
    const hasErr = status === 'error';
    const hasWarn = status === 'warning';
    const conf = field?.confidence || 0;
    const confColor = ConfidenceEngine.getConfidenceColor(conf);

    return (
      <div key={String(key)} className="voucher-field-item">
        <label className="voucher-field-label">
          <span>{meta.label} {meta.required && <span style={{ color: 'var(--error)' }}>*</span>}</span>
          <span
            className="voucher-confidence-tag"
            style={{
              background: `${confColor}20`,
              color: confColor,
              border: `1px solid ${confColor}40`,
            }}
          >
            {field?.isUserEdited ? 'Edited' : `${conf}%`}
          </span>
        </label>

        {meta.category === 'particulars' || meta.key === 'society_address' ? (
          <textarea
            className={`voucher-input${hasErr ? ' has-error' : hasWarn ? ' has-warning' : ''}`}
            rows={2}
            value={val}
            placeholder={val ? '' : 'Not detected'}
            onChange={e => handleFieldChange(key, e.target.value)}
          />
        ) : (
          <input
            type="text"
            className={`voucher-input${hasErr ? ' has-error' : hasWarn ? ' has-warning' : ''}`}
            value={val}
            placeholder={val ? '' : 'Not detected'}
            onChange={e => handleFieldChange(key, e.target.value)}
          />
        )}

        {field?.evidence && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Evidence: ${field.evidence} (Source: ${field.source || 'HENU AI'})`}>
            🔍 Evidence: <span style={{ fontStyle: 'italic' }}>{field.evidence}</span>
          </div>
        )}

        {field?.validationMessage && (
          <div style={{ fontSize: 10, color: hasErr ? 'var(--error)' : 'var(--warning)', marginTop: 2 }}>
            {field.validationMessage}
          </div>
        )}
      </div>
    );
  };

  const f = currentRecord.fields;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Action Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        background: 'var(--surface)',
        padding: '10px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Voucher Verification: {f.voucher_no?.normalizedValue || 'Unnamed Voucher'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Source: {currentRecord.sourceFile} (Page {currentRecord.sourcePage} of {currentRecord.totalPages})
              {currentRecord.modelsExecuted && currentRecord.modelsExecuted.length > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>
                  · AI Models: {currentRecord.modelsExecuted.join(' + ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowDebug(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Inspect OCR bounding boxes and crops"
          >
            <RefreshCw size={13} /> Inspect Crops
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportSingle}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} /> Export XLSX
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSaveDraft}
          >
            Save Draft
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleApprove}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Approve and commit voucher"
          >
            <FileCheck size={14} /> Approve Voucher
          </button>
        </div>
      </div>

      {/* 3-COLUMN PROFESSIONAL REVIEW LAYOUT */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.25fr 0.9fr',
        gap: 16,
        flex: 1,
        minHeight: 0,
      }}>
        {/* LEFT COLUMN: Document Viewer */}
        <div className="voucher-image-viewer-card">
          <div className="voucher-viewer-toolbar">
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Original Voucher Document
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setZoom(prev => Math.min(3.0, prev + 0.25))} title="Zoom In" style={{ padding: '2px 6px' }}>
                <ZoomIn size={13} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))} title="Zoom Out" style={{ padding: '2px 6px' }}>
                <ZoomOut size={13} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setRotation(prev => (prev + 90) % 360)} title="Rotate 90°" style={{ padding: '2px 6px' }}>
                <RotateCw size={13} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setZoom(1.0); setRotation(0); }} title="Reset" style={{ padding: '2px 6px' }}>
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="voucher-image-viewport">
            {currentRecord.imageDataUrl ? (
              <img
                src={currentRecord.imageDataUrl}
                alt="Voucher Scan"
                className="voucher-preview-img"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No preview image available</div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Extracted Editable Fields */}
        <div className="voucher-fields-card">
          {/* Header Section */}
          <div className="voucher-field-group">
            <div className="voucher-field-group-title">1. Society Header</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {renderFieldInput('society_name')}
              <div className="voucher-grid-2">
                {renderFieldInput('registration_no')}
                {renderFieldInput('society_address')}
              </div>
            </div>
          </div>

          {/* Voucher Info & Parties */}
          <div className="voucher-field-group">
            <div className="voucher-field-group-title">2. Voucher & Payee Details</div>
            <div className="voucher-grid-2" style={{ marginBottom: 10 }}>
              {renderFieldInput('voucher_no')}
              {renderFieldInput('voucher_date')}
            </div>
            <div className="voucher-grid-2">
              {renderFieldInput('pay_to')}
              {renderFieldInput('charge_to')}
            </div>
          </div>

          {/* Narration */}
          <div className="voucher-field-group">
            <div className="voucher-field-group-title">3. Transaction Particulars</div>
            {renderFieldInput('particulars')}
          </div>

          {/* Financial Breakdown Table */}
          <div className="voucher-field-group">
            <div className="voucher-field-group-title">4. Financial Deductions & Tax Breakdown</div>
            <div className="voucher-grid-3" style={{ marginBottom: 10 }}>
              {renderFieldInput('bill_amount_1')}
              {renderFieldInput('bill_amount_2')}
              {renderFieldInput('advance_paid')}
            </div>
            <div className="voucher-grid-3" style={{ marginBottom: 10 }}>
              {renderFieldInput('total_1')}
              {renderFieldInput('tds_percentage')}
              {renderFieldInput('tds_amount')}
            </div>
            <div className="voucher-grid-3" style={{ marginBottom: 10 }}>
              {renderFieldInput('total_2')}
              {renderFieldInput('cgst_percentage')}
              {renderFieldInput('cgst_amount')}
            </div>
            <div className="voucher-grid-3">
              {renderFieldInput('sgst_percentage')}
              {renderFieldInput('sgst_amount')}
              {renderFieldInput('round_off')}
            </div>
          </div>

          {/* Payment Details & Net Paid */}
          <div className="voucher-field-group" style={{ borderBottom: 'none' }}>
            <div className="voucher-field-group-title">5. Cheque Info & Net Paid</div>
            <div className="voucher-grid-3" style={{ marginBottom: 10 }}>
              {renderFieldInput('bill_no')}
              {renderFieldInput('bank_name')}
              {renderFieldInput('cheque_no')}
            </div>
            <div className="voucher-grid-3">
              {renderFieldInput('cheque_date')}
              {renderFieldInput('rupees')}
              {renderFieldInput('net_paid')}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Validation, Confidence & Evidence Panel */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: 16,
          gap: 14,
        }}>
          {/* Status / Confidence Header */}
          <div style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: currentRecord.validationIssues.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${currentRecord.validationIssues.length > 0 ? '#F59E0B' : '#10B981'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: currentRecord.validationIssues.length > 0 ? '#F59E0B' : '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
                {currentRecord.validationIssues.length > 0 ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                {currentRecord.validationIssues.length > 0 ? 'Review & Verify' : 'Validated'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                {currentRecord.overallConfidence}% Conf
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {currentRecord.validationIssues.length > 0
                ? `You can edit any field directly and confirm to approve.`
                : 'All mathematical and structural constraints passed. Ready for approval.'}
            </div>
          </div>

          {/* Mathematical Integrity Rules */}
          <div className="vch-card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
              Accounting Validation Checklist
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div className="flex items-center justify-between">
                <span>SubTotal 1:</span>
                <strong>₹{f.total_1?.normalizedValue ?? '—'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>TDS Tax Deduction:</span>
                <strong>₹{f.tds_amount?.normalizedValue ?? '—'} ({f.tds_percentage?.normalizedValue ?? 0}%)</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>SubTotal 2:</span>
                <strong>₹{f.total_2?.normalizedValue ?? '—'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>CGST + SGST:</span>
                <strong>₹{((f.cgst_amount?.normalizedValue || 0) + (f.sgst_amount?.normalizedValue || 0)).toFixed(2)}</strong>
              </div>
              <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                <span className="fw-700">Net Calculated Paid:</span>
                <strong style={{ color: 'var(--accent)' }}>₹{f.net_paid?.normalizedValue ?? '—'}</strong>
              </div>
            </div>
          </div>

          {/* Validation Warnings / Issues */}
          {currentRecord.validationIssues.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#EF4444', marginBottom: 6 }}>
                Active Warnings ({currentRecord.validationIssues.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentRecord.validationIssues.map((iss, i) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6, fontSize: 11, color: '#EF4444' }}>
                    <strong>{iss.fieldKey}:</strong> {iss.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correction History */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Human Correction Log
            </div>
            {!currentRecord.correctionHistory || currentRecord.correctionHistory.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                No edits made yet. Original OCR evidence intact.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentRecord.correctionHistory.map((ch, idx) => (
                  <div key={idx} style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 4, fontSize: 10 }}>
                    <div><strong>{ch.fieldLabel}:</strong> <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{String(ch.previousValue ?? 'empty')}</span> ➔ <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{String(ch.correctedValue)}</span></div>
                    <div style={{ opacity: 0.6, fontSize: 9, marginTop: 2 }}>{new Date(ch.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approval Actions */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApprove}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
            >
              <FileCheck size={14} /> Confirm & Approve
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReject}
              style={{ color: '#EF4444' }}
            >
              Return for Correction
            </button>
          </div>
        </div>
      </div>

      {/* Internal OCR Debug Inspector Modal */}
      {showDebug && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--surface, #1e293b)',
            color: 'var(--text-primary, #fff)',
            borderRadius: 12,
            border: '1px solid var(--border, #334155)',
            width: '90%',
            maxWidth: 1000,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border, #334155)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Internal OCR Diagnostic Inspector</h4>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>
                  Total Field Crops: {currentRecord.debugInfo?.fieldCrops?.length || 0}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDebug(false)}>
                Close
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {(currentRecord.debugInfo?.fieldCrops || []).map((fc, i) => (
                  <div key={i} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border, #334155)', borderRadius: 8, padding: 12, fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{fc.label}</span>
                      <span>{fc.confidence}%</span>
                    </div>
                    {fc.cropDataUrl && (
                      <div style={{ background: '#000', borderRadius: 4, padding: 4, margin: '6px 0', textAlign: 'center' }}>
                        <img src={fc.cropDataUrl} alt={fc.label} style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    <div>Raw: {fc.rawOcrText || '(empty)'}</div>
                    <div style={{ color: '#38bdf8' }}>Final: {String(fc.finalValue ?? '(null)')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
