// ============================================================
// Share Register Layout Definition (Landscape)
// Supports 2 Official Templates:
// 1. 15_COLUMN (Compact) — Removes Old Share Cert, Old Membership, Distinctive Nos
// 2. 19_COLUMN (Full)    — Complete 19-Column Register with Old Cert & Distinctive Nos
// Header font sizes increased to 7.25 pt (+0.75) for maximum clarity
// Share Cert No & Cert Transferred column widths widened to fit serial numbers perfectly
// ============================================================

import { ColumnDef, HeaderGroupDef } from '../PdfDocumentBuilder';

export interface ShareRegisterDefinitionType {
  orientation: 'Landscape';
  title: string;
  headerGroups: HeaderGroupDef[];
  flatColumns: ColumnDef[];
}

export type ShareRegisterTemplateId = '15_COLUMN' | '19_COLUMN';

const HEADER_FS = 7.25;

// ── Template 1: 15-Column Compact (Default) ─────────────────
export const ShareRegister15ColDefinition: ShareRegisterDefinitionType = {
  orientation: 'Landscape',
  title: 'SHARE REGISTER',

  headerGroups: [
    { header: '', columns: [{ id: 'srNo', header: 'Sr.\nNo.', width: 28.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'allotDate', header: 'Date of\nAllotment', width: 44.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'cashBookFolio', header: 'Cash Book\nFolio No.', width: 38.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'shareCertNo', header: 'Share Cert.\nNo.', width: 56.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'noOfShares', header: 'No. of\nShares', width: 34.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'valueOfShares', header: 'Value of\nShares Rs.', width: 36.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'memberName', header: 'Name of Member\nallotted to', width: 132.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'unitNo', header: 'Flat / Shop /\nOffice No.', width: 56.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'transferDate', header: 'Date of Transfer\n/ Refund', width: 44.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'noTransferred', header: 'No. Transferred\n/ Refunded', width: 34.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'certTransferred', header: 'Cert. No.\nTransferred', width: 56.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'valTransferred', header: 'Shares Value\nTransferred', width: 36.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'transfereeName', header: 'Transferee\nName', width: 120.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'authority', header: 'Authority', width: 42.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'remarks', header: 'Remarks', width: 42.0, align: 'center', fontSize: HEADER_FS }] },
  ],

  flatColumns: [
    { id: 'srNo', header: 'Sr. No.', width: 28.0, align: 'center', fontSize: HEADER_FS },
    { id: 'allotDate', header: 'Date of allotment', width: 44.0, align: 'center', fontSize: HEADER_FS },
    { id: 'cashBookFolio', header: 'Cash Book Folio No.', width: 38.0, align: 'center', fontSize: HEADER_FS },
    { id: 'shareCertNo', header: 'Share Certificate No.', width: 56.0, align: 'center', fontSize: HEADER_FS },
    { id: 'noOfShares', header: 'No. of Shares', width: 34.0, align: 'center', fontSize: HEADER_FS },
    { id: 'valueOfShares', header: 'Value of Shares Rs.', width: 36.0, align: 'center', fontSize: HEADER_FS },
    { id: 'memberName', header: 'Name of Member allotted to', width: 132.0, align: 'left', fontSize: HEADER_FS },
    { id: 'unitNo', header: 'Flat / Shop / Office No.', width: 56.0, align: 'center', fontSize: HEADER_FS },
    { id: 'transferDate', header: 'Date of transfer / Refund', width: 44.0, align: 'center', fontSize: HEADER_FS },
    { id: 'noTransferred', header: 'No. Transferred / Refunded', width: 34.0, align: 'center', fontSize: HEADER_FS },
    { id: 'certTransferred', header: 'Cert. No. Transferred / Refunded', width: 56.0, align: 'center', fontSize: HEADER_FS },
    { id: 'valTransferred', header: 'Shares Value Transferred / Refunded', width: 36.0, align: 'center', fontSize: HEADER_FS },
    { id: 'transfereeName', header: 'Transferee Name', width: 120.0, align: 'left', fontSize: HEADER_FS },
    { id: 'authority', header: 'Authority', width: 42.0, align: 'center', fontSize: HEADER_FS },
    { id: 'remarks', header: 'Remarks', width: 42.0, align: 'center', fontSize: HEADER_FS },
  ],
};

