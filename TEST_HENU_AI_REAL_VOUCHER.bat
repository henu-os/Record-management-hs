@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo          HENU AI — REAL VOUCHER FORENSIC OCR & PIPELINE TEST
echo ======================================================================

:: 1. Dynamic Removable USB Discovery
set "USB_ENGINE_ROOT="
for %%D in (D E F G H I J K L U) do (
    if exist "%%D:\HENU AI\manifest.json" (
        if exist "%%D:\HENU AI\DEVICE_ID.txt" (
            set "USB_ENGINE_ROOT=%%D:\HENU AI"
            set "USB_DRIVE=%%D:"
            goto :found_usb
        )
    )
)

:found_usb
if "%USB_ENGINE_ROOT%"=="" (
    echo [ERROR] Authorized HENU AI Engine USB was not detected on any drive!
    exit /b 1
)

echo [OK] Discovered HENU AI USB Root: %USB_ENGINE_ROOT% (Drive: %USB_DRIVE%)

set "INPUT_IMAGE=%~1"
if "%INPUT_IMAGE%"=="" (
    set "INPUT_IMAGE=G:\Astro\testvoucher.jpeg"
)

echo [OK] Target Voucher Image: %INPUT_IMAGE%
echo.

set "PY=%USB_ENGINE_ROOT%\runtime\python\python.exe"
"%PY%" "G:\Astro\scripts\run_real_voucher_ocr.py" "%INPUT_IMAGE%"

echo.
echo ======================================================================
echo VOUCHER PIPELINE EXECUTION FINISHED
echo ======================================================================
