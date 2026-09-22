# Ortak yüzey kararları

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

### Kart İÇİNDEKİ kaydırılabilir yüzey tekerleği önce alır (`veWheelInnerPane`)

`js/ui-core.js`'teki kanvas tekerlek dinleyicisi kayıtsız `preventDefault()`
çağırıyordu. Olay kartın içinden kabardığı için varsayılan kaydırma eylemi de
iptal oluyordu: **kartın içindeki hiçbir liste tekerlekle kaydırılamıyordu.**

Ölçüldü (2026-09-11, gerçek tarayıcı, Kayış Tablosu): kart alçaltılıp altı
satır görünmez olduğunda listenin üstünde tekerlek, tabloyu kaydırmak yerine
kanvası uzaklaştırıyordu — zoom 0,486 → 0,438, tablonun `scrollTop`'u 0'da.
Kullanıcının ilk refleksi tam da bu yüzden yanlış şeyi yapıyordu.

Kural: hedef ile kanvas kabuğu arasında **kendi ekseninde gerçekten
kaydırılabilen** bir yüzey varsa (overflow izin veriyor **ve** içerik
sığmıyor) tekerlek onundur. İki koşul birden şart — yalnız `overflow`a bakmak,
taşması olmayan her `auto` kabında tekerleği yutar ve kart üstünde kanvas hiç
yakınlaştırılamazdı.

Kapı: `tests/e2e/fead-tablo.spec.js` → *"TEKERLEK"* (üç halka: taşma yokken
kanvas yakınlaşıyor, taşma varken tablo kayıyor ve kanvas oynamıyor, künye
şeridinde yine kanvas). Node'a taşınamaz — jsdom ne düzen kurar ne de gerçek
bir tekerleğin varsayılan eylemini çalıştırır.

### Kartın EN KÜÇÜK ÖLÇÜSÜNÜ tipi söyler (`veNodeMinSize`)

`js/node-resize.js` her kartı 50×50'ye kadar küçültüyordu. İçeriği olan bir
kart için bu ölçü anlamsız ve kaybı SESSİZ:

* Kayış Tablosu 130 px yükseklikte — yapışkan başlık (50) + Σ satırı (24)
  48 px'lik gövdeyi tamamen örtüyor. Altı satırın altısı da görünmüyor ama Σ
  hâlâ `663,4 · 1048,7` yazıyor: kart boş görünüyor, boş olmadığını yalnız
  toplamlar söylüyor.
* 560 px genişlikte on bir sütunun altısı kayıyor (298 px) ve ölçülen yatay
  kaydırma çubuğu **0 px** yer kaplıyor — kaybın hiçbir işareti yok.

Taban `componentDefs.minWidth/minHeight`ten okunur; beyan etmeyen tip eski
50×50'de kalır. Kenar yapışması (snap) da tabanı ezemez. Taban yalnız
sürüklemeye konsaydı, bu kuraldan ÖNCE küçültülüp kaydedilmiş bir kart bozuk
hâlde açılmaya devam ederdi — bu yüzden `veFeadLayoutSizeFor` açılışta da
yükseltiyor.

Kapılar: `tests/unit/fead-table.test.js` → *"en küçük ölçü"* (taban beyan
ediliyor, sütun toplamından geri kalmıyor, tipten okunuyor, açılışta
yükseliyor) + `tests/e2e/fead-tablo.spec.js` → *"YENİDEN BOYUTLANDIRMA"*
(gerçek tutamak sürüklemesi tabanda duruyor ve tabandaki kart hâlâ satır
gösteriyor).

### Topoloji sınır çerçevesi ADI da sarar (`veNodeLabelOverflow`)

Kesikli çerçeve (`veBoundaryBox` → `veUpdateBoundary`) yalnız KUTULARI sarıyordu;
ada ait tek pay altta sabit `VE_NODE_LABEL_H` (20 px) idi. Oysa ad dört kenara
da konabiliyor (sağ tık → Etiket Konumu · `node.data.labelPos` · css
`.lbl-top/.lbl-left/.lbl-right`) ve yana alındığında kutunun dışına ADIN
GENİŞLİĞİ kadar taşıyor. Kullanıcı bildirimi (2026-08-24, Yapısal Analiz ·
Geometri): *"ismini sola çektiğim zaman topoloji çizgisinin dışına taşmış."*

Aynı sessizlik **yatayda da** vardı ve modüllerin hepsini ilgilendiriyor: alt
etiket kutunun MERKEZİNE göre ortalanıyor (`translateX(-50%)`), yani kutusundan
geniş her ad iki yana eşit taşıyor.

**ÖLÇÜLDÜ (gerçek tarayıcı).** Kullanıcının bildirdiği durum: "Geometri" adı
sola alınınca adın sol ucu çerçevenin **5,0 px DIŞINDA**; düzeltmeyle **50,0 px
içeride** — yani tam dolgu kadar. Depodaki 18 örnek topoloji tek tek koşuldu:

| | eski | yeni |
|---|---|---|
| adı çerçeve dışında kalan örnek | **9 / 18** | 0 |
| en kötü taşma | **79,5 px** (`ap_ypa4x4`, motor adı · üst) | 0 |
| tek örnekte en çok taşan ad | **5** (`ap_jmma`) | 0 |

