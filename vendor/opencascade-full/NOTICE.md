# Full OpenCASCADE WASM (opencascade.js) — BREP Topoloji Motoru

Bu dizin, gerçek B-Rep topolojisi çıkarımı için **opencascade.js** (OpenCASCADE
Technology'nin WebAssembly portu) dosyalarını barındırır.

## Neden ayrı / opt-in?

- `vendor/opencascade/` içindeki **occt-import-js** (~7 MB) yalnızca *import +
  tessellation* yapar — sadece üçgen mesh verir, topoloji vermez.
- Bu dizindeki **full opencascade.js** (~65 MB WASM) ise `TopoDS_Shape`,
  `TopExp_Explorer`, `BRepAdaptor_Surface/Curve`, Euler-Poincaré gibi gerçek
  B-Rep API'lerini sunar. STEP'ten **kesin** yüz/kenar/köşe + tip (Plane,
  Cylinder, Circle, Line, BSpline...) çıkarılır — feature-recognition tahmini
  değil, CAD kernel'in doğrudan çıktısı.

## Boyut & dağıtım

- WASM dosyası **~65 MB** olduğu için **git'e commit EDİLMEZ** (`.gitignore`).
- `MFSim_Code.html` tek-dosya derlemesine **inline edilmez** (87MB HTML olurdu).
- Runtime'da **lazy-load** edilir: kullanıcı STEP yükleyip "Topolojiyi Tara"
  dediğinde, bu dizinden async indirilir (self-host).
- **Deploy:** Bu iki dosyayı (`opencascade.wasm.js`, `opencascade.wasm.wasm`)
  web sunucunuzda `vendor/opencascade-full/` yolundan servis edin.

## Hazırlama

```bash
npm install opencascade.js   # ~65MB bağımlılık (opsiyonel)
npm run occt:full            # node_modules → vendor/opencascade-full/
```

## Lisans

OpenCASCADE Technology — **LGPL-2.1** (exception ile). Ticari kullanım için
OpenCASCADE'in lisans istisnalarını inceleyin. opencascade.js (Sebastian
Alff) — kendi lisansı altında dağıtılır. Detay: node_modules/opencascade.js/LICENSE.

TetGen tet mesher'a benzer şekilde bu bileşen de opt-in'dir; build edilmemişse
(dosyalar yoksa) sistem otomatik olarak hafif occt-import-js + feature
recognition fallback'ine döner.
