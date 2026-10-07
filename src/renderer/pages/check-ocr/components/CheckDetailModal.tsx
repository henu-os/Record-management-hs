/**
 * HENU CHECK OCR — DETAIL & QUICK APPROVAL MODAL
 */

import React from 'react';
import { X, CheckCircle2, AlertTriangle, Download, FileText } from 'lucide-react';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';
import { HENU_CHECK_FIELDS } from '../../../../modules/henu-check-ocr/schema/checkSchema';

interface CheckDetailModalProps {
  record: CheckProcessingRecord;
  onClose: () => void;
  onApprove: (record: CheckProcessingRecord) => void;
  onReject: (record: CheckProcessingRecord, reason: string) => void;
}

export const CheckDetailModal: React.FC<CheckDetailModalProps> = ({
  record,
  onClose,
  onApprove,
  onReject,
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 720,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-2)',
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Cheque Details: {record.sourceFile}
            </h3>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Page {record.sourcePage} of {record.totalPages} · Confidence: {record.overallConfidence}%
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {HENU_CHECK_FIELDS.map((meta) => {
              const field = record.fields[meta.key];
              const val = field?.normalizedValue;
              const displayVal = val !== null && val !== undefined ? String(val) : '—';
              const isAmount = meta.key === 'amount_in_figure';

              return (
                <div
                  key={meta.key}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {meta.label}
                  </div>
                  <div style={{
                    fontSize: isAmount ? 15 : 13,
                    fontWeight: isAmount ? 700 : 500,
                    color: isAmount ? 'var(--accent)' : 'var(--text-primary)',
                    fontFamily: (meta.key === 'account_no' || meta.key === 'cheque_no' || meta.key === 'micr_code') ? 'monospace' : 'inherit',
                  }}>
                    {isAmount && typeof val === 'number'
                      ? `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      : displayVal}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-2)',
        }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onReject(record, 'Flagged in detail modal')}
            style={{ color: 'var(--error)' }}
          >
            Reject Cheque
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
            <button
              className="btn btn-primary btn-sm flex items-center gap-6"
              onClick={() => onApprove(record)}
            >
              <CheckCircle2 size={14} /> Approve Cheque
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
