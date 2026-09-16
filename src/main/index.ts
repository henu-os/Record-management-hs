import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

const logFile = path.join(__dirname, '../../main_debug.log');
function debugLog(msg: string) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { }
}

debugLog('=== Main process starting ===');

process.on('uncaughtException', (err) => {
  debugLog(`Uncaught Exception: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  debugLog(`Unhandled Rejection: ${reason}`);
});

app.setName('HENU OS Records Management');
const userPath = path.join(app.getPath('appData'), 'HENU_OS_Records');
app.setPath('userData', userPath);
debugLog(`userData path set to: ${userPath}`);

// Prevent Chromium Windows GPU disk cache locking & access denied crashes (0x5)
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('no-crashpad');





import { initializeDatabase, getPaths, getDatabase } from './db';
import { MasterDataService, synchronizeMasterWorkbook, sanitizeAndCalculateVoucher } from './services/MasterDataService';
import { PdfEngine } from './services/PdfEngine';
import { ZipService } from './services/ZipService';
import { ValidationEngine } from './services/ValidationEngine';
import { generateRange, normalizeSerial } from './services/SerialRangeEngine';
import { FormDesignSettingsService } from './services/FormDesignSettingsService';
import {
  MasterWorkbook,
  FormId,
  GenerationResult,
  GenerationHistoryEntry,
  Society,
  AddSocietyPayload,
  FoundationStatus,
  ModuleId,
  NormalizedMemberRecord,
} from './types';
import { v4 as uuidv4 } from 'uuid';

let mainWindow: BrowserWindow | null = null;
let activeMasterWorkbook: MasterWorkbook | null = null;

function createDefaultWorkbook(activeSoc: any): MasterWorkbook {
  return {
    loadedAt: new Date().toISOString(),
    fileName: 'Default_Master_Data.xlsx',
    societyMaster: {
      societyName: activeSoc?.societyName || 'HENU OS CO-OPERATIVE HOUSING SOCIETY',
      registrationNo: activeSoc?.registrationNo || '',
      registrationDate: activeSoc?.registrationDate || '',
      address: activeSoc?.fullAddress || '',
      email: '',
      telephone: '',
      totalUnits: 0,
      unitsFlat: 0,
      unitsShop: 0,
      unitsOffice: 0,
      unitsGala: 0,
      printBlanks: 0,
      logoBase64: activeSoc?.logoBase64 || '',
    },
    commonFile: [],
    formIData: [],
    formJData: [],
    shareData: [],
    nominationData: [],
    propertyData: [],
    bankLineMarkData: [],
    voucherData: [],
    validationErrors: [],
    validationWarnings: [],
  };
}

function createWindow() {
  debugLog('createWindow called');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Required for file:// PDF preview in iframe
    },
    title: 'HENU OS — Records Management',
    titleBarStyle: 'default',
    backgroundColor: '#0f1120',
    icon: fs.existsSync(path.join(__dirname, '../../henu_business.ico'))
      ? path.join(__dirname, '../../henu_business.ico')
      : path.join(__dirname, '../../henu_business.png'),
  });

  mainWindow.setMenuBarVisibility(false);

  const indexPath = path.join(__dirname, '../renderer/index.html');
  debugLog(`indexPath: ${indexPath} exists: ${fs.existsSync(indexPath)}`);

  if (!app.isPackaged) {
    debugLog('Loading http://localhost:5174');
    mainWindow.loadURL('http://localhost:5174').catch((err) => {
      debugLog(`loadURL failed: ${err.message}, fallback to index.html`);
      if (fs.existsSync(indexPath)) {
        mainWindow?.loadFile(indexPath);
      }
    });
  } else if (fs.existsSync(indexPath)) {
    debugLog(`Loading file: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  } else {
    debugLog('Fallback loading http://localhost:5174');
    mainWindow.loadURL('http://localhost:5174');
  }

  mainWindow.on('closed', () => {
    debugLog('mainWindow closed');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  debugLog('app.whenReady resolved');
  try {
    initializeDatabase();
    debugLog('initializeDatabase succeeded');
  } catch (err: any) {
    debugLog(`initializeDatabase error: ${err.stack || err}`);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  debugLog('app window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});

function dbLog(operation: string, message: string, metadata: object = {}) {
  try {
    const db = getDatabase();
    db.prepare(`INSERT INTO app_logs (timestamp, level, operation, message, metadata) VALUES (?, 'INFO', ?, ?, ?)`)
      .run(new Date().toISOString(), operation, message, JSON.stringify(metadata));
  } catch { }
}

/** Converts Windows path to file:// URL for Chromium iframe */
function toFileUrl(winPath: string): string {
  return 'file:///' + winPath.replace(/\\/g, '/');
}

function getActiveSociety(): Society {
  const db = getDatabase();
  let row = db.prepare('SELECT * FROM societies WHERE is_active = 1 LIMIT 1').get() as any;
  if (!row) {
    row = db.prepare('SELECT * FROM societies ORDER BY created_at ASC LIMIT 1').get() as any;
    if (row) {
      db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(row.id);
    }
  }
  if (!row) {
    const id = 'default-society-1';
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, logo_base64, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, 'HENU OS PRIVATE LIMITED', 'U62099RJ2025PTC109150', '02/12/2025', 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home', 'Pali', 'Rajasthan', '306401', '', now);
    row = db.prepare('SELECT * FROM societies WHERE id = ?').get(id) as any;
  }
  return {
    id: row.id,
    societyName: row.society_name,
    registrationNo: row.registration_no,
    registrationDate: row.registration_date || '',
    fullAddress: row.full_address || '',
    city: row.city || '',
    state: row.state || '',
    pinCode: row.pin_code || '',
    createdAt: row.created_at,
    isActive: Boolean(row.is_active),
    logoBase64: row.logo_base64 || '',
  };
}

function loadActiveMasterWorkbook(): MasterWorkbook | null {
  const activeSociety = getActiveSociety();
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1 ORDER BY loaded_at DESC LIMIT 1').get(activeSociety.id) as any;
  if (row) {
    try {
      activeMasterWorkbook = JSON.parse(row.workbook_json) as MasterWorkbook;
      // Overlay society identity fields from the active society row (do NOT re-sync data arrays)
      if (activeMasterWorkbook) {
        if (!activeMasterWorkbook.societyMaster) {
          activeMasterWorkbook.societyMaster = {} as any;
        }
        const sm = activeMasterWorkbook.societyMaster as any;
        // Only update identity fields from the authoritative society record
        sm.societyName = activeSociety.societyName;
        sm.registrationNo = activeSociety.registrationNo;
        if (!sm.registrationDate) {
          sm.registrationDate = activeSociety.registrationDate || '';
        }
        if (!sm.address) {
          sm.address = [activeSociety.fullAddress, activeSociety.city, activeSociety.state, activeSociety.pinCode].filter(Boolean).join(', ') || '';
        }
        sm.logoBase64 = (activeSociety as any).logoBase64 || '';
        // NOTE: Do NOT call synchronizeMasterWorkbook here — the workbook in the DB is already
        // the canonical edited state. Re-syncing would overwrite user edits with stale data.
      }
    } catch {
      activeMasterWorkbook = null;
    }
  } else {
    activeMasterWorkbook = null;
  }
  return activeMasterWorkbook;
}

// ══════════════════════════════════════════════════════════════
// SOCIETY MANAGEMENT
// ══════════════════════════════════════════════════════════════
ipcMain.handle('society:list', () => {
  const db = getDatabase();
  try {
    db.prepare('ALTER TABLE societies ADD COLUMN logo_base64 TEXT').run();
  } catch { }
  const rows = db.prepare('SELECT * FROM societies ORDER BY created_at ASC').all() as any[];
  return rows.map(row => ({
    id: row.id,
    societyName: row.society_name,
    registrationNo: row.registration_no,
    registrationDate: row.registration_date || '',
    fullAddress: row.full_address || '',
    city: row.city || '',
    state: row.state || '',
    pinCode: row.pin_code || '',
    logoBase64: row.logo_base64 || '',
    createdAt: row.created_at,
    isActive: Boolean(row.is_active),
  }));
});

ipcMain.handle('society:getActive', () => {
  return getActiveSociety();
});

ipcMain.handle('society:create', (_e, payload: AddSocietyPayload) => {
  const db = getDatabase();
  try {
    db.prepare('ALTER TABLE societies ADD COLUMN logo_base64 TEXT').run();
  } catch { }
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare(`
    INSERT INTO societies
    (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, logo_base64, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, payload.societyName, payload.registrationNo, payload.registrationDate || '',
    payload.fullAddress || '', payload.city || '', payload.state || '', payload.pinCode || '',
    payload.logoBase64 || '',
    now
  );

  activeMasterWorkbook = null;
  dbLog('SOCIETY_CREATE', `Created society: ${payload.societyName} (${payload.registrationNo})`);
  return getActiveSociety();
});

ipcMain.handle('society:select', (_e, societyId: string) => {
  const db = getDatabase();
  const exists = db.prepare('SELECT id FROM societies WHERE id = ?').get(societyId);
  if (!exists) return getActiveSociety();

  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(societyId);

  loadActiveMasterWorkbook();
  dbLog('SOCIETY_SELECT', `Selected active society ID: ${societyId}`);
  return getActiveSociety();
});

ipcMain.handle('society:delete', (_e, societyId: string) => {
  const db = getDatabase();
  db.prepare('DELETE FROM societies WHERE id = ?').run(societyId);
  db.prepare('DELETE FROM master_workbooks WHERE society_id = ?').run(societyId);
  db.prepare('DELETE FROM generation_history WHERE society_id = ?').run(societyId);

  const remaining = db.prepare('SELECT id FROM societies ORDER BY created_at ASC').all() as { id: string }[];
  if (remaining.length > 0) {
    db.prepare('UPDATE societies SET is_active = 0').run();
    db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(remaining[0].id);
  }
  loadActiveMasterWorkbook();
  dbLog('SOCIETY_DELETE', `Deleted society ID: ${societyId}`);
  return getActiveSociety();
});

ipcMain.handle('society:updateLogo', (_e, societyId: string, logoBase64: string) => {
  const db = getDatabase();
  try {
    db.prepare('ALTER TABLE societies ADD COLUMN logo_base64 TEXT').run();
  } catch { }
  db.prepare('UPDATE societies SET logo_base64 = ? WHERE id = ?').run(logoBase64, societyId);
  if (activeMasterWorkbook && activeMasterWorkbook.societyMaster) {
    activeMasterWorkbook.societyMaster.logoBase64 = logoBase64;
  }
  dbLog('SOCIETY_UPDATE_LOGO', `Updated logo for society ID: ${societyId}`);
  return getActiveSociety();
});

// ══════════════════════════════════════════════════════════════
// FOUNDATION DATA & REGISTER LOCKING
// ══════════════════════════════════════════════════════════════
function getFoundationStatus(activeSoc: Society | null, wb: MasterWorkbook | null): FoundationStatus {
  const isSocComplete = Boolean(
    activeSoc &&
    activeSoc.societyName && activeSoc.societyName.trim() !== '' &&
    activeSoc.registrationNo && activeSoc.registrationNo.trim() !== ''
  );

  const memberCount = wb?.commonFile?.length || 0;
  const isCommonComplete = isSocComplete && memberCount > 0;
  const isUnlocked = isSocComplete && isCommonComplete;

  return {
    societyId: activeSoc?.id || '',
    societyMasterComplete: isSocComplete,
    commonMemberMasterComplete: isCommonComplete,
    registersUnlocked: isUnlocked,
    societyMasterStatusText: isSocComplete ? '✓ Complete' : '⚠ Incomplete',
    commonMemberStatusText: !isSocComplete
      ? '🔒 Locked'
      : isCommonComplete
        ? '✓ Complete'
        : '⚠ Incomplete',
    registersStatusText: isUnlocked ? '✓ Unlocked' : '🔒 Locked',
    memberCount,
  };
}

ipcMain.handle('foundation:getStatus', () => {
  const activeSoc = getActiveSociety();
  loadActiveMasterWorkbook();
  return getFoundationStatus(activeSoc, activeMasterWorkbook);
});

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
ipcMain.handle('settings:get', (_e, key: string, defaultValue = '') => {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
});

ipcMain.handle('settings:set', (_e, key: string, value: string) => {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
});

ipcMain.handle('settings:list', () => {
  const db = getDatabase();
  return db.prepare('SELECT key, value FROM settings').all();
});

ipcMain.handle('settings:getFormSettings', (_e, formId: string) => {
  const activeSoc = getActiveSociety();
  return FormDesignSettingsService.getResolvedSettings(formId, activeSoc?.id);
});

ipcMain.handle('settings:saveFormSettings', (_e, formId: string, settings: any) => {
  const activeSoc = getActiveSociety();
  return FormDesignSettingsService.saveSettings(formId, settings, activeSoc?.id);
});

ipcMain.handle('settings:resetFormSettings', (_e, formId: string) => {
  const activeSoc = getActiveSociety();
  return FormDesignSettingsService.resetFormSettings(formId, activeSoc?.id);
});

ipcMain.handle('settings:resetGlobalSettings', () => {
  const activeSoc = getActiveSociety();
  return FormDesignSettingsService.resetGlobalSettings(activeSoc?.id);
});

// ══════════════════════════════════════════════════════════════
// MASTER DATA & MODULE IMPORT/EXPORT
// ══════════════════════════════════════════════════════════════
ipcMain.handle('masterData:downloadTemplate', async () => {
  const paths = getPaths();
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Master Data Template',
    defaultPath: path.join(paths.downloadsTemplates, 'HENU_OS_Master_Template.xlsx'),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buffer = await MasterDataService.generateTemplate();
  fs.writeFileSync(result.filePath, buffer);
  dbLog('TEMPLATE_DOWNLOAD', `Template saved to ${result.filePath}`);
  return result.filePath;
});

ipcMain.handle('masterData:downloadMasterTemplate', async () => {
  const paths = getPaths();
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Master Data Template',
    defaultPath: path.join(paths.downloadsTemplates, 'HENU_OS_Master_Template.xlsx'),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buffer = await MasterDataService.generateTemplate();
  fs.writeFileSync(result.filePath, buffer);
  dbLog('TEMPLATE_DOWNLOAD', `Master template saved to ${result.filePath}`);
  return result.filePath;
});

ipcMain.handle('masterData:exportMaster', async () => {
  loadActiveMasterWorkbook();
  const activeSoc = getActiveSociety();
  const wbToExport = activeMasterWorkbook || {
    societyMaster: {
      societyName: activeSoc?.societyName || 'CO-OPERATIVE HOUSING SOCIETY LTD',
      registrationNo: activeSoc?.registrationNo || '',
      registrationDate: activeSoc?.registrationDate || '',
      headerAddress: activeSoc?.fullAddress || '',
      address: activeSoc?.fullAddress || '',
      email: '',
      telephone: '',
      totalUnits: 0,
      unitsFlat: 0,
      unitsShop: 0,
      unitsOffice: 0,
      unitsGala: 0,
      printBlanks: 0,
    },
    commonFile: [],
    formIData: [],
    formJData: [],
    shareData: [],
    nominationData: [],
    propertyData: [],
    bankLineMarkData: [],
    voucherData: [],
    loadedAt: new Date().toISOString(),
    fileName: 'Master_Workbook.xlsx',
    validationErrors: [],
    validationWarnings: [],
  };
  const paths = getPaths();
  const defaultName = `${(activeSoc?.societyName || 'Master').replace(/[^a-zA-Z0-9]/g, '_')}_Master_Workbook.xlsx`;
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Master Data Workbook',
    defaultPath: path.join(paths.downloadsHlabs, defaultName),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buffer = await MasterDataService.exportMasterWorkbook(wbToExport);
  fs.writeFileSync(result.filePath, buffer);
  dbLog('MASTER_EXPORT', `Master exported to ${result.filePath}`);
  return result.filePath;
});

ipcMain.handle('masterData:downloadModuleTemplate', async (_e, moduleId: ModuleId) => {
  const paths = getPaths();
  const defaultName = `Template_${moduleId}.xlsx`;
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: `Save ${moduleId} Template`,
    defaultPath: path.join(paths.downloadsTemplates, defaultName),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buffer = await MasterDataService.generateIndividualTemplate(moduleId);
  fs.writeFileSync(result.filePath, buffer);
  dbLog('MODULE_TEMPLATE_DOWNLOAD', `Template for ${moduleId} saved to ${result.filePath}`);
  return result.filePath;
});

ipcMain.handle('masterData:exportModule', async (_e, moduleId: ModuleId) => {
  loadActiveMasterWorkbook();
  const activeSoc = getActiveSociety();
  const wbToExport = activeMasterWorkbook || {
    societyMaster: {
      societyName: activeSoc?.societyName || 'CO-OPERATIVE HOUSING SOCIETY LTD',
      registrationNo: activeSoc?.registrationNo || '',
      registrationDate: activeSoc?.registrationDate || '',
      headerAddress: activeSoc?.fullAddress || '',
      address: activeSoc?.fullAddress || '',
      email: '',
      telephone: '',
      totalUnits: 0,
      unitsFlat: 0,
      unitsShop: 0,
      unitsOffice: 0,
      unitsGala: 0,
      printBlanks: 0,
    },
    commonFile: [],
    formIData: [],
    formJData: [],
    shareData: [],
    nominationData: [],
    propertyData: [],
    bankLineMarkData: [],
    voucherData: [],
    loadedAt: new Date().toISOString(),
    fileName: 'Master_Workbook.xlsx',
    validationErrors: [],
    validationWarnings: [],
  };
  const paths = getPaths();
  const defaultName = `${(activeSoc?.societyName || 'Master').replace(/[^a-zA-Z0-9]/g, '_')}_${moduleId}.xlsx`;
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: `Export ${moduleId}`,
    defaultPath: path.join(paths.downloadsHlabs, defaultName),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buffer = await MasterDataService.exportIndividualModule(wbToExport, moduleId);
  fs.writeFileSync(result.filePath, buffer);
  dbLog('MODULE_EXPORT', `Module ${moduleId} exported to ${result.filePath}`);
  return result.filePath;
});

ipcMain.handle('masterData:importModule', async (_e, moduleId: ModuleId) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: `Import ${moduleId} Excel File`,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const activeSoc = getActiveSociety();

  let rawWb: any;
  try {
    const XLSX = require('xlsx');
    rawWb = XLSX.readFile(filePath, { cellDates: false, raw: false });
  } catch (err: any) {
    return { isValid: false, validationErrors: [`Failed to read Excel file: ${err.message}`] };
  }

  const detected = MasterDataService.detectModuleType(rawWb);
  if (detected && detected !== moduleId) {
    return {
      isValid: false,
      validationErrors: [`Wrong template format! Selected module was "${moduleId}", but detected headers for "${detected}". Please upload the correct template.`],
    };
  }

  const parsedWb = MasterDataService.parseWorkbook(filePath);
  loadActiveMasterWorkbook();

  const updatedWb: MasterWorkbook = activeMasterWorkbook ? { ...activeMasterWorkbook } : {
    societyMaster: {
      societyName: activeSoc.societyName,
      registrationNo: activeSoc.registrationNo,
      registrationDate: activeSoc.registrationDate || '',
      address: [activeSoc.fullAddress, activeSoc.city, activeSoc.state, activeSoc.pinCode].filter(Boolean).join(', '),
      email: '', telephone: '', totalUnits: 0, unitsFlat: 0, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0,
    },
    commonFile: [], formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [], voucherData: [],
    loadedAt: new Date().toISOString(), fileName: path.basename(filePath), validationErrors: [], validationWarnings: [],
  };

  if (moduleId === 'SOCIETY_MASTER' && parsedWb.societyMaster) {
    updatedWb.societyMaster = parsedWb.societyMaster;
  } else if (moduleId === 'COMMON_MEMBER_MASTER' && parsedWb.commonFile.length > 0) {
    updatedWb.commonFile = parsedWb.commonFile;
  } else if (moduleId === 'FORM_I' && parsedWb.formIData.length > 0) {
    updatedWb.formIData = parsedWb.formIData;
  } else if (moduleId === 'FORM_J' && parsedWb.formJData.length > 0) {
    updatedWb.formJData = parsedWb.formJData;
  } else if (moduleId === 'FORM_SHARE' && parsedWb.shareData.length > 0) {
    updatedWb.shareData = parsedWb.shareData;
  } else if (moduleId === 'FORM_NOM' && parsedWb.nominationData.length > 0) {
    updatedWb.nominationData = parsedWb.nominationData;
  } else if (moduleId === 'FORM_PROP' && parsedWb.propertyData.length > 0) {
    updatedWb.propertyData = parsedWb.propertyData;
  } else if (moduleId === 'FORM_BANK' && parsedWb.bankLineMarkData.length > 0) {
    updatedWb.bankLineMarkData = parsedWb.bankLineMarkData;
  } else if (moduleId === 'FORM_VOUCHER' && (parsedWb.voucherData || []).length > 0) {
    updatedWb.voucherData = parsedWb.voucherData;
  }

  const validation = ValidationEngine.validateWorkbook(updatedWb);
  updatedWb.validationErrors = validation.errors;
  updatedWb.validationWarnings = [...updatedWb.validationWarnings, ...validation.warnings];
  activeMasterWorkbook = updatedWb;

  const db = getDatabase();
  const id = uuidv4();
  db.prepare('UPDATE master_data_sessions SET is_active = 0 WHERE society_id = ?').run(activeSoc.id);
  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count,
     form_i_count, form_j_count, share_count, nomination_count,
     property_count, bank_count, validation_errors, validation_warnings,
     workbook_json, loaded_at, is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
  `).run(
    id, activeSoc.id, updatedWb.fileName, activeSoc.societyName, activeSoc.registrationNo,
    updatedWb.commonFile.length, updatedWb.formIData.length, updatedWb.formJData.length, updatedWb.shareData.length,
    updatedWb.nominationData.length, updatedWb.propertyData.length, updatedWb.bankLineMarkData.length,
    JSON.stringify(updatedWb.validationErrors), JSON.stringify(updatedWb.validationWarnings),
    JSON.stringify(updatedWb), updatedWb.loadedAt,
  );

  dbLog('MODULE_IMPORT', `Imported module ${moduleId} from ${filePath}`);
  return buildMasterDataStatus(updatedWb);
});

ipcMain.handle('masterData:getMembersList', async () => {
  loadActiveMasterWorkbook();
  return activeMasterWorkbook?.commonFile || [];
});

ipcMain.handle('masterData:updateMemberRecord', async (_e, record: NormalizedMemberRecord) => {
  loadActiveMasterWorkbook();
  if (!activeMasterWorkbook) return null;

  const activeSoc = getActiveSociety();
  let found = false;
  const updateList = (list: any[]) => {
    if (!Array.isArray(list)) return list;
    return list.map(m => {
      if ((record.memberId && m.memberId === record.memberId) || (record.srNo && String(m.srNo).trim() === String(record.srNo).trim())) {
        found = true;
        return { ...m, ...record };
      }
      return m;
    });
  };

  activeMasterWorkbook.commonFile = updateList(activeMasterWorkbook.commonFile);
  if (activeMasterWorkbook.formIData) activeMasterWorkbook.formIData = updateList(activeMasterWorkbook.formIData);
  if (activeMasterWorkbook.formJData) activeMasterWorkbook.formJData = updateList(activeMasterWorkbook.formJData);
  if (activeMasterWorkbook.shareData) activeMasterWorkbook.shareData = updateList(activeMasterWorkbook.shareData);
  if (activeMasterWorkbook.nominationData) activeMasterWorkbook.nominationData = updateList(activeMasterWorkbook.nominationData);
  if (activeMasterWorkbook.propertyData) activeMasterWorkbook.propertyData = updateList(activeMasterWorkbook.propertyData);
  if (activeMasterWorkbook.bankLineMarkData) activeMasterWorkbook.bankLineMarkData = updateList(activeMasterWorkbook.bankLineMarkData);

  if (!found && record.srNo) {
    activeMasterWorkbook.commonFile.push(record);
  }

  activeMasterWorkbook = synchronizeMasterWorkbook(activeMasterWorkbook);
  const validation = ValidationEngine.validateWorkbook(activeMasterWorkbook);
  activeMasterWorkbook.validationErrors = validation.errors;
  activeMasterWorkbook.validationWarnings = validation.warnings;

  const db = getDatabase();
  const activeSession = db.prepare('SELECT id FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(activeSoc.id) as { id: string } | undefined;

  if (activeSession) {
    db.prepare(`
      UPDATE master_data_sessions
      SET common_record_count = ?, workbook_json = ?, validation_errors = ?, validation_warnings = ?
      WHERE id = ?
    `).run(
      activeMasterWorkbook.commonFile.length,
      JSON.stringify(activeMasterWorkbook),
      JSON.stringify(activeMasterWorkbook.validationErrors),
      JSON.stringify(activeMasterWorkbook.validationWarnings),
      activeSession.id
    );
  }

  dbLog('MEMBER_UPDATE', `Updated member record srNo: ${record.srNo}`);
  return buildMasterDataStatus(activeMasterWorkbook);
});

ipcMain.handle('masterData:getWorkbook', async () => {
  loadActiveMasterWorkbook();
  return activeMasterWorkbook;
});

ipcMain.handle('masterData:updateWorkbook', async (_e, updatedWb: MasterWorkbook) => {
  const activeSoc = getActiveSociety();
  if (!updatedWb) return null;

  if (updatedWb.societyMaster) {
    updatedWb.societyMaster.societyName = activeSoc.societyName;
    updatedWb.societyMaster.registrationNo = activeSoc.registrationNo;
  }

  if (updatedWb.commonFile) {
    updatedWb.commonFile.forEach(m => {
      if (!m.memberId) m.memberId = uuidv4();
    });
  }

  updatedWb = synchronizeMasterWorkbook(updatedWb);
  const validation = ValidationEngine.validateWorkbook(updatedWb);
  updatedWb.validationErrors = validation.errors;
  updatedWb.validationWarnings = validation.warnings;
  activeMasterWorkbook = updatedWb;

  const db = getDatabase();
  const activeSession = db.prepare('SELECT id FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(activeSoc.id) as { id: string } | undefined;

  if (!activeSession) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO master_data_sessions
      (id, society_id, file_name, society_name, registration_no, common_record_count,
       form_i_count, form_j_count, share_count, nomination_count,
       property_count, bank_count, validation_errors, validation_warnings,
       workbook_json, loaded_at, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
    `).run(
      id, activeSoc.id, updatedWb.fileName || 'MasterWorkbook.xlsx',
      activeSoc.societyName, activeSoc.registrationNo,
      updatedWb.commonFile?.length || 0,
      updatedWb.formIData?.length || 0,
      updatedWb.formJData?.length || 0,
      updatedWb.shareData?.length || 0,
      updatedWb.nominationData?.length || 0,
      updatedWb.propertyData?.length || 0,
      updatedWb.bankLineMarkData?.length || 0,
      JSON.stringify(updatedWb.validationErrors),
      JSON.stringify(updatedWb.validationWarnings),
      JSON.stringify(updatedWb),
      new Date().toISOString()
    );
  } else {
    db.prepare(`
      UPDATE master_data_sessions
      SET common_record_count = ?, form_i_count = ?, form_j_count = ?, share_count = ?,
          nomination_count = ?, property_count = ?, bank_count = ?,
          workbook_json = ?, validation_errors = ?, validation_warnings = ?
      WHERE id = ?
    `).run(
      updatedWb.commonFile?.length || 0,
      updatedWb.formIData?.length || 0,
      updatedWb.formJData?.length || 0,
      updatedWb.shareData?.length || 0,
      updatedWb.nominationData?.length || 0,
      updatedWb.propertyData?.length || 0,
      updatedWb.bankLineMarkData?.length || 0,
      JSON.stringify(updatedWb),
      JSON.stringify(updatedWb.validationErrors),
      JSON.stringify(updatedWb.validationWarnings),
      activeSession.id
    );
  }

  dbLog('MASTER_DATA_UPDATE', `Updated master workbook data for society ${activeSoc.id}`);
  return buildMasterDataStatus(updatedWb);
});

ipcMain.handle('masterData:upload', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Master Data Excel File',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const activeSoc = getActiveSociety();
  const filePath = result.filePaths[0];
  const wb = MasterDataService.parseWorkbook(filePath);

  const parsedSocName = wb.societyMaster?.societyName;
  const parsedRegNo = wb.societyMaster?.registrationNo;

  wb.societyMaster = {
    societyName: (parsedSocName && parsedSocName.trim() !== '') ? parsedSocName : activeSoc.societyName,
    registrationNo: (parsedRegNo && parsedRegNo.trim() !== '') ? parsedRegNo : activeSoc.registrationNo,
    registrationDate: wb.societyMaster?.registrationDate || activeSoc.registrationDate || '',
    address: wb.societyMaster?.address || [activeSoc.fullAddress, activeSoc.city, activeSoc.state, activeSoc.pinCode].filter(Boolean).join(', ') || '',
    email: wb.societyMaster?.email || '',
    telephone: wb.societyMaster?.telephone || '',
    totalUnits: wb.societyMaster?.totalUnits || 0,
    unitsFlat: wb.societyMaster?.unitsFlat || 0,
    unitsShop: wb.societyMaster?.unitsShop || 0,
    unitsOffice: wb.societyMaster?.unitsOffice || 0,
    unitsGala: wb.societyMaster?.unitsGala || 0,
    printBlanks: wb.societyMaster?.printBlanks || 0,
  };

  const validation = ValidationEngine.validateWorkbook(wb);
  wb.validationErrors = validation.errors;
  wb.validationWarnings = [...wb.validationWarnings, ...validation.warnings];
  activeMasterWorkbook = wb;

  const db = getDatabase();
  const id = uuidv4();
  db.prepare('UPDATE master_data_sessions SET is_active = 0 WHERE society_id = ?').run(activeSoc.id);
  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count,
     form_i_count, form_j_count, share_count, nomination_count,
     property_count, bank_count, validation_errors, validation_warnings,
     workbook_json, loaded_at, is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
  `).run(
    id, activeSoc.id, wb.fileName, wb.societyMaster.societyName, wb.societyMaster.registrationNo,
    wb.commonFile.length, wb.formIData.length, wb.formJData.length, wb.shareData.length,
    wb.nominationData.length, wb.propertyData.length, wb.bankLineMarkData.length,
    JSON.stringify(wb.validationErrors), JSON.stringify(wb.validationWarnings),
    JSON.stringify(wb), wb.loadedAt,
  );

  dbLog('MASTER_DATA_UPLOAD', `Uploaded: ${wb.fileName}`, { records: wb.commonFile.length, societyId: activeSoc.id });
  return buildMasterDataStatus(wb);
});

ipcMain.handle('masterData:getStatus', () => {
  const activeSoc = getActiveSociety();
  loadActiveMasterWorkbook();
  if (activeMasterWorkbook) return buildMasterDataStatus(activeMasterWorkbook);

  const db = getDatabase();
  const row = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1 ORDER BY loaded_at DESC LIMIT 1').get(activeSoc.id) as any;
  if (!row) return null;
  try { activeMasterWorkbook = JSON.parse(row.workbook_json) as MasterWorkbook; } catch { }
  return {
    fileName: row.file_name, societyName: row.society_name || activeSoc.societyName, registrationNo: row.registration_no || activeSoc.registrationNo,
    commonRecords: row.common_record_count, formICnt: row.form_i_count, formJCnt: row.form_j_count,
    shareCnt: row.share_count, nominationCnt: row.nomination_count, propertyCnt: row.property_count,
    bankCnt: row.bank_count, loadedAt: row.loaded_at,
    validationErrors: JSON.parse(row.validation_errors || '[]'),
    validationWarnings: JSON.parse(row.validation_warnings || '[]'),
    isValid: JSON.parse(row.validation_errors || '[]').length === 0,
  };
});

ipcMain.handle('masterData:clear', () => {
  const activeSoc = getActiveSociety();
  activeMasterWorkbook = null;
  const db = getDatabase();
  db.prepare('UPDATE master_data_sessions SET is_active = 0 WHERE society_id = ?').run(activeSoc.id);
  dbLog('MASTER_DATA_CLEAR', `Master data cleared for society ${activeSoc.id}`);
});

ipcMain.handle('masterData:getFormDetails', (_e, formId: FormId) => {
  if (!activeMasterWorkbook) return null;

  const SHEET_NAMES: Record<FormId, string> = {
    FORM_I: 'I form',
    FORM_J: 'J form',
    FORM_SHARE: 'Share Register',
    FORM_NOM: 'Nomination Register',
    FORM_PROP: 'Property Register',
    FORM_BANK: 'Bank Line Mark Register',
    FORM_SHARE_CERT: 'Share Certificate',
    FORM_VOUCHER: 'Voucher Register',
  };

  const ORIENTATIONS: Record<FormId, string> = {
    FORM_I: 'Portrait',
    FORM_J: 'Portrait',
    FORM_SHARE: 'Landscape',
    FORM_NOM: 'Landscape',
    FORM_PROP: 'Landscape',
    FORM_BANK: 'Landscape',
    FORM_SHARE_CERT: 'Landscape',
    FORM_VOUCHER: 'Portrait',
  };

  const OUTPUT_TYPES: Record<FormId, string> = {
    FORM_I: 'ZIP containing individual PDF files per member (FORM_I_XXX.pdf)',
    FORM_J: 'ZIP containing a single multi-page PDF document (FORM_J_XXX-XXX.pdf)',
    FORM_SHARE: 'ZIP containing a single multi-page PDF document (SHARE_REGISTER_XXX-XXX.pdf)',
    FORM_NOM: 'ZIP containing a single multi-page PDF document (NOMINATION_REGISTER_XXX-XXX.pdf)',
    FORM_PROP: 'ZIP containing a single multi-page PDF document (PROPERTY_REGISTER_XXX-XXX.pdf)',
    FORM_BANK: 'ZIP containing a single multi-page PDF document (BANK_LINE_MARK_XXX-XXX.pdf)',
    FORM_SHARE_CERT: 'ZIP containing 13x19 2-page PDF documents (SHARE_CERTIFICATE_13X19_XXX-XXX.pdf)',
    FORM_VOUCHER: 'ZIP containing A4 2-per-page PDF documents (PAYMENT_VOUCHER_A4_XXX-XXX.pdf)',
  };

  let specificSheetRecords: any[] = [];
  switch (formId) {
    case 'FORM_I': specificSheetRecords = (activeMasterWorkbook.formIData && activeMasterWorkbook.formIData.length > 0) ? activeMasterWorkbook.formIData : activeMasterWorkbook.commonFile; break;
    case 'FORM_J': specificSheetRecords = (activeMasterWorkbook.formJData && activeMasterWorkbook.formJData.length > 0) ? activeMasterWorkbook.formJData : activeMasterWorkbook.commonFile; break;
    case 'FORM_SHARE': specificSheetRecords = (activeMasterWorkbook.shareData && activeMasterWorkbook.shareData.length > 0) ? activeMasterWorkbook.shareData : activeMasterWorkbook.commonFile; break;
    case 'FORM_NOM': specificSheetRecords = (activeMasterWorkbook.nominationData && activeMasterWorkbook.nominationData.length > 0) ? activeMasterWorkbook.nominationData : activeMasterWorkbook.commonFile; break;
    case 'FORM_PROP': specificSheetRecords = (activeMasterWorkbook.propertyData && activeMasterWorkbook.propertyData.length > 0) ? activeMasterWorkbook.propertyData : activeMasterWorkbook.commonFile; break;
    case 'FORM_BANK': specificSheetRecords = (activeMasterWorkbook.bankLineMarkData && activeMasterWorkbook.bankLineMarkData.length > 0) ? activeMasterWorkbook.bankLineMarkData : activeMasterWorkbook.commonFile; break;
    case 'FORM_SHARE_CERT': specificSheetRecords = (activeMasterWorkbook as any).shareCertData || activeMasterWorkbook.shareData || activeMasterWorkbook.commonFile; break;
    case 'FORM_VOUCHER': specificSheetRecords = activeMasterWorkbook.voucherData || []; break;
  }

  const recordCount = (specificSheetRecords || []).length;

  const rawSerials = (formId === 'FORM_VOUCHER' && (activeMasterWorkbook.voucherData || []).length > 0)
    ? (activeMasterWorkbook.voucherData || []).map(v => (v.voucherNo || v.srNo || '').trim())
    : activeMasterWorkbook.commonFile.map(r => r.srNo.trim());

  const commonSerials = rawSerials.filter(s => s !== '');

  let minNum = Infinity;
  let maxNum = -Infinity;
  let minSerial = '';
  let maxSerial = '';
  const serialSet = new Set<string>();

  for (const s of commonSerials) {
    const num = parseInt(s, 10);
    if (!isNaN(num)) {
      serialSet.add(s);
      if (num < minNum) {
        minNum = num;
        minSerial = s;
      }
      if (num > maxNum) {
        maxNum = num;
        maxSerial = s;
      }
    }
  }

  if (minNum !== Infinity && maxNum !== -Infinity) {
    const blanks = activeMasterWorkbook.societyMaster?.printBlanks || 0;
    if (blanks > 0) {
      maxNum += blanks;
      maxSerial = String(maxNum).padStart(minSerial.length, '0');
    }
  }

  const missingSerials: string[] = [];
  if (minNum !== Infinity && maxNum !== -Infinity) {
    const padWidth = minSerial.length;
    for (let i = minNum; i <= maxNum; i++) {
      const expected = String(i).padStart(padWidth, '0');
      if (!serialSet.has(expected)) {
        missingSerials.push(expected);
      }
    }
  }

  return {
    sheetName: SHEET_NAMES[formId] || '',
    recordCount,
    availableMinSerial: minNum !== Infinity ? minSerial : '—',
    availableMaxSerial: maxNum !== -Infinity ? maxSerial : '—',
    missingSerials,
    orientation: ORIENTATIONS[formId] || 'Portrait',
    outputType: OUTPUT_TYPES[formId] || '',
  };
});

function buildMasterDataStatus(wb: MasterWorkbook) {
  return {
    fileName: wb.fileName, societyName: wb.societyMaster?.societyName || '',
    registrationNo: wb.societyMaster?.registrationNo || '',
    commonRecords: wb.commonFile.length, formICnt: wb.formIData.length,
    formJCnt: wb.formJData.length, shareCnt: wb.shareData.length,
    nominationCnt: wb.nominationData.length, propertyCnt: wb.propertyData.length,
    bankCnt: wb.bankLineMarkData.length, loadedAt: wb.loadedAt,
    validationErrors: wb.validationErrors, validationWarnings: wb.validationWarnings,
    isValid: wb.validationErrors.length === 0,
  };
}

// ══════════════════════════════════════════════════════════════
// GENERATE
// ══════════════════════════════════════════════════════════════
// GENERATION IPC HANDLERS
// ══════════════════════════════════════════════════════════════
ipcMain.handle('generate:preview', (_e, arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let formId: FormId;
  let fromSerial: string;
  let toSerial: string;
  let nonSerialCount: number;

  if (typeof arg1 === 'object' && arg1 !== null) {
    formId = arg1.formId;
    fromSerial = String(arg1.fromSerial ?? '').trim();
    toSerial = String(arg1.toSerial ?? '').trim();
    nonSerialCount = Math.max(0, Number(arg1.nonSerialCount) || 0);
  } else {
    formId = arg1;
    fromSerial = String(arg2 ?? '').trim();
    toSerial = String(arg3 ?? '').trim();
    nonSerialCount = Math.max(0, Number(arg4) || 0);
  }

  loadActiveMasterWorkbook();
  const activeSoc = getActiveSociety();
  const wb: MasterWorkbook = activeMasterWorkbook || createDefaultWorkbook(activeSoc);

  const rangeValidation = ValidationEngine.validateGenerationRange(fromSerial, toSerial, nonSerialCount);
  if (!rangeValidation.isValid) return { error: rangeValidation.errors.join(' ') };
  const serialRange = (fromSerial || toSerial) ? generateRange(fromSerial, toSerial, true) : [];
  const isVoucher = formId === 'FORM_VOUCHER';
  const commonSerials = new Set(
    isVoucher
      ? (wb.voucherData || []).map(r => normalizeSerial(r.voucherNo || r.srNo))
      : (wb.commonFile || []).map(r => normalizeSerial(r.srNo))
  );
  let found = 0; let blank = 0;
  for (const s of serialRange) { if (commonSerials.has(normalizeSerial(s))) found++; else blank++; }

  const totalAvailableInMaster = isVoucher ? (wb.voucherData || []).length : (wb.commonFile || []).length;
  let warningMessage = '';
  if (serialRange.length > totalAvailableInMaster && totalAvailableInMaster > 0) {
    warningMessage = `Only ${totalAvailableInMaster} records are available in Master Data.`;
  }

  return {
    formId,
    fromSerial,
    toSerial,
    requested: serialRange.length,
    found,
    blank,
    nonSerialCount,
    totalOutput: serialRange.length + nonSerialCount,
    availableTotal: totalAvailableInMaster,
    warning: warningMessage,
    serialList: serialRange
  };
});

/**
 * Generates a PREVIEW PDF using the EXACT SAME engine as the final download.
 * Saves to temp directory. Returns file:// URL for iframe.
 * Spec 33: One pipeline — Preview === Final PDF.
 */
ipcMain.handle('generate:previewPdf', async (_e, arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let formId: FormId;
  let fromSerial: string;
  let toSerial: string;
  let options: any;

  if (typeof arg1 === 'object' && arg1 !== null) {
    formId = arg1.formId;
    fromSerial = String(arg1.fromSerial ?? '').trim();
    toSerial = String(arg1.toSerial ?? '').trim();
    options = arg1;
  } else {
    formId = arg1;
    fromSerial = String(arg2 ?? '').trim();
    toSerial = String(arg3 ?? '').trim();
    options = arg4 || {};
  }

  const activeSoc = getActiveSociety();
  let wb: MasterWorkbook;
  if (options?.workbook && (Array.isArray(options.workbook.commonFile) || Array.isArray(options.workbook.voucherData))) {
    wb = synchronizeMasterWorkbook(options.workbook);
    activeMasterWorkbook = wb;
  } else {
    loadActiveMasterWorkbook();
    wb = activeMasterWorkbook || createDefaultWorkbook(activeSoc);
  }

  const extraCount = Math.max(0, Number(options?.nonSerialCount) || 0);
  const rangeValidation = ValidationEngine.validateGenerationRange(fromSerial, toSerial, extraCount);
  if (!rangeValidation.isValid) return { error: rangeValidation.errors.join(' ') };

  try {
    const paths = getPaths();

    // Generate using the EXACT same engine as final download
    mainWindow?.webContents.send('generate:progress', 'Preparing pages...');
    const output = await PdfEngine.generate({
      formId, fromSerial, toSerial,
      nonSerialCount: extraCount,
      templateId: (options as any)?.templateId,
      shareRegisterTemplateId: (options as any)?.shareRegisterTemplateId,
      voucherPaperSize: (options as any)?.voucherPaperSize,
      voucherTemplateId: (options as any)?.voucherTemplateId,
      emptyRows: (options as any)?.emptyRows,
      dataFontSize: (options as any)?.dataFontSize,
      dataTextColor: (options as any)?.dataTextColor,
      workbook: wb,
      societyId: activeSoc?.id,
      orientationOverride: options?.orientationOverride,
      prefix: options?.prefix,
      separator: options?.separator,
      rowsPerPage: options?.rowsPerPage,
      gridOn: options?.gridOn,
      renderMode: options?.renderMode,
      headerImageBase64: (options as any)?.headerImageBase64 || activeSoc?.logoBase64,
      ackImageBase64: (options as any)?.ackImageBase64,
      fontFamily: (options as any)?.fontFamily,
      onProgress: (msg) => mainWindow?.webContents.send('generate:progress', msg),
    });

    mainWindow?.webContents.send('generate:progress', 'Building preview PDF...');

    // Merge Form I individual PDFs into one preview document
    let previewBuffer: Buffer;
    if (formId === 'FORM_I' && output.files.length > 1) {
      previewBuffer = await PdfEngine.mergeFormIPdfs(output.files);
    } else {
      previewBuffer = output.files[0].buffer;
    }

    // Save to temp (cleaned on next app start)
    const tempPath = path.join(paths.temp, `preview_${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, previewBuffer);

    mainWindow?.webContents.send('generate:progress', 'Preview ready.');

    const b64 = previewBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${b64}`;

    return {
      previewPdfUrl: dataUrl,
      previewPdfPath: tempPath,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to generate preview PDF' };
  }
});

/**
 * Executes generation: creates both preview temp file AND ZIP.
 * Saves to history. Returns zipPath + previewPdfUrl.
 */
ipcMain.handle('generate:execute', async (_e, arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let formId: FormId;
  let fromSerial: string;
  let toSerial: string;
  let options: any;

  if (typeof arg1 === 'object' && arg1 !== null) {
    formId = arg1.formId;
    fromSerial = String(arg1.fromSerial ?? '').trim();
    toSerial = String(arg1.toSerial ?? '').trim();
    options = arg1;
  } else {
    formId = arg1;
    fromSerial = String(arg2 ?? '').trim();
    toSerial = String(arg3 ?? '').trim();
    options = arg4 || {};
  }

  const activeSoc = getActiveSociety();
  let wb: MasterWorkbook;
  if (options?.workbook && (Array.isArray(options.workbook.commonFile) || Array.isArray(options.workbook.voucherData))) {
    wb = synchronizeMasterWorkbook(options.workbook);
    activeMasterWorkbook = wb;
  } else {
    loadActiveMasterWorkbook();
    wb = activeMasterWorkbook || createDefaultWorkbook(activeSoc);
  }

  const extraCount = Math.max(0, Number(options?.nonSerialCount) || 0);
  const rangeValidation = ValidationEngine.validateGenerationRange(fromSerial, toSerial, extraCount);
  if (!rangeValidation.isValid) {
    return { success: false, errorMessage: rangeValidation.errors.join(' ') };
  }

  try {
    const paths = getPaths();

    mainWindow?.webContents.send('generate:progress', 'Preparing pages...');
    const activeSocForGen = getActiveSociety();
    const output = await PdfEngine.generate({
      formId, fromSerial, toSerial,
      nonSerialCount: extraCount,
      templateId: (options as any)?.templateId,
      shareRegisterTemplateId: (options as any)?.shareRegisterTemplateId,
      voucherPaperSize: (options as any)?.voucherPaperSize,
      voucherTemplateId: (options as any)?.voucherTemplateId,
      emptyRows: (options as any)?.emptyRows,
      dataFontSize: (options as any)?.dataFontSize,
      dataTextColor: (options as any)?.dataTextColor,
      workbook: wb,
      societyId: activeSocForGen?.id,
      orientationOverride: options?.orientationOverride,
      prefix: options?.prefix,
      separator: options?.separator,
      rowsPerPage: options?.rowsPerPage,
      gridOn: options?.gridOn,
      renderMode: options?.renderMode,
      headerImageBase64: (options as any)?.headerImageBase64 || activeSocForGen?.logoBase64,
      ackImageBase64: (options as any)?.ackImageBase64,
      fontFamily: (options as any)?.fontFamily,
      onProgress: (msg) => mainWindow?.webContents.send('generate:progress', msg),
    });

    mainWindow?.webContents.send('generate:progress', 'Writing PDF...');

    // Merge Form I into single consolidated PDF
    let previewBuffer: Buffer;
    if (formId === 'FORM_I' && output.files.length > 1) {
      previewBuffer = await PdfEngine.mergeFormIPdfs(output.files);
    } else {
      previewBuffer = output.files[0].buffer;
    }

    // Save consolidated PDF to permanent exports directory
    const pdfDir = path.join(paths.exports, 'PDFs');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const safeSocName = (activeSoc?.societyName || 'Society').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFileName = `${formId}_${safeSocName}_${fromSerial}-${toSerial}_${Date.now()}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFileName);
    fs.writeFileSync(pdfPath, previewBuffer);

    // Save Excel export reference
    let excelPath = '';
    try {
      const excelDir = path.join(paths.exports, 'Excel');
      if (!fs.existsSync(excelDir)) fs.mkdirSync(excelDir, { recursive: true });
      const excelFileName = `${formId}_${safeSocName}_${fromSerial}-${toSerial}_${Date.now()}.xlsx`;
      excelPath = path.join(excelDir, excelFileName);
      const excelBuf = await MasterDataService.exportIndividualModule(wb, formId);
      fs.writeFileSync(excelPath, excelBuf);
    } catch (err) {
      console.error('Failed to write Excel history file:', err);
    }

    mainWindow?.webContents.send('generate:progress', 'Creating ZIP...');
    const zipPath = await ZipService.createAndSave(
      output.files, formId, fromSerial, toSerial, paths.downloadsZip,
    );
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
      throw new Error(`ZIP generation failed: ZIP file at ${zipPath} does not exist or is 0 bytes.`);
    }

    // Stats
    const serialRange = (fromSerial || toSerial) ? generateRange(fromSerial, toSerial, true) : [];
    const isVoucherForm = formId === 'FORM_VOUCHER';
    const commonSerials = new Set(
      isVoucherForm
        ? (wb.voucherData || []).map(r => normalizeSerial(r.voucherNo || r.srNo))
        : (wb.commonFile || []).map(r => normalizeSerial(r.srNo))
    );
    const foundCount = serialRange.filter(s => commonSerials.has(normalizeSerial(s))).length;
    const blankCount = serialRange.length - foundCount;

    // History
    const db = getDatabase();
    const formLabels: Record<FormId, string> = {
      FORM_I: 'Form I', FORM_J: 'Form J', FORM_SHARE: 'Share Register',
      FORM_NOM: 'Nomination Register', FORM_PROP: 'Property Register',
      FORM_BANK: 'Bank Line Mark Register',
      FORM_SHARE_CERT: 'Share Certificate (13x19)',
      FORM_VOUCHER: 'Payment Voucher (A4)',
    };
    db.prepare(`
      INSERT INTO generation_history
      (id, society_id, society_name, form_id, form_label, from_serial, to_serial,
       total_generated, found_count, blank_count, orientation, rows_per_page,
       grid_setting, color_setting, pdf_path, excel_path, zip_path, status, generated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      uuidv4(), activeSoc?.id || 'default-society-1', activeSoc?.societyName || 'HENU OS', formId, formLabels[formId] || formId, fromSerial, toSerial,
      serialRange.length + extraCount, foundCount, blankCount + extraCount,
      options?.orientationOverride || 'Portrait',
      options?.rowsPerPage || 10,
      options?.gridOn === false ? 'Grid OFF' : 'Grid ON',
      options?.renderMode === 'BW' ? 'B&W' : 'Color',
      pdfPath, excelPath, zipPath, 'SUCCESS', new Date().toISOString(),
    );

    dbLog('GENERATE_SUCCESS', `Generated ${formId} ${fromSerial}-${toSerial}`, { pdfPath, zipPath });
    mainWindow?.webContents.send('generate:progress', 'Complete.');

    const b64 = previewBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${b64}`;

    return {
      success: true,
      zipPath,
      pdfPath,
      excelPath,
      previewPdfUrl: dataUrl,
      previewPdfPath: pdfPath,
      formId, fromSerial, toSerial,
      totalGenerated: serialRange.length + extraCount, foundCount, blankCount,
      generatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    dbLog('GENERATE_ERROR', err.message, { formId, fromSerial, toSerial });
    return { success: false, errorMessage: err.message || 'Generation failed' };
  }
});

/** Maps technical errors to user-friendly messages (spec 46) */
function friendlyError(raw: string, formId?: string): string {
  if (raw.includes('template not found') || raw.includes('Template not found')) {
    return `Unable to generate the PDF because the ${formId || ''} template file is missing. Please reinstall the application.`;
  }
  if (raw.includes('Common File')) {
    return 'Unable to read the Excel file because the required Common File sheet was not found.';
  }
  if (raw.includes('serial') || raw.includes('Serial')) {
    return 'Serial range is invalid. Please check your FROM and TO values.';
  }
  if (raw.includes('No master data')) {
    return 'No master data loaded. Please upload the Master Data Excel file first.';
  }
  return `Generation failed: ${raw}`;
}

// ══════════════════════════════════════════════════════════════
// GENERATION HISTORY
// ══════════════════════════════════════════════════════════════
ipcMain.handle('history:list', () => {
  const activeSoc = getActiveSociety();
  const db = getDatabase();
  return db.prepare('SELECT * FROM generation_history WHERE society_id = ? ORDER BY generated_at DESC LIMIT 100').all(activeSoc.id);
});

ipcMain.handle('history:clear', () => {
  const activeSoc = getActiveSociety();
  const db = getDatabase();
  db.prepare('DELETE FROM generation_history WHERE society_id = ?').run(activeSoc.id);
});

// ══════════════════════════════════════════════════════════════
// SYSTEM
// ══════════════════════════════════════════════════════════════
ipcMain.handle('system:getPaths', () => getPaths());
ipcMain.handle('system:getAppInfo', () => ({
  version: app.getVersion(), name: app.getName(), isPackaged: app.isPackaged,
  nodeVersion: process.versions.node, electronVersion: process.versions.electron,
}));
ipcMain.handle('system:openPath', async (_e, p: string) => { await shell.openPath(p); });
ipcMain.handle('system:showItemInFolder', (_e, p: string) => { shell.showItemInFolder(p); });
ipcMain.handle('system:openFileDialog', async (_e, options: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('system:showSaveDialog', async (_e, options: Electron.SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result.canceled ? null : result.filePath;
});

// ══════════════════════════════════════════════════════════════
// CALIBRATION & TEMPLATES
// ══════════════════════════════════════════════════════════════
ipcMain.handle('calibration:getTemplates', async () => {
  return [
    { id: 'FORM_I', name: 'Form I (Register of Members)', orientation: 'Portrait', paperSize: 'A4' },
    { id: 'FORM_J', name: 'Form J (List of Members)', orientation: 'Portrait', paperSize: 'A4' },
    { id: 'FORM_SHARE', name: 'Share Register', orientation: 'Landscape', paperSize: 'A4' },
    { id: 'FORM_NOM', name: 'Nomination Register', orientation: 'Landscape', paperSize: 'A4' },
    { id: 'FORM_PROP', name: 'Property Register', orientation: 'Landscape', paperSize: 'A4' },
    { id: 'FORM_BANK', name: 'Bank Line Mark Register', orientation: 'Landscape', paperSize: 'A4' },
    { id: 'FORM_SHARE_CERT', name: 'Share Certificate', orientation: 'Landscape', paperSize: 'Super A3 (13x19)' },
    { id: 'FORM_VOUCHER', name: 'Payment Voucher', orientation: 'Portrait', paperSize: 'A4' },
  ];
});

// ══════════════════════════════════════════════════════════════
// TESTS (Developer Mode)
// ══════════════════════════════════════════════════════════════
ipcMain.handle('tests:run', async () => {
  try {
    const { TestRunner } = await import('./tests/TestRunner');
    return await TestRunner.runAll();
  } catch (err: any) {
    return { error: err.message, results: [] };
  }
});
