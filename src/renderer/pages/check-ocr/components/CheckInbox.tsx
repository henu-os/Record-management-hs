/**
 * HENU CHECK OCR — CHECK INBOX WORKSPACE
 * Ingestion, search, advanced filter, batch operations, retry, review, and detail actions.
 */

import React, { useState, useRef } from 'react';
import {
  Upload, Search, Filter, CheckCircle2, AlertTriangle, XCircle, AlertCircle,
  Eye, Trash2, RotateCcw, Download, CheckSquare, Square, FileText, Layers, RefreshCw
} from 'lucide-react';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';
import { CheckExcelExportService } from '../../../../modules/henu-check-ocr/excel/CheckExcelExportService';
import { PreprocessingPipeline } from '../../../../modules/henu-voucher-ocr/ocr/PreprocessingPipeline';
import { PdfPageExtractor } from '../../../../modules/henu-voucher-ocr/ocr/PdfPageExtractor';
import { CheckOcrRouter } from '../../../../modules/henu-check-ocr/ocr/CheckOcrRouter';

interface CheckInboxProps {
  records: CheckProcessingRecord[];
  engineStatus?: { isUsbConnected?: boolean; isEngineOn?: boolean; state?: string } | null;
  ocrMode?: 'HENU_AI' | 'APIS';
  onRecordsUpdated: (records: CheckProcessingRecord[]) => void;
  onReviewRecord: (record: CheckProcessingRecord) => void;
  onViewDetail: (record: CheckProcessingRecord) => void;
  onProcessingStarted: () => void;
}

