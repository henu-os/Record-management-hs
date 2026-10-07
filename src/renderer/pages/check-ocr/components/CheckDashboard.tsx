/**
 * HENU CHECK OCR — DASHBOARD OVERVIEW
 */

import React, { useState } from 'react';
import {
  FileText, Upload, Sparkles, CheckCircle2, AlertTriangle, XCircle,
  Clock, ShieldCheck, ArrowRight, Eye, RefreshCw, Disc, Globe, Layers
} from 'lucide-react';
import { SingleCheckUpload } from './SingleCheckUpload';
import { BatchCheckPdfUpload } from './BatchCheckPdfUpload';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';

interface CheckDashboardProps {
  records: CheckProcessingRecord[];
  ocrMode: 'HENU_AI' | 'APIS';
  apiActiveModel: string;
  engineStatus: {
    state: string;
    isEngineOn: boolean;
    isUsbConnected: boolean;
    usbDriveLetter: string;
    statusMessage: string;
  };
  onChequeProcessed: (record: CheckProcessingRecord) => void;
  onBatchCompleted: (records: CheckProcessingRecord[]) => void;
  onReviewRecord: (record: CheckProcessingRecord) => void;
  onViewAll: () => void;
}

export const CheckDashboard: React.FC<CheckDashboardProps> = ({
  records,
  ocrMode,
  apiActiveModel,
  engineStatus,
  onChequeProcessed,
  onBatchCompleted,
  onReviewRecord,
  onViewAll,
}) => {
  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('single');

  const totalCheques = records.length;
  const reviewRequiredCount = records.filter(r => r.reviewRequired).length;
  const approvedCount = records.filter(r => !r.reviewRequired && r.processingStatus === 'completed').length;
  const failedCount = records.filter(r => r.processingStatus === 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {/* Active Provider Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
            OCR Provider
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {ocrMode === 'HENU_AI' ? (
              <>
                <Disc size={16} style={{ color: engineStatus.isUsbConnected ? '#10B981' : '#EF4444' }} />
                HENU AI (USB Offline)
              </>
            ) : (
              <>
                <Globe size={16} style={{ color: '#3B82F6' }} />
                HENU Vision Online
              </>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {ocrMode === 'HENU_AI'
              ? (engineStatus.isUsbConnected ? `USB Brain (${engineStatus.usbDriveLetter || 'Connected'})` : 'USB Disconnected')
              : `Model: ${apiActiveModel}`}
          </div>
        </div>

        {/* Total Cheques */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
            Queue Status
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalCheques} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>TOTAL CHEQUES</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {approvedCount} Approved · {reviewRequiredCount} Review Required
          </div>
        </div>

        {/* Validated / Approved */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.06)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#10B981', marginBottom: 6 }}>
            Validated & Approved
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={20} /> {approvedCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Ready for canonical XLSX / JSON export
          </div>
        </div>

        {/* Review Required */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#F59E0B', marginBottom: 6 }}>
            Needs Human Review
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={20} /> {reviewRequiredCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Pending verification or non-cheque review
          </div>
        </div>
      </div>

      {/* Upload Workspace Switcher */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Cheque Document Ingestion
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Upload single cheque images or multi-cheque PDF booklets for automated OCR extraction.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              className={`btn btn-sm ${uploadMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setUploadMode('single')}
              style={{ fontSize: 11, padding: '5px 12px' }}
            >
              <FileText size={13} /> Single Cheque (Image / PDF)
            </button>
            <button
              className={`btn btn-sm ${uploadMode === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setUploadMode('batch')}
              style={{ fontSize: 11, padding: '5px 12px' }}
            >
              <Layers size={13} /> Bulk Multi-Page PDF
            </button>
          </div>
        </div>

        {uploadMode === 'single' ? (
          <SingleCheckUpload onProcessed={onChequeProcessed} />
        ) : (
          <BatchCheckPdfUpload onBatchCompleted={onBatchCompleted} />
        )}
      </div>

      {/* Recent Records Quick View */}
      {records.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Recent Extracted Cheques ({records.slice(0, 5).length} of {records.length})
            </h3>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={onViewAll}
              style={{ fontSize: 12 }}
            >
              View All in Table <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Bank</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Payee Name</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Cheque No</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 5).map((r) => {
                  const f = r.fields;
                  const amt = f.amount_in_figure?.normalizedValue;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px' }}>
                        {r.reviewRequired ? (
                          <span className="badge badge-warning" style={{ fontSize: 10 }}>Review</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: 10 }}>Valid</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{f.bank?.normalizedValue || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{f.date?.normalizedValue || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{f.payee_name?.normalizedValue || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        {typeof amt === 'number' ? `₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{f.cheque_no?.normalizedValue || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onReviewRecord(r)}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          <Eye size={12} /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
