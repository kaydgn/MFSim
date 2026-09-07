# Bilinen açık ayrışmalar — kapatılmadı, kayda geçti

Bunlar 2026-09-07'de üç paralel tarama ajanıyla bulundu ve **bilerek** o turun
kapsamına alınmadı. Buraya yazılmalarının sebebi, bir sonraki oturumun aynı
bulguyu üçüncü kez keşfetmesini önlemek.

Bunlardan birine yakın bir iş yapıyorsan önce buraya bak: belki dokunduğun şey
zaten bilinen bir tutarsızlığın parçasıdır.

---

## 1 · RK45 iki kopya — PCHIP'ten daha kötü durumda

| | `js/numerics.js` `veRK45Solve` | `js/ft-performance.js` (satır içi) |
|---|---|---|
| Butcher tablosu | Dormand–Prince | Dormand–Prince, **elle yazılmış** |
| FSAL | var | **yok** (adım başına tam değerlendirme) |
| Dense output | var (Hermite kübik) | **yok** |
| Stiffness algılama | var | yok |
| Olay yakalama | var | yok |
| Güvenlik çarpanları | `0,2 / 5,0` | `0,3 / 2,5` |
| `dt_min` | `1e-6` | `1e-5` |

**Aynı toleransta farklı adım dizisi üretiyorlar** ve aralarında hiçbir kapı
yok. Motor Freni modu birinciyi, Tam Gaz ikinciyi kullanıyor — yani aynı aracın
aynı fiziği iki modda farklı ayrıklaştırılıyor.

Neden kapatılmadı: iki çözücüyü birleştirmek Tam Gaz'ın bütün altın çıpalarını
(13 araç, 81 vites geçişi) yeniden ölçmeyi gerektirir. Bu ayrı ve büyük bir iş.

İlk adım, birleştirme değil **kapı** olmalı: ikisini aynı basit ODE'de
koşturup çözümlerinin tolerans içinde uyuştuğunu tutan bir test.

---

## 2 · Eşleştirme paneli ile çözücü aynı veriyi farklı okuyor

`js/cp-matching.js` — `interpT` · `interpTWithDroop` · `interpKp` · `interpTau`

Motor–Konvertör Eşleştirme paneli (`getECMatchingPropertiesHTML`) Allison
C4/C5/C7/C8/C9/C10 kontrollerinin **"geçti / kaldı"** kararını **lineer**
interpolasyonla veriyor. Aynı `torqueData` ve `tcData` çözücüde
(`ft-performance.js`) **PCHIP** ile okunuyor.

Yani panelin kullanıcıya gösterdiği hüküm ile simülasyonun kullandığı tork
**aynı tablodan farklı sayılarla** türüyor.

Ayrıca `interpTWithDroop`, `createMotorTorqueFn`'in droop mantığını
(`droopRunout` + sentetik droop) **sadeleştirilmiş biçimde tekrar ediyor** —
yani üçüncü bir yazım.

Neden kapatılmadı: panelin `pchipCreate`'e geçirilmesi bütün Allison
kontrollerinin hükmünü değiştirebilir; hangi örneklerde "geçti"nin "kaldı"ya
döneceği ölçülmeden yapılmamalı.

---

## 3 · Takoz kütüphane kartı çözücüden başka eğri çiziyor

`js/cp-mount.js` `_mntLibForceChart` — kartın "Kuvvet–Sehim Eğrileri" grafiği
kopya **A** (`veBuildPchipSpline`) ile çiziliyor; çözücü ve `fdefl` sinyal
kanalı kopya **C** (`buildMonotoneCubic`) ile.

`js/mount-signals.js`'in kendi yorumu bunu açıkça yasaklıyor:

> *"panoda görünen eğri ile çözümün kullandığı yasa AYNI olsun — ayrı bir
> 'gösterim için' eğri üretmek, sessizce ayrışan iki model demekti."*

Bugün tablo içi A ≡ C olduğu için fark görünmüyor; A'nın uç formülü değişirse
grafik sessizce çözücüden ayrışır. Çizim aralığı tablo sınırlarıyla kısıtlı
olduğu için ekstrapolasyon farkı da bugün ortaya çıkmıyor.

**Üstelik bu dal hiç test edilmiyor:** `tests/unit/cp-mount.test.js`
`numerics.js`'i yüklemiyor, dolayısıyla `typeof veBuildPchipSpline === 'function'`
her testte `false` ve grafik lineer yedekle (`_mntLinInterp`) çiziliyor. Yani
testler PCHIP dalını **hiç görmüyor**.

Bu Takoz modülünün alanına giriyor; oraya dokunuyorsan bu maddeyi de oku.

---

## Küçük bulgular (aynı taramadan)

- `js/ft-performance.js` `lerpTable` — hiçbir yerden çağrılmıyor, yalnız dışa
  veriliyor. Ölü kod.
- `js/ft-performance.js` `ds[0] = deltas[0]` / `ds[n-1] = …` ve
  `js/numerics.js`'teki `if(n >= 3)` — ulaşılamayan dallar (üstteki guard'lar
  zaten eliyor).
- `js/numerics.js` `c2` / `c3` hesabında `h > 1e-12` koruması **eksik**
  (`delta` için var). Yinelenen x'te o segmentin katsayıları `NaN` oluyor;
  bugün zararsız çünkü binary arama o segmenti pratikte seçmiyor — ama bu
  tesadüf, garanti değil. `ft-performance.js` bu sınıfı `throw` ile kesiyor;
  koruma A ve C'ye taşınmamış.
- 16 FT testi `numerics.js`'i boşuna yüklüyor (FT çözücüsü ondan hiçbir şey
  kullanmıyor) ve `arac-performans-notc-run.test.js`'teki
  `// pchipCreate / pchipEval` yorumu yanlış — o fonksiyonlar `numerics.js`'te
  değil, `ft-performance.js`'te.
