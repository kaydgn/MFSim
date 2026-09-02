# FEAD — çevrimdışı HTML raporlar (ayrıntılı + özet)

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

#### Çevrimdışı HTML rapor (`js/cp-fead-report.js`)

Tedarikçi (Gates) "Accessory Belt Drive System" çıktısının 11 sayfası, Takoz
raporuyla **AYNI görsel dilde** tek dosyalık çevrimdışı bir HTML'e dökülüyor.
Kalıp birebir Takoz'unki: sabit **teori şablonu** (§1–7, 9, 10, Ek A) +
çözümden üretilen **§8** + **Uygunluk hükmü**.

| Dosya | Sorumluluk |
|-------|-----------|
| `tools/report-assets/fead-theory-source.html` | Teori metni (elle yazılır) — tokenlar ZATEN içinde |
| `tools/report-assets/build-fead-report-template.js` | Doğrula → KaTeX önyükleyiciyi ekle → base64 (`npm run build:fead-report`) |
| `js/fead-report-template.js` | Üretilen şablon (`window.FEAD_REPORT_TEMPLATE_B64`) — **elle düzenlenmez** |
| `js/cp-fead-report.js` | Panel · giriş · antet · §8 (18 alt bölüm) · Uygunluk · 6 SVG şekli |

Takoz şablonundan **tek yapısal farkı**: orada derleyici harici bir referans
belgeyi regex ameliyatıyla token'lıyordu; burada kaynak zaten token'lı yazıldı,
derleyici yalnız **doğruluyor**. Regex ameliyatı, kaynak metin bir kelime
değiştiğinde sessizce yanlış yere token koyabilecek tek yerdi.

**KaTeX ve fontlar Takoz raporuyla ORTAK** (`window.MNT_REPORT_ASSETS`, ~1 MB).
İkinci bir kopyanın karşılığı yok; `js/results.js` de aynısını yapıyor. Varlık
yükleyicideki **sayaç döngüden ÖNCE kurulur** — Takoz'daki tuzağın aynısı:
artışı döngü içine koymak tek dosya build'inde her oturumun ilk rapor denemesini
kırıyor, `index.html`'de görünmüyor.

Ad öneki **`_fr…`** (`cp-mount-report.js` `_r…`, `cp-fead.js` `_fead…`
kullanıyor) — aynı adı iki dosyada üst-seviye bildirmek `source-hygiene`
kapısına takılır. `getFeadReportPropertiesHTML` bu yüzden `cp-fead.js`'ten
**silinip** buraya taşındı.

##### Şeklin geometrisi de ÇEKİRDEKTEN gelir (Şekil 1)

§2'deki kavramsal FEAD şeması elle yazılmış sabit bir SVG'ydi ve **beş yol
ucunun beşi de** kasnak çemberinin dışındaydı (ölçüldü): krankın "sarım yayı"
r=70 ile (560,60)→(560,200) arasına çizildiği için örtük merkezi (630,130)
yerine **(560,130)**'a düşüyor, yani kasnağın MERKEZİNDEN geçiyordu; aksesuar
yayının kirişi 2r'den uzun olduğu için SVG yarıçapı 62 → 64.2'ye büyütüp yayı
kasnaktan **96 px** uzağa oturtuyordu — **kayış o kasnağa hiç değmiyordu.** Alt
künye satırı da 820'lik viewBox'ı 32 px aşıp kırpılıyordu (rapor CSS'i SVG
yazılarını IBM Plex Mono'ya sabitliyor: karakter 0.6 em, proporsiyonel değil).

Şekil artık `FEADCore.solveGeometry`'nin teğet noktaları, sarım açıları ve
dönüş yönleriyle çiziliyor. Kazanç yalnız "doğru duruyor" değil: çekirdek
**kapalı çevrim değişmezini (Σ işaretli sarım = 360°) ve kayışın bir kasnağın
içinden geçmediğini doğruluyor** — yani şekil kurulduğu anda geçerli, gözle
denetlenmesi gerekmiyor. Yerleşim doğrulama takımındaki AG00686 ile aynı
ailedendir (iki kaburgalı büyük kasnak, ana eksenin karşı taraflarında iki sırt
kasnağı); sarımlar 216/32/200/23°, referansın 208/27/201/22°'sine komşu.
Sweep bayrağı Kayış Yolu kartıyla **aynı kuralı** kullanır (`d > 0 → sweep 0`);
iki çizim aynı konvansiyonu paylaşmazsa biri sessizce aynalanır.

İşaretler de ölçülerek yerleşti: sarım açısı önce kasnağın **dışına** halka
olarak çizilmişti, 216°'lik o yay ikinci bir kayış gibi okunuyor ve krank
etiketinin üstünden geçiyordu — klasik teknik resim gösterimine (merkezden iki
teğete yarıçap + içeride küçük yay) alındı. Etiketler `_frTxtW` ile ölçülüp
çakışmayana kadar itiliyor; elle bir koordinat daha yazmak düzeltilen hatanın
aynısı olurdu.

Kapı dört mutasyonla ölçüldü (sweep sabitleme, sarım yarıçapını %5 şişirme,
teğet ucu yerine kasnak merkezine gitme, künyeyi taşırma) — dördü de kırmızı.

##### Kanvastan gelen şekil raporda GÖRÜNMEZDİ — palet jetonları

§8.5'teki şekli MFSim'in kendi çizicisi (`veFeadLayoutSVG`) üretiyor; tek-çizici
kuralı bunu gerektiriyor. Ama o çizici **uygulamanın** palet değişkenlerini
kullanıyor (`--accent-warning`, `--text-muted`, `--bg-input`, … 11 jeton) ve
raporun paleti bambaşka (`--ink`, `--prusya`, `--line`…). Tanımsız bir `var()`
"invalid at computed-value time"dır; kalıtılan bir özellik olan `stroke` için
sonuç **`none`** demektir.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC raporu):** kayış, altı kasnak çemberi, kaburga
dişleri, sarım yayları, gergi kolu ve pivot **tamamen görünmezdi**; ayakta kalan
tek şey etiketler ve merkez noktalarıydı (onlar `fill` kullanıyor). Şeklin
künyesi olmayan bir çizimi anlatıyordu. Sayfa hatası yok, konsol temiz, sessiz.

Şablon CSS'i jetonları `.appfig` altında raporun baskı paletine bağlıyor
(`tools/report-assets/fead-theory-source.html`), `_frLayoutFigure` de `<figure>`
elemanına o sınıfı koyuyor. Kapı, şeklin kullandığı **her** `var(--…)` jetonunun
şablonda tanımlı olmasını arıyor — sınıf düşse de bir jeton eksik kalsa da
kırmızı (iki mutasyonla ölçüldü).

##### Tasarım gerginliğinin kaynağı — §8.6/§8.7/§8.9 (mühendis sorusu, 2026-08-24)

Kullanıcı raporu bir mühendisle inceledi ve üç soru geldi: *"Take-up oranı nasıl
hesaplanıyor, bir girdi giriyor muyuz? φ ve β nasıl elde ediliyor?"* — üçü de tek
şeyi sorguluyordu: **Design Tension nereden geliyor.** Üretildi ve **üç gerçek
kusur** çıktı.

**1 · §8.7'nin TEK denklemi yanlış çevrim çarpanıyla basılıyordu.** Metin

```
T = M/(dL/dθ) · (180/π) · (1/1000) = 650 N          ← ESKİ
```

diyordu; elle çalışıldığında **2,13 N** veriyor (ölçüldü). Basılan 650 N doğruydu
— ama ayrı bir alandan geliyordu, yani aritmetiği denetleyen okuyucu **raporun
yanlış olduğu** sonucuna varıyordu. Mühendisin sorusunun sebebi büyük olasılıkla
tam olarak buydu. Doğru çarpan `× 1000 × (π/180)`; artık **ara değer de**
basılıyor (m/rad cinsinden take-up), yani bölme elle tekrarlanabiliyor.

**2 · §8.9 ORTALAMA eğime "take-up oranı" diyordu.** Eğrinin uçtan uca ortalama
eğimi **0,4481 mm/°**, çalışma noktasındaki gerçek türev **0,5984 mm/°** —
**%25,1 fark** (ölçüldü, BMC). §8.7 ve tedarikçi raporunun *"Belt Take-up /
Tensioner Arm Ratio"* satırı **anlık** türevdir. Aynı ad iki farklı sayıyı
taşıyordu. §8.9 artık çalışma noktasındaki **teğeti çiziyor** (eğimi take-up
oranının kendisi) ve ikisini ayrı ayrı adlandırıyor.

**3 · Design Tension'ın GİRDİ olduğu hiçbir yerde yazmıyordu** — ve sonradan
görüldü ki **girdi olmaması gerekiyordu.** Bkz. bir sonraki bölüm.

**"Kayma emniyeti değişmez" iddiası ÖLÇÜLDÜ ve fazla kesinmiş** (800 d/d,
650→400 N): yük **çeken** kasnaklarda SF değişiyor (Sürücü 5,348 → 4,024,
Alternatör 6,667 → 5,235), yük **çekmeyenlerde** (avara, gergi) gerginlik oranı
tam 1 olduğu için SF hiç değişmiyor — ve **hükmü veren en düşük SF tam orada:
%0,0**. Doğrusu: *tablo kısmen gösterir, hüküm göstermeyebilir.* Rapor metni ve
bu tablo ona göre düzeltildi.

##### φ ve β artık ÇİZİLİYOR — çizim sembol taşır, sayı denklemde durur

İki yeni şekil, çözülmüş geometriden üretiliyor (Şekil 1'deki kural: elle
yerleştirilmiş koordinat yok):

| Şekil | Nerede | Ne gösteriyor |
|---|---|---|
| **φ kuruluşu** | §8.6 | teğet noktaları, +X referansı, θ_giriş/θ_çıkış, işaretli sarım yayı; altında (3.3)'ün bu kasnak için KaTeX aritmetiği |
| **β / take-up** | §8.7 | pivot, kol `a`, birim açıklık doğrultuları, bileşke `f`, hareket yönü `t`, β yayı ve φ yayı |

§8.6'ya ayrıca **kasnak başına θ_giriş/θ_çıkış/d/φ tablosu** girdi: her satırın
φ'si **o satırdaki iki θ'dan** yeniden hesaplanıyor, yani tablo kendi
aritmetiğini taşıyor ve `Σ d·φ = 360°` orada kapanıyor.

