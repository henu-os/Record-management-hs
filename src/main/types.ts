// ============================================================
// HENU OS Records Management — Canonical Master Data Schema
// ============================================================

// ------ Society Model ------
export interface Society {
  id: string;
  societyName: string;
  registrationNo: string;
  registrationDate?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  logoBase64?: string;            // Square PNG logo Data URL / base64
  createdAt: string;
  isActive?: boolean;
}

export interface AddSocietyPayload {
  societyName: string;
  registrationNo: string;
  registrationDate?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  logoBase64?: string;            // Square PNG logo Data URL / base64
}

export interface FoundationStatus {
  societyId: string;
  societyMasterComplete: boolean;
  commonMemberMasterComplete: boolean;
  registersUnlocked: boolean;
  societyMasterStatusText: string;
  commonMemberStatusText: string;
  registersStatusText: string;
  memberCount: number;
}

// ------ Society Address (6 Structured Lines) ------
export interface SocietyAddress {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
  line6: string;
}

// ------ Society Master (Canonical Master Identity) ------
export interface SocietyMaster {
  societyName: string;
  registrationNo: string;
  registrationDate: string;       // DD/MM/YYYY
  headerAddress?: string;         // Hedder Address (Header Box)
  address: string;                // Society Registered Address (Full string or combined)
  societyAddress?: SocietyAddress;// Exactly 6 lines: line1..line6
  email: string;
  telephone: string;
  totalUnits: number;
  unitsFlat: number;
  unitsShop: number;
  unitsOffice: number;
  unitsGala: number;
  printBlanks: number;            // Extra blank serial numbers
  authorisedCapital?: string;
  totalAuthorisedShares?: string;
  faceValue?: string;
  logoBase64?: string;            // Square PNG logo Data URL / base64
}

// ------ Unified Normalized Member Record (All 6 Forms Unified) ------
export interface NormalizedMemberRecord {
  memberId?: string;              // Stable internal member ID (UUID)
  srNo: string;                   // Preserves leading zeros ('001', '002')
  membershipNo: string;
  shareCertificateNo: string;
  noOfShares: string;
  valueOfOneShare: string;
  valueOfShares: string;
  sharesFrom: string;             // DD/MM/YYYY
  sharesTo: string;               // DD/MM/YYYY
  dateOfAllotment: string;
  cashBookFolio: string;
  dateOfAdmission: string;
  dateOfEntranceFee: string;
  memberName: string;             // Primary combined display name
  member1: string;
  member2: string;
  member3: string;
  member4: string;
  member5: string;
  member6: string;
  permanentAddress: string;
  residentialAddress: string;
  occupation: string;
  age: string;
  nomineeName: string;
  nomineeAddress: string;
  nominee1?: string;
  nominee2?: string;
  nominee3?: string;
  nominee4?: string;
  nominee5?: string;
  nominee6?: string;
  nomineePercentage1?: string;
  nomineePercentage2?: string;
  nomineePercentage3?: string;
  nomineePercentage4?: string;
  nomineePercentage5?: string;
  nomineePercentage6?: string;
  nomineeRelationship?: string;
  dateOfNomination: string;
  mcMeetingDate: string;
  subsequentRevocation: string;
  dateOfCessation: string;
  reasonForCessation: string;
  remarks: string;
  shareApplication: string;
  shareAllotment: string;
  share1stCall: string;
  share2ndCall: string;
  totalAmountReceived: string;
  serialNoOfShareCertificate: string;
  classOfMember: string;
  dateOfPossession: string;
  distinguishingNo: string;
  flatNo: string;
  wingNo: string;
  descriptionOfTenement: string;
  area: string;
  costOfTenement: string;
  annualGroundRent: string;
  signature: string;
  propertyRemarks: string;
  dateOfTransferRefund: string;
  transferJournalFolioNo: string;
  noOfSharesTransferredRefunded: string;
  shareCertTransferred: string;
  sharesValueTransferred: string;
  nameOfTransferee: string;
  authorityForTransfer: string;
  nomineePercentage: string;
  carpetBuildupSqFt: string;
  dateOfLoanSanction: string;
  bankName: string;
  bankAddress: string;
  loanAmount: string;
  loanPeriod: string;
  mcMeetingApprovalDate: string;
  resolutionNo: string;
  dateOfNOC: string;
  dateOfLienCancellation: string;
  transferDate: string;
  transferCashBookFolio: string;
  noOfSharesTransferred: string;
  transferCertificateNo: string;
  balanceNoOfShares: string;
  balanceSerialNoCertificate: string;
  balanceAmountRs: string;
  floor: string;
  landCost: string;
  constructionCost: string;
  oldShareCertNo?: string;
  oldMembershipNo?: string;
  // Multi-Loan block support (Loans 1 to 4)
  loan1BankName: string;
  loan1BankAddress: string;
  loan1Amount: string;
  loan1Period: string;
  loan1MCDate: string;
  loan1ResolutionNo: string;
  loan1NOCDate: string;
  loan1CancelDate: string;
  loan2BankName: string;
  loan2BankAddress: string;
  loan2Amount: string;
  loan2Period: string;
  loan2MCDate: string;
  loan2ResolutionNo: string;
  loan2NOCDate: string;
  loan2CancelDate: string;
  loan3BankName: string;
  loan3BankAddress: string;
  loan3Amount: string;
  loan3Period: string;
  loan3MCDate: string;
  loan3ResolutionNo: string;
  loan3NOCDate: string;
  loan3CancelDate: string;
  loan4BankName: string;
  loan4BankAddress: string;
  loan4Amount: string;
  loan4Period: string;
  loan4MCDate: string;
  loan4ResolutionNo: string;
  loan4NOCDate: string;
  loan4CancelDate: string;
  loan1Remark?: string;
  loan2Remark?: string;
  loan3Remark?: string;
  loan4Remark?: string;
  // Form I Multi-Entry Shares Held & Transferred (Entries 1 to 5)
  sharesHeldEntries?: FormIShareHeldEntry[];
  sharesTransferredEntries?: FormIShareTransferredEntry[];
}

