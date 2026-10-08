import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../db';
import { HenuConfigService } from '../config/HenuConfigService';
import { StorageEngine } from '../config/StorageEngine';

export interface SocietyImportRecord {
  id: string;
  societyId: string;
  fileName: string;
  filePath: string;
  importType: 'EXCEL' | 'TEMPLATE' | 'MODULE';
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  recordCount: number;
  importedBy: string;
  importedAt: string;
  templateName?: string;
  metadata?: any;
}

export interface SocietyExportRecord {
  id: string;
  societyId: string;
  fileName: string;
  filePath: string;
  exportType: 'EXCEL' | 'CSV' | 'PDF';
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  recordCount: number;
  exportedAt: string;
  metadata?: any;
}

export interface SocietyTemplateRecord {
  id: string;
  societyId: string;
  templateName: string;
  templatePath: string;
  version: number;
  recordCount: number;
  lastUsedAt: string;
  sourceSocietyId?: string;
  createdAt: string;
}

export interface GlobalTemplateItem {
  templateName: string;
  usedBySocieties: Array<{ societyId: string; societyName: string; lastUsedAt: string }>;
  totalUsageCount: number;
  latestUsedAt: string;
}

export interface HenuMasterGlobalKpis {
  totalSocieties: number;
  activeSocieties: number;
  archivedSocieties: number;
  totalDocuments: number;
  totalImports: number;
  totalExports: number;
  completedSocieties: number;
  inProgressSocieties: number;
  notStartedSocieties: number;
  totalStorageUsedBytes: number;
  totalStorageUsedFormatted: string;
}

export class HenuSocietyContextService {
  private static instance: HenuSocietyContextService;
  private currentContextVersion: number = 1;
  private activeSocietyId: string = 'default-society-1';
  private activeSocietyName: string = 'HENU OS PRIVATE LIMITED';
  private activeSocietyRegistrationNumber: string = 'U62099RJ2025PTC109150';

  private constructor() {}

