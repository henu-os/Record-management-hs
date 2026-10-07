# HENU AI — OCR LOCAL / API MODE INTEGRATION AUDIT
## Date: 2026-09-19
## Target System: `G:\Astro` (HENU OS Records Management)
## Document: `docs/API_OCR_INTEGRATION_AUDIT.md`

---

## 1. CURRENT OCR ENTRY POINT

The Voucher OCR entry point in the application is:
- **Router / Page**: `src/renderer/pages/voucher-ocr/HenuVoucherOcrPage.tsx`
- **Sub-Views**:
  - `VoucherDashboard.tsx`: Statistics and processing metrics
  - `VoucherInbox.tsx`: File dropzone, upload triggers, batch processing
  - `SingleVoucherUpload.tsx` & `BatchPdfUpload.tsx`: Image / PDF input intake
  - `VoucherReviewScreen.tsx`: 26-field interactive human review & validation
  - `VoucherDataTable.tsx`: Completed records list

The primary user interaction flow starts in `VoucherInbox.tsx` or `SingleVoucherUpload.tsx`, which triggers image pre-processing and dispatches OCR extraction jobs.

---

## 2. CURRENT LOCAL HENU AI EXECUTION PATH

```
User Drops Image (VoucherInbox / SingleVoucherUpload)
    │
    ▼
Check Engine Status (HenuAiEngineManager / TesseractLocalEngine)
    │
    ├── [HENU AI USB Engine Mode]
    │       ├── Dynamic USB Discovery (D:, E:, F:, G:, etc.)
    │       ├── USB Identity Validation (manifest.json + DEVICE_ID.txt + VERSION.txt)
    │       ├── Authorization Gate (validateOcrAuthorization())
    │       ├── Sequential Model Pipeline (GLM-OCR -> FireRed-OCR)
    │       └── Preprocessing -> Consensus -> Field Extraction -> Normalization
    │
    ▼
FieldExtractor & NormalizationEngine (26 Canonical Fields)
    │
    ▼
ValidationEngine (Mandatory Checks, Accounting Arithmetic Rules)
    │
    ▼
ConfidenceEngine (0 - 100% Bounded Multi-Factor Score)
    │
    ▼
VoucherReviewScreen (Side-by-side Image & 26 Editable Fields)
    │
    ▼
ExcelExportService (3-Sheet Publication XLSX on USB exports/)
```

---

## 3. CURRENT SETTINGS ARCHITECTURE

- **Page**: `src/renderer/pages/SettingsPage.tsx`
- **Tabs**:
  - `global`: Global Defaults
  - `FORM_I`, `FORM_J`, `FORM_SHARE`, `FORM_NOM`, `FORM_PROP`, `FORM_BANK`: Register Form Design
  - `voucher_ocr`: HENU Voucher OCR Dedicated Settings (`VoucherOcrSettingsSection.tsx`)
- **Backend IPC Handlers**:
  - `settings:getFormSettings` / `settings:saveFormSettings` (in `src/main/index.ts` backed by SQLite/JSON in `userData`)
  - `henuAi:getStatus`, `henuAi:setPower`, `henuAi:detectUsb` (in `src/main/services/HenuAiEngineManager.ts`)

---

## 4. EXISTING CONFIGURATION MECHANISM

- Non-sensitive form settings are stored via `db.ts` / SQLite in `user_settings` table.
- System paths and user data directories are resolved dynamically via Electron `app.getPath('userData')`.
- HENU AI engine configuration is read dynamically from `[USB]\HENU AI\manifest.json` and `[USB]\HENU AI\config\*.json`.

---

## 5. EXISTING SECRETS / KEY HANDLING

- Current system operates 100% offline with zero cloud API keys stored.
- For the new **APIs** mode, an isolated credential store will be created in the main process:
  - File: `userData/secure_ocr_credentials.json` (or encrypted via Electron `safeStorage`).
  - Sensitive API keys are stored in the main process and **NEVER returned in plain text to the renderer**.
  - Frontend only receives `{ hasApiKey: boolean, provider: string, model: string, lastTestedAt: string }`.

