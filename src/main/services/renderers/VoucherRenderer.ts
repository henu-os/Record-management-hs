// ============================================================
// HENU OS — Native Payment Voucher Renderer (2 Vouchers per A4 Sheet)
// Dimensions: 8.27" x 11.69" A4 Portrait (595.28 pt x 841.89 pt)
// Pure Programmatic Vector Rendering with pdf-lib
// Supported Templates:
//  - TEMPLATE_1: Detailed Financial Calculation (Master Reference Style)
//  - TEMPLATE_2: Open Ledger Grid Style
// ============================================================

import { PDFDocument, PDFPage, PDFFont, PDFImage, StandardFonts, rgb, LineCapStyle } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { VoucherRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { wrapPdfDocumentForWinAnsi, sanitizeWinAnsi } from './PdfDocumentBuilder';

export interface VoucherRenderOptions {
  settings?: FormDesignSettings;
  renderMode?: 'Color' | 'BW';
  templateId?: 'TEMPLATE_1' | 'TEMPLATE_2' | string;
  paperSize?: 'A4' | 'LEGAL' | string;
  logoBase64?: string;
  fontFamily?: string;
}

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
  serifBold: PDFFont;
  serifItalicBold: PDFFont;
  sansReg: PDFFont;
  sansBold: PDFFont;
}

const COLOR_BLACK = rgb(0, 0, 0);
const COLOR_BORDER = rgb(0, 0, 0);
const COLOR_CUT_LINE = rgb(0.55, 0.55, 0.55);

/** Formats date into DD/MM/YYYY (handles raw numeric serials like 46084) */
function formatDateString(val: string | undefined): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s) return '';

  // Check if numeric serial (e.g. 46084)
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const d = String(date.getUTCDate()).padStart(2, '0');
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const y = String(date.getUTCFullYear());
      return `${d}/${m}/${y}`;
    }
  }

  // Check DD/MM/YYYY or D-M-YYYY
  const ddmm = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/.exec(s);
  if (ddmm) {
    const d = ddmm[1].padStart(2, '0');
    const m = ddmm[2].padStart(2, '0');
    const y = ddmm[3].length === 2 ? `20${ddmm[3]}` : ddmm[3];
    return `${d}/${m}/${y}`;
  }

  // Check ISO YYYY-MM-DD
  const iso = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/.exec(s);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, '0');
    const d = iso[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  return s;
}

/** Split a currency amount into Rupees and Paise strings */
function splitRupeesPaise(valStr: string | undefined): { rs: string; ps: string } {
  if (!valStr) return { rs: '', ps: '' };
  const clean = sanitizeWinAnsi(valStr).replace(/[^0-9.-]/g, '').trim();
  if (!clean) return { rs: '', ps: '' };

  const num = parseFloat(clean);
  if (isNaN(num)) return { rs: sanitizeWinAnsi(valStr), ps: '' };

  const parts = Math.abs(num).toFixed(2).split('.');
  const intPart = parts[0];
  const psPart = parts[1] === '00' ? '00' : parts[1];

  const lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  const formatted = otherNumbers !== ''
    ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;

  const prefix = num < 0 ? '-' : '';
  return { rs: `${prefix}${formatted}`, ps: psPart };
}

/** Text fitting helper */
function fitFontSize(text: string, font: PDFFont, maxFontSize: number, maxWidth: number, minFontSize = 5): number {
  if (!text) return maxFontSize;
  const clean = sanitizeWinAnsi(text);
  let size = maxFontSize;
  while (size > minFontSize) {
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) break;
    size -= 0.5;
  }
  return size;
}

/** Word wrapping helper */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const clean = sanitizeWinAnsi(text);
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/** Draw horizontally centered text */
function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number, color = COLOR_BLACK) {
  if (!text) return;
  const clean = sanitizeWinAnsi(text);
  const w = font.widthOfTextAtSize(clean, size);
  page.drawText(clean, { x: cx - w / 2, y, size, font, color });
}

const RUPEE_SVG_PATH = 'M 6 3 L 18 3 L 18 5 L 13.8 5 C 14.4 5.6 14.8 6.3 15 7 L 18 7 L 18 9 L 15.2 9 C 14.7 11.3 12.7 13 10.3 13 L 9.5 13 L 16 21 L 13 21 L 7 13 L 7 11 L 10.3 11 C 11.8 11 13.1 10 13.5 8.7 L 6 8.7 L 6 6.7 L 13.6 6.7 C 13.3 6 12.7 5.4 12 5 L 6 5 Z';

/** Draw authentic vector Indian Rupee symbol glyph */
function drawRupeeGlyph(page: PDFPage, x: number, y: number, size: number, color = COLOR_BLACK) {
  const scale = size / 19;
  page.drawSvgPath(RUPEE_SVG_PATH, {
    x: x - 6 * scale,
    y: y + size + 2 * scale,
    scale,
    color,
  });
}

/** Split payee or chargeTo across row 1 and row 2 underlines */
function wrapPayeeOrChargeLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  line1W: number,
  line2W: number
): { line1: string; line2: string } {
  if (!text) return { line1: '', line2: '' };
  const clean = text.trim();
  if (font.widthOfTextAtSize(clean, fontSize) <= line1W) {
    return { line1: clean, line2: '' };
  }

  const words = clean.split(/\s+/);
  let l1 = '';
  let wordIdx = 0;

  for (; wordIdx < words.length; wordIdx++) {
    const test = l1 ? `${l1} ${words[wordIdx]}` : words[wordIdx];
    if (font.widthOfTextAtSize(test, fontSize) <= line1W) {
      l1 = test;
    } else {
      break;
    }
  }

  if (!l1 && words.length > 0) {
    let charIdx = 0;
    while (charIdx < clean.length && font.widthOfTextAtSize(clean.substring(0, charIdx + 1), fontSize) <= line1W) {
      charIdx++;
    }
    l1 = clean.substring(0, charIdx);
    const l2 = clean.substring(charIdx).trim();
    return { line1: l1, line2: l2 };
  }

  const l2 = words.slice(wordIdx).join(' ').trim();
  return { line1: l1, line2: l2 };
}


