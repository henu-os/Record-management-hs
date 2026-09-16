// ============================================================
// HENU OS — PDF Document Builder (Legal Paper, Excel-Faithful)
// Reusable template engine for all 7 form renderers.
// All geometry in PDF points (1 inch = 72 points).
// ============================================================

import 'regenerator-runtime/runtime';
import * as fs from 'fs';
import * as path from 'path';
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
  Color,
  degrees,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { SocietyMaster } from '../../types';

export type Alignment = 'left' | 'center' | 'right';

export interface ColumnDef {
  id: string;
  header: string;
  width: number;
  align?: Alignment;
  fontSize?: number;
}

export interface CellDef {
  text: string;
  width: number;
  align?: Alignment;
  fontSize?: number;
  bold?: boolean;
  color?: Color | string;
}

// ── Utility ───────────────────────────────────────────────────
export function hexToRgb(hex?: string, defaultRgb: any = rgb(0, 0, 0)): Color {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return defaultRgb;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return defaultRgb;
  return rgb(r, g, b);
}

// ── WinAnsi Sanitization Wrapper ──────────────────────────────
export function sanitizeWinAnsi(text: any): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n\t\x00-\x1F\x7F-\x9F]/g, ' ') // replace control chars, newlines, tabs with space
    .replace(/₹/g, 'Rs. ')
    .replace(/[\u2013\u2014\u2212\u2015]/g, '-') // en-dash, em-dash, math minus
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"') // smart double quotes
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'") // smart single quotes
    .replace(/\u2026/g, '...')                   // horizontal ellipsis
    .replace(/[\u2022\u25cf\u25cb\u25aa\u25ab]/g, '-') // bullets
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ') // non-breaking spaces
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/g, ' ');
}

export function wrapPdfDocumentForWinAnsi(doc: PDFDocument): PDFDocument {
  const originalAddPage = doc.addPage.bind(doc);
  doc.addPage = (pageOrSize?: any) => {
    const page = originalAddPage(pageOrSize);
    wrapPage(page);
    return page;
  };

  const originalGetPage = doc.getPage.bind(doc);
  doc.getPage = (index: number) => {
    const page = originalGetPage(index);
    wrapPage(page);
    return page;
  };

  const originalEmbedFont = doc.embedFont.bind(doc);
  doc.embedFont = async (font: any, options?: any) => {
    const pdfFont = await originalEmbedFont(font, options);
    wrapFont(pdfFont);
    return pdfFont;
  };

  const originalEmbedStandardFont = (doc as any).embedStandardFont?.bind(doc);
  if (originalEmbedStandardFont) {
    (doc as any).embedStandardFont = (font: any, options?: any) => {
      const pdfFont = originalEmbedStandardFont(font, options);
      wrapFont(pdfFont);
      return pdfFont;
    };
  }

  try {
    doc.getPages().forEach(wrapPage);
  } catch {}

  return doc;

  function wrapPage(page: any) {
    if (!page || page._wrappedForWinAnsi) return;
    page._wrappedForWinAnsi = true;
    const originalDrawText = page.drawText.bind(page);
    page.drawText = (text: string, options?: any) => {
      const sanitized = sanitizeWinAnsi(text);
      return originalDrawText(sanitized, options);
    };
  }

  function wrapFont(font: any) {
    if (!font || font._wrappedForWinAnsi) return;
    font._wrappedForWinAnsi = true;
    const originalWidthOfTextAtSize = font.widthOfTextAtSize.bind(font);
    font.widthOfTextAtSize = (text: string, size: number) => {
      const sanitized = sanitizeWinAnsi(text);
      return originalWidthOfTextAtSize(sanitized, size);
    };
  }
}

// ── Excel-Faithful Color System ───────────────────────────────
// Matches the supplied Excel workbook exactly.
// Header cell fills: #D9E1F2 (light steel blue)
// Section bar fills: #EDEDED (light gray) for loan section headers
// Sub-header fills:  #EEF2F7 (pale blue-gray) for "PARTICULARS OF..." bars in Form I
// Text:              #000000 (black) for body, #1C355E (dark navy) for headers/labels
// Borders:           #8EA9DB (medium blue) thin lines
// Background:        #FFFFFF (white paper)

export const COLOR_HEADER_BG     = rgb(217 / 255, 225 / 255, 242 / 255);  // #D9E1F2
export const COLOR_SECTION_BG    = rgb(237 / 255, 237 / 255, 237 / 255);  // #EDEDED
export const COLOR_SUBSECTION_BG = rgb(238 / 255, 242 / 255, 247 / 255);  // #EEF2F7
export const COLOR_HEADER_TEXT   = rgb(28 / 255, 53 / 255, 94 / 255);     // #1C355E (dark navy)
export const COLOR_BODY_TEXT     = rgb(0, 0, 0);                           // #000000
export const COLOR_BORDER        = rgb(142 / 255, 169 / 255, 219 / 255);  // #8EA9DB
export const COLOR_WHITE         = rgb(1, 1, 1);                          // #FFFFFF
export const COLOR_LABEL_TEXT    = rgb(28 / 255, 53 / 255, 94 / 255);     // #1C355E
// Navy section bars: dark navy bg (#1C355E) + white text — matches approved reference images
export const COLOR_NAVY_BG       = rgb(28 / 255, 53 / 255, 94 / 255);     // #1C355E
export const COLOR_WHITE_TEXT    = rgb(1, 1, 1);                           // #FFFFFF

// Legacy aliases for backward compatibility
export const COLOR_PRIMARY       = COLOR_HEADER_TEXT;
export const COLOR_SECONDARY     = COLOR_HEADER_TEXT;
export const COLOR_BACKGROUND    = COLOR_HEADER_BG;
export const COLOR_ACCENT        = COLOR_HEADER_TEXT;
export const COLOR_TEXT          = COLOR_BODY_TEXT;
export const COLOR_PAGE_NUMBER   = COLOR_HEADER_TEXT;

// ── Legal Paper Dimensions (in points) ────────────────────────
// 8.5 × 14 inches = 612 × 1008 points
const LEGAL_WIDTH  = 612;
const LEGAL_HEIGHT = 1008;

// Hard-binding margins: 0.75 inches = 54 points on all sides
// Portrait usable: 7.0" × 12.5" = 504 × 900 pt
// Landscape usable: 12.5" × 7.0" = 900 × 504 pt
const SAFE_MARGIN = 54;

export interface PdfSettingsOptions {
  colorMode?: 'Color' | 'BW';
  fontFamily?: 'Helvetica' | 'Times-Roman' | 'Courier' | 'Helvetica-Bold' | string;
  fontSize?: number;        // Bounds: 7 to 12 pt
  headerFontSize?: number;  // Bounds: 8 to 14 pt
  bodyFontSize?: number;    // Bounds: 6 to 10 pt
  bold?: boolean;
  italic?: boolean;
  textWrapping?: boolean;
  textRotation?: 0 | 90 | 180 | 270;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textColor?: string;
  headerBgColor?: string;
  headerFill?: string;
  headerTextColor?: string;
  cellBgColor?: string;
  cellFill?: string;
  borderColor?: string;
  gridColor?: string;
  gridOpacity?: number;     // 0 to 100%
  gridThickness?: number;   // 0.25 to 1.00 pt
  gridOn?: boolean;
  pageNumberAlign?: 'left' | 'center' | 'right';
  pageNumberPrefix?: string;
  brandingText?: string;
  brandingAlign?: 'left' | 'center' | 'right';
  customFooterText?: string;
  customFooterAlign?: 'left' | 'center' | 'right';
  logoOffsetX?: number;
  logoOffsetY?: number;
  logoSize?: number;
}

