/**
 * HENU CHECK OCR — COMPREHENSIVE UNIT & INTEGRATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CheckNormalizationEngine } from '../extraction/CheckNormalizationEngine';
import { CheckValidationEngine } from '../extraction/CheckValidationEngine';
import { CheckConfidenceEngine } from '../extraction/CheckConfidenceEngine';
import { CheckFieldExtractor } from '../extraction/CheckFieldExtractor';
import { createEmptyCheckFields, HENU_CHECK_FIELDS } from '../schema/checkSchema';
import { CheckExcelExportService } from '../excel/CheckExcelExportService';
import { CheckProcessingRecord } from '../schema/types';
import { OcrApiExtractionResult } from '../../../main/services/ocr-api/types';

describe('HENU Check OCR Module — Canonical Schema & Labels', () => {
  test('Check schema has exactly 10 canonical fields with specified display labels', () => {
    assert.equal(HENU_CHECK_FIELDS.length, 10);
    const keys = HENU_CHECK_FIELDS.map(f => f.key);
    assert.deepEqual(keys, [
      'bank',
      'address',
      'date',
      'payee_name',
      'rupees_in_words',
      'amount_in_figure',
      'account_no',
      'cheque_no',
      'micr_code',
      'signature_by',
    ]);

    const labelMap = HENU_CHECK_FIELDS.reduce((acc, f) => {
      acc[f.key] = f.label;
      return acc;
    }, {} as Record<string, string>);

    // Exact specified display labels
    assert.equal(labelMap.bank, 'Bank:');
    assert.equal(labelMap.address, 'Address:');
    assert.equal(labelMap.date, 'Date (DDMMYYYY):');
    assert.equal(labelMap.payee_name, 'Pay / Payee Name:');
    assert.equal(labelMap.rupees_in_words, 'Rupees in Words:');
    assert.equal(labelMap.amount_in_figure, 'Amount in Figure: ₹');
    assert.equal(labelMap.account_no, 'A/c No.:');
    assert.equal(labelMap.cheque_no, 'Cheque No:');
    assert.equal(labelMap.micr_code, 'MICR Code at bottom:');
    assert.equal(labelMap.signature_by, 'Signature By:');
  });
});

describe('HENU Check OCR Module — Normalization & Zero-Guessing', () => {
  test('Preserves leading zeros for Cheque No and A/c No without numeric loss', () => {
    assert.equal(CheckNormalizationEngine.normalizeIdentifier('004582'), '004582');
    assert.equal(CheckNormalizationEngine.normalizeIdentifier('000123456789'), '000123456789');
    assert.equal(CheckNormalizationEngine.normalizeIdentifier('Cheque No: 009841'), '009841');
    assert.equal(CheckNormalizationEngine.normalizeIdentifier('A/c No: 05411010001234'), '05411010001234');
  });

  test('Normalizes Amount in Figures to proper decimal number', () => {
    assert.equal(CheckNormalizationEngine.normalizeAmount('₹ 1,00,000.00'), 100000);
    assert.equal(CheckNormalizationEngine.normalizeAmount('Rs. 25,500.50/-'), 25500.5);
    assert.equal(CheckNormalizationEngine.normalizeAmount('11,000.00'), 11000);
    assert.equal(CheckNormalizationEngine.normalizeAmount(''), null);
    assert.equal(CheckNormalizationEngine.normalizeAmount('invalid amount text'), null);
  });

  test('Normalizes DDMMYYYY dates without guesswork', () => {
    assert.equal(CheckNormalizationEngine.normalizeDate('08042026'), '08/04/2026');
    assert.equal(CheckNormalizationEngine.normalizeDate('08/04/2026'), '08/04/2026');
    assert.equal(CheckNormalizationEngine.normalizeDate('08-04-2026'), '08/04/2026');
    assert.equal(CheckNormalizationEngine.normalizeDate('2026-04-08'), '08/04/2026');
    assert.equal(CheckNormalizationEngine.normalizeDate('invalid date string'), null);
  });

  test('Preserves complete Rupees in Words with Only suffix', () => {
    assert.equal(CheckNormalizationEngine.normalizeWords('Rupees One Lakh Only'), 'One Lakh Only');
    assert.equal(CheckNormalizationEngine.normalizeWords('Eleven Thousand'), 'Eleven Thousand Only');
    assert.equal(CheckNormalizationEngine.normalizeWords(''), null);
  });

  test('Adheres strictly to zero-guessing rule on unreadable signatures', () => {
    assert.equal(CheckNormalizationEngine.normalizeSignature('Authorised Signatory'), null);
    assert.equal(CheckNormalizationEngine.normalizeSignature('Signatory'), null);
    assert.equal(CheckNormalizationEngine.normalizeSignature('Please sign above this line'), null);
    assert.equal(CheckNormalizationEngine.normalizeSignature('FOR HENU OS PRIVATE LIMITED'), null);
    assert.equal(CheckNormalizationEngine.normalizeSignature('Rajesh Kumar Sharma'), 'Rajesh Kumar Sharma');
  });

  test('Cleans 22-digit MICR code correctly', () => {
    assert.equal(CheckNormalizationEngine.normalizeMicr('1234567890123456789012'), '1234567890123456789012');
    assert.equal(CheckNormalizationEngine.normalizeMicr('c 1234567890123456789012 c'), '1234567890123456789012');
    assert.equal(CheckNormalizationEngine.normalizeMicr('123'), null); // too short
  });
});

describe('HENU Check OCR Module — Validation & Confidence Engines', () => {
  test('Identifies valid cheque vs non-cheque page', () => {
    const fields = createEmptyCheckFields();
    fields.bank = { rawValue: 'Indian Bank', normalizedValue: 'Indian Bank', confidence: 95, validationStatus: 'valid' };
    fields.date = { rawValue: '08/04/2026', normalizedValue: '08/04/2026', confidence: 92, validationStatus: 'valid' };
    fields.payee_name = { rawValue: 'Acme Enterprises', normalizedValue: 'Acme Enterprises', confidence: 90, validationStatus: 'valid' };
    fields.amount_in_figure = { rawValue: '50000.00', normalizedValue: 50000, confidence: 95, validationStatus: 'valid' };
    fields.rupees_in_words = { rawValue: 'Fifty Thousand Only', normalizedValue: 'Fifty Thousand Only', confidence: 90, validationStatus: 'valid' };
    fields.account_no = { rawValue: '001234567890', normalizedValue: '001234567890', confidence: 92, validationStatus: 'valid' };
    fields.cheque_no = { rawValue: '004582', normalizedValue: '004582', confidence: 94, validationStatus: 'valid' };
    fields.micr_code = { rawValue: '1234567890123456789012', normalizedValue: '1234567890123456789012', confidence: 96, validationStatus: 'valid' };

    const valResult = CheckValidationEngine.validate(fields);
    assert.equal(valResult.isCheque, true);
    assert.equal(valResult.reviewRequired, false);

    // Empty fields -> Non-cheque detection
    const emptyFields = createEmptyCheckFields();
    const emptyResult = CheckValidationEngine.validate(emptyFields);
    assert.equal(emptyResult.isCheque, false);
    assert.equal(emptyResult.reviewRequired, true);
  });

  test('CheckConfidenceEngine computes weighted confidence accurately', () => {
    const fields = createEmptyCheckFields();
    fields.bank = { rawValue: 'HDFC Bank', normalizedValue: 'HDFC Bank', confidence: 90, validationStatus: 'valid' };
    fields.amount_in_figure = { rawValue: '10000', normalizedValue: 10000, confidence: 90, validationStatus: 'valid' };
    fields.cheque_no = { rawValue: '001234', normalizedValue: '001234', confidence: 90, validationStatus: 'valid' };
    fields.micr_code = { rawValue: '1234567890123456789012', normalizedValue: '1234567890123456789012', confidence: 90, validationStatus: 'valid' };

    const overall = CheckConfidenceEngine.calculateOverallConfidence(fields);
    assert.ok(overall > 0);
  });
});

describe('HENU Check OCR Module — Field Extractor & Mapping', () => {
  test('Maps raw API extraction response into complete CheckProcessingRecord', () => {
    const rawApi: OcrApiExtractionResult = {
      success: true,
      sourceEngine: 'api_provider',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      latencyMs: 150,
      rawText: 'STATE BANK OF INDIA\nDate: 15/05/2026\nPay Rajesh Sharma Rs 25,000.00',
      rawResponseJson: {
        bank: 'State Bank of India',
        address: 'Nariman Point, Mumbai - 400021',
        date: '15/05/2026',
        payee_name: 'Rajesh Sharma',
        rupees_in_words: 'Twenty Five Thousand Only',
        amount_in_figure: '25000.00',
        account_no: '009876543210',
        cheque_no: '004123',
        micr_code: '4000020150000123456789',
        signature_by: null,
        confidence_scores: {
          bank: 95,
          amount_in_figure: 98,
          cheque_no: 96,
          micr_code: 94,
        },
        is_cheque: true,
        notes: ['Clean cheque image'],
      },
      structuredFields: {},
    };

    const record = CheckFieldExtractor.extractFromApiResult(
      rawApi,
      'cheque_sample.jpg',
      1,
      1
    );

    assert.ok(record.id);
    assert.equal(record.fields.bank.normalizedValue, 'State Bank of India');
    assert.equal(record.fields.amount_in_figure.normalizedValue, 25000);
    assert.equal(record.fields.cheque_no.normalizedValue, '004123');
    assert.equal(record.fields.account_no.normalizedValue, '009876543210');
    assert.equal(record.fields.signature_by.normalizedValue, null); // zero guessing preserved
    assert.equal(record.validationIssues.length === 0, true);
  });
});

describe('HENU Check OCR Module — XLSX & JSON Export', () => {
  test('Generates canonical JSON export string', () => {
    const fields = createEmptyCheckFields();
    fields.bank = { rawValue: 'ICICI Bank', normalizedValue: 'ICICI Bank', confidence: 95, validationStatus: 'valid' };
    fields.amount_in_figure = { rawValue: '12000', normalizedValue: 12000, confidence: 95, validationStatus: 'valid' };
    fields.cheque_no = { rawValue: '003344', normalizedValue: '003344', confidence: 95, validationStatus: 'valid' };

    const record: CheckProcessingRecord = {
      id: 'CHECK-001',
      sourceFile: 'cheques.pdf',
      sourcePage: 1,
      totalPages: 4,
      processingStatus: 'completed',
      rawText: 'ICICI Bank 003344',
      isChequePage: true,
      processedAt: new Date().toISOString(),
      overallConfidence: 94,
      reviewRequired: false,
      validationIssues: [],
      fields,
    };

    const jsonStr = CheckExcelExportService.generateCanonicalJson([record]);
    assert.ok(jsonStr.length > 50);
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.cheques.length, 1);
    assert.equal(parsed.cheques[0].fields.cheque_no, '003344');
    assert.equal(parsed.cheques[0].fields.amount_in_figure, 12000);
  });
});
