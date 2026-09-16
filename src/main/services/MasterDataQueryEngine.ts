// ============================================================
// HENU OS — Master Data Query Engine
// Query system for Form Renderers & Data Preview Metrics.
// ============================================================

import {
  MasterWorkbook,
  SocietyMaster,
  NormalizedMemberRecord,
  FormId,
  DataPreviewMetrics,
} from '../types';
import { generateRange, normalizeSerial, normalizeSerialKey } from './SerialRangeEngine';
import { FormMappingService } from './FormMappingService';

export class MasterDataQueryEngine {
  /**
   * Retrieves Society Master metadata separately from member records.
   * Prevents society information from being duplicated incorrectly in member records.
   */
  static getSocietyData(workbook: MasterWorkbook | null): SocietyMaster | null {
    if (!workbook || !workbook.societyMaster) return null;
    return workbook.societyMaster;
  }

  /**
   * Queries the normalized master data for a specific form and serial range.
   * Returns a complete list of records matching the requested serial range.
   * For missing serial numbers in the range, returns a blank record containing
   * ONLY the serial number with all other fields as empty strings.
   */
  static queryFormRecords(
    workbook: MasterWorkbook,
    formId: FormId,
    fromSerial: string,
    toSerial: string
  ): { serial: string; record: NormalizedMemberRecord; isBlank: boolean }[] {
    const serialRange = generateRange(fromSerial, toSerial);
    const results: { serial: string; record: NormalizedMemberRecord; isBlank: boolean }[] = [];

    // Map common file records for fast lookup
    const commonSet = new Set<string>();
    for (const c of workbook.commonFile) {
      commonSet.add(normalizeSerialKey(c.srNo));
    }

    for (const serial of serialRange) {
      const normKey = normalizeSerialKey(serial);
      const isFound = commonSet.has(normKey);
      const record = FormMappingService.resolveRecord(workbook, formId, serial);
      results.push({ serial, record, isBlank: !isFound });
    }

    return results;
  }

  /**
   * Computes data preview metrics before rendering.
   * Returns exact count of found records vs blank serial records.
   */
  static getPreviewMetrics(
    workbook: MasterWorkbook | null,
    formId: FormId,
    fromSerial: string,
    toSerial: string
  ): DataPreviewMetrics {
    const serialRange = generateRange(fromSerial, toSerial);
    const totalRequested = serialRange.length;

    if (!workbook) {
      return {
        selectedForm: formId,
        fromSerial,
        toSerial,
        foundCount: 0,
        blankCount: totalRequested,
        totalRequested,
        societyName: 'No Master Workbook Loaded',
      };
    }

    const commonSet = new Set<string>();
    for (const c of workbook.commonFile) {
      commonSet.add(normalizeSerialKey(c.srNo));
    }

    let foundCount = 0;
    for (const s of serialRange) {
      if (commonSet.has(normalizeSerialKey(s))) {
        foundCount++;
      }
    }

    const blankCount = totalRequested - foundCount;
    const societyName = workbook.societyMaster?.societyName || 'Unspecified Society';

    return {
      selectedForm: formId,
      fromSerial,
      toSerial,
      foundCount,
      blankCount,
      totalRequested,
      societyName,
    };
  }
}
