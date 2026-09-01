# Yapısal Analiz — Malzeme ve Özellikler

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

##### Malzeme ve Özellikler — Geometri'ye asılan ALT bileşen (`str-material`)

Zincirin halkası **değil**, Geometri'nin **eki**: içe aktarılan parçaya malzeme
atar. "Alt bileşen" olduğu iki YAPISAL işaretten okunuyor, yazıdan değil:

| İşaret | Değer | Neyi imkânsız kılıyor |
|--------|-------|-----------------------|
| **Çıkışı YOK** (`outputs: 0`) | kutu bir yaprak | "Geometri → Malzeme → Ağ" diye yanlış bir zincir kurulamaz |
| **Kutu küçük** (50×46 ↔ zincirin 62×56) | bakışta hiyerarşi | — (aksesuarların Motor'a asılırkenki 54×50 kalıbı) |

**Geometri'nin GİRİŞİ AÇILMADI** ve bu bilinçli: malzeme ekini girişten
beslemek zincirin başını kaybettirir (`str-mesh` çıkışı Geometri'ye
bağlanabilirdi). Bunun yerine Geometri **ikinci bir ÇIKIŞ** aldı:
`output-0` (SAĞ) = analiz zinciri, `output-1` (ALT) = malzeme eki. Tek porta
iki tel de bağlanabilirdi (bir port çok bağlantı taşıyor) ama ikisi **aynı
ağızdan** çıkardı ve alttaki kutuya giden tel sağa çıkıp geri dönerdi.

**Eski kayıtlar göç İSTEMİYOR — ölçüldü.** Geometri tek çıkışlıyken kaydedilmiş
projelerde bağlantı `fromPort: 'output'` taşıyor ve o ad artık yok; ama çizici
`vePortOffset` üzerinden onu da sağ kenarın ortasına koyuyor: yeni `output-0`
ile sapma **0,00 px** (gerçek tarayıcı). Tel yerinden oynamıyor.

**Geometri'nin ADI SOLA alındı** — zevk değil, ölçülmüş bir çakışmanın
düzeltmesi. Malzeme teli alt porttan **dümdüz** iniyor (yatay sapma 0,00 px) ve
ad varsayılan yerinde tam onun altında ortalıydı → tel adın üstünden geçiyordu,
yani projenin kendi yerleşim kuralının ihlali. Dört seçenek ölçüldü:

| Ad konumu | Tel adı kesiyor mu | Rozet/zincir çakışması |
|-----------|--------------------|------------------------|
| bottom (varsayılan) | **evet** | — |
| top | hayır | **STEP rozeti adın üstünde** |
| right | hayır | **ad zincir telinin üstünde** |
| **left** | hayır | yok ✓ |

###### Çözücünün gerçekten istediği şey — ve eksik olanın NEYİ engellediği

Lineer elastik tet10 için gereken tam liste kısa: **E ve ν**. Geri kalanı ayrı
sorulara cevap veriyor, o yüzden hepsi tek "zorunlu" torbasına atılmadı —
`errors` çözümü DURDURUR, `warns` yalnız bir yeteneği kapatır:

| Alan | Yoksa |
|------|-------|
| E, ν | **ÇÖZÜM YOK** (rijitlik matrisi kurulamaz) |
| ρ | öz ağırlık / kütle / modal kapalı |
| σ_akma | gerilme basılır, **emniyet payı hükmü verilemez** |
| σ_çekme | kopma payı (bilgi) |
| α | ısıl yük (ileride) |

Hepsi tek torbaya atılsaydı ρ'suz bir model "çözülemez" ilan edilirdi — oysa
öz ağırlıksız bir gerilme çözümü geçerli bir analizdir.

###### ν < 0,5 bir zevk meselesi değil, TEKİLLİK

`K = E / (3(1−2ν))`; ν → 0,5'te payda sıfıra gider, K → ∞. Yer değiştirme
temelli standart elemanlarda bu rijitlik matrisinin koşullanmasının bozulması
demek: **ν = 0,5 tam tekillik**, **ν > 0,49 hacimsel kilitlenme** — çözüm koşar,
sayı çıkar ve sonuç sistematik olarak **FAZLA RİJİT** olur. Yani gözle
yakalanmayan, güvenli tarafta OLMAYAN bir hata: modülün tet4 ölçümünde
(%24 rijit) belgelenen sınıfın aynısı. ν ≥ 0,5 **reddediliyor**, 0,49–0,5
**uyarılıyor**, ve türetilen K o aralıkta sayı üretmiyor (`null`).

###### SESSİZ BİRİM TUZAĞI: ρ

Modülün birim sistemi **mm · N · MPa**; o sistemde kütle birimi **TON**, yani
yoğunluk **ton/mm³**: çelik 7850 kg/m³ = **7,85e-9 ton/mm³**. 7850'i doğrudan
yazmak kütleyi **10¹² kat** büyütür — çözüm yine koşar, öz ağırlık altında parça
"erir". Panel kg/m³ soruyor (kullanıcının bildiği birim), çevrimi kendisi yapıyor
ve **çevrilmiş değeri panelde yazıyor** — kimse hangi sayının çözücüye gittiğini
tahmin etmek zorunda kalmasın. FEAD'deki `wearPct` oran↔yüzde tuzağının aynısı.

###### Bağ TELDEN okunuyor, ikinci bir "hedef seç" alanı yok

`veStrMatHost` malzeme kutusuna gelen teli izleyip `str-geometry` düğümünü
buluyor. Panelde ayrı bir hedef alanı tutulsaydı tel ile alan sessizce
ayrışırdı (FEAD'de panel ile kartın AYNI alanı okuması kuralının aynısı).
Üç durum da AÇIKÇA yazılı: bağlı değil / bağlı ama parça yok / parça künyesi.
"Bağlı değil" sessiz bırakılsaydı kullanıcı malzemeyi girer, kaydeder ve çözücü
onu hiç görmezdi.

###### Rozet AMBER yalnız çözülebilir kayıtta

Adı yazılmış ama E'si girilmemiş bir malzeme "hazır" görünmemeli. Boşken de
rozet **var** (`MALZ`) — Geometri rozetindeki gerekçenin aynısı: "rozet yok" ile
"malzeme yok" ayırt edilemezdi. Adsız ama E girilmiş kayıt `210 GPa` okur.

**ÖLÇÜLDÜ (gerçek tarayıcı, başlangıç topolojisi):** beş bileşen kuruluyor,
Geometri 62×56 / Malzeme 50×46, teller `output-0→Ağ` ve `output-1→Malzeme`,
malzeme telinin **yatay sapması 0,00 px** (alt kenar → üst kenar), Malzeme'nin
DOM'da **0 çıkış portu**, elle bağlama iki yönden de aynı bağlantıyı kuruyor,
S355JR girilince G **80.769,2 MPa** · K **175.000,0 MPa** · ρ **7,850e-9 ton/mm³**,
alt topolojiden çıkıp geri girince kayıt ve tel aynen duruyor, konsol hatası
**yok**.

###### Malzeme kütüphanesi — `js/structural-materials.js` (112 kayıt / 16 aile)

Katalog AYRI DOSYADA ve DOM'suz: panel (`cp-structural.js`) onu yalnız
**gösteriyor**, tek bir malzeme değeri sunum katmanında yazılı değil. FEAD'deki
üç katmanın (çekirdek / köprü / sunum) aynı ayrımı.

| Aile | Kayıt | Aile | Kayıt |
|------|------:|------|------:|
| Yapı çelikleri (EN 10025) | 9 | Nikel alaşımları | 5 |
| Islah/sementasyon (EN 10083/10084) | 12 | Bakır alaşımları | 6 |
| Yay çelikleri (EN 10089) | 3 | Titanyum | 3 |
| Paslanmaz (EN 10088) | 10 | Magnezyum | 3 |
| Dökme çelik (EN 10293) | 4 | Diğer metaller | 4 |
| Dökme demir (EN 1561/1563/1562/16079) | 11 | Polimerler | 15 |
| Alüminyum — dövme (EN 755/485) | 11 | Elastomerler | 5 |
| Alüminyum — döküm (EN 1706) | 5 | Seramik ve cam | 6 |

**KATALOG BİR SERTİFİKA DEĞİL** ve panel bunu listenin ÜSTÜNDE yazıyor
(altında değil): değerler standardın **nominal** değerleri, gerçek bir dökümün
muayene belgesi değil. Nominal değeri ölçülmüş değer sanmak bu modülün en pahalı
sessiz hatası olurdu. Hepsi **20 °C** içindir.

**Kayıt KOPYA olarak gidiyor, referans olarak değil.** Kütüphane sürümü
değişip bir değer düzeltilse bile kaydedilmiş proje **kendiliğinden değişmez**;
`lib` + `libVer` yalnız İZ bırakıyor. Bir katalog güncellemesinin kaydedilmiş
bir analizi sessizce değiştirmesi, bu projenin en çok kaçındığı hata sınıfı.

**REFERANS alanlar (λ, c_p) kayda GEÇMİYOR.** Çözücü onları kullanmıyor; düğüme
kopyalamak ileride "bu sayı nereden geldi, güncel mi" sorusunu doğuran ölü veri
olurdu. Panelde soluk basılıyorlar ve etiketleri *(ref.)* diyor.

###### Aynı malzeme ÜÇ ayrı adla anılıyor — arama bunun üstüne kurulu

Sahada aynı çelik `1.4301`, `X5CrNi18-10` ve `AISI 304` olarak geçiyor; aradaki
fark çoğu zaman yalnız **ayıraç** (`1.4301` ↔ `1,4301` ↔ `14301`). Arama üç
katmanlı ve her katman ayrı bir soruya cevap veriyor:

| Katman | Ne yapar | Neyi çözer |
|--------|----------|------------|
| `veStrMatFold` | Türkçe → ASCII katlama | `toLowerCase()` TEK BAŞINA YETMEZ: JS'te `'I'.toLowerCase()` → `'i'` (Türkçe'de `'ı'`), `'İ'` → birleşik noktalı `i`. Katlama olmadan "ISLAH" ve "İNCONEL" hiç bulunmuyordu |
| `veStrMatKey` | ayıraçları **atar** | `1.4301` = `1,4301` = `14301` |
| `veStrMatTokens` | ayıraçlardan **böler** | `"304"` araması `AISI 304`'ü getirir, `AISI 304L`'yi değil |

Son satır ölçülmüş bir düzeltme: parça eşleşmesi eklenmeden önce ikisi de aynı
puanı alıyor, eşitliği alfabetik sıra bozuyor ve **304L, 304'ten önce**
geliyordu. Puanlama kademeli (tam ad 100 · parça 90 · başlangıç 80/70 ·
içerme 50/40 · standart-kategori 20).

**`alt` TEKİL, `fam` PAYLAŞILAN.** Kapı gerçek bir çakışma buldu: `AL995`
(alümina seramik) ile `Al99,5` (saf alüminyum) ayıraçlar atılınca **aynı
anahtara** iniyordu — ρ 3890 ↔ 2710, yani birbirinin yerine geçmesi sessiz ve
ciddi bir hataydı. Aile/atölye terimleri (`sfero`, `pik döküm`) ise bilerek
paylaşılıyor ve `fam` alanında; tekillik kapısı yalnız `alt`'a bakıyor.

###### Katalog kendi kısıtlarını KAYITTA taşıyor

Kütüphaneden seçilen hiçbir malzeme "çözülemez" bir kayıt üretemez (testli,
112 kaydın hepsi). Ama üç sınıf, çözümün **geçerli olmadığını** söylemek
zorunda ve söylüyor:

| Sınıf | Kayıt ne diyor |
|-------|----------------|
| Elastomer (5) | ν → 0,5 → hacimsel kilitlenme; hiperelastik. **Bu çözücü için uygun değil** — kauçuk takoz için Takoz modülü |
| Gri dökme demir + seramik + cam | **Akma göstermez** (σ_ak `null`, 0 değil); basma ≫ çekme ya da Weibull dağılımı → von Mises hükmü yanıltır |
| PTFE, kurşun | Oda sıcaklığında **sürünür**; lineer elastik çözüm yalnız anlık cevabı verir |

`sy: null` ile alanı **hiç koymamak** farklı: kayda yazılmadığı için
`veStrMatValidate` "akma dayanımı yok, emniyet payı hükmü verilemez" uyarısını
üretiyor — yani kısıt kaydın kendisiyle birlikte taşınıyor.

###### Kapı ölçümle kuruldu, tahminle değil

Sayılar ölçülemez (standart değerleri); **tutarlılıkları** ölçülebilir ve
`tests/unit/structural-materials.test.js` beş katmanda onu ölçüyor. En sıkı
kapı türetilen **G = E/2(1+ν)**'nün sınıf penceresine düşmesi: ν 0,30 yerine
0,03 yazılırsa E ve ρ doğru kalır, ν aralık kontrolünden de geçer (0,03 < 0,5)
— yalnız G pencereden çıkar. On mutasyonla ölçüldü, onu da kırmızı.

###### Panel İKİ SÜTUN — ve sağ sütun SEÇİLENİ gösterir, uygulananı değil

Solda katalog (ara · süz · liste), sağda **Malzeme Özellikleri**. "Hangi
malzemeler var" ile "bu malzemenin özellikleri ne" ayrı iki soru ve ikincisi
birincisine bakarken görünmek zorunda.

**ÖNCE BAK, SONRA UYGULA.** Kullanıcı bildirimi (2026-08-24): *"malzeme
kütüphanesinden malzeme seçtiğim zaman 'Uygulanan Malzeme' penceresi üzerinden
malzeme özellikleri görünmüyor. 'Parçaya Uygula' dediğim zaman görünüyor."* —
yani **uygulamak, bakmanın ön koşuluydu**. Artık liste satırına tıklamak
yeterli: bütün özellikler, künye ve üç diyagram anında sağ sütunda.

Karar TEK YERDE (`veStrMatShown`), çünkü paneli çizen yer ile sıcaklık
değerlendiricisini tazeleyen yer AYNI kaydı görmek zorunda; ikisi ayrı
hesaplasaydı sıcaklık satırı önizlemede başka bir malzemeyi anlatırdı.

| Durum | Gösterilen | Alanlar | Alt şerit |
|-------|-----------|---------|-----------|
| Katalogdan **seçili**, uygulanmamış | katalog kaydı | **salt okunur** | **Parçaya Uygula** |
| Seçili = uygulanmış (değişmemiş) | düğümün kaydı | düzenlenebilir | ✓ uygulanmış |
| Seçim yok, kayıt var | düğümün kaydı | düzenlenebilir | — |
| Elle değiştirilmiş kayıt yeniden seçildi | katalog kaydı | salt okunur | Parçaya Uygula (yeniden) |

**Önizlemede alanlar SALT OKUNUR** ve şerit "ÖNİZLEME — henüz uygulanmadı"
diyor. İkisi de gerekli: düzenlenebilir bıraksaydık yazının gideceği bir yer
olmazdı, şerit olmasaydı dolu görünen alanlara bakan kullanıcı uyguladığını
sanırdı. Önizleme düğüme **tek bir alan bile yazmıyor** (testli).

Katalog künye kartı SOL sütundan **kalktı** — aynı sayıları iki kez basmak
olurdu ve dar sütunda listeden yer çalıyordu.

**Tarama durumu OTURUMLUK** (arama metni, seçili kategori/kayıt): `node.data`'ya
yazılsalardı her tuş vuruşu undo yığınına binerdi ve "geri al" malzemeyi değil
arama metnini geri getirirdi. Arama listeyi **yerinde** tazeliyor, paneli değil
— panel yeniden çizilseydi arama kutusu DOM'dan silinir ve odak her harfte
kaybolurdu.

**İZ ÜÇ DURUM anlatıyor** ve üçü farklı şey söylüyor: katalogdan geldi ve
değişmedi / katalogdan geldi ama **elle değişti** (ad artık kaydı anlatmıyor) /
hiç katalogdan gelmedi.

**ÖLÇÜLDÜ (gerçek tarayıcı):** 112 kayıt global olarak yükleniyor, panel
1180×880 ve **kaydırmıyor**, liste 112 satır + **16 aile başlığı**, `1.4301`
yazınca sonuç 1'e iniyor ve **odak arama kutusunda kalıyor**, `X5CrNi18-10`
uygulanınca kayıt `E 200000 · ν 0,3 · ρ 7900 · σ_ak 210 · σ_ç 520 · α 16` +
`lib/libVer` izi, rozet **amber `X5CrNi18-10`**, listede uygulanan satır
işaretli, G **76.923** · K **166.667** · ρ **7,900e-9 ton/mm³**.

> **Aile başlığı sayısı ölçümle düzeldi:** boş sorgu düz alfabetik sıralanırken
> 16 aile için **30 başlık** basılıyordu — aileler birbirinin içine giriyor,
> yapışkan başlık her birkaç satırda değişiyor ve katalog gezilemez oluyordu.
> Arama YOKKEN sıra aileye göre; arama VARKEN başlık hiç basılmıyor, çünkü
> orada sıra puana göre ve başlık koymak sırayı yalanlardı.

**Rozet uzun katalog adlarını kırpmadan önce ayıklıyor:** ham kısaltma
`EN AW-6082 T6` → `EN AW-608…` veriyordu ve bu **başka bir alaşım numarası**
gibi okunuyor. Standart öneki (`EN `, `EN-`) ve parantez içi atılıyor →
`AW-6082 T6`, `AC-43000 T6`, `GJS-500-7`. Tam ad ipucunda.

###### Genişletilmiş veri — sıcaklık · yorulma · sertlik (kullanıcı isteği 2026-08-24)

*"Tipik Ansys'teki gibi"* istendi: sıcaklığa bağlı değerler, Wöhler eğrileri,
sertlik. Katalog üç MODEL katmanıyla genişletildi. Ortak ilke: sayıları
uydurmak yerine **standardın modelini** kurmak ve modelin sınırını sonucun
İÇİNDE taşımak.

| Katman | Ne | Kaynak |
|--------|-----|--------|
| `VE_STR_MAT_TEMP_SETS` (12 eğri) | k_E(θ), k_Y(θ), k_P(θ) | EN 1993-1-2 Tablo 3.1 · EN 1993-1-2 Ek C · EN 1999-1-2 + 8 tipik seyir |
| `VE_STR_MAT_FAT_SETS` (13 takım) | σ_W = f_W·R_m, Basquin k, diz N_D, ikinci eğim k₂ | FKM Richtlinie (8) + 5 tipik |
| Kayıt başına | HB / HV / Shore D / Shore A · uzama A% · azami servis °C | standart + el kitabı |

**MALZEME BAŞINA DEĞİL SINIF BAŞINA EĞRİ.** S235 ile S355 aynı k(θ) eğrisini
paylaşır; azalan şey mutlak dayanım değil, 20 °C değerine ORAN. 112 kayda 112
eğri yazmak hem yanlış hem bakımsız olurdu.

**İKİ AYRI GÜVEN DÜZEYİ VE PANELDE AYRI AYRI YAZILI:** `tur:'std'` bir
standardın TABLOSU, `tur:'tipik'` el kitabının SEYRİ. Ayrım gizlenseydi
kullanıcı ikisini aynı ağırlıkta okurdu — kataloğun "nominal ≠ sertifika"
kuralının sıcaklık tarafındaki karşılığı. Testi hangi eğrinin hangi sınıfta
olduğunu SABİTLİYOR: bir el kitabı eğrisini sessizce `'std'`ye yükseltmek
üstteki genel testten GEÇİYORDU (mutasyonla ölçüldü).

**k_Y 400 °C'ye kadar 1,000 KALIR ve bu doğrudur.** EN 1993-1-2'nin k_Y'si %2
gerinimdeki ETKİN akma dayanımı; elastik sınır çoktan düşmüştür ve onu k_P
anlatıyor (200 °C'de 0,807, 400 °C'de 0,420). Yalnız k_Y basılsaydı kullanıcı
"400 °C'ye kadar hiçbir şey olmuyor" diye okurdu — ikisi birden basılıyor.

**ALÜMİNYUMUN GERÇEK DAYANMA SINIRI YOKTUR.** S-N eğrisi dizden sonra da
düşer (`k2`), o yüzden "sonsuz ömür" bölgesi ÇİZİLMEZ; çelikte çizilir.
Yataylık gösterilseydi olmayan bir güvenlik anlatılmış olurdu.

**MODELİN GEÇERLİLİK SINIRI ÇİZİMDE.** Basquin doğrusu geriye uzatılınca R_m'yi
aşar (S355: σ_a(10³) ≈ 840 MPa, R_m 470) — orası düşük çevrimli yorulma
bölgesi ve model orada geçerli DEĞİL. Eğri R_m'de kesiliyor, kesilen bölge
grafikte taranıyor ve "LCF — model dışı" yazıyor. `f_W` ayrıca İŞLENMEMİŞ
malzeme içindir: yüzey pürüzlülüğü, boyut, çentik ve ortalama gerilme etkileri
(FKM K_WK çarpanları) DAHİL DEĞİL ve bu diyagramın altında yazılı.

**SERTLİK ÖLÇEĞİ SINIFA GÖRE:** metalde Brinell, seramikte Vickers,
termoplastikte Shore D, elastomerde Shore A. Hepsini tek sayıya indirmek
yanlış olurdu — Shore A 70 ile HB 70 aynı büyüklük bile değil. Kapı **Rm/HB**
oranını sınıf penceresinde arıyor (ISO 18265: alaşımsız çelikte ≈ 3,38; gri
dökme demirde grafit lamelleri yüzünden 1,2–1,5; titanyumda ≈ 2,8) — bir σ_ç
ya da HB ondalık kayması buradan yakalanıyor.

###### Üç diyagram — hepsi KAYITTAN türüyor

| Diyagram | Neyi anlatıyor | Sınırı |
|----------|----------------|--------|
| σ–ε | E eğimi, akma, çekme, kopma uzaması | **İdealleştirilmiş**: dört sayı gerçek, aralarındaki biçim değil |
| Wöhler (S-N) | dayanma sınırı, diz, LCF bölgesi | **Ölçülmüş değil**, FKM modeli; yüzey/boyut/çentik dahil değil |
| k(θ) | ısındığında ne kaybedilir | Kaynağı ve türü (std/tipik) etikette |

Tablodaki sayı ile diyagram **AYNI kaynaktan** besleniyor; ayrı bir veriden
çizilseydi ikisi sessizce ayrışırdı. Kapı iki şey arıyor: hiçbir koordinat
NaN/Infinity olmasın (eksik bir alan bozuk bir yol üretir ve tarayıcı onu
ÇİZMEZ, hata da vermez) ve çizilen şey kaydın anlattığıyla tutarlı olsun
(gevrekte akma çizgisi yok, alüminyumda dayanma sınırı yok).

**Sıcaklıkta Değerlendir** satırı eğriyi okumak yerine SAYIYI veriyor: θ
yazılıyor, E(θ) ve σ_ak(θ) basılıyor. Seçilen θ OTURUMLUK — bir okuma tercihi
undo yığınına binmemeli. Azami servis sıcaklığı aşılırsa uyarıyor (sürünme ve
kalıcı hasar bu modelde YOK).

**Diyagramlar yalnız KATALOG kaydında.** Elle girilen altı sayı sertlik, uzama,
sıcaklık eğrisi ve yorulma modelini üretmeye yetmez; panel bunu SÖYLÜYOR —
sessiz bırakılsaydı kullanıcı "neden grafik çıkmıyor" diye kendinde arardı.

###### Panel oranı TERSİNE çevrildi

Kullanıcı bildirimi: *"'Malzeme Kütüphanesi' kısmı çok geniş olmuş."* Katalog
listesi bir ad + bir sayıdan ibaret; genişlik ona değil diyagramlara lazım.
Sütunlar **300 px ↔ kalan her şey** oldu (ölçüldü: 300 ↔ 846 px). Liste
satırından ρ da çıkarıldı — üçüncü kolon satırı üç satıra taşırıyordu.
Uygulanan kayıt panel açılınca listede **görünür yapılıyor**: 112 satırda
ekranın dışında kalan bir ✓ hiçbir şey söylemez.

**ÖLÇÜLDÜ (gerçek tarayıcı, S355JR):** panel 1180×968 ve kaydırmıyor · sütunlar
300 ↔ 846 px · üç diyagram 401×200 ve çizgilerin hesaplanmış `stroke` değeri
gerçek renk (`none` DEĞİL — rapordaki jeton dersi) · künye `150 HBW · Rm/HB
3,13 · A %22 · 400 °C · σ_W 212 MPa · 45,2 kN·m/kg` · θ 20 → 500 yazınca
E `210.000 → 126.000` MPa ve σ_ak `355 → 277` MPa, odak kutuda KALIYOR ·
servis sıcaklığı aşılınca uyarı çıkıyor · konsol hatası yok.

Kapı **14 mutasyonla** ölçüldü, on dördü de kırmızı.