export interface FormIShareHeldEntry {
  date?: string;
  cashBookFolio?: string;
  application?: string;
  allotment?: string;
  call1st?: string;
  call2nd?: string;
  totalAmountReceived?: string;
  noOfShares?: string;
  sharesFrom?: string;
  sharesTo?: string;
  shareCertificateNo?: string;
}

export interface FormIShareTransferredEntry {
  date?: string;
  cashBookFolio?: string;
  transferDate?: string;
  shareCertificateNo?: string;
  noOfSharesTransferred?: string;
  balanceNoOfShares?: string;
  balanceSerialNoCertificate?: string;
  amountRs?: string;
  amountP?: string;
}

// ------ Sheet Specific Extensions ------
export type CommonFileRecord = NormalizedMemberRecord;
export type FormIRecord = NormalizedMemberRecord;
export type FormJRecord = NormalizedMemberRecord;
export type ShareRecord = NormalizedMemberRecord;
export type NominationRecord = NormalizedMemberRecord;
export type PropertyRecord = NormalizedMemberRecord;
export type BankLineMarkRecord = NormalizedMemberRecord;

// ------ Voucher Record Model ------
export interface VoucherRecord {
  srNo?: string;
  voucherNo: string;
  socNumber?: string;
  societyName?: string;
  societyAddress?: string;
  toPayee: string;             // Pay To
  chargeTo: string;           // Charge To
  particulars: string;        // Description / Particulars
  bankName: string;
  chequeNo: string;
  voucherDate: string;        // DD/MM/YYYY
  billNo?: string;
  billAmount: string;         // Bill Amount 1
  billAmount2?: string;       // Bill Amount 2 (optional)
  advLessPaid: string;        // Adv. Less or Paid
  subTotal1: string;          // Total 1
  tdsPercent: string;         // TDS %
  tdsAmount: string;          // Less TDS @ %
  subTotal2: string;          // Total 2
  cgstPercent: string;        // CGST %
  cgstAmount: string;         // Add CGST @ %
  sgstPercent?: string;       // SGST %
  sgstAmount?: string;        // Add SGST @ %
  roundOff: string;           // Round off (+/-)
  otherFineAdj?: string;      // Other adjustments
  netPaid: string;            // Net Paid =
}

