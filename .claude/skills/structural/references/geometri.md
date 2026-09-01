# Yapısal Analiz — Geometri (STEP içe aktarma)

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

##### Geometri — STEP içe aktarma (`js/structural-model.js` + `cp-structural-viewer.js`)

Zincirin ilk bileşeni. FEAD'deki üç katmanın aynısı:

| Dosya | Katman | Kural |
|-------|--------|-------|
| `vendor/opencascade.*` | Hesap çekirdeği | **Dışarıdan geldi, birebir durur** (npm `opencascade.js@1.1.1`, LGPL-2.1). `fead-core.js` ile aynı kural |
| `js/structural-model.js` | Köprü (DOM'suz) | Ham occt çıktısı → MFSim modeli; yüz kimliği, sınır kutusu, hata çevirisi |
| `js/cp-structural-viewer.js` | Sunum (THREE) | Kanvas, kamera, yüz vurgusu. Kalıp `cp-mount-viewer.js` |
| `js/cp-structural.js` | Sunum (HTML) | Panel, dosya alma, künye. **Kendi geometrisini hesaplamaz** |
| `js/structural-materials.js` | Katalog (DOM'suz) | 112 malzeme / 16 aile + arama. **Sunum katmanında tek bir malzeme değeri yazılı değil** |

###### ÇEKİRDEK DEĞİŞTİ — okuyucu değil, boolean'lı OCCT (2026-08-25)

Kullanıcı bildirimi: *"bir braket parçasını eklediğim zaman '7 ayrı katı/kabuk'
olarak algılamışsın… onu tek bir katı olarak algıla, yani otomatik boolean
olsun. Yoksa ağ örme işleminde problem yaşıyorum."*

Eski çekirdek (`occt-import-js`) **salt okuyucuydu** — dışa verdiği üç fonksiyon
`ReadStepFile` / `ReadIgesFile` / `ReadBrepFile`, boolean YOK. Ve bunun ucuz bir
çaresi de yok: değen ama AYRI duran katıların yüzey üçgenlemesi arayüzde
uyuşmuyor (**ÖLÇÜLDÜ**, as1-tu-203: 18 katının her biri kendi içinde su
geçirmez, 32 çift sınır kutusunda örtüşüyor, ama 1 800 köşeden yalnız **204**'ü
ortak) — yani üçgenleri tek tampona yığmak bir tet ağ örücüsü için hâlâ kendi
kendini kesen girdi demek. Uyumlu arayüz ancak **B-Rep seviyesinde imprint &
merge** ile kurulur.

Bedeli ÖLÇÜLDÜ ve kullanıcı kabul etti:

| | gzip | gömülü (base64) | tek dosya |
|---|---:|---:|---:|
| `occt-import-js` (eski, salt okuyucu) | 3,09 MB | 3,96 MB | 12,6 MB |
| **`opencascade.js@1.1.1`** (boolean + STEP + mesh) | **13,1 MB** | **17,5 MB** | **26,8 MB** |
| 2.x modüler toolkit seti (aynı yetenek) | 15,5 MB | — | daha kötü |

2.x'in modüler derlemesi hem daha büyük hem de dinamik yan modüllerle geliyor
(tek blob gömme kalıbımıza uymaz); 1.1.1 **tek** glue + **tek** wasm.

**Boru hattı** (`_sgOcctPipeline`, tek fonksiyon — worker'a `toString()` ile
gidiyor, ikinci kopya YOK):

```
STEPControl_Reader → katıları topla
  → BRepAlgoAPI_Fuse (TEK BOP: arguments=ilk, tools=geri kalanı)
  → ShapeUpgrade_UnifySameDomain   (iç duvarlar + dikişler silinir)
  → BRepMesh_IncrementalMesh → yüz başına üçgen aralığı
```

**ÖLÇÜLDÜ (gerçek OCCT):**

| girdi | sonuç | union |
|---|---|---:|
| 3 değen kutu | 3 → **1 katı**, 6 yüz | 119 ms |
| plaka + 2 kulak (3 gövde) | 3 → **1 katı**, 10 yüz | 64 ms |
| **plaka + 2 kulak + 4 göbek (7 gövde)** | 7 → **1 katı**, 18 yüz (ham 30) | **135 ms** |
| as1-tu-203 montajı (18 katı, cıvatalar delikten geçiyor) | 18 → **1 katı**, 104 yüz | 15,5 s |

Yani çok gövdeli bir **PARÇADA** birleştirme fark edilmiyor; saniyeler ancak
gerçek bir **MONTAJDA** görülüyor. Hacim sapması as1-tu-203'te `%0,00002`.

**Hacim farkı bir HATA DEĞİL, BİLGİ.** Birleşim hacmi gövdelerin toplamından
küçükse gövdeler üst üste biniyordu (örnek brakette **%6,1** — göbekler
plakanın içine giriyor). Panel bunu ayrı bir cümleyle yazıyor; "gövdeler yalnız
değiyordu" ile "örtüşüyordu" birbirinden ayrı okunuyor.

**Boolean BAŞARISIZ olursa panel SESSİZ KALMIYOR:** "N ayrı katı — birleştirilemedi
(sebep); ağ örerken sorun çıkarabilir". "1 katı" deyip geçseydi kullanıcı bunu
ancak ağ örerken, anlaşılmaz bir hatayla öğrenirdi.

**İki sessiz kayıp — ikisi de kapatıldı:**

| Ne | Eski çekirdek | Yeni çekirdek |
|---|---|---|
| Parça adı / rengi | STEP ürün adından geliyordu | birleştirmeden sonra anlamsız → ad **dosya adından** |
| OCCT'nin kendi teşhisi | kendiliğinden `print`'e düşüyordu | **düşmüyor** (ölçüldü: bozuk dosyada 0 satır) → `PrintCheckLoad` açıkça çağrılıyor |

**Yeni bir aşama var:** `reader · parse · fuse · build`. `fuse` yalnız dosyada
birden çok katı varsa görülür ve worker'dan bildiriliyor — 15 saniye boyunca
"Geometri çözümleniyor" yazmak ilerleme göstergesinin var oluş sebebini yok
ederdi. `download` aşaması KALKTI (aşağıda).

**.wasm UYGULAMAYA GÖMÜLÜ — çevrimdışı çalışır.** `js/structural-occt-wasm.js`
(gzip+base64, **17,5 MB**; ham 62,8 MB) uygulamanın içinde taşınıyor ve **ilk**
içe aktarmada talep üzerine çalıştırılıyor (`type="text/x-mfsim-asset"` →
açılışta ne tarayıcı ne `MFSimLoader` dokunur; `js/mount-report-assets.js` ile
aynı kalıp). Üretim: `npm run build` (build:occt-wasm'ı kendisi koşturur).

**İLK İÇE AKTARMANIN BEDELİ ARTTI — ÖLÇÜLDÜ (gerçek tarayıcı):** 62,8 MB'lık
wasm'ın derlenmesi **7,8 s** (JS heap 226 MB, wasm heap 64 MB). Bu oturumda
**bir kez** ödeniyor; sonraki içe aktarmalar çekirdeği hazır buluyor. Worker'da
koştuğu için arayüz bu sırada da yaşıyor, ve ilerleme kartındaki geçen süre
sayacı akıyor.

**ÖLÇÜLDÜ (gerçek tarayıcı):**

| senaryo | okuyucu | içe aktarma sırasında ağ isteği |
|---|---|---|
| Tek dosya, ağ açık | `(gömülü)` ✓ | yalnız `blob:` worker URL'i |
| Tek dosya, **ağ kesik** | `(gömülü)` ✓ | **hiç yok** |
| **`file://`** (indirilmiş dosya) | `(gömülü)` ✓ | yalnız `blob:` |
| Modüler (geliştirme) | `(gömülü)` ✓ | kendi iki dosyası |

**gzip ŞART:** ham base64 62,8 MB'ı **83,8 MB**'a çıkarırdı; `gzip -9` ile
13,1 MB → base64 **17,5 MB**, yani beşte bir. Açma `DecompressionStream('gzip')`
ile ve **worker'da** — 17,5 MB'lık dizgiyi ana iş parçacığında çözmek saniyelik
bir donma demekti, yani kaçındığımız şeyin ta kendisi.

**`vendor/opencascade.wasm.gz` depoda KALIYOR** (ham 62,8 MB depoya konmaz) ve
CI onu `_site/vendor/`'a kopyalıyor — iki sebeple: gömülü varlığın kaynağı ve
LGPL-2.1'in *"kütüphane değiştirilebilir olmalı"* koşulunun karşılığı.

**AĞDAN İNDİRME YEDEĞİ KALKTI.** Eskiden gömülü varlık okunamazsa `vendor/`'dan
indirilirdi; tek gerekçesi `DecompressionStream` bilmeyen tarayıcıydı. Ama
vendor dosyası artık ZATEN gzip'li, yani o tarayıcıda yedek de açılamazdı —
var olmayan bir durumu kurtaran bir yol taşımanın karşılığı yoktu. Onunla
birlikte `download` aşaması, `Content-Length` tahmini ve aday-yol araması da
gitti. **Üretilen varlık artık git'e dahil değil:** `npm run build` her
seferinde vendor'dan üretiyor, yani "vendor güncellendi ama varlık üretilmedi"
diye bir bayat durum HİÇ oluşamıyor (eskiden bunu bayt-bayt bir test kolluyordu).

**Worker glue'yu da AĞSIZ alıyor:** vendor script etiketi `data-mfsim-occt-glue`
ile işaretli; tek dosya sürümünde içerik orada INLINE durduğu için köprü
`textContent`'ten okuyor (`type` javascript olmadığından tarayıcı onu
çalıştırmaz, `MFSimLoader` kopyasını çalıştırır → yer tutucunun metni yerinde
kalır). Emscripten'in kendi yol tahminine (`document.currentScript.src`) hiç
güvenilmiyor: tek dosyada o alan **yoktur**.

**EN KRİTİK ÖZELLİK — yüz kimliği ağ inceliğinden BAĞIMSIZ.** Sınır koşulu CAD
yüzüne bağlanacak, yakınsama çalışması ise ağı defalarca yenileyecek; kimlik
incelikle değişseydi her yenilemede bütün sınır koşulları düşerdi. **ÖLÇÜLDÜ**
(`as1-tu-203.stp`, üç incelik): `4688 → 4408 → 2456` üçgen, **160 yüz ve aynı
kimlikler**. Kimlik `m<mesh>/f<yüz>` (`veStrFaceKey`). İkinci değişmez: yüz
aralıkları üçgenleri **boşluksuz ve örtüşmesiz** böler — `first`/`last` anlamı
sessizce kayarsa (0↔1 tabanlı, kapsayan↔kapsamayan) geometri kusursuz görünür
ama yüz seçimi YANLIŞ üçgenleri toplar.

**Birim çevrimi occt'de doğru, regex'le OKUNMAZ.** Aynı küp mm/inch/metre ile
yazılmış üç dosyada da 1000,0000 mm çıkıyor — sessiz 25,4× hatası yok. STEP
başlığından birimi regex ile okuma **denendi ve bırakıldı**: `cube-m.step`
hiçbir `SI_UNIT(...METRE)` kalıbına uymuyor.

**Künye HAFİF** (`veStrGeomRecord`): ne üçgen ne STEP kaynağı girer. `node.data`
her `saveState()`'te derin kopyalanıyor ve alt-topolojiye gömülüyor. Üçgenler
oturumluk önbellekte (`window.veStrGeometryCache`, `_strForgetResults`'tan
temizleniyor — Takoz/FEAD tuzağının aynısı); zaten TÜRETİLMİŞ veri, yakınsama
çalışması için ZATEN farklı inceliklerde yeniden üretilecek.

###### STEP kaynağı node.data'da DURMAZ — ölçülmüş bir hatanın düzeltmesi

İlk sürüm kaynağı `node.data.geometry.source`'a yazıyordu. **ÖLÇÜLDÜ (gerçek
tarayıcı) ve bu bir hataydı — üstelik dosya yalnız 140 KB'ken:**

| | kaynak künyede | oturumluk depoda |
|---|---:|---:|
| `saveState()` süresi | 2,17 ms | **0,12 ms** |
| 20 adımlık undo yığını | 3,14 MB | **184 KB** |
| künye boyutu | 155,8 KB | **8,0 KB** |

Sebep: `saveState()` bütün `node.data`'yı `JSON.parse(JSON.stringify(...))` ile
kopyalıyor ve yığın **50 adım** tutuyor (`js/state.js` `MAX_UNDO_STEPS`). 3 MB'lık
bir kaynakta bu ~150 MB yığın demekti. **İkinci ve daha sessiz sorun:** otomatik
yedek `localStorage`'a yazılıyor (kota ~5-10 MB, `js/settings.js`) ve aynı
temizleyiciden geçiyor — çok MB'lık bir kaynak yedeği SESSİZCE bozardı, ki
`simResults`'ın oraya hiç yazılmama sebebi tam olarak budur.

Artık kaynak oturumluk depoda (`veStrSrcSet/Get/Clear`) ve **yalnız proje
DOSYAYA kaydedilirken** enjekte ediliyor (`veStrSrcAttach`, `js/toolbar.js`
`veSaveTopology`); yüklenirken geri toplanıyor (`veStrSrcHarvest`). Dosyaya
gzip+base64 gider — STEP metni ~4,6–5,3× sıkışıyor, base64'ten sonra net kazanç
**~4×** (ölçüldü). Sınır SIKIŞTIRILMIŞ boyuta konuyor
(`VE_STR_SRC_STORE_LIMIT` = 8 MB ≈ 30 MB ham STEP), çünkü dosyaya giden o.

**`veStrSrcAttach` KOPYALA-YAZ olmak ZORUNDA** ve ilk hâli değildi: yerinde
yazıyordu, ama `veSanitizeNodesSubtopology` (topology.js) hiçbir şey
değişmediyse AYNI diziyi döndürüyor ("gereksiz kopya üretme"). **ÖLÇÜLDÜ:**
kaynak canlı `tab.state`'e sızıp otomatik yedeğe de giriyordu — yedek 9,9 KB
yerine **46,4 KB**, yani düzeltmenin tamamı boşa çıkıyordu. Artık dokunulan her
düğüm kopyalanıyor; canlı duruma tek bir yazma bile yapılmıyor.

**ÖLÇÜLDÜ (gidiş-dönüş):** as1-tu-203 içe aktarılıp kaydedilince dosya
10,0 → 46,5 KB (+36,5 KB sıkıştırılmış kaynak), yedek 9,9 KB ve kaynaksız;
yüklenince kaynak depoya dönüyor ve geometri **4688 üçgen / 160 yüz** olarak
yeniden üretiliyor.

###### Kanvas rozeti — parça yüklü mü, kaç CAD yüzü var

Zincirin ilk halkası boşsa gerisi de boştur; ama Geometri kutusu kanvasta dolu
ile boş arasında hiç fark göstermiyordu. `veStrApplyBadge` (FEAD rozetiyle aynı
kalıp ve aynı gerekçe: stil ELEMANIN ÜSTÜNDE, çünkü `css/styles.css`'e dokunmak
Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor). Boşken **`STEP`**
(nötr), doluyken **`⬡160`** (amber) + künye başlığı. Boşken de rozet VAR:
"rozet yok" ile "parça yok" ayırt edilemezdi. Üç yerden tazeleniyor —
`ui-core.js` (düğüm kurulumu), `state.js` (geri yükleme), `topology.js` (sekme
yükleme) — FEAD rozetinin bağlı olduğu üç noktanın aynısı.

###### Panel parça YÜKLÜYKEN büyür — görüntüleyici boşluğu yutar

Kullanıcı bildirimi (2026-08-22): *"Daha geniş bir pencere olsun, genişlettikçe
de [görüntüleyicinin altındaki boşluk] kapansın."* **ÖLÇÜLDÜ (gerçek tarayıcı,
1600×1000, as1-tu-203):** pencere 980×900, sol ray 830.6 px, görüntüleyici
540 px → parçanın **altında 290.6 px boşluk**, ve pencere ekran genişliğinin
ancak **%61**'i. İçerik ayrıca kaydırıyordu (905 > 865).

