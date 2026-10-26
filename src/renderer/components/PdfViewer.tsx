import React, { useEffect, useState } from 'react';
import { FileText, Printer, CheckCircle } from 'lucide-react';

interface Props {
  /** file://, blob:, or data: URL of the PDF to show. When empty, shows placeholder. */
  pdfUrl: string | null;
  pdfPath?: string | null;
  orientation?: 'Portrait' | 'Landscape';
  paperSize?: 'LEGAL' | 'FOOLSCAP' | string;
  height?: number | string;
  loading?: boolean;
  loadingMessage?: string;
  onPrint?: (targetPaperSize?: 'LEGAL' | 'FOOLSCAP') => void;
}

/**
 * PdfViewer — Displays a PDF using Chromium's built-in PDF viewer with
 * calibrated paper printing and 1:1 scale enforcement toolbar.
 */
export default function PdfViewer({
  pdfUrl,
  pdfPath,
  orientation = 'Portrait',
  paperSize = 'LEGAL',
  height = '100%',
  loading = false,
  loadingMessage,
  onPrint,
}: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

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

  const handleDirectPrint = async (targetSize?: 'LEGAL' | 'FOOLSCAP') => {
    const activePaper = targetSize || (paperSize === 'FOOLSCAP' ? 'FOOLSCAP' : 'LEGAL');
    if (onPrint) {
      onPrint(activePaper);
      return;
    }

    setIsPrinting(true);
    try {
      const api = (window as any).api;
      if (api?.system?.printPdf) {
        await api.system.printPdf({
          pdfUrl: resolvedUrl || pdfUrl,
          pdfPath,
          orientation,
          pageSize: activePaper === 'FOOLSCAP' ? 'Foolscap' : 'Legal',
          paperSize: activePaper,
          silent: false,
        });
      } else {
        // Fallback to high-precision HTML print iframe with CSS @page calibrated size
        const isLandscape = orientation === 'Landscape';
        const isFoolscap = activePaper === 'FOOLSCAP';
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const targetUrl = resolvedUrl || pdfUrl || '';
        const pageCss = isFoolscap
          ? (isLandscape ? '13.5in 8.5in landscape' : '8.5in 13.5in portrait')
          : (isLandscape ? '14in 8.5in landscape' : '8.5in 14in portrait');

        const html = `<!DOCTYPE html><html><head><style>
          @page { size: ${pageCss}; margin: 0; }
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; }
          embed { width: 100%; height: 100%; }
        </style></head><body>
          <embed src="${targetUrl}#toolbar=0" type="application/pdf" width="100%" height="100%" />
        </body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        iframe.src = blobUrl;
        setTimeout(() => {
          try {
            iframe.contentWindow?.print();
          } catch (e) {
            window.print();
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }, 3000);
        }, 500);
      }
    } catch (err: any) {
      console.error('Direct print error:', err);
    } finally {
      setIsPrinting(false);
    }
  };

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
            Using exact 1:1 Legal Paper Engine (1.5 cm Margins)
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
          Click <strong>Live Preview PDF</strong> to generate and preview the output formatted exactly for physical Legal paper.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: typeof height === 'number' ? `${height}px` : height,
      flex: 1,
      minHeight: 0,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Precision Print Toolbar */}
      <div style={{
        background: 'var(--surface-2, #1e293b)',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
      }}>
        <div className="flex items-center gap-8">
          <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
            {paperSize === 'FOOLSCAP' ? 'FOOLSCAP 8.5 × 13.5 in' : 'LEGAL 8.5 × 14 in'}
          </span>
          <span className="badge badge-secondary" style={{ fontSize: 10, padding: '2px 6px' }}>
            {orientation.toUpperCase()}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {paperSize === 'FOOLSCAP'
              ? 'Indian Register / Foolscap (Folio) • 1:1 Scale Fixed'
              : '1.5 cm Box Margins • 1:1 Scale Fixed'}
          </span>
        </div>

        <button
          className="btn btn-primary btn-sm flex items-center gap-6"
          onClick={() => handleDirectPrint(paperSize === 'FOOLSCAP' ? 'FOOLSCAP' : 'LEGAL')}
          disabled={isPrinting}
          style={{ fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
          title={paperSize === 'FOOLSCAP'
            ? 'Direct Print onto Physical Indian Register / Foolscap Paper (No compression, no shrinking)'
            : 'Direct Print onto Physical Legal Paper (No compression, no shrinking)'}
        >
          <Printer size={13} />
          {isPrinting ? 'Preparing Print...' : (paperSize === 'FOOLSCAP' ? '🖨 Print Directly (Foolscap)' : '🖨 Print Directly (Legal Paper)')}
        </button>
      </div>

      <iframe
        title="PDF Preview"
        src={resolvedUrl}
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
