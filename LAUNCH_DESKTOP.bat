@echo off
REM HENU OS — Desktop App Launcher (Direct)
REM Run this .bat to launch the HENU OS desktop app without npm

set ELECTRON_DISABLE_SANDBOX=1
set ELECTRON_NO_ASAR=1

echo Starting HENU OS Records Management...
"G:\Astro\node_modules\electron\dist\electron.exe" "G:\Astro" --no-sandbox --disable-gpu --disable-software-rasterizer --no-crashpad

pause
