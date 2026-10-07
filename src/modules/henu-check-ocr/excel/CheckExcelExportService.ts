/**
 * HENU CHECK OCR — EXCEL XLSX & CANONICAL JSON EXPORT SERVICE
 * Module: Henu Check OCR
 * 
 * Generates publication-grade XLSX workbooks and JSON records:
 * - Fixed canonical schema (1 cheque = 1 row)
 * - Professional styling, frozen headers, and tailored column widths
 * - Multi-sheet: 'Cheque Data', 'Banking Validation', and 'Evidence & Diagnostics'
 * - Preserves UTF-8 Unicode (English, Hindi, Marathi)
 */

import ExcelJS from 'exceljs';
import { CheckProcessingRecord, HenuCheckData } from '../schema/types';
import { HENU_CHECK_FIELDS } from '../schema/checkSchema';

export class CheckExcelExportService {
  /**
   * Generates a binary Excel (.xlsx) file buffer from an array of cheque records
   */
  public static async generateWorkbook(records: CheckProcessingRecord[]): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HENU OS Check OCR';
    workbook.lastModifiedBy = 'HENU OS Check OCR';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ── SHEET 1: Cheque Data ──
    const dataSheet = workbook.addWorksheet('Cheque Data', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF7C3AED' } },
    });

    // 1. Define Columns from Schema
    dataSheet.columns = HENU_CHECK_FIELDS.map(f => ({
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
      for (const f of HENU_CHECK_FIELDS) {
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
        const fieldMeta = HENU_CHECK_FIELDS[colNumber - 1];

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
          } else if (fieldMeta.format === 'date') {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (fieldMeta.key === 'cheque_no' || fieldMeta.key === 'micr_code' || fieldMeta.key === 'account_no') {
            // Keep string format for identifier numbers
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        }
      });
    });

    // ── SHEET 2: Banking Validation ──
    const validationSheet = workbook.addWorksheet('Banking Validation', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF3B82F6' } },
    });

    validationSheet.columns = [
      { header: 'Cheque No', key: 'chequeNo', width: 16 },
      { header: 'Bank Name', key: 'bank', width: 24 },
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Payee Name', key: 'payee', width: 28 },
      { header: 'Amount in Figure (₹)', key: 'amountFig', width: 20 },
      { header: 'Rupees in Words', key: 'rupeesWords', width: 34 },
      { header: 'A/c No.', key: 'acNo', width: 22 },
      { header: 'MICR Code', key: 'micr', width: 26 },
      { header: 'Validation Status', key: 'status', width: 20 },
    ];

    const valHeader = validationSheet.getRow(1);
    valHeader.height = 26;
    valHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    records.forEach((rec) => {
      const hasErrors = rec.validationIssues.some(i => i.severity === 'error');
      const row = validationSheet.addRow({
        chequeNo: rec.fields.cheque_no?.normalizedValue || 'N/A',
        bank: rec.fields.bank?.normalizedValue || '',
        date: rec.fields.date?.normalizedValue || '',
        payee: rec.fields.payee_name?.normalizedValue || '',
        amountFig: rec.fields.amount_in_figure?.normalizedValue ?? '',
        rupeesWords: rec.fields.rupees_in_words?.normalizedValue || '',
        acNo: rec.fields.account_no?.normalizedValue || '',
        micr: rec.fields.micr_code?.normalizedValue || '',
        status: rec.isChequePage === false ? 'NON-CHEQUE' : (hasErrors ? 'REVIEW REQUIRED' : 'VALIDATED'),
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
      { header: 'Cheque No', key: 'chequeNo', width: 16 },
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
      const chqNo = rec.fields.cheque_no?.normalizedValue || 'N/A';
      for (const meta of HENU_CHECK_FIELDS) {
        const fData = rec.fields[meta.key];
        const row = evidenceSheet.addRow({
          chequeNo: chqNo,
          fieldKey: meta.key,
          fieldLabel: meta.label,
          rawOcr: fData?.rawValue || '(blank)',
          normalized: fData?.normalizedValue !== null && fData?.normalizedValue !== undefined ? String(fData.normalizedValue) : '(null)',
          confidence: `${fData?.confidence || 0}%`,
          status: fData?.validationStatus?.toUpperCase() || 'NOT_DETECTED',
          engine: rec.sourceEngine || 'HENU OCR Engine',
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
   * Generates canonical JSON export
   */
  public static generateCanonicalJson(records: CheckProcessingRecord[]): string {
    const payload = {
      system: 'HENU Check OCR',
      module: 'BANK CHEQUE OCR AND VERIFICATION',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalRecords: records.length,
      cheques: records.map((rec) => {
        const canonicalData: Record<string, any> = {};
        for (const f of HENU_CHECK_FIELDS) {
          canonicalData[f.key] = rec.fields[f.key]?.normalizedValue ?? null;
        }
        return {
          id: rec.id,
          sourceFile: rec.sourceFile,
          sourcePage: rec.sourcePage,
          totalPages: rec.totalPages,
          isChequePage: rec.isChequePage ?? true,
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
              evidence: v.evidence,
            };
            return acc;
          }, {}),
          validationIssues: rec.validationIssues,
          correctionHistory: rec.correctionHistory || [],
          processedAt: rec.processedAt,
        };
      }),
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Helper to trigger browser file download of the XLSX
   */
  public static downloadXlsx(buffer: ArrayBuffer, fileName: string = 'Henu_Cheques_Extracted.xlsx'): void {
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
  public static downloadJson(jsonString: string, fileName: string = 'Henu_Cheques_Export.json'): void {
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
