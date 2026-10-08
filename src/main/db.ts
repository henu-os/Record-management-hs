import path from 'path';
import fs from 'fs';

let app: any;
try {
  app = require('electron').app;
} catch {
  app = undefined;
}

export class JsonDatabaseAdapter {
  private filePath: string;
  private data: {
    settings: Record<string, any>;
    societies: any[];
    master_data_sessions: any[];
    generation_history: any[];
    app_logs: any[];
    schema_migrations: any[];
    application_config: Record<string, any>;
    document_categories: any[];
    documents: any[];
    society_folders: any[];
    imports: any[];
    exports: any[];
    template_history: any[];
  };

  constructor(dbFilePath: string) {
    this.filePath = dbFilePath.replace(/\.db$/, '-store.json');
    this.data = {
      settings: {},
      societies: [],
      master_data_sessions: [],
      generation_history: [],
      app_logs: [],
      schema_migrations: [],
      application_config: {},
      document_categories: [],
      documents: [],
      society_folders: [],
      imports: [],
      exports: [],
      template_history: [],
    };
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };

        if (!this.data.application_config) this.data.application_config = {};
        if (!Array.isArray(this.data.document_categories)) this.data.document_categories = [];
        if (!Array.isArray(this.data.documents)) this.data.documents = [];
        if (!Array.isArray(this.data.society_folders)) this.data.society_folders = [];
        if (!Array.isArray(this.data.imports)) this.data.imports = [];
        if (!Array.isArray(this.data.exports)) this.data.exports = [];
        if (!Array.isArray(this.data.template_history)) this.data.template_history = [];

        // Ensure default document categories exist
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

