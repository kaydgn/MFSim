# MFSim - Claude Code Talimatları

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (otomatik üretilir, elle düzenlenmez)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `build.js` — Build script (`index.html` + `js/` + `css/` → `MFSim_Code.html`)
- `tests/unit/` — Jest birim testleri
- `tests/e2e/` — Playwright E2E testleri

**ÖNEMLİ:** Kod değişiklikleri **yalnızca** `js/` ve `css/` klasörlerindeki modüler dosyalara ve `index.html`'e yapılır. `MFSim_Code.html` dosyası **elle düzenlenmez** — `npm run build` ile otomatik üretilir.

## Kodlama Sonrası Akış

Her kod değişikliğinden sonra şu adımları izle:

### 1. Build (Monolitik dosyayı üret)
```bash
npm run build
```
Bu komut `index.html` + `css/styles.css` + `js/*.js` dosyalarını birleştirip `MFSim_Code.html` üretir.

### 2. Birim Testleri (Jest + jsdom)
```bash
npm test
```
Bu komut `tests/unit/` altındaki tüm `*.test.js` dosyalarını çalıştırır.

### 3. E2E Testleri (Playwright - yerel ortam gerektirir)
```bash
npm run test:e2e
```
**Not:** Bu testler Chromium tarayıcısı gerektirir. İlk kurulumda `npx playwright install chromium` çalıştırılmalıdır.

### 4. Her İkisi Birden
```bash
npm run test:all
```

## Çalışma Akışı

Claude Code ile çalışırken şu akışı uygula:

1. **Kodlama**: Değişikliği `js/`, `css/` veya `index.html` dosyalarına uygula
2. **Build**: `npm run build` çalıştır → `MFSim_Code.html` otomatik güncellenir
3. **Test**: `npm test` çalıştır
   - Testler başarısızsa → düzelt ve tekrar test et
   - Testler başarılıysa → commit yap (build çıktısı dahil)
4. **Yeni test yazımı**: Değişiklik yeni bir fonksiyon ekliyorsa, `tests/unit/` altına test ekle

## Test Dosyaları

| Dosya | Test Edilen Modül | Kapsam |
|-------|-------------------|--------|
| `tests/unit/numerics.test.js` | `js/numerics.js` | PCHIP spline, RK45 solver, enerji dengesi |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |

## Sık Kullanılan Komutlar

```bash
npm run build               # MFSim_Code.html üret (modüler → monolitik)
npm test                    # Birim testlerini çalıştır
npm run test:unit           # Birim testlerini çalıştır (aynı)
npm run test:e2e            # E2E testlerini çalıştır (tarayıcı gerekli)
npm run test:all            # Tümünü çalıştır
npm run build:wasm          # C++ FEA çözücüsünü WASM'a derle (emscripten gerekli)
npm run build:wasm:tetgen   # TetGen tet mesher'ı WASM'a derle (emscripten + AGPL)
```

## WASM Modülleri

İki ayrı WASM bileşeni vardır; ikisi de opt-in build edilir.

### 1. MFSim FEA (`vendor/mfsim-fea/`)
- Kaynak: `src/fea/{bar1d,solver3d}.cpp`
- Lisans: ISC (proje ile aynı)
- Build: `npm run build:wasm`
- Artifact: `vendor/mfsim-fea/mfsim-fea.{js,wasm}` (commit edilir)

