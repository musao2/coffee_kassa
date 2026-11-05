@echo off
rem =====================================================================
rem  COFFEEGRAM KASSA - chekni so'ramasdan chiqarish (Windows)
rem  Ikki marta bosing: chek bosilganda printer oynasi ham, "Save" ham chiqmaydi.
rem  1) KASSA_URL ga kassa saytingiz manzilini yozing.
rem  2) PRINTER ga termal printer nomini yozing (Sozlamalar - Printerlar ro'yxatidagi nom),
rem     masalan: set "PRINTER=XP-80C". Bo'sh qolsa - Windows standart printeri ishlatiladi.
rem =====================================================================
set "KASSA_URL=https://kassa.coffeegram.uz"
set "PRINTER="

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome topilmadi. Avval google.com/chrome dan o'rnating.
  pause
  exit /b 1
)

rem Windows printerni o'zi almashtirib yubormasligi uchun
reg add "HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows" /v LegacyDefaultPrinterMode /t REG_DWORD /d 1 /f >nul 2>&1

if not "%PRINTER%"=="" (
  rundll32 printui.dll,PrintUIEntry /y /n "%PRINTER%"
  if errorlevel 1 (
    echo "%PRINTER%" nomli printer topilmadi. Mavjud printerlar:
    wmic printer get name
    pause
    exit /b 1
  )
)

start "" "%CHROME%" --user-data-dir="%LocalAppData%\CoffeegramKassa" --kiosk-printing --no-first-run --no-default-browser-check --app="%KASSA_URL%"
