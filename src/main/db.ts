import path from 'path';
import fs from 'fs';

let app: any;
try {
  app = require('electron').app;
} catch {
  app = undefined;
}

class JsonDatabaseAdapter {
  private filePath: string;
  private data: {
    settings: Record<string, any>;
    societies: any[];
    master_data_sessions: any[];
    generation_history: any[];
    app_logs: any[];
    schema_migrations: any[];
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
    };
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
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

          if (this.data.societies.length === 0) {
            this.data.societies.push({
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
            });
          }

          // Ensure exactly one active society exists
          const hasActive = this.data.societies.some(s => s.is_active === 1);
          if (!hasActive && this.data.societies.length > 0) {
            this.data.societies[0].is_active = 1;
          }
          this.save();
        }
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
        if (/UPDATE\s+societies\s+SET\s+logo_base64\s*=\s*\?\s+WHERE\s+id\s*=/i.test(s)) {
          const idx = self.data.societies.findIndex(x => String(x.id).trim() === String(params[1]).trim());
          if (idx >= 0) {
            self.data.societies[idx].logo_base64 = params[0] || '';
            self.save();
          }
          return { changes: 1 };
        }
        if (/DELETE\s+FROM\s+societies\s+WHERE\s+id\s*=/i.test(s)) {
          const socId = String(params[0]).trim();
          self.data.societies = self.data.societies.filter(x => String(x.id).trim() !== socId);
          self.data.master_data_sessions = self.data.master_data_sessions.filter(x => String(x.society_id).trim() !== socId);
          self.data.generation_history = self.data.generation_history.filter(x => String(x.society_id).trim() !== socId);
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
        if (/SELECT\s+(\*|id|society_name)\s+FROM\s+societies/i.test(s)) {
          return [...self.data.societies];
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+generation_history\s+WHERE\s+society_id\s*=/i.test(s)) {
          return self.data.generation_history.filter(x => String(x.society_id).trim() === String(params[0]).trim());
        }
        if (/SELECT\s+(\*|id)\s+FROM\s+generation_history/i.test(s)) {
          return [...self.data.generation_history];
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

  // Ensure logo_base64 column exists on societies table
  try {
    const cols0 = db.prepare("PRAGMA table_info(societies)").all() as { name: string }[];
    if (!cols0.some(c => c.name === 'logo_base64')) {
      db.exec("ALTER TABLE societies ADD COLUMN logo_base64 TEXT DEFAULT ''");
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
}
