/**
 * HENU CHECK OCR — DATA TABLE & EXPORT
 */

import React, { useState } from 'react';
import { Download, CheckCircle2, AlertTriangle, Eye, Trash2, Filter, FileCode } from 'lucide-react';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';
import { CheckExcelExportService } from '../../../../modules/henu-check-ocr/excel/CheckExcelExportService';

interface CheckDataTableProps {
  records: CheckProcessingRecord[];
  onReviewRecord: (record: CheckProcessingRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

export const CheckDataTable: React.FC<CheckDataTableProps> = ({
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

  const handleExportXlsx = async () => {
    if (records.length === 0) return;
    setIsExporting(true);
    try {
      const buffer = await CheckExcelExportService.generateWorkbook(records);
      CheckExcelExportService.downloadXlsx(buffer, `HENU_Cheques_Batch_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    if (records.length === 0) return;
    const jsonStr = CheckExcelExportService.generateCanonicalJson(records);
    CheckExcelExportService.downloadJson(jsonStr, `HENU_Cheques_Export_${new Date().toISOString().slice(0, 10)}.json`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
      {/* Table Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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

        {/* Export Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClearAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)' }}
          >
            <Trash2 size={13} /> Clear Batch
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportJson}
            disabled={records.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileCode size={14} /> JSON Export
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportXlsx}
            disabled={isExporting || records.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Download size={14} /> Export All ({records.length}) to XLSX
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
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
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Bank</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Date</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Payee Name</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>A/c No.</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Cheque No</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>MICR Code</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Signature By</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Confidence</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No cheque records match the selected filter.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, idx) => {
                const f = r.fields;
                const amt = f.amount_in_figure?.normalizedValue;
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={r.id}
                    style={{
                      background: isEven ? 'transparent' : 'rgba(0,0,0,0.02)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.isChequePage === false ? (
                        <span className="badge badge-error" style={{ fontSize: 10 }}>Non-Cheque</span>
                      ) : r.reviewRequired ? (
                        <span className="badge badge-warning" style={{ fontSize: 10 }}>Review</span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: 10 }}>Valid</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{f.bank?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{f.date?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{f.payee_name?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      {typeof amt === 'number' ? `₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{f.account_no?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{f.cheque_no?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{f.micr_code?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{f.signature_by?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: r.overallConfidence >= 80 ? '#10B981' : r.overallConfidence >= 50 ? '#F59E0B' : '#EF4444',
                      }}>
                        {r.overallConfidence}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onReviewRecord(r)}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          <Eye size={12} /> Review
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onDeleteRecord(r.id)}
                          style={{ fontSize: 11, padding: '3px 6px', color: 'var(--error)' }}
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
