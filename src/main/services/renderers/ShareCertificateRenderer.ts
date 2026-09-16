// ============================================================
// HENU OS — Share Certificate Native PDF Renderer
// Supports 3 Professional Templates:
// 1. HENU_OS_DEFAULT: Sai Flora Master Style (19" x 13" Landscape · 350 GSM · Red/Gold)
// 2. HENU_OS_1: Portrait Master Style (13" x 19" Portrait · #FFF7EB / #CC3A63 Palette)
// 3. HENU_OS_2: Marathi Master Style (19" x 13" Landscape · Marathi Devanagari · Red/Gold)
// ============================================================

import 'regenerator-runtime/runtime';
const fs: any = typeof window === 'undefined' ? require('fs') : null;
const path: any = typeof window === 'undefined' ? require('path') : null;
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  NormalizedMemberRecord,
  SocietyMaster,
  FormDesignSettings,
  ShareCertificateTemplateId,
} from '../../types';
import { MASTER_GEOMETRY } from './share_cert/certificateGeometry';
import { ShareCertificateExcelMapping } from './share_cert/excelMapping';
import { ShareCertificateFieldData } from './share_cert/certificateFields';
import { wrapPdfDocumentForWinAnsi } from './PdfDocumentBuilder';

export const SIZE_13X19_W = 1368; // 19.00 inches * 72
export const SIZE_13X19_H = 936;  // 13.00 inches * 72
export const SAFE_MARGIN = 48;   // 0.67 inches * 72

// ── Palette 1: HENU_OS_DEFAULT (Sai Flora Red & Gold) ────────
const RED_VIBRANT = rgb(204 / 255, 0, 0);         // #CC0000 Vibrant border red
const RED_MAROON = rgb(148 / 255, 0, 0);         // #940000 Master maroon
const GOLD_ACCENT = rgb(190 / 255, 140 / 255, 20 / 255); // #BE8C14 Gold border accent
const COLOR_BLACK = rgb(0, 0, 0);
const COLOR_NAVY = rgb(24 / 255, 52 / 255, 98 / 255);  // #183462 Address & Rupee Box
const COLOR_GRAY = rgb(170 / 255, 170 / 255, 170 / 255);
const COLOR_SEAL = rgb(215 / 255, 215 / 255, 215 / 255); // Light grey watermark seal
const COLOR_WHITE = rgb(1, 1, 1);

// ── Palette 2: HENU_OS_1 (Custom Warm/Ruby Palette) ──────────
const C1_BG_LIGHT = rgb(255 / 255, 247 / 255, 235 / 255); // #FFF7EB Primary light theme
const C1_BG_SEC = rgb(249 / 255, 240 / 255, 224 / 255); // #F9F0E0 Secondary bg
const C1_ACCENT_OLV = rgb(162 / 255, 171 / 255, 115 / 255); // #A2AB73 3rd accent
const C1_RUBY_RED = rgb(204 / 255, 58 / 255, 99 / 255);  // #CC3A63 4th border & society name

// ── Palette 3: HENU_OS_2 (Royal Violet & Lavender Palette — #42326E / #E0D4FC) ─────
const C3_VIOLET_DARK = rgb(0x42 / 255, 0x32 / 255, 0x6E / 255);    // #42326E Deep Royal Violet Border & Headers
const C3_VIOLET_MED = rgb(0x6E / 255, 0x5B / 255, 0x9A / 255);     // #6E5B9A Medium Violet Accent
const C3_LILAC = rgb(0xB2 / 255, 0x9C / 255, 0xE4 / 255);          // #B29CE4 Lilac Accent
const C3_LAVENDER_MIST = rgb(0xD7 / 255, 0xC8 / 255, 0xED / 255);  // #D7C8ED Soft Lavender Trim
const C3_BG_PRIMARY = rgb(0xE0 / 255, 0xD4 / 255, 0xFC / 255);     // #E0D4FC Primary Lavender Background
const C3_BG_LIGHT = rgb(0xFB / 255, 0xF9 / 255, 0xFF / 255);       // #FBF9FF Ultra Light Background Fill
const C3_GOLD = rgb(224 / 255, 184 / 255, 76 / 255);               // Gold Accent Trim

// ── Palette 4: HENU_OS_3 (Polaris Luxury Master Style — 13" x 9" Landscape) ─────
export const SIZE_13X9_W = 936;  // 13.00 inches * 72
export const SIZE_13X9_H = 648;  // 9.00 inches * 72

const P_PURPLE_DEEP = rgb(0x18 / 255, 0x0B / 255, 0x45 / 255);    // #180B45
const P_PURPLE_PRIMARY = rgb(0x24 / 255, 0x10 / 255, 0x5E / 255); // #24105E
const P_PURPLE_ROYAL = rgb(0x3B / 255, 0x12 / 255, 0x6F / 255);   // #3B126F
const P_PURPLE_ACCENT = rgb(0x64 / 255, 0x24 / 255, 0xA0 / 255);  // #6424A0
const P_LAVENDER_MIST = rgb(0xDC / 255, 0xCC / 255, 0xF0 / 255);  // #DCCCF0
const P_LAVENDER_LIGHT = rgb(0xF4 / 255, 0xEF / 255, 0xFA / 255); // #F4EFFA

const P_GOLD_DARK = rgb(0x8A / 255, 0x5A / 255, 0x00 / 255);      // #8A5A00
const P_GOLD_BRONZE = rgb(0xA9 / 255, 0x6D / 255, 0x0A / 255);    // #A96D0A
const P_GOLD_PRIMARY = rgb(0xC9 / 255, 0x96 / 255, 0x27 / 255);   // #C99627
const P_GOLD_METALLIC = rgb(0xD8 / 255, 0xAA / 255, 0x3B / 255);  // #D8AA3B
const P_GOLD_LIGHT = rgb(0xE8 / 255, 0xC6 / 255, 0x6A / 255);     // #E8C66A
const P_GOLD_PALE = rgb(0xF4 / 255, 0xE2 / 255, 0xB2 / 255);      // #F4E2B2

const P_TEXT_PRIMARY = rgb(0x17 / 255, 0x15 / 255, 0x1B / 255);   // #17151B
const P_TEXT_MUTED = rgb(0x55 / 255, 0x51 / 255, 0x5A / 255);     // #55515A
const P_LINE_GREY = rgb(0x77 / 255, 0x74 / 255, 0x7D / 255);      // #77747D
const P_BG_PAPER = rgb(0xFC / 255, 0xFB / 255, 0xF8 / 255);       // #FCFBF8
const P_BG_LIGHT = rgb(0xF7 / 255, 0xF5 / 255, 0xF1 / 255);       // #F7F5F1

const POLARIS_GEOMETRY = {
  FRONT: {
    ACK: { x: 4 * 0.72, y: 15.12, w: 219 * 0.72, h: 873 * 0.72 },
    SOCIETY: { x: 234 * 0.72, y: 15.12, w: 523 * 0.72, h: 874 * 0.72 },
    MEMBER: { x: 769 * 0.72, y: 15.12, w: 525 * 0.72, h: 874 * 0.72 },
  },
  BACK: {
    SOCIETY: { x: 4 * 0.72, y: 15.12, w: 523 * 0.72, h: 874 * 0.72 },
    MEMBER: { x: 539 * 0.72, y: 15.12, w: 525 * 0.72, h: 874 * 0.72 },
    ACK: { x: 1076 * 0.72, y: 15.12, w: 219 * 0.72, h: 873 * 0.72 },
  }
};

export interface ShareCertRenderOptions {
  templateId?: ShareCertificateTemplateId;
  orientationOverride?: 'Portrait' | 'Landscape';
  settings?: FormDesignSettings;
  renderMode?: 'Color' | 'BW';
  gridOn?: boolean;
  headerImageBase64?: string;
  ackImageBase64?: string;
  fontFamily?: string;
}

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  timesRoman: PDFFont;
  timesBold: PDFFont;
  devReg?: PDFFont;
  devBold?: PDFFont;
  hasDevanagari: boolean;
}

function fitFontSize(
  text: string,
  font: PDFFont,
  maxSize: number,
  maxWidth: number,
  minSize = 6
): number {
  let sz = maxSize;
  while (sz > minSize && font.widthOfTextAtSize(text, sz) > maxWidth) {
    sz -= 0.25;
  }
  return sz;
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  centerX: number,
  y: number,
  color = COLOR_BLACK
) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - tw / 2, y, size, font, color });
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function ordinalDay(n: number): string {
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function cleanCurrency(val: string | number | undefined, defaultVal = '0'): string {
  if (val === undefined || val === null || val === '') return `${defaultVal}/-`;
  const str = String(val).trim();
  const cleaned = str.replace(/(\/\-|\/|\-|\.00)+$/g, '').trim();
  return `${cleaned || defaultVal}/-`;
}

function formatIssueDate(dateStr: string | undefined, city = 'MUMBAI'): string {
  if (!dateStr) return `Given under the Common Seal of the Said Society on ${city} this ___ day of ___.`;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return `Given under the Common Seal of the Said Society on ${city} this ___ day of ___.`;
    const day = ordinalDay(d.getDate());
    const month = d.toLocaleString('en-IN', { month: 'long' });
    const year = d.getFullYear();
    return `Given under the Common Seal of the Said Society on ${city} this ${day} day of ${month} ${year}.`;
  } catch {
    return `Given under the Common Seal of the Said Society on ${city} this ___ day of ___.`;
  }
}

