// ============================================================
// HENU OS — Semantic Form Mapping Service
// Maps Normalized Member Records to Form-Specific Fields cleanly.
// Decouples Excel column positions from PDF layout coordinates.
// ============================================================

import { NormalizedMemberRecord, MasterWorkbook, FormId, SocietyMaster } from '../types';
import { normalizeSerial, normalizeSerialKey } from './SerialRangeEngine';

export class FormMappingService {
  /**
   * Formats up to 6 joint member names into a clean comma-separated string:
   * "Name 1, Name 2, Name 3, Name 4, Name 5, Name 6"
   */
  static formatAllMemberNames(rec: NormalizedMemberRecord | null | undefined): string {
    if (!rec) return '';
    const members = [rec.member1, rec.member2, rec.member3, rec.member4, rec.member5, rec.member6]
      .map(m => (m ? String(m).trim() : ''))
      .filter(Boolean);

    if (members.length > 0) {
      return members.join(', ');
    }

    if (rec.memberName) {
      return rec.memberName
        .split(/[\/\+\,]/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }

  /**
   * Builds the exactly 6 logical address lines for Permanent Address.
   * Line 1 = {captured member permanent-address data}, {Society Line 1} (or just Society Line 1 if member address is empty)
   * Line 2 = {Society Line 2}
   * Line 3 = {Society Line 3}
   * Line 4 = {Society Line 4}
   * Line 5 = {Society Line 5}
   * Line 6 = {Society Line 6}
   * 
   * CRITICAL: Society address is ONLY appended to Permanent Address, NEVER to Residential Address.
   */
  static buildPermanentAddressLines(
    rec: NormalizedMemberRecord | null | undefined,
    society: SocietyMaster | null | undefined
  ): string[] {
    const sAddr = society?.societyAddress;
    let sLines: string[] = [];
    if (sAddr) {
      sLines = [
        sAddr.line1 || '',
        sAddr.line2 || '',
        sAddr.line3 || '',
        sAddr.line4 || '',
        sAddr.line5 || '',
        sAddr.line6 || '',
      ];
    } else if (society?.address) {
      const parts = society.address.split(/[\r\n]+/).map(p => p.trim());
      sLines = [
        parts[0] || '',
        parts[1] || '',
        parts[2] || '',
        parts[3] || '',
        parts[4] || '',
        parts[5] || '',
      ];
    } else {
      sLines = ['', '', '', '', '', ''];
    }

    // Determine member's local permanent address components (e.g. flatNo, wingNo, or raw permanentAddress)
    let memberPart = '';
    if (rec) {
      if (rec.permanentAddress && rec.permanentAddress.trim()) {
        memberPart = rec.permanentAddress.trim();
      } else {
        const flat = rec.flatNo ? String(rec.flatNo).trim() : '';
        const wing = rec.wingNo ? String(rec.wingNo).trim() : '';
        const parts = [flat, wing].filter(Boolean);
        memberPart = parts.join(', ');
      }
    }

    const sLine1 = (sLines[0] || '').trim();
    let line1 = '';
    if (memberPart && sLine1) {
      line1 = `${memberPart}, ${sLine1}`;
    } else if (memberPart) {
      line1 = memberPart;
    } else {
      line1 = sLine1;
    }

    return [
      line1,
      (sLines[1] || '').trim(),
      (sLines[2] || '').trim(),
      (sLines[3] || '').trim(),
      (sLines[4] || '').trim(),
      (sLines[5] || '').trim(),
    ];
  }

  /**
   * Formats Permanent Address as a clean multi-line string with non-empty lines joined by newline.
   */
  static formatPermanentAddress(
    rec: NormalizedMemberRecord | null | undefined,
    society: SocietyMaster | null | undefined
  ): string {
    const lines = FormMappingService.buildPermanentAddressLines(rec, society);
    const nonBlank = lines.filter(l => l.trim() !== '');
    return nonBlank.length > 0 ? nonBlank.join('\n') : '';
  }

  /**
   * Returns a blank NormalizedMemberRecord containing ONLY the serial number,
   * leaving all other fields as empty strings ("").
   */
  static createBlankRecord(serialNo: string): NormalizedMemberRecord {
    return {
      srNo: serialNo,
      membershipNo: '',
      shareCertificateNo: '',
      noOfShares: '',
      valueOfOneShare: '',
      valueOfShares: '',
      sharesFrom: '',
      sharesTo: '',
      dateOfAllotment: '',
      cashBookFolio: '',
      dateOfAdmission: '',
      dateOfEntranceFee: '',
      memberName: '',
      member1: '',
      member2: '',
      member3: '',
      member4: '',
      member5: '',
      member6: '',
      permanentAddress: '',
      residentialAddress: '',
      occupation: '',
      age: '',
      nomineeName: '',
      nomineeAddress: '',
      dateOfNomination: '',
      mcMeetingDate: '',
      subsequentRevocation: '',
      dateOfCessation: '',
      reasonForCessation: '',
      remarks: '',
      shareApplication: '',
      shareAllotment: '',
      share1stCall: '',
      share2ndCall: '',
      totalAmountReceived: '',
      serialNoOfShareCertificate: '',
      classOfMember: '',
      dateOfPossession: '',
      distinguishingNo: '',
      flatNo: '',
      wingNo: '',
      descriptionOfTenement: '',
      area: '',
      costOfTenement: '',
      annualGroundRent: '',
      signature: '',
      propertyRemarks: '',
      dateOfTransferRefund: '',
      transferJournalFolioNo: '',
      noOfSharesTransferredRefunded: '',
      shareCertTransferred: '',
      sharesValueTransferred: '',
      nameOfTransferee: '',
      authorityForTransfer: '',
      nomineePercentage: '',
      carpetBuildupSqFt: '',
      dateOfLoanSanction: '',
      bankName: '',
      bankAddress: '',
      loanAmount: '',
      loanPeriod: '',
      mcMeetingApprovalDate: '',
      resolutionNo: '',
      dateOfNOC: '',
      dateOfLienCancellation: '',
      transferDate: '',
      transferCashBookFolio: '',
      noOfSharesTransferred: '',
      transferCertificateNo: '',
      balanceNoOfShares: '',
      balanceSerialNoCertificate: '',
      balanceAmountRs: '',
      floor: '',
      landCost: '',
      constructionCost: '',
      oldShareCertNo: '',
      oldMembershipNo: '',
      loan1BankName: '',
      loan1BankAddress: '',
      loan1Amount: '',
      loan1Period: '',
      loan1MCDate: '',
      loan1ResolutionNo: '',
      loan1NOCDate: '',
      loan1CancelDate: '',
      loan2BankName: '',
      loan2BankAddress: '',
      loan2Amount: '',
      loan2Period: '',
      loan2MCDate: '',
      loan2ResolutionNo: '',
      loan2NOCDate: '',
      loan2CancelDate: '',
      loan3BankName: '',
      loan3BankAddress: '',
      loan3Amount: '',
      loan3Period: '',
      loan3MCDate: '',
      loan3ResolutionNo: '',
      loan3NOCDate: '',
      loan3CancelDate: '',
      loan4BankName: '',
      loan4BankAddress: '',
      loan4Amount: '',
      loan4Period: '',
      loan4MCDate: '',
      loan4ResolutionNo: '',
      loan4NOCDate: '',
      loan4CancelDate: '',
      loan1Remark: '',
      loan2Remark: '',
      loan3Remark: '',
      loan4Remark: '',
    };
  }

  /**
   * Resolves a record from the MasterWorkbook by serial number.
   * Merges specific sheet data over Common File master data.
   * Returns a blank record with only srNo populated if missing.
   */
  static resolveRecord(workbook: MasterWorkbook, formId: FormId, serialNo: string): NormalizedMemberRecord {
    const key = normalizeSerialKey(serialNo);

    // Look up in Common File first
    const common = workbook.commonFile.find(r => normalizeSerialKey(r.srNo) === key);

    // Look up in form-specific sheet
    let specific: NormalizedMemberRecord | undefined;
    switch (formId) {
      case 'FORM_I':
        specific = workbook.formIData.find(r => normalizeSerialKey(r.srNo) === key);
        break;
      case 'FORM_J':
        specific = workbook.formJData.find(r => normalizeSerialKey(r.srNo) === key);
        break;
      case 'FORM_SHARE':
        specific = workbook.shareData.find(r => normalizeSerialKey(r.srNo) === key);
        break;
      case 'FORM_NOM':
        specific = workbook.nominationData.find(r => normalizeSerialKey(r.srNo) === key);
        break;
      case 'FORM_PROP':
        specific = workbook.propertyData.find(r => normalizeSerialKey(r.srNo) === key);
        break;
      case 'FORM_BANK':
        specific = workbook.bankLineMarkData.find(r => normalizeSerialKey(r.srNo) === key);
        break;
      case 'FORM_SHARE_CERT':
        specific = (workbook as any).shareCertData?.find((r: any) => normalizeSerialKey(r.srNo) === key) || workbook.shareData?.find(r => normalizeSerialKey(r.srNo) === key) || workbook.commonFile?.find(r => normalizeSerialKey(r.srNo) === key);
        break;
    }

    if (!common && !specific) {
      return this.createBlankRecord(serialNo);
    }

    const base = this.createBlankRecord(serialNo);
    const merged: any = { ...base };

    if (common) {
      for (const [k, v] of Object.entries(common)) {
        if (v !== undefined && v !== null && v !== '') {
          merged[k] = v;
        }
      }
    }

    if (specific) {
      for (const [k, v] of Object.entries(specific)) {
        if (v !== undefined && v !== null && v !== '') {
          merged[k] = v;
        }
      }
    }

    merged.srNo = serialNo; // Ensure original requested serial (with padding) is preserved
    return merged as NormalizedMemberRecord;
  }

  /** Form I Semantic Fields */
  static mapToFormI(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      dateOfAdmission: rec.dateOfAdmission,
      dateOfEntranceFee: rec.dateOfEntranceFee,
      memberName: FormMappingService.formatAllMemberNames(rec),
      permanentAddress: rec.permanentAddress,
      residentialAddress: rec.residentialAddress,
      occupation: rec.occupation,
      age: rec.age,
      nomineeName: rec.nomineeName,
      nomineeAddress: rec.nomineeAddress,
      dateOfNomination: rec.dateOfNomination,
      dateOfCessation: rec.dateOfCessation,
      reasonForCessation: rec.reasonForCessation,
      remarks: rec.remarks,
      shareAllotmentDate: rec.dateOfAllotment,
      cashBookFolio: rec.cashBookFolio,
      shareApplication: rec.shareApplication,
      shareAllotment: rec.shareAllotment,
      share1stCall: rec.share1stCall,
      share2ndCall: rec.share2ndCall,
      totalAmountReceived: rec.totalAmountReceived || rec.valueOfShares,
      noOfSharesHeld: rec.noOfShares,
      serialNoOfShareCertificate: rec.shareCertificateNo,
      transferDate: rec.transferDate,
      transferCashBookFolio: rec.transferCashBookFolio,
      noOfSharesTransferred: rec.noOfSharesTransferred,
      transferCertificateNo: rec.transferCertificateNo,
      balanceNoOfShares: rec.balanceNoOfShares,
      balanceSerialNoCertificate: rec.balanceSerialNoCertificate,
      balanceAmountRs: rec.balanceAmountRs,
    };
  }

  /** Form J Semantic Fields */
  static mapToFormJ(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      memberName: FormMappingService.formatAllMemberNames(rec),
      address: rec.permanentAddress || rec.residentialAddress,
      classOfMember: rec.classOfMember || (rec.memberName || rec.srNo ? 'Active Member' : ''),
    };
  }

