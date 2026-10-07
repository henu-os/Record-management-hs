/**
 * HENU VOUCHER OCR — SINGLE VOUCHER UPLOAD COMPONENT
 */

import React, { useState, useRef } from 'react';
import { Upload, FileImage, FileText, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { getLocalOcrEngine } from '../../../../modules/henu-voucher-ocr/ocr/TesseractLocalEngine';
import { PreprocessingPipeline } from '../../../../modules/henu-voucher-ocr/ocr/PreprocessingPipeline';
import { FieldExtractor } from '../../../../modules/henu-voucher-ocr/extraction/FieldExtractor';
import { PdfPageExtractor } from '../../../../modules/henu-voucher-ocr/ocr/PdfPageExtractor';
import { OcrRouter } from '../../../../modules/henu-voucher-ocr/ocr/OcrRouter';
import { VoucherProcessingRecord } from '../../../../modules/henu-voucher-ocr/schema/types';

interface SingleVoucherUploadProps {
  onProcessed: (record: VoucherProcessingRecord) => void;
}

export const SingleVoucherUpload: React.FC<SingleVoucherUploadProps> = ({ onProcessed }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedLangs, setSelectedLangs] = useState<('eng' | 'hin' | 'mar')[]>(['eng']);
  const [preprocess, setPreprocess] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setPreviewUrl('pdf');
    }
  };

  const toggleLang = (lang: 'eng' | 'hin' | 'mar') => {
    setSelectedLangs(prev =>
      prev.includes(lang) ? (prev.length > 1 ? prev.filter(l => l !== lang) : prev) : [...prev, lang]
    );
  };

  const processVoucher = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Initializing OCR engine / API route...');

    try {
      let targetCanvas: HTMLCanvasElement;
      let originalDisplayUrl = previewUrl || '';

      if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setProgressStatus('Rendering PDF page...');
        const pdfDoc = await PdfPageExtractor.loadPdf(selectedFile);
        const rendered = await PdfPageExtractor.renderPage(pdfDoc, 1, 2.0);
        targetCanvas = rendered.canvas;
        originalDisplayUrl = rendered.dataUrl;
      } else {
        setProgressStatus('Loading voucher photograph...');
        const img = await PreprocessingPipeline.loadImage(selectedFile);
        targetCanvas = PreprocessingPipeline.sourceToCanvas(img);
        if (!originalDisplayUrl || originalDisplayUrl === 'pdf') {
          originalDisplayUrl = targetCanvas.toDataURL('image/png');
        }
      }

      setProgressStatus(`Extracting voucher fields...`);

      const record = await OcrRouter.processCanvas(
        targetCanvas,
        selectedFile.name,
        1,
        1,
        {
          languages: selectedLangs,
          originalDataUrl: originalDisplayUrl,
        }
      );

      setIsProcessing(false);
      onProcessed(record);
    } catch (err: any) {
      console.error('Error processing single voucher:', err);
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Failed to process voucher image.');
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
      {/* Upload Zone */}
      <div
        className={`voucher-dropzone${dragActive ? ' drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
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
          <Upload size={28} />
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
          {selectedFile ? selectedFile.name : 'Upload Single Voucher (JPG, PNG, PDF)'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460 }}>
          Drag and drop your scanned or photo voucher here, or click to browse.
          Supports English, Hindi, and Marathi text (printed or handwritten).
        </p>

        {selectedFile && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            <CheckCircle2 size={14} /> File selected: {(selectedFile.size / 1024).toFixed(1)} KB
          </div>
        )}
      </div>

      {/* Options Panel */}
      <div style={{
        marginTop: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
      }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            OCR Languages (Offline)
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={selectedLangs.includes('eng')}
                onChange={e => {
                  if (e.target.checked) setSelectedLangs([...selectedLangs, 'eng']);
                  else setSelectedLangs(selectedLangs.filter(l => l !== 'eng'));
                }}
              />
              English
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={selectedLangs.includes('hin')}
                onChange={e => {
                  if (e.target.checked) setSelectedLangs([...selectedLangs, 'hin']);
                  else setSelectedLangs(selectedLangs.filter(l => l !== 'hin'));
                }}
              />
              Hindi (हिन्दी)
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={selectedLangs.includes('mar')}
                onChange={e => {
                  if (e.target.checked) setSelectedLangs([...selectedLangs, 'mar']);
                  else setSelectedLangs(selectedLangs.filter(l => l !== 'mar'));
                }}
              />
              Marathi (मराठी)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={preprocess}
              onChange={e => setPreprocess(e.target.checked)}
            />
            Enhanced Preprocessing (Contrast & Deskew)
          </label>

          <button
            className="btn btn-primary"
            disabled={!selectedFile || isProcessing || selectedLangs.length === 0}
            onClick={processVoucher}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={15} className="spin" /> Processing...
              </>
            ) : (
              <>
                <Sparkles size={15} /> Extract Voucher Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Status / Error Bar */}
      {isProcessing && (
        <div className="voucher-progress-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
            <span>{progressStatus}</span>
            <span style={{ color: 'var(--accent)' }}>Local Offline OCR Running</span>
          </div>
          <div className="voucher-progress-bar-bg">
            <div className="voucher-progress-bar-fill" style={{ width: '75%' }} />
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: 8,
          color: 'var(--error)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}
    </div>
  );
};
