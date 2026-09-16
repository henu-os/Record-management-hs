// ============================================================
// HENU OS — Lien Mark / Bank Lien Mark Renderer (Portrait, Legal Paper)
// Excel Authority: "Bank Lien Mark - Portrait" sheet
// Card/form layout with 4 repeating loan sections & Remarks
// ============================================================

import { BankLineMarkRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { PdfDocumentBuilder } from './PdfDocumentBuilder';
import { LienMarkDefinition } from './definitions/LienMarkDefinition';
import { FormMappingService } from '../FormMappingService';

export class LienMarkRenderer {
  static async render(
    records: { serial: string; record: BankLineMarkRecord | null }[],
    society: SocietyMaster | null,
    options?: { orientationOverride?: 'Portrait' | 'Landscape'; settings?: FormDesignSettings; renderMode?: 'Color' | 'BW'; gridOn?: boolean } | 'Portrait' | 'Landscape',
    settingsParam?: FormDesignSettings
  ): Promise<Buffer> {
    const def = LienMarkDefinition;
    const orientationOverride = typeof options === 'string' ? options : options?.orientationOverride;
    const settings = typeof options === 'object' ? options?.settings : settingsParam;
    const renderMode = typeof options === 'object' ? options?.renderMode : undefined;
    const gridOn = typeof options === 'object' ? options?.gridOn : undefined;

    const builder = await PdfDocumentBuilder.create({
      orientation: orientationOverride || def.orientation,
      title: def.title,
      society,
      settings,
      renderMode,
      gridOn,
    });

    const cw = builder.contentWidth;

    // Excel column widths: 29.29, 27.29, 27.29, 27.29 (total 111.16)
    const colA = Math.floor(cw * (29.29 / 111.16));
    const colB = Math.floor(cw * (27.29 / 111.16));
    const colC = Math.floor(cw * (27.29 / 111.16));
    const colD = cw - colA - colB - colC;

    for (let recordIdx = 0; recordIdx < records.length; recordIdx++) {
      if (recordIdx > 0) {
        builder.addNewPage();
      }

      // Draw Excel header block
      builder.drawExcelHeader('REGISTER OF LIEN MARK');

      const item = records[recordIdx];
      const rec = item.record;
      const serial = item.serial;

      const isBlankRec = !rec || (!rec.srNo && !rec.member1 && !rec.memberName);
      const memberName = isBlankRec ? '' : FormMappingService.formatAllMemberNames(rec);
      const membershipType = isBlankRec ? '' : (rec.classOfMember || 'Active Member');
      const flatArea = isBlankRec ? '' : (rec.area || rec.carpetBuildupSqFt || '');

      let wingFlat = '';
      if (rec) {
        if (rec.wingNo && rec.flatNo) {
          wingFlat = `${rec.wingNo} / ${rec.flatNo}`;
        } else {
          wingFlat = rec.flatNo || rec.wingNo || '';
        }
      }

      // ── Row 1: Sr. No. | Wing / Flat No. ──
      builder.drawFormFieldPair(
        'Sr. No.', serial, colA, colB,
        'Wing / Flat No.', wingFlat, colC, colD,
        24
      );

      // ── Row 2: Members Name (All 6 joint members with comma separation) ──
      builder.drawFormField('Members Name', memberName, colA, cw - colA, 36);

      // ── Row 3: Flat Area | Type of Membership ──
      builder.drawFormFieldPair(
        'Flat Area', flatArea, colA, colB,
        'Type of Membership', membershipType, colC, colD,
        24
      );

      // ── Row 4: Flat & Member Information Remarks ──
      builder.drawFormField('Remarks', rec?.remarks || rec?.propertyRemarks || '', colA, cw - colA, 28);

      // ── 4 Loan Sections ──
      for (const section of def.loanSections) {
        let bName = '';
        let bAddr = '';
        let amt = '';
        let period = '';
        let mcDate = '';
        let resNo = '';
        let nocDate = '';
        let cancelDate = '';
        let bRemark = '';

        if (rec) {
          const p = section.prefix as 'loan1' | 'loan2' | 'loan3' | 'loan4';
          bName = (rec as any)[`${p}BankName`] || (p === 'loan1' ? rec.bankName : '');
          bAddr = (rec as any)[`${p}BankAddress`] || (p === 'loan1' ? rec.bankAddress : '');
          amt = (rec as any)[`${p}Amount`] || (p === 'loan1' ? rec.loanAmount : '');
          period = (rec as any)[`${p}Period`] || (p === 'loan1' ? rec.loanPeriod : '');
          mcDate = (rec as any)[`${p}MCDate`] || (p === 'loan1' ? rec.mcMeetingApprovalDate : '');
          resNo = (rec as any)[`${p}ResolutionNo`] || (p === 'loan1' ? rec.resolutionNo : '');
          nocDate = (rec as any)[`${p}NOCDate`] || (p === 'loan1' ? rec.dateOfNOC : '');
          cancelDate = (rec as any)[`${p}CancelDate`] || (p === 'loan1' ? rec.dateOfLienCancellation : '');
          bRemark = (rec as any)[`${p}Remark`] || '';
        }

        builder.drawNavySectionBar(section.title, 20);

        // Name of the Bank
        builder.drawFormField('Name of the Bank', bName, colA, cw - colA, 22);

        // Bank Address (Auto-scaled inside cell)
        builder.drawFormField('Bank Address', bAddr, colA, cw - colA, 42);

        // Loan Amount / Period of Loan
        builder.drawFormFieldPair(
          'Loan Amount', amt, colA, colB,
          'Period of Loan', period, colC, colD,
          22
        );

        // Managing Committee Meeting Date / Resolution No
        builder.drawFormFieldPair(
          'Managing Committee Meeting Date', mcDate, colA, colB,
          'Resolution No.', resNo, colC, colD,
          22
        );

        // Date of NOC given by Society / Date of Documents of Lien Cancellation
        builder.drawFormFieldPair(
          'Date of NOC given by Society', nocDate, colA, colB,
          'Date of Documents of Lien Cancellation', cancelDate, colC, colD,
          22
        );

        // Loan Section Remarks
        builder.drawFormField('Remarks', bRemark, colA, cw - colA, 22);
      }
    }

    return await builder.buildBuffer();
  }
}
