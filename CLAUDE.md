# MFSim - Claude Code Talimatları

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (monolitik)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `tests/unit/` — Jest birim testleri
- `tests/e2e/` — Playwright E2E testleri

**ÖNEMLİ:** Kod değişiklikleri hem `js/` klasöründeki modüler dosyalara hem de `MFSim_Code.html` monolitik dosyasına uygulanmalıdır. İkisi senkron tutulmalıdır.

## Kodlama Sonrası Test Akışı

Her kod değişikliğinden sonra şu adımları izle:

### 1. Birim Testleri (Jest + jsdom)
```bash
npm test
```
Bu komut `tests/unit/` altındaki tüm `*.test.js` dosyalarını çalıştırır.

### 2. E2E Testleri (Playwright - yerel ortam gerektirir)
```bash
npm run test:e2e
```
**Not:** Bu testler Chromium tarayıcısı gerektirir. İlk kurulumda `npx playwright install chromium` çalıştırılmalıdır.

### 3. Her İkisi Birden
```bash
npm run test:all
```

## İki Agent Akışı

Claude Code ile çalışırken şu akışı uygula:

1. **Kodlama Aşaması**: İstenen değişikliği `js/` ve `MFSim_Code.html` dosyalarına uygula
2. **Test Aşaması**: `npm test` çalıştır
   - Testler başarısızsa → düzelt ve tekrar test et
   - Testler başarılıysa → commit yap
3. **Yeni test yazımı**: Değişiklik yeni bir fonksiyon ekliyorsa, `tests/unit/` altına test ekle

## Test Dosyaları

| Dosya | Test Edilen Modül | Kapsam |
|-------|-------------------|--------|
| `tests/unit/numerics.test.js` | `js/numerics.js` | PCHIP spline, RK45 solver, enerji dengesi |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |

## Sık Kullanılan Komutlar

```bash
npm test              # Birim testlerini çalıştır
npm run test:unit     # Birim testlerini çalıştır (aynı)
npm run test:e2e      # E2E testlerini çalıştır (tarayıcı gerekli)
npm run test:all      # Tümünü çalıştır
```
