# HENU AI — Dual-Mode OCR Routing Architecture

## 1. UI Switch Specification
The top-level switcher controls the active execution mode across both the **Voucher OCR Workspace** and **Settings → OCR**:

```
[ HENU AI ]    [ APIs ]
```

- **Exact Labels:** Strictly `[ HENU AI ]` and `[ APIs ]` (Never ON/OFF, Cloud, etc.).
- **Exclusivity:** Segmented switch; only one active mode at a time.
- **Default Mode:** `HENU AI` (USB Local Offline Engine).

---

## 2. Mode Differences & Behavior Matrix

| Feature | `[ HENU AI ]` Mode | `[ APIs ]` Mode |
|---|---|---|
| **Engine Source** | Dynamic USB Drive (`[USB]\HENU AI\`) | Configured Cloud AI Provider |
| **Active Provider** | Local Models (GLM-OCR / FireRed-OCR / Tesseract) | Selected Provider (Gemini / Grok / DeepSeek / OpenRouter) |
| **Internet Requirement** | **Not Required** (100% Offline) | **Required** (TLS Outbound Request) |
| **Missing USB State** | Shows `"Please insert the HENU AI Engine pen drive."` | Allowed (Processes via configured API) |
| **Security Handling** | Hardware boundary (No cloud sockets) | Main-process credential vault isolation |
| **Field Extraction** | Standard Canonical FieldExtractor | `FieldExtractor.extractFromApiResult` |
| **Normalization** | `NormalizationEngine` (DDMMYYYY dates, numeric currency) | `NormalizationEngine` (Identical rules) |
| **Validation** | `ValidationEngine` (Arithmetic & required field check) | `ValidationEngine` (Identical rules) |
| **Human Review Screen** | `VoucherReviewScreen` (Confidence & warnings) | `VoucherReviewScreen` (Identical UI) |
| **Excel Export** | `ExcelExportService` (3 sheets, verified cells) | `ExcelExportService` (Identical 3-sheet schema) |
| **Zero Guessing** | Strictly enforced (null on missing fields) | Strictly enforced (null on missing fields) |
| **Anti-Concatenation** | Row boundary isolation | Structured JSON row field mapping |
