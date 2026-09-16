# HENU OS Records Management — Comprehensive Architecture Report & Audit

**Date**: August 12, 2026  
**Status**: AUDIT COMPLETE — IMPLEMENTATION PAUSED FOR REVIEW  

---

## Executive Summary & Design Principles

This document provides the formal architectural audit and design specification for the **HENU OS Records Management** desktop application.

### Key Mandates
1. **No Background PDF / Image Overlays**: The production PDF engine must programmatically draw all lines, borders, headers, tables, text, and footers directly using `pdf-lib` primitives. Pre-existing PDF templates or image backgrounds are **STRICTLY FORBIDDEN**.
2. **Dynamic Content Layout**: Layouts and row heights must be calculated dynamically based on actual wrapped text height, avoiding overlapping or clipped text.
3. **Preservation of Existing Logic**: The Master Data Excel parser, canonical data model, serial number range engine (with leading-zero preservation), validation engine, and test suite must be fully preserved.
4. **Zero Data Fabrication**: Blank or missing data yields blank cells. Missing serials yield rows with serial number only.

---

## Section A: Current Architecture

```
                    ┌─────────────────────────┐
                    │ Master Excel File (.xlsx)│
                    └────────────┬────────────┘
                                 │
                                 ▼
                     ┌──────────────────────┐
                     │ MasterDataService.ts │
                     └───────────┬──────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Canonical Data Model   │
                    │       (types.ts)        │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         ┌─────────────────────┐   ┌─────────────────────┐
         │ ValidationEngine.ts │   │SerialRangeEngine.ts │
         └─────────────────────┘   └──────────┬──────────┘
                                              │
                                              ▼
                                    ┌───────────────────┐
                                    │   PdfEngine.ts    │
                                    │ (PDF-Overlay Map) │
                                    └─────────┬─────────┘
                                              │
                                   ┌──────────┴──────────┐
                                   ▼                     ▼
                             PDF Previews           ZipService.ts
```

### Existing Components:
- **Electron + React + TypeScript + SQLite**: Core desktop stack (`main/index.ts`, `renderer/App.tsx`, `db.ts`).
- **Master Data Importer (`MasterDataService.ts`)**: Reads 8 sheets (`Society Master`, `Common File`, `I form`, `J form`, `Share Register`, `Nomination Register`, `Property Register`, `Bank Line Mark Register`).
- **Serial Engine (`SerialRangeEngine.ts`)**: Handles `001-010` generation, preserves leading zero string representation, returns gap range lists.
- **Legacy Rendering System (`PdfEngine.ts`)**: Currently loads fixed PDF templates from `src/templates/*.pdf` and overlays text onto predefined `(x, y)` coordinates.

---

## Section B: Problems Found in Current Implementation

1. **PDF Background Template Dependency**:
   - The existing `PdfEngine.ts` relies on background PDF templates (`form-i.pdf`, `form-j.pdf`, etc.).
   - Overlays fixed coordinates onto background PDFs, causing alignment issues when text length varies or font auto-scaling triggers.
   - Violates the directive against background PDF/image rendering.

2. **Fixed Row Height vs. Variable Text**:
   - The current engine uses fixed row heights (e.g. 38pt for registers, 26pt for Form J) and fixed row capacities per page (10 or 20 rows).
   - Long addresses or multiple member names cannot expand the row dynamically without overflowing into adjacent row boxes.

3. **HTML/CSS Reference Misuse Risk**:
   - Reference files exist in `references/all template in html , css , js logics/` which could be mistakenly used as runtime renderers.

---

## Section C: Required Architecture

The application will transition to a **Pure Native Document Rendering Architecture**:

```
                       Canonical Data Model
                                │
                                ▼
                       Form Dispatcher Engine
                                │
   ┌───────────┬───────────┼────┴──────┬───────────┬───────────┐
   ▼           ▼           ▼           ▼           ▼           ▼
 FormI       FormJ       Share     Nomination   Property    LienMark
Renderer    Renderer   Renderer     Renderer    Renderer   Renderer
   │           │           │           │           │           │
   └───────────┴───────────┼───────────┴───────────┴───────────┘
                           ▼
             Shared Document Builder Primitives
          (Page, Header, Footer, Table, Grid, Text)
                           │
                           ▼
                  pdf-lib Native Canvas
             (Lines, Rectangles, Wrapped Text)
                           │
                           ▼
                     PDF / ZIP Output
```

---

## Section D: Normalized Data Model (`types.ts`)

The central source of truth represents society records cleanly without loss of structure:

1. **`SocietyMaster`**: Holds 12 core metadata fields including `societyName`, `registrationNo`, `registrationDate`, `address`, `email`, `telephone`, unit breakdown counts (`unitsFlat`, `unitsShop`, `unitsOffice`, `unitsGala`), and `printBlanks`.
2. **`CommonFileRecord`**: Holds member primary information (`srNo`, `membershipNo`, `shareCertificateNo`, `noOfShares`, `memberName`, `member1`..`member6`, `permanentAddress`, `flatNo`, `wingNo`, `residentialAddress`).
3. **Form Extensions**: `FormIRecord`, `FormJRecord`, `ShareRecord`, `NominationRecord`, `PropertyRecord`, `BankLineMarkRecord`.

