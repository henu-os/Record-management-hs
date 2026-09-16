// ============================================================
// HENU OS — Share Certificate Field Definitions & Data Contract
// Defines all data fields required by the Share Certificate Master
// ============================================================

export interface ShareCertificateFieldData {
  // Serial & Registration Identifiers
  serialNo: string;
  shareCertificateNo: string;
  memberRegisterNo: string;
  noOfShares: string;
  sharesInWords?: string;
  flatNo: string;
  wingNo?: string;

  // Society Identity
  societyName: string;
  societyLegalName?: string;
  societyAddress: string;
  registrationNo: string;
  registrationDate: string;
  authorisedCapital: string;
  totalAuthorisedShares: string;
  faceValue: string;

  // Primary Member / Holders
  memberName: string;
  member1?: string;
  member2?: string;
  member3?: string;

  // Distinctive Shares Numbers
  sharesFrom: string;
  sharesTo: string;
  valueOfShares: string;

  // Issue Statement
  issueCity?: string;
  issueDate?: string;

  // Old Certificate Clause
  oldCertificateNo?: string;
  oldSharesFrom?: string;
  oldSharesTo?: string;

  // Front Acknowledgement (3 Receivers)
  receiver1Name?: string;
  receiver1PanAadhaar?: string;
  receiver1Mobile?: string;

  receiver2Name?: string;
  receiver2PanAadhaar?: string;
  receiver2Mobile?: string;

  receiver3Name?: string;
  receiver3PanAadhaar?: string;
  receiver3Mobile?: string;

  // Back Memorandum of Transfers (5 Rows)
  transfers?: Array<{
    date?: string;
    transferNo?: string;
    transferorRegNo?: string;
    transfereeName?: string;
    transfereeRegNo?: string;
  }>;
}