// ------ Master Workbook (9 Sheets) ------
export interface MasterWorkbook {
  societyMaster: SocietyMaster | null;
  commonFile: NormalizedMemberRecord[];
  formIData: NormalizedMemberRecord[];
  formJData: NormalizedMemberRecord[];
  shareData: NormalizedMemberRecord[];
  nominationData: NormalizedMemberRecord[];
  propertyData: NormalizedMemberRecord[];
  bankLineMarkData: NormalizedMemberRecord[];
  voucherData: VoucherRecord[];
  loadedAt: string;
  fileName: string;
  validationErrors: string[];
  validationWarnings: string[];
}

// ------ Validation ------
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type ShareCertificateTemplateId =
  | 'HENU_OS_DEFAULT'
  | 'HENU_OS_1'
  | 'HENU_OS_2'
  | 'HENU_OS_3'
  | 'POLARIS_LUXURY_13X9'
  | 'DESIGN_A_LANDSCAPE'
  | 'DESIGN_B_LANDSCAPE'
  | 'DESIGN_A_PORTRAIT'
  | 'DESIGN_B_PORTRAIT';

export type ShareCertificateRecord = NormalizedMemberRecord;

// ------ Form & Module Identifiers ------
export type FormId =
  | 'FORM_I'
  | 'FORM_J'
  | 'FORM_SHARE'
  | 'FORM_NOM'
  | 'FORM_PROP'
  | 'FORM_BANK'
  | 'FORM_SHARE_CERT'
  | 'FORM_VOUCHER';

export type ModuleId =
  | 'SOCIETY_MASTER'
  | 'COMMON_MEMBER_MASTER'
  | 'FORM_I'
  | 'FORM_J'
  | 'FORM_SHARE'
  | 'FORM_NOM'
  | 'FORM_PROP'
  | 'FORM_BANK'
  | 'FORM_SHARE_CERT'
  | 'FORM_VOUCHER';

// ------ Data Preview & Query Metrics ------
export interface DataPreviewMetrics {
  selectedForm: FormId;
  fromSerial: string;
  toSerial: string;
  foundCount: number;
  blankCount: number;
  totalRequested: number;
  societyName: string;
}

export interface GenerationPreview {
  formId: FormId;
  fromSerial: string;
  toSerial: string;
  requested: number;
  found: number;
  blank: number;
  serialList: string[];
}

export interface GenerationResult {
  success: boolean;
  zipPath: string;
  formId: FormId;
  fromSerial: string;
  toSerial: string;
  totalGenerated: number;
  foundCount: number;
  blankCount: number;
  generatedAt: string;
  errorMessage?: string;
}

// ------ App Settings & History ------
export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type TextRotation = 0 | 90 | 180 | 270;
export type SelectableFontFamily = 'Times-Roman' | 'Helvetica' | 'Courier' | 'Helvetica-Bold' | 'Indie_Flower' | 'Merriweather';

export interface FormDesignSettings {
  societyId?: string;
  formId?: string;
  colorMode: 'Color' | 'BW';
  horizontalAlign: HorizontalAlign;
  verticalAlign: VerticalAlign;
  fontFamily: SelectableFontFamily;
  fontSize: number;          // Bounds: 7 to 12 pt
  bodyFontSize?: number;     // Alias for fontSize
  headerFontSize: number;    // Bounds: 8 to 14 pt
  bold: boolean;
  italic: boolean;
  textWrapping: boolean;
  textRotation: TextRotation;
  textColor: string;
  headerBgColor: string;
  headerFill?: string;       // Alias for headerBgColor
  cellBgColor: string;
  cellFill?: string;         // Alias for cellBgColor
  borderColor: string;
  gridColor: string;
  gridOpacity: number;       // 0 to 100%
  gridThickness: number;     // 0.25 to 1.00 pt
  gridOn: boolean;
  gridEnabled?: boolean;     // Alias for gridOn
  pageNumberAlign: HorizontalAlign;
  pageNumberPrefix: string;
  brandingText: string;
  brandingAlign: HorizontalAlign;
  customFooterText: string;
  customFooterAlign: HorizontalAlign;
  rowsPerPage?: number;
  logoOffsetX?: number;      // Header Logo X offset (-20 to +100 pt, default 0)
  logoOffsetY?: number;      // Header Logo Y offset (-20 to +50 pt, default 0)
  logoSize?: number;         // Header Logo size in pt (24 to 60 pt, default 44 pt)
}