**Sayı çizime YAZILMAZ.** Değerleri yayların yanına koymak ölçüldü: etiket
kutuları yay işaretlerinin, yarıçap doğrularının ve kayışın üstüne biniyordu.
Çizimde yalnız semboller (`θ_giriş`, `φ`, `β`, `a`, `f`, `t`, `P_giriş`) duruyor;
sayılar hemen altındaki **KaTeX denklemlerinde** ve tablolarda. Aynı gerekçeyle
şekil künyelerindeki üç satırlık sayısal türetme de kaldırılıp denklem bloğuna
taşındı — SVG metni KaTeX ile dizilemez ve belgenin tipografisinden kopuk
görünüyordu (kullanıcı bildirimi: *"çok yazısal görünüyor, ana görünüm temasını
bozmayalım"*).

**Şeklin YANINDA açıklama sütunu var** (`_frLegend`). Kullanıcı bildirimi
(2026-08-24): *"'fi' ne demek falan çok belli olmamış."* Doğruydu — sayıları
çizimden çıkarınca sembolün NE OLDUĞU yalnız künye metninde kalıyordu, oysa
okuyucu şekle bakarken orada değil. Sol şerit her sembolü tanımlıyor
(`φ — SARIM AÇISI`, `f — bileşke`, `a — gergi kol boyu`, …); SVG metni satır
kaydırmadığı için sarma elle yapılıyor (`_frWrap`).

**Kadraj YATAY, çünkü şekiller fazla uzundu.** `svg{width:100%}` olduğu için
ekrandaki yükseklik = genişlik × (H/W); iki yeni şekil **534 ve 452 px** iken
raporun diğer sekizi 209–346 px bandındaydı (ölçüldü). viewBox yataylaşınca
hem **297 / 316 px**'e indiler hem de açığa çıkan sol şerit açıklamaya yer
açtı — aynı değişiklik iki sorunu birden çözüyor. Kapı oranı `H/W < 0,45`
olarak kilitliyor.

**Etiketler ÇAKIŞMA ÖNLEYİCİ bir yerleştiriciden geçiyor** (`_frLabels`): istenen
yönde adım adım ilerleyip hem çerçeveden, hem önceki etiketlerden, hem de
**engel olarak kaydedilen çizim öğelerinden** (kasnak çemberi, yarıçap doğruları,
kol, vektör gövdeleri) çıkan ilk yeri seçer. Yalnız radyal ilerleyen ilk sürümde
`u_çıkış` etiketi çerçevenin dışına itilip **kayboluyordu** (ölçüldü); arama
yarıçap-baskın, yön ikincil oldu. Sıra = öncelik: şeklin konusu olan β ve φ önce
yerleşir. `θ_giriş`/`θ_çıkış` açıortayda değil
**kendi yarıçap doğrultularında** duruyor: iki teğet noktası çevrenin karşıt
yerlerinde olduğu için etiketler yapısal olarak ayrılır — açıortayda ikisi de
aynı dörtte bire düşüp sıkışıyordu (kadraj küçüldükten sonra iç bölge dar).

**Denklem numaraları sayaçtan** (`_frEq`, tablo/şekil sayaçlarıyla aynı kalıp) ve
metindeki atıflar **aynı kaynaktan** (`_frEqRef`) basılıyor — elle "(8.4)" yazmak,
araya bir denklem girdiğinde gövde metnini sessizce yanlış denkleme yollardı.

**Teori tarafı:** §4.2 artık (4.3)'ü **türetiyor** (merkezin hızı `a·t`, yalnız
komşu iki açıklığın değişmesi, `|f| = 2sin(φ/2)`, `f` ile `t` arasındaki açının
`90°−β` olması); §5.1'e **ankraj paragrafı** eklendi (bağıntılar gerginliğin nasıl
DEĞİŞTİĞİNİ verir, mutlak SEVİYESİNİ tasarım gerginliği verir); §10'a `f`, `t`,
`dL/dθ`, `T_tasarım` sembolleri girdi. Şablon CSS'ine `h4` kuralı eklendi (rapor
üreteci artık alt başlık kullanıyor; satır içi stil bırakmak temayı bozardı).

**Kapı dokuz mutasyonla ölçüldü, dokuzu da kırmızı:** çevrim çarpanını terse
yazma, `takeupRad` hesabını ters çevirme, sarım yayının sweep bayrağını çevirme,
yay süpürmesini kısa yola normalize etme, etiket çakışma denetimini kaldırma,
take-up'ı envanterde "girdi" diye işaretleme, tasarım gerginliği
karşılaştırmasını kaldırma, teoriden türetmeyi silme, §8.9'da ortalama eğime
"take-up oranı" deme. Dördüncüsü ilk turda **YEŞİL kaldı** — kayış yayını
denetleyen test φ'yi *gösteren* işaret yayına bakmıyordu; o kapı da eklendi.

##### İKİ RAPOR TÜRÜ — 'Rapor' bileşeninden seçilir (2026-08-26)

Kullanıcı isteği: *"Bu raporun kalmasını istiyorum, yanına Gates raporunun
aynısı olacak şekilde özet bir rapor daha çıkar. Rapor bileşeninde 'Detaylı
Rapor' ve 'Özet Rapor' seçenekleri olsun."*

| Tür | Dosya | Ne anlatır | Boy |
|-----|-------|-----------|-----|
| `detailed` (varsayılan) | `js/cp-fead-report.js` | Teori §1–10 + Ek A + §8 çözümü | ~944 KB |
| `summary` | `js/cp-fead-summary.js` | Tedarikçi çıktısının **beş sonuç sayfası** | ~340 KB |

Seçim `node.data.reportKind`'da; **varsayılan `detailed`** → alanı olmayan her
eski proje bugüne kadarki davranışını birebir korur (testli). Panel iki KART
çiziyor (iki durumlu anahtar değil): hangi belgenin ne olduğu seçim yapılmadan
ÖNCE okunabilsin.

Özet rapor **KaTeX taşımıyor** — teori yok, denklem yok. Boy farkının tamamı bu.
Fontlar Takoz/ayrıntılı raporla ORTAK (`window.MNT_REPORT_ASSETS.fontsCss`).

###### DÜZEN TEDARİKÇİ SAYFASININ KENDİSİ — kendi yorumumuz değil (2026-08-26)

İlk sürüm A4 **yatay**, kendi başlıklarıyla ("Sonuç Özeti" kartları) ve şemayı
üç sayfaya birden koyan bir belgeydi. Kullanıcı reddetti: *"Her yere bu şekli
koymuşsun. Gerek yok… Gates raporunun aynısı olsun. Gates raporunda sayfalarda
ne varsa aynısı olsun."*

PDF `pymupdf` ile görüntüye çevrilip yerleşim **okundu** (metin koordinatları
döndürülmüş çıktığı için tahminle kurulamıyordu). Gerçek yapı:

| | Gates | ilk sürümümüz |
|---|---|---|
| Sayfa | A4 **dikey**, iki sütun, kırmızı ayraçlar | A4 yatay, tek akış |
| Antet | marka + firma + sistem adı ÜSTTE | teknik resim antedi ALTTA |
| Şema | 1, 2 ve 5. sayfalarda | **üç sayfada da, büyük** |
| Sayfa 1 | kayış/gergi künyesi · şema · **gerginlik kontrol grafiği** · B10 · **doğal frekans haritası** · tepe yük · eksenel kaçıklık | kendi uydurduğumuz özet kartları |
| Sayfa 3 | gergi tablosu + **küçük** take-up grafiği | tablo + büyük kendi grafiğimiz |

Belge yeniden kuruldu. Grafikler AYRINTILI RAPORDAN geliyor — ikinci bir çizici
yok: `veFeadFigureRaw(fn, R, W, H)` aynı figür işlevini **küçük ve numarasız**
koşturuyor (`_FR_W`/`_FR_H` zaten `_frChart`'ın yedeği, `_FR_RAW` figür
sarmalını atlıyor; şekil sayaçlarına dokunmuyor).

**ÜÇ SESSİZ KUSUR — üçü de bu turda çıktı, üçü de testli:**

| Kusur | Belirti | Kök neden |
|---|---|---|
| Gerginlik grafiğinin ekseni | y ekseni **8411 N**'e uzuyor, altı çalışma konumu x ekseninin dibinde tek çizgiye yapışıyordu | Ölçek tabanına **Load** katılıyordu. Load bir MEKANİK DURDURUCU: orada take-up tekilleşir ve gerginlik 5257 N (çalışma 544 N). Fonksiyonun kendi yorumu "çalışma konumlarına göre sınırlanır" diyordu — tersi oluyordu. **Bu kusur AYRINTILI RAPORDA da vardı**; düzeltme ikisini birden düzeltiyor (yeni tavan 1170 N, Gates 900) |
| Take-up çağrısı bölümü sürüklüyordu | Özet sayfa 3'e §8.9'un başlığı ve iki paragrafı düşüyordu | `_frTakeupFigure` bir **bölüm** üreticisi, figür değil. Çizim `_frTakeupChart` olarak ayrıldı; bölüm de onu çağırıyor |
| Gergi kasnağının X/Y'si `—` | Yerleşim tablosunda konum "bilinmiyor" gibi okunuyordu | Konum bir GİRDİ değil, kol açısından türeyen çalışma merkezi. Çalışma (Ortalama) konumundan basılıyor ve † ile türev olduğu işaretli (−161,97 / 91,27 ↔ Gates −161,97 / 91,29) |

Boşalan yere gerçek tablo kondu (kaburga yorulma dağılımı — kalibre bir sonuç),
sayfa 3'ün take-up grafiğinin yanına açıklık frekansları.

**ÖLÇÜ KALDIRACI:** şekiller sütuna `width:100%` ile oturuyor, yazı boyutu ise
viewBox biriminde sabit. Küçük viewBox'ta etiketler çizimin üstüne biniyordu;
viewBox BÜYÜTÜLÜNCE yazı göreli küçülüyor ve sığıyor. Kalan taşma (uzun kasnak
adları şema çerçevesini aşıyor) `veFeadLayoutSVG`'nin sınırlara etiket
genişliğini katmamasından — Şekil 1'de düzeltilen sınıfın aynısı, kanvas
çizicisinde duruyor.

