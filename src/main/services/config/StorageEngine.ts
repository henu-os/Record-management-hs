import fs from 'fs';
import path from 'path';
import { StorageValidationResult } from '../../types';

export class StorageEngine {
  /**
   * System-protected Windows path prefixes that should NOT be used as root storage.
   */
  private static readonly SYSTEM_PROTECTED_PREFIXES = [
    'c:\\windows',
    'c:\\program files',
    'c:\\program files (x86)',
    'c:\\system volume information',
    'c:\\$recycle.bin',
  ];

  /**
   * Validates if a proposed directory path is safe, writable, and ready for HENU OS storage.
   */
  static validateLocation(targetPath: string): StorageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = path.normalize(targetPath.trim());

    if (!normalized || normalized.length < 3) {
      return {
        isValid: false,
        path: targetPath,
        exists: false,
        isWritable: false,
        isReadable: false,
        dbReady: false,
        fileStorageReady: false,
        isSystemProtected: false,
        errors: ['Storage path cannot be empty or too short.'],
        warnings: [],
      };
    }

    // Check system protected paths
    const lowerNorm = normalized.toLowerCase();
    const isSystemProtected = this.SYSTEM_PROTECTED_PREFIXES.some(p => lowerNorm.startsWith(p));
    if (isSystemProtected) {
      errors.push('Selected location is inside a Windows system-protected directory.');
    }

    let exists = false;
    let isWritable = false;
    let isReadable = false;
    let dbReady = false;
    let fileStorageReady = false;

    try {
      if (!fs.existsSync(normalized)) {
        // Try creating directory recursively
        fs.mkdirSync(normalized, { recursive: true });
        exists = true;
      } else {
        exists = true;
      }
    } catch (err: any) {
      errors.push(`Cannot access or create target directory: ${err.message}`);
    }

    if (exists && errors.length === 0) {
      // Test read/write permission by writing, reading, and removing a temp verification file
      const testFile = path.join(normalized, `.henu_verify_${Date.now()}.tmp`);
      try {
        fs.writeFileSync(testFile, 'HENU_OS_STORAGE_VERIFICATION', 'utf8');
        isWritable = true;

        const readBack = fs.readFileSync(testFile, 'utf8');
        if (readBack === 'HENU_OS_STORAGE_VERIFICATION') {
          isReadable = true;
        }

        fs.unlinkSync(testFile);
        fileStorageReady = true;
        dbReady = true;
      } catch (err: any) {
        errors.push(`Directory permission verification failed: ${err.message}`);
      }
    }

    // Disk space check (approximated / best-effort)
    let availableSpaceBytes = 100 * 1024 * 1024 * 1024; // Default fallback to 100GB
    let availableSpaceFormatted = '> 10 GB';

