/**
 * HENU VOUCHER OCR — VOUCHER INBOX WORKSPACE
 * Ingestion, search, advanced filter, batch operations, retry, review, and detail actions.
 */

import React, { useState, useRef } from 'react';
import {
  Upload, Search, Filter, CheckCircle2, AlertTriangle, XCircle, AlertCircle,
  Eye, Trash2, RotateCcw, Download, CheckSquare, Square, FileText, Layers, RefreshCw
} from 'lucide-react';
import { VoucherProcessingRecord, HenuAiEngineStatusReport } from '../../../../modules/henu-voucher-ocr/schema/types';
import { ExcelExportService } from '../../../../modules/henu-voucher-ocr/excel/ExcelExportService';
import { getLocalOcrEngine } from '../../../../modules/henu-voucher-ocr/ocr/TesseractLocalEngine';
import { PreprocessingPipeline } from '../../../../modules/henu-voucher-ocr/ocr/PreprocessingPipeline';
import { FieldExtractor } from '../../../../modules/henu-voucher-ocr/extraction/FieldExtractor';
import { PdfPageExtractor } from '../../../../modules/henu-voucher-ocr/ocr/PdfPageExtractor';
import { OcrRouter } from '../../../../modules/henu-voucher-ocr/ocr/OcrRouter';

interface VoucherInboxProps {
  records: VoucherProcessingRecord[];
  engineStatus?: { isUsbConnected?: boolean; isEngineOn?: boolean; state?: string } | null;
  ocrMode?: 'HENU_AI' | 'APIS';
  onRecordsUpdated: (records: VoucherProcessingRecord[]) => void;
  onReviewRecord: (record: VoucherProcessingRecord) => void;
  onViewDetail: (record: VoucherProcessingRecord) => void;
  onProcessingStarted: () => void;
}