export class ShareCertificateRenderer {
  /**
   * Main entry point for native Share Certificate PDF generation
   */
  static async render(
    records: { serial: string; record: NormalizedMemberRecord | null }[],
    society: SocietyMaster | null,
    options?: ShareCertRenderOptions | 'Portrait' | 'Landscape'
  ): Promise<Buffer> {
    const doc = wrapPdfDocumentForWinAnsi(await PDFDocument.create());
    doc.registerFontkit(fontkit);

    let devReg: PDFFont | undefined;
    let devBold: PDFFont | undefined;

    if (typeof window === 'undefined' && fs && path) {
      const regFontCandidates = [
        path.join(process.cwd(), 'Tiro_Devanagari_Marathi', 'TiroDevanagariMarathi-Regular.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'TiroDevanagariMarathi-Regular.ttf'),
        path.join(process.cwd(), 'src', 'assets', 'fonts', 'TiroDevanagariMarathi-Regular.ttf'),
        path.join(process.cwd(), 'src', 'assets', 'fonts', 'Mukta-Regular.ttf'),
        path.join(process.cwd(), 'src', 'templates', 'Mukta-Regular.ttf'),
        path.join(process.cwd(), 'dist', 'main', 'templates', 'Mukta-Regular.ttf'),
        path.join(__dirname, 'Mukta-Regular.ttf'),
      ];

      const boldFontCandidates = [
        path.join(process.cwd(), 'Tiro_Devanagari_Marathi', 'TiroDevanagariMarathi-Regular.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'TiroDevanagariMarathi-Regular.ttf'),
        path.join(process.cwd(), 'src', 'assets', 'fonts', 'TiroDevanagariMarathi-Regular.ttf'),
        path.join(process.cwd(), 'src', 'assets', 'fonts', 'Mukta-Bold.ttf'),
        path.join(process.cwd(), 'src', 'templates', 'Mukta-Bold.ttf'),
        path.join(process.cwd(), 'dist', 'main', 'templates', 'Mukta-Bold.ttf'),
        path.join(__dirname, 'Mukta-Bold.ttf'),
      ];

      for (const p of regFontCandidates) {
        if (fs.existsSync(p)) {
          try {
            devReg = await doc.embedFont(fs.readFileSync(p));
            break;
          } catch (e) {
            console.error('Failed to embed Devanagari regular font from:', p, e);
          }
        }
      }

      for (const p of boldFontCandidates) {
        if (fs.existsSync(p)) {
          try {
            devBold = await doc.embedFont(fs.readFileSync(p));
            break;
          } catch (e) {
            console.error('Failed to embed Devanagari bold font from:', p, e);
          }
        }
      }
    } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const tiroRes = await fetch('/fonts/TiroDevanagariMarathi-Regular.ttf');
        if (tiroRes.ok) {
          const tiroBuf = await tiroRes.arrayBuffer();
          devReg = await doc.embedFont(new Uint8Array(tiroBuf));
          devBold = devReg;
        }
      } catch (e) {
        console.warn('Browser fetch Tiro font failed:', e);
      }
      if (!devReg) {
        try {
          const regRes = await fetch('/fonts/Mukta-Regular.ttf');
          if (regRes.ok) {
            const regBuf = await regRes.arrayBuffer();
            devReg = await doc.embedFont(new Uint8Array(regBuf));
            devBold = devReg;
          }
        } catch (e) {
          console.warn('Browser fetch Mukta font failed:', e);
        }
      }
    }

    const rawFont = (typeof options === 'object' && ((options as ShareCertRenderOptions)?.fontFamily || (options as any)?.settings?.fontFamily)) || 'Times-Roman';
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
              customFont = await doc.embedFont(fs.readFileSync(p));
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
            customFont = await doc.embedFont(new Uint8Array(buf));
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
              customFont = await doc.embedFont(fs.readFileSync(p));
              break;
            } catch (e) {}
          }
        }
        for (const p of boldCandidates) {
          if (fs.existsSync(p)) {
            try {
              customBoldFont = await doc.embedFont(fs.readFileSync(p));
              break;
            } catch (e) {}
          }
        }
      } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
          const regRes = await fetch('/fonts/Merriweather-Regular.ttf');
          if (regRes.ok) {
            const buf = await regRes.arrayBuffer();
            customFont = await doc.embedFont(new Uint8Array(buf));
          }
          const boldRes = await fetch('/fonts/Merriweather-Bold.ttf');
          if (boldRes.ok) {
            const buf = await boldRes.arrayBuffer();
            customBoldFont = await doc.embedFont(new Uint8Array(buf));
          }
        } catch (e) {}
      }
    }

    let standardReg: PDFFont;
    let standardBold: PDFFont;

    if (customFont) {
      standardReg = customFont;
      standardBold = customBoldFont || customFont;
    } else if (fontName === 'courier') {
      standardReg = await doc.embedFont(StandardFonts.Courier);
      standardBold = await doc.embedFont(StandardFonts.CourierBold);
    } else if (fontName === 'helvetica-bold') {
      standardReg = await doc.embedFont(StandardFonts.HelveticaBold);
      standardBold = await doc.embedFont(StandardFonts.HelveticaBold);
    } else if (fontName === 'helvetica') {
      standardReg = await doc.embedFont(StandardFonts.Helvetica);
      standardBold = await doc.embedFont(StandardFonts.HelveticaBold);
    } else {
      // Default: Times-Roman (Classic Serif Standard)
      standardReg = await doc.embedFont(StandardFonts.TimesRoman);
      standardBold = await doc.embedFont(StandardFonts.TimesRomanBold);
    }

    const hasDevanagari = !!devReg && devReg !== standardReg;

    const fonts: Fonts = {
      reg: standardReg,
      bold: standardBold,
      italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
      timesRoman: standardReg,
      timesBold: standardBold,
      devReg: devReg || standardReg,
      devBold: devBold || standardBold,
      hasDevanagari,
    };

    let template: ShareCertificateTemplateId = 'HENU_OS_DEFAULT';
    if (typeof options === 'object') {
      if ((options as any)?.templateId) template = (options as any).templateId;
      else if ((options as any)?.template) template = (options as any).template;
      else if ((options as any)?.settings?.templateId) template = (options as any).settings.templateId;
    }

    let marathiHeaderImg: PDFImage | undefined;
    let marathiAckImg: PDFImage | undefined;

    if (typeof options === 'object' && options?.headerImageBase64) {
      try {
        const base64Clean = options.headerImageBase64.includes('base64,')
          ? options.headerImageBase64.split('base64,')[1].trim()
          : options.headerImageBase64.trim();
        const bytes = typeof Buffer !== 'undefined'
          ? Buffer.from(base64Clean, 'base64')
          : Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
        try {
          if (options.headerImageBase64.includes('jpeg') || options.headerImageBase64.includes('jpg')) {
            marathiHeaderImg = await doc.embedJpg(bytes);
          } else {
            marathiHeaderImg = await doc.embedPng(bytes);
          }
        } catch {
          try {
            marathiHeaderImg = await doc.embedJpg(bytes);
          } catch {
            marathiHeaderImg = await doc.embedPng(bytes);
          }
        }
      } catch (e) {
        console.warn('Failed to embed custom headerImageBase64:', e);
      }
    }

    if (typeof options === 'object' && options?.ackImageBase64) {
      try {
        const base64Clean = options.ackImageBase64.includes('base64,')
          ? options.ackImageBase64.split('base64,')[1].trim()
          : options.ackImageBase64.trim();
        const bytes = typeof Buffer !== 'undefined'
          ? Buffer.from(base64Clean, 'base64')
          : Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
        try {
          if (options.ackImageBase64.includes('jpeg') || options.ackImageBase64.includes('jpg')) {
            marathiAckImg = await doc.embedJpg(bytes);
          } else {
            marathiAckImg = await doc.embedPng(bytes);
          }
        } catch {
          try {
            marathiAckImg = await doc.embedJpg(bytes);
          } catch {
            marathiAckImg = await doc.embedPng(bytes);
          }
        }
      } catch (e) {
        console.warn('Failed to embed custom ackImageBase64:', e);
      }
    }

    const hasCustomHeader = typeof options === 'object' && !!options?.headerImageBase64;
    const hasCustomAck = typeof options === 'object' && !!options?.ackImageBase64;

    if (!marathiHeaderImg && !hasCustomHeader && (template === 'HENU_OS_2' || template === 'DESIGN_B_LANDSCAPE')) {
      if (typeof window === 'undefined' && fs && path) {
        const headerCandidates = [
          path.join(process.cwd(), 'src', 'assets', 'images', 'marathi_society_header.png'),
          path.join(process.cwd(), 'public', 'images', 'marathi_society_header.png'),
          path.join(process.cwd(), 'dist', 'renderer', 'images', 'marathi_society_header.png'),
          path.join(__dirname, 'marathi_society_header.png'),
          path.join(__dirname, '..', '..', '..', 'assets', 'images', 'marathi_society_header.png'),
        ];
        for (const p of headerCandidates) {
          if (fs.existsSync(p)) {
            try {
              marathiHeaderImg = await doc.embedPng(fs.readFileSync(p));
              break;
            } catch (e) {
              console.error('Failed to embed marathi_society_header.png:', e);
            }
          }
        }
      } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
          const hRes = await fetch('/images/marathi_society_header.png');
          if (hRes.ok) {
            const hBuf = await hRes.arrayBuffer();
            marathiHeaderImg = await doc.embedPng(hBuf);
          }
        } catch (e) {
          console.warn('Browser fetch marathi_society_header failed:', e);
        }
      }
    }

    if (!marathiAckImg && !hasCustomAck && (template === 'HENU_OS_2' || template === 'DESIGN_B_LANDSCAPE')) {
      if (typeof window === 'undefined' && fs && path) {
        const ackCandidates = [
          path.join(process.cwd(), 'src', 'assets', 'images', 'marathi_ack_header.png'),
          path.join(process.cwd(), 'public', 'images', 'marathi_ack_header.png'),
          path.join(process.cwd(), 'dist', 'renderer', 'images', 'marathi_ack_header.png'),
          path.join(__dirname, 'marathi_ack_header.png'),
          path.join(__dirname, '..', '..', '..', 'assets', 'images', 'marathi_ack_header.png'),
        ];
        for (const p of ackCandidates) {
          if (fs.existsSync(p)) {
            try {
              marathiAckImg = await doc.embedPng(fs.readFileSync(p));
              break;
            } catch (e) {
              console.error('Failed to embed marathi_ack_header.png:', e);
            }
          }
        }
      } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
          const aRes = await fetch('/images/marathi_ack_header.png');
          if (aRes.ok) {
            const aBuf = await aRes.arrayBuffer();
            marathiAckImg = await doc.embedPng(aBuf);
          }
        } catch (e) {
          console.warn('Browser fetch marathi_ack_header failed:', e);
        }
      }
    }

    let polarisWordmarkImg: PDFImage | undefined;
    let polarisCompassPurpleImg: PDFImage | undefined;
    let polarisCompassGoldImg: PDFImage | undefined;
    let acknoglementRibbonImg: PDFImage | undefined;
    let sharePolyPurpleImg: PDFImage | undefined;
    let sharePolyGoldImg: PDFImage | undefined;
    let shareRedImg: PDFImage | undefined;
    let leftTopCornerImg: PDFImage | undefined;
    let rightBottomCornerImg: PDFImage | undefined;
    let memberLeftTopCornerImg: PDFImage | undefined;
    let memberRightBottomCornerImg: PDFImage | undefined;
    let shareBlueImg: PDFImage | undefined;

    if (typeof window === 'undefined' && fs && path) {
      const loadImg = async (filenames: string[]): Promise<PDFImage | undefined> => {
        let appPath = '';
        try {
          const electron = require('electron');
          const app = electron.app || (electron.remote && electron.remote.app);
          if (app && typeof app.getAppPath === 'function') {
            appPath = app.getAppPath();
          }
        } catch (e) {}

        const baseDirs = [
          process.cwd(),
          appPath,
          path.join(process.cwd(), 'resources'),
          path.join(__dirname, '..', '..', '..'),
          path.join(__dirname, '..', '..'),
          path.join(__dirname, '..'),
          __dirname,
          'g:\\Astro',
          'G:\\Astro',
        ].filter(Boolean);

        for (const fn of filenames) {
          for (const base of baseDirs) {
            const candidatePaths = [
              path.join(base, 'public', 'images', fn),
              path.join(base, 'src', 'assets', 'images', fn),
              path.join(base, 'Design imgs', fn),
              path.join(base, 'Design imgs', 'Template 4 imgs', fn),
              path.join(base, fn),
            ];
            for (const p of candidatePaths) {
              if (fs.existsSync(p)) {
                try {
                  return await doc.embedPng(fs.readFileSync(p));
                } catch (e) {}
              }
            }
          }
        }
        return undefined;
      };

      polarisWordmarkImg = await loadImg(['polaris_wordmark.png']);
      polarisCompassPurpleImg = await loadImg(['polaris_compass_purple.png']);
      polarisCompassGoldImg = await loadImg(['polaris_compass_gold.png']);
      acknoglementRibbonImg = await loadImg(['acknoglement_ribbon.png', 'Acknoglement.png', 'Acknoglement .png']);
      sharePolyPurpleImg = await loadImg(['share_poly_purple.png', 'Share poly 1.png', 'Share poly 1 .png']);
      sharePolyGoldImg = await loadImg(['share_poly_gold.png', 'Share poly.png', 'Share poly .png']);
      shareRedImg = await loadImg(['Share red.png', 'share_red.png', 'Share red .png']);
      shareBlueImg = await loadImg(['Share blue.png', 'share_blue.png', 'Share blue .png']);
      leftTopCornerImg = await loadImg(['Left top corner.png', 'left_top_corner.png']);
      rightBottomCornerImg = await loadImg(['Right bottom corner.png', 'right_bottom_corner.png']);
      memberLeftTopCornerImg = await loadImg(['Member left top corner.png', 'member_left_top_corner.png']);
      memberRightBottomCornerImg = await loadImg(['Member right bottom corner.png', 'member_right_bottom_corner.png']);
    } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      const fetchImg = async (urls: string[]): Promise<PDFImage | undefined> => {
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (res.ok) return await doc.embedPng(await res.arrayBuffer());
          } catch (e) {}
        }
        return undefined;
      };

      polarisWordmarkImg = await fetchImg(['/images/polaris_wordmark.png']);
      polarisCompassPurpleImg = await fetchImg(['/images/polaris_compass_purple.png']);
      polarisCompassGoldImg = await fetchImg(['/images/polaris_compass_gold.png']);
      acknoglementRibbonImg = await fetchImg(['/images/acknoglement_ribbon.png', '/images/Acknoglement.png']);
      sharePolyPurpleImg = await fetchImg(['/images/share_poly_purple.png', '/images/Share poly 1.png']);
      sharePolyGoldImg = await fetchImg(['/images/share_poly_gold.png', '/images/Share poly.png']);
      shareRedImg = await fetchImg(['/images/Share red.png', '/images/share_red.png']);
      shareBlueImg = await fetchImg(['/images/Share blue.png', '/images/share_blue.png']);
      leftTopCornerImg = await fetchImg(['/images/Left top corner.png', '/images/left_top_corner.png']);
      rightBottomCornerImg = await fetchImg(['/images/Right bottom corner.png', '/images/right_bottom_corner.png']);
      memberLeftTopCornerImg = await fetchImg(['/images/Member left top corner.png', '/images/member_left_top_corner.png']);
      memberRightBottomCornerImg = await fetchImg(['/images/Member right bottom corner.png', '/images/member_right_bottom_corner.png']);
    }

    // Determine Orientation & Canvas Dimensions
    const isPolaris = template === 'HENU_OS_3' || template === 'POLARIS_LUXURY_13X9';
    const isPortrait = template === 'HENU_OS_1' || template === 'DESIGN_A_PORTRAIT' || template === 'DESIGN_B_PORTRAIT';
    const pw = isPolaris ? SIZE_13X9_W : (isPortrait ? SIZE_13X19_H : SIZE_13X19_W);
    const ph = isPolaris ? SIZE_13X9_H : (isPortrait ? SIZE_13X19_W : SIZE_13X19_H);

    for (const item of records) {
      const data = ShareCertificateExcelMapping.mapToCertificateData(item.record, society, item.serial);

      const page1 = doc.addPage([pw, ph]);
      const page2 = doc.addPage([pw, ph]);

      if (template === 'HENU_OS_1' || template === 'DESIGN_A_PORTRAIT') {
        // Template 2: HENU OS 1 (Portrait Custom Ruby/Warm Palette)
        this.drawTemplateHenuOS1_Front(page1, data, society, fonts, pw, ph);
        this.drawTemplateHenuOS1_Back(page2, data, society, fonts, pw, ph);
      } else if (template === 'HENU_OS_2' || template === 'DESIGN_B_LANDSCAPE') {
        // Template 3: HENU OS 2 (Marathi Master Style — English with Share blue ribbon 19" x 13" Landscape)
        this.drawTemplateHenuOS2_Front(page1, data, society, fonts, pw, ph, marathiHeaderImg, marathiAckImg, shareBlueImg);
        this.drawTemplateHenuOS2_Back(page2, data, society, fonts, pw, ph);
      } else if (template === 'HENU_OS_3' || template === 'POLARIS_LUXURY_13X9') {
        // Template 4: Polaris Luxury Master Style (13" x 9" Landscape · Purple & Gold)
        this.drawTemplatePolaris_Front(
          page1, data, society, fonts, pw, ph,
          marathiHeaderImg, marathiAckImg, polarisWordmarkImg, polarisCompassPurpleImg, polarisCompassGoldImg,
          acknoglementRibbonImg, sharePolyPurpleImg, sharePolyGoldImg,
          leftTopCornerImg, rightBottomCornerImg,
          memberLeftTopCornerImg, memberRightBottomCornerImg
        );
        this.drawTemplatePolaris_Back(page2, data, society, fonts, pw, ph, acknoglementRibbonImg);
      } else {
        // Template 1: HENU OS Default (Sai Flora Red/Gold Master)
        this.drawTemplateDefault_Front(page1, data, society, fonts, shareRedImg);
        this.drawTemplateDefault_Back(page2, data, society, fonts);
      }
    }

    const pdfBytes = await doc.save();
    return typeof Buffer !== 'undefined' ? Buffer.from(pdfBytes) : (pdfBytes as any);
  }

  // =========================================================================
  // TEMPLATE 1: HENU OS DEFAULT (Sai Flora Master Style — 19" x 13" Landscape)
  // =========================================================================
  private static drawTemplateDefault_Front(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    shareRedImg?: PDFImage
  ) {
    this.drawCropMarks(page, SIZE_13X19_W, SIZE_13X19_H, SAFE_MARGIN);
    const geo = MASTER_GEOMETRY.FRONT;

    this.drawAckStripDefault(page, geo.ACK.x, geo.ACK.y, geo.ACK.w, geo.ACK.h, data, fonts, shareRedImg);
    this.drawCertPanelDefault(page, geo.SOCIETY_COPY.x, geo.SOCIETY_COPY.y, geo.SOCIETY_COPY.w, geo.SOCIETY_COPY.h, data, 'SOCIETY COPY', fonts, shareRedImg);
    this.drawCertPanelDefault(page, geo.MEMBER_COPY.x, geo.MEMBER_COPY.y, geo.MEMBER_COPY.w, geo.MEMBER_COPY.h, data, 'MEMBER COPY', fonts, shareRedImg);
  }

  private static drawTemplateDefault_Back(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts
  ) {
    this.drawCropMarks(page, SIZE_13X19_W, SIZE_13X19_H, SAFE_MARGIN);
    const geo = MASTER_GEOMETRY.BACK;

    this.drawTransferMemoDefault(page, geo.SOCIETY_MEMO.x, geo.SOCIETY_MEMO.y, geo.SOCIETY_MEMO.w, geo.SOCIETY_MEMO.h, fonts);
    this.drawTransferMemoDefault(page, geo.MEMBER_MEMO.x, geo.MEMBER_MEMO.y, geo.MEMBER_MEMO.w, geo.MEMBER_MEMO.h, fonts);
    this.drawAckStripBackDefault(page, geo.ACK.x, geo.ACK.y, geo.ACK.w, geo.ACK.h, fonts);
  }

  private static drawAckStripDefault(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: ShareCertificateFieldData,
    fonts: Fonts,
    shareRedImg?: PDFImage
  ) {
    // Background and outer border
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(251 / 255, 246 / 255, 227 / 255), borderColor: rgb(193 / 255, 39 / 255, 45 / 255), borderWidth: 2 });
    page.drawRectangle({ x: x + 3, y: y + 3, width: w - 6, height: h - 6, borderColor: rgb(224 / 255, 184 / 255, 76 / 255), borderWidth: 1 });
    const cx = x + w / 2;

    const ribbonH = 38;
    const ribbonY = y + h - 52;
    if (shareRedImg) {
      page.drawImage(shareRedImg, { x: x + 8, y: ribbonY, width: w - 16, height: ribbonH });
    } else {
      // Red / gold ribbon banner
      page.drawRectangle({ x: x + 8, y: ribbonY, width: w - 16, height: ribbonH, color: rgb(193 / 255, 39 / 255, 45 / 255), borderColor: rgb(224 / 255, 184 / 255, 76 / 255), borderWidth: 1.5 });
      drawCentered(page, 'Share Certificate', fonts.timesBold, 15, cx, ribbonY + 11, rgb(255 / 255, 255 / 255, 255 / 255));
    }

    const socName = (data.societyName || 'MULUND AMIT').replace(/CO-OPERATIVE.*$/i, '').trim();
    const socLines = wrapText(socName, fonts.bold, 13, w - 16);
    socLines.slice(0, 2).forEach((ln, i) => {
      const sz = fitFontSize(ln, fonts.bold, 13, w - 16);
      drawCentered(page, ln, fonts.bold, sz, cx, y + h - 78 - i * 16, rgb(143 / 255, 28 / 255, 32 / 255));
    });

    const legal = 'CO-OPERATIVE HOUSING SOCIETY LTD.';
    const legalLines = wrapText(legal, fonts.bold, 9.5, w - 16);
    legalLines.slice(0, 2).forEach((ln, i) => {
      const sz = fitFontSize(ln, fonts.bold, 9.5, w - 16);
      drawCentered(page, ln, fonts.bold, sz, cx, y + h - 114 - i * 13, rgb(143 / 255, 28 / 255, 32 / 255));
    });

    drawCentered(page, 'ACKNOWLEDGEMENT', fonts.bold, 12.5, cx, y + h - 148, rgb(26 / 255, 26 / 255, 26 / 255));
    page.drawLine({ start: { x: x + 8, y: y + h - 156 }, end: { x: x + w - 8, y: y + h - 156 }, color: rgb(180 / 255, 180 / 255, 180 / 255), thickness: 1 });

    const topY = y + h - 166;
    const bottomY = y + 18;
    const availH = topY - bottomY;
    const boxGap = 14;
    const boxH = (availH - (2 * boxGap)) / 3;

    for (let b = 0; b < 3; b++) {
      const by = topY - (b + 1) * boxH - b * boxGap;
      page.drawRectangle({ x: x + 6, y: by, width: w - 12, height: boxH, color: rgb(255 / 255, 255 / 255, 255 / 255), borderColor: rgb(200 / 255, 200 / 255, 200 / 255), borderWidth: 1 });

      const nameVal = b === 0 ? data.receiver1Name : b === 1 ? data.receiver2Name : data.receiver3Name;
      const panVal = b === 0 ? data.receiver1PanAadhaar : b === 1 ? data.receiver2PanAadhaar : data.receiver3PanAadhaar;
      const mobVal = b === 0 ? data.receiver1Mobile : b === 1 ? data.receiver2Mobile : data.receiver3Mobile;

      const innerPad = 10;
      const lineLeft = x + 6 + innerPad;
      const lineRight = x + w - 6 - innerPad;
      const sectionSpacing = (boxH - 20) / 4;

      // 1. Name of Receivers (Single solid line with generous writing space)
      const nameSecY = by + boxH - 18;
      page.drawText('Name of Receivers :-', { x: lineLeft, y: nameSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const nameLineY = nameSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: nameLineY }, end: { x: lineRight, y: nameLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });
      if (nameVal) {
        const nSz = fitFontSize(nameVal.toUpperCase(), fonts.bold, 9.5, lineRight - lineLeft - 4, 7);
        page.drawText(nameVal.toUpperCase(), { x: lineLeft + 2, y: nameLineY + 3, size: nSz, font: fonts.bold, color: COLOR_BLACK });
      }

      // 2. PAN / Aadhar Card No.
      const panSecY = by + boxH - 18 - sectionSpacing;
      page.drawText('PAN / Aadhar Card No. :-', { x: lineLeft, y: panSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const panLineY = panSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: panLineY }, end: { x: lineRight, y: panLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });
      if (panVal) {
        const pSz = fitFontSize(panVal.toUpperCase(), fonts.bold, 9.5, lineRight - lineLeft - 4, 7);
        page.drawText(panVal.toUpperCase(), { x: lineLeft + 2, y: panLineY + 3, size: pSz, font: fonts.bold, color: COLOR_BLACK });
      }

      // 3. Mobile No.
      const mobSecY = by + boxH - 18 - sectionSpacing * 2;
      page.drawText('Mobile No. :-', { x: lineLeft, y: mobSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const mobLineY = mobSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: mobLineY }, end: { x: lineRight, y: mobLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });
      if (mobVal) {
        const mSz = fitFontSize(mobVal, fonts.bold, 9.5, lineRight - lineLeft - 4, 7);
        page.drawText(mobVal, { x: lineLeft + 2, y: mobLineY + 3, size: mSz, font: fonts.bold, color: COLOR_BLACK });
      }

      // 4. Signature
      const sigSecY = by + boxH - 18 - sectionSpacing * 3;
      page.drawText('Signature :-', { x: lineLeft, y: sigSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const sigLineY = sigSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: sigLineY }, end: { x: lineRight, y: sigLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });
    }
  }

  private static drawCertPanelDefault(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: ShareCertificateFieldData,
    copyType: 'SOCIETY COPY' | 'MEMBER COPY',
    fonts: Fonts,
    shareRedImg?: PDFImage
  ) {
    this.drawOrnateBorderDefault(page, x, y, w, h);
    const iX = x + 24;
    const iW = w - 48;
    const cx = x + w / 2;

    // ── 1. Topline Metadata Rows (2-Row Balanced Format with Increased Bold Font Size ~10.5pt) ──
    const metaY1 = y + h - 28;
    const metaY2 = metaY1 - 18;
    const metaFontSize = 10.5;

    const row1Items = [
      { label: 'Serial No.: ', val: String(data.serialNo || '001') },
      { label: 'Share Certificate No.: ', val: String(data.shareCertificateNo || '001') },
      { label: "Member's Register No.: ", val: String(data.memberRegisterNo || '001') },
    ];

    const row2Items = [
      { label: 'No. of Shares : ', val: `${String(data.noOfShares || '10')}${data.sharesInWords ? `(${String(data.sharesInWords).split(' ')[0]})` : ''}` },
      { label: 'Flat No.: ', val: String(data.flatNo || '') },
    ];

    const renderMetaRow = (items: { label: string; val: string }[], rowY: number) => {
      let totalW = 0;
      const measured = items.map(item => {
        const lblW = fonts.bold.widthOfTextAtSize(item.label, metaFontSize);
        const valW = Math.max(fonts.bold.widthOfTextAtSize(item.val, metaFontSize), 16);
        totalW += lblW + valW;
        return { ...item, lblW, valW, itemW: lblW + valW };
      });

      const gap = items.length > 1 ? Math.max(0, (iW - 16 - totalW) / (items.length - 1)) : 0;
      let curX = iX + 8;
      measured.forEach(item => {
        page.drawText(item.label, { x: curX, y: rowY, size: metaFontSize, font: fonts.bold, color: COLOR_BLACK });
        const valX = curX + item.lblW;
        page.drawText(item.val, { x: valX, y: rowY, size: metaFontSize, font: fonts.bold, color: COLOR_BLACK });
        page.drawLine({ start: { x: valX, y: rowY - 2 }, end: { x: valX + item.valW, y: rowY - 2 }, color: COLOR_BLACK, thickness: 0.9 });
        curX += item.itemW + gap;
      });
    };

    renderMetaRow(row1Items, metaY1);
    renderMetaRow(row2Items, metaY2);

    // ── 2. Ribbon Banner (Preserve Natural Elegant Aspect Ratio ~ 3.55:1) ──
    const ribbonW = 280;
    const ribbonH = 78;
    const ribbonX = x + (w - ribbonW) / 2;
    const ribbonY = metaY2 - 82;

    if (shareRedImg) {
      page.drawImage(shareRedImg, { x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH });
    } else {
      // Outer fold shadow
      page.drawRectangle({ x: ribbonX - 8, y: ribbonY + 4, width: ribbonW + 16, height: ribbonH - 8, color: rgb(143 / 255, 28 / 255, 32 / 255) });
      // Main red banner body
      page.drawRectangle({ x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH, color: rgb(193 / 255, 39 / 255, 45 / 255), borderColor: rgb(224 / 255, 184 / 255, 76 / 255), borderWidth: 2 });
      page.drawRectangle({ x: ribbonX + 3, y: ribbonY + 3, width: ribbonW - 6, height: ribbonH - 6, borderColor: rgb(245 / 255, 220 / 255, 120 / 255), borderWidth: 1 });
      
      // Ribbon banner title text
      drawCentered(page, 'Share Certificate', fonts.timesBold, 25, cx, ribbonY + 13, rgb(255 / 255, 255 / 255, 255 / 255));
    }

    // ── 3. Authorised Share Capital (12.25pt Font) ──
    const capY = ribbonY - 24;
    const authCap = cleanCurrency(data.authorisedCapital, '1,00,000');
    const totShares = data.totalAuthorisedShares || '2000';
    const faceVal = cleanCurrency(data.faceValue, '50');
    const capText = `AUTHORISED SHARE CAPITAL OF Rs. ${authCap} DIVIDED INTO ${totShares} SHARES OF RS. ${faceVal} EACH`;
    const capSz = fitFontSize(capText, fonts.bold, 12.25, iW - 16, 8);
    drawCentered(page, capText, fonts.bold, capSz, cx, capY, COLOR_BLACK);

    // ── 4. Society Title & Subtitle ──
    const fullSoc = data.societyName || 'SAI FLORA CO-OPERATIVE HOUSING SOCIETY LTD.';
    const socMain = fullSoc.replace(/CO-OPERATIVE.*$/i, '').trim() || 'SAI FLORA';
    const socSub = fullSoc.toUpperCase().includes('CO-OPERATIVE')
      ? fullSoc.substring(fullSoc.toUpperCase().indexOf('CO-OPERATIVE')).trim()
      : 'CO-OPERATIVE HOUSING SOCIETY LTD.';

    const socTitleY = capY - 54;
    const socSz = fitFontSize(socMain, fonts.timesBold, 38, iW - 16, 18);
    drawCentered(page, socMain, fonts.timesBold, socSz, cx, socTitleY, rgb(193 / 255, 39 / 255, 45 / 255));

    const socSubY = socTitleY - 30;
    const subSz = fitFontSize(socSub, fonts.bold, 18, iW - 16, 11);
    drawCentered(page, socSub, fonts.bold, subSz, cx, socSubY, rgb(193 / 255, 39 / 255, 45 / 255));

    // ── 5. Society Address & Act Registration ──
    const addr = data.societyAddress || 'SAI COMPLEX, NAVGHAR ROAD, MULUND (EAST), MUMBAI - 400 081.';
    const addrY = socSubY - 26;
    const addrLines = wrapText(addr, fonts.bold, 12.5, iW - 16);
    addrLines.slice(0, 2).forEach((ln, i) => {
      drawCentered(page, ln, fonts.bold, 12.5, cx, addrY - i * 16, rgb(26 / 255, 63 / 255, 122 / 255));
    });

    const actY = addrY - (addrLines.length * 16) - 6;
    drawCentered(page, 'Registered under the Maharashtra Co-operative Societies Act, 1960', fonts.bold, 10.5, cx, actY, rgb(26 / 255, 26 / 255, 26 / 255));

    const regdNoY = actY - 18;
    const regStr = `( Regd. No. : ${data.registrationNo || 'BOM/WT/HSG/(TC)/8847 2003-2004'}, DATED - ${data.registrationDate || '07.04.2003'} )`;
    drawCentered(page, regStr, fonts.bold, 10.5, cx, regdNoY, rgb(193 / 255, 39 / 255, 45 / 255));

    // ── 6. THIS IS TO CERTIFY THAT (Double Underline Row — Safe Margins Inside Borders) ──
    const certY = regdNoY - 36;
    const certLabel = 'THIS IS TO CERTIFY THAT';
    page.drawText(certLabel, { x: iX + 8, y: certY, size: 12, font: fonts.reg, color: COLOR_BLACK });

    const nameStartX = iX + 8 + fonts.reg.widthOfTextAtSize(certLabel, 12) + 8;
    const nameEndX = iX + iW - 12;
    const certY2 = certY - 20;

    // Line 1 & Line 2 underlines
    page.drawLine({ start: { x: nameStartX, y: certY - 2 }, end: { x: nameEndX, y: certY - 2 }, color: COLOR_BLACK, thickness: 0.9 });
    page.drawLine({ start: { x: iX + 8, y: certY2 - 2 }, end: { x: nameEndX, y: certY2 - 2 }, color: COLOR_BLACK, thickness: 0.9 });

    const holderName = (data.memberName || 'MR. SANJAY BABURAO NIKALJI').toUpperCase();
    if (holderName) {
      const maxLine1W = nameEndX - nameStartX - 10;
      const fitsLine1 = fonts.bold.widthOfTextAtSize(holderName, 12) <= maxLine1W;
      if (fitsLine1) {
        page.drawText(holderName, { x: nameStartX + 6, y: certY + 1, size: 12, font: fonts.bold, color: COLOR_BLACK });
      } else {
        const parts = holderName.split(/,\s*/);
        if (parts.length > 1) {
          const line1Text = parts[0] + (parts.length > 2 ? ', ' + parts[1] : '');
          const line2Text = parts.length > 2 ? parts.slice(2).join(', ') : parts[1];
          const sz1 = fitFontSize(line1Text, fonts.bold, 12, maxLine1W, 8.5);
          page.drawText(line1Text, { x: nameStartX + 6, y: certY + 1, size: sz1, font: fonts.bold, color: COLOR_BLACK });
          const sz2 = fitFontSize(line2Text, fonts.bold, 12, iW - 24, 8.5);
          page.drawText(line2Text, { x: iX + 12, y: certY2 + 1, size: sz2, font: fonts.bold, color: COLOR_BLACK });
        } else {
          const sz = fitFontSize(holderName, fonts.bold, 12, maxLine1W, 8.5);
          page.drawText(holderName, { x: nameStartX + 6, y: certY + 1, size: sz, font: fonts.bold, color: COLOR_BLACK });
        }
      }
    }

    // ── 7. Word-Wrapped Body Text Paragraphs ──
    const sharesInWords = data.sharesInWords || 'TEN (10)';
    const sharesCount = data.faceValue ? `${data.faceValue}/-` : '50/-';
    const sFrom = data.sharesFrom || '001';
    const sTo = data.sharesTo || '010';

    const fullBodyText = `is/are the Registered Holders of ${sharesInWords} fully paid - up Share of Rupees ${sharesCount} each numbered from  ${sFrom}  to  ${sTo}  both inclusive in ${fullSoc} ${addr} Subject to the Bye - laws of the Said Society.`;
    const wrappedBodyLines = wrapText(fullBodyText, fonts.reg, 11.5, iW - 16);

    const bodyY = certY2 - 24;
    wrappedBodyLines.forEach((line, idx) => {
      page.drawText(line, { x: iX + 8, y: bodyY - idx * 19, size: 11.5, font: fonts.reg, color: COLOR_BLACK });
    });

    const sealLineY = bodyY - (wrappedBodyLines.length * 19) - 16;
    const issueDateStr = formatIssueDate(data.issueDate, data.issueCity || 'MUMBAI');
    page.drawText(issueDateStr, { x: iX + 8, y: sealLineY, size: 11.5, font: fonts.reg, color: COLOR_BLACK });

    // ── 8. Stamp Box & In-Lieu-of Text Block ──
    const lowerY = sealLineY - 26;
    const stampW = 96;
    const stampH = 46;
    const stampX = iX + 8;
    const stampY = lowerY - stampH + 12;

    // Stamp box with double border
    page.drawRectangle({ x: stampX, y: stampY, width: stampW, height: stampH, color: rgb(255 / 255, 255 / 255, 255 / 255), borderColor: COLOR_BLACK, borderWidth: 1.8 });
    page.drawText('Rs.', { x: stampX + 8, y: stampY + 15, size: 15, font: fonts.bold, color: COLOR_BLACK });
    const rawValShares = data.valueOfShares || (data.faceValue ? `${parseInt(String(data.faceValue).replace(/\D/g, '') || '50', 10) * parseInt(String(data.noOfShares || '10').replace(/\D/g, '') || '10', 10)}` : '500');
    const formattedValShares = cleanCurrency(rawValShares, '500');
    page.drawText(formattedValShares, { x: stampX + 38, y: stampY + 15, size: 15, font: fonts.bold, color: COLOR_BLACK });

    const lieuX = stampX + stampW + 14;
    const lieuW = iW - stampW - 26;
    const lieuText = `This Share Certificate is issued in lieu of the Old Share Certificate No. ${data.oldCertificateNo || '001'} for fully paid Shares of Rupees ${faceVal} each, numbered from ${data.oldSharesFrom || sFrom} to ${data.oldSharesTo || sTo}, and the members name(s) are mentioned below as per the society's records -`;
    const lieuLines = wrapText(lieuText, fonts.reg, 10.5, lieuW);
    lieuLines.forEach((ln, i) => {
      page.drawText(ln, { x: lieuX, y: lowerY - i * 16, size: 10.5, font: fonts.reg, color: COLOR_BLACK });
    });

    // ── 9. Owners Lines (Full Vertical Distribution: 60pt spacing per owner block) ──
    const ownersStartY = stampY - 44;
    const owners = [
      { label: '1st OWNER :-', val: data.member1 || data.memberName },
      { label: '2nd OWNER :-', val: data.member2 || '' },
      { label: '3rd OWNER :-', val: data.member3 || '' },
    ];

    owners.forEach((ow, oi) => {
      const row1Y = ownersStartY - oi * 60;
      const row2Y = row1Y - 24;

      // Line 1: Label + Member Name underline
      page.drawText(ow.label, { x: iX + 8, y: row1Y, size: 12, font: fonts.bold, color: COLOR_BLACK });
      const owLineStartX = iX + 8 + fonts.bold.widthOfTextAtSize(ow.label, 12) + 10;
      const owLineEndX = iX + iW - 12;
      page.drawLine({ start: { x: owLineStartX, y: row1Y - 2 }, end: { x: owLineEndX, y: row1Y - 2 }, color: rgb(51 / 255, 51 / 255, 51 / 255), thickness: 0.8 });
      if (ow.val) {
        const valSz = fitFontSize(ow.val.toUpperCase(), fonts.bold, 12, owLineEndX - owLineStartX - 10, 8);
        page.drawText(ow.val.toUpperCase(), { x: owLineStartX + 8, y: row1Y + 1, size: valSz, font: fonts.bold, color: COLOR_BLACK });
      }

      // Line 2: Empty underline spanning the entire width
      page.drawLine({ start: { x: iX + 8, y: row2Y - 2 }, end: { x: owLineEndX, y: row2Y - 2 }, color: rgb(51 / 255, 51 / 255, 51 / 255), thickness: 0.8 });
    });

    // ── 10. Seal & Signatures Footer (Contained Cleanly Above Red Footer Line) ──
    const sealCX = iX + 54;
    const sealCY = y + 84;
    const sealR = 38;
    page.drawCircle({ x: sealCX, y: sealCY, size: sealR, borderColor: rgb(184 / 255, 169 / 255, 143 / 255), borderWidth: 2 });
    drawCentered(page, 'Seal of the', fonts.italic, 9.5, sealCX, sealCY + 4, rgb(184 / 255, 169 / 255, 143 / 255));
    drawCentered(page, 'Society', fonts.italic, 9.5, sealCX, sealCY - 8, rgb(184 / 255, 169 / 255, 143 / 255));

    const sigLineY = y + 80;
    const sigLabelY = y + 58;
    const sigAreaX = iX + 120;
    const sigAreaW = iW - 132;
    const sigSlotW = sigAreaW / 3;

    const sigLabels = ['Hon. Chairman', 'Hon. Secretary', 'Authorised M.C. Member'];
    sigLabels.forEach((lbl, si) => {
      const slotX = sigAreaX + si * sigSlotW;
      const lineW = sigSlotW - 16;
      const lineX = slotX + 8;
      page.drawLine({ start: { x: lineX, y: sigLineY }, end: { x: lineX + lineW, y: sigLineY }, color: rgb(51 / 255, 51 / 255, 51 / 255), thickness: 1 });
      const lsz = fitFontSize(lbl, fonts.bold, 11, lineW, 7.5);
      drawCentered(page, lbl, fonts.bold, lsz, lineX + lineW / 2, sigLabelY, COLOR_BLACK);
    });

    // ── 11. Bottom Copy Label Bar ──
    const footBarY = y + 22;
    page.drawLine({ start: { x: iX + 4, y: footBarY + 16 }, end: { x: iX + iW - 4, y: footBarY + 16 }, color: rgb(193 / 255, 39 / 255, 45 / 255), thickness: 2.5 });
    drawCentered(page, copyType, fonts.bold, 12, cx, footBarY, rgb(143 / 255, 28 / 255, 32 / 255));
    page.drawText('P.T.O.', { x: iX + iW - 48, y: footBarY, size: 11, font: fonts.bold, color: rgb(143 / 255, 28 / 255, 32 / 255) });
  }

  private static drawOrnateBorderDefault(page: PDFPage, x: number, y: number, w: number, h: number) {
    // Cream background fill
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(251 / 255, 246 / 255, 227 / 255) });

    // Subtle security diamond lattice pattern inside
    const gridStep = 18;
    const startX = x + 16;
    const endX = x + w - 16;
    const startY = y + 16;
    const endY = y + h - 16;
    const meshColor = rgb(238 / 255, 226 / 255, 202 / 255);

    // Diagonal lines (45 deg)
    for (let lx = startX - h; lx < endX + h; lx += gridStep) {
      const x1 = Math.max(startX, lx);
      const y1 = startY + (x1 - lx);
      const x2 = Math.min(endX, lx + (endY - startY));
      const y2 = startY + (x2 - lx);
      if (y1 <= endY && y2 >= startY && x1 <= endX && x2 >= startX) {
        page.drawLine({
          start: { x: Math.max(startX, Math.min(endX, x1)), y: Math.max(startY, Math.min(endY, y1)) },
          end: { x: Math.max(startX, Math.min(endX, x2)), y: Math.max(startY, Math.min(endY, y2)) },
          color: meshColor,
          thickness: 0.4,
        });
      }
    }

    // Diagonal lines (-45 deg)
    for (let lx = startX; lx < endX + h * 2; lx += gridStep) {
      const x1 = Math.min(endX, lx);
      const y1 = startY + (lx - x1);
      const x2 = Math.max(startX, lx - (endY - startY));
      const y2 = startY + (lx - x2);
      if (y1 <= endY && y2 >= startY && x1 >= startX && x2 <= endX) {
        page.drawLine({
          start: { x: Math.max(startX, Math.min(endX, x1)), y: Math.max(startY, Math.min(endY, y1)) },
          end: { x: Math.max(startX, Math.min(endX, x2)), y: Math.max(startY, Math.min(endY, y2)) },
          color: meshColor,
          thickness: 0.4,
        });
      }
    }

    // Outer rich borders
    page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(193 / 255, 39 / 255, 45 / 255), borderWidth: 3 });
    page.drawRectangle({ x: x + 4, y: y + 4, width: w - 8, height: h - 8, borderColor: rgb(224 / 255, 184 / 255, 76 / 255), borderWidth: 1.5 });
    page.drawRectangle({ x: x + 8, y: y + 8, width: w - 16, height: h - 16, borderColor: rgb(143 / 255, 28 / 255, 32 / 255), borderWidth: 0.8 });
    page.drawRectangle({ x: x + 12, y: y + 12, width: w - 24, height: h - 24, borderColor: rgb(193 / 255, 39 / 255, 45 / 255), borderWidth: 0.5 });

    const corners = [
      [x + 9, y + 9],
      [x + w - 9, y + 9],
      [x + 9, y + h - 9],
      [x + w - 9, y + h - 9],
    ];
    corners.forEach(([cx, cy]) => {
      page.drawRectangle({ x: cx - 4, y: cy - 4, width: 8, height: 8, color: GOLD_ACCENT, borderColor: RED_MAROON, borderWidth: 0.5 });
    });
  }

  private static drawTransferMemoDefault(page: PDFPage, x: number, y: number, w: number, h: number, fonts: Fonts) {
    // Plain white / clean background
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(255 / 255, 255 / 255, 255 / 255), borderColor: COLOR_BLACK, borderWidth: 1.2 });

    // ── Top Title Box ──
    const headH = 30;
    const headY = y + h - headH;
    page.drawRectangle({ x, y: headY, width: w, height: headH, borderColor: COLOR_BLACK, borderWidth: 1 });
    const headerText = 'MEMORANDUM OF TRANSFERS OF THE WITHIN MENTIONED SHARES';
    const htSz = fitFontSize(headerText, fonts.bold, 11.5, w - 20, 8);
    drawCentered(page, headerText, fonts.bold, htSz, x + w / 2, headY + 9, RED_VIBRANT);

    // ── Column Headers (Equal compact widths for first 3 columns) ──
    const colHeadH = 38;
    const colY = headY - colHeadH;
    const col1W = 46; // Compact Date of transfer
    const col2W = 44; // Transfer No.
    const col3W = 46; // Register No. of transfer
    const col5W = 58; // Register No. of transferee
    const col4W = w - col1W - col2W - col3W - col5W; // To whom Transfered

    const cols = [
      { label: 'Date of\ntransfer', w: col1W },
      { label: 'Transfer\nNo.', w: col2W },
      { label: 'Register No.\nof transfer', w: col3W },
      { label: 'To whom Transfered', w: col4W },
      { label: 'Register No.\nof transferee', w: col5W },
    ];

    let cx2 = x;
    cols.forEach(col => {
      page.drawRectangle({ x: cx2, y: colY, width: col.w, height: colHeadH, borderColor: COLOR_BLACK, borderWidth: 0.8 });
      const lines = col.label.split('\n');
      const colCX = cx2 + col.w / 2;
      lines.forEach((ln, li) => {
        const sz = fitFontSize(ln, fonts.bold, 8.2, col.w - 2, 6);
        drawCentered(page, ln, fonts.bold, sz, colCX, colY + colHeadH - 14 - li * 12, RED_VIBRANT);
      });
      cx2 += col.w;
    });

    const dataAreaH = colY - y;
    const rowH = dataAreaH / 5;

    for (let r = 0; r < 5; r++) {
      const ry = colY - (r + 1) * rowH;
      const midY = ry + rowH * 0.46; // Middle horizontal divider line

      // Full outer row box
      page.drawRectangle({ x, y: ry, width: w, height: rowH, borderColor: COLOR_BLACK, borderWidth: 0.8 });

      // Col 1: Date of transfer (vertical divider stops at midY)
      const col1Right = x + col1W;
      page.drawLine({ start: { x: col1Right, y: midY }, end: { x: col1Right, y: ry + rowH }, color: COLOR_BLACK, thickness: 0.8 });

      // ── SEAL Circle (Positioned Directly Below Transfer No. & Register No. of transfer) ──
      const sealR = 40;
      const sealCX = col1Right + (col2W + col3W) / 2; // Exactly centered under col 2 & col 3
      const sealCY = midY;

      // Col 2: Transfer No. (vertical divider ends at top of SEAL circle arch)
      const col2Right = col1Right + col2W;
      const col2Top = ry + rowH;
      const col2Bottom = sealCY + sealR;
      if (col2Top > col2Bottom) {
        page.drawLine({ start: { x: col2Right, y: col2Bottom }, end: { x: col2Right, y: col2Top }, color: COLOR_BLACK, thickness: 0.8 });
      }

      // Col 3: Register No. of transfer (vertical divider down to midY)
      const col3Right = col2Right + col3W;
      page.drawLine({ start: { x: col3Right, y: midY }, end: { x: col3Right, y: ry + rowH }, color: COLOR_BLACK, thickness: 0.8 });

      // Col 5: Register No. of transferee (vertical divider all the way down)
      const col5Left = x + w - col5W;
      page.drawLine({ start: { x: col5Left, y: ry }, end: { x: col5Left, y: ry + rowH }, color: COLOR_BLACK, thickness: 0.8 });

      // Middle divider line: from left edge of row across to left edge of seal
      page.drawLine({ start: { x, y: midY }, end: { x: sealCX - sealR, y: midY }, color: COLOR_BLACK, thickness: 0.8 });

      // Middle divider line: from right edge of seal across to Col 5 left
      page.drawLine({ start: { x: sealCX + sealR, y: midY }, end: { x: col5Left, y: midY }, color: COLOR_BLACK, thickness: 0.8 });

      // Circular SEAL cutout with inner subtle ring
      page.drawCircle({ x: sealCX, y: sealCY, size: sealR, color: rgb(255 / 255, 255 / 255, 255 / 255), borderColor: COLOR_BLACK, borderWidth: 1 });
      page.drawCircle({ x: sealCX, y: sealCY, size: sealR - 3, borderColor: rgb(215 / 255, 215 / 255, 215 / 255), borderWidth: 0.6 });
      drawCentered(page, 'SEAL', fonts.timesBold, 14, sealCX, sealCY - 5, rgb(190 / 255, 190 / 255, 190 / 255));

      // ── 3 Signatures on Bottom Half (To the Right of the Seal) ──
      const sigStartX = sealCX + sealR + 10;
      const sigAreaW = col5Left - sigStartX - 8;
      const sigSlotW = sigAreaW / 3;

      const sigLabels = ['Hon. Chairman', 'Hon. Secretary', 'Authorised M.C. Member'];
      sigLabels.forEach((lbl, si) => {
        const sx = sigStartX + si * sigSlotW;
        const lineW = sigSlotW - 14;
        const lineX = sx + 7;
        const lineY = ry + 26;
        const lblY = ry + 10;

        // Black underline
        page.drawLine({ start: { x: lineX, y: lineY }, end: { x: lineX + lineW, y: lineY }, color: COLOR_BLACK, thickness: 0.9 });
        // Bold red label
        const lsz = fitFontSize(lbl, fonts.bold, 8.5, lineW, 6);
        drawCentered(page, lbl, fonts.bold, lsz, lineX + lineW / 2, lblY, RED_VIBRANT);
      });
    }
  }

  private static drawAckStripBackDefault(page: PDFPage, x: number, y: number, w: number, h: number, fonts: Fonts) {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(255 / 255, 255 / 255, 255 / 255), borderColor: COLOR_BLACK, borderWidth: 1.2 });

    const boxCount = 5;
    const boxGap = 10;
    const boxH = (h - 20 - ((boxCount + 1) * boxGap)) / boxCount;

    for (let b = 0; b < boxCount; b++) {
      const by = y + h - 12 - (b + 1) * (boxH + boxGap);
      page.drawRectangle({ x: x + 6, y: by, width: w - 12, height: boxH, color: rgb(255 / 255, 255 / 255, 255 / 255), borderColor: COLOR_BLACK, borderWidth: 0.8 });

      const fields = [
        'Name ___________________________',
        'PAN / Aadhar No. ________________',
        'Mob. No. _______________________',
        'Signature ______________________',
      ];

      const fieldSpacing = (boxH - 18) / fields.length;
      fields.forEach((fld, fi) => {
        const fy = by + boxH - 18 - fi * fieldSpacing;
        page.drawText(fld, { x: x + 12, y: fy, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
      });
    }
  }

  // =========================================================================
  // TEMPLATE 2: HENU OS 1 (Portrait Master Style — #FFF7EB / #CC3A63 Palette)
  // =========================================================================
  private static drawTemplateHenuOS1_Front(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    pw: number,
    ph: number
  ) {
    // Fill Primary Light Background (#FFF7EB)
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: C1_BG_LIGHT });

    const m = SAFE_MARGIN;
    const w = pw - (2 * m); // 840
    const h = ph - (2 * m); // 1272
    const cx = pw / 2;

    // Outer Decorative Ruby/Olive Border
    page.drawRectangle({ x: m, y: m, width: w, height: h, borderColor: C1_RUBY_RED, borderWidth: 2.5 });
    page.drawRectangle({ x: m + 4, y: m + 4, width: w - 8, height: h - 8, borderColor: C1_ACCENT_OLV, borderWidth: 1 });
    page.drawRectangle({ x: m + 8, y: m + 8, width: w - 16, height: h - 16, borderColor: C1_RUBY_RED, borderWidth: 0.6 });

    // Header Title
    let curY = m + h - 36;
    drawCentered(page, 'SHARE CERTIFICATE', fonts.timesBold, 20, cx, curY, C1_RUBY_RED);

    // Society Name in Bold Ruby Red
    curY -= 36;
    const socName = data.societyName || 'CO-OPERATIVE HOUSING SOCIETY LTD.';
    const socSz = fitFontSize(socName, fonts.timesBold, 24, w - 40, 14);
    drawCentered(page, socName, fonts.timesBold, socSz, cx, curY, C1_RUBY_RED);

    // Subheading & Address
    curY -= 22;
    const legalName = data.societyLegalName || 'CO-OPERATIVE HOUSING SOCIETY LTD.';
    drawCentered(page, legalName, fonts.bold, 12, cx, curY, C1_RUBY_RED);

    curY -= 18;
    const addr = data.societyAddress || 'MUMBAI';
    drawCentered(page, addr, fonts.reg, 9.5, cx, curY, COLOR_BLACK);

    curY -= 16;
    drawCentered(page, '(Registered under the Maharashtra Co-operative Societies Act, 1960)', fonts.italic, 8.5, cx, curY, COLOR_BLACK);

    curY -= 14;
    const regNoDate = `Regd. No.: ${data.registrationNo}  Dated: ${data.registrationDate}`;
    drawCentered(page, regNoDate, fonts.bold, 9, cx, curY, C1_RUBY_RED);

    // Metadata Box (Secondary BG #F9F0E0)
    curY -= 70;
    const metaBoxH = 60;
    page.drawRectangle({ x: m + 16, y: curY, width: w - 32, height: metaBoxH, color: C1_BG_SEC, borderColor: C1_ACCENT_OLV, borderWidth: 1 });

    const colW = (w - 32) / 2;
    page.drawText(`Serial No.: ${data.serialNo}`, { x: m + 26, y: curY + 42, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    page.drawText(`Share Certificate No.: ${data.shareCertificateNo}`, { x: m + 26 + colW, y: curY + 42, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    page.drawText(`Member's Register No.: ${data.memberRegisterNo}`, { x: m + 26, y: curY + 24, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    page.drawText(`No. of Shares: ${data.noOfShares}`, { x: m + 26 + colW, y: curY + 24, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    page.drawText(`Wing: ${data.wingNo || '-'}   |   Flat/Shop No.: ${data.flatNo}`, { x: m + 26, y: curY + 6, size: 8.5, font: fonts.bold, color: COLOR_BLACK });

    // Authorised Share Capital Band
    curY -= 36;
    page.drawRectangle({ x: m + 16, y: curY, width: w - 32, height: 26, color: C1_BG_SEC, borderColor: C1_RUBY_RED, borderWidth: 0.8 });
    const authText = `(AUTHORISED SHARE CAPITAL OF Rs. ${data.authorisedCapital})  DIVIDED INTO ${data.totalAuthorisedShares} SHARES OF Rs. ${data.faceValue} EACH`;
    drawCentered(page, authText, fonts.bold, 8.5, cx, curY + 8, C1_RUBY_RED);

    // Certification Box & Member Holders
    curY -= 150;
    const certBoxH = 135;
    page.drawRectangle({ x: m + 16, y: curY, width: w - 32, height: certBoxH, color: C1_BG_LIGHT, borderColor: C1_RUBY_RED, borderWidth: 0.8 });
    page.drawText('THIS IS TO CERTIFY THAT', { x: m + 26, y: curY + certBoxH - 18, size: 9, font: fonts.bold, color: C1_RUBY_RED });

    const holders = [
      data.member1 || data.memberName || 'HOLDER 1',
      data.member2 || '',
      data.member3 || '',
    ].filter(Boolean);

    holders.slice(0, 3).forEach((hName, hi) => {
      const hy = curY + certBoxH - 42 - hi * 32;
      page.drawText(`${hi + 1}.  ${hName.toUpperCase()}`, { x: m + 32, y: hy + 4, size: 9.5, font: fonts.bold, color: COLOR_BLACK });
      page.drawLine({ start: { x: m + 32, y: hy }, end: { x: m + w - 48, y: hy }, color: C1_ACCENT_OLV, thickness: 0.5 });
    });

    // Registered Holders Paragraph
    curY -= 100;
    const paraLines = [
      `is/are the Registered Holder(s) of ${data.sharesInWords || data.noOfShares} fully paid-up Share(s)`,
      `of Rupees ${data.faceValue} each numbered from ${data.sharesFrom} to ${data.sharesTo} both inclusive in ${data.societyName}.`,
      `${data.societyAddress}`,
      `Subject to the Bye-laws of the Said Society.`,
    ];
    paraLines.forEach((ln, li) => {
      page.drawText(ln, { x: m + 20, y: curY + 70 - li * 18, size: 9, font: fonts.reg, color: COLOR_BLACK });
    });

    // Issue Statement & Rupee Box
    curY -= 80;
    page.drawRectangle({ x: m + 20, y: curY, width: 90, height: 32, color: C1_RUBY_RED });
    drawCentered(page, `Rs. ${data.valueOfShares}`, fonts.timesBold, 15, m + 20 + 45, curY + 10, COLOR_WHITE);

    const issueText = `Given under the Common Seal of the Said Society on ${data.issueDate || '01.01.2025'} at ${data.issueCity || 'MUMBAI'}.`;
    page.drawText(issueText, { x: m + 120, y: curY + 12, size: 8.5, font: fonts.reg, color: COLOR_BLACK });

    // Seal & Signatures
    curY -= 130;
    const sealX = m + 90;
    const sealY = curY + 50;
    page.drawCircle({ x: sealX, y: sealY, size: 45, borderColor: C1_ACCENT_OLV, borderWidth: 1.5 });
    drawCentered(page, 'COMMON SEAL', fonts.bold, 8, sealX, sealY - 3, C1_ACCENT_OLV);

    const sigLabels = ['Hon. Chairman', 'Hon. Secretary', 'Authorised M.C. Member'];
    const sigSlotW = (w - 240) / 3;
    sigLabels.forEach((lbl, si) => {
      const sx = m + 220 + si * sigSlotW;
      page.drawLine({ start: { x: sx, y: curY + 55 }, end: { x: sx + sigSlotW - 20, y: curY + 55 }, color: C1_RUBY_RED, thickness: 0.8 });
      drawCentered(page, lbl, fonts.reg, 8.5, sx + (sigSlotW - 20) / 2, curY + 40, COLOR_BLACK);
    });

    // Footer
    drawCentered(page, 'SOCIETY COPY', fonts.bold, 10, cx, m + 18, C1_RUBY_RED);
    page.drawText('P.T.O.', { x: m + w - 45, y: m + 18, size: 9, font: fonts.bold, color: C1_RUBY_RED });
  }

  private static drawTemplateHenuOS1_Back(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    pw: number,
    ph: number
  ) {
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: C1_BG_LIGHT });

    const m = SAFE_MARGIN;
    const w = pw - (2 * m);
    const h = ph - (2 * m);
    const cx = pw / 2;

    page.drawRectangle({ x: m, y: m, width: w, height: h, borderColor: C1_RUBY_RED, borderWidth: 2 });

    let curY = m + h - 28;
    drawCentered(page, 'MEMORANDUM OF TRANSFERS OF THE WITHIN MENTIONED SHARES', fonts.bold, 10, cx, curY, C1_RUBY_RED);

    // 5 Transfer Table Rows
    curY -= 40;
    const tableTop = curY;
    const rowH = 90;
    const colW = [110, 90, 110, w - 420, 110];

    const colHeaders = ['Date of transfer', 'Transfer No.', 'Register No. of transfer', 'To whom Transferred', 'Register No. of transferee'];
    let curX = m;
    colHeaders.forEach((hdr, ci) => {
      page.drawRectangle({ x: curX, y: tableTop, width: colW[ci], height: 28, color: C1_BG_SEC, borderColor: C1_RUBY_RED, borderWidth: 0.5 });
      drawCentered(page, hdr, fonts.bold, 7.5, curX + colW[ci] / 2, tableTop + 9, C1_RUBY_RED);
      curX += colW[ci];
    });

    for (let r = 0; r < 5; r++) {
      const ry = tableTop - (r + 1) * rowH;
      curX = m;
      colW.forEach((cw) => {
        page.drawRectangle({ x: curX, y: ry, width: cw, height: rowH, borderColor: C1_RUBY_RED, borderWidth: 0.5 });
        curX += cw;
      });
    }

    // 2 Receiver Blocks at Bottom
    const botY = m + 20;
    const recH = 70;
    for (let r = 0; r < 2; r++) {
      const ry = botY + (1 - r) * (recH + 8);
      page.drawRectangle({ x: m + 10, y: ry, width: w - 20, height: recH, color: C1_BG_SEC, borderColor: C1_ACCENT_OLV, borderWidth: 0.8 });
      page.drawText(`RECEIVED BY: Name: __________________________________   Date: ______________`, { x: m + 20, y: ry + 46, size: 8, font: fonts.reg, color: COLOR_BLACK });
      page.drawText(`PAN / Aadhaar No.: ___________________________   Mobile: _____________________`, { x: m + 20, y: ry + 28, size: 8, font: fonts.reg, color: COLOR_BLACK });
      page.drawText(`Signature: _______________________________________________________________`, { x: m + 20, y: ry + 10, size: 8, font: fonts.reg, color: COLOR_BLACK });
    }
  }

  // =========================================================================
  // TEMPLATE 3: HENU OS 2 (Marathi Master Style — 19" x 13" Landscape)
  // Palette: Royal Violet & Lavender (#42326E / #E0D4FC)
  // =========================================================================
  private static drawOrnateBorderViolet(page: PDFPage, x: number, y: number, w: number, h: number) {
    page.drawRectangle({ x, y, width: w, height: h, color: C3_BG_LIGHT, borderColor: C3_VIOLET_DARK, borderWidth: 2.2 });
    page.drawRectangle({ x: x + 4, y: y + 4, width: w - 8, height: h - 8, borderColor: C3_LAVENDER_MIST, borderWidth: 1 });
    page.drawRectangle({ x: x + 8, y: y + 8, width: w - 16, height: h - 16, borderColor: C3_VIOLET_MED, borderWidth: 0.8 });
    page.drawRectangle({ x: x + 12, y: y + 12, width: w - 24, height: h - 24, borderColor: C3_LILAC, borderWidth: 0.5 });
    const corners = [
      [x + 9, y + 9],
      [x + w - 9, y + 9],
      [x + 9, y + h - 9],
      [x + w - 9, y + h - 9],
    ];
    corners.forEach(([cx, cy]) => {
      page.drawRectangle({ x: cx - 4, y: cy - 4, width: 8, height: 8, color: C3_LILAC, borderColor: C3_VIOLET_DARK, borderWidth: 0.5 });
    });
  }

  // =========================================================================
  // TEMPLATE 3: HENU OS 2 (English Style with Royal Violet & Share Blue Ribbon — 19" x 13" Landscape)
  // =========================================================================
  private static drawTemplateHenuOS2_Front(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    pw: number,
    ph: number,
    headerImg?: PDFImage,
    ackImg?: PDFImage,
    shareBlueImg?: PDFImage
  ) {
    this.drawCropMarks(page, SIZE_13X19_W, SIZE_13X19_H, SAFE_MARGIN);
    const geo = MASTER_GEOMETRY.FRONT;

    this.drawAckStripMarathi(page, geo.ACK.x, geo.ACK.y, geo.ACK.w, geo.ACK.h, data, fonts, ackImg, shareBlueImg);
    this.drawCertPanelMarathi(page, geo.SOCIETY_COPY.x, geo.SOCIETY_COPY.y, geo.SOCIETY_COPY.w, geo.SOCIETY_COPY.h, data, 'SOCIETY COPY', fonts, headerImg, shareBlueImg);
    this.drawCertPanelMarathi(page, geo.MEMBER_COPY.x, geo.MEMBER_COPY.y, geo.MEMBER_COPY.w, geo.MEMBER_COPY.h, data, 'MEMBER COPY', fonts, headerImg, shareBlueImg);
  }

  private static drawTemplateHenuOS2_Back(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    pw: number,
    ph: number
  ) {
    this.drawCropMarks(page, SIZE_13X19_W, SIZE_13X19_H, SAFE_MARGIN);
    const geo = MASTER_GEOMETRY.BACK;

    this.drawTransferMemoMarathi(page, geo.SOCIETY_MEMO.x, geo.SOCIETY_MEMO.y, geo.SOCIETY_MEMO.w, geo.SOCIETY_MEMO.h, fonts);
    this.drawTransferMemoMarathi(page, geo.MEMBER_MEMO.x, geo.MEMBER_MEMO.y, geo.MEMBER_MEMO.w, geo.MEMBER_MEMO.h, fonts);
    this.drawAckBackMarathi(page, geo.ACK.x, geo.ACK.y, geo.ACK.w, geo.ACK.h, fonts);
  }

  // ── Template 3 Front: Acknowledgement Strip (English) ──
  private static drawAckStripMarathi(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: ShareCertificateFieldData,
    fonts: Fonts,
    ackImg?: PDFImage,
    shareBlueImg?: PDFImage
  ) {
    const cx = x + w / 2;

    // Background fill & border in Royal Violet & Lavender Palette (#42326E / #E0D4FC)
    page.drawRectangle({ x, y, width: w, height: h, color: C3_BG_PRIMARY, borderColor: C3_VIOLET_DARK, borderWidth: 1.5 });
    page.drawRectangle({ x: x + 4, y: y + 4, width: w - 8, height: h - 8, borderColor: C3_LAVENDER_MIST, borderWidth: 1 });

    // Top Ribbon: Share Certificate (Share blue.png)
    const ribbonW = w - 16;
    const ribbonH = 38;
    const ribbonX = x + 8;
    const ribbonY = y + h - 50;

    if (shareBlueImg) {
      page.drawImage(shareBlueImg, { x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH });
    } else {
      page.drawRectangle({ x: ribbonX - 8, y: ribbonY + 4, width: ribbonW + 16, height: ribbonH - 8, color: C3_VIOLET_MED });
      page.drawRectangle({ x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH, color: C3_VIOLET_DARK, borderColor: C3_GOLD, borderWidth: 1.5 });
      page.drawRectangle({ x: ribbonX + 2, y: ribbonY + 2, width: ribbonW - 4, height: ribbonH - 4, borderColor: C3_LAVENDER_MIST, borderWidth: 0.8 });
      drawCentered(page, 'SHARE CERTIFICATE', fonts.bold, 13.5, cx, ribbonY + 11, COLOR_WHITE);
    }

    let pochY = ribbonY - 145;

    if (ackImg) {
      // User-uploaded Image 2 cleanly replaces the ack header space with larger prominent display
      const ackImgW = w - 16;
      const ackImgH = 125;
      const ackImgY = ribbonY - ackImgH - 12;
      page.drawImage(ackImg, { x: x + 8, y: ackImgY, width: ackImgW, height: ackImgH });
      pochY = ackImgY - 10;
    } else {
      // Default Society Header text & Subtitle
      const fullSoc = data.societyName || 'HENU OS PVT LTD CO-SOC';
      const socY = ribbonY - 24;
      const socSz = fitFontSize(fullSoc, fonts.bold, 11.25, w - 24, 8);
      drawCentered(page, fullSoc, fonts.bold, socSz, cx, socY, C3_VIOLET_DARK);
      drawCentered(page, 'CO-OPERATIVE HOUSING SOCIETY LIMITED.', fonts.bold, 6.8, cx, socY - 14, C3_VIOLET_DARK);

      const addr = data.societyAddress || 'MUMBAI';
      const addrLines = wrapText(addr, fonts.reg, 7.75, w - 24);
      addrLines.slice(0, 2).forEach((ln, idx) => {
        drawCentered(page, ln, fonts.reg, 7.75, cx, socY - 26 - idx * 10, COLOR_BLACK);
      });
      pochY = socY - 28 - (Math.min(addrLines.length, 2) * 10);
    }

    // Ornate Badge: • ACKNOWLEDGEMENT •
    page.drawRectangle({ x: cx - 68, y: pochY - 20, width: 136, height: 22, color: COLOR_WHITE, borderColor: C3_VIOLET_DARK, borderWidth: 1.5 });
    drawCentered(page, '• ACKNOWLEDGEMENT •', fonts.bold, 9.5, cx, pochY - 14, C3_VIOLET_DARK);

    // 3 Member Receipt Blocks filling remaining vertical height completely (Zero blank space)
    const startRecY = pochY - 28;
    const blockCount = 3;
    const blockH = (startRecY - (y + 14)) / blockCount;
    const owners = [data.member1 || data.memberName, data.member2, data.member3];

    for (let i = 0; i < blockCount; i++) {
      const by = startRecY - (i + 1) * blockH;
      page.drawRectangle({ x: x + 8, y: by + 4, width: w - 16, height: blockH - 8, color: COLOR_WHITE, borderColor: C3_VIOLET_DARK, borderWidth: 0.8 });

      const lineLeft = x + 14;
      const lineRight = x + w - 14;
      const sectionSpacing = (blockH - 8) / 4;

      // 1. Name of Receivers
      const nameSecY = by + blockH - 18;
      page.drawText('Name :-', { x: lineLeft, y: nameSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const nameLineY = nameSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: nameLineY }, end: { x: lineRight, y: nameLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });
      const rName = owners[i];
      if (rName) {
        const nSz = fitFontSize(rName, fonts.bold, 9.5, lineRight - lineLeft - 4, 7.5);
        page.drawText(rName, { x: lineLeft + 2, y: nameLineY + 3, size: nSz, font: fonts.bold, color: COLOR_BLACK });
      }

      // 2. PAN / Aadhar Card No.
      const panSecY = by + blockH - 18 - sectionSpacing;
      page.drawText('PAN / Aadhar Card No. :-', { x: lineLeft, y: panSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const panLineY = panSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: panLineY }, end: { x: lineRight, y: panLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });

      // 3. Mobile No.
      const mobSecY = by + blockH - 18 - sectionSpacing * 2;
      page.drawText('Mobile No. :-', { x: lineLeft, y: mobSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const mobLineY = mobSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: mobLineY }, end: { x: lineRight, y: mobLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });

      // 4. Signature
      const sigSecY = by + blockH - 18 - sectionSpacing * 3;
      page.drawText('Signature :-', { x: lineLeft, y: sigSecY, size: 9.5, font: fonts.bold, color: rgb(51 / 255, 51 / 255, 51 / 255) });
      const sigLineY = sigSecY - 20;
      page.drawLine({ start: { x: lineLeft, y: sigLineY }, end: { x: lineRight, y: sigLineY }, color: rgb(140 / 255, 140 / 255, 140 / 255), thickness: 0.8 });
    }
  }

  // ── Template 3 Front: Certificate Panel (English with Share blue.png Ribbon) ──
  private static drawCertPanelMarathi(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: ShareCertificateFieldData,
    copyType: 'SOCIETY COPY' | 'MEMBER COPY',
    fonts: Fonts,
    headerImg?: PDFImage,
    shareBlueImg?: PDFImage
  ) {
    this.drawOrnateBorderViolet(page, x, y, w, h);
    const iX = x + 24;
    const iW = w - 48;
    const cx = x + w / 2;

    // ── 1. Topline Metadata Row (Proportional 5-Column Grid in English) ──
    const metaY = y + h - 36;
    const metaItems = [
      { label: 'Serial No. : ', val: data.serialNo || '001' },
      { label: 'Share Certificate No. : ', val: data.shareCertificateNo || '001' },
      { label: "Member's Regn. No. : ", val: data.memberRegisterNo || '001' },
      { label: 'No. of Shares : ', val: `${data.noOfShares || '10'}${data.sharesInWords ? `(${data.sharesInWords.split(' ')[0]})` : ''}` },
      { label: 'Flat No. : ', val: data.flatNo || '' },
    ];

    const colWidths = [0.15, 0.24, 0.25, 0.22, 0.14];
    const availMetaW = iW - 32;
    let colStartX = iX + 16;

    metaItems.forEach((item, colIdx) => {
      const colW = availMetaW * colWidths[colIdx];
      const maxValW = Math.max(10, colW - fonts.bold.widthOfTextAtSize(item.label, 8.25) - 4);
      const valFontSize = fitFontSize(item.val, fonts.bold, 8.25, maxValW, 5.5);
      const lblFontSize = Math.min(8.25, valFontSize + 0.5);
      const lblW = fonts.bold.widthOfTextAtSize(item.label, lblFontSize);

      page.drawText(item.label, { x: colStartX, y: metaY, size: lblFontSize, font: fonts.bold, color: COLOR_BLACK });
      const valX = colStartX + lblW + 1;
      page.drawText(item.val, { x: valX, y: metaY, size: valFontSize, font: fonts.bold, color: COLOR_BLACK });
      page.drawLine({ start: { x: valX, y: metaY - 2 }, end: { x: colStartX + colW - 4, y: metaY - 2 }, color: COLOR_BLACK, thickness: 0.7 });

      colStartX += colW;
    });

    // ── 2. Top Ribbon Banner (Share blue.png with Natural Aspect Ratio ~ 2.96:1) ──
    const ribbonW = 320;
    const ribbonH = 88;
    const ribbonX = cx - ribbonW / 2;
    const ribbonY = metaY - 92;

    if (shareBlueImg) {
      page.drawImage(shareBlueImg, { x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH });
    } else {
      page.drawRectangle({ x: ribbonX - 8, y: ribbonY + 4, width: ribbonW + 16, height: ribbonH - 8, color: C3_VIOLET_MED });
      page.drawRectangle({ x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH, color: C3_VIOLET_DARK, borderColor: C3_GOLD, borderWidth: 2 });
      page.drawRectangle({ x: ribbonX + 3, y: ribbonY + 3, width: ribbonW - 6, height: ribbonH - 6, borderColor: C3_LAVENDER_MIST, borderWidth: 1 });
      drawCentered(page, 'SHARE CERTIFICATE', fonts.timesBold, 22, cx, ribbonY + 14, COLOR_WHITE);
    }

    // ── 3. Authorised Share Capital Line (English) ──
    const capY = ribbonY - 24;
    const authCap = cleanCurrency(data.authorisedCapital, '1,00,000');
    const totShares = data.totalAuthorisedShares || '2,000';
    const faceVal = cleanCurrency(data.faceValue, '50');
    const capText = `( AUTHORISED SHARE CAPITAL OF Rs. ${authCap} DIVIDED INTO ${totShares} SHARES OF RS. ${faceVal} EACH )`;
    const capSz = fitFontSize(capText, fonts.bold, 10.25, iW - 36, 7.0);
    drawCentered(page, capText, fonts.bold, capSz, cx, capY, COLOR_BLACK);

    // ── 4. Society Header Banner ──
    let curY = capY - 54;
    if (headerImg) {
      const cardH = 120;
      const cardY = capY - cardH - 12;
      const cardX = iX + 8;
      const cardW = iW - 16;
      page.drawImage(headerImg, { x: cardX, y: cardY, width: cardW, height: cardH });
      curY = cardY - 14;
    } else {
      const fullSoc = data.societyName || 'HENU OS PVT LTD CO-SOC';
      const socMain = fullSoc.replace(/CO-OPERATIVE.*$/i, '').trim() || fullSoc;
      const socSub = fullSoc.toUpperCase().includes('CO-OPERATIVE')
        ? fullSoc.substring(fullSoc.toUpperCase().indexOf('CO-OPERATIVE')).trim()
        : 'CO-OPERATIVE HOUSING SOCIETY LIMITED.';

      const socSz = fitFontSize(socMain, fonts.timesBold, 36.75, iW - 16, 18);
      drawCentered(page, socMain, fonts.timesBold, socSz, cx, curY, C3_VIOLET_DARK);

      curY -= 30;
      const subSz = fitFontSize(socSub, fonts.bold, 18.75, iW - 16, 11);
      drawCentered(page, socSub, fonts.bold, subSz, cx, curY, C3_VIOLET_DARK);

      curY -= 26;
      const addr = data.societyAddress || 'HOME BHAGESAR, 10B-204 SECOND FLOOR, MUMBAI';
      const addrLines = wrapText(addr, fonts.reg, 12.5, iW - 16);
      addrLines.slice(0, 2).forEach((ln, i) => {
        drawCentered(page, ln, fonts.reg, 12.5, cx, curY - i * 16, rgb(26 / 255, 63 / 255, 122 / 255));
      });
      curY -= (addrLines.length * 16) + 6;

      drawCentered(page, '( Registered under the Maharashtra Co-operative Societies Act, 1960 )', fonts.bold, 11.25, cx, curY, rgb(26 / 255, 26 / 255, 26 / 255));
      curY -= 18;

      const regStr = `( Registration No. : ${data.registrationNo || 'BOM/WT/HSG/(TC)/8847 2003-2004'}, DATE : ${data.registrationDate || '07.04.2003'} )`;
      drawCentered(page, regStr, fonts.bold, 11.25, cx, curY, C3_VIOLET_DARK);
      curY -= 20;
    }

    // ── 5. THIS IS TO CERTIFY THAT (Double Underline Row in English) ──
    const certY = curY - 12;
    const certLabel = 'THIS IS TO CERTIFY THAT Shri. / Smt. : ';
    page.drawText(certLabel, { x: iX + 16, y: certY, size: 11.75, font: fonts.reg, color: COLOR_BLACK });

    const nameStartX = iX + 16 + fonts.reg.widthOfTextAtSize(certLabel, 11.75) + 8;
    const nameEndX = iX + iW - 16;
    const certY2 = certY - 18;

    page.drawLine({ start: { x: nameStartX, y: certY - 2 }, end: { x: nameEndX, y: certY - 2 }, color: COLOR_BLACK, thickness: 0.9 });
    page.drawLine({ start: { x: iX + 16, y: certY2 - 2 }, end: { x: nameEndX, y: certY2 - 2 }, color: COLOR_BLACK, thickness: 0.9 });

    const holderName = (data.memberName || 'AARAV01, VIKRAM01, RAJENDRA01').toUpperCase();
    if (holderName) {
      const maxLine1W = nameEndX - nameStartX - 10;
      const fitsLine1 = fonts.bold.widthOfTextAtSize(holderName, 11.75) <= maxLine1W;
      if (fitsLine1) {
        page.drawText(holderName, { x: nameStartX + 4, y: certY + 1, size: 11.75, font: fonts.bold, color: COLOR_BLACK });
      } else {
        const parts = holderName.split(/,\s*/);
        if (parts.length > 1) {
          const line1Text = parts[0] + (parts.length > 2 ? ', ' + parts[1] : '');
          const line2Text = parts.length > 2 ? parts.slice(2).join(', ') : parts[1];
          const sz1 = fitFontSize(line1Text, fonts.bold, 11.75, maxLine1W, 8.5);
          page.drawText(line1Text, { x: nameStartX + 4, y: certY + 1, size: sz1, font: fonts.bold, color: COLOR_BLACK });
          const sz2 = fitFontSize(line2Text, fonts.bold, 11.75, iW - 36, 8.5);
          page.drawText(line2Text, { x: iX + 20, y: certY2 + 1, size: sz2, font: fonts.bold, color: COLOR_BLACK });
        } else {
          const sz = fitFontSize(holderName, fonts.bold, 11.75, maxLine1W, 8.5);
          page.drawText(holderName, { x: nameStartX + 4, y: certY + 1, size: sz, font: fonts.bold, color: COLOR_BLACK });
        }
      }
    }

    // ── 6. Word-Wrapped Body Text Paragraphs (English) ──
    const sharesInWords = data.sharesInWords || 'TEN (10)';
    const sharesCount = data.faceValue ? `${data.faceValue}/-` : '50/-';
    const sFrom = data.sharesFrom || '101';
    const sTo = data.sharesTo || '101';
    const fullSoc = data.societyName || 'HENU OS PVT LTD CO-SOC';
    const addr = data.societyAddress || 'MUMBAI';

    const fullBodyText = `is/are the Registered Holder of ${sharesInWords} fully paid up shares of Rs. ${sharesCount} each numbered from ${sFrom} to ${sTo} (both Inclusive) in ${fullSoc}, ${addr}. Subject to the Bye-laws of the said society.`;
    const wrappedBodyLines = wrapText(fullBodyText, fonts.reg, 11.25, iW - 36);

    const bodyY = certY2 - 22;
    wrappedBodyLines.forEach((line, idx) => {
      page.drawText(line, { x: iX + 16, y: bodyY - idx * 17, size: 11.25, font: fonts.reg, color: COLOR_BLACK });
    });

    const sealLineY = bodyY - (wrappedBodyLines.length * 17) - 14;
    const issueDateStr = `Given under the Common Seal of the said society on this ${data.issueDate || '___'}.`;
    page.drawText(issueDateStr, { x: iX + 16, y: sealLineY, size: 11.25, font: fonts.reg, color: COLOR_BLACK });

    // ── 7. Stamp Box & In-Lieu-of Text Block (English) ──
    const lowerY = sealLineY - 24;
    const stampW = 96;
    const stampH = 44;
    const stampX = iX + 16;
    const stampY = lowerY - stampH + 12;

    page.drawRectangle({ x: stampX, y: stampY, width: stampW, height: stampH, color: COLOR_WHITE, borderColor: COLOR_BLACK, borderWidth: 1.8 });
    page.drawText('Rs.', { x: stampX + 8, y: stampY + 14, size: 15.75, font: fonts.bold, color: COLOR_BLACK });
    const rawValShares = data.valueOfShares || (data.faceValue ? `${parseInt(String(data.faceValue).replace(/\D/g, '') || '50', 10) * parseInt(String(data.noOfShares || '11').replace(/\D/g, '') || '11', 10)}` : '550');
    const formattedValShares = cleanCurrency(rawValShares, '550');
    page.drawText(formattedValShares, { x: stampX + 38, y: stampY + 14, size: 15.75, font: fonts.bold, color: COLOR_BLACK });

    const lieuX = stampX + stampW + 16;
    const lieuW = iW - stampW - 48;
    const lieuText = `This Share Certificate is issued in lieu of Old Share Certificate No. ${data.oldCertificateNo || '001'} for Rs. ${faceVal}/- fully paid up shares numbered from ${data.oldSharesFrom || sFrom} to ${data.oldSharesTo || sTo} and the names of the members as per society records are as follows -`;
    const lieuLines = wrapText(lieuText, fonts.reg, 10.25, lieuW);
    lieuLines.forEach((ln, i) => {
      page.drawText(ln, { x: lieuX, y: lowerY - i * 15, size: 10.25, font: fonts.reg, color: COLOR_BLACK });
    });

    // ── 8. 3 Owners Lines (English) ──
    const ownersStartY = stampY - 38;
    const owners = [
      { label: '1st OWNER :-', val: data.member1 || data.memberName },
      { label: '2nd OWNER :-', val: data.member2 || '' },
      { label: '3rd OWNER :-', val: data.member3 || '' },
    ];

    owners.forEach((ow, oi) => {
      const row1Y = ownersStartY - oi * 68;
      const row2Y = row1Y - 24;

      page.drawText(ow.label, { x: iX + 16, y: row1Y, size: 10.75, font: fonts.bold, color: COLOR_BLACK });
      const owLblW = fonts.bold.widthOfTextAtSize(ow.label, 10.75);
      const owValStartX = iX + 16 + owLblW + 8;
      const owValEndX = iX + iW - 16;

      page.drawLine({ start: { x: owValStartX, y: row1Y - 2 }, end: { x: owValEndX, y: row1Y - 2 }, color: COLOR_BLACK, thickness: 0.9 });
      page.drawLine({ start: { x: iX + 16, y: row2Y - 2 }, end: { x: owValEndX, y: row2Y - 2 }, color: COLOR_BLACK, thickness: 0.9 });

      const owVal = (ow.val || '').trim().toUpperCase();
      if (owVal) {
        const maxRow1W = owValEndX - owValStartX - 10;
        const fitsRow1 = fonts.bold.widthOfTextAtSize(owVal, 11.25) <= maxRow1W;
        if (fitsRow1) {
          page.drawText(owVal, { x: owValStartX + 4, y: row1Y + 1, size: 11.25, font: fonts.bold, color: COLOR_BLACK });
        } else {
          const parts = owVal.split(/,\s*/);
          if (parts.length > 1) {
            const r1 = parts[0] + (parts.length > 2 ? ', ' + parts[1] : '');
            const r2 = parts.length > 2 ? parts.slice(2).join(', ') : parts[1];
            const sz1 = fitFontSize(r1, fonts.bold, 11.25, maxRow1W, 8.25);
            page.drawText(r1, { x: owValStartX + 4, y: row1Y + 1, size: sz1, font: fonts.bold, color: COLOR_BLACK });
            const sz2 = fitFontSize(r2, fonts.bold, 11.25, iW - 36, 8.25);
            page.drawText(r2, { x: iX + 20, y: row2Y + 1, size: sz2, font: fonts.bold, color: COLOR_BLACK });
          } else {
            const sz = fitFontSize(owVal, fonts.bold, 11.25, maxRow1W, 8.25);
            page.drawText(owVal, { x: owValStartX + 4, y: row1Y + 1, size: sz, font: fonts.bold, color: COLOR_BLACK });
          }
        }
      }
    });

    // ── 9. Common Seal Circle & 3 Signature Blocks (English) ──
    const sigRowY = y + 62;
    const sealCircleR = 34;
    const sealCircleCX = iX + 46;
    const sealCircleCY = sigRowY + 18;

    page.drawCircle({ x: sealCircleCX, y: sealCircleCY, size: sealCircleR, color: COLOR_WHITE, borderColor: C3_VIOLET_MED, borderWidth: 1 });
    page.drawCircle({ x: sealCircleCX, y: sealCircleCY, size: sealCircleR - 3, borderColor: C3_LAVENDER_MIST, borderWidth: 0.6 });
    drawCentered(page, 'Seal of the', fonts.timesRoman, 9.75, sealCircleCX, sealCircleCY + 4, C3_VIOLET_MED);
    drawCentered(page, 'Society', fonts.timesRoman, 9.75, sealCircleCX, sealCircleCY - 8, C3_VIOLET_MED);

    const sigColStartX = sealCircleCX + sealCircleR + 24;
    const sigColAreaW = iW - (sigColStartX - iX) - 8;
    const sigColW = sigColAreaW / 3;
    const sigs = ['Hon. Chairman', 'Hon. Secretary', 'Authorised M.C. Member'];

    sigs.forEach((sigTitle, si) => {
      const scx = sigColStartX + si * sigColW;
      const slineW = sigColW - 14;
      const slineX = scx + 7;
      const slineY = sigRowY + 28;

      page.drawLine({ start: { x: slineX, y: slineY }, end: { x: slineX + slineW, y: slineY }, color: COLOR_BLACK, thickness: 0.9 });
      const ssz = fitFontSize(sigTitle, fonts.bold, 10.75, slineW, 7.5);
      drawCentered(page, sigTitle, fonts.bold, ssz, slineX + slineW / 2, sigRowY + 10, C3_VIOLET_DARK);
    });

    // ── 10. Bottom Copy Label Bar ──
    const footBarY = y + 22;
    page.drawLine({ start: { x: iX + 4, y: footBarY + 16 }, end: { x: iX + iW - 4, y: footBarY + 16 }, color: C3_VIOLET_DARK, thickness: 2.5 });
    drawCentered(page, copyType, fonts.bold, 12.75, cx, footBarY, C3_VIOLET_DARK);
    page.drawText('P.T.O.', { x: iX + iW - 65, y: footBarY, size: 9.75, font: fonts.bold, color: COLOR_BLACK });
  }

  // ── Template 3 Back: Transfer Memorandum (5 Columns in English) ──
  private static drawTransferMemoMarathi(page: PDFPage, x: number, y: number, w: number, h: number, fonts: Fonts) {
    this.drawOrnateBorderViolet(page, x, y, w, h);
    const iX = x + 24;
    const iW = w - 48;
    const iY = y + 24;
    const iH = h - 48;
    const cx = x + w / 2;

    // ── Top Title Box ──
    const headH = 32;
    const headY = iY + iH - headH;
    page.drawRectangle({ x: iX, y: headY, width: iW, height: headH, color: C3_BG_PRIMARY, borderColor: C3_VIOLET_DARK, borderWidth: 1 });
    const headerText = 'MEMORANDUM OF TRANSFERS OF THE WITHIN MENTIONED SHARES';
    const htSz = fitFontSize(headerText, fonts.bold, 11.5, iW - 20, 8);
    drawCentered(page, headerText, fonts.bold, htSz, cx, headY + 10, C3_VIOLET_DARK);

    // ── Column Headers (5 Columns in English) ──
    const colHeadH = 38;
    const colY = headY - colHeadH;
    const col1W = 52; // Date of Transfer
    const col2W = 46; // Transfer No.
    const col3W = 54; // Register No.
    const col5W = 64; // Member No.
    const col4W = iW - col1W - col2W - col3W - col5W; // Transferee Name

    const cols = [
      { label: 'Date of\nTransfer', w: col1W },
      { label: 'Transfer\nNo.', w: col2W },
      { label: 'Register\nNo.', w: col3W },
      { label: 'Name of Transferee in Full', w: col4W },
      { label: 'Member\nNo.', w: col5W },
    ];

    let cx2 = iX;
    cols.forEach(col => {
      page.drawRectangle({ x: cx2, y: colY, width: col.w, height: colHeadH, color: C3_BG_LIGHT, borderColor: C3_VIOLET_DARK, borderWidth: 0.8 });
      const lines = col.label.split('\n');
      const colCX = cx2 + col.w / 2;
      lines.forEach((ln, li) => {
        const sz = fitFontSize(ln, fonts.bold, 8.0, col.w - 2, 5.5);
        drawCentered(page, ln, fonts.bold, sz, colCX, colY + colHeadH - 14 - li * 11, C3_VIOLET_DARK);
      });
      cx2 += col.w;
    });

    const dataAreaH = colY - iY;
    const rowH = dataAreaH / 5;

    for (let r = 0; r < 5; r++) {
      const ry = colY - (r + 1) * rowH;
      const midY = ry + rowH * 0.46; // Middle horizontal divider line

      // Full outer row box
      page.drawRectangle({ x: iX, y: ry, width: iW, height: rowH, borderColor: C3_VIOLET_DARK, borderWidth: 0.8 });

      // Col 1: Date of transfer (vertical divider stops at midY)
      const col1Right = iX + col1W;
      page.drawLine({ start: { x: col1Right, y: midY }, end: { x: col1Right, y: ry + rowH }, color: C3_VIOLET_DARK, thickness: 0.8 });

      // ── SEAL Circle (Positioned Directly Below Col 2 & Col 3) ──
      const sealR = 38;
      const sealCX = col1Right + (col2W + col3W) / 2;
      const sealCY = midY;

      // Col 2: Transfer No. (vertical divider ends at top of SEAL circle arch)
      const col2Right = col1Right + col2W;
      const col2Top = ry + rowH;
      const col2Bottom = sealCY + sealR;
      if (col2Top > col2Bottom) {
        page.drawLine({ start: { x: col2Right, y: col2Bottom }, end: { x: col2Right, y: col2Top }, color: C3_VIOLET_DARK, thickness: 0.8 });
      }

      // Col 3: Register No. of transfer (vertical divider down to midY)
      const col3Right = col2Right + col3W;
      const col3Top = ry + rowH;
      const col3Bottom = sealCY + sealR;
      if (col3Top > col3Bottom) {
        page.drawLine({ start: { x: col3Right, y: col3Bottom }, end: { x: col3Right, y: col3Top }, color: C3_VIOLET_DARK, thickness: 0.8 });
      }

      // Middle divider line: from left edge of row across to left edge of seal
      page.drawLine({ start: { x: iX, y: midY }, end: { x: sealCX - sealR, y: midY }, color: C3_VIOLET_DARK, thickness: 0.8 });

      // Middle divider line: from right edge of seal across to Col 5 left
      const col5Left = iX + iW - col5W;
      page.drawLine({ start: { x: sealCX + sealR, y: midY }, end: { x: col5Left, y: midY }, color: C3_VIOLET_DARK, thickness: 0.8 });

      // Col 4 & Col 5: Vertical divider (top half only)
      const col4Right = col3Right + col4W;
      page.drawLine({ start: { x: col4Right, y: midY }, end: { x: col4Right, y: ry + rowH }, color: C3_VIOLET_DARK, thickness: 0.8 });
      page.drawLine({ start: { x: col5Left, y: ry }, end: { x: col5Left, y: ry + rowH }, color: C3_VIOLET_DARK, thickness: 0.8 });

      page.drawCircle({ x: sealCX, y: sealCY, size: sealR, color: COLOR_WHITE, borderColor: C3_VIOLET_DARK, borderWidth: 0.8 });
      drawCentered(page, 'SEAL', fonts.timesRoman, 8.5, sealCX, sealCY - 3, rgb(110 / 255, 91 / 255, 154 / 255));

      // ── 3 Signatures on Bottom Half (To the Right of the Seal) ──
      const sigStartX = sealCX + sealR + 10;
      const sigAreaW = col5Left - sigStartX - 8;
      const sigSlotW = sigAreaW / 3;

      const sigLabels = ['Hon. Chairman', 'Hon. Secretary', 'Authorised M.C. Member'];

      sigLabels.forEach((lbl, si) => {
        const sx = sigStartX + si * sigSlotW;
        const lineW = sigSlotW - 12;
        const lineX = sx + 6;
        const lineY = ry + 24;
        const lblY = ry + 8;

        // Underline
        page.drawLine({ start: { x: lineX, y: lineY }, end: { x: lineX + lineW, y: lineY }, color: COLOR_BLACK, thickness: 0.9 });
        // Bold label in deep violet
        const lsz = fitFontSize(lbl, fonts.bold, 8, lineW, 5.5);
        drawCentered(page, lbl, fonts.bold, lsz, lineX + lineW / 2, lblY, C3_VIOLET_DARK);
      });
    }
  }

  // ── Template 3 Back: Ack Back Panel (English) ──
  private static drawAckBackMarathi(page: PDFPage, x: number, y: number, w: number, h: number, fonts: Fonts) {
    page.drawRectangle({ x, y, width: w, height: h, color: C3_BG_PRIMARY, borderColor: C3_VIOLET_DARK, borderWidth: 1.5 });
    page.drawRectangle({ x: x + 4, y: y + 4, width: w - 8, height: h - 8, borderColor: C3_LAVENDER_MIST, borderWidth: 1 });

    const boxCount = 5;
    const boxGap = 8;
    const boxH = (h - 24 - ((boxCount + 1) * boxGap)) / boxCount;

    for (let b = 0; b < boxCount; b++) {
      const by = y + h - 14 - (b + 1) * (boxH + boxGap);
      page.drawRectangle({ x: x + 8, y: by, width: w - 16, height: boxH, color: COLOR_WHITE, borderColor: C3_VIOLET_DARK, borderWidth: 0.8 });

      const fields = [
        'Name :- _________________________',
        'PAN / Aadhar No. :- ____________',
        'Mobile No. :- ___________________',
        'Signature :- ____________________',
      ];

      const fieldSpacing = (boxH - 18) / fields.length;
      fields.forEach((fld, fi) => {
        const fy = by + boxH - 16 - fi * fieldSpacing;
        page.drawText(fld, { x: x + 14, y: fy, size: 7.8, font: fonts.bold, color: COLOR_BLACK });
      });
    }
  }

  // =========================================================================
  // TEMPLATE 4: POLARIS LUXURY MASTER STYLE (13" x 9" Landscape · Purple & Gold)
  // =========================================================================
  private static drawTemplatePolaris_Front(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    pw: number,
    ph: number,
    customHeaderImg?: PDFImage,
    customAckImg?: PDFImage,
    wordmarkImg?: PDFImage,
    compassPurpleImg?: PDFImage,
    compassGoldImg?: PDFImage,
    ackRibbonImg?: PDFImage,
    sharePolyPurpleImg?: PDFImage,
    sharePolyGoldImg?: PDFImage,
    leftTopCornerImg?: PDFImage,
    rightBottomCornerImg?: PDFImage,
    memberLeftTopCornerImg?: PDFImage,
    memberRightBottomCornerImg?: PDFImage
  ) {
    // Fill full canvas background (#F7F5F1)
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: P_BG_LIGHT });
    this.drawCropMarks(page, pw, ph, 24);

    const geo = POLARIS_GEOMETRY.FRONT;
    this.drawAckStripPolaris(page, geo.ACK.x, geo.ACK.y, geo.ACK.w, geo.ACK.h, data, fonts, customHeaderImg, customAckImg, wordmarkImg, compassPurpleImg, ackRibbonImg);
    this.drawCertPanelPolaris(page, geo.SOCIETY.x, geo.SOCIETY.y, geo.SOCIETY.w, geo.SOCIETY.h, data, 'SOCIETY', fonts, customHeaderImg, customAckImg, wordmarkImg, compassPurpleImg, ackRibbonImg, sharePolyPurpleImg, leftTopCornerImg, rightBottomCornerImg);
    this.drawCertPanelPolaris(page, geo.MEMBER.x, geo.MEMBER.y, geo.MEMBER.w, geo.MEMBER.h, data, 'MEMBER', fonts, customHeaderImg, customAckImg, wordmarkImg, compassGoldImg, ackRibbonImg, sharePolyGoldImg, memberLeftTopCornerImg, memberRightBottomCornerImg);
  }

  private static drawTemplatePolaris_Back(
    page: PDFPage,
    data: ShareCertificateFieldData,
    society: SocietyMaster | null,
    fonts: Fonts,
    pw: number,
    ph: number,
    ackRibbonImg?: PDFImage
  ) {
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: P_BG_LIGHT });
    this.drawCropMarks(page, pw, ph, 24);

    // Full Sheet Outer Royal Purple Double Border & Baroque Corner Accents
    page.drawRectangle({ x: 8, y: 8, width: pw - 16, height: ph - 16, borderColor: P_PURPLE_PRIMARY, borderWidth: 2.0 });
    page.drawRectangle({ x: 11, y: 11, width: pw - 22, height: ph - 22, borderColor: P_LAVENDER_MIST, borderWidth: 0.8 });
    this.drawBaroqueCorners(page, 8, 8, pw - 16, ph - 16, P_PURPLE_PRIMARY);

    const geo = POLARIS_GEOMETRY.BACK;
    this.drawTransferMemoPolaris(page, geo.SOCIETY.x, geo.SOCIETY.y, geo.SOCIETY.w, geo.SOCIETY.h, fonts, 'SOCIETY', ackRibbonImg);
    this.drawTransferMemoPolaris(page, geo.MEMBER.x, geo.MEMBER.y, geo.MEMBER.w, geo.MEMBER.h, fonts, 'MEMBER', ackRibbonImg);
    this.drawAckBackPolaris(page, geo.ACK.x, geo.ACK.y, geo.ACK.w, geo.ACK.h, fonts);
  }

  // ── Template 4 Front: Certificate Panel (Society / Member Copy) ──
  private static drawCertPanelPolaris(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: ShareCertificateFieldData,
    theme: 'SOCIETY' | 'MEMBER',
    fonts: Fonts,
    customHeaderImg?: PDFImage,
    customAckImg?: PDFImage,
    wordmarkImg?: PDFImage,
    compassImg?: PDFImage,
    ackRibbonImg?: PDFImage,
    sharePolyImg?: PDFImage,
    leftTopCornerImg?: PDFImage,
    rightBottomCornerImg?: PDFImage
  ) {
    const isSociety = theme === 'SOCIETY';
    const primaryColor = isSociety ? P_PURPLE_PRIMARY : P_GOLD_DARK;
    const plaqueFill = isSociety ? P_PURPLE_PRIMARY : rgb(135 / 255, 87 / 255, 0);

    this.drawPolarisBorder(page, x, y, w, h, isSociety);

    const cx = x + w / 2;
    const innerLeft = x + 16;
    const innerRight = x + w - 16;
    const innerW = innerRight - innerLeft;

    // ── 0. Corner Images (Enlarged Left Corner as per Pink Diagram Line) ──
    const cornerSize = 98;
    if (leftTopCornerImg) {
      page.drawImage(leftTopCornerImg, {
        x: x,
        y: y + h - cornerSize,
        width: cornerSize,
        height: cornerSize,
      });
    }
    if (rightBottomCornerImg) {
      const rbW = w * 0.96;
      const rbH = rbW * 0.24;
      page.drawImage(rightBottomCornerImg, {
        x: x + w - rbW - 2,
        y: y,
        width: rbW,
        height: rbH,
      });
    }

    // ── 1. Topline Metadata Rows (Regular Labels, Bold Values, Safe Border Margins) ──
    const metaY1 = y + h - 18;
    const metaY2 = metaY1 - 14;
    const metaLblSize = 6.8;
    const metaValSize = 6.8;

    const sNo = String(data.serialNo || '172');
    const certNo = String(data.shareCertificateNo || data.serialNo || '172');
    const regNo = String(data.memberRegisterNo || data.serialNo || '172');
    const shClean = String(data.noOfShares || '10').trim();
    const shWords = data.sharesInWords ? `(${String(data.sharesInWords).split(' ')[0]})` : '(Ten)';
    const shValStr = shClean.includes('(') ? shClean : `${shClean}${shWords}`;
    const rawFlat = String(data.flatNo || '0901').trim();
    const flatParts = rawFlat.includes('/') ? rawFlat.split('/') : [rawFlat];
    const wing = String((data as any).wing || (data as any).wingNo || (flatParts.length > 1 ? flatParts[0] : 'B')).trim();
    const flat = rawFlat;

    // Row 1 Column 1: Serial No (offset after left corner flourish)
    const r1Col1X = innerLeft + 52;
    page.drawText('Serial No. ', { x: r1Col1X, y: metaY1, size: metaLblSize, font: fonts.reg, color: P_TEXT_PRIMARY });
    const sNoValX = r1Col1X + fonts.reg.widthOfTextAtSize('Serial No. ', metaLblSize);
    page.drawText(sNo, { x: sNoValX, y: metaY1, size: metaValSize, font: fonts.bold, color: P_TEXT_PRIMARY });
    page.drawLine({ start: { x: sNoValX, y: metaY1 - 1.5 }, end: { x: sNoValX + fonts.bold.widthOfTextAtSize(sNo, metaValSize) + 6, y: metaY1 - 1.5 }, color: P_LINE_GREY, thickness: 0.8 });

    // Row 1 Column 2: Share Certificate No (dedicated center-left column)
    const certLbl = 'Share Certificate No. ';
    const r1Col2X = innerLeft + 114;
    page.drawText(certLbl, { x: r1Col2X, y: metaY1, size: metaLblSize, font: fonts.reg, color: P_TEXT_PRIMARY });
    const certValX = r1Col2X + fonts.reg.widthOfTextAtSize(certLbl, metaLblSize);
    page.drawText(certNo, { x: certValX, y: metaY1, size: metaValSize, font: fonts.bold, color: P_TEXT_PRIMARY });
    page.drawLine({ start: { x: certValX, y: metaY1 - 1.5 }, end: { x: certValX + fonts.bold.widthOfTextAtSize(certNo, metaValSize) + 6, y: metaY1 - 1.5 }, color: P_LINE_GREY, thickness: 0.8 });

    // Row 1 Column 3: Member's Regn. No. (safe right margin)
    const regLbl = "Member's Regn. No. ";
    const regFullW = fonts.reg.widthOfTextAtSize(regLbl, metaLblSize) + fonts.bold.widthOfTextAtSize(regNo, metaValSize);
    const r1Col3X = innerRight - 10 - regFullW;
    page.drawText(regLbl, { x: r1Col3X, y: metaY1, size: metaLblSize, font: fonts.reg, color: P_TEXT_PRIMARY });
    const regValX = r1Col3X + fonts.reg.widthOfTextAtSize(regLbl, metaLblSize);
    page.drawText(regNo, { x: regValX, y: metaY1, size: metaValSize, font: fonts.bold, color: P_TEXT_PRIMARY });
    page.drawLine({ start: { x: regValX, y: metaY1 - 1.5 }, end: { x: regValX + fonts.bold.widthOfTextAtSize(regNo, metaValSize) + 6, y: metaY1 - 1.5 }, color: P_LINE_GREY, thickness: 0.8 });

    // Row 2 Column 1: No. of Shares
    const shLbl = 'No. of Shares ';
    page.drawText(shLbl, { x: r1Col1X + 4, y: metaY2, size: metaLblSize, font: fonts.reg, color: P_TEXT_PRIMARY });
    const shValX = r1Col1X + 4 + fonts.reg.widthOfTextAtSize(shLbl, metaLblSize);
    page.drawText(shValStr, { x: shValX, y: metaY2, size: metaValSize, font: fonts.bold, color: P_TEXT_PRIMARY });
    page.drawLine({ start: { x: shValX, y: metaY2 - 1.5 }, end: { x: shValX + fonts.bold.widthOfTextAtSize(shValStr, metaValSize) + 6, y: metaY2 - 1.5 }, color: P_LINE_GREY, thickness: 0.8 });

    // Row 2 Column 2: Wing No. / Wrg No. (centered-right relative to shares)
    const wingLbl = 'Wrg No. ';
    const r2Col2X = innerLeft + 185;
    page.drawText(wingLbl, { x: r2Col2X, y: metaY2, size: metaLblSize, font: fonts.reg, color: P_TEXT_PRIMARY });
    const wingValX = r2Col2X + fonts.reg.widthOfTextAtSize(wingLbl, metaLblSize);
    page.drawText(wing, { x: wingValX, y: metaY2, size: metaValSize, font: fonts.bold, color: P_TEXT_PRIMARY });
    page.drawLine({ start: { x: wingValX, y: metaY2 - 1.5 }, end: { x: wingValX + fonts.bold.widthOfTextAtSize(wing, metaValSize) + 6, y: metaY2 - 1.5 }, color: P_LINE_GREY, thickness: 0.8 });

    // Row 2 Column 3: Flat No. (safe right margin)
    const flatLbl = 'Flat No. ';
    const flatFullW = fonts.reg.widthOfTextAtSize(flatLbl, metaLblSize) + fonts.bold.widthOfTextAtSize(flat, metaValSize);
    const flatX = innerRight - 10 - flatFullW;
    page.drawText(flatLbl, { x: flatX, y: metaY2, size: metaLblSize, font: fonts.reg, color: P_TEXT_PRIMARY });
    const flatValX = flatX + fonts.reg.widthOfTextAtSize(flatLbl, metaLblSize);
    page.drawText(flat, { x: flatValX, y: metaY2, size: metaValSize, font: fonts.bold, color: P_TEXT_PRIMARY });
    page.drawLine({ start: { x: flatValX, y: metaY2 - 1.5 }, end: { x: flatValX + fonts.bold.widthOfTextAtSize(flat, metaValSize) + 6, y: metaY2 - 1.5 }, color: P_LINE_GREY, thickness: 0.8 });

    // ── 2. Top Ribbon Banner (Shifted Down for Perfect Spacing: plaqueW = 275) ──
    const plaqueW = 275;
    const plaqueH = 56;
    const plaqueX = cx - plaqueW / 2;
    const plaqueY = metaY2 - 76;

    if (sharePolyImg) {
      page.drawImage(sharePolyImg, { x: plaqueX, y: plaqueY, width: plaqueW, height: plaqueH });
    } else {
      this.drawOrnamentalFlourish(page, cx, plaqueY + plaqueH + 3, 50, P_GOLD_PRIMARY);
      this.drawOrnamentalFlourish(page, cx, plaqueY - 3, 50, P_GOLD_PRIMARY);
      page.drawRectangle({ x: plaqueX, y: plaqueY, width: plaqueW, height: plaqueH, color: plaqueFill, borderColor: P_GOLD_METALLIC, borderWidth: 1.4 });
      drawCentered(page, 'SHARE CERTIFICATE', fonts.bold, 11.5, cx, plaqueY + 18, COLOR_WHITE);
    }

    // ── 3. Authorised Share Capital (Clean Single Slash, Non-Cutting Font Size) ──
    const capY = plaqueY - 20;
    const authCap = cleanCurrency(data.authorisedCapital, '1,00,000').replace(/\/-.*$/, '').trim();
    const totShares = data.totalAuthorisedShares || '2000';
    const faceVal = cleanCurrency(data.faceValue, '50').replace(/\/-.*$/, '').trim();
    
    // Build segmented Authorised Capital line
    const capP1 = '( AUTHORISED SHARE CAPITAL OF Rs. ';
    const capP2 = `${authCap}/-`;
    const capP3 = ' DIVIDED INTO ';
    const capP4 = `${totShares}`;
    const capP5 = ' SHARES OF RS. ';
    const capP6 = `${faceVal}/-`;
    const capP7 = ' EACH )';
    const capFontSz = 7.8;
    
    const capTotalW = fonts.reg.widthOfTextAtSize(capP1, capFontSz)
      + fonts.bold.widthOfTextAtSize(capP2, capFontSz)
      + fonts.reg.widthOfTextAtSize(capP3, capFontSz)
      + fonts.bold.widthOfTextAtSize(capP4, capFontSz)
      + fonts.reg.widthOfTextAtSize(capP5, capFontSz)
      + fonts.bold.widthOfTextAtSize(capP6, capFontSz)
      + fonts.reg.widthOfTextAtSize(capP7, capFontSz);
    
    let curCapX = cx - capTotalW / 2;
    page.drawText(capP1, { x: curCapX, y: capY, size: capFontSz, font: fonts.reg, color: P_TEXT_PRIMARY });
    curCapX += fonts.reg.widthOfTextAtSize(capP1, capFontSz);
    page.drawText(capP2, { x: curCapX, y: capY, size: capFontSz, font: fonts.bold, color: P_TEXT_PRIMARY });
    curCapX += fonts.bold.widthOfTextAtSize(capP2, capFontSz);
    page.drawText(capP3, { x: curCapX, y: capY, size: capFontSz, font: fonts.reg, color: P_TEXT_PRIMARY });
    curCapX += fonts.reg.widthOfTextAtSize(capP3, capFontSz);
    page.drawText(capP4, { x: curCapX, y: capY, size: capFontSz, font: fonts.bold, color: P_TEXT_PRIMARY });
    curCapX += fonts.bold.widthOfTextAtSize(capP4, capFontSz);
    page.drawText(capP5, { x: curCapX, y: capY, size: capFontSz, font: fonts.reg, color: P_TEXT_PRIMARY });
    curCapX += fonts.reg.widthOfTextAtSize(capP5, capFontSz);
    page.drawText(capP6, { x: curCapX, y: capY, size: capFontSz, font: fonts.bold, color: P_TEXT_PRIMARY });
    curCapX += fonts.bold.widthOfTextAtSize(capP6, capFontSz);
    page.drawText(capP7, { x: curCapX, y: capY, size: capFontSz, font: fonts.reg, color: P_TEXT_PRIMARY });

    // ── 4. Society Header Block (Automatic Logo & Proportional Spacing) ──
    const socTitleY = capY - 38;
    const fullSoc = data.societyName || 'POLARIS CO-OPERATIVE HOUSING SOCIETY LIMITED.';
    const socMain = fullSoc.replace(/CO-OPERATIVE.*$/i, '').trim() || 'POLARIS';
    const socSub = fullSoc.toUpperCase().includes('CO-OPERATIVE')
      ? fullSoc.substring(fullSoc.toUpperCase().indexOf('CO-OPERATIVE')).trim()
      : 'CO-OPERATIVE HOUSING SOCIETY LIMITED.';

    // Automatic Society Logo / Compass Logo on Left (Aspect ratio fitted)
    const compassSize = 82;
    const logoX = innerLeft + 6;
    const logoY = socTitleY - 56;
    const effectiveLogo = customHeaderImg || compassImg;
    if (effectiveLogo) {
      const imgDims = effectiveLogo.scaleToFit(compassSize, compassSize);
      const drawLogoX = logoX + (compassSize - imgDims.width) / 2;
      const drawLogoY = logoY + (compassSize - imgDims.height) / 2;
      page.drawImage(effectiveLogo, { x: drawLogoX, y: drawLogoY, width: imgDims.width, height: imgDims.height });
    } else {
      const logoR = compassSize / 2;
      const logoCX = logoX + logoR;
      const logoCY = logoY + logoR;
      page.drawCircle({ x: logoCX, y: logoCY, size: logoR, color: COLOR_WHITE, borderColor: primaryColor, borderWidth: 1.5 });
      page.drawCircle({ x: logoCX, y: logoCY, size: logoR - 3, color: COLOR_WHITE, borderColor: P_GOLD_PRIMARY, borderWidth: 0.8 });
      drawCentered(page, 'POLARIS', fonts.bold, 8.0, logoCX, logoCY + 3, primaryColor);
      drawCentered(page, 'LOGO', fonts.bold, 7.0, logoCX, logoCY - 6, primaryColor);
    }

    // Society name & details shifted right to accommodate logo
    const socTextLeft = logoX + compassSize + 10;
    const socTextCX = socTextLeft + (innerRight - socTextLeft) / 2;
    const socTextW = innerRight - socTextLeft;

    const socSz = fitFontSize(socMain, fonts.timesBold, 26.0, socTextW - 8, 15);
    drawCentered(page, socMain, fonts.timesBold, socSz, socTextCX, socTitleY, primaryColor);

    const socSubY = socTitleY - 20;
    const subSz = fitFontSize(socSub, fonts.bold, 10.0, socTextW - 8, 7.5);
    drawCentered(page, socSub, fonts.bold, subSz, socTextCX, socSubY, isSociety ? rgb(160 / 255, 30 / 255, 30 / 255) : P_GOLD_DARK);

    const addrY = socSubY - 17;
    const addr = (data.societyAddress || 'CTS No. 548, A To G, Nahur Village, L.B.S. Marg, Mulund (West), Mumbai - 400080.').replace(/Registered under.*$/i, '').trim();
    const addrLines = wrapText(addr, fonts.reg, 8.2, socTextW - 8);
    addrLines.slice(0, 2).forEach((ln, i) => {
      drawCentered(page, ln, fonts.reg, 8.2, socTextCX, addrY - i * 11.5, P_TEXT_PRIMARY);
    });

    const regY = Math.min(addrY - (addrLines.length * 11.5) - 4, logoY - 4);
    const regTxt1 = '( Registered under the Maharashtra Co-operative Societies Act, 1960 )';
    drawCentered(page, regTxt1, fonts.bold, 7.2, socTextCX, regY, P_TEXT_PRIMARY);

    const regTxt2 = `Registration No. ${data.registrationNo || 'MUM/WT/HS/GC/T/1489/YEAR 2024 DT. 10/04/2024'}`;
    drawCentered(page, regTxt2, fonts.bold, 7.2, socTextCX, regY - 12, P_TEXT_PRIMARY);

    // ── 5. Certification Row (Regular Prefix, Bold Output, Clean Border Wrap) ──
    const certStartY = regY - 34;
    const holderName = (data.memberName || 'SRIHARI SARUNGAN').toUpperCase();
    const l1Prefix = 'THIS IS TO CERTIFY THAT Shri. / Smt. : ';
    const prefixW = fonts.reg.widthOfTextAtSize(l1Prefix, 9.6);
    page.drawText(l1Prefix, { x: innerLeft + 4, y: certStartY, size: 9.6, font: fonts.reg, color: P_TEXT_PRIMARY });
    const nameStartX = innerLeft + 4 + prefixW + 2;
    const nameEndX = innerRight - 4;
    const nameL1MaxW = nameEndX - nameStartX;

    // Check if full name fits on line 1
    const singleLineNameW = fonts.bold.widthOfTextAtSize(holderName, 9.6);
    let certLinesCount = 1;
    if (singleLineNameW <= nameL1MaxW) {
      // Fits on Line 1
      page.drawText(holderName, { x: nameStartX + 2, y: certStartY, size: 9.6, font: fonts.bold, color: P_TEXT_PRIMARY });
      page.drawLine({ start: { x: nameStartX, y: certStartY - 2 }, end: { x: nameEndX, y: certStartY - 2 }, color: P_LINE_GREY, thickness: 0.9 });
    } else {
      // Split into 2 cleanly bounded lines
      certLinesCount = 2;
      const rawWords = holderName.split(/,\s*/);
      let l1 = '';
      let l2 = '';
      for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
        const candidate = l1 ? `${l1}, ${rawWords[wIdx]}` : rawWords[wIdx];
        if (fonts.bold.widthOfTextAtSize(candidate, 9.4) <= nameL1MaxW) {
          l1 = candidate;
        } else {
          l2 = rawWords.slice(wIdx).join(', ');
          break;
        }
      }
      if (!l1) {
        l1 = rawWords[0];
        l2 = rawWords.slice(1).join(', ');
      }

      // Line 1 text & underline
      page.drawText(l1, { x: nameStartX + 2, y: certStartY, size: 9.4, font: fonts.bold, color: P_TEXT_PRIMARY });
      page.drawLine({ start: { x: nameStartX, y: certStartY - 2 }, end: { x: nameEndX, y: certStartY - 2 }, color: P_LINE_GREY, thickness: 0.9 });

      // Line 2 text & underline
      const line2Y = certStartY - 16;
      if (l2) {
        page.drawText(l2, { x: innerLeft + 8, y: line2Y, size: 9.4, font: fonts.bold, color: P_TEXT_PRIMARY });
      }
      page.drawLine({ start: { x: innerLeft + 4, y: line2Y - 2 }, end: { x: innerRight - 4, y: line2Y - 2 }, color: P_LINE_GREY, thickness: 0.9 });
    }

    // ── 6. Registered Holder Body Paragraphs (Stretched to Fill Blank Space) ──
    const l2Y = (certLinesCount === 1) ? certStartY - 26 : certStartY - 40;
    const sFrom = data.sharesFrom || '101';
    const sTo = data.sharesTo || '101';
    const bodyText1 = `is/are the Registered Holder of  ${shValStr}  fully paid up shares of  Rs. ${faceVal}/-  each numbered from  ${sFrom}  to  ${sTo}  both Inclusive in  ${fullSoc}, ${addr}. Subject to the Bye-laws of the said society.`;
    const bodyLines = wrapText(bodyText1, fonts.reg, 9.5, innerW - 8);
    const bodyLineSpacing = 20.0;
    bodyLines.forEach((ln, li) => {
      page.drawText(ln, { x: innerLeft + 4, y: l2Y - li * bodyLineSpacing, size: 9.5, font: fonts.reg, color: P_TEXT_PRIMARY });
    });

    // ── 7. Side-by-Side: Stamp Box (Left) + Given under Common Seal (Right) ──
    const bodyBottomY = l2Y - (bodyLines.length - 1) * bodyLineSpacing;
    const sealAreaY = bodyBottomY - 34;
    const fvClean = parseFloat(String(data.faceValue || '50').replace(/[^\d.]/g, '')) || 50;
    const nsClean = parseFloat(String(data.noOfShares || '11').replace(/[^\d.]/g, '')) || 11;
    const totValNum = fvClean * nsClean;
    const stampValStr = cleanCurrency(totValNum, '550');

    // Box Design Stamp on left
    const stampBoxW = 66;
    const stampBoxH = 34;
    const stampBoxX = innerLeft + 4;
    const stampBoxY = sealAreaY - 17;
    page.drawRectangle({ x: stampBoxX, y: stampBoxY, width: stampBoxW, height: stampBoxH, color: COLOR_WHITE, borderColor: primaryColor, borderWidth: 1.5 });
    page.drawRectangle({ x: stampBoxX + 2.5, y: stampBoxY + 2.5, width: stampBoxW - 5, height: stampBoxH - 5, color: COLOR_WHITE, borderColor: primaryColor, borderWidth: 0.7 });
    drawCentered(page, `Rs. ${stampValStr}/-`, fonts.bold, 11, stampBoxX + stampBoxW / 2, stampBoxY + 11.5, primaryColor);

    // Given under the Common Seal text directly beside the stamp on right (Regular text, bold date output)
    const sealTextX = stampBoxX + stampBoxW + 12;
    const issueDateStr = data.issueDate || '29th September 2024';
    page.drawText('Given under the Common Seal of', { x: sealTextX, y: sealAreaY + 4, size: 9.5, font: fonts.reg, color: P_TEXT_PRIMARY });
    const prefixDate = 'the said society on this ';
    page.drawText(prefixDate, { x: sealTextX, y: sealAreaY - 11, size: 9.5, font: fonts.reg, color: P_TEXT_PRIMARY });
    const datePrefixW = fonts.reg.widthOfTextAtSize(prefixDate, 9.5);
    page.drawText(`${issueDateStr}.`, { x: sealTextX + datePrefixW, y: sealAreaY - 11, size: 9.5, font: fonts.bold, color: P_TEXT_PRIMARY });

    // ── 8. Watermark Blur Seal of Society (Bottom-Left) ──
    const blurSealCX = innerLeft + 42;
    const blurSealCY = y + 74;
    const blurSealR = 28;
    const blurColor = rgb(190 / 255, 190 / 255, 205 / 255);
    page.drawCircle({ x: blurSealCX, y: blurSealCY, size: blurSealR, borderColor: blurColor, borderWidth: 0.9, borderDashArray: [3, 2] });
    page.drawCircle({ x: blurSealCX, y: blurSealCY, size: blurSealR - 3, borderColor: blurColor, borderWidth: 0.5 });
    drawCentered(page, 'SEAL OF', fonts.bold, 7.2, blurSealCX, blurSealCY + 4, blurColor);
    drawCentered(page, 'SOCIETY', fonts.bold, 7.2, blurSealCX, blurSealCY - 6, blurColor);

    // ── 9. Signatures (Evenly Distributed to Fill Space: sigStartY = y + 175, sigSpacing = 48) ──
    const sigAreaLeft = innerLeft + 130;
    const sigAreaRight = innerRight - 8;
    const sigSpacing = 48;
    const sigStartY = y + 175;
    const sigTitles = ['Hon. Chairman', 'Hon. Secretary', 'Hon. Treasurer'];

    sigTitles.forEach((st, si) => {
      const lineY = sigStartY - si * sigSpacing;
      // Label on the left
      page.drawText(st, { x: sigAreaLeft, y: lineY, size: 9.0, font: fonts.bold, color: primaryColor });
      const lblW = fonts.bold.widthOfTextAtSize(st, 9.0);
      // Signature line after the label
      page.drawLine({ start: { x: sigAreaLeft + lblW + 6, y: lineY - 1.5 }, end: { x: sigAreaRight, y: lineY - 1.5 }, color: P_LINE_GREY, thickness: 0.9 });
    });

    // ── 10. Bottom Copy Label & P.T.O. (Medium Bold Font Centered inside Plaque) ──
    const copyTitle = isSociety ? 'SOCIETY COPY' : 'MEMBER COPY';
    const rbBottomRibbonCX = x + w * 0.4275;
    const rbBottomRibbonY = y + 15.5;
    drawCentered(page, copyTitle, fonts.bold, 9.5, rbBottomRibbonCX, rbBottomRibbonY, COLOR_WHITE);
  }

  private static drawAckStripPolaris(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: ShareCertificateFieldData,
    fonts: Fonts,
    customHeaderImg?: PDFImage,
    customAckImg?: PDFImage,
    wordmarkImg?: PDFImage,
    compassImg?: PDFImage,
    ackRibbonImg?: PDFImage
  ) {
    this.drawPolarisBorder(page, x, y, w, h, true);
    const cx = x + w / 2;

    const topPlqW = w - 8;
    const topPlqH = 22;
    const topPlqY = y + h - 36;
    if (ackRibbonImg) {
      page.drawImage(ackRibbonImg, { x: cx - topPlqW / 2, y: topPlqY, width: topPlqW, height: topPlqH });
    } else {
      page.drawRectangle({ x: cx - topPlqW / 2, y: topPlqY, width: topPlqW, height: topPlqH, color: P_PURPLE_PRIMARY, borderColor: P_GOLD_METALLIC, borderWidth: 1.2 });
    }
    drawCentered(page, 'SHARE CERTIFICATE', fonts.bold, 8.2, cx, topPlqY + 7.5, COLOR_WHITE);

    const ackPlqY = y + h - 146;

    // Center the society text block vertically between topPlqY and ackPlqY
    const midAckY = (topPlqY + ackPlqY + 20) / 2;

    const fullSoc = data.societyName || 'POLARIS CO-OPERATIVE HOUSING SOCIETY LIMITED.';
    const socMain = fullSoc.replace(/CO-OPERATIVE.*$/i, '').trim() || 'POLARIS';
    const socSz = fitFontSize(socMain, fonts.bold, 13.0, w - 24, 7.0);
    drawCentered(page, socMain, fonts.bold, socSz, cx, midAckY + 26, P_PURPLE_PRIMARY);
    drawCentered(page, 'CO-OPERATIVE HOUSING SOCIETY LIMITED.', fonts.bold, 5.8, cx, midAckY + 14, rgb(160 / 255, 30 / 255, 30 / 255));

    const addr = (data.societyAddress || 'CTS No. 548, A To G, Nahur Village, L.B.S. Marg, Mulund (West), Mumbai - 400080.').replace(/Registered under.*$/i, '').trim();
    const addrLines = wrapText(addr, fonts.reg, 5.4, w - 24);
    addrLines.slice(0, 2).forEach((ln, i) => {
      drawCentered(page, ln, fonts.reg, 5.4, cx, midAckY + 2 - i * 8, P_TEXT_PRIMARY);
    });

    drawCentered(page, '( Registered under the Maharashtra Co-operative Societies Act, 1960 )', fonts.bold, 4.8, cx, midAckY - 16, P_TEXT_PRIMARY);
    drawCentered(page, `Registration No. ${data.registrationNo || 'MUM/WT/HS/GC/T/1489/YEAR 2024 DT. 10/04/2024'}`, fonts.bold, 4.8, cx, midAckY - 24, P_TEXT_PRIMARY);

    if (ackRibbonImg) {
      page.drawImage(ackRibbonImg, { x: cx - topPlqW / 2, y: ackPlqY, width: topPlqW, height: topPlqH });
    } else {
      page.drawRectangle({ x: cx - topPlqW / 2, y: ackPlqY, width: topPlqW, height: topPlqH, color: P_PURPLE_PRIMARY, borderColor: P_GOLD_METALLIC, borderWidth: 1.2 });
    }
    drawCentered(page, 'ACKNOWLEDGEMENT', fonts.bold, 7.6, cx, ackPlqY + 7.5, COLOR_WHITE);

    const startBoxY = ackPlqY - 14;
    const boxCount = 3;
    const boxGap = 12;
    const bottomMargin = 20;
    const availableHeight = startBoxY - (y + 16) - bottomMargin;
    const boxH = Math.min(115, (availableHeight - (boxCount - 1) * boxGap) / boxCount);

    for (let b = 0; b < boxCount; b++) {
      const by = startBoxY - (b + 1) * boxH - b * boxGap;
      page.drawRectangle({ x: x + 8, y: by, width: w - 16, height: boxH, color: COLOR_WHITE, borderColor: P_PURPLE_PRIMARY, borderWidth: 0.9 });
      page.drawRectangle({ x: x + 10, y: by + 2, width: w - 20, height: boxH - 4, borderColor: P_LAVENDER_MIST, borderWidth: 0.5 });

      const fields = [
        'Name : ',
        'PAN / Aadhar No. : ',
        'Mob. No. : ',
        'Bank Name : ',
        'Signature : ',
      ];

      const lineLeft = x + 14;
      const lineRight = x + w - 14;
      const lineSpacing = (boxH - 14) / fields.length;

      fields.forEach((fld, fi) => {
        const fy = by + boxH - 16 - fi * lineSpacing;
        page.drawText(fld, { x: lineLeft, y: fy, size: 7.2, font: fonts.bold, color: P_TEXT_PRIMARY });
        const lblW = fonts.bold.widthOfTextAtSize(fld, 7.2);
        page.drawLine({ start: { x: lineLeft + lblW, y: fy - 1 }, end: { x: lineRight, y: fy - 1 }, color: P_LINE_GREY, thickness: 0.7 });
      });
    }
  }

  private static drawTransferMemoPolaris(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    fonts: Fonts,
    theme: 'SOCIETY' | 'MEMBER',
    ackRibbonImg?: PDFImage
  ) {
    this.drawPolarisBorder(page, x, y, w, h, true);

    const iX = x + 12;
    const iW = w - 24;
    const iY = y + 12;
    const iH = h - 24;
    const cx = x + w / 2;

    const headH = 26;
    const headY = iY + iH - headH;
    if (ackRibbonImg) {
      page.drawImage(ackRibbonImg, { x: iX, y: headY, width: iW, height: headH });
    } else {
      page.drawRectangle({ x: iX, y: headY, width: iW, height: headH, color: P_PURPLE_PRIMARY, borderColor: P_GOLD_METALLIC, borderWidth: 1 });
    }
    const memText = 'MEMORANDUM OF TRANSFERS OF THE WITHIN MENTIONED SHARES';
    drawCentered(page, memText, fonts.bold, 7.0, cx, headY + 8.5, COLOR_WHITE);

    const colHeadH = 26;
    const colY = headY - colHeadH;
    const col1W = 48; // Date of Transfer
    const col2W = 44; // Transferor Folio No.
    const col3W = 44; // Transferee Folio No.
    const col5W = 54; // Register No. of Transfer
    const col4W = iW - col1W - col2W - col3W - col5W; // To whom Transferred (Spans full remaining space)

    const cols = [
      { label: 'Date of\nTransfer', w: col1W },
      { label: 'Transferor\nFolio No.', w: col2W },
      { label: 'Transferee\nFolio No.', w: col3W },
      { label: 'To whom Transferred', w: col4W },
      { label: 'Register No.\nof Transfer', w: col5W },
    ];

    let cx2 = iX;
    cols.forEach(col => {
      page.drawRectangle({ x: cx2, y: colY, width: col.w, height: colHeadH, color: P_LAVENDER_LIGHT, borderColor: P_PURPLE_PRIMARY, borderWidth: 0.8 });
      const lines = col.label.split('\n');
      const colCX = cx2 + col.w / 2;
      lines.forEach((ln, li) => {
        const sz = fitFontSize(ln, fonts.bold, 6.5, col.w - 2, 4.8);
        drawCentered(page, ln, fonts.bold, sz, colCX, colY + colHeadH - 9 - li * 8.5, P_PURPLE_PRIMARY);
      });
      cx2 += col.w;
    });

    // 4 Rows Data Boxes with Skyline Watermark across bottom
    const dataAreaH = colY - iY;
    const rowH = dataAreaH / 4;

    // Draw purple city skyline silhouette + wave ribbons across the bottom
    this.drawSkylineBack(page, iX, iY, iW, 64);

    for (let r = 0; r < 4; r++) {
      const ry = colY - (r + 1) * rowH;
      const midY = ry + rowH * 0.44;

      page.drawRectangle({ x: iX, y: ry, width: iW, height: rowH, color: COLOR_WHITE, borderColor: P_PURPLE_PRIMARY, borderWidth: 0.8, opacity: 0.82 });

      // Vertical column lines:
      // In top half ONLY (from midY to ry + rowH): dividers between Col 1, 2, 3, 4
      let vxTop = iX;
      [col1W, col2W, col3W, col4W].forEach(cw => {
        vxTop += cw;
        page.drawLine({ start: { x: vxTop, y: midY }, end: { x: vxTop, y: ry + rowH }, color: P_PURPLE_PRIMARY, thickness: 0.8 });
      });

      // Horizontal divider line across ALL columns 1 to 5 (extended with blue line)
      page.drawLine({ start: { x: iX, y: midY }, end: { x: iX + iW, y: midY }, color: P_PURPLE_PRIMARY, thickness: 0.6 });

      // Horizontal Oval / Ellipse SEAL on left across columns 1-3
      const sealCX = iX + (col1W + col2W + col3W) * 0.50;
      const sealCY = ry + rowH / 2;
      page.drawEllipse({ x: sealCX, y: sealCY, xScale: 44, yScale: 25, color: COLOR_WHITE, borderColor: P_PURPLE_PRIMARY, borderWidth: 1.1 });
      page.drawEllipse({ x: sealCX, y: sealCY, xScale: 41, yScale: 22, color: COLOR_WHITE, borderColor: P_LAVENDER_MIST, borderWidth: 0.6 });
      drawCentered(page, 'SEAL', fonts.timesRoman, 10, sealCX, sealCY - 3.5, P_PURPLE_PRIMARY);

      // Bottom half: Wide Open Signature Area spanning Columns 4 & 5 (with vertical lines removed as circled in red)
      const sigAreaLeft = iX + col1W + col2W + col3W + 8;
      const sigAreaRight = iX + iW - 8;
      const sigAreaW = sigAreaRight - sigAreaLeft;
      const sigSlotW = sigAreaW / 3;
      const sigs = ['Hon. Chairman', 'Hon. Secretary', 'Authorised M.C. Member'];

      sigs.forEach((st, si) => {
        const sx = sigAreaLeft + si * sigSlotW;
        const lineX = sx + 4;
        const lineW = sigSlotW - 8;
        const lineY = ry + 26;
        const lblY = ry + 10;

        page.drawLine({ start: { x: lineX, y: lineY }, end: { x: lineX + lineW, y: lineY }, color: COLOR_BLACK, thickness: 0.8 });
        const sz = fitFontSize(st, fonts.bold, 6.8, lineW, 5.0);
        drawCentered(page, st, fonts.bold, sz, lineX + lineW / 2, lblY, P_PURPLE_PRIMARY);

        // Floral diamond cross ornament between signatures
        if (si < 2) {
          const crossX = lineX + lineW + 4;
          this.drawFloralCross(page, crossX, lineY, 2.5, P_PURPLE_PRIMARY);
        }
      });
    }
  }

  // ── Template 4 Back: Acknowledgement Back Strip ──
  private static drawAckBackPolaris(page: PDFPage, x: number, y: number, w: number, h: number, fonts: Fonts) {
    this.drawPolarisBorder(page, x, y, w, h, true);

    const boxCount = 5;
    const boxGap = 8;
    const boxH = (h - 28 - (boxCount - 1) * boxGap) / boxCount;

    for (let b = 0; b < boxCount; b++) {
      const by = y + h - 16 - (b + 1) * boxH - b * boxGap;
      // White card box with purple border
      page.drawRectangle({ x: x + 8, y: by, width: w - 16, height: boxH, color: COLOR_WHITE, borderColor: P_PURPLE_PRIMARY, borderWidth: 1.0 });

      const fields = [
        'Name : ________________________',
        'PAN / Aadhar No. : ____________',
        'Mob. No. : ____________________',
        'Signature : ___________________',
      ];

      const fieldSpacing = (boxH - 12) / fields.length;
      fields.forEach((fld, fi) => {
        const fy = by + boxH - 12 - fi * fieldSpacing;
        page.drawText(fld, { x: x + 12, y: fy, size: 6.8, font: fonts.bold, color: P_TEXT_PRIMARY });
      });

      // Floral cross ornament between boxes
      if (b < boxCount - 1) {
        const ornamentY = by - boxGap / 2;
        this.drawFloralCross(page, x + w / 2, ornamentY, 3.5, P_PURPLE_PRIMARY);
      }
    }
  }

  private static drawFloralCross(page: PDFPage, cx: number, cy: number, r: number, color = P_PURPLE_PRIMARY) {
    this.drawTinyDiamond(page, cx, cy, r * 0.7, color);
    this.drawTinyDiamond(page, cx, cy + r * 1.1, r * 0.45, color);
    this.drawTinyDiamond(page, cx, cy - r * 1.1, r * 0.45, color);
    this.drawTinyDiamond(page, cx - r * 1.1, cy, r * 0.45, color);
    this.drawTinyDiamond(page, cx + r * 1.1, cy, r * 0.45, color);
  }

  private static drawBaroqueCorners(page: PDFPage, x: number, y: number, w: number, h: number, color = P_PURPLE_PRIMARY) {
    const corners = [
      { cx: x + 10, cy: y + h - 10 },
      { cx: x + w - 10, cy: y + h - 10 },
      { cx: x + 10, cy: y + 10 },
      { cx: x + w - 10, cy: y + 10 },
    ];
    corners.forEach(c => {
      this.drawFloralCross(page, c.cx, c.cy, 4.0, color);
    });
  }

  private static drawSkylineBack(page: PDFPage, x: number, y: number, w: number, h: number) {
    const color = rgb(190 / 255, 168 / 255, 225 / 255);
    const numBld = 42;
    const bW = w / numBld;
    const hts = [
      0.25, 0.45, 0.3, 0.65, 0.85, 0.5, 0.35, 0.7, 0.95, 0.55, 0.4, 0.75, 1.0, 0.6,
      0.45, 0.68, 0.88, 0.52, 0.32, 0.58, 0.8, 0.48, 0.28, 0.62, 0.84, 0.46, 0.34, 0.72,
      0.92, 0.56, 0.38, 0.78, 0.96, 0.58, 0.44, 0.66, 0.86, 0.5, 0.36, 0.6, 0.82, 0.48
    ];
    for (let i = 0; i < numBld; i++) {
      const bx = x + i * bW;
      const bh = h * (hts[i % hts.length] || 0.5);
      page.drawRectangle({ x: bx, y, width: bW - 1, height: bh, color, opacity: 0.38 });
      if ((hts[i % hts.length] || 0) >= 0.8) {
        page.drawLine({ start: { x: bx + bW / 2 - 0.5, y: y + bh }, end: { x: bx + bW / 2 - 0.5, y: y + bh + 8 }, color, thickness: 0.8, opacity: 0.45 });
      }
    }
  }

  // ── Polaris Vector Helper Methods ──
  private static drawPolarisBorder(page: PDFPage, x: number, y: number, w: number, h: number, isSociety: boolean) {
    const primary = isSociety ? P_PURPLE_PRIMARY : P_GOLD_DARK;
    const accent = P_GOLD_PRIMARY;
    const innerTrim = isSociety ? P_LAVENDER_MIST : P_GOLD_LIGHT;

    // Outer primary border
    page.drawRectangle({ x, y, width: w, height: h, color: P_BG_PAPER, borderColor: primary, borderWidth: 2.2 });
    // Metallic gold secondary border
    page.drawRectangle({ x: x + 2.5, y: y + 2.5, width: w - 5, height: h - 5, borderColor: accent, borderWidth: 1.0 });
    // Inner fine stroke
    page.drawRectangle({ x: x + 5.5, y: y + 5.5, width: w - 11, height: h - 11, borderColor: innerTrim, borderWidth: 0.7 });

    // Corner diamond accents
    [
      { cx: x + 10, cy: y + h - 10 },
      { cx: x + w - 10, cy: y + h - 10 },
      { cx: x + 10, cy: y + 10 },
      { cx: x + w - 10, cy: y + 10 },
    ].forEach(c => {
      this.drawTinyDiamond(page, c.cx, c.cy, 3, accent);
    });
  }

  private static drawOrnamentalFlourish(page: PDFPage, cx: number, y: number, w: number, color = P_GOLD_PRIMARY) {
    const hw = w / 2;
    page.drawLine({ start: { x: cx - hw, y }, end: { x: cx - 8, y }, color, thickness: 0.8 });
    page.drawLine({ start: { x: cx + 8, y }, end: { x: cx + hw, y }, color, thickness: 0.8 });
    this.drawTinyDiamond(page, cx, y, 3, color);
    this.drawTinyDiamond(page, cx - hw, y, 1.8, color);
    this.drawTinyDiamond(page, cx + hw, y, 1.8, color);
  }

  private static drawTinyDiamond(page: PDFPage, cx: number, cy: number, r: number, color = P_GOLD_PRIMARY) {
    page.drawLine({ start: { x: cx, y: cy + r }, end: { x: cx + r, y: cy }, color, thickness: 0.8 });
    page.drawLine({ start: { x: cx + r, y: cy }, end: { x: cx, y: cy - r }, color, thickness: 0.8 });
    page.drawLine({ start: { x: cx, y: cy - r }, end: { x: cx - r, y: cy }, color, thickness: 0.8 });
    page.drawLine({ start: { x: cx - r, y: cy }, end: { x: cx, y: cy + r }, color, thickness: 0.8 });
  }

  private static drawTinyStar(page: PDFPage, cx: number, cy: number, r: number, color = P_GOLD_PRIMARY) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle + Math.PI) * r;
      const y2 = cy + Math.sin(angle + Math.PI) * r;
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 1.2 });
    }
  }

  private static drawVectorCompass(page: PDFPage, cx: number, cy: number, r: number, isSociety: boolean) {
    const ringColor = P_GOLD_PRIMARY;
    const starColor = isSociety ? P_PURPLE_PRIMARY : P_GOLD_DARK;

    page.drawCircle({ x: cx, y: cy, size: r, borderColor: ringColor, borderWidth: 1.5 });
    page.drawCircle({ x: cx, y: cy, size: r - 3, borderColor: ringColor, borderWidth: 0.7 });

    // 8-point compass star lines
    const mainLen = r + 4;
    const secLen = r * 0.7;

    // 4 Main points
    page.drawLine({ start: { x: cx, y: cy - mainLen }, end: { x: cx, y: cy + mainLen }, color: starColor, thickness: 2.0 });
    page.drawLine({ start: { x: cx - mainLen, y: cy }, end: { x: cx + mainLen, y: cy }, color: starColor, thickness: 2.0 });

    // 4 Diagonal points
    const diag = secLen * 0.707;
    page.drawLine({ start: { x: cx - diag, y: cy - diag }, end: { x: cx + diag, y: cy + diag }, color: ringColor, thickness: 1.2 });
    page.drawLine({ start: { x: cx - diag, y: cy + diag }, end: { x: cx + diag, y: cy - diag }, color: ringColor, thickness: 1.2 });
  }

  private static drawSkylineWatermark(page: PDFPage, x: number, y: number, w: number, h: number, color = P_PURPLE_ACCENT) {
    // Vector architectural silhouette / towers line-art
    const numBuildings = 14;
    const bW = w / numBuildings;
    const heights = [0.35, 0.55, 0.85, 0.45, 1.0, 0.65, 0.9, 0.4, 0.75, 0.5, 0.8, 0.35, 0.6, 0.3];

    for (let i = 0; i < numBuildings; i++) {
      const bx = x + i * bW;
      const bh = h * heights[i % heights.length];
      page.drawLine({ start: { x: bx, y }, end: { x: bx, y: y + bh }, color, thickness: 0.6 });
      page.drawLine({ start: { x: bx, y: y + bh }, end: { x: bx + bW - 1, y: y + bh }, color, thickness: 0.6 });
      page.drawLine({ start: { x: bx + bW - 1, y: y + bh }, end: { x: bx + bW - 1, y }, color, thickness: 0.6 });
      // Spire for tall buildings
      if (heights[i % heights.length] >= 0.85) {
        page.drawLine({ start: { x: bx + bW / 2, y: y + bh }, end: { x: bx + bW / 2, y: y + bh + 8 }, color, thickness: 0.8 });
      }
    }
  }

  private static drawWaveLinesWatermark(page: PDFPage, x: number, y: number, w: number, h: number, color = P_PURPLE_ACCENT) {
    // 6 Flowing sinusoidal/curved lines
    const numWaves = 6;
    for (let wIdx = 0; wIdx < numWaves; wIdx++) {
      const yOff = y + wIdx * 4;
      const segs = 18;
      const segW = w / segs;
      let prevX = x;
      let prevY = yOff + Math.sin(0) * 8;

      for (let s = 1; s <= segs; s++) {
        const curX = x + s * segW;
        const curY = yOff + Math.sin((s / segs) * Math.PI * 2 + wIdx * 0.4) * 8;
        page.drawLine({ start: { x: prevX, y: prevY }, end: { x: curX, y: curY }, color, thickness: 0.5 });
        prevX = curX;
        prevY = curY;
      }
    }
  }

  private static drawPolarisCurvedRibbon(page: PDFPage, x: number, y: number, w: number, h: number, isSociety: boolean) {
    const mainColor = isSociety ? P_PURPLE_PRIMARY : P_GOLD_DARK;
    const edgeColor = P_GOLD_PRIMARY;

    // Corner metallic decorative curves at bottom right corner
    page.drawLine({ start: { x: x + w - 50, y: y + 2 }, end: { x: x + w - 2, y: y + 2 }, color: edgeColor, thickness: 1.5 });
    page.drawLine({ start: { x: x + w - 35, y: y + 2 }, end: { x: x + w - 2, y: y + 25 }, color: edgeColor, thickness: 1.8 });
    page.drawLine({ start: { x: x + w - 30, y: y + 2 }, end: { x: x + w - 2, y: y + 20 }, color: mainColor, thickness: 1.2 });
  }

  // ──────────────────────────────────────────────────────────
  // CROP MARKS (Physical Print Bleed & Alignment)
  // ──────────────────────────────────────────────────────────
  private static drawCropMarks(page: PDFPage, pw: number, ph: number, margin: number) {
    const markLen = 16;
    const c = rgb(0.3, 0.3, 0.3);
    const t = 0.5;

    page.drawLine({ start: { x: margin - markLen, y: ph - margin }, end: { x: margin, y: ph - margin }, color: c, thickness: t });
    page.drawLine({ start: { x: margin, y: ph - margin + markLen }, end: { x: margin, y: ph - margin }, color: c, thickness: t });

    page.drawLine({ start: { x: pw - margin, y: ph - margin }, end: { x: pw - margin + markLen, y: ph - margin }, color: c, thickness: t });
    page.drawLine({ start: { x: pw - margin, y: ph - margin + markLen }, end: { x: pw - margin, y: ph - margin }, color: c, thickness: t });

    page.drawLine({ start: { x: margin - markLen, y: margin }, end: { x: margin, y: margin }, color: c, thickness: t });
    page.drawLine({ start: { x: margin, y: margin - markLen }, end: { x: margin, y: margin }, color: c, thickness: t });

    page.drawLine({ start: { x: pw - margin, y: margin }, end: { x: pw - margin + markLen, y: margin }, color: c, thickness: t });
    page.drawLine({ start: { x: pw - margin, y: margin - markLen }, end: { x: pw - margin, y: margin }, color: c, thickness: t });
  }
}