Düzeltme **iki parçalı ve ikisi de gerekli**: pencere büyüyor
(`.ve-properties--strgeom`: `min(1560px, 96vw)` × `94vh`) **ve** görüntüleyici
artan boyu yutuyor (grid `align-items:stretch`, sağ sütun flex sütunu, kutu
`flex:1`). Yalnız birincisi yapılsaydı **boşluk BÜYÜRDÜ**.

| | önce | sonra |
|---|---:|---:|
| Pencere | 980 × 900 | **1536 × 940** |
| Görüntüleyici | 699 × 540 | **1202 × 831** (alan **2,65×**) |
| Altındaki boşluk | 290.6 px | **0** |
| İçerik kaydırıyor mu | evet (905 > 865) | **hayır** |

**Sınıf yalnız parça YÜKLÜYKEN veriliyor** (`node.data.geometry`, cp-core.js) —
motor panelindeki `--engine-empty` kuralının aynısı: boşken sağ sütun tek
satırlık bir yer tutucu, 94vh'lik pencere bomboş açılırdı.

Kutunun ölçüsü **satır içinde değil sınıfta** (`.ve-str-vwr-box`): satır içi bir
`height` özgüllükte sınıfı ezer ve boşluğu sessizce geri getirirdi. Sol ray
**sabit 300 px** — `--wideright` oranı (0.6fr) 1560 px'te rayı 396 px yapıyordu,
yani görüntüleyiciden çalıyordu. Ray kendi içinde kaydırır (sayfanın tamamı
kaydırılsaydı görüntüleyici de ekrandan çıkardı) ve **CAD yüz listesi artan boyu
yutar** (`max-height:180px` tavanı kalkar).

