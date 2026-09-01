# Ortak yüzey kararları

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

### Topoloji sınır çerçevesi ADI da sarar (`veNodeLabelOverflow`)

Kesikli çerçeve (`veBoundaryBox` → `veUpdateBoundary`) yalnız KUTULARI sarıyordu;
ada ait tek pay altta sabit `VE_NODE_LABEL_H` (20 px) idi. Oysa ad dört kenara
da konabiliyor (sağ tık → Etiket Konumu · `node.data.labelPos` · css
`.lbl-top/.lbl-left/.lbl-right`) ve yana alındığında kutunun dışına ADIN
GENİŞLİĞİ kadar taşıyor. Kullanıcı bildirimi (2026-08-24, Yapısal Analiz ·
Geometri): *"ismini sola çektiğim zaman topoloji çizgisinin dışına taşmış."*

Aynı sessizlik **yatayda da** vardı ve dört modülün hepsini ilgilendiriyor: alt
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

