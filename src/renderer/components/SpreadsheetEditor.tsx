import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Copy, Save, RotateCcw, RotateCw, RefreshCw, CheckCircle, AlertTriangle, FileSpreadsheet
} from 'lucide-react';
import { MasterWorkbook } from '../../main/types';
import { synchronizeMasterWorkbook, sanitizeAndCalculateVoucher } from '../../main/services/MasterDataService';

export interface ColumnDef {
  key: string;
  label: string;
  width?: number;
  type?: 'text' | 'number' | 'amount' | 'date' | 'serial';
  required?: boolean;
}

export interface SheetConfig {
  id: string;
  name: string;
  wbProp: keyof MasterWorkbook;
  columns: ColumnDef[];
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    id: '01_Society_Master',
    name: '01_Society_Master',
    wbProp: 'societyMaster',
    columns: [
      { key: 'field', label: 'FIELD NAME', width: 280, required: true },
      { key: 'value', label: 'VALUE', width: 480, required: true },
    ]
  },
  {
    id: '02_Common_Member_Master',
    name: '02_Common_Member_Master',
    wbProp: 'commonFile',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'membershipNo', label: 'Membership No.', width: 140 },
      { key: 'shareCertificateNo', label: 'Share Cert No.', width: 140 },
      { key: 'noOfShares', label: 'No. of Shares', width: 110, type: 'number' },
      { key: 'valueOfOneShare', label: 'Value of 1 Share', width: 130, type: 'amount' },
      { key: 'valueOfShares', label: 'Value of Shares', width: 130, type: 'amount' },
      { key: 'sharesFrom', label: 'Cert Range From', width: 120 },
      { key: 'sharesTo', label: 'Cert Range To', width: 120 },
      { key: 'memberName', label: 'Member Name 1', width: 220, required: true },
      { key: 'member2', label: 'Member Name 2', width: 180 },
      { key: 'member3', label: 'Member Name 3', width: 180 },
      { key: 'member4', label: 'Member Name 4', width: 180 },
      { key: 'member5', label: 'Member Name 5', width: 180 },
      { key: 'member6', label: 'Member Name 6', width: 180 },
      { key: 'flatNo', label: 'Flat/Gala No.', width: 120 },
      { key: 'wingNo', label: 'Wing No.', width: 90 },
      { key: 'residentialAddress', label: 'Residential Address', width: 260 },
      { key: 'permanentAddress', label: 'Permanent Address', width: 260 },
    ]
  },
  {
    id: '03_Form_I',
    name: '03_Form_I',
    wbProp: 'formIData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'dateOfAdmission', label: 'Date of Admission', width: 140, type: 'date' },
      { key: 'dateOfEntranceFee', label: 'Date of Entrance Fee', width: 150, type: 'date' },
      { key: 'memberName', label: 'Member Name 1', width: 220, required: true },
      { key: 'member2', label: 'Member Name 2', width: 180 },
      { key: 'member3', label: 'Member Name 3', width: 180 },
      { key: 'member4', label: 'Member Name 4', width: 180 },
      { key: 'member5', label: 'Member Name 5', width: 180 },
      { key: 'member6', label: 'Member Name 6', width: 180 },
      { key: 'flatNo', label: 'Flat/Room/Shop/Gala No.', width: 150 },
      { key: 'wingNo', label: 'Wing No.', width: 90 },
      { key: 'residentialAddress', label: 'Residential Address', width: 260 },
      { key: 'permanentAddress', label: 'Permanent Address', width: 260 },
      { key: 'occupation', label: 'Occupation', width: 150 },
      { key: 'age', label: 'Age on Admission', width: 130, type: 'number' },
      { key: 'nomineeName', label: 'Nominee Name 1', width: 200 },
      { key: 'nominee2', label: 'Nominee Name 2', width: 180 },
      { key: 'nominee3', label: 'Nominee Name 3', width: 180 },
      { key: 'nominee4', label: 'Nominee Name 4', width: 180 },
      { key: 'nominee5', label: 'Nominee Name 5', width: 180 },
      { key: 'nominee6', label: 'Nominee Name 6', width: 180 },
      { key: 'nomineeAddress', label: 'Nominee Address', width: 240 },
      { key: 'dateOfNomination', label: 'Date of Nomination', width: 140, type: 'date' },
      { key: 'dateOfCessation', label: 'Date of Cessation', width: 140, type: 'date' },
      { key: 'reasonForCessation', label: 'Reason for Cessation', width: 180 },
      { key: 'remarks', label: 'Remarks', width: 180 },

      // 5 Multi-entries for Particulars of Shares Held
      { key: 'sharesHeld_date_1', label: 'Shares Held: Date 1', width: 140, type: 'date' },
      { key: 'sharesHeld_cashBookFolio_1', label: 'Shares Held: Cash Folio 1', width: 140 },
      { key: 'sharesHeld_application_1', label: 'Shares Held: Application 1', width: 140, type: 'amount' },
      { key: 'sharesHeld_allotment_1', label: 'Shares Held: Allotment 1', width: 140, type: 'amount' },
      { key: 'sharesHeld_call1st_1', label: 'Shares Held: 1st Call 1', width: 140, type: 'amount' },
      { key: 'sharesHeld_call2nd_1', label: 'Shares Held: 2nd Call 1', width: 140, type: 'amount' },
      { key: 'sharesHeld_totalAmountReceived_1', label: 'Shares Held: Total Amt 1', width: 140, type: 'amount' },
      { key: 'sharesHeld_noOfShares_1', label: 'Shares Held: No Shares 1', width: 130, type: 'number' },
      { key: 'sharesHeld_sharesFrom_1', label: 'Shares Held: Distinctive From 1', width: 140 },
      { key: 'sharesHeld_sharesTo_1', label: 'Shares Held: Distinctive To 1', width: 140 },
      { key: 'sharesHeld_shareCertNo_1', label: 'Shares Held: Cert No 1', width: 140 },

      { key: 'sharesHeld_date_2', label: 'Shares Held: Date 2', width: 140, type: 'date' },
      { key: 'sharesHeld_cashBookFolio_2', label: 'Shares Held: Cash Folio 2', width: 140 },
      { key: 'sharesHeld_application_2', label: 'Shares Held: Application 2', width: 140, type: 'amount' },
      { key: 'sharesHeld_allotment_2', label: 'Shares Held: Allotment 2', width: 140, type: 'amount' },
      { key: 'sharesHeld_call1st_2', label: 'Shares Held: 1st Call 2', width: 140, type: 'amount' },
      { key: 'sharesHeld_call2nd_2', label: 'Shares Held: 2nd Call 2', width: 140, type: 'amount' },
      { key: 'sharesHeld_totalAmountReceived_2', label: 'Shares Held: Total Amt 2', width: 140, type: 'amount' },
      { key: 'sharesHeld_noOfShares_2', label: 'Shares Held: No Shares 2', width: 130, type: 'number' },
      { key: 'sharesHeld_sharesFrom_2', label: 'Shares Held: Distinctive From 2', width: 140 },
      { key: 'sharesHeld_sharesTo_2', label: 'Shares Held: Distinctive To 2', width: 140 },
      { key: 'sharesHeld_shareCertNo_2', label: 'Shares Held: Cert No 2', width: 140 },

      { key: 'sharesHeld_date_3', label: 'Shares Held: Date 3', width: 140, type: 'date' },
      { key: 'sharesHeld_cashBookFolio_3', label: 'Shares Held: Cash Folio 3', width: 140 },
      { key: 'sharesHeld_application_3', label: 'Shares Held: Application 3', width: 140, type: 'amount' },
      { key: 'sharesHeld_allotment_3', label: 'Shares Held: Allotment 3', width: 140, type: 'amount' },
      { key: 'sharesHeld_call1st_3', label: 'Shares Held: 1st Call 3', width: 140, type: 'amount' },
      { key: 'sharesHeld_call2nd_3', label: 'Shares Held: 2nd Call 3', width: 140, type: 'amount' },
      { key: 'sharesHeld_totalAmountReceived_3', label: 'Shares Held: Total Amt 3', width: 140, type: 'amount' },
      { key: 'sharesHeld_noOfShares_3', label: 'Shares Held: No Shares 3', width: 130, type: 'number' },
      { key: 'sharesHeld_sharesFrom_3', label: 'Shares Held: Distinctive From 3', width: 140 },
      { key: 'sharesHeld_sharesTo_3', label: 'Shares Held: Distinctive To 3', width: 140 },
      { key: 'sharesHeld_shareCertNo_3', label: 'Shares Held: Cert No 3', width: 140 },

      { key: 'sharesHeld_date_4', label: 'Shares Held: Date 4', width: 140, type: 'date' },
      { key: 'sharesHeld_cashBookFolio_4', label: 'Shares Held: Cash Folio 4', width: 140 },
      { key: 'sharesHeld_application_4', label: 'Shares Held: Application 4', width: 140, type: 'amount' },
      { key: 'sharesHeld_allotment_4', label: 'Shares Held: Allotment 4', width: 140, type: 'amount' },
      { key: 'sharesHeld_call1st_4', label: 'Shares Held: 1st Call 4', width: 140, type: 'amount' },
      { key: 'sharesHeld_call2nd_4', label: 'Shares Held: 2nd Call 4', width: 140, type: 'amount' },
      { key: 'sharesHeld_totalAmountReceived_4', label: 'Shares Held: Total Amt 4', width: 140, type: 'amount' },
      { key: 'sharesHeld_noOfShares_4', label: 'Shares Held: No Shares 4', width: 130, type: 'number' },
      { key: 'sharesHeld_sharesFrom_4', label: 'Shares Held: Distinctive From 4', width: 140 },
      { key: 'sharesHeld_sharesTo_4', label: 'Shares Held: Distinctive To 4', width: 140 },
      { key: 'sharesHeld_shareCertNo_4', label: 'Shares Held: Cert No 4', width: 140 },

      { key: 'sharesHeld_date_5', label: 'Shares Held: Date 5', width: 140, type: 'date' },
      { key: 'sharesHeld_cashBookFolio_5', label: 'Shares Held: Cash Folio 5', width: 140 },
      { key: 'sharesHeld_application_5', label: 'Shares Held: Application 5', width: 140, type: 'amount' },
      { key: 'sharesHeld_allotment_5', label: 'Shares Held: Allotment 5', width: 140, type: 'amount' },
      { key: 'sharesHeld_call1st_5', label: 'Shares Held: 1st Call 5', width: 140, type: 'amount' },
      { key: 'sharesHeld_call2nd_5', label: 'Shares Held: 2nd Call 5', width: 140, type: 'amount' },
      { key: 'sharesHeld_totalAmountReceived_5', label: 'Shares Held: Total Amt 5', width: 140, type: 'amount' },
      { key: 'sharesHeld_noOfShares_5', label: 'Shares Held: No Shares 5', width: 130, type: 'number' },
      { key: 'sharesHeld_sharesFrom_5', label: 'Shares Held: Distinctive From 5', width: 140 },
      { key: 'sharesHeld_sharesTo_5', label: 'Shares Held: Distinctive To 5', width: 140 },
      { key: 'sharesHeld_shareCertNo_5', label: 'Shares Held: Cert No 5', width: 140 },

      // 5 Multi-entries for Particulars of Shares Transferred or Surrendered
      { key: 'sharesTransferred_date_1', label: 'Transferred: Date 1', width: 140, type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_1', label: 'Transferred: Folio 1', width: 140 },
      { key: 'sharesTransferred_transferDate_1', label: 'Transferred: Transfer Date 1', width: 140, type: 'date' },
      { key: 'sharesTransferred_shareCertNo_1', label: 'Transferred: Cert No 1', width: 140 },
      { key: 'sharesTransferred_noOfShares_1', label: 'Transferred: No Shares 1', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceNoOfShares_1', label: 'Transferred: Bal Shares 1', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceCertNo_1', label: 'Transferred: Bal Cert 1', width: 140 },
      { key: 'sharesTransferred_amountRs_1', label: 'Transferred: Amt Rs 1', width: 130, type: 'amount' },
      { key: 'sharesTransferred_amountP_1', label: 'Transferred: Amt P 1', width: 110 },

      { key: 'sharesTransferred_date_2', label: 'Transferred: Date 2', width: 140, type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_2', label: 'Transferred: Folio 2', width: 140 },
      { key: 'sharesTransferred_transferDate_2', label: 'Transferred: Transfer Date 2', width: 140, type: 'date' },
      { key: 'sharesTransferred_shareCertNo_2', label: 'Transferred: Cert No 2', width: 140 },
      { key: 'sharesTransferred_noOfShares_2', label: 'Transferred: No Shares 2', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceNoOfShares_2', label: 'Transferred: Bal Shares 2', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceCertNo_2', label: 'Transferred: Bal Cert 2', width: 140 },
      { key: 'sharesTransferred_amountRs_2', label: 'Transferred: Amt Rs 2', width: 130, type: 'amount' },
      { key: 'sharesTransferred_amountP_2', label: 'Transferred: Amt P 2', width: 110 },

      { key: 'sharesTransferred_date_3', label: 'Transferred: Date 3', width: 140, type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_3', label: 'Transferred: Folio 3', width: 140 },
      { key: 'sharesTransferred_transferDate_3', label: 'Transferred: Transfer Date 3', width: 140, type: 'date' },
      { key: 'sharesTransferred_shareCertNo_3', label: 'Transferred: Cert No 3', width: 140 },
      { key: 'sharesTransferred_noOfShares_3', label: 'Transferred: No Shares 3', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceNoOfShares_3', label: 'Transferred: Bal Shares 3', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceCertNo_3', label: 'Transferred: Bal Cert 3', width: 140 },
      { key: 'sharesTransferred_amountRs_3', label: 'Transferred: Amt Rs 3', width: 130, type: 'amount' },
      { key: 'sharesTransferred_amountP_3', label: 'Transferred: Amt P 3', width: 110 },

      { key: 'sharesTransferred_date_4', label: 'Transferred: Date 4', width: 140, type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_4', label: 'Transferred: Folio 4', width: 140 },
      { key: 'sharesTransferred_transferDate_4', label: 'Transferred: Transfer Date 4', width: 140, type: 'date' },
      { key: 'sharesTransferred_shareCertNo_4', label: 'Transferred: Cert No 4', width: 140 },
      { key: 'sharesTransferred_noOfShares_4', label: 'Transferred: No Shares 4', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceNoOfShares_4', label: 'Transferred: Bal Shares 4', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceCertNo_4', label: 'Transferred: Bal Cert 4', width: 140 },
      { key: 'sharesTransferred_amountRs_4', label: 'Transferred: Amt Rs 4', width: 130, type: 'amount' },
      { key: 'sharesTransferred_amountP_4', label: 'Transferred: Amt P 4', width: 110 },

      { key: 'sharesTransferred_date_5', label: 'Transferred: Date 5', width: 140, type: 'date' },
      { key: 'sharesTransferred_cashBookFolio_5', label: 'Transferred: Folio 5', width: 140 },
      { key: 'sharesTransferred_transferDate_5', label: 'Transferred: Transfer Date 5', width: 140, type: 'date' },
      { key: 'sharesTransferred_shareCertNo_5', label: 'Transferred: Cert No 5', width: 140 },
      { key: 'sharesTransferred_noOfShares_5', label: 'Transferred: No Shares 5', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceNoOfShares_5', label: 'Transferred: Bal Shares 5', width: 130, type: 'number' },
      { key: 'sharesTransferred_balanceCertNo_5', label: 'Transferred: Bal Cert 5', width: 140 },
      { key: 'sharesTransferred_amountRs_5', label: 'Transferred: Amt Rs 5', width: 130, type: 'amount' },
      { key: 'sharesTransferred_amountP_5', label: 'Transferred: Amt P 5', width: 110 },
    ]
  },
  {
    id: '04_Form_J',
    name: '04_Form_J',
    wbProp: 'formJData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'memberName', label: 'Member Name 1', width: 220, required: true },
      { key: 'member2', label: 'Member Name 2', width: 180 },
      { key: 'member3', label: 'Member Name 3', width: 180 },
      { key: 'member4', label: 'Member Name 4', width: 180 },
      { key: 'member5', label: 'Member Name 5', width: 180 },
      { key: 'member6', label: 'Member Name 6', width: 180 },
      { key: 'permanentAddress', label: 'Permanent Address', width: 260 },
      { key: 'residentialAddress', label: 'Residential Address', width: 260 },
      { key: 'classOfMember', label: 'Class of Member', width: 160 },
    ]
  },
  {
    id: '05_Share_Register',
    name: '05_Share_Register',
    wbProp: 'shareData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'dateOfAllotment', label: 'Date of allotment', width: 140, type: 'date' },
      { key: 'cashBookFolio', label: 'Cash Book Folio No.', width: 130 },
      { key: 'shareCertificateNo', label: 'Share Certificate No.', width: 140 },
      { key: 'noOfShares', label: 'No. of Shares', width: 110, type: 'number' },
      { key: 'valueOfShares', label: 'Value of Shares Rs.', width: 130, type: 'amount' },
      { key: 'memberName', label: 'Member Name 1', width: 220, required: true },
      { key: 'member2', label: 'Member Name 2', width: 180 },
      { key: 'member3', label: 'Member Name 3', width: 180 },
      { key: 'member4', label: 'Member Name 4', width: 180 },
      { key: 'member5', label: 'Member Name 5', width: 180 },
      { key: 'member6', label: 'Member Name 6', width: 180 },
      { key: 'flatNo', label: 'Flat / Shop / Office No.', width: 140 },
      { key: 'wingNo', label: 'Wing No.', width: 90 },
      { key: 'dateOfTransferRefund', label: 'Date of transfer / Refund', width: 150, type: 'date' },
      { key: 'noOfSharesTransferred', label: 'No. Transferred / Refunded', width: 140, type: 'number' },
      { key: 'transferCertificateNo', label: 'Cert. No. Transferred / Refunded', width: 150 },
      { key: 'sharesValueTransferred', label: 'Shares Value Transferred / Refunded', width: 160, type: 'amount' },
      { key: 'nameOfTransferee', label: 'Transferee Name', width: 200 },
      { key: 'authorityForTransfer', label: 'Authority', width: 160 },
      { key: 'oldShareCertNo', label: 'Old Share Cert. No.', width: 140 },
      { key: 'oldMembershipNo', label: 'Old Membership No.', width: 140 },
      { key: 'sharesFrom', label: 'Distinctive From', width: 120 },
      { key: 'sharesTo', label: 'Distinctive To', width: 120 },
      { key: 'remarks', label: 'Remarks', width: 180 },
    ]
  },
  {
    id: '06_Nomination_Register',
    name: '06_Nomination_Register',
    wbProp: 'nominationData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'memberName', label: 'Member Name', width: 220, required: true },
      { key: 'flatNo', label: 'Flat No.', width: 100 },
      { key: 'wingNo', label: 'Wing No.', width: 80 },
      { key: 'dateOfNomination', label: 'Date of Nomination', width: 140, type: 'date' },
      { key: 'nominee1', label: 'Nominee 1', width: 180 },
      { key: 'nomineePercentage1', label: 'Percentage 1', width: 100 },
      { key: 'nominee2', label: 'Nominee 2', width: 180 },
      { key: 'nomineePercentage2', label: 'Percentage 2', width: 100 },
      { key: 'nominee3', label: 'Nominee 3', width: 180 },
      { key: 'nomineePercentage3', label: 'Percentage 3', width: 100 },
      { key: 'nominee4', label: 'Nominee 4', width: 180 },
      { key: 'nomineePercentage4', label: 'Percentage 4', width: 100 },
      { key: 'nominee5', label: 'Nominee 5', width: 180 },
      { key: 'nomineePercentage5', label: 'Percentage 5', width: 100 },
      { key: 'nominee6', label: 'Nominee 6', width: 180 },
      { key: 'nomineePercentage6', label: 'Percentage 6', width: 100 },
      { key: 'mcMeetingDate', label: 'MC Meeting Date', width: 140, type: 'date' },
      { key: 'subsequentRevocation', label: 'Subsequent Revocation', width: 180 },
      { key: 'remarks', label: 'Remarks', width: 180 },
    ]
  },
  {
    id: '07_Property_Register',
    name: '07_Property_Register',
    wbProp: 'propertyData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'memberName', label: 'Member Name', width: 220, required: true },
      { key: 'descriptionOfTenement', label: 'Description of Tenement', width: 240 },
      { key: 'area', label: 'Area (sq ft)', width: 120, type: 'number' },
      { key: 'costOfTenement', label: 'Cost of Tenement', width: 140, type: 'amount' },
      { key: 'annualGroundRent', label: 'Annual Ground Rent', width: 150, type: 'amount' },
    ]
  },
  {
    id: '08_Lien_Mark_Register',
    name: '08_Lien_Mark_Register',
    wbProp: 'bankLineMarkData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'memberName', label: 'Member Name', width: 220, required: true },
      { key: 'bankName', label: 'Bank Name', width: 220 },
      { key: 'bankAddress', label: 'Bank Address', width: 240 },
      { key: 'loanAmount', label: 'Loan Amount', width: 140, type: 'amount' },
      { key: 'loanPeriod', label: 'Loan Period', width: 130 },
      { key: 'dateOfLienCancellation', label: 'Lien Cancellation Date', width: 160, type: 'date' },
    ]
  },
  {
    id: '09_Share_Certificate',
    name: '09_Share_Certificate',
    wbProp: 'shareData',
    columns: [
      { key: 'srNo', label: 'Sr. No.', width: 80, type: 'serial', required: true },
      { key: 'shareCertificateNo', label: 'Share Cert No.', width: 130 },
      { key: 'membershipNo', label: 'Member Reg No.', width: 130 },
      { key: 'noOfShares', label: 'No. of Shares', width: 110, type: 'number' },
      { key: 'valueOfShares', label: 'Value of Shares', width: 130, type: 'amount' },
      { key: 'sharesFrom', label: 'Distinctive From', width: 120 },
      { key: 'sharesTo', label: 'Distinctive To', width: 120 },
      { key: 'wingNo', label: 'Wing', width: 80 },
      { key: 'flatNo', label: 'Flat No.', width: 100 },
      { key: 'memberName', label: '1st Owner Name', width: 220, required: true },
      { key: 'member2', label: '2nd Owner Name', width: 180 },
      { key: 'member3', label: '3rd Owner Name', width: 180 },
      { key: 'oldShareCertNo', label: 'Old Share Cert No.', width: 140 },
      { key: 'dateOfAllotment', label: 'Date of Issue', width: 130, type: 'date' },
      { key: 'remarks', label: 'Remarks', width: 180 },
    ]
  },
  {
    id: '10_Voucher',
    name: '10_Voucher',
    wbProp: 'voucherData',
    columns: [
      { key: 'voucherNo', label: 'Voucher No.', width: 100, type: 'serial', required: true },
      { key: 'voucherDate', label: 'Voucher Date', width: 120, type: 'date' },
      { key: 'toPayee', label: 'To (Payee)', width: 220, required: true },
      { key: 'chargeTo', label: 'Charge To', width: 180 },
      { key: 'particulars', label: 'Particulars', width: 260 },
      { key: 'bankName', label: 'Bank Name', width: 180 },
      { key: 'chequeNo', label: 'Cheque No', width: 120 },
      { key: 'billNo', label: 'Bill No.', width: 120 },
      { key: 'billAmount', label: 'Bill Amount', width: 120, type: 'amount' },
      { key: 'billAmount2', label: 'Bill Amount 2', width: 120, type: 'amount' },
      { key: 'advLessPaid', label: 'Adv. Less/Paid', width: 120, type: 'amount' },
      { key: 'subTotal1', label: 'Sub Total 1', width: 120, type: 'amount' },
      { key: 'tdsPercent', label: 'TDS %', width: 90, type: 'number' },
      { key: 'tdsAmount', label: 'TDS Amount', width: 120, type: 'amount' },
      { key: 'subTotal2', label: 'Sub Total 2', width: 120, type: 'amount' },
      { key: 'cgstPercent', label: 'CGST %', width: 90, type: 'number' },
      { key: 'cgstAmount', label: 'CGST Amount', width: 120, type: 'amount' },
      { key: 'sgstPercent', label: 'SGST %', width: 90, type: 'number' },
      { key: 'sgstAmount', label: 'SGST Amount', width: 120, type: 'amount' },
      { key: 'roundOff', label: 'Round Off (+/-)', width: 120, type: 'amount' },
      { key: 'otherFineAdj', label: 'Other (Fine/Adj)', width: 130, type: 'amount' },
      { key: 'netPaid', label: 'Net Paid (Voucher)', width: 140, type: 'amount', required: true },
      { key: 'societyName', label: 'Society Name', width: 220 },
      { key: 'socNumber', label: 'SOC-Number', width: 140 },
      { key: 'societyAddress', label: 'Society Address', width: 260 },
    ]
  }
];

