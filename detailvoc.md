# HENU OS — Payment Voucher Module: Complete A-to-Z Technical Audit & System Documentation

---

## 1. Executive Summary & Module Overview

The **Payment Voucher Module** (`FORM_VOUCHER`) in **HENU OS Records Management / HLABS Filing System** is an enterprise-grade financial document generation and accounting registry sub-system. It is built to generate legally compliant, publication-quality **Official Payment Vouchers** formatted with high-precision programmatic vector rendering.

### Key Specifications:
- **Sheet Target / Source**: `[Voucher Register]` in the Master Excel Workbook or SQLite Database.
- **Physical Paper Size**: **A4 Portrait** ($595.28\text{ pt} \times 841.89\text{ pt}$ / $8.27" \times 11.69"$).
- **Voucher Layout Density**: **2 Vouchers per A4 Sheet** (Dual-voucher stacked vertical layout with perforated cutting line).
- **Rendering Technology**: Native programmatic vector rendering using `pdf-lib`, `@pdf-lib/fontkit`, and WinAnsi encoding wrappers (zero external headless browser/Puppeteer overhead).
- **Financial Calculation Engine**: Fully automatic arithmetic deduction, GST (CGST/SGST), TDS tax calculation, rounding off, and Net Paid aggregation with Indian Rupee (`₹`) vector glyphs and separate Rupees/Paise accounting columns.

---

## 2. Architecture & File Mapping

The Payment Voucher module spans across both the Electron Main Process (backend services, database, PDF generation) and the Renderer Process (React UI, live PDF preview, data editing modals):

```
g:\Astro\
├── src/
│   ├── main/
│   │   ├── types.ts                                 # VoucherRecord, MasterWorkbook interfaces
│   │   ├── index.ts                                 # IPC Handlers (generate:execute, previewPdf, masterData:getFormDetails)
│   │   ├── services/
│   │   │   ├── PdfEngine.ts                         # PDF generation pipeline dispatcher for FORM_VOUCHER
│   │   │   ├── MasterDataService.ts                 # parseVoucherRegister() & sanitizeAndCalculateVoucher()
│   │   │   ├── ZipService.ts                        # Output ZIP file packager & filename hints
│   │   │   └── renderers/
│   │   │       ├── VoucherRenderer.ts               # Programmatic PDF vector drawing engine (2-per-page A4)
│   │   │       └── PdfDocumentBuilder.ts            # WinAnsi sanitizer, text wrapping, and font encoders
│   ├── renderer/
│   │   ├── pages/
│   │   │   ├── GenerateForms.tsx                    # UI Control Center, Voucher settings, Range selector, Live viewer
│   │   │   └── MasterData.tsx                       # Master workbook upload, validation status, and sheet summary
│   │   └── components/
│   │       ├── voucher/
│   │       │   └── VoucherSheet.tsx                 # React-based live visual component for DOM/screen preview
│   │       ├── EditDataModal.tsx                    # In-app data grid & form editor with '10_Voucher' schema
│   │       └── PdfViewer.tsx                        # PDF.js / Electron iframe live preview player
```

---

## 3. Data Model & Field Definitions (`VoucherRecord`)

