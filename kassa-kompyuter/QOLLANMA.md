# Chekni so'ramasdan chiqarish (printer oynasi ham, "Save" ham chiqmaydi)

**Nega "Save" chiqadi?** Printer oynasida *Destination: Save as PDF* tanlangan bo'lsa, brauzer chekni
faylga saqlashni so'raydi. Haqiqiy printer tanlanib, kassa quyidagi fayl orqali ochilsa — hech narsa
so'ralmaydi, chek darhol printerdan chiqadi.

## macOS

1. `Kassani-ochish-mac.command` ni matn muharririda oching, `KASSA_URL` ga kassa saytingizni yozing.
2. Faylni **ikki marta bosing**.
   - Birinchi marta **printerlar ro'yxati** chiqadi → termal (80mm) printerni tanlang.
     Tanlov eslab qolinadi va u **standart printer** qilib qo'yiladi.
   - Kassa alohida oynada ochiladi → bir marta kassir login bilan kiring.
3. Tayyor: "Chek chiqarish" → chek darhol chiqadi.
4. Printerni almashtirish: faylni **Option (⌥)** tugmasini bosib turib oching.

> Birinchi marta macOS "noma'lum dasturchi" desa: faylni o'ng tugma → **Open** → **Open**.

## Windows

1. `Kassani-ochish-windows.bat` ni Bloknot'da oching:
   - `KASSA_URL` ga kassa saytingizni yozing;
   - `PRINTER` ga termal printer nomini yozing (Sozlamalar → Printerlar ro'yxatidagi nom aynan shunday),
     masalan `set "PRINTER=XP-80C"`.
2. Faylni ikki marta bosing → kassa ochiladi → bir marta kirasiz. Ish stoliga yorliq qilib qo'ying.

## Printer sozlamasi (bir marta)

Kiosk rejimi printerning o'z sozlamalaridan foydalanadi. Printer sozlamalarida (yoki birinchi marta
oddiy Chrome'da chekni chiqarib, "More settings" da):
- **Qog'oz o'lchami:** 80mm / "Receipt" / "80 x 297"
- **Margins:** None
- **Scale:** 100%, **Headers and footers:** o'chiq

## Muhim

- Chek **standart printerdan** chiqadi — boshqa (A4) printer standart bo'lsa, chek o'sha yerdan chiqadi.
- Bu faqat shu fayl orqali ochilgan kassa oynasiga ta'sir qiladi; oddiy Chrome'da printer oynasi chiqaveradi.
