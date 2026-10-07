/**
 * HENU CHECK OCR — BATCH MULTI-PAGE PDF PROCESSOR
 */

import React, { useState, useRef } from 'react';
import { FileText, Play, Square, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Sparkles, Layers } from 'lucide-react';
import { PdfPageExtractor } from '../../../../modules/henu-voucher-ocr/ocr/PdfPageExtractor';
import { CheckOcrRouter } from '../../../../modules/henu-check-ocr/ocr/CheckOcrRouter';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';

interface BatchCheckPdfUploadProps {
  onBatchCompleted: (records: CheckProcessingRecord[]) => void;
}

export const BatchCheckPdfUpload: React.FC<BatchCheckPdfUploadProps> = ({ onBatchCompleted }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLangs, setSelectedLangs] = useState<('eng' | 'hin' | 'mar')[]>(['eng']);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageRange, setPageRange] = useState<'all' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('1-10');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  // Batch stats
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [extractedRecords, setExtractedRecords] = useState<CheckProcessingRecord[]>([]);
  const [reviewRequiredCount, setReviewRequiredCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const cancelRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Please select a valid PDF file.');
        return;
      }

      setSelectedFile(file);
      try {
        const pdfDoc = await PdfPageExtractor.loadPdf(file);
        setTotalPages(pdfDoc.numPages);
        setCustomRange(`1-${Math.min(pdfDoc.numPages, 10)}`);
      } catch (err) {
        console.error('Failed to read PDF page count:', err);
      }
    }
  };

  const parsePageNumbers = (total: number): number[] => {
    if (pageRange === 'all') {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const parts = customRange.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10) || 1;
        const end = Math.min(total, parseInt(endStr, 10) || total);
        for (let p = start; p <= end; p++) {
          if (!pages.includes(p)) pages.push(p);
        }
      } else {
        const p = parseInt(trimmed, 10);
        if (p >= 1 && p <= total && !pages.includes(p)) pages.push(p);
      }
    }
    return pages.sort((a, b) => a - b);
  };

  const startBatchProcessing = async () => {
    if (!selectedFile) return;

    cancelRef.current = false;
    setIsCancelled(false);
    setIsProcessing(true);
    setExtractedRecords([]);
    setReviewRequiredCount(0);
    setFailedCount(0);

    setStatusMessage('Initializing PDF processor & Check OCR router...');

    try {
      const pdfDoc = await PdfPageExtractor.loadPdf(selectedFile);
      const targetPageNumbers = parsePageNumbers(pdfDoc.numPages);
      const results: CheckProcessingRecord[] = [];

      let reviewCount = 0;
      let fails = 0;

      for (let i = 0; i < targetPageNumbers.length; i++) {
        if (cancelRef.current) {
          setIsCancelled(true);
          break;
        }

        const pageNum = targetPageNumbers[i];
        setCurrentPageIndex(i + 1);
        setStatusMessage(`Rendering and extracting Page ${pageNum} of ${pdfDoc.numPages}...`);

        try {
          const rendered = await PdfPageExtractor.renderPage(pdfDoc, pageNum, 2.0);
          const record = await CheckOcrRouter.processCanvas(
            rendered.canvas,
            selectedFile.name,
            pageNum,
            pdfDoc.numPages,
            {
              languages: selectedLangs,
              originalDataUrl: rendered.dataUrl,
            }
          );

          if (record.reviewRequired) {
            reviewCount++;
            setReviewRequiredCount(reviewCount);
          }

          results.push(record);
          setExtractedRecords([...results]);
        } catch (pageErr) {
          console.error(`Error on cheque page ${pageNum}:`, pageErr);
          fails++;
          setFailedCount(fails);
        }
      }

      setIsProcessing(false);
      setStatusMessage('Bulk cheque PDF processing completed.');
      onBatchCompleted(results);
    } catch (err: any) {
      console.error('Batch PDF processing error:', err);
      setIsProcessing(false);
      setStatusMessage(`Error: ${err?.message || 'Failed processing batch'}`);
    }
  };

  const cancelProcessing = () => {
    cancelRef.current = true;
    setIsCancelled(true);
    setIsProcessing(false);
    setStatusMessage('Processing cancelled by user.');
  };

  const progressPercent = totalPages > 0 && currentPageIndex > 0
    ? Math.round((currentPageIndex / (pageRange === 'all' ? totalPages : parsePageNumbers(totalPages).length)) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
      {/* File Selector */}
      <div
        className="check-dropzone"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'rgba(124, 58, 237, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: 'var(--accent)',
        }}>
          <Layers size={28} />
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
          {selectedFile ? `${selectedFile.name} (${totalPages} cheque pages detected)` : 'Select Bulk Cheque PDF Document'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460 }}>
          Process multi-page bank cheque booklets and batches (e.g. 4, 10, 20, 50+ cheques in one PDF).
          Each page will generate an independent, reviewable cheque record.
        </p>
      </div>

      {/* Configuration & Controls */}
      {selectedFile && (
        <div style={{
          marginTop: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Page Range
              </label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="pageRange"
                    checked={pageRange === 'all'}
                    onChange={() => setPageRange('all')}
                  />
                  All Pages ({totalPages} cheques)
                </label>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="pageRange"
                    checked={pageRange === 'custom'}
                    onChange={() => setPageRange('custom')}
                  />
                  Custom Range:
                </label>
                {pageRange === 'custom' && (
                  <input
                    type="text"
                    className="check-input"
                    value={customRange}
                    onChange={e => setCustomRange(e.target.value)}
                    style={{ width: 100, padding: '4px 8px' }}
                    placeholder="1-10"
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {isProcessing ? (
                <button
                  className="btn"
                  onClick={cancelProcessing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--error)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  <Square size={14} /> Stop / Cancel
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={startBatchProcessing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 24px',
                    fontWeight: 700,
                  }}
                >
                  <Play size={15} /> Start Bulk Extraction
                </button>
              )}
            </div>
          </div>

          {/* Progress & Live Statistics */}
          {(isProcessing || extractedRecords.length > 0) && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <span>{statusMessage}</span>
                <span style={{ color: 'var(--accent)' }}>{progressPercent}%</span>
              </div>

              <div className="check-progress-bar-bg">
                <div className="check-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>

              {/* Counter Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
                <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Processed Pages</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentPageIndex} / {pageRange === 'all' ? totalPages : parsePageNumbers(totalPages).length}
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> Extracted Cheques
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>{extractedRecords.length}</div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: 11, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> Review Required
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B' }}>{reviewRequiredCount}</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <XCircle size={12} /> Failed Pages
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#EF4444' }}>{failedCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
