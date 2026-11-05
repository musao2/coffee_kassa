#!/bin/bash
# =====================================================================
#  COFFEEGRAM KASSA — chekni so'ramasdan chiqarish (macOS)
#  Ikki marta bosing:
#   - birinchi marta printerni tanlaysiz (eslab qolinadi va standart qilinadi)
#   - chek bosilganda printer oynasi ham, "Save" ham chiqmaydi — darhol printerga ketadi
#  KASSA_URL ni o'z kassa saytingiz manziliga o'zgartiring.
#  Printerni almashtirish: faylni Option (⌥) tugmasini bosib turib oching.
# =====================================================================
KASSA_URL="https://kassa.coffeegram.uz"

DIR="$HOME/.coffeegram-kassa"
PRINTER_FILE="$DIR/printer.txt"
mkdir -p "$DIR"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  osascript -e 'display alert "Google Chrome topilmadi" message "Avval Google Chrome o‘rnating: google.com/chrome"'
  exit 1
fi

# Option (⌥) bosilgan bo'lsa — printerni qayta tanlash
if osascript -e 'tell application "System Events" to return (option down of (get current modifiers)) ' 2>/dev/null | grep -q true; then
  rm -f "$PRINTER_FILE"
fi

PRINTER="$(cat "$PRINTER_FILE" 2>/dev/null)"
if [ -z "$PRINTER" ] || ! lpstat -p "$PRINTER" >/dev/null 2>&1; then
  LIST="$(lpstat -p 2>/dev/null | awk '/^printer /{print $2}')"
  if [ -z "$LIST" ]; then
    osascript -e 'display alert "Printer topilmadi" message "Termal printerni ulang va Tizim sozlamalari → Printerlar va skanerlar orqali qo‘shing, keyin qayta oching."'
    exit 1
  fi
  ITEMS="$(printf '%s\n' "$LIST" | sed 's/.*/"&"/' | paste -sd, -)"
  PRINTER="$(osascript -e "choose from list {$ITEMS} with title \"Coffeegram kassa\" with prompt \"Chek qaysi printerdan chiqsin? (termal 80mm printerni tanlang)\" OK button name \"Tanlash\" cancel button name \"Bekor\"")"
  if [ -z "$PRINTER" ] || [ "$PRINTER" = "false" ]; then exit 0; fi
  printf '%s' "$PRINTER" > "$PRINTER_FILE"
fi

# Tanlangan printerni standart qilamiz — Chrome kiosk rejimi aynan standart printerga chop etadi
lpoptions -d "$PRINTER" >/dev/null 2>&1

# Alohida profil: oddiy Chrome ochiq bo'lsa ham shu rejim ishlaydi (birinchi marta kassaga bir marta kirasiz)
"$CHROME" --user-data-dir="$DIR/chrome" --kiosk-printing \
  --no-first-run --no-default-browser-check --app="$KASSA_URL" >/dev/null 2>&1 &
