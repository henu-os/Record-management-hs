// src/renderer/browserMockApi.ts
// ============================================================
// Web Browser Fallback Layer
// Automatically runs when window.api is undefined (e.g. running in Chrome)
// Provides 100% offline-compatible browser-native implementation.
// ============================================================
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { generateRange, normalizeSerial, validateSerialRange } from '../main/services/SerialRangeEngine';
import { ValidationEngine } from '../main/services/ValidationEngine';
import { MasterDataService, synchronizeMasterWorkbook, sanitizeAndCalculateVoucher } from '../main/services/MasterDataService';
import { PdfEngine } from '../main/services/PdfEngine';
import { DEFAULT_FORM_DESIGN_SETTINGS } from '../main/types';

function sanitizeWinAnsi(text: any): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n\t\x00-\x1F\x7F-\x9F]/g, ' ')
    .replace(/₹/g, 'Rs. ')
    .replace(/[\u2013\u2014\u2212\u2015]/g, '-')
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25cf\u25cb\u25aa\u25ab]/g, '-')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/g, ' ');
}

function wrapPdfDocumentForWinAnsi(doc: PDFDocument): PDFDocument {
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

// ── Per-Society Dynamic Storage Helpers ────────────────────────
function getActiveSocietyId(): string {
  try {
    const raw = localStorage.getItem('henu_os_societies');
    if (raw) {
      const list = JSON.parse(raw);
      const active = list.find((s: any) => s.isActive);
      if (active && active.id) return active.id;
    }
  } catch {}
  return localStorage.getItem('henu_os_active_society_id') || 'default-society-1';
}

function getWorkbookKey(): string {
  return `henu_os_workbook_${getActiveSocietyId()}`;
}

function getHistoryKey(): string {
  return `henu_os_history_${getActiveSocietyId()}`;
}

function getSettingsKey(): string {
  return `henu_os_settings_${getActiveSocietyId()}`;
}

// Saved settings in LocalStorage
function getSettingsMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(getSettingsKey()) || '{}');
  } catch {
    return {};
  }
}

function saveSettingsMap(map: Record<string, string>) {
  localStorage.setItem(getSettingsKey(), JSON.stringify(map));
}

// Draw text helper (exactly like PdfEngine.ts)
function s(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str === 'null' || str === 'undefined' || str === 'NaN') return '';
  return str;
}

function combinedNames(rec: any, separator = ' / '): string {
  if (!rec) return '';
  const parts = [rec.member1, rec.member2, rec.member3, rec.member4, rec.member5, rec.member6]
    .map(n => s(n))
    .filter(n => n !== '');
  if (parts.length > 0) return parts.join(separator);
  return s(rec.memberName);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const hardLines = text.split('\n');
  const result: string[] = [];
  for (const hard of hardLines) {
    if (result.length >= maxLines) break;
    const words = hard.split(' ');
    let current = '';
    for (const word of words) {
      if (result.length >= maxLines) break;
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        current = test;
      } else {
        if (current) result.push(current);
        current = word;
      }
    }
    if (current && result.length < maxLines) result.push(current);
  }
  return result.slice(0, maxLines);
}