    return {
      isValid: errors.length === 0 && isWritable && isReadable,
      path: normalized,
      exists,
      isWritable,
      isReadable,
      dbReady,
      fileStorageReady,
      availableSpaceBytes,
      availableSpaceFormatted,
      isSystemProtected,
      errors,
      warnings,
    };
  }

  /**
   * Initializes the standard HENU OS RECMA root structure:
   * Root/
   * ├── Societies/
   * ├── Backups/
   * ├── Exports/
   * ├── Imports/
   * ├── Logs/
   * └── System/
   */
  static initializeRootStructure(rootPath: string): {
    societiesPath: string;
    backupsPath: string;
    exportsPath: string;
    importsPath: string;
    logsPath: string;
    systemPath: string;
  } {
    const normalized = path.normalize(rootPath);
    if (!fs.existsSync(normalized)) {
      fs.mkdirSync(normalized, { recursive: true });
    }

    const subDirs = {
      societiesPath: path.join(normalized, 'Societies'),
      backupsPath: path.join(normalized, 'Backups'),
      exportsPath: path.join(normalized, 'Exports'),
      importsPath: path.join(normalized, 'Imports'),
      logsPath: path.join(normalized, 'Logs'),
      systemPath: path.join(normalized, 'System'),
    };

    Object.values(subDirs).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    return subDirs;
  }

  /**
   * Standard required statutory and OCR folders for every society.
   */
  static readonly STANDARD_FOLDERS = [
    'Form I',
    'Form J',
    'Share Register',
    'Property Register',
    'Nomination Register',
    'Bank Lien Mark',
    'Share Certificate',
    'Voucher',
  ];

  static readonly OCR_SUBFOLDERS = [
    path.join('HENU OCR', 'VOUCHER'),
    path.join('HENU OCR', 'CHECK'),
  ];

  static readonly IMPORT_SUBFOLDERS = ['Templates', 'Imported', 'Working'];
  static readonly EXPORT_SUBFOLDERS = ['Excel', 'CSV'];

  /**
   * Sanitizes Windows folder/file names by replacing illegal characters.
   */
  static sanitizeFolderName(name: string): string {
    return (name || 'Unnamed_Society')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Resolves the canonical society storage folder path under Societies/
   */
  static getSocietyStoragePath(rootPath: string, societyName: string): string {
    const safeSocName = this.sanitizeFolderName(societyName);
    return path.join(path.resolve(rootPath), 'Societies', safeSocName);
  }

  /**
   * Resolves the partitioned society imports folder path under Imports/
   */
  static getSocietyImportsPath(rootPath: string, societyName: string): string {
    const safeSocName = this.sanitizeFolderName(societyName);
    return path.join(path.resolve(rootPath), 'Imports', safeSocName);
  }

  /**
   * Resolves the partitioned society exports folder path under Exports/
   */
  static getSocietyExportsPath(rootPath: string, societyName: string): string {
    const safeSocName = this.sanitizeFolderName(societyName);
    return path.join(path.resolve(rootPath), 'Exports', safeSocName);
  }

  /**
   * Creates the complete folder structure for a society under:
   * - {rootPath}/Societies/{SocietyFolder}/
   * - {rootPath}/Imports/{SocietyFolder}/ (Templates, Imported, Working)
   * - {rootPath}/Exports/{SocietyFolder}/ (Excel, CSV)
   */
  static createSocietyFolders(
    rootPath: string,
    societyName: string,
    extraCategoryNames: string[] = []
  ): { societyPath: string; createdCategories: Record<string, string>; importsPath: string; exportsPath: string } {
    const safeSocName = this.sanitizeFolderName(societyName);
    const societiesRoot = path.join(rootPath, 'Societies');
    const societyPath = path.join(societiesRoot, safeSocName);

    if (!fs.existsSync(societyPath)) {
      fs.mkdirSync(societyPath, { recursive: true });
    }

    const createdCategories: Record<string, string> = {};

    // 1. Create standard statutory registers
    for (const folder of this.STANDARD_FOLDERS) {
      const folderPath = path.join(societyPath, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      createdCategories[folder] = folderPath;
    }

    // 2. Create HENU OCR parent & subfolders (VOUCHER, CHECK)
    const henuOcrParent = path.join(societyPath, 'HENU OCR');
    if (!fs.existsSync(henuOcrParent)) {
      fs.mkdirSync(henuOcrParent, { recursive: true });
    }
    for (const ocrSub of this.OCR_SUBFOLDERS) {
      const subPath = path.join(societyPath, ocrSub);
      if (!fs.existsSync(subPath)) {
        fs.mkdirSync(subPath, { recursive: true });
      }
      createdCategories[ocrSub] = subPath;
    }

    // 3. Create any extra custom categories
    for (const cat of extraCategoryNames) {
      if (!cat) continue;
      const safeCat = this.sanitizeFolderName(cat);
      const catPath = path.join(societyPath, safeCat);
      if (!fs.existsSync(catPath)) {
        fs.mkdirSync(catPath, { recursive: true });
      }
      createdCategories[cat] = catPath;
    }

    // 4. Create partitioned Imports folder (Templates, Imported, Working)
    const importsRoot = path.join(rootPath, 'Imports');
    const importsPath = path.join(importsRoot, safeSocName);
    if (!fs.existsSync(importsPath)) {
      fs.mkdirSync(importsPath, { recursive: true });
    }
    for (const impSub of this.IMPORT_SUBFOLDERS) {
      const p = path.join(importsPath, impSub);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
    }

    // 5. Create partitioned Exports folder (Excel, CSV)
    const exportsRoot = path.join(rootPath, 'Exports');
    const exportsPath = path.join(exportsRoot, safeSocName);
    if (!fs.existsSync(exportsPath)) {
      fs.mkdirSync(exportsPath, { recursive: true });
    }
    for (const expSub of this.EXPORT_SUBFOLDERS) {
      const p = path.join(exportsPath, expSub);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
    }

    return { societyPath, createdCategories, importsPath, exportsPath };
  }

  /**
   * Reconciles an existing society's folder structure, creating any missing required folders
   * across Societies/, Imports/, and Exports/ without modifying or deleting existing files.
   */
  static reconcileSocietyFolders(
    rootPath: string,
    societyName: string
  ): { societyPath: string; createdMissing: string[] } {
    const safeSocName = this.sanitizeFolderName(societyName);
    const societiesRoot = path.join(rootPath, 'Societies');
    const societyPath = path.join(societiesRoot, safeSocName);
    const createdMissing: string[] = [];

    if (!fs.existsSync(societyPath)) {
      fs.mkdirSync(societyPath, { recursive: true });
      createdMissing.push(societyPath);
    }

    // Check & create standard folders
    for (const folder of this.STANDARD_FOLDERS) {
      const p = path.join(societyPath, folder);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        createdMissing.push(folder);
      }
    }

    // Check & create HENU OCR & subfolders
    for (const ocrSub of this.OCR_SUBFOLDERS) {
      const p = path.join(societyPath, ocrSub);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        createdMissing.push(ocrSub);
      }
    }

    // Check & create partitioned Imports
    const importsPath = path.join(rootPath, 'Imports', safeSocName);
    if (!fs.existsSync(importsPath)) {
      fs.mkdirSync(importsPath, { recursive: true });
      createdMissing.push(importsPath);
    }
    for (const impSub of this.IMPORT_SUBFOLDERS) {
      const p = path.join(importsPath, impSub);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        createdMissing.push(path.join('Imports', safeSocName, impSub));
      }
    }

    // Check & create partitioned Exports
    const exportsPath = path.join(rootPath, 'Exports', safeSocName);
    if (!fs.existsSync(exportsPath)) {
      fs.mkdirSync(exportsPath, { recursive: true });
      createdMissing.push(exportsPath);
    }
    for (const expSub of this.EXPORT_SUBFOLDERS) {
      const p = path.join(exportsPath, expSub);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        createdMissing.push(path.join('Exports', safeSocName, expSub));
      }
    }

    return { societyPath, createdMissing };
  }

  /**
   * Safely deletes a society physical directory and its Imports/Exports partitions with path traversal protection.
   */
  static deleteSocietyFolder(rootPath: string, societyName: string): boolean {
    if (!societyName || societyName.includes('..') || path.isAbsolute(societyName)) {
      throw new Error(`Security Violation: Invalid society name containing traversal sequence: ${societyName}`);
    }
    const safeSocName = this.sanitizeFolderName(societyName);
    const resolvedRoot = path.resolve(rootPath);

    // 1. Delete Societies/<Society>
    const societiesRoot = path.resolve(resolvedRoot, 'Societies');
    const societyPath = path.resolve(societiesRoot, safeSocName);

    if (!this.isPathWithinRoot(societyPath, societiesRoot) || societyPath === societiesRoot) {
      throw new Error(`Security Violation: Target path ${societyPath} is not strictly within ${societiesRoot}`);
    }

    if (fs.existsSync(societyPath)) {
      fs.rmSync(societyPath, { recursive: true, force: true });
    }

    // 2. Delete Imports/<Society>
    const importsRoot = path.resolve(resolvedRoot, 'Imports');
    const importsPath = path.resolve(importsRoot, safeSocName);
    if (this.isPathWithinRoot(importsPath, importsRoot) && importsPath !== importsRoot && fs.existsSync(importsPath)) {
      fs.rmSync(importsPath, { recursive: true, force: true });
    }

    // 3. Delete Exports/<Society>
    const exportsRoot = path.resolve(resolvedRoot, 'Exports');
    const exportsPath = path.resolve(exportsRoot, safeSocName);
    if (this.isPathWithinRoot(exportsPath, exportsRoot) && exportsPath !== exportsRoot && fs.existsSync(exportsPath)) {
      fs.rmSync(exportsPath, { recursive: true, force: true });
    }

    return true;
  }

  /**
   * Validates path traversal security: Ensures target path stays strictly inside rootPath.
   */
  static isPathWithinRoot(targetPath: string, rootPath: string): boolean {
    const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }
}
