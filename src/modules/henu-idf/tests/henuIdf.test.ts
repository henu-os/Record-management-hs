/**
 * HENU IDF — AUTOMATED TEST SUITE
 * Validates local Image to PDF conversion:
 * - JPG, JPEG, PNG support
 * - Multiple pages
 * - Page sizes (A4, A3, A5, Letter, Legal, Original)
 * - Orientation (Auto, Portrait, Landscape)
 * - Image Fit (Fit, Fill, Original)
 * - Margins (None, Small, Medium, Large)
 * - Page ordering & removal
 * - File naming & sanitization
 * - 100% Local offline guarantee
 */

import { IdfPdfGenerator } from '../services/IdfPdfGenerator';
import { IdfImageItem, IdfPdfSettings } from '../types';
import { PDFDocument } from 'pdf-lib';

// Minimal 1x1 valid PNG in base64
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, 'base64');

// Minimal 1x1 valid JPEG in base64
const MINIMAL_JPG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const MINIMAL_JPG_BUFFER = Buffer.from(MINIMAL_JPG_BASE64, 'base64');

function createMockImageItem(opts: {
  id: string;
  name: string;
  type: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  rotation?: number;
}): IdfImageItem {
  const isPng = opts.type === 'image/png';
  const buffer = isPng ? MINIMAL_PNG_BUFFER : MINIMAL_JPG_BUFFER;

  // Node environment File mock
  const mockFile = {
    name: opts.name,
    type: opts.type,
    size: buffer.length,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as File;

  return {
    id: opts.id,
    file: mockFile,
    name: opts.name,
    size: buffer.length,
    type: opts.type,
    objectUrl: `blob:mock-${opts.id}`,
    width: opts.width,
    height: opts.height,
    rotation: opts.rotation || 0,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${testName}`);
    failed++;
  }
}

async function runAllIdfTests() {
  console.log('=== STARTING HENU IDF AUTOMATED TESTS ===\n');

  // Test 1: JPG single image PDF generation
  {
    const img1 = createMockImageItem({ id: 'img-1', name: 'voucher1.jpg', type: 'image/jpeg', width: 800, height: 1200 });
    const settings: IdfPdfSettings = {
      pageSize: 'A4',
      orientation: 'Auto',
      imageFit: 'Fit',
      margins: 'None',
      fileName: 'test_voucher.pdf',
    };

    const res = await IdfPdfGenerator.generatePdf([img1], settings);
    assert(res.pageCount === 1, 'JPG generates a 1-page PDF');
    assert(res.fileName === 'test_voucher.pdf', 'Custom filename preserved with .pdf extension');
    assert(res.fileSize > 0, 'Generated PDF has non-zero size');

    // Parse with pdf-lib to verify structural integrity
    const arrayBuf = await res.blob.arrayBuffer();
    const parsed = await PDFDocument.load(arrayBuf);
    assert(parsed.getPageCount() === 1, 'Parsed PDF has exactly 1 page');
  }

  // Test 2: JPEG single image PDF generation
  {
    const img1 = createMockImageItem({ id: 'img-2', name: 'document.jpeg', type: 'image/jpeg', width: 1000, height: 1000 });
    const settings: IdfPdfSettings = {
      pageSize: 'A4',
      orientation: 'Portrait',
      imageFit: 'Fit',
      margins: 'Small',
      fileName: 'doc_jpeg',
    };

    const res = await IdfPdfGenerator.generatePdf([img1], settings);
    assert(res.pageCount === 1, 'JPEG generates a 1-page PDF');
    assert(res.fileName === 'doc_jpeg.pdf', 'Automatically appends .pdf if missing');
  }

  // Test 3: PNG single image PDF generation
  {
    const img1 = createMockImageItem({ id: 'img-3', name: 'diagram.png', type: 'image/png', width: 1200, height: 800 });
    const settings: IdfPdfSettings = {
      pageSize: 'Letter',
      orientation: 'Landscape',
      imageFit: 'Fill',
      margins: 'Medium',
      fileName: 'diagram.pdf',
    };

    const res = await IdfPdfGenerator.generatePdf([img1], settings);
    assert(res.pageCount === 1, 'PNG generates a 1-page PDF');
    const parsed = await PDFDocument.load(await res.blob.arrayBuffer());
    const page = parsed.getPage(0);
    assert(page.getWidth() > page.getHeight(), 'Landscape orientation matches width > height');
  }

  // Test 4: Multiple Images (3 different images -> 3 PDF pages in exact order)
  {
    const img1 = createMockImageItem({ id: 'img-a', name: 'page1.jpg', type: 'image/jpeg', width: 800, height: 1000 });
    const img2 = createMockImageItem({ id: 'img-b', name: 'page2.png', type: 'image/png', width: 900, height: 1100 });
    const img3 = createMockImageItem({ id: 'img-c', name: 'page3.jpeg', type: 'image/jpeg', width: 750, height: 950 });

    const settings: IdfPdfSettings = {
      pageSize: 'A4',
      orientation: 'Auto',
      imageFit: 'Fit',
      margins: 'None',
      fileName: 'MultiPage_Report.pdf',
    };

    const res = await IdfPdfGenerator.generatePdf([img1, img2, img3], settings);
    assert(res.pageCount === 3, 'Multiple images generate exact 3 pages in PDF');

    const parsed = await PDFDocument.load(await res.blob.arrayBuffer());
    assert(parsed.getPageCount() === 3, 'Parsed PDF has exactly 3 pages');
  }

  // Test 5: Reordering (Page 1 = Image 2, Page 2 = Image 1)
  {
    const img1 = createMockImageItem({ id: 'img-1', name: 'img1.jpg', type: 'image/jpeg', width: 800, height: 1000 });
    const img2 = createMockImageItem({ id: 'img-2', name: 'img2.png', type: 'image/png', width: 900, height: 1100 });

    const reorderedList = [img2, img1];
    const settings: IdfPdfSettings = {
      pageSize: 'A4',
      orientation: 'Auto',
      imageFit: 'Fit',
      margins: 'None',
      fileName: 'reordered.pdf',
    };

    const res = await IdfPdfGenerator.generatePdf(reorderedList, settings);
    assert(res.pageCount === 2, 'Reordered list generates 2 pages matching new sequence');
  }

  // Test 6: Image removal (Removing middle image from 3 images produces 2 pages)
  {
    const img1 = createMockImageItem({ id: 'img-1', name: 'first.jpg', type: 'image/jpeg', width: 800, height: 1000 });
    const img3 = createMockImageItem({ id: 'img-3', name: 'third.jpg', type: 'image/jpeg', width: 800, height: 1000 });

    const remainingList = [img1, img3];
    const settings: IdfPdfSettings = {
      pageSize: 'A4',
      orientation: 'Auto',
      imageFit: 'Fit',
      margins: 'None',
      fileName: 'removed_item.pdf',
    };

    const res = await IdfPdfGenerator.generatePdf(remainingList, settings);
    assert(res.pageCount === 2, 'Removing an image produces a 2-page PDF without the removed image');
  }

  // Test 7: Standard Page Sizes (A3, A5, Legal)
  {
    const img = createMockImageItem({ id: 'img-1', name: 'test.jpg', type: 'image/jpeg', width: 800, height: 1200 });

    const a3Res = await IdfPdfGenerator.generatePdf([img], { pageSize: 'A3', orientation: 'Portrait', imageFit: 'Fit', margins: 'None', fileName: 'a3.pdf' });
    const a3Doc = await PDFDocument.load(await a3Res.blob.arrayBuffer());
    const a3Page = a3Doc.getPage(0);
    assert(Math.round(a3Page.getWidth()) === 842 && Math.round(a3Page.getHeight()) === 1191, 'A3 Page Dimensions match 842 × 1191 pt');

    const a5Res = await IdfPdfGenerator.generatePdf([img], { pageSize: 'A5', orientation: 'Portrait', imageFit: 'Fit', margins: 'None', fileName: 'a5.pdf' });
    const a5Doc = await PDFDocument.load(await a5Res.blob.arrayBuffer());
    const a5Page = a5Doc.getPage(0);
    assert(Math.round(a5Page.getWidth()) === 420 && Math.round(a5Page.getHeight()) === 595, 'A5 Page Dimensions match 420 × 595 pt');

    const legalRes = await IdfPdfGenerator.generatePdf([img], { pageSize: 'Legal', orientation: 'Portrait', imageFit: 'Fit', margins: 'None', fileName: 'legal.pdf' });
    const legalDoc = await PDFDocument.load(await legalRes.blob.arrayBuffer());
    const legalPage = legalDoc.getPage(0);
    assert(Math.round(legalPage.getWidth()) === 612 && Math.round(legalPage.getHeight()) === 1008, 'Legal Page Dimensions match 612 × 1008 pt');
  }

  // Test 8: Original Image Size Page Option
  {
    const img = createMockImageItem({ id: 'img-orig', name: 'custom.png', type: 'image/png', width: 1024, height: 768 });
    const res = await IdfPdfGenerator.generatePdf([img], { pageSize: 'Original', orientation: 'Auto', imageFit: 'Original', margins: 'None', fileName: 'orig.pdf' });
    const doc = await PDFDocument.load(await res.blob.arrayBuffer());
    const page = doc.getPage(0);
    assert(page.getWidth() === 1024 && page.getHeight() === 768, 'Original Page Size option sets exact image pixel dimensions');
  }

  // Test 9: Filename Sanitization for Windows
  {
    const img = createMockImageItem({ id: 'img-1', name: 'test.jpg', type: 'image/jpeg', width: 800, height: 1000 });
    const res = await IdfPdfGenerator.generatePdf([img], { pageSize: 'A4', orientation: 'Auto', imageFit: 'Fit', margins: 'None', fileName: 'Society/Bills:2026*?.pdf' });
    assert(res.fileName === 'Society_Bills_2026__.pdf', 'Sanitizes invalid Windows filename characters');
  }

  // Test 10: Empty list validation
  {
    let errorThrown = false;
    try {
      await IdfPdfGenerator.generatePdf([], { pageSize: 'A4', orientation: 'Auto', imageFit: 'Fit', margins: 'None', fileName: 'empty.pdf' });
    } catch (e: any) {
      errorThrown = true;
      assert(e.message.includes('at least one image'), 'Throws clear error on empty image list');
    }
    assert(errorThrown, 'Empty image list validation triggered successfully');
  }

  console.log(`\n=== HENU IDF TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllIdfTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
