# Yapısal Analiz — zincir ve kapsam kararları

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.
> Lisans ve "ağır varlıklar gömülür" kuralları proje geneli olduğu için
> kök `CLAUDE.md`'de KALDI.

#### Yapısal Analiz — `js/cp-structural.js` (Geometri + Ağ DOLU, kalan ikisi iskelet)

Dördüncü modül. Zincirin **ilk iki bileşeni çalışıyor** — Geometri (STEP içe
aktarma + 3B görüntüleyici) ve Hesaplama Ağı (yüzey yeniden-mesh + TetGen →
tet10) — ve Geometri'ye asılı **Malzeme ve Özellikler** alt bileşeni de
çalışıyor; kalan iki panel hâlâ iskelet ve ayrı oturumlarda doldurulacak.
`_strPending` kuralı orada duruyor: panel boş ama SESSİZ değil.

```
Geometri → Hesaplama Ağı → Sınır Koşulları → Sonuçlar
   │
   └── Malzeme ve Özellikler   (ALT bileşen — zincirin halkası değil)
```

**Zincir PORTLARLA zorlanır, yorumla değil:** `str-geometry` girişi 0,
`str-results` çıkışı 0 → kullanıcı zinciri ters kuramaz. İlk açılışta zincir
**kurulu ve bağlı** gelir (diğer üç modül yalnız "Başlangıç" kartı koyar; onların
alt topolojisi değişken, bunun ki sabit — tam bir Geometri, bir Ağ, bir Sınır
Koşulları, bir Sonuçlar, ve Geometri'ye asılı bir Malzeme. Seçim yok, o yüzden
boş tuval bırakmanın karşılığı yok).

##### Kapsam ölçümle belirlendi — iki kural

Aynı konsol kiriş (200×20×10 mm, çelik, 1000 N) saf JS'te üç eleman tipiyle:

| Eleman | DOF | Süre | Hata |
|--------|----:|-----:|-----:|
| 2D lineer üçgen (CST) | 410 | 23 ms | **−17,96 %** |
| 2D kuadratik (Q8) | 330 | 13 ms | −0,35 % |
| 3D lineer tet (tet4) | 27 783 | 14,7 s | **−24,0 %** |

1. **ELEMAN KUADRATİK (tet10).** tet4 ile 28 bin serbestlik derecesinde bile
   cevap %24 yanlış — ve hep **rijit** tarafa, yani güvenli tarafa değil. Kontur
   grafiği kusursuz görünür; hata gözle yakalanmaz.
2. **YAKINSAMA GÖSTERİLMEK ZORUNDA.** Tek bir FEA sonucu bir sayı değil bir
   kanaattir. Rapor yakınsama eğrisini basmadan hüküm veremez.

##### Mesh boru hattı — darboğaz TetGen DEĞİL

TetGen 1.6.1 native derlenip ölçüldü: küpte hacim **tam 1000,000000 mm³**, ters
tet 0, sınır işaretçileri korunuyor. `-o2` **doğrudan tet10** üretiyor (orta
düğümleri biz eklemiyoruz). Kalite reçetesi `-pq1.4/20 -O9 -o/150//2.5` →
min dihedral **7,58°**, `<10°` kuyruğu **%0,01**. (`-q<radius-edge>/<min-dihedral>`
kısa yardımda yazmıyor, kaynaktan çıkarıldı.)

**`predicates.cxx` MUTLAKA `-O0`** — Shewchuk'un kesin aritmetiği terimlerin
yeniden sıralanmamasına dayanır; iyileştirme açılırsa TetGen **sessizce
geçersiz** ağ üretir (TetGen'in kendi `CMakeLists.txt`'i uyarıyor).

Asıl darboğaz **OCCT'nin RENDER tessellation'ı**: min açı 2,81° (küp) — ve
parametreyi sıkmak **iyileştirmiyor, BOZUYOR**: 2,50° → **0,14°**, tet
11,8 bin → **1,32 M**. Altı gerçek CAD parçasında ham besleme denendi: **biri
hiç çözülemedi** (yüzey kendi kendini kesiyor), MAINBODY_BACK'te 11 bin üçgen
**834 bin tete** patladı. Araya **yüzey yeniden-mesh'leme** adımı şart; prototip
küpte 2,50° → **11,96°** yaptı (su geçirmez, hacim sapması %0,035).

##### Sınır koşulu CAD YÜZÜNE bağlanır, ağ düğümüne değil

Zincir uçtan uca ölçüldü ve ayakta:
`occt brep_faces` → `TetGen facetmarkerlist` → çıktı `trifacemarkerlist`.
Yüzey yeniden bölünse bile kimlik korunuyor. Ağ düğümüne bağlansaydı, yakınsama
çalışması için ağ her yenilendiğinde bütün sınır koşulları düşerdi — ve yakınsama
çalışması bu modülde **zorunlu** (yukarıdaki 2. kural).

