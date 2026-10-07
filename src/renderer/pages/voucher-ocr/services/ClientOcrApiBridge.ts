/**
 * HENU VOUCHER OCR — CLIENT OCR API RESILIENT BRIDGE
 * Provides unified interface for OCR API operations with automatic fallback
 * between Electron IPC backend and browser-native authenticated endpoints.
 */

import type { ApiProviderId, OcrApiGlobalConfig, ConnectionTestResult, OcrApiExtractionResult } from '../../../../main/services/ocr-api/types';

const CONFIG_KEY = 'henu_ocr_api_config';
const SECRETS_KEY = 'henu_ocr_api_secrets';

function getStoredLocalConfig(): OcrApiGlobalConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      // Auto-migrate obsolete or quota-limited models to gemini-2.5-flash-lite
      if (cfg.providers?.gemini) {
        if (!cfg.providers.gemini.model || cfg.providers.gemini.model.includes('1.5') || cfg.providers.gemini.model === 'gemini-pro-latest') {
          cfg.providers.gemini.model = 'gemini-2.5-flash-lite';
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        }
      }
      return cfg;
    }
  } catch {}
  return {
    mode: 'HENU_AI',
    activeProvider: 'gemini',
    providers: {
      gemini: { provider: 'gemini', model: 'gemini-2.5-flash-lite', hasApiKey: false, visionSupported: 'SUPPORTED', connectionStatus: 'NOT_TESTED' },
      grok: { provider: 'grok', model: 'grok-2-vision-1212', hasApiKey: false, visionSupported: 'SUPPORTED', connectionStatus: 'NOT_TESTED' },
      deepseek: { provider: 'deepseek', model: 'deepseek-chat', hasApiKey: false, visionSupported: 'UNSUPPORTED', connectionStatus: 'NOT_TESTED' },
      openrouter: { provider: 'openrouter', model: 'google/gemini-flash-1.5', hasApiKey: false, visionSupported: 'SUPPORTED', connectionStatus: 'NOT_TESTED' },
    },
  };
}

function getStoredLocalSecrets(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (raw) {
      const secrets = JSON.parse(raw);
      if (secrets && Object.keys(secrets).length > 0) return secrets;
    }
  } catch {}
  return {};
}

export class ClientOcrApiBridge {
  public static async getConfig(): Promise<OcrApiGlobalConfig> {
    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.getConfig) {
      try {
        const res = await api.ocrApi.getConfig();
        if (res && !res.error && res.providers) {
          const secrets = getStoredLocalSecrets();
          for (const p of Object.keys(res.providers) as ApiProviderId[]) {
            if (secrets[p]) {
              res.providers[p].hasApiKey = true;
            }
          }
          return res;
        }
      } catch (err) {
        console.warn('IPC getConfig fallback to local vault:', err);
      }
    }

    // In browser / dev-server mode, fetch from server endpoints if available
    try {
      if (typeof window !== 'undefined') {
        const secRes = await fetch('/api/ocr-secrets').catch(() => null);
        if (secRes && secRes.ok) {
          const secJson = await secRes.json().catch(() => ({}));
          const currentSecrets = getStoredLocalSecrets();
          for (const [k, v] of Object.entries(secJson)) {
            if (v && (v as any).apiKey && !currentSecrets[k]) {
              currentSecrets[k] = (v as any).apiKey;
            }
          }
          localStorage.setItem(SECRETS_KEY, JSON.stringify(currentSecrets));
        }
      }
    } catch {}