export class VoucherRenderer {
  /**
   * Renders Voucher records into PDF buffer(s).
   * Fixed layout: A4 Portrait (595.28 pt x 841.89 pt), exactly 2 vouchers per sheet.
   */
  static async render(
    records: VoucherRecord[],
    society: SocietyMaster | null,
    options?: VoucherRenderOptions
  ): Promise<Buffer> {
    const doc = wrapPdfDocumentForWinAnsi(await PDFDocument.create());
    doc.registerFontkit(fontkit);

    const rawFont = options?.fontFamily || options?.settings?.fontFamily || 'Times-Roman';
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
            } catch (e) { }
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
        } catch (e) { }
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
            } catch (e) { }
          }
        }
        for (const p of boldCandidates) {
          if (fs.existsSync(p)) {
            try {
              customBoldFont = await doc.embedFont(fs.readFileSync(p));
              break;
            } catch (e) { }
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
        } catch (e) { }
      }
    }

    let reg: PDFFont;
    let bold: PDFFont;
    let serifBold: PDFFont;
    let serifItalicBold: PDFFont;
    const sansReg: PDFFont = await doc.embedFont(StandardFonts.Helvetica);
    const sansBold: PDFFont = await doc.embedFont(StandardFonts.HelveticaBold);

    if (customFont) {
      reg = customFont;
      bold = customBoldFont || customFont;
      serifBold = customBoldFont || customFont;
      serifItalicBold = customBoldFont || customFont;
    } else if (fontName.includes('courier')) {
      reg = await doc.embedFont(StandardFonts.Courier);
      bold = await doc.embedFont(StandardFonts.CourierBold);
      serifBold = await doc.embedFont(StandardFonts.CourierBold);
      serifItalicBold = await doc.embedFont(StandardFonts.CourierBoldOblique);
    } else if (fontName.includes('helvetica-bold')) {
      reg = await doc.embedFont(StandardFonts.HelveticaBold);
      bold = await doc.embedFont(StandardFonts.HelveticaBold);
      serifBold = await doc.embedFont(StandardFonts.HelveticaBold);
      serifItalicBold = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
    } else if (fontName.includes('helvetica')) {
      reg = await doc.embedFont(StandardFonts.Helvetica);
      bold = await doc.embedFont(StandardFonts.HelveticaBold);
      serifBold = await doc.embedFont(StandardFonts.HelveticaBold);
      serifItalicBold = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
    } else {
      // Default: Times-Roman Standard
      reg = await doc.embedFont(StandardFonts.TimesRoman);
      bold = await doc.embedFont(StandardFonts.TimesRomanBold);
      serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
      serifItalicBold = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
    }

    const fonts: Fonts = { reg, bold, serifBold, serifItalicBold, sansReg, sansBold };

    // Embed Society Logo if present
    let logoImg: PDFImage | undefined;
    const logoDataUrl = options?.logoBase64 !== undefined ? options.logoBase64 : (society?.logoBase64 || '');
    if (logoDataUrl && typeof logoDataUrl === 'string' && logoDataUrl.includes(',')) {
      try {
        const b64 = logoDataUrl.split(',')[1];
        if (b64 && b64.trim().length > 0) {
          const imgBytes = typeof Buffer !== 'undefined'
            ? Buffer.from(b64, 'base64')
            : Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          if (logoDataUrl.includes('image/png')) {
            logoImg = await doc.embedPng(imgBytes);
          } else {
            try {
              logoImg = await doc.embedPng(imgBytes);
            } catch {
              logoImg = await doc.embedJpg(imgBytes);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to embed logo image:', e);
      }
    }

    const templateId = options?.templateId || 'TEMPLATE_1';

    // Fixed Paper Size: A4 Portrait (595.28 pt x 841.89 pt), exactly 2 vouchers per sheet
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const VOUCHERS_PER_PAGE = 2;

    const marginLeft = 45;
    const marginRight = 30;
    const marginTop = 26;
    const marginBottom = 26;

    const usableW = PAGE_W - marginLeft - marginRight;
    const usableH = PAGE_H - marginTop - marginBottom;
    const voucherH = usableH / VOUCHERS_PER_PAGE;
    const vchW = usableW;
    const vchX = marginLeft;

    // If records is empty, generate 1 blank sheet
    const activeRecords = records.length > 0 ? records : [
      { voucherNo: '001', toPayee: '', chargeTo: '', particulars: '', bankName: '', chequeNo: '', voucherDate: '', billAmount: '', advLessPaid: '', subTotal1: '', tdsPercent: '', tdsAmount: '', subTotal2: '', cgstPercent: '', cgstAmount: '', roundOff: '', netPaid: '' }
    ];

    const totalPages = Math.ceil(activeRecords.length / VOUCHERS_PER_PAGE);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      const pageRecords = activeRecords.slice(pageIdx * VOUCHERS_PER_PAGE, (pageIdx + 1) * VOUCHERS_PER_PAGE);

      for (let vIdx = 0; vIdx < VOUCHERS_PER_PAGE; vIdx++) {
        const vchRecord = pageRecords[vIdx];
        const vchY = PAGE_H - marginTop - (vIdx + 1) * voucherH;

        const currentData = vchRecord || {
          voucherNo: '', toPayee: '', chargeTo: '', particulars: '', bankName: '', chequeNo: '', voucherDate: '', billAmount: '', advLessPaid: '', subTotal1: '', tdsPercent: '', tdsAmount: '', subTotal2: '', cgstPercent: '', cgstAmount: '', roundOff: '', netPaid: ''
        };

        if (templateId === 'TEMPLATE_2') {
          this.drawTemplate2_OpenLedger(page, vchX, vchY, vchW, voucherH, currentData, society, fonts, logoImg);
        } else {
          this.drawTemplate1_Breakdown(page, vchX, vchY, vchW, voucherH, currentData, society, fonts, logoImg);
        }

        // Cutting dotted line between voucher 1 and voucher 2
        if (vIdx < VOUCHERS_PER_PAGE - 1) {
          const cutY = vchY;
          page.drawLine({
            start: { x: 16, y: cutY },
            end: { x: PAGE_W - 16, y: cutY },
            color: COLOR_CUT_LINE,
            thickness: 0.6,
            dashArray: [4, 4],
            lineCap: LineCapStyle.Round,
          });
        }
      }
    }

    const pdfBytes = await doc.save();
    return typeof Buffer !== 'undefined' ? Buffer.from(pdfBytes) : (pdfBytes as any);
  }

  // =========================================================================
  // TEMPLATE 1: DETAILED FINANCIAL CALCULATION (Exact Reference Matching)
  // =========================================================================
  private static drawTemplate1_Breakdown(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: VoucherRecord,
    society: SocietyMaster | null,
    fonts: Fonts,
    logoImg?: PDFImage
  ) {
    // Dynamic Society & Voucher Metadata
    const fullSocName = data.societyName || society?.societyName || 'Aishwarya Heights Co-op. Housing Society Ltd.';
    const socNo = data.socNumber || society?.registrationNo || '';
    const regDate = formatDateString(society?.registrationDate || '');
    const socAddress = data.societyAddress || society?.address || '';

    // Master Dimensions (No outer rectangle border — open sheet layout as in reference)
    const vH = h - 8;
    const vY = y + 4;
    const yTop = vY + vH;

    // ── 1. Top Header Compartment ───────────────────────────────────────────
    const headerH = 62;
    const headerBottomY = yTop - headerH;
    const vchBoxW = 145;
    const vchBoxH = 22;
    const vchBoxX = x + w - vchBoxW;
    const vchBoxY = yTop - 6 - vchBoxH;

    // Society Logo (if provided)
    let textStartX = x;
    if (logoImg) {
      const logoSize = 34;
      page.drawImage(logoImg, {
        x,
        y: yTop - logoSize - 6,
        width: logoSize,
        height: logoSize,
      });
      textStartX = x + logoSize + 10;
    }

    // Left Society Header block width and center
    const headerAreaW = vchBoxX - textStartX - 15;

    // Level 1: Society Name (Italic Serif Bold) starting flush at left margin
    const socSz = fitFontSize(fullSocName, fonts.serifItalicBold, 15, headerAreaW, 9.5);
    page.drawText(fullSocName, { x: textStartX + 2, y: yTop - 14, size: socSz, font: fonts.serifItalicBold, color: COLOR_BLACK });

    const socWidth = fonts.serifItalicBold.widthOfTextAtSize(fullSocName, socSz);
    const socCX = textStartX + 2 + Math.min(socWidth, headerAreaW) / 2;

    // Level 2: Registration Line (Centered directly below society name)
    const regStr = socNo
      ? `Reg. No. : ${socNo}${regDate ? ' Dated ' + regDate : ''}`
      : 'Reg. No. : M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023 Dated 02.01.2023';
    const regSz = fitFontSize(regStr, fonts.sansBold, 8.5, headerAreaW, 6.5);
    drawCentered(page, regStr, fonts.sansBold, regSz, socCX, yTop - 27, COLOR_BLACK);

    // Levels 3 & 4: Address Lines (Centered directly below registration line)
    const defaultAddr = 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.';
    const addrLines = wrapText(socAddress || defaultAddr, fonts.sansBold, 7.8, headerAreaW);
    if (addrLines[0]) {
      const a1Sz = fitFontSize(addrLines[0], fonts.sansBold, 7.8, headerAreaW, 6.5);
      drawCentered(page, addrLines[0], fonts.sansBold, a1Sz, socCX, yTop - 38, COLOR_BLACK);
    }
    if (addrLines[1]) {
      const a2Sz = fitFontSize(addrLines[1], fonts.sansBold, 7.8, headerAreaW, 6.5);
      drawCentered(page, addrLines[1], fonts.sansBold, a2Sz, socCX, yTop - 48, COLOR_BLACK);
    }

    // Right Area: Voucher No. Box & Date (Standalone box, NO vertical dividing line to the left)
    page.drawRectangle({
      x: vchBoxX,
      y: vchBoxY,
      width: vchBoxW,
      height: vchBoxH,
      borderColor: COLOR_BORDER,
      borderWidth: 1.1,
      color: rgb(1, 1, 1),
    });

    const vchLabel = 'Voucher No.  ';
    page.drawText(vchLabel, { x: vchBoxX + 6, y: vchBoxY + 6.5, size: 9, font: fonts.bold, color: COLOR_BLACK });
    if (data.voucherNo) {
      const vchValX = vchBoxX + fonts.bold.widthOfTextAtSize(vchLabel, 9) + 4;
      const vchMaxW = vchBoxW - (vchValX - vchBoxX) - 4;
      const vchSz = fitFontSize(String(data.voucherNo), fonts.bold, 9, vchMaxW, 7);
      page.drawText(sanitizeWinAnsi(String(data.voucherNo)), { x: vchValX, y: vchBoxY + 6.5, size: vchSz, font: fonts.bold, color: COLOR_BLACK });
    }

    // Date below Voucher box (Double underline with ample clearance above divider line)
    const dateY = yTop - 46;
    page.drawText('Date :', { x: vchBoxX + 2, y: dateY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    const dateLineStart = vchBoxX + 32;
    const dateLineEnd = x + w;
    page.drawLine({ start: { x: dateLineStart, y: dateY - 2.0 }, end: { x: dateLineEnd, y: dateY - 2.0 }, color: COLOR_BORDER, thickness: 0.6 });
    page.drawLine({ start: { x: dateLineStart, y: dateY - 3.8 }, end: { x: dateLineEnd, y: dateY - 3.8 }, color: COLOR_BORDER, thickness: 0.6 });

    const formattedVchDate = formatDateString(data.voucherDate);
    if (formattedVchDate) {
      const dSz = fitFontSize(formattedVchDate, fonts.bold, 8.5, dateLineEnd - dateLineStart - 6, 7);
      page.drawText(formattedVchDate, { x: dateLineStart + 6, y: dateY, size: dSz, font: fonts.bold, color: COLOR_BLACK });
    } else {
      page.drawText('/', { x: dateLineStart + 26, y: dateY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
      page.drawText('/', { x: dateLineStart + 60, y: dateY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
    }

    // Top Divider Line directly beneath address and Date compartment
    page.drawLine({
      start: { x, y: headerBottomY },
      end: { x: x + w, y: headerBottomY },
      color: COLOR_BORDER,
      thickness: 1.0,
    });

    // ── 2. PAY TO / CHARGE TO Compartment (34 pt) ───────────────────────────
    const payH = 34;
    const payBottomY = headerBottomY - payH;
    const midX = x + Math.round(w * 0.57); // 57% PAY To, 43% CHARGE To

    // Vertical divider between PAY TO and CHARGE TO
    page.drawLine({
      start: { x: midX, y: headerBottomY },
      end: { x: midX, y: payBottomY },
      color: COLOR_BORDER,
      thickness: 1.0,
    });

    // Double horizontal bottom border below PAY TO / CHARGE TO
    page.drawLine({ start: { x, y: payBottomY + 1.2 }, end: { x: x + w, y: payBottomY + 1.2 }, color: COLOR_BORDER, thickness: 0.6 });
    page.drawLine({ start: { x, y: payBottomY - 0.8 }, end: { x: x + w, y: payBottomY - 0.8 }, color: COLOR_BORDER, thickness: 0.6 });

    // Row 1: PAY To, & CHARGE To,
    const payRow1Y = headerBottomY - 13;
    const payRow2Y = headerBottomY - 25;
    const payLbl = 'PAY To,';
    page.drawText(payLbl, { x: x + 4, y: payRow1Y, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    const payLine1Start = x + fonts.bold.widthOfTextAtSize(payLbl, 8.5) + 6;
    const payLine1End = midX - 8;
    page.drawLine({ start: { x: payLine1Start, y: payRow1Y - 1.5 }, end: { x: payLine1End, y: payRow1Y - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

    const pay1AvailW = payLine1End - payLine1Start - 4;
    const pay2AvailW = payLine1End - (x + 4) - 4;
    if (data.toPayee) {
      const { line1, line2 } = wrapPayeeOrChargeLines(data.toPayee, fonts.bold, 8.5, pay1AvailW, pay2AvailW);
      if (line1) {
        const p1Sz = fitFontSize(line1, fonts.bold, 8.5, pay1AvailW, 7);
        page.drawText(sanitizeWinAnsi(line1), { x: payLine1Start + 3, y: payRow1Y + 1, size: p1Sz, font: fonts.bold, color: COLOR_BLACK });
      }
      if (line2) {
        const p2Sz = fitFontSize(line2, fonts.bold, 8.5, pay2AvailW, 7);
        page.drawText(sanitizeWinAnsi(line2), { x: x + 4 + 2, y: payRow2Y + 1.2, size: p2Sz, font: fonts.bold, color: COLOR_BLACK });
      }
    }

    const chgX = midX + 8;
    const chgLbl = 'CHARGE To,';
    page.drawText(chgLbl, { x: chgX, y: payRow1Y, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    const chgLine1Start = chgX + fonts.bold.widthOfTextAtSize(chgLbl, 8.5) + 6;
    const chgLine1End = x + w - 4;
    page.drawLine({ start: { x: chgLine1Start, y: payRow1Y - 1.5 }, end: { x: chgLine1End, y: payRow1Y - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

    const chg1AvailW = chgLine1End - chgLine1Start - 4;
    const chg2AvailW = chgLine1End - chgX - 4;
    if (data.chargeTo) {
      const { line1, line2 } = wrapPayeeOrChargeLines(data.chargeTo, fonts.bold, 8.5, chg1AvailW, chg2AvailW);
      if (line1) {
        const c1Sz = fitFontSize(line1, fonts.bold, 8.5, chg1AvailW, 7);
        page.drawText(sanitizeWinAnsi(line1), { x: chgLine1Start + 3, y: payRow1Y + 1, size: c1Sz, font: fonts.bold, color: COLOR_BLACK });
      }
      if (line2) {
        const c2Sz = fitFontSize(line2, fonts.bold, 8.5, chg2AvailW, 7);
        page.drawText(sanitizeWinAnsi(line2), { x: chgX + 2, y: payRow2Y + 1.2, size: c2Sz, font: fonts.bold, color: COLOR_BLACK });
      }
    }

    // Row 2: Secondary writing underlines (Both start from below their labels)
    page.drawLine({ start: { x: x + 4, y: payRow2Y }, end: { x: payLine1End, y: payRow2Y }, color: COLOR_BORDER, thickness: 0.6 });
    page.drawLine({ start: { x: chgX, y: payRow2Y }, end: { x: chgLine1End, y: payRow2Y }, color: COLOR_BORDER, thickness: 0.6 });

    // ── 3. Main Accounting Table Compartment (10 Continuous Rows) ───────────
    const footerH = 75; // Ample footer height to contain stamp box and signatures with zero overlap
    const tableBottomY = vY + footerH;
    const tableTopY = payBottomY - 1.5;
    const tableH = tableTopY - tableBottomY;

    // 4 Fixed Columns: Particulars (57%) | Description (20%) | Rs. (16%) | Ps. (7%)
    const colPartW = Math.round(w * 0.57);
    const colLblW = Math.round(w * 0.20);
    const colRsW = Math.round(w * 0.16);
    const colPsW = w - colPartW - colLblW - colRsW;

    const xPartEnd = x + colPartW;
    const xLblEnd = xPartEnd + colLblW;
    const xRsEnd = xLblEnd + colRsW;

    const thH = 16;
    const thY = tableTopY - thH;
    const financialRowsCount = 10;
    const rowH = (tableH - thH) / financialRowsCount;

    // Header divider horizontal line
    page.drawLine({ start: { x, y: thY }, end: { x: x + w, y: thY }, color: COLOR_BORDER, thickness: 1.0 });

    // Full-height vertical column dividers (including left and right borders to match reference image)
    page.drawLine({ start: { x, y: tableBottomY }, end: { x, y: tableTopY }, color: COLOR_BORDER, thickness: 1.0 });
    page.drawLine({ start: { x: xPartEnd, y: tableBottomY }, end: { x: xPartEnd, y: tableTopY }, color: COLOR_BORDER, thickness: 1.0 });
    page.drawLine({ start: { x: xLblEnd, y: tableBottomY }, end: { x: xLblEnd, y: tableTopY }, color: COLOR_BORDER, thickness: 0.8 });
    page.drawLine({ start: { x: xRsEnd, y: tableBottomY }, end: { x: xRsEnd, y: tableTopY }, color: COLOR_BORDER, thickness: 0.8 });
    page.drawLine({ start: { x: x + w, y: tableBottomY }, end: { x: x + w, y: tableTopY }, color: COLOR_BORDER, thickness: 1.0 });

    // Header Row Text
    drawCentered(page, 'P   a   r   t   i   c   u   l   a   r   s', fonts.bold, 9, x + colPartW / 2, thY + 4, COLOR_BLACK);
    const rupeeW1 = 12 * (9 / 19);
    drawRupeeGlyph(page, xLblEnd + (colRsW - rupeeW1) / 2, thY + 3.5, 9, COLOR_BLACK);
    drawCentered(page, 'Ps.', fonts.bold, 8.5, xRsEnd + colPsW / 2, thY + 4, COLOR_BLACK);

    // ── Continuous Horizontal Grid Lines Across the FULL TABLE (x to x + w) ──
    for (let i = 1; i < financialRowsCount; i++) {
      const ry = thY - i * rowH;
      page.drawLine({
        start: { x, y: ry },
        end: { x: x + w, y: ry },
        color: COLOR_BORDER,
        thickness: 0.55,
      });
    }

    // Bottom boundary line of the table
    page.drawLine({
      start: { x, y: tableBottomY },
      end: { x: x + w, y: tableBottomY },
      color: COLOR_BORDER,
      thickness: 1.2,
    });

    // ── 10 Financial Rows Definitions ───────────────────────────────────────
    const finRowDefs = [
      { label: 'Bill Amount', percent: '', val: data.billAmount, isBold: false },
      { label: 'Bill Amount', percent: '', val: data.billAmount2 || '', isBold: false },
      { label: 'Adv. Less or Paid', percent: '', val: data.advLessPaid, isBold: false },
      { label: 'Total', percent: '', val: data.subTotal1, isBold: true },
      { label: 'Less TDS @', percent: data.tdsPercent ? `${data.tdsPercent} %` : '    %', val: data.tdsAmount, isBold: false },
      { label: 'Total', percent: '', val: data.subTotal2, isBold: true },
      { label: 'Add CGST @', percent: data.cgstPercent ? `${data.cgstPercent} %` : '    %', val: data.cgstAmount, isBold: false },
      { label: 'Add SGST @', percent: data.sgstPercent ? `${data.sgstPercent} %` : '    %', val: data.sgstAmount, isBold: false },
      { label: 'Round off (+/-)', percent: '', val: data.roundOff, isBold: false },
      { label: 'Net Paid =', percent: '', val: data.netPaid, isBold: true, isHighlight: true },
    ];

    // Narration lines wrapped from data.particulars (fit into rows 0 to 4)
    const partInnerW = colPartW - 14;
    const partLines = data.particulars ? wrapText(data.particulars, fonts.reg, 8.5, partInnerW) : [];

    // Render Row-by-Row Content (Aligned Left and Right)
    for (let rIdx = 0; rIdx < financialRowsCount; rIdx++) {
      const fRow = finRowDefs[rIdx];
      const ry = thY - (rIdx + 1) * rowH;
      const textY = ry + (rowH - 8) / 2 + 1.2;
      const fFont = fRow.isBold ? fonts.bold : fonts.reg;

      // ── RIGHT SIDE: Financial columns ─────────────────────────────────────
      if (fRow.isHighlight || fRow.label === 'Net Paid =') {
        const lblW = fonts.bold.widthOfTextAtSize(fRow.label, 8.5);
        page.drawText(fRow.label, { x: xLblEnd - lblW - 6, y: textY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
      } else if (fRow.label === 'Total') {
        const lblW = fonts.bold.widthOfTextAtSize(fRow.label, 8);
        page.drawText(fRow.label, { x: xLblEnd - lblW - 6, y: textY, size: 8, font: fonts.bold, color: COLOR_BLACK });
      } else if (fRow.percent) {
        // Space-between for TDS, CGST, SGST rows inside Description column
        page.drawText(fRow.label, { x: xPartEnd + 6, y: textY, size: 8, font: fFont, color: COLOR_BLACK });
        const pctW = fonts.reg.widthOfTextAtSize(fRow.percent, 8);
        page.drawText(fRow.percent, { x: xLblEnd - pctW - 6, y: textY, size: 8, font: fonts.reg, color: COLOR_BLACK });
      } else {
        page.drawText(fRow.label, { x: xPartEnd + 6, y: textY, size: 8, font: fFont, color: COLOR_BLACK });
      }

      // Rupees and Paise
      if (fRow.val) {
        const { rs, ps } = splitRupeesPaise(fRow.val);
        const valFont = fRow.isBold ? fonts.bold : fonts.reg;
        const rsW = valFont.widthOfTextAtSize(rs, 8);
        page.drawText(rs, { x: xRsEnd - rsW - 6, y: textY, size: 8, font: valFont, color: COLOR_BLACK });
        if (ps) {
          drawCentered(page, ps, valFont, 7.5, xRsEnd + colPsW / 2, textY, COLOR_BLACK);
        }
      }

      // ── LEFT SIDE: Row-Aligned Narration / Form Fields ───────────────────
      if (rIdx < 5) {
        // Rows 0 to 4: Narration lines (up to 5 lines)
        if (partLines[rIdx]) {
          page.drawText(partLines[rIdx], { x: x + 6, y: textY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
        }
      } else if (rIdx === 5) {
        // Row 5 (aligned with Total): Bill No.:
        page.drawText('Bill No.:', { x: x + 6, y: textY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
        if (data.billNo) {
          const bValSz = fitFontSize(String(data.billNo), fonts.bold, 8.5, colPartW - 56, 7);
          page.drawText(sanitizeWinAnsi(String(data.billNo)), { x: x + 48, y: textY, size: bValSz, font: fonts.bold, color: COLOR_BLACK });
        }
      } else if (rIdx === 6) {
        // Row 6 (aligned with Add CGST @): Bank Name :
        page.drawText('Bank Name :', { x: x + 6, y: textY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
        if (data.bankName) {
          const bSz = fitFontSize(data.bankName, fonts.bold, 8.5, partInnerW - 65, 7);
          page.drawText(sanitizeWinAnsi(data.bankName), { x: x + 66, y: textY, size: bSz, font: fonts.bold, color: COLOR_BLACK });
        }
      } else if (rIdx === 7) {
        // Row 7 (aligned with Add SGST @): Cheque No. & Date
        const chqLbl = 'Cheque No.';
        page.drawText(chqLbl, { x: x + 6, y: textY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
        const chqLine1Start = x + 58;
        const chqLine1End = x + 148;
        page.drawLine({ start: { x: chqLine1Start, y: textY - 1.5 }, end: { x: chqLine1End, y: textY - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });
        if (data.chequeNo) {
          const chqSz = fitFontSize(String(data.chequeNo), fonts.bold, 8.5, chqLine1End - chqLine1Start - 6, 7);
          page.drawText(sanitizeWinAnsi(String(data.chequeNo)), { x: chqLine1Start + 3, y: textY, size: chqSz, font: fonts.bold, color: COLOR_BLACK });
        }

        const dtLblX = chqLine1End + 8;
        page.drawText('Date', { x: dtLblX, y: textY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
        const chqDtStart = dtLblX + 26;
        const chqDtEnd = xPartEnd - 8;
        // Underline for Date
        page.drawLine({ start: { x: chqDtStart, y: textY - 1.5 }, end: { x: chqDtEnd, y: textY - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

        const formattedChqDate = formatDateString((data as any).chequeDate || data.voucherDate);
        if (formattedChqDate) {
          const dtSz = fitFontSize(formattedChqDate, fonts.bold, 8.5, chqDtEnd - chqDtStart - 6, 7);
          page.drawText(formattedChqDate, { x: chqDtStart + 4, y: textY, size: dtSz, font: fonts.bold, color: COLOR_BLACK });
        } else {
          page.drawText('/', { x: chqDtStart + 22, y: textY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
          page.drawText('/', { x: chqDtStart + 52, y: textY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
        }
      } else if (rIdx === 8) {
        // Row 8 (aligned with Round off (+/-)): Indian Rupee Symbol and Net Paid Amount
        drawRupeeGlyph(page, x + 6, textY - 1, 10, COLOR_BLACK);
        page.drawText('.', { x: x + 13, y: textY, size: 10, font: fonts.bold, color: COLOR_BLACK });

        const amtLineStart = x + 18;
        const amtLineEnd = xPartEnd - 8;
        page.drawLine({ start: { x: amtLineStart, y: textY - 1.5 }, end: { x: amtLineEnd, y: textY - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

        const totalNet = data.netPaid || data.billAmount || '';
        if (totalNet) {
          const netPaidStr = `${splitRupeesPaise(totalNet).rs}/-`;
          const nSz = fitFontSize(netPaidStr, fonts.bold, 9.5, amtLineEnd - amtLineStart - 6, 7.5);
          page.drawText(netPaidStr, { x: amtLineStart + 4, y: textY, size: nSz, font: fonts.bold, color: COLOR_BLACK });
        }
      } else if (rIdx === 9) {
        // Row 9 (aligned with Net Paid =): Clean open space
      }
    }

    // ── 4. Footer & Signatures Section (Below Table - Open space, no enclosing box)
    const sigRowY = vY + 10;
    const sig1X = x + 6;
    const sig2CX = x + w * 0.38;
    const sig3CX = x + w * 0.65;
    const sig4EndX = x + w;

    page.drawText('Chairman', { x: sig1X, y: sigRowY, size: 9, font: fonts.bold, color: COLOR_BLACK });
    drawCentered(page, 'Secretary', fonts.bold, 9, sig2CX, sigRowY, COLOR_BLACK);
    drawCentered(page, 'Treasurer', fonts.bold, 9, sig3CX, sigRowY, COLOR_BLACK);

    const recText = "Receiver's Signature";
    const recW = fonts.bold.widthOfTextAtSize(recText, 9);
    const recX = sig4EndX - recW;
    page.drawText(recText, { x: recX, y: sigRowY, size: 9, font: fonts.bold, color: COLOR_BLACK });

    // Revenue Stamp Box: Compact rectangle positioned directly above Receiver's Signature
    // Not very long, centered above Receiver's Signature: width: 42, height: 24
    const stampBoxW = 42;
    const stampBoxH = 24;
    const stampBoxX = recX + (recW - stampBoxW) / 2;
    const stampBoxY = sigRowY + 14;

    page.drawRectangle({
      x: stampBoxX,
      y: stampBoxY,
      width: stampBoxW,
      height: stampBoxH,
      borderColor: COLOR_BORDER,
      borderWidth: 1.0,
      color: rgb(1, 1, 1),
    });
  }

  // =========================================================================
  // TEMPLATE 2: OPEN LEDGER GRID STYLE (Sai Rachna Reference Style)
  // =========================================================================
  private static drawTemplate2_OpenLedger(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    data: VoucherRecord,
    society: SocietyMaster | null,
    fonts: Fonts,
    logoImg?: PDFImage
  ) {
    const fullSocName = data.societyName || society?.societyName || 'SAI RACHNA CO-OP. HOUSING SOCIETY LTD.';
    const socNo = data.socNumber || society?.registrationNo || '';
    const regDate = formatDateString(society?.registrationDate || '');
    const socAddress = data.societyAddress || society?.address || '';

    // Master Dimensions (No outer rectangle border — open sheet layout as in reference)
    const vH = h - 8;
    const vY = y + 4;
    const yTop = vY + vH;

    // ── 1. Top Header Compartment ───────────────────────────────────────────
    const headerH = 60;
    const headerBottomY = yTop - headerH;
    const vchBoxW = 142;
    const vchBoxH = 22;
    const vchBoxX = x + w - vchBoxW;
    const vchBoxY = yTop - 6 - vchBoxH;

    // Society Logo (if provided)
    let textStartX = x;
    if (logoImg) {
      const logoSize = 34;
      page.drawImage(logoImg, {
        x,
        y: yTop - logoSize - 8,
        width: logoSize,
        height: logoSize,
      });
      textStartX = x + logoSize + 10;
    }

    // Centered Society Header text in the area left of Voucher No box
    const headerAreaW = vchBoxX - textStartX - 12;
    const headerCX = textStartX + headerAreaW / 2;

    // Society Name: Bold Uppercase Sans-Serif (Arial/Helvetica Style)
    const upperSocName = fullSocName.toUpperCase();
    const socSz = fitFontSize(upperSocName, fonts.sansBold, 13.5, headerAreaW, 9.5);
    drawCentered(page, upperSocName, fonts.sansBold, socSz, headerCX, yTop - 14, COLOR_BLACK);

    // Reg No. & Date: Centered
    const regStr = socNo
      ? `Reg. No. MUM / SRA / HSG / (TC) / ${socNo}${regDate ? ' Dated-' + regDate : ''}`
      : 'Reg. No. MUM / SRA / HSG / (TC) / 13334 / Year-2022-23 Dated-05 / 08 / 2022';
    const regSz = fitFontSize(regStr, fonts.sansBold, 8, headerAreaW, 6.5);
    drawCentered(page, regStr, fonts.sansBold, regSz, headerCX, yTop - 27, COLOR_BLACK);

    // Address Lines: Centered
    const defaultAddr = 'CTS No.747(P) of Village Mulund, Dumping Road, P. D. Road, Opp. Babu Jagjivan Ram Nagar,\nMulund (West), Mumbai – 400 080.';
    const addrLines = wrapText(socAddress || defaultAddr, fonts.sansBold, 7.5, headerAreaW);
    if (addrLines[0]) {
      const a1Sz = fitFontSize(addrLines[0], fonts.sansBold, 7.5, headerAreaW, 6.5);
      drawCentered(page, addrLines[0], fonts.sansBold, a1Sz, headerCX, yTop - 39, COLOR_BLACK);
    }
    if (addrLines[1]) {
      const a2Sz = fitFontSize(addrLines[1], fonts.sansBold, 7.5, headerAreaW, 6.5);
      drawCentered(page, addrLines[1], fonts.sansBold, a2Sz, headerCX, yTop - 49, COLOR_BLACK);
    }

    // Right Area: Voucher No. Box & Date (Clean standalone box, no dividing line to the left)
    page.drawRectangle({
      x: vchBoxX,
      y: vchBoxY,
      width: vchBoxW,
      height: vchBoxH,
      borderColor: COLOR_BORDER,
      borderWidth: 1.1,
      color: rgb(1, 1, 1),
    });

    const vchLabel = 'Voucher No.  ';
    page.drawText(vchLabel, { x: vchBoxX + 6, y: vchBoxY + 6.5, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    if (data.voucherNo) {
      const vchValX = vchBoxX + fonts.sansBold.widthOfTextAtSize(vchLabel, 8.5) + 4;
      const vchMaxW = vchBoxW - (vchValX - vchBoxX) - 4;
      const vchSz = fitFontSize(String(data.voucherNo), fonts.sansBold, 9, vchMaxW, 7);
      page.drawText(sanitizeWinAnsi(String(data.voucherNo)), { x: vchValX, y: vchBoxY + 6.5, size: vchSz, font: fonts.sansBold, color: COLOR_BLACK });
    }

    // Date below Voucher box (Double underline)
    const dateLabelY = yTop - 48;
    page.drawText('Date :', { x: vchBoxX + 2, y: dateLabelY, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    const dateLineStartX = vchBoxX + 32;
    const dateLineEndX = x + w;
    page.drawLine({ start: { x: dateLineStartX, y: dateLabelY - 1.5 }, end: { x: dateLineEndX, y: dateLabelY - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });
    page.drawLine({ start: { x: dateLineStartX, y: dateLabelY - 3.2 }, end: { x: dateLineEndX, y: dateLabelY - 3.2 }, color: COLOR_BORDER, thickness: 0.6 });

    const formattedVchDate = formatDateString(data.voucherDate);
    if (formattedVchDate) {
      const dSz = fitFontSize(formattedVchDate, fonts.sansBold, 8.5, dateLineEndX - dateLineStartX - 6, 7);
      page.drawText(formattedVchDate, { x: dateLineStartX + 6, y: dateLabelY, size: dSz, font: fonts.sansBold, color: COLOR_BLACK });
    } else {
      page.drawText('/', { x: dateLineStartX + 26, y: dateLabelY, size: 8.5, font: fonts.sansReg, color: COLOR_BLACK });
      page.drawText('/', { x: dateLineStartX + 60, y: dateLabelY, size: 8.5, font: fonts.sansReg, color: COLOR_BLACK });
    }

    // Top Divider Line directly beneath address spanning across
    page.drawLine({
      start: { x, y: headerBottomY },
      end: { x: x + w, y: headerBottomY },
      color: COLOR_BORDER,
      thickness: 1.0,
    });

    // ── 2. PAY To / CHARGE To Section (57% PAY To, 43% CHARGE To) ───────────
    const payH = 36;
    const payBottomY = headerBottomY - payH;
    const midX = x + Math.round(w * 0.57);

    // Solid Vertical Center Divider cleanly starting at top border and ending at bottom boundary
    page.drawLine({
      start: { x: midX, y: headerBottomY },
      end: { x: midX, y: payBottomY },
      color: COLOR_BORDER,
      thickness: 1.0,
    });

    // Double bottom boundary line below PAY To / CHARGE To
    page.drawLine({ start: { x, y: payBottomY + 1.2 }, end: { x: x + w, y: payBottomY + 1.2 }, color: COLOR_BORDER, thickness: 0.6 });
    page.drawLine({ start: { x, y: payBottomY - 0.6 }, end: { x: x + w, y: payBottomY - 0.6 }, color: COLOR_BORDER, thickness: 0.6 });

    // PAY To
    const payRow1Y = headerBottomY - 14;
    const payRow2Y = headerBottomY - 28;
    const payLbl = 'PAY To,';
    page.drawText(payLbl, { x: x + 4, y: payRow1Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    const payLineStartX = x + fonts.sansBold.widthOfTextAtSize(payLbl, 8.5) + 6;
    const payLineEndX = midX - 8;
    page.drawLine({ start: { x: payLineStartX, y: payRow1Y - 1.5 }, end: { x: payLineEndX, y: payRow1Y - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

    const pay1AvailW = payLineEndX - payLineStartX - 4;
    const pay2AvailW = payLineEndX - (x + 4) - 4;
    if (data.toPayee) {
      const { line1, line2 } = wrapPayeeOrChargeLines(data.toPayee, fonts.sansBold, 8.5, pay1AvailW, pay2AvailW);
      if (line1) {
        const p1Sz = fitFontSize(line1, fonts.sansBold, 8.5, pay1AvailW, 7);
        page.drawText(sanitizeWinAnsi(line1), { x: payLineStartX + 3, y: payRow1Y + 1, size: p1Sz, font: fonts.sansBold, color: COLOR_BLACK });
      }
      if (line2) {
        const p2Sz = fitFontSize(line2, fonts.sansBold, 8.5, pay2AvailW, 7);
        page.drawText(sanitizeWinAnsi(line2), { x: x + 4 + 2, y: payRow2Y + 1.2, size: p2Sz, font: fonts.sansBold, color: COLOR_BLACK });
      }
    }

    // CHARGE To
    const chgX = midX + 8;
    const chgLbl = 'CHARGE To,';
    page.drawText(chgLbl, { x: chgX, y: payRow1Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    const chgLineStartX = chgX + fonts.sansBold.widthOfTextAtSize(chgLbl, 8.5) + 6;
    const chgLineEndX = x + w;
    page.drawLine({ start: { x: chgLineStartX, y: payRow1Y - 1.5 }, end: { x: chgLineEndX, y: payRow1Y - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

    const chg1AvailW = chgLineEndX - chgLineStartX - 4;
    const chg2AvailW = chgLineEndX - chgX - 4;
    if (data.chargeTo) {
      const { line1, line2 } = wrapPayeeOrChargeLines(data.chargeTo, fonts.sansBold, 8.5, chg1AvailW, chg2AvailW);
      if (line1) {
        const c1Sz = fitFontSize(line1, fonts.sansBold, 8.5, chg1AvailW, 7);
        page.drawText(sanitizeWinAnsi(line1), { x: chgLineStartX + 3, y: payRow1Y + 1, size: c1Sz, font: fonts.sansBold, color: COLOR_BLACK });
      }
      if (line2) {
        const c2Sz = fitFontSize(line2, fonts.sansBold, 8.5, chg2AvailW, 7);
        page.drawText(sanitizeWinAnsi(line2), { x: chgX + 2, y: payRow2Y + 1.2, size: c2Sz, font: fonts.sansBold, color: COLOR_BLACK });
      }
    }

    // Row 2 Underlines (Both start from below their labels)
    page.drawLine({ start: { x: x + 4, y: payRow2Y }, end: { x: payLineEndX, y: payRow2Y }, color: COLOR_BORDER, thickness: 0.6 });
    page.drawLine({ start: { x: chgX, y: payRow2Y }, end: { x: chgLineEndX, y: payRow2Y }, color: COLOR_BORDER, thickness: 0.6 });

    // ── 3. Main Accounting Table Compartment (3-Column Open Ledger: 76.5% | 16% | 7.5%)
    const footerH = 75;
    const tableBottom = vY + footerH;
    const tableTop = payBottomY - 1.5;
    const tableH = tableTop - tableBottom;

    // 3 Columns matching Vouchertem2: Particulars (76.5%) | ₹ (16%) | Ps. (7.5%)
    const colPartW = Math.round(w * 0.765);
    const colRsW = Math.round(w * 0.16);
    const colPsW = w - colPartW - colRsW;

    const xPartEnd = x + colPartW;
    const xRsEnd = xPartEnd + colRsW;

    const thH = 16;
    const thY = tableTop - thH;

    // Header divider horizontal line
    page.drawLine({ start: { x, y: thY }, end: { x: x + w, y: thY }, color: COLOR_BORDER, thickness: 1.0 });

    // Full-height vertical column dividers (including left and right borders of table to match image)
    page.drawLine({ start: { x, y: tableBottom }, end: { x, y: tableTop }, color: COLOR_BORDER, thickness: 1.0 });
    page.drawLine({ start: { x: xPartEnd, y: tableBottom }, end: { x: xPartEnd, y: tableTop }, color: COLOR_BORDER, thickness: 1.0 });
    page.drawLine({ start: { x: xRsEnd, y: tableBottom }, end: { x: xRsEnd, y: tableTop }, color: COLOR_BORDER, thickness: 0.8 });
    page.drawLine({ start: { x: x + w, y: tableBottom }, end: { x: x + w, y: tableTop }, color: COLOR_BORDER, thickness: 1.0 });

    // Header Text
    drawCentered(page, 'P   a   r   t   i   c   u   l   a   r   s', fonts.sansBold, 9, x + colPartW / 2, thY + 4, COLOR_BLACK);
    const rupeeW2 = 12 * (9 / 19);
    drawRupeeGlyph(page, xPartEnd + (colRsW - rupeeW2) / 2, thY + 3.5, 9, COLOR_BLACK);
    drawCentered(page, 'Ps.', fonts.sansBold, 8.5, xRsEnd + colPsW / 2, thY + 4, COLOR_BLACK);

    // ── 11 Continuous Rows: 8 Open Rows + Bank Name + Cheque No. + Total ───
    const t2RowCount = 11;
    const rowH = (tableH - thH) / t2RowCount;

    // Draw horizontal dividers for all 11 rows
    for (let i = 1; i < t2RowCount; i++) {
      const ry = thY - i * rowH;
      page.drawLine({
        start: { x, y: ry },
        end: { x: x + w, y: ry },
        color: COLOR_BORDER,
        thickness: 0.55,
      });
    }

    // Bottom boundary line of the table
    page.drawLine({
      start: { x, y: tableBottom },
      end: { x: x + w, y: tableBottom },
      color: COLOR_BORDER,
      thickness: 1.2,
    });

    // Narration lines for open rows 0 to 7
    const partInnerW = colPartW - 14;
    const partLines = data.particulars ? wrapText(data.particulars, fonts.sansReg, 8.5, partInnerW) : [];

    // Financial breakdown values corresponding to rows in ₹ and Ps columns
    const t2FinValues = [
      data.billAmount,       // Row 0: Bill Amount 1
      data.billAmount2,      // Row 1: Bill Amount 2
      data.advLessPaid,      // Row 2: Adv. Less or Paid
      data.subTotal1,        // Row 3: Total (Sub Total 1)
      data.tdsAmount,        // Row 4: Less TDS
      data.subTotal2,        // Row 5: Total (Sub Total 2)
      data.cgstAmount,       // Row 6: Add CGST
      data.sgstAmount,       // Row 7: Add SGST
    ];

    for (let rIdx = 0; rIdx < 8; rIdx++) {
      const ry = thY - (rIdx + 1) * rowH;
      const textY = ry + (rowH - 8) / 2 + 1.2;
      if (partLines[rIdx]) {
        page.drawText(partLines[rIdx], { x: x + 6, y: textY, size: 8.5, font: fonts.sansReg, color: COLOR_BLACK });
      }

      const val = t2FinValues[rIdx];
      if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '0') {
        const { rs, ps } = splitRupeesPaise(String(val));
        if (rs) {
          const rsW = fonts.sansBold.widthOfTextAtSize(rs, 8.5);
          page.drawText(rs, { x: xRsEnd - rsW - 6, y: textY, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
          if (ps) {
            drawCentered(page, ps, fonts.sansBold, 8, xRsEnd + colPsW / 2, textY, COLOR_BLACK);
          }
        }
      }
    }

    // Row 8: Bank Name Row (+ Round Off in Rs/Ps)
    const row8Y = thY - 9 * rowH;
    const text8Y = row8Y + (rowH - 8) / 2 + 1.2;
    page.drawText('Bank Name', { x: x + 6, y: text8Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    if (data.bankName) {
      const bSz = fitFontSize(data.bankName, fonts.sansBold, 8.5, partInnerW - 65, 7);
      page.drawText(sanitizeWinAnsi(data.bankName), { x: x + 65, y: text8Y, size: bSz, font: fonts.sansBold, color: COLOR_BLACK });
    }
    if (data.roundOff && String(data.roundOff).trim() !== '' && String(data.roundOff).trim() !== '0') {
      const { rs, ps } = splitRupeesPaise(String(data.roundOff));
      if (rs) {
        const rsW = fonts.sansBold.widthOfTextAtSize(rs, 8.5);
        page.drawText(rs, { x: xRsEnd - rsW - 6, y: text8Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
        if (ps) {
          drawCentered(page, ps, fonts.sansBold, 8, xRsEnd + colPsW / 2, text8Y, COLOR_BLACK);
        }
      }
    }

    // Row 9: Che. No. / Date Row
    const row9Y = thY - 10 * rowH;
    const text9Y = row9Y + (rowH - 8) / 2 + 1.2;
    page.drawText('Che. No.', { x: x + 6, y: text9Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    const chqLine1Start = x + 52;
    const chqLine1End = x + 160;
    page.drawLine({ start: { x: chqLine1Start, y: text9Y - 1.5 }, end: { x: chqLine1End, y: text9Y - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });
    if (data.chequeNo) {
      const cSz = fitFontSize(String(data.chequeNo), fonts.sansBold, 8.5, chqLine1End - chqLine1Start - 4, 7);
      page.drawText(sanitizeWinAnsi(String(data.chequeNo)), { x: chqLine1Start + 3, y: text9Y, size: cSz, font: fonts.sansBold, color: COLOR_BLACK });
    }

    const dtLblX = chqLine1End + 8;
    page.drawText('Date', { x: dtLblX, y: text9Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
    const chqDtStart = dtLblX + 26;
    const chqDtEnd = xPartEnd - 8;
    // Underline for Cheque Date
    page.drawLine({ start: { x: chqDtStart, y: text9Y - 1.5 }, end: { x: chqDtEnd, y: text9Y - 1.5 }, color: COLOR_BORDER, thickness: 0.6 });

    const formattedChqDate = formatDateString((data as any).chequeDate || data.voucherDate);
    if (formattedChqDate) {
      const dSz = fitFontSize(formattedChqDate, fonts.sansBold, 8.5, chqDtEnd - chqDtStart - 6, 7);
      page.drawText(formattedChqDate, { x: chqDtStart + 4, y: text9Y, size: dSz, font: fonts.sansBold, color: COLOR_BLACK });
    } else {
      page.drawText('/', { x: chqDtStart + 24, y: text9Y, size: 8.5, font: fonts.sansReg, color: COLOR_BLACK });
      page.drawText('/', { x: chqDtStart + 56, y: text9Y, size: 8.5, font: fonts.sansReg, color: COLOR_BLACK });
    }

    // Row 10: ₹. (Total / Final Amount) Row
    const row10Y = thY - 11 * rowH;
    const text10Y = row10Y + (rowH - 8) / 2 + 1.2;
    drawRupeeGlyph(page, x + 6, text10Y - 0.5, 10, COLOR_BLACK);
    page.drawText('.', { x: x + 13.5, y: text10Y, size: 10, font: fonts.sansBold, color: COLOR_BLACK });

    const totalAmtStr = data.netPaid || data.billAmount || '';
    if (totalAmtStr) {
      const { rs, ps } = splitRupeesPaise(totalAmtStr);
      page.drawText(`${rs}/-`, { x: x + 20, y: text10Y + 1, size: 9.5, font: fonts.sansBold, color: COLOR_BLACK });

      // Amounts in Rs and Ps columns
      const rsW = fonts.sansBold.widthOfTextAtSize(rs, 8.5);
      page.drawText(rs, { x: xRsEnd - rsW - 6, y: text10Y, size: 8.5, font: fonts.sansBold, color: COLOR_BLACK });
      if (ps) {
        drawCentered(page, ps, fonts.sansBold, 8, xRsEnd + colPsW / 2, text10Y, COLOR_BLACK);
      }
    }

    // ── 4. Footer & Signatures Section (Below Table - Open space, no enclosing box)
    const sigRowY = vY + 12;
    const sig1X = x + 6;
    const sig2CX = x + w * 0.38;
    const sig3CX = x + w * 0.65;
    const sig4EndX = x + w;

    page.drawText('Chairman', { x: sig1X, y: sigRowY, size: 9, font: fonts.sansBold, color: COLOR_BLACK });
    drawCentered(page, 'Secretary', fonts.sansBold, 9, sig2CX, sigRowY, COLOR_BLACK);
    drawCentered(page, 'Treasurer', fonts.sansBold, 9, sig3CX, sigRowY, COLOR_BLACK);

    const recText = "Receiver's Signature";
    const recW = fonts.sansBold.widthOfTextAtSize(recText, 9);
    const recX = sig4EndX - recW;
    page.drawText(recText, { x: recX, y: sigRowY, size: 9, font: fonts.sansBold, color: COLOR_BLACK });

    // Revenue Stamp Box: Compact rectangle positioned directly above Receiver's Signature
    // Not very long, centered above Receiver's Signature: width: 42, height: 24
    const stampBoxW = 42;
    const stampBoxH = 24;
    const stampBoxX = recX + (recW - stampBoxW) / 2;
    const stampBoxY = sigRowY + 14;

    page.drawRectangle({
      x: stampBoxX,
      y: stampBoxY,
      width: stampBoxW,
      height: stampBoxH,
      borderColor: COLOR_BORDER,
      borderWidth: 1.0,
      color: rgb(1, 1, 1),
    });
  }
}