export const DEFAULT_FORM_DESIGN_SETTINGS: FormDesignSettings = {
  colorMode: 'Color',
  horizontalAlign: 'center',
  verticalAlign: 'middle',
  fontFamily: 'Times-Roman',
  fontSize: 7.5,
  bodyFontSize: 7.5,
  headerFontSize: 11,
  bold: false,
  italic: false,
  textWrapping: true,
  textRotation: 0,
  textColor: '#1C355E',
  headerBgColor: '#D9E1F2',
  headerFill: '#D9E1F2',
  cellBgColor: '#FFFFFF',
  cellFill: '#FFFFFF',
  borderColor: '#8EA9DB',
  gridColor: '#D9E1F2',
  gridOpacity: 100,
  gridThickness: 0.5,
  gridOn: true,
  gridEnabled: true,
  pageNumberAlign: 'center',
  pageNumberPrefix: '',
  brandingText: 'HENU OS - Records Management',
  brandingAlign: 'right',
  customFooterText: '',
  customFooterAlign: 'left',
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoSize: 44,
};

export interface RenderColors {
  textColor: string;
  headerFill: string;
  cellFill: string;
  borderColor: string;
}

export function resolveRenderColors(config: Partial<FormDesignSettings>): RenderColors {
  if (config.colorMode === 'BW') {
    return {
      textColor: '#000000',
      headerFill: '#F2F2F2',
      cellFill: '#FFFFFF',
      borderColor: '#000000',
    };
  }
  return {
    textColor: config.textColor || '#1C355E',
    headerFill: config.headerBgColor || config.headerFill || '#D9E1F2',
    cellFill: config.cellBgColor || config.cellFill || '#FFFFFF',
    borderColor: config.borderColor || '#8EA9DB',
  };
}

export interface AppSettings {
  appName: string;
  appSubtitle: string;
  theme: 'light' | 'dark';
  accentColor: string;
}

export interface GenerationHistoryEntry {
  id: string;
  societyId?: string;
  societyName?: string;
  formId: FormId;
  formLabel: string;
  fromSerial: string;
  toSerial: string;
  totalGenerated: number;
  foundCount: number;
  blankCount: number;
  orientation?: 'Portrait' | 'Landscape';
  rowsPerPage?: number;
  gridSetting?: string;
  colorSetting?: string;
  pdfPath?: string;
  excelPath?: string;
  status?: 'SUCCESS' | 'FAILED';
  zipPath?: string;
  generatedAt: string;
}

export interface MasterDataStatus {
  fileName: string;
  societyName: string;
  registrationNo: string;
  commonRecords: number;
  formICnt: number;
  formJCnt: number;
  shareCnt: number;
  nominationCnt: number;
  propertyCnt: number;
  bankCnt: number;
  voucherCnt?: number;
  loadedAt: string;
  validationErrors: string[];
  validationWarnings: string[];
  isValid: boolean;
}