Çerçeve yatayda 24–145 px açılıyor, **dikeyde hiç değişmiyor**: alt pay hiç
küçülmüyor (`of.bottom` tabanı `VE_NODE_LABEL_H`) → bu düzeltme çerçeveyi
yalnız BÜYÜTÜR, kurulu hiçbir topoloji daralmaz.

**Modül KARTI dışarıda:** kart adı kutunun dışında yüzmez, kartın İÇİNDE bir
satırdır (`.ve-node--module .ve-node-label{position:static}`) → taşma sayılmaz.
Ölçüt tip listesi değil, o kuralın kendi ölçütü (`veIsModuleNode`).

**Ölçü DOM'dan, `offsetWidth` ile — `getBoundingClientRect` DEĞİL:** ikincisi
kamera zoom'unu (CSS transform) içine katar, sınır kutusu ise yerel px; zoom
%50'de çerçeve adın yarısını keserdi. `veBoundaryBox` SAF kalsın diye ölçüm
işlevi DIŞARIDAN geçiliyor; geçilmezse fonksiyon birebir eski davranışını
korur (saf koşucuda DOM yok, uydurma bir genişlik çerçeveyi yanlış yere koyar).

**ÖNBELLEK ŞART — ölçüldü** (16 düğüm · 12 tel, kare başına, 300 kare):
ölçümsüz 0,369 ms · **önbellekli 0,480 ms** · önbelleksiz 0,784 ms. `veUpdateBoundary`,
`updateAllConnections`'tan geçtiği için her sürükleme karesinde koşuyor;
önbelleksiz hâl kare başına zorlanmış bir yerleşim (layout) demekti. Anahtar
METİN + ELEMAN: ölçüyü değiştiren tek şey yeniden adlandırma, `isConnected` de
DOM yeniden kurulduğunda bayat referansı ele veriyor. Yazı tipi geç yüklenirse
`document.fonts.ready` önbelleği bir kez boşaltıyor.

**Ad kenarı değişince çerçeve de tazelenmeli.** `handleLabelContextAction`'ın
`saveState()`'i mutasyondan ÖNCE çağrılıyor (geri-al yığını — FEAD kartındaki
tuzağın aynısı), yani tazelemeyi o üstlenemez; `veUpdateBoundary` hem oradan hem
yeniden adlandırmadan (`map.js`) çağrılıyor.

Boşluk sayıları (`VE_LABEL_GAP_V` 4 · `VE_LABEL_GAP_H` 7) CSS'te de yazılı; kapı
sayıyı JS'e değil `css/styles.css`'in KENDİSİNE bağlıyor — ayrışırlarsa çerçeve
yine çizilir, yalnız adı birkaç piksel keser. Yedi mutasyonla ölçüldü (yan
taşmayı yok sayma, iki boşluk sabitini kaydırma, CSS tarafını kaydırma, yatay
taşmayı ikiye bölmeme, modül istisnasını kaldırma, alt pay tabanını kaldırma,
ölçüm işlevini hiç kullanmama) — yedisi de kırmızı.

### Sonuçlar penceresi — TXT raporları A4 SAYFA (kullanıcı isteği 2026-08-25)

Kullanıcı bildirimi: *"sonuçlar penceresi üzerinde TXT raporları sanki bir fiş
gibi duruyor… Burası normal bir A4 boyutunda olsun… Ayrıca başlığın yazdığı
header, 'Veri Gezgini' headeri ile aynı doğrultuda ve boyutta değil."*
Üretildi; **iki ayrı hata** çıktı ve ikisi de ölçüldü.

**1 · "Fiş" — ortalama blok blok yapılıyordu.** `veRenderCenteredTXT` metni
boş-satır bloklarına ayırıp her bloğu ayrı bir `<pre width:fit-content;
margin:0 auto>` olarak ORTALIYORDU. Ama raporun **iki farklı sütun genişliği**
var (ölçüldü: dar bölümler ~80, geniş tablolar **119** karakter; iz raporunda
121), dolayısıyla bloklar birbirine göre kayıyordu:

| | eski | yeni |
|---|---:|---:|
| `<pre>` bloğu | **43** | **1** |
| ayrı sol kenar | **10** | **1** |
| sol kenar yayılımı | **222 px** | 0 |
| kutu genişliği | 854 px (içeriğe göre) | **794 px** (A4) |

Yani sütun hizası blok İÇİNDE korunuyor, bloklar ARASINDA bozuluyordu —
ortalamanın kazandırdığı hiçbir şey yoktu. Metin artık **tek `<pre>`, sola
yaslı**; kutu A4 sayfa (210×297 mm @96dpi = 794×1123 px). Gölge farkı korundu
(kullanıcı açıkça istedi).

**Font ölçüsü sayfaya SIĞMAKTAN türer, sabit değil.** A4 içerik alanına
(794 − 2·45 = 704 px) 119 sütun sığması gerekiyor; hesap **CSS'te**:

```css
font-size: min(var(--rep-fs-max),
               calc((var(--rep-page-w) - 2*var(--rep-page-pad))
                    / var(--rep-cols) / var(--rep-ch)));
```

