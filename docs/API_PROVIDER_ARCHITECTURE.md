# HENU AI — API Provider Architecture & Capabilities

## 1. Provider Adapter Contract (`BaseOcrProvider`)
Every external AI provider implements the standard abstract interface:

```typescript
export abstract class BaseOcrProvider {
  abstract getProviderId(): ApiProviderId;
  abstract getDisplayName(): string;
  abstract getDefaultModel(): string;
  abstract getRecommendedModels(): string[];
  abstract isModelVisionCapable(model: string): boolean;
  abstract testConnection(apiKey: string, model: string): Promise<ConnectionTestResult>;
  abstract extractVoucher(
    apiKey: string,
    model: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<OcrApiExtractionResult>;
}
```

---

## 2. Implemented Provider Adapters

### 1. Google Gemini (`GeminiProvider`)
- **Default Model:** `gemini-1.5-flash`
- **Recommended Models:** `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`
- **Vision Support:** Full multimodal native vision.
- **Protocol:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

### 2. xAI Grok (`GrokProvider`)
- **Default Model:** `grok-2-vision-1212`
- **Recommended Models:** `grok-2-vision-1212`, `grok-vision-beta`
- **Vision Support:** Vision multimodal.
- **Protocol:** `https://api.x.ai/v1/chat/completions` with base64 image data URL payload.

### 3. DeepSeek (`DeepSeekProvider`)
- **Default Model:** `deepseek-chat`
- **Vision Support:** Marked `UNSUPPORTED` for text-only models (`deepseek-chat`, `deepseek-reasoner`, `deepseek-coder`).
- **Safety Pre-Flight:** Pre-flight check rejects image OCR before dispatching network request with user notice: `"This model does not support image input. Select a vision-capable model."`
- **Protocol:** `https://api.deepseek.com/v1/chat/completions`

### 4. OpenRouter (`OpenRouterProvider`)
- **Default Model:** `google/gemini-flash-1.5`
- **Recommended Models:** `google/gemini-flash-1.5`, `anthropic/claude-3-5-sonnet`, `openai/gpt-4o-mini`
- **Vision Support:** Supports multimodal models.
- **Protocol:** `https://openrouter.ai/api/v1/chat/completions`

---

## 3. Standardized Error Handling
Standard error categories mapped across all providers:
- `INVALID_API_KEY`: Authentication / Bearer token rejected.
- `UNAUTHORIZED`: Permission denied.
- `RATE_LIMITED`: HTTP 429 status.
- `QUOTA_EXCEEDED`: Provider quota / billing exhaustion.
- `MODEL_NOT_FOUND`: HTTP 404 on model route.
- `VISION_NOT_SUPPORTED`: Text-only model requested for image OCR.
- `NETWORK_ERROR`: Connection timeout / DNS failure.
- `MALFORMED_OCR_RESPONSE`: Non-JSON or corrupted response payload.
