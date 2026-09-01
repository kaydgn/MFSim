# Yapısal Analiz — Hesaplama Ağı (remesh + TetGen)

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

##### Hesaplama Ağı — yüzey hazırlığı + TetGen (`structural-remesh.js` + `structural-mesh-model.js`)

Zincirin ikinci halkası **DOLU**. Boru hattı üç adım:

```
OCCT tessellation  →  yüzey yeniden-mesh  →  TetGen  →  tet10
   (render ağı)        (izotropik, saf JS)    (WASM)
```

| Dosya | Katman | Kural |
|-------|--------|-------|
| `vendor/tetgen-src/*` | Hesap çekirdeği | **Dışarıdan geldi, birebir durur** (TetGen 1.6, Hang Si / WIAS, AGPL-3). `fead-core.js` ve occt ile aynı kural |
| `tools/tetgen-wasm-src/tetgen-glue.cpp` | Köprü (C++) | MFSim'in kendi kaynağı (MIT): tipli dizi girdi/çıktı, `throw <int>` → Türkçe mesaj |
| `js/structural-remesh.js` | Yüzey hazırlığı (DOM'suz) | OCCT'nin render ağını TetGen'in kabul edeceği üniform ağa çevirir |
| `js/structural-mesh-model.js` | Köprü (DOM'suz) | PLC kurar, çekirdeği çağırır, sonucu normalize eder, hata çevirir |
| `js/cp-structural.js` | Sunum | Panel + rozet + 3B görünüm. **Kendi ağını örmez** |

**TetGen'i KENDİMİZ DERLEDİK** — occt npm'den hazır `.wasm` olarak geliyordu,
TetGen için öyle bir paket YOK (npm/CDN arandı, yok). `npm run build:tetgen-wasm`
emscripten ile derliyor, `npm run build:tetgen-wasm-asset` çıkanı gzip+base64
gömüyor (**0,72 MB ham → 0,24 MB**; occt'nin 3,96 MB'ının yanında ihmal
edilebilir). İkisi de NADİREN koşar: çıktılar depoda, günlük akış (`npm run
build` / `npm test`) derleyiciye hiç dokunmaz.

**`predicates.cxx` MUTLAKA `-O0`** — Shewchuk'un kesin aritmetiği IEEE 754
yuvarlamasının TAM sırasına dayanır; optimizasyon ifadeleri yeniden sıralayıp
predikati **sessizce** yanlış yapar ve TetGen geçersiz ağ üretir. Testi var.

###### SINIR KOŞULU ZİNCİRİ AYAKTA — NATIVE OLARAK ÖLÇÜLDÜ

Modülün en kritik sözleşmesi. Sınır koşulu ağ düğümüne değil **CAD yüzüne**
bağlanacak, yakınsama çalışması ise ağı defalarca yenileyecek:

```
occt brep_faces → remesh faceIds → TetGen facetmarkerlist
                → çıktı trifacemarkerlist → yeniden m<i>/f<j>
```

Native TetGen ile ölçüldü (küpün üst yüzü 42, diğer beşi 7): çıktı sınır
üçgenlerinin işaretçisi **%100 {7,42}**, başka değer YOK. Kalite kısıtı yüzeyi
yeniden bölmeye zorlanınca (`-a5`, 12 → 232 sınır üçgeni) sonuç aynı: 194 + 38,
sıfır kayıp. Gerçek parçada da (rounded-cube) **7/7 CAD yüzü** çıktıda.

###### YÜZEY HAZIRLIĞI ŞART — ve bağımsız olarak doğrulandı

OCCT'nin ağı GÖRÜNTÜLEMEK için üretilir: min açısı ~2,8°'ye inen sliver'lar
bırakır. Onlar TetGen'e **sınır kısıtı** olarak gider (PLC kipinde TetGen sınır
üçgenlerini DEĞİŞTİREMEZ) ve etraflarını doldurmaya çalışırken patlar.

Bu tespit MFSim dışında bir kaynakta da var: aynı braket için kurulmuş bir
Python boru hattı (gmsh + pymeshfix + tetgen) aynı duvara çarpmış ve kendi
notlarına *"ağ kalitesinin darboğazı tetgen değil… kök neden yüzey onarımının
bıraktığı üçgenler… gerçekten iyileştirmek istersen yüzeyi yeniden ağla,
tetgen parametreleriyle uğraşma"* diye yazmış. `structural-remesh.js` tam olarak
o maddedir.

Botsch–Kobbelt döngüsü (böl → birleştir → çevir → düzleştir). **ÖLÇÜLDÜ**
(10 mm küp, hedef 1,2 mm, 10 paso): açık kenar **0**, anormal kenar **0**,
yüzeyden sapma **0,000e+0**, hacim **1000,0000 mm³** (sapma %0,0000),
min açı **45,00°**, 10° altı üçgen **%0,00**.

**Dört hata sınıfı ölçümle yakalandı ve dördü de testli:**

| Hata | Belirtisi | Kapı |
|------|-----------|------|
| Anlık görüntü üzerinde ikinci işlem | 888 üçgende **1220 açık kenar** | üçgen pasoda BİR kez |
| Sınır düğümünün yanlış yöne birleşmesi | hacim **%3,5** kayıyor | iç nokta sınıra birleşir, tersi ASLA |
| Bağlantı (link) koşulu yok | 9. pasoda **8 anormal kenar** | ortak komşu denetimi |
| **İçbükey dörtgenin çevrilmesi** | sapma 0 ama hacim 1000,000 → **1000,418** | alan korunumu (%2) |

Sonuncusu en sinsisi: normal denetimi onu **göremez** (normaller aynı yönde
kalır), yalnız hacim değişmezinden görünür.

**Ölçüt VALANS değil MİN AÇI.** Klasik izotropik yeniden-mesh valans eşitler;
bu modülün varlık sebebi min açıyı yükseltmek olduğu için ölçüt doğrudan odur.
Kapılar `acos` KULLANMAZ (`_rmShapeQ`, `4√3·A/(a²+b²+c²)`): üçgen başına üç ters
trigonometri iç döngüde milyonlarca kez koşuyordu — düzleştirme **11,0 s**
sürüyordu.

**Bölme EN UZUNDAN başlar.** `Object.keys` sırası geometriyle ilgisizdir;
sırasız hâlde aynı küpte min açı 45° → **17,6°**'ye düşüyor ve üçgenlerin
**%45,8'i** 10° altına iniyordu.

**Hedef kenar boyunun KATI BAŞINA TAVANI var** (kendi köşegeninin 1/8'i).
Montajın tamamı için seçilen tek sayı küçük parçalar için fazlasıyla kaba
olabiliyor: braket montajında 5,98 mm hedefle 17 mm'lik mesafe parçaları
ekranda **yuvarlak çakıl taşına** dönüyor ve hacim kaybı %5,7'ye çıkıyordu;
tavanla %3,9.

###### KESİŞME KALKANI — yerel denetimlerin göremediği üç sınıf

Kullanıcı bildirimi (2026-08-25): *"eleman boyutunun önemi yoksa, ağdan
bağımsızlık hesapları vs nasıl yapacağız?"* Haklıydı ve sorun gerçekti:
yeniden-mesh'lenmiş yüzeyi TetGen bazı hedef boylarında REDDEDİYOR, köprü de
ham yüzeye düşüp eleman boyu kontrolünü tamamen kaybediyordu.

> **ÖNCEKİ ÖLÇÜM GEÇERSİZDİ.** "Her hedef boyda kesişim üretiliyor" kaydı
> bozuk bir koşucudan geliyordu: TetGen girdisi `.smesh` uzantısı olmadan
> yazılıyor, TetGen hata verip çıkıyor, ayrıştırıcı da "0 kesişim" okuyordu.
> Uzantı düzeltilince gerçek tablo çıktı ve arıza hedef boyla **MONOTON
> DEĞİL** (h=12 ve h=5 zaten temizdi) — yani "eleman boyu kalınlıktan büyük
> olmasın" gibi bir kural bunu AÇIKLAMIYOR.

**Yeniden-mesh KALİTEDE zaten çalışıyordu** ve bu ayrım önemli: ortalama min
açı **12,5° → 41,6°**, 10° altı üçgen **%46,7 → %0,56**. Kalan *minimum*
(~3,5°) bir kusur değil, KISITIN kendisi: en kötü 200 üçgenin **170'inin üç
köşesi de bir CAD yüzü sınırında** (226 yüzün 20'si 3 mm'den dar şeritler).

Üç işlemin (birleştir/çevir/düzleştir) denetimleri **YEREL**: normal
katlanması, alan korunumu, şekil ölçütü — hepsi işlemin DOKUNDUĞU yıldıza
bakar. Hiçbiri *"bu üçgen 3 mm ötedeki karşı duvarın içinden geçiyor mu"*
diye soramaz. Kalkan (`VE_STR_REMESH_SHIELD`) düzgün bir ızgarayla o soruyu
soruyor. **Bölme kalkan DIŞINDA** ve bu bir eksiklik değil: yeni düğümü mevcut
kenarın üstüne koyduğu için yeni üçgenlerin birleşimi eskisinin TAM aynı
noktalarını kaplar, kesişim üretmesi geometrik olarak imkânsız.

**Kusur ABLASYONLA yerini buldu** (h=6): yalnız-split, split+collapse,
split+smooth, flip KAPALI ve smooth KAPALI koşularının BEŞİ de temiz; kesişim
ancak flip ile smooth BİRLİKTE koşunca doğuyor.

###### Kalkanın ÜÇ kör noktası — üçü de ölçülerek bulundu

| # | Kör nokta | Nasıl görüldü | Ölçüt |
|---|-----------|---------------|-------|
| 1 | **Köşe paylaşan çiftler tümden eleniyordu** ("komşular zaten değer") | TetGen'in h=10'da bildirdiği `[794,595] ↔ [793,597]` çifti tam da tek köşe paylaşan iki üçgene aitti | 1 ortak köşede **KARŞI KENAR**: temas meşru, gerçek kesişim ancak o köşeye komşu OLMAYAN kenar öbürünün içinden geçerse var |
| 2 | **Asılı düğüm (T-bağlantısı)** | Paso paso izlendi: 9. pasonun DÜZLEŞTİRME adımında `kenar[1915,1916] boy 3,1000 · düğüm 1924 · t = 0,5000` | Yabancı kenarın İÇİNE düşen düğüm, **iki yönde** (düğüm→kenar ve kenar→düğüm) |
| 3 | **Eş düzlemli kenar çaprazlaması** | TetGen'in kendi ölçütü ("Two segments exactly intersect"); çift doğrudan incelendi: doğrular arası uzaklık **0,000e+0**, parametreler **s=0,440 · t=0,751** | Köşe PAYLAŞMAYAN kenar çiftleri için parça–parça çaprazlama, **ortak köşe sayısına bakmadan** |

Üçüncüsü kritik bir ayrıntı taşıyor: **kenar komşusu iki üçgen de
çaprazlayabilir** — ortak kenar (a,b) iken (a,c)×(b,d) ve (b,c)×(a,d) çiftleri
köşe paylaşmaz ve yüzey keskin katlanınca gerçekten kesişirler.

**İKİ YAKLAŞIM ÖLÇÜLDÜ VE ATILDI:**

| Deneme | Sonuç |
|--------|-------|
| Asılı düğümü ONARMAK (kenarı düğümde bölmek) | h=12'de atılan üçgen **0 → 4**; durumu KÖTÜLEŞTİRİYOR |
| Köşe paylaşan çiftleri "zerre büzüp" (1e-6) Möller ile sınamak | Hile İŞE YARAMIYOR: ayrılma yönü kesişim doğrultusuyla aynı değil. Kalkanın **51.797 reddinin 51.691'i** bu yoldan geliyordu — reddin **%99,8'i asılsız**, ortalama min açı 41,6° → **29,7°** |
| Eşikle ÖNLEME (T-bağlantısı eşiğini büyütmek) | 1e-2'de meşru birleştirmeler de reddediliyor: üçgen sayısı İKİYE KATLANIYOR, min açı 3,36° → **0,01°** |

###### T-bağlantısı eşiği KALİTEYLE ödeniyor — 1e-4

Kenar çaprazlaması ölçütü eklendikten sonra gerçek kesişimleri o yakaladığı
için eşiğin gevşek olmasına gerek kalmadı; gevşekliğin bedeli ise doğrudan
kalite. **ÖLÇÜLDÜ (TetGen üç eşikte de TEMİZ, yani seçim yalnız kaliteye
bakıyor):**

| eşik | h=8 (min / ort / <10°) | h=6 | h=4 |
|---|---|---|---|
| **1e-4** | **3,956° / 38,1° / %1,24** | **3,565° / 41,6° / %0,51** | **2,746° / 43,6° / %0,27** |
| 3e-4 | 0,007° / 37,6° / %2,49 | 0,007° / 41,1° / %1,78 | 0,007° / 43,1° / %1,26 |
| 1e-3 | 0,007° / 37,4° / %2,95 | — | — |

Gevşek eşik en kötü üçgeni 4°'den **0,007°**'ye indiriyor ve o sliver'lar
TetGen'de **DEJENERE TET**'e dönüşüyordu (ölçüldü: h=12/8/6 → **54/478/103**
adet) — ki bu modülün kendi kuralına göre dejenere eleman bir uyarı değil,
çözümü durduran bir HÜKÜM. 1e-4'te ortalama kalite kalkansız tabanla
(ort 41,6° · <10° %0,56) aynı bantta.


**T-BAĞLANTISI ÖLÇÜTÜNDE KENAR KOMŞULARI MUTLAKA ELENMELİ** ve bunun sebebi
tanım gereği: bir **sliver** üçgenin üçüncü köşesi zaten karşı kenarının
üstündedir. Elenmezse her sliver kendi komşusunu asılı düğüm sanıyor ve
iyileştirici işlemleri de birlikte engelliyordu.

###### Kalkanın MALİYETİ — ölçülerek üçe bölündü

İlk sürüm toplam sürenin **%96'sıydı** (h=10, 2 paso: 44 s; sorgu başına
**486** aday). İki değişiklik:

| Değişiklik | Aday/sorgu | Süre |
|---|---:|---:|
| ilk sürüm ("büyük kova" her sorguda taranıyor) | 486 | 44,0 s |
| kutusu çok hücreye yayılan üçgeni **yayarak yazmak** | 117 | 12,6 s |
| aday başına **kutu ön elemesi** | **3** | **2,96 s** |

"Büyük kova" tasarımının neden çöktüğü ölçüldü: ham OCCT üçgenlemesinde düz
yüzeylerde 150 mm'ye varan üçgenler var (parça 131×150×131 mm), yani kova
doluydu ve her sorgu onu baştan sona tarıyordu.

###### PASO SAYISI HEDEFTEN TÜRER — dejenere tet'in GERÇEK sebebi

Kalkan ve eşik yerine oturduktan sonra bile İNCE hedeflerde dejenere tet
kalıyordu (h=3 → **2.081**, h=2 → 377) ve sebebi ikisinden de bağımsız çıktı:
**paso sayısı yetmiyordu.**

Döngünün ilk işi bölme ve bölme her pasoda kenarı yarıya indiriyor. Hedef
küçüldükçe pasoların daha çoğu boya inmeye gidiyor, geriye kaliteyi
toparlayacak paso kalmıyor.

**ÖLÇÜLDÜ (kullanıcının braketi, h=3):**

| | min açı | 2° altı | 5° altı | üçgen |
|---|---|---|---|---|
| 10 paso | 1,59° | **4** | 42 | 34.554 |
| 20 paso | **5,89°** | **0** | **0** | 32.108 |

Ve o birkaç sliver YÜZEY üçgeninin TetGen'de binlerce dejenere tet'e
dönüştüğü korelasyonla gösterildi — bir sliver yüzey üçgeni etrafında yassı
tet yelpazesi doğuruyor:

| hedef | 2° altı yüzey üçgeni | dejenere tet |
|---|---:|---:|
| 4 | 0 | **0** |
| 3 | 4 | **2.081** |
| 2,5 | 8 | 2 |
| 2 | 12 | 377 |

**Paso ARTINCA üçgen sayısı DÜŞÜYOR** (34,5 bin → 32,1 bin): fazladan pasolar
bölmüyor, birleştirip düzeltiyor — yani TetGen'in işi de azalıyor.

Formül: `ceil(log2(başlangıç ortalama kenarı / hedef))` bölme pasosu **+ 12**
kalite pasosu, 24 tavanıyla. **ÖLÇÜLDÜ** (braket, başlangıç ortalama kenarı
**15,45 mm**): h=16 → 12 paso · h=12 → 13 · h=8 → 13 · h=4 → 14 · h=3 → 15.

> **Kaba hedefte davranış BİREBİR eski DEĞİL** ve bu bilerek: taban 10'dan
> 12'ye çıktı. Bedeli ölçüldü ve kazanç yönünde — h=8'de eleman sayısı
> 43.990 → **41.772**, yüzey 2° altı üçgen zaten 0'dı ve öyle kaldı.

###### SON DURUM — dejenere eleman HER hedefte sıfır

| hedef (mm) | yüzey üçgeni | yüzey min açı | 2° altı | düğüm | eleman | SD | **dejenere** |
|---|---:|---:|---:|---:|---:|---:|---:|
| 8 | 6.110 | 3,96° | 0 | 74.828 | 41.772 | 224.484 | **0** |
| 4 | 18.772 | 3,61° | 0 | 95.950 | 52.579 | 287.850 | **0** |
| 3 | 32.220 | 5,89° | 0 | 168.681 | 94.347 | 506.043 | **0** |
| 2,5 | 46.208 | 5,95° | 0 | 244.161 | 140.548 | 732.483 | **0** |
| 2 | 72.222 | **10,02°** | 0 | 384.450 | 226.579 | 1.153.350 | **0** |

Eleman sayısı da serbestlik derecesi de **monoton** — yakınsama çalışması için
gereken kaba→ince seri artık var. h=2'de yüzeyde **10° altı üçgen bile
kalmıyor**.

**Kaba uçta hedef DOYUYOR ve bu fizik:** braket 3,1 mm sac. 12 mm'lik bir
eleman o duvarın içinden geçemez, TetGen kaliteyi tutmak için Steiner noktası
ekler ve sayı sabitlenir (h=12/8/6 → 46k/44k/40k, hatta hafif TERS). Anlamlı
yakınsama aralığı duvar kalınlığının altında başlıyor.

###### SONUÇ — on bir hedef boyunun on biri de temiz

NATIVE TetGen `-d`, kullanıcının braketi:

| hedef (mm) | 16 | 12 | 10 | 8 | 6 | 5 | 4,2 | 4 | 3,15 | 3 | 2,5 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| atılan üçgen | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| üçgen | 2760 | 3598 | 4748 | 6334 | 9832 | 13682 | 18872 | 20404 | 32118 | 35630 | 50358 |

Öncesinde h=12/10/8/6/4/3 sırasıyla 8/6/1/2/2/4 üçgen atıyordu. Köprü artık
gerçekten yeniden-mesh'lenmiş yüzeyle çalışıyor (h=12'de **59.556** eleman;
eski ham yol her hedefte **204.542**) ve eleman sayısı hedefle **monoton**
değişiyor — **yakınsama çalışması artık mümkün.**