`--rep-cols` (en uzun satır) sayfaya satır içinde yazılır. Hesabı JS'te yapıp
px yazmak yerine CSS'e bırakmak, **aynı kuralın indirilen HTML'de de birebir
çalışmasını** sağlıyor — orada JS yok. **ÖLÇÜLDÜ:** 119 sütunlu Tam Gaz raporu
9.83 px'e oturuyor ve `<pre>` genişliği **702 px = içerik alanı 702 px**, yani
yatay kaydırma YOK; 80 sütunluk dar rapor tavana (`--rep-fs-max` 11 px)
oturuyor, sayfayı doldurmak için şişmiyor.

`--rep-ch` (karakter genişliği / font boyutu) **ölçülür, varsayılmaz**: font
ailesine göre değişiyor (Consolas 0.55, DejaVu Sans Mono / Menlo 0.60) ve sabit
bir oran dar karakterli fontta sayfanın onda birini boş bırakırdı.
`veTxtCharRatio()` gizli bir ögeyle bir kez ölçer; ölçüm tutmazsa CSS'in
varsayılanına (0.62) düşer — **büyük oran = küçük font = taşma yerine boşluk**,
yani güvenli taraf. Ölçüm ögesinin punto'su CSS'te DEĞİL JS'te: o bir tasarım
jetonu değil, ölçüm parametresidir (tipografi ölçeği kapısı bunu doğru yakaladı).

**2 · Üst bant panel ayırıcısında KIRILIYORDU.** Rapor bandı 48 px, soldaki
"Veri Gezgini" bandı 36 px; alt çizgiler **12 px kayık**, çizgi 2 px'e karşı
1 px, başlık 13 px'e karşı 12 px (gerçek tarayıcı, 1600×950). Bu, 2026-08-17'de
`.ve-results-head` ↔ `.ve-trace-toolbar` arasında kapatılan kırılmanın
**aynısıydı**; rapor overlay'i o düzeltmeye dahil edilmemişti. Bant artık
`.ve-rep-head` ile **aynı `--results-bar-h`'tan** besleniyor, düğmeler ölçüm
penceresi araç çubuğunun düğmesini (`.ve-trace-btn`) **paylaşıyor** — aynı
bandın iki yarısı için ikinci bir düğme stili tutmanın karşılığı yok.
**ÖLÇÜLDÜ:** alt çizgi farkı **12 → 0 px**, yükseklik 36 ↔ 36, başlık 12 ↔ 12.

**BANDI KURAN TEK YER VAR.** Beş panel (dört TXT önizlemesi + Detaylı Rapor)
bandı satır içi stille, birbirinin kopyası olarak kuruyordu; biri düzeltilince
diğer dördü sessizce ayrışırdı — nitekim ayrışmıştı. Artık `veRepHeadHTML` tek
üretici, panel yalnız başlığını ve indirme adını veriyor (`veTxtPreviewShow`).
Bu, düğme kablolaması testinin ölçütünü de değiştirdi: kopya SAYMAK anlamını
yitirdi, test artık ÜRETİLEN YÜZEYE bakıyor.

İndirilen HTML aynı sayfayı açar ve `@page{size:A4}` ile gerçekten A4'e basar.
Arayüz jetonlarına başvurmama kuralı (`report-cosmetics.test.js`) korunuyor:
belge kendi `--rp-*` ölçeğini kendi `:root`'unda taşıyor.

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: bandın kendi ölçüsünü
tutması, sayfanın içeriğe göre daralması, A4 yerine keyfî genişlik, font
tavanının kalkması, gövdenin yine blok blok ortalanması, karakter oranının
güvensiz tarafa kayması, indirilen belgenin A4'e basmaması, bir panelin kendi
bandını kurması.


## Artifact önizlemesi KALDIRILDI (2026-08-25)

Bir dönem tek dosya claude.ai'ın Artifact sayfası olarak yayınlanıyordu
(`tools/build-artifact.js` → `MFSim_Artifact.html`, gövde varyantı + ortam
bayrağı `js/env.js`). Kullanıcı **kullanmadığını** söyledi ve kaldırıldı.

Kaldırmayı tetikleyen şey de bu zaten bir kapıydı: boolean'lı OCCT çekirdeğine
geçince tek dosya 12,6 → 26,8 MB oldu ve **artifact'in 16 MB sınırı** CI'ı
kırdı. Kullanılmayan bir varyantın, uygulama her büyüdüğünde merge'i bloke
etmesinin karşılığı yok.

Kalkanlar da onunla gitti: `js/env.js` (`veArtifactEnv` / `veNetworkAllowed` /
`veOfflineNote`) ve onu okuyan dört kapı — deploy noktası, commit listesi,
harita, canlı radyo — artık koşulsuz çalışıyor. Bunlar zaten yalnız artifact
ortamında kapanıyordu; Pages ve indirilen tek dosya sürümlerinde hep açıktı,
yani **davranış değişmedi**.

