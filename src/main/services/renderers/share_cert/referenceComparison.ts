// ============================================================
// HENU OS — Share Certificate Reference Geometry Comparison Engine
// Compares rendered geometries against locked Master Reference constants
// ============================================================

import { MASTER_GEOMETRY } from './certificateGeometry';
import { PRINT_CONFIG } from './printConfig';

export interface GeometryCheckResult {
  passed: boolean;
  checks: Array<{ name: string; expected: number | string; actual: number | string; ok: boolean }>;
}

export class ShareCertificateReferenceComparison {
  static verifyGeometry(): GeometryCheckResult {
    const checks = [
      {
        name: 'Sheet Width',
        expected: '19.00 inches (1368 pt)',
        actual: `${PRINT_CONFIG.SHEET_WIDTH_INCHES} in (${PRINT_CONFIG.SHEET_WIDTH_PT} pt)`,
        ok: PRINT_CONFIG.SHEET_WIDTH_PT === 1368,
      },
      {
        name: 'Sheet Height',
        expected: '13.00 inches (936 pt)',
        actual: `${PRINT_CONFIG.SHEET_HEIGHT_INCHES} in (${PRINT_CONFIG.SHEET_HEIGHT_PT} pt)`,
        ok: PRINT_CONFIG.SHEET_HEIGHT_PT === 936,
      },
      {
        name: 'Safe Margin (All 4 Sides)',
        expected: '0.67 inches (48 pt)',
        actual: `${PRINT_CONFIG.SAFE_MARGIN_INCHES} in (${PRINT_CONFIG.SAFE_MARGIN_PT} pt)`,
        ok: PRINT_CONFIG.SAFE_MARGIN_PT === 48,
      },
      {
        name: 'Front Left Ack Width',
        expected: '176 pt',
        actual: `${MASTER_GEOMETRY.FRONT.ACK.w} pt`,
        ok: MASTER_GEOMETRY.FRONT.ACK.w === 176,
      },
      {
        name: 'Front Society Copy Width',
        expected: '534 pt',
        actual: `${MASTER_GEOMETRY.FRONT.SOCIETY_COPY.w} pt`,
        ok: MASTER_GEOMETRY.FRONT.SOCIETY_COPY.w === 534,
      },
      {
        name: 'Front Member Copy Width',
        expected: '534 pt',
        actual: `${MASTER_GEOMETRY.FRONT.MEMBER_COPY.w} pt`,
        ok: MASTER_GEOMETRY.FRONT.MEMBER_COPY.w === 534,
      },
      {
        name: 'Front Ack Receiver Box Count',
        expected: 3,
        actual: MASTER_GEOMETRY.FRONT.ACK.boxCount,
        ok: MASTER_GEOMETRY.FRONT.ACK.boxCount === 3,
      },
      {
        name: 'Back Transfer Row Count',
        expected: 5,
        actual: MASTER_GEOMETRY.BACK.MEMO.rowCount,
        ok: MASTER_GEOMETRY.BACK.MEMO.rowCount === 5,
      },
      {
        name: 'Back Ack Receiver Box Count',
        expected: 5,
        actual: MASTER_GEOMETRY.BACK.ACK.boxCount,
        ok: MASTER_GEOMETRY.BACK.ACK.boxCount === 5,
      },
    ];

    const passed = checks.every(c => c.ok);
    return { passed, checks };
  }
}