Kapı iki katmanlı: Node tarafı flex zincirinin **her halkasını** arıyor (üç
mutasyonla ölçüldü — `align-items:stretch` kaldırma, kutuya satır içi `height`
geri koyma, sınıfı koşulsuz verme), gerçek ölçüm ise E2E'de
(`structural-geometry.spec.js`): sol ray ile kutunun **aynı yerde bitmesi**,
kanvasın gerçekten o ölçüde kurulması (ResizeObserver), içeriğin kaydırmaması.

###### Üç varsayılan kullanıcı isteğiyle değişti (2026-08-22)

| Ne | Eski | Yeni |
|---|---|---|
| CAD yüz listesi + fare künyesi | panel açılınca **oradaydı** | **kapalı**, tek anahtarla açılır |
| Görüntü ağı inceliği | üç kademeli seçici (varsayılan Orta) | seçici **yok** — hep **İnce** (`VE_STR_MESH_LINEAR = 0.0005`) |
| "Kenarlar" aç/kapa kutusu | var | **yok** — kenarlar hep açık |

Ortak gerekçe: üçü de kullanıcının dokunmadığı, panelde yer kaplayan ayarlardı.
İncelik kademesini kaldırmanın bedeli ölçüldü ve küçük: as1-tu-203'te üçgen
`4 408 → 4 736`, kullanıcının braketinde `4 902 → 5 572` — ve **yüz kimlikleri
incelikten bağımsız** olduğu için sınır koşulları bundan hiç etkilenmiyor.