Kapı dört mutasyonla ölçüldü, dördü de kırmızı. İki fikstür de ölçülerek
düzeltildi çünkü ilk hâlleri mutasyonu YAKALAMIYORDU: asılı düğüm fikstürü
köşe paylaşmıyordu (o durumda `_rmTriTriHit` zaten "kesişiyor" diyor), oysa
gerçek durumda asılı düğümün zincir komşusu kenarı taşıyan üçgenin köşesidir
— yani TEK ortak köşe vardır ve orada devreye giren karşı kenar ölçütü bu
yapıyı göremez.

###### NON-MANIFOLD ÜRETİLMEZ, KORUNUR, RAPORLANIR

Gerçek CAD verisinde bir kenar 2'den fazla üçgene komşu olabiliyor: OCCT
tessellation'ı temas eden/çakışan yüzeyleri aynı koordinata oturtuyor. **Bu
parçanın kendi geometrisinden gelir**, remesh'in ürettiği bir bozukluk değil —
ama bölmek onları **çoğaltır**: braket katısı 0'da 18 kenar remesh sonunda
**303'e** çıkıyordu. Artık o kenarlara hiç dokunulmuyor (sayı sabit: 26) ve
`nonManifoldEdges` olarak künyeye çıkıyor.

###### KATI BAŞINA TETRAHEDRALİZASYON — tercih değil zorunluluk

