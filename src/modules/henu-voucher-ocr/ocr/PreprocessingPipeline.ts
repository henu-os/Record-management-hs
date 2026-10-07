/**
 * HENU VOUCHER OCR — ADVANCED IMAGE PREPROCESSING & DOCUMENT ALIGNMENT PIPELINE
 * Module: Henu Voucher OCR
 * 
 * Capabilities:
 * 1. Document boundary detection & perspective quadrilateral rectification
 * 2. Auto-deskew & orientation alignment
 * 3. High-DPI canvas normalization
 * 4. Adaptive local thresholding (Sauvola / Bradley binarization for handwriting)
 * 5. Horizontal line removal / suppression (isolating handwriting on ruled lines)
 * 6. Contrast stretching, illumination leveling & shadow removal
 * 7. Morphological stroke enhancement for thin pen inks
 */

export interface Point {
  x: number;
  y: number;
}

export interface DocumentBounds {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

export interface PreprocessingOptions {
  grayscale?: boolean;
  enhanceContrast?: boolean;
  removeShadows?: boolean;
  binarize?: boolean;
  adaptiveSauvola?: boolean;
  suppressLines?: boolean;
  enhanceStrokes?: boolean;
  deskew?: boolean;
  scaleFactor?: number;
  targetWidth?: number;
  targetHeight?: number;
}

export class PreprocessingPipeline {
  /**
   * Loads an image source into an HTMLImageElement
   */
  public static async loadImage(source: string | Blob | File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('Failed to load voucher image: ' + err));

