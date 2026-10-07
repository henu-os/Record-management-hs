// ============================================================
// PdfEngine — Orchestrator for Native PDF Document Renderers
// Pure programmatic document rendering engine.
// NEVER uses HTML-to-PDF or background PDF template files.
// ============================================================

import { PDFDocument } from 'pdf-lib';
import {
  FormId,
  MasterWorkbook,
  CommonFileRecord,
  FormIRecord,
  FormJRecord,
  ShareRecord,
  NominationRecord,
  PropertyRecord,
  BankLineMarkRecord,
  VoucherRecord,
  ShareCertificateTemplateId,
} from '../types';
import { generateRange, normalizeSerial, normalizeSerialKey } from './SerialRangeEngine';
import { FormMappingService } from './FormMappingService';
import { FormDesignSettingsService } from './FormDesignSettingsService';
import { FormDesignSettings } from '../types';
import { FormIRenderer } from './renderers/FormIRenderer';
import { FormJRenderer } from './renderers/FormJRenderer';
import { ShareRegisterRenderer } from './renderers/ShareRegisterRenderer';
import { NominationRegisterRenderer } from './renderers/NominationRegisterRenderer';
import { PropertyRegisterRenderer } from './renderers/PropertyRegisterRenderer';
import { LienMarkRenderer } from './renderers/LienMarkRenderer';
import { ShareCertificateRenderer } from './renderers/ShareCertificateRenderer';
import { VoucherRenderer } from './renderers/VoucherRenderer';

export interface PdfGenerationOptions {
  formId: FormId;
  fromSerial: string;
  toSerial: string;
  nonSerialCount?: number;
  workbook: MasterWorkbook;
  societyId?: string;
  orientationOverride?: 'Portrait' | 'Landscape';
  rowsPerPage?: number;
  renderMode?: 'Color' | 'BW';
  gridOn?: boolean;
  consolidatePdf?: boolean;
  prefix?: string;
  separator?: string;
  templateId?: ShareCertificateTemplateId;
  shareRegisterTemplateId?: '15_COLUMN' | '19_COLUMN';
  voucherPaperSize?: 'LEGAL' | 'A4' | string;
  voucherTemplateId?: 'TEMPLATE_1' | 'TEMPLATE_2' | string;
  emptyRows?: number;
  dataFontSize?: number;
  dataTextColor?: string;
  headerImageBase64?: string;
  ackImageBase64?: string;
  fontFamily?: string;
  settings?: Partial<FormDesignSettings>;
  onProgress?: (message: string) => void;
}

export interface PdfGenerationOutput {
  files: { filename: string; buffer: Buffer }[];
  isSingleZip: boolean;
}

