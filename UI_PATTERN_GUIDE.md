# MFSim UI Pattern Rehberi — Sensör Sihirbazı Tasarım Sistemi

Tüm bileşen properties panelleri bu pattern'leri kullanmalıdır.

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
