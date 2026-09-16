// ============================================================
// HENU OS — Form J Renderer (Portrait + Landscape, Legal Paper)
// Excel Authority: "Form J - Portrait" and "Form J - Landscape"
// ============================================================

import { FormJRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { PdfDocumentBuilder, CellDef } from './PdfDocumentBuilder';
import { FormJDefinition } from './definitions/FormJDefinition';
import { FormMappingService } from '../FormMappingService';

export class FormJRenderer {
  static async render(
    records: { serial: string; record: FormJRecord | null }[],
    society: SocietyMaster | null,
    options?: {
      orientationOverride?: 'Portrait' | 'Landscape';
      rowsPerPage?: number;
      settings?: FormDesignSettings;
      renderMode?: 'Color' | 'BW';
      gridOn?: boolean;
      templateId?: string;
      emptyRows?: number;
      dataFontSize?: number;
      dataTextColor?: string;
    } | 'Portrait' | 'Landscape'
  ): Promise<Buffer> {
    const def = FormJDefinition;
    const orientationOverride = typeof options === 'string' ? options : options?.orientationOverride;
    const customRows = typeof options === 'object' ? options?.rowsPerPage : undefined;
    const settings = typeof options === 'object' ? options?.settings : undefined;
    const renderMode = typeof options === 'object' ? options?.renderMode : undefined;
    const gridOn = typeof options === 'object' ? options?.gridOn : undefined;
    const emptyRowsCount = typeof options === 'object' && options?.emptyRows !== undefined ? Math.min(6, Math.max(0, options.emptyRows)) : 0;
    const dataFontSize = typeof options === 'object' && options?.dataFontSize ? Math.min(12.5, Math.max(7.5, options.dataFontSize)) : 8.5;
    const dataTextColor = typeof options === 'object' && options?.dataTextColor ? options.dataTextColor : undefined;

    const templateId = typeof options === 'object' && (options as any)?.templateId ? (options as any).templateId : 'TEMPLATE_2';
    const isTemplate2 = templateId !== 'TEMPLATE_1';

    const orientation = orientationOverride || def.orientation;

    const builder = await PdfDocumentBuilder.create({
      orientation,
      title: def.title,
      society,
      settings,
      renderMode,
      gridOn,
    });

    // Select column definitions based on orientation
    const baseCols = orientation === 'Landscape' ? def.landscapeColumns : def.columns;

    // Scale columns to fill available content width
    const availW = builder.contentWidth;
    const baseW = baseCols.reduce((sum, c) => sum + c.width, 0);
    const scale = availW / baseW;
    const cols = baseCols.map(c => ({ ...c, width: c.width * scale }));

    // Flatten records into table rows based on Template 1 (Compact 1-row) or Template 2 (Multi-row + emptyRows)
    interface FormJRowItem {
      serial: string;
      memberName: string;
      address: string;
      memberClass: string;
      isNameBold?: boolean;
    }

    const allRowItems: FormJRowItem[] = [];

    for (const item of records) {
      const rec = item.record;
      const serial = item.serial || '';
      const rawRec = rec as any;
      const isBlankRec = !rec || (!rawRec.srNo && !rawRec.member1 && !rawRec.memberName);

      if (isBlankRec) {
        allRowItems.push({
          serial,
          memberName: '',
          address: '',
          memberClass: '',
        });
        if (isTemplate2) {
          for (let e = 0; e < emptyRowsCount; e++) {
            allRowItems.push({ serial: '', memberName: '', address: '', memberClass: '' });
          }
        }
        continue;
      }

      const address = rec
        ? (rec.permanentAddress ? FormMappingService.formatPermanentAddress(rec, society) : (rec.residentialAddress || ''))
        : '';
      const memberClass = rec ? (rec.classOfMember || 'Active Member') : '';

      if (!isTemplate2) {
        // TEMPLATE 1: Compact 1-Row per Member
        const allNames = FormMappingService.formatAllMemberNames(rec);
        allRowItems.push({
          serial,
          memberName: allNames,
          address,
          memberClass,
          isNameBold: true,
        });

        // Configurable empty rows per entry (0-6)
        for (let e = 0; e < emptyRowsCount; e++) {
          allRowItems.push({
            serial: '',
            memberName: '',
            address: '',
            memberClass: '',
          });
        }
      } else {
        // TEMPLATE 2: Multi-Row per Joint Member + Configurable Empty Rows
        let memberNamesList: string[] = [];
        if (rawRec) {
          const direct = [rawRec.member1, rawRec.member2, rawRec.member3, rawRec.member4, rawRec.member5, rawRec.member6]
            .map((m: any) => (m ? String(m).trim() : ''))
            .filter(Boolean);

          if (direct.length > 0) {
            memberNamesList = direct;
          } else if (rawRec.memberName) {
            memberNamesList = rawRec.memberName.split(/[\/\+\,]/).map((s: string) => s.trim()).filter(Boolean);
          }
        }

        if (memberNamesList.length === 0) {
          memberNamesList = [''];
        }

        // First member row gets serial, address, memberClass
        allRowItems.push({
          serial,
          memberName: memberNamesList[0],
          address,
          memberClass,
          isNameBold: true,
        });

        // Subsequent joint members (member2..member6)
        for (let mIdx = 1; mIdx < memberNamesList.length; mIdx++) {
          allRowItems.push({
            serial: '',
            memberName: memberNamesList[mIdx],
            address: '',
            memberClass: '',
            isNameBold: true,
          });
        }

        // Configurable empty rows per entry (0-6)
        for (let e = 0; e < emptyRowsCount; e++) {
          allRowItems.push({
            serial: '',
            memberName: '',
            address: '',
            memberClass: '',
          });
        }
      }
    }

    // Default 18 rows per page in landscape, 22 in portrait, or customRows (up to 30)
    const defaultPageSize = orientation === 'Landscape' ? 18 : 22;
    const pageSize = customRows ? Math.min(30, Math.max(4, customRows)) : defaultPageSize;
    const totalPages = Math.max(1, Math.ceil(allRowItems.length / pageSize));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) {
        builder.addNewPage();
      }

      // Header
      if (orientation === 'Landscape') {
        builder.drawExcelHeaderLandscape('FORM J: LIST OF MEMBERS');
      } else {
        builder.drawExcelHeader('FORM J: LIST OF MEMBERS');
      }

      // Table header (Fixed at 7.25 pt)
      const headerHeight = 28;
      builder.drawTableHeader(cols, headerHeight);

      // Column number row
      builder.drawColumnNumberRow(cols, 16);

      // Calculate row height to balance the page perfectly
      const usableHeight = builder.currentY - builder.marginBottom - 2;
      const rowHeight = Math.max(16, Math.floor(usableHeight / pageSize));

      const pageRows = allRowItems.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);

      for (let r = 0; r < pageSize; r++) {
        const item = pageRows[r];

        const cells: CellDef[] = [
          { text: item ? item.serial : '', width: cols[0].width, align: 'center', bold: true, fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.memberName : '', width: cols[1].width, align: 'left', bold: item?.isNameBold ?? true, fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.address : '', width: cols[2].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.memberClass : '', width: cols[3].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
        ];

        builder.drawTableRow(cells, rowHeight, dataFontSize);
      }
    }

    return await builder.buildBuffer();
  }
}
