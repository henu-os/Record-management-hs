/**
 * HENU VOUCHER OCR — PDF PAGE EXTRACTOR
 * Module: Henu Voucher OCR
 * 
 * Renders PDF pages to high-resolution HTML5 Canvas / PNG Data URLs
 * for both local OCR processing and UI split-view review.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker source locally
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use local or cdn worker fallback
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface RenderedPdfPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
  hasText: boolean;
  extractedText?: string;
}

export class PdfPageExtractor {
  /**
   * Loads a PDF file and returns its total page count and document handle
   */
  public static async loadPdf(fileOrBuffer: File | Blob | ArrayBuffer | Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
    let data: Uint8Array;
    if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
      const buffer = await fileOrBuffer.arrayBuffer();
      data = new Uint8Array(buffer);
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      data = new Uint8Array(fileOrBuffer);
    } else {
      data = fileOrBuffer;
    }

    const loadingTask = pdfjsLib.getDocument({ data });
    return await loadingTask.promise;
  }

  /**
   * Renders a specific page of a PDF document to an HTML5 Canvas and Data URL
   */
  public static async renderPage(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    scale: number = 2.0 // 2.0 provides ~144 DPI for crisp OCR
  ): Promise<RenderedPdfPage> {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context for PDF rendering');

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;

    // Check if the page has embedded text
    let hasText = false;
    let extractedText = '';
    try {
      const textContent = await page.getTextContent();
      if (textContent && textContent.items && textContent.items.length > 0) {
        extractedText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        if (extractedText.length > 20) {
          hasText = true;
        }
      }
    } catch {
      // Direct text extraction error, continue with image OCR
    }

    const dataUrl = canvas.toDataURL('image/png');

    return {
      pageNumber,
      canvas,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      hasText,
      extractedText,
    };
  }
}
