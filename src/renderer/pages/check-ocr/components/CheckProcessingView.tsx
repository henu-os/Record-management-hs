/**
 * HENU CHECK OCR — LIVE PROCESSING & PIPELINE VIEW
 */

import React from 'react';
import { CheckCircle2, Clock, Play, ArrowRight, ShieldCheck, Cpu, RefreshCw, FileText, Database } from 'lucide-react';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';

interface CheckProcessingViewProps {
  records: CheckProcessingRecord[];
  isProcessing: boolean;
  processingStatus: string;
}

const CHECK_PIPELINE_STAGES = [
  { id: 1, name: 'File Ingestion & Format Verification', desc: 'Validates PNG, JPG, JPEG, or multi-page PDF cheques' },
  { id: 2, name: 'Image Preprocessing', desc: 'Deskew, contrast enhancement, Sauvola thresholding, and resolution normalization' },
  { id: 3, name: 'Local OCR Engine Execution', desc: 'GLM-OCR / FireRed-OCR on USB or Online Multimodal AI' },
  { id: 4, name: 'OCR Comparison & Check Field Zoning', desc: 'Semantic anchor detection (Bank, Date, Payee, Figures, Words, A/c, Cheque No, MICR)' },
  { id: 5, name: 'Field Normalization', desc: 'Type-safe normalization with strict leading zero preservation' },
  { id: 6, name: 'Banking / Cheque Validation', desc: 'Cheque CTS-2010 rules, MICR 22-digit checks, non-cheque page detection' },
  { id: 7, name: 'Human Review Gate', desc: '3-column split view for manual verification and field correction' },
  { id: 8, name: 'Approval Gate', desc: 'Sign-off and approval auditing' },
  { id: 9, name: 'Canonical Export', desc: 'Publication-grade 3-sheet XLSX and canonical JSON export' },
];

export const CheckProcessingView: React.FC<CheckProcessingViewProps> = ({
  records,
  isProcessing,
  processingStatus,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Active Pipeline Status Banner */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.6px', marginBottom: 4 }}>
            Cheque OCR Extraction Pipeline
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            {isProcessing ? 'Active Ingestion & Extraction in Progress' : 'Pipeline Standby / Idle'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            {processingStatus || 'Ready to receive cheque documents.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isProcessing && (
            <span className="badge badge-accent" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
              <RefreshCw size={13} className="spin" /> Processing Queue
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {records.length} Total Records Loaded
          </span>
        </div>
      </div>

      {/* 9-Stage Pipeline Architecture Visualizer */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Automated Cheque Verification Pipeline (9 Stages)
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {CHECK_PIPELINE_STAGES.map((stage) => {
            const isCompleted = records.length > 0 && !isProcessing;
            const isCurrent = isProcessing && stage.id <= 4;

            return (
              <div
                key={stage.id}
                style={{
                  background: 'var(--surface-2)',
                  border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: isCurrent ? 'var(--accent)' : (isCompleted ? '#10B981' : 'rgba(255,255,255,0.06)'),
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {isCompleted ? <CheckCircle2 size={16} /> : stage.id}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {stage.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {stage.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
