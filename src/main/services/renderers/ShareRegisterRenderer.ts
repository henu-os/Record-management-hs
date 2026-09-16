// ============================================================
// HENU OS — Share Register Renderer (Landscape, Legal Paper)
// Supports:
//  - Template 1: 15_COLUMN (Compact) — Removes Old Cert, Old Membership, Distinctive Nos
//  - Template 2: 19_COLUMN (Full)    — Complete Register with Old Cert & Distinctive Nos
//  - Dynamic joint member rows based on active names in Excel (1 to 6)
//  - User-selectable empty rows per entry (0 to 6, default 0)
//  - Adjustable scraped data font size (7.5 to 12.5 pt) & text color
//  - Locked 14 rows per page with balanced height to eliminate bottom blank space
// ============================================================

import { ShareRecord, SocietyMaster, FormDesignSettings } from '../../types';
import { PdfDocumentBuilder, CellDef } from './PdfDocumentBuilder';
import {
  ShareRegister15ColDefinition,
  ShareRegister19ColDefinition,
  ShareRegisterTemplateId,
} from './definitions/ShareRegisterDefinition';

export interface ShareRegisterRenderOptions {
  orientationOverride?: 'Portrait' | 'Landscape';
  settings?: FormDesignSettings;
  renderMode?: 'Color' | 'BW';
  gridOn?: boolean;
  templateId?: ShareRegisterTemplateId;
  emptyRows?: number; // 0 to 6
  dataFontSize?: number; // 7.5 to 12.5 pt
  dataTextColor?: string; // hex color for input data
}