Braket **7 katıdan** oluşuyor ve katılar birbirine **TEMAS ediyor** (kaynaklı
montaj). Hepsi tek yüzey ağı olarak verildiğinde TetGen 18,5 s sonra bellek
taşmasıyla duruyor. Python boru hattı da aynı duvara çarpmış; oradaki çözüm CAD
seviyesinde boolean birleştirmeydi (gmsh `fuse`), ki occt-import-js yalnız
OKUYUCU olduğu için burada yok.

Katı başına ayırmak sorunu yapısal olarak kaldırıyor: her katı kendi içinde
kapalı, çakışma ancak katılar ARASINDA. **ÖLÇÜLDÜ:** braketin yedi katısının
beşinde non-manifold kenar sıfır; **4/7 katı ağa giriyor**, 3'ü (nm kenarı olan
18/4/4) giremiyor. Korelasyon tam — kök neden kesin.

**Bir katı çökerse SONRAKİLER İÇİN TAZE WASM ÖRNEĞİ kurulur.** ÖLÇÜLDÜ: ilk
katı taştıktan sonra aynı örnekle koşan diğer ALTI katı da çöküyordu, oysa
beşinin yüzeyi kusursuz. (Küçük bir sentetik durumda örnek sağ çıkmıştı;
gerçek bir parçadaki taşma o kadar iyi huylu değil.)

