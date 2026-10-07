/**
 * HENU IDF — LOCAL IMAGE TO PDF GENERATOR
 * Module: HENU IDF
 * 
 * 100% Local Browser/Client PDF Generation using pdf-lib.
 * No APIs, No Cloud, No Remote Servers, No AI, No USB requirements.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import { IdfImageItem, IdfPdfSettings, PageSize, Orientation, ImageFit, MarginSize, GenerationProgress, GeneratedPdfResult } from '../types';

// Standard Page Dimensions in Points (72 DPI)
const PAGE_DIMENSIONS: Record<Exclude<PageSize, 'Original'>, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  Letter: [612.00, 792.00],
  Legal: [612.00, 1008.00],
};

const MARGIN_POINTS: Record<MarginSize, number> = {
  None: 0,
  Small: 18,   // 0.25 in
  Medium: 36,  // 0.50 in
  Large: 54,   // 0.75 in
};

export class IdfPdfGenerator {
  /**
   * Generates a valid multi-page PDF locally from the provided list of images.
   */
  public static async generatePdf(
    images: IdfImageItem[],
    settings: IdfPdfSettings,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<GeneratedPdfResult> {
    if (!images || images.length === 0) {
      throw new Error('Please upload at least one image.');
    }

    onProgress?.({
      current: 0,
      total: images.length,
      phase: 'reading',
      message: 'Initializing local PDF engine...',
    });

    const pdfDoc = await PDFDocument.create();

    // Set PDF Document Metadata
    pdfDoc.setTitle(settings.fileName || 'HENU_IDF');
    pdfDoc.setAuthor('HENU IDF — Local Image to PDF');
    pdfDoc.setCreator('HENU OS Local Engine');
    pdfDoc.setProducer('HENU IDF (100% Offline)');
    pdfDoc.setCreationDate(new Date());

    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      const pageIndex = i + 1;

      onProgress?.({
        current: pageIndex,
        total: images.length,
        phase: 'processing',
        message: `Processing image ${pageIndex} of ${images.length}: ${item.name}`,
      });

      // 1. Obtain image data bytes (applying rotation if user specified)
      const { bytes, format, effectiveWidth, effectiveHeight } = await this.prepareImageBytes(item);

      // 2. Embed Image into PDF
      let pdfImage;
      if (format === 'png') {
        pdfImage = await pdfDoc.embedPng(bytes);
      } else {
        pdfImage = await pdfDoc.embedJpg(bytes);
      }

      // 3. Compute Page Dimensions & Orientation
      const [pageWidth, pageHeight] = this.calculatePageDimensions(
        effectiveWidth,
        effectiveHeight,
        settings.pageSize,
        settings.orientation
      );

      // 4. Create and Add Page
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // 5. Compute Margins and Layout
      const margin = MARGIN_POINTS[settings.margins] || 0;
      const availWidth = Math.max(1, pageWidth - (margin * 2));
      const availHeight = Math.max(1, pageHeight - (margin * 2));

      const { drawWidth, drawHeight, x, y } = this.calculateImagePlacement(
        effectiveWidth,
        effectiveHeight,
        availWidth,
        availHeight,
        margin,
        settings.imageFit
      );

      // 6. Draw Image onto Page
      page.drawImage(pdfImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });
    }

    onProgress?.({
      current: images.length,
      total: images.length,
      phase: 'assembling',
      message: 'Assembling and saving PDF binary...',
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Sanitize and format filename
    let cleanName = (settings.fileName || 'HENU_IDF').trim();
    cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');
    if (!cleanName.toLowerCase().endsWith('.pdf')) {
      cleanName += '.pdf';
    }

    const result: GeneratedPdfResult = {
      blob: pdfBlob,
      url: pdfUrl,
      fileName: cleanName,
      pageCount: images.length,
      fileSize: pdfBytes.length,
      generatedAt: new Date().toISOString(),
    };

    onProgress?.({
      current: images.length,
      total: images.length,
      phase: 'completed',
      message: 'PDF Generated Successfully',
    });

    return result;
  }

  /**
   * Prepares raw or rotated image bytes.
   */
  private static async prepareImageBytes(item: IdfImageItem): Promise<{
    bytes: Uint8Array;
    format: 'jpg' | 'png';
    effectiveWidth: number;
    effectiveHeight: number;
  }> {
    const isPng = item.type === 'image/png' || item.name.toLowerCase().endsWith('.png');

    // If no rotation needed, read file array buffer directly for 100% loss-free quality
    if (!item.rotation || item.rotation === 0) {
      const buffer = await item.file.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        format: isPng ? 'png' : 'jpg',
        effectiveWidth: item.width || 800,
        effectiveHeight: item.height || 600,
      };
    }

    // If rotation is present, render onto an offscreen canvas to produce accurately rotated bitmap
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const rot = (item.rotation % 360 + 360) % 360;
          const isSwap = rot === 90 || rot === 270;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Failed to create 2D canvas for rotation');
          }

          canvas.width = isSwap ? img.height : img.width;
          canvas.height = isSwap ? img.width : img.height;

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();

          const mimeType = isPng ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error('Failed to convert canvas to image blob'));
                return;
              }
              blob.arrayBuffer().then(buf => {
                resolve({
                  bytes: new Uint8Array(buf),
                  format: isPng ? 'png' : 'jpg',
                  effectiveWidth: canvas.width,
                  effectiveHeight: canvas.height,
                });
              });
            },
            mimeType,
            0.98 // High quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${item.name}`));
      img.src = item.objectUrl;
    });
  }

  /**
   * Calculates the target page size [width, height] in points based on settings.
   */
  private static calculatePageDimensions(
    imgW: number,
    imgH: number,
    pageSize: PageSize,
    orientation: Orientation
  ): [number, number] {
    if (pageSize === 'Original') {
      // 1 pixel = 1 point roughly at 72 DPI
      return [imgW, imgH];
    }

    const base = PAGE_DIMENSIONS[pageSize] || PAGE_DIMENSIONS.A4;
    const [dimShort, dimLong] = [Math.min(base[0], base[1]), Math.max(base[0], base[1])];

    if (orientation === 'Auto') {
      if (imgW > imgH) {
        return [dimLong, dimShort]; // Landscape
      } else {
        return [dimShort, dimLong]; // Portrait
      }
    } else if (orientation === 'Landscape') {
      return [dimLong, dimShort];
    } else {
      return [dimShort, dimLong];
    }
  }

  /**
   * Calculates positioning and scaling of the image within the printable area.
   */
  private static calculateImagePlacement(
    imgW: number,
    imgH: number,
    availW: number,
    availH: number,
    margin: number,
    fit: ImageFit
  ): { drawWidth: number; drawHeight: number; x: number; y: number } {
    let drawWidth = imgW;
    let drawHeight = imgH;

    if (fit === 'Fit') {
      // Scale proportionally to fit inside available box
      const scale = Math.min(availW / imgW, availH / imgH);
      drawWidth = imgW * scale;
      drawHeight = imgH * scale;
    } else if (fit === 'Fill') {
      // Scale proportionally to fill available box (may clip overflow if larger)
      const scale = Math.max(availW / imgW, availH / imgH);
      drawWidth = imgW * scale;
      drawHeight = imgH * scale;
    } else if (fit === 'Original') {
      // Original proportions: if larger than box, scale down to fit; otherwise keep 1:1
      if (imgW > availW || imgH > availH) {
        const scale = Math.min(availW / imgW, availH / imgH);
        drawWidth = imgW * scale;
        drawHeight = imgH * scale;
      }
    }

    // Center image in the available region
    const x = margin + (availW - drawWidth) / 2;
    const y = margin + (availH - drawHeight) / 2;

    return { drawWidth, drawHeight, x, y };
  }
}
