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
`.ve-rep-head` ile **aynı `--results-bar-h`'tan** (bugün `--bant-h`) besleniyor, düğmeler ölçüm
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

## Tek yazı tipi — Inter (2026-09-23)

**Hüküm.** Arayüzün her yüzeyi tek aileyle çizilir: `--font-sans` (Inter,
`css/fonts.css`'te gömülü; 400–800, latin + latin-ext). Başlık, gövde, etiket,
sayı, form denetimi ve **tuval** dâhil. Başlık ayrı bir YÜZ değil: aynı aile,
kendi ağırlığı ve `letter-spacing:-0.01em`. **İndirilen belgeler de**
(AP · Takoz · FEAD ayrıntılı · FEAD özet raporu, kılavuzlar) aynı yüzle yazar.
**İki istisna:** hizası boşlukla kurulmuş düz metin — TXT rapor sayfası
(`.ve-rep-page pre`, `.ve-rep-measure` → `--rep-mono`) — ve KaTeX'in formül
yüzü (matematik dizgisi kendi yüzüyle yazar).

**Belgeler yüzü arayüzden GÖMER** (`js/theme.js` → `veThemeFontFaceCss`):
arayüzün kendi @font-face kuralları (build `css/fonts.css`'i `<style>` olarak
gömüyor), ikinci bir kopya değil. Önce belgeler kendi üç yüzünü (Source Serif
4 gövde · Archivo başlık · IBM Plex Mono sayı) ~390 KB'lık ayrı bir pakette
taşıyordu; aynı program ekranda bir, kâğıtta üç aileyle yazıyordu. Ölçüldü
(AG00976): FEAD özetinde 133 · 271 · 712, ayrıntılı raporda 301 · 730 · 1311
öğe → iki belgede 3458 öğenin tamamı Inter; özetin altı A4 sayfasının hiçbiri
taşmıyor; 136 şekil metninin hiçbiri çerçeveden kırpılmıyor. Paket 1.086.340 →
695.429 bayt (`build-report-assets.js --mevcut-katex` ağsız yeniden üretir).
Kapı: `tek-yazi-tipi.test.js` → *"belgeler de tek yüz"* + `tek-yazi-tipi.spec.js`
→ *"BELGE de tek yüz"* (belge uygulamanın DIŞINDA açılır, yüz orada ölçülür).

**Gerekçe — ölçüldü.** Kullanıcı isteği: *"Program içinde çok fazla yazı tipi
var. Tek bir yazı tipi olmasını istiyorum."* Önce, gerçek tarayıcıda: ekranda
BEŞ aile — Inter; başlıkta Source Serif 4; etiket ve sayıda sistem mono'su
(FEAD ekranında 126–146 öğe); tuvalde `sans-serif` ve `system-ui` (Windows'ta
Arial ve Segoe UI). Kaynakta 54 CSS mono kuralı, ~50 satır içi mono bildirimi
ve kendi ailesini yazan 101 tuval ataması.

**Rakam hizası mono İSTEMEZ.** Mono'nun buradaki tek işi rakamları alt alta
hizalamaktı; `body`'deki `font-variant-numeric: tabular-nums` bunu Inter'le
yapıyor.

**Tuval `var()` çözemez** → `veThemeFont(px, ağırlık)` / `veThemeFontFamily()`
(`js/theme.js`) aileyi `--font-sans`'tan okur. Tuvale çıplak aile adı
yazılmaz; Plotly de aileyi aynı köprüden alır.

**UA stil sayfası `kbd, code, samp, pre`'ye monospace verir.** Mono kuralları
kalkınca `kbd` sessizce sistem mono'suna döndü (gerçek tarayıcıda ölçüldü);
form sıfırlaması (`font-family:inherit`) o dört elemanı da kapsıyor.

**Ağırlıklar gömülü setten** (400–800). `650` gibi bir değer tarayıcıda
sessizce 700'e yuvarlanır.

**Başlık yüzü EMEKLİ** (2026-09-22'de girdi, 09-23'te çıktı):
`css/fonts-display.css`, `tools/build-display-font.js` ve
`build:display-font` kalktı; üç üründe de −85 KB.

### Ölçüm `measureText` ile — `document.fonts.check` BOŞTUR

```
document.fonts.check('600 16px "Zzz Yok Boyle Bir Aile"')  →  true
```

Spec'e göre `check()` *"bu metni çizmek için yüklenmesi GEREKEN bir yüz kaldı
mı"* sorusunu cevaplıyor; hiç eşleşen yüz yoksa cevap "kalmadı" — yani `true`.
Yedek yüze düşen bir harf de `true` döner (kanıtlandı: latin-ext yüzü TAMAMEN
silindi, eski dört halka yeşil kaldı). Gerçek ölçüt **genişlik** — ama tek
yedekle ve eşikle DEĞİL. İlk yazım harfi `"Inter", monospace` ile ve çıplak
`monospace` ile çizip farka 0,5 px eşik koyuyordu; CI'da (#984) kırmızıya
döndü ve sebep yüz değil TESADÜFTÜ: Inter'in "ö"sü 0,597 em, DejaVu Sans
Mono'nunki 0,602 em — yerelde fark 0,55 px'ti (eşiği 0,05 px'le geçiyordu),
CI'ın Chromium'unda altına düştü. Şimdi harf aynı aileyle **üç ayrı yedeğe**
(`monospace` · `serif` · `sans-serif`) karşı çizilir: yüzde varsa üçü de
Inter'den çizilir ve BİREBİR aynıdır, yoksa her biri kendi yedeğine düşüp
ayrışır — eşik de Inter'in kendi genişliği de işin içinde değil. latin-ext
sökülünce ölçüm tam olarak ğ ş Ğ İ Ş'yi adlarıyla söylüyor. Kapının kendisinin
boş olmadığı ayrı bir halkayla tutulur (var olmayan aile bütün harfleri eksik
saymalı).

**Tembel alt küme.** `latin-ext` parçası `unicode-range` ile ancak o harflerle
metin çizilince iner. Halka yükü `document.fonts.load` ile AÇIKÇA ister —
istemeyen ilk yazımı, başlıkları serif olan eski derlemede ğ/ş/İ'yi "eksik"
saydı; yüz aynıydı.

**Kapı.** `tests/unit/tek-yazi-tipi.test.js` (CSS'te aile yalnız `inherit` ya
da `var(--font-sans)`, istisna listesi TAM eşleşir; JS'te her `.font =`
köprüden, satır içi aile yok; Plotly köprüden) + `tests/e2e/tek-yazi-tipi.spec.js`
(gerçek tarayıcı: ekranda 500+ öğe ve tuvalde tek aile, Türkçe harfler iki
ağırlıkta, sıfır ağ isteği). Değişiklik öncesi derlemede halkaların üçü
düşüyor: başlık `Source Serif 4`; ekranda `SF Mono` / `Source Serif 4` /
`ui-monospace`; tuvalde `sans-serif`.

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

## Kabuk TEK ÇİZGİ — üst bant tek jeton, tuval kenara yapışık (2026-09-23)

**Hüküm.** Yan yana duran üst başlıklar ölçüyü ve zemini tek jetondan alır
(`--bant-h` + `--bant-zemin`): Topoloji'de "Bileşenler" · sekme bandı ·
müfettiş başlığı, Sonuçlar'da Veri Gezgini · araç çubuğu · rapor bandı. Bandın
başlığı altındaki sütunun sol kenarından başlar. Tuvalin kendi çerçevesi yok;
sınırı komşusunun çizgisidir. Aktif sekme bandın çizgisini örter (çizgi
zeminin iç gölgesi, kenarlık değil) ve tuvale bağlanır.

**Gerekçe — ölçülen.** Kullanıcı: *"pencere sınırları bir hizasız, tatsız,
güzel değil."* Topoloji'de üç başlık 37 · 29 · 33 px, alt çizgileri y=75 · 67 ·
71; iki zemin rengi. Tuval 8 px içeride 10 px köşeli bir çukurdaydı: her sınır
iki çizgi (kenar çubuğu 283 ↔ tuval 292, bant 67 ↔ tuval 75), aktif sekme
tuvale değil aradaki kâğıda açılıyordu. Aynı kırılma Sonuçlar'da 2026-08-17'de
`--results-bar-h` ile kapatılmıştı; jeton kabuğun oldu.

**Emekli: "Tuval bir ÇUKURA oturur" (2026-09-22).** Ayrımı ("bant kabuğun,
tuval çalışmanın") pay ile söylüyordu; bugün zemin söylüyor (bantlar yüzey,
tuval kâğıt). Karşılamanın "çukursuz" istisnası onunla gereksiz kaldı.

**Kapı:** `tests/unit/kabuk-bant.test.js` (CSS metni: her bant jetondan, kural
olarak) + `kabuk-sutun.spec.js` → *"KABUK TEK ÇİZGİ"* ve *"başlıklar içeriğin
kenarında"* (gerçek tarayıcı; eski derlemede 8 px ve 5 px ile düşüyor).

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

**2026-09-23 — kenar TEK: sol.** Kural doğruydu ama kenarı ALAN TİPİNE
bırakıyordu: sayı sağda, liste solda. Aynı pencerede etiketler beş ayrı sol
kenara dağılıyordu (380 px'lik kasnak penceresi: 11 · 63 · 203 · 305–325 px;
5 örnek × bütün pencere/sekmelerde 114–150 etiket denetiminin sol kenarından
kaymış). Kullanıcı: *"Hizalamalar, şekiller şukullar hep kaymış."* Sayı da
sola yaslandı; etiket, değer ve bölüm başlığı tek çizgiden başlıyor. Sağa
yaslı rakamın işi SÜTUN karşılaştırmasıdır — o iş veri TABLOSUNDA kalır
(`.ve-fp-duty-tbl` sayıyı ve başlığını sağa yaslar). Aynı turda: türetilenler
iki sütun, özet şeridi çip (asılı `·` ayracı yok), bölüm çizgisi yalnız
"kritik"te renkli (5 renk → 2). Kapı: `source-hygiene.test.js` → *"HER ALANDA
SOL"* (`.ve-fp-l|inp|sel` seçicisi sağa/ortaya geri çekemez) +
`fead-panel-gramer.spec.js` → *"TEK SOL KENAR"*.

**Ödenen bedel:** panel 260 → **281 px** (+21, %8) — 12 alan, 5 ızgara.
Beklenenden az, çünkü etiket mikro punto ve saç teli kenarlıkları gitti.

**Kapı:** `tests/e2e/fead-panel-gramer.spec.js` (4 halka). Node'da koşamaz:
jsdom kaskaddan `background-color` hesaplamaz, `:has()` değerlendirmez,
`scrollWidth`i sıfır döndürür. İki düşme ölçüldü — türetilen değer yükselen
zemine dönünce halka jeton değerini adıyla söylüyor, etiket sola dönünce
hangi alanların bozulduğunu sayıyor (*"Dış çap (OD) → denetim right, etiket
flex-start"*).

## Atölye üst bandı — komut dizen yüzey, yön gösteren yüzeye döndü (2026-09-22)

**Hüküm.** Bant üç şey söyler: **neredeyim** (marka · modül adı), **ne
arıyorum** (komut arama), **tek ana eylem** (Çöz). Şerit gövdesi varsayılan
olarak **katlı** açılır.

**Ön koşul — ve meşruiyetin tamamı bu.** Gövdeyi kapatmak, ancak şeritteki her
komut palette de bulunabiliyorsa meşru. Ölçüldü: şerit **42** komut, palet
**30** — **on biri palette YOKTU** (sınır çerçevesi, kılavuzlar, Komuta
penceresi, radyo ve Sonuç sayfasının beş şerit komutu). Koşul sağlanmasaydı
hata **sessiz** olurdu: komut kaybolmaz, sadece **bulunamaz** — fonksiyon
duruyor, çağrısı duruyor, düğmesi ekranda değil.

**Tek meşru istisna `veCmdkOpen`**: paleti açan komut palette aranmaz.

**Modül adının kaynağı `veSidebarScope`** — modül aç/kapa'nın geçtiği tek
nokta. İkinci bir "aktif modül" değişkeni tutulmuyor: iki değişken iki yüzeyin
sessizce ayrışması demekti. Kökte **boş** yazılır (karşılama ekranında
gidilecek modül yok) ve `:empty` kuralı ayracı da kaldırır — boş bir çizgi
"bir şey eksik" der.

**Komut arama ALAN GİBİ görünür, DÜĞMEDİR.** Kural 14'ün iki yönlü afordansı
(düğme dolu, alan boş) burada bilerek esnetildi: kutu bir metin alanı olsaydı
kullanıcı içine yazmayı beklerdi, oysa yazmak paleti açar. Çerçeveli ama dolu
değil — *"buraya bir şey yazacaksın"* diyor, *"burası şu an yazılıyor"*
demiyor.

**Bandın TEK dolu düğmesi var.** İkinci bir dolu düğme "asıl iş hangisi"
sorusunu geri getirirdi. Kapı bunu renk adıyla değil **zeminle** ölçüyor.

### Yetki devri bandın tamamına taşındı

`data-qat` dinleyicisi `#ve-qat` kabına bağlıydı; bandın yeni düğmeleri o kabın
**dışında**. Dinleyici kapta kalsaydı düğmeler **sessizce ölürdü** — markup
doğru, fonksiyon yerinde, tık hiçbir şey yapmaz. Ölçüldü ve kapıda tutuluyor.
Pasifleştirme taraması da aynı sebeple bandın tamamını geziyor.

### Ölçülen sonuç

| Ne | Önce | Sonra |
|----|------|-------|
| Şerit yüksekliği (varsayılan) | 116 px | **44 px** |
| Tuval yüksekliği (1280×720) | 551 | **623** (+72) |
| Palet kapsamı | 30/42 | **41/42** (+ 1 meşru istisna) |

### Yapılmayanlar — ve neden

| Maketteki | Neden yok |
|-----------|-----------|
| Avatar (**KA**) | Programda **kullanıcı kimliği yok** — tek ortak parola. Baş harf basmak olmayan bir kimliği iddia etmek olurdu |
| "Kaydedildi · 12:04" | Kaydetme **zamanı hiçbir yerde tutulmuyor**. Uydurulmuş bir saat, yanlış bir güvence verir |

**Kapı:** `tests/unit/komut-kapsami.test.js` (kapsam, Node'da) +
`tests/e2e/ust-bant.spec.js` (yerleşim ve canlı bağ, gerçek tarayıcıda). İki
düşme ölçüldü: bir komut paletten çıkarılınca kapsam kapısı adıyla söylüyor,
yetki devri kaba geri dönünce arama düğmesi paleti açamıyor.

## Bandın envanteri — "eskisiyle aynı olmuş" (2026-09-22)

**Bildirim.** Bant Atölye'ye geçirildikten sonra kullanıcı: *"bu toolbar çok
kalın olmuş. Ayrıca eskisiyle de aynı olmuş."* Haklıydı ve sebep **renk değil
ENVANTERDİ**: bandın içinde hâlâ şerit sekmeleri (Giriş · Görünüm · Araçlar)
ve kaydet/geri/ileri ikonları duruyordu. Yeni öğeler onların yanına eklenmişti,
yerlerine değil.

**Hüküm.** Bant yalnız dört şey taşır: **marka · modül adı** ┊ **komut arama ·
birincil eylem · avatar**. Şerit sekmeleri **gövdenin** satırıdır ve gövde
katlıyken onlar da yoktur — "kapalı ama yarısı açık" bir hâl yoktur.

| Ne | Önce | Sonra |
|----|------|-------|
| Bant yüksekliği | 44 px | **38 px** |
| Şerit sekmeleri | bantta | **gövdede** (katlıyken gizli) |
| Kaydet/geri/ileri ikonu | bantta | **yok** — klavye + palet |
| Marka ikon kutusu | var | **gizli** (maket yalnız sözcük markasını gösteriyor) |
| Bant zemini | `--bg-tertiary` (oyuk) | **`--bg-secondary`** (yükselen) |
| Tuval yüksekliği | 623 | **629** |

Oyuk zemin bandı bir **araç şeridi** gibi okutuyordu; bu kabuğun başlığı.

**KALDIRILAN DÜĞMENİN YOLU AÇIK KALIR.** Kaydet ikonu banttan kalkarken
ölçüldü: `veSaveTopology` **hiçbir tuşa bağlı değildi** (Ctrl+Z ve Ctrl+Y
vardı, Ctrl+S yoktu). Düğmeyi klavye yolu açmadan kaldırmak, sık kullanılan
bir eylemi yalnız palete mahkûm etmekti — **Ctrl+S o turda eklendi**.

## Kimlik — uydurulmadı, AÇILDI (2026-09-22)

**Hüküm.** Avatar bir adı gösterir; ad **kullanıcının kendi yazdığıdır**
(Ayarlar → Görünüm → Kimlik ya da avatar menüsü). **Tarayıcıda** saklanır,
**projeye yazılmaz** — dosyayı paylaşan herkes onu da paylaşırdı.

Ad yokken **sahte baş harf basılmaz**: nötr bir daire durur ve menü adı
yazmaya çağırır. *"Bilinmiyor"u "biliniyormuş gibi" göstermemek* bu deponun
kuralı; ilk turda avatarın hiç yapılmamasının sebebi de buydu.

**BAŞ HARF TÜRKÇE BÜYÜTÜLÜR.** `'i'.toUpperCase()` → `'I'`, oysa Türkçe'de
`'İ'`. "İlker" → "I" **yanlış** baş harftir ve hata sessizdir: avatar dolu
görünür. `toLocaleUpperCase('tr')` kullanılır. En çok iki harf — üçü avatarda
okunmuyor, biri ayırt etmiyor; tek parçalı adda ikinci harf **uydurulmaz**.

**Kapı:** `tests/unit/kimlik.test.js` (baş harf, tuzağın kendisi dahil çivili)
+ `tests/e2e/ust-bant.spec.js` (envanter · avatar · menü · Ctrl+S).

## Şerit sekmeleri — markanın yanında, ama yalnız gövde açıkken (2026-09-22)

**Hüküm.** Sekmeler (Giriş · Görünüm · Araçlar) bandın **içinde**, markanın
yanında durur — ve **yalnız gövde açıkken** çizilir.

**İki uç da ölçüldü, ikisi de yanlıştı:**

| Deneme | Kusur |
|--------|-------|
| Hep bantta (ilk hâl) | Üst satır eski şeridin aynısı okunuyordu — *"eskisiyle de aynı olmuş"* |
| Gövdeye taşındı | Açılışta bandın çizgisinin **altında** ikinci bir başlık satırı doğuyordu — *"başlıklar üstteki çizginin altına geliyor"* |

Doğrusu ortası. Sekme bir **sayfa başlığı** değil, gövdenin hangi yüzünü
gördüğünü söyleyen bir **seçici**; yeri de o gövdeyi açan bandın kendisi.
Kendi zemini **yok** — bandın zeminini paylaşır, yoksa banda ikinci bir şerit
çizerdi. Üst kenarlık + negatif `margin-bottom` hilesi (klasör kulağı) kalktı:
bandın altındaki çizgiye yapışacak bir kenarı yok.

## Kanvas çizimi tema köprüsünden geçer (2026-09-22)

**Hüküm.** Hiçbir `ctx.fillStyle/strokeStyle` ataması sabit hex yazmaz;
hepsi `veThemeRgba` köprüsünden geçer. Diyagram serileri **tema başına** ayrı
değer taşır (`--seri-1..4`).

**Gerekçe — ölçülen kusur.** 65 atama köprüyü atlıyordu ve hata bir temada
görünmez, ötekinde okunmazdı:

| Renk | Nerede kırık |
|------|--------------|
| `#8f3636` seri kırmızısı | koyu zeminde **2,45** |
| `#a78bfa` seri moru | beyazda **2,72** |
| `#4aa3ff` | beyazda **2,63** |
| `#666` eksen yazısı · `#444` ızgara | koyu zeminde okunmuyor |

Yani diyagramların yarısı bir kimlikte, yarısı ötekinde kayboluyordu. Tek bir
palet iki kimliğe yetmiyor: seriler **hue** ile ayrışır, parlaklıkla değil, ve
her biri **kendi** kimliğinin zeminlerinde ≥3:1 olmak zorunda.

| | açık | koyu |
|---|---|---|
| `--seri-1` | `#2f6a9e` (4,89) | `#7ab3e0` (7,31) |
| `--seri-2` | `#9a3b3b` (5,87) | `#e08585` (6,14) |
| `--seri-3` | `#6b4fa0` (5,53) | `#b39ddb` (6,85) |
| `--seri-4` | `#2f6b45` (5,43) | `#6cbb87` (7,11) |

### Önbellek DENENDİ ve GERİ ALINDI

Çizim döngüsü kare başına onlarca çağrı yapıyor; `veThemeRgba`'ya bir önbellek
eklendi ve **aynı turda geri alındı**. Sebep: jeton değeri `changeTheme`
dışında bir yoldan değişirse önbellek bayat kalıyor ve köprü *"şu anki değeri
oku"* sözünü bozuyor — `theme-rgba.test.js` bunu anında yakaladı.

Asıl kusur testin kırılması değil, **kazancın ölçülmeden eklenmesiydi**:
ölçülmüş bir kazanç için bile o sözleşme bozulmazdı. Çağıran tarafta önbellek
meşru ve zaten var — `js/results.js` → `_drThemeColors()`, tema değişiminde
sıfırlanıyor.

**Kapı:** `source-hygiene.test.js` bölüm 7 — sabit hex yok, `ctx`'e `var()`
dizesi verilmiyor (Canvas onu sessizce yutar), ve seri paleti iki kimlikte de
≥3:1. İki düşme ölçüldü, ikisi de adıyla söylüyor.


## Bir öğeyi taşımak, üstündeki kuralları da taşımaktır (2026-09-22)

**Ölçülen kusur.** Durum şeridi Tur A'da `.ve-doc-dock`'tan çıkarılıp tuvalin
altına taşındı. Şerit o kabın içindeyken `.ve-main.ve-no-module .ve-doc-dock
{ display:none }` kuralıyla **birlikte** gizleniyordu — karşılama ekranında
görünmemesinin sebebi buydu ve kendi kuralı hiç yazılmamıştı.

Taşınınca kapsamdan **sessizce** çıktı: karşılama ekranının dibinde
*"0 bileşen, 0 bağlantı · %100 · Hazır"* belirdi, yani arkada açık bir
topoloji varmış gibi (kullanıcı bildirimi). Hiçbir test bakmıyordu — şeridin
karşılamada gizli olduğu hiçbir yerde yazılı değildi, bir kabın yan etkisiydi.

**Hüküm.** Bir öğe DOM'da yer değiştirdiğinde, ona **kabı üzerinden** uygulanan
kurallar da taşınır. Devralınan bir kural, yazılı olmayan bir karardır.

**Kapı:** `kabuk-sutun.spec.js` → *"karşılama ekranında durum şeridi
GÖRÜNMÜYOR"* — hem gizlendiğini hem modüle girince **geri geldiğini** ölçer
(gizleme kalıcı olmamalı). Düşmesi ölçüldü.


## Hover jetondan gelir, parlaklık filtresinden değil (2026-09-22)

**Ölçülen kusur.** Dolu düğmelerin `:hover`ı on bir yerde
`filter:brightness(1.08…1.15)` ile yapılıyordu. Filtre **tema-KÖRDÜR**:
boyanmış sonucu çarpar, hangi kimlikte olduğunu bilmez. Ölçüldü —

| Kimlik | Aksan | Metin kontrastı: dinlenme → hover |
|--------|-------|-----------------------------------|
| Açık | `#a8502b` | 5,46 → **4,67** (AA tabanına iniyor) |
| Koyu | `#d9763f` | 5,71 → **6,86** |

Yani aynı bildirim iki kimlikte **ters** yöne gidiyor: açıkta okunaklılığı
düşürüyor, koyuda artırıyor.

**Hüküm.** Hover `--ink-accent` / `--ink-success` / `--ink-warning`
jetonlarından gelir. `--ink-*` zaten "aksanı metin gücünde kullan" için
ölçülmüş değerlerdir — açıkta daha koyu, koyuda daha açık — yani hover **iki
kimlikte de kontrastı artıran yöne** gider.

**`--bg-*` merdiveni bu işe yaramaz**: iki kimlikte TERS sıralı (açıkta
`--bg-tertiary` `#e6e1d8`, `--bg-secondary` `#faf8f4`'ten KOYU; koyuda
`#2a2621` ondan AÇIK). "Bir üst yüzey" diye tek bir jeton yok. Opak bir
yüzeyin hover'ı gerektiğinde aksan kendi zeminine karıştırılır
(`color-mix(in srgb, var(--accent-primary) 8%, var(--bg-tertiary))`) —
`--accent-tint-8` doğru orandır ama SAYDAMDIR ve gölgeli/üstte duran bir
yüzeyde altını geçirir.

### Kaldırmayı ölçen kapı, yerine konanın ölü olduğunu göremez

Bunu iki yerde **sessizce** kaçırdık. `.ve-settings-btn-primary:hover`
kuralında yeni `background:var(--ink-accent)` bildiriminden **sonra** eski
`background:var(--accent-primary)` duruyordu; art arda yazılan iki bildirimde
sonuncusu kazanır, yani hover dinlenme durumunun aynısını boyuyordu. Eski
`filter` bildirim sırasından **bağımsız** çalıştığı için aynı kural yıllarca
doğru görünmüştü. `.dr-hdr`de de aynısı: taban zaten `--bg-tertiary` idi ve
hover ona aynı değeri yazdı. İkisi de `filter:brightness` yok diyen kapıdan
geçiyordu.

**Hüküm.** Kapı **VARIŞI** ölçer: her `:hover` kuralı tabanından farklı en az
bir kazanan bildirim yazmak zorunda.

**NÖTRLEYİCİ istisnadır, ölü değildir.** `.ve-fp-inp[readonly]:hover` tabanıyla
aynı değeri yazar ama işi daha geniş bir hover'ı (`.ve-fp-inp:hover`) iptal
etmektir — salt-okunur alan fareye tepki VERMEMELİ. İşareti, niteleyicileri
soyulunca ortaya çıkan daha genel bir `:hover` kuralının aynı özelliği
yazıyor olmasıdır. Muafiyet **koşulludur**: geniş kural silinirse nötrleyici
de ölü sayılır (ölçüldü).

**Kapı:** `source-hygiene.test.js` bölüm 8 (`filter:brightness` yok, satırıyla)
+ bölüm 10 (ölü hover yok — 193 `:hover` kuralının tamamı taranıyor). Üç düşme
ölçüldü: ölü hover yakalanıyor, nötrleyici muafiyeti geniş kural silinince
düşüyor.

## Panel alan borcu yalnız aşağı iner (2026-09-22)

FEAD paneli Atölye alan gramerine geçti; kalan on panel dosyası hâlâ satır içi
`style=` ile alan kuruyor. Satır içi CSS **durum ifade edemez** (`:hover`,
`:focus`, `:invalid` yazılamaz) — o paneller bu yüzden donuk.

**Hüküm.** Sayı bir hedef değil **borçtur**: 1170'te çivilendi ve yalnız
modül modül iner. Pay bırakılmadı — pay bırakmak, borcun sessizce büyümesine
verilmiş izindir; bu deponun `CLAUDE.md`'si tam olarak o şekilde 6.052 satıra
çıktı.

**Kapı:** `source-hygiene.test.js` bölüm 9. Tavan aşılınca hata mesajı
**dosya başına dağılımı** basar — hangi modülün borcu büyüdü, adıyla görünür.


## Müfettiş tuvalin YANINDADIR, üstünde değil (2026-09-22)

**Ölçülen kusur.** Bileşen özellikleri ekranın **ortasında**, `rgba(0,0,0,0.6)`
karartmalı bir perdenin üstünde açılıyordu. Yani bir sayı girmek modeli gözden
kaybettiriyor, girilen sayının modeli nasıl değiştirdiğini görmek pencereyi
**kapatmayı** gerektiriyordu. Perde ayrıca tuvalin tamamını yutuyordu:
`elementFromPoint` tuvalin tam ortasında overlay'in kendisini döndürüyordu.

**Hüküm.** ≥1280 px'te özellik penceresi sağ kenara yaslı **tam boy sütundur**:
perde yok, `pointer-events:none` ile tıklama tuvale geçer, tuval sütunu
`--inspector-w` kadar **daralır**. Daralma şart — örtseydi kazanılan şey yine
gizlenen model olurdu. Genişlik ile daralma **aynı jetondan** gelir; iki yerde
yazılsaydı ya sütun tuvali örterdi ya arada ölü şerit kalırdı.

**Eşik 1280 px**: altında ray (48) + kenar çubuğu (220, 360'a kadar açılabilir)
+ müfettiş (380) tuvale 632 px bırakıyor. Altında modal davranış **birebir**
durur — dar ekranda sütun bir kazanç değil kayıptır.

**İki varyant modal kalır.** `--2dview` (1000 px) ve `--mntlib` (1040 px) birer
**görüntüleyicidir**, müfettiş değil: ilki üç ölçekli diyagramı alt alta,
ikincisi seçici + üç eksen grafiğini yan yana koyar. 380 px'lik bir sütunda
ikisi de okunamaz olurdu. Ayrım `:has()` ile kuralın kendisinde — ikinci bir
JS bayrağı iki yüzeyin sessizce ayrışması demekti.

### Ölçünün kendisi iki kez yanlıştı

Bunu yazarken iki kez **çalışan bir düzeni "bozuk" ölçtüm**; ikisi de kaydedilmeye
değer çünkü ikisi de sessiz:

1. **`clientWidth` DOLGUYU İÇERİR.** `.ve-canvas-area`nın `clientWidth`i
   müfettiş açıkken de kapalıyken de 1316 — `padding-right` daralmayı hiç
   göstermez. Çizim yüzeyi `.ve-split-container`dır ve ölçü ondan alınır.
2. **Açılış ekranı hâlâ üstteydi.** Halka "tıklama tuvale geçiyor mu" diye
   sorup `#mfsim-loading-photo` ölçüyordu. Testin beklediği şey fonksiyonların
   varlığıydı; perdenin çekilmesi ayrı bir koşul.

**Kapı:** `tests/e2e/mufettis-sutun.spec.js` — üç halka (geniş ekranda sütun ·
tıklamanın tuvale geçmesi · dar ekranda modalin birebir durması). Node'da
koşamaz: jsdom `@media` değerlendirmez, `:has()` hesaplamaz, `elementFromPoint`
yoktur. Düşmesi ölçüldü: eşik erişilemez yapılınca iki geniş halka **eski
belirtiyle** düşüyor (`rgba(0, 0, 0, 0.6)` geri geliyor, overlay tuvalin
merkezini yine sahipleniyor), dar halka yeşil kalıyor.

**Tıklamanın gerçekten geçtiğini ayıran ölçü seçimdir**, pencerenin açık
kalması değil: boş tuvale tıklamak seçimi boşaltır ve pencere onun **sonucu**
olarak kapanır. Perdeli dünyada aynı tıklama perdeye düşer, pencere kapanır ve
seçim **olduğu gibi kalır**. Halka `selectedNodes.length` 1 → 0 geçişini ölçer.


## Pencere kabukları jeton konuşur (2026-09-22)

**Ölçülen kusur.** Kaplamalar ve pencereler yarı yarıya jeton, yarı yarıya
sabit değer yazıyordu — ve iki taraf **aynı şeyi söylemiyordu**:

| Ne | Jeton | Sabit yazan |
|----|-------|-------------|
| perde | `--scrim` = `rgba(0,0,0,0.62)` | iki kaplama: `rgba(0,0,0,0.6)` |
| gölge | `--shadow-xl` = `0 12px 32px var(--shadow-color)` | iki pencere: `0 24px 70px rgba(0,0,0,.42)` |
| z | `--z-overlay: 300` | `.ve-module-overlay`: `z-index:100` |

Üçünün ağırlığı **aynı değil** ve olduğu gibi yazılması gerekiyor:

- **Gölge görünür bir kusurdu.** `--shadow-color` tema farkındadır (açıkta
  `rgba(38,36,31,0.10)`, koyuda `rgba(0,0,0,0.55)`); sabit `rgba(0,0,0,.42)`
  açık kimlikte jetonun **4,2 katı** donuk siyah bir leke bırakıyordu — kâğıt
  zeminli Atölye'de gri bir bulaşma olarak okunuyor.
- **Perde farkı gözle ayırt edilmez** (0,60 ↔ 0,62). Bedeli görünüm değil
  **sürüklenme**: jetonu değiştiren bir tur pencerelerin yarısını hareket
  ettirir, yarısını yerinde bırakır.
- **z farkı bir çakışma riski.** `--z-overlay`ın yorumu modül kaplamasını
  **adıyla** sayıyor ("tuvali kaplayan örtüler: modül seçimi") ama kural 100
  yazıyordu — aynı sayıyı `.ve-split-dropzone` de kullanıyor, yani ikisi aynı
  kapta buluşsa sıra kaynak sırasına kalırdı.

**Hüküm.** Bir pencere kabuğunun perdesi, gölgesi ve yığın katmanı jetondan
gelir. Sabit değer yazmak, jetonun o yüzeyde geçersiz olduğunu söylemektir.

### "Adında geçen" yetmez — özne olmalı

Kapının ilk hâli torunları da tarıyordu ve `.ve-properties-content
.ve-eng-sheet th` üzerinde düştü: yapışkan bir tablo başlığı ve `z-index:1`
onun **yerel** kaldırması, pencere kabuğunun yığın katmanı değil. Kapı artık
seçicinin **öznesine** (son bileşik parça) bakıyor; torunlar dışarıda.

`.ve-chart-legend-overlay` ayrıca **muaf**: `position:absolute` ile bir
grafiğin içinde duran künye rozeti, pencere kabuğu değil.

**Kapı:** `source-hygiene.test.js` bölüm 11. **59 özne kabuk kuralı** taranıyor
ve bu sayı ikinci bir halkayla çivili — hiçbir şey tarayamayan bir kapı
sessizce yeşil kalırdı. Üç dalın üçü de ayrı ayrı düşürüldü: perde
(`.ve-settings-overlay`), gölge (`.ve-help-panel`), z (`.ve-module-overlay`).


## Marka üç yüzeyde de aynı çizilir (2026-09-22)

**Ölçülen kusur.** "MFSim" yazısı açılış ekranında **-0,2px**, karşılama
ekranında **+0,5px** tracking ile çiziliyordu — aynı yüz (Source Serif 4),
aynı boy (20px), **saniyeler arayla**. Devir teslimde marka görünür biçimde
geniyordu: gerçek tarayıcıda ölçüldü, beş karakter × 0,7px ≈ 3,5px, yani
%5'lik bir genleme.

**Sebep bir tercih değil KASKAD.** Display yüzü bağlaması

```css
h1, h2, h3, h4, .mfsim-login-title, .mfsim-loading-logo, .ve-welcome-logo, …
{ font-family: var(--font-display); letter-spacing: -0.01em; }
/* 2026-09-23: aile tekleşti, bağlama artık YALNIZ tracking yazar */
```

ile elemanların kendi `letter-spacing:0.5px` bildirimi **aynı özgüllükte**.
İkisinde bağlama **sonra** geldiği için kazanıyordu (bildirim ÖLÜYDÜ),
`.ve-welcome-logo` ise bağlamadan sonra tanımlı olduğu için **kazanıyordu**.
`0.5px` eski **sans** marka yazısından kalmaydı ve serif yüze geçilirken
kimse onu aramadı.

Yani aynı bildirim, aynı dosyada, üç elemandan **ikisinde ölü birinde
canlıydı** — ve farkı yalnız kaynaktaki SIRA belirliyordu.

**Hüküm.** Display bağlamasına giren bir eleman tracking'ini **bağlamadan**
alır. Aynı değeri tekrar etmek bile yasak: `.ve-settings-section-title`
bağlamanın değerini (`-0.01em`) kelimesi kelimesine tekrar ediyordu — bugün
zararsız, ama bağlama değiştiği gün sessizce ayrışacak ikinci bir kaynak.

**Kardeş kural:** açılış kartı ile karşılama kartının geometrisi zaten **1
px'e kadar** kilitli (`loader-splash.test.js`); gerekçesi aynı — devir
teslimde hiçbir şey yerinden oynamamalı. Marka o kartın İÇİNDEKİ yazı ve
aynı korumayı hak ediyordu.

**Kapı ÇİFT.** `source-hygiene.test.js` bölüm 12 kuralı statik tutar ve
**bağlama listesini elle kopyalamaz, kaynaktan okur** — liste bulunamazsa
halka düşer, yani kapı boşa çalışamaz (ölçüldü: bağlama bozulunca
`Expected >= 4, Received 1`). `tests/e2e/marka-tutarli.spec.js` gerçek
tarayıcıda iki ekranın hesaplanmış değerini karşılaştırır **ve genişlik
farkının göz ayıracak kadar büyük olduğunu** ayrıca ölçer — tracking
eşitliği tek başına, ölçülen şeyin görünür bir fark olduğunu söylemez.
Üç düşme de ölçüldü.


## Panel veri tablosu sunumu sınıftan alır (2026-09-22)

**Ölçülen kusur.** Panellerde **31 veri tablosu** kendi yapışkan başlığını,
kenarlığını ve dolgusunu **satır içi** yazıyordu. Satır içi CSS durum ifade
edemez — `:hover` yazılamaz — yani vites oranları ya da takoz koordinatları
okunurken **"hangi satırdayım" sorusunun cevabı yoktu**. Kayış Tablosu'nu
kart listesine çeviren gerekçenin aynısı.

**Hüküm.** `.ve-pnl-tbl` tek kaynak: yapışkan başlık, hücre dolgusu/kenarlığı
ve **satır vurgusu**. Satır içinde yalnız **VERİ** kalır (sütun genişliği,
koşullu renk, JS'in ürettiği değer) — sunum kalmaz.

- **Fare satırın tamamını boyar**, hücreyi değil: okunan şey satır.
- **Zebra yok** — satır zaten kenarlıkla ayrık, ikinci bir ton fare
  vurgusunun üstüne binerdi (Kayış Tablosu'nda ölçülmüş karar).
- **Başlık `--z-*` ölçeğine girmez**: tablonun kendi kabında yerel bir
  kaldırma, pencere katmanı değil (bölüm 11'in muafiyetiyle aynı ayrım).
- **`.tight` hücre** yoğun girdi satırları için: varsayılan `4px 6px` bir
  `<input>` etrafında fazladan yer yakıyor; satır kurucularının ölçtüğü 3px
  korunuyor. `.ve-eng-sheet td.in` ile aynı fikir.

### Bu turda DEĞİŞTİRİLMEYENLER — ve neden

- **Sayı sütunu `--font-mono`ya çevrilmedi.** Doğru tipografi bu (Kayış
  Tablosu öyle) ama 100+ hücrenin hangisinin gerçekten sayı olduğu tek tek
  doğrulanmadan yapılamaz. Doğrulanmamış bir değişiklik bu deponun tanımıyla
  bir iyileştirme değil bir **iddiadır**. `.num` bu turda yalnız hiza veriyor.
- **`cp-mount.js`'te iki hücre** (`627`, `628`) taşınmadı: anahtar/değer
  tablosunun başlık sütunu biçimi, satır tablosununkinden farklı.
- **`sensors.js` · `solver-pro.js` · `cp-accessories.js`** hiç dokunulmadı —
  ya tablosu yok ya da kendi sınıfı zaten var (`.ve-acc-tbl`).

### Sayaç bu işi OLDUĞUNDAN KÜÇÜK gösteriyor

Bölüm 9'un sayacı `style=` **özniteliğini** sayar, içindeki **bildirimi**
değil. Bu turda düşen bildirim **467** (108 tablo + 397 hücre + 48 hiza +
22 sıkı girdi hücresi, ikinci geçişteki 48 üçüncü geçişte tamamlandı); öznitelik
sayısı ise yalnız **1170 → 1081** indi, çünkü hücrelerin çoğu hâlâ bir veri
bildirimi taşıyor ve öznitelik ayakta kalıyor. Tavan yine de yeni ölçüme
çivilendi.

**Kapı ÇİFT.** `source-hygiene.test.js` bölüm 9 sayıyı ve sınıfın varlığını
(`tr:hover` + `thead th` sticky + en az 31 kullanım) tutar;
`tests/e2e/panel-tablo.spec.js` gerçek tarayıcıda **fare satırın zeminini
gerçekten değiştiriyor mu** ve **hücre biçimi sınıftan mı geliyor** diye
ölçer. Node'da koşamaz: jsdom `:hover`ı hiç hesaplamaz.

Düşmeleri ölçüldü: satır vurgusu silinince tarayıcı halkası
`rgba(0, 0, 0, 0)` ile düşüyor, tek satır içi stil eklenince sayaç
`1082 > 1081` diyor.


## Bandın sağ ucu, karşılama kenarı, sütun kipi (2026-09-23)

Kullanıcı bildirimi: ▼ ve KA "çalışmıyor", KA'nın açtığı yapı kötü; karşılama
fotoğrafının çerçevesi var; bileşen pencereleri yeni modele göre olmamış.

**Hesap menüsünün yüzeyi `.ve-context-menu`de.** Dört sağ-tık menüsü yüzeyini
satır içi `cssText`ten alıyordu, sınıf yalnız yazı boyu taşıyordu; avatar
menüsü sınıfı devraldı ve saydam, kenarlıksız, `z-index`siz doğdu. İlk kapısı
`toBeVisible()` ölçüyordu — boyutu olan her kutu "görünür" sayılır. Kapı artık
OKUNMAYI ölçer (opak zemin, kenarlık, üç noktada en üstteki eleman menü).
Kapı: `ust-bant.spec.js` → *"OKUNUR bir yüzey"*.

**Sütun bir pencere değil — `--z-dock` (400).** Müfettiş sütunu `--z-modal`da
durunca bandın menüsü onun arkasında açılıyordu. Kapı: *"müfettişin ÜSTÜNDE"*.

**Tek ESC tek katman.** Menüyü kapatan tuş alttaki müfettişi de kapatıyordu
(yakalama evresindeki dinleyici olayı yaymaya bırakıyordu). Kapı: *"TEK ESC"*.

**Avatar açılışta tazelenir.** `veAvatarYaz` yalnız ad yazılınca çağrılıyordu;
kayıtlı ad yeniden açılışta bandda görünmüyordu. Kapı: *"AÇILIŞTA"*.

**Şerit düğmesi iki durumda da yerinde, yalnız ok döner.** Yalnız katlıyken
vardı; basınca kayboluyor, sağ küme 26 px kayıyor ve tıklanan noktaya avatar
oturuyordu — ikinci tık hesap menüsüne gidiyordu. Kapı: *"KAYMIYOR"*.

**Karşılamada tuval çukuru yok.** Çukur (Tur B) kaplamanın kabına uygulanınca
kaplama da çerçevelendi: foto 1902×1014, kart açılış kartından 9 px içeride —
iki kartın CSS'i birebir aynı, ÇİZİMİ değil (`left` kapsayana göre). Önceki
dersin tersi: bir kaba kural EKLEMEK de içindekileri etkiler.
Kapı: `karsilama-kenar.spec.js` (çizilmiş dikdörtgenler). (Çukur aynı gün
tuvalden de kalktı — "Kabuk TEK ÇİZGİ"; istisna kuralı onunla gitti.)

**Sütuna sığmayan pencere modal açılır** (`VE_SUTUNA_SIGMAYAN`, ölçülmüş,
yalnız aşağı iner). Tur C'nin kapısı yalnız BOŞ motor penceresini ölçmüştü.
**Taşma sıfır okunur demek değil**: ezilen pencere taşmaz. Kapı dört okunurluk
ölçüsü taşır — düzenlenen sütun ≥ %90, girdi ≥ 56 px, etiket kırpılmıyor
(çizilmiş metin kutusuyla; `scrollWidth` başlangıç yönüne taşmayı saymaz),
başlık büzülmüyor. Kapı: `mufettis-sigma.spec.js`.

**Tek sütuna geçişi panelin genişliği söyler, ekranın değil.** FEAD kabuğu
`@media (max-width:900px)` ile tek sütuna iniyordu; geniş ekranda 380 px'lik
sütunda sorgu tetiklenmedi, düzenlenen sütuna 42 px kaldı. `@container`
(`.ve-properties-content`). Kapı: aynı spec, *"düzenlenen sütun"*.

**Etiket kırpılmaz, satır kaydırır.** Sağa yaslı + `nowrap` + `overflow:hidden`
sığmayan etiketi SOLDAN kesiyordu, üç nokta çıkmıyordu: "Çalışma momenti —
Mean Load" → "Mean Load". Kapı: aynı spec, *"etiket kırpık"*.

**Hover rengini ailesinden alır.** Kapı: `source-hygiene.test.js` bölüm 13.


## Sütuna sığmayan tablo açılır pencerede (2026-09-23)

**Hüküm.** Müfettiş sütununda yatay kaydırma olmaz. Panel, veri tablosunu ve
ONUN düğmelerini bir BİRİM olarak işaretler (`data-ve-tablo` · `-baslik` ·
`-ozet`); `js/tablo-pencere.js` birimi çizimden sonra ÖLÇER: tablo kabına
sığmıyorsa yerinde bir özet kartı kalır ve "Tabloyu aç" birimi küçük bir
pencereye taşır. Sığıyorsa hiçbir şey değişmez.

**Gerekçe — ölçüldü.** Kullanıcı: *"geniş tablolar bileşen pencerelerine
sığmıyor. Bu pencereleri açılır ufak pencereler şeklinde yapmamız
gerekiyor."* Üç modülün bütün pencereleri, her sekme: FEAD çalışma çevrimi
785/359 px (AG00976 örneği; her kasnak tipi eklenince 1162/359), AP
motor-şanzıman eşleştirme 337/335 px. İkincisi bir tablo genişliği değil bir
düğmeydi — "Seç", panel kabuğunun `td{padding:5px 8px !important}` kuralıyla
34 px'lik sütunda tablonun 2,2 px dışına çıkıyordu; satır içi `padding` o
`!important`ı ezemediği için hücreye sınıf (`egm-sec`) verildi.

**Tablo TAŞINIR, kopyalanmaz.** Hücrelerin olay işleyicileri satır içi ve
düğüm kimliğini taşıyor; aynı DOM pencereye taşınınca aynı modeli yazar.
Pencere içeriğini kendisi üretmez — ikinci bir üretici panel ile pencerenin
sessizce ayrışması olurdu. Panel yeniden çizilince (satır ekle/sil) yeni birim
yeniden pencereye alınır; panel başka bir düğüme geçerse pencere kapanır.

**Karar bir `ResizeObserver`dan, BİR SONRAKİ KAREDE.** Geri çağrının içinde
katlamak gözlenen kabın boyunu değiştiriyor ve tarayıcı "ResizeObserver loop
completed with undelivered notifications" atıyor — uygulamanın hata
yakalayıcısı bunu kullanıcıya "Beklenmeyen hata" diye gösterdi (ölçüldü). İlk
karar eşzamanlı, sonrakiler bir kare ertelenir.

**Pencere ufak kalır.** Girdinin genişliği SABİT (84 px): `width:100%` bir
girdi tablonun doğal genişliğine kendi varsayılan boyunu katıyordu ve pencere
1517/1600 px açılıyordu; şimdi 807 px. Uzun sütun adı dengeli kırılır
(`text-wrap:balance`).

**TEK ESC = TEK KATMAN.** Dinleyici yakalama evresinde ve yayılmayı keser;
odaktaki hücre sökülmeden ÖNCE bırakılır (son değer `onchange` ile yazılır).

**Kapı.** `tests/unit/tablo-pencere.test.js` (karar · taşıma kimliği · yeniden
çizim · sahiplik · ESC · odak; beş mutasyonun beşi de yakalanıyor) +
`tests/e2e/tablo-pencere.spec.js` (`test:urun`; eski kodda üç halkanın üçü de
düşüyor) + `tests/e2e/mufettis-sigma.spec.js` (her sekmede yatay kaydırma).

## Palet: liste satırı, kutu değil (2026-09-23)

**Hüküm.** Palet öğesi dinlenmede zeminsiz ve kenarlıksızdır (kenarlık
SAYDAM — fareyle 1 px kayma olmasın); zemin, kenar ve gölge fare üstündeyken
gelir. Kategori başlığı İKONUN kenarından başlar (öğenin kenarlığı + iç payı
= 9 px).

**Gerekçe.** Kullanıcı (kenar çubuğunun ekran görüntüsüyle): *"Şuradaki
yapı biraz karışık. Düzen vs yok."* FEAD paletinde on dokuz dolu kutu üst
üste bir düğme yığını çiziyordu; başlık ne kutunun kenarına ne ikona
oturuyordu (kutu 72,5 · başlık 76 · ikon 82 px). Yazı etiketinin ve gruplama
çerçevesinin simgesi SVG içinde bir YAZI GLİFİYDİ ("T", "Grup") — çizgi
simgeye çevrildi.

**Kapı.** `kabuk-sutun.spec.js` → *"palet: kategori başlığı İKONUN
kenarında, öğe dinlenmede zeminsiz"*.
