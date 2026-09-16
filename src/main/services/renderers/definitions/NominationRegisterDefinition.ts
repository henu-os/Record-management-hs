// ============================================================
// Nomination Register Layout Definition (Landscape)
// Authority: Column widths tailored for 6 joint member names
// and balanced date/percentage column proportions.
// ============================================================

import { ColumnDef } from '../PdfDocumentBuilder';

export interface NominationRegisterDefinitionType {
  orientation: 'Landscape';
  title: string;
  columns: ColumnDef[];
}

export const NominationRegisterDefinition: NominationRegisterDefinitionType = {
  orientation: 'Landscape',
  title: 'REGISTER OF NOMINATION',
  columns: [
    { id: 'srNo', header: 'Sr. No.', width: 34, align: 'center', fontSize: 7.5 },
    { id: 'member', header: 'Member Name', width: 175, align: 'center', fontSize: 7.5 },
    { id: 'flatWing', header: 'Flat / Wing', width: 65, align: 'center', fontSize: 7.5 },
    { id: 'nomDate', header: 'Date of\nNomination', width: 60, align: 'center', fontSize: 7.0 },
    { id: 'nominee', header: 'Name/s of Nominee/s & Address/es of the Nominee/s', width: 215, align: 'center', fontSize: 7.5 },
    { id: 'percentage', header: 'Percentage %', width: 55, align: 'center', fontSize: 7.0 },
    { id: 'mcDate', header: 'Managing\nCommittee\nMeeting Date', width: 65, align: 'center', fontSize: 7.0 },
    { id: 'revokeDate', header: 'Revocation\nDate', width: 60, align: 'center', fontSize: 7.0 },
    { id: 'remarks', header: 'Remarks', width: 100, align: 'center', fontSize: 7.5 },
  ],
};