###### Sayfa eşlemesi — Gates AG00976 (05.06.2025, v13.02)

| Özet sayfa | Gates sayfa | İçerik |
|---|---|---|
| 1 Sonuç Özeti | 1/12 | kayış+gergi künyesi · şema · duty+B10 · **tepe yük** |
| 2 Geometrik Analiz 1/2 | 2/12 | yerleşim verisi · kayış/gergi girdisi · span/sarım/oran |
| 3 Geometrik Analiz 2/2 | 3/12 | gergi geometrisi (6 konum × 10 satır) · take-up · boy eğrisi |
| 4 Kayma ve Gerginlik | 6/12 | kayma duyarlılığı (en kritik kombinasyon) · emniyet matrisi + grafiği |
| 5 Hubload Analizi | 8/12 | yük koşulları · ortalama gerginlik/hubload/yön matrisleri |

**ÖLÇÜLDÜ — tedarikçi sayfası geri üretiliyor** (AG00976 örneği, PDF'in kendi
sayıları): açıklık `148,0 · 141,4 · 150,8 · 272,7 · 194,4 · 141,3`, sarım
`156,2 · 52,8 · 198,4 · 64,3 · 157,1 · 34,6`, hız oranı ve gereken kayış boyu
altı konumda **birebir**; take-up `0,708 mm/°`; ortalama gerginlik/hubload
880 d/d'de `1381/1380/1023/1022/545/544` ve `1892/1228/2373/1089/1539/324`
(≤2 N). Tek sapma Load sütununda (%0,66) — orası belgeli tekillik.

###### TEPE YÜK TABLOSU BASILIR AMA "KALİBRE DEĞİL" DAMGASIYLA

Gates bu tabloyu *"en kritik ivme + yük kombinasyonu"* **arayarak** kuruyor.
Çekirdeğin `peakEstimate`'i yarı-statik ve kendi notu şunu diyor: *"gergi kolu
dinamigi dahil DEGIL"*. Kombinasyon taraması (aksesuarlar %100/%10, ivme
±1100 d/d/s) köprü katmanında yapıldı — çekirdeğe DOKUNULMADAN — ve
**ÖLÇÜLDÜ: yakınsamıyor**:

| | MFSim | Gates | fark |
|---|---:|---:|---:|
| yük taşıyanlar | 1471 · 1464 · 1058 · 1051 | 1585 · 1582 · 1177 · 1174 | −%7,2 … −%10,5 |
| alternatör | 671 | 546 | **+%22,8** |
| gergi | 544 | 544 | %0,0 |

Tablo yine basılıyor — düzen tedarikçi çıktısıyla aynı kalsın — ama başlığında
`KALİBRE DEĞİL` damgası, altında ölçülen sapma bandı ve *"yatak/braket
seçiminde tek başına kullanılmamalıdır"* uyarısı var. Sayı gizlenmiyor, çünkü
bu modülün kuralı geçerlilik sınırını sonucun **içinde** taşımak.

**SESSİZ KIRILMA — kW anahtarı.** İlk sürümde tepe gerginlik ORTALAMANIN
ALTINA düşüyordu (FAN 634 N, oysa ortalaması 1381 N): `R.duty` zaten çekirdek
biçiminde (kW kasnak ADIYLA anahtarlı) ama kod onu ikinci kez
`veFeadDutyToCore`'dan geçiriyordu; anahtarlar tutmayınca **bütün aksesuarlar
0 kW** ile koşuyordu. Tablo yine üretiliyor, yalnız sayı küçülüyor — modülün
en pahalı sınıfının aynısı. Kapı artık *"tepe ≥ ortalama"* değişmezini tutuyor.

###### Uydurulmayan iki şey

`Belt Slip Sensitivity`'nin ters çözümü (gereken gerginlik/sarım artışı) ve
`Permissible Axial Offset` yok. İkincisi için çekirdekte `alignmentAllowance`
VAR ama düz kasnakların açısal kaçıklığını (ψ) GİRDİ olarak istiyor ve MFSim
o alanı sormuyor; ψ=0 ile basılan sayı iyimser bir yalan olurdu.

###### Sayı biçimi ve şekil ORTAK — ikinci kopya yok

`_frF`/`_frFs`/`_frPct`/`_frEsc`/`_frNum` ve kayma hükmü (`_frSlipStats`)
ayrıntılı rapordan çağrılıyor; iki belge aynı sayıyı farklı basamazdı.
Yerleşim şeması yine `veFeadLayoutSVG` — ve `class="appfig"` ŞART: o çizici
uygulamanın palet jetonlarını kullanıyor, tanımsız `var()` kalıtılan `stroke`
için `none` demek (ayrıntılı raporda ölçüldü: kayış ve kasnaklar görünmez
kalmıştı). Kapı, şeklin kullandığı her jetonun belgenin CSS'inde tanımlı
olmasını arıyor.

Kapı altı mutasyonla ölçüldü, altısı da kırmızı: tepe kW anahtarını geri
bozma, `.appfig` sınıfını düşürme, varsayılan türü `summary` yapma, açıklık
boyunu %1 kaydırma, CSS'ten `--accent-warning` silme, sapma bandını yutma.

###### KOZMETİK TUR — okunmazlığın kökü TİPOGRAFİ DEĞİL YERLEŞİMDİ (2026-08-26)

Kullanıcı bildirimi: *"Yine her yere bu diyagramları koymuşsun… Zaten tablolar
diyagramlar taşmış, yazılar komik bir şekilde kötü duruyor falan. Gates
raporuna tamamen bağımlı kalmana gerek yok. Güzel bir kozmetik düzenleme ile
raporu gerçekten okunabilir bir hale getirmeni istiyorum."*

**ÖLÇÜLDÜ (gerçek tarayıcı, önce ↔ sonra):**

| | önce | sonra |
|---|---:|---:|
| yatay taşan öge | **41** | **0** |
| ayrı punto sayısı | **17** | 6 (belge) + şeklin kendi 4'ü |
| 8,5 px altındaki öge | **651** | **11** (yalnız pusula ve künye) |
| viewBox dışına taşan SVG yazısı | **8** | **0** |
| sentetik kalın (gömülü olmayan ağırlık) | **2 çift · 36 öge** | **0** |
| etiket ↔ kayış yolu çakışması (şema) | **4** | **0** |
| sayfa doluluk oranı | %48–116 | **%92–97** |

**KÖK NEDEN TİPOGRAFİ DEĞİLDİ.** Punto 8,2 px'e o yüzden düşürülmüştü:
matris sütun başlığı kasnak ADIYDI ve *"Otomatik Gergi (E9843)"* tek başına
22 karakter — altı kasnakta satır A4'e sığmıyor, sığdırmanın tek yolu puntoyu
kırmaktı. Kısa kod (`_fsrCodes` → `FAN · AVA1 · KK · AVA2 · ALT · TEN`) o
baskıyı kaldırdı, punto serbest kaldı. Tedarikçi çıktısının FAN/IDR/A_C/ALT/TEN
kullanmasının sebebi de bu. **Kısaltma ancak karşılığı AYNI SAYFADA duruyorsa
okunur** → kodu kullanan her sayfa `_fsrCodeLegend` basıyor.

**DİYAGRAM İKİ KEZ DEĞİL, BİR KEZ.** Kullanıcı aynı itirazı iki kez yaptı.
Belgede **tek yerleşim şeması** (sayfa 1) ve **tek grafik** (sayfa 3) var.
Doğal frekans haritası, take-up eğrisi, kayma çubuk grafiği ve yorulma çubuk
grafiği KALKTI — dördü de aynı sayfadaki bir tablo satırını ikinci kez
anlatıyordu.

**AMA "BİR KEZ" DEMEK "HİÇ" DEMEK DE DEĞİL — ve dördü fazla silinmişti.**
Üçüncü bildirim şuydu: *"Rapordaki tüm şekiller yok ama? Gates raporundaki tüm
şekilleri, diyagramları çıkar bakalım."* Çıkarıldı ve **ölçüm kullanıcıyı
doğruladı**: tedarikçi çıktısının beş şekil türünden **üçü** belgede yoktu.

| # | Gates şekli | Gates sayfası | Kozmetik turundan sonra | Bugün |
|---|-------------|---------------|-------------------------|-------|
| 1 | Yerleşim şeması + pusula | 1 · 2 · 5 | ✓ s1 | ✓ s1 |
| 2 | Belt Tension Control | 1 · 2 | ✓ s3 | ✓ s3 |
| 3 | **Natural Frequency Map** | 1 | ✗ | **✓ s1** |
| 4 | **Belt Take-up** | 3 | ✗ | **✓ s3** |
| 5 | **Belt Slip Safety Factor** | 4 | ✗ | **✓ s5** |
| 6 | **Gergi kolu konum zarfı** | 5 | ✗ | **✓ s1** (şemanın içinde) |

Üçünün de üreticisi ayrıntılı raporda **zaten vardı** (`_frFreqFigure`,
`_frTakeupChartRaw`, `_frSlipFigure`) — eksik olan hesap değil YERLEŞİMDİ.
"Aynı sayfadaki bir tablo satırını tekrar ediyor" gerekçesi yanlıştı: take-up
eğrisinin **çalışma noktasındaki teğetinin eğimi take-up oranının ta kendisi**
(0,7082 ↔ tablodaki 0,708), yani grafik sayıyı tekrar etmiyor, **kanıtlıyor**.

**Kol zarfı BEDAVA:** `veFeadLayoutSVG`'ye `posMode:'all'` geçmek yeterli —
gergi kasnağı altı konumda üst üste çiziliyor, her konum için ayrı kayış yolu
soluk çiziliyor. 0 px ek yer, ve sayfa 3'ün zarf tablosunun görsel karşılığı.
Hayalet ETİKETLERİ kapalı (`ghostLabels:false`): 395 px'lik şemada altı ad üst
üste biniyordu (ölçüldü: "Serbest" ↔ "Değişt." **104 px²**) ve konumların adı
zaten sayfa 3'te. Tedarikçi çıktısı da zarfı etiketsiz çiziyor.