export const CheckInbox: React.FC<CheckInboxProps> = ({
  records,
  engineStatus,
  ocrMode = 'HENU_AI',
  onRecordsUpdated,
  onReviewRecord,
  onViewDetail,
  onProcessingStarted,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'review' | 'approved' | 'non_cheque' | 'failed'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<('eng' | 'hin' | 'mar')[]>(['eng']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter logic
  const filteredRecords = records.filter(r => {
    if (statusFilter === 'review' && !r.reviewRequired) return false;
    if (statusFilter === 'approved' && (r.reviewRequired || r.processingStatus !== 'completed')) return false;
    if (statusFilter === 'non_cheque' && r.isChequePage !== false) return false;
    if (statusFilter === 'failed' && r.processingStatus !== 'failed') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const f = r.fields;
      const bank = String(f.bank?.normalizedValue || '').toLowerCase();
      const payee = String(f.payee_name?.normalizedValue || '').toLowerCase();
      const chq = String(f.cheque_no?.normalizedValue || '').toLowerCase();
      const date = String(f.date?.normalizedValue || '').toLowerCase();
      const amount = String(f.amount_in_figure?.normalizedValue || '').toLowerCase();
      const micr = String(f.micr_code?.normalizedValue || '').toLowerCase();
      const file = String(r.sourceFile || '').toLowerCase();

      return bank.includes(q) || payee.includes(q) || chq.includes(q) || date.includes(q) || amount.includes(q) || micr.includes(q) || file.includes(q);
    }
    return true;
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(Array.from(e.target.files));
    }
  };

  const processUploadedFiles = async (files: File[]) => {
    if (ocrMode === 'HENU_AI') {
      if (engineStatus && !engineStatus.isUsbConnected) {
        alert('Please connect the HENU AI Engine pen drive.');
        return;
      }
      if (engineStatus && !engineStatus.isEngineOn) {
        alert('HENU AI Engine is OFF. Turn ON before processing cheques.');
        return;
      }
    }

    setIsUploading(true);
    onProcessingStarted();
    const newRecords: CheckProcessingRecord[] = [];
    const activeLangs: ('eng' | 'hin' | 'mar')[] = selectedLanguages.length > 0 ? selectedLanguages : ['eng'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      setUploadStatus(`Processing file ${i + 1} of ${files.length}: ${file.name} [Mode: ${ocrMode === 'APIS' ? 'HENU Vision Online' : 'HENU AI USB'}]...`);

      try {
        if (isPdf) {
          const pdfDoc = await PdfPageExtractor.loadPdf(file);
          for (let p = 1; p <= pdfDoc.numPages; p++) {
            setUploadStatus(`Rendering & extracting ${file.name} (Page ${p}/${pdfDoc.numPages})...`);
            const rendered = await PdfPageExtractor.renderPage(pdfDoc, p, 2.0);
            const record = await CheckOcrRouter.processCanvas(
              rendered.canvas,
              file.name,
              p,
              pdfDoc.numPages,
              { languages: activeLangs, originalDataUrl: rendered.dataUrl }
            );
            newRecords.push(record);
          }
        } else {
          setUploadStatus(`Running OCR on image ${file.name}...`);
          const img = await PreprocessingPipeline.loadImage(file);
          const canvas = PreprocessingPipeline.sourceToCanvas(img);
          const dataUrl = canvas.toDataURL('image/png');
          const record = await CheckOcrRouter.processCanvas(
            canvas,
            file.name,
            1,
            1,
            { languages: activeLangs, originalDataUrl: dataUrl }
          );
          newRecords.push(record);
        }
      } catch (err: any) {
        console.error(`Error processing cheque ${file.name}:`, err);
        newRecords.push({
          id: `check-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sourceFile: file.name,
          sourcePage: 1,
          totalPages: 1,
          processingStatus: 'failed',
          overallConfidence: 0,
          reviewRequired: true,
          validationIssues: [{ fieldKey: 'general', severity: 'error', message: err?.message || 'Processing failed' }],
          fields: {} as any,
          rawText: '',
          processedAt: new Date().toISOString(),
          errorMessage: err?.message || 'Cheque OCR parsing failed',
        });
      }
    }

    onRecordsUpdated([...newRecords, ...records]);
    setIsUploading(false);
    setUploadStatus('');
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleBulkApprove = () => {
    const updated = records.map(r => {
      if (selectedIds.includes(r.id)) {
        return {
          ...r,
          reviewRequired: false,
          lifecycleStatus: 'approved' as const,
          approvalInfo: {
            status: 'approved' as const,
            approvedAt: new Date().toISOString(),
            approvedBy: 'User (Bulk)',
          },
        };
      }
      return r;
    });
    onRecordsUpdated(updated);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected cheque record(s)?`)) {
      const updated = records.filter(r => !selectedIds.includes(r.id));
      onRecordsUpdated(updated);
      setSelectedIds([]);
    }
  };

  const handleExportSelected = async () => {
    const targetRecords = records.filter(r => selectedIds.includes(r.id));
    if (targetRecords.length === 0) return;
    const buffer = await CheckExcelExportService.generateWorkbook(targetRecords);
    CheckExcelExportService.downloadXlsx(buffer, `HENU_Cheques_Selected_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Upload Dropzone Bar */}
      <div
        className={`check-dropzone${dragActive ? ' drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ padding: '24px 20px' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'rgba(124, 58, 237, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <Upload size={20} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Drop Bank Cheques Here or Click to Upload
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Supports multiple PNG, JPG, JPEG images and multi-page PDF documents.
            </div>
          </div>
        </div>

        {isUploading && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={14} className="spin" /> {uploadStatus}
          </div>
        )}
      </div>

      {/* Inbox Search, Filter & Bulk Actions Bar */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
          <input
            type="text"
            className="check-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search bank, payee, cheque no, amount..."
            style={{ paddingLeft: 32, height: 32, fontSize: 12 }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            All ({records.length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'review' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('review')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Needs Review ({records.filter(r => r.reviewRequired).length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('approved')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Approved ({records.filter(r => !r.reviewRequired && r.processingStatus === 'completed').length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'non_cheque' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('non_cheque')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Non-Cheque ({records.filter(r => r.isChequePage === false).length})
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              {selectedIds.length} Selected
            </span>
            <button
              className="btn btn-primary btn-sm flex items-center gap-4"
              onClick={handleBulkApprove}
              style={{ fontSize: 11 }}
            >
              <CheckCircle2 size={13} /> Bulk Approve
            </button>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={handleExportSelected}
              style={{ fontSize: 11 }}
            >
              <Download size={13} /> Export
            </button>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={handleBulkDelete}
              style={{ fontSize: 11, color: 'var(--error)' }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Cheque Ingestion Table */}
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
              <th style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={filteredRecords.length > 0 && selectedIds.length === filteredRecords.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Source File / Page</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Bank</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Date</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Payee Name</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Amount in Figure (₹)</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Cheque No</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>MICR Code</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Confidence</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No cheque records found matching the current filter.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, idx) => {
                const f = r.fields;
                const isSelected = selectedIds.includes(r.id);
                const isEven = idx % 2 === 0;
                const amt = f.amount_in_figure?.normalizedValue;

                return (
                  <tr
                    key={r.id}
                    style={{
                      background: isSelected ? 'rgba(124, 58, 237, 0.08)' : (isEven ? 'transparent' : 'rgba(0,0,0,0.02)'),
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(r.id)}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.isChequePage === false ? (
                        <span className="badge badge-error" style={{ fontSize: 10 }}>Non-Cheque</span>
                      ) : r.reviewRequired ? (
                        <span className="badge badge-warning" style={{ fontSize: 10 }}>Review Required</span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: 10 }}>Approved</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {r.sourceFile} {r.totalPages > 1 && `(Page ${r.sourcePage}/${r.totalPages})`}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{f.bank?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{f.date?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{f.payee_name?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      {typeof amt === 'number' ? `₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{f.cheque_no?.normalizedValue || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{f.micr_code?.normalizedValue || '—'}</td>
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
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onReviewRecord(r)}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          title="Open 3-column verification screen"
                        >
                          <Eye size={12} /> Review
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewDetail(r)}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          title="Quick View Details"
                        >
                          Detail
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