**Yüz inceleme kipi TEK ANAHTAR, İKİ YÜZ:** liste ile 3B künyesi aynı kipin iki
görünümü (`_veStrFaceMode`, oturumluk — seçimle aynı gerekçe: bir görünüm
tercihi undo yığınına binmemeli). Ayrı ayrı açılsalardı "liste açık ama parçada
bir şey görünmüyor" gibi yarım durumlar çıkardı. Kapanınca **ekranda hiçbir
işaret kalmaz** — vurgu, seçim ve künye üçü de silinir; yarısı duran bir kip
kapalı sayılmaz. Kanvasın alt şeridi de kipe bağlı: kapalıyken "parçanın üstüne
gel → CAD yüzü" yazmak yalan olurdu.

Kip kapalıyken görüntüleyici **raycast bile yapmıyor** (`onHover` erken çıkış) —
kazanç yalnız görsel değil, kare başına bir ışın taraması.

Liste DOM'da hep duruyor, yalnız gizli: 240 satırı her açılışta yeniden kurmak
(ve kaydırma konumunu kaybetmek) bir görünüm anahtarının bedeli olamaz, ayrıca
satır işaretleyicisi (`_strFaceMarkRow`) satırların DOM'da olmasına dayanıyor.
Anahtar paneli **yeniden çizmiyor**: `showNodeProperties` çağrılsaydı 3B kanvas
da yeniden kurulur, kamera ve sahne baştan yüklenirdi.

