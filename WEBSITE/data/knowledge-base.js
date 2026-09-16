/** HENU OS KNOWLEDGE BASE BUNDLE **/
window.HENU_KNOWLEDGE_BASE = {
  "system": {
    "productName": "HENU OS Records Management",
    "version": "1.0.0",
    "developer": "HLabs Technology",
    "platform": "Windows 10 / 11 (x64)",
    "technology": "Electron + TypeScript + React + PDF-Lib + SheetJS + Local SQLite/JSON Store",
    "architecture": "100% Local-First Offline Database"
  },
  "modules": [
    {
      "id": "getting-started",
      "name": "Overview & Quick Start",
      "category": "Getting Started",
      "description": "Comprehensive introduction to HENU OS Records Management, system lifecycle, and step-by-step initialization.",
      "steps": [
        "Step 1: Download and launch the HENU OS desktop installer on your Windows (x64) machine.",
        "Step 2: On first launch, the local database is automatically created in %APPDATA%\\HENU_OS_Records\\database\\.",
        "Step 3: In the Top Header, click 'Add Society' to create your first cooperative housing or commercial society.",
        "Step 4: Navigate to Master Data, download the official 8-sheet Master Excel Template, and populate your member records.",
        "Step 5: Upload the populated Excel sheet. The built-in validation engine automatically scans for errors (ERR_001 to ERR_009).",
        "Step 6: Navigate to Generate Forms, select any statutory register (Form I, Form J, Share, Nomination, Property, Bank Lien, Share Cert, Voucher), select your serial number range, preview the PDF layout, and export to ZIP."
      ]
    },
    {
      "id": "storage-paths",
      "name": "Storage & AppData Paths",
      "category": "Getting Started",
      "description": "Details of the local file system layout, database files, temporary directories, and generated file repositories.",
      "paths": [
        "Database Store: %APPDATA%\\HENU_OS_Records\\database\\henu-os-store.json",
        "Database Backups: %APPDATA%\\HENU_OS_Records\\database\\henu-os-store.backup.json",
        "Temporary PDF Staging: %APPDATA%\\HENU_OS_Records\\temp\\",
        "Generated ZIP Exports: C:\\Users\\<Username>\\Downloads\\HENU_OS\\ZIP\\",
        "Downloaded Master Templates: C:\\Users\\<Username>\\Downloads\\HENU_OS\\Templates\\"
      ]
    },
    {
      "id": "dashboard",
      "name": "Dashboard Console",
      "category": "Core Modules",
      "description": "Real-time command center monitoring society identity, statutory foundation gate readiness, member statistics, and generation history.",
      "steps": [
        "Step 1: Inspect the Active Society Card to verify Registration Number, Date, and Address.",
        "Step 2: Check Foundation Gate 1 (Society Master Complete) and Foundation Gate 2 (Member Master Complete). Both must show 'VALIDATED' before registers can be generated.",
        "Step 3: View Real-Time Metric Tiles: Total Members, Active Shares, Nominee Allocations, and Tenements.",
        "Step 4: Use the Recent History Log to re-open or locate previously exported PDF/ZIP bundles with one click."
      ]
    },
    {
      "id": "society-management",
      "name": "Society Management & Multi-Tenant Isolation",
      "category": "Core Modules",
      "description": "Multi-society workspace manager supporting individual registration details, custom high-DPI society logos, and 100% data isolation.",
      "steps": [
        "Step 1: Click 'Add Society' in the Dashboard or top header bar.",
        "Step 2: Fill in the mandatory statutory fields: Society Legal Name, Registration Number, Registration Date, Address, City, State, and PIN Code.",
        "Step 3: Upload Society Logo (PNG, JPEG, or WebP). The system automatically converts the logo to Base64 and embeds it with high-DPI scaling on all generated forms.",
        "Step 4: Click 'Save Society'. To switch between societies, simply select the society name from the top header dropdown. All dashboard cards, master sheets, and generated files immediately reload in isolated context."
      ]
    },
    {
      "id": "master-data",
      "name": "Master Data & 8 Statutory Sheets",
      "category": "Core Modules",
      "description": "Central workbook engine handling 8 interconnected statutory sheets, spreadsheet editor, and validation rules.",
      "sheets": [
        "SOCIETY_MASTER: Society registration number, date, address, contact, and total unit distribution.",
        "COMMON_FILE: Base member master containing Serial No (srNo), Member Name, Flat/Shop/Unit No, Wing, Share Certificate No, Distinctive Shares (From/To), and Folio No.",
        "FORM_I_DATA: Detailed member admission history, entrance fees, and occupation data.",
        "FORM_J_DATA: List of members, shareholdings, and residential address records.",
        "SHARE_DATA: Comprehensive 18-column statutory share register.",
        "NOMINATION_DATA: Member nominee designations with split percentage allocation.",
        "PROPERTY_DATA: Tenement and property descriptions, carpet area, and dimensions.",
        "BANK_LIEN_DATA: Mortgage, bank lien markings, and loan release records."
      ],
      "validationRules": [
        "ERR_001: Missing Serial Number (srNo is required for every row)",
        "ERR_002: Missing Member Name (memberName cannot be blank)",
        "ERR_003: Duplicate Serial Number (serial numbers must be strictly unique within a society)",
        "ERR_004: Invalid Percentage Sum (nominee percentages must not exceed 100%)",
        "ERR_005: Missing Flat/Unit Number (flatNo required for tenement mapping)",
        "ERR_006: Invalid Date Format (expected DD/MM/YYYY or ISO 8601)",
        "WARN_001: Unallocated Shares (shareCount does not match distinctive range)",
        "WARN_002: Blank Optional Fields (empty telephone or nominee address)"
      ]
    },
    {
      "id": "control-center",
      "name": "Control Center & Foundation Gates",
      "category": "Core Modules",
      "description": "Statutory compliance gatekeeper that validates prerequisite data completeness before unlocking register generation.",
      "gates": [
        "Gate 1 (Society Master Gate): Verifies that society name, registration number, and address are fully populated.",
        "Gate 2 (Member Master Gate): Verifies that COMMON_FILE contains at least 1 validated member record with valid serial number, name, and flat number.",
        "Gate 3 (Statutory Release Gate): Automatically unlocks all 8 generation pipelines once Gates 1 and 2 pass."
      ]
    },
    {
      "id": "settings",
      "name": "Settings & Typography Engine",
      "category": "Core Modules",
      "description": "Per-society and global visual customization system for fonts, borders, margins, and colors.",
      "options": [
        "Font Selection: Helvetica, Times-Roman, Courier, Merriweather, Indie Flower, and Marathi Unicode fonts.",
        "Border Grid Modes: Border Grid ON (Full tabular borders) / Border Grid OFF (Clean minimalist ledger lines).",
        "Color Profiles: Full Color (Accent purple/indigo), Monochromatic Black & White, or Grayscale.",
        "Branding Footer: Custom footer text, copyright notice, page numbering alignment, and logo position offsets."
      ]
    },
    {
      "id": "form-i",
      "name": "Form I — Register of Members",
      "category": "Statutory Registers",
      "description": "Statutory Register of Members prescribed under Cooperative Societies Act.",
      "paper": "A4 Portrait (210 × 297 mm)",
      "layout": "Dynamic row height, multi-entry overflow protection, 10 to 30 rows per page configurable.",
      "steps": [
        "Step 1: Open 'Generate Forms' from the sidebar and select 'Form I'.",
        "Step 2: Enter the 'From Serial' (e.g. 001) and 'To Serial' (e.g. 050).",
        "Step 3: Select density (e.g. 15 rows per page) and choose whether to print blank continuation lines.",
        "Step 4: Click 'Preview PDF' to inspect the rendered canvas.",
        "Step 5: Click 'Generate & Export' to save the final PDF and ZIP bundle to Downloads."
      ]
    },
    {
      "id": "form-j",
      "name": "Form J — List of Members",
      "category": "Statutory Registers",
      "description": "Official List of Members for statutory submission and general body meetings.",
      "paper": "A4 Portrait (210 × 297 mm) or Landscape",
      "layout": "Customizable density with up to 30 members per page, stacked co-member names, and wrapped postal addresses."
    },
    {
      "id": "form-share",
      "name": "18-Column Share Register",
      "category": "Statutory Registers",
      "description": "Comprehensive 18-column statutory share register tracking share allotments, certificate numbers, transfer history, and distinctive share numbers.",
      "paper": "A4 Landscape (297 × 210 mm)",
      "layout": "Full-width table with crisp border rendering and zero text clipping."
    },
    {
      "id": "form-nom",
      "name": "Nomination Register",
      "category": "Statutory Registers",
      "description": "Records member nominations, nominee relations, percentage allocations, and date of entry.",
      "paper": "A4 Landscape (297 × 210 mm)",
      "layout": "Multi-nominee split rows per member with mathematical percentage verification totaling 100%."
    },
    {
      "id": "form-prop",
      "name": "Property Register",
      "category": "Statutory Registers",
      "description": "Tenement, flat, shop, office, and gala property asset register detailing floor area and ownership history.",
      "paper": "A4 Landscape (297 × 210 mm)",
      "layout": "Structured columns for unit type, carpet area, and transfer records."
    },
    {
      "id": "form-bank",
      "name": "Bank Lien Mark Register",
      "category": "Statutory Registers",
      "description": "Tracks bank mortgage liens, loan NOCs, and lien release notices.",
      "paper": "A4 Landscape (297 × 210 mm) or Portrait",
      "layout": "Bank institution, loan sanction, and mortgage release notation cells."
    },
    {
      "id": "form-share-cert",
      "name": "Share Certificate (Super A3 / 13x19)",
      "category": "Statutory Registers",
      "description": "High-resolution statutory Share Certificate designed for Super A3 (13×19 inch / 330.2 × 482.6 mm) professional printing.",
      "paper": "Super A3 (330.2 × 482.6 mm)",
      "layout": "Ornate vector borders, bilingual English/Marathi typography, dual signature blocks, and share details table."
    },
    {
      "id": "form-voucher",
      "name": "Payment Voucher (US Legal 3-Per-Page)",
      "category": "Statutory Registers",
      "description": "Standardized society payment voucher printed 3-up on US Legal paper with perforated cutting guides.",
      "paper": "US Legal (8.5 × 14 inches / 215.9 × 355.6 mm)",
      "layout": "3 identical vouchers per page, automated amount-in-words converter, debit/credit notation."
    },
    {
      "id": "troubleshooting",
      "name": "Troubleshooting & Error Recovery",
      "category": "Troubleshooting & Issues",
      "description": "Comprehensive diagnosis and step-by-step resolution guide for all common operational, database, Excel, and PDF layout issues.",
      "issues": [
        {
          "issue": "Excel Master Template Not Importing or Showing Parsing Error",
          "cause": "The uploaded workbook is missing one of the 8 mandatory statutory sheet tabs or has modified tab names.",
          "solution": "Download a fresh Master Template from Master Data -> 'Download Master Template', paste your data into the exact tab names (COMMON_FILE, FORM_I_DATA, etc.), and re-upload."
        },
        {
          "issue": "ERR_001 / ERR_003: Missing or Duplicate Serial Number",
          "cause": "A member row has a blank 'srNo' or two members share the exact same serial number.",
          "solution": "Open the Master Data Spreadsheet Editor, filter by 'COMMON_FILE', ensure every member has a unique padded serial number (e.g. 001, 002), and click 'Save Changes'."
        },
        {
          "issue": "ERR_004: Invalid Nominee Percentage Sum",
          "cause": "The nominee percentage allocations for a member do not sum to 100%.",
          "solution": "Navigate to the NOMINATION_DATA sheet in Spreadsheet Editor, adjust the percentage values (e.g. 50% + 50% = 100%), and save."
        },
        {
          "issue": "Foundation Gate 1 or Gate 2 is Locked (Red Badge)",
          "cause": "Required society registration details or member records are incomplete.",
          "solution": "Go to Society Management, ensure Society Name, Reg. No., and Address are filled. Then go to Master Data and ensure COMMON_FILE contains at least 1 validated member."
        },
        {
          "issue": "Society Switching in Header Does Not Update Dashboard",
          "cause": "Active society was updated but child component state required event broadcast.",
          "solution": "In HENU OS v1.0.0, live global event synchronization is active. If running a cached window, press Ctrl+R to reload the Electron renderer."
        },
        {
          "issue": "Generated PDF Text is Clipped or Table Overflows Page",
          "cause": "Too many rows per page selected or font size is too large.",
          "solution": "Open Generate Forms, reduce 'Rows Per Page' from 25 to 15, or open Settings and choose a compact font such as Helvetica or Courier."
        },
        {
          "issue": "Share Certificate Margin Offset on Physical Press Printer",
          "cause": "Printer hardware margins differ from Super A3 printable area.",
          "solution": "In printer dialog, select 'Actual Size / 100% Scale' (do not use 'Fit to Page' or 'Shrink to Printable Area')."
        }
      ]
    }
  ],
  "faq": [
    {
      "question": "How do I import the master Excel file in HENU OS?",
      "answer": "Navigate to the Master Data page, click 'Upload Master Template', select your 8-sheet Excel file (.xlsx or .xls), and the system will automatically parse and validate all records.",
      "relatedModule": "master-data"
    },
    {
      "question": "Why is my serial number missing or showing an error?",
      "answer": "Every record in COMMON_FILE must have a valid 'srNo' (e.g., '001', '002'). If srNo is blank or duplicate, the validation engine flags ERR_001 or ERR_003. You can edit the cell directly in the Spreadsheet Editor and click Save Changes.",
      "relatedModule": "troubleshooting"
    },
    {
      "question": "How do I generate Form I for a specific serial range?",
      "answer": "Go to Generate Forms, select 'Form I', enter the 'From Serial' (e.g. 001) and 'To Serial' (e.g. 050), adjust rows per page (10 to 30), click 'Preview PDF' to check layout, and click 'Generate & Export' to save the PDF/ZIP.",
      "relatedModule": "form-i"
    },
    {
      "question": "Where are generated PDF and ZIP files saved on my computer?",
      "answer": "By default, all generated ZIP archives and export files are saved to your Downloads folder at 'C:\\Users\\<YourUsername>\\Downloads\\HENU_OS\\ZIP\\'. You can open any file directly from the Generated Files tab.",
      "relatedModule": "storage-paths"
    },
    {
      "question": "How do I switch between different societies?",
      "answer": "Use the society dropdown in the top-right header of the application. Selecting a society instantly switches the active workspace, master records, and settings with complete isolation.",
      "relatedModule": "society-management"
    },
    {
      "question": "Can I print Share Certificates on 13x19 inch paper?",
      "answer": "Yes! The Share Certificate module is custom-engineered for Super A3 (13×19 inch) printing with high-resolution vector borders, Marathi/English text, and dual signature blocks.",
      "relatedModule": "form-share-cert"
    },
    {
      "question": "Does HENU OS work offline without internet?",
      "answer": "Yes, HENU OS is a 100% local desktop application. All database records, PDF rendering engines, and templates run entirely on your local machine without sending your private records to the cloud.",
      "relatedModule": "storage-paths"
    },
    {
      "question": "How do I change the font or turn off grid borders on generated PDFs?",
      "answer": "Open Settings, select the specific form (e.g. Form I or Share Register), toggle 'Grid ON/OFF', pick your preferred font (Helvetica, Times, Merriweather, etc.), and click 'Save Design Settings'.",
      "relatedModule": "settings"
    }
  ]
}
;