export class PdfEngine {
  /**
   * Generates all PDFs natively for the given form and serial range.
   * Dispatches directly to the six native form renderers.
   */
  static async generate(opts: PdfGenerationOptions): Promise<PdfGenerationOutput> {
    const {
      formId, fromSerial, toSerial, nonSerialCount = 0, templateId, workbook, societyId, orientationOverride,
      rowsPerPage, renderMode, gridOn, consolidatePdf, prefix, separator, settings: settingsOverride, onProgress,
      headerImageBase64, ackImageBase64
    } = opts;

    const savedSettings = FormDesignSettingsService.getResolvedSettings(formId, societyId);
    const settings = settingsOverride
      ? FormDesignSettingsService.clampSettings({ ...savedSettings, ...settingsOverride })
      : savedSettings;

    // Apply overrides if passed explicitly
    if (renderMode !== undefined) {
      settings.colorMode = renderMode;
    }
    if (rowsPerPage !== undefined) {
      settings.rowsPerPage = rowsPerPage;
    }
    if (gridOn !== undefined) {
      settings.gridOn = gridOn;
    }
    if (opts.fontFamily !== undefined) {
      settings.fontFamily = opts.fontFamily as any;
    }

    onProgress?.('Building serial range...');
    const serialRange = (fromSerial || toSerial) ? generateRange(fromSerial, toSerial, true) : [];

    // Build data lookups for efficient retrieval
    const commonMap = new Map<string, CommonFileRecord>();
    for (const c of workbook.commonFile) {
      if (c.srNo) commonMap.set(normalizeSerialKey(c.srNo), c);
    }

    let specificMap = new Map<string, any>();
    switch (formId) {
      case 'FORM_I':
        for (const r of workbook.formIData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        break;
      case 'FORM_J':
        for (const r of workbook.formJData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        break;
      case 'FORM_SHARE':
        for (const r of workbook.shareData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        break;
      case 'FORM_NOM':
        for (const r of workbook.nominationData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        break;
      case 'FORM_PROP':
        for (const r of workbook.propertyData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        break;
      case 'FORM_BANK':
        for (const r of workbook.bankLineMarkData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        break;
      case 'FORM_SHARE_CERT':
        if ((workbook as any).shareCertData) {
          for (const r of (workbook as any).shareCertData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        } else if (workbook.shareData) {
          for (const r of workbook.shareData) if (r.srNo) specificMap.set(normalizeSerialKey(r.srNo), r);
        }
        break;
    }

    // Resolve items array (missing serials produce null record, returning serial-only row)
    const pfx = prefix ? prefix.trim() : '';
    const sep = separator || '-';

    const serialItems = serialRange.map(rawSerial => {
      const key = normalizeSerialKey(rawSerial);
      const common = commonMap.get(key);
      const specific = specificMap.get(key);
      const resolved = FormMappingService.resolveRecord(workbook, formId, rawSerial);
      const isFound = Boolean(common || specific);
      const record = isFound ? resolved : null;

      // Format serial display if prefix is present
      const displaySerial = pfx ? `${pfx}${sep}${rawSerial}` : rawSerial;
      return { serial: displaySerial, record, isNonSerial: false, rawSerial };
    });

    const extraCount = Math.max(0, Number(nonSerialCount) || 0);
    const nonSerialItems = [];
    for (let i = 0; i < extraCount; i++) {
      nonSerialItems.push({ serial: '', record: null, isNonSerial: true, rawSerial: '' });
    }

    const items = [...serialItems, ...nonSerialItems];

    onProgress?.(`Rendering ${formId} document...`);
    const filePrefixMap: Record<FormId, string> = {
      FORM_I: 'FORM_I',
      FORM_J: 'FORM_J',
      FORM_SHARE: 'SHARE_REGISTER',
      FORM_NOM: 'NOMINATION_REGISTER',
      FORM_PROP: 'PROPERTY_REGISTER',
      FORM_BANK: 'BANK_LINE_MARK',
      FORM_SHARE_CERT: 'SHARE_CERTIFICATE_13X19',
      FORM_VOUCHER: 'PAYMENT_VOUCHER_A4',
    };

    const basePrefix = filePrefixMap[formId] || formId;

    switch (formId) {
      case 'FORM_I': {
        const buffers = await FormIRenderer.render(items, workbook.societyMaster, { orientationOverride, settings, renderMode, gridOn });
        let blankCounter = 1;
        const files = buffers.map((buf, idx) => {
          const item = items[idx];
          if (item?.isNonSerial) {
            return {
              filename: `BLANK_EXTRA_${blankCounter++}.pdf`,
              buffer: buf,
            };
          }
          const rawSr = item?.rawSerial || item?.serial || String(idx + 1);
          const srPadded = normalizeSerial(rawSr);
          const fullSr = pfx ? `${pfx}${sep}${srPadded}` : srPadded;
          return {
            filename: `${basePrefix}_${fullSr}.pdf`,
            buffer: buf,
          };
        });
        return { files, isSingleZip: false };
      }

      case 'FORM_J': {
        const buffer = await FormJRenderer.render(items, workbook.societyMaster, {
          orientationOverride,
          rowsPerPage,
          settings,
          renderMode,
          gridOn,
          templateId: opts.templateId,
          emptyRows: opts.emptyRows,
          dataFontSize: opts.dataFontSize,
          dataTextColor: opts.dataTextColor,
        });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial}-${toSerial}` : `${fromSerial}-${toSerial}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      case 'FORM_SHARE': {
        const buffer = await ShareRegisterRenderer.render(items, workbook.societyMaster, {
          orientationOverride,
          settings,
          renderMode,
          gridOn,
          templateId: opts.shareRegisterTemplateId,
          emptyRows: opts.emptyRows,
          dataFontSize: opts.dataFontSize,
          dataTextColor: opts.dataTextColor,
        });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial}-${toSerial}` : `${fromSerial}-${toSerial}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      case 'FORM_NOM': {
        const buffer = await NominationRegisterRenderer.render(items, workbook.societyMaster, {
          orientationOverride,
          settings,
          renderMode,
          gridOn,
          templateId: opts.templateId,
          emptyRows: opts.emptyRows,
          dataFontSize: opts.dataFontSize,
          dataTextColor: opts.dataTextColor,
        });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial}-${toSerial}` : `${fromSerial}-${toSerial}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      case 'FORM_PROP': {
        const buffer = await PropertyRegisterRenderer.render(items, workbook.societyMaster, {
          orientationOverride,
          settings,
          renderMode,
          gridOn,
          templateId: opts.templateId,
          emptyRows: opts.emptyRows,
          dataFontSize: opts.dataFontSize,
          dataTextColor: opts.dataTextColor,
        });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial}-${toSerial}` : `${fromSerial}-${toSerial}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      case 'FORM_BANK': {
        const buffer = await LienMarkRenderer.render(items, workbook.societyMaster, { orientationOverride, settings, renderMode, gridOn });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial}-${toSerial}` : `${fromSerial}-${toSerial}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      case 'FORM_SHARE_CERT': {
        const buffer = await ShareCertificateRenderer.render(items, workbook.societyMaster, {
          orientationOverride,
          templateId,
          settings,
          renderMode,
          gridOn,
          headerImageBase64,
          ackImageBase64,
          fontFamily: opts.fontFamily || settings?.fontFamily,
        });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial}-${toSerial}` : `${fromSerial}-${toSerial}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      case 'FORM_VOUCHER': {
        const rawVouchers = workbook.voucherData || [];

        let vouchers: VoucherRecord[] = [];
        if (serialRange.length > 0) {
          const usedRecordIndices = new Set<number>();
          vouchers = serialRange.map((rawSerial, idx) => {
            const key = normalizeSerialKey(rawSerial);
            let foundIndex = -1;

            // 1. Try exact match by key on voucherNo or srNo
            for (let i = 0; i < rawVouchers.length; i++) {
              if (usedRecordIndices.has(i)) continue;
              const v = rawVouchers[i];
              const vNum = v.voucherNo || v.srNo;
              if (vNum && normalizeSerialKey(vNum) === key) {
                foundIndex = i;
                break;
              }
            }

            // 2. Fallback to sequential index if not already used
            if (foundIndex === -1 && rawVouchers[idx] && !usedRecordIndices.has(idx)) {
              foundIndex = idx;
            }

            // 3. Fallback to next available unused record in rawVouchers
            if (foundIndex === -1) {
              for (let i = 0; i < rawVouchers.length; i++) {
                if (!usedRecordIndices.has(i)) {
                  foundIndex = i;
                  break;
                }
              }
            }

            const displayVoucherNo = pfx ? `${pfx}${sep}${rawSerial}` : rawSerial;
            if (foundIndex !== -1) {
              usedRecordIndices.add(foundIndex);
              return { ...rawVouchers[foundIndex], voucherNo: displayVoucherNo };
            }
            return {
              voucherNo: displayVoucherNo,
              toPayee: '',
              chargeTo: '',
              particulars: '',
              bankName: '',
              chequeNo: '',
              voucherDate: '',
              billAmount: '',
              advLessPaid: '',
              subTotal1: '',
              tdsPercent: '',
              tdsAmount: '',
              subTotal2: '',
              cgstPercent: '',
              cgstAmount: '',
              roundOff: '',
              netPaid: '',
            };
          });
        } else if (rawVouchers.length > 0) {
          vouchers = rawVouchers;
        }

        const extraCount = Math.max(0, Number(nonSerialCount) || 0);
        for (let i = 0; i < extraCount; i++) {
          vouchers.push({
            voucherNo: '',
            toPayee: '',
            chargeTo: '',
            particulars: '',
            bankName: '',
            chequeNo: '',
            voucherDate: '',
            billAmount: '',
            advLessPaid: '',
            subTotal1: '',
            tdsPercent: '',
            tdsAmount: '',
            subTotal2: '',
            cgstPercent: '',
            cgstAmount: '',
            roundOff: '',
            netPaid: '',
          });
        }

        const buffer = await VoucherRenderer.render(vouchers, workbook.societyMaster, {
          settings,
          renderMode,
          templateId: opts.voucherTemplateId || templateId || 'TEMPLATE_1',
          paperSize: 'A4',
          logoBase64: headerImageBase64 || workbook.societyMaster?.logoBase64,
          fontFamily: opts.fontFamily || settings?.fontFamily,
        });
        const rangeStr = pfx ? `${pfx}${sep}${fromSerial || '1'}-${toSerial || vouchers.length}` : `${fromSerial || '1'}-${toSerial || vouchers.length}`;
        const filename = `${basePrefix}_${rangeStr}.pdf`;
        return { files: [{ filename, buffer }], isSingleZip: true };
      }

      default:
        throw new Error(`Unsupported form renderer: ${formId}`);
    }
  }

  /**
   * Merges multiple individual PDFs (Form I) into a single multi-page PDF for preview.
   */
  static async mergeFormIPdfs(files: { filename: string; buffer: Buffer }[]): Promise<Buffer> {
    const mergedDoc = await PDFDocument.create();
    for (const f of files) {
      const srcDoc = await PDFDocument.load(f.buffer);
      const indices = srcDoc.getPageIndices();
      const pages = await mergedDoc.copyPages(srcDoc, indices);
      for (const p of pages) mergedDoc.addPage(p);
    }
    const bytes = await mergedDoc.save();
    return typeof Buffer !== 'undefined' ? Buffer.from(bytes) : (bytes as any);
  }

}
