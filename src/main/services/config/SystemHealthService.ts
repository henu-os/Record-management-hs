import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../db';
import { SystemHealthReport } from '../../types';
import { HenuConfigService } from './HenuConfigService';
import { StorageEngine } from './StorageEngine';
import { DocumentRoutingService } from './DocumentRoutingService';

export class SystemHealthService {
  private static instance: SystemHealthService;

  static getInstance(): SystemHealthService {
    if (!SystemHealthService.instance) {
      SystemHealthService.instance = new SystemHealthService();
    }
    return SystemHealthService.instance;
  }

  /**
   * Runs the complete 8-point HENU OS SYSTEM HEALTH audit.
   */
  async runHealthCheck(): Promise<SystemHealthReport> {
    const config = HenuConfigService.getInstance().getConfig();
    const db = getDatabase();
    const missingFilesList: Array<{ id: string; societyName: string; fileName: string; expectedPath: string }> = [];

    // 1. Database Check
    let dbPassed = false;
    let dbMessage = 'Database operational';
    try {
      const res = db.prepare('SELECT COUNT(*) as cnt FROM settings').get();
      dbPassed = res !== undefined;
    } catch (err: any) {
      dbMessage = `Database error: ${err.message}`;
    }

    // 2. Storage & Path Check
    const storageValidation = StorageEngine.validateLocation(config.rootStoragePath);
    const storagePassed = storageValidation.isValid;
    const storageMessage = storagePassed
      ? `Root storage accessible (${config.rootStoragePath})`
      : `Storage issue: ${storageValidation.errors.join(', ')}`;

    // 3. Society Index vs Folders
    const societies = (db.prepare('SELECT * FROM societies').all() as any[]) || [];
    const missingFolders: string[] = [];
    for (const soc of societies) {
      const safeName = StorageEngine.sanitizeFolderName(soc.society_name);
      const socDir = path.join(config.societiesPath, safeName);
      if (!fs.existsSync(socDir)) {
        missingFolders.push(`${soc.society_name} (${safeName})`);
      }
    }
    const societyIndexPassed = missingFolders.length === 0;
    const societyIndexMessage = societyIndexPassed
      ? `All ${societies.length} societies have physical directories.`
      : `${missingFolders.length} society folders are missing on disk.`;

    // 4. File Index Check (Detect missing physical files)
    const docs = (db.prepare('SELECT * FROM documents').all() as any[]) || [];
    const socMap = new Map(societies.map(s => [s.id, s.society_name]));
    let missingPhysicalCount = 0;

    for (const doc of docs) {
      if (!fs.existsSync(doc.file_path)) {
        missingPhysicalCount++;
        missingFilesList.push({
          id: doc.id,
          societyName: socMap.get(doc.society_id) || 'Unknown',
          fileName: doc.file_name,
          expectedPath: doc.file_path,
        });
      }
    }
    const fileIndexPassed = missingPhysicalCount === 0;
    const fileIndexMessage = fileIndexPassed
      ? `All ${docs.length} indexed documents verified on disk.`
      : `Warning: ${missingPhysicalCount} document files missing on disk.`;

    // 5. Folder Structure Check (8 System Categories)
    const categories = DocumentRoutingService.getInstance().getCategories();
    const systemCats = categories.filter(c => c.systemRequired);
    const folderStructurePassed = systemCats.length >= 8;
    const folderStructureMessage = folderStructurePassed
      ? `All 8 required system document categories active.`
      : `Missing required system categories (${systemCats.length}/8).`;

    // 6. Configuration Check
    const configPassed = config.firstRunCompleted && Boolean(config.rootStoragePath);
    const configMessage = configPassed
      ? 'Application configuration verified.'
      : 'First-run configuration not yet completed.';

    // 7. Permissions Check
    const permissionsPassed = storageValidation.isWritable && storageValidation.isReadable;
    const permissionsMessage = permissionsPassed
      ? 'Read and write permissions confirmed.'
      : 'Insufficient directory permissions.';

    // 8. Backup Status Check
    let backupPassed = true;
    let backupMessage = 'Backups enabled.';
    if (config.lastBackupAt) {
      const daysSince = (Date.now() - new Date(config.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
      backupMessage = `Last backup: ${new Date(config.lastBackupAt).toLocaleDateString()} (${Math.round(daysSince)} days ago)`;
      if (daysSince > 14) {
        backupPassed = false;
        backupMessage += ' — Warning: Backup is over 14 days old.';
      }
    } else {
      backupMessage = 'No backup performed yet.';
    }

    const allPassed =
      dbPassed &&
      storagePassed &&
      societyIndexPassed &&
      fileIndexPassed &&
      folderStructurePassed &&
      configPassed &&
      permissionsPassed;

    const overallStatus: 'HEALTHY' | 'WARNING' | 'ERROR' = !dbPassed || !storagePassed
      ? 'ERROR'
      : (allPassed ? 'HEALTHY' : 'WARNING');

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      checks: {
        database: { passed: dbPassed, message: dbMessage },
        storage: { passed: storagePassed, message: storageMessage, rootPath: config.rootStoragePath },
        societyIndex: { passed: societyIndexPassed, message: societyIndexMessage, societyCount: societies.length, missingFolders },
        fileIndex: { passed: fileIndexPassed, message: fileIndexMessage, indexedFiles: docs.length, missingPhysicalFiles: missingPhysicalCount },
        folderStructure: { passed: folderStructurePassed, message: folderStructureMessage },
        configuration: { passed: configPassed, message: configMessage },
        permissions: { passed: permissionsPassed, message: permissionsMessage },
        backup: { passed: backupPassed, message: backupMessage, lastBackup: config.lastBackupAt },
      },
      missingFilesList,
    };
  }

  /**
   * Repairs and re-indexes storage:
   * 1. Re-creates any missing society and category folders
   * 2. Scans physical directories to register any untracked PDF/Excel files into the database
   */
  async repairAndReindex(): Promise<{ success: boolean; repairedFolders: number; registeredFiles: number; message: string }> {
    const config = HenuConfigService.getInstance().getConfig();
    const db = getDatabase();
    const societies = (db.prepare('SELECT * FROM societies').all() as any[]) || [];
    const categories = DocumentRoutingService.getInstance().getCategories();
    const catNames = categories.map(c => c.name);

    let repairedFolders = 0;
    let registeredFiles = 0;

    // 1. Ensure root folders exist
    StorageEngine.initializeRootStructure(config.rootStoragePath);

    // 2. Ensure each society has full folder hierarchy
    for (const soc of societies) {
      const { createdCategories } = StorageEngine.createSocietyFolders(config.rootStoragePath, soc.society_name, catNames);
      repairedFolders += Object.keys(createdCategories).length;

      // Scan category folders for unindexed files
      for (const [catName, catPath] of Object.entries(createdCategories)) {
        const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (!cat || !fs.existsSync(catPath)) continue;

        const files = fs.readdirSync(catPath);
        for (const file of files) {
          const filePath = path.join(catPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            // Check if already in documents table
            const existing = db.prepare('SELECT id FROM documents WHERE file_path = ?').get(filePath);
            if (!existing) {
              const ext = path.extname(file).replace('.', '').toUpperCase();
              db.prepare(`
                INSERT INTO documents
                (id, society_id, category_id, file_name, file_path, file_type, file_size, version, checksum, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                uuidv4(),
                soc.id,
                cat.id,
                file,
                filePath,
                ext || 'PDF',
                stat.size,
                1,
                '',
                'ACTIVE',
                stat.birthtime.toISOString() || new Date().toISOString(),
                stat.mtime.toISOString() || new Date().toISOString()
              );
              registeredFiles++;
            }
          }
        }
      }
    }

    return {
      success: true,
      repairedFolders,
      registeredFiles,
      message: `Repair completed: verified ${repairedFolders} folders, indexed ${registeredFiles} untracked files.`,
    };
  }
}