// ── Template 2: 19-Column Full Register (Includes Old & Distinctive Nos) ──
export const ShareRegister19ColDefinition: ShareRegisterDefinitionType = {
  orientation: 'Landscape',
  title: 'SHARE REGISTER',

  headerGroups: [
    { header: '', columns: [{ id: 'srNo', header: 'Sr.\nNo.', width: 28.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'allotDate', header: 'Date of\nAllotment', width: 42.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'cashBookFolio', header: 'Cash Book\nFolio No.', width: 36.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'shareCertNo', header: 'Share Cert.\nNo.', width: 50.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'noOfShares', header: 'No. of\nShares', width: 32.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'valueOfShares', header: 'Value of\nShares Rs.', width: 34.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'memberName', header: 'Name of Member\nallotted to', width: 108.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'unitNo', header: 'Flat / Shop /\nOffice No.', width: 52.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'transferDate', header: 'Date of Transfer\n/ Refund', width: 42.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'noTransferred', header: 'No. Transferred\n/ Refunded', width: 34.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'certTransferred', header: 'Cert. No.\nTransferred', width: 50.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'valTransferred', header: 'Shares Value\nTransferred', width: 34.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'transfereeName', header: 'Transferee\nName', width: 108.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'authority', header: 'Authority', width: 40.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'oldShareCertNo', header: 'Old Share\nCert. No.', width: 44.0, align: 'center', fontSize: HEADER_FS }] },
    { header: '', columns: [{ id: 'oldMembershipNo', header: 'Old Member-\nship No.', width: 36.0, align: 'center', fontSize: HEADER_FS }] },
    {
      header: 'Share\nDistinctive Nos.',
      columns: [
        { id: 'distFrom', header: 'From', width: 24.0, align: 'center', fontSize: HEADER_FS },
        { id: 'distTo', header: 'To', width: 24.0, align: 'center', fontSize: HEADER_FS },
      ],
    },
    { header: '', columns: [{ id: 'remarks', header: 'Remarks', width: 34.0, align: 'center', fontSize: HEADER_FS }] },
  ],

  flatColumns: [
    { id: 'srNo', header: 'Sr. No.', width: 28.0, align: 'center', fontSize: HEADER_FS },
    { id: 'allotDate', header: 'Date of allotment', width: 42.0, align: 'center', fontSize: HEADER_FS },
    { id: 'cashBookFolio', header: 'Cash Book Folio No.', width: 36.0, align: 'center', fontSize: HEADER_FS },
    { id: 'shareCertNo', header: 'Share Certificate No.', width: 50.0, align: 'center', fontSize: HEADER_FS },
    { id: 'noOfShares', header: 'No. of Shares', width: 32.0, align: 'center', fontSize: HEADER_FS },
    { id: 'valueOfShares', header: 'Value of Shares Rs.', width: 34.0, align: 'center', fontSize: HEADER_FS },
    { id: 'memberName', header: 'Name of Member allotted to', width: 108.0, align: 'left', fontSize: HEADER_FS },
    { id: 'unitNo', header: 'Flat / Shop / Office No.', width: 52.0, align: 'center', fontSize: HEADER_FS },
    { id: 'transferDate', header: 'Date of transfer / Refund', width: 42.0, align: 'center', fontSize: HEADER_FS },
    { id: 'noTransferred', header: 'No. Transferred / Refunded', width: 34.0, align: 'center', fontSize: HEADER_FS },
    { id: 'certTransferred', header: 'Cert. No. Transferred / Refunded', width: 50.0, align: 'center', fontSize: HEADER_FS },
    { id: 'valTransferred', header: 'Shares Value Transferred / Refunded', width: 34.0, align: 'center', fontSize: HEADER_FS },
    { id: 'transfereeName', header: 'Transferee Name', width: 108.0, align: 'left', fontSize: HEADER_FS },
    { id: 'authority', header: 'Authority', width: 40.0, align: 'center', fontSize: HEADER_FS },
    { id: 'oldShareCertNo', header: 'Old Share Cert. No.', width: 44.0, align: 'center', fontSize: HEADER_FS },
    { id: 'oldMembershipNo', header: 'Old Membership No.', width: 36.0, align: 'center', fontSize: HEADER_FS },
    { id: 'distFrom', header: 'From', width: 24.0, align: 'center', fontSize: HEADER_FS },
    { id: 'distTo', header: 'To', width: 24.0, align: 'center', fontSize: HEADER_FS },
    { id: 'remarks', header: 'Remarks', width: 34.0, align: 'center', fontSize: HEADER_FS },
  ],
};

export const ShareRegisterDefinition = ShareRegister15ColDefinition;
