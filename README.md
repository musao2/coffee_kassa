# Coffeegram — Kassa (alohida ilova)

Faqat **kassirlar** uchun: menyudan buyurtma yoki erkin summa → QR → mijoz skanerlaydi → chek.
Mijozga qaragan ikkinchi ekran — `/display`.

```bash
cp .env.example .env     # Supabase URL/kalit + VITE_CUSTOMER_URL (mijoz ilovasi manzili)
npm install
npm run dev              # http://localhost:5182
```

- **Kassir akkaunti:** admin panel → Xodimlar → Kassir qo'shish. Kassir bo'lmagan akkaunt kira olmaydi.
- **QR ekran:** mijozga qaragan planshetda shu kassir logini bilan `/display` (ikki marta bosish — to'liq ekran).
- **QR chek:** "QR chek chiqarish" → 80mm printerga; mijoz keyinroq chekdagi QR'ni skanerlaydi.
- **Deploy:** asosiy qo'llanma — `coffee-cashback/README.md`. `VITE_CUSTOMER_URL` **majburiy**.
# coffee_kassa
