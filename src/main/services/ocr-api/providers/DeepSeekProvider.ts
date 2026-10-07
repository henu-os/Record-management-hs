/**
 * HENU AI — DEEPSEEK OCR API PROVIDER
 * Module: Main Services / OCR API Providers
 */

import { BaseOcrProvider, VOUCHER_EXTRACTION_SYSTEM_PROMPT, CHECK_EXTRACTION_SYSTEM_PROMPT } from './BaseOcrProvider';
import { ApiProviderId, ConnectionTestResult, OcrApiExtractionResult } from '../types';

export class DeepSeekProvider extends BaseOcrProvider {
  getProviderId(): ApiProviderId {
    return 'deepseek';
  }

  getDisplayName(): string {
    return 'DeepSeek';
  }

  getDefaultModel(): string {
    return 'deepseek-chat';
  }

  getRecommendedModels(): string[] {
    return ['deepseek-chat', 'deepseek-reasoner', 'deepseek-vl-7b'];
  }

  isModelVisionCapable(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('vl') || m.includes('vision');
  }

  async testConnection(apiKey: string, model: string): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        provider: 'deepseek',
        model,
        latencyMs: 0,
        visionSupported: false,
        errorCategory: 'INVALID_API_KEY',
        errorMessage: 'API Key is empty. Please enter your DeepSeek API Key.',
        timestamp,
      };
    }

    try {
      const targetModel = model || this.getDefaultModel();
      const url = 'https://api.deepseek.com/chat/completions';

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
      const visionSupported = this.isModelVisionCapable(targetModel);

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          provider: 'deepseek',
          model: targetModel,
          latencyMs,
          visionSupported,
          httpStatus: res.status,
          errorCategory: res.status === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR',
          errorMessage: this.sanitizeErrorMessage(errText, apiKey),
          timestamp,
        };
      }

      return {
        success: true,
        provider: 'deepseek',
        model: targetModel,
        latencyMs,
        visionSupported,
        httpStatus: res.status,
        timestamp,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'deepseek',
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
    const targetModel = model || this.getDefaultModel();

    if (!this.isModelVisionCapable(targetModel)) {
      return {
        success: false,
        sourceEngine: 'API_DEEPSEEK',
        provider: 'deepseek',
        model: targetModel,
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'VISION_NOT_SUPPORTED',
        errorMessage: `Model "${targetModel}" is text-only and does not support image OCR input. Select a vision-capable model (or use Gemini / Grok / OpenRouter).`,
      };
    }

    const startTime = Date.now();
    try {
      const url = 'https://api.deepseek.com/chat/completions';
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
          sourceEngine: 'API_DEEPSEEK',
          provider: 'deepseek',
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
        sourceEngine: 'API_DEEPSEEK',
        provider: 'deepseek',
        model: targetModel,
        latencyMs,
        rawText,
        rawResponseJson: parsedJson,
        structuredFields,
      };
    } catch (err: any) {
      return {
        success: false,
        sourceEngine: 'API_DEEPSEEK',
        provider: 'deepseek',
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
    const targetModel = model || this.getDefaultModel();

    if (!this.isModelVisionCapable(targetModel)) {
      return {
        success: false,
        sourceEngine: 'API_DEEPSEEK',
        provider: 'deepseek',
        model: targetModel,
        latencyMs: 0,
        rawText: '',
        structuredFields: {},
        errorCategory: 'VISION_NOT_SUPPORTED',
        errorMessage: `Model "${targetModel}" is text-only and does not support image OCR input. Select a vision-capable model (or use Gemini / Grok / OpenRouter).`,
      };
    }

    const startTime = Date.now();
    try {
      const url = 'https://api.deepseek.com/chat/completions';
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
          sourceEngine: 'API_DEEPSEEK',
          provider: 'deepseek',
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
        sourceEngine: 'API_DEEPSEEK',
        provider: 'deepseek',
        model: targetModel,
        latencyMs,
        rawText,
        rawResponseJson: parsedJson,
        structuredFields,
      };
    } catch (err: any) {
      return {
        success: false,
        sourceEngine: 'API_DEEPSEEK',
        provider: 'deepseek',
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

