/**
 * HENU VOUCHER OCR — LIVE PROCESSING PIPELINE VIEW
 * Real-time queue and step-by-step pipeline checklist visualization.
 */

import React from 'react';
import {
  CheckCircle2, Clock, AlertCircle, RefreshCw,
  Cpu, Layers, ShieldCheck, ArrowRight, Play, Square
} from 'lucide-react';
import { VoucherProcessingRecord } from '../../../../modules/henu-voucher-ocr/schema/types';

interface VoucherProcessingViewProps {
  records: VoucherProcessingRecord[];
  isProcessing: boolean;
  currentStatus: string;
  onReviewRecord: (record: VoucherProcessingRecord) => void;
}

export const VoucherProcessingView: React.FC<VoucherProcessingViewProps> = ({
  records,
  isProcessing,
  currentStatus,
  onReviewRecord,
}) => {
  const activeJobs = records.filter(r => r.processingStatus === 'ocr_running' || r.processingStatus === 'preprocessing');
  const completedJobs = records.filter(r => r.processingStatus === 'completed');
  const failedJobs = records.filter(r => r.processingStatus === 'failed');

  const latestRecord = records[0] || null;

  const PIPELINE_STEPS = [
    { id: 'ingest', label: '1. File Ingestion & Format Verification', done: !!latestRecord, inProgress: isProcessing && !latestRecord },
    { id: 'preprocess', label: '2. Image Preprocessing (Deskew, Contrast, Sauvola Adaptive)', done: !!latestRecord, inProgress: isProcessing },
    { id: 'ocr', label: '3. Local OCR Engine Execution (Multilingual Eng/Hin/Mar)', done: !!latestRecord && latestRecord.rawText?.length > 0, inProgress: isProcessing },
    { id: 'zoning', label: '4. OCR Comparison & Field Zoning (26 Canonical Fields)', done: !!latestRecord && Object.keys(latestRecord.fields || {}).length > 0, inProgress: isProcessing },
    { id: 'norm', label: '5. Field Normalization (Devanagari Digits, Dates DDMMYYYY, Currency)', done: !!latestRecord && Object.keys(latestRecord.fields || {}).length > 0, inProgress: isProcessing },
    { id: 'validation', label: '6. Accounting Validation (TDS, GST, Subtotals, Net Paid)', done: !!latestRecord && !!latestRecord.validationIssues, inProgress: false },
    { id: 'review', label: '7. Human Review Gate', done: latestRecord ? !latestRecord.reviewRequired : false, inProgress: latestRecord ? latestRecord.reviewRequired : false },
    { id: 'approval', label: '8. Approval Gate', done: latestRecord ? latestRecord.lifecycleStatus === 'approved' : false, inProgress: false },
    { id: 'export', label: '9. Canonical Export (XLSX, JSON, ZIP Package)', done: latestRecord ? !!latestRecord.exportInfo?.exportedAt : false, inProgress: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Live Pipeline Status Banner */}
      <div className="vch-card" style={{ padding: '20px 24px', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="flex items-center gap-10">
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: isProcessing ? 'var(--accent)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isProcessing ? '#fff' : '#10B981',
            }}>
              {isProcessing ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {isProcessing ? 'OCR Extraction Pipeline Active' : 'Pipeline Idle / Standby'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {isProcessing ? currentStatus : 'Ready to process incoming voucher documents.'}
              </div>
            </div>
          </div>

          <span className="voucher-ocr-badge">
            Queue: {activeJobs.length} Active · {completedJobs.length} Completed
          </span>
        </div>

        {/* Real Step-by-Step Pipeline Checklist */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 10,
          marginTop: 16,
          background: 'var(--surface)',
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          {PIPELINE_STEPS.map((step) => {
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: step.done ? 'rgba(16, 185, 129, 0.08)' : step.inProgress ? 'rgba(124, 58, 237, 0.1)' : 'var(--surface-2)',
                  border: `1px solid ${step.done ? 'rgba(16, 185, 129, 0.25)' : step.inProgress ? 'var(--accent)' : 'var(--border)'}`,
                  fontSize: 12,
                }}
              >
                {step.done ? (
                  <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                ) : step.inProgress ? (
                  <RefreshCw size={15} className="spin text-accent" style={{ flexShrink: 0 }} />
                ) : (
                  <Clock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <span style={{
                  color: step.done ? 'var(--text-primary)' : step.inProgress ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: step.done || step.inProgress ? 600 : 400,
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Processed Vouchers Queue Stream */}
      <div className="vch-card">
        <div className="vch-card-header">
          <div className="flex items-center gap-8">
            <Layers size={16} className="text-accent" />
            <span className="fw-700 text-sm">Processing Queue History</span>
          </div>
          <span className="text-xs text-secondary">{records.length} Total Jobs</span>
        </div>

        {records.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No processing jobs have been queued yet. Upload vouchers in the Voucher Inbox.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left' }}>Job ID / Time</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' }}>File / Page</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' }}>Voucher No</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Confidence</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Pipeline Status</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const f = r.fields;
                  const vNo = f.voucher_no?.normalizedValue || 'Not detected';
                  const isFail = r.processingStatus === 'failed';

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                        <div>{r.id.slice(0, 16)}...</div>
                        <div style={{ fontSize: 10 }}>{r.processedAt ? new Date(r.processedAt).toLocaleTimeString() : '—'}</div>
                      </td>

                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>
                        {r.sourceFile} (p.{r.sourcePage})
                      </td>

                      <td style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {vNo}
                      </td>

                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: r.overallConfidence >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: r.overallConfidence >= 80 ? '#10B981' : '#F59E0B',
                        }}>
                          {r.overallConfidence}%
                        </span>
                      </td>

                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        {isFail ? (
                          <span className="vch-status-badge vch-status-failed">
                            <AlertCircle size={11} /> Failed
                          </span>
                        ) : r.reviewRequired ? (
                          <span className="vch-status-badge vch-status-review">
                            <Clock size={11} /> Review Needed
                          </span>
                        ) : (
                          <span className="vch-status-badge vch-status-approved">
                            <CheckCircle2 size={11} /> Completed
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onReviewRecord(r)}
                          style={{ padding: '3px 10px', fontSize: 11 }}
                        >
                          Open Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
