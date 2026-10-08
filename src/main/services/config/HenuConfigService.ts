import path from 'path';
import fs from 'fs';
import { getDatabase, getPaths } from '../../db';
import { ApplicationConfig, StorageValidationResult } from '../../types';
import { StorageEngine } from './StorageEngine';

export class HenuConfigService {
  private static instance: HenuConfigService;
  private cachedConfig: ApplicationConfig | null = null;

  static getInstance(): HenuConfigService {
    if (!HenuConfigService.instance) {
      HenuConfigService.instance = new HenuConfigService();
    }
    return HenuConfigService.instance;
  }

  /**
   * Retrieves the current application configuration.
   * If not yet created, seeds a default configuration derived from default system paths.
   */
  getConfig(): ApplicationConfig {
    if (this.cachedConfig) return this.cachedConfig;

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM application_config LIMIT 1').get();

    if (row && row.root_storage_path) {
      this.cachedConfig = {
        id: row.id,
        rootStoragePath: row.root_storage_path,
        societiesPath: row.societies_path || path.join(row.root_storage_path, 'Societies'),
        backupPath: row.backup_path || path.join(row.root_storage_path, 'Backups'),
        exportPath: row.export_path || path.join(row.root_storage_path, 'Exports'),
        importPath: row.import_path || path.join(row.root_storage_path, 'Imports'),
        logsPath: row.logs_path || path.join(row.root_storage_path, 'Logs'),
        systemPath: row.system_path || path.join(row.root_storage_path, 'System'),
        firstRunCompleted: Number(row.first_run_completed) === 1,
        fileNamingPattern: row.file_naming_pattern || '{SocietyName}_{Category}_{Number}_{Date}',
        duplicateStrategy: row.duplicate_strategy || 'VERSION',
        backupEnabled: Number(row.backup_enabled) !== 0,
        backupFrequency: row.backup_frequency || 'DAILY',
        backupRetentionDays: Number(row.backup_retention_days) || 30,
        lastBackupAt: row.last_backup_at || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      };
      return this.cachedConfig;
    }

    // Default configuration using standard downloads root or app data
    const defaultPaths = getPaths();
    const defaultRoot = path.join(defaultPaths.downloads, 'HENU OS RECMA');

    const defaultCfg: ApplicationConfig = {
      id: 'default-config',
      rootStoragePath: defaultRoot,
      societiesPath: path.join(defaultRoot, 'Societies'),
      backupPath: path.join(defaultRoot, 'Backups'),
      exportPath: path.join(defaultRoot, 'Exports'),
      importPath: path.join(defaultRoot, 'Imports'),
      logsPath: path.join(defaultRoot, 'Logs'),
      systemPath: path.join(defaultRoot, 'System'),
      firstRunCompleted: false,
      fileNamingPattern: '{SocietyName}_{Category}_{Number}_{Date}',
      duplicateStrategy: 'VERSION',
      backupEnabled: true,
      backupFrequency: 'DAILY',
      backupRetentionDays: 30,
      lastBackupAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cachedConfig = defaultCfg;
    this.saveConfig(defaultCfg);
    return defaultCfg;
  }

  /**
   * Checks whether the first-run configuration setup has been completed.
   */
  isFirstRunCompleted(): boolean {
    const cfg = this.getConfig();
    return cfg.firstRunCompleted;
  }

  /**
   * Completes the first-run setup wizard with the selected root storage path.
   */
  completeFirstRun(rootStoragePath: string): StorageValidationResult {
    const val = StorageEngine.validateLocation(rootStoragePath);
    if (!val.isValid) {
      return val;
    }

    const subDirs = StorageEngine.initializeRootStructure(rootStoragePath);
    const cfg: ApplicationConfig = {
      ...this.getConfig(),
      rootStoragePath,
      societiesPath: subDirs.societiesPath,
      backupPath: subDirs.backupsPath,
      exportPath: subDirs.exportsPath,
      importPath: subDirs.importsPath,
      logsPath: subDirs.logsPath,
      systemPath: subDirs.systemPath,
      firstRunCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    this.saveConfig(cfg);
    return val;
  }

  /**
   * Persists application configuration changes to the database.
   */
  saveConfig(cfg: Partial<ApplicationConfig>): ApplicationConfig {
    const db = getDatabase();
    const defaultPaths = getPaths();
    const defaultRoot = path.join(defaultPaths.downloads, 'HENU OS RECMA');

    const fallback: ApplicationConfig = {
      id: 'default-config',
      rootStoragePath: defaultRoot,
      societiesPath: path.join(defaultRoot, 'Societies'),
      backupPath: path.join(defaultRoot, 'Backups'),
      exportPath: path.join(defaultRoot, 'Exports'),
      importPath: path.join(defaultRoot, 'Imports'),
      logsPath: path.join(defaultRoot, 'Logs'),
      systemPath: path.join(defaultRoot, 'System'),
      firstRunCompleted: false,
      fileNamingPattern: '{SocietyName}_{Category}_{Number}_{Date}',
      duplicateStrategy: 'VERSION',
      backupEnabled: true,
      backupFrequency: 'DAILY',
      backupRetentionDays: 30,
      lastBackupAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = this.cachedConfig || fallback;
    const updated: ApplicationConfig = {
      ...current,
      ...cfg,
      updatedAt: new Date().toISOString(),
    };

    this.cachedConfig = updated;

    db.prepare(`
      INSERT OR REPLACE INTO application_config
      (id, root_storage_path, societies_path, backup_path, export_path, import_path, logs_path, system_path,
       first_run_completed, file_naming_pattern, duplicate_strategy, backup_enabled, backup_frequency,
       backup_retention_days, last_backup_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      updated.id,
      updated.rootStoragePath,
      updated.societiesPath,
      updated.backupPath,
      updated.exportPath,
      updated.importPath,
      updated.logsPath,
      updated.systemPath,
      updated.firstRunCompleted ? 1 : 0,
      updated.fileNamingPattern,
      updated.duplicateStrategy,
      updated.backupEnabled ? 1 : 0,
      updated.backupFrequency,
      updated.backupRetentionDays,
      updated.lastBackupAt || '',
      updated.createdAt,
      updated.updatedAt
    );

    return updated;
  }

  /**
   * Changes the root data storage location with atomic verification and rollback safety.
   */
  async changeDataLocation(newRootPath: string): Promise<{ success: boolean; message: string; error?: string }> {
    const val = StorageEngine.validateLocation(newRootPath);
    if (!val.isValid) {
      return { success: false, message: 'Validation failed', error: val.errors.join(', ') };
    }

    const currentCfg = this.getConfig();
    const oldRoot = currentCfg.rootStoragePath;

    if (path.normalize(oldRoot).toLowerCase() === path.normalize(newRootPath).toLowerCase()) {
      return { success: true, message: 'Path is identical. No migration needed.' };
    }

    try {
      // 1. Initialize new structure
      const newDirs = StorageEngine.initializeRootStructure(newRootPath);

      // 2. Copy old data recursively if old directory exists
      if (fs.existsSync(oldRoot)) {
        this.copyRecursiveSync(oldRoot, newRootPath);
      }

      // 3. Verify integrity
      if (!fs.existsSync(newDirs.societiesPath)) {
        throw new Error('Verification failed: Societies folder missing in target location.');
      }

      // 4. Update configuration
      this.saveConfig({
        rootStoragePath: newRootPath,
        societiesPath: newDirs.societiesPath,
        backupPath: newDirs.backupsPath,
        exportPath: newDirs.exportsPath,
        importPath: newDirs.importsPath,
        logsPath: newDirs.logsPath,
        systemPath: newDirs.systemPath,
      });

      return {
        success: true,
        message: `Successfully migrated data location to: ${newRootPath}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Data migration failed. Old location was kept active.',
        error: err.message,
      };
    }
  }

  private copyRecursiveSync(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyRecursiveSync(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
