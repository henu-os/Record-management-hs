# HENU Voucher OCR — Technical & System Documentation

---

## 1. Overview & System Boundary

**HENU Voucher OCR** is an isolated, local, offline voucher extraction and accounting pipeline designed specifically for Co-operative Housing Society payment vouchers.

- **Primary Goal**: Ingest scanned or photo vouchers (JPG, PNG) and multi-page PDF documents, perform high-precision layout zone analysis and multilingual OCR (English, Hindi, Marathi), validate financial accounting rules, allow split-view human verification, and export fixed-schema Excel (.xlsx) workbooks.
- **Privacy & Security Guarantee**: 100% local processing. Zero cloud APIs, zero external HTTP dependencies, and zero data leaves the client machine.

---

## 2. Directory Structure

```
g:\Astro\
├── src/
│   ├── modules/
│   │   └── henu-voucher-ocr/
│   │       ├── schema/
│   │       │   ├── types.ts                  # Raw & normalized interfaces, metadata
│   │       │   └── voucherSchema.ts          # 26 canonical fields & master schema definition
│   │       ├── ocr/
│   │       │   ├── types.ts                  # OCR engine abstraction & word bounding boxes
│   │       │   ├── PreprocessingPipeline.ts  # Contrast, deskew, binarization, scale factor
│   │       │   ├── TesseractLocalEngine.ts   # Offline Tesseract.js worker instance
│   │       │   └── PdfPageExtractor.ts       # PDF rendering to canvas/image via pdfjs-dist
│   │       ├── templates/
│   │       │   ├── types.ts                  # Geometry zone definition types
│   │       │   └── standardVoucher.ts        # Standard 2-per-page A4 voucher zones
│   │       ├── extraction/
│   │       │   ├── FieldExtractor.ts         # Template-aware zone & keyword extraction
│   │       │   ├── NormalizationEngine.ts    # Date, currency, Devanagari digit converters
│   │       │   ├── ValidationEngine.ts       # Mathematical verification (Subtotals, TDS, GST, Net)
│   │       │   └── ConfidenceEngine.ts       # Field & record confidence ratings (High, Med, Low)
│   │       ├── excel/
│   │       │   └── ExcelExportService.ts     # Multi-sheet XLSX builder via ExcelJS
│   │       └── docs/
│   │           └── MODULE_DOCUMENTATION.md   # This documentation
│   └── renderer/
│       └── pages/
│           └── voucher-ocr/
│               ├── HenuVoucherOcrPage.tsx    # Parent page container & tab router
│               ├── voucher-ocr.css          # Isolated styling for the module
│               └── components/
│                   ├── SingleVoucherUpload.tsx   # Single JPG/PNG/PDF upload & preview
│                   ├── BatchPdfUpload.tsx        # Multi-page asynchronous batch queue
│                   ├── VoucherReviewScreen.tsx   # Split-screen review (Image vs Fields)
│                   └── VoucherDataTable.tsx      # Batch records table & XLSX export
```

---

## 3. Fixed Master Schema (`HenuVoucherSchema`)

Every extracted voucher produces a standardized row with the following 26 canonical fields:

1. `society_name` — Society Name
2. `registration_no` — Registration Number
3. `society_address` — Society Address
4. `voucher_no` — Voucher Number
5. `voucher_date` — Voucher Date (`DD/MM/YYYY`)
6. `pay_to` — Pay To (Payee Name)
7. `charge_to` — Charge To (Debit Ledger Head)
8. `particulars` — Narration / Transaction Details
9. `bill_amount_1` — Primary Bill Gross Amount
10. `bill_amount_2` — Secondary Bill Amount
11. `advance_paid` — Advance Deducted
12. `total_1` — Total 1 ($Bill_1 + Bill_2 - Adv$)
13. `tds_percentage` — Tax Deducted at Source %
14. `tds_amount` — TDS Amount ($Total_1 \times TDS\%$)
15. `total_2` — Total 2 ($Total_1 - TDS$)
16. `bill_no` — Bill / Invoice Number
17. `bank_name` — Bank Name
18. `cheque_no` — Cheque / UTR Ref Number
19. `cheque_date` — Cheque Date (`DD/MM/YYYY`)
20. `rupees` — Rupees (in words or highlighted text)
21. `cgst_percentage` — Central GST %
22. `cgst_amount` — CGST Amount ($Total_2 \times CGST\%$)
23. `sgst_percentage` — State GST %
24. `sgst_amount` — SGST Amount ($Total_2 \times SGST\%$)
25. `round_off` — Round Off (+/-)
26. `net_paid` — Final Net Paid Amount

---

## 4. Mathematical Validation Rules

The `ValidationEngine` automatically checks the arithmetic integrity:

$$\text{Total}_1 = \text{BillAmount}_1 + \text{BillAmount}_2 - \text{AdvancePaid}$$

$$\text{TDS Amount} = \text{Total}_1 \times \left(\frac{\text{TDS}\%}{100}\right)$$

$$\text{Total}_2 = \text{Total}_1 - \text{TDS Amount}$$

$$\text{CGST Amount} = \text{Total}_2 \times \left(\frac{\text{CGST}\%}{100}\right)$$

$$\text{SGST Amount} = \text{Total}_2 \times \left(\frac{\text{SGST}\%}{100}\right)$$

$$\text{Net Paid} = \text{Total}_2 + \text{CGST Amount} + \text{SGST Amount} \pm \text{Round Off}$$

If any calculated value differs from the extracted value by more than $₹1.00$, the field is highlighted in amber/red with an exact mathematical explanation, and flagged as `reviewRequired = true`.

---

## 5. Multilingual & Handwriting Support

- **Supported Languages**: English (`eng`), Hindi (`hin`), Marathi (`mar`).
- **Devanagari Digits**: Automatically normalizes numerals (०, १, २, ३, ४, ५, ६, ७, ८, ९) to standard (0-9) for calculations while preserving original Marathi/Hindi words in narration and society headers.
- **Handwriting**: Preserved via delicate adaptive thresholding and contrast normalization. Character confidence and word-level ratings are highlighted in the UI.

---

## 6. XLSX Output Quality

Exported workbooks contain:
1. **Sheet 1: Voucher Data**: Auto-formatted columns, frozen top header row, numeric cells with currency formatting (`#,##0.00`), date cells, and UTF-8 encoded text for multilingual strings.
2. **Sheet 2: Processing Summary**: Audit metadata, source file names, page numbers, extraction confidence %, and validation issue logs.


