@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo              HENU AI — REAL USB MODEL RUNTIME HEALTH TEST
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
echo.

set "PY=%USB_ENGINE_ROOT%\runtime\python\python.exe"
if not exist "%PY%" (
    echo [ERROR] USB Embeddable Python runtime not found at: %PY%
    exit /b 1
)

echo Executing Model Diagnostics & Health Tests via USB Python Runtime...
"%PY%" "%USB_ENGINE_ROOT%\tests\test_final_production.py"

echo.
echo ======================================================================
echo MODEL TEST FINISHED
echo ======================================================================