**İKİ GRAFİK YAN YANA** (kullanıcı isteği): gerginlik eğrisi ve take-up
eğrisi AYNI yatay ekseni (gergi kol açısı) paylaşıyor; yan yana konunca aynı
x'te iki büyüklük birlikte okunuyor — solda gerginlik yükselirken sağda
gereken kayış boyu düşüyor. Alt alta bu eşleme gözle kurulmuyordu. Kutu
ölçüsü sütundan BÜYÜK seçilir (390 birim ↔ 345 px sütun) ki ölçek 0,885
olsun ve puntolar 9,3–10,2 px'e insin; sütun genişliği seçilseydi ölçek 1
kalır ve grafik yazıları gövdeden büyük görünürdü.

**AMA "BİR KEZ" DEMEK "BÜYÜK" DEMEK DEĞİL** — üçüncü bildirim bunu söyledi:
*"Şekiller çok büyük. Gerçekten bu kadar büyük olmasına gerek yok."*
**ÖLÇÜLDÜ ve haklıydı:**

| | önce | sonra | A4 içerik alanının (972 px) |
|---|---:|---:|---:|
| Sayfa 1 · yerleşim şeması | 521 px | **243 px** | %54 → **%25** |
| Sayfa 3 · gerginlik grafiği | 623 px | **412 px** | %64 → **%42** |

**KÜÇÜLEN ÇİZİM, YAZI DEĞİL.** Çizicinin kabuğu `max-width:<W>px` taşıyor:
W kabın genişliğinden küçük seçildiği sürece ölçek 1 kalır ve kullanıcı
birimindeki puntolar (kasnak adı 9) ekranda yine 9 px basılır. Aynı kuralın
TERSİ yönü daha önce ısırmıştı — 460 birimlik kutuyu 397 px'lik sütuna
sığdırmak ölçeği 0,863 yapıp adları 6,0 px'e indiriyordu.

Şema **sütuna** giriyor: kümenin doğal en-boy oranı ≈1,64 (yatay), yani tam
genişlikte yükseklik zorunlu olarak 430 px'e çıkıyor. 395 px'lik sütunda aynı
oran **242 px** veriyor ve boşalan yeri künyeler dolduruyor — yani küçültme
yer kaybı değil, yer KAZANCI (sayfa 1'de 455 px, sayfa 3'te 264 px).

##### Sekiz kozmetik karar — her biri ölçülmüş bir kusurun karşılığı

| # | Karar | Neyi kapatıyor |
|---|-------|----------------|
| 1 | Sütun başlığı **kısa kod** + sayfa altında künye | 41 yatay taşmanın çoğu; puntoyu kıran baskı |
| 2 | **Bütün hücreleri aynı olan sütun tablodan çıkar**, künyeye iner (`_fsrConstCols`) | 5 tabloda 11 sütun · 130 hücre · 11 farklı sayı |
| 3 | Kalınlık **gömülü ağırlıklara** bağlı (Archivo 700 · serif 600 · mono 500) | sentetik kalın: 36 ögede glifler şişiyordu |
| 4 | Punto **tek ölçekten** (`--f-xl…--f-xs`), satır içi px YOK | 17 ayrı punto |
| 5 | Şemada etiket **kayış yolunu ENGEL sayar** (üst→alt→sağ→sol) | 4 çakışma |
| 6 | Şemanın **W'si kabın genişliğini aşmaz** | 460 birimlik kutu 397 px'e sığdırılınca ölçek 0,863 → adlar **6,0 px** |
| 7 | Eksen bölmesi **1/2/2,5/5 × 10ⁿ**'e oturur (`_frNiceAxis`) | `0 · 12,1 · 24,2 · 36,2 · 48,3` — 36,2 bir bölme değil, yuvarlama artığı |
| 8 | Kırmızı vurgu yalnız **hükmü verebilen** kasnakta | 36 hücre kırmızıydı ve sayfanın KENDİ hükmüyle çelişiyordu |

**6. maddenin sebebi çizicinin kabuğunda:** `veFeadLayoutSVG` `max-width:<W>px`
yazıyor, yani SVG asla W'den geniş çizilmiyor ama dar bir kaba konursa
KÜÇÜLTÜLÜYOR — ve puntolar kullanıcı biriminde sabit olduğu için onlar da
küçülüyor. Kural: **istenen W, kabın genişliğinden küçük ya da eşit olmalı.**
Kanvas kartında W zaten kutunun kendi ölçüsü, yani oran 1 ve sorun yok.

**8. madde bir MANTIK hatasıydı, kozmetik değil.** `SF < servis faktörü` olan
her hücre kırmızı basılıyordu; AG00976'da bu, gerginlik oranı 1,00 olan üç
sütunun (iki avara + gergi) **36 hücresini** kırmızıya boyuyordu. Ama aynı
sayfanın hükmü *"yük taşımayanlarda o sayı bir marj değil KAPASİTEDİR"* diyor
— vurgu metnin tam tersini bağırıyordu. Sayı gizlenmiyor: soluk basılıyor ve
başlığında **`yük taşımaz`** yazıyor.

##### Çizici de düzeldi — kazanç KANVASTA da var

Üçü de `js/cp-fead.js` / `js/cp-fead-report.js` içinde ve iki belgeyi birden
düzeltiyor:

| Ne | Nerede | Kanvasa etkisi |
|----|--------|----------------|
| Sınır kutusuna **etiket genişliği** katılıyor (iki geçiş: önce ölçek, sonra taşan pay kadar kenar payı) | `veFeadLayoutSVG` | uzun adlı kasnak artık çerçeveyi aşmıyor |
| Etiket **kayış yolunu engel sayıyor** | `veFeadLayoutSVG` | kart da okunur oldu |
| Eksen bölmesi yuvarlak sayıya oturuyor | `_frNiceAxis` / `_frChart` | ayrıntılı raporun **bütün** grafikleri (ölçüldü: `0 | 200 | 400…`, `1690 | 1700…`) |

Ölçek ile etiket genişliği **birbirine bağlı** (etiket px, sınır mm; ikisini
çözen `s` sınırdan geliyor) → tek geçişte çözülemez. İkinci geçiş `s`'yi
küçültür, yani etiketler daha da daralır; yakınsama tek adımda garanti.

**Etiket kısaltmak ile yer değiştirmek AYRI işler** ve mutasyonla ayrıştı:
etiketi koşulsuz üste sabitleyince **kısa kodla bile** iki çakışma çıkıyor
(`AVA1`, `TEN`); yerleştirici açıkken **tam adla bile** çakışma yok. Yani kod
GENİŞLİK için, yerleştirici ÇAKIŞMA için.

##### Ekranda kırpılan ≠ baskıda taşan — ikisi de sessizdi

Sayfa bir ara `height:297mm; overflow:hidden` idi ve baskıda `height:auto`.
Yani ekranda **sessizce kırpılan** içerik baskıda **altıncı sayfaya** düşüyor,
iki yüzey birbirinden habersiz kalıyordu. Artık `min-height`: taşan sayfa
ekranda da UZUYOR — kardeşlerinden uzun duran bir sayfa gözle görünür.

##### Beş sayfa = beş soru

Tedarikçi çıktısının sayfa adları (*"Geometric Analysis 1/2"*) bir DOSYA
numaralandırmasıydı; sayfanın neyi cevapladığını söylemiyordu.

| # | Sayfa | Cevapladığı soru |
|---|-------|------------------|
| 1 | **Genel Bakış** | nasıl duruyor · özetle nasıl (şema · künyeler · 5 kritik sayı · **kapsam**) |
| 2 | **Geometri** | nerede duruyor (yerleşim · kayış yolu · aksesuar devirleri · **boy dengesi**) |
| 3 | **Gergi Çalışma Zarfı** | kol nasıl geziyor (6 konum × 10 satır · gerginlik eğrisi) |
| 4 | **Yükler** | ne kadar yükleniyor (duty girdisi · gerginlik ve hubload matrisleri) |
| 5 | **Dayanım** | ne kadar dayanıyor (kayma · yorulma · ömür · titreşim · tepe yük) |

**Sayfa 1'in "Belgenin Kapsamı" bloğu bir süs değil:** bir özet raporun en
pahalı sessiz hatası, İÇERMEDİĞİ bir kontrolün yapıldığı izlenimini
bırakmasıdır — tablolar dolu görünür, hüküm verilir, okuyucu neyin
denetlenmediğini bilmez. Blok "ne var / ne yok"u yan yana yazıyor.

**Sayfa 2'nin "Kayış Boyu Dengesi" tablosu ELLE TOPLANABİLİR olsun diye var:**
*"efektif tahrik boyu 1716,2 mm"* tek başına doğrulanamaz; sarım yayları
(667,53) + serbest açıklıklar (1048,67) = 1716,20 mm olarak parçalanınca
okuyucu toplamı kendisi yapabiliyor.

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: serif kalınlığını 700
yapma (sentetik), iki satırlık tabloda da sabit sütun arama, şemada tam ad +
sarım açısına dönme, kırmızıyı global en düşüğe çevirme, `nice` ekseni kapatma,
bir sayfanın kod künyesini düşürme, punto tabanını 7,4'e indirme, şemayı ikinci
kez çizme.

##### Eksik şekiller geri gelirken ÇİZİCİLER de düzeldi — beş sessiz kusur

Beşinin de ortak imzası aynı: belge yine üretiliyor, hata çıkmıyor, yalnız
şekil ya yanlış duruyor ya da **yanlış şeyi söylüyor**. Beşi de kapısızken
mutasyondan sağ çıkıyordu; kapıları eklendi ve onu da kırmızı.

| Kusur | Belirti | Kök neden |
|-------|---------|-----------|
| Frekans haritasının **göstergesi çizim alanının içinde** | yedi girdi, altı eğrinin dördünü kesiyor | `_frChart`'ın sağ payı 18 px'te sabitti; gösterge için pay yoktu |
| Gösterge **tam kasnak adlarını** basıyor | en geniş girdi 262 px = çizim alanının %42'si | ad kısaltma yüzeyi yoktu |
| Kayma grafiğinin **sağ payı 30 px'te sabit** | `14,95` viewBox'ı **10 px** aşıp kırpılıyor | pay etiket genişliğinden türemiyordu |
| Kayma grafiği **gergiyi kırmızı** basıyor | sayfanın kendi hükmüyle çelişiyor | yük taşıyan/taşımayan ayrımı yalnız MATRİSTE yapılmıştı |
| Frekans haritası **`H: 300`** yazıyor | özet raporda sayfa taşıyor | `_FR_H` sessizce yutuluyordu (take-up doğru yapıyordu) |

