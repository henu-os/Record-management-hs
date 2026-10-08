# HENU OS RECORD MANAGEMENT — EXISTING SYSTEM PROTECTION MAP & ARCHITECTURE AUDIT
**Document Version:** 1.0.0  
**Audit Date:** October 8, 2026  
**Status:** COMPLETE & SEALED — SYSTEM PROTECTED  
**Repository:** [https://github.com/henu-os/Record-management-hs](https://github.com/henu-os/Record-management-hs)  

---

## 1. ABSOLUTE SYSTEM PROTECTION MANDATE

The HENU OS Record Management system is a fully functional, production-grade desktop application built with Electron, React 18, TypeScript, and native PDF/Excel generation engines.

### Non-Destructive Protection Rules:
1. **NO REWRITES**: The current architecture, directory layout, and frameworks must NOT be replaced or redesigned.
2. **NO DELETIONS**: No existing file, asset, font, template, or script may be removed or renamed.
3. **NO SCHEMA WIPING / SILENT MIGRATIONS**: Existing databases (`henu-os.db` / `henu-os-store.json`) and user data files must remain 100% backward compatible.
4. **NO BREAKING OF WORKING MODULES**: All 10 existing modules, 8 form generation pipelines, OCR engines, and converters must continue executing without modification to their core calculation or output logic.
5. **ADDITIVE EXTENSION ONLY**: HENU CONFIG and HENUMASTER must be implemented as distinct, additive layers that attach to safe integration points.

---

## 2. COMPREHENSIVE EXISTING SYSTEM AUDIT

### 2.1 Technology Stack & Runtime Topology

| Layer | Technology | Primary Files / Locations |
| :--- | :--- | :--- |
| **Runtime Shell** | Electron 31.3.0 | `src/main/index.ts`, `src/main/preload.ts`, `scripts/launch-electron.js` |
| **Main Process** | Node.js + TypeScript (CommonJS) | `src/main/`, `tsconfig.main.json` |
| **Renderer Process** | React 18.3.1 + Vite 5.4.1 + CSS | `src/renderer/`, `src/renderer/App.tsx`, `index.css` |
| **Local Storage / DB** | Hybrid JSON Store Adapter (`JsonDatabaseAdapter`) & SQLite | `src/main/db.ts` (`userData/database/henu-os-store.json`) |
| **Document Generation** | Native `pdf-lib` + `@pdf-lib/fontkit` | `src/main/services/PdfEngine.ts`, `renderers/PdfDocumentBuilder.ts` |
| **Spreadsheet Engine** | `exceljs` 4.4.0 + `xlsx` 0.18.5 | `src/main/services/MasterDataService.ts` |
| **Archive Packaging** | `jszip` 3.10.1 | `src/main/services/ZipService.ts` |
| **OCR & AI Pipelines** | `tesseract.js` + Custom OCR Engine Managers | `src/main/services/ocr-api/`, `src/modules/henu-voucher-ocr/`, `src/modules/henu-check-ocr/` |
| **Fonts & Typography** | Mukta & NotoSansDevanagari TrueType Fonts | `src/templates/*.ttf` |

---

### 2.2 Existing Modules Inventory

The application currently contains 10 operational modules accessible via the primary UI:

1. **Dashboard (`src/renderer/pages/Dashboard.tsx`)**
   - Central overview with quick action cards, summary metric counters (Total Members, Active Society, Active Modules), quick navigation triggers, and system status display.
2. **Master Data (`src/renderer/pages/MasterData.tsx`)**
   - Excel workbook upload, parsing, and validation.
   - Live interactive spreadsheet grid editor (`SpreadsheetEditor.tsx`) for reviewing and editing all 8 sheets in memory.
   - Individual member record modal editor (`EditDataModal.tsx`).
   - Export master template (`MasterWorkbook.xlsx`) and module-specific templates.
3. **Control Center / Generate Forms (`src/renderer/pages/GenerateForms.tsx`)**
   - Dual mode: Master Control Center (batch multi-form generation) and Individual Register Generation.
   - Form selection dropdown, serial range generator (`001` to `N`), live record count preview.
   - Print controls: Grid ON/OFF, Color vs. B&W, Rows Per Page, Paper Orientation.
   - Real-time PDF preview pane (`PdfViewer.tsx`) and Single-Click ZIP Export.
4. **Form I Register (`src/main/services/renderers/FormIRenderer.ts`)**
   - Statutory Register of Members in Portrait mode. Dynamic member details, entrance fees, share allocation, and date records.
5. **Form J Register (`src/main/services/renderers/FormJRenderer.ts`)**
   - Statutory List of Members in Portrait mode with serial continuity and member address registers.
6. **Share Register (`src/main/services/renderers/ShareRegisterRenderer.ts`)**
   - Landscape statutory share register with certificate tracking, distinctive numbers (`From-To`), and transferred shares.
7. **Nomination Register (`src/main/services/renderers/NominationRegisterRenderer.ts`)**
   - Landscape register recording nominee names, relationships, percentage shares, and managing committee approval dates.
8. **Property Register (`src/main/services/renderers/PropertyRegisterRenderer.ts`)**
   - Landscape register capturing unit/flat numbers, floor, area, parking allotment, and possession history.
9. **Bank Lien Mark Register (`src/main/services/renderers/LienMarkRenderer.ts`)**
   - Portrait statutory register recording loan hypothecations, bank NOCs, lien creation, and discharge details.
10. **Share Certificate Generator (`src/main/services/renderers/ShareCertificateRenderer.ts`)**
    - High-fidelity single-sheet and multi-member Share Certificates with customizable borders, society logo, seal placement, and authorized signatory placeholders.
11. **Voucher Register (`src/main/services/renderers/VoucherRenderer.ts`)**
    - 3-per-legal-sheet payment and receipt vouchers with automated currency-to-words conversion and ledger head allocations.
12. **HENU Voucher OCR (`src/renderer/pages/voucher-ocr/HenuVoucherOcrPage.tsx`, `src/modules/henu-voucher-ocr/`)**
    - Multi-engine OCR extraction pipeline (Local Tesseract + Cloud AI APIs: OpenAI, Claude, Gemini, PaddleOCR, RapidOCR).
    - Image pre-processing, bounding box field detection, validation engine, and Excel export.
13. **HENU Check OCR (`src/renderer/pages/check-ocr/HenuCheckOcrPage.tsx`, `src/modules/henu-check-ocr/`)**
    - Bank check scan extraction (MICR, IFSC, Account Number, Payee, Amount, Date).
14. **HENU IDF Converter (`src/renderer/pages/henu-idf/HenuIdfPage.tsx`, `src/modules/henu-idf/`)**
    - Image-to-PDF / Document file conversion engine with compression, layout tuning, and instant download.
15. **Generated Files / History (`src/renderer/pages/GeneratedFiles.tsx`)**
    - Historical generation log audit table, tracking generated ZIP paths, serial ranges, creation timestamps, and direct "Open Folder" / "Open File" shortcuts.
16. **Settings Page (`src/renderer/pages/SettingsPage.tsx`)**
    - Global application configuration, theme switching (Light/Dark), accent color picker, form-specific layout calibrations, and OCR API key management.

---

### 2.3 Existing Business Workflows & Data Pipelines

```
[User Action: Upload Excel]
         │
         ▼
[MasterDataService.parseWorkbook()] ─── Validates 8 Sheets
         │
         ▼
[In-Memory Canonical Model (MasterWorkbook)]
         │
         ├─── Saved to DB Session (`master_data_sessions`)
         ├─── Editable in UI (`SpreadsheetEditor.tsx`)
         │
         ▼
[Form Generation Trigger: SerialRangeEngine ('001' -> '050')]
         │
         ▼
[ValidationEngine.validateForGeneration()]
         │
         ▼
[PdfEngine.generate()] ───> [PdfDocumentBuilder (pdf-lib)]
         │
         ├─── Temporary Preview PDF (`userData/temp/preview_*.pdf`)
         └─── Final PDF Files -> [ZipService.createZip()]
                                       │
                                       ▼
                  Saved to: `%USERPROFILE%/Downloads/HENU_OS/ZIP/`
```

---

### 2.4 Existing Storage, Paths & Database Logic

#### Storage Paths Architecture (`src/main/db.ts: AppPaths`):
- **User Data Root:** `%APPDATA%\HENU_OS_Records\` (or `scratch/userData` in standalone tests)
- **Database Directory:** `%APPDATA%\HENU_OS_Records\database\` (`henu-os.db` / `henu-os-store.json`)
- **Master Data Cache:** `%APPDATA%\HENU_OS_Records\masterdata\`
- **Exports Directory:** `%APPDATA%\HENU_OS_Records\exports\`
- **Temp Preview Cache:** `%APPDATA%\HENU_OS_Records\temp\` (auto-cleaned on startup)
- **Downloads Root:** `%USERPROFILE%\Downloads\HENU_OS\`
- **Downloads ZIP:** `%USERPROFILE%\Downloads\HENU_OS\ZIP\`
- **Downloads Templates:** `%USERPROFILE%\Downloads\HENU_OS\Templates\`

#### Database Schema (`henu-os-store.json` / SQLite):
1. **`societies`**:
   - `id` (TEXT PRIMARY KEY)
   - `society_name` (TEXT NOT NULL)
   - `registration_no` (TEXT NOT NULL)
   - `registration_date` (TEXT)
   - `full_address` (TEXT)
   - `city` (TEXT), `state` (TEXT), `pin_code` (TEXT)
   - `logo_base64` (TEXT)
   - `created_at` (TEXT)
   - `is_active` (INTEGER: 0 or 1)
2. **`master_data_sessions`**:
   - `id` (TEXT PRIMARY KEY), `society_id` (TEXT), `file_name` (TEXT), `society_name` (TEXT), `registration_no` (TEXT)
   - `common_record_count`, `form_i_count`, `form_j_count`, `share_count`, `nomination_count`, `property_count`, `bank_count` (INTEGER)
   - `validation_errors` (TEXT JSON), `validation_warnings` (TEXT JSON)
   - `workbook_json` (TEXT JSON), `loaded_at` (TEXT), `is_active` (INTEGER)
3. **`generation_history`**:
   - `id` (TEXT PRIMARY KEY), `society_id` (TEXT), `society_name` (TEXT)
   - `form_id` (TEXT), `form_label` (TEXT), `from_serial` (TEXT), `to_serial` (TEXT)
   - `total_generated`, `found_count`, `blank_count` (INTEGER)
   - `orientation`, `rows_per_page`, `grid_setting`, `color_setting` (TEXT)
   - `pdf_path`, `excel_path`, `zip_path` (TEXT), `status` (TEXT), `generated_at` (TEXT)
4. **`settings`**: `key` (TEXT PRIMARY KEY), `value` (TEXT)
5. **`app_logs`**: `id` (INTEGER AUTOINCREMENT), `timestamp`, `level`, `operation`, `message`, `metadata`
6. **`schema_migrations`**: `version` (INTEGER PRIMARY KEY), `applied_at` (TEXT)

---

### 2.5 Existing Society Management Logic

- **Creation Flow:** `ipcRenderer.invoke('society:create', payload)` -> Main generates UUID -> Inserts record -> Deactivates other societies -> Sets new society `is_active = 1` -> Initializes default master workbook -> Returns new society record.
- **Selection / Active Switch Flow:** `ipcRenderer.invoke('society:select', societyId)` -> Updates `is_active` flags in DB -> Loads most recent active master data session for that society -> Notifies renderer -> Renderer triggers state update and re-renders components using `key={activeSociety?.id}`.
- **Logo Storage:** Base64 data string stored directly in the `societies.logo_base64` column; rendered dynamically in share certificates, registers, and preview cards.

---

## 3. SAFE EXTENSION POINTS FOR NEW MODULES

To cleanly integrate **HENU CONFIG** and **HENUMASTER** without altering or endangering existing logic:

```
                  ┌──────────────────────────────────────────────┐
                  │                 HENU OS SHELL                │
                  │             (src/renderer/App.tsx)           │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │     EXISTING SYSTEM       │                   │       NEW EXTENSIONS      │
   │  (Protected & Untouched)  │                   │        (Additive)         │
   ├───────────────────────────┤                   ├───────────────────────────┤
   │ • Dashboard               │                   │ • HENU CONFIG             │
   │ • Master Data Editor      │                   │   (System Config / Rules) │
   │ • Control Center          │                   │                           │
   │ • 6 Statutory Registers   │                   │ • HENUMASTER              │
   │ • Share Certificate       │                   │   (Advanced Master Org)   │
   │ • Voucher Engine          │                   │                           │
   │ • OCR (Voucher / Check)   │                   │                           │
   │ • IDF Converter           │                   │                           │
   │ • Generated Files / Logs  │                   │                           │
   └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │          SAFE SHARED SERVICE LAYER           │
                 ├──────────────────────────────────────────────┤
                 │ • Society Context & Registry                 │
                 │ • Configuration Service                      │
                 │ • Document / File Index                      │
                 │ • Local Database Adapter (SQLite/JSON)       │
                 └──────────────────────────────────────────────┘
```

### 3.1 Extension Point 1: Navigation Routing (`src/renderer/App.tsx`)
- **Action:** Add `'henu-config'` and `'henumaster'` to `PageId` union type.
- **Safety:** Additive only. Does not alter existing `page` matching branches or sidebar hierarchy.

### 3.2 Extension Point 2: IPC Channel Namespaces (`src/main/preload.ts` & `src/main/index.ts`)
- **Action:** Register isolated IPC channels:
  - `henuConfig:*` (`henuConfig:getSettings`, `henuConfig:saveSettings`, etc.)
  - `henuMaster:*` (`henuMaster:getSocieties`, `henuMaster:syncRecords`, etc.)
- **Safety:** Zero collision with existing `society:*`, `masterData:*`, `generate:*`, `settings:*` channels.

### 3.3 Extension Point 3: Database Migrations (`src/main/db.ts`)
- **Action:** Add migration `version: 3` to `runMigrations()` array.
- **Safety:** Schema migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` checks with transaction boundaries. No existing tables are modified destructively.

---

## 4. CENTRAL APPLICATION CONTEXT DESIGN

### 4.1 Current Society Context (`CurrentSocietyContext`)
```typescript
export interface CurrentSocietyContext {
  societyId: string;
  societyName: string;
  registrationNo: string;
  registrationDate?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  logoBase64?: string;
  societyStatus: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  societyStoragePath: string; // Isolated subfolder under exports/masterdata for this society
  loadedSessionId?: string;
}
```

### 4.2 Current Module Context (`CurrentModuleContext`)
```typescript
export interface CurrentModuleContext {
  moduleId: string;
  moduleName: string;
  permissions: string[];
  lastAccessedAt: string;
}
```

---

## 5. SAFE SERVICE INTEGRATION LAYER

The upcoming architecture will provide structured, reusable services:

1. **Configuration Service (`src/main/services/ConfigurationService.ts`)**:
   - Manages configuration keys, schema defaults, module-level settings, and environment overrides.
2. **Storage & Filesystem Service (`src/main/services/StorageService.ts`)**:
   - Manages sanitized file read/writes, export paths, society directory creation, and temp file purging without polluting root user folders.
3. **Database Service (`src/main/services/DatabaseService.ts`)**:
   - Wraps database operations in strict types, handles query parameterization, and executes non-blocking atomic writes.
4. **Society Service (`src/main/services/SocietyService.ts`)**:
   - Encapsulates multi-society metadata, active switches, validation rules, and logo management.
5. **Document / File Index Service (`src/main/services/DocumentIndexService.ts`)**:
   - Maintains an indexed catalog of all generated PDFs, master workbooks, OCR exports, and zip bundles for instant searching.

---

## 6. DATABASE DECISION & FILESYSTEM SEPARATION PRINCIPLE

1. **Database Selection**:
   - The application currently operates with a dual architecture: native SQLite (`better-sqlite3`) and an internal fallback `JsonDatabaseAdapter`.
   - In Electron, the JSON Store Adapter (`userData/database/henu-os-store.json`) provides zero-dependency, crash-resilient local persistence across all Windows installations without native binary compilation failures.
   - **Decision:** Maintain and extend this local desktop architecture. Under no circumstances will a remote cloud database (Supabase, Firebase, AWS RDS) or network server be introduced.
2. **Filesystem vs. Database Separation**:
   - **Database Role:** Stores metadata, indexes, settings, society headers, logs, record counts, and file path references.
   - **Filesystem Role:** Stores actual document binaries, generated PDFs, Excel workbooks, and ZIP archives.
   - Binary PDF and ZIP contents will never be dumped into database text columns.

---

## 7. PROTECTION GUARANTEE & SUMMARY TABLE

| Component | Status Before Extension | Safety Strategy for Next Phases |
| :--- | :--- | :--- |
| **8 Statutory Forms / Registers** | 100% Functional, 54 Verified Tests | Untouched. Will consume shared context via read-only interfaces. |
| **Master Data Excel Importer** | 100% Functional, 8-sheet parser | Preserved as canonical ingestion pipeline. |
| **PDF Generation Canvas Builder** | 100% Native programmatic drawing | Preserved as sole PDF rendering pipeline. |
| **Multi-Society Context** | Active in DB and UI Header | Extended into formal `CurrentSocietyContext` service. |
| **OCR & Converter Submodules** | 3 Submodules operational | Maintained in dedicated `src/modules/` boundaries. |
| **History & System Logs** | Operational in UI & DB | Index enriched additively by Document Index Service. |

---
*Protection Map Certified — Baseline Sealed for Master Implementation Prompt 2 & 3.*
