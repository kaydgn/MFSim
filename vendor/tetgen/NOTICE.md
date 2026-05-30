# TetGen — Üçüncü Taraf Bileşen Lisans Bildirimi

## Bileşen

**TetGen** v1.6.0 — A Quality Tetrahedral Mesh Generator and 3D Delaunay
Triangulator

- Yazar: Hang Si (Weierstrass Institute for Applied Analysis and
  Stochastics, WIAS Berlin)
- Yukarı kaynak: https://codeberg.org/TetGen/TetGen
- Akademik atıf: Hang Si, "TetGen, a Delaunay-Based Quality Tetrahedral
  Mesh Generator". ACM Trans. on Mathematical Software. 41 (2), 2015

## Lisans

TetGen v1.5.0 ve sonrası **GNU Affero General Public License v3.0
(AGPL-3.0)** ile lisanslanmıştır. Tam metin: `LICENSE.txt`.

AGPL-3.0'ın temel yükümlülükleri:

1. **Kaynak kod açıklama**: TetGen içeren bir programı dağıttığınızda
   (binary, network service, web uygulaması) kullanıcıya tam kaynak kodu
   sağlamalısınız.
2. **Copyleft**: TetGen'i kapsayan birleşik çalışmalar AGPL-3.0 altında
   dağıtılmalıdır.
3. **Network klozu (AGPL'ye özel)**: TetGen'i bir ağ üzerinden hizmet
   olarak sunarsanız (örneğin web uygulamasında çalıştırırsanız),
   kullanıcılara kaynak kodu sağlama zorunluluğu da uygulanır.

## MFSim İçin Anlamı

MFSim ana proje lisansı ISC'dir. TetGen WASM modülü dağıtıma dahil
edildiğinde (yani `vendor/tetgen/tetgen-wasm.wasm` build edilip
`MFSim_Code.html`'e inline edildiğinde) **bileşik dağıtım AGPL-3.0
yükümlülüklerine tabidir**.

Kullanım modları:

- **Build etmezseniz**: `npm run build:wasm:tetgen` çalıştırmazsanız
  TetGen WASM oluşmaz, dağıtım yapmazsanız AGPL tetiklenmez. Tet mesh
  özelliği graceful olarak devre dışı kalır — voxel fallback'e döner.
- **Build ederseniz ve dağıtırsanız**: AGPL-3.0 yükümlülükleri başlar.
  MFSim'in kullandığı TetGen kaynak kodunu (`src/fea/tetgen/` altında)
  ve yapılan değişiklikleri kullanıcılara erişilebilir tutmanız gerekir.
  Github repo bunu zaten karşılar.

## Ticari Lisans Alternatifi

WIAS Berlin, AGPL-3.0 dışında **ticari kullanım için ayrı bir lisans**
sunar. AGPL yükümlülüklerinden kaçınmak isteyen ticari kullanıcılar için
önerilen yol budur.

İletişim: `tetgen at wias-berlin.de`

Talebinizde şirketinizi ve faaliyet alanınızı kısaca tanımlayın.

## Yapılan Değişiklikler

MFSim, TetGen kaynak kodunu **değiştirmeden** vendor eder. Ek olarak
`src/fea/tetgen/tetgen_wasm.cpp` dosyası bir C arayüz katmanı sağlar
(MFSim/JS ↔ TetGen). Bu wrapper dosya MFSim projesinin parçasıdır ve
AGPL kapsamına dahildir (TetGen ile bileşik çalışma).

Build çıktıları (`vendor/tetgen/tetgen-wasm.{js,wasm}`) git'e commit
EDİLMEMELİDİR; build sırasında üretilir ve `.gitignore` ile dışlanır.
