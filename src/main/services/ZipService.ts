// ============================================================
// ZipService — Packages PDF files into a ZIP
// ============================================================
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { FormId } from '../types';

// Deterministic ZIP file name prefixes per spec 31-32
// ZIP name: HENU_OS_FORM_I_001-010.zip
const ZIP_LABELS: Record<FormId, string> = {
  FORM_I:    'FORM_I',
  FORM_J:    'FORM_J',
  FORM_SHARE:'SHARE_REGISTER',
  FORM_NOM:  'NOMINATION_REGISTER',
  FORM_PROP: 'PROPERTY_REGISTER',
  FORM_BANK: 'BANK_LINE_MARK',
  FORM_SHARE_CERT: 'SHARE_CERTIFICATE_13X19',
  FORM_VOUCHER: 'PAYMENT_VOUCHER_LEGAL',
};

export interface ZipEntry {
  filename: string;
  buffer: Buffer;
}

export class ZipService {
  /**
   * Creates a ZIP file from the given entries and saves it to the downloads folder.
   * Returns the path of the saved ZIP.
   */
  static async createAndSave(
    entries: ZipEntry[],
    formId: FormId,
    fromSerial: string,
    toSerial: string,
    downloadsZipDir: string,
  ): Promise<string> {
    const zip = new JSZip();

    for (const entry of entries) {
      zip.file(entry.filename, entry.buffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const formLabel = ZIP_LABELS[formId] || formId;
    const rangeLabel = (fromSerial && toSerial) ? `${fromSerial}-${toSerial}` : 'BLANK';
    const zipName = `HENU_OS_${formLabel}_${rangeLabel}.zip`;
    const zipPath = path.join(downloadsZipDir, zipName);

    // Ensure directory exists
    if (!fs.existsSync(downloadsZipDir)) {
      fs.mkdirSync(downloadsZipDir, { recursive: true });
    }

    fs.writeFileSync(zipPath, zipBuffer);
    return zipPath;
  }
}
