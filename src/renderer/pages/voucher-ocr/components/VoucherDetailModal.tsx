/**
 * HENU VOUCHER OCR — VOUCHER DETAIL INSPECTOR MODAL
 * 8 comprehensive tabs: Document, OCR, Consensus, Validation, Review, Approval, Export, Audit.
 */

import React, { useState } from 'react';
import {
  X, FileText, CheckCircle2, AlertTriangle, ShieldCheck,
  Download, History, Eye, Check, Clock, UserCheck
} from 'lucide-react';
import { VoucherProcessingRecord, HenuVoucherData } from '../../../../modules/henu-voucher-ocr/schema/types';
import { HENU_VOUCHER_FIELDS } from '../../../../modules/henu-voucher-ocr/schema/voucherSchema';
import { ExcelExportService } from '../../../../modules/henu-voucher-ocr/excel/ExcelExportService';

interface VoucherDetailModalProps {
  record: VoucherProcessingRecord;
  onClose: () => void;
  onApprove: (record: VoucherProcessingRecord) => void;
  onReject: (record: VoucherProcessingRecord, reason: string) => void;
}

type DetailTab = 'document' | 'ocr' | 'consensus' | 'validation' | 'review' | 'approval' | 'export' | 'audit';

export const VoucherDetailModal: React.FC<VoucherDetailModalProps> = ({
  record,
  onClose,
  onApprove,
  onReject,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('document');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  const f = record.fields;
  const vNo = f.voucher_no?.normalizedValue || 'Not detected';

  const handleExportXlsx = async () => {
    const buf = await ExcelExportService.generateWorkbook([record]);
    ExcelExportService.downloadXlsx(buf, `Voucher_${vNo}_Detail.xlsx`);
  };

  const handleExportJson = () => {
    const jsonStr = ExcelExportService.generateCanonicalJson([record]);
    ExcelExportService.downloadJson(jsonStr, `Voucher_${vNo}_Canonical.json`);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        width: '94%',
        maxWidth: 1100,
        height: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-2)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Voucher Detail Inspector: {vNo}
              </h3>
              <span className="voucher-ocr-badge" style={{ fontSize: 10 }}>
                {record.sourceFile} (Page {record.sourcePage}/{record.totalPages})
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              ID: {record.id} · Ingested: {record.processedAt ? new Date(record.processedAt).toLocaleString() : '—'}
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 8 Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          padding: '0 16px',
          overflowX: 'auto',
          gap: 4,
        }}>
          {[
            { id: 'document', label: '1. Document' },
            { id: 'ocr', label: '2. OCR Evidence' },
            { id: 'consensus', label: '3. Consensus' },
            { id: 'validation', label: '4. Validation' },
            { id: 'review', label: '5. Review History' },
            { id: 'approval', label: '6. Approval Gate' },
            { id: 'export', label: '7. Export' },
            { id: 'audit', label: '8. Audit Trail' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DetailTab)}
              style={{
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto', background: 'var(--bg)' }}>
          {/* TAB 1: Document */}
          {activeTab === 'document' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
              {record.imageDataUrl ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0f172a',
                  borderRadius: 8,
                  padding: 16,
                  width: '100%',
                }}>
                  <img
                    src={record.imageDataUrl}
                    alt="Original Document"
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 4 }}
                  />
                </div>
              ) : (
                <div style={{ padding: 40, color: 'var(--text-muted)' }}>
                  No preview image available for this document.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OCR Evidence */}
          {activeTab === 'ocr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
                  Raw Baseline OCR Output
                </h4>
                <pre style={{
                  background: 'var(--surface-2)',
                  padding: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  maxHeight: 180,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}>
                  {record.rawText || '(No raw OCR text available)'}
                </pre>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
                  Field-Level Extraction Evidence & Confidence Ratings
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {HENU_VOUCHER_FIELDS.map(meta => {
                    const field = record.fields[meta.key];
                    const conf = field?.confidence || 0;
                    return (
                      <div key={meta.key} style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{meta.label}</span>
                          <span style={{
                            fontSize: 10,
                            color: conf >= 80 ? '#10B981' : conf >= 50 ? '#F59E0B' : '#EF4444',
                          }}>
                            {conf}%
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-primary)', marginTop: 4, fontWeight: 700 }}>
                          {field?.normalizedValue !== null && field?.normalizedValue !== undefined
                            ? String(field.normalizedValue)
                            : <span style={{ color: 'var(--text-muted)' }}>Not detected</span>}
                        </div>
                        {field?.rawValue && field.rawValue !== String(field.normalizedValue) && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Raw: {field.rawValue}
                          </div>
                        )}
                        {field?.evidence && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                            Evidence: {field.evidence}
                          </div>
                        )}
                        {field?.source && (
                          <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2 }}>
                            Source: {field.source}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Consensus & Normalized Fields */}
          {activeTab === 'consensus' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)' }}>
                  Normalized Canonical Accounting Record (26 Fields)
                </h4>
                {record.modelsExecuted && record.modelsExecuted.length > 0 && (
                  <span className="voucher-ocr-badge" style={{ fontSize: 10, color: 'var(--accent)' }}>
                    Workers: {record.modelsExecuted.join(' + ')}
                  </span>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Field</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Data Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Normalized Value</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Confidence</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>User Edited</th>
                  </tr>
                </thead>
                <tbody>
                  {HENU_VOUCHER_FIELDS.map(meta => {
                    const field = record.fields[meta.key];
                    return (
                      <tr key={meta.key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{meta.label}</td>
                        <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{meta.dataType}</td>
                        <td style={{ padding: '6px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {field?.normalizedValue !== null && field?.normalizedValue !== undefined
                            ? String(field.normalizedValue)
                            : <span style={{ color: 'var(--text-muted)' }}>Not detected</span>}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>{field?.confidence || 0}%</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          {field?.isUserEdited ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>YES</span> : 'No'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Validation */}
          {activeTab === 'validation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: 14,
                background: record.validationIssues.length === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${record.validationIssues.length === 0 ? '#10B981' : '#F59E0B'}`,
                borderRadius: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: record.validationIssues.length === 0 ? '#10B981' : '#F59E0B' }}>
                  {record.validationIssues.length === 0
                    ? '✓ All Mathematical & Accounting Rules Validated'
                    : `⚠️ ${record.validationIssues.length} Accounting Validation Issues Detected`}
                </div>
              </div>

              {/* Mathematical balance breakdown */}
              <div className="vch-card" style={{ padding: 16 }}>
                <h5 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                  Mathematical Verification Breakdown
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div>Total 1 = Bill Amount 1 ({f.bill_amount_1?.normalizedValue ?? 0}) + Bill Amount 2 ({f.bill_amount_2?.normalizedValue ?? 0}) - Advance ({f.advance_paid?.normalizedValue ?? 0}) = <strong>{f.total_1?.normalizedValue ?? '—'}</strong></div>
                  <div>TDS Amount = Total 1 × TDS% ({f.tds_percentage?.normalizedValue ?? 0}%) = <strong>{f.tds_amount?.normalizedValue ?? '—'}</strong></div>
                  <div>Total 2 = Total 1 - TDS Amount = <strong>{f.total_2?.normalizedValue ?? '—'}</strong></div>
                  <div>CGST = Total 2 × CGST% ({f.cgst_percentage?.normalizedValue ?? 0}%) = <strong>{f.cgst_amount?.normalizedValue ?? '—'}</strong></div>
                  <div>SGST = Total 2 × SGST% ({f.sgst_percentage?.normalizedValue ?? 0}%) = <strong>{f.sgst_amount?.normalizedValue ?? '—'}</strong></div>
                  <div>Net Paid = Total 2 + CGST + SGST + RoundOff ({f.round_off?.normalizedValue ?? 0}) = <strong style={{ color: 'var(--accent)', fontSize: 13 }}>{f.net_paid?.normalizedValue ?? '—'}</strong></div>
                </div>
              </div>

              {/* Issues List */}
              {record.validationIssues.length > 0 && (
                <div>
                  <h5 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, color: '#EF4444' }}>
                    Issue Diagnostics
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {record.validationIssues.map((iss, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6, fontSize: 11, color: '#EF4444' }}>
                        <strong>[{iss.severity.toUpperCase()}] {iss.fieldKey}:</strong> {iss.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Review & Human Corrections */}
          {activeTab === 'review' && (
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                Human Correction History & Review Logs
              </h4>
              {!record.correctionHistory || record.correctionHistory.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No human edits or corrections have been made to this voucher.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Timestamp</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Field</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Original OCR</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Corrected Value</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.correctionHistory.map((ch, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{new Date(ch.timestamp).toLocaleTimeString()}</td>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{ch.fieldLabel || ch.fieldKey}</td>
                        <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{String(ch.previousValue ?? 'empty')}</td>
                        <td style={{ padding: '6px 12px', fontWeight: 700, color: 'var(--accent)' }}>{String(ch.correctedValue)}</td>
                        <td style={{ padding: '6px 12px', fontSize: 11 }}>{ch.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 6: Approval Gate */}
          {activeTab === 'approval' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: 16,
                background: 'var(--surface-2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Current Status:</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: record.reviewRequired ? '#F59E0B' : '#10B981', marginTop: 4 }}>
                  {record.approvalInfo?.status ? record.approvalInfo.status.toUpperCase() : (record.reviewRequired ? 'PENDING REVIEW' : 'APPROVED')}
                </div>
                {record.approvalInfo?.approvedAt && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Approved by: {record.approvalInfo.approvedBy || 'Reviewer'} on {new Date(record.approvalInfo.approvedAt).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onApprove(record)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <CheckCircle2 size={15} /> Approve Voucher
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowRejectBox(!showRejectBox)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444' }}
                >
                  <X size={15} /> Return for Correction
                </button>
              </div>

              {showRejectBox && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    className="input-control"
                    placeholder="Enter reason for rejection / return..."
                    rows={2}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <button
                    className="btn"
                    style={{ background: '#EF4444', color: '#fff', alignSelf: 'flex-start' }}
                    onClick={() => {
                      onReject(record, rejectReason);
                      setShowRejectBox(false);
                    }}
                  >
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: Export */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Export verified voucher data into canonical accounting structures.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="vch-card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Excel Workbook (.xlsx)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Styled 26-column ledger sheet + audit summary
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportXlsx}>
                    <Download size={13} /> Export XLSX
                  </button>
                </div>

                <div className="vch-card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Canonical JSON</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Strict JSON schema payload with evidence
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportJson}>
                    <FileText size={13} /> Export JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: Audit Trail */}
          {activeTab === 'audit' && (
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                Voucher Lifecycle Audit Trail
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>[Ingested]</span> {record.processedAt ? new Date(record.processedAt).toLocaleString() : '—'} — Ingested from {record.sourceFile}
                </div>
                {record.rawText && (
                  <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11 }}>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>[OCR Completed]</span> Confidence: {record.overallConfidence}%
                  </div>
                )}
                {record.reviewRequired && (
                  <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11 }}>
                    <span style={{ color: '#F59E0B', fontWeight: 700 }}>[Review Gate]</span> Flagged for human verification
                  </div>
                )}
                {record.approvalInfo?.approvedAt && (
                  <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11 }}>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>[Approved]</span> Approved by {record.approvalInfo.approvedBy || 'User'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
