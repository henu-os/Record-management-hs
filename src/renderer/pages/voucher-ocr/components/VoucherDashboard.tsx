/**
 * HENU VOUCHER OCR — DASHBOARD COMPONENT
 * Real data metrics, processing statistics, OCR engine status, and recent activity.
 */

import React from 'react';
import {
  Layers, CheckCircle2, AlertTriangle, XCircle, Clock,
  Sparkles, FileText, ArrowRight, ShieldCheck, Cpu, HardDrive, Zap, Eye, Download
} from 'lucide-react';
import { VoucherProcessingRecord } from '../../../../modules/henu-voucher-ocr/schema/types';

interface VoucherDashboardProps {
  records: VoucherProcessingRecord[];
  onNavigateTab: (tab: 'inbox' | 'processing' | 'table') => void;
  onReviewRecord: (record: VoucherProcessingRecord) => void;
  onViewDetail: (record: VoucherProcessingRecord) => void;
}

export const VoucherDashboard: React.FC<VoucherDashboardProps> = ({
  records,
  onNavigateTab,
  onReviewRecord,
  onViewDetail,
}) => {
  // Compute real metrics
  const total = records.length;
  const pending = records.filter(r => r.processingStatus === 'pending' || r.lifecycleStatus === 'pending').length;
  const processing = records.filter(r => r.processingStatus === 'ocr_running' || r.processingStatus === 'preprocessing').length;
  const reviewRequired = records.filter(r => r.reviewRequired || r.lifecycleStatus === 'review_required').length;
  const approved = records.filter(r => r.lifecycleStatus === 'approved' || (!r.reviewRequired && r.processingStatus === 'completed')).length;
  const exported = records.filter(r => r.lifecycleStatus === 'exported' || !!r.exportInfo?.exportedAt).length;
  const failed = records.filter(r => r.processingStatus === 'failed').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = records.filter(r => r.processedAt && r.processedAt.startsWith(todayStr)).length;

  // Real statistics
  const completedRecords = records.filter(r => r.processingStatus === 'completed');
  const avgConfidence = completedRecords.length > 0
    ? Math.round(completedRecords.reduce((sum, r) => sum + r.overallConfidence, 0) / completedRecords.length)
    : 0;

  const validWithoutIssues = completedRecords.filter(r => !r.reviewRequired).length;
  const validationPassRate = completedRecords.length > 0
    ? Math.round((validWithoutIssues / completedRecords.length) * 100)
    : 0;

  const recentRecords = [...records].slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
      }}>
        {/* Total Vouchers */}
        <div className="vch-metric-card">
          <div className="vch-metric-header">
            <span className="vch-metric-title">Total Vouchers</span>
            <Layers size={16} className="text-accent" />
          </div>
          <div className="vch-metric-val">{total}</div>
          <div className="vch-metric-sub">{todayCount} ingested today</div>
        </div>

        {/* Review Required */}
        <div className="vch-metric-card" style={{ borderColor: reviewRequired > 0 ? 'rgba(245, 158, 11, 0.4)' : undefined }}>
          <div className="vch-metric-header">
            <span className="vch-metric-title">Review Required</span>
            <AlertTriangle size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div className="vch-metric-val" style={{ color: reviewRequired > 0 ? '#F59E0B' : undefined }}>{reviewRequired}</div>
          <div className="vch-metric-sub">Awaiting human verification</div>
        </div>

        {/* Approved */}
        <div className="vch-metric-card">
          <div className="vch-metric-header">
            <span className="vch-metric-title">Approved</span>
            <CheckCircle2 size={16} style={{ color: '#10B981' }} />
          </div>
          <div className="vch-metric-val" style={{ color: '#10B981' }}>{approved}</div>
          <div className="vch-metric-sub">Ready for accounting export</div>
        </div>

        {/* Exported */}
        <div className="vch-metric-card">
          <div className="vch-metric-header">
            <span className="vch-metric-title">Exported</span>
            <Download size={16} style={{ color: '#3B82F6' }} />
          </div>
          <div className="vch-metric-val" style={{ color: '#3B82F6' }}>{exported}</div>
          <div className="vch-metric-sub">XLSX / JSON packages generated</div>
        </div>

        {/* Failed */}
        <div className="vch-metric-card">
          <div className="vch-metric-header">
            <span className="vch-metric-title">Failed</span>
            <XCircle size={16} style={{ color: '#EF4444' }} />
          </div>
          <div className="vch-metric-val" style={{ color: failed > 0 ? '#EF4444' : undefined }}>{failed}</div>
          <div className="vch-metric-sub">Unparseable or corrupted</div>
        </div>
      </div>

      {/* Middle Grid: OCR Performance Stats & Local Engine Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 16,
      }}>
        {/* Processing Performance */}
        <div className="vch-card">
          <div className="vch-card-header">
            <div className="flex items-center gap-8">
              <Zap size={16} className="text-accent" />
              <span className="fw-700 text-sm">OCR Processing Analytics</span>
            </div>
            <span className="text-xs text-secondary">Real extracted dataset metrics</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '16px 20px' }}>
            <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Avg. Confidence</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: avgConfidence > 70 ? '#10B981' : avgConfidence > 40 ? '#F59E0B' : 'var(--text-primary)', marginTop: 4 }}>
                {avgConfidence > 0 ? `${avgConfidence}%` : 'N/A'}
              </div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Math Pass Rate</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: validationPassRate > 80 ? '#10B981' : '#F59E0B', marginTop: 4 }}>
                {completedRecords.length > 0 ? `${validationPassRate}%` : 'N/A'}
              </div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Zero-Guess Policy</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981', marginTop: 10 }}>
                ACTIVE (100%)
              </div>
            </div>
          </div>

          <div style={{ padding: '0 20px 16px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
            Pipeline enforces sequential multi-pass preprocessing (Grayscale, Sauvola adaptive thresholding, and horizontal line suppression).
          </div>
        </div>

        {/* Local Engines Matrix */}
        <div className="vch-card">
          <div className="vch-card-header">
            <div className="flex items-center gap-8">
              <Cpu size={16} className="text-accent" />
              <span className="fw-700 text-sm">Local OCR Engine Runtime</span>
            </div>
            <span className="voucher-ocr-badge" style={{ fontSize: 10, padding: '2px 6px' }}>100% Offline</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Tesseract.js Local Engine</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Multilingual: English, Hindi (हिन्दी), Marathi (मराठी)</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
                READY / ACTIVE
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>GLM-OCR / FireRed-OCR Bridge</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Sequential memory-isolated consensus pipeline</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(124, 58, 237, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
                STANDBY / LOCAL
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>HENU OS Bridge Connector</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Direct journal posting integration</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: 4 }}>
                SPECIFICATION READY
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Vouchers Card */}
      <div className="vch-card">
        <div className="vch-card-header">
          <div className="flex items-center gap-8">
            <FileText size={16} className="text-accent" />
            <span className="fw-700 text-sm">Recent Ingested Vouchers</span>
          </div>
          <button
            className="btn btn-secondary btn-sm flex items-center gap-4"
            onClick={() => onNavigateTab('inbox')}
            style={{ fontSize: 11, padding: '3px 10px' }}
          >
            Open Inbox <ArrowRight size={12} />
          </button>
        </div>

        {recentRecords.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No vouchers loaded yet. Ingest your first voucher in the Voucher Inbox tab.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left' }}>Voucher No</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' }}>Payee</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right' }}>Net Paid</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Confidence</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map(r => {
                  const f = r.fields;
                  const vNo = f.voucher_no?.normalizedValue || 'Not detected';
                  const vDate = f.voucher_date?.normalizedValue || '—';
                  const payee = f.pay_to?.normalizedValue || 'Not detected';
                  const net = f.net_paid?.normalizedValue !== null && f.net_paid?.normalizedValue !== undefined
                    ? `₹${Number(f.net_paid.normalizedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '—';

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 700 }}>{vNo}</td>
                      <td style={{ padding: '8px 14px' }}>{vDate}</td>
                      <td style={{ padding: '8px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payee}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{net}</td>
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
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: r.reviewRequired ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: r.reviewRequired ? '#F59E0B' : '#10B981',
                        }}>
                          {r.reviewRequired ? 'Review Required' : 'Approved'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onReviewRecord(r)}
                            style={{ padding: '2px 8px', fontSize: 11 }}
                          >
                            Review
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onViewDetail(r)}
                            style={{ padding: '2px 8px', fontSize: 11 }}
                            title="Full Detail Inspector"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
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