### 2. TetGen Tet Mesher (`vendor/tetgen/`)
- Kaynak: `src/fea/tetgen/{tetgen.h,tetgen.cxx,predicates.cxx,tetgen_wasm.cpp}`
- Lisans: **AGPL-3.0** (Hang Si, WIAS Berlin)
- Build: `npm run build:wasm:tetgen`
- Artifact: `vendor/tetgen/tetgen-wasm.{js,wasm}` (**.gitignore'da, commit edilmez**)
- Detaylı lisans uyarısı: `vendor/tetgen/NOTICE.md`

**Tet mesh kalite kademesi** (STEP / karmaşık geometriler, `_veFEAMeshWithTetMesherOrVoxel`):

1. **TetGen** (üst katman, AGPL WASM) — en yüksek kalite Constrained Delaunay tet4.
2. **Delaunay** (orta katman, saf JS — `js/fea-delaunay.js` + `vendor/delaunay/`, MIT, **her zaman mevcut**, build gerektirmez).
3. **Voxel + boundary-snap** (taban — her zaman çalışır).

TetGen build edilmemişse veya yüklenemezse otomatik olarak Delaunay'a, o da başarısız olursa voxel'a düşülür — kullanıcı her durumda tet4 mesh alır. STEP geometrilerinde en yüksek kalite için TetGen önerilir; ticari kullanım için WIAS Berlin'den lisans gerekir.

> **Not:** `scripts/build-tetgen-wasm.js` emscripten flag'lerini `spawnSync` ile (shell olmadan) geçirir; bu yüzden `-s EXPORT_NAME=...` / `-s ENVIRONMENT=...` değerleri **tek tırnaksız** olmalıdır (tırnaklar literal geçer ve emscripten 4.x+ reddeder).

> **CI/Deploy:** `.github/workflows/ci-deploy.yml` hem test hem deploy job'ında
> emscripten kurar (`setup-emsdk@v14`, EMSDK_VERSION pinli) ve `build:wasm:tetgen`'i
> `npm run build`'den **önce** çalıştırır → TetGen WASM canlı sitede inline ("● aktif").
> **AGPL-3.0:** yayınlanan site bu yükümlülüklere tabidir (bilinçli opt-in karar).

## Mesh Kalite Altyapısı (ANSYS-tarzı)

Mesh kalitesi `js/fea-mesh-smoothing.js` (ISC, saf JS) ve `js/fea-mesh.js` kalite
fonksiyonları ile yönetilir.

### Smoothing (`js/fea-mesh-smoothing.js`)
- **`veFEASmoothMesh(mesh, opts)`** — Smart Laplacian: iç düğümü komşu centroid'ine
  çeker, yalnız lokal MİN kaliteyi artırıyorsa kabul eder (monoton, inverted üretmez).
  Yüzey düğümleri sabit (veya `surfaceProjector` ile yüzeyde tanjant kayar).
  `method:'optimization'` / `optimizeStubborn:true` → çok-yönlü pattern search.
- **`veFEAAutoImproveMesh(mesh, {targetScore, scoreFn})`** — kalite-güdümlü kademeli
  otomatik iyileştirme (smartLaplacian → +optimizeStubborn → optimization). Monoton.
- Unstructured (TetGen/Delaunay/voxel) tet için pipeline'da **varsayılan AÇIK**;
  yapısal primitifler için opt-in (`opts.smoothing`).

### Kalite metrikleri & skor (`js/fea-mesh.js`)
- **`veFEAComputeQualityMetrics`** — aspect, skewness, orthogonal quality, element
  quality, warping, parallel deviation, iç açı + histogramlar.
- **`veFEAComputeJacobianMetrics`** — inverted/degenerate tespiti.
- **`veFEAComputeMeshQualityScore`** — ANSYS-tarzı **0-100 skor + harf notu (A-F)** +
  öneri. Inverted → veto. Mesh editöründe renk-kodlu rozet olarak gösterilir.
- **`veFEAAutoImproveMeshWithScore`** — UI köprüsü (gerçek skoru auto-improve'a enjekte).

### TetGen ANSYS-kalite switch'leri (`js/fea-tetgen.js`)
- `_veFEATetgenBuildSwitches` — `q{ratio}/{angle}` (min dihedral açı, sliver
  engelleme, 18° clamp), `O{level}` (optimization), `a{vol}`, `Y`, `T{tol}`.
- `fea-mesh.js` varsayılan `minDihedralAngle: 10°`.
