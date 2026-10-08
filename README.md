# 🏛️ HENU OS RECMA (Records Management & Automation System)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/henu-os/Record-management-hs/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6.svg?logo=windows)](https://github.com/henu-os/Record-management-hs/releases)
[![Electron](https://img.shields.io/badge/Electron-31.7.7-47848F.svg?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](#)

> **HENU OS RECMA** is an enterprise-grade offline desktop application engineered for Housing Societies, Trusts, and Organizations. It delivers automated ledger processing, intelligent OCR scanning for vouchers & checks, multi-society records management, high-fidelity PDF form generation, and banking-grade security & disaster recovery.

---

## 🚀 Download & Installation

You can download the ready-to-use Windows installer directly from the [GitHub Releases](https://github.com/henu-os/Record-management-hs/releases):

1. Go to the **[Releases](https://github.com/henu-os/Record-management-hs/releases)** page.
2. Download **`HENU OS RECMA Setup.exe`**.
3. Run the installer and follow the on-screen setup wizard.
4. Launch **HENU OS RECMA** directly from your Desktop or Start Menu.

---

## ✨ Key Features

### 🏢 1. Multi-Society Context Isolation (HENU Master)
- Seamlessly manage, switch, configure, and isolate distinct societies and organizations.
- Complete data boundary separation: each society maintains isolated ledger tables, templates, settings, and audits.
- Full lifecycle management (Create, Edit, Archive, and multi-tier authenticated Deletion).

### 📄 2. Automated Regulatory PDF Form & Certificate Generation
- **Share Certificates**: Dynamic certificate rendering with dual-language typography (English + Devanagari Mukta & Noto Sans).
- **Statutory Forms**: Automatic population for Form I, Form J, Nominee Registers, and Custom Society Registers.
- **Serial Range Engine**: Automatic continuous serial tracking and range validation.
- High-fidelity PDF rendering powered by `pdf-lib` and `fontkit`.

### 🔍 3. Intelligent OCR Scanning Engine
- **Voucher OCR**: Automated receipt, invoice, and payment voucher text and numerical extraction.
- **Cheque OCR**: Real-time extraction of account numbers, MICR lines, payee names, and amounts.
- Offline text extraction powered by `tesseract.js` with zero external cloud dependencies.

### 🔒 4. Enterprise Security & Multi-Tier Access Control
- **Security Lock & MFA**: Passcode protection with multi-factor challenge-response verification for destructive operations.
- Anti-bruteforce lockouts with timed cooling and security token persistence.
- First-Run Setup Wizard ensuring secure administrative initialization.

### 💾 5. Comprehensive Backup, Export & Disaster Recovery
- Full snapshot database backups with checksum validation.
- Selective Excel master data export and import (`.xlsx`).
- System health diagnostic monitoring with live storage tracking and database integrity checks.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime / Packaging** | Electron 31, Electron-Builder (NSIS Installer) |
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Lucide Icons |
| **Bundler & Tooling** | Vite 5, TypeScript 5 |
| **Database** | SQLite3 (`better-sqlite3`) with WAL journal mode |
| **Document Generation** | `pdf-lib`, `@pdf-lib/fontkit`, `exceljs`, `xlsx` |
| **OCR & Vision** | `tesseract.js` (Offline Engine) |

---

## 💻 Developer Guide & Local Setup

### Prerequisites
- Node.js (v20.x or higher recommended)
- npm or yarn
- Windows 10/11 x64

### 1. Clone the Repository
```bash
git clone https://github.com/henu-os/Record-management-hs.git
cd Record-management-hs
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run in Development Mode
```bash
npm run desktop
```
*(Runs Vite dev server + TypeScript compiler + Electron desktop window simultaneously)*

### 4. Build Production Executable (.exe)
```bash
npm run package
```
The output installer will be generated at:
- `HENU OS RECMA Setup.exe` (Root directory)
- `release/HENU OS RECMA Setup.exe`

---

## 📁 Project Structure

```
g:/Astro/
├── dist/                     # Compiled main & renderer code
├── public/                   # Static assets, logos & branding
├── release/                  # Packaged NSIS executables & build artifacts
├── scripts/
│   ├── build-installer.js    # Automated production packaging script
│   └── launch-electron.js    # Electron development process manager
├── src/
│   ├── main/                 # Electron main process & IPC handlers
│   │   ├── db.ts             # SQLite database manager & schemas
│   │   ├── services/         # Business logic (Master, Security, PDF, OCR)
│   │   └── types.ts          # Backend type definitions
│   ├── renderer/             # React UI application
│   │   ├── components/       # Reusable UI widgets & Modals
│   │   ├── context/          # Society & Security context providers
│   │   └── pages/            # Core views (HENU Master, Config, OCR, Forms)
│   └── templates/            # PDF templates & Devanagari font files
└── package.json              # Project dependencies & build config
```

---

## 🛡️ License & Trademarks

© 2026 **HLabs / HENU OS**. All rights reserved.  
Unauthorized copying, modification, or distribution is strictly prohibited.