**KOD ÜRETİCİSİ KÖPRÜYE TAŞINDI** (`veFeadPulleyCodes`, `js/fead-model.js`):
kısa kodu artık hem özet rapor hem ayrıntılı raporun frekans ve kayma
grafikleri kullanıyor. İkinci bir kopya `source-hygiene` kapısına takılır ve
iki yüzey sessizce ayrışırdı. Kod bir kısaltma değil bir **kimlik**:
kullanıldığı her yüzeyde karşılığı aynı sayfada basılmak zorunda.

> Beşincisi **ilk turda YEŞİL kaldı**: kapı `_frNiceAxis`'i doğrudan
> çağırıyordu, GRAFİĞİN onu kullandığını ölçmüyordu. İkinci kapı basılan bölme
> ETİKETLERİNE bakıyor (eşit aralık + adım 1/2/2,5/5 × 10ⁿ) — Şekil 1'deki
> *"yay sayısına bakan test"* dersinin aynısı.

##### DENETİM TURU — üç sessiz SAYI hatası (2026-08-26)

Kullanıcı sordu: *"Ayrıca tepe gerginliği ve hubload için kalibre değil
yazmışsın. Neden kalibre değil? Programımız bunu hesaplamıyor mu?"* — ve
ayrıca *"hesapların rapora tam olarak aktarıldığından da emin olalım"*.
On üç ajanlık bir denetim koştu; Gates'ten aktarılan **sayılarda yanlış
YOK** (yerleşim 34 değer 0,00 mm · span+sarım 12 değer 0,039 · ortalama
gerginlik/hubload 144 değer ≤1 N · kayma matrisi 72 değer 0 uyuşmazlık),
ama **hüküm ve metin katmanında üç gerçek hata** çıktı.

###### 1 · KAYIŞ BİRİM KÜTLESİ — çekirdeğin KENDİ uyarısı yok sayılıyordu

`fead-core.js` `BELT_DB` Gates PK için **katalog** kütlesini taşıyor
(0,0144 kg/m/kaburga) ama kendi yorumunda **reddediyor**: hem kesit tahmini
hem AG00686 frekans haritasından geri-hesap **~0,0196** veriyor ve
*"massPerRibKgM'i acikca gecmek onerilir"* diye yazıyor. `AG00976_GATES_2025`
örneği alanı **yazmıyordu** → katalog değeri kullanılıyordu.

**ÖLÇÜLDÜ** (2750 d/d, altı açıklık):

| m′ | f₁ [Hz] | ateşlemeyle kesişen hücre | en düşük f₁/ateşleme |
|---|---|---:|---:|
| 0,0144 (katalog) | 299,0 · 312,9 · 237,6 · **131,3** · 155,8 · 214,3 | **1 / 72** | 0,955 |
| **0,0196** (geri-hesap) | 250,1 · 261,7 · 196,3 · **108,5** · 127,1 · 174,7 | **3 / 72** | **0,789** |

**HATA EMNİYETLİ TARAFTA DEĞİL:** `f₁ ∝ 1/√m′`, yani hafif kayış frekansı
YÜKSEK gösterir ve **rezonans riskini küçültür**. Yalnız frekans tablosunu
etkiliyor: B10 (1403,032) ve tasarım gerginliği (544,0497) iki değerde de
birebir aynı.

###### 2 · REZONANS HÜKMÜ YOKTU — üstelik sayfanın KENDİ verisinde kesişme var

Belge hem açıklık frekansını hem ateşleme frekansını basıyor ama
**karşılaştırmıyordu**. Basılan tek titreşim hükmü `Çırpınma = yok` idi ve
okuyucu onu *"titreşim sorunu yok"* diye okuyor — oysa çırpınma bambaşka bir
mod (kayış hızı ↔ enine dalga hızı), rezonansla ilgisi yok.

Artık hüküm basılıyor: *"en düşük f₁ / ateşleme = 0,789 (AVA2 → ALT @ 2750
d/d); ateşleme frekansının altına düşen hücre 3 / 72 ✗"*. **Frekans haritası
ile açıklık tablosu aynı sayfaya alındı** — harita bu tablonun çizimi, tablo
haritanın sayısı; ayrı sayfalarda okuyucu eğriyi sayıya bağlayamıyordu.

Kapsam kutusundaki *"rezonans haritası yer ALMAZ"* satırı da düzeltildi:
sayfa 1 o haritayı **çiziyor**. Yer almayan şey açıklık titreşimi değil, çok
serbestlik dereceli **burulma** modu.

###### 3 · MANŞETTE HAM B10 — modelin kendi düzeltmesi gizliydi

Sayfa 1'in kartı ham **1403 saat** basıyordu (Gates 2670'e −%47), modelin
ampirik düzeltmeli kestirimi **2551** (−%4,5) yalnız sayfa 5'te duruyordu.
Kart artık düzeltilmiş değeri manşete, hamı alt satıra alıyor — sayı
gizlenmiyor, **sıralaması** düzeliyor.

Ayrıca: *"yorulma payları çap penceresinden bağımsız olarak geçerlidir"*
iddiası **geçersizdi** — pencere dağılımın kendisinden kalibre edilmiş.
Doğrusu ölçüldü: **SIRALAMA** üs seçiminden bağımsız (m = 5,6 ↔ 4,05 ↔ 3,4
için de ALT baskın), ama mutlak pay değil (%86,9 → %73,4).

###### "KALİBRE DEĞİL" = HESAPLANMIYOR DEĞİL, DOĞRULANMIYOR

Kullanıcının sorusunun cevabı: **tepe yük hesaplanıyor.** Çekirdeğin
`peakEstimate`'i yarı-statik gerilme zinciri + kasnak başına atalet terimi
kuruyor; köprü katmanı aksesuar güçlerinin %100/%10 kombinasyonları ile
± ivmeyi tarayıp kasnak başına en büyüğü alıyor.

Eksik olan **doğrulama**: 17 rapordan çıkarılmış 2095 değerlik kümede
**tek bir tepe değeri yok** (ölçüldü — fixture'da `peak`/`accel` alanı hiç
geçmiyor). Tepe tablosu olan tek rapora karşı sapma gerginlikte
**−%10,5 … +%22,8** (RMS %11,8), hubloadda **−%10,3 … +%17,5** (RMS %9,7).

> **BU AÇIKLAMA ÇÜRÜTÜLDÜ (2026-08-27).** Aşağıdaki "şekil farkı" gerekçesi bir
> yıl sonra ölçümle düştü: aksesuarların atalet talepleri iki modelde **%2,5
> içinde aynıydı** (KK 49,25 ↔ 48 N · ALT 154,58 ↔ 151 N). Dağılım aynı;
> ayrışan tek şey tepe zincirinde **çevrimin kapanmamasıydı**. Çevrim
> kapatılınca aşağıdaki bütün sapmalar %1'in altına iniyor ve tablo Gates'in
> desenine oturuyor (bkz. *"TEPE ZİNCİRİNDE ÇEVRİM KAPANMIYORDU"*). Sayılar
> **o zamanki hâli** belgelemek için duruyor; bugünkü sapma bandı
> gerginlikte −%0,0 … +%1,0, hubloadda −%0,0 … +%0,9.

**AMA ASIL FARK BÜYÜKLÜKTE DEĞİL ŞEKİLDE** — damganın *o zamanki* gerekçesi buydu.
Tepe/ortalama oranı:

| | MFSim | Gates |
|---|---:|---:|
| FAN | 1,065 | 1,148 |
| AVA1 | 1,061 | 1,146 |
| KK | 1,034 | 1,151 |
| AVA2 | 1,029 | 1,149 |
| **ALT** | **1,230** | **1,002** |
| TEN | 1,000 | 1,000 |

Tedarikçi yük taşıyan dört kasnağın dördüne de neredeyse **aynı payı**
(≈1,15) veriyor ve alternatöre hiç vermiyor. Bu model tersini yapıyor:
atalet terimi kasnak BAŞINA (`J·α·oran/r`) olduğu için ivmenin etkisi küçük
ve hızlı dönen alternatörde **toplanıyor** (+%23), büyükler %3–7'de kalıyor.
İki model aynı sayıya farklı yoldan yaklaşmıyor; yükü **başka yere
dağıtıyorlar**. Damganın kalkması için birden çok raporun tepe tablosu
gerekir — tek raporla sabit uydurmak o raporu ezberlemek olurdu.

Gerekçe artık tablonun altında paragraf değil, **kapsam bölümünde künye**
(model sınırları: tepe yük · B10 çap penceresi · kayış kütlesi). Tablonun
altında tek satır kalıyor: *"Kalibre değil, HESAPLANMIYOR demek değildir."*

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: rezonans hükmünü
kaldırma, kayış kütlesini katalog değerine döndürme, kapsam çelişkisini geri
getirme, manşete yine ham B10 yazma, model sınırları künyesini silme,
frekans göstergesini içeri alma, kayma grafiğinde yük ayrımını kaldırma,
gergi kod kısayolunu silme.

##### PROFESYONEL TUR — kapsam kutusu kalktı, dört bölüm eklendi (2026-08-27)

Kullanıcı bildirimi: *"'Belgenin Kapsamı' kısmını da çıkar. Ona da gerek yok.
Çok amatörce olmuş. Bu raporu daha profesyonel bir yapıya kavuşturalım. Amatör
açıklamaları kaldıralım."* Ayrıca: *"'Detay Rapor' kısmında olup da bu raporda
olmayan hangi kısımlar var?"*

###### AÇIKLAMA DEĞİL KÜNYE — ölçülen ton farkı

**ÖLÇÜLDÜ:** on sekiz açıklama notundan ikisi 627 ve 684 karakterdi — birer
deneme yazısı. Bir mühendislik raporunda tablo altı notu bir cümledir.

| | önce | sonra |
|---|---:|---:|
| en uzun not | **684 karakter** | 176 |
| 300 karakteri aşan not | **4** | **0** |
| toplam açıklama metni | 4 186 karakter | **1 693** |