export class ShareRegisterRenderer {
  static async render(
    records: { serial: string; record: ShareRecord | null }[],
    society: SocietyMaster | null,
    options?: ShareRegisterRenderOptions | 'Portrait' | 'Landscape',
    settingsParam?: FormDesignSettings
  ): Promise<Buffer> {
    const isOptionsObj = typeof options === 'object';
    const orientationOverride = typeof options === 'string' ? options : options?.orientationOverride;
    const settings = isOptionsObj ? options?.settings : settingsParam;
    const renderMode = isOptionsObj ? options?.renderMode : undefined;
    const gridOn = isOptionsObj ? options?.gridOn : undefined;
    const templateId: ShareRegisterTemplateId = (isOptionsObj && options?.templateId) ? options.templateId : '19_COLUMN';
    const emptyRowsCount: number = Math.max(0, Math.min(6, (isOptionsObj && typeof options?.emptyRows === 'number') ? options.emptyRows : 0));

    // Data font size (limit 7.5 to 12.5 pt, default 8.5 pt)
    const dataFontSize: number = Math.max(
      7.5,
      Math.min(12.5, (isOptionsObj && typeof options?.dataFontSize === 'number') ? options.dataFontSize : 8.5)
    );

    // Data text color (customizable, default deep navy in Color mode, black in BW)
    const rawColor = isOptionsObj && options?.dataTextColor ? options.dataTextColor : undefined;
    const dataTextColor = renderMode === 'BW' ? '#000000' : (rawColor || '#002060');

    // Merge font size & color into builder settings while keeping header font size fixed
    const mergedSettings: Partial<FormDesignSettings> = {
      ...(settings || {}),
      fontSize: dataFontSize,
      bodyFontSize: dataFontSize,
      textColor: dataTextColor,
    };

    // Choose definition based on selected template
    const def = templateId === '19_COLUMN' ? ShareRegister19ColDefinition : ShareRegister15ColDefinition;
    const is19Col = templateId === '19_COLUMN';

    const builder = await PdfDocumentBuilder.create({
      orientation: orientationOverride || def.orientation,
      title: def.title,
      society,
      settings: mergedSettings as FormDesignSettings,
      renderMode,
      gridOn,
    });

    // Scale columns to fill 100% of available content width
    const availW = builder.contentWidth;
    const baseW = def.flatColumns.reduce((sum, c) => sum + c.width, 0);
    const scale = availW / baseW;
    const flatCols = def.flatColumns.map(c => ({ ...c, width: c.width * scale }));
    const groups = def.headerGroups.map(g => ({
      ...g,
      columns: g.columns.map(c => ({ ...c, width: c.width * scale })),
    }));

    const MAX_ROWS_PER_PAGE = 18;
    const headerHeight = 38;
    const colNumHeight = 14;

    // Helper to start a fresh page with full header & column numbering (fixed header styling)
    const startPage = () => {
      builder.drawExcelHeaderLandscape('SHARE REGISTER');
      builder.drawTwoTierHeader(groups, headerHeight);
      builder.drawColumnNumberRow(flatCols, colNumHeight);
    };

    startPage();

    // Calculate row height to span the entire page evenly down to the bottom margin (no blank void)
    const usableHeight = builder.currentY - builder.marginBottom - 6;
    const rowHeight = Math.max(18, Math.floor(usableHeight / MAX_ROWS_PER_PAGE));

    let rowsOnPage = 0;

    // Function to pad any remaining rows up to 18 on current page
    const padCurrentPageTo18 = () => {
      while (rowsOnPage < MAX_ROWS_PER_PAGE) {
        const emptyCells: CellDef[] = flatCols.map(c => ({ text: '', width: c.width, align: 'center' as const }));
        builder.drawTableRow(emptyCells, rowHeight, dataFontSize);
        rowsOnPage++;
      }
    };

    // Loop through each entry and render dynamic member rows + requested empty rows
    for (let rIdx = 0; rIdx < records.length; rIdx++) {
      const item = records[rIdx];
      const serial = item ? item.serial : '';
      const rec = item ? item.record : null;

      // Extract all active member names present in Excel (1 to 6)
      let names: string[] = [];
      if (rec) {
        const direct = [rec.member1, rec.member2, rec.member3, rec.member4, rec.member5, rec.member6]
          .map(m => (m ? String(m).trim() : ''))
          .filter(Boolean);

        if (direct.length > 0) {
          names = direct;
        } else if (rec.memberName) {
          names = rec.memberName.split(/[\/\+\,]/).map(s => s.trim()).filter(Boolean);
        }
      }
      if (names.length === 0) {
        names = [''];
      }

      const numNameRows = names.length;
      const totalEntryRows = numNameRows + emptyRowsCount;

      // If this entry cannot fit on the current page, pad to 18 and start a new page
      if (rowsOnPage > 0 && rowsOnPage + totalEntryRows > MAX_ROWS_PER_PAGE) {
        padCurrentPageTo18();
        builder.addNewPage();
        startPage();
        rowsOnPage = 0;
      }

      // Unit / Flat Address
      let unitText = '';
      if (rec) {
        const flat = rec.flatNo ? String(rec.flatNo).trim() : '';
        const wing = rec.wingNo ? String(rec.wingNo).trim() : '';
        const parts = [flat, wing].filter(Boolean);
        unitText = parts.join(', ') || rec.descriptionOfTenement || '';
      }

      // ── Sub-row 0: Main Populated Data Row ──
      let mainCells: CellDef[] = [];
      if (is19Col) {
        mainCells = [
          { text: serial,                                                                   width: flatCols[0].width,  align: 'center', bold: true, fontSize: dataFontSize },
          { text: rec?.dateOfAllotment || '',                                               width: flatCols[1].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.cashBookFolio || '',                                                 width: flatCols[2].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.shareCertificateNo || rec?.serialNoOfShareCertificate || '',         width: flatCols[3].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.noOfShares || '',                                                    width: flatCols[4].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.valueOfShares || rec?.totalAmountReceived || '',                     width: flatCols[5].width,  align: 'right',  fontSize: dataFontSize },
          { text: names[0] || '',                                                           width: flatCols[6].width,  align: 'left', bold: true, fontSize: dataFontSize },
          { text: unitText,                                                                 width: flatCols[7].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.dateOfTransferRefund || rec?.transferDate || '',                     width: flatCols[8].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.noOfSharesTransferred || rec?.noOfSharesTransferredRefunded || '',   width: flatCols[9].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.transferCertificateNo || rec?.shareCertTransferred || '',           width: flatCols[10].width, align: 'center', fontSize: dataFontSize },
          { text: rec?.sharesValueTransferred || '',                                        width: flatCols[11].width, align: 'right',  fontSize: dataFontSize },
          { text: rec?.nameOfTransferee || '',                                              width: flatCols[12].width, align: 'left',   fontSize: dataFontSize },
          { text: rec?.authorityForTransfer || '',                                          width: flatCols[13].width, align: 'center', fontSize: dataFontSize },
          { text: (rec as any)?.oldShareCertNo || '',                                       width: flatCols[14].width, align: 'center', fontSize: dataFontSize },
          { text: (rec as any)?.oldMembershipNo || '',                                      width: flatCols[15].width, align: 'center', fontSize: dataFontSize },
          { text: rec?.sharesFrom || '',                                                    width: flatCols[16].width, align: 'center', fontSize: dataFontSize },
          { text: rec?.sharesTo || '',                                                      width: flatCols[17].width, align: 'center', fontSize: dataFontSize },
          { text: rec?.remarks || '',                                                       width: flatCols[18].width, align: 'left',   fontSize: dataFontSize },
        ];
      } else {
        // 15-Column Compact Row
        mainCells = [
          { text: serial,                                                                   width: flatCols[0].width,  align: 'center', bold: true, fontSize: dataFontSize },
          { text: rec?.dateOfAllotment || '',                                               width: flatCols[1].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.cashBookFolio || '',                                                 width: flatCols[2].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.shareCertificateNo || rec?.serialNoOfShareCertificate || '',         width: flatCols[3].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.noOfShares || '',                                                    width: flatCols[4].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.valueOfShares || rec?.totalAmountReceived || '',                     width: flatCols[5].width,  align: 'right',  fontSize: dataFontSize },
          { text: names[0] || '',                                                           width: flatCols[6].width,  align: 'left', bold: true, fontSize: dataFontSize },
          { text: unitText,                                                                 width: flatCols[7].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.dateOfTransferRefund || rec?.transferDate || '',                     width: flatCols[8].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.noOfSharesTransferred || rec?.noOfSharesTransferredRefunded || '',   width: flatCols[9].width,  align: 'center', fontSize: dataFontSize },
          { text: rec?.transferCertificateNo || rec?.shareCertTransferred || '',           width: flatCols[10].width, align: 'center', fontSize: dataFontSize },
          { text: rec?.sharesValueTransferred || '',                                        width: flatCols[11].width, align: 'right',  fontSize: dataFontSize },
          { text: rec?.nameOfTransferee || '',                                              width: flatCols[12].width, align: 'left',   fontSize: dataFontSize },
          { text: rec?.authorityForTransfer || '',                                          width: flatCols[13].width, align: 'center', fontSize: dataFontSize },
          { text: rec?.remarks || '',                                                       width: flatCols[14].width, align: 'left',   fontSize: dataFontSize },
        ];
      }

      builder.drawTableRow(mainCells, rowHeight, dataFontSize);
      rowsOnPage++;

      // ── Sub-rows 1 to (numNameRows - 1): Follow-up joint member name rows ──
      for (let subIdx = 1; subIdx < numNameRows; subIdx++) {
        const subCells: CellDef[] = flatCols.map((c, colIdx) => {
          if (colIdx === 6) {
            return { text: names[subIdx] || '', width: c.width, align: 'left' as const, bold: true, fontSize: dataFontSize };
          }
          return { text: '', width: c.width, align: 'center' as const, fontSize: dataFontSize };
        });
        builder.drawTableRow(subCells, rowHeight, dataFontSize);
        rowsOnPage++;
      }

      // ── Sub-rows: Empty spacer rows as configured by user (0 to 6) ──
      for (let eIdx = 0; eIdx < emptyRowsCount; eIdx++) {
        const emptyCells: CellDef[] = flatCols.map(c => ({ text: '', width: c.width, align: 'center' as const, fontSize: dataFontSize }));
        builder.drawTableRow(emptyCells, rowHeight, dataFontSize);
        rowsOnPage++;
      }
    }

    // Pad last page to 18 rows so every page has a complete, clean grid down to the footer
    padCurrentPageTo18();

    return await builder.buildBuffer();
  }
}
