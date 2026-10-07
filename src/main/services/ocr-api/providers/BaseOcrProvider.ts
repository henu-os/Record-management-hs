/**
 * HENU AI — BASE OCR API PROVIDER ADAPTER
 * Module: Main Services / OCR API Providers
 */

import { ApiProviderId, ConnectionTestResult, OcrApiExtractionResult } from '../types';

export const VOUCHER_EXTRACTION_SYSTEM_PROMPT = `You are a specialized accounting document OCR engine for Co-operative Housing Society payment vouchers.
Analyze the provided voucher image and extract the 26 canonical fields into the exact JSON format below.

CRITICAL ACCOUNTING RULES:
1. ZERO GUESSING: If a field is blank, missing, or illegible, set its value to null. Never invent or calculate missing fields.
2. ROW ISOLATION: Never concatenate numbers across adjacent rows or columns. Extract each amount strictly from its own row.
3. DATES: Format dates as DD/MM/YYYY (e.g. 08/04/2026). If blank, return null.
4. AMOUNTS: Return amounts as plain numbers (e.g. 25161.00, 252.00, 5000.00, 19909.00). Do not include currency symbols.
5. NET PAID: Extract the observed Net Paid directly from the voucher pixels. Do not replace it with an arithmetic formula.

Return ONLY a valid JSON object matching this schema with no markdown formatting or extra text:
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
    "society_name": number (0-100),
    "voucher_date": number (0-100),
    "pay_to": number (0-100),
    "bill_amount_1": number (0-100),
    "net_paid": number (0-100)
  }
}`;

export const CHECK_EXTRACTION_SYSTEM_PROMPT = `You are a specialized banking document OCR and verification engine for Bank Cheques.
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

Return ONLY a valid JSON object matching this schema with no markdown formatting or extra text:
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
    "bank": number (0-100),
    "date": number (0-100),
    "payee_name": number (0-100),
    "amount_in_figure": number (0-100),
    "account_no": number (0-100),
    "cheque_no": number (0-100),
    "micr_code": number (0-100)
  }
}`;

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

  abstract extractCheck(
    apiKey: string,
    model: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<OcrApiExtractionResult>;

  /**
   * Sanitizes error messages to ensure API keys and secret tokens are NEVER leaked in logs or UI
   */
  protected sanitizeErrorMessage(error: any, apiKey?: string): string {
    let msg = error instanceof Error ? error.message : String(error);
    if (apiKey && apiKey.length > 4) {
      msg = msg.split(apiKey).join('[REDACTED_API_KEY]');
    }
    // Redact common auth token patterns
    msg = msg.replace(/bearer\s+[a-zA-Z0-9_\-\.]{10,}/gi, 'Bearer [REDACTED]');
    msg = msg.replace(/key=[a-zA-Z0-9_\-\.]{10,}/gi, 'key=[REDACTED]');
    return msg;
  }

  /**
   * Standardized 1x1 transparent PNG buffer for lightweight connection testing
   */
  protected getTestPingImageBuffer(): Buffer {
    // 1x1 white PNG byte array
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==',
      'base64'
    );
  }
}

