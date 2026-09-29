# Kayma grafikleri — sayıya çevrildi (2026-09-29)

Her Gates raporunun *Belt Slip / Tension Analysis* bölümünde iki grafik var:
kasnak başına **kayma emniyeti** (log ölçek, eşik 1) ve aksesuarların **tepe
yükü**. İkisi de PDF'e **raster** gömülü, metin katmanında sayı yok. Bu yüzden
kaymama koşulu karşılaştırmasına bugüne kadar girmediler. Bu klasör onları
sayıya çeviriyor ve Gates'in koşulunu MFSim köprüsüyle yeniden kuruyor.

**Bir ÖLÇÜM ARACIDIR, kapı değil.** Buradaki hiçbir dosya `npm test`'e girmez
(jest kökü `tests/unit`). Bir kapı kurulursa sayıları `sayisal.json`'dan
okur. Bulgular ve karar önerileri kaymama koşulu analizinde (sohbet
artifact'ı "Kaymama Koşulu", 2026-09-29).

| Dosya | Ne | Kaynağı |
|-------|----|---------|
| `sayisal.json` | 11 raporun kayma eğrileri (45 kasnak) + 10 tepe yük grafiği, eksen kalibrasyonuyla birlikte | `sayisallastir.py` üretir |
| `grafikler.json` | her grafiğin PDF'i, sayfası, dikdörtgeni, çözünürlüğü | `cikar.py` üretir |
| `gates-girdi.json` | tasarım gerginliği, ivme, aksesuar ataletleri, kritik koşullar | raporların metin katmanından |
| `cikar.py` | kayma grafiklerini PDF'ten doğal çözünürlükte çıkarır | |
| `sayisallastir.py` | eksen kalibrasyonu + eğri izleme | |
| `zincir.test.js` | Gates'in koşulunu (devir × ±ivme × %10/%100 yük × avara sürtünmesi) köprüyle kurar | |
| `analiz.js` · `analiz2.js` | SF tanımı testi, μ kalibrasyonu, kasnak ayrıntıları | |
| `sayfa-veri.js` · `sayfa-uret.js` · `sayfa-sablon.html` | analiz sayfasını üretir | |

**Gözle okunan tek şey eksen ETİKETLERİDİR** (`sayisallastir.py` → `OKUNAN`):
kayma grafiğinin x ekseninin sağ ucu ve tepe yük grafiğinin ilk etiketiyle
adımı. Geri kalan her şey çerçeve, eşik çizgisi ve çentiklerden kalibre
edilir. Log ölçeğin on kat adımı uzun çentiklerden alınır. Devir ölçeği
çentik aralığından gelir (adım = 0,15 · sağ uç; on bir grafikte çerçeve ⁄ adım
6,64–6,70, beklenen 6,67).

**Kuşkulu veri İŞARETLİ durur, silinmez** (`sayfa-uret.js` → `bayrak`):
- AG00902'nin iki revizyonunda grafik raporun kendi ortalama gerginlik
  tablosuyla tek μ ile tutmuyor.
- AG00894'te iki klima ve iki avara aynı renkte.
- AG00976'nın kayma bölümünün ilk yüzü alıntıda yok.
- AG00686'da gergi kasnağına kolun ataleti girilmiş.

Yeniden üretmek (`pymupdf` gerekir; bkz. üst klasörün README'si):

```bash
W=$(mktemp -d); cp docs/gates-reports/kayma/* "$W"; mkdir -p "$W/sf" "$W/pp"
python3 docs/gates-reports/kayma/cikar.py "$W/sf"   # depo kökünden: kayma grafikleri
# pp/: tepe yük grafikleri aynı sayfadaki ikinci raster; cikar.py onları ÇIKARMIYOR
python3 docs/gates-reports/kayma/sayisallastir.py "$W"   # → $W/sayisal.json
```
