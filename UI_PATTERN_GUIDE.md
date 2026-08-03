# MFSim UI Pattern Rehberi — Sensör Sihirbazı Tasarım Sistemi

Tüm bileşen properties panelleri bu pattern'leri kullanmalıdır.

> **Liste/ağaç panelleri için ayrı bölüm var:** Veri Gezgini'nin ölçüm kanalı
> listesi `vsig-*` sınıflarını kullanır (bkz. en alttaki "Ölçüm Kanalı Listesi").
> Yeni bir sinyal/kanal listesi yazarken oradaki kurallara uyun.

## Ana Container
```javascript
html += '<div class="sw-panel">';
// ... tüm içerik ...
html += '</div>';
```

## Durum Çubuğu (Her bileşenin en üstünde)
```javascript
// Veri yüklü
html += '<div class="sw-status-bar installed">';
html += '<span class="sw-status-dot"></span>';
html += '<span>Veri Yüklendi</span>';
html += '<span style="margin-left:auto;font-weight:400;font-size:0.56rem;opacity:0.8;">5 veri noktası</span>';
html += '</div>';

// Veri yok
html += '<div class="sw-status-bar not-installed">';
html += '<span class="sw-status-dot"></span>';
html += '<span>Veri Girilmedi</span>';
html += '</div>';
```

## Bölüm Başlığı (UPPERCASE, alt çizgi)
```javascript
html += '<div class="sw-section-title">MOTOR SEÇİMİ</div>';
```

## Kart Container (Başlık + Gövde)
```javascript
html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
html += '<div class="sw-pkg-header" style="cursor:default;">';
html += '<span class="sw-pkg-name">Kart Başlığı</span>';
html += '<button class="sw-info-btn" onclick="..." title="Bilgi">?</button>';
html += '</div>';
html += '<div class="sw-pkg-body">';
// ... kart içeriği ...
html += '</div></div>';
```

## Açıklama Metni
```javascript
html += '<div class="sw-pkg-desc">Açıklama metni buraya.</div>';
```

## Butonlar
```javascript
html += '<div class="sw-btn-row" style="margin:8px 0;">';
html += '<button class="sw-btn sw-btn-primary" onclick="...">Kaydet</button>';
html += '<button class="sw-btn sw-btn-outline" onclick="...">İptal</button>';
html += '<button class="sw-btn sw-btn-danger" onclick="...">Sil</button>';
html += '</div>';
```

## Uyarı / Bilgi Çubuğu
```javascript
// Başarılı
html += '<div class="sw-chain-bar ok">✓ Topoloji zinciri tamamlandı</div>';
// Hata
html += '<div class="sw-chain-bar fail">✗ Eksik bileşen var</div>';
```

## Badge (Durum Etiketi)
```javascript
html += '<span class="sw-pkg-badge ok">Kurulu</span>';
html += '<span class="sw-pkg-badge partial">Kısmi</span>';
html += '<span class="sw-pkg-badge miss">Eksik</span>';
```

## Info Butonu (Kare, transparent)
```javascript
html += '<button class="sw-info-btn" onclick="showInfoPopup(\'id\')" title="Bilgi">?</button>';
```