export interface PageSetupOptions {
  orientation: 'Portrait' | 'Landscape';
  title: string;
  society: SocietyMaster | null;
  settings?: PdfSettingsOptions;
  renderMode?: 'Color' | 'BW';
  gridOn?: boolean;
}

export interface HeaderGroupDef {
  header: string;
  columns: ColumnDef[];
}

export class PdfDocumentBuilder {
  doc!: PDFDocument;
  font!: PDFFont;
  boldFont!: PDFFont;
  currentPage!: PDFPage;

  orientation: 'Portrait' | 'Landscape' = 'Portrait';
  pageWidth: number = LEGAL_WIDTH;
  pageHeight: number = LEGAL_HEIGHT;

  marginLeft: number = SAFE_MARGIN;
  marginRight: number = SAFE_MARGIN;
  marginTop: number = SAFE_MARGIN;
  marginBottom: number = SAFE_MARGIN;

  currentY: number = 0;
  title: string = '';
  society: SocietyMaster | null = null;
  embeddedLogo?: any;
  pageCount: number = 0;
  renderMode: 'Color' | 'BW' = 'Color';
  gridOn: boolean = true;

  // Prompt 01 Form Design Settings Overrides
  headerFontSize: number = 11;
  bodyFontSize: number = 7.5;
  boldText: boolean = false;
  italicText: boolean = false;
  textWrapping: boolean = true;
  textRotation: 0 | 90 | 180 | 270 = 0;
  horizontalAlign: 'left' | 'center' | 'right' = 'center';
  verticalAlign: 'top' | 'middle' | 'bottom' = 'middle';

  gridOpacity: number = 100;
  gridThickness: number = 0.5;
  customHeaderBg?: Color;
  customHeaderTextColor?: Color;
  customCellBg?: Color;
  customBorderColor?: Color;
  customGridColor?: Color;
  customTextColor?: Color;

  pageNumberAlign: 'left' | 'center' | 'right' = 'center';
  pageNumberPrefix: string = '';
  brandingText: string = 'HENU OS - Records Management';
  brandingAlign: 'left' | 'center' | 'right' = 'right';
  customFooterText: string = '';
  customFooterAlign: 'left' | 'center' | 'right' = 'left';

  logoOffsetX: number = 0;
  logoOffsetY: number = 0;
  logoSize: number = 44;

  get headerBg() {
    if (this.renderMode === 'BW') return rgb(240 / 255, 240 / 255, 240 / 255);
    return this.customHeaderBg || COLOR_HEADER_BG;
  }
  get headerText() {
    if (this.renderMode === 'BW') return rgb(0, 0, 0);
    return this.customHeaderTextColor || COLOR_HEADER_TEXT;
  }
  get borderColor() {
    if (this.renderMode === 'BW') return rgb(0, 0, 0);
    return this.customBorderColor || COLOR_BORDER;
  }
  get navyBg() {
    if (this.renderMode === 'BW') return rgb(50 / 255, 50 / 255, 50 / 255);
    return COLOR_NAVY_BG;
  }
  get cellBg() {
    if (this.renderMode === 'BW') return COLOR_WHITE;
    return this.customCellBg || COLOR_WHITE;
  }
  get bodyTextColor() {
    if (this.renderMode === 'BW') return rgb(0, 0, 0);
    return this.customTextColor || COLOR_BODY_TEXT;
  }
  get gridLineColor(): Color {
    const opacity = Math.max(0, Math.min(100, this.gridOpacity)) / 100;
    if (this.renderMode === 'BW') {
      const baseBW = 0.3 * opacity + 1.0 * (1 - opacity);
      return rgb(baseBW, baseBW, baseBW);
    }
    const baseRgb = this.customGridColor || this.customBorderColor || COLOR_BORDER;
    const r = (baseRgb as any).r !== undefined ? (baseRgb as any).r : 0.557;
    const g = (baseRgb as any).g !== undefined ? (baseRgb as any).g : 0.663;
    const b = (baseRgb as any).b !== undefined ? (baseRgb as any).b : 0.859;
    const blendedR = r * opacity + 1.0 * (1 - opacity);
    const blendedG = g * opacity + 1.0 * (1 - opacity);
    const blendedB = b * opacity + 1.0 * (1 - opacity);
    return rgb(blendedR, blendedG, blendedB);
  }

  // Usable content width (page minus margins)
  get contentWidth(): number {
    return this.pageWidth - this.marginLeft - this.marginRight;
  }

