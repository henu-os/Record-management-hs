// ============================================================
// HENU OS — Form I Renderer (Portrait, Legal Paper)
// Excel Authority: "Form I - Portrait" sheet
// Card-style form with label-value fields + two data tables
// ============================================================

import { FormIRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { PdfDocumentBuilder, ColumnDef, HeaderGroupDef, CellDef } from './PdfDocumentBuilder';
import { FormIDefinition } from './definitions/FormIDefinition';
import { FormMappingService } from '../FormMappingService';

export class FormIRenderer {
  static async render(
    records: { serial: string; record: FormIRecord | null }[],
    society: SocietyMaster | null,
    options?: { orientationOverride?: 'Portrait' | 'Landscape'; settings?: FormDesignSettings; renderMode?: 'Color' | 'BW'; gridOn?: boolean; paperSize?: 'LEGAL' | 'FOOLSCAP' | string } | 'Portrait' | 'Landscape',
    settingsParam?: FormDesignSettings
  ): Promise<Buffer[]> {
    const def = FormIDefinition;
    const orientationOverride = typeof options === 'string' ? options : options?.orientationOverride;
    const settings = typeof options === 'object' ? options?.settings : settingsParam;
    const renderMode = typeof options === 'object' ? options?.renderMode : undefined;
    const gridOn = typeof options === 'object' ? options?.gridOn : undefined;
    const paperSize = typeof options === 'object' ? (options?.paperSize || (options?.settings as any)?.paperSize) : undefined;
    const isFoolscap = String(paperSize || '').toUpperCase().includes('FOOLSCAP');
    const outputs: Buffer[] = [];

    for (const item of records) {
      const builder = await PdfDocumentBuilder.create({
        orientation: orientationOverride || def.orientation,
        title: def.title,
        society,
        settings,
        renderMode,
        gridOn,
        paperSize: isFoolscap ? 'FOOLSCAP' : 'LEGAL',
      });

      const rec = item.record;
      const serial = item.serial;
      const cw = builder.contentWidth;

      // ── Header Block (Matches 5-Row Approved Society Header) ──
      builder.drawFormIHeader();

      const halfW = Math.floor(cw / 2);
      // Increased label width (from 0.20 to 0.26) for comfortable fit of 1. Serial Number, 4. Full Name, 6. Occupation, 8. Nominee, 9. Address, 12. Cessation
      const w1 = Math.floor(cw * 0.26);
      const w3 = Math.floor((cw - halfW) * 0.58);

      // ── Row 1: Fields 1, 2, 3 (Aligned to Column 1, Column 2, Column 3) ──
      builder.drawStackedFields([
        { label: '1. Serial Number', value: serial, width: w1 },
        { label: '2. Date of admission', value: rec?.dateOfAdmission || '', width: halfW - w1 },
        { label: '3. Date of Payment of entrance fee', value: rec?.dateOfEntranceFee || '', width: cw - halfW },
      ], 16, 24);

      // ── Row 2: Field 4 (Full Name - Expanded vertical height for comfortable name display) ──
      const memberName = FormMappingService.formatAllMemberNames(rec);
      builder.drawFormField('4. Full Name', memberName, w1, cw - w1, 36);

      // ── Row 3: Field 5 & 6 (Residential & Permanent Address 50/50 Split Stacked, 6-line space) ──
      const resAddress = FormMappingService.formatResidentialAddress(rec, society);
      const permAddress = FormMappingService.formatPermanentAddress(rec, society);

      builder.drawStackedFields([
        { label: '5. Residential Address', value: resAddress, width: halfW },
        { label: '6. Permanent Address', value: permAddress, width: cw - halfW },
      ], 16, 70);

      // ── Row 4: Fields 7 & 8 (Occupation w1, halfW - w1 | Age w3, cw - halfW - w3) ──
      const occVal = rec?.occupation !== undefined && rec?.occupation !== null ? String(rec.occupation).trim() : '';
      const ageVal = rec?.age !== undefined && rec?.age !== null ? String(rec.age).trim() : '';
      builder.drawFormFieldPair(
        '7. Occupation', occVal, w1, halfW - w1,
        '8. Age on the date of admission', ageVal, w3, cw - halfW - w3,
        24
      );

      // ── Row 5: Field 9 (Full Name nominee - Expanded vertical height) ──
      const nomineeVal = rec?.nomineeName || rec?.nominee1 || '';
      builder.drawFormField('9. Full Name nominee', nomineeVal ? String(nomineeVal).trim() : '', w1, cw - w1, 36);

      // ── Row 6: Field 9A (Address of nominee - Expanded vertical height for multi-line address) ──
      const nomAddrVal = rec?.nomineeAddress !== undefined && rec?.nomineeAddress !== null ? String(rec.nomineeAddress).trim() : '';
      builder.drawFormField('9A. Address of nominee', nomAddrVal, w1, cw - w1, 48);

      // ── Row 7: Fields 10 & 11 (Date of nomination | Date of cessation) ──
      const nomDateVal = rec?.dateOfNomination !== undefined && rec?.dateOfNomination !== null ? String(rec.dateOfNomination).trim() : '';
      const cessDateVal = rec?.dateOfCessation !== undefined && rec?.dateOfCessation !== null ? String(rec.dateOfCessation).trim() : '';
      builder.drawFormFieldPair(
        '10. Date of nomination', nomDateVal, w1, halfW - w1,
        '11. Date of cessation of Membership', cessDateVal, w3, cw - halfW - w3,
        26
      );

      // ── Row 8: Field 12 (Reason for cessation - Left Label w1 | Right Value cw - w1) ──
      const cessReasonVal = rec?.reasonForCessation !== undefined && rec?.reasonForCessation !== null ? String(rec.reasonForCessation).trim() : '';
      builder.drawFormField('12. Reason for cessation', cessReasonVal, w1, cw - w1, 26);

      // ── Row 9: Field 13 (Remarks - Left Label w1 | Right Value cw - w1) ──
      const remarksVal = rec?.remarks !== undefined && rec?.remarks !== null ? String(rec.remarks).trim() : '';
      builder.drawFormField('13. Remarks', remarksVal, w1, cw - w1, 26);

      // ── Shares Held Table ──
      builder.drawNavySectionBar('PARTICULARS OF SHARES HELD', 20);

      const shareGroups: HeaderGroupDef[] = [
        { header: '', columns: [{ id: 'date', header: 'Date', width: Math.floor(cw * 0.12), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'cbf', header: 'Cash Book\nFolio', width: Math.floor(cw * 0.08), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'app', header: 'Application', width: Math.floor(cw * 0.10), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'allot', header: 'Allotment', width: Math.floor(cw * 0.085), align: 'center', fontSize: 7.5 }] },
        {
          header: 'Amount received on',
          columns: [
            { id: 'call1', header: '1st Call', width: Math.floor(cw * 0.075), align: 'center', fontSize: 7.0 },
            { id: 'call2', header: '2nd Call', width: Math.floor(cw * 0.075), align: 'center', fontSize: 7.0 },
          ],
        },
        { header: '', columns: [{ id: 'total', header: 'Total\nAmount\nReceived', width: Math.floor(cw * 0.095), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'held', header: 'No. of\nShare\nheld', width: Math.floor(cw * 0.08), align: 'center', fontSize: 7.5 }] },
        {
          header: 'No. of Share',
          columns: [
            { id: 'from', header: 'From', width: Math.floor(cw * 0.088), align: 'center', fontSize: 7.0 },
            { id: 'to', header: 'To', width: Math.floor(cw * 0.088), align: 'center', fontSize: 7.0 },
          ],
        },
        { header: '', columns: [{ id: 'cert', header: 'Serial No.\nof Share\nCertificate', width: 0, align: 'center', fontSize: 7.5 }] },
      ];

      // Flat column list for data rows
      const shareFlatCols: ColumnDef[] = [];
      for (const g of shareGroups) {
        for (const c of g.columns) shareFlatCols.push(c);
      }
      const usedShareW = shareFlatCols.slice(0, -1).reduce((s, c) => s + c.width, 0);
      shareFlatCols[shareFlatCols.length - 1].width = cw - usedShareW;
      shareGroups[shareGroups.length - 1].columns[0].width = cw - usedShareW;

      builder.drawTwoTierHeader(shareGroups, 36);

      // Helper to strip any accidentally leaked member/nominee names from share and transfer cells
      const memberNames = [
        rec?.memberName,
        rec?.member1,
        rec?.member2,
        rec?.member3,
        rec?.member4,
        rec?.member5,
        rec?.member6,
        FormMappingService.formatAllMemberNames(rec),
        rec?.nomineeName,
        rec?.nominee1,
        rec?.nominee2,
      ].filter(Boolean).map(n => String(n).trim().toLowerCase().replace(/\s+/g, ' '));

      const cleanVal = (val: unknown): string => {
        if (val === undefined || val === null) return '';
        const str = String(val).trim();
        if (!str) return '';
        const lowerNorm = str.toLowerCase().replace(/\s+/g, ' ');
        if (memberNames.some(n => n && (lowerNorm === n || (n.length >= 3 && (lowerNorm.includes(n) || n.includes(lowerNorm)))))) {
          return '';
        }
        return str;
      };

      // Render 5 Rows for Shares Held (Populating Entries 1 to 5)
      for (let i = 0; i < 5; i++) {
        const rawEntry = rec?.sharesHeldEntries?.[i] || (i === 0 ? {
          date: rec?.dateOfAllotment || '',
          cashBookFolio: rec?.cashBookFolio || '',
          application: rec?.shareApplication || '',
          allotment: rec?.shareAllotment || '',
          call1st: rec?.share1stCall || '',
          call2nd: rec?.share2ndCall || '',
          totalAmountReceived: rec?.totalAmountReceived || '',
          noOfShares: rec?.noOfShares || '',
          sharesFrom: rec?.sharesFrom || '',
          sharesTo: rec?.sharesTo || '',
          shareCertificateNo: rec?.serialNoOfShareCertificate || rec?.shareCertificateNo || '',
        } : null);

        const entry = rawEntry ? {
          date: cleanVal(rawEntry.date),
          cashBookFolio: cleanVal(rawEntry.cashBookFolio),
          application: cleanVal(rawEntry.application),
          allotment: cleanVal(rawEntry.allotment),
          call1st: cleanVal(rawEntry.call1st),
          call2nd: cleanVal(rawEntry.call2nd),
          totalAmountReceived: cleanVal(rawEntry.totalAmountReceived),
          noOfShares: cleanVal(rawEntry.noOfShares),
          sharesFrom: cleanVal(rawEntry.sharesFrom),
          sharesTo: cleanVal(rawEntry.sharesTo),
          shareCertificateNo: cleanVal(rawEntry.shareCertificateNo),
        } : null;

        const hasData = entry && Object.values(entry).some(v => v && String(v).trim() !== '');

        if (hasData) {
          const fs = builder.dataFontSize || 8.5;
          const shareDataCells: CellDef[] = [
            { text: entry.date || '', width: shareFlatCols[0].width, align: 'center', fontSize: fs },
            { text: entry.cashBookFolio || '', width: shareFlatCols[1].width, align: 'center', fontSize: fs },
            { text: entry.application || '', width: shareFlatCols[2].width, align: 'center', fontSize: fs },
            { text: entry.allotment || '', width: shareFlatCols[3].width, align: 'center', fontSize: fs },
            { text: entry.call1st || '', width: shareFlatCols[4].width, align: 'center', fontSize: fs },
            { text: entry.call2nd || '', width: shareFlatCols[5].width, align: 'center', fontSize: fs },
            { text: entry.totalAmountReceived || '', width: shareFlatCols[6].width, align: 'center', fontSize: fs },
            { text: entry.noOfShares || '', width: shareFlatCols[7].width, align: 'center', fontSize: fs },
            { text: entry.sharesFrom || '', width: shareFlatCols[8].width, align: 'center', fontSize: fs },
            { text: entry.sharesTo || '', width: shareFlatCols[9].width, align: 'center', fontSize: fs },
            { text: entry.shareCertificateNo || '', width: shareFlatCols[10].width, align: 'center', fontSize: fs },
          ];
          const shareRowH = isFoolscap ? 26.4 : 30;
          builder.drawTableRow(shareDataCells, shareRowH, fs);
        } else {
          const shareRowH = isFoolscap ? 26.4 : 30;
          const emptyRow = shareFlatCols.map(c => ({ text: '', width: c.width, align: 'center' as const }));
          builder.drawTableRow(emptyRow, shareRowH, builder.dataFontSize || 8.5);
        }
      }

      // ── Shares Transferred Table ──
      builder.drawNavySectionBar('PARTICULARS OF SHARES TRANSFERRED OR SURRENDERED', 20);

      const pColW = Math.max(24, Math.floor(cw * 0.045));
      const transGroups: HeaderGroupDef[] = [
        { header: '', columns: [{ id: 'date', header: 'Date', width: Math.floor(cw * 0.12), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'cbf', header: 'Cash Book\nFolio', width: Math.floor(cw * 0.085), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'date2', header: 'Date', width: Math.floor(cw * 0.085), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'certNo', header: 'No./ Serial No.\nof Share Certificate', width: Math.floor(cw * 0.13), align: 'center', fontSize: 7 }] },
        { header: '', columns: [{ id: 'transNo', header: 'No. of shares\ntransferred / refunded', width: Math.floor(cw * 0.13), align: 'center', fontSize: 7 }] },
        {
          header: 'BALANCES',
          columns: [
            { id: 'balNo', header: 'No. of shares\nheld', width: Math.floor(cw * 0.11), align: 'center', fontSize: 7 },
            { id: 'balCert', header: 'Serial No. of\nshare cert.', width: Math.floor(cw * 0.13), align: 'center', fontSize: 7 },
          ],
        },
        {
          header: 'Amount',
          columns: [
            { id: 'amtRs', header: 'Rs', width: 0, align: 'center', fontSize: 7.5 },
            { id: 'amtP', header: 'P', width: pColW, align: 'center', fontSize: 7.5 },
          ],
        },
      ];

      const transFlatCols: ColumnDef[] = [];
      for (const g of transGroups) {
        for (const c of g.columns) transFlatCols.push(c);
      }
      const amtRsCol = transFlatCols.find(c => c.id === 'amtRs')!;
      const otherColsW = transFlatCols.filter(c => c.id !== 'amtRs').reduce((s, c) => s + c.width, 0);
      amtRsCol.width = cw - otherColsW;
      transGroups[transGroups.length - 1].columns[0].width = amtRsCol.width;

      builder.drawTwoTierHeader(transGroups, 36);

      // Render 5 Rows for Shares Transferred or Surrendered (Populating Entries 1 to 5)
      for (let i = 0; i < 5; i++) {
        const rawEntry = rec?.sharesTransferredEntries?.[i] || (i === 0 ? {
          date: rec?.dateOfTransferRefund || rec?.transferDate || '',
          cashBookFolio: rec?.transferCashBookFolio || '',
          transferDate: rec?.transferDate || '',
          shareCertificateNo: rec?.shareCertTransferred || rec?.transferCertificateNo || '',
          noOfSharesTransferred: rec?.noOfSharesTransferredRefunded || rec?.noOfSharesTransferred || '',
          balanceNoOfShares: rec?.balanceNoOfShares || '',
          balanceSerialNoCertificate: rec?.balanceSerialNoCertificate || '',
          amountRs: rec?.balanceAmountRs || '',
          amountP: '',
        } : null);

        const entry = rawEntry ? {
          date: cleanVal(rawEntry.date),
          cashBookFolio: cleanVal(rawEntry.cashBookFolio),
          transferDate: cleanVal(rawEntry.transferDate),
          shareCertificateNo: cleanVal(rawEntry.shareCertificateNo),
          noOfSharesTransferred: cleanVal(rawEntry.noOfSharesTransferred),
          balanceNoOfShares: cleanVal(rawEntry.balanceNoOfShares),
          balanceSerialNoCertificate: cleanVal(rawEntry.balanceSerialNoCertificate),
          amountRs: cleanVal(rawEntry.amountRs),
          amountP: cleanVal(rawEntry.amountP),
        } : null;

        const hasData = entry && Object.values(entry).some(v => v && String(v).trim() !== '');

        if (hasData) {
          const fs = builder.dataFontSize || 8.5;
          const transDataCells: CellDef[] = [
            { text: entry.date || '', width: transFlatCols[0].width, align: 'center', fontSize: fs },
            { text: entry.cashBookFolio || '', width: transFlatCols[1].width, align: 'center', fontSize: fs },
            { text: entry.transferDate || '', width: transFlatCols[2].width, align: 'center', fontSize: fs },
            { text: entry.shareCertificateNo || '', width: transFlatCols[3].width, align: 'center', fontSize: fs },
            { text: entry.noOfSharesTransferred || '', width: transFlatCols[4].width, align: 'center', fontSize: fs },
            { text: entry.balanceNoOfShares || '', width: transFlatCols[5].width, align: 'center', fontSize: fs },
            { text: entry.balanceSerialNoCertificate || '', width: transFlatCols[6].width, align: 'center', fontSize: fs },
            { text: entry.amountRs || '', width: transFlatCols[7].width, align: 'center', fontSize: fs },
            { text: entry.amountP || '', width: transFlatCols[8].width, align: 'center', fontSize: fs },
          ];
          const transRowH = isFoolscap ? 26.4 : 30;
          builder.drawTableRow(transDataCells, transRowH, fs);
        } else {
          const transRowH = isFoolscap ? 26.4 : 30;
          const emptyRow = transFlatCols.map(c => ({ text: '', width: c.width, align: 'center' as const }));
          builder.drawTableRow(emptyRow, transRowH, builder.dataFontSize || 8.5);
        }
      }

      // ── Special Notes Box (Exact 2.00 CM on Legal and Foolscap, Directly Above Footer Margin) ──
      const specialNoteBottomY = builder.marginBottom + 4;
      const maxAvailableNoteH = Math.max(38, builder.currentY - specialNoteBottomY - 4);
      const specialNoteH = Math.min(56.7, maxAvailableNoteH);
      const specialNoteTopY = specialNoteBottomY + specialNoteH;

      // Draw Special Notes Box rectangle
      builder.currentPage.drawRectangle({
        x: builder.marginLeft,
        y: specialNoteBottomY,
        width: cw,
        height: specialNoteH,
        color: builder.cellBg,
        borderColor: builder.borderColor,
        borderWidth: 0.5,
      });

      // Header label inside Special Notes box
      builder.currentPage.drawText('Special Notes.', {
        x: builder.marginLeft + 6,
        y: specialNoteTopY - 14,
        size: 8.5,
        font: builder.boldFont,
        color: builder.headerText,
      });

      // Draw any custom special note or remarks inside the box
      const specialNoteContent = (rec as any)?.specialNotes || '';
      if (specialNoteContent && specialNoteContent.trim()) {
        const noteLines = builder.wrapText(specialNoteContent.trim(), cw - 90, 8);
        noteLines.slice(0, 3).forEach((line, idx) => {
          builder.currentPage.drawText(line, {
            x: builder.marginLeft + 80,
            y: specialNoteTopY - 14 - idx * 11,
            size: 8,
            font: builder.font,
            color: builder.bodyTextColor,
          });
        });
      }

      builder.currentY = specialNoteBottomY;

      outputs.push(await builder.buildBuffer());
    }

    return outputs;
  }
}