## Font Boyutları
| Kullanım | Boyut |
|----------|-------|
| Durum çubuğu | 0.64rem |
| Bölüm başlığı | 0.62rem |
| Kart başlığı | 0.62rem (sw-pkg-name) |
| Kart gövde | 0.58rem |
| Açıklama | sw-pkg-desc (CSS'de tanımlı) |
| Tablo | 0.68rem |
| Legend | 0.56rem |
| Alt bilgi | 0.54rem |
| Badge | 0.52rem |

---

## Ölçüm Kanalı Listesi (`vsig-*`) — Veri Gezgini

Sinyal/kanal listeleri `js/signal-tree.js` + `css/styles.css` içindeki
`vsig-*` sistemini kullanır. Kurallar pazarlık konusu değil: bu listede
"profesyonel" hissini veren şey hizadır, süs değil.

### 1. Tek satır ritmi
Grup başlığı da sinyal satırı da `var(--vsig-row)` = **22px**. İstisna yok.
Farklı yükseklikte satırlar listeyi el yapımı gösterir.

### 2. Girinti tek kuralla
```css
padding-left: calc(var(--vsig-pad) + var(--vsig-indent));
```
JS'te `padding-left:' + (indent + 16) + 'px'` gibi elle hesap **YASAK**.
Yeni seviye gerekirse `--vsig-indent` çarpanı kullanılır.

### 3. Durum satırın kendisinde okunur
| Öğe | Anlamı |
|-----|--------|
| `.vsig-ck` (`.on` / `.some` / `.all`) | Sinyal hedef panelde çizili mi |
| `.vsig-sw` | Paneldeki eğri rengi. Çizili değilse `.off` → nötr kutu (rengi henüz yok) |
| `.vsig-badge` | Grupta kaç sinyal çizili (`3/6`); sıfırdan büyükse mavi |

### 4. Sütun ızgarası
```css
grid-template-columns: 12px 11px minmax(0,1fr) auto 46px;
/*                     kutu  renk  ad          birim  eğri */
```
Ad sütunu **blok** akışta olmalı (flex değil) — yoksa `text-overflow:ellipsis`
çalışmaz ve uzun adlar sertçe kesilir.

### 5. Renk tek kaynaktan
Listedeki kutucuk, grafikteki eğri, lejant ve tablo **aynı** fonksiyonu çağırır:
```javascript
veSlotSignalColor(slot, idx)   // kullanıcı seçimi varsa o, yoksa palet sırası
```
Yerel `var colors = [...]` dizisi açmayın; ayrışırlar.

### 6. Ağaç panelin aynasıdır
Slotu değiştiren her yol (`veAddSignalToSlot`, `veRemoveSensorFromSlot`,
`veSlotClear`) sonunda `veSigRefreshTree()` çağırır. Toplu işlemde ara
render'lar `veSigSuspendRefresh` sayacıyla bastırılır.

### 7. Arama
`veSigNorm` **uzunluk koruyucudur** — vurgulama indeksleri ham metne
uygulandığı için `toLocaleLowerCase('tr')` kullanılamaz ('İ' iki karakter
üretir). Aksanlar katlanır: "hiz" yazan kullanıcı "Hız"ı bulur.

### 8. Klavye
↑/↓ satır gezinme, Space görünürlük, Enter denetçi (grup başlığında aç/kapa),
Esc denetçiyi kapatır. Her odaklanabilir öğede görünür odak halkası olmalı.


## Ölçüm Penceresi (`ve-trace-*`) — Sonuçlar

Sonuçlar sayfası PANEL SEÇTİRMEZ. Tek bir ölçüm penceresi vardır
(`js/trace-view.js` + `css/styles.css` `ve-trace-*`); Veri Gezgini'nde
işaretlenen her sinyal orada kendi ŞERİDİNE düşer.

### 1. Panel kavramı geri gelmez
"Kaç panel istersiniz?" sorusunun cevabını ölçümden önce kimse bilmiyor.
Yeni bir yerleşim ihtiyacı doğarsa çözüm panel eklemek değil, ŞERİT
eklemektir: şerit yeniden sıralanır, yüksekliği sürüklenir, iki şerit
ortak eksende birleştirilir.

### 2. Bir şerit = bir Y ekseni
Aynı şeritteki sinyaller ortak ölçekte okunur. Bu yüzden birleştirme
YALNIZCA aynı birimde anlamlıdır (`veTrMergeByUnit`). 0–3000 rpm ile
0–100 km/h'yi aynı eksene koymak ikincisini düz çizgiye çevirir.

### 3. Pencere TEK X ekseninde çalışır
Kural `js/measure-core.js`'te (`veSharedXAxis` / `veXAxisAllowed`).
Uymayan bir sinyal ya da sihirbaz diyagramı ağaçta KİLİTLİ görünür;
sessizce farklı eksene düşürülmez.

### 4. Ayrık sinyal basamaklı çizilir
Vites 3'ten 4'e geçerken 3.5'ten geçmez (`veTrIsDiscrete`). Metin değerli
kanallar (vites modu `1C`/`2L`) seviyelere eşlenir ve eksende sayı değil
METNİN KENDİSİ yazılır (`veTrEncodeText`) — CANoe'nun "durum şeridi"
karşılığı.

### 5. İmleç ayrı katmanda
Şeritler `#ve-trace-canvas`'a, imleç ve değer rozetleri
`#ve-trace-overlay`'e çizilir. Aynı canvas kullanılırsa her fare hareketi
bütün serileri yeniden örnekler.

### 6. Zaman ekseni kaydırma dışında
`.ve-trace-axis` ayrı ve SABİT bir canvas'tır: sekiz şeritli bir pencerede
aşağı inince eksen ekrandan çıkmamalı.

### 7. Şerit yüksekliği ve Y kilidi kullanıcı emeğidir
`slot.lanes[].h/min/max` türetilmiş veri değildir; kaydedilir ve
`veTrReconcileLanes` içinde korunur. Yalnız sinyal listesi (`slot.sensors`)
doğruluk kaynağıdır — şerit listesi ona göre onarılır.

### 8. Canvas'a sabit renk yazma
Tema on tane (`slate` … `solidworks`). Vurgu renkleri `veThemeRgba(...)`
ile okunur; ızgara/çerçeve için nötr gri (`rgba(128,128,128,α)`) kullanılır,
çünkü hem koyu hem açık zeminde okunur.