interface SpreadsheetEditorProps {
  defaultSheetId?: string;
  onWorkbookUpdated?: (wb: MasterWorkbook) => void;
}

export default function SpreadsheetEditor({ defaultSheetId, onWorkbookUpdated }: SpreadsheetEditorProps) {
  const [activeSheetId, setActiveSheetId] = useState<string>(defaultSheetId || '02_Common_Member_Master');
  const [showDetailedValidation, setShowDetailedValidation] = useState<boolean>(false);
  const [workbook, setWorkbook] = useState<MasterWorkbook | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [initialEditValue, setInitialEditValue] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [clipboardValue, setClipboardValue] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const undoStackRef = useRef<MasterWorkbook[]>([]);
  const redoStackRef = useRef<MasterWorkbook[]>([]);

  const api = (window as any).api;

  // Sync defaultSheetId when changed
  useEffect(() => {
    if (defaultSheetId) {
      setActiveSheetId(defaultSheetId);
    }
  }, [defaultSheetId]);

  // Load workbook from SQLite on mount
  // NOTE: Do NOT call synchronizeMasterWorkbook here — the DB is the canonical saved state.
  // Re-syncing on load would overwrite user edits by re-deriving fields from stale inter-register data.
  const loadWorkbook = useCallback(async () => {
    try {
      const wb = await api.masterData.getWorkbook();
      if (wb) {
        setWorkbook(wb);
        validateCurrentWorkbook(wb);
      }
    } catch (err) {
      console.error('Failed to load master workbook:', err);
    }
  }, []);

  useEffect(() => {
    loadWorkbook();
  }, [loadWorkbook]);

  const activeConfig = SHEET_CONFIGS.find(s => s.id === activeSheetId) || SHEET_CONFIGS[1];

  // Helper to validate a cell value based on field type
  const validateCellValue = (type?: string, required?: boolean, val?: any): string | null => {
    const s = String(val ?? '').trim();
    if (required && !s) return 'Required field cannot be empty';
    if (!s) return null;

    if (type === 'date') {
      const ddmm = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      const excelSerial = /^\d{4,6}$/;
      if (!ddmm.test(s) && !iso.test(s) && !excelSerial.test(s)) return 'Invalid date format (use DD/MM/YYYY)';
    }

    if (type === 'number' || type === 'amount') {
      if (isNaN(Number(s.replace(/,/g, '')))) return 'Must be a valid number';
    }

    return null;
  };

  // Run validation across active sheet in active workbook
  const validateCurrentWorkbook = (wb: MasterWorkbook) => {
    const errors: Record<string, string> = {};
    if (activeConfig.id === '01_Society_Master') {
      const sm = (wb.societyMaster || {}) as any;
      activeConfig.columns.forEach(col => {
        const err = validateCellValue(col.type, col.required, sm[col.key]);
        if (err) errors[`01_Society_Master:0:${col.key}`] = err;
      });
    } else {
      const rows = (wb as any)[activeConfig.wbProp] || (activeConfig.wbProp !== 'voucherData' ? wb.commonFile : []) || [];
      rows.forEach((row: any, rIdx: number) => {
        activeConfig.columns.forEach(col => {
          const err = validateCellValue(col.type, col.required, row[col.key]);
          if (err) errors[`${activeConfig.id}:${rIdx}:${col.key}`] = err;
        });
      });
    }
    setValidationErrors(errors);
    return errors;
  };

  // Push current workbook to Undo stack before mutation
  const pushUndoState = () => {
    if (workbook) {
      undoStackRef.current.push(JSON.parse(JSON.stringify(workbook)));
      redoStackRef.current = [];
    }
  };

  // Persist updated workbook to SQLite & notify parent
  const saveWorkbookToDb = async (newWb: MasterWorkbook) => {
    setSaveStatus('saving');
    try {
      const syncedWb = synchronizeMasterWorkbook(newWb);
      validateCurrentWorkbook(syncedWb);
      await api.masterData.updateWorkbook(syncedWb);
      setWorkbook(syncedWb);
      setSaveStatus('saved');
      if (onWorkbookUpdated) onWorkbookUpdated(syncedWb);
    } catch (err) {
      setSaveStatus('error');
      console.error('Failed to save workbook to SQLite:', err);
    }
  };

  // Society Master Key-Value rows adapter
  const getSocietyMasterRows = (): { key: string; field: string; value: string; type?: string; required?: boolean }[] => {
    const sm = (workbook?.societyMaster || {}) as any;
    const sa = sm.societyAddress || { line1: '', line2: '', line3: '', line4: '', line5: '', line6: '' };
    return [
      { key: 'societyName', field: 'Society Name', value: sm.societyName || '', required: true },
      { key: 'registrationNo', field: 'Society Registration No.', value: sm.registrationNo || '', required: true },
      { key: 'registrationDate', field: 'Society Registration Date', value: sm.registrationDate || '', type: 'date' },
      { key: 'headerAddress', field: 'Hedder Address', value: sm.headerAddress || sm.address || '' },
      { key: 'societyAddress.line1', field: 'Society Address — Line 1', value: sa.line1 || '' },
      { key: 'societyAddress.line2', field: 'Society Address — Line 2', value: sa.line2 || '' },
      { key: 'societyAddress.line3', field: 'Society Address — Line 3', value: sa.line3 || '' },
      { key: 'societyAddress.line4', field: 'Society Address — Line 4', value: sa.line4 || '' },
      { key: 'societyAddress.line5', field: 'Society Address — Line 5', value: sa.line5 || '' },
      { key: 'societyAddress.line6', field: 'Society Address — Line 6', value: sa.line6 || '' },
      { key: 'email', field: 'Society Email Id', value: sm.email || '' },
      { key: 'telephone', field: 'Society Telephone or Mobile No.', value: sm.telephone || '' },
      { key: 'unitsFlat', field: 'A) No. of Flat or Room', value: String(sm.unitsFlat ?? 0), type: 'number' },
      { key: 'unitsShop', field: 'B) No. Shop', value: String(sm.unitsShop ?? 0), type: 'number' },
      { key: 'unitsOffice', field: 'C) No. Office', value: String(sm.unitsOffice ?? 0), type: 'number' },
      { key: 'unitsGala', field: 'D) No. Galas', value: String(sm.unitsGala ?? 0), type: 'number' },
      { key: 'printBlanks', field: 'No. of Print Blank (EXTRA SR. No.)', value: String(sm.printBlanks ?? 0), type: 'number' },
      { key: 'totalUnits', field: 'Total Unit', value: String(sm.totalUnits ?? 0), type: 'number' },
    ];
  };

  // Get active sheet's data rows
  const getSheetDataRows = (): any[] => {
    if (!workbook) return [];
    if (activeConfig.id === '01_Society_Master') return getSocietyMasterRows();
    const rows = (workbook as any)[activeConfig.wbProp];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
    // For voucherData, if empty, return default starter row or empty array (do NOT fallback to commonFile)
    if (activeConfig.wbProp === 'voucherData') {
      return rows || [];
    }
    // Fallback to commonFile for member register sheets
    if (workbook.commonFile && workbook.commonFile.length > 0) {
      return workbook.commonFile;
    }
    return rows || [];
  };

  const getFilteredRows = (): { originalIndex: number; row: any }[] => {
    const allRows = getSheetDataRows();
    if (!searchQuery.trim()) {
      return allRows.map((row, index) => ({ originalIndex: index, row }));
    }
    const q = searchQuery.toLowerCase().trim();
    return allRows
      .map((row, index) => ({ originalIndex: index, row }))
      .filter(item => {
        return Object.values(item.row).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        );
      });
  };

  // Commit edit to cell
  const commitCellEdit = (r: number, colKey: string, val: string, andMove?: { dr: number; dc: number } | null) => {
    if (!workbook) return;
    pushUndoState();

    let newWb = JSON.parse(JSON.stringify(workbook)) as MasterWorkbook;

    if (activeConfig.id === '01_Society_Master') {
      const sm = (newWb.societyMaster || {}) as any;
      const rows = getSocietyMasterRows();
      const targetItem = rows[r];
      if (targetItem) {
        const keyToUpdate = targetItem.key;
        if (['totalUnits', 'unitsFlat', 'unitsShop', 'unitsOffice', 'unitsGala', 'printBlanks'].includes(keyToUpdate)) {
          (sm as any)[keyToUpdate] = Number(val) || 0;
        } else if (keyToUpdate.startsWith('societyAddress.')) {
          const subKey = keyToUpdate.split('.')[1] as 'line1' | 'line2' | 'line3' | 'line4' | 'line5' | 'line6';
          if (!sm.societyAddress) sm.societyAddress = { line1: '', line2: '', line3: '', line4: '', line5: '', line6: '' };
          sm.societyAddress[subKey] = val;
          const lines = [sm.societyAddress.line1, sm.societyAddress.line2, sm.societyAddress.line3, sm.societyAddress.line4, sm.societyAddress.line5, sm.societyAddress.line6].filter(Boolean);
          sm.address = lines.join('\n');
        } else if (keyToUpdate === 'headerAddress') {
          sm.headerAddress = val;
          if (!sm.address) sm.address = val;
        } else {
          (sm as any)[keyToUpdate] = val;
        }
      }
      newWb.societyMaster = sm;
    } else if (activeConfig.wbProp === 'voucherData') {
      if (!Array.isArray(newWb.voucherData)) newWb.voucherData = [];
      if (newWb.voucherData[r]) {
        (newWb.voucherData[r] as any)[colKey] = val;
        if (colKey === 'voucherNo') (newWb.voucherData[r] as any)['srNo'] = val;
        if (colKey === 'srNo') (newWb.voucherData[r] as any)['voucherNo'] = val;
        newWb.voucherData[r] = sanitizeAndCalculateVoucher(newWb.voucherData[r]);
      } else {
        const newVch: any = sanitizeAndCalculateVoucher({
          srNo: String(r + 1).padStart(3, '0'),
          voucherNo: String(r + 1).padStart(3, '0'),
          [colKey]: val,
        } as any);
        newWb.voucherData.push(newVch);
      }
    } else {
      // Member registers
      if (!newWb.commonFile) newWb.commonFile = [];
      const targetProp = activeConfig.wbProp;
      let sheetRows = (newWb as any)[targetProp];
      if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
        sheetRows = newWb.commonFile.map(m => ({ ...m }));
        (newWb as any)[targetProp] = sheetRows;
      }

      if (sheetRows[r]) {
        sheetRows[r][colKey] = val;
        if (colKey === 'memberName' || colKey === 'member1') {
          sheetRows[r]['memberName'] = val;
          sheetRows[r]['member1'] = val;
        }
      } else {
        const newMember: any = {
          srNo: String(r + 1).padStart(3, '0'),
          [colKey]: val,
        };
        if (colKey === 'memberName' || colKey === 'member1') {
          newMember.memberName = val;
          newMember.member1 = val;
        }
        sheetRows.push(newMember);
      }

      const regProps = ['formIData', 'formJData', 'shareData', 'nominationData', 'propertyData', 'bankLineMarkData'];
      
      // Update commonFile at index r
      if (newWb.commonFile[r]) {
        newWb.commonFile[r] = { ...newWb.commonFile[r], [colKey]: val };
        if (colKey === 'memberName' || colKey === 'member1') {
          newWb.commonFile[r].memberName = val;
          newWb.commonFile[r].member1 = val;
        }
      } else {
        newWb.commonFile[r] = { ...sheetRows[r] };
      }

      // Update all register sheets at index r
      for (const p of regProps) {
        if (!Array.isArray((newWb as any)[p])) {
          (newWb as any)[p] = newWb.commonFile.map(m => ({ ...m }));
        }
        if ((newWb as any)[p][r]) {
          (newWb as any)[p][r] = { ...(newWb as any)[p][r], [colKey]: val };
          if (colKey === 'memberName' || colKey === 'member1') {
            (newWb as any)[p][r].memberName = val;
            (newWb as any)[p][r].member1 = val;
          }
        } else {
          (newWb as any)[p][r] = { ...sheetRows[r] };
        }
      }
    }

    newWb = synchronizeMasterWorkbook(newWb);
    setWorkbook(newWb);
    setEditingCell(null);
    saveWorkbookToDb(newWb);

    if (andMove && selectedCell) {
      const displayed = getFilteredRows();
      const maxR = displayed.length - 1;
      const maxC = activeConfig.columns.length - 1;
      const curDisplayIdx = displayed.findIndex(item => item.originalIndex === selectedCell.r);
      const resDisplayIdx = curDisplayIdx !== -1 ? curDisplayIdx : 0;

      let nextDisplayIdx = resDisplayIdx + andMove.dr;
      let nextCol = selectedCell.c + andMove.dc;

      if (nextCol > maxC) {
        nextCol = 0;
        nextDisplayIdx = Math.min(maxR, nextDisplayIdx + 1);
      } else if (nextCol < 0) {
        nextCol = maxC;
        nextDisplayIdx = Math.max(0, nextDisplayIdx - 1);
      }

      nextDisplayIdx = Math.max(0, Math.min(maxR, nextDisplayIdx));
      if (displayed[nextDisplayIdx]) {
        setSelectedCell({ r: displayed[nextDisplayIdx].originalIndex, c: nextCol });
      }
    }
  };

  // Add row action — affects active form sheet and synchronizes
  const handleAddRow = () => {
    if (!workbook || activeConfig.id === '01_Society_Master') return;
    pushUndoState();

    let newWb = JSON.parse(JSON.stringify(workbook)) as MasterWorkbook;
    if (!newWb.commonFile) newWb.commonFile = [];

    if (activeConfig.wbProp === 'voucherData') {
      if (!Array.isArray(newWb.voucherData)) newWb.voucherData = [];
      const existingVchs = newWb.voucherData.map((r: any) => parseInt(r.voucherNo || r.srNo, 10)).filter((n: number) => !isNaN(n));
      const maxVch = existingVchs.length > 0 ? Math.max(...existingVchs) : 0;
      const nextVch = String(maxVch + 1).padStart(3, '0');

      const newRow: any = {
        srNo: nextVch,
        voucherNo: nextVch,
        voucherDate: new Date().toLocaleDateString('en-GB'),
        toPayee: '',
        chargeTo: '',
        particulars: '',
        bankName: '',
        chequeNo: '',
        billNo: '',
        billAmount: '',
        billAmount2: '',
        advLessPaid: '',
        subTotal1: '',
        tdsPercent: '',
        tdsAmount: '',
        subTotal2: '',
        cgstPercent: '',
        cgstAmount: '',
        sgstPercent: '',
        sgstAmount: '',
        roundOff: '',
        otherFineAdj: '',
        netPaid: '',
        societyName: newWb.societyMaster?.societyName || '',
        socNumber: newWb.societyMaster?.registrationNo || '',
        societyAddress: newWb.societyMaster?.address || '',
      };
      newWb.voucherData.push(newRow);
      newWb = synchronizeMasterWorkbook(newWb);
      setWorkbook(newWb);
      setSelectedCell({ r: newWb.voucherData.length - 1, c: 0 });
      saveWorkbookToDb(newWb);
    } else {
      const existingSrs = newWb.commonFile.map((r: any) => parseInt(r.srNo, 10)).filter((n: number) => !isNaN(n));
      const maxSr = existingSrs.length > 0 ? Math.max(...existingSrs) : 0;
      const nextSr = String(maxSr + 1).padStart(3, '0');

      const newRow: any = {
        srNo: nextSr,
        member1: `Member ${nextSr}`,
        memberName: `Member ${nextSr}`,
        flatNo: '',
        wingNo: '',
      };
      activeConfig.columns.forEach(c => {
        if (newRow[c.key] === undefined) newRow[c.key] = '';
      });

      newWb.commonFile.push({ ...newRow });

      const regProps = ['formIData', 'formJData', 'shareData', 'nominationData', 'propertyData', 'bankLineMarkData'];
      for (const p of regProps) {
        if (Array.isArray((newWb as any)[p])) {
          (newWb as any)[p].push({ ...newRow });
        }
      }

      newWb = synchronizeMasterWorkbook(newWb);
      setWorkbook(newWb);
      setSelectedCell({ r: newWb.commonFile.length - 1, c: 0 });
      saveWorkbookToDb(newWb);
    }
  };

  // Delete row action — affects active form sheet and synchronizes
  const handleDeleteRow = () => {
    if (!workbook || !selectedCell || activeConfig.id === '01_Society_Master') return;
    const rows = getSheetDataRows();
    if (rows.length === 0 || selectedCell.r >= rows.length) return;

    pushUndoState();
    let newWb = JSON.parse(JSON.stringify(workbook)) as MasterWorkbook;

    if (activeConfig.wbProp === 'voucherData') {
      if (Array.isArray(newWb.voucherData) && newWb.voucherData.length > selectedCell.r) {
        newWb.voucherData.splice(selectedCell.r, 1);
        newWb.voucherData.forEach((row: any, idx: number) => {
          const newSr = String(idx + 1).padStart(3, '0');
          row.srNo = newSr;
          row.voucherNo = newSr;
        });
      }
    } else {
      if (Array.isArray(newWb.commonFile) && newWb.commonFile.length > selectedCell.r) {
        newWb.commonFile.splice(selectedCell.r, 1);
        newWb.commonFile.forEach((row: any, idx: number) => {
          row.srNo = String(idx + 1).padStart(3, '0');
        });
      }
      const regProps = ['formIData', 'formJData', 'shareData', 'nominationData', 'propertyData', 'bankLineMarkData'];
      for (const p of regProps) {
        if (Array.isArray((newWb as any)[p]) && (newWb as any)[p].length > selectedCell.r) {
          (newWb as any)[p].splice(selectedCell.r, 1);
          (newWb as any)[p].forEach((row: any, idx: number) => {
            row.srNo = String(idx + 1).padStart(3, '0');
          });
        }
      }
    }

    newWb = synchronizeMasterWorkbook(newWb);
    setWorkbook(newWb);
    const nextR = Math.max(0, selectedCell.r - 1);
    setSelectedCell({ r: nextR, c: selectedCell.c });
    saveWorkbookToDb(newWb);
  };

  // Duplicate row action — affects active form sheet and synchronizes
  const handleDuplicateRow = () => {
    if (!workbook || !selectedCell || activeConfig.id === '01_Society_Master') return;
    const rows = getSheetDataRows();
    if (rows.length === 0 || selectedCell.r >= rows.length) return;

    pushUndoState();
    let newWb = JSON.parse(JSON.stringify(workbook)) as MasterWorkbook;

    if (activeConfig.wbProp === 'voucherData') {
      if (!Array.isArray(newWb.voucherData)) newWb.voucherData = [];
      const sourceRow = newWb.voucherData[selectedCell.r];
      if (!sourceRow) return;
      const clonedRow = JSON.parse(JSON.stringify(sourceRow));
      const existingVchs = newWb.voucherData.map((r: any) => parseInt(r.voucherNo || r.srNo, 10)).filter((n: number) => !isNaN(n));
      const maxVch = existingVchs.length > 0 ? Math.max(...existingVchs) : 0;
      const nextVch = String(maxVch + 1).padStart(3, '0');
      clonedRow.srNo = nextVch;
      clonedRow.voucherNo = nextVch;
      newWb.voucherData.splice(selectedCell.r + 1, 0, clonedRow);
    } else {
      if (!Array.isArray(newWb.commonFile)) newWb.commonFile = [];
      const sourceRow = newWb.commonFile[selectedCell.r] || rows[selectedCell.r];
      if (!sourceRow) return;
      const clonedRow = JSON.parse(JSON.stringify(sourceRow));
      delete clonedRow.memberId;
      const existingSrs = newWb.commonFile.map((r: any) => parseInt(r.srNo, 10)).filter((n: number) => !isNaN(n));
      const maxSr = existingSrs.length > 0 ? Math.max(...existingSrs) : 0;
      const nextSr = String(maxSr + 1).padStart(3, '0');

      clonedRow.srNo = nextSr;
      if (clonedRow.member1) clonedRow.member1 = `${sourceRow.member1 || 'Member'} (Copy)`;
      if (clonedRow.memberName) clonedRow.memberName = `${sourceRow.memberName || 'Member'} (Copy)`;

      newWb.commonFile.splice(selectedCell.r + 1, 0, clonedRow);
      const regProps = ['formIData', 'formJData', 'shareData', 'nominationData', 'propertyData', 'bankLineMarkData'];
      for (const p of regProps) {
        if (Array.isArray((newWb as any)[p])) {
          (newWb as any)[p].splice(selectedCell.r + 1, 0, { ...clonedRow });
        }
      }
    }

    newWb = synchronizeMasterWorkbook(newWb);
    setWorkbook(newWb);
    setSelectedCell({ r: selectedCell.r + 1, c: selectedCell.c });
    saveWorkbookToDb(newWb);
  };

  // Undo action
  const handleUndo = () => {
    if (undoStackRef.current.length === 0 || !workbook) return;
    redoStackRef.current.push(JSON.parse(JSON.stringify(workbook)));
    const previous = undoStackRef.current.pop()!;
    setWorkbook(previous);
    saveWorkbookToDb(previous);
  };

  // Redo action
  const handleRedo = () => {
    if (redoStackRef.current.length === 0 || !workbook) return;
    undoStackRef.current.push(JSON.parse(JSON.stringify(workbook)));
    const next = redoStackRef.current.pop()!;
    setWorkbook(next);
    saveWorkbookToDb(next);
  };

  // Fill Down / Duplicate Above Cell (Ctrl+D)
  const handleFillDown = () => {
    if (!selectedCell || selectedCell.r <= 0 || !workbook) return;
    const displayed = getFilteredRows();
    const curIdx = displayed.findIndex(item => item.originalIndex === selectedCell.r);
    if (curIdx <= 0) return;

    const prevRow = displayed[curIdx - 1]?.row;
    const curRow = displayed[curIdx]?.row;
    const col = activeConfig.columns[selectedCell.c];
    if (!prevRow || !curRow || !col) return;

    const colKey = activeConfig.id === '01_Society_Master' ? curRow.key : col.key;
    const aboveVal = activeConfig.id === '01_Society_Master' ? prevRow.value : (prevRow[col.key] || '');
    commitCellEdit(selectedCell.r, colKey, aboveVal);
  };

  // Helper to enter Edit Mode on current cell
  const startEditing = (r: number, c: number, overwriteVal?: string) => {
    const displayed = getFilteredRows();
    const curItem = displayed.find(item => item.originalIndex === r);
    if (!curItem) return;

    const col = activeConfig.columns[c];
    const row = curItem.row;
    const currentVal = activeConfig.id === '01_Society_Master'
      ? (c === 0 ? row.field : row.value)
      : (row[col.key] ?? '');

    const initial = overwriteVal !== undefined ? overwriteVal : String(currentVal);
    setInitialEditValue(String(currentVal));
    setEditValue(initial);
    setSelectedCell({ r, c });
    setEditingCell({ r, c });
  };

  // Focus input and place cursor at end when edit mode begins
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingCell]);

  // Scroll active selected cell into view smoothly
  useEffect(() => {
    if (selectedCell && tableContainerRef.current) {
      const cellEl = tableContainerRef.current.querySelector(
        `[data-cell-r="${selectedCell.r}"][data-cell-c="${selectedCell.c}"]`
      ) as HTMLElement | null;
      if (cellEl) {
        cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedCell]);

  // Comprehensive Excel & Google Sheets Keyboard Navigation Engine
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const displayed = getFilteredRows();
    if (displayed.length === 0 || !selectedCell) return;

    const maxR = displayed.length - 1;
    const maxC = activeConfig.columns.length - 1;
    const currentDisplayIdx = displayed.findIndex(item => item.originalIndex === selectedCell.r);
    const resolvedDisplayIdx = currentDisplayIdx !== -1 ? currentDisplayIdx : 0;
    const curRow = displayed[resolvedDisplayIdx]?.row;
    const col = activeConfig.columns[selectedCell.c];
    const colKey = activeConfig.id === '01_Society_Master' ? curRow?.key : col?.key;

    // Stop propagation unconditionally so modal never closes on any spreadsheet key press
    e.stopPropagation();

    // ─────────────────────────────────────────────────────────────
    // A. WHILE IN EDIT MODE
    // ─────────────────────────────────────────────────────────────
    if (editingCell) {
      const editCol = activeConfig.columns[editingCell.c];
      const editingColKey = activeConfig.id === '01_Society_Master' ? getSocietyMasterRows()[editingCell.r]?.key : editCol?.key;

      // 1. Cancel Editing: Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
        setEditValue(initialEditValue);
        return;
      }

      // 2. Alt+Enter (Windows) or Ctrl+Enter: Insert Line Break inside cell
      if ((e.altKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const input = inputRef.current;
        if (input) {
          const start = input.selectionStart || editValue.length;
          const end = input.selectionEnd || editValue.length;
          const newVal = editValue.substring(0, start) + '\n' + editValue.substring(end);
          setEditValue(newVal);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(start + 1, start + 1);
            }
          }, 10);
        }
        return;
      }

      // 3. Enter / Shift+Enter: Commit and move down / up
      if (e.key === 'Enter' && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        if (editingColKey) {
          commitCellEdit(editingCell.r, editingColKey, editValue, { dr: e.shiftKey ? -1 : 1, dc: 0 });
        }
        return;
      }

      // 4. Tab / Shift+Tab: Commit and move right / left
      if (e.key === 'Tab') {
        e.preventDefault();
        if (editingColKey) {
          commitCellEdit(editingCell.r, editingColKey, editValue, { dr: 0, dc: e.shiftKey ? -1 : 1 });
        }
        return;
      }

      // Allow native cursor navigation inside text input
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // B. NAVIGATION MODE SHORTCUTS
    // ─────────────────────────────────────────────────────────────

    // Ctrl+Z (Undo)
    if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z (Redo)
    if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl+S (Save)
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (workbook) saveWorkbookToDb(workbook);
      return;
    }

    // Ctrl+D (Fill Down from above cell)
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      handleFillDown();
      return;
    }

    // Ctrl+C (Copy)
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (curRow) {
        const val = activeConfig.id === '01_Society_Master' ? curRow.value : (curRow[col.key] ?? '');
        setClipboardValue(String(val));
        navigator.clipboard.writeText(String(val));
      }
      return;
    }

    // Ctrl+V (Paste)
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const valToPaste = text || clipboardValue;
        if (valToPaste !== undefined && colKey) {
          commitCellEdit(selectedCell.r, colKey, valToPaste);
        }
      });
      return;
    }

    // Delete / Backspace (Clear Cell Content)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (colKey) {
        commitCellEdit(selectedCell.r, colKey, '');
      }
      return;
    }

    // F2 (Edit Cell Content without clearing)
    if (e.key === 'F2') {
      e.preventDefault();
      startEditing(selectedCell.r, selectedCell.c);
      return;
    }

    // Enter in Navigation Mode: Enter Edit Mode
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter: move up
        const nextIdx = Math.max(0, resolvedDisplayIdx - 1);
        setSelectedCell({ r: displayed[nextIdx].originalIndex, c: selectedCell.c });
      } else {
        startEditing(selectedCell.r, selectedCell.c);
      }
      return;
    }

    // Tab / Shift+Tab in Navigation Mode
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (selectedCell.c > 0) {
          setSelectedCell(prev => ({ r: prev!.r, c: prev!.c - 1 }));
        } else if (resolvedDisplayIdx > 0) {
          setSelectedCell({ r: displayed[resolvedDisplayIdx - 1].originalIndex, c: maxC });
        }
      } else {
        if (selectedCell.c < maxC) {
          setSelectedCell(prev => ({ r: prev!.r, c: prev!.c + 1 }));
        } else if (resolvedDisplayIdx < maxR) {
          setSelectedCell({ r: displayed[resolvedDisplayIdx + 1].originalIndex, c: 0 });
        }
      }
      return;
    }

    // Arrow Keys (with Ctrl support for jumping to edges)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = e.ctrlKey ? 0 : Math.max(0, resolvedDisplayIdx - 1);
      setSelectedCell({ r: displayed[nextIdx].originalIndex, c: selectedCell.c });
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = e.ctrlKey ? maxR : Math.min(maxR, resolvedDisplayIdx + 1);
      setSelectedCell({ r: displayed[nextIdx].originalIndex, c: selectedCell.c });
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextCol = e.ctrlKey ? 0 : Math.max(0, selectedCell.c - 1);
      setSelectedCell(prev => ({ r: prev!.r, c: nextCol }));
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = e.ctrlKey ? maxC : Math.min(maxC, selectedCell.c + 1);
      setSelectedCell(prev => ({ r: prev!.r, c: nextCol }));
      return;
    }

    // Home / End
    if (e.key === 'Home') {
      e.preventDefault();
      setSelectedCell(prev => ({ r: prev!.r, c: 0 }));
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      setSelectedCell(prev => ({ r: prev!.r, c: maxC }));
      return;
    }

    // PageUp / PageDown
    if (e.key === 'PageUp') {
      e.preventDefault();
      const nextIdx = Math.max(0, resolvedDisplayIdx - 10);
      setSelectedCell({ r: displayed[nextIdx].originalIndex, c: selectedCell.c });
      return;
    }

    if (e.key === 'PageDown') {
      e.preventDefault();
      const nextIdx = Math.min(maxR, resolvedDisplayIdx + 10);
      setSelectedCell({ r: displayed[nextIdx].originalIndex, c: selectedCell.c });
      return;
    }

    // Direct Typing: Overwrite cell and enter edit mode immediately
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      startEditing(selectedCell.r, selectedCell.c, e.key);
      return;
    }
  };

  const displayedRows = getFilteredRows();

  return (
    <div
      className="card mb-24"
      style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', outline: 'none' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ── 1. SHEET TABS HEADER ───────────────────────────── */}
      <div
        className="flex items-center gap-2"
        style={{
          background: 'var(--surface-2, #1e293b)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px 0 16px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}
      >
        {SHEET_CONFIGS.map(cfg => {
          const isActive = cfg.id === activeSheetId;
          return (
            <button
              key={cfg.id}
              onClick={() => {
                setActiveSheetId(cfg.id);
                setSelectedCell({ r: 0, c: 0 });
                setEditingCell(null);
              }}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent, #3b82f6)' : 'var(--text-secondary, #94a3b8)',
                background: isActive ? 'var(--bg-card, #0f172a)' : 'transparent',
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid var(--bg-card, #0f172a)' : '1px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <FileSpreadsheet size={13} /> {cfg.name}
            </button>
          );
        })}
      </div>

      {/* ── 2. TOOLBAR ───────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-wrap gap-12"
        style={{
          padding: '10px 16px',
          background: 'var(--bg-card, #0f172a)',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div className="flex items-center gap-8 flex-wrap">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAddRow}
            disabled={activeConfig.id === '01_Society_Master'}
            title="Add a new row"
          >
            <Plus size={14} /> Add Row
          </button>
          <button
            className="btn btn-secondary btn-sm text-error"
            onClick={handleDeleteRow}
            disabled={activeConfig.id === '01_Society_Master' || !selectedCell}
            title="Delete selected row"
          >
            <Trash2 size={14} /> Delete Row
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDuplicateRow}
            disabled={activeConfig.id === '01_Society_Master' || !selectedCell}
            title="Duplicate selected row"
          >
            <Copy size={14} /> Duplicate Row
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleUndo}
            disabled={undoStackRef.current.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={14} /> Undo
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRedo}
            disabled={redoStackRef.current.length === 0}
            title="Redo (Ctrl+Y)"
          >
            <RotateCw size={14} /> Redo
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadWorkbook}
            title="Refresh from DB"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Status Indicator & Detailed Error Breakdown Toggle */}
        <div className="flex items-center gap-12 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Search & Filter Members..."
            className="input-control text-xs"
            style={{ width: 220, height: 28, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-2)' }}
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedCell({ r: 0, c: 0 });
            }}
          />
          {saveStatus === 'saved' && (
            <span className="badge badge-success flex items-center gap-4 text-xs">
              <CheckCircle size={13} /> Saved ✓
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="badge badge-info flex items-center gap-4 text-xs">
              <RefreshCw size={13} className="spin" /> Saving...
            </span>
          )}
          {Object.keys(validationErrors).length > 0 && (
            <button
              className="badge badge-error flex items-center gap-4 text-xs"
              onClick={() => setShowDetailedValidation(!showDetailedValidation)}
              style={{ cursor: 'pointer', border: 'none' }}
              title="Click to view detailed validation breakdown"
            >
              <AlertTriangle size={13} /> {Object.keys(validationErrors).length} Errors
            </button>
          )}
          {workbook && (
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                if (editingCell) {
                  const editCol = activeConfig.columns[editingCell.c];
                  const editingColKey = activeConfig.id === '01_Society_Master' ? getSocietyMasterRows()[editingCell.r]?.key : editCol?.key;
                  if (editingColKey) {
                    commitCellEdit(editingCell.r, editingColKey, editValue);
                  }
                } else {
                  await saveWorkbookToDb(workbook);
                }
              }}
            >
              <Save size={13} /> Save Changes
            </button>
          )}
        </div>
      </div>

      {/* ── 3. DETAILED VALIDATION PANELS ────────────────── */}
      {showDetailedValidation && Object.keys(validationErrors).length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.08)',
            borderBottom: '1px solid var(--border)',
            maxHeight: 120,
            overflowY: 'auto'
          }}
        >
          <div className="text-xs fw-700 text-error mb-6 flex items-center gap-6">
            <AlertTriangle size={13} /> Field Validation Errors ({Object.keys(validationErrors).length})
          </div>
          <div className="grid-2 gap-4">
            {Object.entries(validationErrors).slice(0, 20).map(([k, err]) => (
              <div key={k} className="text-xs text-error font-mono flex items-center gap-4">
                • <span>{k}</span>: <span>{err}</span>
              </div>
            ))}
          </div>
          {Object.keys(validationErrors).length > 20 && (
            <div className="text-xs text-muted mt-4">...and {Object.keys(validationErrors).length - 20} more errors</div>
          )}
        </div>
      )}

      {/* ── 4. SPREADSHEET TABLE GRID ────────────────────── */}
      <div
        ref={tableContainerRef}
        style={{
          maxHeight: 460,
          overflow: 'auto',
          position: 'relative',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border)'
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            tableLayout: 'fixed'
          }}
        >
          {/* Header Row */}
          <thead>
            <tr style={{ background: 'var(--table-header-bg, #e2e8f0)', position: 'sticky', top: 0, zIndex: 10 }}>
              <th
                style={{
                  width: 50,
                  padding: '8px 4px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  fontWeight: 600,
                  position: 'sticky',
                  left: 0,
                  background: 'var(--table-header-bg, #e2e8f0)',
                  zIndex: 11
                }}
              >
                #
              </th>
              {activeConfig.columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width || 150,
                    padding: '8px 10px',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}
                >
                  {col.label} {col.required && <span className="text-error">*</span>}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeConfig.columns.length + 1}
                  style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}
                >
                  {searchQuery ? 'No members match the search query.' : `No records present in ${activeConfig.name}. Click <strong>[ + Add Row ]</strong> to add data.`}
                </td>
              </tr>
            ) : (
              displayedRows.map(({ originalIndex, row }, dIdx) => (
                <tr key={originalIndex} style={{ background: dIdx % 2 === 0 ? 'var(--table-row-even, #ffffff)' : 'var(--table-row-odd, #f8fafc)' }}>
                  {/* Sticky Row Number Column */}
                  <td
                    style={{
                      padding: '6px 4px',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                      fontWeight: 600,
                      position: 'sticky',
                      left: 0,
                      background: 'var(--table-header-bg, #e2e8f0)',
                      zIndex: 5
                    }}
                  >
                    {originalIndex + 1}
                  </td>

                  {/* Editable Data Cells */}
                  {activeConfig.columns.map((col, cIdx) => {
                    const isSelected = selectedCell?.r === originalIndex && selectedCell?.c === cIdx;
                    const isEditing = editingCell?.r === originalIndex && editingCell?.c === cIdx;

                    const colKey = activeConfig.id === '01_Society_Master' ? row.key : col.key;
                    const cellVal = activeConfig.id === '01_Society_Master'
                      ? (cIdx === 0 ? row.field : row.value)
                      : (row[col.key] ?? '');

                    const errKey = `${activeConfig.id}:${originalIndex}:${colKey}`;
                    const hasErr = !!validationErrors[errKey];
                    const isMultilineField = String(cellVal).includes('\n') || colKey.toLowerCase().includes('address') || colKey.toLowerCase().includes('remarks');

                    return (
                      <td
                        key={cIdx}
                        data-cell-r={originalIndex}
                        data-cell-c={cIdx}
                        onClick={e => {
                          e.stopPropagation();
                          if (editingCell && (editingCell.r !== originalIndex || editingCell.c !== cIdx)) {
                            const prevCol = activeConfig.columns[editingCell.c];
                            const prevColKey = activeConfig.id === '01_Society_Master' ? getSocietyMasterRows()[editingCell.r]?.key : prevCol?.key;
                            if (prevColKey) {
                              commitCellEdit(editingCell.r, prevColKey, editValue);
                            }
                          }
                          setSelectedCell({ r: originalIndex, c: cIdx });
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          startEditing(originalIndex, cIdx);
                        }}
                        style={{
                          padding: isEditing ? '0px' : '4px 8px',
                          border: isSelected ? '2px solid var(--accent, #7c3aed)' : '1px solid var(--border)',
                          background: hasErr
                            ? 'rgba(239, 68, 68, 0.15)'
                            : isSelected
                              ? 'var(--cell-selected-bg, rgba(124, 58, 237, 0.12))'
                              : 'transparent',
                          color: hasErr ? 'var(--error, #ef4444)' : 'var(--text-primary)',
                          cursor: 'cell',
                          position: 'relative',
                          whiteSpace: isMultilineField ? 'pre-wrap' : 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          verticalAlign: 'middle',
                          minHeight: 28
                        }}
                        title={hasErr ? validationErrors[errKey] : String(cellVal)}
                      >
                        {isEditing ? (
                          isMultilineField || editValue.includes('\n') ? (
                            <textarea
                              ref={inputRef as any}
                              rows={Math.max(2, editValue.split('\n').length)}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => {
                                commitCellEdit(originalIndex, colKey, editValue);
                              }}
                              style={{
                                width: '100%',
                                minHeight: 38,
                                background: 'var(--input-bg, #ffffff)',
                                color: 'var(--input-text, #0f172a)',
                                border: '2px solid var(--accent, #7c3aed)',
                                outline: 'none',
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                padding: '4px 6px',
                                borderRadius: 0,
                                resize: 'vertical',
                                boxSizing: 'border-box',
                                display: 'block'
                              }}
                            />
                          ) : (
                            <input
                              ref={inputRef as any}
                              type="text"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => {
                                commitCellEdit(originalIndex, colKey, editValue);
                              }}
                              style={{
                                width: '100%',
                                height: 28,
                                background: 'var(--input-bg, #ffffff)',
                                color: 'var(--input-text, #0f172a)',
                                border: '2px solid var(--accent, #7c3aed)',
                                outline: 'none',
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                padding: '2px 6px',
                                borderRadius: 0,
                                boxSizing: 'border-box',
                                display: 'block'
                              }}
                            />
                          )
                        ) : (
                          String(cellVal)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