// ------ HENU CONFIG Database & Architecture Types ------
export interface DocumentCategory {
  id: string;
  name: string;
  systemRequired: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  societyId: string;
  societyName?: string;
  categoryId: string;
  categoryName?: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  version: number;
  checksum?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationConfig {
  id: string;
  rootStoragePath: string;
  societiesPath: string;
  backupPath: string;
  exportPath: string;
  importPath: string;
  logsPath: string;
  systemPath: string;
  firstRunCompleted: boolean;
  fileNamingPattern: string;
  duplicateStrategy: 'VERSION' | 'REPLACE' | 'RENAME_AUTO' | 'CANCEL';
  backupEnabled: boolean;
  backupFrequency: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'ON_CLOSE';
  backupRetentionDays: number;
  lastBackupAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageValidationResult {
  isValid: boolean;
  path: string;
  exists: boolean;
  isWritable: boolean;
  isReadable: boolean;
  dbReady: boolean;
  fileStorageReady: boolean;
  availableSpaceBytes?: number;
  availableSpaceFormatted?: string;
  isSystemProtected: boolean;
  errors: string[];
  warnings: string[];
}

export interface BackupItem {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileSizeFormatted: string;
  createdAt: string;
  itemCount: number;
  isVerified: boolean;
}

export interface SystemHealthCheckItem {
  passed: boolean;
  message: string;
  details?: any;
}

export interface SystemHealthReport {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'ERROR';
  checks: {
    database: SystemHealthCheckItem;
    storage: SystemHealthCheckItem & { rootPath?: string; freeSpace?: string };
    societyIndex: SystemHealthCheckItem & { societyCount?: number; missingFolders?: string[] };
    fileIndex: SystemHealthCheckItem & { indexedFiles?: number; missingPhysicalFiles?: number };
    folderStructure: SystemHealthCheckItem;
    configuration: SystemHealthCheckItem;
    permissions: SystemHealthCheckItem;
    backup: SystemHealthCheckItem & { lastBackup?: string };
  };
  missingFilesList: Array<{ id: string; societyName: string; fileName: string; expectedPath: string }>;
}

export interface StorageOverview {
  rootStoragePath: string;
  totalSocieties: number;
  totalDocuments: number;
  totalStorageSizeBytes: number;
  totalStorageSizeFormatted: string;
  categories: Array<{ id: string; name: string; documentCount: number; systemRequired: boolean; active: boolean }>;
  societiesTree: Array<{
    id: string;
    name: string;
    folderName: string;
    path: string;
    categories: Array<{
      id: string;
      name: string;
      path: string;
      fileCount: number;
      files: DocumentRecord[];
    }>;
  }>;
}

// ============================================================
// HENUMASTER — Central Society Administration Types
// ============================================================

export interface SocietyRegisterCount {
  categoryId: string;
  categoryName: string;
  documentCount: number;
  storageBytes: number;
  storageFormatted: string;
  lastUpdated: string;
  status: 'HEALTHY' | 'WARNING' | 'EMPTY';
  navFormId?: string; // e.g. 'generate-FORM_I', 'generate-FORM_VOUCHER'
  folderPath?: string;
  folderExists: boolean;
}

export interface SocietyActivityItem {
  id: string;
  timestamp: string;
  type: 'DOCUMENT_GENERATED' | 'DOCUMENT_SAVED' | 'SOCIETY_CREATED' | 'METADATA_UPDATED' | 'BACKUP_CREATED' | 'STATUS_CHANGED';
  title: string;
  description: string;
  categoryName?: string;
  fileName?: string;
}

export interface SocietyHealthCheck {
  isHealthy: boolean;
  overallStatus: 'HEALTHY' | 'WARNING' | 'ERROR';
  dbRecordExists: boolean;
  folderExists: boolean;
  categoriesConfigured: boolean;
  allCategoryFoldersExist: boolean;
  missingCategoryFolders: string[];
  totalDocuments: number;
  missingPhysicalFiles: number;
  missingFilesList: Array<{ fileName: string; filePath: string }>;
  backupStatus: 'UP_TO_DATE' | 'NEVER' | 'STALE';
  lastBackupAt?: string;
}

export interface SocietySummary {
  id: string;
  societyName: string;
  registrationNo: string;
  registrationDate?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  logoBase64?: string;
  createdAt: string;
  updatedAt?: string;
  yearEstablished?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';
  isActive: boolean; // currently selected society in session
  folderPath?: string;
  storageSizeBytes: number;
  storageSizeFormatted: string;
  documentCount: number;
  filesCount: number;
  importCount?: number;
  exportCount?: number;
  completionStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastActivityTitle?: string;
  lastActivityTimestamp?: string;
  healthStatus: 'HEALTHY' | 'WARNING' | 'ERROR';
  healthMessage?: string;
  lastDocumentDate?: string;
  lastDocumentName?: string;
  memberCount?: number;
}

export interface SocietyOverviewDetails extends SocietySummary {
  rootStoragePath: string;
  registers: SocietyRegisterCount[];
  recentActivity: SocietyActivityItem[];
  health: SocietyHealthCheck;
  missingFilesCount: number;
}

export interface HenuMasterDashboardStats {
  totalSocieties: number;
  activeSocieties: number;
  archivedSocieties: number;
  totalRegisters: number;
  totalDocuments: number;
  totalFiles: number;
  totalImports: number;
  totalExports: number;
  completedSocieties: number;
  inProgressSocieties: number;
  notStartedSocieties: number;
  storageUsedBytes: number;
  storageUsedFormatted: string;
  storageAvailableBytes: number;
  storageAvailableFormatted: string;
  storagePercentUsed: number;
  lastBackupAt: string;
  systemHealthStatus: 'HEALTHY' | 'WARNING' | 'ERROR';
  healthySocietiesCount: number;
  warningSocietiesCount: number;
  activeSocietyId?: string;
  activeSocietyName?: string;
}