> Yeniden gerekirse: gövde varyantının üç sessiz tuzağı ölçülmüştü — sahte
> `</body>` (rapor üreticileri HTML şablonu basıyor, gerçek belgede 3 kez
> geçiyor; `maskRawTextKeepOffsets` bunun için var ve **build.js'te KALDI**),
> `data-theme` çakışması (host aynı özniteliğe yazıyor), ve script/style
> sayımının JS içindeki şablonları da sayması. Git geçmişinde duruyor.


## Ondokuz gömülü tema KALDIRILDI — iki zemin, üç kip (2026-09-22)

**Hüküm.** `css/styles.css`'te ondokuz `[data-theme]` bloğu vardı (456 bildirim,
sıfır jeton sapması). Hepsi kaldırıldı; yerine `acik` ve `koyu` geldi. Kullanıcı
artık palet değil **kip** seçiyor: `acik · koyu · sistem`.

**Gerekçe.** Kullanıcı kararı: program tek bir tasarım dili ("Atölye") taşıyacak.
Ondokuz palet o dilin değil, dilsizliğin işaretiydi.

**Kip ≠ kimlik.** `sistem` bir kimlik DEĞİLDİR ve CSS bloğu yoktur; `data-theme`a
yazılsaydı belge sessizce `:root`a düşerdi. Kip localStorage'da durur, kimlik
attribute'a yazılır.

**Kimlikler tek kelime ve tiresiz.** `js/loader.js`'in ilk-kare çözücüsü ve
`index.html`'in satır içi betiği tireli bir kimliği ayrı ayrı ele alırdı;
tek kelime kuralı o ayrışmayı baştan kapatıyor.

**Kapılar.** `theme-consistency.test.js` — kip↔menü senkronu, tam iki kimlik,
`:root` ile virgüllü ortak bildirim, iki ilk-kare yolunun 18 girdide aynı
kimliği çözmesi, üç göç yolunun ondokuz eski kimlikte aynı aileye düşmesi.
`theme-contrast.test.js` — iki zemin de WCAG AA.

### Emekliye ayrılan gerekçeler

Silinen 101 satır palet yorumunun taşıdığı üç hüküm, kodda karşılığı kalmadığı
için buraya taşındı. **Bunlar artık yürürlükte değil**; yeniden bir palet ailesi
açılırsa başlangıç noktası olsunlar diye duruyorlar:

- **SADE ailesi (graphite · ink · basalt · mono · paper · zinc).** Düşük
  doygunlukta aksan, eşit yüzey basamakları. Kural: aksan yalnız seçim ve durum
  bildirir, kimlik taşımaz.
- **Yüksek kontrast ailesi (contrast · amber · scope).** Saf siyah zemin +
  fosfor ekran geleneği. Ölçülmüştü: diğer koyu temaların metin kontrastı
  15,2'de tavan yapıyor, bu aile 16–18 arasında. Halation eşiği bu yüzden ayrı
  tutulmuştu.
- **Kehribar rampası (amber).** Fosfor ekranın sarı-turuncu rampası eşit
  aralıklı değil; göz düşük parlaklıkta sarıyı daha hızlı ayırt ediyor.

### Göç kopyası — bilinçli ve GEÇİCİ

Ondokuz eski kimliğin aile eşlemesi ÜÇ yerde duruyor: `index.html` satır içi
betiği, `js/loader.js`, `js/theme.js` (`MF_ESKI_KIMLIK`). İlk ikisi göçü **ilk
karede** yapmak zorunda — yoksa koyu tema seçmiş bir kullanıcı açılışı açık
zeminde görür, sonra ekran koyuya devrilir; tam olarak `loader-splash`'ın
kapattığı sıçrama. Üçüncüsü kaydı kalıcı olarak yeni sözlüğe yazar.

Korunan şey "kopya yok" değil **üçünün aynı kararı vermesi**. Kayıtlar yeni
sözlüğe döndükçe üç liste birlikte silinebilir.

## Atölye paleti — yüzey yönü bir KURAL (2026-09-22)

**Hüküm.** `--bg-secondary` her zaman `--bg-primary`'den AÇIK (yükselen panel);
`--bg-tertiary` ise **metinden UZAĞA** gider — açık zeminde primary'den KOYU,
koyu zeminde AÇIK. `--bg-input` her iki uçta da uç değerdir.

**Gerekçe.** Kural tahmin edilmedi, ondokuz temanın hepsinden ölçülerek
çıkarıldı. Atölye paletinin ilk yazımında `--bg-tertiary` açık zeminde
primary'den AÇIK konmuştu; o hâlde tertiary ile secondary neredeyse aynı
değerde kalıyor ve **bütün oyuk yüzeyler sessizce düzleşiyordu** — hiçbir test
kırılmazdı, çünkü kontrast eşikleri yine tutuyordu.

**Ölçülen ikinci kelepçe.** Tertiary doğru yöne (koyuya) alınınca açık zeminin
EN KÖTÜ yüzeyi o oldu ve `--text-muted` 4,23'e düştü. Eşiği tutan en açık değer
arandı: `#676055` → 4,77. Bir basamak açığı (`#6b6458`) 4,49'da kalıyordu.
Daha koyu bir değer eşiği rahat geçerdi ama kademe ayrışmasını
(`secondary/muted`) gereksiz yere daraltırdı — 1,326'da bırakıldı.

**Kapı.** `theme-contrast.test.js` — her jeton DÖRT yüzeye ayrı ayrı vurulur,
yani yüzeylerden biri yanlış yöne giderse en kötü yüzey değişir ve eşik düşer.