---

## Section E: Six Renderer Architecture

Six dedicated renderer classes/modules will be created under `src/main/services/renderers/`:

| Renderer Name | Form ID | Target Orientation | Target Dimensions | Page Structure |
| :--- | :--- | :--- | :--- | :--- |
| `FormIRenderer` | `FORM_I` | **PORTRAIT** | A4 (595.28 x 841.89 pt) | Form Sections (Member details, Nomination, Shares, Transfer) |
| `FormJRenderer` | `FORM_J` | **PORTRAIT** | A4 (595.28 x 841.89 pt) | Ledger Table (Sr. No., Member Name, Address, Class of Member) |
| `ShareRegisterRenderer` | `FORM_SHARE` | **LANDSCAPE** | A4 (841.89 x 595.28 pt) | Multi-column Share Ledger Table |
| `NominationRegisterRenderer` | `FORM_NOM` | **LANDSCAPE** | A4 (841.89 x 595.28 pt) | Nomination Ledger Table |
| `PropertyRegisterRenderer` | `FORM_PROP` | **LANDSCAPE** | A4 (841.89 x 595.28 pt) | Tenement & Property Ledger Table |
| `LienMarkRenderer` | `FORM_BANK` | **LANDSCAPE** | A4 (841.89 x 595.28 pt) | Bank Loan / Lien Mark Ledger Table |

---

## Section F: Import & Validation Architecture

- **`MasterDataService.ts`**:
  - Preserved fully. Converts raw Excel rows into normalized typed records.
  - Employs strict cell format parsers to ensure dates are standard (`DD/MM/YYYY`) and string numbers preserve leading zeros (`001`).
- **`ValidationEngine.ts`**:
  - Validates presence of mandatory society fields.
  - Validates serial ranges (`FROM <= TO`).
  - Identifies gap serials and returns appropriate non-blocking warnings.

---

## Section G: Pagination & Dynamic Row Height Engine

The new layout system computes table dimensions dynamically:

1. **Wrapped Line Computation**:
   - For every table cell, measure text width using font metrics at configured font size.
   - Wrap text into lines fitting cell column width.
2. **Dynamic Row Height Calculation**:
   - `rowHeight = max(minRowHeight, maxLinesInRow * lineSpacing * fontSize + padding)`.
3. **Flow-Based Page Breaks**:
   - Keep track of `currentY` on the page.
   - If `currentY - calculatedRowHeight < bottomMargin`, trigger a page break:
     - Render global footer at current page bottom.
     - Add new page to `PDFDocument`.
     - Render global society header on new page.
     - Re-render repeated table header row.
     - Continue drawing data row.

---

## Section H: PDF Generation Architecture

The PDF generation workflow:
1. `PdfEngine.ts` receives request `(formId, fromSerial, toSerial, workbook)`.
2. Resolves serial range using `SerialRangeEngine`.
3. Calls `resolveRecord(formId, serialNo)` for each serial number.
4. Delegates to the specific form renderer (e.g. `ShareRegisterRenderer.render(...)`).
5. Renderer uses `PdfDocumentBuilder` primitives to draw page elements natively via `pdf-lib`.
6. Returns `Buffer` for preview or file save.

---

## Section I: ZIP Generation Architecture

- `ZipService.ts` receives generated PDF buffers.
- For Form I: Packages individual member PDFs into `HENU_OS_FORM_I_001-010.zip`.
- For Registers (J, Share, Nom, Prop, Bank): Packages multi-page combined PDF into `HENU_OS_REGISTER_001-010.zip`.

---

## Section J: Components to be Preserved

1. **Excel Parsing Engine (`MasterDataService.ts`)**.
2. **Serial Normalization & Gap Engine (`SerialRangeEngine.ts`)**.
3. **Canonical Data Interfaces (`types.ts`)**.
4. **Validation Logic (`ValidationEngine.ts`)**.
5. **Database Storage & IPC Architecture (`db.ts`, `index.ts`, `preload.ts`)**.
6. **Automated CLI Test Runner (`TestRunner.ts`) — All 22 tests**.
7. **Frontend UI Components (`GenerateForms.tsx`, `MasterData.tsx`, `SettingsPage.tsx`)**.

---

## Section K: Components to be Replaced

1. **Background PDF Overlays**: Delete dependency on pre-existing PDF background templates in `src/templates/*.pdf`.
2. **Static Coordinate Mapping (`mappings.ts`)**: Replace fixed `(x, y)` static tables with dynamic programmatic rendering primitives.
3. **Hardcoded PDF Generation (`PdfEngine.ts`)**: Replace current overlay logic with six dedicated programmatic native renderers.

---

**Audit Sign-off**: The codebase audit is complete. Implementation of the six renderers is paused awaiting user confirmation to proceed to Phase 2 (Core Programmatic Rendering Primitives).
