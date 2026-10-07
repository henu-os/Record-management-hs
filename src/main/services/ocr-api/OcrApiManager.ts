/**
 * HENU AI — CENTRAL OCR API MANAGER
 * Module: Main Services / OCR API
 * 
 * Manages:
 * - Execution mode: 'HENU_AI' (USB Local) vs 'APIS' (Configured External AI)
 * - Provider instances: Gemini, Grok, DeepSeek, OpenRouter
 * - Secure local credential store in app userData (never sent to renderer or logs)
 * - Safe sanitization and execution auditing
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  OcrExecutionMode,
  ApiProviderId,
  OcrApiGlobalConfig,
  ProviderSettings,
  StoredProviderSecrets,
  ConnectionTestResult,
  OcrApiExtractionResult,
} from './types';
import { BaseOcrProvider } from './providers/BaseOcrProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { GrokProvider } from './providers/GrokProvider';
import { DeepSeekProvider } from './providers/DeepSeekProvider';
import { OpenRouterProvider } from './providers/OpenRouterProvider';

export class OcrApiManager {
  private static instance: OcrApiManager | null = null;

  private mode: OcrExecutionMode = 'HENU_AI';
  private activeProvider: ApiProviderId = 'gemini';
  private providers: Map<ApiProviderId, BaseOcrProvider> = new Map();
  private providerSettings: Record<ApiProviderId, ProviderSettings>;
  private secrets: StoredProviderSecrets = {};

  private configFilePath: string;
  private secretsFilePath: string;
  private logFilePath: string;

  private constructor() {
    const userDataPath = app?.getPath ? app.getPath('userData') : path.join(process.cwd(), 'userData');
    if (!fs.existsSync(userDataPath)) {
      try { fs.mkdirSync(userDataPath, { recursive: true }); } catch { }
    }

    this.configFilePath = path.join(userDataPath, 'ocr_api_config.json');
    this.secretsFilePath = path.join(userDataPath, 'ocr_api_secrets.json');
    this.logFilePath = path.join(process.cwd(), 'logs', 'api_ocr.log');

    const logsDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logsDir)) {
      try { fs.mkdirSync(logsDir, { recursive: true }); } catch { }
    }

    // Register supported providers
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new GrokProvider());
    this.registerProvider(new DeepSeekProvider());
    this.registerProvider(new OpenRouterProvider());

    // Default settings
    this.providerSettings = {
      gemini: {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        hasApiKey: false,
        visionSupported: 'SUPPORTED',
        connectionStatus: 'NOT_TESTED',
      },
      grok: {
        provider: 'grok',
        model: 'grok-2-vision-1212',
        hasApiKey: false,
        visionSupported: 'SUPPORTED',
        connectionStatus: 'NOT_TESTED',
      },
      deepseek: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        hasApiKey: false,
        visionSupported: 'UNSUPPORTED',
        connectionStatus: 'NOT_TESTED',
      },
      openrouter: {
        provider: 'openrouter',
        model: 'google/gemini-2.0-flash-001',
        hasApiKey: false,
        visionSupported: 'SUPPORTED',
        connectionStatus: 'NOT_TESTED',
      },
    };

    this.loadConfiguration();
    this.loadSecrets();
  }

  public static getInstance(): OcrApiManager {
    if (!OcrApiManager.instance) {
      OcrApiManager.instance = new OcrApiManager();
    }
    return OcrApiManager.instance;
  }

  private registerProvider(provider: BaseOcrProvider): void {
    this.providers.set(provider.getProviderId(), provider);
  }

  private loadConfiguration(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.mode === 'HENU_AI' || data.mode === 'APIS') {
          this.mode = data.mode;
        }
        if (data.activeProvider && this.providers.has(data.activeProvider)) {
          this.activeProvider = data.activeProvider;
        }
        if (data.providers) {
          for (const [k, v] of Object.entries(data.providers)) {
            const pId = k as ApiProviderId;
            if (this.providerSettings[pId]) {
              this.providerSettings[pId] = {
                ...this.providerSettings[pId],
                ...(v as any),
                hasApiKey: false, // will be populated from secrets
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[OcrApiManager] Failed to load configuration:', err);
    }
  }

  private saveConfiguration(): void {
    try {
      const configToSave: OcrApiGlobalConfig = {
        mode: this.mode,
        activeProvider: this.activeProvider,
        providers: this.providerSettings,
      };
      fs.writeFileSync(this.configFilePath, JSON.stringify(configToSave, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[OcrApiManager] Failed to save configuration:', err);
    }
  }

  private loadSecrets(): void {
    try {
      if (fs.existsSync(this.secretsFilePath)) {
        const raw = fs.readFileSync(this.secretsFilePath, 'utf-8');
        this.secrets = JSON.parse(raw);
        for (const [pId, s] of Object.entries(this.secrets)) {
          const id = pId as ApiProviderId;
          if (this.providerSettings[id]) {
            this.providerSettings[id].hasApiKey = !!(s && s.apiKey && s.apiKey.trim().length > 0);
          }
        }
      }
    } catch (err) {
      console.warn('[OcrApiManager] Failed to load secrets:', err);
    }
  }

  private saveSecrets(): void {
    try {
      fs.writeFileSync(this.secretsFilePath, JSON.stringify(this.secrets, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[OcrApiManager] Failed to save secrets:', err);
    }
  }

  /**
   * Appends sanitized audit log entry to logs/api_ocr.log
   */
  public logAudit(entry: {
    jobId?: string;
    mode: OcrExecutionMode;
    provider?: string;
    model?: string;
    action: string;
    durationMs?: number;
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
    errorCategory?: string;
  }): void {
    try {
      const logLine = `[${new Date().toISOString()}] MODE=${entry.mode} ACTION=${entry.action} PROVIDER=${entry.provider || 'N/A'} MODEL=${entry.model || 'N/A'} STATUS=${entry.status} DURATION_MS=${entry.durationMs ?? 0} ERROR=${entry.errorCategory || 'NONE'} JOB_ID=${entry.jobId || 'N/A'}\n`;
      fs.appendFileSync(this.logFilePath, logLine, 'utf-8');
    } catch { }
  }

  public getGlobalConfig(): OcrApiGlobalConfig {
    return {
      mode: this.mode,
      activeProvider: this.activeProvider,
      providers: { ...this.providerSettings },
    };
  }

  public setMode(mode: OcrExecutionMode): OcrApiGlobalConfig {
    this.mode = mode;
    this.saveConfiguration();
    this.logAudit({
      mode: this.mode,
      action: `SWITCH_MODE_TO_${mode}`,
      status: 'SUCCESS',
    });
    return this.getGlobalConfig();
  }

  public setActiveProvider(providerId: ApiProviderId): OcrApiGlobalConfig {
    if (this.providers.has(providerId)) {
      this.activeProvider = providerId;
      this.saveConfiguration();
      this.logAudit({
        mode: this.mode,
        provider: providerId,
        action: 'SELECT_PROVIDER',
        status: 'SUCCESS',
      });
    }
    return this.getGlobalConfig();
  }

  public saveProviderConfig(
    providerId: ApiProviderId,
    modelOrConfig: string | { model?: string; apiKey?: string },
    optionalApiKey?: string
  ): OcrApiGlobalConfig {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown provider "${providerId}"`);

    let targetModel: string;
    let apiKey: string | undefined = optionalApiKey;

    if (typeof modelOrConfig === 'object' && modelOrConfig !== null) {
      targetModel = modelOrConfig.model?.trim() || provider.getDefaultModel();
      if (modelOrConfig.apiKey !== undefined) {
        apiKey = modelOrConfig.apiKey;
      }
    } else {
      targetModel = modelOrConfig?.trim() || provider.getDefaultModel();
    }

    const visionSupported = provider.isModelVisionCapable(targetModel) ? 'SUPPORTED' : 'UNSUPPORTED';

    if (this.providerSettings[providerId]) {
      this.providerSettings[providerId].model = targetModel;
      this.providerSettings[providerId].visionSupported = visionSupported;
    }

    if (apiKey !== undefined && apiKey !== null) {
      const cleanKey = apiKey.trim();
      if (cleanKey.length > 0) {
        this.secrets[providerId] = {
          apiKey: cleanKey,
          updatedAt: new Date().toISOString(),
        };
        this.providerSettings[providerId].hasApiKey = true;
      } else {
        delete this.secrets[providerId];
        this.providerSettings[providerId].hasApiKey = false;
        this.providerSettings[providerId].connectionStatus = 'NOT_TESTED';
      }
      this.saveSecrets();
    }

    this.saveConfiguration();
    return this.getGlobalConfig();
  }

  public async testConnection(providerId: ApiProviderId): Promise<ConnectionTestResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        success: false,
        provider: providerId,
        model: 'unknown',
        latencyMs: 0,
        visionSupported: false,
        errorCategory: 'UNKNOWN_PROVIDER',
        errorMessage: `Unknown provider "${providerId}".`,
        timestamp: new Date().toISOString(),
      };
    }

    const settings = this.providerSettings[providerId];
    const apiKey = this.secrets[providerId]?.apiKey || '';
    const model = settings?.model || provider.getDefaultModel();

    const result = await provider.testConnection(apiKey, model);

    // Update internal settings with test status
    if (this.providerSettings[providerId]) {
      this.providerSettings[providerId].connectionStatus = result.success ? 'PASSED' : 'FAILED';
      this.providerSettings[providerId].lastTestedAt = result.timestamp;
      this.providerSettings[providerId].lastLatencyMs = result.latencyMs;
      this.providerSettings[providerId].lastError = result.errorMessage;
      this.providerSettings[providerId].visionSupported = result.visionSupported ? 'SUPPORTED' : 'UNSUPPORTED';
      this.saveConfiguration();
    }

    this.logAudit({
      mode: this.mode,
      provider: providerId,
      model,
      action: 'TEST_CONNECTION',
      durationMs: result.latencyMs,
      status: result.success ? 'SUCCESS' : 'FAILED',
      errorCategory: result.errorCategory,
    });

    return result;
  }

  public async processVoucher(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
    jobId?: string
  ): Promise<OcrApiExtractionResult> {
    if (this.mode !== 'APIS') {
      return {
        success: false,
        sourceEngine: 'HENU_AI_USB',
        provider: this.activeProvider,
        model: 'local',
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'WRONG_MODE',
        errorMessage: 'Cannot call OCR API while mode is set to HENU AI (USB Local).',
      };
    }

    const providerId = this.activeProvider;
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        success: false,
        sourceEngine: `API_${providerId.toUpperCase()}`,
        provider: providerId,
        model: 'unknown',
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'UNKNOWN_PROVIDER',
        errorMessage: `Provider "${providerId}" is not registered.`,
      };
    }

    const apiKey = this.secrets[providerId]?.apiKey || '';
    if (!apiKey) {
      return {
        success: false,
        sourceEngine: `API_${providerId.toUpperCase()}`,
        provider: providerId,
        model: this.providerSettings[providerId]?.model || provider.getDefaultModel(),
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'INVALID_API_KEY',
        errorMessage: `API Key for ${provider.getDisplayName()} is not configured. Please open Settings → OCR to configure your API key.`,
      };
    }

    const model = this.providerSettings[providerId]?.model || provider.getDefaultModel();
    const startTime = Date.now();

    const result = await provider.extractVoucher(apiKey, model, imageBuffer, mimeType);

    this.logAudit({
      jobId,
      mode: 'APIS',
      provider: providerId,
      model,
      action: 'EXTRACT_VOUCHER',
      durationMs: Date.now() - startTime,
      status: result.success ? 'SUCCESS' : 'FAILED',
      errorCategory: result.errorCategory,
    });

    return result;
  }

  public async processCheck(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
    jobId?: string
  ): Promise<OcrApiExtractionResult> {
    if (this.mode !== 'APIS') {
      return {
        success: false,
        sourceEngine: 'HENU_AI_USB',
        provider: this.activeProvider,
        model: 'local',
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'WRONG_MODE',
        errorMessage: 'Cannot call OCR API while mode is set to HENU AI (USB Local).',
      };
    }

    const providerId = this.activeProvider;
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        success: false,
        sourceEngine: `API_${providerId.toUpperCase()}`,
        provider: providerId,
        model: 'unknown',
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'UNKNOWN_PROVIDER',
        errorMessage: `Provider "${providerId}" is not registered.`,
      };
    }

    const apiKey = this.secrets[providerId]?.apiKey || '';
    if (!apiKey) {
      return {
        success: false,
        sourceEngine: `API_${providerId.toUpperCase()}`,
        provider: providerId,
        model: this.providerSettings[providerId]?.model || provider.getDefaultModel(),
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'INVALID_API_KEY',
        errorMessage: `API Key for ${provider.getDisplayName()} is not configured. Please open Settings → OCR or click API Settings in Check OCR to configure your API key.`,
      };
    }

    const model = this.providerSettings[providerId]?.model || provider.getDefaultModel();
    const startTime = Date.now();

    const result = await provider.extractCheck(apiKey, model, imageBuffer, mimeType);

    this.logAudit({
      jobId,
      mode: 'APIS',
      provider: providerId,
      model,
      action: 'EXTRACT_CHECK',
      durationMs: Date.now() - startTime,
      status: result.success ? 'SUCCESS' : 'FAILED',
      errorCategory: result.errorCategory,
    });

    return result;
  }
}