## Atölye şekil ölçeği — yarıçap ROL'e göre bağlanır (2026-09-22)

**Hüküm.** Köşe yarıçapı tek bir ölçekten gelir — `--radius-xs|sm|md|lg|xl|pill`
= 3 · 5 · 7 · 10 · 14 · 999 px — ve arayüzdeki her KAP o ölçekten bir basamak
seçer. Sabit yazılmış yarıçap yalnız üç hâlde meşrudur: daire (`50%`), bilinçli
keskin köşe (`0`), ve **çizgi örneği**.

**Gerekçe.** Jeton 197 yerde kullanılıyordu ama 61 CSS + 96 JS noktası ondan
bağımsızdı. Ölçeği değiştirmek panelleri oynatıp çözücü kartlarını, takoz
künyelerini ve sihirbaz düğmelerini yerinde bırakıyordu: yarısı yuvarlak yarısı
keskin bir arayüz, ve hiçbir test bunu ölçmüyordu.

**Sınıflandırma SAYIYA DEĞİL ROLE göre.** Aynı `1px` iki ayrı işte geçiyordu:
22×22 kapatma düğmesinde (KAP → ölçeğe bağlanır) ve 14×3 lejant çubuğunda
(ÇİZGİ ÖRNEĞİ → diyagram dilinin parçası). Sayıya göre çevirmek ikincisini
kapsüle döndürürdü. Kapı bu ayrımı **kural** olarak tutuyor: aynı bildirimde
kendi kutusunu ≤3px ilan eden eleman çizgidir — yarın eklenen bir lejant
kendiliğinden geçer, yarın eklenen bir düğme geçmez.

**Ölü yedek temizlendi.** `var(--radius-md, 8px)` biçiminde 28 bildirim vardı.
Jeton her zaman tanımlı olduğu için yedeğin hiçbiri devreye girmiyordu — ama
**aynı jetona üç ayrı yedek** yazılmıştı (`--radius-sm` için 5px · 6px · 7px).
Yedekler ölü olduğu için bu tutarsızlık hiçbir yerde görünmüyordu; ölçek
değiştiğinde ise hepsi birden bayatladı.

### Ölçeğe BAĞLANMAYANLAR — dokunulmayan da bir sonuçtur

| Ne | Kaç | Neden |
|----|-----|-------|
| `stroke-width` | 330+ | Şekil değil **anlam**: 4px kayış ile 1px ızgara çizgisi aynı ölçeğin basamakları değil. Üç basamağa indirmek FEAD ve takoz mühendislik çizimlerini sessizce yeniden yazardı |
| Bileşen sembollerinin `rx`'i | 61 | Semboller **100×100 viewBox'ta 38×38 çiziliyor**: `rx="8"` ekranda ~3 px, yani zaten ölçekte. Ayrıca kap değil ÇİZİM (şanzıman gövdesi, konvertör kabuğu) |
| Rapor belgeleri | 4 | İndirilen rapor kendi stil sayfasını taşır; `var(--radius-*)` orada TANIMSIZ — bağlamak yarıçapı sessizce 0 yapardı. Dışa çıkan belgeler ayrı turun işi |
| 2048 tahtası | 4 | Oyunun kendi geometrisi, kendi paleti gibi (`#bbada0`). Kabuk (pencere · skor · düğme · kapat) Atölye'ye çevrildi, tahta çevrilmedi |

**Kapı.** `source-hygiene.test.js` bölüm 4 (CSS) + bölüm 5 (JS). İkisi ayrı
ayrı hiçbir şey ifade etmez: CSS kapısı tek başınayken JS'ten yazılan her
yarıçap serbest kalıyordu. Kapsam dışı sayılar **TAM eşleşir** — bir satır
silinince boşalan yer yeni bir sapmaya açılmasın.

## Atölye başlık yüzü — serif bir ROL, bir boyut değil (2026-09-22)

**Hüküm.** Başlıklar `--font-display` (Source Serif 4 600) ile, gövde
`--font-sans` (Inter) ile çizilir. Bağlama **anlama** göredir: başlık
elemanları (`h1`-`h4`) ve adıyla başlık olan sınıflar. Boyuta göre bağlanmaz.

**Gerekçe — ölçüldü.** `--fs-title|h2|h1|display|hero` kullanan 18 CSS
kuralının yalnız **9'u başlık**; kalan 9'u büyük çizilmiş İKON (`.mf-ico`),
komut paleti arama GİRDİSİ ve `+` sekme düğmesi. JS tarafında ayrım daha da
keskin: aynı `--fs-h2` hem pencere başlığında, hem `✕` kapatma düğmesinde, hem
de FEAD'in "1. elastik mod" **sayısında** geçiyor. Boyuta göre bağlayan bir
kural serifi bir çarpı işaretine ve bir sayıya yazardı.

**Yüz depoda zaten vardı.** Takoz raporunun gömülü varlıklarında (Source Serif
4 · Archivo · IBM Plex Mono). Ama o dosya açılışta **yüklenmiyor** — 1 MB,
`type="text/x-mfsim-report"`, ilk rapora kadar hiç okunmuyor. Başlık yüzünü
oradan almak o 1 MB'ı açılışa taşımak demekti. Bu yüzden `tools/build-display-font.js`
yalnız arayüzün ihtiyacı olan **iki yüzü** (600, latin + latin-ext) ayrı bir
stil sayfasına çıkarıyor — **ağ gerektirmez**, kaynağı depodaki dosya.

