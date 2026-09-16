// ============================================================
// HENU OS — Nomination Register Renderer (Landscape, Legal Paper)
// Excel Authority: "Nomination Register" sheet — 8 columns
// ============================================================

import { NominationRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { PdfDocumentBuilder, CellDef } from './PdfDocumentBuilder';
import { NominationRegisterDefinition } from './definitions/NominationRegisterDefinition';
import { FormMappingService } from '../FormMappingService';

export class NominationRegisterRenderer {
  static async render(
    records: { serial: string; record: NominationRecord | null }[],
    society: SocietyMaster | null,
    options?: {
      orientationOverride?: 'Portrait' | 'Landscape';
      settings?: FormDesignSettings;
      renderMode?: 'Color' | 'BW';
      gridOn?: boolean;
      templateId?: string;
      emptyRows?: number;
      dataFontSize?: number;
      dataTextColor?: string;
    } | 'Portrait' | 'Landscape',
    settingsParam?: FormDesignSettings
  ): Promise<Buffer> {
    const def = NominationRegisterDefinition;
    const orientationOverride = typeof options === 'string' ? options : options?.orientationOverride;
    const settings = typeof options === 'object' ? options?.settings : settingsParam;
    const renderMode = typeof options === 'object' ? options?.renderMode : undefined;
    const gridOn = typeof options === 'object' ? options?.gridOn : undefined;
    const emptyRowsCount = typeof options === 'object' && options?.emptyRows !== undefined ? Math.min(6, Math.max(0, options.emptyRows)) : 0;
    const dataFontSize = typeof options === 'object' && options?.dataFontSize ? Math.min(12.5, Math.max(7.5, options.dataFontSize)) : 8.0;
    const dataTextColor = typeof options === 'object' && options?.dataTextColor ? options.dataTextColor : undefined;
    const templateId = typeof options === 'object' && (options as any)?.templateId ? (options as any).templateId : 'TEMPLATE_2';
    const isTemplate2 = templateId !== 'TEMPLATE_1';

    const builder = await PdfDocumentBuilder.create({
      orientation: orientationOverride || def.orientation,
      title: def.title,
      society,
      settings,
      renderMode,
      gridOn,
    });

    // Scale columns to fill available content width
    const availW = builder.contentWidth;
    const baseW = def.columns.reduce((sum, c) => sum + c.width, 0);
    const scale = availW / baseW;
    const cols = def.columns.map(c => ({ ...c, width: c.width * scale }));

    // Flatten records into table rows (handling Nominees 1..6 and Percentages 1..6)
    interface NomRowItem {
      serial: string;
      memberName: string;
      flatWing: string;
      dateOfNomination: string;
      nomineeFull: string;
      nomineePercentage: string;
      mcMeetingDate: string;
      subsequentRevocation: string;
      remarks: string;
      isNameBold?: boolean;
    }

    const allRowItems: NomRowItem[] = [];

    for (const item of records) {
      const rec = item.record;
      const serial = item.serial || '';
      const rawRec = rec as any;
      const isBlankRec = !rec || (!rawRec.srNo && !rawRec.member1 && !rawRec.memberName);

      if (isBlankRec) {
        allRowItems.push({
          serial,
          memberName: '',
          flatWing: '',
          dateOfNomination: '',
          nomineeFull: '',
          nomineePercentage: '',
          mcMeetingDate: '',
          subsequentRevocation: '',
          remarks: '',
        });
        for (let e = 0; e < emptyRowsCount; e++) {
          allRowItems.push({
            serial: '', memberName: '', flatWing: '', dateOfNomination: '', nomineeFull: '',
            nomineePercentage: '', mcMeetingDate: '', subsequentRevocation: '', remarks: '',
          });
        }
        continue;
      }

      // Extract Member Names 1..6
      let memberNamesList: string[] = [];
      if (rawRec) {
        const direct = [rawRec.member1, rawRec.member2, rawRec.member3, rawRec.member4, rawRec.member5, rawRec.member6]
          .map((m: any) => (m ? String(m).trim() : ''))
          .filter(Boolean);

        if (direct.length > 0) {
          memberNamesList = direct;
        } else if (rawRec.memberName || rawRec.nameOfMember) {
          const rawName = rawRec.memberName || rawRec.nameOfMember || '';
          memberNamesList = rawName.split(/[\/\+\,\n\r]/).map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (memberNamesList.length === 0) {
        memberNamesList = [''];
      }

      // Flat / Wing
      const flat = rec?.flatNo ? String(rec.flatNo).trim() : '';
      const wing = rec?.wingNo ? String(rec.wingNo).trim() : '';
      const flatWing = [flat, wing].filter(Boolean).join(' / ') || (rawRec?.flat_wing ? String(rawRec.flat_wing).trim() : '');

      // Extract Nominees 1..6 and Percentages 1..6
      const directNominees = [
        { name: rawRec?.nominee1, pct: rawRec?.nomineePercentage1 },
        { name: rawRec?.nominee2, pct: rawRec?.nomineePercentage2 },
        { name: rawRec?.nominee3, pct: rawRec?.nomineePercentage3 },
        { name: rawRec?.nominee4, pct: rawRec?.nomineePercentage4 },
        { name: rawRec?.nominee5, pct: rawRec?.nomineePercentage5 },
        { name: rawRec?.nominee6, pct: rawRec?.nomineePercentage6 },
      ];

      let nomList: { name: string; pct: string }[] = [];
      const hasDirect = directNominees.some(n => (n.name && String(n.name).trim()) || (n.pct && String(n.pct).trim()));

      if (hasDirect) {
        nomList = directNominees
          .filter(n => (n.name && String(n.name).trim()) || (n.pct && String(n.pct).trim()))
          .map(n => ({
            name: n.name ? String(n.name).trim() : '',
            pct: n.pct ? String(n.pct).trim() : '',
          }));
      } else {
        const rawNames = rawRec?.nomineeName ? String(rawRec.nomineeName).split(/\r?\n|;/).map((s: string) => s.trim()).filter(Boolean) : [];
        const rawPcts = rawRec?.nomineePercentage ? String(rawRec.nomineePercentage).split(/\r?\n|;/).map((s: string) => s.trim()).filter(Boolean) : [];
        const maxLen = Math.max(rawNames.length, rawPcts.length);
        if (maxLen > 0) {
          for (let i = 0; i < maxLen; i++) {
            nomList.push({
              name: rawNames[i] || '',
              pct: rawPcts[i] || '',
            });
          }
        } else {
          const singleName = rawRec?.nomineeName || '';
          const singleAddr = rawRec?.nomineeAddress ? ` (${rawRec.nomineeAddress})` : '';
          const singleFull = `${singleName}${singleAddr}`.trim();
          nomList.push({
            name: singleFull,
            pct: rawRec?.nomineePercentage || '',
          });
        }
      }

      if (nomList.length === 0) {
        nomList = [{ name: '', pct: '' }];
      }

      const entryRowCount = Math.max(memberNamesList.length, nomList.length);

      // First Row (Row 0)
      allRowItems.push({
        serial,
        memberName: memberNamesList[0] || '',
        flatWing,
        dateOfNomination: rawRec?.dateOfNomination || '',
        nomineeFull: nomList[0]?.name || '',
        nomineePercentage: nomList[0]?.pct || '',
        mcMeetingDate: rawRec?.mcMeetingDate || '',
        subsequentRevocation: rawRec?.subsequentRevocation || '',
        remarks: rawRec?.remarks || '',
        isNameBold: true,
      });

      // Subsequent Rows (Members 2..6, Nominees 2..6)
      for (let rIdx = 1; rIdx < entryRowCount; rIdx++) {
        allRowItems.push({
          serial: '',
          memberName: memberNamesList[rIdx] || '',
          flatWing: '',
          dateOfNomination: '',
          nomineeFull: nomList[rIdx]?.name || '',
          nomineePercentage: nomList[rIdx]?.pct || '',
          mcMeetingDate: '',
          subsequentRevocation: '',
          remarks: '',
          isNameBold: true,
        });
      }

      // Configurable empty rows per entry (0-6)
      for (let e = 0; e < emptyRowsCount; e++) {
        allRowItems.push({
          serial: '',
          memberName: '',
          flatWing: '',
          dateOfNomination: '',
          nomineeFull: '',
          nomineePercentage: '',
          mcMeetingDate: '',
          subsequentRevocation: '',
          remarks: '',
        });
      }
    }

    const pageSize = 18;
    const totalPages = Math.max(1, Math.ceil(allRowItems.length / pageSize));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) {
        builder.addNewPage();
      }

      // Excel header (4-row centered)
      builder.drawExcelHeader('NOMINATION REGISTER');

      // Table header
      const headerHeight = 30;
      builder.drawTableHeader(cols, headerHeight);

      // Column number row (1-9)
      builder.drawColumnNumberRow(cols, 16);

      // Calculate row height to balance the page
      const usableHeight = builder.currentY - builder.marginBottom - 2;
      const rowHeight = Math.max(18, Math.floor(usableHeight / pageSize));

      const pageRows = allRowItems.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);

      for (let r = 0; r < pageSize; r++) {
        const item = pageRows[r];

        const cells: CellDef[] = [
          { text: item ? item.serial : '',                            width: cols[0].width, align: 'center', bold: true, fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.memberName : '',                        width: cols[1].width, align: 'left', bold: item?.isNameBold ?? true, fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.flatWing : '',                          width: cols[2].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.dateOfNomination : '',                  width: cols[3].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.nomineeFull : '',                       width: cols[4].width, align: 'left', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.nomineePercentage : '',                 width: cols[5].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.mcMeetingDate : '',                     width: cols[6].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.subsequentRevocation : '',              width: cols[7].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.remarks : '',                           width: cols[8].width, align: 'left', fontSize: dataFontSize, color: dataTextColor },
        ];

        builder.drawTableRow(cells, rowHeight, dataFontSize);
      }
    }

    return await builder.buildBuffer();
  }
}
