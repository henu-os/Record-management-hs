import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../db';
import { DocumentCategory, DocumentRecord, StorageOverview } from '../../types';
import { HenuConfigService } from './HenuConfigService';
import { StorageEngine } from './StorageEngine';

export class DocumentRoutingService {
  private static instance: DocumentRoutingService;

  static getInstance(): DocumentRoutingService {
    if (!DocumentRoutingService.instance) {
      DocumentRoutingService.instance = new DocumentRoutingService();
    }
    return DocumentRoutingService.instance;
  }

  // ── Document Category Management ──────────────────────────────

  getCategories(): DocumentCategory[] {
    const db = getDatabase();
    let rows = db.prepare('SELECT * FROM document_categories').all() as any[];

    if (!rows || rows.length === 0) {
      const defaultCats = [
        { id: 'cat-form-i', name: 'Form I', system_required: 1, active: 1, sort_order: 1 },
        { id: 'cat-form-j', name: 'Form J', system_required: 1, active: 1, sort_order: 2 },
        { id: 'cat-share-reg', name: 'Share Register', system_required: 1, active: 1, sort_order: 3 },
        { id: 'cat-prop-reg', name: 'Property Register', system_required: 1, active: 1, sort_order: 4 },
        { id: 'cat-nom-reg', name: 'Nomination Register', system_required: 1, active: 1, sort_order: 5 },
        { id: 'cat-bank-lien', name: 'Bank Lien Mark', system_required: 1, active: 1, sort_order: 6 },
        { id: 'cat-share-cert', name: 'Share Certificate', system_required: 1, active: 1, sort_order: 7 },
        { id: 'cat-ocr-voucher', name: 'HENU OCR/VOUCHER', system_required: 1, active: 1, sort_order: 8 },
        { id: 'cat-ocr-check', name: 'HENU OCR/CHECK', system_required: 1, active: 1, sort_order: 9 },
        { id: 'cat-voucher', name: 'Voucher', system_required: 1, active: 1, sort_order: 10 },
      ];
      const now = new Date().toISOString();
      for (const d of defaultCats) {
        db.prepare(`
          INSERT OR REPLACE INTO document_categories
          (id, name, system_required, active, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(d.id, d.name, d.system_required, d.active, d.sort_order, now, now);
      }
      rows = db.prepare('SELECT * FROM document_categories').all() as any[];
    }

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      systemRequired: Number(r.system_required) === 1,
      active: Number(r.active) !== 0,
      sortOrder: Number(r.sort_order) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  saveCategory(cat: Partial<DocumentCategory>): DocumentCategory {
    const db = getDatabase();
    const id = cat.id || `cat-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM document_categories WHERE id = ?').get(id) as any;
    const isSystem = existing ? Number(existing.system_required) === 1 : Boolean(cat.systemRequired);

    const updated: DocumentCategory = {
      id,
      name: (cat.name || 'Custom Category').trim(),
      systemRequired: isSystem,
      active: cat.active !== undefined ? cat.active : true,
      sortOrder: cat.sortOrder !== undefined ? cat.sortOrder : 99,
      createdAt: existing?.created_at || now,
      updatedAt: now,
    };

    db.prepare(`
      INSERT OR REPLACE INTO document_categories
      (id, name, system_required, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      updated.id,
      updated.name,
      updated.systemRequired ? 1 : 0,
      updated.active ? 1 : 0,
      updated.sortOrder,
      updated.createdAt,
      updated.updatedAt
    );

    return updated;
  }

  deleteCategory(id: string): { success: boolean; error?: string } {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM document_categories WHERE id = ?').get(id) as any;
    if (!existing) return { success: false, error: 'Category not found' };
    if (Number(existing.system_required) === 1) {
      return { success: false, error: 'System-required categories cannot be deleted.' };
    }

    db.prepare('DELETE FROM document_categories WHERE id = ?').run(id);
    return { success: true };
  }

  reorderCategories(orderedIds: string[]): DocumentCategory[] {
    const db = getDatabase();
    orderedIds.forEach((id, index) => {
      db.prepare('UPDATE document_categories SET sort_order = ? WHERE id = ?').run(index + 1, id);
    });
    return this.getCategories();
  }

  // ── Document Naming & Duplicate Resolution ───────────────────

  formatDocumentFileName(
    pattern: string,
    params: {
      societyName: string;
      categoryName: string;
      number?: string | number;
      date?: string;
      extension?: string;
    }
  ): string {
    const ext = (params.extension || 'pdf').replace(/^\./, '');
    const cleanSoc = StorageEngine.sanitizeFolderName(params.societyName || 'Society');
    const cleanCat = StorageEngine.sanitizeFolderName(params.categoryName || 'Document').replace(/\s+/g, '');
    const cleanNum = String(params.number || '001').padStart(3, '0');
    const cleanDate = params.date || new Date().toISOString().slice(0, 10);

    let result = pattern || '{SocietyName}_{Category}_{Number}_{Date}';
    result = result.replace(/{SocietyName}/g, cleanSoc);
    result = result.replace(/{Category}/g, cleanCat);
    result = result.replace(/{DocumentType}/g, cleanCat);
    result = result.replace(/{Number}/g, cleanNum);
    result = result.replace(/{Year}/g, cleanDate.slice(0, 4));
    result = result.replace(/{Date}/g, cleanDate);

    // Sanitize any remaining Windows illegal characters
    result = StorageEngine.sanitizeFolderName(result);
    return `${result}.${ext}`;
  }

  resolveDuplicatePath(
    targetDir: string,
    fileName: string,
    strategy: 'VERSION' | 'REPLACE' | 'RENAME_AUTO' | 'CANCEL'
  ): { resolvedPath: string; finalFileName: string; version: number; cancelled: boolean } {
    let finalFileName = fileName;
    let targetPath = path.join(targetDir, finalFileName);
    let version = 1;

    if (!fs.existsSync(targetPath)) {
      return { resolvedPath: targetPath, finalFileName, version: 1, cancelled: false };
    }

    if (strategy === 'CANCEL') {
      return { resolvedPath: targetPath, finalFileName, version: 1, cancelled: true };
    }

    if (strategy === 'REPLACE') {
      return { resolvedPath: targetPath, finalFileName, version: 1, cancelled: false };
    }

    // VERSION or RENAME_AUTO
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);

    while (fs.existsSync(targetPath)) {
      version++;
      if (strategy === 'VERSION') {
        finalFileName = `${baseName}_v${version}${ext}`;
      } else {
        finalFileName = `${baseName}_${Date.now()}${ext}`;
      }
      targetPath = path.join(targetDir, finalFileName);
    }

    return { resolvedPath: targetPath, finalFileName, version, cancelled: false };
  }

  // ── Automatic Routing & Document Registration ────────────────

  async routeAndRegisterDocument(params: {
    societyId: string;
    societyName: string;
    categoryNameOrId: string;
    buffer: Buffer;
    fileType?: string;
    serialNumber?: string | number;
    customFileName?: string;
  }): Promise<{ success: boolean; document?: DocumentRecord; error?: string }> {
    try {
      const config = HenuConfigService.getInstance().getConfig();
      const categories = this.getCategories();

      // Find matching category
      let category = categories.find(
        c => c.id === params.categoryNameOrId || c.name.toLowerCase() === params.categoryNameOrId.toLowerCase()
      );

      if (!category) {
        // Fallback to Voucher or Form I or create custom
        category = categories[0] || { id: 'cat-form-i', name: 'Form I', systemRequired: true, active: true, sortOrder: 1, createdAt: '', updatedAt: '' };
      }

      // Provision folder: Root/Societies/{SocietyName}/{CategoryName}/
      const rootPath = config.rootStoragePath;
      const { createdCategories } = StorageEngine.createSocietyFolders(rootPath, params.societyName, [category.name]);
      const targetDir = createdCategories[category.name] || path.join(rootPath, 'Societies', StorageEngine.sanitizeFolderName(params.societyName), StorageEngine.sanitizeFolderName(category.name));

      // Calculate file name
      const ext = (params.fileType || 'pdf').toLowerCase().replace('application/', '');
      const desiredFileName = params.customFileName || this.formatDocumentFileName(config.fileNamingPattern, {
        societyName: params.societyName,
        categoryName: category.name,
        number: params.serialNumber || '001',
        extension: ext,
      });

      // Duplicate handling
      const { resolvedPath, finalFileName, version, cancelled } = this.resolveDuplicatePath(
        targetDir,
        desiredFileName,
        config.duplicateStrategy || 'VERSION'
      );

      if (cancelled) {
        return { success: false, error: 'Document save cancelled by duplicate strategy.' };
      }

      // Physical File Save
      fs.writeFileSync(resolvedPath, params.buffer);

      // Verify physical save
      if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size === 0) {
        throw new Error(`Physical file save failed at: ${resolvedPath}`);
      }

      const stat = fs.statSync(resolvedPath);
      const checksum = crypto.createHash('sha256').update(params.buffer).digest('hex').substring(0, 16);
      const docId = uuidv4();
      const now = new Date().toISOString();

      const docRecord: DocumentRecord = {
        id: docId,
        societyId: params.societyId,
        societyName: params.societyName,
        categoryId: category.id,
        categoryName: category.name,
        fileName: finalFileName,
        filePath: resolvedPath,
        fileType: ext.toUpperCase(),
        fileSize: stat.size,
        version,
        checksum,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };

      // Register in Database
      const db = getDatabase();
      db.prepare(`
        INSERT OR REPLACE INTO documents
        (id, society_id, category_id, file_name, file_path, file_type, file_size, version, checksum, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        docRecord.id,
        docRecord.societyId,
        docRecord.categoryId,
        docRecord.fileName,
        docRecord.filePath,
        docRecord.fileType,
        docRecord.fileSize,
        docRecord.version,
        docRecord.checksum,
        docRecord.status,
        docRecord.createdAt,
        docRecord.updatedAt
      );

      return { success: true, document: docRecord };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── File Index & Storage Tree Overview ───────────────────────

  getDocuments(filter?: { societyId?: string; categoryId?: string; search?: string }): DocumentRecord[] {
    const db = getDatabase();
    let docs: any[] = [];

    if (filter?.societyId && filter?.categoryId) {
      docs = db.prepare('SELECT * FROM documents WHERE society_id = ? AND category_id = ?').all(filter.societyId, filter.categoryId) as any[];
    } else if (filter?.societyId) {
      docs = db.prepare('SELECT * FROM documents WHERE society_id = ?').all(filter.societyId) as any[];
    } else {
      docs = db.prepare('SELECT * FROM documents').all() as any[];
    }

    const categories = this.getCategories();
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    const societies = (db.prepare('SELECT id, society_name FROM societies').all() as any[]) || [];
    const socMap = new Map(societies.map(s => [s.id, s.society_name]));

    let results: DocumentRecord[] = docs.map(d => ({
      id: d.id,
      societyId: d.society_id,
      societyName: socMap.get(d.society_id) || 'Unknown Society',
      categoryId: d.category_id,
      categoryName: catMap.get(d.category_id) || 'General',
      fileName: d.file_name,
      filePath: d.file_path,
      fileType: d.file_type,
      fileSize: Number(d.file_size) || 0,
      version: Number(d.version) || 1,
      checksum: d.checksum,
      status: d.status || 'ACTIVE',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      results = results.filter(d =>
        d.fileName.toLowerCase().includes(q) ||
        (d.societyName && d.societyName.toLowerCase().includes(q)) ||
        (d.categoryName && d.categoryName.toLowerCase().includes(q))
      );
    }

    return results;
  }

  getStorageOverview(): StorageOverview {
    const config = HenuConfigService.getInstance().getConfig();
    const categories = this.getCategories();
    const allDocs = this.getDocuments();
    const db = getDatabase();
    const societies = (db.prepare('SELECT * FROM societies').all() as any[]) || [];

    const totalStorageSizeBytes = allDocs.reduce((sum, d) => sum + (d.fileSize || 0), 0);
    const totalStorageSizeFormatted = (totalStorageSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';

    const categoriesOverview = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      documentCount: allDocs.filter(d => d.categoryId === cat.id).length,
      systemRequired: cat.systemRequired,
      active: cat.active,
    }));

    const societiesTree = societies.map(soc => {
      const safeName = StorageEngine.sanitizeFolderName(soc.society_name || 'Society');
      const socPath = path.join(config.societiesPath, safeName);
      const socDocs = allDocs.filter(d => d.societyId === soc.id);

      const catTree = categories.map(cat => {
        const catDocs = socDocs.filter(d => d.categoryId === cat.id);
        const catPath = path.join(socPath, StorageEngine.sanitizeFolderName(cat.name));
        return {
          id: cat.id,
          name: cat.name,
          path: catPath,
          fileCount: catDocs.length,
          files: catDocs,
        };
      });

      return {
        id: soc.id,
        name: soc.society_name,
        folderName: safeName,
        path: socPath,
        categories: catTree,
      };
    });

    return {
      rootStoragePath: config.rootStoragePath,
      totalSocieties: societies.length,
      totalDocuments: allDocs.length,
      totalStorageSizeBytes,
      totalStorageSizeFormatted,
      categories: categoriesOverview,
      societiesTree,
    };
  }
}
