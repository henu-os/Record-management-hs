import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { getDatabase, getPaths } from '../../db';
import { BackupItem } from '../../types';
import { HenuConfigService } from './HenuConfigService';
import { StorageEngine } from './StorageEngine';

export interface ScopedBackupOptions {
  backupType: 'json' | 'zip';
  scope: 'all' | 'custom';
  includeConfig?: boolean;
  selectedSocieties?: string[];
  selectedFolders?: Record<string, string[]>;
  label?: string;
}

export interface BackupValidationResult {
  isValid: boolean;
  backupType: 'ZIP' | 'JSON' | 'UNKNOWN';
  backupDate: string;
  societies: string[];
  filesCount: number;
  fileSizeFormatted: string;
  version: string;
  hasConfig: boolean;
  errors: string[];
}

export class BackupService {
  private static instance: BackupService;

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || 'B'}`;
  }

  /**
   * Universal entry point for creating backups (JSON or Folder/ZIP).
   */
  async createScopedBackup(
    options: ScopedBackupOptions
  ): Promise<{ success: boolean; backup?: BackupItem; error?: string }> {
    if (options.backupType === 'json') {
      return this.createJsonBackup(options);
    }
    return this.createZipBackup(options);
  }

  /**
   * Creates a structured JSON metadata and database backup.
   */
  async createJsonBackup(
    options: ScopedBackupOptions
  ): Promise<{ success: boolean; backup?: BackupItem; error?: string }> {
    try {
      const config = HenuConfigService.getInstance().getConfig();
      const backupDir = config.backupPath;

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const db = getDatabase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanLabel = options.label ? `_${options.label.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const fileName = `HENU_OS_RECMA_BACKUP_${timestamp}${cleanLabel}.json`;
      const filePath = path.join(backupDir, fileName);

      let societies = (db.prepare('SELECT * FROM societies').all() || []) as any[];
      if (options.scope === 'custom' && options.selectedSocieties && options.selectedSocieties.length > 0) {
        const set = new Set(options.selectedSocieties.map(s => s.toLowerCase()));
        societies = societies.filter(s => set.has((s.society_name || s.societyName || '').toLowerCase()) || set.has(String(s.id).toLowerCase()));
      }

      const socIds = new Set(societies.map(s => String(s.id)));
      let documents = (db.prepare('SELECT * FROM documents').all() || []) as any[];
      let generationHistory = (db.prepare('SELECT * FROM generation_history').all() || []) as any[];
      let masterSessions = (db.prepare('SELECT * FROM master_data_sessions').all() || []) as any[];

      if (options.scope === 'custom') {
        documents = documents.filter(d => socIds.has(String(d.society_id)));
        generationHistory = generationHistory.filter(g => socIds.has(String(g.society_id)));
        masterSessions = masterSessions.filter(m => socIds.has(String(m.society_id)));
      }

      const payload = {
        backupVersion: 1,
        applicationVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        backupType: 'JSON_METADATA',
        scope: options.scope,
        includeConfig: Boolean(options.includeConfig),
        societies,
        documents,
        generationHistory,
        masterSessions,
        configuration: options.includeConfig ? config : undefined,
      };

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      const stat = fs.statSync(filePath);
      const now = new Date().toISOString();

      HenuConfigService.getInstance().saveConfig({ lastBackupAt: now });

      const item: BackupItem = {
        id: `backup-${Date.now()}`,
        fileName,
        filePath,
        fileSize: stat.size,
        fileSizeFormatted: this.formatBytes(stat.size),
        createdAt: now,
        itemCount: societies.length,
        isVerified: true,
      };

      return { success: true, backup: item };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Creates a Folder / ZIP backup with full or custom scope.
   */
  async createZipBackup(
    options: ScopedBackupOptions
  ): Promise<{ success: boolean; backup?: BackupItem; error?: string }> {
    try {
      const config = HenuConfigService.getInstance().getConfig();
      const backupDir = config.backupPath;

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanLabel = options.label ? `_${options.label.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const fileName = `HENU_OS_RECMA_Societies_${timestamp}${cleanLabel}.zip`;
      const tempFilePath = path.join(backupDir, `.tmp_${Date.now()}_${fileName}`);
      const finalFilePath = path.join(backupDir, fileName);

      const zip = new JSZip();
      let fileCount = 0;
      const societiesDir = config.societiesPath;
      const includedSocieties: string[] = [];

      if (options.scope === 'all') {
        // Full recursive Societies backup
        if (fs.existsSync(societiesDir)) {
          fileCount += this.addFolderToZip(zip, societiesDir, 'Societies');
          const socs = fs.readdirSync(societiesDir).filter(f => fs.statSync(path.join(societiesDir, f)).isDirectory());
          includedSocieties.push(...socs);
        }
      } else {
        // Custom scoped backup
        const selectedSocs = options.selectedSocieties || [];
        for (const socName of selectedSocs) {
          const safeName = StorageEngine.sanitizeFolderName(socName);
          const socPath = path.join(societiesDir, safeName);
          if (!fs.existsSync(socPath)) continue;

          includedSocieties.push(socName);
          const allowedSubfolders = options.selectedFolders?.[socName] || options.selectedFolders?.[safeName];

          if (!allowedSubfolders || allowedSubfolders.length === 0) {
            // Whole society selected
            fileCount += this.addFolderToZip(zip, socPath, `Societies/${safeName}`);
          } else {
            // Specific sub-registers selected
            for (const sub of allowedSubfolders) {
              const subPath = path.join(socPath, sub);
              if (fs.existsSync(subPath)) {
                if (fs.statSync(subPath).isDirectory()) {
                  fileCount += this.addFolderToZip(zip, subPath, `Societies/${safeName}/${sub}`);
                } else {
                  zip.file(`Societies/${safeName}/${sub}`, fs.readFileSync(subPath));
                  fileCount++;
                }
              }
            }
          }
        }
      }

      // Include HENU CONFIG metadata if requested
      if (options.includeConfig) {
        zip.file('system/application_config.json', JSON.stringify(config, null, 2));
        fileCount++;
      }

      // Manifest
      const manifest = {
        backupVersion: 1,
        applicationVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        backupType: 'FOLDER_ZIP',
        scope: options.scope,
        includedSocieties,
        includeConfig: Boolean(options.includeConfig),
        fileCount,
      };
      zip.file('backup-manifest.json', JSON.stringify(manifest, null, 2));

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      fs.writeFileSync(tempFilePath, zipBuffer);

      // Validation check before committing
      const loadedCheck = await JSZip.loadAsync(fs.readFileSync(tempFilePath));
      if (!loadedCheck.file('backup-manifest.json')) {
        throw new Error('Backup integrity validation failed: manifest missing.');
      }

      // Commit file rename
      fs.renameSync(tempFilePath, finalFilePath);

      const stat = fs.statSync(finalFilePath);
      const now = new Date().toISOString();

      HenuConfigService.getInstance().saveConfig({ lastBackupAt: now });

      const item: BackupItem = {
        id: `backup-${Date.now()}`,
        fileName,
        filePath: finalFilePath,
        fileSize: stat.size,
        fileSizeFormatted: this.formatBytes(stat.size),
        createdAt: now,
        itemCount: fileCount,
        isVerified: true,
      };

      return { success: true, backup: item };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Compatibility wrapper for default single-click backup
   */
  async createBackup(label?: string): Promise<{ success: boolean; backup?: BackupItem; error?: string }> {
    return this.createZipBackup({
      backupType: 'zip',
      scope: 'all',
      includeConfig: true,
      label,
    });
  }

  private addFolderToZip(zip: JSZip, folderPath: string, zipPrefix: string): number {
    let count = 0;
    if (!fs.existsSync(folderPath)) return 0;

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      const zipPath = `${zipPrefix}/${entry.name}`;

      if (entry.isDirectory()) {
        count += this.addFolderToZip(zip, fullPath, zipPath);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          zip.file(zipPath, content);
          count++;
        } catch { }
      }
    }
    return count;
  }

  /**
   * Lists all available backups in the configured backup directory (.zip and .json).
   */
  listBackups(): BackupItem[] {
    const config = HenuConfigService.getInstance().getConfig();
    const backupDir = config.backupPath;
    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir).filter(f =>
      (f.endsWith('.zip') || f.endsWith('.json')) &&
      !f.startsWith('.tmp') &&
      (f.startsWith('HENU_BACKUP_') || f.startsWith('HENU_OS_RECMA_'))
    );
    const items: BackupItem[] = [];

    for (const file of files) {
      const fullPath = path.join(backupDir, file);
      try {
        const stat = fs.statSync(fullPath);
        items.push({
          id: `backup-${stat.mtimeMs}`,
          fileName: file,
          filePath: fullPath,
          fileSize: stat.size,
          fileSizeFormatted: this.formatBytes(stat.size),
          createdAt: stat.birthtime.toISOString() || stat.mtime.toISOString(),
          itemCount: 0,
          isVerified: stat.size > 50,
        });
      } catch { }
    }

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Inspects and validates a backup file before restoration.
   */
  async validateBackupFile(backupFilePath: string): Promise<BackupValidationResult> {
    const errors: string[] = [];
    if (!fs.existsSync(backupFilePath)) {
      return {
        isValid: false,
        backupType: 'UNKNOWN',
        backupDate: '',
        societies: [],
        filesCount: 0,
        fileSizeFormatted: '0 B',
        version: '',
        hasConfig: false,
        errors: ['Backup file does not exist.'],
      };
    }

    const stat = fs.statSync(backupFilePath);
    const sizeFormatted = this.formatBytes(stat.size);

    if (backupFilePath.endsWith('.json')) {
      try {
        const raw = fs.readFileSync(backupFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        const societies = Array.isArray(parsed.societies) ? parsed.societies.map((s: any) => s.society_name || s.societyName || 'Unnamed') : [];
        return {
          isValid: Boolean(parsed.backupVersion && parsed.createdAt),
          backupType: 'JSON',
          backupDate: parsed.createdAt || stat.mtime.toISOString(),
          societies,
          filesCount: (parsed.documents?.length || 0) + societies.length,
          fileSizeFormatted: sizeFormatted,
          version: String(parsed.backupVersion || '1.0'),
          hasConfig: Boolean(parsed.configuration || parsed.includeConfig),
          errors: [],
        };
      } catch (err: any) {
        return {
          isValid: false,
          backupType: 'JSON',
          backupDate: '',
          societies: [],
          filesCount: 0,
          fileSizeFormatted: sizeFormatted,
          version: '',
          hasConfig: false,
          errors: [`Invalid JSON backup file: ${err.message}`],
        };
      }
    }

    if (backupFilePath.endsWith('.zip')) {
      try {
        const zipData = fs.readFileSync(backupFilePath);
        const zip = await JSZip.loadAsync(zipData);
        let societies: string[] = [];
        let hasConfig = false;
        let manifest: any = null;

        const manifestFile = zip.file('backup-manifest.json');
        if (manifestFile) {
          const mText = await manifestFile.async('text');
          manifest = JSON.parse(mText);
          societies = manifest.includedSocieties || [];
          hasConfig = Boolean(manifest.includeConfig);
        } else {
          // Detect society folder names from zip entries
          const socSet = new Set<string>();
          for (const key of Object.keys(zip.files)) {
            if (key.startsWith('Societies/')) {
              const parts = key.split('/');
              if (parts.length > 1 && parts[1]) socSet.add(parts[1]);
            }
          }
          societies = Array.from(socSet);
        }

        const totalEntries = Object.keys(zip.files).filter(k => !zip.files[k].dir).length;

        return {
          isValid: totalEntries > 0,
          backupType: 'ZIP',
          backupDate: manifest?.createdAt || stat.mtime.toISOString(),
          societies,
          filesCount: totalEntries,
          fileSizeFormatted: sizeFormatted,
          version: manifest?.applicationVersion || '1.0.0',
          hasConfig: hasConfig || Boolean(zip.file('system/application_config.json')),
          errors,
        };
      } catch (err: any) {
        return {
          isValid: false,
          backupType: 'ZIP',
          backupDate: '',
          societies: [],
          filesCount: 0,
          fileSizeFormatted: sizeFormatted,
          version: '',
          hasConfig: false,
          errors: [`Invalid ZIP backup file: ${err.message}`],
        };
      }
    }

    return {
      isValid: false,
      backupType: 'UNKNOWN',
      backupDate: '',
      societies: [],
      filesCount: 0,
      fileSizeFormatted: sizeFormatted,
      version: '',
      hasConfig: false,
      errors: ['Unsupported backup format. Expected .zip or .json file.'],
    };
  }

  /**
   * Universal restore method handling both JSON and ZIP archives.
   */
  async restoreBackup(
    backupFilePath: string,
    options?: { replaceExisting?: boolean }
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const validation = await this.validateBackupFile(backupFilePath);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('; ') || 'Backup file validation failed.');
      }

      if (validation.backupType === 'JSON') {
        return this.restoreJsonBackup(backupFilePath, options);
      }

      return this.restoreZipBackup(backupFilePath, options);
    } catch (err: any) {
      return { success: false, message: 'Restore failed', error: err.message };
    }
  }

  private async restoreJsonBackup(
    backupFilePath: string,
    _options?: { replaceExisting?: boolean }
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const db = getDatabase();
    const raw = fs.readFileSync(backupFilePath, 'utf8');
    const parsed = JSON.parse(raw);

    const societies = Array.isArray(parsed.societies) ? parsed.societies : [];
    const documents = Array.isArray(parsed.documents) ? parsed.documents : [];

    for (const soc of societies) {
      if (!soc.id) continue;
      db.prepare(`
        INSERT OR REPLACE INTO societies
        (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, logo_base64, status, year_established, created_at, updated_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        soc.id,
        soc.society_name || soc.societyName,
        soc.registration_no || soc.registrationNo || '',
        soc.registration_date || soc.registrationDate || '',
        soc.full_address || soc.fullAddress || '',
        soc.city || '',
        soc.state || '',
        soc.pin_code || soc.pinCode || '',
        soc.logo_base64 || '',
        soc.status || 'ACTIVE',
        soc.year_established || '',
        soc.created_at || new Date().toISOString(),
        soc.updated_at || '',
        Number(soc.is_active) === 1 ? 1 : 0
      );
    }

    for (const doc of documents) {
      if (!doc.id) continue;
      db.prepare(`
        INSERT OR REPLACE INTO documents
        (id, society_id, category_id, file_name, file_path, file_type, file_size, version, checksum, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        doc.id,
        doc.society_id,
        doc.category_id,
        doc.file_name,
        doc.file_path,
        doc.file_type || 'application/pdf',
        doc.file_size || 0,
        doc.version || 1,
        doc.checksum || '',
        doc.status || 'ACTIVE',
        doc.created_at || new Date().toISOString(),
        doc.updated_at || new Date().toISOString()
      );
    }

    if (parsed.configuration) {
      HenuConfigService.getInstance().saveConfig(parsed.configuration);
    }

    return {
      success: true,
      message: `Restored ${societies.length} societies and ${documents.length} document records from JSON backup.`,
    };
  }

  private async restoreZipBackup(
    backupFilePath: string,
    _options?: { replaceExisting?: boolean }
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const zipData = fs.readFileSync(backupFilePath);
    const zip = await JSZip.loadAsync(zipData);

    const config = HenuConfigService.getInstance().getConfig();
    const societiesDir = config.societiesPath;
    let extractedCount = 0;

    for (const [relativePath, fileObj] of Object.entries(zip.files)) {
      if (fileObj.dir || relativePath === 'backup-manifest.json') continue;

      if (relativePath.startsWith('Societies/')) {
        const targetRel = relativePath.replace(/^Societies\//, '');
        const targetFullPath = path.join(societiesDir, targetRel);
        const dir = path.dirname(targetFullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const content = await fileObj.async('nodebuffer');
        fs.writeFileSync(targetFullPath, content);
        extractedCount++;
      } else if (relativePath === 'system/application_config.json') {
        try {
          const cfgText = await fileObj.async('text');
          const cfg = JSON.parse(cfgText);
          HenuConfigService.getInstance().saveConfig(cfg);
        } catch { }
      }
    }

    // Reconcile folders for all extracted societies
    try {
      const entries = fs.readdirSync(societiesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          StorageEngine.reconcileSocietyFolders(config.rootStoragePath, entry.name);
        }
      }
    } catch { }

    return {
      success: true,
      message: `Backup restored successfully. Extracted ${extractedCount} files into active storage.`,
    };
  }
}