  public static getInstance(): HenuSocietyContextService {
    if (!HenuSocietyContextService.instance) {
      HenuSocietyContextService.instance = new HenuSocietyContextService();
    }
    return HenuSocietyContextService.instance;
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || 'B'}`;
  }

  public getContextVersion(): { version: number; token: string; activeSocietyId: string; activeSocietyName: string } {
    return {
      version: this.currentContextVersion,
      token: `${this.activeSocietyId}_v${this.currentContextVersion}`,
      activeSocietyId: this.activeSocietyId,
      activeSocietyName: this.activeSocietyName,
    };
  }

  public incrementContextVersion(): number {
    this.currentContextVersion += 1;
    return this.currentContextVersion;
  }

  public switchActiveSociety(
    societyId: string,
    societyName: string,
    registrationNo?: string
  ): { activeSocietyId: string; activeSocietyName: string; version: number; token: string } {
    this.activeSocietyId = societyId;
    this.activeSocietyName = societyName;
    if (registrationNo) this.activeSocietyRegistrationNumber = registrationNo;
    this.currentContextVersion += 1;
    const token = `${societyId}_v${this.currentContextVersion}_${Date.now()}`;
    return {
      activeSocietyId: this.activeSocietyId,
      activeSocietyName: this.activeSocietyName,
      version: this.currentContextVersion,
      token,
    };
  }

  public validateActiveSociety(societyId: string): boolean {
    return this.activeSocietyId === societyId;
  }

  public validateContextToken(token: string): boolean {
    if (!token) return false;
    return token.startsWith(`${this.activeSocietyId}_v`);
  }

  /**
   * Records an import operation strictly bound to the active society ID.
   */
  public recordImport(params: {
    societyId: string;
    fileName: string;
    filePath: string;
    importType: 'EXCEL' | 'TEMPLATE' | 'MODULE';
    recordCount: number;
    status?: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
    importedBy?: string;
    templateName?: string;
    metadata?: any;
  }): SocietyImportRecord {
    const db = getDatabase();
    const id = uuidv4();
    const importedAt = new Date().toISOString();
    const status = params.status || 'COMPLETED';
    const importedBy = params.importedBy || 'Operator';

    try {
      db.prepare(`
        INSERT INTO imports
        (id, society_id, filename, file_name, file_path, import_type, status, record_count, imported_by, imported_at, template_name, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.societyId,
        params.fileName,
        params.fileName,
        params.filePath,
        params.importType,
        status,
        params.recordCount,
        importedBy,
        importedAt,
        params.templateName || '',
        JSON.stringify(params.metadata || {})
      );
    } catch {
      // Fallback for schema variants
      db.prepare(`
        INSERT INTO imports
        (id, society_id, file_name, file_path, import_type, status, record_count, imported_by, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.societyId,
        params.fileName,
        params.filePath,
        params.importType,
        status,
        params.recordCount,
        importedBy,
        importedAt
      );
    }

    // If template was used, record in template history
    if (params.templateName) {
      this.recordTemplateUsage({
        societyId: params.societyId,
        templateName: params.templateName,
        templatePath: params.filePath,
        recordCount: params.recordCount,
      });
    }

    return {
      id,
      societyId: params.societyId,
      fileName: params.fileName,
      filePath: params.filePath,
      importType: params.importType,
      status,
      recordCount: params.recordCount,
      importedBy,
      importedAt,
      templateName: params.templateName,
      metadata: params.metadata,
    };
  }

  /**
   * Retrieves import history strictly scoped to active society.
   */
  public getSocietyImports(societyId: string): SocietyImportRecord[] {
    if (!societyId) return [];
    const db = getDatabase();
    const rows = (db.prepare('SELECT * FROM imports WHERE society_id = ? ORDER BY imported_at DESC').all(societyId) || []) as any[];
    return rows.map(r => ({
      id: r.id,
      societyId: r.society_id,
      fileName: r.file_name || r.filename,
      filePath: r.file_path || '',
      importType: r.import_type || 'EXCEL',
      status: r.status || 'COMPLETED',
      recordCount: Number(r.record_count || 0),
      importedBy: r.imported_by || 'Operator',
      importedAt: r.imported_at,
      templateName: r.template_name,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata,
    }));
  }

  /**
   * Records an export operation strictly bound to the active society ID.
   */
  public recordExport(params: {
    societyId: string;
    fileName: string;
    filePath: string;
    exportType: 'EXCEL' | 'CSV' | 'PDF';
    recordCount: number;
    status?: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
    metadata?: any;
  }): SocietyExportRecord {
    const db = getDatabase();
    const id = uuidv4();
    const exportedAt = new Date().toISOString();
    const status = params.status || 'COMPLETED';

    try {
      db.prepare(`
        INSERT INTO exports
        (id, society_id, filename, file_name, file_path, export_type, register_type, status, record_count, exported_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.societyId,
        params.fileName,
        params.fileName,
        params.filePath,
        params.exportType,
        params.exportType,
        status,
        params.recordCount,
        exportedAt,
        JSON.stringify(params.metadata || {})
      );
    } catch {
      db.prepare(`
        INSERT INTO exports
        (id, society_id, file_name, file_path, export_type, status, record_count, exported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.societyId,
        params.fileName,
        params.filePath,
        params.exportType,
        status,
        params.recordCount,
        exportedAt
      );
    }

    return {
      id,
      societyId: params.societyId,
      fileName: params.fileName,
      filePath: params.filePath,
      exportType: params.exportType,
      status,
      recordCount: params.recordCount,
      exportedAt,
      metadata: params.metadata,
    };
  }

  /**
   * Retrieves export history strictly scoped to active society.
   */
  public getSocietyExports(societyId: string): SocietyExportRecord[] {
    if (!societyId) return [];
    const db = getDatabase();
    const rows = (db.prepare('SELECT * FROM exports WHERE society_id = ? ORDER BY exported_at DESC').all(societyId) || []) as any[];
    return rows.map(r => ({
      id: r.id,
      societyId: r.society_id,
      fileName: r.file_name || r.filename,
      filePath: r.file_path || '',
      exportType: r.export_type || 'EXCEL',
      status: r.status || 'COMPLETED',
      recordCount: Number(r.record_count || 0),
      exportedAt: r.exported_at,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata,
    }));
  }

  /**
   * Records template usage for a society.
   */
  public recordTemplateUsage(params: {
    societyId: string;
    templateName: string;
    templatePath: string;
    recordCount?: number;
    sourceSocietyId?: string;
  }): SocietyTemplateRecord {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO template_history
        (id, society_id, society_name, template_name, template_path, file_path, version, record_count, last_used_at, used_at, source_society_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.societyId,
        '',
        params.templateName,
        params.templatePath,
        params.templatePath,
        params.recordCount || 0,
        now,
        now,
        params.sourceSocietyId || '',
        now
      );
    } catch {
      db.prepare(`
        INSERT INTO template_history
        (id, society_id, template_name, template_path, version, record_count, last_used_at, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        id,
        params.societyId,
        params.templateName,
        params.templatePath,
        params.recordCount || 0,
        now,
        now
      );
    }

    return {
      id,
      societyId: params.societyId,
      templateName: params.templateName,
      templatePath: params.templatePath,
      version: 1,
      recordCount: params.recordCount || 0,
      lastUsedAt: now,
      sourceSocietyId: params.sourceSocietyId,
      createdAt: now,
    };
  }

  /**
   * Retrieves template history strictly scoped to active society.
   */
  public getSocietyTemplates(societyId: string): SocietyTemplateRecord[] {
    if (!societyId) return [];
    const db = getDatabase();
    const rows = (db.prepare('SELECT * FROM template_history WHERE society_id = ? ORDER BY last_used_at DESC').all(societyId) || []) as any[];
    return rows.map(r => ({
      id: r.id,
      societyId: r.society_id,
      templateName: r.template_name,
      templatePath: r.template_path,
      version: Number(r.version || 1),
      recordCount: Number(r.record_count || 0),
      lastUsedAt: r.last_used_at,
      sourceSocietyId: r.source_society_id,
      createdAt: r.created_at,
    }));
  }

  /**
   * Aggregates global template usage across all societies for the Global Template Library.
   * Does NOT merge society data, only presents template references.
   */
  public getGlobalTemplateLibrary(): GlobalTemplateItem[] {
    const db = getDatabase();
    const allTemplates = (db.prepare('SELECT * FROM template_history ORDER BY last_used_at DESC').all() || []) as any[];
    const allSocieties = (db.prepare('SELECT id, society_name FROM societies').all() || []) as any[];
    const socMap = new Map<string, string>();
    allSocieties.forEach(s => socMap.set(String(s.id).trim(), s.society_name));

    const grouped = new Map<string, GlobalTemplateItem>();

    for (const t of allTemplates) {
      const name = t.template_name || 'Standard_Template.xlsx';
      const sId = String(t.society_id).trim();
      const sName = socMap.get(sId) || 'Unknown Society';

      if (!grouped.has(name)) {
        grouped.set(name, {
          templateName: name,
          usedBySocieties: [],
          totalUsageCount: 0,
          latestUsedAt: t.last_used_at || t.created_at,
        });
      }

      const item = grouped.get(name)!;
      item.totalUsageCount += 1;
      if (!item.usedBySocieties.some(u => u.societyId === sId)) {
        item.usedBySocieties.push({
          societyId: sId,
          societyName: sName,
          lastUsedAt: t.last_used_at || t.created_at,
        });
      }
      if (new Date(t.last_used_at || 0) > new Date(item.latestUsedAt || 0)) {
        item.latestUsedAt = t.last_used_at;
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Reuses a template from the Global Template Library for a target society.
   * Copies ONLY the template schema into target society's Imports/Templates directory.
   * Does NOT copy or merge member records, registers, or generated files.
   */
  public reuseTemplateForSociety(templateName: string, targetSocietyId: string): { success: boolean; targetPath: string; record: SocietyTemplateRecord } {
    const db = getDatabase();
    const config = HenuConfigService.getInstance().getConfig();

    const targetSoc = db.prepare('SELECT * FROM societies WHERE id = ?').get(targetSocietyId) as any;
    if (!targetSoc) {
      throw new Error(`Target society ${targetSocietyId} not found`);
    }

    const targetSocName = targetSoc.society_name || targetSoc.societyName;
    const targetImportsDir = path.join(StorageEngine.getSocietyImportsPath(config.rootStoragePath, targetSocName), 'Templates');
    if (!fs.existsSync(targetImportsDir)) {
      fs.mkdirSync(targetImportsDir, { recursive: true });
    }

    // Find source template file if exists
    const sourceRec = db.prepare('SELECT * FROM template_history WHERE template_name = ? ORDER BY last_used_at DESC LIMIT 1').get(templateName) as any;
    const cleanFileName = path.basename(templateName.endsWith('.xlsx') ? templateName : `${templateName}.xlsx`);
    const targetFilePath = path.join(targetImportsDir, cleanFileName);

    if (sourceRec && sourceRec.template_path && fs.existsSync(sourceRec.template_path)) {
      fs.copyFileSync(sourceRec.template_path, targetFilePath);
    } else {
      // Create empty placeholder template file marker
      fs.writeFileSync(targetFilePath, Buffer.from(''));
    }

    const record = this.recordTemplateUsage({
      societyId: targetSocietyId,
      templateName: cleanFileName,
      templatePath: targetFilePath,
      recordCount: 0,
      sourceSocietyId: sourceRec ? sourceRec.society_id : undefined,
    });

    return {
      success: true,
      targetPath: targetFilePath,
      record,
    };
  }

  /**
   * Calculates HENUMASTER Global KPIs across the entire application.
   */
  public getGlobalKpis(): HenuMasterGlobalKpis {
    const db = getDatabase();

    const societies = (db.prepare('SELECT * FROM societies').all() || []) as any[];
    const documents = (db.prepare('SELECT * FROM documents').all() || []) as any[];
    const imports = (db.prepare('SELECT * FROM imports').all() || []) as any[];
    const exportsList = (db.prepare('SELECT * FROM exports').all() || []) as any[];
    const sessions = (db.prepare('SELECT * FROM master_data_sessions').all() || []) as any[];

    const totalSocieties = societies.length;
    const archivedSocieties = societies.filter(s => s.status === 'ARCHIVED').length;
    const activeSocieties = totalSocieties - archivedSocieties;

    const totalDocuments = documents.length;
    const totalImports = imports.length;
    const totalExports = exportsList.length;

    let completedSocieties = 0;
    let inProgressSocieties = 0;
    let notStartedSocieties = 0;
    let totalStorageUsedBytes = 0;

    for (const soc of societies) {
      const sId = String(soc.id).trim();
      const socDocs = documents.filter(d => String(d.society_id).trim() === sId);
      const socImports = imports.filter(i => String(i.society_id).trim() === sId);
      const socSessions = sessions.filter(s => String(s.society_id).trim() === sId);

      const hasDocuments = socDocs.length > 0;
      const hasImports = socImports.length > 0 || socSessions.length > 0;

      if (hasDocuments && hasImports && socDocs.length >= 2) {
        completedSocieties += 1;
      } else if (hasDocuments || hasImports) {
        inProgressSocieties += 1;
      } else {
        notStartedSocieties += 1;
      }

      // Storage bytes from documents
      for (const d of socDocs) {
        totalStorageUsedBytes += Number(d.file_size || 0);
      }
    }

    return {
      totalSocieties,
      activeSocieties,
      archivedSocieties,
      totalDocuments,
      totalImports,
      totalExports,
      completedSocieties,
      inProgressSocieties,
      notStartedSocieties,
      totalStorageUsedBytes,
      totalStorageUsedFormatted: this.formatBytes(totalStorageUsedBytes),
    };
  }

  /**
   * Computes society completion status ('NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED')
   */
  public computeSocietyCompletion(societyId: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
    const db = getDatabase();
    const docCount = (db.prepare('SELECT COUNT(*) as c FROM documents WHERE society_id = ?').get(societyId) as any)?.c || 0;
    const impCount = (db.prepare('SELECT COUNT(*) as c FROM imports WHERE society_id = ?').get(societyId) as any)?.c || 0;
    const sessionCount = (db.prepare('SELECT COUNT(*) as c FROM master_data_sessions WHERE society_id = ?').get(societyId) as any)?.c || 0;

    if (docCount >= 2 && (impCount > 0 || sessionCount > 0)) {
      return 'COMPLETED';
    }
    if (docCount > 0 || impCount > 0 || sessionCount > 0) {
      return 'IN_PROGRESS';
    }
    return 'NOT_STARTED';
  }

  /**
   * Retrieves the human-readable last activity timestamp and title for a society.
   */
  public getLastActivity(societyId: string): { timestamp: string; title: string } {
    const db = getDatabase();

    const lastDoc = db.prepare('SELECT * FROM documents WHERE society_id = ? ORDER BY created_at DESC LIMIT 1').get(societyId) as any;
    const lastGen = db.prepare('SELECT * FROM generation_history WHERE society_id = ? ORDER BY generated_at DESC LIMIT 1').get(societyId) as any;
    const lastImp = db.prepare('SELECT * FROM imports WHERE society_id = ? ORDER BY imported_at DESC LIMIT 1').get(societyId) as any;
    const soc = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;

    const candidates: Array<{ timestamp: string; title: string }> = [];

    if (lastDoc && lastDoc.created_at) {
      candidates.push({ timestamp: lastDoc.created_at, title: `Document: ${lastDoc.file_name}` });
    }
    if (lastGen && lastGen.generated_at) {
      candidates.push({ timestamp: lastGen.generated_at, title: `${lastGen.form_label || lastGen.form_id || 'Form'} Generated` });
    }
    if (lastImp && lastImp.imported_at) {
      candidates.push({ timestamp: lastImp.imported_at, title: `Import: ${lastImp.file_name}` });
    }
    if (soc && soc.created_at) {
      candidates.push({ timestamp: soc.created_at, title: 'Society Created' });
    }

    if (candidates.length === 0) {
      return { timestamp: new Date().toISOString(), title: 'No Activity' };
    }

    candidates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return candidates[0];
  }
}
