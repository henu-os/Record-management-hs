/**
 * HENU CHECK OCR — CHECK ASSISTANT DRAWER
 */

import React from 'react';
import { X, Bot, Sparkles, AlertTriangle, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';

interface CheckAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: CheckProcessingRecord[];
  onSelectRecord: (record: CheckProcessingRecord) => void;
}

export const CheckAssistantDrawer: React.FC<CheckAssistantDrawerProps> = ({
  isOpen,
  onClose,
  records,
  onSelectRecord,
}) => {
  if (!isOpen) return null;

  const totalCheques = records.length;
  const reviewRequiredList = records.filter(r => r.reviewRequired);
  const nonChequeList = records.filter(r => r.isChequePage === false);
  const lowConfList = records.filter(r => r.overallConfidence < 70 && r.processingStatus === 'completed');

  return (
    <div className="check-drawer">
      {/* Drawer Header */}
      <div className="check-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}>
            <Bot size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Check Assistant
            </h4>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Contextual Cheque Verification Guide
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="check-drawer-content">
        {/* Batch Overview Card */}
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '14px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
            Batch Diagnostics
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>{totalCheques}</strong> cheques loaded in current session.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {reviewRequiredList.length === 0 ? (
              <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <CheckCircle2 size={13} /> All cheques meet validation thresholds.
              </span>
            ) : (
              <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <AlertTriangle size={13} /> {reviewRequiredList.length} cheque(s) require review.
              </span>
            )}
          </div>
        </div>

        {/* Attention Items List */}
        {reviewRequiredList.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Cheques Requiring Attention ({reviewRequiredList.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviewRequiredList.slice(0, 10).map((r) => (
                <div
                  key={r.id}
                  onClick={() => { onSelectRecord(r); onClose(); }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {r.fields.bank?.normalizedValue || r.sourceFile}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>
                      {r.overallConfidence}% Conf
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {r.validationIssues[0]?.message || 'Review recommended before approval.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banking Tips & CTS-2010 Guidance */}
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Info size={14} className="text-accent" /> Cheque OCR Guidance
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <li><strong>Cheque No:</strong> Preserves starting digits and leading zeros without numerical conversion.</li>
            <li><strong>MICR Band:</strong> CTS-2010 cheques feature a 22-digit magnetic band at the bottom margin.</li>
            <li><strong>Signatures:</strong> Handwritten signatures without printed names are strictly treated with zero-guessing.</li>
            <li><strong>Dates:</strong> Normalized to DD/MM/YYYY format.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
