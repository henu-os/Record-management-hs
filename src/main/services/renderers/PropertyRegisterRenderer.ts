// ============================================================
// HENU OS — Property Register Renderer (Landscape, Legal Paper)
// Excel Authority: "Property Register" sheet — 13 columns, 2-tier header
// ============================================================

import { PropertyRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { PdfDocumentBuilder, CellDef } from './PdfDocumentBuilder';
import { PropertyRegisterDefinition } from './definitions/PropertyRegisterDefinition';
import { FormMappingService } from '../FormMappingService';

export class PropertyRegisterRenderer {
  static async render(
    records: { serial: string; record: PropertyRecord | null }[],
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
    const def = PropertyRegisterDefinition;
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
    const baseW = def.flatColumns.reduce((sum, c) => sum + c.width, 0);
    const scale = availW / baseW;
    const flatCols = def.flatColumns.map(c => ({ ...c, width: c.width * scale }));

    // Scale header groups
    const groups = def.headerGroups.map(g => ({
      ...g,
      columns: g.columns.map(c => ({ ...c, width: c.width * scale })),
    }));

    // Flatten all records into table rows (handling Template 1 vs Template 2)
    interface PropRowItem {
      serial: string;
      memberName: string;
      dateOfPossession: string;
      flatNo: string;
      floor: string;
      descriptionOfTenement: string;
      area: string;
      landCost: string;
      constCost: string;
      annualGroundRent: string;
      dateOfCessation: string;
      signature: string;
      remarks: string;
      isNameBold?: boolean;
    }

    const allRowItems: PropRowItem[] = [];

    for (const item of records) {
      const rec = item.record;
      const serial = item.serial || '';
      const rawRec = rec as any;
      const isBlankRec = !rec || (!rawRec.srNo && !rawRec.member1 && !rawRec.nameOfMember && !rawRec.memberName);

      if (isBlankRec) {
        allRowItems.push({
          serial,
          memberName: '',
          dateOfPossession: '',
          flatNo: '',
          floor: '',
          descriptionOfTenement: '',
          area: '',
          landCost: '',
          constCost: '',
          annualGroundRent: '',
          dateOfCessation: '',
          signature: '',
          remarks: '',
        });
        if (isTemplate2) {
          for (let e = 0; e < emptyRowsCount; e++) {
            allRowItems.push({
              serial: '', memberName: '', dateOfPossession: '', flatNo: '', floor: '',
              descriptionOfTenement: '', area: '', landCost: '', constCost: '',
              annualGroundRent: '', dateOfCessation: '', signature: '', remarks: '',
            });
          }
        }
        continue;
      }

      const landCost = rawRec?.landCost || (rawRec?.costOfTenement ? rawRec.costOfTenement : '');
      const constCost = rawRec?.constructionCost || '';

      if (!isTemplate2) {
        // TEMPLATE 1: Compact 1-Row per Property
        const allNames = FormMappingService.formatAllMemberNames(rec);
        allRowItems.push({
          serial,
          memberName: allNames,
          dateOfPossession: rec?.dateOfPossession || '',
          flatNo: rec?.flatNo || '',
          floor: rec?.floor || '',
          descriptionOfTenement: rec?.descriptionOfTenement || '',
          area: rec?.area || '',
          landCost,
          constCost,
          annualGroundRent: rec?.annualGroundRent || '',
          dateOfCessation: rec?.dateOfCessation || '',
          signature: rec?.signature || '',
          remarks: rec?.propertyRemarks || rec?.remarks || '',
          isNameBold: true,
        });

        // Configurable empty rows per entry (0-6)
        for (let e = 0; e < emptyRowsCount; e++) {
          allRowItems.push({
            serial: '',
            memberName: '',
            dateOfPossession: '',
            flatNo: '',
            floor: '',
            descriptionOfTenement: '',
            area: '',
            landCost: '',
            constCost: '',
            annualGroundRent: '',
            dateOfCessation: '',
            signature: '',
            remarks: '',
          });
        }
      } else {
        // TEMPLATE 2: Multi-Row Joint Members + Configurable Empty Rows
        let memberNamesList: string[] = [];
        if (rawRec) {
          const direct = [rawRec.member1, rawRec.member2, rawRec.member3, rawRec.member4, rawRec.member5, rawRec.member6]
            .map((m: any) => (m ? String(m).trim() : ''))
            .filter(Boolean);

          if (direct.length > 0) {
            memberNamesList = direct;
          } else if (rawRec.nameOfMember || rawRec.memberName) {
            const rawName = rawRec.nameOfMember || rawRec.memberName || '';
            memberNamesList = rawName.split(/[\/\+\,]/).map((s: string) => s.trim()).filter(Boolean);
          }
        }

        if (memberNamesList.length === 0) {
          memberNamesList = [''];
        }

        // First member row gets serial and property details
        allRowItems.push({
          serial,
          memberName: memberNamesList[0],
          dateOfPossession: rec?.dateOfPossession || '',
          flatNo: rec?.flatNo || '',
          floor: rec?.floor || '',
          descriptionOfTenement: rec?.descriptionOfTenement || '',
          area: rec?.area || '',
          landCost,
          constCost,
          annualGroundRent: rec?.annualGroundRent || '',
          dateOfCessation: rec?.dateOfCessation || '',
          signature: rec?.signature || '',
          remarks: rec?.propertyRemarks || rec?.remarks || '',
          isNameBold: true,
        });

        // Subsequent joint members (member2..member6)
        for (let mIdx = 1; mIdx < memberNamesList.length; mIdx++) {
          allRowItems.push({
            serial: '',
            memberName: memberNamesList[mIdx],
            dateOfPossession: '',
            flatNo: '',
            floor: '',
            descriptionOfTenement: '',
            area: '',
            landCost: '',
            constCost: '',
            annualGroundRent: '',
            dateOfCessation: '',
            signature: '',
            remarks: '',
            isNameBold: true,
          });
        }

        // Configurable empty rows per entry (0-6)
        for (let e = 0; e < emptyRowsCount; e++) {
          allRowItems.push({
            serial: '',
            memberName: '',
            dateOfPossession: '',
            flatNo: '',
            floor: '',
            descriptionOfTenement: '',
            area: '',
            landCost: '',
            constCost: '',
            annualGroundRent: '',
            dateOfCessation: '',
            signature: '',
            remarks: '',
          });
        }
      }
    }

    const pageSize = 18;
    const totalPages = Math.max(1, Math.ceil(allRowItems.length / pageSize));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) {
        builder.addNewPage();
      }

      // Excel header (4-row centered)
      builder.drawExcelHeader('PROPERTY REGISTER');

      // Two-tier table header
      const headerHeight = 36;
      builder.drawTwoTierHeader(groups, headerHeight);

      // Column number row (1-13)
      builder.drawColumnNumberRow(flatCols, 16);

      // Calculate row height
      const usableHeight = builder.currentY - builder.marginBottom - 2;
      const rowHeight = Math.max(18, Math.floor(usableHeight / pageSize));

      const pageRows = allRowItems.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);

      for (let r = 0; r < pageSize; r++) {
        const item = pageRows[r];

        const cells: CellDef[] = [
          { text: item ? item.serial : '',                               width: flatCols[0].width,  align: 'center', bold: true, fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.memberName : '',                           width: flatCols[1].width,  align: 'left', bold: item?.isNameBold ?? true, fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.dateOfPossession : '',                     width: flatCols[2].width,  align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.flatNo : '',                               width: flatCols[3].width,  align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.floor : '',                                width: flatCols[4].width,  align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.descriptionOfTenement : '',                width: flatCols[5].width,  align: 'left', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.area : '',                                 width: flatCols[6].width,  align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.landCost : '',                             width: flatCols[7].width,  align: 'right', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.constCost : '',                            width: flatCols[8].width,  align: 'right', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.annualGroundRent : '',                      width: flatCols[9].width,  align: 'right', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.dateOfCessation : '',                       width: flatCols[10].width, align: 'center', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.signature : '',                             width: flatCols[11].width, align: 'left', fontSize: dataFontSize, color: dataTextColor },
          { text: item ? item.remarks : '',                               width: flatCols[12].width, align: 'left', fontSize: dataFontSize, color: dataTextColor },
        ];

        builder.drawTableRow(cells, rowHeight, dataFontSize);
      }
    }

    return await builder.buildBuffer();
  }
}