  /** Share Register Semantic Fields */
  static mapToShareRegister(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      dateOfAllotment: rec.dateOfAllotment,
      cashBookFolioNo: rec.cashBookFolio,
      shareCertificateNo: rec.shareCertificateNo,
      noOfShares: rec.noOfShares,
      valueOfShares: rec.valueOfShares,
      memberName: FormMappingService.formatAllMemberNames(rec),
      member1: rec.member1,
      member2: rec.member2,
      member3: rec.member3,
      member4: rec.member4,
      member5: rec.member5,
      member6: rec.member6,
      flatNo: rec.flatNo,
      wingNo: rec.wingNo,
      dateOfTransferRefund: rec.dateOfTransferRefund,
      transferJournalFolioNo: rec.transferJournalFolioNo,
      noOfSharesTransferredRefunded: rec.noOfSharesTransferredRefunded || rec.noOfSharesTransferred,
      shareCertTransferred: rec.shareCertTransferred || rec.transferCertificateNo,
      sharesValueTransferred: rec.sharesValueTransferred,
      nameOfTransferee: rec.nameOfTransferee,
      authorityForTransfer: rec.authorityForTransfer,
      oldShareCertNo: rec.oldShareCertNo,
      oldMembershipNo: rec.oldMembershipNo,
      sharesFrom: rec.sharesFrom,
      sharesTo: rec.sharesTo,
      remark: rec.remarks || rec.propertyRemarks,
    };
  }

  /** Nomination Register Semantic Fields */
  static mapToNominationRegister(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      membershipNo: rec.membershipNo,
      shareCertificateNo: rec.shareCertificateNo,
      permanentAddress: rec.permanentAddress,
      memberName: FormMappingService.formatAllMemberNames(rec),
      dateOfNomination: rec.dateOfNomination,
      nomineeName: rec.nomineeName,
      nomineeAddress: rec.nomineeAddress,
      nomineePercentage: rec.nomineePercentage,
      mcMeetingDate: rec.mcMeetingDate,
      subsequentRevocation: rec.subsequentRevocation,
      remark: rec.remarks,
    };
  }

  /** Property Register Semantic Fields */
  static mapToPropertyRegister(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      memberName: FormMappingService.formatAllMemberNames(rec),
      dateOfPossession: rec.dateOfPossession,
      distinguishingNo: rec.distinguishingNo || rec.flatNo,
      descriptionOfTenement: rec.descriptionOfTenement || (rec.flatNo ? `Flat/Unit: ${rec.flatNo} Wing: ${rec.wingNo || ''}` : ''),
      areaOfTenement: rec.area,
      costOfTenement: rec.costOfTenement,
      annualGroundRent: rec.annualGroundRent,
      dateOfCessation: rec.dateOfCessation,
      signature: rec.signature,
      remark: rec.propertyRemarks || rec.remarks,
    };
  }

  /** Lien Mark Register Semantic Fields */
  static mapToLienMarkRegister(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      permanentAddress: rec.permanentAddress,
      flatNo: rec.flatNo,
      wingNo: rec.wingNo,
      area: rec.area,
      carpetBuildupSqFt: rec.carpetBuildupSqFt,
      shareCertificateNo: rec.shareCertificateNo,
      sharesFrom: rec.sharesFrom,
      sharesTo: rec.sharesTo,
      memberName: FormMappingService.formatAllMemberNames(rec),
      member1: rec.member1,
      member2: rec.member2,
      member3: rec.member3,
      member4: rec.member4,
      member5: rec.member5,
      member6: rec.member6,
      dateOfLoanSanction: rec.dateOfLoanSanction,
      bankName: rec.bankName,
      bankAddress: rec.bankAddress,
      loanAmount: rec.loanAmount,
      loanPeriod: rec.loanPeriod,
      mcMeetingApprovalDate: rec.mcMeetingApprovalDate,
      resolutionNo: rec.resolutionNo,
      dateOfNOC: rec.dateOfNOC,
      dateOfLienCancellation: rec.dateOfLienCancellation,
    };
  }

  /** Share Certificate Semantic Fields */
  static mapToShareCertificate(rec: NormalizedMemberRecord) {
    return {
      srNo: rec.srNo,
      shareCertificateNo: rec.shareCertificateNo || rec.srNo,
      memberRegisterNo: rec.membershipNo || rec.srNo,
      noOfShares: rec.noOfShares || '10',
      shareValue: rec.valueOfShares || rec.totalAmountReceived || '500',
      distinctiveFrom: rec.sharesFrom || '001',
      distinctiveTo: rec.sharesTo || '010',
      wing: rec.wingNo || '',
      flatNo: rec.flatNo || '',
      holder1: rec.member1 || rec.memberName || '',
      holder2: rec.member2 || '',
      holder3: rec.member3 || '',
      holder4: rec.member4 || '',
      holder5: rec.member5 || '',
      holder6: rec.member6 || '',
      oldShareCertNo: rec.oldShareCertNo || '',
      issueDate: rec.dateOfAllotment || '',
      issueCity: 'MUMBAI',
    };
  }
}