---

## 6. EXISTING OCR RESULT SCHEMA

The canonical internal data representation (`VoucherProcessingRecord`) defined in `src/modules/henu-voucher-ocr/schema/types.ts` contains:
```typescript
interface VoucherProcessingRecord {
  id: string;
  sourceFile: string;
  sourcePage: number;
  totalPages: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  overallConfidence: number; // strictly 0 - 100
  reviewRequired: boolean;
  validationIssues: ValidationIssue[];
  fields: ExtractedVoucherFields; // all 26 canonical fields
  rawText?: string;
  processedAt: string;
  sourceEngine?: string; // e.g. "HENU_AI_GLM_OCR" | "API_GEMINI" | "API_GROK" | "API_DEEPSEEK" | "API_OPENROUTER"
}
```

---

## 7. EXISTING EXCEL EXPORT SCHEMA

Defined in `src/modules/henu-voucher-ocr/excel/ExcelExportService.ts`:
- **Sheet 1 (`Voucher Data`)**: 26 canonical columns with currency (`#,##0.00`) and date formatting.
- **Sheet 2 (`Accounting Validation`)**: Mathematical breakdown (Bill Amount 1, TDS, Total 2, Net Paid Observed, Net Paid Calculated, Status).
- **Sheet 3 (`Evidence & Diagnostics`)**: Field key, raw text, normalized value, confidence %, validation status, and source engine.

---

## 8. FILES THAT MUST BE MODIFIED

1. `src/main/preload.ts`: Add `ocrApi` IPC bridge methods (`getConfig`, `saveConfig`, `testConnection`, `processVoucher`, `getMode`, `setMode`).
2. `src/main/index.ts`: Register `ocrApi:*` IPC handlers.
3. `src/renderer/pages/voucher-ocr/components/VoucherOcrSettingsSection.tsx`: Add mode switch `[ HENU AI ] [ APIs ]`, provider selection (Gemini, Grok, DeepSeek, OpenRouter), API key input, model selector, live status badge, and Test Connection button.
4. `src/renderer/pages/voucher-ocr/HenuVoucherOcrPage.tsx`: Add header mode switch `[ HENU AI ] [ APIs ]` and status banner.
5. `src/renderer/pages/voucher-ocr/components/VoucherInbox.tsx`: Route voucher upload to active mode (USB engine vs selected API provider).
6. `src/modules/henu-voucher-ocr/schema/types.ts`: Add OCR mode types and API provider metadata.

---

## 9. FILES THAT MUST NOT BE MODIFIED

- Accounting core modules (`src/main/services/renderers/`, `src/main/db.ts`, register forms I, J, Share, Nomination, Property, Bank Lien).
- Core validation mathematical formulas in `ValidationEngine.ts` (validation rules apply universally to both local and API results).
- Schema integrity of `HENU_VOUCHER_FIELDS` in `voucherSchema.ts`.
- Master templates in `src/modules/henu-voucher-ocr/templates/`.

---

## 10. RISKS AND COMPATIBILITY ISSUES

| Risk | Mitigation |
|---|---|
| API Key leakage to renderer or logs | Store in main process only; sanitize all logs; never put API key in JSON results or Excel. |
| Malformed or hallucinated API responses | Strict schema validation before passing to `NormalizationEngine`; zero guessing for missing fields. |
| Number concatenation in API mode | Provide strict JSON extraction prompts with separate row-level field schemas. |
| Network timeout or rate limit | Implement structured error categories (`INVALID_API_KEY`, `RATE_LIMITED`, `VISION_NOT_SUPPORTED`, `NETWORK_ERROR`) with graceful UI feedback. |
| Accidental automatic provider fallback | Hard constraint: failure halts the job with a clear error; never silently switch providers or modes. |
| Incompatible non-vision models | Capability pre-flight check flags vision support before allowing OCR requests. |