Each voucher entry is represented by the TypeScript interface `VoucherRecord` in [`src/main/types.ts`](file:///g:/Astro/src/main/types.ts):

| Field Name | Type | Description | Sample / Default |
| :--- | :--- | :--- | :--- |
| `voucherNo` | `string` | Official sequential voucher identifier | `001`, `HENU-001` |
| `srNo` | `string` | Serial number in master workbook | `001` |
| `voucherDate` | `string` | Transaction date (parsed to `DD/MM/YYYY`) | `16/09/2026` or Excel serial `46084` |
| `societyName` | `string` | Society name override | `Aishwarya Heights Co-op. Housing Society Ltd.` |
| `socNumber` | `string` | Registration number override | `M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023` |
| `societyAddress`| `string` | Physical address override | `CTS No. 1020 (Part), Mithagar Road, Mulund (E)` |
| `toPayee` | `string` | Vendor, contractor, or person paid | `Apex Elevator Services Pvt. Ltd.` |
| `chargeTo` | `string` | Accounting head / Ledger debit category | `Lift Maintenance & Repair A/c` |
| `particulars` | `string` | Narration / transaction details (3 lines) | `Being monthly AMC charges for passenger lift...` |
| `bankName` | `string` | Bank through which payment was cleared | `State Bank of India` |
| `chequeNo` | `string` | Cheque number, NEFT, or RTGS UTR ref | `CHQ-883921` |
| `billNo` | `string` | Vendor invoice / bill number | `INV-2026-091` |
| `billAmount` | `string` | Primary bill gross amount (Bill Amount 1) | `25000.00` |
| `billAmount2` | `string` | Secondary bill amount (optional) | `0.00` |
| `advLessPaid` | `string` | Advance already paid / deducted | `5000.00` |
| `subTotal1` | `string` | Calculated Total 1 ($Bill_1 + Bill_2 - Adv$) | `20000.00` |
| `tdsPercent` | `string` | Tax Deducted at Source percentage | `2` (meaning 2%) |
| `tdsAmount` | `string` | Calculated TDS deduction ($SubTotal_1 \times TDS\%$) | `400.00` |
| `subTotal2` | `string` | Calculated Total 2 ($SubTotal_1 - TDS$) | `19600.00` |
| `cgstPercent` | `string` | Central GST percentage | `9` (meaning 9%) |
| `cgstAmount` | `string` | Calculated CGST addition ($SubTotal_2 \times CGST\%$) | `1764.00` |
| `sgstPercent` | `string` | State GST percentage | `9` (meaning 9%) |
| `sgstAmount` | `string` | Calculated SGST addition ($SubTotal_2 \times SGST\%$) | `1764.00` |
| `roundOff` | `string` | Fractional rupee adjustment ($+/-$) | `0.00` |
| `otherFineAdj`| `string` | Extra penalties or adjustments | `0.00` |
| `netPaid` | `string` | Final Net Paid Amount ($SubTotal_2 + CGST + SGST \pm Round$) | `23128.00` |

---

## 4. Financial Calculation Engine & Math Logic

The financial sanitizer and calculator is defined in [`sanitizeAndCalculateVoucher()`](file:///g:/Astro/src/main/services/MasterDataService.ts#L815-L886). It guarantees mathematical consistency even when Excel sheets contain missing or raw numeric strings:

$$\text{SubTotal}_1 = \text{BillAmount}_1 + \text{BillAmount}_2 - \text{AdvLessPaid}$$

$$\text{TDS Amount} = \begin{cases} \text{tdsAmount}_{\text{explicit}} & \text{if explicitly provided} \\ \text{SubTotal}_1 \times \left(\frac{\text{tdsPercent}}{100}\right) & \text{if TDS } \% > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$\text{SubTotal}_2 = \text{SubTotal}_1 - \text{TDS Amount}$$

$$\text{CGST Amount} = \begin{cases} \text{cgstAmount}_{\text{explicit}} & \text{if explicitly provided} \\ \text{SubTotal}_2 \times \left(\frac{\text{cgstPercent}}{100}\right) & \text{if CGST } \% > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$\text{SGST Amount} = \begin{cases} \text{sgstAmount}_{\text{explicit}} & \text{if explicitly provided} \\ \text{SubTotal}_2 \times \left(\frac{\text{sgstPercent}}{100}\right) & \text{if SGST } \% > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$\text{Net Paid} = \text{SubTotal}_2 + \text{CGST Amount} + \text{SGST Amount} + \text{RoundOff} + \text{OtherFineAdj}$$

### Currency Formatting & Rupee/Paise Separation:
The helper `splitRupeesPaise(valStr)` formats any numeric string according to the **Indian Numbering System** (Lakhs & Crores, e.g., `1,25,000.00`), returning:
- `rs`: Formatted Rupee portion (e.g. `1,25,000`)
- `ps`: 2-digit Paise portion (e.g. `00` or `50`)

---

## 5. Visual Layout & PDF Geometry Breakdown

The PDF is generated by [`VoucherRenderer.ts`](file:///g:/Astro/src/main/services/renderers/VoucherRenderer.ts).

### 5.1 Page Dimensions & Coordinates:
- **Sheet Dimensions**: $W = 595.28\text{ pt}$, $H = 841.89\text{ pt}$ (A4 Portrait).
- **Margins**: Left = $45\text{ pt}$, Right = $30\text{ pt}$, Top = $26\text{ pt}$, Bottom = $26\text{ pt}$.
- **Usable Width ($vchW$)**: $595.28 - 45 - 30 = 520.28\text{ pt}$.
- **Usable Height ($usableH$)**: $841.89 - 26 - 26 = 789.89\text{ pt}$.
- **Voucher Height ($voucherH$)**: $\frac{789.89}{2} = 394.945\text{ pt}$ per voucher.

```
+-------------------------------------------------------------------+  y = 841.89 (Top of A4 Page)
|  [Margin Top: 26 pt]                                              |
|  +-------------------------------------------------------------+  |  y = 815.89 (Top of Voucher 1)
|  | [Logo]        SOCIETY NAME (Italic Serif Centered)  [Vch No.]|  |
|  |               Reg No. & Date | Address               [Date] |  |
|  |-------------------------------------------------------------|  |
|  | PAY To: [ Vendor Name ]       | CHARGE To: [ Ledger Head ]  |  |
|  |=============================================================|  |
|  | Particulars (3 lines)        | Bill Amount       | % | Rs |Ps|  |
|  | Bill No:                     | Adv. Less/Paid    |   |    |  |  |
|  | Bank Name: SBI               | Total             |   |    |  |  |
|  | Cheque No: [ 123456 ] Date:  | Less TDS @ 2%     | 2%| 400|00|  |
|  |------------------------------| Total             |   |    |  |  |
|  | ₹. [ 23,128/-              ] | Add CGST @ 9%     | 9%|1764|00|  |
|  |                              | Add SGST @ 9%     | 9%|1764|00|  |
|  |                              | Round off (+/-)   |   |   0|00|  |
|  |                              | Net Paid =        |   |2312800|  |
|  |-------------------------------------------------------------|  |
|  | Chairman    Secretary    Treasurer      [Stamp] Receiver Sig |  |
|  +-------------------------------------------------------------+  |  y = 420.95 (Bottom of Voucher 1)
|  - - - - - - - - - - Perforated Cutting Line - - - - - - - - - - - |  y = 420.95 (Dotted Line: dash [4,4])
|  +-------------------------------------------------------------+  |  y = 420.95 (Top of Voucher 2)
|  |                    VOUCHER 2 (Same Layout)                  |  |
|  +-------------------------------------------------------------+  |  y = 26.00 (Bottom of Voucher 2)
|  [Margin Bottom: 26 pt]                                           |
+-------------------------------------------------------------------+  y = 0.00 (Bottom of A4 Page)
```

### 5.2 Section Detail in Each Voucher:

1. **Header Top-Left Logo**:
   - 32x32 square PNG logo rendered from `society.logoBase64` or custom upload.
2. **Top-Right Voucher Box & Double Baseline Date**:
   - Outlined box ($145\text{ pt} \times 22\text{ pt}$) holding bold `Voucher No.`
   - Double underline for transaction date (`Date : ____/__/____`).
3. **Centered Society Branding**:
   - Society Name drawn in `Times-Roman-BoldItalic` with dynamic size fitting.
   - Registration Number & Date + Society Address centered below name.
4. **Pay To / Charge To Row**:
   - $52\%$ split width container with a solid vertical divider and a double bottom horizontal rule ($1.0\text{ pt} + 0.6\text{ pt}$).
5. **Main Data Table**:
   - **Left Column**: Particulars narrative with 3 ruled horizontal lines; Bill No, Bank Name, and Cheque No/Date line; bottom Net Amount line featuring a custom programmatic **Vector Indian Rupee (`₹`) Glyph**.
   - **Right Column (10 Financial Rows)**:
     1. `Bill Amount`
     2. `Bill Amount 2`
     3. `Adv. Less or Paid`
     4. `Total` (Bold Subtotal 1)
     5. `Less TDS @ %` (with dedicated `%` column)
     6. `Total` (Bold Subtotal 2)
     7. `Add CGST @ %`
     8. `Add SGST @ %`
     9. `Round off (+/-)`
     10. `Net Paid =` (Bold Highlighted Row)
6. **Signatures & Revenue Stamp**:
   - 4 horizontal signatures: `Chairman`, `Secretary`, `Treasurer`, `Receiver's Signature`.
   - Empty Revenue Stamp Box ($38\text{ pt} \times 20\text{ pt}$) situated directly above `Receiver's Signature`.

---

## 6. Available Templates

| Template ID | Name | Distinctive Characteristics |
| :--- | :--- | :--- |
| **`TEMPLATE_1`** | **Detailed Financial Calculation** | Master Aishwarya Heights style with full 10-row breakdown (Bill Amount, TDS, CGST, SGST, Net Paid, 3-line narration, Cheque & Bank fields). |
| **`TEMPLATE_2`** | **Open Ledger Grid Style** | Open ledger narration and financial breakdown rows formatted for direct accounting journal vouchers (2 per A4 sheet). |

---

## 7. UI Controls & Configuration Options (GenerateForms.tsx)

Inside [`src/renderer/pages/GenerateForms.tsx`](file:///g:/Astro/src/renderer/pages/GenerateForms.tsx), the Voucher module provides interactive controls:

```
[Generate Forms Control Center] -> [Payment Voucher (A4 Paper)]
```

### 1. Logo Management
- **PNG Upload Widget**: Supports selecting/replacing square PNG society logos stored in SQLite and displayed inside the voucher header.

### 2. Template Selector
- Switch between **Template 1 (Detailed Financial Calculation)** and **Template 2 (Open Ledger Grid Style)**.

### 3. Color Mode & Grid Lines
- **Color Mode**: `Color` (RGB true black & accents) or `BW` (Pure monochrome).
- **Grid Lines**: `Grid ON` (Standard boxed rules) or `Grid OFF`.
- **Paper Size**: Fixed at `A4 (2 Vouchers / Page)`.

### 4. Typography / Font Selector (6 System Fonts)
1. **Times-Roman** (Classic Serif Standard — Default)
2. **Helvetica** (Clean Sans-Serif Standard)
3. **Courier** (Fixed-pitch Monospace Standard)
4. **Helvetica-Bold** (High-contrast Sans-Serif Accent)
5. **Indie Flower** (Handwritten Style)
6. **Merriweather** (Modern Editorial Serif)

### 5. Range & Serial Controls
- **From Voucher No.** / **To Voucher No.** (e.g. `001` to `061`)
- **Blank Vouchers**: Allows appending unnumbered blank forms for manual physical accounting.
- **Prefix & Separator**: Custom prefixing (e.g., `HENU-001`).
- **Real-Time Stat Counters**:
  * *Total Captured*: Number of matched records found in workbook.
  * *Blank Forms*: Count of extra empty vouchers requested.
  * *Problem Data*: Count of corrupted/unparseable records.
  * *Serial Status Matrix*: Visual dot grid showing status for all serials (e.g., `01 ●`, `02 ●`, ... `61 ●`).

---

## 8. Generation & Output Actions

The 4 action buttons operate as follows:

```
┌──────────────────────────┬──────────────────────────┐
│   👁 Live Preview PDF     │    ▶ Generate Voucher PDF │
├──────────────────────────┼──────────────────────────┤
│ 📥 Download Excel / CSV  │    💾 Download Options ▾ │
└──────────────────────────┴──────────────────────────┘
```

1. **Live Preview PDF (`handlePreviewOnly`)**:
   - Calls `api.generate.previewPdf('FORM_VOUCHER', fromSerial, toSerial, options)`.
   - Compiles the PDF in-memory, writes to a temporary preview file, and displays it in real-time inside the right-hand PDF viewer iframe.
2. **Generate Voucher PDF (`handleGenerate`)**:
   - Calls `api.generate.execute()`.
   - Iterates through the active serial range, renders the 2-per-page A4 documents, packages them into a `.zip` archive (named `PAYMENT_VOUCHER_A4_XXX-XXX.zip`), and registers the output in the persistent Generation History.
3. **Download Excel / CSV**:
   - Exports the raw voucher register data from SQLite/Workbook to an editable `.xlsx` spreadsheet.
4. **Download Options Dropdown (▾)**:
   - **Download PNG / JPG**: Renders raster images of the voucher pages.
   - **Download CDR / Vector**: Exports vector documents.
   - **Print Voucher**: Direct system print dialog to physical printer.

---

## 9. In-App Spreadsheet & Quick Form Editing

Users can modify voucher records on the fly using the **Edit Data Modal** (`10_Voucher` schema in [`EditDataModal.tsx`](file:///g:/Astro/src/renderer/components/EditDataModal.tsx)):

- **Spreadsheet Mode**: High-speed Excel-like grid editor supporting multi-cell pasting, row addition/deletion, and undo/redo.
- **Quick Form Mode**: Search by Voucher No or Payee Name, with direct field editing and auto-recalculation upon saving.

---

## 10. Summary Audit Findings & Health Status

| Checkpoint | Audit Result | Status |
| :--- | :--- | :--- |
| **Vector Layout & DPI** | Pure programmatic vector paths via `pdf-lib` (resolution independent, crisp printing at 300+ DPI). | 🟢 **PASSED** |
| **A4 Sheet Constraints** | Fixed A4 Portrait ($595.28 \times 841.89\text{ pt}$), zero vertical overflow, exact $50\%$ page partition ($394.94\text{ pt}$ per voucher). | 🟢 **PASSED** |
| **Indian Rupee (`₹`) Vector** | Rendered via custom coordinate strokes; avoids WinAnsi character encoding failures. | 🟢 **PASSED** |
| **Financial Arithmetic** | Auto-calculates SubTotal1, TDS, SubTotal2, CGST, SGST, RoundOff, and Net Paid with 100% accuracy. | 🟢 **PASSED** |
| **Logo & Branding** | Seamlessly embeds society PNG logo and dynamic multi-line society header. | 🟢 **PASSED** |
| **Perforation & Stamps** | Dotted cut lines and revenue stamp boxes aligned with official auditing standards. | 🟢 **PASSED** |

---
*Audit Document Generated for HENU OS Records Management — Payment Voucher Engine.*
