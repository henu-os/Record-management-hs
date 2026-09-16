/* global.d.ts — API bridge type declarations */
import { Society, AddSocietyPayload, FoundationStatus, ModuleId } from '../main/types';

interface Window {
  api: {
    society: {
      list(): Promise<Society[]>;
      getActive(): Promise<Society>;
      create(payload: AddSocietyPayload): Promise<Society>;
      select(societyId: string): Promise<Society>;
    };
    foundation: {
      getStatus(): Promise<FoundationStatus>;
    };
    settings: {
      get(key: string, defaultValue?: string): Promise<string>;
      set(key: string, value: string): Promise<void>;
      list(): Promise<{ key: string; value: string }[]>;
      getFormSettings(formId: string): Promise<any>;
      saveFormSettings(formId: string, settings: any): Promise<any>;
      resetFormSettings(formId: string): Promise<any>;
      resetGlobalSettings(): Promise<any>;
    };
    masterData: {
      downloadTemplate(): Promise<string | null>;
      downloadMasterTemplate(): Promise<string | null>;
      exportMaster(): Promise<string | null>;
      downloadModuleTemplate(moduleId: ModuleId): Promise<string | null>;
      exportModule(moduleId: ModuleId): Promise<string | null>;
      importModule(moduleId: ModuleId): Promise<MasterDataStatus | null>;
      getMembersList(): Promise<NormalizedMemberRecord[]>;
      updateMemberRecord(record: Partial<NormalizedMemberRecord>): Promise<MasterDataStatus | null>;
      upload(): Promise<MasterDataStatus | null>;
      getStatus(): Promise<MasterDataStatus | null>;
      clear(): Promise<void>;
      getFormDetails(formId: string): Promise<FormDetails | null>;
    };
    generate: {
      preview(formId: string, fromSerial: string, toSerial: string): Promise<GenerationPreview>;
      /** Same engine as execute — preview === final PDF (spec 33) */
      previewPdf(formId: string, fromSerial: string, toSerial: string, options?: { orientationOverride?: 'Portrait' | 'Landscape'; prefix?: string; separator?: string }): Promise<{
        previewPdfUrl?: string;
        previewPdfPath?: string;
        error?: string;
      }>;
      execute(formId: string, fromSerial: string, toSerial: string, options?: { orientationOverride?: 'Portrait' | 'Landscape'; prefix?: string; separator?: string }): Promise<GenerationResult>;
      onProgress(callback: (msg: string) => void): void;
      removeProgressListener(): void;
    };
    history: {
      list(): Promise<GenerationHistoryEntry[]>;
      clear(): Promise<void>;
    };
    tests: {
      run(): Promise<TestSuiteResult>;
    };
    system: {
      getPaths(): Promise<AppPaths>;
      getAppInfo(): Promise<AppInfo>;
      openPath(p: string): Promise<void>;
      showItemInFolder(p: string): Promise<void>;
      openFileDialog(options: any): Promise<string | null>;
      showSaveDialog(options: any): Promise<string | null>;
    };
  };
}

interface MasterDataStatus {
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
  loadedAt: string;
  validationErrors: string[];
  validationWarnings: string[];
  isValid: boolean;
}

interface GenerationPreview {
  formId?: string;
  fromSerial?: string;
  toSerial?: string;
  requested?: number;
  found?: number;
  blank?: number;
  serialList?: string[];
  error?: string;
}

interface GenerationResult {
  success: boolean;
  zipPath?: string;
  previewPdfUrl?: string;  // file:// URL for iframe display
  previewPdfPath?: string;
  formId?: string;
  fromSerial?: string;
  toSerial?: string;
  totalGenerated?: number;
  foundCount?: number;
  blankCount?: number;
  generatedAt?: string;
  errorMessage?: string;
}

interface GenerationHistoryEntry {
  id: string;
  form_id: string;
  form_label: string;
  from_serial: string;
  to_serial: string;
  total_generated: number;
  found_count: number;
  blank_count: number;
  zip_path: string;
  generated_at: string;
}

interface AppPaths {
  downloadsZip: string;
  downloadsTemplates: string;
  downloadsHlabs: string;
  userData: string;
  temp: string;
  templatesSource: string;
}

interface AppInfo {
  version: string;
  name: string;
  isPackaged: boolean;
  nodeVersion: string;
  electronVersion: string;
}

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  durationMs: number;
  error?: string;
}

interface FormDetails {
  sheetName: string;
  recordCount: number;
  availableMinSerial: string;
  availableMaxSerial: string;
  missingSerials: string[];
  orientation: string;
  outputType: string;
}
