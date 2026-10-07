# HENU AI — OCR Local & API Mode Integration Architecture

## 1. Overview & System Architecture
The HENU AI Voucher OCR subsystem integrates two mutually-exclusive execution modes under a single, unified canonical schema:

```
                      ┌─────────────────────────┐
                      │    HENU OCR MODULE      │
                      └────────────┬────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              [ HENU AI ]                      [ APIs ]
                    │                             │
           USB Local Engine                  API Manager
          (100% Offline AI)             (External Vision API)
                    │                             │
          GLM-OCR / FireRed-OCR          Gemini / Grok / DeepSeek
             / Tesseract.js                   / OpenRouter
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                       CANONICAL OCR RESPONSE
                                   │
                         Normalization Engine
                                   │
                          Validation Engine
                                   │
                          Confidence Engine
                                   │
                         Voucher Review Gate
                                   │
                         Excel Export Service
                                   │
                              HENU OS
```

---

## 2. Execution Modes

### Mode 1: `[ HENU AI ]` (Default)
- **Execution Target:** Removable USB drive (`[USB]\HENU AI\`), dynamically discovered.
- **Hardware Profile:** Local sequential workers with automatic memory clearing.
- **Network Boundary:** Hard boundary. 0 network calls, 0 telemetry.
- **USB Missing Notice:** Displays `"Please insert the HENU AI Engine pen drive."`
- **Host System Impact:** Zero writes to `C:\`, `AppData`, Registry, or global Python.

### Mode 2: `[ APIs ]`
- **Execution Target:** Secure backend routing through Electron Main Process (`OcrApiManager`).
- **Supported Providers:** Google Gemini, xAI Grok, DeepSeek, OpenRouter.
- **Authentication:** Credentials stored in encrypted/isolated JSON vault (`userData/ocr_api_secrets.json`). API keys are NEVER exposed to browser JavaScript or renderer DOM.
- **Vision Pre-Flight:** Verifies model vision capability before request dispatch.
- **Network Indicator:** Explicitly flags `Internet: Required` and displays privacy notice.

---

## 3. Data Flow & Zero-Guessing Policy
Both modes feed directly into `FieldExtractor` and the 26-field canonical voucher schema:
1. **Zero Guessing:** If a field is blank, missing, or illegible, the normalized value remains `null` or `""`. No arithmetic invention.
2. **Anti-Concatenation:** Table amounts are extracted with row boundary isolation; adjacent vertical and horizontal numbers are never concatenated.
3. **Date Format:** Normalized to strict `DDMMYYYY` (8 digits).
4. **Excel Export:** Generates identical 3-sheet workbook (`Voucher Data`, `Accounting Validation`, `Evidence & Diagnostics`).
