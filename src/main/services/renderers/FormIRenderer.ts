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
    options?: { orientationOverride?: 'Portrait' | 'Landscape'; settings?: FormDesignSettings; renderMode?: 'Color' | 'BW'; gridOn?: boolean } | 'Portrait' | 'Landscape',
    settingsParam?: FormDesignSettings
  ): Promise<Buffer[]> {
    const def = FormIDefinition;
    const orientationOverride = typeof options === 'string' ? options : options?.orientationOverride;
    const settings = typeof options === 'object' ? options?.settings : settingsParam;
    const renderMode = typeof options === 'object' ? options?.renderMode : undefined;
    const gridOn = typeof options === 'object' ? options?.gridOn : undefined;
    const outputs: Buffer[] = [];

    for (const item of records) {
      const builder = await PdfDocumentBuilder.create({
        orientation: orientationOverride || def.orientation,
        title: def.title,
        society,
        settings,
        renderMode,
        gridOn,
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

      // ── Row 3: Field 5 (Residential & Permanent Address 50/50 Split Stacked, 6-line space) ──
      const permAddress = FormMappingService.formatPermanentAddress(rec, society);
      const resAddress = rec?.residentialAddress ? rec.residentialAddress.trim() : '';

      builder.drawStackedFields([
        { label: '5. Residential Address', value: resAddress, width: halfW },
        { label: '5. Permanent Address', value: permAddress, width: cw - halfW },
      ], 16, 70);

      // ── Row 4: Fields 6 & 7 (Occupation w1, halfW - w1 | Age w3, cw - halfW - w3) ──
      builder.drawFormFieldPair(
        '6. Occupation', rec?.occupation || '', w1, halfW - w1,
        '7. Age on the date of admission', rec?.age || '', w3, cw - halfW - w3,
        24
      );

      // ── Row 5: Field 8 (Full Name nominee - Expanded vertical height) ──
      builder.drawFormField('8. Full Name nominee', rec?.nomineeName || '', w1, cw - w1, 36);

      // ── Row 6: Field 9 (Address of nominee - Expanded vertical height for multi-line address) ──
      builder.drawFormField('9. Address of nominee', rec?.nomineeAddress || '', w1, cw - w1, 48);

      // ── Row 7: Fields 10 & 11 (Date of nomination | Date of cessation) ──
      builder.drawFormFieldPair(
        '10. Date of nomination', rec?.dateOfNomination || '', w1, halfW - w1,
        '11. Date of cessation of Membership', rec?.dateOfCessation || '', w3, cw - halfW - w3,
        26
      );

      // ── Row 8: Field 12 (Reason for cessation - Left Label w1 | Right Value cw - w1) ──
      builder.drawFormField('12. Reason for cessation', rec?.reasonForCessation || '', w1, cw - w1, 26);

      // ── Row 9: Field 13 (Remarks - Left Label w1 | Right Value cw - w1) ──
      builder.drawFormField('13. Remarks', rec?.remarks || '', w1, cw - w1, 26);

      // ── Row 10: Blank row under Remarks ──
      builder.drawFormField('', '', 0, cw, 20);

      // ── Shares Held Table ──
      builder.drawNavySectionBar('PARTICULARS OF SHARES HELD', 20);

      const shareGroups: HeaderGroupDef[] = [
        { header: '', columns: [{ id: 'date',   header: 'Date',                 width: Math.floor(cw * 0.12),  align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'cbf',    header: 'Cash Book\nFolio',     width: Math.floor(cw * 0.08),  align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'app',    header: 'Application',          width: Math.floor(cw * 0.10),  align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'allot',  header: 'Allotment',            width: Math.floor(cw * 0.085), align: 'center', fontSize: 7.5 }] },
        {
          header: 'Amount received on',
          columns: [
            { id: 'call1', header: '1st Call', width: Math.floor(cw * 0.075), align: 'center', fontSize: 7.0 },
            { id: 'call2', header: '2nd Call', width: Math.floor(cw * 0.075), align: 'center', fontSize: 7.0 },
          ],
        },
        { header: '', columns: [{ id: 'total',  header: 'Total\nAmount\nReceived', width: Math.floor(cw * 0.095), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'held',   header: 'No. of\nShare\nheld', width: Math.floor(cw * 0.08),  align: 'center', fontSize: 7.5 }] },
        {
          header: 'No. of Share',
          columns: [
            { id: 'from', header: 'From', width: Math.floor(cw * 0.07), align: 'center', fontSize: 7.0 },
            { id: 'to',   header: 'To',   width: Math.floor(cw * 0.07), align: 'center', fontSize: 7.0 },
          ],
        },
        { header: '', columns: [{ id: 'cert',   header: 'Serial No.\nof Share\nCertificate', width: 0, align: 'center', fontSize: 7.5 }] },
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
          const shareDataCells: CellDef[] = [
            { text: entry.date || '', width: shareFlatCols[0].width, align: 'center', fontSize: 8 },
            { text: entry.cashBookFolio || '', width: shareFlatCols[1].width, align: 'center', fontSize: 8 },
            { text: entry.application || '', width: shareFlatCols[2].width, align: 'center', fontSize: 8 },
            { text: entry.allotment || '', width: shareFlatCols[3].width, align: 'center', fontSize: 8 },
            { text: entry.call1st || '', width: shareFlatCols[4].width, align: 'center', fontSize: 8 },
            { text: entry.call2nd || '', width: shareFlatCols[5].width, align: 'center', fontSize: 8 },
            { text: entry.totalAmountReceived || '', width: shareFlatCols[6].width, align: 'center', fontSize: 8 },
            { text: entry.noOfShares || '', width: shareFlatCols[7].width, align: 'center', fontSize: 8 },
            { text: entry.sharesFrom || '', width: shareFlatCols[8].width, align: 'center', fontSize: 8 },
            { text: entry.sharesTo || '', width: shareFlatCols[9].width, align: 'center', fontSize: 8 },
            { text: entry.shareCertificateNo || '', width: shareFlatCols[10].width, align: 'center', fontSize: 8 },
          ];
          builder.drawTableRow(shareDataCells, 26, 8);
        } else {
          const emptyRow = shareFlatCols.map(c => ({ text: '', width: c.width, align: 'center' as const }));
          builder.drawTableRow(emptyRow, 26, 8);
        }
      }

      // ── Shares Transferred Table ──
      builder.drawNavySectionBar('PARTICULARS OF SHARES TRANSFERRED OR SURRENDERED', 20);

      const transGroups: HeaderGroupDef[] = [
        { header: '', columns: [{ id: 'date',     header: 'Date',                 width: Math.floor(cw * 0.12), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'cbf',      header: 'Cash Book\nFolio',     width: Math.floor(cw * 0.085), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'date2',    header: 'Date',                 width: Math.floor(cw * 0.085), align: 'center', fontSize: 7.5 }] },
        { header: '', columns: [{ id: 'certNo',   header: 'No./ Serial No.\nof Share Certificate', width: Math.floor(cw * 0.14), align: 'center', fontSize: 7 }] },
        { header: '', columns: [{ id: 'transNo',  header: 'No. of shares\ntransferred / refunded', width: Math.floor(cw * 0.14), align: 'center', fontSize: 7 }] },
        {
          header: 'BALANCES',
          columns: [
            { id: 'balNo',   header: 'No. of shares\nheld', width: Math.floor(cw * 0.12), align: 'center', fontSize: 7 },
            { id: 'balCert', header: 'Serial No. of\nshare cert.', width: Math.floor(cw * 0.14), align: 'center', fontSize: 7 },
          ],
        },
        {
          header: 'Amount',
          columns: [
            { id: 'amtRs', header: 'Rs', width: Math.floor(cw * 0.09), align: 'center', fontSize: 7.5 },
            { id: 'amtP',  header: 'P',  width: 0, align: 'center', fontSize: 7.5 },
          ],
        },
      ];

      const transFlatCols: ColumnDef[] = [];
      for (const g of transGroups) {
        for (const c of g.columns) transFlatCols.push(c);
      }
      const usedTransW = transFlatCols.slice(0, -1).reduce((s, c) => s + c.width, 0);
      transFlatCols[transFlatCols.length - 1].width = cw - usedTransW;
      transGroups[transGroups.length - 1].columns[1].width = cw - usedTransW;

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
          const transDataCells: CellDef[] = [
            { text: entry.date || '', width: transFlatCols[0].width, align: 'center', fontSize: 8 },
            { text: entry.cashBookFolio || '', width: transFlatCols[1].width, align: 'center', fontSize: 8 },
            { text: entry.transferDate || '', width: transFlatCols[2].width, align: 'center', fontSize: 8 },
            { text: entry.shareCertificateNo || '', width: transFlatCols[3].width, align: 'center', fontSize: 8 },
            { text: entry.noOfSharesTransferred || '', width: transFlatCols[4].width, align: 'center', fontSize: 8 },
            { text: entry.balanceNoOfShares || '', width: transFlatCols[5].width, align: 'center', fontSize: 8 },
            { text: entry.balanceSerialNoCertificate || '', width: transFlatCols[6].width, align: 'center', fontSize: 8 },
            { text: entry.amountRs || '', width: transFlatCols[7].width, align: 'center', fontSize: 8 },
            { text: entry.amountP || '', width: transFlatCols[8].width, align: 'center', fontSize: 8 },
          ];
          builder.drawTableRow(transDataCells, 26, 8);
        } else {
          const emptyRow = transFlatCols.map(c => ({ text: '', width: c.width, align: 'center' as const }));
          builder.drawTableRow(emptyRow, 26, 8);
        }
      }

      // Special Note
      builder.currentY -= 8;
      builder.currentPage.drawText('Special Note :-', {
        x: builder.marginLeft + 4,
        y: builder.currentY - 10,
        size: 8.5,
        font: builder.boldFont,
        color: builder.headerText,
      });

      outputs.push(await builder.buildBuffer());
    }

    return outputs;
  }
}
