import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Edit3, Search, CheckCircle, Database, UserCheck, Save, FileText } from 'lucide-react';
import { ModuleId, NormalizedMemberRecord, VoucherRecord } from '../../main/types';
import { synchronizeMasterWorkbook, sanitizeAndCalculateVoucher } from '../../main/services/MasterDataService';
import SpreadsheetEditor from './SpreadsheetEditor';

interface Props {
  isOpen: boolean;
  moduleId?: ModuleId | string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditDataModal({ isOpen, moduleId, onClose, onSaved }: Props) {
  const [activeMode, setActiveMode] = useState<'spreadsheet' | 'quickForm'>('spreadsheet');

  // Search & Form Edit State
  const [searchSrNo, setSearchSrNo] = useState('');
  const [searchName, setSearchName] = useState('');

  const [records, setRecords] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [editingRecord, setEditingRecord] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const api = (window as any).api;

  const FORM_SCHEMAS: Record<string, { key: string; label: string; type?: string; required?: boolean }[]> = {
    '03_Form_I': [
      { key: 'srNo', label: 'Sr. No.', required: true },
      { key: 'dateOfAdmission', label: 'Date of Admission', type: 'date' },
      { key: 'dateOfEntranceFee', label: 'Date of Entrance Fee', type: 'date' },
      { key: 'member1', label: 'Member Name 1', required: true },
      { key: 'member2', label: 'Member Name 2' },
      { key: 'member3', label: 'Member Name 3' },
      { key: 'member4', label: 'Member Name 4' },
      { key: 'member5', label: 'Member Name 5' },
      { key: 'member6', label: 'Member Name 6' },
      { key: 'flatNo', label: 'Flat / Room / Shop / Gala No.' },
      { key: 'wingNo', label: 'Wing No.' },
      { key: 'residentialAddress', label: 'Residential Address' },
      { key: 'permanentAddress', label: 'Permanent Address' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'age', label: 'Age on Admission' },
      { key: 'nominee1', label: 'Nominee Name 1' },
      { key: 'nominee2', label: 'Nominee Name 2' },
      { key: 'nominee3', label: 'Nominee Name 3' },
      { key: 'nominee4', label: 'Nominee Name 4' },
      { key: 'nominee5', label: 'Nominee Name 5' },
      { key: 'nominee6', label: 'Nominee Name 6' },
      { key: 'nomineeAddress', label: 'Nominee Address' },
      { key: 'dateOfNomination', label: 'Date of Nomination', type: 'date' },
      { key: 'dateOfCessation', label: 'Date of Cessation', type: 'date' },
      { key: 'reasonForCessation', label: 'Reason for Cessation' },
      { key: 'remarks', label: 'Remarks' },

      // Shares Held (Entries 1 to 5)
      { key: 'sharesHeld_date_1', label: 'Shares Held: Date (Entry 1)', type: 'date' },
      { key: 'sharesHeld_cashBookFolio_1', label: 'Shares Held: Cash Book Folio 1' },
      { key: 'sharesHeld_application_1', label: 'Shares Held: Application Amt 1' },
      { key: 'sharesHeld_allotment_1', label: 'Shares Held: Allotment Amt 1' },
      { key: 'sharesHeld_call1st_1', label: 'Shares Held: 1st Call Amt 1' },
      { key: 'sharesHeld_call2nd_1', label: 'Shares Held: 2nd Call Amt 1' },
      { key: 'sharesHeld_totalAmountReceived_1', label: 'Shares Held: Total Amount Received 1' },
      { key: 'sharesHeld_noOfShares_1', label: 'Shares Held: No. of Shares 1' },
      { key: 'sharesHeld_sharesFrom_1', label: 'Shares Held: Distinctive From 1' },
      { key: 'sharesHeld_sharesTo_1', label: 'Shares Held: Distinctive To 1' },
      { key: 'sharesHeld_shareCertNo_1', label: 'Shares Held: Share Certificate No. 1' },

      { key: 'sharesHeld_date_2', label: 'Shares Held: Date (Entry 2)', type: 'date' },
      { key: 'sharesHeld_cashBookFolio_2', label: 'Shares Held: Cash Book Folio 2' },
      { key: 'sharesHeld_application_2', label: 'Shares Held: Application Amt 2' },
      { key: 'sharesHeld_allotment_2', label: 'Shares Held: Allotment Amt 2' },
      { key: 'sharesHeld_call1st_2', label: 'Shares Held: 1st Call Amt 2' },
      { key: 'sharesHeld_call2nd_2', label: 'Shares Held: 2nd Call Amt 2' },
      { key: 'sharesHeld_totalAmountReceived_2', label: 'Shares Held: Total Amount Received 2' },
      { key: 'sharesHeld_noOfShares_2', label: 'Shares Held: No. of Shares 2' },
      { key: 'sharesHeld_sharesFrom_2', label: 'Shares Held: Distinctive From 2' },
      { key: 'sharesHeld_sharesTo_2', label: 'Shares Held: Distinctive To 2' },
      { key: 'sharesHeld_shareCertNo_2', label: 'Shares Held: Share Certificate No. 2' },

      { key: 'sharesHeld_date_3', label: 'Shares Held: Date (Entry 3)', type: 'date' },
      { key: 'sharesHeld_cashBookFolio_3', label: 'Shares Held: Cash Book Folio 3' },
      { key: 'sharesHeld_application_3', label: 'Shares Held: Application Amt 3' },
      { key: 'sharesHeld_allotment_3', label: 'Shares Held: Allotment Amt 3' },
      { key: 'sharesHeld_call1st_3', label: 'Shares Held: 1st Call Amt 3' },
      { key: 'sharesHeld_call2nd_3', label: 'Shares Held: 2nd Call Amt 3' },
      { key: 'sharesHeld_totalAmountReceived_3', label: 'Shares Held: Total Amount Received 3' },
      { key: 'sharesHeld_noOfShares_3', label: 'Shares Held: No. of Shares 3' },
      { key: 'sharesHeld_sharesFrom_3', label: 'Shares Held: Distinctive From 3' },
      { key: 'sharesHeld_sharesTo_3', label: 'Shares Held: Distinctive To 3' },
      { key: 'sharesHeld_shareCertNo_3', label: 'Shares Held: Share Certificate No. 3' },

      { key: 'sharesHeld_date_4', label: 'Shares Held: Date (Entry 4)', type: 'date' },
      { key: 'sharesHeld_cashBookFolio_4', label: 'Shares Held: Cash Book Folio 4' },
      { key: 'sharesHeld_application_4', label: 'Shares Held: Application Amt 4' },
      { key: 'sharesHeld_allotment_4', label: 'Shares Held: Allotment Amt 4' },
      { key: 'sharesHeld_call1st_4', label: 'Shares Held: 1st Call Amt 4' },
      { key: 'sharesHeld_call2nd_4', label: 'Shares Held: 2nd Call Amt 4' },
      { key: 'sharesHeld_totalAmountReceived_4', label: 'Shares Held: Total Amount Received 4' },
      { key: 'sharesHeld_noOfShares_4', label: 'Shares Held: No. of Shares 4' },
      { key: 'sharesHeld_sharesFrom_4', label: 'Shares Held: Distinctive From 4' },
      { key: 'sharesHeld_sharesTo_4', label: 'Shares Held: Distinctive To 4' },
      { key: 'sharesHeld_shareCertNo_4', label: 'Shares Held: Share Certificate No. 4' },

      { key: 'sharesHeld_date_5', label: 'Shares Held: Date (Entry 5)', type: 'date' },
      { key: 'sharesHeld_cashBookFolio_5', label: 'Shares Held: Cash Book Folio 5' },
      { key: 'sharesHeld_application_5', label: 'Shares Held: Application Amt 5' },
      { key: 'sharesHeld_allotment_5', label: 'Shares Held: Allotment Amt 5' },
      { key: 'sharesHeld_call1st_5', label: 'Shares Held: 1st Call Amt 5' },
      { key: 'sharesHeld_call2nd_5', label: 'Shares Held: 2nd Call Amt 5' },
      { key: 'sharesHeld_totalAmountReceived_5', label: 'Shares Held: Total Amount Received 5' },
      { key: 'sharesHeld_noOfShares_5', label: 'Shares Held: No. of Shares 5' },
      { key: 'sharesHeld_sharesFrom_5', label: 'Shares Held: Distinctive From 5' },
      { key: 'sharesHeld_sharesTo_5', label: 'Shares Held: Distinctive To 5' },
      { key: 'sharesHeld_shareCertNo_5', label: 'Shares Held: Share Certificate No. 5' },

      // Shares Transferred (Entries 1 to 5)
      { key: 'sharesTransferred_date_1', label: 'Shares Transferred: Date (Entry 1)', type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_1', label: 'Shares Transferred: Folio 1' },
      { key: 'sharesTransferred_transferDate_1', label: 'Shares Transferred: Transfer Date 1', type: 'date' },
      { key: 'sharesTransferred_shareCertNo_1', label: 'Shares Transferred: Cert No 1' },
      { key: 'sharesTransferred_noOfShares_1', label: 'Shares Transferred: No. of Shares 1' },
      { key: 'sharesTransferred_balanceNoOfShares_1', label: 'Shares Transferred: Balance Shares 1' },
      { key: 'sharesTransferred_balanceCertNo_1', label: 'Shares Transferred: Balance Cert No 1' },
      { key: 'sharesTransferred_amountRs_1', label: 'Shares Transferred: Amount Rs 1' },
      { key: 'sharesTransferred_amountP_1', label: 'Shares Transferred: Amount P 1' },

      { key: 'sharesTransferred_date_2', label: 'Shares Transferred: Date (Entry 2)', type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_2', label: 'Shares Transferred: Folio 2' },
      { key: 'sharesTransferred_transferDate_2', label: 'Shares Transferred: Transfer Date 2', type: 'date' },
      { key: 'sharesTransferred_shareCertNo_2', label: 'Shares Transferred: Cert No 2' },
      { key: 'sharesTransferred_noOfShares_2', label: 'Shares Transferred: No. of Shares 2' },
      { key: 'sharesTransferred_balanceNoOfShares_2', label: 'Shares Transferred: Balance Shares 2' },
      { key: 'sharesTransferred_balanceCertNo_2', label: 'Shares Transferred: Balance Cert No 2' },
      { key: 'sharesTransferred_amountRs_2', label: 'Shares Transferred: Amount Rs 2' },
      { key: 'sharesTransferred_amountP_2', label: 'Shares Transferred: Amount P 2' },

      { key: 'sharesTransferred_date_3', label: 'Shares Transferred: Date (Entry 3)', type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_3', label: 'Shares Transferred: Folio 3' },
      { key: 'sharesTransferred_transferDate_3', label: 'Shares Transferred: Transfer Date 3', type: 'date' },
      { key: 'sharesTransferred_shareCertNo_3', label: 'Shares Transferred: Cert No 3' },
      { key: 'sharesTransferred_noOfShares_3', label: 'Shares Transferred: No. of Shares 3' },
      { key: 'sharesTransferred_balanceNoOfShares_3', label: 'Shares Transferred: Balance Shares 3' },
      { key: 'sharesTransferred_balanceCertNo_3', label: 'Shares Transferred: Balance Cert No 3' },
      { key: 'sharesTransferred_amountRs_3', label: 'Shares Transferred: Amount Rs 3' },
      { key: 'sharesTransferred_amountP_3', label: 'Shares Transferred: Amount P 3' },

      { key: 'sharesTransferred_date_4', label: 'Shares Transferred: Date (Entry 4)', type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_4', label: 'Shares Transferred: Folio 4' },
      { key: 'sharesTransferred_transferDate_4', label: 'Shares Transferred: Transfer Date 4', type: 'date' },
      { key: 'sharesTransferred_shareCertNo_4', label: 'Shares Transferred: Cert No 4' },
      { key: 'sharesTransferred_noOfShares_4', label: 'Shares Transferred: No. of Shares 4' },
      { key: 'sharesTransferred_balanceNoOfShares_4', label: 'Shares Transferred: Balance Shares 4' },
      { key: 'sharesTransferred_balanceCertNo_4', label: 'Shares Transferred: Balance Cert No 4' },
      { key: 'sharesTransferred_amountRs_4', label: 'Shares Transferred: Amount Rs 4' },
      { key: 'sharesTransferred_amountP_4', label: 'Shares Transferred: Amount P 4' },

      { key: 'sharesTransferred_date_5', label: 'Shares Transferred: Date (Entry 5)', type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_5', label: 'Shares Transferred: Folio 5' },
      { key: 'sharesTransferred_transferDate_5', label: 'Shares Transferred: Transfer Date 5', type: 'date' },
      { key: 'sharesTransferred_shareCertNo_5', label: 'Shares Transferred: Cert No 5' },
      { key: 'sharesTransferred_noOfShares_5', label: 'Shares Transferred: No. of Shares 5' },
      { key: 'sharesTransferred_balanceNoOfShares_5', label: 'Shares Transferred: Balance Shares 5' },
      { key: 'sharesTransferred_balanceCertNo_5', label: 'Shares Transferred: Balance Cert No 5' },
      { key: 'sharesTransferred_amountRs_5', label: 'Shares Transferred: Amount Rs 5' },
      { key: 'sharesTransferred_amountP_5', label: 'Shares Transferred: Amount P 5' },
    ],
    '04_Form_J': [
      { key: 'srNo', label: '1. Sr. No. *', required: true },
      { key: 'member1', label: '2. Member Name 1 *', required: true },
      { key: 'member2', label: '3. Member Name 2' },
      { key: 'member3', label: '4. Member Name 3' },
      { key: 'member4', label: '5. Member Name 4' },
      { key: 'member5', label: '6. Member Name 5' },
      { key: 'member6', label: '7. Member Name 6' },
      { key: 'permanentAddress', label: '8. Permanent Address' },
      { key: 'residentialAddress', label: '9. Residential Address' },
      { key: 'classOfMember', label: '10. Class of Member' },
    ],
    '05_Share_Register': [
      { key: 'srNo', label: 'Sr. No.', required: true },
      { key: 'member1', label: 'Member Name', required: true },
      { key: 'dateOfAllotment', label: 'Date of Allotment', type: 'date' },
      { key: 'cashBookFolio', label: 'Cash Book Folio' },
      { key: 'noOfShares', label: 'No. of Shares' },
      { key: 'sharesFrom', label: 'Distinctive From' },
      { key: 'sharesTo', label: 'Distinctive To' },
      { key: 'valueOfShares', label: 'Total Share Value' },
      { key: 'serialNoOfShareCertificate', label: 'Share Cert Serial' },
      { key: 'transferDate', label: 'Transfer Date', type: 'date' },
      { key: 'transferCashBookFolio', label: 'Transfer Folio' },
      { key: 'noOfSharesTransferred', label: 'Shares Transferred' },
      { key: 'transferCertificateNo', label: 'Transfer Cert No.' },
      { key: 'sharesValueTransferred', label: 'Value Transferred' },
      { key: 'nameOfTransferee', label: 'Name of Transferee' },
      { key: 'authorityForTransfer', label: 'Authority for Transfer' },
    ],
    '06_Nomination_Register': [
      { key: 'srNo', label: 'Sr. No.', required: true },
      { key: 'member1', label: 'Member Name', required: true },
      { key: 'flatNo', label: 'Flat No.' },
      { key: 'wingNo', label: 'Wing No.' },
      { key: 'dateOfNomination', label: 'Date of Nomination', type: 'date' },
      { key: 'nominee1', label: 'Nominee 1' },
      { key: 'nomineePercentage1', label: 'Percentage 1' },
      { key: 'nominee2', label: 'Nominee 2' },
      { key: 'nomineePercentage2', label: 'Percentage 2' },
      { key: 'nominee3', label: 'Nominee 3' },
      { key: 'nomineePercentage3', label: 'Percentage 3' },
      { key: 'nominee4', label: 'Nominee 4' },
      { key: 'nomineePercentage4', label: 'Percentage 4' },
      { key: 'nominee5', label: 'Nominee 5' },
      { key: 'nomineePercentage5', label: 'Percentage 5' },
      { key: 'nominee6', label: 'Nominee 6' },
      { key: 'nomineePercentage6', label: 'Percentage 6' },
      { key: 'mcMeetingDate', label: 'MC Meeting Date', type: 'date' },
      { key: 'subsequentRevocation', label: 'Subsequent Revocation' },
      { key: 'remarks', label: 'Remarks' },
    ],
    '07_Property_Register': [
      { key: 'srNo', label: 'Sr. No.', required: true },
      { key: 'member1', label: 'Member Name', required: true },
      { key: 'descriptionOfTenement', label: 'Description of Tenement' },
      { key: 'area', label: 'Area (sq ft)' },
      { key: 'costOfTenement', label: 'Cost of Tenement' },
      { key: 'annualGroundRent', label: 'Annual Ground Rent' },
    ],
    '08_Lien_Mark_Register': [
      { key: 'srNo', label: 'Sr. No.', required: true },
      { key: 'member1', label: 'Member Name', required: true },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'bankAddress', label: 'Bank Address' },
      { key: 'loanAmount', label: 'Loan Amount' },
      { key: 'loanPeriod', label: 'Loan Period' },
      { key: 'dateOfLienCancellation', label: 'Lien Cancellation Date', type: 'date' },
    ],
    '09_Share_Certificate': [
      { key: 'srNo', label: 'Sr. No.', required: true },
      { key: 'shareCertificateNo', label: 'Share Cert No.' },
      { key: 'membershipNo', label: 'Member Reg No.' },
      { key: 'noOfShares', label: 'No. of Shares' },
      { key: 'valueOfShares', label: 'Value of Shares' },
      { key: 'sharesFrom', label: 'Distinctive From' },
      { key: 'sharesTo', label: 'Distinctive To' },
      { key: 'wingNo', label: 'Wing' },
      { key: 'flatNo', label: 'Flat No.' },
      { key: 'member1', label: '1st Owner Name', required: true },
      { key: 'member2', label: '2nd Owner Name' },
      { key: 'member3', label: '3rd Owner Name' },
      { key: 'oldShareCertNo', label: 'Old Share Cert No.' },
      { key: 'dateOfAllotment', label: 'Date of Issue', type: 'date' },
      { key: 'remarks', label: 'Remarks' },
    ],
    '10_Voucher': [
      { key: 'voucherNo', label: 'Voucher No. *', required: true },
      { key: 'voucherDate', label: 'Voucher Date', type: 'date' },
      { key: 'toPayee', label: 'To (Payee) *', required: true },
      { key: 'chargeTo', label: 'Charge To' },
      { key: 'particulars', label: 'Particulars' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'chequeNo', label: 'Cheque No.' },
      { key: 'billNo', label: 'Bill No.' },
      { key: 'billAmount', label: 'Bill Amount' },
      { key: 'billAmount2', label: 'Bill Amount 2' },
      { key: 'advLessPaid', label: 'Adv. Less/Paid' },
      { key: 'subTotal1', label: 'Sub Total 1' },
      { key: 'tdsPercent', label: 'TDS %' },
      { key: 'tdsAmount', label: 'TDS Amount' },
      { key: 'subTotal2', label: 'Sub Total 2' },
      { key: 'cgstPercent', label: 'CGST %' },
      { key: 'cgstAmount', label: 'CGST Amount' },
      { key: 'sgstPercent', label: 'SGST %' },
      { key: 'sgstAmount', label: 'SGST Amount' },
      { key: 'roundOff', label: 'Round Off (+/-)' },
      { key: 'otherFineAdj', label: 'Other (Fine/Adj)' },
      { key: 'netPaid', label: 'Net Paid (Voucher) *', required: true },
      { key: 'societyName', label: 'Society Name' },
      { key: 'socNumber', label: 'SOC-Number' },
      { key: 'societyAddress', label: 'Society Address' },
    ],
  };

  const MODULE_TITLES: Record<string, string> = {
    SOCIETY_MASTER: 'Society Master',
    COMMON_MEMBER_MASTER: 'Common Member Master',
    FORM_I: 'Form I — Register of Members',
    FORM_J: 'Form J — List of Members',
    FORM_SHARE: 'Share Register',
    FORM_NOM: 'Nomination Register',
    FORM_PROP: 'Property Register',
    FORM_BANK: 'Bank Lien Mark Register',
    FORM_SHARE_CERT: 'Share Certificate (13x19)',
    FORM_VOUCHER: 'Payment Voucher Register',
    formI: 'Form I — Register of Members',
    formJ: 'Form J — List of Members',
    share: 'Share Register',
    nomination: 'Nomination Register',
    property: 'Property Register',
    bankLineMark: 'Bank Lien Mark Register',
    shareCert: 'Share Certificate (13x19)',
    voucher: 'Payment Voucher Register',
  };

  const MODULE_SHEET_MAP: Record<string, string> = {
    SOCIETY_MASTER: '01_Society_Master',
    COMMON_MEMBER_MASTER: '02_Common_Member_Master',
    FORM_I: '03_Form_I',
    FORM_J: '04_Form_J',
    FORM_SHARE: '05_Share_Register',
    FORM_NOM: '06_Nomination_Register',
    FORM_PROP: '07_Property_Register',
    FORM_BANK: '08_Lien_Mark_Register',
    FORM_SHARE_CERT: '09_Share_Certificate',
    FORM_VOUCHER: '10_Voucher',
    formI: '03_Form_I',
    formJ: '04_Form_J',
    share: '05_Share_Register',
    nomination: '06_Nomination_Register',
    property: '07_Property_Register',
    bankLineMark: '08_Lien_Mark_Register',
    shareCert: '09_Share_Certificate',
    voucher: '10_Voucher',
  };

  const SHEET_PROP_MAP: Record<string, string> = {
    '01_Society_Master': 'societyMaster',
    '02_Common_Member_Master': 'commonFile',
    '03_Form_I': 'formIData',
    '04_Form_J': 'formJData',
    '05_Share_Register': 'shareData',
    '06_Nomination_Register': 'nominationData',
    '07_Property_Register': 'propertyData',
    '08_Lien_Mark_Register': 'bankLineMarkData',
    '09_Share_Certificate': 'shareData',
    '10_Voucher': 'voucherData',
  };

  const title = moduleId ? (MODULE_TITLES[moduleId] || moduleId) : 'Master Data Editor';
  const targetSheetId = moduleId ? (MODULE_SHEET_MAP[moduleId] || '02_Common_Member_Master') : '02_Common_Member_Master';
  const isVoucherMode = targetSheetId === '10_Voucher' || moduleId === 'FORM_VOUCHER' || moduleId === 'voucher';
  const activeSchema = FORM_SCHEMAS[targetSheetId] || FORM_SCHEMAS['03_Form_I'];

  // Helper to unpack nested shares entries for modal editing
  const prepareMemberRecordForEditing = (rec: any): any => {
    if (!rec) return rec;
    const copy = { ...rec };
    if (Array.isArray(copy.sharesHeldEntries)) {
      copy.sharesHeldEntries.forEach((sh: any, idx: number) => {
        const i = idx + 1;
        if (sh) {
          copy[`sharesHeld_date_${i}`] = sh.date || copy[`sharesHeld_date_${i}`] || '';
          copy[`sharesHeld_cashBookFolio_${i}`] = sh.cashBookFolio || copy[`sharesHeld_cashBookFolio_${i}`] || '';
          copy[`sharesHeld_application_${i}`] = sh.application || copy[`sharesHeld_application_${i}`] || '';
          copy[`sharesHeld_allotment_${i}`] = sh.allotment || copy[`sharesHeld_allotment_${i}`] || '';
          copy[`sharesHeld_call1st_${i}`] = sh.call1st || copy[`sharesHeld_call1st_${i}`] || '';
          copy[`sharesHeld_call2nd_${i}`] = sh.call2nd || copy[`sharesHeld_call2nd_${i}`] || '';
          copy[`sharesHeld_totalAmountReceived_${i}`] = sh.totalAmountReceived || copy[`sharesHeld_totalAmountReceived_${i}`] || '';
          copy[`sharesHeld_noOfShares_${i}`] = sh.noOfShares || copy[`sharesHeld_noOfShares_${i}`] || '';
          copy[`sharesHeld_sharesFrom_${i}`] = sh.sharesFrom || copy[`sharesHeld_sharesFrom_${i}`] || '';
          copy[`sharesHeld_sharesTo_${i}`] = sh.sharesTo || copy[`sharesHeld_sharesTo_${i}`] || '';
          copy[`sharesHeld_shareCertNo_${i}`] = sh.shareCertificateNo || copy[`sharesHeld_shareCertNo_${i}`] || '';
        }
      });
    }
    if (Array.isArray(copy.sharesTransferredEntries)) {
      copy.sharesTransferredEntries.forEach((st: any, idx: number) => {
        const i = idx + 1;
        if (st) {
          copy[`sharesTransferred_date_${i}`] = st.date || copy[`sharesTransferred_date_${i}`] || '';
          copy[`sharesTransferred_cashBookFolio_${i}`] = st.cashBookFolio || copy[`sharesTransferred_cashBookFolio_${i}`] || '';
          copy[`sharesTransferred_transferDate_${i}`] = st.transferDate || copy[`sharesTransferred_transferDate_${i}`] || '';
          copy[`sharesTransferred_shareCertNo_${i}`] = st.shareCertificateNo || copy[`sharesTransferred_shareCertNo_${i}`] || '';
          copy[`sharesTransferred_noOfShares_${i}`] = st.noOfSharesTransferred || copy[`sharesTransferred_noOfShares_${i}`] || '';
          copy[`sharesTransferred_balanceNoOfShares_${i}`] = st.balanceNoOfShares || copy[`sharesTransferred_balanceNoOfShares_${i}`] || '';
          copy[`sharesTransferred_balanceCertNo_${i}`] = st.balanceSerialNoCertificate || copy[`sharesTransferred_balanceCertNo_${i}`] || '';
          copy[`sharesTransferred_amountRs_${i}`] = st.amountRs || copy[`sharesTransferred_amountRs_${i}`] || '';
          copy[`sharesTransferred_amountP_${i}`] = st.amountP || copy[`sharesTransferred_amountP_${i}`] || '';
        }
      });
    }
    return copy;
  };

  // Load records when modal opens or activeMode changes
  const loadRecords = useCallback(async () => {
    if (!api?.masterData) return;
    try {
      let wb = await api.masterData.getWorkbook();
      if (!wb) {
        const activeSoc = api?.society?.getActive ? await api.society.getActive() : null;
        wb = {
          societyMaster: {
            societyName: activeSoc?.societyName || 'Aishwarya Heights Co-op. Housing Society Ltd.',
            registrationNo: activeSoc?.registrationNo || '',
            registrationDate: activeSoc?.registrationDate || '',
            address: activeSoc?.fullAddress || '',
            email: '', telephone: '', totalUnits: 0, unitsFlat: 0, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0,
          },
          commonFile: [], formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [], voucherData: [],
        };
      }
      // NOTE: Do NOT call synchronizeMasterWorkbook here — the DB is the canonical saved state.
      if (isVoucherMode) {
        const vList = wb.voucherData || [];
        setRecords(vList);
        if (vList.length > 0) {
          const curId = selectedId || vList[0].voucherNo || vList[0].srNo;
          const found = vList.find((v: any) => (v.voucherNo || v.srNo) === curId) || vList[0];
          setSelectedId(found.voucherNo || found.srNo || '001');
          setEditingRecord({ ...found });
        }
      } else {
        const commonList = wb.commonFile || [];
        setRecords(commonList);
        if (commonList.length > 0) {
          const curId = selectedId || commonList[0].srNo;
          const found = commonList.find((m: any) => m.srNo === curId) || commonList[0];
          setSelectedId(found.srNo);
          setEditingRecord(prepareMemberRecordForEditing(found));
        }
      }
    } catch (err) {
      console.error('Failed to load records in EditDataModal:', err);
    }
  }, [isVoucherMode, selectedId]);

  useEffect(() => {
    if (isOpen) {
      loadRecords();
    }
  }, [isOpen, activeMode, isVoucherMode, targetSheetId]);

  // Filtered records list
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (isVoucherMode) {
        const vNo = (r.voucherNo || r.srNo || '').toString();
        const payee = r.toPayee || r.particulars || '';
        if (searchSrNo.trim() && !vNo.toLowerCase().includes(searchSrNo.trim().toLowerCase())) return false;
        if (searchName.trim() && !payee.toLowerCase().includes(searchName.trim().toLowerCase())) return false;
        return true;
      } else {
        const sr = (r.srNo || '').toString();
        const name = r.member1 || r.memberName || '';
        if (searchSrNo.trim() && !sr.toLowerCase().includes(searchSrNo.trim().toLowerCase())) return false;
        if (searchName.trim() && !name.toLowerCase().includes(searchName.trim().toLowerCase())) return false;
        return true;
      }
    });
  }, [records, isVoucherMode, searchSrNo, searchName]);

  const handleSelectRecord = (id: string) => {
    setSelectedId(id);
    const rec = records.find(r => (isVoucherMode ? (r.voucherNo === id || r.srNo === id) : r.srNo === id));
    if (rec) {
      setEditingRecord(isVoucherMode ? { ...rec } : prepareMemberRecordForEditing(rec));
      setHasUnsavedChanges(false);
      setSuccessMsg(null);
    }
  };

  const handleFieldChange = (key: string, val: any) => {
    setEditingRecord(prev => {
      const updated = { ...prev, [key]: val };
      if (isVoucherMode) {
        return sanitizeAndCalculateVoucher(updated as VoucherRecord);
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    setSuccessMsg(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      let wb = await api.masterData.getWorkbook();
      if (!wb) {
        const activeSoc = api?.society?.getActive ? await api.society.getActive() : null;
        wb = {
          societyMaster: {
            societyName: activeSoc?.societyName || 'Aishwarya Heights Co-op. Housing Society Ltd.',
            registrationNo: activeSoc?.registrationNo || '',
            registrationDate: activeSoc?.registrationDate || '',
            address: activeSoc?.fullAddress || '',
            email: '', telephone: '', totalUnits: 0, unitsFlat: 0, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0,
          },
          commonFile: [], formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [], voucherData: [],
        };
      }

      if (isVoucherMode) {
        if (!wb.voucherData) wb.voucherData = [];
        const recordToSave = sanitizeAndCalculateVoucher({
          ...editingRecord,
          voucherNo: editingRecord.voucherNo || editingRecord.srNo || selectedId,
          srNo: editingRecord.srNo || editingRecord.voucherNo || selectedId,
        } as VoucherRecord);
        const idx = wb.voucherData.findIndex((v: any) => (
          String(v.voucherNo || '').trim() === String(selectedId).trim() ||
          String(v.srNo || '').trim() === String(selectedId).trim()
        ));
        if (idx >= 0) {
          wb.voucherData[idx] = recordToSave;
        } else {
          wb.voucherData.push(recordToSave);
        }
        wb = synchronizeMasterWorkbook(wb);
        await api.masterData.updateWorkbook(wb);
        setRecords([...wb.voucherData]);
        setEditingRecord({ ...recordToSave });
      } else {
        const recordToSave: any = { ...editingRecord };
        
        // Sync 5 shares held entries
        const shEntries: any[] = [];
        for (let i = 1; i <= 5; i++) {
          if (
            recordToSave[`sharesHeld_date_${i}`] ||
            recordToSave[`sharesHeld_cashBookFolio_${i}`] ||
            recordToSave[`sharesHeld_application_${i}`] ||
            recordToSave[`sharesHeld_allotment_${i}`] ||
            recordToSave[`sharesHeld_call1st_${i}`] ||
            recordToSave[`sharesHeld_call2nd_${i}`] ||
            recordToSave[`sharesHeld_totalAmountReceived_${i}`] ||
            recordToSave[`sharesHeld_noOfShares_${i}`] ||
            recordToSave[`sharesHeld_sharesFrom_${i}`] ||
            recordToSave[`sharesHeld_sharesTo_${i}`] ||
            recordToSave[`sharesHeld_shareCertNo_${i}`]
          ) {
            shEntries.push({
              date: recordToSave[`sharesHeld_date_${i}`] || '',
              cashBookFolio: recordToSave[`sharesHeld_cashBookFolio_${i}`] || '',
              application: recordToSave[`sharesHeld_application_${i}`] || '',
              allotment: recordToSave[`sharesHeld_allotment_${i}`] || '',
              call1st: recordToSave[`sharesHeld_call1st_${i}`] || '',
              call2nd: recordToSave[`sharesHeld_call2nd_${i}`] || '',
              totalAmountReceived: recordToSave[`sharesHeld_totalAmountReceived_${i}`] || '',
              noOfShares: recordToSave[`sharesHeld_noOfShares_${i}`] || '',
              sharesFrom: recordToSave[`sharesHeld_sharesFrom_${i}`] || '',
              sharesTo: recordToSave[`sharesHeld_sharesTo_${i}`] || '',
              shareCertificateNo: recordToSave[`sharesHeld_shareCertNo_${i}`] || '',
            });
          }
        }
        if (shEntries.length > 0) {
          recordToSave.sharesHeldEntries = shEntries;
        }

        // Sync 5 shares transferred entries
        const stEntries: any[] = [];
        for (let i = 1; i <= 5; i++) {
          if (
            recordToSave[`sharesTransferred_date_${i}`] ||
            recordToSave[`sharesTransferred_cashBookFolio_${i}`] ||
            recordToSave[`sharesTransferred_transferDate_${i}`] ||
            recordToSave[`sharesTransferred_shareCertNo_${i}`] ||
            recordToSave[`sharesTransferred_noOfShares_${i}`] ||
            recordToSave[`sharesTransferred_balanceNoOfShares_${i}`] ||
            recordToSave[`sharesTransferred_balanceCertNo_${i}`] ||
            recordToSave[`sharesTransferred_amountRs_${i}`] ||
            recordToSave[`sharesTransferred_amountP_${i}`]
          ) {
            stEntries.push({
              date: recordToSave[`sharesTransferred_date_${i}`] || '',
              cashBookFolio: recordToSave[`sharesTransferred_cashBookFolio_${i}`] || '',
              transferDate: recordToSave[`sharesTransferred_transferDate_${i}`] || '',
              shareCertificateNo: recordToSave[`sharesTransferred_shareCertNo_${i}`] || '',
              noOfSharesTransferred: recordToSave[`sharesTransferred_noOfShares_${i}`] || '',
              balanceNoOfShares: recordToSave[`sharesTransferred_balanceNoOfShares_${i}`] || '',
              balanceSerialNoCertificate: recordToSave[`sharesTransferred_balanceCertNo_${i}`] || '',
              amountRs: recordToSave[`sharesTransferred_amountRs_${i}`] || '',
              amountP: recordToSave[`sharesTransferred_amountP_${i}`] || '',
            });
          }
        }
        if (stEntries.length > 0) {
          recordToSave.sharesTransferredEntries = stEntries;
        }

        if (!wb.commonFile) wb.commonFile = [];
        const cIdx = wb.commonFile.findIndex((c: any) => String(c.srNo).trim() === String(recordToSave.srNo).trim());
        if (cIdx >= 0) {
          wb.commonFile[cIdx] = { ...wb.commonFile[cIdx], ...recordToSave };
        } else if (recordToSave.srNo) {
          wb.commonFile.push(recordToSave);
        }

        wb = synchronizeMasterWorkbook(wb);
        await api.masterData.updateWorkbook(wb);

        if (api?.masterData?.updateMemberRecord) {
          await api.masterData.updateMemberRecord(recordToSave as NormalizedMemberRecord);
        }

        const commonList = wb.commonFile || [];
        setRecords(commonList);
        const found = commonList.find((c: any) => String(c.srNo).trim() === String(recordToSave.srNo).trim());
        if (found) setEditingRecord(prepareMemberRecordForEditing(found));
      }

      setSuccessMsg('✓ Saved successfully');
      setHasUnsavedChanges(false);
      onSaved();

      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedAlert(true);
    } else {
      onSaved();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: '100%', maxWidth: 1160,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)',
          padding: 20,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header & View Mode Switcher */}
        <div className="flex items-center justify-between mb-12 pb-12" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-12">
            <Edit3 className="text-accent" size={20} />
            <h2 className="text-base fw-700" style={{ margin: 0 }}>
              Real-Time Data Editor — {title}
            </h2>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-8">
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 6, padding: 3, border: '1px solid var(--border)' }}>
              <button
                className={`btn btn-sm ${activeMode === 'spreadsheet' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveMode('spreadsheet')}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                <Database size={12} /> Spreadsheet View
              </button>
              <button
                className={`btn btn-sm ${activeMode === 'quickForm' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveMode('quickForm')}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                <Search size={12} /> Quick Search & Edit
              </button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleCloseAttempt}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        {activeMode === 'spreadsheet' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <SpreadsheetEditor defaultSheetId={targetSheetId} onWorkbookUpdated={onSaved} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>

            {/* Left Column: Multi-Attribute Search & Filtered List */}
            <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid var(--border)', paddingRight: 14 }}>
              <div className="text-xs fw-700 text-secondary">
                Search & Filter {isVoucherMode ? 'Vouchers' : 'Members'} ({title})
              </div>

              {/* Search Inputs */}
              <div className="grid-2 gap-6">
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {isVoucherMode ? 'Voucher No.' : 'Sr. No.'}
                  </label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    value={searchSrNo}
                    onChange={e => setSearchSrNo(e.target.value)}
                    placeholder="e.g. 001"
                    style={{ height: 28 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {isVoucherMode ? 'Payee / Particulars' : 'Member Name'}
                  </label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    placeholder={isVoucherMode ? 'e.g. Apex' : 'e.g. Shah'}
                    style={{ height: 28 }}
                  />
                </div>
              </div>

              <div className="text-xs text-muted">
                Showing {filteredRecords.length} of {records.length} {isVoucherMode ? 'vouchers' : 'members'}
              </div>

              {/* Selection List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredRecords.map((r, idx) => {
                  const idVal = (isVoucherMode ? (r.voucherNo || r.srNo || `VCH-${idx + 1}`) : (r.srNo || `${idx + 1}`)).toString();
                  const isSel = idVal === selectedId;
                  const displayName = isVoucherMode
                    ? (r.toPayee || r.particulars || 'Unnamed Payee')
                    : (r.member1 || r.memberName || 'Unnamed Member');

                  return (
                    <button
                      key={idVal}
                      className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleSelectRecord(idVal)}
                      style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 11, padding: '6px 8px' }}
                    >
                      {isVoucherMode ? <FileText size={12} /> : <UserCheck size={12} />}
                      <span className="fw-700 font-mono">[{idVal}]</span>
                      <span className="truncate">{displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Record Edit Form — Exact Schema Fields */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedId ? (
                <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  <div className="flex items-center justify-between pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="fw-700 text-sm">
                      Editing Record for {title}: <span className="text-accent font-mono">[{selectedId}]</span>
                    </div>
                    {successMsg && (
                      <span className="badge badge-success flex items-center gap-4 text-xs">
                        <CheckCircle size={12} /> {successMsg}
                      </span>
                    )}
                  </div>

                  {/* Render exact schema fields */}
                  <div className="grid-2 gap-10">
                    {activeSchema.map(col => {
                      const val = (editingRecord as any)[col.key] || (col.key === 'member1' ? editingRecord.memberName : '') || '';
                      return (
                        <div key={col.key}>
                          <label className="form-label text-xs">{col.label}</label>
                          <input
                            className="form-input text-xs"
                            value={val}
                            onChange={e => {
                              handleFieldChange(col.key, e.target.value);
                              if (col.key === 'member1' || col.key === 'memberName') {
                                handleFieldChange('memberName', e.target.value);
                                handleFieldChange('member1', e.target.value);
                              }
                            }}
                            required={col.required}
                            placeholder={col.type === 'date' ? 'DD/MM/YYYY' : ''}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-end gap-10 mt-8 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
                    <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
                      <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center text-muted p-20">Select a record to edit.</div>
              )}
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning Confirmation Modal */}
        {showUnsavedAlert && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'var(--surface)', padding: 24, borderRadius: 10,
              maxWidth: 420, width: '100%', border: '1px solid var(--border)', textAlign: 'center'
            }}>
              <h3 className="text-base fw-700 text-warning mb-8">Unsaved Changes</h3>
              <p className="text-xs text-secondary mb-16">
                You have unsaved changes. Save before closing?
              </p>
              <div className="flex items-center justify-center gap-10">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    setShowUnsavedAlert(false);
                    setHasUnsavedChanges(false);
                    onSaved();
                    onClose();
                  }}
                >
                  Save
                </button>
                <button
                  className="btn btn-secondary btn-sm text-error"
                  onClick={() => {
                    setShowUnsavedAlert(false);
                    setHasUnsavedChanges(false);
                    onClose();
                  }}
                >
                  Discard
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowUnsavedAlert(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