    const cfg = getStoredLocalConfig();
    const secrets = getStoredLocalSecrets();
    for (const p of Object.keys(cfg.providers) as ApiProviderId[]) {
      cfg.providers[p].hasApiKey = !!(secrets[p] && secrets[p].trim().length > 0);
    }
    return cfg;
  }

  public static async setMode(mode: 'HENU_AI' | 'APIS'): Promise<OcrApiGlobalConfig> {
    const cfg = getStoredLocalConfig();
    cfg.mode = mode;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.setMode) {
      try {
        const res = await api.ocrApi.setMode(mode);
        if (res && !res.error) return res;
      } catch (err) {
        console.warn('IPC setMode fallback to local storage:', err);
      }
    }

    return cfg;
  }

  public static async setActiveProvider(providerId: ApiProviderId): Promise<OcrApiGlobalConfig> {
    const cfg = getStoredLocalConfig();
    cfg.activeProvider = providerId;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.setActiveProvider) {
      try {
        const res = await api.ocrApi.setActiveProvider(providerId);
        if (res && !res.error) return res;
      } catch (err) {
        console.warn('IPC setActiveProvider fallback to local storage:', err);
      }
    }

    return cfg;
  }

  public static async saveProviderConfig(
    providerId: ApiProviderId,
    config: { model?: string; apiKey?: string }
  ): Promise<OcrApiGlobalConfig> {
    // 1. Update Local Vault
    const cfg = getStoredLocalConfig();
    const secrets = getStoredLocalSecrets();

    const targetModel = config.model?.trim() || cfg.providers[providerId]?.model || 'default';
    if (!cfg.providers[providerId]) {
      cfg.providers[providerId] = {
        provider: providerId,
        model: targetModel,
        hasApiKey: false,
        visionSupported: providerId === 'deepseek' && targetModel.includes('chat') ? 'UNSUPPORTED' : 'SUPPORTED',
        connectionStatus: 'NOT_TESTED',
      };
    } else {
      cfg.providers[providerId].model = targetModel;
      cfg.providers[providerId].visionSupported = providerId === 'deepseek' && targetModel.includes('chat') ? 'UNSUPPORTED' : 'SUPPORTED';
    }

    if (config.apiKey !== undefined && config.apiKey !== null) {
      const cleanKey = config.apiKey.trim();
      if (cleanKey.length > 0) {
        secrets[providerId] = cleanKey;
        cfg.providers[providerId].hasApiKey = true;
      } else {
        delete secrets[providerId];
        cfg.providers[providerId].hasApiKey = false;
        cfg.providers[providerId].connectionStatus = 'NOT_TESTED';
      }
      localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
    }

    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

    // 2. Sync to Electron Main Process IPC if available
    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.saveProviderConfig) {
      try {
        const res = await api.ocrApi.saveProviderConfig(providerId, targetModel, config.apiKey);
        if (res && !res.error && res.providers) {
          return res;
        }
      } catch (ipcErr) {
        console.warn('IPC saveProviderConfig fallback to local storage:', ipcErr);
      }
    }

    return cfg;
  }

  public static async testConnection(
    providerId: ApiProviderId,
    directApiKey?: string,
    directModel?: string
  ): Promise<ConnectionTestResult> {
    const cfg = getStoredLocalConfig();
    const secrets = getStoredLocalSecrets();
    const apiKey = (directApiKey && directApiKey.trim().length > 0) ? directApiKey.trim() : secrets[providerId];
    const prov = cfg.providers[providerId];
    const model = directModel?.trim() || prov?.model || 'default';
    const start = Date.now();

    // If API key is provided directly, save it in local secrets
    if (directApiKey && directApiKey.trim().length > 0) {
      secrets[providerId] = directApiKey.trim();
      localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
      if (prov) {
        prov.hasApiKey = true;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      }
    }

    // Try Electron IPC first
    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.testConnection) {
      try {
        const res = await api.ocrApi.testConnection(providerId);
        if (res && (res.success !== undefined || res.timestamp)) {
          return res;
        }
      } catch (ipcErr) {
        console.warn('IPC testConnection fallback to direct fetch:', ipcErr);
      }
    }

    if (!apiKey) {
      const res: ConnectionTestResult = {
        success: false,
        provider: providerId,
        model,
        latencyMs: 0,
        visionSupported: prov?.visionSupported === 'SUPPORTED',
        errorCategory: 'INVALID_API_KEY',
        errorMessage: `No API key saved for provider "${providerId}". Please enter your API key first.`,
        timestamp: new Date().toISOString(),
      };
      if (prov) {
        prov.connectionStatus = 'FAILED';
        prov.lastTestedAt = res.timestamp;
        prov.lastError = res.errorMessage;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      }
      return res;
    }

    // Direct Authenticated Connection Test Fallback
    try {
      if (providerId === 'gemini') {
        const candidateModels = [
          ...(model && !model.includes('1.5') ? [model.trim()] : []),
          'gemini-2.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-flash-latest',
          'gemini-3-flash-preview',
          'gemini-pro-latest',
        ];

        let workingModel = '';
        let lastErr = '';
        let status = 0;

        for (const targetModel of Array.from(new Set(candidateModels))) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Ping test' }] }],
                generationConfig: { maxOutputTokens: 5 },
              }),
            });

            if (response.ok) {
              workingModel = targetModel;
              status = response.status;
              break;
            } else {
              status = response.status;
              const errBody = await response.json().catch(() => ({}));
              lastErr = errBody?.error?.message || `HTTP ${response.status}`;
            }
          } catch (e: any) {
            lastErr = e?.message || String(e);
          }
        }

        const latencyMs = Date.now() - start;
        if (!workingModel) {
          throw new Error(lastErr || 'Connection failed on all available Gemini models');
        }

        const res: ConnectionTestResult = {
          success: true,
          provider: providerId,
          model: workingModel,
          latencyMs,
          visionSupported: true,
          httpStatus: status || 200,
          timestamp: new Date().toISOString(),
        };
        if (prov) {
          prov.model = workingModel;
          prov.connectionStatus = 'PASSED';
          prov.lastTestedAt = res.timestamp;
          prov.lastLatencyMs = latencyMs;
          delete prov.lastError;
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        }
        return res;
      } else if (providerId === 'grok') {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });

        const latencyMs = Date.now() - start;
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const res: ConnectionTestResult = {
          success: true,
          provider: providerId,
          model,
          latencyMs,
          visionSupported: true,
          httpStatus: response.status,
          timestamp: new Date().toISOString(),
        };
        if (prov) {
          prov.connectionStatus = 'PASSED';
          prov.lastTestedAt = res.timestamp;
          prov.lastLatencyMs = latencyMs;
          delete prov.lastError;
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        }
        return res;
      } else if (providerId === 'deepseek') {
        let response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        }).catch(async () => {
          return await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Ping' }],
              max_tokens: 5,
            }),
          });
        });

        const latencyMs = Date.now() - start;
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const res: ConnectionTestResult = {
          success: true,
          provider: providerId,
          model,
          latencyMs,
          visionSupported: !model.includes('chat') && !model.includes('reasoner'),
          httpStatus: response.status,
          timestamp: new Date().toISOString(),
        };
        if (prov) {
          prov.connectionStatus = 'PASSED';
          prov.lastTestedAt = res.timestamp;
          prov.lastLatencyMs = latencyMs;
          delete prov.lastError;
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        }
        return res;
      } else if (providerId === 'openrouter') {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174',
            'X-Title': 'HENU OS',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });

        const latencyMs = Date.now() - start;
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const res: ConnectionTestResult = {
          success: true,
          provider: providerId,
          model,
          latencyMs,
          visionSupported: true,
          httpStatus: response.status,
          timestamp: new Date().toISOString(),
        };
        if (prov) {
          prov.connectionStatus = 'PASSED';
          prov.lastTestedAt = res.timestamp;
          prov.lastLatencyMs = latencyMs;
          delete prov.lastError;
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        }
        return res;
      } else {
        throw new Error(`Unsupported provider: ${providerId}`);
      }
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const res: ConnectionTestResult = {
        success: false,
        provider: providerId,
        model,
        latencyMs,
        visionSupported: prov?.visionSupported === 'SUPPORTED',
        errorCategory: 'CONNECTION_FAILED',
        errorMessage: err?.message || 'Connection failed',
        timestamp: new Date().toISOString(),
      };
      if (prov) {
        prov.connectionStatus = 'FAILED';
        prov.lastTestedAt = res.timestamp;
        prov.lastError = res.errorMessage;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      }
      return res;
    }
  }

  public static async processVoucher(
    req: { base64Image: string; mimeType: string; fileName: string }
  ): Promise<OcrApiExtractionResult> {
    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.processVoucher) {
      try {
        const res = await api.ocrApi.processVoucher(req.base64Image, req.mimeType, req.fileName);
        if (res && res.sourceEngine) {
          return res;
        }
      } catch (ipcErr) {
        console.warn('IPC processVoucher fallback to direct fetch:', ipcErr);
      }
    }

    const cfg = getStoredLocalConfig();
    const secrets = getStoredLocalSecrets();
    const activeProv = cfg.activeProvider || 'gemini';
    const provSetting = cfg.providers[activeProv];
    const apiKey = secrets[activeProv];
    const model = provSetting?.model || 'gemini-2.5-flash-lite';

    if (!apiKey) {
      return {
        success: false,
        sourceEngine: `API_${activeProv.toUpperCase()}`,
        provider: activeProv,
        model,
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'INVALID_API_KEY',
        errorMessage: `No API key configured for provider "${activeProv}". Please configure in Settings -> OCR.`,
      };
    }

    const cleanBase64 = req.base64Image.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');
    const start = Date.now();

    const systemPrompt = `You are a specialized accounting document OCR engine for Co-operative Housing Society payment vouchers.
Analyze the provided voucher image and extract the 26 canonical fields into the exact JSON format below.

CRITICAL ACCOUNTING RULES:
1. ZERO GUESSING: If a field is blank, missing, or illegible, set its value to null. Never invent or calculate missing fields.
2. ROW ISOLATION: Never concatenate numbers across adjacent rows or columns. Extract each amount strictly from its own row.
3. DATES: Format dates as DD/MM/YYYY (e.g. 08/04/2026). If blank, return null.
4. AMOUNTS: Return amounts as plain numbers (e.g. 25161.00, 252.00, 5000.00, 19909.00). Do not include currency symbols.
5. NET PAID: Extract the observed Net Paid directly from the voucher pixels. Do not replace it with an arithmetic formula.
6. PARTICULARS: Capture the complete meaningful narration from the voucher.

Return ONLY a valid JSON object matching this schema with no markdown formatting:
{
  "society_name": string | null,
  "registration_no": string | null,
  "society_address": string | null,
  "voucher_no": string | null,
  "voucher_date": string | null,
  "pay_to": string | null,
  "charge_to": string | null,
  "particulars": string | null,
  "bill_amount_1": number | null,
  "bill_amount_2": number | null,
  "advance_paid": number | null,
  "total_1": number | null,
  "tds_percentage": number | null,
  "tds_amount": number | null,
  "total_2": number | null,
  "cgst_percentage": number | null,
  "cgst_amount": number | null,
  "sgst_percentage": number | null,
  "sgst_amount": number | null,
  "round_off": number | null,
  "bill_no": string | null,
  "bank_name": string | null,
  "cheque_no": string | null,
  "cheque_date": string | null,
  "rupees": string | null,
  "net_paid": number | null,
  "confidence_scores": {
    "society_name": number,
    "voucher_date": number,
    "pay_to": number,
    "bill_amount_1": number,
    "net_paid": number
  }
}`;

    try {
      if (activeProv === 'gemini') {
        const candidateModels = [
          ...(model && !model.includes('1.5') ? [model.trim()] : []),
          'gemini-2.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-flash-latest',
          'gemini-3-flash-preview',
          'gemini-pro-latest',
        ];

        let workingModel = '';
        let lastErr = '';
        let extractedText = '{}';
        let parsed: any = {};

        for (const targetModel of Array.from(new Set(candidateModels))) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: systemPrompt },
                      { inlineData: { mimeType: req.mimeType || 'image/jpeg', data: cleanBase64 } },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              try {
                const cleanedText = extractedText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanedText);
              } catch {
                parsed = {};
              }
              workingModel = targetModel;
              break;
            } else {
              const err = await response.json().catch(() => ({}));
              lastErr = err?.error?.message || `HTTP ${response.status}`;
            }
          } catch (e: any) {
            lastErr = e?.message || String(e);
          }
        }

        const latencyMs = Date.now() - start;
        if (!workingModel) {
          throw new Error(lastErr || 'Extraction failed across all available Gemini models');
        }

        const structuredFields: Record<string, any> = {};
        const confScores = parsed.confidence_scores || {};
        for (const [k, v] of Object.entries(parsed)) {
          if (k === 'confidence_scores') continue;
          const conf = typeof confScores[k] === 'number'
            ? (confScores[k] <= 1.0 ? Math.round(confScores[k] * 100) : Math.round(confScores[k]))
            : 90;
          structuredFields[k] = {
            rawValue: v !== null && v !== undefined ? String(v) : '',
            normalizedValue: v,
            confidence: v !== null && v !== undefined ? conf : 0,
          };
        }

        return {
          success: true,
          sourceEngine: 'API_GEMINI',
          provider: 'gemini',
          model: workingModel,
          latencyMs,
          rawText: extractedText,
          rawResponseJson: parsed,
          structuredFields,
        };
      } else {
        const endpoint = activeProv === 'grok'
          ? 'https://api.x.ai/v1/chat/completions'
          : activeProv === 'openrouter'
          ? 'https://openrouter.ai/api/v1/chat/completions'
          : 'https://api.deepseek.com/chat/completions';

        const extraHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        if (activeProv === 'openrouter') {
          extraHeaders['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
          extraHeaders['X-Title'] = 'HENU OS';
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: extraHeaders,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extract voucher fields into JSON' },
                  { type: 'image_url', image_url: { url: `data:${req.mimeType || 'image/png'};base64,${cleanBase64}` } },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        const latencyMs = Date.now() - start;
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(text);

        const structuredFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          structuredFields[k] = {
            rawValue: v !== null && v !== undefined ? String(v) : '',
            normalizedValue: v,
            confidence: 90,
          };
        }

        return {
          success: true,
          sourceEngine: `API_${activeProv.toUpperCase()}`,
          provider: activeProv,
          model,
          latencyMs,
          rawText: text,
          rawResponseJson: parsed,
          structuredFields,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        sourceEngine: `API_${activeProv.toUpperCase()}`,
        provider: activeProv,
        model,
        latencyMs: Date.now() - start,
        rawText: '',
        structuredFields: {},
        errorCategory: 'API_ERROR',
        errorMessage: err?.message || 'API extraction failed',
      };
    }
  }

  public static async processCheck(
    req: { base64Image: string; mimeType: string; fileName: string }
  ): Promise<OcrApiExtractionResult> {
    const api = (typeof window !== 'undefined' ? (window as any).api : null);
    if (api?.ocrApi?.processCheck) {
      try {
        const res = await api.ocrApi.processCheck(req.base64Image, req.mimeType, req.fileName);
        if (res && res.sourceEngine) {
          return res;
        }
      } catch (ipcErr) {
        console.warn('IPC processCheck fallback to direct fetch:', ipcErr);
      }
    }

    const cfg = getStoredLocalConfig();
    const secrets = getStoredLocalSecrets();
    const activeProv = cfg.activeProvider || 'gemini';
    const provSetting = cfg.providers[activeProv];
    const apiKey = secrets[activeProv];
    const model = provSetting?.model || 'gemini-2.5-flash-lite';

    if (!apiKey) {
      return {
        success: false,
        sourceEngine: `API_${activeProv.toUpperCase()}`,
        provider: activeProv,
        model,
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'INVALID_API_KEY',
        errorMessage: `No API key configured for provider "${activeProv}". Please configure in Settings -> OCR or Check OCR -> API Settings.`,
      };
    }

    const cleanBase64 = req.base64Image.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');
    const start = Date.now();

    const systemPrompt = `You are a specialized banking document OCR and verification engine for Bank Cheques.
Analyze the provided cheque image and extract the 10 canonical cheque fields into the exact JSON format below.

CRITICAL CHEQUE EXTRACTION RULES:
1. ZERO GUESSING: If a field is missing, blank, obscured, or illegible, set its value to null. Never invent, hallucinate, or assume missing values.
2. NON-CHEQUE DETECTION: If the page/image is NOT a bank cheque (e.g. blank sheet, invoice, receipt, general document), set "is_cheque": false and all field values to null.
3. BANK & ADDRESS: Extract the bank name and branch/address from the header area.
4. DATE: Extract only the date printed/written in the cheque date box/area. Format as DD/MM/YYYY (e.g. 08/04/2026) or DDMMYYYY (e.g. 08042026). If unreadable, return null.
5. PAYEE NAME: Extract the Pay / Payee Name from the "PAY" line area. Do not confuse with bank name or account holder name.
6. RUPEES IN WORDS: Extract the complete monetary amount written in words without truncation (e.g. "Rupees One Lakh Only").
7. AMOUNT IN FIGURE: Extract the numerical amount from the "₹" box. Return it as a plain decimal number (e.g. 100000.00). Do NOT include currency symbols or commas.
8. ACCOUNT NUMBER: Extract the A/c No. as a string. Preserve all leading zeros and exact digits.
9. CHEQUE NUMBER: Extract the Cheque No. as a string. Preserve leading zeros (e.g. "004582"). Do not convert to a number that strips zeros.
10. MICR CODE: Extract the MICR Code at the bottom band of the cheque (typically 22 digits). Extract only from the bottom MICR line. Return as string. If unreadable, return null.
11. SIGNATURE BY: If a printed/typed signatory name or authorized signatory title is readable, extract it. If only a handwritten signature is present without a printed name, return null (do NOT guess or hallucinate a person's name from a signature scribble).

Return ONLY a valid JSON object matching this schema with no markdown formatting:
{
  "is_cheque": boolean,
  "bank": string | null,
  "address": string | null,
  "date": string | null,
  "payee_name": string | null,
  "rupees_in_words": string | null,
  "amount_in_figure": number | null,
  "account_no": string | null,
  "cheque_no": string | null,
  "micr_code": string | null,
  "signature_by": string | null,
  "confidence_scores": {
    "bank": number,
    "date": number,
    "payee_name": number,
    "amount_in_figure": number,
    "account_no": number,
    "cheque_no": number,
    "micr_code": number
  }
}`;

    try {
      if (activeProv === 'gemini') {
        const candidateModels = [
          ...(model && !model.includes('1.5') ? [model.trim()] : []),
          'gemini-2.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-flash-latest',
          'gemini-3-flash-preview',
          'gemini-pro-latest',
        ];

        let workingModel = '';
        let lastErr = '';
        let extractedText = '{}';
        let parsed: any = {};

        for (const targetModel of Array.from(new Set(candidateModels))) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: systemPrompt },
                      { inlineData: { mimeType: req.mimeType || 'image/jpeg', data: cleanBase64 } },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              try {
                const cleanedText = extractedText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanedText);
              } catch {
                parsed = {};
              }
              workingModel = targetModel;
              break;
            } else {
              const err = await response.json().catch(() => ({}));
              lastErr = err?.error?.message || `HTTP ${response.status}`;
            }
          } catch (e: any) {
            lastErr = e?.message || String(e);
          }
        }

        const latencyMs = Date.now() - start;
        if (!workingModel) {
          throw new Error(lastErr || 'Cheque extraction failed across all available Gemini models');
        }

        const structuredFields: Record<string, any> = {};
        const confScores = parsed.confidence_scores || {};
        for (const [k, v] of Object.entries(parsed)) {
          if (k === 'confidence_scores') continue;
          const conf = typeof confScores[k] === 'number'
            ? (confScores[k] <= 1.0 ? Math.round(confScores[k] * 100) : Math.round(confScores[k]))
            : 90;
          structuredFields[k] = {
            rawValue: v !== null && v !== undefined ? String(v) : '',
            normalizedValue: v,
            confidence: v !== null && v !== undefined ? conf : 0,
          };
        }

        return {
          success: true,
          sourceEngine: 'API_GEMINI',
          provider: 'gemini',
          model: workingModel,
          latencyMs,
          rawText: extractedText,
          rawResponseJson: parsed,
          structuredFields,
        };
      } else {
        const endpoint = activeProv === 'grok'
          ? 'https://api.x.ai/v1/chat/completions'
          : activeProv === 'openrouter'
          ? 'https://openrouter.ai/api/v1/chat/completions'
          : 'https://api.deepseek.com/chat/completions';

        const extraHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        if (activeProv === 'openrouter') {
          extraHeaders['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
          extraHeaders['X-Title'] = 'HENU OS';
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: extraHeaders,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extract cheque fields into JSON' },
                  { type: 'image_url', image_url: { url: `data:${req.mimeType || 'image/png'};base64,${cleanBase64}` } },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        const latencyMs = Date.now() - start;
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(text);

        const structuredFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          structuredFields[k] = {
            rawValue: v !== null && v !== undefined ? String(v) : '',
            normalizedValue: v,
            confidence: 90,
          };
        }

        return {
          success: true,
          sourceEngine: `API_${activeProv.toUpperCase()}`,
          provider: activeProv,
          model,
          latencyMs,
          rawText: text,
          rawResponseJson: parsed,
          structuredFields,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        sourceEngine: `API_${activeProv.toUpperCase()}`,
        provider: activeProv,
        model,
        latencyMs: Date.now() - start,
        rawText: '',
        structuredFields: {},
        errorCategory: 'API_ERROR',
        errorMessage: err?.message || 'Cheque API extraction failed',
      };
    }
  }
}

