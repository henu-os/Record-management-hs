import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

interface Props {
  /** file://, blob:, or data: URL of the PDF to show. When empty, shows placeholder. */
  pdfUrl: string | null;
  height?: number | string;
  loading?: boolean;
  loadingMessage?: string;
}

/**
 * PdfViewer — Displays a PDF using Chromium's built-in PDF viewer.
 *
 * Converts data URLs to Blob URLs to avoid Chromium's raw CSS text display bug.
 */
export default function PdfViewer({ pdfUrl, height = '100%', loading = false, loadingMessage }: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfUrl) {
      setResolvedUrl(null);
      return;
    }

    // If it is a base64 data URL, convert to a Blob URL so Chromium renders the PDF properly
    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setResolvedUrl(blobUrl);
        return () => {
          URL.revokeObjectURL(blobUrl);
        };
      } catch (e) {
        console.error('Failed to create blob URL from base64 PDF:', e);
        setResolvedUrl(pdfUrl);
      }
    } else {
      setResolvedUrl(pdfUrl);
    }
  }, [pdfUrl]);

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    minHeight: 0,
    flex: 1,
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {loadingMessage || 'Generating PDF preview…'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Using same engine as final download
          </div>
        </div>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div style={containerStyle}>
        <FileText size={40} strokeWidth={1} style={{ color: 'var(--border)', marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
          PDF preview will appear here
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
          Click <strong>Generate PDF</strong> to generate and preview the output using
          the exact same engine as the final download
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height, flex: 1, minHeight: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <iframe
        title="PDF Preview"
        src={resolvedUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
