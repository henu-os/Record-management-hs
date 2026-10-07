/**
 * HENU AI — OCR API & PROVIDER INTEGRATION TYPES
 * Module: Main Services / OCR API
 */

export type OcrExecutionMode = 'HENU_AI' | 'APIS';

export type ApiProviderId = 'gemini' | 'grok' | 'deepseek' | 'openrouter';

export interface ProviderCapability {
  supportsVision: boolean;
  defaultModel: string;
  recommendedModels: string[];
  displayName: string;
  description: string;
}

export interface ProviderSettings {
  provider: ApiProviderId;
  model: string;
  hasApiKey: boolean;
  visionSupported: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
  connectionStatus: 'PASSED' | 'FAILED' | 'NOT_TESTED';
  lastTestedAt?: string;
  lastLatencyMs?: number;
  lastError?: string;
}

export interface StoredProviderSecrets {
  [key: string]: {
    apiKey: string;
    updatedAt: string;
  };
}

export interface OcrApiGlobalConfig {
  mode: OcrExecutionMode;
  activeProvider: ApiProviderId;
  providers: Record<ApiProviderId, ProviderSettings>;
}

export interface ConnectionTestResult {
  success: boolean;
  provider: ApiProviderId;
  model: string;
  latencyMs: number;
  visionSupported: boolean;
  httpStatus?: number;
  errorCategory?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface OcrApiExtractionResult {
  success: boolean;
  sourceEngine: string;
  provider: ApiProviderId;
  model: string;
  latencyMs: number;
  rawText: string;
  rawResponseJson?: any;
  structuredFields: Record<string, {
    rawValue: string;
    normalizedValue: any;
    confidence: number;
    boundingBox?: any;
  }>;
  errorCategory?: string;
  errorMessage?: string;
}
