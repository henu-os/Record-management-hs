# HENU AI — API Security & Secret Isolation Architecture

## 1. Zero-Credential Leakage Guarantee
API keys and secret tokens are treated as integrity-sensitive credentials:

| Channel / Artifact | Security Guarantee | Implementation Mechanism |
|---|---|---|
| **Source Code & Git** | 100% Free of API Keys | Key storage is isolated to local runtime `userData` |
| **Renderer Process (DOM/JS)** | Never receives plain API key | `OcrApiManager` returns boolean `hasApiKey` only |
| **OCR Result Schema & JSON** | Zero API keys | Schema contains only `sourceEngine`, `provider`, and `model` |
| **Excel Exports (.xlsx)** | Zero API keys | `ExcelExportService` strictly formats financial fields |
| **Audit Logs (`logs/api_ocr.log`)** | Fully sanitized | Regex redacts bearer tokens, query params, and raw keys |
| **Error Messages & UI** | Safe category mapping | `getSafeError()` translates raw HTTP/API exceptions |

---

## 2. Secure Secret Storage Vault
- **Storage Path:** `<userData>/ocr_api_secrets.json` (Separate from non-sensitive `<userData>/ocr_api_config.json`).
- **Access Boundary:** Accessible only by Electron Main Process. Renderer invokes methods via strictly defined IPC channels (`contextBridge.exposeInMainWorld`).
- **Separation of Concerns:**
  - `ocr_api_config.json`: Stores `mode`, `activeProvider`, `model`, `visionSupported`, `connectionStatus`, `lastTestedAt`.
  - `ocr_api_secrets.json`: Stores isolated API keys.

---

## 3. Strict Execution Isolation
- When `HENU AI` mode is selected:
  - Hard code boundary blocks external dispatch.
  - Zero outgoing HTTP/HTTPS sockets opened to external AI providers.
  - Audit log records `MODE=HENU_AI API_CALL=false`.
- When `APIs` mode is selected:
  - Invokes ONLY the selected provider.
  - No automatic waterfall or failover across providers (prevents surprise API charges).
  - Single controlled retry on transient errors; fails cleanly if persistent.
