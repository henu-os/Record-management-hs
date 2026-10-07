/**
 * HENU VOUCHER OCR — BATCH DATA TABLE & EXPORT
 */

import React, { useState } from 'react';
import { Download, CheckCircle2, AlertTriangle, Eye, Trash2, Filter } from 'lucide-react';
import { VoucherProcessingRecord } from '../../../../modules/henu-voucher-ocr/schema/types';
import { ExcelExportService } from '../../../../modules/henu-voucher-ocr/excel/ExcelExportService';

interface VoucherDataTableProps {
  records: VoucherProcessingRecord[];
  onReviewRecord: (record: VoucherProcessingRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

export const VoucherDataTable: React.FC<VoucherDataTableProps> = ({
  records,
  onReviewRecord,
  onDeleteRecord,
  onClearAll,
}) => {
  const [filter, setFilter] = useState<'all' | 'review' | 'valid'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const filteredRecords = records.filter(r => {
    if (filter === 'review') return r.reviewRequired;
    if (filter === 'valid') return !r.reviewRequired;
    return true;
  });

  const handleExportAll = async () => {
    if (records.length === 0) return;
    setIsExporting(true);
    try {
      const buffer = await ExcelExportService.generateWorkbook(records);
      ExcelExportService.downloadXlsx(buffer, `HENU_Vouchers_Batch_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
            <Filter size={13} /> Filter:
          </span>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            All ({records.length})
          </button>
          <button
            className={`btn btn-sm ${filter === 'review' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('review')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Needs Review ({records.filter(r => r.reviewRequired).length})
          </button>
          <button
            className={`btn btn-sm ${filter === 'valid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('valid')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Valid ({records.filter(r => !r.reviewRequired).length})
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClearAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)' }}
          >
            <Trash2 size={13} /> Clear Batch
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportAll}
            disabled={isExporting || records.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Download size={14} /> Export All ({records.length}) to XLSX
          </button>
        </div>
      </div>

      {/* Spreadsheet Style Table Container */}
      <div style={{
        flex: 1,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'auto',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>#</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Vch No</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Date</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Pay To (Payee)</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Charge To</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Particulars</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Total 1</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>TDS Amt</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Net Paid</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Bank / Cheque</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No vouchers match the selected filter.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, idx) => {
                const f = r.fields;
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={r.id}
                    style={{
                      background: isEven ? 'transparent' : 'rgba(0,0,0,0.02)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: r.reviewRequired ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: r.reviewRequired ? '#F59E0B' : '#10B981',
                      }}>
                        {r.reviewRequired ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                        {r.reviewRequired ? 'Review' : `${r.overallConfidence}%`}
                      </span>
                    </td>

                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {f.voucher_no?.normalizedValue || '—'}
                    </td>

                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      {f.voucher_date?.normalizedValue || '—'}
                    </td>

                    <td style={{ padding: '8px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.pay_to?.normalizedValue || '—'}
                    </td>

                    <td style={{ padding: '8px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.charge_to?.normalizedValue || '—'}
                    </td>

                    <td style={{ padding: '8px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(f.particulars?.normalizedValue || '')}>
                      {f.particulars?.normalizedValue || '—'}
                    </td>

                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {f.total_1?.normalizedValue !== null ? Number(f.total_1.normalizedValue).toFixed(2) : '—'}
                    </td>

                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {f.tds_amount?.normalizedValue !== null ? Number(f.tds_amount.normalizedValue).toFixed(2) : '—'}
                    </td>

                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                      {f.net_paid?.normalizedValue !== null ? `₹${Number(f.net_paid.normalizedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>

                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {f.bank_name?.normalizedValue ? `${f.bank_name.normalizedValue} / ${f.cheque_no?.normalizedValue || 'No Chq'}` : '—'}
                    </td>

                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onReviewRecord(r)}
                          title="Review & Edit"
                          style={{ padding: '3px 8px' }}
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onDeleteRecord(r.id)}
                          title="Delete Record"
                          style={{ padding: '3px 8px', color: 'var(--error)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
