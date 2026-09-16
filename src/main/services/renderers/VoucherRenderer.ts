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

/** Draw vector Indian Rupee symbol glyph */
function drawRupeeGlyph(page: PDFPage, x: number, y: number, size: number, color = COLOR_BLACK) {
  const w = size * 0.58;
  const h = size * 0.85;
  const t = Math.max(0.65, size * 0.08);

  // Top horizontal bar
  page.drawLine({ start: { x, y: y + h }, end: { x: x + w, y: y + h }, thickness: t, color });
  // Second horizontal bar
  page.drawLine({ start: { x, y: y + h * 0.68 }, end: { x: x + w * 0.88, y: y + h * 0.68 }, thickness: t, color });
  // Vertical stem upper
  page.drawLine({ start: { x: x + w * 0.15, y: y + h }, end: { x: x + w * 0.15, y: y + h * 0.42 }, thickness: t, color });
  // Upper semicircle loop (drawn with lines)
  page.drawLine({ start: { x: x + w * 0.15, y: y + h * 0.68 }, end: { x: x + w * 0.62, y: y + h * 0.68 }, thickness: t, color });
  page.drawLine({ start: { x: x + w * 0.62, y: y + h * 0.68 }, end: { x: x + w * 0.62, y: y + h * 0.42 }, thickness: t, color });
  page.drawLine({ start: { x: x + w * 0.62, y: y + h * 0.42 }, end: { x: x + w * 0.15, y: y + h * 0.42 }, thickness: t, color });
  // Diagonal leg down
  page.drawLine({ start: { x: x + w * 0.25, y: y + h * 0.42 }, end: { x: x + w * 0.78, y }, thickness: t, color });
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
  // TEMPLATE 1: DETAILED FINANCIAL CALCULATION (100% Matching Reference)
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
    const yTop = y + h - 8;

    const fullSocName = data.societyName || society?.societyName || 'Aishwarya Heights Co-op. Housing Society Ltd.';
    const socNo = data.socNumber || society?.registrationNo || 'M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023';
    const regDate = formatDateString(society?.registrationDate || '02.01.2023');
    const socAddress = data.societyAddress || society?.address || 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.';

    // ── 1. Top Right Voucher Box & Date ─────────────────────────────────────
    const vchBoxW = 145;
    const vchBoxH = 22;
    const vchBoxX = x + w - vchBoxW;
    const vchBoxY = yTop - 18;

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
    page.drawText(vchLabel, { x: vchBoxX + 8, y: vchBoxY + 6.5, size: 9, font: fonts.bold, color: COLOR_BLACK });
    if (data.voucherNo) {
      const vchValX = vchBoxX + fonts.bold.widthOfTextAtSize(vchLabel, 9) + 8;
      page.drawText(data.voucherNo, { x: vchValX, y: vchBoxY + 6.5, size: 9.5, font: fonts.bold, color: COLOR_BLACK });
    }

    // Date below Voucher box with DOUBLE BASELINE
    const dateLabelY = vchBoxY - 14;
    page.drawText('Date :', { x: vchBoxX - 4, y: dateLabelY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    const dateLineStartX = vchBoxX + 26;
    const dateLineEndX = x + w;
    page.drawLine({
      start: { x: dateLineStartX, y: dateLabelY - 1 },
      end: { x: dateLineEndX, y: dateLabelY - 1 },
      color: COLOR_BORDER,
      thickness: 0.8,
    });
    page.drawLine({
      start: { x: dateLineStartX, y: dateLabelY - 3 },
      end: { x: dateLineEndX, y: dateLabelY - 3 },
      color: COLOR_BORDER,
      thickness: 0.5,
    });

    const formattedVchDate = formatDateString(data.voucherDate);
    if (formattedVchDate) {
      page.drawText(formattedVchDate, { x: dateLineStartX + 6, y: dateLabelY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    } else {
      page.drawText('/', { x: dateLineStartX + 32, y: dateLabelY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
      page.drawText('/', { x: dateLineStartX + 68, y: dateLabelY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
    }

    // ── 2. Header & Title Section (Centered & Italicized) ────────────────────
    let textStartX = x;
    if (logoImg) {
      const logoSize = 32;
      page.drawImage(logoImg, {
        x,
        y: yTop - logoSize - 2,
        width: logoSize,
        height: logoSize,
      });
      textStartX = x + logoSize + 8;
    }

    const headerAreaW = vchBoxX - textStartX - 10;
    const headerCX = textStartX + headerAreaW / 2;

    // Society Name: Italicized Serif Font, Horizontally Centered
    const socSz = fitFontSize(fullSocName, fonts.serifItalicBold, 13.5, headerAreaW, 9.5);
    drawCentered(page, fullSocName, fonts.serifItalicBold, socSz, headerCX, yTop - 3, COLOR_BLACK);

    // Reg No. & Date: Centered
    const regStr = `Reg. No. : ${socNo} Dated ${regDate}`;
    const regSz = fitFontSize(regStr, fonts.sansBold, 8, headerAreaW, 6.5);
    drawCentered(page, regStr, fonts.sansBold, regSz, headerCX, yTop - 14, COLOR_BLACK);

    // Address: Centered
    const addrSz = fitFontSize(socAddress, fonts.sansReg, 7.5, headerAreaW, 6);
    drawCentered(page, socAddress, fonts.sansReg, addrSz, headerCX, yTop - 23, COLOR_BLACK);

    // Top Divider Line directly beneath address spanning across
    const headerDividerY = yTop - 29;
    page.drawLine({
      start: { x: textStartX, y: headerDividerY },
      end: { x: x + w, y: headerDividerY },
      color: COLOR_BORDER,
      thickness: 0.8,
    });

    // ── 3. PAY To / CHARGE To Section (With Continuous Vertical Divider & Double Border) ─
    const payTopY = headerDividerY - 4;
    const payRowY = yTop - 46;
    const midX = x + w * 0.52;

    // Top boundary line above PAY To / CHARGE To
    page.drawLine({ start: { x, y: payTopY }, end: { x: x + w, y: payTopY }, color: COLOR_BORDER, thickness: 0.8 });

    // PAY To
    const payLbl = 'PAY To,';
    page.drawText(payLbl, { x: x + 4, y: payRowY, size: 9, font: fonts.bold, color: COLOR_BLACK });
    const payLineStartX = x + fonts.bold.widthOfTextAtSize(payLbl, 9) + 8;
    const payLineEndX = midX - 6;
    page.drawLine({ start: { x: payLineStartX, y: payRowY - 1 }, end: { x: payLineEndX, y: payRowY - 1 }, color: COLOR_BORDER, thickness: 0.8 });
    if (data.toPayee) {
      const pSz = fitFontSize(data.toPayee, fonts.bold, 9, payLineEndX - payLineStartX - 4, 7);
      page.drawText(data.toPayee, { x: payLineStartX + 3, y: payRowY + 1, size: pSz, font: fonts.bold, color: COLOR_BLACK });
    }

    // CHARGE To
    const chgX = midX + 6;
    const chgLbl = 'CHARGE To,';
    page.drawText(chgLbl, { x: chgX, y: payRowY, size: 9, font: fonts.bold, color: COLOR_BLACK });
    const chgLineStartX = chgX + fonts.bold.widthOfTextAtSize(chgLbl, 9) + 8;
    const chgLineEndX = x + w - 4;
    page.drawLine({ start: { x: chgLineStartX, y: payRowY - 1 }, end: { x: chgLineEndX, y: payRowY - 1 }, color: COLOR_BORDER, thickness: 0.8 });
    if (data.chargeTo) {
      const cSz = fitFontSize(data.chargeTo, fonts.bold, 9, chgLineEndX - chgLineStartX - 4, 7);
      page.drawText(data.chargeTo, { x: chgLineStartX + 3, y: payRowY + 1, size: cSz, font: fonts.bold, color: COLOR_BLACK });
    }

    // Solid Vertical Center Divider cleanly starting at top border and ending at bottom double line
    page.drawLine({
      start: { x: midX, y: payTopY },
      end: { x: midX, y: payRowY - 6 },
      color: COLOR_BORDER,
      thickness: 0.8,
    });

    // Double horizontal boundary across 100% of both columns
    page.drawLine({ start: { x, y: payRowY - 6 }, end: { x: x + w, y: payRowY - 6 }, color: COLOR_BORDER, thickness: 1.0 });
    page.drawLine({ start: { x, y: payRowY - 8.5 }, end: { x: x + w, y: payRowY - 8.5 }, color: COLOR_BORDER, thickness: 0.6 });

    // ── 4. Main Data Table Structure & Dedicated "%" Column ─────────────────
    const tableTop = payRowY - 10;
    const tableBottom = y + 42;
    const tableH = tableTop - tableBottom;

    page.drawRectangle({
      x,
      y: tableBottom,
      width: w,
      height: tableH,
      borderColor: COLOR_BORDER,
      borderWidth: 1.1,
      color: rgb(1, 1, 1),
    });

    // Sub-columns: Particulars | Description | % | Rs. | Ps.
    const colLblW = 104;
    const colPctW = 22;
    const colRsW = 58;
    const colPsW = 34;
    const colPartW = w - colLblW - colPctW - colRsW - colPsW;

    const xPartEnd = x + colPartW;
    const xLblEnd = xPartEnd + colLblW;
    const xPctEnd = xLblEnd + colPctW;
    const xRsEnd = xPctEnd + colRsW;

    const thH = 15;
    const thY = tableTop - thH;

    // Header divider line
    page.drawLine({ start: { x, y: thY }, end: { x: x + w, y: thY }, color: COLOR_BORDER, thickness: 1.0 });

    // Full-height column dividers
    page.drawLine({ start: { x: xPartEnd, y: tableBottom }, end: { x: xPartEnd, y: tableTop }, color: COLOR_BORDER, thickness: 1.0 });
    page.drawLine({ start: { x: xLblEnd, y: tableBottom }, end: { x: xLblEnd, y: tableTop }, color: COLOR_BORDER, thickness: 0.8 });
    page.drawLine({ start: { x: xPctEnd, y: tableBottom }, end: { x: xPctEnd, y: tableTop }, color: COLOR_BORDER, thickness: 0.8 });
    page.drawLine({ start: { x: xRsEnd, y: tableBottom }, end: { x: xRsEnd, y: tableTop }, color: COLOR_BORDER, thickness: 0.8 });

    // Header Text: Wide letter spacing for "P a r t i c u l a r s"
    drawCentered(page, 'P   a   r   t   i   c   u   l   a   r   s', fonts.bold, 9, x + colPartW / 2, thY + 4, COLOR_BLACK);
    // Currency header: Indian Rupee Symbol
    drawRupeeGlyph(page, xPctEnd + colRsW / 2 - 4.5, thY + 3.5, 9, COLOR_BLACK);
    drawCentered(page, 'Ps.', fonts.bold, 8.5, xRsEnd + colPsW / 2, thY + 4, COLOR_BLACK);

    // ── Right Side 10 Financial Rows ─────────────────────────────────────────
    const financialRowsCount = 10;
    const rowH = (tableH - thH) / financialRowsCount;

    const finRowDefs = [
      { label: 'Bill Amount', percent: '', val: data.billAmount, isBold: false },
      { label: 'Bill Amount', percent: '', val: data.billAmount2 || '', isBold: false },
      { label: 'Adv. Less or Paid', percent: '', val: data.advLessPaid, isBold: false },
      { label: 'Total', percent: '', val: data.subTotal1, isBold: true },
      { label: 'Less TDS @', percent: data.tdsPercent ? `${data.tdsPercent} %` : '  %', val: data.tdsAmount, isBold: false },
      { label: 'Total', percent: '', val: data.subTotal2, isBold: true },
      { label: 'Add CGST @', percent: data.cgstPercent ? `${data.cgstPercent} %` : '  %', val: data.cgstAmount, isBold: false },
      { label: 'Add SGST @', percent: data.sgstPercent ? `${data.sgstPercent} %` : '  %', val: data.sgstAmount, isBold: false },
      { label: 'Round off (+/-)', percent: '', val: data.roundOff, isBold: false },
      { label: 'Net Paid =', percent: '', val: data.netPaid, isBold: true, isHighlight: true },
    ];

    finRowDefs.forEach((fRow, rIdx) => {
      const ry = thY - (rIdx + 1) * rowH;
      if (rIdx < financialRowsCount - 1) {
        page.drawLine({
          start: { x: xPartEnd, y: ry },
          end: { x: x + w, y: ry },
          color: COLOR_BORDER,
          thickness: fRow.isBold ? 1.0 : 0.6,
        });
      }

      const fFont = fRow.isBold ? fonts.bold : fonts.reg;
      const fSize = 8;
      const textY = ry + (rowH - fSize) / 2 + 1;

      if (fRow.isHighlight) {
        page.drawText(fRow.label, { x: xLblEnd - fonts.bold.widthOfTextAtSize(fRow.label, 8.5) - 4, y: textY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
      } else if (fRow.label === 'Total') {
        page.drawText(fRow.label, { x: xLblEnd - fonts.bold.widthOfTextAtSize(fRow.label, 8) - 6, y: textY, size: 8, font: fonts.bold, color: COLOR_BLACK });
      } else {
        page.drawText(fRow.label, { x: xPartEnd + 4, y: textY, size: fSize, font: fFont, color: COLOR_BLACK });
      }

      // Percent dedicated column
      if (fRow.percent) {
        drawCentered(page, fRow.percent, fonts.reg, 7.5, xLblEnd + colPctW / 2, textY, COLOR_BLACK);
      }

      if (fRow.val) {
        const { rs, ps } = splitRupeesPaise(fRow.val);
        const valFont = fRow.isBold ? fonts.bold : fonts.reg;
        const rsW = valFont.widthOfTextAtSize(rs, 8);
        page.drawText(rs, { x: xRsEnd - rsW - 4, y: textY, size: 8, font: valFont, color: COLOR_BLACK });
        if (ps) {
          drawCentered(page, ps, valFont, 7.5, xRsEnd + colPsW / 2, textY, COLOR_BLACK);
        }
      }
    });

    // ── Left Column: Particulars (Aligned 3 Horizontal Lines) ───────────────
    const partInnerW = colPartW - 14;

    // Exactly 3 horizontal lines matching row heights of top 3 right-hand rows
    page.drawLine({ start: { x, y: thY - 1 * rowH }, end: { x: xPartEnd, y: thY - 1 * rowH }, color: COLOR_BORDER, thickness: 0.5 });
    page.drawLine({ start: { x, y: thY - 2 * rowH }, end: { x: xPartEnd, y: thY - 2 * rowH }, color: COLOR_BORDER, thickness: 0.5 });
    page.drawLine({ start: { x, y: thY - 3 * rowH }, end: { x: xPartEnd, y: thY - 3 * rowH }, color: COLOR_BORDER, thickness: 0.5 });

    // Particulars Narration text
    if (data.particulars) {
      const partLines = wrapText(data.particulars, fonts.reg, 8.5, partInnerW);
      if (partLines[0]) page.drawText(partLines[0], { x: x + 6, y: thY - 0.7 * rowH, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
      if (partLines[1]) page.drawText(partLines[1], { x: x + 6, y: thY - 1.7 * rowH, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
      if (partLines[2]) page.drawText(partLines[2], { x: x + 6, y: thY - 2.7 * rowH, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
    }

    const pBoxBaseY = tableBottom + 2;
    const stepH = (tableH - thH) * 0.102;

    // Bill No.
    const billY = pBoxBaseY + stepH * 3.8;
    page.drawText('Bill No.:', { x: x + 8, y: billY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    if (data.billNo) {
      page.drawText(data.billNo, { x: x + 48, y: billY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    }

    // Bank Name
    const bankY = pBoxBaseY + stepH * 2.6;
    page.drawText('Bank Name :', { x: x + 8, y: bankY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    if (data.bankName) {
      const bSz = fitFontSize(data.bankName, fonts.bold, 8.5, partInnerW - 65, 7);
      page.drawText(data.bankName, { x: x + 66, y: bankY, size: bSz, font: fonts.bold, color: COLOR_BLACK });
    }

    // Cheque No. & Date
    const chqY = pBoxBaseY + stepH * 1.4;
    page.drawText('Cheque No.', { x: x + 8, y: chqY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    const chqLine1Start = x + 62;
    const chqLine1End = x + 145;
    page.drawLine({ start: { x: chqLine1Start, y: chqY - 1 }, end: { x: chqLine1End, y: chqY - 1 }, color: COLOR_BORDER, thickness: 0.8 });
    if (data.chequeNo) {
      page.drawText(data.chequeNo, { x: chqLine1Start + 3, y: chqY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    }

    const dtLblX = chqLine1End + 6;
    page.drawText('Date', { x: dtLblX, y: chqY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    const chqDtStart = dtLblX + 24;
    const chqDtEnd = xPartEnd - 8;
    page.drawLine({ start: { x: chqDtStart, y: chqY - 1 }, end: { x: chqDtEnd, y: chqY - 1 }, color: COLOR_BORDER, thickness: 0.8 });

    const formattedChqDate = formatDateString(data.voucherDate);
    if (formattedChqDate) {
      page.drawText(formattedChqDate, { x: chqDtStart + 4, y: chqY, size: 8.5, font: fonts.bold, color: COLOR_BLACK });
    } else {
      page.drawText('/', { x: chqDtStart + 24, y: chqY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
      page.drawText('/', { x: chqDtStart + 52, y: chqY, size: 8.5, font: fonts.reg, color: COLOR_BLACK });
    }

    // Full-width horizontal rule separating Cheque section from bottom Total line, aligned with Net Paid row
    const bottomDivY = tableBottom + rowH;
    page.drawLine({ start: { x, y: bottomDivY }, end: { x: xPartEnd, y: bottomDivY }, color: COLOR_BORDER, thickness: 0.8 });

    // Left Bottom Section: Indian Rupee Symbol with baseline perfectly aligned with Net Paid = row
    const rsSymY = tableBottom + (rowH - 9) / 2 + 1;
    drawRupeeGlyph(page, x + 8, rsSymY, 10, COLOR_BLACK);
    page.drawText('.', { x: x + 15, y: rsSymY, size: 10, font: fonts.bold, color: COLOR_BLACK });

    const amtLineStart = x + 20;
    const amtLineEnd = xPartEnd - 8;
    page.drawLine({ start: { x: amtLineStart, y: rsSymY - 1 }, end: { x: amtLineEnd, y: rsSymY - 1 }, color: COLOR_BORDER, thickness: 0.8 });

    if (data.netPaid) {
      const netPaidStr = `${splitRupeesPaise(data.netPaid).rs}/-`;
      page.drawText(netPaidStr, { x: amtLineStart + 4, y: rsSymY + 1, size: 9.5, font: fonts.bold, color: COLOR_BLACK });
    }

    // ── 5. Footer & Signatures Section ───────────────────────────────────────
    const sigRowY = y + 8;
    const sig1CX = x + 40;
    const sig2CX = x + 155;
    const sig3CX = x + 270;
    const sig4CX = x + w - 48;

    drawCentered(page, 'Chairman', fonts.reg, 8.5, sig1CX, sigRowY, COLOR_BLACK);
    drawCentered(page, 'Secretary', fonts.reg, 8.5, sig2CX, sigRowY, COLOR_BLACK);
    drawCentered(page, 'Treasurer', fonts.reg, 8.5, sig3CX, sigRowY, COLOR_BLACK);
    drawCentered(page, "Receiver's Signature", fonts.reg, 8.5, sig4CX, sigRowY, COLOR_BLACK);

    // Revenue Stamp Box: Empty rectangle centered directly above Receiver's Signature (NO overlap with table)
    const stampBoxW = 38;
    const stampBoxH = 20;
    const stampBoxX = sig4CX - stampBoxW / 2;
    const stampBoxY = sigRowY + 11;

    page.drawRectangle({
      x: stampBoxX,
      y: stampBoxY,
      width: stampBoxW,
      height: stampBoxH,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
      color: rgb(1, 1, 1),
    });
  }

  // =========================================================================
  // TEMPLATE 2: OPEN LEDGER GRID STYLE
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
    this.drawTemplate1_Breakdown(page, x, y, w, h, data, society, fonts, logoImg);
  }
}