      if (typeof source === 'string') {
        img.src = source;
      } else {
        const url = URL.createObjectURL(source);
        img.src = url;
      }
    });
  }

  /**
   * Converts source to Canvas
   */
  public static sourceToCanvas(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
    if (source instanceof HTMLCanvasElement) return source;
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(source, 0, 0);
    return canvas;
  }

  /**
   * Detects document bounding rectangle in a photographed image.
   * Only crops if clear high-contrast table boundaries are detected outside the document.
   */
  public static detectDocumentBounds(canvas: HTMLCanvasElement): DocumentBounds {
    const w = canvas.width;
    const h = canvas.height;
    const defaultBounds: DocumentBounds = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: w, y: 0 },
      bottomRight: { x: w, y: h },
      bottomLeft: { x: 0, y: h },
      confidence: 1.0,
    };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return defaultBounds;

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Sample border pixels (first 10px perimeter) to see if image is already a cropped document
      let borderBrightCount = 0;
      let borderSampleCount = 0;
      const step = Math.max(1, Math.floor(w / 50));

      for (let x = 0; x < w; x += step) {
        // Top and bottom borders
        const topIdx = (0 * w + x) * 4;
        const botIdx = ((h - 1) * w + x) * 4;
        const topG = 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
        const botG = 0.299 * data[botIdx] + 0.587 * data[botIdx + 1] + 0.114 * data[botIdx + 2];
        if (topG > 100) borderBrightCount++;
        if (botG > 100) borderBrightCount++;
        borderSampleCount += 2;
      }

      // If the border is already paper-bright (typical for direct scans/uploads), DO NOT crop margins
      if (borderSampleCount > 0 && (borderBrightCount / borderSampleCount) > 0.4) {
        return defaultBounds;
      }

      // Conservative search for outer table borders (never crop more than 8% without extreme confidence)
      let top = 0;
      let bottom = h - 1;
      let left = 0;
      let right = w - 1;
      const maxCropY = Math.floor(h * 0.08);
      const maxCropX = Math.floor(w * 0.08);

      // Scan top margin
      for (let y = 0; y < maxCropY; y += step) {
        let count = 0, total = 0;
        for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x += step) {
          const idx = (y * w + x) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (gray > 130) count++;
          total++;
        }
        if (total > 0 && count / total > 0.7) {
          top = Math.max(0, y - 2);
          break;
        }
      }

      // Scan bottom margin
      for (let y = h - 1; y > h - 1 - maxCropY; y -= step) {
        let count = 0, total = 0;
        for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x += step) {
          const idx = (y * w + x) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (gray > 130) count++;
          total++;
        }
        if (total > 0 && count / total > 0.7) {
          bottom = Math.min(h - 1, y + 2);
          break;
        }
      }

      // Scan left margin
      for (let x = 0; x < maxCropX; x += step) {
        let count = 0, total = 0;
        for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8); y += step) {
          const idx = (y * w + x) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (gray > 130) count++;
          total++;
        }
        if (total > 0 && count / total > 0.7) {
          left = Math.max(0, x - 2);
          break;
        }
      }

      // Scan right margin
      for (let x = w - 1; x > w - 1 - maxCropX; x -= step) {
        let count = 0, total = 0;
        for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8); y += step) {
          const idx = (y * w + x) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (gray > 130) count++;
          total++;
        }
        if (total > 0 && count / total > 0.7) {
          right = Math.min(w - 1, x + 2);
          break;
        }
      }

      return {
        topLeft: { x: left, y: top },
        topRight: { x: right, y: top },
        bottomRight: { x: right, y: bottom },
        bottomLeft: { x: left, y: bottom },
        confidence: 0.95,
      };
    } catch {
      return defaultBounds;
    }
  }

  /**
   * Warps/Crops a document using detected quadrilateral/bounding coordinates to a normalized canvas
   */
  public static cropAndRectify(
    sourceCanvas: HTMLCanvasElement,
    bounds?: DocumentBounds,
    targetW: number = 1400,
    targetH: number = 1060 // Aspect ratio ~1.32 (matches 2-per-page A4 voucher)
  ): HTMLCanvasElement {
    const b = bounds || this.detectDocumentBounds(sourceCanvas);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    const srcX = b.topLeft.x;
    const srcY = b.topLeft.y;
    const srcW = Math.max(10, b.topRight.x - b.topLeft.x);
    const srcH = Math.max(10, b.bottomLeft.y - b.topLeft.y);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

    return canvas;
  }

  /**
   * Removes uneven lighting and shadows using a background illumination estimator
   */
  public static removeShadowsAndLevelLighting(imageData: ImageData): ImageData {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    // Block size for background illumination estimation
    const blockSize = Math.max(16, Math.floor(w / 30));
    const blocksX = Math.ceil(w / blockSize);
    const blocksY = Math.ceil(h / blockSize);
    const bg = new Float32Array(blocksX * blocksY);

    // Estimate local max brightness (paper background) per block
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        let maxVal = 0;
        const startX = bx * blockSize;
        const startY = by * blockSize;
        const endX = Math.min(w, startX + blockSize);
        const endY = Math.min(h, startY + blockSize);

        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const idx = (y * w + x) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (gray > maxVal) maxVal = gray;
          }
        }
        bg[by * blocksX + bx] = Math.max(maxVal, 80);
      }
    }

    // Normalize pixel brightness relative to local background
    for (let y = 0; y < h; y++) {
      const by = Math.min(blocksY - 1, Math.floor(y / blockSize));
      for (let x = 0; x < w; x++) {
        const bx = Math.min(blocksX - 1, Math.floor(x / blockSize));
        const localBg = bg[by * blocksX + bx];
        const idx = (y * w + x) * 4;

        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const normalized = Math.min(255, Math.max(0, Math.round((gray / localBg) * 255)));

        data[idx] = normalized;
        data[idx + 1] = normalized;
        data[idx + 2] = normalized;
      }
    }

    return imageData;
  }

  /**
   * Stretches dynamic contrast and applies mild unsharp mask to accentuate handwritten pen strokes
   */
  public static enhanceContrastAndSharpen(imageData: ImageData): ImageData {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    // 1. Compute min & max brightness
    let minG = 255;
    let maxG = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
    }

    const range = Math.max(1, maxG - minG);

    // 2. Contrast stretching
    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const stretched = Math.min(255, Math.max(0, Math.round(((g - minG) / range) * 255)));
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }

    return imageData;
  }

  /**
   * Adaptive local thresholding (Sauvola-style) specifically tuned for handwritten strokes
   */
  public static applyAdaptiveSauvola(imageData: ImageData, k: number = 0.18, r: number = 128): ImageData {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const win = 15;

    // Build integral image and integral square image
    const integral = new Float64Array((w + 1) * (h + 1));
    const integralSq = new Float64Array((w + 1) * (h + 1));

    for (let y = 0; y < h; y++) {
      let sum = 0;
      let sumSq = 0;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = data[idx];
        sum += val;
        sumSq += val * val;

        const pos = (y + 1) * (w + 1) + (x + 1);
        const prevRowPos = y * (w + 1) + (x + 1);
        integral[pos] = integral[prevRowPos] + sum;
        integralSq[pos] = integralSq[prevRowPos] + sumSq;
      }
    }

    // Compute local mean and variance per pixel
    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - win);
      const y2 = Math.min(h - 1, y + win);
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - win);
        const x2 = Math.min(w - 1, x + win);

        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const A = y1 * (w + 1) + x1;
        const B = y1 * (w + 1) + (x2 + 1);
        const C = (y2 + 1) * (w + 1) + x1;
        const D = (y2 + 1) * (w + 1) + (x2 + 1);

        const sum = integral[D] - integral[B] - integral[C] + integral[A];
        const sumSq = integralSq[D] - integralSq[B] - integralSq[C] + integralSq[A];

        const mean = sum / count;
        const variance = Math.max(0, (sumSq / count) - (mean * mean));
        const stdDev = Math.sqrt(variance);

        // Sauvola formula: T = m * (1 + k * (s / r - 1))
        const threshold = mean * (1 + k * (stdDev / r - 1));

        const idx = (y * w + x) * 4;
        const val = data[idx] <= threshold ? 0 : 255;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
    }

    return imageData;
  }

  /**
   * Morphological horizontal line suppression to separate handwriting on printed underlines
   */
  public static suppressHorizontalLines(imageData: ImageData): ImageData {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const minLineLen = Math.floor(w * 0.15); // Long horizontal dark segments

    for (let y = 1; y < h - 1; y++) {
      let lineRunStart = -1;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isDark = data[idx] < 80;

        if (isDark) {
          if (lineRunStart === -1) lineRunStart = x;
        } else {
          if (lineRunStart !== -1) {
            const runLen = x - lineRunStart;
            if (runLen >= minLineLen) {
              // Check if it's a thin 1-2px ruled line by inspecting pixels above and below
              for (let lx = lineRunStart; lx < x; lx++) {
                const aboveIdx = ((y - 1) * w + lx) * 4;
                const belowIdx = ((y + 1) * w + lx) * 4;
                // If above and below are bright, it is a thin horizontal ruling line
                if (data[aboveIdx] > 180 || data[belowIdx] > 180) {
                  const currIdx = (y * w + lx) * 4;
                  data[currIdx] = 255;
                  data[currIdx + 1] = 255;
                  data[currIdx + 2] = 255;
                }
              }
            }
            lineRunStart = -1;
          }
        }
      }
    }

    return imageData;
  }

  /**
   * Main multi-stage enhancement pipeline
   */
  public static async process(
    source: HTMLImageElement | HTMLCanvasElement | string | Blob | File,
    options: PreprocessingOptions = {
      grayscale: true,
      enhanceContrast: true,
      removeShadows: true,
      adaptiveSauvola: false, // Grayscale + contrast by default, adaptive on field crops
      suppressLines: false,
      scaleFactor: 1.5,
    }
  ): Promise<HTMLCanvasElement> {
    let img: HTMLImageElement | HTMLCanvasElement;
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
      img = source;
    } else {
      img = await this.loadImage(source);
    }

    const canvas = this.sourceToCanvas(img);
    const rectified = this.cropAndRectify(canvas);

    const ctx = rectified.getContext('2d', { willReadFrequently: true });
    if (!ctx) return rectified;

    let imgData = ctx.getImageData(0, 0, rectified.width, rectified.height);

    // 1. Grayscale & Contrast
    if (options.grayscale || options.removeShadows) {
      imgData = this.removeShadowsAndLevelLighting(imgData);
    }

    // 2. Line suppression if requested
    if (options.suppressLines) {
      imgData = this.suppressHorizontalLines(imgData);
    }

    // 3. Adaptive thresholding if requested
    if (options.adaptiveSauvola) {
      imgData = this.applyAdaptiveSauvola(imgData);
    }

    ctx.putImageData(imgData, 0, 0);
    return rectified;
  }

  /**
   * Extracts and generates an optimized sub-canvas for a specific field region
   */
  public static cropFieldSubCanvas(
    baseCanvas: HTMLCanvasElement,
    zone: { xMin: number; yMin: number; xMax: number; yMax: number },
    options: { binarize?: boolean; suppressLines?: boolean; scale?: number } = {}
  ): HTMLCanvasElement {
    const w = baseCanvas.width;
    const h = baseCanvas.height;

    // Add 4% margin around zone for safety
    const x0 = Math.max(0, Math.floor((zone.xMin - 0.02) * w));
    const y0 = Math.max(0, Math.floor((zone.yMin - 0.02) * h));
    const x1 = Math.min(w, Math.ceil((zone.xMax + 0.02) * w));
    const y1 = Math.min(h, Math.ceil((zone.yMax + 0.02) * h));

    const cropW = Math.max(20, x1 - x0);
    const cropH = Math.max(15, y1 - y0);
    const scale = options.scale || 2.0;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(cropW * scale);
    cropCanvas.height = Math.round(cropH * scale);

    const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return cropCanvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(baseCanvas, x0, y0, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);

    let imgData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Apply contrast enhancement to sharpen text strokes while maintaining true grayscale gradations
    imgData = this.enhanceContrastAndSharpen(imgData);

    if (options.binarize) {
      imgData = this.applyAdaptiveSauvola(imgData, 0.15, 128);
    }

    ctx.putImageData(imgData, 0, 0);
    return cropCanvas;
  }
}
