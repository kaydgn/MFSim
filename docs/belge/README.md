# Şanzıman ailesinin belgeleri — ham PDF arşivi

Bir belge bir kez konur; sonraki oturumlar yeniden yüklemeden okur. Build ve Pages'e
**girmez**. Programa giren, belgenin seçilmiş sayfalarının görseli (`assets/belge/<aile>/`) ve
işaretli bölgeleridir (`js/mount-belge-veri.js`); ikisini de `tools/belge-sayfa.js` bu PDF'ten
üretir (tanım `tools/belge-tanim.js`; poppler ve Playwright'ın Chromium'u gerekir):

```bash
MFSIM_CHROMIUM=/opt/pw-browsers/chromium node tools/belge-sayfa.js
```

| Aile | Belge | Programdaki sayfalar |
|------|-------|----------------------|
| `allison-4000` | `allison-4000/DATA_4K_TRANSMISSION_DATA_PRODUCT_FAMILY.pdf` — 4000 Product Family Transmission Data · 15.10.2020 · DATA_4K · 50 sayfa | 5 (§8 kuru kütleler) · 6 (§9.1 ağırlık merkezi, CR/WR) · 7 (§9.2, yedi vitesli) · 8 (§11 atalet) · 9 (§12 vites oranları) · 10 (§13 yağ) · 21 · 27 · 33 · 37 · 41 · 45 (17.3–17.8 soğutucular) |

Programın Allison 4000 tabloları (`js/mount-veri-sayfasi.js` → `VE_MNT_A4K`) bu belgeden;
bölgelerin satırındaki sayılar o tablolarla birebir — kapı `tests/unit/mount-belge.test.js` →
*PDF İLE AYNI* (62 satır, 157 değer).