###### CAD yüz listesi — Sınır Koşullarının doğrudan hazırlığı

3B'de fareyle yüz bulmak keşif için iyi ama 160 yüzlü bir montajda "hangi yüzü
seçtim / hangileri var" sorusuna cevap vermiyor. Panelde (kullanıcı açınca)
kaydırılabilir liste var ve **liste ile 3B TEK seçimi paylaşıyor**: listeden tıkla → parçada
vurgulanır, parçada tıkla → listede işaretlenir ve görünüre kaydırılır, fareyle
gez → listede `hover`. Aynı satıra ikinci tık seçimi kaldırır (başka yolu yoktu).

**Gezinme vurgusu ile seçim AYRI katman** (`hl` / `sel`): tek katman olsaydı
fare parçadan çıkınca seçim de silinirdi — oysa seçim, sınır koşulunun
bağlanacağı şey.

**Seçim rengi tema jetonundan DEĞİL, sabit magenta.** Parça rengi STEP
dosyasından geliyor (occt `mesh.color`) ve her şey olabilir; **ÖLÇÜLDÜ:**
as1-tu-203'te plaka MAVİ ve seçim `--accent-primary` (mavi) iken vurgu
görünmüyordu. Liste satırı da aynı magentayı kullanıyor — iki farklı renk "iki
ayrı şey seçili" gibi okunurdu.