**Bedeli AÇIKÇA yazılıyor:** temas yüzeylerinde iki katının düğümleri
çakışmaz, yani parçalar ağ düzeyinde birbirine **bağlı değildir**. Panel bunu
uyarı olarak basıyor; sessiz bırakılsaydı kullanıcı yedi ayrı parçayı tek
gövde sanırdı.

###### KRİTİK METRİK `v_min`, `q_min` DEĞİL

Python boru hattının en pahalı dersi ve burada da geçerli: şekil ölçütü iyi bir
ağda bile 0,0000 görünebiliyor, ama **hacmi sıfıra yakın tetler** rijitlik
matrisini sayısal olarak tekil yapıyor ve **hiçbir ön koşullandırıcı
kurtaramıyor** (o tarafta CG 800 iterasyonda 1e-2'de takılmış). Bu yüzden panel
`minTetVolume` ve `degenerate`i ayrı ayrı basıyor, dejenere > 0 ise bu bir
uyarı değil çözümü durduran bir **hüküm** ve rozet KIRMIZI oluyor.

###### ÖLÇÜLDÜ — GERÇEK TARAYICI (tek dosya, `file://`)

| | rounded-cube | braket (7 katı) |
|---|---|---|
| süre | **2,6 s** | **5,2 s** |
| çizilen kare | **156** | **289** |
| eleman | 41.200 tet10 | 12.366 tet10 |
| dejenere / ters | 0 / 0 | 0 / 0 |
| hacim kaybı | %0,10 | %3,86 |
| yüzey min açı | 1,80° → **21,27°** | 4,45° → 11,27° |
| katı | 1/1 | **4/7** |
| `node.data` | 929 bayt | 2344 bayt |

Kare sayısı **arayüzün yaşadığının** kanıtı: ana iş parçacığında koşsaydı
~1 olurdu (Geometri bileşeninde ölçülen dersin aynısı). Hem yüzey hazırlığı hem
tetrahedralizasyon worker'da.

Karşılaştırma için: aynı braket, Python boru hattı — hacim kaybı **%1,47**
(pymeshfix onarımı), burada **%0,10** (rounded-cube) / %3,86 (braket, kaba
hedefle). Yüzey hazırlığı hacmi ölçüp raporluyor; %4'ü aşarsa panel uyarıyor.

###### Panel: tek sayı, dört hüküm, bir 3B görünüm

Kullanıcının dokunduğu TEK şey **hedef kenar boyu** (girilmezse parçanın sınır
kutusu köşegeninin 1/40'ı). Kalite reçetesi (`q1.4/18`) panelde YOK ve bu
bilinçli: Python boru hattı bu parametreleri taramış ve *"2,5 kat eleman,
marjinal kazanç, minimum kalite DAHA DA DÜŞÜK"* sonucuna varmış — o düğmeleri
kullanıcının önüne koymak, iyileştirdiğini sanarak ağı bozabileceği bir yüzey
açardı. Değerler künyede **yazılı**.

Rozet: boşken `AĞ` (nötr), doluyken `△41,2b` (amber), **dejenere varsa KIRMIZI**.
3B görünüm ağın dış yüzeyini + **eleman sınırlarını** çiziyor; tel kafes şart,
çünkü düz gölgeli bir katı 500 elemanlı ağ ile 500 bin elemanlı ağda AYNI
görünür — oysa kullanıcının ayarladığı tek şey tam olarak o yoğunluk.

**Bilinen kısıt:** temas eden katılardan oluşan montajlarda (kaynaklı sac
braket gibi) non-manifold kenarı olan katılar ağa giremiyor. Sonraki adım
manifold-güvenli kaynak (çakışan yüzeyleri ayıran vertex splitting) ya da CAD
seviyesinde boolean birleştirme.

###### WORKER PAKETİ ELLE SAYILMIŞ BİR LİSTE — ve bir kez eksik kaldı

Kullanıcı bildirimi (2026-08-25, tek dosya `file://`): *"geometriyi attıktan
sonra … ağı oluştur diyorum, herhangi bir şey olmuyor. Ne hata veriyor ne başka
bir şey. Offline olarak kullanmamdan kaynaklı mı acaba?"* Üretildi. **Offline
ile ilgisi yoktu** (konsoldaki `file://` CORS satırları — `pwa/manifest.json`,
`version.json` — ağa çıkan başka özelliklere ait); iki ayrı kusur üst üste
binmişti ve ikisi de ÇEVRİMİÇİ sürümde de vardı.

**1 · Worker paketi `_smAssign`'ı taşımıyordu.** Worker'a giden şey bir DOSYA
değil, `_smMeshBridgeSource()` içinde **elle sayılmış** bir fonksiyon listesi
(`fn.toString()` birleştirmesi). Ham-yüzey yedeği (bir önceki bölüm) eklenirken
kullanılan `_smAssign` listeye girmemişti. Ana iş parçacığı yolunda aynı kod
**çalışıyor** — fonksiyon orada kapsamda — yani birim testleri ve doğrudan
çağrılan bütün ölçümler yeşildi; hata yalnız worker'da, yani **gerçek panel
yolunda** çıkıyordu:

```
res = { ok: false, error: "_smAssign is not defined" }
```

**2 · Panel o sebebi yazıp hemen SİLİYORDU.** `veStrMeshBuild` sırası şuydu:
`_strMeshStatus(sebep)` → `showNodeProperties(node)`. İkincisi paneli
`innerHTML` ile baştan kuruyor, yani `#ve-str-mesh-status` elemanını da
yeniliyor. Sonuç: ilerleme kartı kapanmış, durum satırı boş, sonuç yok —
**ekranda hiçbir iz**. Kullanıcının "ne hata veriyor ne başka bir şey" dediği
şey tam olarak buydu. Sıra tersine çevrildi (önce panel, sonra mesaj); başarı ve
red yolları da aynı sırada.

**ÖLÇÜLDÜ (gerçek tarayıcı, `file:///…/MFSim_Code.html`, kullanıcının braketi):**

| | öncesi | sonrası |
|---|---|---|
| ilerleme kartı | `display:none` (hiç açılmadı gibi) | `block` → aşama yazıyor |
| durum satırı | **boş** (5 dk boyunca) | `Ağ hazır: 204.542 eleman.` |
| `node.data.mesh` | yok | var |

İki kapı kondu ve ikisi de mutasyonla ölçüldü. Birincisi paketin **kendi
kendine yettiğini** arıyor: worker'a giden bütünün (`structural-remesh.js` +
paket) İÇİNDEN çağrılan her `_sm…`/`veStr…` adı o bütünde **bildirilmiş**
olmalı — `_smAssign.toString()` listeden düşürülünce kırmızı. İkincisi
davranışsal: `showNodeProperties` paneli gerçekten yeniden kuran bir sahte ile
değiştirilip mesajın **ayakta kaldığı** ölçülüyor — sıra geri çevrilince
kırmızı.

**Sırada:** Sınır Koşulları (yüz seçimi) · Sonuçlar (çözücü + yakınsama
eğrisi). Kütüphane tarafında sırada olan: sıcaklığa bağlı özellikler ve
ortotrop (kompozit) malzeme kartı — ikisi de bugün katalogda YOK ve panel
bunu yazıyor.

