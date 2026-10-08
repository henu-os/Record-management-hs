import fs from 'fs';
import path from 'path';
import { getDatabase } from '../../db';
import {
  HenuMasterDashboardStats,
  SocietySummary,
  SocietyOverviewDetails,
  SocietyRegisterCount,
  SocietyActivityItem,
  SocietyHealthCheck,
  Society,
} from '../../types';
import { HenuConfigService } from '../config/HenuConfigService';
import { DocumentRoutingService } from '../config/DocumentRoutingService';
import { StorageEngine } from '../config/StorageEngine';
import { BackupService } from '../config/BackupService';
import { SystemHealthService } from '../config/SystemHealthService';

import { HenuSocietyContextService } from '../society/HenuSocietyContextService';

export class HenuMasterService {
  private static instance: HenuMasterService;

  private constructor() {}

  public static getInstance(): HenuMasterService {
    if (!HenuMasterService.instance) {
      HenuMasterService.instance = new HenuMasterService();
    }
    return HenuMasterService.instance;
  }

  /**
   * Formats raw bytes into human readable string
   */
  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || 'B'}`;
  }

  /**
   * Maps category name to existing application navigation ID
   */
  public getNavIdForCategory(categoryName: string): string {
    const norm = categoryName.trim().toLowerCase();
    if (norm.includes('ocr') && (norm.includes('voucher') || norm.includes('vch'))) return 'voucher-ocr';
    if (norm.includes('ocr') && (norm.includes('check') || norm.includes('cheque') || norm.includes('chk'))) return 'check-ocr';
    if (norm.includes('form i') && !norm.includes('form j')) return 'generate-FORM_I';
    if (norm.includes('form j')) return 'generate-FORM_J';
    if (norm.includes('share reg') || norm.includes('share_reg')) return 'generate-FORM_SHARE';
    if (norm.includes('property') || norm.includes('prop')) return 'generate-FORM_PROP';
    if (norm.includes('nomination') || norm.includes('nom')) return 'generate-FORM_NOM';
    if (norm.includes('bank') || norm.includes('lien')) return 'generate-FORM_BANK';
    if (norm.includes('certificate') || norm.includes('share cert')) return 'generate-FORM_SHARE_CERT';
    if (norm.includes('voucher')) return 'generate-FORM_VOUCHER';
    return 'dashboard';
  }

  /**
   * Alias for getDashboardStats
   */
  public getDashboardKPIs(): HenuMasterDashboardStats {
    return this.getDashboardStats();
  }

  /**
   * Fetches high-level administrative KPIs for the HENUMASTER dashboard
   */
  public getDashboardStats(): HenuMasterDashboardStats {
    const db = getDatabase();
    const config = HenuConfigService.getInstance().getConfig();
    const contextService = HenuSocietyContextService.getInstance();
    const kpis = contextService.getGlobalKpis();

    const societies = (db.prepare('SELECT * FROM societies').all() || []) as any[];
    const categories = DocumentRoutingService.getInstance().getCategories();
    const totalRegisters = kpis.totalSocieties * (categories.length || 8);

    const valResult = StorageEngine.validateLocation(config.rootStoragePath);
    const storageAvailableBytes = valResult.availableSpaceBytes || (100 * 1024 * 1024 * 1024);
    const totalCapacity = kpis.totalStorageUsedBytes + storageAvailableBytes;
    const storagePercentUsed = totalCapacity > 0 ? Math.min(100, Math.round((kpis.totalStorageUsedBytes / totalCapacity) * 100)) : 0;

    const backups = BackupService.getInstance().listBackups();
    const lastBackupAt = backups.length > 0 ? backups[0].createdAt : config.lastBackupAt || 'Never';

    let healthyCount = 0;
    let warningCount = 0;

    for (const soc of societies) {
      const sanitized = StorageEngine.sanitizeFolderName(soc.society_name || soc.societyName);
      const socFolder = path.join(config.societiesPath, sanitized);
      const exists = fs.existsSync(socFolder);
      if (exists) {
        healthyCount++;
      } else {
        warningCount++;
      }
    }

    const activeSocRow = societies.find(s => Number(s.is_active) === 1);

    return {
      totalSocieties: kpis.totalSocieties,
      activeSocieties: kpis.activeSocieties,
      archivedSocieties: kpis.archivedSocieties,
      totalRegisters,
      totalDocuments: kpis.totalDocuments,
      totalFiles: kpis.totalDocuments,
      totalImports: kpis.totalImports,
      totalExports: kpis.totalExports,
      completedSocieties: kpis.completedSocieties,
      inProgressSocieties: kpis.inProgressSocieties,
      notStartedSocieties: kpis.notStartedSocieties,
      storageUsedBytes: kpis.totalStorageUsedBytes,
      storageUsedFormatted: kpis.totalStorageUsedFormatted,
      storageAvailableBytes,
      storageAvailableFormatted: this.formatBytes(storageAvailableBytes),
      storagePercentUsed,
      lastBackupAt,
      systemHealthStatus: warningCount > 0 ? 'WARNING' : 'HEALTHY',
      healthySocietiesCount: healthyCount,
      warningSocietiesCount: warningCount,
      activeSocietyId: activeSocRow?.id,
      activeSocietyName: activeSocRow?.society_name || activeSocRow?.societyName,
    };
  }

  /**
   * Lists all societies with search, filter, document counts, imports, exports, storage, completion, and activity
   */
  public listSocieties(filter?: { search?: string; status?: string }): SocietySummary[] {
    const db = getDatabase();
    const config = HenuConfigService.getInstance().getConfig();
    const contextService = HenuSocietyContextService.getInstance();

    const societies = (db.prepare('SELECT * FROM societies ORDER BY created_at ASC').all() || []) as any[];
    const documents = (db.prepare('SELECT * FROM documents').all() || []) as any[];
    const imports = (db.prepare('SELECT * FROM imports').all() || []) as any[];
    const exportsList = (db.prepare('SELECT * FROM exports').all() || []) as any[];

    // Index documents by societyId for ultra-fast aggregations
    const docMap = new Map<string, any[]>();
    for (const doc of documents) {
      const sId = String(doc.society_id || '').trim();
      if (!docMap.has(sId)) docMap.set(sId, []);
      docMap.get(sId)!.push(doc);
    }

    const importMap = new Map<string, any[]>();
    for (const imp of imports) {
      const sId = String(imp.society_id || '').trim();
      if (!importMap.has(sId)) importMap.set(sId, []);
      importMap.get(sId)!.push(imp);
    }

    const exportMap = new Map<string, any[]>();
    for (const exp of exportsList) {
      const sId = String(exp.society_id || '').trim();
      if (!exportMap.has(sId)) exportMap.set(sId, []);
      exportMap.get(sId)!.push(exp);
    }

    const results: SocietySummary[] = [];

    for (const soc of societies) {
      const socId = String(soc.id).trim();
      const socName = soc.society_name || soc.societyName || 'Unnamed Society';
      const status: 'ACTIVE' | 'ARCHIVED' = soc.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
      const isActive = Number(soc.is_active) === 1;

      // Check search filter
      if (filter?.search) {
        const q = filter.search.toLowerCase().trim();
        const match =
          socName.toLowerCase().includes(q) ||
          (soc.registration_no && soc.registration_no.toLowerCase().includes(q)) ||
          (soc.city && soc.city.toLowerCase().includes(q)) ||
          (soc.state && soc.state.toLowerCase().includes(q)) ||
          (soc.full_address && soc.full_address.toLowerCase().includes(q));
        if (!match) continue;
      }

      // Check status filter
      if (filter?.status && filter.status !== 'ALL') {
        if (filter.status !== status) continue;
      }

      const socDocs = docMap.get(socId) || [];
      const socImports = importMap.get(socId) || [];
      const socExports = exportMap.get(socId) || [];

      const documentCount = socDocs.length;
      let storageSizeBytes = 0;
      let lastDocumentDate = '';
      let lastDocumentName = '';

      for (const d of socDocs) {
        storageSizeBytes += Number(d.file_size || 0);
        if (!lastDocumentDate || new Date(d.created_at || 0) > new Date(lastDocumentDate)) {
          lastDocumentDate = d.created_at;
          lastDocumentName = d.file_name;
        }
      }

      const sanitized = StorageEngine.sanitizeFolderName(socName);
      const folderPath = path.join(config.societiesPath, sanitized);
      const folderExists = fs.existsSync(folderPath);

      let healthStatus: 'HEALTHY' | 'WARNING' | 'ERROR' = 'HEALTHY';
      let healthMessage = 'Storage folder and database records intact';

      if (!folderExists) {
        healthStatus = 'WARNING';
        healthMessage = 'Physical society folder missing from disk';
      }

      const completionStatus = contextService.computeSocietyCompletion(socId);
      const lastAct = contextService.getLastActivity(socId);

      results.push({
        id: socId,
        societyName: socName,
        registrationNo: soc.registration_no || soc.registrationNo || '',
        registrationDate: soc.registration_date || soc.registrationDate || '',
        fullAddress: soc.full_address || soc.fullAddress || '',
        city: soc.city || '',
        state: soc.state || '',
        pinCode: soc.pin_code || soc.pinCode || '',
        logoBase64: soc.logo_base64 || '',
        createdAt: soc.created_at || new Date().toISOString(),
        updatedAt: soc.updated_at || '',
        yearEstablished: soc.year_established || '',
        status,
        isActive,
        folderPath,
        storageSizeBytes,
        storageSizeFormatted: this.formatBytes(storageSizeBytes),
        documentCount,
        filesCount: documentCount,
        importCount: socImports.length,
        exportCount: socExports.length,
        completionStatus,
        lastActivityTitle: lastAct.title,
        lastActivityTimestamp: lastAct.timestamp,
        healthStatus,
        healthMessage,
        lastDocumentDate,
        lastDocumentName,
      });
    }

    return results;
  }

  /**
   * Retrieves complete overview details for a specific society
   */
  public getSocietyOverview(societyId: string): SocietyOverviewDetails {
    const db = getDatabase();
    const config = HenuConfigService.getInstance().getConfig();

    const soc = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;
    if (!soc) {
      throw new Error(`Society with ID ${societyId} not found`);
    }

    const socName = soc.society_name || soc.societyName;
    const sanitized = StorageEngine.sanitizeFolderName(socName);
    const socFolderPath = path.join(config.societiesPath, sanitized);
    const folderExists = fs.existsSync(socFolderPath);

    const categories = DocumentRoutingService.getInstance().getCategories();
    const documents = (db.prepare('SELECT * FROM documents WHERE society_id = ?').all(societyId) || []) as any[];

    // Compute register breakdown
    const registers: SocietyRegisterCount[] = [];
    let totalStorageBytes = 0;
    const missingFilesList: Array<{ fileName: string; filePath: string }> = [];

    for (const cat of categories) {
      const catDocs = documents.filter(d => String(d.category_id).trim() === String(cat.id).trim());
      let catBytes = 0;
      let catLastUpdated = '';

      for (const d of catDocs) {
        catBytes += Number(d.file_size || 0);
        if (!catLastUpdated || new Date(d.created_at || 0) > new Date(catLastUpdated)) {
          catLastUpdated = d.created_at;
        }

        // Verify physical file existence
        if (d.file_path && !fs.existsSync(d.file_path)) {
          missingFilesList.push({ fileName: d.file_name, filePath: d.file_path });
        }
      }

      totalStorageBytes += catBytes;
      const catFolder = path.join(socFolderPath, cat.name);
      const catFolderExists = fs.existsSync(catFolder);

      registers.push({
        categoryId: cat.id,
        categoryName: cat.name,
        documentCount: catDocs.length,
        storageBytes: catBytes,
        storageFormatted: this.formatBytes(catBytes),
        lastUpdated: catLastUpdated || soc.created_at || 'None',
        status: catFolderExists ? (catDocs.length > 0 ? 'HEALTHY' : 'EMPTY') : 'WARNING',
        navFormId: this.getNavIdForCategory(cat.name),
        folderPath: catFolder,
        folderExists: catFolderExists,
      });
    }

    // Recent activity
    const recentActivity = this.getRecentActivity(societyId, 15);

    // Health check
    const missingCategoryFolders = registers.filter(r => !r.folderExists).map(r => r.categoryName);
    const allCategoryFoldersExist = missingCategoryFolders.length === 0;

    const backups = BackupService.getInstance().listBackups();
    const backupStatus = backups.length > 0 ? 'UP_TO_DATE' : 'NEVER';

    const isHealthy = folderExists && allCategoryFoldersExist && missingFilesList.length === 0;
    const overallStatus: 'HEALTHY' | 'WARNING' | 'ERROR' = isHealthy
      ? 'HEALTHY'
      : (!folderExists ? 'ERROR' : 'WARNING');

    const health: SocietyHealthCheck = {
      isHealthy,
      overallStatus,
      dbRecordExists: true,
      folderExists,
      categoriesConfigured: categories.length > 0,
      allCategoryFoldersExist,
      missingCategoryFolders,
      totalDocuments: documents.length,
      missingPhysicalFiles: missingFilesList.length,
      missingFilesList,
      backupStatus,
      lastBackupAt: backups.length > 0 ? backups[0].createdAt : undefined,
    };

    return {
      id: soc.id,
      societyName: socName,
      registrationNo: soc.registration_no || '',
      registrationDate: soc.registration_date || '',
      fullAddress: soc.full_address || '',
      city: soc.city || '',
      state: soc.state || '',
      pinCode: soc.pin_code || '',
      logoBase64: soc.logo_base64 || '',
      createdAt: soc.created_at,
      updatedAt: soc.updated_at || '',
      yearEstablished: soc.year_established || '',
      status: soc.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
      isActive: Number(soc.is_active) === 1,
      rootStoragePath: config.rootStoragePath,
      folderPath: socFolderPath,
      storageSizeBytes: totalStorageBytes,
      storageSizeFormatted: this.formatBytes(totalStorageBytes),
      documentCount: documents.length,
      filesCount: documents.length,
      healthStatus: overallStatus,
      healthMessage: isHealthy ? 'Society storage and all records intact' : `${missingFilesList.length} missing files, ${missingCategoryFolders.length} missing folders`,
      registers,
      recentActivity,
      health,
      missingFilesCount: missingFilesList.length,
    };
  }

  /**
   * Safely updates society metadata in database without breaking folder paths
   */
  public updateSocietyMetadata(
    societyId: string,
    metadata: {
      societyName?: string;
      registrationNo?: string;
      registrationDate?: string;
      fullAddress?: string;
      city?: string;
      state?: string;
      pinCode?: string;
      yearEstablished?: string;
      logoBase64?: string;
    }
  ): Society {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;
    if (!existing) throw new Error(`Society ${societyId} not found`);

    const societyName = metadata.societyName !== undefined ? metadata.societyName : existing.society_name;
    const registrationNo = metadata.registrationNo !== undefined ? metadata.registrationNo : existing.registration_no;
    const registrationDate = metadata.registrationDate !== undefined ? metadata.registrationDate : (existing.registration_date || '');
    const fullAddress = metadata.fullAddress !== undefined ? metadata.fullAddress : (existing.full_address || '');
    const city = metadata.city !== undefined ? metadata.city : (existing.city || '');
    const state = metadata.state !== undefined ? metadata.state : (existing.state || '');
    const pinCode = metadata.pinCode !== undefined ? metadata.pinCode : (existing.pin_code || '');
    const yearEstablished = metadata.yearEstablished !== undefined ? metadata.yearEstablished : (existing.year_established || '');
    const logoBase64 = metadata.logoBase64 !== undefined ? metadata.logoBase64 : (existing.logo_base64 || '');
    const updatedAt = new Date().toISOString();

    db.prepare(`
      UPDATE societies
      SET society_name = ?, registration_no = ?, registration_date = ?, full_address = ?, city = ?, state = ?, pin_code = ?, year_established = ?, logo_base64 = ?, updated_at = ?
      WHERE id = ?
    `).run(
      societyName,
      registrationNo,
      registrationDate,
      fullAddress,
      city,
      state,
      pinCode,
      yearEstablished,
      logoBase64,
      updatedAt,
      societyId
    );

    const updated = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;
    return {
      id: updated.id,
      societyName: updated.society_name,
      registrationNo: updated.registration_no,
      registrationDate: updated.registration_date,
      fullAddress: updated.full_address,
      city: updated.city,
      state: updated.state,
      pinCode: updated.pin_code,
      logoBase64: updated.logo_base64,
      createdAt: updated.created_at,
      isActive: Boolean(updated.is_active),
    };
  }

  /**
   * Sets society status to ARCHIVED without deleting data
   */
  public archiveSociety(societyId: string): boolean {
    const db = getDatabase();
    const soc = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;
    if (!soc) return false;

    db.prepare('UPDATE societies SET status = ? WHERE id = ?').run('ARCHIVED', societyId);

    // If currently active, switch to another active society if possible
    if (Number(soc.is_active) === 1) {
      const nextActive = db.prepare("SELECT id FROM societies WHERE id != ? AND (status != 'ARCHIVED' OR status IS NULL) ORDER BY created_at ASC LIMIT 1").get(societyId) as any;
      if (nextActive) {
        db.prepare('UPDATE societies SET is_active = 0').run();
        db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(nextActive.id);
      }
    }
    return true;
  }

  /**
   * Restores an archived society back to ACTIVE
   */
  public restoreSociety(societyId: string): boolean {
    const db = getDatabase();
    const soc = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;
    if (!soc) return false;

    db.prepare('UPDATE societies SET status = ? WHERE id = ?').run('ACTIVE', societyId);
    return true;
  }

  /**
   * Permanently deletes a society, all associated database records (workbooks, history, documents, folders),
   * clears/switches active context safely, and deletes its physical directory.
   */
  public deleteSociety(societyId: string): { success: boolean; message: string; remainingCount: number } {
    const db = getDatabase();
    const config = HenuConfigService.getInstance().getConfig();

    const soc = db.prepare('SELECT * FROM societies WHERE id = ?').get(societyId) as any;
    if (!soc) {
      throw new Error(`Society with ID ${societyId} does not exist`);
    }

    const socName = soc.society_name || soc.societyName || 'Unnamed_Society';
    const isActive = Number(soc.is_active) === 1;

    // 1. Delete from database tables
    db.prepare('DELETE FROM societies WHERE id = ?').run(societyId);
    db.prepare('DELETE FROM master_data_sessions WHERE society_id = ?').run(societyId);
    db.prepare('DELETE FROM generation_history WHERE society_id = ?').run(societyId);
    db.prepare('DELETE FROM documents WHERE society_id = ?').run(societyId);
    db.prepare('DELETE FROM society_folders WHERE society_id = ?').run(societyId);
    try { db.prepare('DELETE FROM imports WHERE society_id = ?').run(societyId); } catch {}
    try { db.prepare('DELETE FROM exports WHERE society_id = ?').run(societyId); } catch {}
    try { db.prepare('DELETE FROM template_history WHERE society_id = ?').run(societyId); } catch {}

    // 2. Handle active context switch if the deleted society was active
    const remaining = (db.prepare('SELECT * FROM societies ORDER BY created_at ASC').all() || []) as any[];
    if (isActive) {
      db.prepare('UPDATE societies SET is_active = 0').run();
      if (remaining.length > 0) {
        db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(remaining[0].id);
      }
    }

    // 3. Delete physical storage folder
    try {
      StorageEngine.deleteSocietyFolder(config.rootStoragePath, socName);
    } catch (err: any) {
      console.warn(`Could not delete physical society folder for ${socName}:`, err.message);
    }

    // 4. Log the deletion
    try {
      db.prepare(`
        INSERT INTO app_logs (timestamp, level, operation, message, metadata)
        VALUES (?, 'INFO', 'SOCIETY_DELETE_COMPLETE', ?, ?)
      `).run(
        new Date().toISOString(),
        `Permanently deleted society ${socName} (${societyId})`,
        JSON.stringify({ societyId, societyName: socName })
      );
    } catch { }

    return {
      success: true,
      message: `Society "${socName}" and all associated records were permanently deleted.`,
      remainingCount: remaining.length,
    };
  }

  /**
   * Gathers recent activity for a society or the whole system
   */
  public getRecentActivity(societyId?: string, limit: number = 20): SocietyActivityItem[] {
    const db = getDatabase();
    const activities: SocietyActivityItem[] = [];

    // 1. Documents
    const docs = (societyId
      ? db.prepare('SELECT * FROM documents WHERE society_id = ? ORDER BY created_at DESC LIMIT ?').all(societyId, limit)
      : db.prepare('SELECT * FROM documents ORDER BY created_at DESC LIMIT ?').all(limit)) as any[];

    for (const d of docs || []) {
      activities.push({
        id: `doc-${d.id}`,
        timestamp: d.created_at,
        type: 'DOCUMENT_SAVED',
        title: `Document Saved: ${d.file_name}`,
        description: `Version ${d.version || 1} registered (${this.formatBytes(d.file_size)})`,
        fileName: d.file_name,
      });
    }

    // 2. Generation History
    const gens = (societyId
      ? db.prepare('SELECT * FROM generation_history WHERE society_id = ? ORDER BY generated_at DESC LIMIT ?').all(societyId, limit)
      : db.prepare('SELECT * FROM generation_history ORDER BY generated_at DESC LIMIT ?').all(limit)) as any[];

    for (const g of gens || []) {
      activities.push({
        id: `gen-${g.id}`,
        timestamp: g.generated_at,
        type: 'DOCUMENT_GENERATED',
        title: `Batch Generated: ${g.form_label || g.form_id}`,
        description: `Generated ${g.total_generated || 0} sheets (${g.from_serial} - ${g.to_serial})`,
      });
    }

    // Sort combined activities by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities.slice(0, limit);
  }

  /**
   * Generates a printable or exportable summary of society statistics and registers
   */
  public exportSocietySummary(societyId: string, format: 'json' | 'csv' | 'text' = 'text'): string {
    const overview = this.getSocietyOverview(societyId);

    if (format === 'json') {
      return JSON.stringify(overview, null, 2);
    }

    if (format === 'csv') {
      const rows = [
        ['Category', 'Document Count', 'Storage Size', 'Status', 'Last Updated', 'Folder Path'],
        ...overview.registers.map(r => [
          `"${r.categoryName}"`,
          r.documentCount,
          `"${r.storageFormatted}"`,
          `"${r.status}"`,
          `"${r.lastUpdated}"`,
          `"${r.folderPath || ''}"`,
        ]),
      ];
      return rows.map(r => r.join(',')).join('\n');
    }

    // Formatted plain text report
    return [
      '========================================================================',
      `HENU OS RECORD MANAGEMENT — SOCIETY EXECUTIVE SUMMARY`,
      '========================================================================',
      `Society Name:       ${overview.societyName}`,
      `Registration No:    ${overview.registrationNo}`,
      `Registration Date:  ${overview.registrationDate || 'N/A'}`,
      `Year Established:   ${overview.yearEstablished || 'N/A'}`,
      `Address:            ${overview.fullAddress}, ${overview.city}, ${overview.state} ${overview.pinCode}`,
      `Status:             ${overview.status}`,
      `Health Status:      ${overview.healthStatus} (${overview.healthMessage})`,
      `Storage Folder:     ${overview.folderPath}`,
      `Total Documents:    ${overview.documentCount}`,
      `Total Storage:      ${overview.storageSizeFormatted}`,
      `Created At:         ${overview.createdAt}`,
      '------------------------------------------------------------------------',
      'STATUTORY REGISTER & DOCUMENT BREAKDOWN',
      '------------------------------------------------------------------------',
      ...overview.registers.map(
        r => `${r.categoryName.padEnd(25)} : ${String(r.documentCount).padStart(5)} docs | ${r.storageFormatted.padStart(10)} | ${r.status}`
      ),
      '========================================================================',
      `Generated on: ${new Date().toLocaleString()}`,
      '========================================================================',
    ].join('\n');
  }
}
