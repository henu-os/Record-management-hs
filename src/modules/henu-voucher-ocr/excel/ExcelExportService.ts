/**
 * HENU VOUCHER OCR — EXCEL XLSX EXPORT SERVICE
 * Module: Henu Voucher OCR
 * 
 * Generates publication-grade XLSX files:
 * - Fixed canonical schema (1 voucher = 1 row)
 * - Professional styling, frozen header, and tailored column widths
 * - Multi-sheet: 'Voucher Data' and 'Processing Summary'
 * - Preserves UTF-8 Unicode (English, Hindi, Marathi)
 */

import ExcelJS from 'exceljs';
import { VoucherProcessingRecord, HenuVoucherData } from '../schema/types';
import { HENU_VOUCHER_FIELDS } from '../schema/voucherSchema';

export class ExcelExportService {
  /**
   * Generates a binary Excel (.xlsx) file buffer from an array of voucher records
   */
  public static async generateWorkbook(records: VoucherProcessingRecord[]): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HENU OS Voucher OCR';
    workbook.lastModifiedBy = 'HENU OS Voucher OCR';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ── SHEET 1: Voucher Data ──
    const dataSheet = workbook.addWorksheet('Voucher Data', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF7C3AED' } },
    });

    // 1. Define Columns from Schema
    dataSheet.columns = HENU_VOUCHER_FIELDS.map(f => ({
      header: f.excelColumn,
      key: f.key,
      width: f.excelWidth,
    }));

    // 2. Style Header Row
    const headerRow = dataSheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Dark slate
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF475569' } },
        bottom: { style: 'medium', color: { argb: 'FF7C3AED' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF475569' } },
      };
    });

    // 3. Populate Rows
    records.forEach((rec, idx) => {
      const rowData: { [key: string]: any } = {};
      for (const f of HENU_VOUCHER_FIELDS) {
        let val = rec.fields[f.key]?.normalizedValue;
        if (f.dataType === 'date' && val) {
          const str = String(val).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-');
            val = `${d}/${m}/${y}`;
          } else if (/^\d{8}$/.test(str)) {
            val = `${str.substring(0, 2)}/${str.substring(2, 4)}/${str.substring(4, 8)}`;
          }
        }
        rowData[f.key] = val !== null && val !== undefined ? val : '';
      }

      const row = dataSheet.addRow(rowData);
      row.height = 22;

      const isEven = idx % 2 === 0;
      row.eachCell((cell, colNumber) => {
        const fieldMeta = HENU_VOUCHER_FIELDS[colNumber - 1];

        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: 'FF0F172A' },
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
        };

        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (fieldMeta) {
          if (fieldMeta.format === 'currency') {
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (fieldMeta.format === 'percentage') {
            cell.numFmt = '0.00"%"';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (fieldMeta.format === 'date') {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        }
      });
    });

    // ── SHEET 2: Accounting Validation ──
    const validationSheet = workbook.addWorksheet('Accounting Validation', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF3B82F6' } },
    });

    validationSheet.columns = [
      { header: 'Voucher No', key: 'voucherNo', width: 16 },
      { header: 'Bill Amount 1', key: 'bill1', width: 16 },
      { header: 'Bill Amount 2', key: 'bill2', width: 16 },
      { header: 'Advance / Paid', key: 'adv', width: 16 },
      { header: 'Total 1', key: 'tot1', width: 16 },
      { header: 'TDS %', key: 'tdsPct', width: 12 },
      { header: 'TDS Amount', key: 'tdsAmt', width: 16 },
      { header: 'Total 2', key: 'tot2', width: 16 },
      { header: 'CGST %', key: 'cgstPct', width: 12 },
      { header: 'CGST Amount', key: 'cgstAmt', width: 16 },
      { header: 'SGST %', key: 'sgstPct', width: 12 },
      { header: 'SGST Amount', key: 'sgstAmt', width: 16 },
      { header: 'Round Off', key: 'roundOff', width: 14 },
      { header: 'Net Paid Observed', key: 'netObserved', width: 18 },
      { header: 'Net Paid Calculated', key: 'netCalculated', width: 18 },
      { header: 'Validation Status', key: 'validationStatus', width: 20 },
    ];

    const valHeader = validationSheet.getRow(1);
    valHeader.height = 26;
    valHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    records.forEach((rec) => {
      const b1 = (rec.fields.bill_amount_1?.normalizedValue as number) || 0;
      const b2 = (rec.fields.bill_amount_2?.normalizedValue as number) || 0;
      const adv = (rec.fields.advance_paid?.normalizedValue as number) || 0;
      const tot1 = rec.fields.total_1?.normalizedValue as number | null;
      const tdsAmt = rec.fields.tds_amount?.normalizedValue as number | null;
      const tot2 = rec.fields.total_2?.normalizedValue as number | null;
      const cAmt = (rec.fields.cgst_amount?.normalizedValue as number) || 0;
      const sAmt = (rec.fields.sgst_amount?.normalizedValue as number) || 0;
      const round = (rec.fields.round_off?.normalizedValue as number) || 0;
      const netObs = rec.fields.net_paid?.normalizedValue as number | null;

      const calcNet = tot2 !== null ? tot2 + cAmt + sAmt + round : (tot1 !== null && tdsAmt !== null ? tot1 - tdsAmt + cAmt + sAmt + round : null);
      const isMathValid = rec.validationIssues.filter(i => i.severity === 'error').length === 0;

      const row = validationSheet.addRow({
        voucherNo: rec.fields.voucher_no?.normalizedValue || 'N/A',
        bill1: rec.fields.bill_amount_1?.normalizedValue ?? '',
        bill2: rec.fields.bill_amount_2?.normalizedValue ?? '',
        adv: rec.fields.advance_paid?.normalizedValue ?? '',
        tot1: rec.fields.total_1?.normalizedValue ?? '',
        tdsPct: rec.fields.tds_percentage?.normalizedValue ? `${rec.fields.tds_percentage.normalizedValue}%` : '',
        tdsAmt: rec.fields.tds_amount?.normalizedValue ?? '',
        tot2: rec.fields.total_2?.normalizedValue ?? '',
        cgstPct: rec.fields.cgst_percentage?.normalizedValue ? `${rec.fields.cgst_percentage.normalizedValue}%` : '',
        cgstAmt: rec.fields.cgst_amount?.normalizedValue ?? '',
        sgstPct: rec.fields.sgst_percentage?.normalizedValue ? `${rec.fields.sgst_percentage.normalizedValue}%` : '',
        sgstAmt: rec.fields.sgst_amount?.normalizedValue ?? '',
        roundOff: rec.fields.round_off?.normalizedValue ?? '',
        netObserved: netObs ?? '',
        netCalculated: calcNet !== null ? calcNet : 'N/A',
        validationStatus: isMathValid ? 'VALIDATED' : 'REVIEW REQUIRED',
      });

      row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    });

    // ── SHEET 3: Evidence & Diagnostics ──
    const evidenceSheet = workbook.addWorksheet('Evidence & Diagnostics', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF10B981' } },
    });

    evidenceSheet.columns = [
      { header: 'Voucher No', key: 'voucherNo', width: 16 },
      { header: 'Field Key', key: 'fieldKey', width: 22 },
      { header: 'Field Label', key: 'fieldLabel', width: 24 },
      { header: 'Raw OCR Text', key: 'rawOcr', width: 32 },
      { header: 'Normalized Value', key: 'normalized', width: 32 },
      { header: 'Confidence (%)', key: 'confidence', width: 16 },
      { header: 'Validation Status', key: 'status', width: 18 },
      { header: 'Source Engine', key: 'engine', width: 20 },
    ];

    const evHeader = evidenceSheet.getRow(1);
    evHeader.height = 26;
    evHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    records.forEach((rec) => {
      const vNo = rec.fields.voucher_no?.normalizedValue || 'N/A';
      for (const meta of HENU_VOUCHER_FIELDS) {
        const fData = rec.fields[meta.key];
        const row = evidenceSheet.addRow({
          voucherNo: vNo,
          fieldKey: meta.key,
          fieldLabel: meta.label,
          rawOcr: fData?.rawValue || '(blank)',
          normalized: fData?.normalizedValue !== null && fData?.normalizedValue !== undefined ? String(fData.normalizedValue) : '(null)',
          confidence: `${fData?.confidence || 0}%`,
          status: fData?.validationStatus?.toUpperCase() || 'NOT_DETECTED',
          engine: 'HENU AI USB OCR',
        });
        row.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
      }
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Generates a canonical JSON representation of extracted vouchers
   */
  public static generateCanonicalJson(records: VoucherProcessingRecord[]): string {
    const payload = {
      system: 'HENU Voucher OCR',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalRecords: records.length,
      vouchers: records.map(rec => {
        const canonicalData: Record<string, any> = {};
        for (const f of HENU_VOUCHER_FIELDS) {
          canonicalData[f.key] = rec.fields[f.key]?.normalizedValue ?? null;
        }
        return {
          id: rec.id,
          sourceFile: rec.sourceFile,
          sourcePage: rec.sourcePage,
          totalPages: rec.totalPages,
          overallConfidence: rec.overallConfidence,
          reviewRequired: rec.reviewRequired,
          approvalStatus: rec.approvalInfo?.status || (rec.reviewRequired ? 'pending_review' : 'approved'),
          fields: canonicalData,
          fieldEvidence: Object.entries(rec.fields).reduce((acc: any, [k, v]) => {
            acc[k] = {
              rawValue: v.rawValue,
              confidence: v.confidence,
              validationStatus: v.validationStatus,
              isUserEdited: !!v.isUserEdited,
            };
            return acc;
          }, {}),
          validationIssues: rec.validationIssues,
          correctionHistory: rec.correctionHistory || [],
          auditTrail: rec.auditTrail || [],
          processedAt: rec.processedAt,
        };
      }),
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Helper to trigger a browser file download of the XLSX
   */
  public static downloadXlsx(buffer: ArrayBuffer, fileName: string = 'Henu_Vouchers_Extracted.xlsx'): void {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper to download canonical JSON
   */
  public static downloadJson(jsonString: string, fileName: string = 'Henu_Vouchers_Export.json'): void {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