export const VoucherInbox: React.FC<VoucherInboxProps> = ({
  records,
  engineStatus,
  ocrMode = 'HENU_AI',
  onRecordsUpdated,
  onReviewRecord,
  onViewDetail,
  onProcessingStarted,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'review' | 'approved' | 'exported' | 'failed'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter logic
  const filteredRecords = records.filter(r => {
    // Status filter
    if (statusFilter === 'review' && !r.reviewRequired) return false;
    if (statusFilter === 'approved' && (r.reviewRequired || r.processingStatus !== 'completed')) return false;
    if (statusFilter === 'failed' && r.processingStatus !== 'failed') return false;
    if (statusFilter === 'exported' && !r.exportInfo?.exportedAt) return false;
    if (statusFilter === 'pending' && r.processingStatus !== 'pending') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const f = r.fields;
      const vNo = String(f.voucher_no?.normalizedValue || '').toLowerCase();
      const payee = String(f.pay_to?.normalizedValue || '').toLowerCase();
      const narration = String(f.particulars?.normalizedValue || '').toLowerCase();
      const date = String(f.voucher_date?.normalizedValue || '').toLowerCase();
      const amount = String(f.net_paid?.normalizedValue || '').toLowerCase();
      const chq = String(f.cheque_no?.normalizedValue || '').toLowerCase();

      return vNo.includes(q) || payee.includes(q) || narration.includes(q) || date.includes(q) || amount.includes(q) || chq.includes(q);
    }
    return true;
  });

  // Handle Drag & Drop
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

  const [selectedLanguages, setSelectedLanguages] = useState<('eng' | 'hin' | 'mar')[]>(['eng']);

  // Process files through unified OcrRouter
  const processUploadedFiles = async (files: File[]) => {
    // If HENU AI mode is active, check USB
    if (ocrMode === 'HENU_AI') {
      if (engineStatus && !engineStatus.isUsbConnected) {
        alert('Please insert the HENU AI Engine pen drive.');
        return;
      }
      if (engineStatus && !engineStatus.isEngineOn) {
        alert('HENU AI Engine is OFF. Turn ON to process vouchers.');
        return;
      }
    }

    setIsUploading(true);
    onProcessingStarted();
    const newRecords: VoucherProcessingRecord[] = [];
    const activeLangs: ('eng' | 'hin' | 'mar')[] = selectedLanguages.length > 0 ? selectedLanguages : ['eng'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      setUploadStatus(`Processing file ${i + 1} of ${files.length}: ${file.name} [Mode: ${ocrMode === 'APIS' ? 'APIs' : 'HENU AI'}]...`);

      try {
        if (isPdf) {
          const pdfDoc = await PdfPageExtractor.loadPdf(file);
          for (let p = 1; p <= pdfDoc.numPages; p++) {
            setUploadStatus(`Rendering & extracting ${file.name} (Page ${p}/${pdfDoc.numPages})...`);
            const rendered = await PdfPageExtractor.renderPage(pdfDoc, p, 2.0);
            const record = await OcrRouter.processCanvas(
              rendered.canvas,
              file.name,
              p,
              pdfDoc.numPages,
              { languages: activeLangs, originalDataUrl: rendered.dataUrl }
            );
            newRecords.push(record);
          }
        } else {
          setUploadStatus(`Running OCR on image ${file.name} [${ocrMode === 'APIS' ? 'APIs' : 'HENU AI'}]...`);
          const img = await PreprocessingPipeline.loadImage(file);
          const canvas = PreprocessingPipeline.sourceToCanvas(img);
          const dataUrl = canvas.toDataURL('image/png');
          const record = await OcrRouter.processCanvas(
            canvas,
            file.name,
            1,
            1,
            { languages: activeLangs, originalDataUrl: dataUrl }
          );
          newRecords.push(record);
        }
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        // Create a failed record
        newRecords.push({
          id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sourceFile: file.name,
          sourcePage: 1,
          totalPages: 1,
          processingStatus: 'failed',
          overallConfidence: 0,
          reviewRequired: true,
          validationIssues: [{ fieldKey: 'voucher_no', severity: 'error', message: err?.message || 'Processing failed' }],
          fields: {} as any,
          rawText: '',
          processedAt: new Date().toISOString(),
          errorMessage: err?.message || 'OCR parsing failed',
        });
      }
    }

    onRecordsUpdated([...newRecords, ...records]);
    setIsUploading(false);
    setUploadStatus('');
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Bulk actions
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
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected vouchers?`)) {
      onRecordsUpdated(records.filter(r => !selectedIds.includes(r.id)));
      setSelectedIds([]);
    }
  };

  const handleBulkExportXlsx = async () => {
    const targetRecords = records.filter(r => selectedIds.includes(r.id));
    if (targetRecords.length === 0) return;
    const buf = await ExcelExportService.generateWorkbook(targetRecords);
    ExcelExportService.downloadXlsx(buf, `Vouchers_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleBulkExportJson = () => {
    const targetRecords = records.filter(r => selectedIds.includes(r.id));
    if (targetRecords.length === 0) return;
    const jsonStr = ExcelExportService.generateCanonicalJson(targetRecords);
    ExcelExportService.downloadJson(jsonStr, `Vouchers_Canonical_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const isHenuAiNotReady = ocrMode === 'HENU_AI' && (!engineStatus?.isUsbConnected || engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' || engineStatus?.state === 'ENGINE_ERROR' || engineStatus?.state === 'RUNTIME_ERROR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Upload Dropzone */}
      <div
        className={`voucher-dropzone${dragActive ? ' drag-active' : ''}`}
        onDragEnter={isHenuAiNotReady ? undefined : handleDrag}
        onDragLeave={isHenuAiNotReady ? undefined : handleDrag}
        onDragOver={isHenuAiNotReady ? undefined : handleDrag}
        onDrop={isHenuAiNotReady ? undefined : handleDrop}
        onClick={() => {
          if (ocrMode === 'HENU_AI') {
            if (!engineStatus?.isUsbConnected) {
              alert('HENU AI USB NOT CONNECTED.\nConnect the HENU AI USB to use OCR. The AI engine and OCR models are available only from the connected HENU AI USB.');
              return;
            }
            if (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING') {
              alert('HENU AI Engine is initializing and loading models. Please wait a moment for READY state.');
              return;
            }
            if (engineStatus?.state === 'ENGINE_ERROR' || engineStatus?.state === 'RUNTIME_ERROR') {
              alert('HENU AI Service encountered an error. Please reconnect the USB.');
              return;
            }
          }
          fileInputRef.current?.click();
        }}
        style={{
          padding: '24px 20px',
          cursor: isHenuAiNotReady ? 'not-allowed' : 'pointer',
          border: ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected ? '2px dashed #EF4444' : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' ? '2px dashed #F59E0B' : undefined),
          background: ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected ? 'rgba(239, 68, 68, 0.04)' : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' ? 'rgba(245, 158, 11, 0.04)' : undefined),
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          multiple
          disabled={isHenuAiNotReady}
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected ? 'rgba(239, 68, 68, 0.15)' : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 58, 237, 0.1)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected ? '#EF4444' : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' ? '#F59E0B' : 'var(--accent)'),
            flexShrink: 0,
          }}>
            {ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected ? <AlertCircle size={22} /> : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' ? <RefreshCw size={22} className="spin" /> : <Upload size={22} />)}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected ? '#EF4444' : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING' ? '#F59E0B' : 'var(--text-primary)') }}>
              {ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected
                ? '🔒 HENU AI USB NOT CONNECTED'
                : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING'
                  ? '🟡 Initializing HENU AI Model — Please wait...'
                  : 'Ingest Vouchers (Drag & Drop or Click to Browse)')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {ocrMode === 'HENU_AI' && !engineStatus?.isUsbConnected
                ? 'Connect the HENU AI USB to use OCR. The AI engine and OCR models are available only from the connected HENU AI USB.'
                : (engineStatus?.state === 'SERVICE_STARTING' || engineStatus?.state === 'MODEL_LOADING'
                  ? 'Loading local neural models from USB into memory. Upload will be enabled once READY.'
                  : 'Supports single or multiple JPG, PNG, and multi-page PDF files. 100% offline local extraction.')}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="voucher-progress-container" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
            <span className="flex items-center gap-6"><RefreshCw size={14} className="spin text-accent" /> {uploadStatus}</span>
            <span style={{ color: 'var(--accent)' }}>Local OCR Engine Working</span>
          </div>
          <div className="voucher-progress-bar-bg">
            <div className="voucher-progress-bar-fill" style={{ width: '80%' }} />
          </div>
        </div>
      )}

      {/* Toolbar: Search, Filters, and Bulk Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'var(--surface)',
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 240, maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Search Voucher No, Payee, Amount, Date..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, fontSize: 12, height: 32, width: '100%' }}
          />
        </div>

        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            All ({records.length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'review' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('review')}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            Review ({records.filter(r => r.reviewRequired).length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('approved')}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            Approved ({records.filter(r => !r.reviewRequired && r.processingStatus === 'completed').length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('failed')}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            Failed ({records.filter(r => r.processingStatus === 'failed').length})
          </button>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
              {selectedIds.length} Selected:
            </span>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={handleBulkApprove}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              <CheckCircle2 size={12} className="text-success" /> Approve
            </button>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={handleBulkExportXlsx}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              <Download size={12} /> Export XLSX
            </button>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={handleBulkExportJson}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              <FileText size={12} /> JSON
            </button>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-4"
              onClick={handleBulkDelete}
              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--error)' }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Main Vouchers Table */}
      <div className="vch-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>
                  <button
                    onClick={handleSelectAll}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)' }}
                  >
                    {selectedIds.length === filteredRecords.length && filteredRecords.length > 0 ? (
                      <CheckSquare size={14} className="text-accent" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Voucher No</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Payee (Pay To)</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Debit (Charge To)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Paid</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Confidence</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Source / Page</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No vouchers found matching your query or filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const formatTableDate = (d: any) => {
                    if (!d) return '—';
                    const str = String(d).trim();
                    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                      const [y, m, day] = str.split('-');
                      return `${day}/${m}/${y}`;
                    }
                    if (/^\d{8}$/.test(str)) {
                      return `${str.substring(0, 2)}/${str.substring(2, 4)}/${str.substring(4, 8)}`;
                    }
                    return str;
                  };

                  const isSelected = selectedIds.includes(r.id);
                  const f = r.fields;
                  const vNo = f.voucher_no?.normalizedValue || 'Not detected';
                  const vDate = formatTableDate(f.voucher_date?.normalizedValue);
                  const payee = f.pay_to?.normalizedValue || 'Not detected';
                  const charge = f.charge_to?.normalizedValue || '—';
                  const net = f.net_paid?.normalizedValue !== null && f.net_paid?.normalizedValue !== undefined
                    ? `₹${Number(f.net_paid.normalizedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '—';

                  const isFailed = r.processingStatus === 'failed';

                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: isSelected ? 'rgba(124, 58, 237, 0.08)' : undefined,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleSelect(r.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}
                        >
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </td>

                      <td style={{ padding: '8px 12px' }}>
                        {isFailed ? (
                          <span className="vch-status-badge vch-status-failed">
                            <XCircle size={11} /> Failed
                          </span>
                        ) : r.reviewRequired ? (
                          <span className="vch-status-badge vch-status-review">
                            <AlertTriangle size={11} /> Review
                          </span>
                        ) : (
                          <span className="vch-status-badge vch-status-approved">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {vNo}
                      </td>

                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {vDate}
                      </td>

                      <td style={{ padding: '8px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={payee}>
                        {payee}
                      </td>

                      <td style={{ padding: '8px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={charge}>
                        {charge}
                      </td>

                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        {net}
                      </td>

                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
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

                      <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {r.sourceFile} (p.{r.sourcePage})
                      </td>

                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onReviewRecord(r)}
                            title="Open Review & Corrections"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                          >
                            Review
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onViewDetail(r)}
                            title="Inspect 8-Tab Detail"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                          >
                            <Eye size={12} />
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
    </div>
  );
};
