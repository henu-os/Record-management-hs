/**
 * HENU AI — GROK OCR API PROVIDER
 * Module: Main Services / OCR API Providers
 */

import { BaseOcrProvider, VOUCHER_EXTRACTION_SYSTEM_PROMPT, CHECK_EXTRACTION_SYSTEM_PROMPT } from './BaseOcrProvider';
import { ApiProviderId, ConnectionTestResult, OcrApiExtractionResult } from '../types';

export class GrokProvider extends BaseOcrProvider {
  getProviderId(): ApiProviderId {
    return 'grok';
  }

  getDisplayName(): string {
    return 'xAI Grok';
  }

  getDefaultModel(): string {
    return 'grok-2-vision-1212';
  }

  getRecommendedModels(): string[] {
    return ['grok-2-vision-1212', 'grok-vision-beta'];
  }

  isModelVisionCapable(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('vision');
  }

  async testConnection(apiKey: string, model: string): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        provider: 'grok',
        model,
        latencyMs: 0,
        visionSupported: false,
        errorCategory: 'INVALID_API_KEY',
        errorMessage: 'API Key is empty. Please enter your xAI Grok API Key.',
        timestamp,
      };
    }

    try {
      const targetModel = model || this.getDefaultModel();
      const url = 'https://api.x.ai/v1/chat/completions';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping test. Respond with OK.' }],
          max_tokens: 5,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          provider: 'grok',
          model: targetModel,
          latencyMs,
          visionSupported: this.isModelVisionCapable(targetModel),
          httpStatus: res.status,
          errorCategory: res.status === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR',
          errorMessage: this.sanitizeErrorMessage(errText, apiKey),
          timestamp,
        };
      }

      return {
        success: true,
        provider: 'grok',
        model: targetModel,
        latencyMs,
        visionSupported: this.isModelVisionCapable(targetModel),
        httpStatus: res.status,
        timestamp,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'grok',
        model,
        latencyMs: Date.now() - startTime,
        visionSupported: this.isModelVisionCapable(model),
        errorCategory: 'NETWORK_ERROR',
        errorMessage: this.sanitizeErrorMessage(err, apiKey),
        timestamp,
      };
    }
  }

  async extractVoucher(
    apiKey: string,
    model: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<OcrApiExtractionResult> {
    const startTime = Date.now();
    const targetModel = model || this.getDefaultModel();

    if (!this.isModelVisionCapable(targetModel)) {
      return {
        success: false,
        sourceEngine: 'API_GROK',
        provider: 'grok',
        model: targetModel,
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'VISION_NOT_SUPPORTED',
        errorMessage: `Model "${targetModel}" does not support vision/image input.`,
      };
    }

    try {
      const url = 'https://api.x.ai/v1/chat/completions';
      const base64Data = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const payload = {
        model: targetModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VOUCHER_EXTRACTION_SYSTEM_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          sourceEngine: 'API_GROK',
          provider: 'grok',
          model: targetModel,
          latencyMs,
          rawText: '',
          structuredFields: {},
          errorCategory: res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
          errorMessage: this.sanitizeErrorMessage(errText, apiKey),
        };
      }

      const responseJson = await res.json();
      const rawText = responseJson.choices?.[0]?.message?.content || '';

      let parsedJson: any = {};
      try {
        const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleanedText);
      } catch {
        parsedJson = {};
      }

      const structuredFields: Record<string, any> = {};
      const confScores = parsedJson.confidence_scores || {};

      for (const [k, v] of Object.entries(parsedJson)) {
        if (k === 'confidence_scores') continue;
        const conf = typeof confScores[k] === 'number' ? Math.max(0, Math.min(100, confScores[k])) : 90;
        structuredFields[k] = {
          rawValue: v !== null && v !== undefined ? String(v) : '',
          normalizedValue: v,
          confidence: v !== null && v !== undefined ? conf : 0,
        };
      }

      return {
        success: true,
        sourceEngine: 'API_GROK',
        provider: 'grok',
        model: targetModel,
        latencyMs,
        rawText,
        rawResponseJson: parsedJson,
        structuredFields,
      };
    } catch (err: any) {
      return {
        success: false,
        sourceEngine: 'API_GROK',
        provider: 'grok',
        model: targetModel,
        latencyMs: Date.now() - startTime,
        rawText: '',
        structuredFields: {},
        errorCategory: 'NETWORK_ERROR',
        errorMessage: this.sanitizeErrorMessage(err, apiKey),
      };
    }
  }

  async extractCheck(
    apiKey: string,
    model: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<OcrApiExtractionResult> {
    const startTime = Date.now();
    const targetModel = model || this.getDefaultModel();

    if (!this.isModelVisionCapable(targetModel)) {
      return {
        success: false,
        sourceEngine: 'API_GROK',
        provider: 'grok',
        model: targetModel,
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'VISION_NOT_SUPPORTED',
        errorMessage: `Model "${targetModel}" does not support vision/image input.`,
      };
    }

    try {
      const url = 'https://api.x.ai/v1/chat/completions';
      const base64Data = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const payload = {
        model: targetModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: CHECK_EXTRACTION_SYSTEM_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          sourceEngine: 'API_GROK',
          provider: 'grok',
          model: targetModel,
          latencyMs,
          rawText: '',
          structuredFields: {},
          errorCategory: res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
          errorMessage: this.sanitizeErrorMessage(errText, apiKey),
        };
      }

      const responseJson = await res.json();
      const rawText = responseJson.choices?.[0]?.message?.content || '';

      let parsedJson: any = {};
      try {
        const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleanedText);
      } catch {
        parsedJson = {};
      }

      const structuredFields: Record<string, any> = {};
      const confScores = parsedJson.confidence_scores || {};

      for (const [k, v] of Object.entries(parsedJson)) {
        if (k === 'confidence_scores') continue;
        const conf = typeof confScores[k] === 'number' ? Math.max(0, Math.min(100, confScores[k])) : 90;
        structuredFields[k] = {
          rawValue: v !== null && v !== undefined ? String(v) : '',
          normalizedValue: v,
          confidence: v !== null && v !== undefined ? conf : 0,
        };
      }

      return {
        success: true,
        sourceEngine: 'API_GROK',
        provider: 'grok',
        model: targetModel,
        latencyMs,
        rawText,
        rawResponseJson: parsedJson,
        structuredFields,
      };
    } catch (err: any) {
      return {
        success: false,
        sourceEngine: 'API_GROK',
        provider: 'grok',
        model: targetModel,
        latencyMs: Date.now() - startTime,
        rawText: '',
        structuredFields: {},
        errorCategory: 'NETWORK_ERROR',
        errorMessage: this.sanitizeErrorMessage(err, apiKey),
      };
    }
  }
}