**Ağırlık `600 700` bilerek ARALIK.** Yüz statik 600; arayüzde 700 isteyen
başlıklar var. Tek bir 600 bildirilseydi tarayıcı 700'ü SENTETİK
kalınlaştırırdı (bulanık kenar).

**400 ağırlıklı başlıklar listede DEĞİL** (Sonuçlar'ın katlanır şeritleri): tek
yüz 600 olduğu için ona düşüp istenenden kalın görünürlerdi.

### Kapının ilk yazımı BOŞTU — `document.fonts.check` hiçbir şey ölçmüyor

İlk e2e kapısı `document.fonts.check()` kullanıyordu. Ölçüldü:

```
document.fonts.check('600 16px "Zzz Yok Boyle Bir Aile"')  →  true
```

Spec'e göre `check()` *"bu metni çizmek için yüklenmesi GEREKEN bir yüz kaldı
mı"* sorusunu cevaplıyor; hiç eşleşen yüz yoksa cevap "kalmadı" — yani `true`.
Yedek yüze düşen bir harf de `true` döner. **Kanıtlandı:** `fonts-display.css`'ten
latin-ext yüzü TAMAMEN silindi ve dört test de yeşil kaldı.

Gerçek ölçüt **genişlik**: aynı harf `"Source Serif 4", monospace` ile ve çıplak
`monospace` ile çizilir; harf yüzde varsa genişlikler ayrışır, yoksa ikisi de
monospace'e düşüp birebir aynı çıkar. Yeni kapı aynı silmede **ğ ş Ğ İ Ş**'yi
adlarıyla söylüyor ve latin alt kümesindeki ç ı ö ü'ye dokunmuyor. Kapının
kendisinin boş olmadığı ayrıca bir halkayla tutuluyor (var olmayan aile bütün
harfleri eksik saymalı).

### Ödenen bayt — TEK KALEM

| Ürün | Önce | Sonra | Fark |
|------|------|-------|------|
| `MFSim_Code.html` | 28.705.033 | 28.790.207 | **+85.174 (+0,30 %)** |
| `MFSim_Olcum_Goruntuleyici.html` | 1.161.822 | 1.246.996 | **+85.174 (+7,3 %)** |
| `MFSim_CAN_Cozumleyici.html` | 979.093 | 1.064.267 | **+85.174 (+8,7 %)** |

Altı yüzün tamamı (400 · 600 · italik) taşınsaydı maliyet 195 KB olurdu; yalnız
600 çifti 81 KB. Görüntüleyici ve CAN için oran yüksek görünüyor çünkü o iki
ürün küçük — ama başlık yüzü üçünde de aynı olmasaydı **aynı program üç ayrı
tipografiyle** dağıtılırdı.

### CI listesi tek kaynağa indi

`e2e-urun` işi spec adlarını `package.json`'dan KOPYALIYORDU. Bu turda dördüncü
spec eklenince ayrışma göründü: yerelde `npm run test:urun` dört spec koşacak,
CI üçünü koşacaktı — dördüncüsü hiç görülmeden merge edilirdi. İş artık
`npm run test:urun` çağırıyor.

## Dışa çıkan belgeler — kâğıt beyaz, mürekkep Atölye (2026-09-22)

**Hüküm.** İndirilen her belgenin (SVG/PNG dışa aktarma · takoz raporu · FEAD
raporu · Sonuçlar'ın tasarımlı raporu · TXT sayfası · kılavuzlar · PWA)
MÜREKKEBİ ekranın `--ink-*` jetonlarıyla birebirdir. **Kâğıt beyaz kalır.**

**Gerekçe.** Belgeler uygulamanın stil sayfasını kullanamaz — tek başına
açılıyorlar ve `var(--accent-primary)` orada tanımsız. Bu yüzden renkleri
SABİT yazıyorlar, ve tam bu yüzden sessizce bayatlıyorlar: ekran Atölye'ye
geçtiğinde **dört ayrı belge paleti** 2024'ün soğuk baskı kimliğinde kaldı
(prusya mavisi `#24425f`, soğuk kurşun `#1b1e24`, soğuk gri `#c9cdd3`).
Hiçbir test bakmıyordu; kullanıcı ancak bir rapor ÜRETİP açtığında görürdü.

**Kâğıt neden bej olmadı.** Atölye'nin açık zemini `#f0ede7` bir EKRAN
zeminidir. Kâğıda bej basmak bej mürekkep harcamaktır; `@media print` zaten
zemini beyaza zorluyordu. Bağlanan şey mürekkeptir — ve ekranın `--ink-*`
jetonları zaten "aksanı METİN olarak kullan" için ölçülmüş değerler, yani
kâğıtta da okunur güçteler.

**`--prusya` adı EMEKLİ.** Renk artık prusya mavisi değil; adı bırakmak bir
yalanı kodda tutmak olurdu. Yerine `--vurgu`. Kapı **kullanımı** arıyor
(`var(--prusya)` / `--prusya:`), **anmayı** değil — emekli adı bir yorumda
anmak bu deponun istediği şeydir.

**Dördüncü palet ancak kapı yazılınca göründü.** `js/results.js`'in tasarımlı
rapor kabuğu üç kaynağı çevirdikten SONRA bulundu: elle sayılan liste eksikti,
kapı saydı.

### Aynı turda bulunan İKİ CANLI KUSUR — ikisi de tanımsız jeton

Şekil ve palet turları jetonları saymaya zorlayınca iki başvuru ortaya çıktı
ve ikisinin de **tanımı yoktu**:

| Jeton | Çağıran | Sonucu |
|-------|---------|--------|
| `--bg-hover` | 4 `:hover` kuralı + 2048 düğmesi | o dört yüzeyde fare üstündeyken **hiçbir şey olmuyordu** |
| `--border-subtle` | `.ve-fw-seeded` | notun **üç kenarında çerçeve yoktu**, yalnız sol aksan şeridi çiziliyordu |

Hata sınıfı bu deponun korktuğu sınıf: CSS'te çözülemeyen bir özel özellik
bildirimi **sessizce geçersiz kılar** — konsola hiçbir şey düşmez, hiçbir test
kırılmaz, yalnız beklenen şey olmaz.

`--bg-hover` için YENİ JETON AÇILMADI. Ölçüldü: koyu kimlikte `--text-muted`
AA'yı (4,5) yalnız `#2a2621`'de geçiyor — yani `--bg-tertiary`'nin kendisi.
Aynı değeri ikinci bir adla yazmak sürüklenmeye davetiyedir; beş çağıran var
olan yüzeye bağlandı.

**Kapı:** `source-hygiene.test.js` bölüm 6 — `css/` ve `js/` içindeki her
`var(--x)` başvurusu `css/`'te bildirilen jeton kümesiyle karşılaştırılır.
Belge üreticileri kapsam dışı (kendi jetonlarını kendi stil sayfalarında
bildiriyorlar). İki yönde de düşmesi ölçüldü, dosya ve satır adıyla.

### Geometri kapıları RENGE çivilenmez

`cp-fead-summary.test.js`'in "frekans göstergesi çizim alanının DIŞINDA"
halkası ızgara çizgilerini `stroke="#e4e6e9"` ile seçiyordu: bir GEOMETRİ
kapısı bir RENK yüzünden düştü. Izgara artık çizimde en çok tekrar eden
`<line>` rengidir — tanım şeklin kendisinden gelir, paletten değil.

## Atölye kabuğu — tek sütun ve alt durum şeridi (2026-09-22)

**Hüküm.** Ray ile palet TEK sütun okunur: aynı zemin, aralarında dikey çizgi
yok, sütunun sağ kenarında tek çizgi. Durum okumaları tuvalin ALTINDA, kendi
şeridinde.

### Birleştirme bir DOM taşıması DEĞİL

Ray `.ve-main`'in dışında duruyor ve bu yapısal: Sonuçlar'a geçince panel de
tuval de değişiyor, **ray yerinde kalıyor** (kaydı `index.html`'de yazılı).
Rayı paletin içine taşımak sayfa geçişini kırardı. Birleştirme bu yüzden bir
**yüzey kararı**: ikisi `--bg-secondary`'ye gelir ve aradaki çizgi kalkar.

Çizgi yalnız TUVAL sayfasında kalkar — Sonuçlar'da palet gizleniyor ve sütunun
tek kenarı onunla gidiyor, ray kendi kenarını geri alıyor. Bayrağı
`js/tabs.js` koyuyor (`html.ve-sayfa-tuval`). Satır içi `display` dizesine
bakan bir seçici (`[style*="none"]`) tarayıcının stil serileştirmesine bağlı
olurdu.

### 2026-08-13 kullanıcı kararının DURUM YARISI emekli

Kayıt şuydu: *"Bant TUVALİN ÜSTÜNDE durur — sekmeler bu yüzden klasik yönde,
aşağıya, tuvale bağlanır."* Gerekçe okununca ikiye ayrılıyor ve **yalnız
sekmelere ait**: bir sekme açtığı belgeye bağlanır. Durum bir gezinme yüzeyi
değil bir **okuma**; mühendislik yazılımlarının tamamında altta durur.

Sekmeler bandın tamamını aldı: **662 → 996 px** (eskiden sağdaki 327 px'i durum
yiyordu).

### Ödenen bedel ÇİVİLİ

| Ne | Önce | Sonra |
|----|------|-------|
| Tuval yüksekliği (1280×720) | 575 | **551** (−24) |
| Sekme bandı genişliği | 662 | **996** (+334) |
| Şerit katlanınca tuval kazancı | — | **+86** (mekanizma zaten vardı) |

24 px'i gizlemek yerine kapıya yazdık. Şerit katlaması (aktif sekmeye ikinci
tık) **zaten kuruluydu** ve 86 px geri getiriyor — planın "şerit katlanır
yapılacak" maddesi ölçülünce **yapılmış çıktı**; o turda inşa edilen tek şey
bu kararın kendisi oldu.

**Kapı:** `tests/e2e/kabuk-sutun.spec.js` — beş halka, Node'da hiçbiri
koşamaz (jsdom `getBoundingClientRect`i sıfır döndürür, kenarlık rengini
kaskaddan hesaplamaz). İki yönde düşmesi ölçüldü: ray kenarı geri konunca
tek-sütun halkası, durum bandın içine dönünce yerleşim halkaları.

## Tuval bir ÇUKURA oturur (2026-09-22)

**Hüküm.** Tuval dört kenardan da 8 px içeri çekilir, yarıçaplıdır ve **iç**
gölge taşır. Üst ve alt bantlar (sekmeler · durum) tam genişlikte kalır.

**Gerekçe.** Yerleşim bir ayrım söylüyor: **bant kabuğun, tuval çalışmanın.**
Kabuğun kenarına yapışan bir bant ile içeri çekilmiş bir yüzey bunu sözsüz
anlatır; ikisi de kenara yapışınca aynı düzlemde okunuyorlardı.

**İÇ gölge bir YÜKSELTİ değil bir DERİNLİKTİR.** Emekli hüküm
(*"yalnız YÜZEN katman gölge alır; yerinde duran kabuk gölge almaz"*) bu ayrımı
yapmadığı için çukuru da yasaklıyordu: nesneyi kaldıran gölge ile yüzeyi oyan
gölge aynı sayılmıştı. `--shadow-inset` PR 5'te tam bunun için tanımlandı.

**Bölünmüş görünümde her bölme kendi çukuru olur** — boşluk kapta
(`.ve-split-container` iç payı + `gap`), çukur bölmenin kendisinde.

**Kapı:** `kabuk-sutun.spec.js` → *"tuval bir ÇUKURA oturuyor"*. DÖRT kenarın
da payı ölçülür (tek kenarda pay bir çukur değil bir kaymadır) ve gölgenin
`inset` olduğu ayrıca tutulur — dışa çevrilince düşüyor, ölçüldü. Node'da
koşamaz: jsdom `box-shadow`u kaskaddan hesaplamaz.

## Panel alan grameri — iki yüzey tek dil (2026-09-22)

**Hüküm.** Bileşen panelinin alan grameri Kayış Tablosu'nunkiyle **aynıdır**:
etiket üstte (mono · mikro · büyük harf · soluk), birim etiketin yanında,
türetilen değer **oyuk** zeminde. Etiket, denetiminin yaslandığı **kenara**
yaslanır.

**Gerekçe — ölçülen ayrışma.** Aynı modülün iki yüzeyi iki ayrı gramer
konuşuyordu, ve kullanıcı panele **tablodan** geçiyor (satırdaki ad düğmesi):

| | Kayış Tablosu | Kasnak paneli |
|---|---|---|
| Etiket | ÜSTTE | SOLDA |
| Türetilen değer | OYUK zemin | **YÜKSELEN** zemin |
| Ayrım | zemin | saç teli ızgara |

İkincisi sessiz bir **ters işaretti**: okunur değer, yazılabilir olandan daha
önde duruyordu. Ayrımın tek taşıyıcısı zemin olduğu için bunu hiçbir şey
söylemiyordu. Üçüncüsü bir **hesap sayfası** çiziyordu — kullanıcının Kayış
Tablosu için *"demode ve ilkel"* dediği desenin aynısı.

**Etiket üstte yalnız bir hiza değil bir KAZANÇ:** etiket yatay yer istemeyince
alan daralabiliyor, yani aynı satıra daha çok alan sığıyor.

**P3 hükmü EMEKLİ DEĞİL, KENARA TAŞINDI.** Kapatılan kusur etiketin ortalanıp
değerin sağa yapışmasıydı; o gün çare *"ikisini aynı satıra koy"* olmuştu.
Etiket üste çıkınca aynı kusur yeniden açılabilirdi, bu yüzden hüküm bir
**kurala** dönüştü: sayı alanı sağa yaslı → etiketi de sağda; metin ve açılır
liste sola yaslı → etiketi de solda. Yeni bir alan tipi kendi hizasını
getirdiğinde etiket onu izler.

**Açılır listenin sabit-piksel kuralı da emekli değil, YERİ değişti.** Ölçülmüş
kusur (en uzun seçenek 169 px ister, alan 120 px verir) bir **yatay yarıştan**
doğuyordu: etiket aynı satırda yer istiyordu. Etiket üste çıkınca liste alanın
tamamını alıyor ve yarış bitiyor. Kapı CSS metninden gerçek tarayıcıya taşındı:
ölçülen şey artık bir oran değil **kırpılmanın kendisi**.

**Ödenen bedel:** panel 260 → **281 px** (+21, %8) — 12 alan, 5 ızgara.
Beklenenden az, çünkü etiket mikro punto ve saç teli kenarlıkları gitti.

**Kapı:** `tests/e2e/fead-panel-gramer.spec.js` (4 halka). Node'da koşamaz:
jsdom kaskaddan `background-color` hesaplamaz, `:has()` değerlendirmez,
`scrollWidth`i sıfır döndürür. İki düşme ölçüldü — türetilen değer yükselen
zemine dönünce halka jeton değerini adıyla söylüyor, etiket sola dönünce
hangi alanların bozulduğunu sayıyor (*"Dış çap (OD) → denetim right, etiket
flex-start"*).
