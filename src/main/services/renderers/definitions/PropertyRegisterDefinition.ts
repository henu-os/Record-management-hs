// ============================================================
// Property Register Layout Definition (Landscape)
// Excel Authority: "Property Register" sheet
// 13 columns: A-M with 2-tier header groups
// ============================================================

import { ColumnDef } from '../PdfDocumentBuilder';
import { HeaderGroupDef } from '../PdfDocumentBuilder';

export interface PropertyRegisterDefinitionType {
  orientation: 'Landscape';
  title: string;
  headerGroups: HeaderGroupDef[];
  flatColumns: ColumnDef[];
}

// Excel column widths: 6.64, 36.36, 12.36, 8.64, 9.64, 17.5, 13.64, 10.21, 11.5, 10.07, 12.21, 18.21, 24.64
// Total: 191.61 → proportionally scaled to PDF content width at render time.
export const PropertyRegisterDefinition: PropertyRegisterDefinitionType = {
  orientation: 'Landscape',
  title: 'PROPERTY REGISTER',
  headerGroups: [
    { header: '', columns: [{ id: 'srNo',     header: 'Sr.\nNo.',                                     width: 29, align: 'center', fontSize: 6.5 }] },
    { header: '', columns: [{ id: 'member',   header: 'Name of\nCo-partner\nMember',                  width: 158, align: 'center', fontSize: 6.5 }] },
    { header: '', columns: [{ id: 'possDate', header: 'Date of\nPossession',                          width: 54, align: 'center', fontSize: 6.5 }] },
    {
      header: 'Distinguishing No. of Tenement',
      columns: [
        { id: 'flatNo', header: 'Flat No.',  width: 38, align: 'center', fontSize: 6 },
        { id: 'floor',  header: 'Floor No.', width: 42, align: 'center', fontSize: 6 },
      ],
    },
    { header: '', columns: [{ id: 'desc',     header: 'Description\nof Tenement',                     width: 76, align: 'center', fontSize: 6.5 }] },
    { header: '', columns: [{ id: 'area',     header: 'Area of\nTenement',                            width: 59, align: 'center', fontSize: 6.5 }] },
    {
      header: 'Cost of Tenement',
      columns: [
        { id: 'landCost',  header: 'Land Rs.',   width: 44, align: 'center', fontSize: 6 },
        { id: 'constCost', header: 'Const .Rs.', width: 50, align: 'center', fontSize: 6 },
      ],
    },
    { header: '', columns: [{ id: 'rent',     header: 'Annual\nGround\nRent Rs.',                     width: 44, align: 'center', fontSize: 6.5 }] },
    { header: '', columns: [{ id: 'cessDate', header: 'Date of\nCessation of\nMembership',            width: 53, align: 'center', fontSize: 6.5 }] },
    { header: '', columns: [{ id: 'sig',      header: 'Signature Chairman /\nHon. Secretary /',       width: 79, align: 'center', fontSize: 6.5 }] },
    { header: '', columns: [{ id: 'remark',   header: ' Remarks (Reason of Cessation /\nTransfer to Sr. No. and Date)', width: 107, align: 'center', fontSize: 6.5 }] },
  ],
  flatColumns: [
    { id: 'srNo',     header: 'Sr.\nNo.',                          width: 29,  align: 'center' },
    { id: 'member',   header: 'Name of\nCo-partner\nMember',      width: 158, align: 'center' },
    { id: 'possDate', header: 'Date of\nPossession',               width: 54,  align: 'center' },
    { id: 'flatNo',   header: 'Flat No.',                          width: 38,  align: 'center' },
    { id: 'floor',    header: 'Floor No.',                         width: 42,  align: 'center' },
    { id: 'desc',     header: 'Description\nof Tenement',          width: 76,  align: 'center' },
    { id: 'area',     header: 'Area of\nTenement',                 width: 59,  align: 'center' },
    { id: 'landCost', header: 'Land Rs.',                          width: 44,  align: 'center' },
    { id: 'constCost', header: 'Const .Rs.',                       width: 50,  align: 'center' },
    { id: 'rent',     header: 'Annual\nGround\nRent Rs.',          width: 44,  align: 'center' },
    { id: 'cessDate', header: 'Date of\nCessation of\nMembership', width: 53,  align: 'center' },
    { id: 'sig',      header: 'Signature Chairman /\nHon. Secretary /', width: 79, align: 'center' },
    { id: 'remark',   header: 'Remarks',                           width: 107, align: 'center' },
  ],
};
