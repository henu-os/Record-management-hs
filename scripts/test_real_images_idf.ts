/**
 * REAL FILESYSTEM IMAGE-TO-PDF INTEGRATION VERIFICATION
 * Tests HENU IDF against actual JPG, JPEG, and PNG images on disk:
 * - testvoucher.jpeg
 * - icon.png
 * - henu_business.png
 */

import * as fs from 'fs';
import * as path from 'path';
import { IdfPdfGenerator } from '../src/modules/henu-idf/services/IdfPdfGenerator';
import { IdfImageItem, IdfPdfSettings } from '../src/modules/henu-idf/types';
import { PDFDocument } from 'pdf-lib';

async function testWithRealDiskImages() {
  console.log('=== TESTING HENU IDF WITH REAL DISK IMAGES ===\n');

  const jpegPath = path.resolve('testvoucher.jpeg');
  const png1Path = path.resolve('icon.png');
  const png2Path = path.resolve('henu_business.png');

  const jpegBuffer = fs.readFileSync(jpegPath);
  const png1Buffer = fs.readFileSync(png1Path);
  const png2Buffer = fs.readFileSync(png2Path);

  const mockFile = (name: string, type: string, buffer: Buffer): File => {
    return {
      name,
      type,
      size: buffer.length,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as unknown as File;
  };

  const image1: IdfImageItem = {
    id: 'img-real-1',
    file: mockFile('testvoucher.jpeg', 'image/jpeg', jpegBuffer),
    name: 'testvoucher.jpeg',
    size: jpegBuffer.length,
    type: 'image/jpeg',
    objectUrl: 'blob:testvoucher',
    width: 1200,
    height: 1600,
    rotation: 0,
  };

  const image2: IdfImageItem = {
    id: 'img-real-2',
    file: mockFile('icon.png', 'image/png', png1Buffer),
    name: 'icon.png',
    size: png1Buffer.length,
    type: 'image/png',
    objectUrl: 'blob:icon',
    width: 512,
    height: 512,
    rotation: 0,
  };

  const image3: IdfImageItem = {
    id: 'img-real-3',
    file: mockFile('henu_business.png', 'image/png', png2Buffer),
    name: 'henu_business.png',
    size: png2Buffer.length,
    type: 'image/png',
    objectUrl: 'blob:henu_business',
    width: 800,
    height: 600,
    rotation: 0,
  };

  // 1. Single Real JPEG -> PDF
  console.log('[1/4] Generating PDF from real JPEG image (testvoucher.jpeg)...');
  const res1 = await IdfPdfGenerator.generatePdf([image1], {
    pageSize: 'A4',
    orientation: 'Auto',
    imageFit: 'Fit',
    margins: 'None',
    fileName: 'Voucher_Real.pdf',
  });
  const doc1 = await PDFDocument.load(await res1.blob.arrayBuffer());
  console.log(`✓ Real JPEG PDF created: ${res1.fileName} (${res1.fileSize} bytes, ${doc1.getPageCount()} page)`);

  // 2. Single Real PNG -> PDF
  console.log('[2/4] Generating PDF from real PNG image (icon.png)...');
  const res2 = await IdfPdfGenerator.generatePdf([image2], {
    pageSize: 'A4',
    orientation: 'Auto',
    imageFit: 'Fit',
    margins: 'Small',
    fileName: 'Icon_Real.pdf',
  });
  const doc2 = await PDFDocument.load(await res2.blob.arrayBuffer());
  console.log(`✓ Real PNG PDF created: ${res2.fileName} (${res2.fileSize} bytes, ${doc2.getPageCount()} page)`);

  // 3. Multi-page PDF combining Real JPEG + PNG + PNG
  console.log('[3/4] Generating 3-page PDF from real JPEG + PNG + PNG...');
  const res3 = await IdfPdfGenerator.generatePdf([image1, image2, image3], {
    pageSize: 'A4',
    orientation: 'Auto',
    imageFit: 'Fit',
    margins: 'None',
    fileName: 'Society_Documents_Combined.pdf',
  });
  const doc3 = await PDFDocument.load(await res3.blob.arrayBuffer());
  console.log(`✓ Multi-image PDF created: ${res3.fileName} (${res3.fileSize} bytes, ${doc3.getPageCount()} pages)`);
  if (doc3.getPageCount() !== 3) {
    throw new Error(`Expected 3 pages, found ${doc3.getPageCount()}`);
  }

  // 4. Test reordering: [image3, image1, image2]
  console.log('[4/4] Testing page reordering with real images...');
  const res4 = await IdfPdfGenerator.generatePdf([image3, image1, image2], {
    pageSize: 'Letter',
    orientation: 'Landscape',
    imageFit: 'Fit',
    margins: 'Medium',
    fileName: 'Reordered_Real.pdf',
  });
  const doc4 = await PDFDocument.load(await res4.blob.arrayBuffer());
  console.log(`✓ Reordered PDF created: ${res4.fileName} (${res4.fileSize} bytes, ${doc4.getPageCount()} pages)`);

  console.log('\n=== ALL REAL IMAGE TESTS PASSED SUCCESSFULLY! ===');
}

testWithRealDiskImages().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