  static async create(opts: PageSetupOptions): Promise<PdfDocumentBuilder> {
    const builder = new PdfDocumentBuilder();
    builder.doc = wrapPdfDocumentForWinAnsi(await PDFDocument.create());
    builder.doc.registerFontkit(fontkit);

    const rawFont = opts.settings?.fontFamily || (opts as any).fontFamily || 'Times-Roman';
    const fontName = String(rawFont).toLowerCase();

    let customFont: PDFFont | undefined;
    let customBoldFont: PDFFont | undefined;

    if (fontName.includes('indie')) {
      if (typeof window === 'undefined' && fs && path) {
        const candidates = [
          path.join(process.cwd(), 'Indie_Flower,Merriweather', 'Indie_Flower', 'IndieFlower-Regular.ttf'),
          path.join(process.cwd(), 'public', 'fonts', 'IndieFlower-Regular.ttf'),
          path.join(process.cwd(), 'src', 'assets', 'fonts', 'IndieFlower-Regular.ttf'),
          path.join(__dirname, 'IndieFlower-Regular.ttf'),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            try {
              customFont = await builder.doc.embedFont(fs.readFileSync(p));
              customBoldFont = customFont;
              break;
            } catch (e) {}
          }
        }
      } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
          const res = await fetch('/fonts/IndieFlower-Regular.ttf');
          if (res.ok) {
            const buf = await res.arrayBuffer();
            customFont = await builder.doc.embedFont(new Uint8Array(buf));
            customBoldFont = customFont;
          }
        } catch (e) {}
      }
    } else if (fontName.includes('merriweather')) {
      if (typeof window === 'undefined' && fs && path) {
        const regCandidates = [
          path.join(process.cwd(), 'Indie_Flower,Merriweather', 'Merriweather', 'static', 'Merriweather_24pt-Regular.ttf'),
          path.join(process.cwd(), 'public', 'fonts', 'Merriweather-Regular.ttf'),
          path.join(process.cwd(), 'src', 'assets', 'fonts', 'Merriweather-Regular.ttf'),
          path.join(__dirname, 'Merriweather-Regular.ttf'),
        ];
        const boldCandidates = [
          path.join(process.cwd(), 'Indie_Flower,Merriweather', 'Merriweather', 'static', 'Merriweather_24pt-Bold.ttf'),
          path.join(process.cwd(), 'public', 'fonts', 'Merriweather-Bold.ttf'),
          path.join(process.cwd(), 'src', 'assets', 'fonts', 'Merriweather-Bold.ttf'),
          path.join(__dirname, 'Merriweather-Bold.ttf'),
        ];
        for (const p of regCandidates) {
          if (fs.existsSync(p)) {
            try {
              customFont = await builder.doc.embedFont(fs.readFileSync(p));
              break;
            } catch (e) {}
          }
        }
        for (const p of boldCandidates) {
          if (fs.existsSync(p)) {
            try {
              customBoldFont = await builder.doc.embedFont(fs.readFileSync(p));
              break;
            } catch (e) {}
          }
        }
      } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
          const regRes = await fetch('/fonts/Merriweather-Regular.ttf');
          if (regRes.ok) {
            const buf = await regRes.arrayBuffer();
            customFont = await builder.doc.embedFont(new Uint8Array(buf));
          }
          const boldRes = await fetch('/fonts/Merriweather-Bold.ttf');
          if (boldRes.ok) {
            const buf = await boldRes.arrayBuffer();
            customBoldFont = await builder.doc.embedFont(new Uint8Array(buf));
          }
        } catch (e) {}
      }
    }

    if (customFont) {
      builder.font = customFont;
      builder.boldFont = customBoldFont || customFont;
    } else if (fontName === 'courier') {
      builder.font = await builder.doc.embedFont(StandardFonts.Courier);
      builder.boldFont = await builder.doc.embedFont(StandardFonts.CourierBold);
    } else if (fontName === 'helvetica-bold') {
      builder.font = await builder.doc.embedFont(StandardFonts.HelveticaBold);
      builder.boldFont = await builder.doc.embedFont(StandardFonts.HelveticaBold);
    } else if (fontName === 'helvetica') {
      builder.font = await builder.doc.embedFont(StandardFonts.Helvetica);
      builder.boldFont = await builder.doc.embedFont(StandardFonts.HelveticaBold);
    } else {
      // Default: Times-Roman (Classic Serif Standard)
      builder.font = await builder.doc.embedFont(StandardFonts.TimesRoman);
      builder.boldFont = await builder.doc.embedFont(StandardFonts.TimesRomanBold);
    }

    builder.orientation = opts.orientation;
    builder.renderMode = opts.settings?.colorMode || opts.renderMode || 'Color';
    builder.gridOn = opts.gridOn !== undefined ? opts.gridOn : (opts.settings?.gridOn !== undefined ? opts.settings.gridOn : true);

    // Apply & Clamp Font Size Settings (Template Safety Limits: 7-12 body, 8-14 header)
    if (opts.settings?.headerFontSize !== undefined) {
      builder.headerFontSize = Math.min(14, Math.max(8, opts.settings.headerFontSize));
    }
    if (opts.settings?.fontSize !== undefined) {
      builder.bodyFontSize = Math.min(12, Math.max(7, opts.settings.fontSize));
    } else if (opts.settings?.bodyFontSize !== undefined) {
      builder.bodyFontSize = Math.min(12, Math.max(7, opts.settings.bodyFontSize));
    }

    // Apply Typography & Alignment Settings
    if (opts.settings?.bold !== undefined) builder.boldText = Boolean(opts.settings.bold);
    if (opts.settings?.italic !== undefined) builder.italicText = Boolean(opts.settings.italic);
    if (opts.settings?.textWrapping !== undefined) builder.textWrapping = Boolean(opts.settings.textWrapping);
    if (opts.settings?.textRotation !== undefined) builder.textRotation = opts.settings.textRotation;
    if (opts.settings?.horizontalAlign) builder.horizontalAlign = opts.settings.horizontalAlign;
    if (opts.settings?.verticalAlign) builder.verticalAlign = opts.settings.verticalAlign;

    // Apply Color Theme & Grid Opacity Overrides
    const headerBgHex = opts.settings?.headerBgColor || opts.settings?.headerFill;
    if (headerBgHex) builder.customHeaderBg = hexToRgb(headerBgHex);
    if (opts.settings?.headerTextColor) builder.customHeaderTextColor = hexToRgb(opts.settings.headerTextColor);

    const cellBgHex = opts.settings?.cellBgColor || opts.settings?.cellFill;
    if (cellBgHex) builder.customCellBg = hexToRgb(cellBgHex);

    if (opts.settings?.borderColor) builder.customBorderColor = hexToRgb(opts.settings.borderColor);

    const gridColorHex = opts.settings?.gridColor || opts.settings?.borderColor;
    if (gridColorHex) builder.customGridColor = hexToRgb(gridColorHex);

    if (opts.settings?.textColor) builder.customTextColor = hexToRgb(opts.settings.textColor);
    if (opts.settings?.gridOpacity !== undefined) builder.gridOpacity = Math.min(100, Math.max(0, opts.settings.gridOpacity));
    if (opts.settings?.gridThickness !== undefined) builder.gridThickness = Math.min(1.0, Math.max(0.25, opts.settings.gridThickness));

    // Apply Footer Controls
    if (opts.settings?.pageNumberAlign) builder.pageNumberAlign = opts.settings.pageNumberAlign;
    if (opts.settings?.pageNumberPrefix !== undefined) builder.pageNumberPrefix = opts.settings.pageNumberPrefix;
    if (opts.settings?.brandingText !== undefined) builder.brandingText = opts.settings.brandingText;
    if (opts.settings?.brandingAlign) builder.brandingAlign = opts.settings.brandingAlign;
    if (opts.settings?.customFooterText !== undefined) builder.customFooterText = opts.settings.customFooterText;
    if (opts.settings?.customFooterAlign) builder.customFooterAlign = opts.settings.customFooterAlign;

    // Apply Logo Positioning Settings (Header Box Restrained)
    if (opts.settings?.logoOffsetX !== undefined) builder.logoOffsetX = opts.settings.logoOffsetX;
    if (opts.settings?.logoOffsetY !== undefined) builder.logoOffsetY = opts.settings.logoOffsetY;
    if (opts.settings?.logoSize !== undefined) builder.logoSize = opts.settings.logoSize;

    if (opts.orientation === 'Landscape') {
      builder.pageWidth = LEGAL_HEIGHT;  // 1008
      builder.pageHeight = LEGAL_WIDTH;  // 612
    } else {
      builder.pageWidth = LEGAL_WIDTH;   // 612
      builder.pageHeight = LEGAL_HEIGHT; // 1008
    }

    builder.title = opts.title;
    builder.society = opts.society;

    // Embed Society PNG Logo if provided (square format)
    const logoSource = (opts.society as any)?.logoBase64 || (opts.society as any)?.logo;
    if (logoSource) {
      try {
        const raw = String(logoSource);
        const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
        let buf: Uint8Array;
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
          buf = Buffer.from(b64, 'base64');
        } else {
          const binaryStr = atob(b64);
          buf = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            buf[i] = binaryStr.charCodeAt(i);
          }
        }
        builder.embeddedLogo = await builder.doc.embedPng(buf);
      } catch (e) {
        console.warn('Failed to embed society PNG logo:', e);
      }
    }

    builder.addNewPage();
    return builder;
  }

  addNewPage(): PDFPage {
    this.pageCount++;
    this.currentPage = this.doc.addPage([this.pageWidth, this.pageHeight]);

    // White paper background
    this.currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageWidth,
      height: this.pageHeight,
      color: COLOR_WHITE,
    });

    this.currentY = this.pageHeight - this.marginTop;

    // Draw footer
    this.drawPageFooter();

    return this.currentPage;
  }

  // ── Footer Controls (Prompt 08) ────────────────────────────────
  private drawPageFooter(): void {
    const page = this.currentPage;
    const usableW = this.contentWidth;
    const fontSize = 7;
    const lineY = Math.max(16, this.marginBottom - 10);

    // Thin divider line
    page.drawLine({
      start: { x: this.marginLeft, y: lineY },
      end: { x: this.pageWidth - this.marginRight, y: lineY },
      thickness: 0.5,
      color: this.borderColor,
    });

    const getX = (align: 'left' | 'center' | 'right', textWidth: number) => {
      if (align === 'left') return this.marginLeft;
      if (align === 'right') return this.pageWidth - this.marginRight - textWidth;
      return this.marginLeft + (usableW - textWidth) / 2;
    };

    // 1. Page Number: Positioned Just above the footer line in center
    const pPrefix = this.pageNumberPrefix !== undefined ? this.pageNumberPrefix : '';
    const pageText = `${pPrefix}${this.pageCount}`;
    const pWidth = this.font.widthOfTextAtSize(pageText, fontSize);
    page.drawText(pageText, {
      x: getX(this.pageNumberAlign || 'center', pWidth),
      y: lineY + 3,
      size: fontSize,
      font: this.font,
      color: this.headerText,
    });

    // 2. Application Branding (Positioned below the footer line)
    const brandText = this.brandingText || 'HENU OS - Records Management';
    const bWidth = this.font.widthOfTextAtSize(brandText, fontSize);
    page.drawText(brandText, {
      x: getX(this.brandingAlign || 'right', bWidth),
      y: lineY - 8,
      size: fontSize,
      font: this.font,
      color: this.headerText,
    });

    // 3. Custom Footer Text (Positioned below the footer line)
    if (this.customFooterText) {
      const cWidth = this.font.widthOfTextAtSize(this.customFooterText, fontSize);
      page.drawText(this.customFooterText, {
        x: getX(this.customFooterAlign || 'left', cWidth),
        y: lineY - 8,
        size: fontSize,
        font: this.font,
        color: this.headerText,
      });
    }
  }

  // ── Excel-Style Header Block ─────────────────────  
  drawExcelHeader(formTitle: string, subtitle?: string, actRef?: string): void {
    const page = this.currentPage;
    const headerStartY = this.currentY;
    let y = headerStartY;

    const societyName = (this.society?.societyName || 'HENU OS PVT LTD CO-SOC').toUpperCase();
    const regNo = (this.society?.registrationNo || '').trim();
    const regDate = (this.society?.registrationDate || '').trim();
    const regInfo = (regNo || regDate)
      ? `${regNo || '[REGISTRATION NO.]'}.: ${regDate || '[DATE]'}`
      : '[REGISTRATION NO].: [DATE]';
    const address = this.society?.headerAddress || this.society?.address || '[SOCIETY REGISTERED ADDRESS]';

    const cw = this.contentWidth;
    const font = this.boldText ? this.boldFont : (this.italicText ? this.font : this.font);
    const boldFont = this.boldFont;

    const headSize = 12; // 12 pt for Society Name and Form Title
    const subSize = 8;    // 8 pt for Reg No and Address

    const getX = (textWidth: number) => {
      return this.marginLeft + (cw - textWidth) / 2;
    };

    // LINE 1: Society Registration Name (bold, 12pt)
    const row1H = headSize + 6;
    const s1 = boldFont.widthOfTextAtSize(societyName, headSize);
    page.drawText(societyName, {
      x: getX(s1),
      y: y - headSize - 2,
      size: headSize,
      font: boldFont,
      color: this.headerText,
    });
    y -= row1H;

    // LINE 2: {Society Registration No}.: {Date} (compact format)
    const row2H = subSize + 4;
    const s2 = font.widthOfTextAtSize(regInfo, subSize);
    page.drawText(regInfo, {
      x: getX(s2),
      y: y - subSize - 2,
      size: subSize,
      font: font,
      color: this.bodyTextColor,
    });
    y -= row2H;

    // LINE 3: Society Registered Address (wrapped naturally if long)
    const addrLines = this.wrapText(address, cw - 120, subSize);
    for (const line of addrLines) {
      const row3H = subSize + 3;
      const s3 = font.widthOfTextAtSize(line, subSize);
      page.drawText(line, {
        x: getX(s3),
        y: y - subSize - 2,
        size: subSize,
        font: font,
        color: this.bodyTextColor,
      });
      y -= row3H;
    }

    // Thin separator line before form title
    const topSectionEndY = y - 2;
    const sepH = 5;
    page.drawLine({
      start: { x: this.marginLeft + 12, y: topSectionEndY },
      end:   { x: this.marginLeft + cw - 12, y: topSectionEndY },
      thickness: 0.5,
      color: this.borderColor,
    });
    y -= sepH;

    // Row 4: Form Title — bold, 12pt
    const titleSize = headSize;
    const row4H = titleSize + 5;
    const s4 = boldFont.widthOfTextAtSize(formTitle, titleSize);
    page.drawText(formTitle, {
      x: getX(s4),
      y: y - titleSize - 2,
      size: titleSize,
      font: boldFont,
      color: this.headerText,
    });
    y -= row4H;

    // Optional subtitle (e.g. 'REGISTER OF MEMBERS')
    if (subtitle) {
      const subH = subSize + 4;
      const sw = boldFont.widthOfTextAtSize(subtitle, subSize);
      page.drawText(subtitle, {
        x: getX(sw),
        y: y - subSize - 2,
        size: subSize,
        font: boldFont,
        color: this.headerText,
      });
      y -= subH;
    }

    // Optional act reference (e.g. '[Section 38 (1)...]')
    if (actRef) {
      const arH = subSize + 4;
      const aw = font.widthOfTextAtSize(actRef, subSize - 1);
      page.drawText(actRef, {
        x: getX(aw),
        y: y - (subSize - 1) - 2,
        size: subSize - 1,
        font: font,
        color: this.bodyTextColor,
      });
      y -= arH;
    }

    const headerEndY = y - 4; // small padding below
    const blockHeight = headerStartY - headerEndY;

    // Outer border rectangle around the entire header block
    page.drawRectangle({
      x: this.marginLeft,
      y: headerEndY,
      width: cw,
      height: blockHeight,
      borderColor: this.borderColor,
      borderWidth: 1,
    });

    // Draw Aspect-Ratio Preserved PNG Logo inside the Header Box (No stretching!)
    if (this.embeddedLogo) {
      const origW = this.embeddedLogo.width;
      const origH = this.embeddedLogo.height;
      const topSectionHeight = headerStartY - topSectionEndY;

      // Restrain target box to fit comfortably in the upper society section
      const maxBoxH = Math.min(topSectionHeight - 6, Math.max(16, this.logoSize || 38));
      const maxBoxW = Math.min(100, Math.max(24, maxBoxH * (origW / origH)));

      const scale = Math.min(maxBoxW / origW, maxBoxH / origH);
      const drawW = origW * scale;
      const drawH = origH * scale;

      const minX = this.marginLeft + 4;
      const maxX = this.marginLeft + cw - drawW - 4;
      const logoX = Math.min(maxX, Math.max(minX, this.marginLeft + 12 + (this.logoOffsetX || 0)));

      const minY = topSectionEndY + 2;
      const maxY = headerStartY - drawH - 2;
      const defaultY = topSectionEndY + (topSectionHeight - drawH) / 2;
      const logoY = Math.min(maxY, Math.max(minY, defaultY + (this.logoOffsetY || 0)));

      page.drawImage(this.embeddedLogo, {
        x: logoX,
        y: logoY,
        width: drawW,
        height: drawH,
      });
    }

    this.currentY = headerEndY - 4; // 4pt gap below header border
  }

  // ── Form I Header (Delegates to standardized boxed header block) ──
  drawFormIHeader(): void {
    this.drawExcelHeader(
      'FORM "I"  [See Rule 32 and 65(1)]',
      'REGISTER OF MEMBERS',
      '[Section 38 (1) of the Maharashtra Co-operative Societies Act, 1960]'
    );
  }

  // ── Stacked Fields Row (Label Cell over Value Cell across columns) ─────
  drawStackedFields(
    fields: { label: string; value: string; width: number; align?: 'left' | 'center' | 'right' }[],
    labelHeight = 16,
    valueHeight = 20
  ): void {
    const fs = 7.5;
    let actualValueHeight = valueHeight;

    // Check if any field value requires more height
    for (const f of fields) {
      if (f.value && f.value.trim()) {
        const lines = this.wrapText(f.value, f.width - 6, fs);
        const needed = Math.ceil(lines.length * (fs * 1.15) + 6);
        if (needed > actualValueHeight) {
          actualValueHeight = needed;
        }
      }
    }

    const totalHeight = labelHeight + actualValueHeight;
    this.ensureSpace(totalHeight);
    const y = this.currentY;
    let x = this.marginLeft;

    for (const f of fields) {
      // Top label cell — light blue bg, navy bold centered text
      this.currentPage.drawRectangle({
        x, y: y - labelHeight, width: f.width, height: labelHeight,
        color: this.headerBg, borderColor: this.borderColor, borderWidth: this.gridThickness,
      });

      if (f.label) {
        const lFs = 8.5;
        const lw = this.boldFont.widthOfTextAtSize(f.label, lFs);
        this.currentPage.drawText(f.label, {
          x: x + Math.max(4, (f.width - lw) / 2),
          y: y - labelHeight + (labelHeight - lFs) / 2,
          size: lFs, font: this.boldFont, color: this.headerText,
        });
      }

      // Bottom value cell — white bg, left/center body text (BOLD DATA)
      this.currentPage.drawRectangle({
        x, y: y - labelHeight - actualValueHeight, width: f.width, height: actualValueHeight,
        color: this.cellBg, borderColor: this.borderColor, borderWidth: this.gridThickness,
      });

      if (f.value && f.value.trim()) {
        let valFs = 8.5;
        let lines = this.wrapText(f.value, f.width - 8, valFs, true);
        let lineH = valFs * 1.15;
        let totalH = lines.length * lineH;

        // Auto-scale font size if lines exceed value cell height or width
        const getOverWidth = () => lines.some(l => this.boldFont.widthOfTextAtSize(l, valFs) > f.width - 6);
        while ((totalH > actualValueHeight - 2 || getOverWidth()) && valFs > 5.0) {
          valFs -= 0.4;
          lines = this.wrapText(f.value, f.width - 8, valFs, true);
          lineH = valFs * 1.15;
          totalH = lines.length * lineH;
        }

        const isLeft = f.align === 'left' || f.label.toLowerCase().includes('address') || f.label.toLowerCase().includes('name');
        const startY = y - labelHeight - (actualValueHeight - totalH) / 2 - valFs;
        lines.forEach((line, idx) => {
          const vw = this.boldFont.widthOfTextAtSize(line, valFs);
          const lineY = startY - idx * lineH;
          if (lineY < y - totalHeight + 1) return; // clip guard
          const lineX = isLeft ? (x + 6) : (x + Math.max(2, (f.width - vw) / 2));
          this.currentPage.drawText(line, {
            x: lineX,
            y: lineY,
            size: valFs, font: this.boldFont, color: this.bodyTextColor,
          });
        });
      }

      x += f.width;
    }

    this.currentY -= totalHeight;
  }

  // ── Stacked Full-Width Field (Label Banner over Value Cell) ──────
  drawStackedFullWidthField(label: string, value: string, labelHeight = 16, valueHeight = 22): void {
    const cw = this.contentWidth;
    let actualValueHeight = valueHeight;
    const fs = 7.5;

    if (value && value.trim()) {
      const lines = this.wrapText(value, cw - 6, fs);
      const needed = Math.ceil(lines.length * (fs * 1.15) + 6);
      if (needed > actualValueHeight) {
        actualValueHeight = needed;
      }
    }

    const totalHeight = labelHeight + actualValueHeight;
    this.ensureSpace(totalHeight);
    const y = this.currentY;
    const x = this.marginLeft;

    // Top label banner — light blue bg, left-aligned bold text
    this.currentPage.drawRectangle({
      x, y: y - labelHeight, width: cw, height: labelHeight,
      color: this.headerBg, borderColor: this.borderColor, borderWidth: this.gridThickness,
    });

    if (label) {
      const lFs = 7;
      this.currentPage.drawText(label, {
        x: x + 6,
        y: y - labelHeight + (labelHeight - lFs) / 2,
        size: lFs, font: this.boldFont, color: this.headerText,
      });
    }

    // Bottom value cell — white bg, centered body text (BOLD DATA)
    this.currentPage.drawRectangle({
      x, y: y - labelHeight - actualValueHeight, width: cw, height: actualValueHeight,
      color: this.cellBg, borderColor: this.borderColor, borderWidth: this.gridThickness,
    });

    if (value && value.trim()) {
      let valFs = fs;
      let lines = this.wrapText(value, cw - 6, valFs);
      let lineH = valFs * 1.15;
      let totalH = lines.length * lineH;

      // Auto-scale font size if lines exceed value cell height
      while (totalH > actualValueHeight - 2 && valFs > 4.5) {
        valFs -= 0.5;
        lines = this.wrapText(value, cw - 6, valFs);
        lineH = valFs * 1.15;
        totalH = lines.length * lineH;
      }

      const startY = y - labelHeight - (actualValueHeight - totalH) / 2 - valFs;
      lines.forEach((line, idx) => {
        const vw = this.boldFont.widthOfTextAtSize(line, valFs);
        const lineY = startY - idx * lineH;
        if (lineY < y - totalHeight + 1) return; // clip guard
        this.currentPage.drawText(line, {
          x: x + Math.max(4, (cw - vw) / 2),
          y: lineY,
          size: valFs, font: this.boldFont, color: this.bodyTextColor,
        });
      });
    }

    this.currentY -= totalHeight;
  }
  drawExcelHeaderLandscape(formTitle: string): void {
    this.drawExcelHeader(formTitle);
  }

  // Legacy header method — delegates to new Excel header
  drawThreeLineTitleBlock(line1: string, line2: string, line3?: string): void {
    this.drawExcelHeader(line2 || line1);
  }

  // ── Section Bar (light gray background, matching Excel #EDEDED) ──
  drawSectionBar(title: string, barHeight = 18): void {
    this.ensureSpace(barHeight);
    const y = this.currentY - barHeight;

    const bg = this.renderMode === 'BW' ? rgb(230 / 255, 230 / 255, 230 / 255) : COLOR_SECTION_BG;
    this.currentPage.drawRectangle({
      x: this.marginLeft,
      y,
      width: this.contentWidth,
      height: barHeight,
      color: bg,
      borderColor: this.borderColor,
      borderWidth: this.gridThickness,
    });

    const font = this.boldFont;
    const textWidth = font.widthOfTextAtSize(title, 8.5);
    this.currentPage.drawText(title, {
      x: this.marginLeft + (this.contentWidth - textWidth) / 2,
      y: y + (barHeight - 8.5) / 2,
      size: 8.5,
      font,
      color: this.headerText,
    });

    this.currentY = y;
  }

  // ── Navy Section Bar (dark navy background + white bold text) ─
  // Matches the approved reference design for Lien Mark loan headers
  // and Form I "PARTICULARS OF SHARES" section headers.
  // Rule §10, §4: section headers must be dark navy with white text.
  drawNavySectionBar(title: string, barHeight = 20): void {
    this.ensureSpace(barHeight);
    const y = this.currentY - barHeight;

    this.currentPage.drawRectangle({
      x: this.marginLeft,
      y,
      width: this.contentWidth,
      height: barHeight,
      color: this.navyBg,
      borderColor: this.navyBg,
      borderWidth: this.gridThickness,
    });

    const font = this.boldFont;
    const fs = 8.5;
    const textWidth = font.widthOfTextAtSize(title, fs);
    const textCol = this.renderMode === 'BW' ? rgb(1, 1, 1) : COLOR_WHITE_TEXT;
    this.currentPage.drawText(title, {
      x: this.marginLeft + (this.contentWidth - textWidth) / 2,
      y: y + (barHeight - fs) / 2,
      size: fs,
      font,
      color: textCol,
    });

    this.currentY = y;
  }

  // ── Sub-section Bar (pale blue #EEF2F7, for Form I "PARTICULARS OF..." headers) ──
  drawSubsectionBar(title: string, barHeight = 16): void {
    this.ensureSpace(barHeight);
    const y = this.currentY - barHeight;

    const bg = this.renderMode === 'BW' ? rgb(240 / 255, 240 / 255, 240 / 255) : COLOR_SUBSECTION_BG;
    this.currentPage.drawRectangle({
      x: this.marginLeft,
      y,
      width: this.contentWidth,
      height: barHeight,
      color: bg,
      borderColor: this.borderColor,
      borderWidth: this.gridThickness,
    });

    const font = this.boldFont;
    const textWidth = font.widthOfTextAtSize(title, 8);
    this.currentPage.drawText(title, {
      x: this.marginLeft + (this.contentWidth - textWidth) / 2,
      y: y + (barHeight - 8) / 2,
      size: 8,
      font,
      color: this.headerText,
    });

    this.currentY = y;
  }

  wrapText(text: any, width: number, fontSize: number, isBold = false): string[] {
    const textStr = text !== null && text !== undefined ? String(text) : '';
    if (!textStr || textStr.trim() === '') return [];
    const font = isBold ? this.boldFont : this.font;

    const hardLines = textStr.split('\n');
    const result: string[] = [];

    for (const hard of hardLines) {
      const words = hard.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, fontSize) <= width - 4) {
          currentLine = testLine;
        } else {
          if (currentLine) result.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) result.push(currentLine);
    }

    return result;
  }

  calcCellHeight(cell: CellDef, defaultFontSize = 7.5, lineSpacing = 1.15): number {
    const fontSize = cell.fontSize || defaultFontSize;
    const lines = this.wrapText(cell.text, cell.width, fontSize, cell.bold);
    if (lines.length <= 1) return fontSize * lineSpacing + 6;
    return lines.length * fontSize * lineSpacing + 6;
  }

  calcRowHeight(cells: CellDef[], minHeight = 22, defaultFontSize = 7.5): number {
    let maxH = minHeight;
    for (const c of cells) {
      const h = this.calcCellHeight(c, defaultFontSize);
      if (h > maxH) maxH = h;
    }
    return maxH;
  }

  // ── Table Drawing Engine ────────────────────────────────────

  // Single-tier header with customizable header background & grid settings
  drawTableHeader(columns: ColumnDef[], headerHeight = 26): void {
    this.ensureSpace(headerHeight);
    const y = this.currentY;
    let x = this.marginLeft;

    for (const col of columns) {
      // Header cell background
      this.currentPage.drawRectangle({
        x,
        y: y - headerHeight,
        width: col.width,
        height: headerHeight,
        color: this.headerBg,
        borderColor: this.gridOn ? this.gridLineColor : undefined,
        borderWidth: this.gridOn ? 0.5 : 0,
        borderOpacity: this.gridOpacity / 100,
      });

      // Header text — ALWAYS horizontally centered, vertically centered
      const fs = col.fontSize || 7;
      const lines = this.wrapText(col.header, col.width, fs, true);
      const lineHeight = fs * 1.15;
      const totalTextH = lines.length * lineHeight;
      const startY = y - (headerHeight - totalTextH) / 2 - fs;

      lines.forEach((line, idx) => {
        const lw = this.boldFont.widthOfTextAtSize(line, fs);
        // Always center horizontally in the cell
        const lineX = x + (col.width - lw) / 2;

        this.currentPage.drawText(line, {
          x: Math.max(lineX, x + 1),
          y: startY - idx * lineHeight,
          size: fs,
          font: this.boldFont,
          color: this.headerText,
        });
      });

      x += col.width;
    }

    this.currentY -= headerHeight;
  }

  // Two-tier table header (for Share Register, Form I, etc.)
  drawTwoTierHeader(groups: HeaderGroupDef[], headerHeight = 34): void {
    this.ensureSpace(headerHeight);
    const y = this.currentY;
    let x = this.marginLeft;

    for (const group of groups) {
      const groupWidth = group.columns.reduce((sum, c) => sum + c.width, 0);

      if (group.header && group.header.trim() !== '') {
        // Top spanning header row
        const topH = Math.floor(headerHeight / 2);
        this.currentPage.drawRectangle({
          x,
          y: y - topH,
          width: groupWidth,
          height: topH,
          color: this.headerBg,
          borderColor: this.borderColor,
          borderWidth: this.gridThickness,
        });

        let fs = 7.5;
        let lines = this.wrapText(group.header, groupWidth - 4, fs, true);
        let lineHeight = fs * 1.1;
        let totalH = lines.length * lineHeight;
        while (totalH > topH - 2 && fs > 5.0) {
          fs -= 0.4;
          lines = this.wrapText(group.header, groupWidth - 4, fs, true);
          lineHeight = fs * 1.1;
          totalH = lines.length * lineHeight;
        }
        const startY = y - (topH - totalH) / 2 - fs;

        lines.forEach((line, idx) => {
          const lw = this.boldFont.widthOfTextAtSize(line, fs);
          const lineX = x + (groupWidth - lw) / 2;
          const lineY = startY - idx * lineHeight;
          if (lineY < y - topH + 1) return;
          this.currentPage.drawText(line, {
            x: Math.max(lineX, x + 1),
            y: lineY,
            size: fs,
            font: this.boldFont,
            color: this.headerText,
          });
        });

        // Bottom tier sub-columns
        let subX = x;
        const botH = headerHeight - topH;
        for (const col of group.columns) {
          this.currentPage.drawRectangle({
            x: subX,
            y: y - headerHeight,
            width: col.width,
            height: botH,
            color: this.headerBg,
            borderColor: this.borderColor,
            borderWidth: this.gridThickness,
          });

          let subFs = col.fontSize || 7.0;
          let subLines = this.wrapText(col.header, col.width - 2, subFs, true);
          let subLineH = subFs * 1.1;
          let subTotalH = subLines.length * subLineH;
          const getSubOverWidth = () => subLines.some(l => this.boldFont.widthOfTextAtSize(l, subFs) > col.width - 3);
          while ((subTotalH > botH - 2 || getSubOverWidth()) && subFs > 4.5) {
            subFs -= 0.3;
            subLines = this.wrapText(col.header, col.width - 2, subFs, true);
            subLineH = subFs * 1.1;
            subTotalH = subLines.length * subLineH;
          }
          const subStartY = y - topH - (botH - subTotalH) / 2 - subFs;

          subLines.forEach((line, idx) => {
            const w = this.boldFont.widthOfTextAtSize(line, subFs);
            const lx = subX + (col.width - w) / 2;
            const lineY = subStartY - idx * subLineH;
            if (lineY < y - headerHeight + 1) return;
            this.currentPage.drawText(line, {
              x: Math.max(lx, subX + 1),
              y: lineY,
              size: subFs,
              font: this.boldFont,
              color: this.headerText,
            });
          });

          subX += col.width;
        }
      } else {
        // Single full-height column header
        const col = group.columns[0];
        this.currentPage.drawRectangle({
          x,
          y: y - headerHeight,
          width: col.width,
          height: headerHeight,
          color: this.headerBg,
          borderColor: this.borderColor,
          borderWidth: this.gridThickness,
        });

        let fs = col.fontSize || 7.5;
        let lines = this.wrapText(col.header, col.width - 4, fs, true);
        let lineHeight = fs * 1.1;
        let totalH = lines.length * lineHeight;
        const getOverWidth = () => lines.some(l => this.boldFont.widthOfTextAtSize(l, fs) > col.width - 4);
        while ((totalH > headerHeight - 2 || getOverWidth()) && fs > 4.5) {
          fs -= 0.3;
          lines = this.wrapText(col.header, col.width - 4, fs, true);
          lineHeight = fs * 1.1;
          totalH = lines.length * lineHeight;
        }
        const startY = y - (headerHeight - totalH) / 2 - fs;

        lines.forEach((line, idx) => {
          const lw = this.boldFont.widthOfTextAtSize(line, fs);
          // Always center horizontally
          const lineX = x + (col.width - lw) / 2;

          this.currentPage.drawText(line, {
            x: Math.max(lineX, x + 1),
            y: startY - idx * lineHeight,
            size: fs,
            font: this.boldFont,
            color: this.headerText,
          });
        });
      }

      x += groupWidth;
    }

    this.currentY -= headerHeight;
  }

  // Column number row (1, 2, 3, ... n) matching Excel design
  drawColumnNumberRow(columns: ColumnDef[], rowHeight = 16): void {
    this.ensureSpace(rowHeight);
    const y = this.currentY;
    let x = this.marginLeft;
    const fs = 7;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];

      this.currentPage.drawRectangle({
        x,
        y: y - rowHeight,
        width: col.width,
        height: rowHeight,
        color: this.cellBg,
        borderColor: this.borderColor,
        borderWidth: this.gridThickness,
      });

      const numStr = String(i + 1);
      const tw = this.boldFont.widthOfTextAtSize(numStr, fs);
      this.currentPage.drawText(numStr, {
        x: x + (col.width - tw) / 2,
        y: y - rowHeight + (rowHeight - fs) / 2,
        size: fs,
        font: this.boldFont,
        color: this.headerText,
      });

      x += col.width;
    }

    this.currentY -= rowHeight;
  }

  // Data row — styled using FormDesignSettings
  drawTableRow(cells: CellDef[], rowHeight: number, defaultFontSize = 7, isAlt = false): void {
    this.ensureSpace(rowHeight);
    const y = this.currentY;
    let x = this.marginLeft;

    const actualDefaultFs = this.bodyFontSize || defaultFontSize;

    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx];

      // Cell background and border
      this.currentPage.drawRectangle({
        x,
        y: y - rowHeight,
        width: cell.width,
        height: rowHeight,
        color: this.cellBg,
        borderColor: this.gridOn ? this.gridLineColor : undefined,
        borderWidth: this.gridOn ? this.gridThickness : 0,
        borderOpacity: this.gridOpacity / 100,
      });

      // Accounting Ledger Graph Grid Sub-Pattern Overlay (Prompt Request)
      if (this.gridOn && this.gridOpacity > 0 && this.renderMode !== 'BW') {
        const subGridStep = 12;
        const subLineCol = this.gridLineColor;
        const subLineOp = Math.min(0.25, (this.gridOpacity / 100) * 0.20);
        for (let subY = y - subGridStep; subY > y - rowHeight; subY -= subGridStep) {
          this.currentPage.drawLine({
            start: { x: x + 1, y: subY },
            end: { x: x + cell.width - 1, y: subY },
            thickness: 0.25,
            color: subLineCol,
            opacity: subLineOp,
          });
        }
        for (let subX = x + subGridStep; subX < x + cell.width; subX += subGridStep) {
          this.currentPage.drawLine({
            start: { x: subX, y: y - rowHeight + 1 },
            end: { x: subX, y: y - 1 },
            thickness: 0.25,
            color: subLineCol,
            opacity: subLineOp,
          });
        }
      }

      const cellTextStr = cell.text !== null && cell.text !== undefined ? String(cell.text) : '';
      if (cellTextStr.trim() !== '') {
        let fs = cell.fontSize || actualDefaultFs;
        const isBold = cell.bold !== undefined ? Boolean(cell.bold) : true;
        const font = isBold ? this.boldFont : this.font;
        let lines = this.wrapText(cellTextStr, cell.width - 6, fs, isBold);
        let lineHeight = fs * 1.12;
        let totalTextH = lines.length * lineHeight;

        // Auto-scale font size down if lines exceed rowHeight or cell width
        while ((totalTextH > rowHeight - 4 || lines.some(l => font.widthOfTextAtSize(l, fs) > cell.width - 6)) && fs > 4.5) {
          fs -= 0.3;
          lines = this.wrapText(cellTextStr, cell.width - 6, fs, isBold);
          lineHeight = fs * 1.12;
          totalTextH = lines.length * lineHeight;
        }

        // Cap lines to prevent drawing outside cell boundaries
        if (totalTextH > rowHeight - 2) {
          const maxLines = Math.max(1, Math.floor((rowHeight - 2) / lineHeight));
          lines = lines.slice(0, maxLines);
          totalTextH = lines.length * lineHeight;
        }

        // Vertical Alignment: top, middle, bottom
        const vAlign = this.verticalAlign || 'middle';
        let startY: number;
        if (vAlign === 'top') {
          startY = y - fs - 2;
        } else if (vAlign === 'bottom') {
          startY = y - rowHeight + totalTextH + 2;
        } else {
          // Clamp top margin so startY NEVER goes above y - fs - 1
          const topMargin = Math.max(2, (rowHeight - totalTextH) / 2);
          startY = y - topMargin - fs;
        }

        const hAlign = cell.align || this.horizontalAlign || 'center';

        lines.forEach((line, idx) => {
          const lineY = startY - idx * lineHeight;
          // Strict top and bottom boundary clip guard
          if (lineY > y - 1 || lineY < y - rowHeight + 1) return;

          const lw = font.widthOfTextAtSize(line, fs);
          let lineX: number;
          if (hAlign === 'right') {
            lineX = x + cell.width - lw - 4;
          } else if (hAlign === 'center') {
            lineX = x + (cell.width - lw) / 2;
          } else {
            lineX = x + 4; // Left align with clean 4pt margin
          }

          const cellColor = cell.color
            ? (typeof cell.color === 'string' ? hexToRgb(cell.color, this.bodyTextColor) : cell.color)
            : this.bodyTextColor;

          const rotAngle = this.textRotation || 0;
          const drawOpts: any = {
            x: Math.max(lineX, x + 2),
            y: lineY,
            size: fs,
            font,
            color: cellColor,
          };

          if (rotAngle === 90) {
            drawOpts.rotate = degrees(90);
            drawOpts.x = x + (cell.width + fs) / 2;
            drawOpts.y = y - rowHeight + (rowHeight - lw) / 2;
          } else if (rotAngle === 180) {
            drawOpts.rotate = degrees(180);
            drawOpts.x = x + (cell.width + lw) / 2;
            drawOpts.y = y - (rowHeight - fs) / 2;
          } else if (rotAngle === 270) {
            drawOpts.rotate = degrees(270);
            drawOpts.x = x + (cell.width - fs) / 2;
            drawOpts.y = y - rowHeight + (rowHeight + lw) / 2;
          }

          this.currentPage.drawText(line, drawOpts);
        });
      }

      x += cell.width;
    }

    this.currentY -= rowHeight;
  }

  // ── Form-Style Drawing (for Form I and Bank Lien Mark) ──────

  // Label-value field row: label cell with #D9E1F2 bg + value cell with white bg
  // Label is left-aligned (it's a heading). Value defaults to LEFT alignment for readability.
  drawFormField(
    label: string,
    value: string,
    labelWidth: number,
    valueWidth: number,
    rowHeight = 20,
    align: 'left' | 'center' | 'right' = 'left'
  ): void {
    let calcHeight = rowHeight;
    if (value && value.trim() !== '') {
      const tempFs = 7.5;
      const tempLines = this.wrapText(value, valueWidth - 8, tempFs);
      const needed = Math.ceil(tempLines.length * (tempFs * 1.15) + 8);
      if (needed > calcHeight) {
        calcHeight = needed;
      }
    }

    this.ensureSpace(calcHeight);
    const y = this.currentY;
    let x = this.marginLeft;

    // Label cell — left-aligned label text
    this.currentPage.drawRectangle({
      x,
      y: y - calcHeight,
      width: labelWidth,
      height: calcHeight,
      color: this.headerBg,
      borderColor: this.borderColor,
      borderWidth: 0.5,
    });

    const labelLines = this.wrapText(label, labelWidth - 6, 8.5, true);
    const labelLineH = 8.5 * 1.15;
    const labelTotalH = labelLines.length * labelLineH;
    const labelStartY = y - (calcHeight - labelTotalH) / 2 - 8.5;
    labelLines.forEach((line, idx) => {
      this.currentPage.drawText(line, {
        x: x + 4,
        y: labelStartY - idx * labelLineH,
        size: 8.5,
        font: this.boldFont,
        color: this.headerText,
      });
    });

    x += labelWidth;

    // Value cell — left / center aligned (BOLD DATA)
    this.currentPage.drawRectangle({
      x,
      y: y - calcHeight,
      width: valueWidth,
      height: calcHeight,
      color: this.cellBg,
      borderColor: this.borderColor,
      borderWidth: 0.5,
    });

    if (value && value.trim() !== '') {
      let fs = 8.5;
      let lines = this.wrapText(value, valueWidth - 10, fs, true);
      let lineHeight = fs * 1.15;
      let totalH = lines.length * lineHeight;

      // Auto-scale font size if total text height exceeds row height or any line width exceeds cell width
      const getOverWidth = () => lines.some(l => this.boldFont.widthOfTextAtSize(l, fs) > valueWidth - 8);
      while ((totalH > calcHeight - 2 || getOverWidth()) && fs > 5.0) {
        fs -= 0.4;
        lines = this.wrapText(value, valueWidth - 10, fs, true);
        lineHeight = fs * 1.15;
        totalH = lines.length * lineHeight;
      }

      const startY = y - (calcHeight - totalH) / 2 - fs;
      lines.forEach((line, idx) => {
        const lw = this.boldFont.widthOfTextAtSize(line, fs);
        let lineX = x + 6;
        if (align === 'center') {
          lineX = x + Math.max(2, (valueWidth - lw) / 2);
        } else if (align === 'right') {
          lineX = x + valueWidth - lw - 6;
        }
        const lineY = startY - idx * lineHeight;
        if (lineY < y - calcHeight + 1) return; // Strict clip guard
        this.currentPage.drawText(line, {
          x: Math.max(lineX, x + 2),
          y: lineY,
          size: fs,
          font: this.boldFont, // BOLD INSERTED DATA
          color: this.bodyTextColor,
        });
      });
    }

    this.currentY -= calcHeight;
  }

  // Two-column label-value row (for Form I's side-by-side fields)
  // Labels are left-aligned. Values default to left-aligned.
  drawFormFieldPair(
    label1: string, value1: string, w1Label: number, w1Value: number,
    label2: string, value2: string, w2Label: number, w2Value: number,
    rowHeight = 20,
    align1: 'left' | 'center' | 'right' = 'left',
    align2: 'left' | 'center' | 'right' = 'left'
  ): void {
    let calcHeight = rowHeight;
    const fs = 8.5;
    if (value1 && value1.trim()) {
      const l1 = this.wrapText(value1, w1Value - 8, fs, true);
      const n1 = Math.ceil(l1.length * (fs * 1.15) + 8);
      if (n1 > calcHeight) calcHeight = n1;
    }
    if (value2 && value2.trim()) {
      const l2 = this.wrapText(value2, w2Value - 8, fs, true);
      const n2 = Math.ceil(l2.length * (fs * 1.15) + 8);
      if (n2 > calcHeight) calcHeight = n2;
    }

    this.ensureSpace(calcHeight);
    const y = this.currentY;
    let x = this.marginLeft;
    const defaultFs = 8.5;
    const defaultLineH = defaultFs * 1.15;

    const drawLabel = (label: string, width: number, xPos: number) => {
      this.currentPage.drawRectangle({
        x: xPos, y: y - calcHeight, width, height: calcHeight,
        color: this.headerBg, borderColor: this.borderColor, borderWidth: 0.5,
      });
      if (label && width > 0) {
        const lines = this.wrapText(label, width - 6, defaultFs, true);
        const totalH = lines.length * defaultLineH;
        const startY = y - (calcHeight - totalH) / 2 - defaultFs;
        lines.forEach((line, idx) => {
          this.currentPage.drawText(line, {
            x: xPos + 4, y: startY - idx * defaultLineH,
            size: defaultFs, font: this.boldFont, color: this.headerText,
          });
        });
      }
    };

    const drawValue = (value: string, width: number, xPos: number, alignVal: 'left' | 'center' | 'right' = 'left') => {
      this.currentPage.drawRectangle({
        x: xPos, y: y - calcHeight, width, height: calcHeight,
        color: this.cellBg, borderColor: this.borderColor, borderWidth: 0.5,
      });
      if (value && value.trim() && width > 0) {
        let fs = defaultFs;
        let lines = this.wrapText(value, width - 8, fs, true);
        let lineH = fs * 1.15;
        let totalH = lines.length * lineH;

        const getOverWidth = () => lines.some(l => this.boldFont.widthOfTextAtSize(l, fs) > width - 6);
        while ((totalH > calcHeight - 2 || getOverWidth()) && fs > 5.0) {
          fs -= 0.4;
          lines = this.wrapText(value, width - 8, fs, true);
          lineH = fs * 1.15;
          totalH = lines.length * lineH;
        }

        const startY = y - (calcHeight - totalH) / 2 - fs;
        lines.forEach((line, idx) => {
          const lw = this.boldFont.widthOfTextAtSize(line, fs);
          let lineX = xPos + 6;
          if (alignVal === 'center') {
            lineX = xPos + Math.max(2, (width - lw) / 2);
          } else if (alignVal === 'right') {
            lineX = xPos + width - lw - 6;
          }
          const lineY = startY - idx * lineH;
          if (lineY < y - calcHeight + 1) return; // Strict clip guard
          this.currentPage.drawText(line, {
            x: Math.max(lineX, xPos + 2), y: lineY,
            size: fs, font: this.boldFont, color: this.bodyTextColor, // BOLD INSERTED DATA
          });
        });
      }
    };

    // Left pair
    drawLabel(label1, w1Label, x); x += w1Label;
    drawValue(value1, w1Value, x, align1); x += w1Value;
    // Right pair
    drawLabel(label2, w2Label, x); x += w2Label;
    drawValue(value2, w2Value, x, align2);

    this.currentY -= calcHeight;
  }

  // Full-width label-value row
  drawFormFieldFull(label: string, value: string, rowHeight = 20): void {
    const labelWidth = 140;
    const valueWidth = this.contentWidth - labelWidth;
    this.drawFormField(label, value, labelWidth, valueWidth, rowHeight);
  }

  // ── Key-Value Grid (legacy, delegates to new methods) ───────
  drawKeyValueGrid(rows: { label: string; val: string; w1: number; w2: number }[][]): void {
    for (const row of rows) {
      if (row.length === 1) {
        this.drawFormField(row[0].label, row[0].val, row[0].w1, row[0].w2);
      } else if (row.length === 2) {
        this.drawFormFieldPair(
          row[0].label, row[0].val, row[0].w1, row[0].w2,
          row[1].label, row[1].val, row[1].w1, row[1].w2,
        );
      }
    }
  }

  // Legacy section header (delegates to section bar)
  drawSectionHeader(title: string): void {
    this.drawSectionBar(title);
  }

  // ── Spacing & Page Management ───────────────────────────────

  ensureSpace(requiredHeight: number): void {
    if (this.currentY - requiredHeight < this.marginBottom) {
      this.addNewPage();
    }
  }

  async buildBuffer(): Promise<Buffer> {
    const bytes = await this.doc.save();
    return typeof Buffer !== 'undefined' ? Buffer.from(bytes) : (bytes as any);
  }
}