        if (this.data.document_categories.length === 0) {
          const now = new Date().toISOString();
          this.data.document_categories = defaultCats.map(c => ({
            ...c,
            created_at: now,
            updated_at: now,
          }));
        } else {
          // Guarantee all system required categories exist
          const existingNames = new Set(this.data.document_categories.map(c => String(c.name).toLowerCase()));
          const now = new Date().toISOString();
          for (const d of defaultCats) {
            if (!existingNames.has(d.name.toLowerCase())) {
              this.data.document_categories.push({
                ...d,
                created_at: now,
                updated_at: now,
              });
            }
          }
        }
        // Clean up and heal corrupt society records
        if (Array.isArray(this.data.societies)) {
          this.data.societies = this.data.societies
            .filter(s => s && s.society_name && !/^\d{4}-\d{2}-\d{2}T/.test(s.society_name))
            .map(s => {
              // If logo was accidentally saved in created_at:
              let logo = s.logo_base64 || '';
              let createdAt = s.created_at || '';
              if (typeof createdAt === 'string' && createdAt.startsWith('data:image/')) {
                logo = createdAt;
                createdAt = new Date().toISOString();
              }
              return {
                ...s,
                logo_base64: logo,
                created_at: createdAt || new Date().toISOString(),
                is_active: Number(s.is_active) === 1 ? 1 : 0,
              };
            });

          // Ensure exactly one active society exists if any societies exist
          const hasActive = this.data.societies.some(s => s.is_active === 1);
          if (!hasActive && this.data.societies.length > 0) {
            this.data.societies[0].is_active = 1;
          }
          this.save();
        }
      } else {
        // Genuinely fresh first installation only
        this.data.societies = [{
          id: 'default-society-1',
          society_name: 'HENU OS PRIVATE LIMITED',
          registration_no: 'U62099RJ2025PTC109150',
          registration_date: '02/12/2025',
          full_address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home',
          city: 'Pali',
          state: 'Rajasthan',
          pin_code: '306401',
          logo_base64: '',
          created_at: new Date().toISOString(),
          is_active: 1,
        }];
        this.save();
      }
    } catch {}
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {}
  }

  pragma() { return []; }
  exec(_sql: string) {}

  transaction(fn: any) {
    return (...args: any[]) => fn(...args);
  }

  prepare(sql: string) {
    const s = sql.trim();
    const self = this;

    return {
      run(...params: any[]) {
        // Settings
        if (/INSERT OR (REPLACE|IGNORE) INTO settings/i.test(s) || /INSERT INTO settings/i.test(s)) {
          if (params.length >= 2) {
            self.data.settings[params[0]] = params[1];
            self.save();
          }
          return { changes: 1 };
        }
        if (/UPDATE\s+settings\s+SET\s+value\s*=\s*\?\s+WHERE\s+key\s*=/i.test(s)) {
          if (params.length >= 2) {
            self.data.settings[params[1]] = params[0];
            self.save();
          }
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+settings\s+WHERE\s+key\s+LIKE/i.test(s)) {
          const pattern = String(params[0] || '').replace(/%/g, '');
          Object.keys(self.data.settings).forEach(k => {
            if (k.startsWith(pattern)) delete self.data.settings[k];
          });
          self.save();
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+settings\s+WHERE\s+key\s*=/i.test(s)) {
          if (params.length > 0) {
            delete self.data.settings[params[0]];
            self.save();
          }
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+settings$/i.test(s)) {
          self.data.settings = {};
          self.save();
          return { changes: 1 };
        }

        // Societies
        if (/INSERT INTO societies/i.test(s) || /INSERT OR IGNORE INTO societies/i.test(s)) {
          let logo_base64 = '';
          let created_at = new Date().toISOString();
          let is_active = 1;

          if (params.length >= 10) {
            logo_base64 = params[8] || '';
            created_at = params[9] || new Date().toISOString();
            is_active = params[10] !== undefined ? Number(params[10]) : 1;
            // Detect if params[8] is ISO date
            if (typeof params[8] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(params[8])) {
              created_at = params[8];
              logo_base64 = params[10] || '';
              is_active = params[9] !== undefined ? Number(params[9]) : 1;
            }
          } else {
            created_at = params[8] || new Date().toISOString();
            is_active = params[9] !== undefined ? Number(params[9]) : 1;
            logo_base64 = params[10] || '';
          }

          const soc: any = {
            id: params[0],
            society_name: params[1],
            registration_no: params[2] || '',
            registration_date: params[3] || '',
            full_address: params[4] || '',
            city: params[5] || '',
            state: params[6] || '',
            pin_code: params[7] || '',
            logo_base64: logo_base64,
            created_at: created_at,
            is_active: Number(is_active) === 1 ? 1 : 0,
          };
          const idx = self.data.societies.findIndex(x => String(x.id).trim() === String(soc.id).trim());
          if (idx >= 0) self.data.societies[idx] = soc;
          else self.data.societies.push(soc);
          self.save();
          return { changes: 1 };
        }
        if (/UPDATE\s+societies\s+SET\s+is_active\s*=\s*0/i.test(s)) {
          self.data.societies.forEach(x => { x.is_active = 0; });
          self.save();
          return { changes: 1 };
        }
        if (/UPDATE\s+societies\s+SET\s+is_active\s*=\s*1\s+WHERE\s+id\s*=/i.test(s)) {
          self.data.societies.forEach(x => {
            x.is_active = (String(x.id).trim() === String(params[0]).trim() ? 1 : 0);
          });
          self.save();
          return { changes: 1 };
        }
        if (/UPDATE\s+societies\s+SET\s+status\s*=\s*\?\s+WHERE\s+id\s*=/i.test(s)) {
          const idx = self.data.societies.findIndex(x => String(x.id).trim() === String(params[1]).trim());
          if (idx >= 0) {
            self.data.societies[idx].status = params[0] || 'ACTIVE';
            self.data.societies[idx].updated_at = new Date().toISOString();
            self.save();
          }
          return { changes: 1 };
        }
        if (/UPDATE\s+societies\s+SET\s+society_name\s*=/i.test(s)) {
          const socId = String(params[params.length - 1]).trim();
          const idx = self.data.societies.findIndex(x => String(x.id).trim() === socId);
          if (idx >= 0) {
            self.data.societies[idx].society_name = params[0] ?? self.data.societies[idx].society_name;
            self.data.societies[idx].registration_no = params[1] ?? self.data.societies[idx].registration_no;
            self.data.societies[idx].registration_date = params[2] ?? self.data.societies[idx].registration_date;
            self.data.societies[idx].full_address = params[3] ?? self.data.societies[idx].full_address;
            self.data.societies[idx].city = params[4] ?? self.data.societies[idx].city;
            self.data.societies[idx].state = params[5] ?? self.data.societies[idx].state;
            self.data.societies[idx].pin_code = params[6] ?? self.data.societies[idx].pin_code;
            if (params.length >= 9) {
              self.data.societies[idx].year_established = params[7] ?? self.data.societies[idx].year_established;
              self.data.societies[idx].updated_at = new Date().toISOString();
            }
            self.save();
          }
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+societies\s+WHERE\s+id\s*=/i.test(s)) {
          const socId = String(params[0]).trim();
          self.data.societies = self.data.societies.filter(x => String(x.id).trim() !== socId);
          self.data.master_data_sessions = self.data.master_data_sessions.filter(x => String(x.society_id).trim() !== socId);
          self.data.generation_history = self.data.generation_history.filter(x => String(x.society_id).trim() !== socId);
          self.data.documents = self.data.documents.filter(x => String(x.society_id).trim() !== socId);
          self.data.society_folders = self.data.society_folders.filter(x => String(x.society_id).trim() !== socId);
          self.data.imports = self.data.imports.filter(x => String(x.society_id).trim() !== socId);
          self.data.exports = self.data.exports.filter(x => String(x.society_id).trim() !== socId);
          self.data.template_history = self.data.template_history.filter(x => String(x.society_id).trim() !== socId);
          self.save();
          return { changes: 1 };
        }

        // Master Data Sessions
        if (/UPDATE\s+master_data_sessions\s+SET\s+is_active\s*=\s*0/i.test(s)) {
          self.data.master_data_sessions.forEach(x => {
            if (!params[0] || x.society_id === params[0]) x.is_active = 0;
          });
          self.save();
          return { changes: 1 };
        }
        if (/INSERT INTO master_data_sessions/i.test(s)) {
          const session = {
            id: params[0],
            society_id: params[1],
            file_name: params[2],
            society_name: params[3],
            registration_no: params[4],
            common_record_count: params[5],
            form_i_count: params[6],
            form_j_count: params[7],
            share_count: params[8],
            nomination_count: params[9],
            property_count: params[10],
            bank_count: params[11],
            validation_errors: params[12],
            validation_warnings: params[13],
            workbook_json: params[14],
            loaded_at: params[15] || new Date().toISOString(),
            is_active: 1,
          };
          self.data.master_data_sessions.push(session);
          self.save();
          return { changes: 1 };
        }
        if (/UPDATE\s+master_data_sessions\s+SET/i.test(s)) {
          const id = params[params.length - 1];
          let idx = self.data.master_data_sessions.findIndex(x => String(x.id).trim() === String(id).trim());
          if (idx === -1) {
            idx = self.data.master_data_sessions.findIndex(x => Number(x.is_active) === 1);
          }
          if (idx >= 0) {
            if (params.length >= 10) {
              self.data.master_data_sessions[idx].common_record_count = params[0];
              self.data.master_data_sessions[idx].form_i_count = params[1];
              self.data.master_data_sessions[idx].form_j_count = params[2];
              self.data.master_data_sessions[idx].share_count = params[3];
              self.data.master_data_sessions[idx].nomination_count = params[4];
              self.data.master_data_sessions[idx].property_count = params[5];
              self.data.master_data_sessions[idx].bank_count = params[6];
              self.data.master_data_sessions[idx].workbook_json = params[7];
              self.data.master_data_sessions[idx].validation_errors = params[8];
              self.data.master_data_sessions[idx].validation_warnings = params[9];
              self.data.master_data_sessions[idx].loaded_at = new Date().toISOString();
              self.data.master_data_sessions[idx].is_active = 1;
            } else {
              self.data.master_data_sessions[idx].common_record_count = params[0];
              self.data.master_data_sessions[idx].workbook_json = params[1];
              self.data.master_data_sessions[idx].validation_errors = params[2];
              self.data.master_data_sessions[idx].validation_warnings = params[3];
              self.data.master_data_sessions[idx].loaded_at = new Date().toISOString();
              self.data.master_data_sessions[idx].is_active = 1;
            }
          } else {
            const newSession = {
              id: id || 'session-' + Date.now(),
              society_id: 'default-society-1',
              file_name: 'MasterWorkbook.xlsx',
              society_name: '',
              registration_no: '',
              common_record_count: params[0] || 0,
              form_i_count: params[1] || 0,
              form_j_count: params[2] || 0,
              share_count: params[3] || 0,
              nomination_count: params[4] || 0,
              property_count: params[5] || 0,
              bank_count: params[6] || 0,
              workbook_json: params.length >= 10 ? params[7] : params[1],
              validation_errors: params.length >= 10 ? params[8] : params[2],
              validation_warnings: params.length >= 10 ? params[9] : params[3],
              loaded_at: new Date().toISOString(),
              is_active: 1,
            };
            self.data.master_data_sessions.push(newSession);
          }
          self.save();
          return { changes: 1 };
        }

        // Generation History
        if (/INSERT INTO generation_history/i.test(s)) {
          const entry = {
            id: params[0],
            society_id: params[1],
            society_name: params[2],
            form_id: params[3],
            form_label: params[4],
            from_serial: params[5],
            to_serial: params[6],
            total_generated: params[7],
            found_count: params[8],
            blank_count: params[9],
            orientation: params[10],
            rows_per_page: params[11],
            grid_setting: params[12],
            color_setting: params[13],
            pdf_path: params[14],
            excel_path: params[15],
            zip_path: params[16],
            status: params.length >= 19 ? params[17] : 'SUCCESS',
            generated_at: params.length >= 19 ? params[18] : (params[17] || new Date().toISOString()),
          };
          self.data.generation_history.unshift(entry);
          self.save();
          return { changes: 1 };
        }

        // App Logs
        if (/INSERT INTO app_logs/i.test(s)) {
          self.data.app_logs.push({
            id: self.data.app_logs.length + 1,
            timestamp: params[0],
            level: 'INFO',
            operation: params[1],
            message: params[2],
            metadata: params[3],
          });
          self.save();
          return { changes: 1 };
        }

        // Application Config
        if (/INSERT OR (REPLACE|IGNORE) INTO application_config/i.test(s) || /INSERT INTO application_config/i.test(s)) {
          if (params.length >= 10) {
            self.data.application_config = {
              id: params[0] || 'default-config',
              root_storage_path: params[1] || '',
              societies_path: params[2] || '',
              backup_path: params[3] || '',
              export_path: params[4] || '',
              import_path: params[5] || '',
              logs_path: params[6] || '',
              system_path: params[7] || '',
              first_run_completed: Number(params[8] || 0),
              file_naming_pattern: params[9] || '{SocietyName}_{Category}_{Number}_{Date}',
              duplicate_strategy: params[10] || 'VERSION',
              backup_enabled: Number(params[11] !== undefined ? params[11] : 1),
              backup_frequency: params[12] || 'DAILY',
              backup_retention_days: Number(params[13] || 30),
              last_backup_at: params[14] || '',
              created_at: params[15] || new Date().toISOString(),
              updated_at: params[16] || new Date().toISOString(),
            };
            self.save();
          }
          return { changes: 1 };
        }
        if (/UPDATE\s+application_config\s+SET/i.test(s)) {
          if (self.data.application_config) {
            // Flexible update matching params
            if (params.length === 1 && typeof params[0] === 'object') {
              self.data.application_config = { ...self.data.application_config, ...params[0], updated_at: new Date().toISOString() };
            }
          }
          self.save();
          return { changes: 1 };
        }

        // Document Categories
        if (/INSERT OR (REPLACE|IGNORE) INTO document_categories/i.test(s) || /INSERT INTO document_categories/i.test(s)) {
          const cat = {
            id: params[0],
            name: params[1],
            system_required: Number(params[2] || 0),
            active: Number(params[3] !== undefined ? params[3] : 1),
            sort_order: Number(params[4] || 0),
            created_at: params[5] || new Date().toISOString(),
            updated_at: params[6] || new Date().toISOString(),
          };
          const idx = self.data.document_categories.findIndex(x => String(x.id).trim() === String(cat.id).trim());
          if (idx >= 0) self.data.document_categories[idx] = cat;
          else self.data.document_categories.push(cat);
          self.save();
          return { changes: 1 };
        }
        if (/UPDATE\s+document_categories\s+SET/i.test(s)) {
          const id = params[params.length - 1];
          const idx = self.data.document_categories.findIndex(x => String(x.id).trim() === String(id).trim());
          if (idx >= 0) {
            if (/name\s*=\s*\?/i.test(s)) self.data.document_categories[idx].name = params[0];
            if (/active\s*=\s*\?/i.test(s)) self.data.document_categories[idx].active = Number(params[0]);
            if (/sort_order\s*=\s*\?/i.test(s)) self.data.document_categories[idx].sort_order = Number(params[0]);
            self.data.document_categories[idx].updated_at = new Date().toISOString();
            self.save();
          }
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+document_categories\s+WHERE\s+id\s*=/i.test(s)) {
          const id = String(params[0]).trim();
          self.data.document_categories = self.data.document_categories.filter(x => String(x.id).trim() !== id || x.system_required === 1);
          self.save();
          return { changes: 1 };
        }

        // Documents
        if (/INSERT OR (REPLACE|IGNORE) INTO documents/i.test(s) || /INSERT INTO documents/i.test(s)) {
          const doc = {
            id: params[0],
            society_id: params[1],
            category_id: params[2],
            file_name: params[3],
            file_path: params[4],
            file_type: params[5],
            file_size: Number(params[6] || 0),
            version: Number(params[7] || 1),
            checksum: params[8] || '',
            status: params[9] || 'ACTIVE',
            created_at: params[10] || new Date().toISOString(),
            updated_at: params[11] || new Date().toISOString(),
          };
          const idx = self.data.documents.findIndex(x => String(x.id).trim() === String(doc.id).trim());
          if (idx >= 0) self.data.documents[idx] = doc;
          else self.data.documents.unshift(doc);
          self.save();
          return { changes: 1 };
        }
        if (/UPDATE\s+documents\s+SET\s+status\s*=\s*\?\s+WHERE\s+id\s*=/i.test(s)) {
          const idx = self.data.documents.findIndex(x => String(x.id).trim() === String(params[1]).trim());
          if (idx >= 0) {
            self.data.documents[idx].status = params[0];
            self.data.documents[idx].updated_at = new Date().toISOString();
            self.save();
          }
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+documents\s+WHERE\s+id\s*=/i.test(s)) {
          self.data.documents = self.data.documents.filter(x => String(x.id).trim() !== String(params[0]).trim());
          self.save();
          return { changes: 1 };
        }

        // Society Folders
        if (/INSERT OR (REPLACE|IGNORE) INTO society_folders/i.test(s) || /INSERT INTO society_folders/i.test(s)) {
          const folder = {
            id: params[0],
            society_id: params[1],
            category_id: params[2],
            folder_path: params[3],
            created_at: params[4] || new Date().toISOString(),
          };
          const idx = self.data.society_folders.findIndex(x => String(x.id).trim() === String(folder.id).trim());
          if (idx >= 0) self.data.society_folders[idx] = folder;
          else self.data.society_folders.push(folder);
          self.save();
          return { changes: 1 };
        }

        // Imports
        if (/INSERT OR (REPLACE|IGNORE) INTO imports/i.test(s) || /INSERT INTO imports/i.test(s)) {
          const imp = {
            id: params[0],
            society_id: params[1],
            file_name: params[2],
            file_path: params[3],
            import_type: params[4] || 'EXCEL',
            status: params[5] || 'COMPLETED',
            record_count: Number(params[6] || 0),
            imported_by: params[7] || 'User',
            imported_at: params[8] || new Date().toISOString(),
            template_name: params[9] || '',
            metadata: params[10] || '{}',
          };
          const idx = self.data.imports.findIndex(x => String(x.id).trim() === String(imp.id).trim());
          if (idx >= 0) self.data.imports[idx] = imp;
          else self.data.imports.unshift(imp);
          self.save();
          return { changes: 1 };
        }

        // Exports
        if (/INSERT OR (REPLACE|IGNORE) INTO exports/i.test(s) || /INSERT INTO exports/i.test(s)) {
          const exp = {
            id: params[0],
            society_id: params[1],
            file_name: params[2],
            file_path: params[3],
            export_type: params[4] || 'EXCEL',
            status: params[5] || 'COMPLETED',
            record_count: Number(params[6] || 0),
            exported_at: params[7] || new Date().toISOString(),
            metadata: params[8] || '{}',
          };
          const idx = self.data.exports.findIndex(x => String(x.id).trim() === String(exp.id).trim());
          if (idx >= 0) self.data.exports[idx] = exp;
          else self.data.exports.unshift(exp);
          self.save();
          return { changes: 1 };
        }

        // Template History
        if (/INSERT OR (REPLACE|IGNORE) INTO template_history/i.test(s) || /INSERT INTO template_history/i.test(s)) {
          const tmpl = {
            id: params[0],
            society_id: params[1],
            template_name: params[2],
            template_path: params[3],
            version: Number(params[4] || 1),
            record_count: Number(params[5] || 0),
            last_used_at: params[6] || new Date().toISOString(),
            source_society_id: params[7] || '',
            created_at: params[8] || new Date().toISOString(),
          };
          const idx = self.data.template_history.findIndex(x => String(x.id).trim() === String(tmpl.id).trim());
          if (idx >= 0) self.data.template_history[idx] = tmpl;
          else self.data.template_history.unshift(tmpl);
          self.save();
          return { changes: 1 };
        }

        // Schema migrations
        if (/INSERT INTO schema_migrations/i.test(s)) {
          self.data.schema_migrations.push({ version: params[0], applied_at: params[1] });
          self.save();
          return { changes: 1 };
        }

        return { changes: 1 };
      },

      get(...params: any[]) {
        if (/SELECT\s+(value|\*)\s+FROM\s+settings\s+WHERE\s+key\s*=/i.test(s)) {
          const val = self.data.settings[params[0]];
          return val !== undefined ? { value: val } : undefined;
        }
        if (/SELECT\s+\*\s+FROM\s+application_config/i.test(s)) {
          return self.data.application_config && Object.keys(self.data.application_config).length > 0 ? self.data.application_config : undefined;
        }
        if (/SELECT\s+\*\s+FROM\s+document_categories\s+WHERE\s+id\s*=/i.test(s)) {
          return self.data.document_categories.find(x => String(x.id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+\*\s+FROM\s+document_categories\s+WHERE\s+name\s*=/i.test(s)) {
          return self.data.document_categories.find(x => String(x.name).trim().toLowerCase() === String(params[0]).trim().toLowerCase());
        }
        if (/SELECT\s+\*\s+FROM\s+documents\s+WHERE\s+id\s*=/i.test(s)) {
          return self.data.documents.find(x => String(x.id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id|society_name)\s+FROM\s+societies\s+WHERE\s+is_active\s*=\s*1/i.test(s)) {
          return self.data.societies.find(x => Number(x.is_active) === 1) || self.data.societies[0];
        }
        if (/SELECT\s+(\*|id|society_name)\s+FROM\s+societies\s+WHERE\s+id\s*=/i.test(s)) {
          return self.data.societies.find(x => String(x.id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id|society_name)\s+FROM\s+societies\s+ORDER\s+BY/i.test(s)) {
          return self.data.societies.find(x => Number(x.is_active) === 1) || self.data.societies[0];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+master_data_sessions/i.test(s)) {
          const socId = params[0] ? String(params[0]).trim() : '';
          const activeSessions = self.data.master_data_sessions
            .filter(x => (!socId || String(x.society_id).trim() === socId) && Number(x.is_active) === 1)
            .sort((a, b) => new Date(b.loaded_at || 0).getTime() - new Date(a.loaded_at || 0).getTime());
          if (activeSessions.length > 0) return activeSessions[0];

          const allSessions = [...self.data.master_data_sessions]
            .sort((a, b) => new Date(b.loaded_at || 0).getTime() - new Date(a.loaded_at || 0).getTime());
          return allSessions[0];
        }
        return undefined;
      },

      all(...params: any[]) {
        if (/SELECT\s+(key,\s*value|\*)\s+FROM\s+settings/i.test(s)) {
          return Object.entries(self.data.settings).map(([k, v]) => ({ key: k, value: String(v) }));
        }
        if (/SELECT\s+\*\s+FROM\s+document_categories/i.test(s)) {
          return [...self.data.document_categories].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
        }
        if (/SELECT\s+\*\s+FROM\s+documents\s+WHERE\s+society_id\s*=\s*\?\s+AND\s+category_id\s*=/i.test(s)) {
          return self.data.documents.filter(x => String(x.society_id).trim() === String(params[0]).trim() && String(x.category_id).trim() === String(params[1]).trim());
        }
        if (/SELECT\s+\*\s+FROM\s+documents\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.documents.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+\*\s+FROM\s+documents/i.test(s)) {
          return [...self.data.documents];
        }
        if (/SELECT\s+\*\s+FROM\s+society_folders\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.society_folders.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id|society_name)\s+FROM\s+societies/i.test(s)) {
          return [...self.data.societies];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+generation_history\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.generation_history.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+generation_history/i.test(s)) {
          return [...self.data.generation_history];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+imports\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.imports.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+imports/i.test(s)) {
          return [...self.data.imports];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+exports\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.exports.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+exports/i.test(s)) {
          return [...self.data.exports];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+template_history\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.template_history.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+template_history/i.test(s)) {
          return [...self.data.template_history];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+app_logs/i.test(s)) {
          return [...self.data.app_logs];
        }
        if (/SELECT version FROM schema_migrations/i.test(s)) {
          return self.data.schema_migrations.map(x => ({ version: x.version }));
        }
        if (/PRAGMA table_info/i.test(s)) {
          return [
            { name: 'society_id' }, { name: 'society_name' }, { name: 'orientation' },
            { name: 'rows_per_page' }, { name: 'grid_setting' }, { name: 'color_setting' },
            { name: 'pdf_path' }, { name: 'excel_path' }, { name: 'logo_base64' }
          ];
        }
        return [];
      }
    };
  }
}

let Database: any = JsonDatabaseAdapter;
const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;

if (!isElectron) {
  try {
    const NativeDb = require('better-sqlite3');
    Database = NativeDb;
  } catch {
    Database = JsonDatabaseAdapter;
  }
} else {
  Database = JsonDatabaseAdapter;
}

let db: any;

export interface AppPaths {
  userData: string;
  database: string;
  masterData: string;
  exports: string;
  templates: string;
  backups: string;
  downloads: string;
  downloadsHlabs: string;
  downloadsZip: string;
  downloadsTemplates: string;
  temp: string;
  templatesSource: string;
}

let paths: AppPaths;

export function initializeDatabase(): any {
  if (db) return db;

  const cwdPath = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
  const userDataPath = (app && app.getPath) ? app.getPath('userData') : path.join(cwdPath, 'scratch', 'userData');
  const downloadsPath = (app && app.getPath) ? app.getPath('downloads') : path.join(cwdPath, 'scratch', 'downloads');
  const hlabsRoot = path.join(downloadsPath, 'HENU_OS');

  const baseDirName = typeof __dirname !== 'undefined' ? __dirname : cwdPath;

  paths = {
    userData: userDataPath,
    database: path.join(userDataPath, 'database'),
    masterData: path.join(userDataPath, 'masterdata'),
    exports: path.join(userDataPath, 'exports'),
    templates: path.join(userDataPath, 'templates'),
    backups: path.join(userDataPath, 'backups'),
    downloads: downloadsPath,
    downloadsHlabs: hlabsRoot,
    downloadsZip: path.join(hlabsRoot, 'ZIP'),
    downloadsTemplates: path.join(hlabsRoot, 'Templates'),
    temp: path.join(userDataPath, 'temp'),
    // Source templates dir (next to dist/main in dev, in resources in prod)
    templatesSource: path.join(baseDirName, 'templates'),
  };

  const allDirs = [
    paths.database, paths.masterData, paths.exports,
    paths.templates, paths.backups,
    paths.downloadsHlabs, paths.downloadsZip, paths.downloadsTemplates,
    paths.temp,
  ];
  allDirs.forEach(dir => {
    try {
      if (fs && fs.existsSync && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
  });

  // Clean temp on startup (remove stale preview files)
  try {
    const tempFiles = fs.readdirSync(paths.temp);
    for (const f of tempFiles) {
      if (f.startsWith('preview_') && f.endsWith('.pdf')) {
        fs.unlinkSync(path.join(paths.temp, f));
      }
    }
  } catch {}

  const dbPath = path.join(paths.database, 'henu-os.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  return db;
}

export function getPaths(): AppPaths {
  if (!paths) throw new Error('Not initialized. Call initializeDatabase first.');
  return paths;
}

export function getDatabase(): any {
  if (!db) throw new Error('DB not initialized. Call initializeDatabase first.');
  return db;
}

// ── Migrations ────────────────────────────────────────────────
function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(r => r.version)
  );

  const migrations: { version: number; sql: string }[] = [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT ''
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES
          ('app_name', 'HENU OS'),
          ('app_subtitle', 'Records Management'),
          ('theme', 'light'),
          ('accent_color', '#7C3AED');

        CREATE TABLE IF NOT EXISTS master_data_sessions (
          id TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          society_name TEXT,
          registration_no TEXT,
          common_record_count INTEGER DEFAULT 0,
          form_i_count INTEGER DEFAULT 0,
          form_j_count INTEGER DEFAULT 0,
          share_count INTEGER DEFAULT 0,
          nomination_count INTEGER DEFAULT 0,
          property_count INTEGER DEFAULT 0,
          bank_count INTEGER DEFAULT 0,
          validation_errors TEXT DEFAULT '[]',
          validation_warnings TEXT DEFAULT '[]',
          workbook_json TEXT NOT NULL,
          loaded_at TEXT NOT NULL,
          is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS generation_history (
          id TEXT PRIMARY KEY,
          form_id TEXT NOT NULL,
          form_label TEXT NOT NULL,
          from_serial TEXT NOT NULL,
          to_serial TEXT NOT NULL,
          total_generated INTEGER DEFAULT 0,
          found_count INTEGER DEFAULT 0,
          blank_count INTEGER DEFAULT 0,
          zip_path TEXT NOT NULL,
          generated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL DEFAULT 'INFO',
          operation TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata TEXT DEFAULT '{}'
        );
      `,
    },
    {
      version: 2,
      sql: `
        CREATE TABLE IF NOT EXISTS societies (
          id TEXT PRIMARY KEY,
          society_name TEXT NOT NULL,
          registration_no TEXT NOT NULL,
          registration_date TEXT DEFAULT '',
          full_address TEXT DEFAULT '',
          city TEXT DEFAULT '',
          state TEXT DEFAULT '',
          pin_code TEXT DEFAULT '',
          logo_base64 TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          is_active INTEGER DEFAULT 0
        );

        INSERT OR IGNORE INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, logo_base64, created_at, is_active)
        SELECT 'default-society-1', 'HENU OS PVT LTD CO-SOC', 'U62099RJ2025PTC109150', '02/12/2025', 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home', 'Pali', 'Rajasthan', '306401', '', CURRENT_TIMESTAMP, 1
        WHERE NOT EXISTS (SELECT 1 FROM societies);
      `,
    },
    {
      version: 3,
      sql: `
        CREATE TABLE IF NOT EXISTS application_config (
          id TEXT PRIMARY KEY,
          root_storage_path TEXT NOT NULL,
          societies_path TEXT NOT NULL,
          backup_path TEXT NOT NULL,
          export_path TEXT NOT NULL,
          import_path TEXT NOT NULL,
          logs_path TEXT NOT NULL,
          system_path TEXT NOT NULL,
          first_run_completed INTEGER DEFAULT 0,
          file_naming_pattern TEXT DEFAULT '{SocietyName}_{Category}_{Number}_{Date}',
          duplicate_strategy TEXT DEFAULT 'VERSION',
          backup_enabled INTEGER DEFAULT 1,
          backup_frequency TEXT DEFAULT 'DAILY',
          backup_retention_days INTEGER DEFAULT 30,
          last_backup_at TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS document_categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          system_required INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          society_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER DEFAULT 0,
          version INTEGER DEFAULT 1,
          checksum TEXT DEFAULT '',
          status TEXT DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS society_folders (
          id TEXT PRIMARY KEY,
          society_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          folder_path TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `,
    },
  ];

  const tx = db.transaction((m: typeof migrations[0]) => {
    db.exec(m.sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(m.version, new Date().toISOString());
  });

  for (const m of migrations) {
    if (!applied.has(m.version)) {
      console.log(`Applying migration v${m.version}...`);
      tx(m);
    }
  }

  // Ensure logo_base64, status, year_established, updated_at columns exist on societies table
  try {
    const cols0 = db.prepare("PRAGMA table_info(societies)").all() as { name: string }[];
    const names = new Set(cols0.map(c => c.name));
    if (!names.has('logo_base64')) {
      db.exec("ALTER TABLE societies ADD COLUMN logo_base64 TEXT DEFAULT ''");
    }
    if (!names.has('status')) {
      db.exec("ALTER TABLE societies ADD COLUMN status TEXT DEFAULT 'ACTIVE'");
    }
    if (!names.has('year_established')) {
      db.exec("ALTER TABLE societies ADD COLUMN year_established TEXT DEFAULT ''");
    }
    if (!names.has('updated_at')) {
      db.exec("ALTER TABLE societies ADD COLUMN updated_at TEXT DEFAULT ''");
    }
  } catch {}

  // Ensure society_id column exists on master_data_sessions & generation_history
  try {
    const cols1 = db.prepare("PRAGMA table_info(master_data_sessions)").all() as { name: string }[];
    if (!cols1.some(c => c.name === 'society_id')) {
      db.exec("ALTER TABLE master_data_sessions ADD COLUMN society_id TEXT DEFAULT 'default-society-1'");
    }
  } catch {}

  try {
    const cols2 = db.prepare("PRAGMA table_info(generation_history)").all() as { name: string }[];
    const colNames = new Set(cols2.map(c => c.name));
    if (!colNames.has('society_id')) db.exec("ALTER TABLE generation_history ADD COLUMN society_id TEXT DEFAULT 'default-society-1'");
    if (!colNames.has('society_name')) db.exec("ALTER TABLE generation_history ADD COLUMN society_name TEXT DEFAULT ''");
    if (!colNames.has('orientation')) db.exec("ALTER TABLE generation_history ADD COLUMN orientation TEXT DEFAULT 'Portrait'");
    if (!colNames.has('rows_per_page')) db.exec("ALTER TABLE generation_history ADD COLUMN rows_per_page INTEGER DEFAULT 10");
    if (!colNames.has('grid_setting')) db.exec("ALTER TABLE generation_history ADD COLUMN grid_setting TEXT DEFAULT 'Grid ON'");
    if (!colNames.has('color_setting')) db.exec("ALTER TABLE generation_history ADD COLUMN color_setting TEXT DEFAULT 'Color'");
    if (!colNames.has('pdf_path')) db.exec("ALTER TABLE generation_history ADD COLUMN pdf_path TEXT DEFAULT ''");
    if (!colNames.has('excel_path')) db.exec("ALTER TABLE generation_history ADD COLUMN excel_path TEXT DEFAULT ''");
    if (!colNames.has('status')) db.exec("ALTER TABLE generation_history ADD COLUMN status TEXT DEFAULT 'SUCCESS'");
  } catch (err) {
    console.error('Migration error on generation_history:', err);
  }

  // Ensure folder_path column exists on societies table
  try {
    const colsSoc = db.prepare("PRAGMA table_info(societies)").all() as { name: string }[];
    if (!colsSoc.some(c => c.name === 'folder_path')) {
      db.exec("ALTER TABLE societies ADD COLUMN folder_path TEXT DEFAULT ''");
    }
  } catch {}

  // Create isolated partition tables: imports, exports, template_history
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        society_id TEXT NOT NULL,
        file_name TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL DEFAULT '',
        import_type TEXT NOT NULL DEFAULT 'EXCEL',
        record_count INTEGER DEFAULT 0,
        imported_by TEXT DEFAULT 'System',
        status TEXT DEFAULT 'COMPLETED',
        imported_at TEXT NOT NULL DEFAULT '',
        template_name TEXT DEFAULT '',
        metadata TEXT DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        society_id TEXT NOT NULL,
        file_name TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL DEFAULT '',
        export_type TEXT NOT NULL DEFAULT 'EXCEL',
        record_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'COMPLETED',
        exported_at TEXT NOT NULL DEFAULT '',
        metadata TEXT DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS template_history (
        id TEXT PRIMARY KEY,
        society_id TEXT NOT NULL,
        template_name TEXT NOT NULL DEFAULT '',
        template_path TEXT NOT NULL DEFAULT '',
        version INTEGER DEFAULT 1,
        record_count INTEGER DEFAULT 0,
        last_used_at TEXT NOT NULL DEFAULT '',
        source_society_id TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
      );
    `);

    // Ensure columns exist if table was created with older schema
    const impCols = (db.prepare("PRAGMA table_info(imports)").all() as { name: string }[]).map(c => c.name);
    if (!impCols.includes('file_name')) db.exec("ALTER TABLE imports ADD COLUMN file_name TEXT DEFAULT ''");
    if (!impCols.includes('file_path')) db.exec("ALTER TABLE imports ADD COLUMN file_path TEXT DEFAULT ''");
    if (!impCols.includes('template_name')) db.exec("ALTER TABLE imports ADD COLUMN template_name TEXT DEFAULT ''");
    if (!impCols.includes('metadata')) db.exec("ALTER TABLE imports ADD COLUMN metadata TEXT DEFAULT '{}'");

    const expCols = (db.prepare("PRAGMA table_info(exports)").all() as { name: string }[]).map(c => c.name);
    if (!expCols.includes('file_name')) db.exec("ALTER TABLE exports ADD COLUMN file_name TEXT DEFAULT ''");
    if (!expCols.includes('file_path')) db.exec("ALTER TABLE exports ADD COLUMN file_path TEXT DEFAULT ''");
    if (!expCols.includes('status')) db.exec("ALTER TABLE exports ADD COLUMN status TEXT DEFAULT 'COMPLETED'");
    if (!expCols.includes('metadata')) db.exec("ALTER TABLE exports ADD COLUMN metadata TEXT DEFAULT '{}'");

    const tmplCols = (db.prepare("PRAGMA table_info(template_history)").all() as { name: string }[]).map(c => c.name);
    if (!tmplCols.includes('template_path')) db.exec("ALTER TABLE template_history ADD COLUMN template_path TEXT DEFAULT ''");
    if (!tmplCols.includes('file_path')) db.exec("ALTER TABLE template_history ADD COLUMN file_path TEXT DEFAULT ''");
    if (!tmplCols.includes('version')) db.exec("ALTER TABLE template_history ADD COLUMN version INTEGER DEFAULT 1");
    if (!tmplCols.includes('record_count')) db.exec("ALTER TABLE template_history ADD COLUMN record_count INTEGER DEFAULT 0");
    if (!tmplCols.includes('last_used_at')) db.exec("ALTER TABLE template_history ADD COLUMN last_used_at TEXT DEFAULT ''");
    if (!tmplCols.includes('source_society_id')) db.exec("ALTER TABLE template_history ADD COLUMN source_society_id TEXT DEFAULT ''");
    if (!tmplCols.includes('created_at')) db.exec("ALTER TABLE template_history ADD COLUMN created_at TEXT DEFAULT ''");
  } catch (err) {
    console.error('Migration error on partition tables:', err);
  }
}