Kaldırılan kalıplar: ikinci tekil anlatım, *"…demek değildir"*, *"çare …"*,
*"biri 'yok' diye öbürü güvenli sayılmaz"*, ölçüm anlatısı. Kalan: birim,
kaynak, ve sayının yanlış okunmasını önleyen tek cümle.

**KAPSAM KUTUSU KALKTI, YERİNE NUMARALI NOTLAR.** *"Bu belge şunları verir /
Bu belgede yer ALMAZ"* iki kutusu bir rapor bölümü değil, bir sunum öğesiydi.
Model sınırları bir mühendislik raporunda kalmak ZORUNDA — ama yeri belgenin
sonundaki **numaralı Notlar** bölümüdür ve metin oraya `(Not n)` ile atıf
yapar. Altı not: tepe yükün doğrulanmamışlığı · B10 çap penceresi · yorulma
üssü · kayış birim kütlesi · hubload vektörü · kapsam dışı kalanlar.

###### DETAYLI RAPORLA KAPSAM DENKLİĞİ — dört bölüm eksikti

Ayrıntılı raporun 19 alt bölümü tek tek tarandı (`kapsam.js`). On beşi özette
zaten vardı; **dördü yoktu ve dördü de üretilebilirdi**:

| Detaylı rapor | Özette | Bugün | Veri |
|---|---|---|---|
| §8.13 Aksesuar mil torku | ✗ | **✓ s4** | `Q = 9549·P/n`, perPulley'den türer |
| §8.15 Yük durumunun yorulmaya katkısı | ✗ | **✓ s4** | `fatigue.perLoadPct` |
| §8.18 Sistem burulma titreşimi | ✗ | **✓ s1** | `R.torsional` |
| §8.19 Tasarım notları | ✗ | **✓ s6** | numaralı Notlar |

**BURULMA SAYFA 1'DE, TİTREŞİMİN GERİ KALANIYLA BİRLİKTE:** doğal frekans
haritası, açıklık tablosu ve burulma modları üçü de titreşim; ayrı sayfalara
düşünce okuyucu üçünü birbirine bağlayamıyordu.

**BURULMA SAYISI KRANK MİLİ ATALETİNE BAĞLI** ve harness'ta ölü girdiydi:
gerçek panel yolu `crankInertia` geçiyor, doğrulama harness'ı geçmiyordu —
1. elastik mod **12,9 yerine 16,8 Hz** çıkıyordu (%29). Test harness'ı artık
uygulamanın yolunu birebir taklit ediyor; kapı frekansı 11–15 Hz bandında
tutuyor.

###### ALTI SAYFA — içerik büyüdüğü için, tercih olarak değil

| # | Sayfa | Cevapladığı soru |
|---|-------|------------------|
| 1 | **Genel Bakış** | nasıl duruyor · titreşimi ne (şema · künyeler · 5 kart · frekans haritası · açıklık tablosu · burulma) |
| 2 | **Geometri** | nerede duruyor |
| 3 | **Gergi Çalışma Zarfı** | kol nasıl geziyor (6 konum · iki grafik yan yana) |
| 4 | **Çalışma Çevrimi ve Torklar** | ne isteniyor (duty girdisi · mil torku · yorulma katkısı) |
| 5 | **Gerginlik ve Hubload** | ne kadar kuvvet (ortalama gerginlik · hubload · tepe yük) |
| 6 | **Dayanım ve Titreşim** | ne kadar dayanıyor (kayma · yorulma · ömür · Notlar) |

Sayfa 4'ün üç tablosu da **devir noktasıyla indekslidir** (girdi → ondan çıkan
tork → o noktanın yorulmaya katkısı); sayfa 5'in üçü de kuvvettir. Bölüşüm
tema değil, INDEKS ortaklığı.

**ÖLÇÜLDÜ:** altı sayfa da taşmasız, doluluk %81–99, yatay taşma 0, viewBox
dışı SVG yazısı 0, çakışma 0, sentetik kalın 0.

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: Notlar bölümünü kaldırma,
burulma / mil torku / yük katkısı bloklarını tek tek kaldırma, kapsam dışı
notunu silme, tork sabitini bozma (9549 → 9459), rezonans hükmünü kaldırma,
kayış kütlesini katalog değerine döndürme. Tork ve yük katkısı kapıları önce
**yalnız başlığa** bakıyordu ve mutasyondan sağ çıkıyordu — artık basılan
hücrenin ARİTMETİĞİNİ (`Q = 9549·P/n`) ve payların toplamının %100 olmasını
tutuyorlar.

##### TEPE ZİNCİRİNDE ÇEVRİM KAPANMIYORDU — 14 farkın tek kök nedeni (2026-08-27)

Kullanıcı özet raporu Gates AG00976'nın kendi PDF'iyle **tablo tablo, sayı sayı**
karşılaştırttı. 318 değer ölçüldü, **300'ü tuttu**; tutmayan 18'in **14'ü tek
tabloda** — tepe gerginlik/hubload — ve hepsinin tek bir kök nedeni çıktı.

| Blok | Değer | Tutan |
|------|------:|------:|
| Kasnak yerleşimi · kayış yolu · duty girdisi | 96 | 96 |
| Ortalama gerginlik + hubload (12×6×2) | 144 | 144 |
| Gergi çalışma zarfı (6×10) | 60 | 56 |
| **Tepe gerginlik + hubload + yön** | 18 | **4** |

Gergi zarfındaki dördü de Gates'in **kendi basım gürültüsünün** içinde: Gates
1 ondalık basıyor ve kendi tablosu (θ ↔ X,Y, pivot + kol boyu ile) **0,108 mm /
0,068°** kendi içinde tutarsız; modelinki 2,8e−14. Load konumundaki +%0,66 ise
take-up tekilliğinin büyütmesi — aynı 0,05°'lik sarım farkı Mean'de %0,14,
Load'da **%1,08** oynatıyor (7,7 kat).

**BAĞIMSIZ DOĞRULAMA — Gates'in kendi eğrisi:** s1'deki "Belt Tension Control"
grafiği 600 dpi'da piksel piksel izlendi. Dikey konum çizgileri modelin göreli
kol açılarına **0,08° içinde** oturuyor (tablodaki 1 ondalıklı basımdan daha
iyi), ve eğrinin kendisi 58 noktada **RMS %0,25** (en kötü %0,70) örtüşüyor.

###### Kök neden: ivme terimi kayış çevrimini kapatmıyordu

Kayış KAPALI bir halkadır: bir tam turda gerginlik değişimlerinin toplamı sıfır
olmak **zorunda** — topolojik özdeşlik, modelleme tercihi değil.
`peakEstimate` bunu GÜÇ için zorluyor (`kw[krank] = Σ diğerleri`), ATALET için
zorlamıyordu: kranka kasnağın **kendi** ataletini yazıyordu.

```
krank adımı  J·α·oran/r                        =  +89,69 N
Σ aksesuar   5,53 + 49,25 + 5,53 + 154,58      = −214,89 N
ÇEVRİM ARTIĞI                                  = −125,20 N   ← sıfır olmalıydı
```

Zincir gergi açıklığında ankrajlanıp ondan **bir önceki** kasnakta bittiği için
artık hiçbir yere yazılmıyor: tamamı son halkaya (ALT→gergi) biniyor.

