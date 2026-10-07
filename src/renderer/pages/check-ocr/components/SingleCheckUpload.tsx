/**
 * HENU CHECK OCR — SINGLE CHEQUE UPLOAD COMPONENT
 */

import React, { useState, useRef } from 'react';
import { Upload, FileImage, FileText, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { PreprocessingPipeline } from '../../../../modules/henu-voucher-ocr/ocr/PreprocessingPipeline';
import { PdfPageExtractor } from '../../../../modules/henu-voucher-ocr/ocr/PdfPageExtractor';
import { CheckOcrRouter } from '../../../../modules/henu-check-ocr/ocr/CheckOcrRouter';
import { CheckProcessingRecord } from '../../../../modules/henu-check-ocr/schema/types';

interface SingleCheckUploadProps {
  onProcessed: (record: CheckProcessingRecord) => void;
}

export const SingleCheckUpload: React.FC<SingleCheckUploadProps> = ({ onProcessed }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedLangs, setSelectedLangs] = useState<('eng' | 'hin' | 'mar')[]>(['eng']);
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

  const processCheque = async () => {
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
        setProgressStatus('Loading cheque photograph...');
        const img = await PreprocessingPipeline.loadImage(selectedFile);
        targetCanvas = PreprocessingPipeline.sourceToCanvas(img);
        if (!originalDisplayUrl || originalDisplayUrl === 'pdf') {
          originalDisplayUrl = targetCanvas.toDataURL('image/png');
        }
      }

      setProgressStatus(`Extracting bank cheque fields...`);

      const record = await CheckOcrRouter.processCanvas(
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
      console.error('Error processing single cheque:', err);
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Failed to process cheque image.');
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
      {/* Upload Zone */}
      <div
        className={`check-dropzone${dragActive ? ' drag-active' : ''}`}
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
          {selectedFile ? selectedFile.name : 'Upload Single Bank Cheque'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460 }}>
          Drag & drop a Bank Cheque (PNG, JPG, JPEG, or PDF) or click to browse.
          Extracts Bank, Payee, Amount in Figures, Rupees in Words, A/c No, Cheque No, Date, MICR, and Signatory.
        </p>

        {previewUrl && previewUrl !== 'pdf' && (
          <div style={{ marginTop: 20, maxHeight: 180, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)' }}>
            <img src={previewUrl} alt="Cheque preview" style={{ height: 180, objectFit: 'contain' }} />
          </div>
        )}

        {previewUrl === 'pdf' && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
            <FileText size={18} /> PDF Document Ready
          </div>
        )}
      </div>

      {/* Control Panel */}
      {selectedFile && (
        <div style={{
          marginTop: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            {/* Language Selector */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                OCR Languages
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'eng', label: 'English' },
                  { id: 'hin', label: 'Hindi' },
                  { id: 'mar', label: 'Marathi' },
                ].map(lang => {
                  const isSel = selectedLangs.includes(lang.id as any);
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => toggleLang(lang.id as any)}
                      className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Process Action */}
            <div>
              <button
                className="btn btn-primary"
                onClick={processCheque}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 24px',
                  fontWeight: 700,
                }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Extract Cheque OCR
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Progress Status */}
          {isProcessing && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                <RefreshCw size={13} className="spin" /> {progressStatus}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 6,
              color: 'var(--error)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <AlertCircle size={15} /> {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
