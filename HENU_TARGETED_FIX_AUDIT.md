# HENU OS RECORD MANAGEMENT
## REQUIREMENT AUDIT + EXISTING LOGIC DISCOVERY REPORT
**Document:** `HENU_TARGETED_FIX_AUDIT.md`  
**Phase:** Master Prompt 1 of 2 (Inspection & Discovery Only — No Changes Implemented)  
**Repository:** [https://github.com/henu-os/Record-management-hs](https://github.com/henu-os/Record-management-hs)  
**Date:** October 2026  
**Status:** Audit Complete & Validated  

---

## 1. Existing Architecture Overview

The HENU OS Record Management system is a production-grade desktop application built with:
- **Runtime & Desktop Layer:** Electron 32+ (Node.js 20+), Windows x64.
- **Frontend Architecture:** React 18, TypeScript, Vite 5, Vanilla CSS design system.
- **Database Architecture:** Dual-engine zero-dependency architecture:
  - SQLite (`better-sqlite3`) in CLI / native environments.
  - JSON Database Adapter (`JsonDatabaseAdapter` saving to `userData/database/henu-os-store.json`) in Electron packaged builds for Windows crash-resilience.
- **Document Rendering & Printing:** Pure programmatic vector PDF generation using `pdf-lib` and `@pdf-lib/fontkit` (zero HTML-to-PDF or browser print hacks).
- **Core Services:**
  - `MasterDataService.ts` — Excel workbook parsing, normalization, and template generation.
  - `FormMappingService.ts` — Semantic mapping from normalized member records to form-specific fields.
  - `MasterDataQueryEngine.ts` — Master data lookups and serial range queries.
  - `SerialRangeEngine.ts` — Serial range validation, padding, and range generation.
  - `PdfEngine.ts` — Orchestrator dispatching to dedicated renderers.
  - `PdfDocumentBuilder.ts` — Vector drawing engine with grid, header, table, and WinAnsi font handlers.
  - `HenuConfigService.ts` & `StorageEngine.ts` — Configuration and society storage provisioning.
  - `HenuMasterService.ts` — Administrative control and society switching.

---

## 2. Existing Modules Under Audit

| Module Code | Module Name | Primary Renderer / Definition | Orientation & Layout |
|---|---|---|---|
| **01** | `Society_Master` | `MasterDataService.ts` (`parseSocietyMaster`) | Master identity (6-line address, reg info, units, logos) |
| **02** | `Common_Member_Master` | `MasterDataService.ts` (`parseCommonFile`) | Canonical member record (50+ statutory fields) |
| **03** | `Form_I` | `FormIRenderer.ts`, `FormIDefinition.ts` | **Portrait** (Legal) — Member details + 2 tables (Shares Held & Transferred) |
| **04** | `Form_J` | `FormJRenderer.ts`, `FormJDefinition.ts` | **Portrait & Landscape** (Legal) — Table with joint members |
| **05** | `Share_Register` | `ShareRegisterRenderer.ts`, `ShareRegisterDefinition.ts` | **Landscape** (Legal) — 15-Col / 19-Col statutory register |
| **06** | `Nomination_Register` | `NominationRegisterRenderer.ts`, `NominationRegisterDefinition.ts` | **Landscape** (Legal) — 8-Col nominee records & percentages |
| **07** | `Property_Register` | `PropertyRegisterRenderer.ts`, `PropertyRegisterDefinition.ts` | **Landscape** (Legal) — 13-Col tenement details & costs |
| **08** | `Lien_Mark_Register` | `LienMarkRenderer.ts`, `LienMarkDefinition.ts` | **Portrait** (Legal) — 4-Loan section card layout |
| **09** | `Share_Certificate` | `ShareCertificateRenderer.ts`, `ShareCertificateSheet.tsx` | **Landscape** (13" × 19" / 9" × 13") — 3-Panel Certificate |
| **10** | `Voucher` | `VoucherRenderer.ts`, `VoucherSheet.tsx` | **Portrait** (A4 / Legal) — Payment vouchers |

---

## 3. Existing Excel Import Flow

1. **Workbook Ingestion (`MasterDataService.ts`):**
   - Reads `.xlsx` buffer using `XLSX.read(buffer, { type: 'buffer' })`.
   - Identifies sheets by exact and case-insensitive names:
     - `Society Master` / `Society Info` / `Society Details`
     - `Common File` / `Common Member Master` / `Member Master`
     - `Form I` / `Form I - Portrait`
     - `Form J` / `Form J - Portrait` / `Form J - Landscape`
     - `Share Register`
     - `Nomination Register`
     - `Property Register`
     - `Bank Lien Mark` / `Register of Lien Mark`
     - `Voucher Data` / `Voucher Register`
2. **Row Extraction (`getRows`):**
   - Scans the first 10 rows for a header row containing `Sr. No.`, `Serial No`, `Voucher No`.
   - Combines multi-tier headers (`TopHeader_SubHeader`) into tolerant keys.
   - Skips visual helper numbering rows (`(1)`, `(2)`, etc.).
3. **Column Extraction (`col`, `colDate`, `colSerial`):**
   - Matches candidate header names using normalized alphanumeric comparisons.
   - Maps raw cell values into `NormalizedMemberRecord`.

---

## 4. Existing Empty-Cell Behavior & Discovered Bugs

### Rule: "EMPTY MUST REMAIN EMPTY. NO FAKE DATA, NO PLACEHOLDERS, NO AUTOMATIC INVENTION."

### Audit Findings of Fallback / Invention Bugs in Existing Code:
1. **`FormMappingService.ts` (Line 349 - Form J):**
   ```typescript
   classOfMember: rec.classOfMember || (rec.memberName || rec.srNo ? 'Active Member' : '')
   ```
   - **Bug:** If `classOfMember` is blank in Excel, the code automatically invents `'Active Member'` instead of leaving it empty.
2. **`FormMappingService.ts` (Lines 458-472 - Share Certificate):**
   ```typescript
   noOfShares: rec.noOfShares || '10',
   shareValue: rec.valueOfShares || rec.totalAmountReceived || '500',
   distinctiveFrom: rec.sharesFrom || '001',
   distinctiveTo: rec.sharesTo || '010',
   issueCity: 'MUMBAI',
   ```
   - **Bug:** Hardcoded fallback values (`'10'`, `'500'`, `'001'`, `'010'`, `'MUMBAI'`) are injected when Excel cells are empty.
3. **`FormMappingService.ts` (Line 411 - Property Register):**
   ```typescript
   descriptionOfTenement: rec.descriptionOfTenement || (rec.flatNo ? `Flat/Unit: ${rec.flatNo} Wing: ${rec.wingNo || ''}` : '')
   ```
   - **Bug:** Auto-invents a description string if `descriptionOfTenement` is empty in Excel.
4. **`LienMarkRenderer.ts` & `FormJRenderer.ts`:**
   - Similar fallback checks where missing data fell back to static placeholder strings.

---

## 5. Existing Common Member Fields & Share Fields

### Audit of:
- `No. of Shares` (`noOfShares`)
- `Value of One Share` (`valueOfOneShare`)
- `Value of Shares` (`valueOfShares`)

### Findings:
- In `MasterDataService.ts`, `col(r, ...)` fetches values using `safeStr(val)`.
- However, in downstream renderers and calculators (such as `ShareRegisterRenderer.ts`, `ShareCertificateRenderer.ts`, and `FormMappingService.ts`), these fields were sometimes coerced with `parseInt(noOfShares)` or replaced with defaults (`'10'`, `'500'`).
- If an Excel cell contains alphanumeric, text, or symbolic entries (e.g. `10A`, `A10`, `10/20`, `₹500`, `500-B`, `ABC123`), the numeric parsing destroys the letters/symbols.
- **Required Behavior:**
  - Preserve exact raw string representation as imported from Excel for all displays and PDF outputs.
  - Only extract numeric amounts if arithmetic computation is legitimately and explicitly required, while maintaining the raw string for rendering.

---

## 6. Existing Hardcoded / Test Data ("HENU OS PRIVATE LIMITED")

### Audit of Where and Why It Is Being Inserted:
1. **`src/main/db.ts` (`JsonDatabaseAdapter.load`, Lines 108-122):**
   ```typescript
   if (this.data.societies.length === 0) {
     this.data.societies.push({
       id: 'default-society-1',
       society_name: 'HENU OS PRIVATE LIMITED',
       ...
     });
   }
   ```
   - **Root Cause:** Every time the JSON database loads on app startup, if `societies.length === 0` (e.g. after user deleted it), it automatically re-inserts `HENU OS PRIVATE LIMITED`!
2. **`src/main/index.ts` (`getActiveSociety()`, Lines 201-210):**
   ```typescript
   if (!row) {
     const id = 'default-society-1';
     db.prepare(`INSERT INTO societies ... VALUES (?, 'HENU OS PRIVATE LIMITED', ...)`).run(...);
   }
   ```
   - **Root Cause:** If all societies were deleted by the user, `getActiveSociety()` re-created the default record on next launch.
3. **`src/main/db.ts` (Migration v2, Line 800):**
   - Migration v2 inserts `'default-society-1'` if table is empty.
4. **`src/renderer/browserMockApi.ts`:**
   - Contains fallback mock society for browser testing.

### Target Fix Behavior for Prompt 2:
- Seed `HENU OS PRIVATE LIMITED` **only on a fresh initial install** (when `application_config` does not exist and `first_run_completed` is false).
- Once setup is completed or when the user deletes the society from Society Management, the application must **NEVER re-create or re-seed** the deleted record.
- If no societies exist, the system should prompt the user to create a society via `AddSocietyModal` rather than silently injecting fake data.

---

## 7. Existing Blank-Form Generation & Range Logic

### Audit of Blank Form Generation:
1. **Mode 1: WITHOUT SERIAL NUMBER (Existing Behavior):**
   - Implemented via `nonSerialCount` in `GenerateForms.tsx` and `PdfEngine.ts`.
   - Generates blank forms without any serial numbers (`BLANK_EXTRA_1.pdf`, etc.).
   - Existing behavior must remain intact.
2. **Mode 2: WITH SERIAL NUMBER (New Addition):**
   - User provides `FROM` and `TO` OR `FROM` and `TOTAL`.
   - **Two-Way Auto-Calculation Formula:**
     - When user inputs `FROM` and `TOTAL`: $\text{TO} = \text{FROM} + \text{TOTAL} - 1$
     - When user inputs `FROM` and `TO`: $\text{TOTAL} = \text{TO} - \text{FROM} + 1$
   - Prevents infinite update loops using controlled state triggers.
   - Supports **Prefix** (e.g., `SC`, `FORM`) and **Separator** (e.g., `-`, `/`, `_`, `.`, `:`) producing `SC-67`, `SC-68`, etc.

---

## 8. Existing PDF Engine & Print / Legal Page Format

### Detailed Geometry Audit:
- **Required Paper Size:** **LEGAL ONLY** (8.5 × 14.0 inches = **612 × 1008 points** at 72 dpi).
- **Required Margins (per visual reference specification):**
  - **LEFT:** 0.70 inch = **50.40 points**
  - **RIGHT:** 0.70 inch = **50.40 points**
  - **TOP:** 0.50 inch = **36.00 points**
  - **BOTTOM:** 0.50 inch = **36.00 points**

### Usable Content Drawing Areas:
1. **Legal Portrait (612 × 1008 pt):**
   - Width: $612 - (50.40 + 50.40) = \mathbf{511.20\text{ pt}}$ (7.10 inches)
   - Height: $1008 - (36.00 + 36.00) = \mathbf{936.00\text{ pt}}$ (13.00 inches)
2. **Legal Landscape (1008 × 612 pt):**
   - Width: $1008 - (50.40 + 50.40) = \mathbf{907.20\text{ pt}}$ (12.60 inches)
   - Height: $612 - (36.00 + 36.00) = \mathbf{540.00\text{ pt}}$ (7.50 inches)

### Audit of Current Margins in `PdfDocumentBuilder.ts`:
- Current `SAFE_MARGIN` was hardcoded to `54.00 pt` (0.75 in) on all 4 sides.
- In Prompt 2, `PdfDocumentBuilder.ts` will be updated to:
  - `marginLeft = 50.40 pt` (0.7 in)
  - `marginRight = 50.40 pt` (0.7 in)
  - `marginTop = 36.00 pt` (0.5 in)
  - `marginBottom = 36.00 pt` (0.5 in)

### Orientations by Module:
| Module | Orientation | Dimensions (pt) | Usable Box ($W \times H$ pt) |
|---|---|---|---|
| **Form I** | Portrait | $612 \times 1008$ | $511.2 \times 936.0$ |
| **Form J** | Portrait & Landscape | $612 \times 1008$ / $1008 \times 612$ | $511.2 \times 936.0$ / $907.2 \times 540.0$ |
| **Share Register** | Landscape | $1008 \times 612$ | $907.2 \times 540.0$ |
| **Property Register** | Landscape | $1008 \times 612$ | $907.2 \times 540.0$ |
| **Nomination Register** | Landscape | $1008 \times 612$ | $907.2 \times 540.0$ |
| **Bank Lien Mark** | Portrait | $612 \times 1008$ | $511.2 \times 936.0$ |
| **Share Certificate** | Landscape | Standard / Luxury dimensions | Scaled per template geometry |
| **Voucher** | Portrait | $595.28 \times 841.89$ (A4) or Legal | Configurable |

---

## 9. Exact Files to Modify in Prompt 2

| File Path | Purpose of Targeted Modification in Prompt 2 |
|---|---|
| `src/main/services/FormMappingService.ts` | Remove all invented defaults (`'Active Member'`, `'10'`, `'500'`, `'001'`, `'010'`, `'MUMBAI'`). Ensure empty remains empty. |
| `src/main/services/MasterDataService.ts` | Ensure `noOfShares`, `valueOfOneShare`, `valueOfShares` accept and retain raw alphanumeric/symbol strings without truncation. |
| `src/main/db.ts` | Remove automatic re-seeding of `'HENU OS PRIVATE LIMITED'` upon startup/deletion. Seed only on fresh first-run. |
| `src/main/index.ts` | Remove automatic re-insertion of `'HENU OS PRIVATE LIMITED'` in `getActiveSociety()`. |
| `src/main/services/renderers/PdfDocumentBuilder.ts` | Update Legal paper margins: Left/Right = 0.70 in (50.4 pt), Top/Bottom = 0.50 in (36.0 pt). |
| `src/renderer/pages/GenerateForms.tsx` | Add two-way calculation for `FROM`, `TO`, `TOTAL FORMS`, and prefix/separator customization for blank forms with serials. |
| `src/main/services/SerialRangeEngine.ts` | Support range calculation with prefix/separator for blank serial form generation. |
| `src/main/tests/TestRunner.ts` | Add unit/integration tests verifying empty cell integrity, alphanumeric shares, and Legal 0.7"/0.5" margins. |

---

## 10. Exact Files That MUST NOT Be Changed

1. **All Statutory Register Business Logic & Mathematical Formulas:**
   - `SerialRangeEngine.ts` (core algorithms for existing numbering)
   - `ValidationEngine.ts` (statutory validation rules)
   - `FormDesignSettingsService.ts` (typography & grid settings engine)
2. **OCR Modules & Web Automation Endpoints:**
   - `src/modules/henu-voucher-ocr/*`
   - `src/modules/henu-check-ocr/*`
   - `src/main/services/ocr-api/*`
   - `src/main/services/VoucherParserService.ts`
3. **Unrelated UI Pages & Navigation Shell:**
   - `src/renderer/pages/Dashboard.tsx`
   - `src/renderer/pages/MasterData.tsx`
   - `src/renderer/pages/SettingsPage.tsx`
   - `src/renderer/pages/GeneratedFiles.tsx`
   - `src/renderer/pages/henu-idf/*`
4. **HENU CONFIG & HENUMASTER Established Engines:**
   - `src/main/services/config/StorageEngine.ts`
   - `src/main/services/config/HenuConfigService.ts`
   - `src/main/services/config/DocumentRoutingService.ts`
   - `src/main/services/config/BackupService.ts`
   - `src/main/services/config/SystemHealthService.ts`
   - `src/main/services/master/HenuMasterService.ts`

---

## 11. Regression Risks & Mitigation Strategy

| Risk | Mitigation Strategy |
|---|---|
| **Alphanumeric shares breaking calculations** | Store raw string in member record; only parse numeric portions when summing in summary statistics while preserving raw string for PDF display. |
| **Deleting default society breaks active society context** | When the last society is deleted, return `null` or prompt the user to create a society via `AddSocietyModal` rather than crashing or re-inserting fake demo data. |
| **Two-way auto-calculation causing infinite re-render loops** | Use distinct event triggers (`onChange` handlers tracking the active user input field) rather than circular `useEffect` dependencies. |
| **Margin changes causing text overflow in tables** | Adjust column widths proportionally to the new content width ($511.2\text{ pt}$ portrait / $907.2\text{ pt}$ landscape) and test with long address and joint member strings. |

---

## 12. Safe Implementation Plan for Prompt 2

1. **Step 1 (Data Integrity & Empty Cell Rule):**
   - Update `FormMappingService.ts` to remove all fallback text and defaults across all 10 modules.
   - Update `MasterDataService.ts` to preserve raw string values for `noOfShares`, `valueOfOneShare`, and `valueOfShares`.
2. **Step 2 (Hardcoded Data Elimination):**
   - Clean `db.ts` and `index.ts` so `HENU OS PRIVATE LIMITED` is only inserted during unconfigured first-run setup, and never resurrected after deletion.
3. **Step 3 (Blank Form Dual-Mode & Two-Way Calculation):**
   - Enhance `GenerateForms.tsx` with two-way auto-calculation (`FROM + TOTAL - 1 = TO` and `TO - FROM + 1 = TOTAL`) and serial prefix/separator formatting.
4. **Step 4 (Legal Paper & 0.7"/0.5" Margins):**
   - Update `PdfDocumentBuilder.ts` with Left/Right = 0.7 in (50.4 pt) and Top/Bottom = 0.5 in (36.0 pt) for all 6 statutory form renderers.
5. **Step 5 (Automated Test Verification):**
   - Execute all 75+ automated test runner suites and build verification (`npm run build:main`, `npm run build:renderer`).

---

**End of Audit Report (`HENU_TARGETED_FIX_AUDIT.md`)**
