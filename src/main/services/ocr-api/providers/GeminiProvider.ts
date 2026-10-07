/**
 * HENU AI — GEMINI OCR API PROVIDER
 * Module: Main Services / OCR API Providers
 */

import { BaseOcrProvider, VOUCHER_EXTRACTION_SYSTEM_PROMPT, CHECK_EXTRACTION_SYSTEM_PROMPT } from './BaseOcrProvider';
import { ApiProviderId, ConnectionTestResult, OcrApiExtractionResult } from '../types';

export class GeminiProvider extends BaseOcrProvider {
  getProviderId(): ApiProviderId {
    return 'gemini';
  }

  getDisplayName(): string {
    return 'Google Gemini';
  }

  getDefaultModel(): string {
    return 'gemini-2.5-flash-lite';
  }

  getRecommendedModels(): string[] {
    return ['gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-pro-latest'];
  }

  isModelVisionCapable(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('flash') || m.includes('pro') || m.includes('vision') || m.includes('gemini');
  }

  private candidateModels = [
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-pro-latest',
  ];

  async testConnection(apiKey: string, model: string): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        provider: 'gemini',
        model,
        latencyMs: 0,
        visionSupported: false,
        errorCategory: 'INVALID_API_KEY',
        errorMessage: 'API Key is empty. Please enter your Gemini API Key.',
        timestamp,
      };
    }

    const modelsToTry = [
      ...(model && !model.includes('1.5') ? [model.trim()] : []),
      ...this.candidateModels.filter(m => m !== model?.trim()),
    ];

    let lastError: any = null;
    let lastStatus = 0;

    for (const targetModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping test' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });

        const latencyMs = Date.now() - startTime;
        if (res.ok) {
          return {
            success: true,
            provider: 'gemini',
            model: targetModel,
            latencyMs,
            visionSupported: this.isModelVisionCapable(targetModel),
            httpStatus: res.status,
            timestamp,
          };
        }

        lastStatus = res.status;
        const errText = await res.text();
        const errJson = (() => { try { return JSON.parse(errText); } catch { return null; } })();
        lastError = errJson?.error?.message || errText;
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    return {
      success: false,
      provider: 'gemini',
      model: modelsToTry[0] || this.getDefaultModel(),
      latencyMs: Date.now() - startTime,
      visionSupported: true,
      httpStatus: lastStatus,
      errorCategory: lastStatus === 429 ? 'RATE_LIMITED' : lastStatus === 400 || lastStatus === 403 ? 'UNAUTHORIZED' : 'CONNECTION_FAILED',
      errorMessage: this.sanitizeErrorMessage(lastError || 'Failed to connect to Gemini endpoints', apiKey),
      timestamp,
    };
  }

  async extractVoucher(
    apiKey: string,
    model: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<OcrApiExtractionResult> {
    const startTime = Date.now();
    const base64Data = imageBuffer.toString('base64');

    const modelsToTry = [
      ...(model && !model.includes('1.5') ? [model.trim()] : []),
      ...this.candidateModels.filter(m => m !== model?.trim()),
    ];

    let lastError: any = null;

    for (const targetModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

        const payload = {
          contents: [
            {
              parts: [
                { text: VOUCHER_EXTRACTION_SYSTEM_PROMPT },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const errText = await res.text();
          lastError = errText;
          continue; // Try next model candidate
        }

        const responseJson = await res.json();
        const rawText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
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
          model: targetModel,
          latencyMs,
          rawText,
          rawResponseJson: parsedJson,
          structuredFields,
        };
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    return {
      success: false,
      sourceEngine: 'API_GEMINI',
      provider: 'gemini',
      model: modelsToTry[0] || this.getDefaultModel(),
      latencyMs: Date.now() - startTime,
      rawText: '',
      structuredFields: {},
      errorCategory: 'API_ERROR',
      errorMessage: this.sanitizeErrorMessage(lastError || 'Extraction failed across available Gemini models', apiKey),
    };
  }

  async extractCheck(
    apiKey: string,
    model: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<OcrApiExtractionResult> {
    const startTime = Date.now();
    const base64Data = imageBuffer.toString('base64');

    const modelsToTry = [
      ...(model && !model.includes('1.5') ? [model.trim()] : []),
      ...this.candidateModels.filter(m => m !== model?.trim()),
    ];

    let lastError: any = null;

    for (const targetModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

        const payload = {
          contents: [
            {
              parts: [
                { text: CHECK_EXTRACTION_SYSTEM_PROMPT },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const errText = await res.text();
          lastError = errText;
          continue; // Try next model candidate
        }

        const responseJson = await res.json();
        const rawText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
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
          model: targetModel,
          latencyMs,
          rawText,
          rawResponseJson: parsedJson,
          structuredFields,
        };
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    return {
      success: false,
      sourceEngine: 'API_GEMINI',
      provider: 'gemini',
      model: modelsToTry[0] || this.getDefaultModel(),
      latencyMs: Date.now() - startTime,
      rawText: '',
      structuredFields: {},
      errorCategory: 'API_ERROR',
      errorMessage: this.sanitizeErrorMessage(lastError || 'Extraction failed across available Gemini models', apiKey),
    };
  }
}