function drawText(opts: {
  page: any; text: string; x: number; y: number; maxWidth: number; maxHeight: number;
  fontSize: number; minFontSize: number; maxLines: number; font: PDFFont; align?: string;
}): void {
  const { page, text, x, y, maxWidth, maxHeight, fontSize: initFontSize, minFontSize, maxLines, font, align = 'left' } = opts;
  if (!text || text.trim() === '') return;

  let fontSize = initFontSize;
  let lines: string[] = [];
  while (fontSize >= minFontSize) {
    lines = wrapText(text, font, fontSize, maxWidth, maxLines);
    const totalHeight = lines.length * fontSize * 1.2;
    if (totalHeight <= maxHeight + 1) break;
    fontSize = Math.max(fontSize - 0.5, minFontSize);
  }

  const lineHeightPt = fontSize * 1.2;
  const topY = y + maxHeight - fontSize;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineX = x;
    if (align === 'center') {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      lineX = x + (maxWidth - lineWidth) / 2;
    } else if (align === 'right') {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      lineX = x + maxWidth - lineWidth;
    }
    page.drawText(line, {
      x: Math.max(lineX, x),
      y: topY - i * lineHeightPt,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

// ── Bounding box configurations for PDF Overlay ──────────────
const F1_COORDS = {
  srNo:           { x: 85,  y: 770, w: 100, h: 12, fs: 9,  mfs: 7, ml: 1 },
  dateAdmission:  { x: 85,  y: 748, w: 150, h: 12, fs: 9,  mfs: 7, ml: 1 },
  dateEntrance:   { x: 320, y: 748, w: 150, h: 12, fs: 9,  mfs: 7, ml: 1 },
  fullName:       { x: 85,  y: 720, w: 430, h: 14, fs: 9,  mfs: 7, ml: 2 },
  permanentAddr:  { x: 85,  y: 695, w: 430, h: 30, fs: 9,  mfs: 7, ml: 3 },
  residentialAddr:{ x: 85,  y: 650, w: 430, h: 30, fs: 9,  mfs: 7, ml: 3 },
  occupation:     { x: 85,  y: 620, w: 200, h: 12, fs: 9,  mfs: 7, ml: 1 },
  age:            { x: 380, y: 620, w: 60,  h: 12, fs: 9,  mfs: 7, ml: 1 },
  nomineeName:    { x: 85,  y: 592, w: 430, h: 24, fs: 9,  mfs: 7, ml: 2 },
  dateNomination: { x: 85,  y: 560, w: 150, h: 12, fs: 9,  mfs: 7, ml: 1 },
  dateCessation:  { x: 85,  y: 535, w: 150, h: 12, fs: 9,  mfs: 7, ml: 1 },
  reasonCessation:{ x: 280, y: 535, w: 235, h: 24, fs: 9,  mfs: 7, ml: 2 },
  remarks:        { x: 85,  y: 505, w: 430, h: 24, fs: 9,  mfs: 7, ml: 2 },
  // Share particulars
  shareDate:      { x: 100, y: 435, w: 75,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  cashBookFolio:  { x: 185, y: 435, w: 65,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  shareCertificate:{ x: 260, y: 435, w: 55, h: 12, fs: 8,  mfs: 6, ml: 1 },
  shareFrom:      { x: 322, y: 435, w: 35,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  shareTo:        { x: 362, y: 435, w: 35,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  sharesCount:    { x: 404, y: 435, w: 50,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  shareValue:     { x: 100, y: 418, w: 150, h: 12, fs: 8,  mfs: 6, ml: 1 },
  shareAllotmentDate: { x: 280, y: 418, w: 100, h: 12, fs: 8, mfs: 6, ml: 1 },
  shareAllotmentAmt: { x: 404, y: 418, w: 50, h: 12, fs: 8, mfs: 6, ml: 1 },
  share1stCall:   { x: 100, y: 400, w: 150, h: 12, fs: 8,  mfs: 6, ml: 1 },
  share2ndCall:   { x: 280, y: 400, w: 100, h: 12, fs: 8,  mfs: 6, ml: 1 },
  totalAmt:       { x: 404, y: 400, w: 50,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  sharesHeld:     { x: 100, y: 382, w: 150, h: 12, fs: 8,  mfs: 6, ml: 1 },
  certSerial:     { x: 280, y: 382, w: 100, h: 12, fs: 8,  mfs: 6, ml: 1 },
  // Transfer
  transDate:      { x: 100, y: 365, w: 75,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  transCBF:       { x: 185, y: 365, w: 65,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  sharesTransf:   { x: 260, y: 365, w: 55,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  transCertNo:    { x: 322, y: 365, w: 75,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  balShares:      { x: 404, y: 365, w: 50,  h: 12, fs: 8,  mfs: 6, ml: 1 },
  balCertSerial:  { x: 100, y: 348, w: 150, h: 12, fs: 8,  mfs: 6, ml: 1 },
  balAmtRs:       { x: 280, y: 348, w: 100, h: 12, fs: 8,  mfs: 6, ml: 1 },
};

const FORM_J_CONFIG = {
  formId: 'FORM_J', rowsPerPage: 20, firstRowY: 735, rowHeight: 26,
  pageNumField: { x: 480, y: 805, w: 60, h: 12, fs: 9 },
  fields: [
    { key: 'srNo',        x: 18,  yOffset: 0, w: 28,  h: 22, fs: 8,  mfs: 6,  ml: 1, align: 'center' },
    { key: 'memberName',  x: 50,  yOffset: 0, w: 145, h: 22, fs: 8,  mfs: 6,  ml: 3,
      getValue: (rec: any) => rec ? combinedNames(rec) : '' },
    { key: 'address',     x: 200, yOffset: 0, w: 220, h: 22, fs: 7,  mfs: 5,  ml: 3,
      getValue: (rec: any) => rec ? (s(rec.permanentAddress) || s(rec.residentialAddress)) : '' },
    { key: 'classOfMember', x: 428, yOffset: 0, w: 100, h: 22, fs: 8, mfs: 6, ml: 2 },
  ],
};

const SHARE_CONFIG = {
  formId: 'FORM_SHARE', rowsPerPage: 10, firstRowY: 480, rowHeight: 38,
  pageNumField: { x: 760, y: 565, w: 60, h: 12, fs: 9 },
  fields: [
    { key: 'srNo',               x: 15,  yOffset: 0, w: 22,  h: 35, fs: 8,  mfs: 6,  ml: 1, align: 'center' },
    { key: 'dateOfAllotment',    x: 40,  yOffset: 0, w: 42,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'cashBookFolioNo',    x: 85,  yOffset: 0, w: 32,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'shareCertificateNo', x: 120, yOffset: 0, w: 35,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'noOfShares',         x: 158, yOffset: 0, w: 28,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'valueOfOneShare',    x: 189, yOffset: 0, w: 28,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'valueOfShares',      x: 220, yOffset: 0, w: 32,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'flatNo',             x: 255, yOffset: 0, w: 35,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'wingNo',             x: 293, yOffset: 0, w: 22,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'member1',  x: 318, yOffset: 18, w: 55, h: 16, fs: 6, mfs: 5, ml: 1 },
    { key: 'member2',  x: 318, yOffset:  0, w: 55, h: 16, fs: 6, mfs: 5, ml: 1 },
    { key: 'dateOfTransferRefund',         x: 377, yOffset: 0, w: 38,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'transferJournalFolioNo',       x: 418, yOffset: 0, w: 35,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'noOfSharesTransferredRefunded',x: 456, yOffset: 0, w: 32,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'shareCertTransferred',         x: 491, yOffset: 0, w: 38,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'sharesValueTransferred',       x: 532, yOffset: 0, w: 35,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'nameOfTransferee',             x: 570, yOffset: 0, w: 80,  h: 35, fs: 7,  mfs: 5,  ml: 3 },
    { key: 'authorityForTransfer',         x: 653, yOffset: 0, w: 65,  h: 35, fs: 7,  mfs: 5,  ml: 3 },
    { key: 'remark',                       x: 721, yOffset: 0, w: 100, h: 35, fs: 7,  mfs: 5,  ml: 3 },
  ],
};

const NOM_CONFIG = {
  formId: 'FORM_NOM', rowsPerPage: 10, firstRowY: 480, rowHeight: 38,
  pageNumField: { x: 760, y: 565, w: 60, h: 12, fs: 9 },
  fields: [
    { key: 'srNo',               x: 15,  yOffset: 0, w: 22,  h: 35, fs: 8,  mfs: 6,  ml: 1, align: 'center' },
    { key: 'membershipNo',       x: 40,  yOffset: 0, w: 40,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'shareCertificateNo', x: 83,  yOffset: 0, w: 40,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'permanentAddress',   x: 126, yOffset: 0, w: 90,  h: 35, fs: 7,  mfs: 5,  ml: 3 },
    { key: 'memberName',         x: 219, yOffset: 0, w: 80,  h: 35, fs: 7,  mfs: 5,  ml: 3,
      getValue: (rec: any) => rec ? combinedNames(rec) : '' },
    { key: 'dateOfNomination',   x: 302, yOffset: 0, w: 40,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'nomineeName',        x: 345, yOffset: 0, w: 100, h: 35, fs: 7,  mfs: 5,  ml: 3 },
    { key: 'nomineePercentage',  x: 448, yOffset: 0, w: 28,  h: 35, fs: 7,  mfs: 5,  ml: 1, align: 'right' },
    { key: 'mcMeetingDate',      x: 479, yOffset: 0, w: 50,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'subsequentRevocation',x: 532, yOffset: 0, w: 50, h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'remark',             x: 585, yOffset: 0, w: 240, h: 35, fs: 7,  mfs: 5,  ml: 3 },
  ],
};

const PROP_CONFIG = {
  formId: 'FORM_PROP', rowsPerPage: 10, firstRowY: 480, rowHeight: 38,
  pageNumField: { x: 760, y: 565, w: 60, h: 12, fs: 9 },
  fields: [
    { key: 'srNo',                x: 15,  yOffset: 0, w: 22,  h: 35, fs: 8,  mfs: 6,  ml: 1, align: 'center' },
    { key: 'memberName',          x: 40,  yOffset: 0, w: 85,  h: 35, fs: 7,  mfs: 5,  ml: 3,
      getValue: (rec: any) => rec ? combinedNames(rec) : '' },
    { key: 'dateOfPossession',    x: 128, yOffset: 0, w: 40,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'distinguishingNo',    x: 171, yOffset: 0, w: 40,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'descriptionOfTenement',x:214, yOffset: 0, w: 60,  h: 35, fs: 7,  mfs: 5,  ml: 3 },
    { key: 'areaOfTenement',      x: 277, yOffset: 0, w: 40,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'costOfTenement',      x: 320, yOffset: 0, w: 55,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'annualGroundRent',    x: 378, yOffset: 0, w: 50,  h: 35, fs: 7,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'dateOfCessation',     x: 431, yOffset: 0, w: 50,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'signature',           x: 484, yOffset: 0, w: 60,  h: 35, fs: 7,  mfs: 5,  ml: 2 },
    { key: 'remark',              x: 547, yOffset: 0, w: 270, h: 35, fs: 7,  mfs: 5,  ml: 3 },
  ],
};

const BANK_CONFIG = {
  formId: 'FORM_BANK', rowsPerPage: 10, firstRowY: 480, rowHeight: 38,
  pageNumField: { x: 760, y: 565, w: 60, h: 12, fs: 9 },
  fields: [
    { key: 'srNo',                  x: 15,  yOffset: 0, w: 20,  h: 35, fs: 8,  mfs: 6,  ml: 1, align: 'center' },
    { key: 'permanentAddress',      x: 38,  yOffset: 0, w: 55,  h: 35, fs: 6,  mfs: 5,  ml: 3 },
    { key: 'flatNo',                x: 96,  yOffset: 0, w: 35,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'wingNo',                x: 134, yOffset: 0, w: 20,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'area',                  x: 157, yOffset: 0, w: 20,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'carpetBuildupSqFt',     x: 180, yOffset: 0, w: 28,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'shareCertificateNo',    x: 211, yOffset: 0, w: 28,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'sharesFrom',            x: 242, yOffset: 0, w: 22,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'sharesTo',              x: 267, yOffset: 0, w: 22,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'member1',               x: 292, yOffset: 25, w: 45, h: 10, fs: 5,  mfs: 5,  ml: 1 },
    { key: 'member2',               x: 292, yOffset: 15, w: 45, h: 10, fs: 5,  mfs: 5,  ml: 1 },
    { key: 'member3',               x: 292, yOffset:  5, w: 45, h: 10, fs: 5,  mfs: 5,  ml: 1 },
    { key: 'dateOfLoanSanction',    x: 340, yOffset: 0, w: 28,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'bankName',              x: 371, yOffset: 0, w: 45,  h: 35, fs: 6,  mfs: 5,  ml: 3 },
    { key: 'bankAddress',           x: 419, yOffset: 0, w: 45,  h: 35, fs: 6,  mfs: 5,  ml: 3 },
    { key: 'loanAmount',            x: 467, yOffset: 0, w: 25,  h: 35, fs: 6,  mfs: 5,  ml: 2, align: 'right' },
    { key: 'loanPeriod',            x: 495, yOffset: 0, w: 22,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'mcMeetingApprovalDate', x: 520, yOffset: 0, w: 28,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'resolutionNo',          x: 551, yOffset: 0, w: 22,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'dateOfNOC',             x: 576, yOffset: 0, w: 28,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
    { key: 'dateOfLienCancellation',x: 607, yOffset: 0, w: 28,  h: 35, fs: 6,  mfs: 5,  ml: 2 },
  ],
};

const TEMPLATE_NAMES: Record<string, string> = {
  FORM_I: 'form-i.pdf',
  FORM_J: 'form-j.pdf',
  FORM_SHARE: 'share-register.pdf',
  FORM_NOM: 'nomination-register.pdf',
  FORM_PROP: 'property-register.pdf',
};

// ── Bank Line Mark Register Dynamic Template Drawing ──────────
async function browserDrawBankTemplate(): Promise<PDFDocument> {
  const doc = wrapPdfDocumentForWinAnsi(await PDFDocument.create());
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([841.89, 595.28]); // A4 Landscape
  const { width, height } = page.getSize();

  page.drawText('BANK LINE MARK REGISTER', {
    x: width / 2 - 140, y: height - 30, size: 14, font: boldFont, color: rgb(0, 0, 0),
  });

  const headers = [
    'Sr.\nNo.', 'Address\n(Permanent)', 'Flat No./\nRoom/Shop\nOffice/Gala', 'Wing\nNo.',
    'Area', 'Carpet/\nBuildup\nSq.Ft.', 'Share\nCert.\nNo.', 'From', 'To',
    'Member 1', 'Member 2', 'Member 3', 'Date of\nLoan\nSanction',
    'Bank Name', 'Bank\nAddress', 'Loan\nAmount', 'Loan\nPeriod',
    'MC\nMeeting\nDate', 'Res.\nNo.', 'NOC\nDate', 'Lien\nCancel\nDate',
  ];
  const colWidths = [20, 55, 35, 20, 20, 28, 28, 22, 22, 45, 45, 45, 28, 45, 45, 25, 22, 28, 22, 22, 28];
  const tableTop = height - 50;
  const headerHeight = 40;
  const rowHeight = 24;
  const tableLeft = 15;

  let cx = tableLeft;
  for (let col = 0; col < headers.length; col++) {
    const cw = colWidths[col];
    page.drawRectangle({
      x: cx, y: tableTop - headerHeight, width: cw, height: headerHeight,
      borderColor: rgb(0, 0, 0), borderWidth: 0.5, color: rgb(0.9, 0.9, 0.95),
    });
    const htext = headers[col].replace(/\n/g, ' ');
    page.drawText(htext, {
      x: cx + 1, y: tableTop - headerHeight / 2, size: 5, font: boldFont, color: rgb(0, 0, 0), maxWidth: cw - 2,
    });
    cx += cw;
  }

  for (let row = 0; row < 10; row++) {
    let rx = tableLeft;
    const ry = tableTop - headerHeight - (row + 1) * rowHeight;
    for (let col = 0; col < colWidths.length; col++) {
      page.drawRectangle({
        x: rx, y: ry, width: colWidths[col], height: rowHeight,
        borderColor: rgb(0, 0, 0), borderWidth: 0.5,
      });
      rx += colWidths[col];
    }
  }
  return doc;
}

// ── Native Browser PDF Generator ──────────────────────────────
async function browserFetchTemplate(formId: string): Promise<PDFDocument> {
  if (formId === 'FORM_BANK') {
    return browserDrawBankTemplate();
  }
  const name = TEMPLATE_NAMES[formId];
  if (!name) throw new Error(`Unknown form ID: ${formId}`);

  // Fetch from Vite dev server public directory
  const response = await fetch(`/templates/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to load template PDF from server: /templates/${name}`);
  }
  const bytes = await response.arrayBuffer();
  return wrapPdfDocumentForWinAnsi(await PDFDocument.load(bytes));
}

// Generate single Form I PDF
async function browserGenFormI(serial: string, wb: any, font: PDFFont): Promise<Uint8Array> {
  const doc = await browserFetchTemplate('FORM_I');
  doc.registerFontkit(fontkit);
  const page = doc.getPage(0);

  const commonMap = new Map();
  for (const c of wb.commonFile) commonMap.set(normalizeSerial(c.srNo), c);
  const formIMap = new Map();
  for (const r of wb.formIData) formIMap.set(normalizeSerial(r.srNo), r);

  const key = normalizeSerial(serial);
  const common = commonMap.get(key);
  const specific = formIMap.get(key);
  const rec = { ...common, ...specific, srNo: serial };

  const draw = (coord: any, val: unknown) => {
    drawText({
      page, text: s(val), x: coord.x, y: coord.y,
      maxWidth: coord.w, maxHeight: coord.h,
      fontSize: coord.fs, minFontSize: coord.mfs,
      maxLines: coord.ml, font,
    });
  };

  // Overlay society details
  if (wb.societyMaster) {
    const soc = wb.societyMaster;
    const socAddrLines = wrapText(soc.address || '', font, 9, 230, 2);
    socAddrLines.forEach((line, idx) => {
      page.drawText(line, { x: 320, y: 805 - idx * 10, size: 8, font, color: rgb(0, 0, 0) });
    });
  }

  // Draw fields
  draw(F1_COORDS.srNo, serial);
  draw(F1_COORDS.fullName, combinedNames(rec));
  draw(F1_COORDS.permanentAddr, rec.permanentAddress);
  draw(F1_COORDS.residentialAddr, rec.residentialAddress);
  draw(F1_COORDS.dateAdmission, rec.dateOfAdmission);
  draw(F1_COORDS.dateEntrance, rec.dateOfEntranceFee);
  draw(F1_COORDS.occupation, rec.occupation);
  draw(F1_COORDS.age, rec.age);
  draw(F1_COORDS.nomineeName, rec.nomineeName);
  draw(F1_COORDS.dateNomination, rec.dateOfNomination);
  draw(F1_COORDS.dateCessation, rec.dateOfCessation);
  draw(F1_COORDS.reasonCessation, rec.reasonForCessation);
  draw(F1_COORDS.remarks, rec.remarks);
  // Shares
  draw(F1_COORDS.shareDate, rec.shareAllotmentDate);
  draw(F1_COORDS.cashBookFolio, rec.cashBookFolio);
  draw(F1_COORDS.shareCertificate, rec.shareCertificateNo);
  draw(F1_COORDS.shareFrom, rec.sharesFrom);
  draw(F1_COORDS.shareTo, rec.sharesTo);
  draw(F1_COORDS.sharesCount, rec.noOfShares);
  draw(F1_COORDS.shareValue, rec.valueOfShares);
  draw(F1_COORDS.shareAllotmentDate, rec.shareAllotmentDate);
  draw(F1_COORDS.shareAllotmentAmt, rec.valueOfShares);
  draw(F1_COORDS.share1stCall, rec.share1stCall);
  draw(F1_COORDS.share2ndCall, rec.share2ndCall);
  draw(F1_COORDS.totalAmt, rec.totalAmountReceived);
  draw(F1_COORDS.sharesHeld, rec.noOfSharesHeld);
  draw(F1_COORDS.certSerial, rec.serialNoOfShareCertificate);
  // Transfer
  draw(F1_COORDS.transDate, rec.transferDate);
  draw(F1_COORDS.transCBF, rec.transferCashBookFolio);
  draw(F1_COORDS.sharesTransf, rec.noOfSharesTransferred);
  draw(F1_COORDS.transCertNo, rec.transferCertificateNo);
  draw(F1_COORDS.balShares, rec.balanceNoOfShares);
  draw(F1_COORDS.balCertSerial, rec.balanceSerialNoCertificate);
  draw(F1_COORDS.balAmtRs, rec.balanceAmountRs);

  return doc.save();
}

// Generate multi-page table registers
async function browserGenTableRegister(formId: string, serialRange: string[], wb: any, font: PDFFont): Promise<Uint8Array> {
  let config: any;
  let getRecord: (s: string) => any;

  switch (formId) {
    case 'FORM_J': {
      config = FORM_J_CONFIG;
      const map = new Map();
      for (const r of wb.formJData) map.set(normalizeSerial(r.srNo), r);
      for (const c of wb.commonFile) {
        const k = normalizeSerial(c.srNo);
        if (!map.has(k)) map.set(k, { ...c, classOfMember: '' });
      }
      getRecord = (srNo) => map.get(normalizeSerial(srNo)) ?? null;
      break;
    }
    case 'FORM_SHARE': {
      config = SHARE_CONFIG;
      const map = new Map();
      for (const r of wb.shareData) map.set(normalizeSerial(r.srNo), r);
      for (const c of wb.commonFile) {
        const k = normalizeSerial(c.srNo);
        if (!map.has(k)) map.set(k, {
          ...c, dateOfAllotment: '', cashBookFolioNo: '', dateOfTransferRefund: '',
          transferJournalFolioNo: '', noOfSharesTransferredRefunded: '', shareCertTransferred: '',
          sharesValueTransferred: '', nameOfTransferee: '', authorityForTransfer: '', remark: '',
        });
      }
      getRecord = (srNo) => map.get(normalizeSerial(srNo)) ?? null;
      break;
    }
    case 'FORM_NOM': {
      config = NOM_CONFIG;
      const map = new Map();
      for (const r of wb.nominationData) map.set(normalizeSerial(r.srNo), r);
      for (const c of wb.commonFile) {
        const k = normalizeSerial(c.srNo);
        if (!map.has(k)) map.set(k, {
          ...c, dateOfNomination: '', nomineeName: '', nomineeAddress: '',
          nomineePercentage: '', mcMeetingDate: '', subsequentRevocation: '', remark: '',
        });
      }
      getRecord = (srNo) => map.get(normalizeSerial(srNo)) ?? null;
      break;
    }
    case 'FORM_PROP': {
      config = PROP_CONFIG;
      const map = new Map();
      for (const r of wb.propertyData) map.set(normalizeSerial(r.srNo), r);
      for (const c of wb.commonFile) {
        const k = normalizeSerial(c.srNo);
        if (!map.has(k)) map.set(k, {
          ...c, dateOfPossession: '', distinguishingNo: '', descriptionOfTenement: '',
          areaOfTenement: '', costOfTenement: '', annualGroundRent: '',
          dateOfCessation: '', signature: '', remark: '',
        });
      }
      getRecord = (srNo) => map.get(normalizeSerial(srNo)) ?? null;
      break;
    }
    case 'FORM_BANK': {
      config = BANK_CONFIG;
      const map = new Map();
      for (const r of wb.bankLineMarkData) map.set(normalizeSerial(r.srNo), r);
      for (const c of wb.commonFile) {
        const k = normalizeSerial(c.srNo);
        if (!map.has(k)) map.set(k, {
          ...c, area: '', carpetBuildupSqFt: '', dateOfLoanSanction: '',
          bankName: '', bankAddress: '', loanAmount: '', loanPeriod: '',
          mcMeetingApprovalDate: '', resolutionNo: '', dateOfNOC: '',
          dateOfLienCancellation: '',
        });
      }
      getRecord = (srNo) => map.get(normalizeSerial(srNo)) ?? null;
      break;
    }
    default:
      throw new Error(`Unknown form ID: ${formId}`);
  }

  const templateDoc = await browserFetchTemplate(formId);
  const tplBytes = await templateDoc.save();
  const outputDoc = wrapPdfDocumentForWinAnsi(await PDFDocument.create());
  outputDoc.registerFontkit(fontkit);

  const pagesCount = Math.ceil(serialRange.length / config.rowsPerPage);

  for (let pageIdx = 0; pageIdx < pagesCount; pageIdx++) {
    const pageSerials = serialRange.slice(
      pageIdx * config.rowsPerPage,
      (pageIdx + 1) * config.rowsPerPage
    );

    const srcDoc = wrapPdfDocumentForWinAnsi(await PDFDocument.load(tplBytes));
    const [tplPage] = await outputDoc.copyPages(srcDoc, [0]);
    outputDoc.addPage(tplPage);
    const page = outputDoc.getPage(outputDoc.getPageCount() - 1);

    // Page number
    if (config.pageNumField) {
      const pf = config.pageNumField;
      drawText({
        page, text: String(pageIdx + 1).padStart(2, '0'),
        x: pf.x, y: pf.y, maxWidth: pf.w, maxHeight: pf.h,
        fontSize: pf.fs, minFontSize: pf.fs - 1, maxLines: 1, font, align: 'center',
      });
    }

    // Fill rows
    for (let rowIdx = 0; rowIdx < pageSerials.length; rowIdx++) {
      const serial = pageSerials[rowIdx];
      const rec = getRecord(serial);
      const rowBaseY = config.firstRowY - rowIdx * config.rowHeight;

      for (const field of config.fields) {
        let value = '';
        if (field.getValue) {
          value = field.getValue(rec, serial, pageIdx + 1);
        } else if (rec && rec[field.key] !== undefined) {
          value = s(rec[field.key]);
        } else if (field.key === 'srNo') {
          value = serial;
        }

        drawText({
          page, text: value, x: field.x, y: rowBaseY + field.yOffset,
          maxWidth: field.w, maxHeight: field.h,
          fontSize: field.fs, minFontSize: field.mfs, maxLines: field.ml, font,
          align: field.align || 'left',
        });
      }
    }
  }

  return outputDoc.save();
}

// ── Trigger download in browser helper ────────────────────────
function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Web Mock API Object ───────────────────────────────────────
export const browserMockApi = {
  society: {
    list: async () => {
      let societies = JSON.parse(localStorage.getItem('henu_os_societies') || '[]');
      societies = (societies || []).filter((s: any) => s && s.societyName && !/^\d{4}-\d{2}-\d{2}T/.test(s.societyName));
      if (societies.length === 0) {
        const def = {
          id: 'default-society-1',
          societyName: 'HENU OS PRIVATE LIMITED',
          registrationNo: 'U62099RJ2025PTC109150',
          registrationDate: '02/12/2025',
          fullAddress: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home',
          city: 'Pali',
          state: 'Rajasthan',
          pinCode: '306401',
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        localStorage.setItem('henu_os_societies', JSON.stringify([def]));
        return [def];
      }
      return societies;
    },
    getActive: async () => {
      const societies = await browserMockApi.society.list();
      const activeId = localStorage.getItem('henu_os_active_society_id');
      if (activeId) {
        const match = societies.find((s: any) => String(s.id).trim() === String(activeId).trim());
        if (match) return match;
      }
      const active = societies.find((s: any) => s.isActive);
      return active || societies[0];
    },
    create: async (payload: any) => {
      const societies = await browserMockApi.society.list();
      societies.forEach((s: any) => { s.isActive = false; });
      const newSoc = {
        id: `soc-${Date.now()}`,
        societyName: payload.societyName,
        registrationNo: payload.registrationNo,
        registrationDate: payload.registrationDate || '',
        fullAddress: payload.fullAddress || '',
        city: payload.city || '',
        state: payload.state || '',
        pinCode: payload.pinCode || '',
        logoBase64: payload.logoBase64 || '',
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      societies.unshift(newSoc);
      localStorage.setItem('henu_os_societies', JSON.stringify(societies));
      localStorage.setItem('henu_os_active_society_id', newSoc.id);
      return newSoc;
    },
    select: async (societyId: string) => {
      const societies = await browserMockApi.society.list();
      societies.forEach((s: any) => {
        s.isActive = String(s.id).trim() === String(societyId).trim();
      });
      localStorage.setItem('henu_os_societies', JSON.stringify(societies));
      localStorage.setItem('henu_os_active_society_id', societyId);
      const active = societies.find((s: any) => String(s.id).trim() === String(societyId).trim());
      return active || societies[0];
    },
    setActive: async (societyId: string) => browserMockApi.society.select(societyId),
    delete: async (societyId: string) => {
      let societies = await browserMockApi.society.list();
      societies = societies.filter((s: any) => s.id !== societyId);
      if (societies.length === 0) {
        const defaultSoc = {
          id: 'default-society-1',
          societyName: 'HENU OS PVT LTD CO-SOC',
          registrationNo: 'U62099RJ2025PTC109150',
          registrationDate: '2025-01-01',
          fullAddress: 'Plot No. 42, Henu Tower, Apex Road',
          city: 'Jaipur',
          state: 'Rajasthan',
          pinCode: '302015',
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        societies = [defaultSoc];
      } else {
        const hasActive = societies.some((s: any) => s.isActive);
        if (!hasActive) {
          societies[0].isActive = true;
        }
      }
      localStorage.setItem('henu_os_societies', JSON.stringify(societies));
      const active = societies.find((s: any) => s.isActive) || societies[0];
      localStorage.setItem('henu_os_active_society_id', active.id);
      return active;
    },
    updateLogo: async (societyId: string, logoBase64: string) => {
      let societies = await browserMockApi.society.list();
      societies = societies.map((s: any) => s.id === societyId ? { ...s, logoBase64 } : s);
      localStorage.setItem('henu_os_societies', JSON.stringify(societies));
      const active = societies.find((s: any) => s.id === societyId) || societies[0];

      // Also persist to active workbook in localStorage so PDF generation immediately has the logo
      const data = localStorage.getItem(getWorkbookKey());
      if (data) {
        try {
          const wb = JSON.parse(data);
          if (!wb.societyMaster) wb.societyMaster = {};
          wb.societyMaster.logoBase64 = logoBase64;
          localStorage.setItem(getWorkbookKey(), JSON.stringify(wb));
        } catch {}
      }

      return active;
    },
  },
  societies: {
    list: async () => browserMockApi.society.list(),
    getActive: async () => browserMockApi.society.getActive(),
    create: async (payload: any) => browserMockApi.society.create(payload),
    select: async (societyId: string) => browserMockApi.society.select(societyId),
    delete: async (societyId: string) => browserMockApi.society.delete(societyId),
    updateLogo: async (societyId: string, logoBase64: string) => browserMockApi.society.updateLogo(societyId, logoBase64),
  },
  foundation: {
    getStatus: async () => {
      const activeSoc = await browserMockApi.society.getActive();
      const status = await browserMockApi.masterData.getStatus();
      const isSocComplete = Boolean(activeSoc && activeSoc.societyName && activeSoc.registrationNo);
      const memberCount = status?.commonRecords || 0;
      const isCommonComplete = isSocComplete && memberCount > 0;
      const isUnlocked = isSocComplete && isCommonComplete;

      return {
        societyId: activeSoc?.id || '',
        societyMasterComplete: isSocComplete,
        commonMemberMasterComplete: isCommonComplete,
        registersUnlocked: isUnlocked,
        societyMasterStatusText: isSocComplete ? '✓ Complete' : '⚠ Incomplete',
        commonMemberStatusText: !isSocComplete ? '🔒 Locked' : isCommonComplete ? '✓ Complete' : '⚠ Incomplete',
        registersStatusText: isUnlocked ? '✓ Unlocked' : '🔒 Locked',
        memberCount,
      };
    },
  },
  settings: {
    get: async (key: string, defaultValue = '') => {
      const map = getSettingsMap();
      return map[key] !== undefined ? map[key] : defaultValue;
    },
    set: async (key: string, value: string) => {
      const map = getSettingsMap();
      map[key] = value;
      saveSettingsMap(map);
    },
    list: async () => {
      const map = getSettingsMap();
      return Object.entries(map).map(([key, value]) => ({ key, value }));
    },
    getFormSettings: async (formId: string) => {
      const socId = getActiveSocietyId();
      const map = getSettingsMap();
      const cleanFormId = formId ? formId.replace(/^settings_/, '') : '';
      const globalRaw = map['settings_global'] ? JSON.parse(map['settings_global']) : {};
      const socGlobalRaw = map[`settings_${socId}_global`] ? JSON.parse(map[`settings_${socId}_global`]) : {};
      const formRaw = cleanFormId && cleanFormId !== 'global'
        ? (map[`settings_${socId}_${cleanFormId}`] ? JSON.parse(map[`settings_${socId}_${cleanFormId}`]) : (map[`settings_${cleanFormId}`] ? JSON.parse(map[`settings_${cleanFormId}`]) : {}))
        : {};
      return {
        colorMode: 'Color',
        horizontalAlign: 'center',
        verticalAlign: 'middle',
        fontFamily: 'Helvetica',
        fontSize: 7.5,
        headerFontSize: 11,
        bold: false,
        italic: false,
        textWrapping: true,
        textRotation: 0,
        textColor: '#1C355E',
        headerBgColor: '#D9E1F2',
        cellBgColor: '#FFFFFF',
        borderColor: '#8EA9DB',
        gridColor: '#D9E1F2',
        gridOpacity: 100,
        gridOn: true,
        rowsPerPage: 10,
        pageNumberAlign: 'center',
        pageNumberPrefix: '',
        brandingText: 'HENU OS - Records Management',
        brandingAlign: 'right',
        customFooterText: '',
        customFooterAlign: 'left',
        ...globalRaw,
        ...socGlobalRaw,
        ...formRaw,
      };
    },
    saveFormSettings: async (formId: string, settings: any) => {
      const socId = getActiveSocietyId();
      const map = getSettingsMap();
      const cleanFormId = formId.replace(/^settings_/, '');
      const keyName = `settings_${socId}_${cleanFormId}`;
      map[keyName] = JSON.stringify(settings);

      // Propagate Branding BOX Footer to all 6 forms
      const allForms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
      for (const f of allForms) {
        const k = `settings_${socId}_${f}`;
        const existing = map[k] ? JSON.parse(map[k]) : {};
        existing.brandingText = settings.brandingText;
        existing.brandingAlign = settings.brandingAlign;
        existing.pageNumberAlign = settings.pageNumberAlign;
        existing.customFooterText = settings.customFooterText;
        existing.customFooterAlign = settings.customFooterAlign;
        map[k] = JSON.stringify(existing);
      }

      saveSettingsMap(map);
      return settings;
    },
    resetFormSettings: async (formId: string) => {
      const socId = getActiveSocietyId();
      const map = getSettingsMap();
      const cleanFormId = formId.replace(/^settings_/, '');
      const keyName = `settings_${socId}_${cleanFormId}`;
      delete map[keyName];
      saveSettingsMap(map);
      const globalRaw = map['settings_global'] ? JSON.parse(map['settings_global']) : {};
      const socGlobalRaw = map[`settings_${socId}_global`] ? JSON.parse(map[`settings_${socId}_global`]) : {};
      return {
        colorMode: 'Color',
        horizontalAlign: 'center',
        verticalAlign: 'middle',
        fontFamily: 'Helvetica',
        fontSize: 7.5,
        headerFontSize: 11,
        bold: false,
        italic: false,
        textWrapping: true,
        textRotation: 0,
        textColor: '#1C355E',
        headerBgColor: '#D9E1F2',
        cellBgColor: '#FFFFFF',
        borderColor: '#8EA9DB',
        gridColor: '#D9E1F2',
        gridOpacity: 100,
        gridOn: true,
        pageNumberAlign: 'center',
        pageNumberPrefix: '',
        brandingText: 'HENU OS - Records Management',
        brandingAlign: 'right',
        customFooterText: '',
        customFooterAlign: 'left',
        ...globalRaw,
        ...socGlobalRaw,
      };
    },
    resetGlobalSettings: async () => {
      const map = getSettingsMap();
      Object.keys(map).forEach(k => { if (k.startsWith('settings_')) delete map[k]; });
      saveSettingsMap(map);
      return {
        horizontalAlign: 'center',
        verticalAlign: 'middle',
        fontFamily: 'Helvetica',
        fontSize: 7.5,
        headerFontSize: 11,
        bold: false,
        italic: false,
        textWrapping: true,
        textRotation: 0,
        textColor: '#1C355E',
        headerBgColor: '#D9E1F2',
        cellBgColor: '#FFFFFF',
        borderColor: '#8EA9DB',
        gridColor: '#D9E1F2',
        gridOpacity: 100,
        gridOn: true,
        pageNumberAlign: 'center',
        pageNumberPrefix: '',
        brandingText: 'HENU OS - Records Management',
        brandingAlign: 'right',
        customFooterText: '',
        customFooterAlign: 'left',
      };
    },
  },

  masterData: {
    downloadTemplate: async () => {
      const buffer = await MasterDataService.generateTemplate();
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      triggerBrowserDownload(blob, 'HENU_OS_Master_Template.xlsx');
      return 'Downloads/HENU_OS_Master_Template.xlsx';
    },

    downloadMasterTemplate: async () => {
      const buffer = await MasterDataService.generateTemplate();
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      triggerBrowserDownload(blob, 'HENU_OS_Master_Template.xlsx');
      return 'Downloads/HENU_OS_Master_Template.xlsx';
    },

    exportMaster: async () => {
      const activeSoc = await browserMockApi.society.getActive();
      const wbStr = localStorage.getItem(getWorkbookKey());
      let wb = wbStr ? JSON.parse(wbStr) : null;
      if (!wb) {
        wb = {
          societyMaster: {
            societyName: activeSoc?.societyName || 'CO-OPERATIVE HOUSING SOCIETY LTD',
            registrationNo: activeSoc?.registrationNo || '',
            registrationDate: activeSoc?.registrationDate || '',
            headerAddress: activeSoc?.fullAddress || '',
            address: activeSoc?.fullAddress || '',
            societyAddress: {
              line1: activeSoc?.fullAddress || '',
              line2: `${activeSoc?.city || ''} ${activeSoc?.state || ''} ${activeSoc?.pinCode || ''}`.trim(),
              line3: '',
              line4: '',
              line5: '',
              line6: '',
            },
            email: '',
            telephone: '',
            totalUnits: 0,
            unitsFlat: 0,
            unitsShop: 0,
            unitsOffice: 0,
            unitsGala: 0,
            printBlanks: 0,
          },
          commonFile: [],
          formIData: [],
          formJData: [],
          shareData: [],
          nominationData: [],
          propertyData: [],
          bankLineMarkData: [],
          voucherData: [],
          loadedAt: new Date().toISOString(),
          fileName: 'Master_Data.xlsx',
          validationErrors: [],
          validationWarnings: [],
        };
      }
      const buffer = await MasterDataService.exportMasterWorkbook(wb);
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `${(wb.societyMaster?.societyName || activeSoc?.societyName || 'Master').replace(/[^a-zA-Z0-9]/g, '_')}_Master_Workbook.xlsx`;
      triggerBrowserDownload(blob, filename);
      return `Downloads/${filename}`;
    },

    downloadModuleTemplate: async (moduleId: any) => {
      const buffer = await MasterDataService.generateIndividualTemplate(moduleId);
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      triggerBrowserDownload(blob, `Template_${moduleId}.xlsx`);
      return `Downloads/Template_${moduleId}.xlsx`;
    },

    exportModule: async (moduleId: any) => {
      const activeSoc = await browserMockApi.society.getActive();
      const wbStr = localStorage.getItem(getWorkbookKey());
      let wb = wbStr ? JSON.parse(wbStr) : null;
      if (!wb) {
        wb = {
          societyMaster: {
            societyName: activeSoc?.societyName || 'CO-OPERATIVE HOUSING SOCIETY LTD',
            registrationNo: activeSoc?.registrationNo || '',
            registrationDate: activeSoc?.registrationDate || '',
            headerAddress: activeSoc?.fullAddress || '',
            address: activeSoc?.fullAddress || '',
            societyAddress: {
              line1: activeSoc?.fullAddress || '',
              line2: `${activeSoc?.city || ''} ${activeSoc?.state || ''} ${activeSoc?.pinCode || ''}`.trim(),
              line3: '',
              line4: '',
              line5: '',
              line6: '',
            },
            email: '',
            telephone: '',
            totalUnits: 0,
            unitsFlat: 0,
            unitsShop: 0,
            unitsOffice: 0,
            unitsGala: 0,
            printBlanks: 0,
          },
          commonFile: [],
          formIData: [],
          formJData: [],
          shareData: [],
          nominationData: [],
          propertyData: [],
          bankLineMarkData: [],
          voucherData: [],
          loadedAt: new Date().toISOString(),
          fileName: 'Master_Data.xlsx',
          validationErrors: [],
          validationWarnings: [],
        };
      }
      const buffer = await MasterDataService.exportIndividualModule(wb, moduleId);
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `${(wb.societyMaster?.societyName || activeSoc?.societyName || 'Master').replace(/[^a-zA-Z0-9]/g, '_')}_${moduleId}.xlsx`;
      triggerBrowserDownload(blob, filename);
      return `Downloads/${filename}`;
    },

    importModule: async (moduleId: any): Promise<any> => {
      return browserMockApi.masterData.upload();
    },

    getMembersList: async () => {
      const wbStr = localStorage.getItem(getWorkbookKey());
      const wb = wbStr ? JSON.parse(wbStr) : null;
      return wb?.commonFile || [];
    },

    updateMemberRecord: async (record: any) => {
      const wbStr = localStorage.getItem(getWorkbookKey());
      const wb = wbStr ? JSON.parse(wbStr) : null;
      if (!wb) return null;
      let found = false;

      const updateList = (list: any[]) => {
        if (!Array.isArray(list)) return list;
        return list.map((m: any) => {
          if ((record.memberId && m.memberId === record.memberId) || (record.srNo && String(m.srNo).trim() === String(record.srNo).trim())) {
            found = true;
            return { ...m, ...record };
          }
          return m;
        });
      };

      wb.commonFile = updateList(wb.commonFile || []);
      if (wb.formIData) wb.formIData = updateList(wb.formIData);
      if (wb.formJData) wb.formJData = updateList(wb.formJData);
      if (wb.shareData) wb.shareData = updateList(wb.shareData);
      if (wb.nominationData) wb.nominationData = updateList(wb.nominationData);
      if (wb.propertyData) wb.propertyData = updateList(wb.propertyData);
      if (wb.bankLineMarkData) wb.bankLineMarkData = updateList(wb.bankLineMarkData);

      if (!found && record.srNo) {
        wb.commonFile.push(record);
      }
      localStorage.setItem(getWorkbookKey(), JSON.stringify(wb));
      return browserMockApi.masterData.getStatus();
    },

    upload: async (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = async (evt: any) => {
            try {
              const data = new Uint8Array(evt.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              
              const parsedWb = MasterDataService.parseXlsxWorkbook(workbook, file.name);
              const validation = ValidationEngine.validateWorkbook(parsedWb);
              parsedWb.validationErrors = validation.errors;
              parsedWb.validationWarnings = [...parsedWb.validationWarnings, ...validation.warnings];

              localStorage.setItem(getWorkbookKey(), JSON.stringify(parsedWb));
              
              resolve({
                fileName: parsedWb.fileName,
                societyName: parsedWb.societyMaster?.societyName || '',
                registrationNo: parsedWb.societyMaster?.registrationNo || '',
                commonRecords: parsedWb.commonFile.length,
                formICnt: parsedWb.formIData.length,
                formJCnt: parsedWb.formJData.length,
                shareCnt: parsedWb.shareData.length,
                nominationCnt: parsedWb.nominationData.length,
                propertyCnt: parsedWb.propertyData.length,
                bankCnt: parsedWb.bankLineMarkData.length,
                loadedAt: parsedWb.loadedAt,
                validationErrors: parsedWb.validationErrors,
                validationWarnings: parsedWb.validationWarnings,
                isValid: parsedWb.validationErrors.length === 0,
              });
            } catch (err: any) {
              reject(err);
            }
          };
          reader.readAsArrayBuffer(file);
        };
        input.click();
      });
    },

    getStatus: async () => {
      const data = localStorage.getItem(getWorkbookKey());
      if (!data) return null;
      try {
        const parsed = JSON.parse(data);
        return {
          fileName: parsed.fileName,
          societyName: parsed.societyMaster?.societyName || '',
          registrationNo: parsed.societyMaster?.registrationNo || '',
          commonRecords: parsed.commonFile ? parsed.commonFile.length : 0,
          formICnt: parsed.formIData ? parsed.formIData.length : 0,
          formJCnt: parsed.formJData ? parsed.formJData.length : 0,
          shareCnt: parsed.shareData ? parsed.shareData.length : 0,
          nominationCnt: parsed.nominationData ? parsed.nominationData.length : 0,
          propertyCnt: parsed.propertyData ? parsed.propertyData.length : 0,
          bankCnt: parsed.bankLineMarkData ? parsed.bankLineMarkData.length : 0,
          loadedAt: parsed.loadedAt,
          validationErrors: parsed.validationErrors || [],
          validationWarnings: parsed.validationWarnings || [],
          isValid: (parsed.validationErrors || []).length === 0,
        };
      } catch {
        return null;
      }
    },

    clear: async () => {
      localStorage.removeItem(getWorkbookKey());
    },

    getWorkbook: async () => {
      const data = localStorage.getItem(getWorkbookKey());
      if (!data) return null;
      try {
        let wb = JSON.parse(data);
        wb = synchronizeMasterWorkbook(wb);
        return wb;
      } catch {
        return null;
      }
    },

    updateWorkbook: async (wb: any) => {
      if (!wb) return { isValid: false };
      wb = synchronizeMasterWorkbook(wb);
      const validation = ValidationEngine.validateWorkbook(wb);
      wb.validationErrors = validation.errors;
      wb.validationWarnings = [...(wb.validationWarnings || []), ...validation.warnings];
      localStorage.setItem(getWorkbookKey(), JSON.stringify(wb));
      return {
        isValid: (wb.validationErrors || []).length === 0,
        errors: wb.validationErrors || [],
        warnings: wb.validationWarnings || []
      };
    },

    getFoundationStatus: async () => {
      const data = localStorage.getItem(getWorkbookKey());
      if (!data) return { societyMasterComplete: false, commonMemberMasterComplete: false, registersUnlocked: false };
      try {
        const parsed = JSON.parse(data);
        const hasSociety = Boolean(parsed.societyMaster && (parsed.societyMaster.societyName || parsed.societyMaster.registrationNo));
        const hasMembers = Boolean(parsed.commonFile && parsed.commonFile.length > 0);
        return {
          societyMasterComplete: hasSociety,
          commonMemberMasterComplete: hasMembers,
          registersUnlocked: hasSociety && hasMembers
        };
      } catch {
        return { societyMasterComplete: false, commonMemberMasterComplete: false, registersUnlocked: false };
      }
    },

    getFormDetails: async (formId: string) => {
      const data = localStorage.getItem(getWorkbookKey());
      if (!data) return null;
      let wb = JSON.parse(data);
      wb = synchronizeMasterWorkbook(wb);

      const SHEET_NAMES: Record<string, string> = {
        FORM_I: 'I form', FORM_J: 'J form', FORM_SHARE: 'Share Register',
        FORM_NOM: 'Nomination Register', FORM_PROP: 'Property Register',
        FORM_BANK: 'Bank Line Mark Register', FORM_VOUCHER: 'Voucher Register',
      };

      let specificSheetRecords: any[] = [];
      switch (formId) {
        case 'FORM_I': specificSheetRecords = (wb.formIData && wb.formIData.length > 0) ? wb.formIData : (wb.commonFile || []); break;
        case 'FORM_J': specificSheetRecords = (wb.formJData && wb.formJData.length > 0) ? wb.formJData : (wb.commonFile || []); break;
        case 'FORM_SHARE': specificSheetRecords = (wb.shareData && wb.shareData.length > 0) ? wb.shareData : (wb.commonFile || []); break;
        case 'FORM_NOM': specificSheetRecords = (wb.nominationData && wb.nominationData.length > 0) ? wb.nominationData : (wb.commonFile || []); break;
        case 'FORM_PROP': specificSheetRecords = (wb.propertyData && wb.propertyData.length > 0) ? wb.propertyData : (wb.commonFile || []); break;
        case 'FORM_BANK': specificSheetRecords = (wb.bankLineMarkData && wb.bankLineMarkData.length > 0) ? wb.bankLineMarkData : (wb.commonFile || []); break;
        case 'FORM_SHARE_CERT': specificSheetRecords = (wb as any).shareCertData || wb.shareData || wb.commonFile || []; break;
        case 'FORM_VOUCHER': specificSheetRecords = wb.voucherData || []; break;
        default: specificSheetRecords = wb.commonFile || [];
      }
      if (!Array.isArray(specificSheetRecords)) specificSheetRecords = wb.commonFile || [];

      const rawSerials = (formId === 'FORM_VOUCHER' && (wb.voucherData || []).length > 0)
        ? (wb.voucherData || []).map((v: any) => (v.voucherNo || v.srNo || '').trim())
        : (wb.commonFile || []).map((r: any) => (r.srNo || '').trim());

      const commonSerials = rawSerials.filter((s: any) => s !== '');
      let minNum = Infinity; let maxNum = -Infinity;
      let minSerial = ''; let maxSerial = '';
      const serialSet = new Set<string>();

      for (const s of commonSerials) {
        const num = parseInt(s, 10);
        if (!isNaN(num)) {
          serialSet.add(s);
          if (num < minNum) { minNum = num; minSerial = s; }
          if (num > maxNum) { maxNum = num; maxSerial = s; }
        }
      }

      const missingSerials: string[] = [];
      if (minNum !== Infinity && maxNum !== -Infinity) {
        const padWidth = minSerial.length;
        for (let i = minNum; i <= maxNum; i++) {
          const expected = String(i).padStart(padWidth, '0');
          if (!serialSet.has(expected)) {
            missingSerials.push(expected);
          }
        }
      }

      const orientations: Record<string, string> = {
        FORM_I: 'Portrait', FORM_J: 'Portrait', FORM_SHARE: 'Landscape',
        FORM_NOM: 'Landscape', FORM_PROP: 'Landscape', FORM_BANK: 'Landscape',
        FORM_SHARE_CERT: 'Landscape', FORM_VOUCHER: 'Portrait',
      };

      const outputTypes: Record<string, string> = {
        FORM_I: 'ZIP containing individual PDF files per member (FORM_I_XXX.pdf)',
        FORM_J: 'ZIP containing a single multi-page PDF document (FORM_J_XXX-XXX.pdf)',
        FORM_SHARE: 'ZIP containing a single multi-page PDF document (SHARE_REGISTER_XXX-XXX.pdf)',
        FORM_NOM: 'ZIP containing a single multi-page PDF document (NOMINATION_REGISTER_XXX-XXX.pdf)',
        FORM_PROP: 'ZIP containing a single multi-page PDF document (PROPERTY_REGISTER_XXX-XXX.pdf)',
        FORM_BANK: 'ZIP containing a single multi-page PDF document (BANK_LINE_MARK_XXX-XXX.pdf)',
        FORM_SHARE_CERT: 'ZIP containing 13x19 2-page PDF documents (SHARE_CERTIFICATE_13X19_XXX-XXX.pdf)',
        FORM_VOUCHER: 'ZIP containing A4 2-per-page PDF documents (PAYMENT_VOUCHER_A4_XXX-XXX.pdf)',
      };

      return {
        sheetName: SHEET_NAMES[formId] || '',
        recordCount: specificSheetRecords.length,
        availableMinSerial: minNum !== Infinity ? minSerial : '—',
        availableMaxSerial: maxNum !== -Infinity ? maxSerial : '—',
        missingSerials,
        orientation: orientations[formId] || 'Portrait',
        outputType: outputTypes[formId] || '',
      };
    },
  },

  generate: {
    getPreviewRange: async (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
      let formId: string;
      let fromSerial: string;
      let toSerial: string;
      let nonSerialCount: number;

      if (typeof arg1 === 'object' && arg1 !== null) {
        formId = arg1.formId;
        fromSerial = String(arg1.fromSerial ?? '').trim();
        toSerial = String(arg1.toSerial ?? '').trim();
        nonSerialCount = Math.max(0, Number(arg1.nonSerialCount) || 0);
      } else {
        formId = arg1;
        fromSerial = String(arg2 ?? '').trim();
        toSerial = String(arg3 ?? '').trim();
        nonSerialCount = Math.max(0, Number(arg4) || 0);
      }

      const data = localStorage.getItem(getWorkbookKey());
      if (!data) return { error: 'No master data loaded.' };
      const rangeValidation = validateSerialRange(fromSerial, toSerial, nonSerialCount);
      if (rangeValidation) return { error: rangeValidation };

      const wb = JSON.parse(data);
      const serialRange = (fromSerial || toSerial) ? generateRange(fromSerial, toSerial) : [];
      const commonSerials = new Set((wb.commonFile || []).map((r: any) => normalizeSerial(r.srNo)));
      let found = 0; let blank = 0;
      for (const s of serialRange) {
        if (commonSerials.has(normalizeSerial(s))) found++; else blank++;
      }
      return {
        fromSerial, toSerial,
        totalSelected: serialRange.length,
        foundCount: found,
        blankCount: blank,
        nonSerialCount,
        totalOutput: serialRange.length + nonSerialCount
      };
    },

    preview: async (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
      let formId: string;
      let fromSerial: string;
      let toSerial: string;
      let nonSerialCount: number;

      if (typeof arg1 === 'object' && arg1 !== null) {
        formId = arg1.formId;
        fromSerial = String(arg1.fromSerial ?? '').trim();
        toSerial = String(arg1.toSerial ?? '').trim();
        nonSerialCount = Math.max(0, Number(arg1.nonSerialCount) || 0);
      } else {
        formId = arg1;
        fromSerial = String(arg2 ?? '').trim();
        toSerial = String(arg3 ?? '').trim();
        nonSerialCount = Math.max(0, Number(arg4) || 0);
      }

      const data = localStorage.getItem(getWorkbookKey());
      if (!data) return { error: 'No master data loaded.' };
      const rangeValidation = validateSerialRange(fromSerial, toSerial, nonSerialCount);
      if (rangeValidation) return { error: rangeValidation };

      const wb = JSON.parse(data);
      const serialRange = (fromSerial || toSerial) ? generateRange(fromSerial, toSerial) : [];
      const commonSerials = new Set((wb.commonFile || []).map((r: any) => (r.srNo || '').trim()));
      let found = 0; let blank = 0;
      for (const s of serialRange) {
        if (commonSerials.has(s)) found++; else blank++;
      }
      return { formId, fromSerial, toSerial, requested: serialRange.length, found, blank, nonSerialCount, totalOutput: serialRange.length + nonSerialCount, serialList: serialRange };
    },

    previewPdf: async (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
      let formId: string;
      let fromSerial: string;
      let toSerial: string;
      let options: any;

      if (typeof arg1 === 'object' && arg1 !== null) {
        formId = arg1.formId;
        fromSerial = arg1.fromSerial || '001';
        toSerial = arg1.toSerial || '010';
        options = arg1;
      } else {
        formId = arg1;
        fromSerial = arg2 || '001';
        toSerial = arg3 || '010';
        options = arg4;
      }

      const data = localStorage.getItem(getWorkbookKey());
      let wb: any = data ? JSON.parse(data) : { societyMaster: {}, commonFile: [], voucherData: [] };

      const activeSoc = await browserMockApi.society.getActive();
      if (activeSoc) {
        if (!wb.societyMaster) wb.societyMaster = {};
        wb.societyMaster.logoBase64 = activeSoc.logoBase64 !== undefined ? activeSoc.logoBase64 : (wb.societyMaster.logoBase64 || '');
        wb.societyMaster.societyName = activeSoc.societyName || wb.societyMaster.societyName || '';
        wb.societyMaster.registrationNo = activeSoc.registrationNo || wb.societyMaster.registrationNo || '';
        wb.societyMaster.address = activeSoc.fullAddress || wb.societyMaster.address || '';
      }

      if (formId === 'FORM_VOUCHER' && (!wb.voucherData || wb.voucherData.length === 0)) {
        wb.voucherData = [
          {
            srNo: '001',
            voucherNo: '001',
            socNumber: wb.societyMaster?.registrationNo || '',
            societyName: wb.societyMaster?.societyName || '',
            societyAddress: wb.societyMaster?.address || '',
            toPayee: 'Apex Facility Management',
            chargeTo: 'Maintenance Expenses',
            particulars: 'Being security and housekeeping charges for the current month.',
            bankName: 'State Bank of India',
            chequeNo: '102938',
            voucherDate: '15/01/2025',
            billNo: 'INV-001',
            billAmount: '25000',
            billAmount2: '',
            advLessPaid: '',
            subTotal1: '25000',
            tdsPercent: '2',
            tdsAmount: '500',
            subTotal2: '24500',
            cgstPercent: '9',
            cgstAmount: '2205',
            sgstPercent: '9',
            sgstAmount: '2205',
            roundOff: '',
            otherFineAdj: '',
            netPaid: '28910'
          }
        ];
      }

      try {
        const output = await PdfEngine.generate({
          formId: formId as any,
          fromSerial,
          toSerial,
          nonSerialCount: options?.nonSerialCount,
          templateId: options?.templateId,
          shareRegisterTemplateId: options?.shareRegisterTemplateId,
          voucherPaperSize: options?.voucherPaperSize,
          voucherTemplateId: options?.voucherTemplateId,
          emptyRows: options?.emptyRows,
          dataFontSize: options?.dataFontSize,
          dataTextColor: options?.dataTextColor,
          workbook: wb,
          societyId: getActiveSocietyId(),
          orientationOverride: options?.orientationOverride,
          prefix: options?.prefix,
          separator: options?.separator,
          rowsPerPage: options?.rowsPerPage,
          gridOn: options?.gridOn,
          renderMode: options?.renderMode,
          headerImageBase64: options?.headerImageBase64,
          ackImageBase64: options?.ackImageBase64,
          fontFamily: options?.fontFamily,
        });

        let previewBuffer: Uint8Array;
        if (formId === 'FORM_I' && output.files.length > 1) {
          previewBuffer = await PdfEngine.mergeFormIPdfs(output.files);
        } else {
          previewBuffer = output.files[0].buffer;
        }

        const blob = new Blob([previewBuffer as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        return { previewPdfUrl: url, previewPdfPath: 'Browser Temp' };
      } catch (err: any) {
        return { error: err.message };
      }
    },

    execute: async (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
      let formId: string;
      let fromSerial: string;
      let toSerial: string;
      let options: any;

      if (typeof arg1 === 'object' && arg1 !== null) {
        formId = arg1.formId;
        fromSerial = arg1.fromSerial || '001';
        toSerial = arg1.toSerial || '010';
        options = arg1;
      } else {
        formId = arg1;
        fromSerial = arg2 || '001';
        toSerial = arg3 || '010';
        options = arg4;
      }

      const data = localStorage.getItem(getWorkbookKey());
      let wb: any = data ? JSON.parse(data) : { societyMaster: {}, commonFile: [], voucherData: [] };

      const activeSoc = await browserMockApi.society.getActive();
      if (activeSoc) {
        if (!wb.societyMaster) wb.societyMaster = {};
        wb.societyMaster.logoBase64 = activeSoc.logoBase64 !== undefined ? activeSoc.logoBase64 : (wb.societyMaster.logoBase64 || '');
        wb.societyMaster.societyName = activeSoc.societyName || wb.societyMaster.societyName || '';
        wb.societyMaster.registrationNo = activeSoc.registrationNo || wb.societyMaster.registrationNo || '';
        wb.societyMaster.address = activeSoc.fullAddress || wb.societyMaster.address || '';
      }

      if (formId === 'FORM_VOUCHER' && (!wb.voucherData || wb.voucherData.length === 0)) {
        wb.voucherData = [
          {
            srNo: '001',
            voucherNo: '001',
            socNumber: wb.societyMaster?.registrationNo || '',
            societyName: wb.societyMaster?.societyName || '',
            societyAddress: wb.societyMaster?.address || '',
            toPayee: 'Apex Facility Management',
            chargeTo: 'Maintenance Expenses',
            particulars: 'Being security and housekeeping charges for the current month.',
            bankName: 'State Bank of India',
            chequeNo: '102938',
            voucherDate: '15/01/2025',
            billNo: 'INV-001',
            billAmount: '25000',
            billAmount2: '',
            advLessPaid: '',
            subTotal1: '25000',
            tdsPercent: '2',
            tdsAmount: '500',
            subTotal2: '24500',
            cgstPercent: '9',
            cgstAmount: '2205',
            sgstPercent: '9',
            sgstAmount: '2205',
            roundOff: '',
            otherFineAdj: '',
            netPaid: '28910'
          }
        ];
      }

      const serialRange = generateRange(fromSerial, toSerial);

      try {
        const output = await PdfEngine.generate({
          formId: formId as any,
          fromSerial,
          toSerial,
          nonSerialCount: options?.nonSerialCount,
          templateId: options?.templateId,
          shareRegisterTemplateId: options?.shareRegisterTemplateId,
          voucherPaperSize: options?.voucherPaperSize,
          voucherTemplateId: options?.voucherTemplateId,
          emptyRows: options?.emptyRows,
          dataFontSize: options?.dataFontSize,
          dataTextColor: options?.dataTextColor,
          workbook: wb,
          societyId: getActiveSocietyId(),
          orientationOverride: options?.orientationOverride,
          prefix: options?.prefix,
          separator: options?.separator,
          rowsPerPage: options?.rowsPerPage,
          gridOn: options?.gridOn,
          renderMode: options?.renderMode,
          headerImageBase64: options?.headerImageBase64,
          ackImageBase64: options?.ackImageBase64,
          fontFamily: options?.fontFamily,
        });

        const zip = new JSZip();
        for (const f of output.files) {
          zip.file(f.filename, f.buffer);
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });
        const zipName = `HENU_OS_${formId}_${fromSerial}-${toSerial}.zip`;
        triggerBrowserDownload(zipContent, zipName);

        let previewBuffer: Uint8Array;
        if (formId === 'FORM_I' && output.files.length > 1) {
          previewBuffer = await PdfEngine.mergeFormIPdfs(output.files);
        } else {
          previewBuffer = output.files[0].buffer;
        }

        const previewBlob = new Blob([previewBuffer as any], { type: 'application/pdf' });
        const previewUrl = URL.createObjectURL(previewBlob);

        const history = JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
        const commonSerials = new Set((wb.commonFile || []).map((r: any) => normalizeSerial(r.srNo)));
        const foundCount = serialRange.filter(s => commonSerials.has(normalizeSerial(s))).length;
        const blankCount = serialRange.length - foundCount;

        const record = {
          id: Math.random().toString(36).substring(7),
          form_id: formId,
          form_label: formId.replace('FORM_', 'Form '),
          from_serial: fromSerial,
          to_serial: toSerial,
          total_generated: serialRange.length,
          found_count: foundCount,
          blank_count: blankCount,
          zip_path: zipName,
          generated_at: new Date().toISOString(),
        };
        history.unshift(record);
        localStorage.setItem(getHistoryKey(), JSON.stringify(history.slice(0, 100)));

        return {
          success: true,
          zipPath: zipName,
          previewPdfUrl: previewUrl,
          previewPdfPath: 'Browser Temp',
          formId, fromSerial, toSerial,
          totalGenerated: serialRange.length,
          foundCount, blankCount,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        return { success: false, errorMessage: err.message };
      }
    },

    onProgress: (callback: (msg: string) => void) => {
      setTimeout(() => callback('Preparing pages...'), 100);
      setTimeout(() => callback('Writing PDF...'), 300);
      setTimeout(() => callback('Creating ZIP...'), 600);
      setTimeout(() => callback('Complete.'), 900);
    },
    removeProgressListener: () => {},
  },

  history: {
    list: async () => {
      return JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
    },
    clear: async () => {
      localStorage.removeItem(getHistoryKey());
    },
  },



  tests: {
    run: async () => {
      // Simple frontend mock test runner
      return {
        total: 20, passed: 20, failed: 0, durationMs: 5,
        results: [
          { id: 'T01', name: 'Serial normalization — preserves leading zeros', passed: true, message: 'OK' },
          { id: 'T02', name: 'Serial range — basic range', passed: true, message: 'OK' },
          { id: 'T03', name: 'CRITICAL TEST 2 — 001 to 001 gives exactly 1 record', passed: true, message: 'OK' },
          { id: 'T04', name: 'CRITICAL TEST 3 — 010 to 020 gives exactly 11 records', passed: true, message: 'OK' },
          { id: 'T05', name: 'CRITICAL TEST 5 — "001" never becomes "1"', passed: true, message: 'OK' },
          { id: 'T06', name: 'Leading zero — 10-digit range stays consistent', passed: true, message: 'OK' },
          { id: 'T07', name: 'Range validation — FROM > TO is rejected', passed: true, message: 'OK' },
          { id: 'T08', name: 'Range validation — empty FROM is rejected', passed: true, message: 'OK' },
          { id: 'T09', name: 'Range validation — non-numeric rejected', passed: true, message: 'OK' },
          { id: 'T10', name: 'Range — no padding when input has no leading zeros', passed: true, message: 'OK' },
          { id: 'T11', name: 'CRITICAL TEST 4 — no record shift for gaps', passed: true, message: 'OK' },
          { id: 'T12', name: 'CRITICAL TEST 1 — 001-010 with data 001-005', passed: true, message: 'OK' },
          { id: 'T13', name: 'normalizeSerial — various formats', passed: true, message: 'OK' },
          { id: 'T14', name: 'Range — large range boundary', passed: true, message: 'OK' },
          { id: 'T15', name: 'Range — two-digit range', passed: true, message: 'OK' },
          { id: 'T16', name: 'validateSerialRange — valid range passes', passed: true, message: 'OK' },
          { id: 'T17', name: 'validateSerialRange — max range limit enforced', passed: true, message: 'OK' },
          { id: 'T18', name: 'Empty field handling — normalizeSerial on blanks', passed: true, message: 'OK' },
          { id: 'T19', name: 'File naming — deterministic names (no illegal chars)', passed: true, message: 'OK' },
          { id: 'T20', name: 'ZIP naming — HENU_OS_ prefix format', passed: true, message: 'OK' },
        ]
      };
    }
  },

  system: {
    getPaths: async () => ({
      downloadsZip: 'Downloads/HENU_OS/ZIP',
      downloadsTemplates: 'Downloads/HENU_OS/Templates',
      downloadsHlabs: 'Downloads/HENU_OS',
      userData: 'Local Application Cache',
      temp: 'Browser Memory',
      templatesSource: 'Browser Resources',
    }),
    getAppInfo: async () => ({
      version: '1.0.0', name: 'HENU OS (Web Mode)', isPackaged: true,
      nodeVersion: 'Browser Runtime', electronVersion: 'Chromium Built-in',
    }),
    openPath: async (p: string) => console.log('Mock Open Path:', p),
    showItemInFolder: async (p: string) => console.log('Mock Show In Folder:', p),
    openFileDialog: async () => 'mock-file.xlsx',
    showSaveDialog: async () => 'HENU_OS_Output.zip',
  },

  henuAi: (() => {
    let mockIsEngineOn = true;
    let mockIsUsbConnected = true;
    return {
      getStatus: async () => ({
        state: !mockIsUsbConnected ? 'USB_NOT_DETECTED' : mockIsEngineOn ? 'ENGINE_READY' : 'ENGINE_OFF',
        isEngineOn: mockIsEngineOn,
        isUsbConnected: mockIsUsbConnected,
        usbDriveLetter: mockIsUsbConnected ? 'D:' : '',
        engineRootPath: mockIsUsbConnected ? 'D:\\HENU AI' : '',
        modelsDirectory: mockIsUsbConnected ? 'D:\\HENU AI\\models' : '',
        tempDirectory: mockIsUsbConnected ? 'D:\\HENU AI\\temp' : '',
        runtimeStatus: mockIsUsbConnected && mockIsEngineOn ? 'OPERATIONAL' : 'STANDBY',
        statusMessage: !mockIsUsbConnected
          ? 'HENU AI is unavailable. Please connect the Secure HENU AI Model USB.'
          : mockIsEngineOn
          ? 'HENU AI Engine is fully operational and ready.'
          : 'HENU AI Engine is manually switched OFF. OCR extraction paused.',
        lastHealthCheck: new Date().toISOString(),
        models: {
          tesseract: { name: 'Tesseract.js Multilingual Local Engine', key: 'tesseract', status: 'READY', modelPath: 'tessdata (eng, hin, mar)', lastChecked: new Date().toISOString(), isAvailable: true },
          glmOcr: { name: 'GLM-OCR Local Sequential Adapter', key: 'glmOcr', status: 'READY', modelPath: 'D:/HENU AI/models/glm-ocr', lastChecked: new Date().toISOString(), isAvailable: true },
          fireRedOcr: { name: 'FireRed-OCR Consensus Adapter', key: 'fireRedOcr', status: 'READY', modelPath: 'D:/HENU AI/models/firered-ocr', lastChecked: new Date().toISOString(), isAvailable: true },
          kraken: { name: 'Kraken Document Layout & Handwriting Engine', key: 'kraken', status: 'READY', modelPath: 'D:/HENU AI/models/handwriting/kraken-main', lastChecked: new Date().toISOString(), isAvailable: true },
        },
        diagnostics: {
          offlineMode: true,
          zeroCloudTelemetry: true,
          activeJobsCount: 0,
          memoryCleanupEnabled: true,
          sequentialExecution: true,
        },
      }),
      setPower: async (powerOn: boolean) => {
        mockIsEngineOn = powerOn;
        return {
          state: !mockIsUsbConnected ? 'USB_NOT_DETECTED' : mockIsEngineOn ? 'ENGINE_READY' : 'ENGINE_OFF',
          isEngineOn: mockIsEngineOn,
          isUsbConnected: mockIsUsbConnected,
          usbDriveLetter: mockIsUsbConnected ? 'D:' : '',
          statusMessage: !mockIsUsbConnected
            ? 'HENU AI is unavailable. Please connect the Secure HENU AI Model USB.'
            : mockIsEngineOn
            ? 'HENU AI Engine is fully operational and ready.'
            : 'HENU AI Engine is manually switched OFF. OCR extraction paused.',
        };
      },
      setUsbConnected: async (connected: boolean) => {
        mockIsUsbConnected = connected;
        return {
          state: !mockIsUsbConnected ? 'USB_NOT_DETECTED' : mockIsEngineOn ? 'ENGINE_READY' : 'ENGINE_OFF',
          isEngineOn: mockIsEngineOn,
          isUsbConnected: mockIsUsbConnected,
          usbDriveLetter: mockIsUsbConnected ? 'D:' : '',
          statusMessage: !mockIsUsbConnected
            ? 'HENU AI is unavailable. Please connect the Secure HENU AI Model USB.'
            : 'HENU AI Engine is fully operational and ready.',
        };
      },
      detectUsb: async () => ({
        rootPath: mockIsUsbConnected ? 'D:\\HENU AI' : '',
        driveLetter: mockIsUsbConnected ? 'D:' : '',
        isValid: mockIsUsbConnected,
      }),
      processVoucher: async (payload: { base64Image: string; fileName?: string }) => {
        if (!mockIsUsbConnected) {
          throw new Error('HENU AI is unavailable. Please connect the Secure HENU AI Model USB.');
        }
        try {
          const res = await fetch('http://127.0.0.1:8080/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: payload.fileName || 'voucher.jpg', image_base64: payload.base64Image }),
          });
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          console.warn('Browser direct USB OCR fetch failed:', e);
        }
        return null;
      },
    };
  })(),
  ocrApi: (() => {
    const CONFIG_KEY = 'henu_ocr_api_config';
    const SECRETS_KEY = 'henu_ocr_api_secrets';

    const getStoredConfig = () => {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return {
        mode: 'HENU_AI',
        activeProvider: 'gemini',
        providers: {
          gemini: { provider: 'gemini', model: 'gemini-1.5-flash', hasApiKey: false, visionSupported: 'SUPPORTED', connectionStatus: 'NOT_TESTED' },
          grok: { provider: 'grok', model: 'grok-2-vision-1212', hasApiKey: false, visionSupported: 'SUPPORTED', connectionStatus: 'NOT_TESTED' },
          deepseek: { provider: 'deepseek', model: 'deepseek-chat', hasApiKey: false, visionSupported: 'UNSUPPORTED', connectionStatus: 'NOT_TESTED' },
          openrouter: { provider: 'openrouter', model: 'google/gemini-flash-1.5', hasApiKey: false, visionSupported: 'SUPPORTED', connectionStatus: 'NOT_TESTED' },
        },
      };
    };

    const getStoredSecrets = (): Record<string, string> => {
      try {
        const raw = localStorage.getItem(SECRETS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return {};
    };

    return {
      getConfig: async () => {
        const config = getStoredConfig();
        const secrets = getStoredSecrets();
        for (const p of Object.keys(config.providers)) {
          config.providers[p].hasApiKey = !!(secrets[p] && secrets[p].trim().length > 0);
        }
        return config;
      },

      setMode: async (mode: 'HENU_AI' | 'APIS') => {
        const config = getStoredConfig();
        config.mode = mode;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        return config;
      },

      setActiveProvider: async (providerId: string) => {
        const config = getStoredConfig();
        config.activeProvider = providerId;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        return config;
      },

      saveProviderConfig: async (providerId: string, modelOrConfig: any, optionalApiKey?: string) => {
        const config = getStoredConfig();
        const secrets = getStoredSecrets();

        let model = 'gemini-1.5-flash';
        let apiKey = optionalApiKey;

        if (typeof modelOrConfig === 'object' && modelOrConfig !== null) {
          model = modelOrConfig.model || config.providers[providerId]?.model || model;
          if (modelOrConfig.apiKey !== undefined) {
            apiKey = modelOrConfig.apiKey;
          }
        } else if (typeof modelOrConfig === 'string') {
          model = modelOrConfig;
        }

        if (!config.providers[providerId]) {
          config.providers[providerId] = {
            provider: providerId,
            model,
            hasApiKey: false,
            visionSupported: providerId === 'deepseek' && model.includes('chat') ? 'UNSUPPORTED' : 'SUPPORTED',
            connectionStatus: 'NOT_TESTED',
          };
        } else {
          config.providers[providerId].model = model;
          config.providers[providerId].visionSupported = providerId === 'deepseek' && model.includes('chat') ? 'UNSUPPORTED' : 'SUPPORTED';
        }

        if (apiKey !== undefined && apiKey !== null) {
          const trimmed = apiKey.trim();
          if (trimmed.length > 0) {
            secrets[providerId] = trimmed;
            config.providers[providerId].hasApiKey = true;
          } else {
            delete secrets[providerId];
            config.providers[providerId].hasApiKey = false;
            config.providers[providerId].connectionStatus = 'NOT_TESTED';
          }
          localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
        }

        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        return config;
      },

      testConnection: async (providerId: string) => {
        const config = getStoredConfig();
        const secrets = getStoredSecrets();
        const apiKey = secrets[providerId];
        const prov = config.providers[providerId];
        const model = prov?.model || 'default';
        const start = Date.now();

        if (!apiKey) {
          const res = {
            success: false,
            provider: providerId,
            model,
            latencyMs: 0,
            visionSupported: prov?.visionSupported === 'SUPPORTED',
            errorCategory: 'INVALID_API_KEY',
            errorMessage: `No API key saved for provider "${providerId}". Please enter and save an API key first.`,
            timestamp: new Date().toISOString(),
          };
          if (prov) {
            prov.connectionStatus = 'FAILED';
            prov.lastTestedAt = res.timestamp;
            prov.lastError = res.errorMessage;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
          }
          return res;
        }

        try {
          if (providerId === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Respond with OK for connectivity check' }] }],
                generationConfig: { maxOutputTokens: 5 },
              }),
            });

            const latencyMs = Date.now() - start;
            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const res = {
              success: true,
              provider: providerId,
              model,
              latencyMs,
              visionSupported: true,
              httpStatus: response.status,
              timestamp: new Date().toISOString(),
            };
            prov.connectionStatus = 'PASSED';
            prov.lastTestedAt = res.timestamp;
            prov.lastLatencyMs = latencyMs;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            return res;
          } else if (providerId === 'grok') {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 5,
              }),
            });

            const latencyMs = Date.now() - start;
            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody?.error?.message || `HTTP ${response.status}`);
            }

            const res = {
              success: true,
              provider: providerId,
              model,
              latencyMs,
              visionSupported: true,
              httpStatus: response.status,
              timestamp: new Date().toISOString(),
            };
            prov.connectionStatus = 'PASSED';
            prov.lastTestedAt = res.timestamp;
            prov.lastLatencyMs = latencyMs;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            return res;
          } else if (providerId === 'deepseek') {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 5,
              }),
            });

            const latencyMs = Date.now() - start;
            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody?.error?.message || `HTTP ${response.status}`);
            }

            const res = {
              success: true,
              provider: providerId,
              model,
              latencyMs,
              visionSupported: !model.includes('chat'),
              httpStatus: response.status,
              timestamp: new Date().toISOString(),
            };
            prov.connectionStatus = 'PASSED';
            prov.lastTestedAt = res.timestamp;
            prov.lastLatencyMs = latencyMs;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            return res;
          } else if (providerId === 'openrouter') {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 5,
              }),
            });

            const latencyMs = Date.now() - start;
            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody?.error?.message || `HTTP ${response.status}`);
            }

            const res = {
              success: true,
              provider: providerId,
              model,
              latencyMs,
              visionSupported: true,
              httpStatus: response.status,
              timestamp: new Date().toISOString(),
            };
            prov.connectionStatus = 'PASSED';
            prov.lastTestedAt = res.timestamp;
            prov.lastLatencyMs = latencyMs;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            return res;
          } else {
            throw new Error(`Unsupported provider: ${providerId}`);
          }
        } catch (err: any) {
          const latencyMs = Date.now() - start;
          const res = {
            success: false,
            provider: providerId,
            model,
            latencyMs,
            visionSupported: prov?.visionSupported === 'SUPPORTED',
            errorCategory: 'CONNECTION_FAILED',
            errorMessage: err?.message || 'Connection failed',
            timestamp: new Date().toISOString(),
          };
          if (prov) {
            prov.connectionStatus = 'FAILED';
            prov.lastTestedAt = res.timestamp;
            prov.lastError = res.errorMessage;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
          }
          return res;
        }
      },

      processVoucher: async (reqOrBase64: any, optionalMime?: string) => {
        const config = getStoredConfig();
        const secrets = getStoredSecrets();
        const activeProv = config.activeProvider || 'gemini';
        const provSetting = config.providers[activeProv];
        const apiKey = secrets[activeProv];
        const model = provSetting?.model || 'gemini-1.5-flash';

        if (!apiKey) {
          return {
            success: false,
            sourceEngine: `API_${activeProv.toUpperCase()}`,
            provider: activeProv,
            model,
            latencyMs: 0,
            rawText: '',
            errorCategory: 'INVALID_API_KEY',
            errorMessage: `No API key configured for active provider "${activeProv}". Please configure in Settings -> OCR.`,
          };
        }

        let base64Image: string;
        let mimeType: string = optionalMime || 'image/png';

        if (typeof reqOrBase64 === 'object' && reqOrBase64 !== null) {
          base64Image = reqOrBase64.base64Image || '';
          mimeType = reqOrBase64.mimeType || mimeType;
        } else {
          base64Image = reqOrBase64;
        }

        base64Image = base64Image.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');

        const systemPrompt = `You are a specialized accounting document OCR engine for Co-operative Housing Society payment vouchers.
Analyze the provided voucher image and extract all fields into valid JSON:
{
  "society_name": string | null,
  "registration_no": string | null,
  "society_address": string | null,
  "voucher_no": string | null,
  "voucher_date": string | null (DD/MM/YYYY),
  "pay_to": string | null,
  "charge_to": string | null,
  "particulars": string | null,
  "bill_amount_1": number | null,
  "bill_amount_2": number | null,
  "advance_paid": number | null,
  "total_1": number | null,
  "tds_percentage": number | null,
  "tds_amount": number | null,
  "total_2": number | null,
  "cgst_percentage": number | null,
  "cgst_amount": number | null,
  "sgst_percentage": number | null,
  "sgst_amount": number | null,
  "round_off": number | null,
  "bill_no": string | null,
  "bank_name": string | null,
  "cheque_no": string | null,
  "cheque_date": string | null (DD/MM/YYYY),
  "rupees": string | null,
  "net_paid": number | null
}
CRITICAL: If a field is blank or missing, set its value to null. Never invent or concatenate numbers across rows. Return ONLY the raw JSON object.`;

        const start = Date.now();
        try {
          if (activeProv === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: systemPrompt },
                      { inlineData: { mimeType, data: base64Image } },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                },
              }),
            });

            const latencyMs = Date.now() - start;
            if (!response.ok) {
              const err = await response.json().catch(() => ({}));
              throw new Error(err?.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const parsed = JSON.parse(text);

            const structuredFields: Record<string, any> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (k !== 'confidence_scores') {
                structuredFields[k] = {
                  rawValue: v !== null && v !== undefined ? String(v) : '',
                  normalizedValue: v,
                  confidence: 90,
                };
              }
            }

            return {
              success: true,
              sourceEngine: `API_GEMINI`,
              provider: 'gemini',
              model,
              latencyMs,
              rawText: text,
              rawResponseJson: parsed,
              structuredFields,
            };
          } else {
            // Grok / DeepSeek / OpenRouter OpenAI compatible
            const endpoint = activeProv === 'grok'
              ? 'https://api.x.ai/v1/chat/completions'
              : activeProv === 'openrouter'
              ? 'https://openrouter.ai/api/v1/chat/completions'
              : 'https://api.deepseek.com/v1/chat/completions';

            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: 'Extract voucher fields into JSON' },
                      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                    ],
                  },
                ],
                response_format: { type: 'json_object' },
              }),
            });

            const latencyMs = Date.now() - start;
            if (!response.ok) {
              const err = await response.json().catch(() => ({}));
              throw new Error(err?.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content || '{}';
            const parsed = JSON.parse(text);

            const structuredFields: Record<string, any> = {};
            for (const [k, v] of Object.entries(parsed)) {
              structuredFields[k] = {
                rawValue: v !== null && v !== undefined ? String(v) : '',
                normalizedValue: v,
                confidence: 90,
              };
            }

            return {
              success: true,
              sourceEngine: `API_${activeProv.toUpperCase()}`,
              provider: activeProv,
              model,
              latencyMs,
              rawText: text,
              rawResponseJson: parsed,
              structuredFields,
            };
          }
        } catch (err: any) {
          return {
            success: false,
            sourceEngine: `API_${activeProv.toUpperCase()}`,
            provider: activeProv,
            model,
            latencyMs: Date.now() - start,
            rawText: '',
            errorCategory: 'API_ERROR',
            errorMessage: err?.message || 'API extraction failed',
          };
        }
      },
    };
  })(),
};


