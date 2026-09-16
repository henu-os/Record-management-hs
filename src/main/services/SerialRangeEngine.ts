// ============================================================
// SerialRangeEngine — Deterministic serial number handling
// ============================================================

/**
 * Determines the zero-padding width from a serial string.
 * '001' => 3, '01' => 2, '1' => 1
 */
function getPadWidth(serial: string): number {
  const s = serial.trim();
  if (/^\d+$/.test(s) && s.length > 1 && s.startsWith('0')) {
    return s.length;
  }
  return Math.max(s.length, 1);
}

/**
 * Normalizes a serial string for comparison.
 * Trims whitespace, preserves leading zeros.
 */
export function normalizeSerial(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  const lower = str.toLowerCase();
  if (!str || str === '0' || lower === 'null' || lower === 'undefined' || lower === 'nan') return '';
  return str;
}

/**
 * Key normalizer for record matching.
 * Converts '001', '01', '1', 1, 'M-01', 'SR-001' to canonical numeric key '1' if numeric.
 */
export function normalizeSerialKey(raw: unknown): string {
  const str = normalizeSerial(raw);
  if (!str) return '';
  const m = str.match(/\d+/);
  if (m) {
    const num = parseInt(m[0], 10);
    if (!isNaN(num)) return String(num);
  }
  return str.toLowerCase();
}

/**
 * Generates all serial strings in [from..to] inclusive.
 * Determines padding from the `from` string.
 *
 * generateRange('001', '005') => ['001','002','003','004','005']
 * generateRange('010', '012') => ['010','011','012']
 * generateRange('1', '5')    => ['1','2','3','4','5']
 */
export function generateRange(from: string, to: string, allowEmpty = false): string[] {
  const fromStr = normalizeSerial(from);
  const toStr = normalizeSerial(to);

  if (!fromStr && !toStr) {
    if (allowEmpty) return [];
    throw new Error('Invalid serial range: FROM and TO must not be empty.');
  }

  if (!fromStr || !toStr) {
    throw new Error('Invalid serial range: FROM and TO must both be specified.');
  }

  const fromNum = parseInt(fromStr, 10);
  const toNum = parseInt(toStr, 10);

  if (isNaN(fromNum) || isNaN(toNum)) {
    throw new Error(`Serial numbers must be numeric. Got: "${fromStr}" - "${toStr}"`);
  }
  if (fromNum > toNum) {
    throw new Error('From Serial No. cannot be greater than To Serial No.');
  }

  // Determine padding: use the longer of from/to width
  const padWidth = Math.max(getPadWidth(fromStr), getPadWidth(toStr));

  const result: string[] = [];
  for (let i = fromNum; i <= toNum; i++) {
    result.push(String(i).padStart(padWidth, '0'));
  }
  return result;
}

/**
 * Matches a serial range against a list of records.
 * Returns a Map of srNo => record for found records,
 * and a list of serial numbers that have no matching record.
 *
 * RULES:
 * - Match is exact string comparison after normalization
 * - Never fabricate data for missing serials
 * - Missing serials get a blank record (serial only)
 */
export function matchRecords<T extends { srNo: string }>(
  records: T[],
  serialRange: string[]
): { found: Map<string, T>; blank: string[] } {
  // Build lookup map from all records
  const lookup = new Map<string, T>();
  for (const rec of records) {
    const key = normalizeSerial(rec.srNo);
    if (key) lookup.set(key, rec);
  }

  const found = new Map<string, T>();
  const blank: string[] = [];

  for (const serial of serialRange) {
    const key = normalizeSerial(serial);
    if (lookup.has(key)) {
      found.set(serial, lookup.get(key)!);
    } else {
      blank.push(serial);
    }
  }

  return { found, blank };
}

/**
 * Validates a serial range input pair.
 * Returns error message or null if valid.
 */
export function validateSerialRange(from: string, to: string, nonSerialCount = 0): string | null {
  const fromStr = normalizeSerial(from);
  const toStr = normalizeSerial(to);

  if (!fromStr && !toStr) {
    if (nonSerialCount > 0) return null;
    return 'Please enter From and To serial numbers, or Non Serial Count (> 0).';
  }

  if (!fromStr) return 'FROM serial number is required.';
  if (!toStr) return 'TO serial number is required.';

  const fromNum = parseInt(fromStr, 10);
  const toNum = parseInt(toStr, 10);

  if (isNaN(fromNum)) return `FROM serial "${fromStr}" is not a valid number.`;
  if (isNaN(toNum)) return `TO serial "${toStr}" is not a valid number.`;
  if (fromNum > toNum) return 'From Serial No. cannot be greater than To Serial No.';
  if (toNum - fromNum > 9999) return `Range too large (max 9999 records per generation). Got ${toNum - fromNum + 1}.`;

  return null;
}