**ÜÇ REFERANSSIZ KANIT** (Gates'e hiç bakmadan):

| Kanıt | Ölçüm |
|-------|-------|
| Yön bağımlılığı | zinciri ileri ↔ geri yürütmek beş kasnakta da tam **130,73 N** fark veriyor; çevrim kapansaydı 0 olurdu |
| Ankraj bağımlılığı | ankrajı ALT'a almak sistemi 6,85 N, ALT'ta 123,88 N kaydırıyor |
| Fiziksel imkânsızlık | 0,010 kW'lık bir **avara** üzerinden %29,5 gerginlik sıçraması (ortalama zincirde aynı avarada fark −1,3 N = fiziksel beklenti) |

Aynı sınama ORTALAMA zincirde **1,4e−13 N** ile kapanıyor — yani yaklaşım değil,
tutarsızlık. AG00976'ya özgü de değil: `BMC_FEAD_2026`'da −157,8 N.

**FİZİK:** kayış krank kasnağını hızlandırmaz — o motora cıvatalı ve motor onu
zaten döndürüyor. Kayışın hızlandırdığı kütleler AKSESUARLARDIR; krankta görülen
gerginlik artışı onların taleplerinin **toplamıdır**. Gates'in tablosu bu
kapanışı sağlıyor (204 ↔ 205 N), MFSim'inki sağlamıyordu.

###### Düzeltme çekirdeğe DOKUNMUYOR

`peakEstimate` `inertias` sözlüğünü zaten kabul ediyor — burulma modelinin
kullandığı yol. `veFeadPeakInertias` (fead-model.js) kranka, adımı Σ aksesuara
eşitleyen **eşdeğer** bir J geçiriyor; α sadeleştiği için J_eş ivmeden bağımsız.

**GERGİ KASNAĞI TOPLAMA GİRMEZ** ve bu bir eksiklik değil: zincir orada
ankrajlı olduğu için o kasnağın kendi adımı zaten hiç uygulanmıyor. Toplama
katılsaydı çevrim yine kapanmaz, +5,53 N artık kalırdı. Çekirdeğin kendi notu
*"gergi kolu dinamigi dahil DEGIL"* diyor; gergi kasnağının atalet talebi
(≈%0,35) o sınırın içinde ve **raporda yazılı**.

**ÖLÇÜLDÜ:**

| | önce | sonra | Gates |
|---|---:|---:|---:|
| Tepe gerginlik RMS | %11,83 | **%0,41** | — |
| en kötü | %22,81 | **%0,69** | — |
| Tepe hubload RMS | %9,75 | **%0,39** | — |
| ALT tepe gerginliği | 671 N | **545 N** | 546 N |
| Gergi hubload yönü | 198,8° | **217,1°** | 218° |

**İKİNCİ, BAĞIMSIZ DOĞRULAMA:** düzeltme yalnız s1 tepe tablosundan türetildi.
Gates'in **s6/12** "Most Critical Load Condition" tablosu türetmede hiç
kullanılmadı; kayma-kritik kombinasyon seçimi orada **2/6 → 5/6** tutmaya geçti.

###### "ŞEKİL FARKI" AÇIKLAMASI YANLIŞTI — ölçümle çürütüldü

Bu kayıt ve `cp-fead-summary.js`'in künyesi bir dönem sapmayı bir **model
karakteri** olarak anlatıyordu: *"atalet terimi kasnak başına olduğu için etki
hızlı dönen alternatörde toplanıyor; iki model yükü BAŞKA yere dağıtıyor."*
Ölçüm bunu çürüttü: aksesuarların atalet talepleri iki modelde **%2,5 içinde
aynı** (KK 49,25 ↔ 48 N · ALT 154,58 ↔ 151 N). Dağılım aynıydı; ayrışan tek şey
çevrimin kapanmasıydı. Şekil farkı bağımsız bir karakter değil, kusurun
SONUCUYDU — tepe/ortalama oranı kapanışla birlikte **1,155–1,162** oluyor
(Gates ≈1,15) ve alternatörde 1,00 (Gates 1,002).

**"Kalibre değil" damgası KALIYOR:** doğrulama kümesinde hâlâ tek bir tepe
değeri yok, yani tablo TEK bir rapora karşı ölçülebiliyor.

###### Aynı turda kapatılan dört yan kusur

| Kusur | Belirti | Düzeltme |
|-------|---------|----------|
| **Ölü girdi** — panel ivmesi tabloya ulaşmıyor | `R.peakAccelRpmS` okunuyor, `js/` içinde YAZAN yok; panelde 1100 → 3000 tabloyu **hiç değiştirmiyordu** | `veFeadAnalyze` `accelRpmS`/`decelRpmS`'i sonuca taşıyor, `cp-fead.js` geçiriyor |
| **Basılan ivme işareti** | ALT satırı +1100 yazıyordu, kazanan dal yavaşlamaydı | Etkin işaret dalından okunuyor |
| **Anlamsız kombinasyon etiketi** | ALT ve TEN kW kombinasyonundan cebirsel bağımsız (yayılım 2,3e−13 N); kazanan kayan nokta artığıyla seçiliyordu | Ayırt etmiyorsa `combo: null` |
| **Taramanın yarısı tekrar** | köprü ±ivme geçiyor, çekirdek de kendi içinde ±dallanıyor → 16 dalın 8'i kopya | Tek katmanda süpürme |

**İVME İŞARETİ KAPISI AG00976'DA ISIRAMAZ** ve sebebi öğretici: çevrim
kapatıldıktan sonra altı kasnağın altısı da **hızlanma** dalında kazanıyor —
yavaşlama hiçbir yerde tepe üretmiyor. Kapı bu yüzden yavaşlamanın gerçekten
kazandığı bir düzende kurulu (avara ataletleri ×1000 → 1/6 kasnak decel).

###### Belgenin kendi tutarlılığı — üç bayat metin

| Ne | Neydi | Ne oldu |
|----|-------|---------|
| Manşetteki sayfa atfı | `bkz. sayfa 5` elle yazılı; belge beş sayfadan altıya çıkınca bayat kaldı, ömür bloğu **sayfa 6**'da | `_fsrSheetNo` sayfa listesinden türetiyor |
| Not 3'ün üs duyarlılığı | `%86,9'dan %73,4'e` elle yazılı iki sabit, yalnız m = 5,6 ↔ 3,4 çiftine ait; PK-2_2a seçiliyken tablo **%53,0** derken not %86,9 diyordu | Baskın kasnak ve payı dağılımın KENDİSİNDEN |
| Ömür kartı | Seçili yorulma modelini etiket olarak basıyor ama saat **her zaman m = 5,6** ile hesaplanıyordu; köprü uyumsuzluğu `life.modelMismatch` ile bildiriyordu, özet rapor **okumuyordu** | Kart uyuşmazlığı kırmızı basıyor |

**Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı:** `veFeadPeakInertias`'ı boş
döndürme (7 test), `inertias`'ı geçirmeme (5), panel ivmesini taşımama, etiketi
her zaman basma, uyuşmazlığı susturma, Not 3'ü yine elle yazma, sayfa atfını
5'e sabitleme, geçirilen ivmeyi kaydetme.

##### KAYMA EŞİĞİ — "ne kadar aşağı inebilirim" (2026-08-28)

Kayma hükmü boyutsuz SF ile veriliyordu; **N cinsinden** *"kaymamak için gereken
en düşük ankraj gerginliği"* diye bir büyüklük modelde HİÇ YOKTU. Tedarikçi
çıktısı onu gerginlik grafiğinde yatay bir çizgi olarak basıyor; MFSim'in aynı
grafiği o çizgisiz çiziyordu.

`veFeadSlipThreshold` (fead-model.js) **kapalı formda, iterasyonsuz**: açıklık
gerginlikleri ankrajdan SABİT farklarla ayrılır (fark torkla belirlenir,
ankrajdan bağımsızdır), yani `T_i = T₀ + Δ_i`. Bir kasnakta kayma sınırı
`T_gergin/T_gevşek = e^(μφ) = cap` olduğunda

```
T₀* = (Δ_gergin − cap·Δ_gevşek) / (cap − 1)
```

**İKİ BAĞIMSIZ YOL, |Δ| ≤ 1,4e−14 N.** İkinci yol cebirle ilgisiz: ankraj
gerçekten değiştirilip `veFeadAnalyze` baştan koşturuluyor ve yük taşıyan
kasnakların en düşük SF'sinin 1'e düştüğü nokta iki-bölmeyle aranıyor.
Sonuç `SF = 1,000000000` @ **80,948 N**, aynı kasnak (FAN), aynı devir (1000).
Bir işaret hatası iki yolda birden aynı şekilde çıkamaz.

| | AG00976 |
|---|---|
| Eşik | **80,95 N** |
| Belirleyici | Sürücü Kasnak (FAN) @ **1000 d/d** |
| Tasarım gerginliği | 544,05 N |
| Pay | **6,72 kat** |

**GERGİN OLAN AÇIKLIK ARANIR — sürücüde ÇIKIŞ, sürülende GİRİŞ.** ÖLÇÜLDÜ
(@1000 d/d): altı kasnağın **beşinde giriş** daha gergin. *"Çıkış her zaman
gergin"* varsayımı alternatörde kökü **39,52 → −480,98 N** yapıyor — ama genel
EN BÜYÜK yine FAN'da kaldığı için toplam sayıya bakan bir kapı bunu SESSİZCE
geçiriyor (mutasyonla ölçüldü, kapı yeniden kuruldu: tek bir sürülen kasnak
yalıtılıyor).

**YÜK TAŞIMAYANLAR DIŞARIDA — gerekçe TUTARLILIK, matematiksel imkânsızlık
DEĞİL.** Bir avara da pekâlâ kök verir; ÖLÇÜLDÜ, kökleri **−856,6 … +5,6 N**,
yani belirleyicinin çok altında → **bu sistemde filtre sayıyı DEĞİŞTİRMİYOR**.
Filtrenin işi hükmü hizada tutmak: kayma hükmünü raporun kendisi yük
taşıyanların en düşüğünden veriyor (`_frMinSF`), çünkü oran ≈ 1 olan bir
avarada SF bir MARJ değil o sarım açısının KAPASİTESİDİR. İki farklı kayma
ölçütü aynı belgede duramaz. Kapı bu yüzden **sentetik**: avaranın kökü
belirleyicinin üstüne (19 490 N) çıkarılıyor ve yine yüklü olan seçiliyor.

**GATES'İN BASTIĞI SAYI KOPYALANMIYOR ve sebebi Gates'in kendi çelişkisi:**
s1 grafiğinde **157,65 N** yazıyor, ama kendi kayma sayfasının (s6/12) FAN
eğrisinden türeyen değer **66,6 N** — aynı raporun iki sayfası arasında
**2,37 kat**. MFSim'in 80,95 N'ı Gates'in kayma VERİSİNE +%21,5 uzakta, basılı
ÇİZGİYE 2 kat. Sayı modelin kendi zincirinden türetiliyor.

**Çizgi eğrinin ALTINA çiziliyor** (üstünü örtmesin) ve altı taralı — tedarikçi
çıktısının kendi biçimi. Çizgi hem ayrıntılı hem özet raporda, **tek çiziciden**
(`_frTensionFigure`).

###### Eşik çizgisinin YERİ ayrı bir kapı — ve ilk hâli ısırmıyordu

Sayıyı künyeye doğru yazıp çizgiyi yanlış yere koymak SESSİZ bir kusur: belge
tutarlı görünür, grafik yalan söyler. Kapı çizginin y'sini grafiğin kendi
**bölme etiketlerinden** geri çözüyor (çizicinin `sy`sine hiç başvurmadan).

İlk tolerans *"başka bir bölmeye düşmesin"* idi ve bölme aralığı **48,4 px**
olduğu için bu **24 px'lik** bir kapı demekti: `+12 px` kaydırma da, `×1,5`
ölçek hatası da SESSİZCE geçiyordu (ölçüldü). Etiket temel çizgisinin bölmenin
4 px altına yazıldığı (`y="(Y+4)"`) fark edilip ofset ayıklanınca tolerans
**0,5 px**'e indi; dört mutasyonun dördü de kırmızı — `×1,5`, `+12 px`,
**`+1 px`** ve tasarım gerginliğini çizme.

###### Aynı turda kapatılan üç eksik satır

| Ne | Neydi | Ne oldu |
|----|-------|---------|
| **Kayış katalog adı** | Künye `GATES 8PK` diyordu; tedarikçiyle konuşurken tek tanımlayıcı olan `8PK1715HD` belgede HİÇ geçmiyordu | `beltType` köprüden geçiyor, künyede `GATES 8PK1715HD` |
| **Yay ortalama momenti** | Tedarikçi künyesinin *"Spring Mean Load"* satırı belgede yoktu | `M₀ + k·rel` → **22,076 Nm** ↔ Gates 22,07 (%0,027), † ile türev işaretli |
| **Hazırlayan** | Antet alanı OKUYOR ama hiçbir yüzey YAZMIYORDU → altı sayfada da `Hazırlayan: —` | Panelde alan var; kapı zinciri uçtan uca tutuyor |

**KAYIŞ KİMLİĞİ AYRI SATIR DEĞİL** ve sebebi ölçüldü: ayrı satır sayfa 1'i
**8 px** taşırıyordu (1131 ↔ tavan 1123) ve katalog adı profili zaten kapsıyor.

**YAY MOMENTİ ÜÇ ONDALIKLA basılır, iki değil:** 22,076 iki ondalıkta
**22,08**'e yuvarlanıyor ve Gates 22,07 yazdığı için okuyucu bir basamaklık
HAYALİ bir uyuşmazlık görürdü. İki yol da (çekirdeğin `springTorque`u ve yedek
`M₀ + k·rel`) aynı sayıyı veriyor ve kapı ikisini birbirine bağlıyor.

###### KK ATALETİ DEĞİŞTİRİLMEDİ — bir "aykırı değer" iddiası ÖLÇÜMLE ÇÜRÜTÜLDÜ

Bir denetim turunda *"Klima kompresörünün ataleti Gates'inkinin 5,85 katı, bir
aykırı değer"* iddiası çıktı. **Çürütüldü:**

1. **Atalet çapla ölçeklenmiyor** — fixture'ın kendisi gösteriyor:
   ALT Ø57,4 → 0,014 ama TM31 Ø154,4 → 0,0053. Bunlar kasnak ataleti değil,
   **sürülen makinenin** ataleti; büyük kasnak küçük atalet taşıyabiliyor.
2. **Tepe tablosu KK'yı doğrudan yokluyor.** Tarama: en iyi uyum **0,025**
   (RMS %0,253), bugünkü **0,031** (%0,41), Gates'in ima ettiği **0,0053**
   (%1,19). RMS < %0,5 bandı KK ∈ **[0,018 – 0,032]** veriyor; Gates'in
   çapraz-rapor bandı bunun **3–6 katı dışında**.

Yani veri bugünkü değeri destekliyor, iddiayı değil. **Girdi değiştirilmedi.**

> **YÖNTEM NOTU — ölçüm aracının kendisi bir kez sessizce ÖLÜYDÜ.** Atalet
> yoklaması `n.data.name` üzerinden mutasyon uyguluyordu; örnek düğümleri adı
> `customName`de taşıyor, dolayısıyla sekiz tarama satırı da **birebir aynı**
> sayıyı basıyordu ve "duyarsız" diye okunuyordu. Yoklama artık `n.id` ile
> anahtarlanıyor **ve** mutasyon `node.data`'yı gerçekten değiştirmediyse
> `MUTASYON ETKİSİZ — ölçüm geçersiz` diye ATIYOR. Kullanıcının uyardığı
> sınıfın (*"yanlış iteratif değer çıkarma"*) tam örneği.

**FAN ATALETİ DUYARSIZ ve bu çevrim kapanışının KANITI:** FAN'ın kendi
ataletini değiştirmek tepe tablosunu **%0,413**'te sabit bırakıyor — krankın
kendi ataleti artık zincire hiç girmiyor, `veFeadPeakInertias` onu aksesuar
taleplerinin toplamına eşitliyor (bkz. *"TEPE ZİNCİRİNDE ÇEVRİM
KAPANMIYORDU"*).

**Kapı on üç mutasyonla ölçüldü, on üçü de kırmızı:** kapalı formda işaret ters
(4 test), satırlarda maks yerine min (3), `max/min` yerine "çıkış hep gergin"
(1), yük filtresini kaldırma (1), raporun oranı kendi kopyasında tutması (1),
eşiği hiç hesaplamama (3), çizgiyi %50 / +12 px / **+1 px** kaydırma ve tasarım
gerginliğini çizme (her biri 1), Gates'in 157,65'ini kopyalama (1), yay
momentini sabitleme (1), katalog adını düşürme (2), yay momenti satırını
kaldırma (1), Hazırlayan alanını panelden kaldırma (1), anteti hep `—` bastırma
(1).

##### Uydurulmayan şeyler — raporun kendi §9'unda yazılı

| Gates sayfası | Neden yok |
|---|---|
| Natural Frequency / System Resonance | Çok serbestlik dereceli **burulma** modu; çekirdek yalnız gergi kol modu verir (ölçüldü: %19 fark) |
| Pulley Alignment Sensitivity | Geometri tek düzlemde çözülüyor; fleeting açısı ve eksenel offset modelde yok |
| Belt Slip Sensitivity taraması | "En kritik ivme + yük kombinasyonu" araması ve ters çözüm çekirdekte yok |
| Weibull / incidents per 1000 | İstatistiksel dağılım modeli yok |
| Peak Torque eğrisi | Ayrı büyüklük; §8.13 açıkça **"ortalama"** diyor |

##### İki sessiz birim tuzağı (ikisi de testli)

`wearPct` çekirdekte **ORAN** (0,007), tedarikçi sayfasında **%0,70** — ham
basılsaydı okuyan kişi payı yüz kat küçük sanırdı. `Number(null) === 0` ise
girilmemiş bir alanı "0 ölçüldü" gibi gösterirdi; `_frNum` null/undefined/''
değerlerini NaN'a çeviriyor ve rapor `—` basıyor.

##### Grafik ölçeği — tekillik kesilir

Belt Tension Control grafiğinde kol açısı çözüm aralığının ucuna yaklaşırken
gerginlik **tekilleşiyor** (T milyarlara çıkıyor). Ham veriye göre ölçeklenen
eksen grafiği okunmaz yapıyordu: çalışma noktaları x ekseninin üstüne yapışıyor,
y etiketleri 9 haneli sayıya dönüyordu (ölçüldü). Eksen çalışma konumlarının
gerginliğine göre sınırlanıyor ve eğri orada kesiliyor — Gates çıktısı da öyle.
Tolerans/aşınma 0 iken dört konum aynı açıya oturduğu için etiketler **tek
çizgide birleştiriliyor**.

##### Biçim: devir SATIR, kasnak SÜTUN

§8.11 ve §8.17 devir başına ayrı tablo basıyordu; aynı span boyları dokuz kez
tekrarlanıyor ve belge 41 000 px'e çıkıyordu (ölçüldü). Matris biçiminde bir
sütunu yukarıdan aşağı okumak, o kasnağın devirle nasıl değiştiğini doğrudan
gösteriyor — tedarikçi sayfasının biçimi de bu.

##### Tasarım gerginliği bir GİRDİ DEĞİL — ankraj türetiliyor (2026-08-25)

Bir önceki bölüm "Design Tension'ın GİRDİ olduğu hiçbir yerde yazmıyordu" diye
bitiyordu ve raporda `girdi` etiketiyle işaretlenmişti. Kullanıcı doğru soruyu
sordu: **girdi olmamalı.** Ölçüldü, haklı çıktı, alan kaldırıldı.

Gerilme zinciri gergide ankrajlanır (`T[gergi] = designTensionN`) ve bütün span
gerilmeleri, hubloadlar, kayma emniyetleri ondan kurulur. Ama gergi kolunun
taşıyabileceği gerginlik yay dengesinden **zaten belirli**:

```
T = M(θ)/(dL/dθ),   M = M₀ + k·θ,   dL/dθ = a·sinβ·2sin(φ/2)
```

Sağdaki hiçbir şey serbest değil: `a`, `M₀`, `k` gergi künyesinden okunur;
`θ`, `φ`, `β` çözülmüş geometriden gelir. **ÖLÇÜLDÜ (10 Gates raporu):**

| | girilen | türeyen | fark |
|---|---|---|---|
| AG00686 | 766 | 765.9 | −0.01% |
| AG00879 · AG00894 · AG00902 ×2 · AG0868 ×3 · AG00686-1520 | 258–609 | 258.2–608.3 | ≤0.12% |
| AG00810 | 759 | 759.9 | +0.12% |

En büyük fark **%0.12**, RMS **%0.08** — tamamı yuvarlama (Gates tam sayı
basıyor). İki kanal zaten **tek kanaldı**.

**Türetilmiş ankrajla 2095 değerlik kapı GEÇİYOR:** çalışma sapması
%0.328 → **%0.391** (eşik %0.5), Load ve kol açısı hiç değişmiyor. O 0.06 puan
model hatası değil: Gates kendi zincirini **yuvarlanmış** tam sayıyla
ankrajlıyor (765.9 değil 766), dolayısıyla girilen değer Gates'in aritmetiğini
yapısal olarak biraz daha iyi taklit ediyordu. Fizik olarak türetilmiş değer
daha tutarlı.

Değişiklik **çekirdeğe dokunmuyor** — çekirdek `designTensionN`'i almaya devam
ediyor, yalnız köprü artık onu kullanıcıdan değil yay dengesinden yazıyor
(`veFeadBuildSystem`, "ANKRAJ TÜRETİLİYOR" bloğu). Doğrulama koşucusu köprüyü
atladığı için (`buildMisc` sistemi doğrudan kurar) kapı raporun kendi değeriyle
ölçmeye devam ediyor; türetilmiş hâli ayrıca ölçüldü.

**Dokunulan yerler:** Çözücü panelindeki alan silindi (`cp-fead.js`) ve
türetilen değer **Algılanan Model** tablosunda görünüyor — panelde okunacak
başka yeri yok, görünmezse "gerginlik nereden geldi" sorusu cevapsız kalırdı.
Raporun §8.7'si karşılaştırma yerine **kuruluş** anlatıyor; envanterde satır
"— aşağıdakilerin hiçbiri girilmez —" ayracının ALTINA taşındı. Teori
belgesindeki "Bu değer **bir girdidir**" cümlesi düzeltildi ve şablon yeniden
üretildi. Hata çevirisi "girilmedi" yerine "türetilemedi" diyor.

**Türetme başarısız olabilir** (kayış boyu gergi kolunun erişemeyeceği kadar
kısa/uzunsa `meanRel` çözülemez). O zaman ankraj YOKTUR: uyarı düşer, çekirdek
gerilme istendiğinde kendi açık hatasını verir, ama `build.ok` **true kalır** ki
yarım modelde kayış yolu kartı çizilmeye devam etsin (kart gerginlik değil
geometri gösteriyor).

Altı mutasyonla ölçüldü — ankrajı yine panelden okuma (3 test kırmızı), türetmeyi
atlama (52), `cfg` ile `sys`i ayrıştırma (1), türetilemedi uyarısını yutma (1),
panel alanını geri getirme (1), Algılanan Model satırını kaldırma (1).

