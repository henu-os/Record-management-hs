// ============================================================
// Form J Layout Definition (Portrait + Landscape)
// Excel Authority: "Form J - Portrait" and "Form J - Landscape" sheets
// 4 columns: Sr. No., Full Name (stacked 1-6), Address, Class of Members
// ============================================================

import { ColumnDef } from '../PdfDocumentBuilder';

export interface FormJDefinitionType {
  orientation: 'Portrait';
  title: string;
  columns: ColumnDef[];
  landscapeColumns: ColumnDef[];
}

export const FormJDefinition: FormJDefinitionType = {
  orientation: 'Portrait',
  title: 'FORM "J" LIST OF MEMBERS',
  columns: [
    { id: 'srNo', header: 'Serial No.', width: 32, align: 'center', fontSize: 7.5 },
    { id: 'name', header: 'Full Name of the Member', width: 145, align: 'center', fontSize: 7.5 },
    { id: 'addr', header: 'Address', width: 225, align: 'center', fontSize: 7.5 },
    { id: 'class', header: 'Class of Member', width: 70, align: 'center', fontSize: 7.5 },
  ],
  landscapeColumns: [
    { id: 'srNo', header: 'Serial No.', width: 45, align: 'center', fontSize: 7.5 },
    { id: 'name', header: 'Full Name of the Member', width: 260, align: 'center', fontSize: 7.5 },
    { id: 'addr', header: 'Address', width: 470, align: 'center', fontSize: 7.5 },
    { id: 'class', header: 'Class of Member', width: 125, align: 'center', fontSize: 7.5 },
  ],
};