**Döndürme seçimi bozmuyor:** hareketsiz sol tık seçer, 4 px'i aşan hareket
döndürmedir. Eşik olmasaydı her döndürme sonunda seçim kayardı.

Seçim OTURUMLUK (`node.data`'ya yazılmıyor): bir vurgu tercihi her
`saveState()`'te undo yığınına binmemeli. Sınır Koşulları kendi kalıcı bağlarını
kuracak — kimlik zaten künyede duruyor.

**Ağ inceliği FEA ağı DEĞİL** — OCCT'nin RENDER tessellation'ı, yalnız
görüntülemek ve yüz aralıklarını kurmak için (min açı 2,81°, sıkmak BOZUYOR;
yukarıda ölçülü). Artık sabit (`VE_STR_MESH_LINEAR`), panelde seçici yok.

**OCCT'nin kendi teşhisi kullanıcıya ULAŞIYOR.** Kütüphane `"Line 2: Incorrect
syntax: unexpected QUID, expecting STEP"` gibi tam sebebi yazıyor ama varsayılanda
bu `console`'a düşüyor ve kullanıcı yalnız "dosya okunamadı" görüyordu;
`print`/`printErr` yakalanıp mesaja iliştiriliyor (`_sgWithDiag`, en fazla iki
satır).

###### Çözümleme WORKER'da — arayüz donmuyor

STEP çözümlemesi ana iş parçacığında koşarsa arayüz **kilitlenir**, ve donma
yalnız çirkin değil YANILTICI: kullanıcı programın çöktüğünü sanıp sekmeyi
kapatır. Ölçüt "hızlı mı" değil, **arayüzün yaşıyor olması** — dürüst ölçüsü
içe aktarma boyunca çizilen KARE SAYISI.

**ÖLÇÜLDÜ** (gerçek tarayıcı, `as1-tu-203.stp`, okuyucu önceden ısıtılmış ki
ölçüm indirmeyi değil çözümlemeyi görsün):

| ağ | | süre | çizilen kare | en uzun donma |
|---|---|---:|---:|---:|
| 20 296 üçgen | ana iş parçacığı | 469 ms | **1** | — |
| | worker | 803 ms | **50** | 22 ms |
| 45 240 üçgen | ana iş parçacığı | 1665 ms | **1** | — |
| | worker | 1497 ms | **91** | 19 ms |

45 bin üçgende eski yol 1,7 saniye boyunca **tek bir kare** çiziyor. Worker'da
süre de kısalıyor (sonuç kopyalanmıyor, transfer ediliyor).

Worker **Blob'dan** kuruluyor: glue metni + boru hattının kaynak metni
(`_sgOcctPipeline.toString()`) + `VE_STR_WORKER_BRIDGE` tek Blob'a yazılıp
`new Worker(blobURL)` ile açılıyor → hiçbir dosya yolu varsayımı yok, ve ana
iş parçacığı yedeği ile worker **aynı fonksiyonu** koşuyor (iki kopya tutulsaydı
ayrışma sessiz olurdu: worker yolu çalışırken yedek yol başka bir geometri
üretirdi). Boru hattı bu yüzden dışarıdan hiçbir şeye başvurmuyor — testi bunu
da kolluyor. Üçgenler **tipli dizi olarak
transfer** ediliyor (sıfır kopya). Worker açılamazsa (CSP, eski tarayıcı) ana
iş parçacığı yedeğine düşülüyor ve panel bunu **yazıyor** — "hiç açılmadı" ile
"donarak açıldı" arasında dağlar kadar fark var.

###### Yükleme göstergesi PARÇAYI anlatır, kütüphaneyi değil

Kartın **ana satırı dosyanın adıdır**; aşama alt satırda geçer. Bir ara sürümde
kart "STEP okuyucusu indiriliyor" diyordu ve kullanıcı haklı olarak itiraz etti:
okuyucunun hazırlanması bir **uygulama ayrıntısı**, kullanıcının beklediği şey
parçanın işlenmesi.

Aşamalar (`VE_STR_STAGES`): `reader` (yalnız ilk içe aktarmada, gömülü .wasm
açılıp derlenirken — **ağ yok**) · `parse` (geometri çözümleniyor) · `build`
(sahne kuruluyor). Dördüncü aşama `download` **normalde HİÇ GÖRÜLMEZ**; yalnız
gömülü varlık okunamazsa (`DecompressionStream` yok) yedek yolda çıkar ve tek
**belirli** (%) aşama odur.

Belirsiz aşamalara uydurma bir yüzde koymak — "%60" deyip 8 saniye beklemek —
yalan olurdu; orada akan çubuk + **geçen süre sayacı** var. Sayacın akması,
"program çalışıyor" diyen en ucuz ve en dürüst işaret; ve worker sayesinde
gerçekten akıyor.

**Yedek yolda `Content-Length` GÜVENİLMEZ — ölçüldü.** Hem `npx serve` hem
GitHub Pages `.wasm`'ı `content-encoding: br` + `transfer-encoding: chunked`
ile gönderiyor; o durumda başlık tarayıcıya **hiç gelmiyor**
(`headers.get('content-length')` → `null`). Toplam bu yüzden
`VE_STR_OCCT_WASM_BYTES` sabitinden geliyor (`fetch` gövdeyi saydam açtığı için
okunan baytlar açılmış baytlardır); sabit dosyayla kaymasın diye test **gerçek
dosya boyutuna kilitliyor**, ve tahmin tutmazsa (`loaded > total`) yüzde
gösterilmiyor — %140 yazan bir çubuk, çubuk olmamasından kötüdür.

**Fare vurgusu bir süs değil, zincirin KANITI:** vurgulanan şey üçgen değil CAD
YÜZÜ (`veStrFaceOfTriangle`). Sınır Koşulları bileşeni yüz seçerken AYNI
çeviriyi kullanacak.

**ÖLÇÜLDÜ (gerçek tarayıcı):** `rounded-cube.step` → 64 üçgen · 7 CAD yüzü ·
10×10×10 mm · 684 ms; fareyle `m0/f3` yüzü (2 üçgen) vurgulanıyor.

**ÖLÇÜLDÜ — GERÇEK PARÇA (kullanıcının braketi, AP242 / 3DEXPERIENCE, 378 KB).**
Fixture'lar AP203/214; **AP242 de sorunsuz okunuyor**:

| incelik | üçgen | CAD yüzü | kimlikler | süre |
|---|---:|---:|---|---:|
| Kaba (0,01) | 4 836 | 240 | — | 648 ms |
| Orta (0,002) | 4 902 | 240 | aynı | 505 ms |
| İnce (0,0005) | 5 572 | 240 | aynı | 485 ms |

7 katı · 131,00 × 150,82 × 131,76 mm · yüz aralıkları üçgenleri **tam bölüyor**.
Parça adı dosyada BOŞ — künye `Parça N` yedeğine düşüyor (normalize'da yazılı).
Kaynak sıkıştırma bu dosyada 6,6× (base64 sonrası net **4,9×**).
Dosya kullanıcının kendi parçası → **depoya eklenmedi**, yalnız ölçüm için
kullanıldı; fixture'lar occt-import-js'in kendi açık test dosyaları.

###### Bileşen bırakma alanı ölçüm kaplamasını devralır (`data-ve-dropzone`)

`js/measure-dropzone.js` dinleyicileri `document` üzerinde ve **bubble**
evresinde. Geometri'nin STEP bırakma alanı `stopPropagation()` çağırınca oradaki
`drop` işleyicisi **hiç çalışmıyor** → `veImpDropShow(false)` çağrılmıyor →
ölçüm kaplaması ekranda **ASILI kalıyor**, program kilitlenmiş görünüyor. İkinci
sorun daha sinsi: kullanıcı .step sürüklerken kaplama "ölçüm dosyasını bırakın"
diyerek **yanlış hedefi** gösteriyordu.

Çözüm tek yerde: `data-ve-dropzone` taşıyan bir alanın üstünde kaplama kendini
çeker ve sayacı sıfırlar (`veImpLocalZone` / `veImpYieldToLocal`); alandan
çıkılınca `dragenter` onu geri getirir — kendi kendini düzeltir. Ağ ve Sınır
Koşulları bileşenleri de kendi alanlarını böyle kuracak.

**ÖLÇÜLDÜ (gerçek tarayıcı, öncesi/sonrası):** alan üzerindeyken kaplama açık
`ESKİ true → YENİ false`; **bıraktıktan sonra** kaplama açık
`ESKİ true → YENİ false`. Genel davranış korunuyor (alan dışında kaplama yine
açılıyor). `measure-dropzone.js` ORTAK dosya → `npm run sync:viewer` yapıldı.

