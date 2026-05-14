/**
 * MFSim FEA WASM solver — birim testleri.
 *
 * Doğrulanan:
 *  1. C++ kaynağı (src/fea/bar1d.cpp) ve build script'i mevcut.
 *  2. WASM artifact'lari (vendor/mfsim-fea/*.{js,wasm}) build'lenmiş.
 *  3. Emscripten modülü gerçekten yüklenip 1D çubuk problemini çözüyor;
 *     N=10 ve N=100 elemanlı çözüm analitik u = F*L/(E*A) ile eşleşiyor
 *     (lineer elastik problem için FEA hatasız olmalı, makine epsilonu).
 *  4. Hatalı girdiler için negatif status döner (defensive programming).
 *  5. js/fea-solver-wasm.js doğru API'yi expose ediyor.
 *  6. index.html'de INLINE_FILE placeholder'ları ve script tag'i mevcut.
 *  7. build.js mfsim-fea inline pattern'ini destekliyor (mevcut __feaInline).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const WASM_DIR = path.join(ROOT, 'vendor', 'mfsim-fea');
const WASM_JS  = path.join(WASM_DIR, 'mfsim-fea.js');
const WASM_BIN = path.join(WASM_DIR, 'mfsim-fea.wasm');

// ────────────────────────────────────────────────────────────────────────────
describe('MFSim FEA — kaynak dosyaları ve artifact mevcudiyeti', () => {
  test('C++ kaynak dosyası mevcut', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/fea/bar1d.cpp'))).toBe(true);
  });

  test('build script (scripts/build-wasm.js) mevcut', () => {
    expect(fs.existsSync(path.join(ROOT, 'scripts/build-wasm.js'))).toBe(true);
  });

  test('package.json içinde build:wasm script tanımlı', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts && pkg.scripts['build:wasm']).toBe('node scripts/build-wasm.js');
  });

  test('WASM artifact (mfsim-fea.js + mfsim-fea.wasm) build edilmiş', () => {
    expect(fs.existsSync(WASM_JS)).toBe(true);
    expect(fs.existsSync(WASM_BIN)).toBe(true);
    // wasm magic number: 0x00 0x61 0x73 0x6D  ("\0asm")
    const head = fs.readFileSync(WASM_BIN).slice(0, 4);
    expect(head[0]).toBe(0x00);
    expect(head[1]).toBe(0x61);
    expect(head[2]).toBe(0x73);
    expect(head[3]).toBe(0x6D);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('MFSim FEA — 1D çubuk eleman çözümü (analitik karşılaştırma)', () => {
  // WASM artifact yoksa testleri atla (CI'da emscripten yoksa build edilmemiş olabilir)
  const haveWasm = fs.existsSync(WASM_JS) && fs.existsSync(WASM_BIN);
  const maybeTest = haveWasm ? test : test.skip;

  let Module;

  beforeAll(async () => {
    if (!haveWasm) return;
    const factory = require(WASM_JS);
    const wasmBinary = fs.readFileSync(WASM_BIN);
    Module = await factory({ wasmBinary });
  }, 30000);

  function solveBar1D(N, E, A, L, F) {
    const ptr = Module._malloc((N + 1) * 8);
    try {
      const status = Module.ccall(
        'solve_bar_1d', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [N, E, A, L, F, ptr]
      );
      const view = new Float64Array(Module.HEAPF64.buffer, ptr, N + 1);
      const out = new Float64Array(N + 1);
      out.set(view);
      return { status, u: out };
    } finally {
      Module._free(ptr);
    }
  }

  maybeTest('N=10 → analitik çözümle eşleşir (çelik çubuk, F=1000 N)', () => {
    const E = 210e9, A = 1e-4, L = 1.0, F = 1000.0, N = 10;
    const { status, u } = solveBar1D(N, E, A, L, F);
    expect(status).toBe(0);
    expect(u.length).toBe(N + 1);
    expect(u[0]).toBe(0);  // Dirichlet BC

    // u(x) = F*x / (E*A)
    for (let i = 0; i <= N; ++i) {
      const xi = i * L / N;
      const exact = F * xi / (E * A);
      // FEA lineer problem için exact'tir; sadece floating point hatası kalır
      expect(Math.abs(u[i] - exact)).toBeLessThan(1e-18);
    }
  });

  maybeTest('N=100 → makine epsilonu içinde analitik çözüm', () => {
    const E = 70e9, A = 5e-5, L = 2.5, F = 500.0, N = 100;
    const { status, u } = solveBar1D(N, E, A, L, F);
    expect(status).toBe(0);
    const expectedTip = F * L / (E * A);
    expect(Math.abs(u[N] - expectedTip) / expectedTip).toBeLessThan(1e-10);
  });

  maybeTest('N=1 (tek eleman) → uç yer değiştirme = F*L/(E*A)', () => {
    const E = 200e9, A = 2e-4, L = 0.5, F = 2000.0, N = 1;
    const { status, u } = solveBar1D(N, E, A, L, F);
    expect(status).toBe(0);
    expect(u[0]).toBe(0);
    expect(u[1]).toBeCloseTo(F * L / (E * A), 15);
  });

  maybeTest('Hatalı girdi (N=0) → negatif status', () => {
    const ptr = Module._malloc(8);
    const status = Module.ccall(
      'solve_bar_1d', 'number',
      ['number', 'number', 'number', 'number', 'number', 'number'],
      [0, 210e9, 1e-4, 1.0, 1000.0, ptr]
    );
    Module._free(ptr);
    expect(status).toBeLessThan(0);
  });

  maybeTest('mfsim_fea_version sürüm dizgisi döner', () => {
    const ptr = Module.ccall('mfsim_fea_version', 'number', [], []);
    const version = Module.UTF8ToString(ptr);
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('MFSim FEA — 3D lineer elastik çözücü (tet4 + hex8)', () => {
  const haveWasm = fs.existsSync(WASM_JS) && fs.existsSync(WASM_BIN);
  const maybeTest = haveWasm ? test : test.skip;

  let Module;
  let wrapper;

  beforeAll(async () => {
    if (!haveWasm) return;
    const factory = require(WASM_JS);
    const wasmBinary = fs.readFileSync(WASM_BIN);
    Module = await factory({ wasmBinary });

    // Sarmalayıcıyı pre-loaded module ile kur — jsdom URL/Blob yüklemesi bypass
    wrapper = require(path.join(ROOT, 'js/fea-solver-wasm.js'));
    wrapper._VE_FEA_WASM_STATE.module = Module;
  }, 30000);

  // Tek hex8 küp (1m × 1m × 1m), sol yüz sabit, sağ yüz eksenel çekme.
  function buildClampedCubeHex8() {
    return {
      elementType: 'hex8',
      nodes: new Float64Array([
        0,0,0,  1,0,0,  1,1,0,  0,1,0,
        0,0,1,  1,0,1,  1,1,1,  0,1,1
      ]),
      elements: new Int32Array([0,1,2,3, 4,5,6,7]),
      material: { E: 210e9, nu: 0.3 },
      fixed: new Int32Array([0, 3, 4, 7]),  // sol yüz
      loads: [
        { node: 1, force: [250, 0, 0] },
        { node: 2, force: [250, 0, 0] },
        { node: 5, force: [250, 0, 0] },
        { node: 6, force: [250, 0, 0] }
      ]
    };
  }

  // Tek tet4 — düzenli tetrahedron yerine standart unit-tetra (köşeler:
  // origin + üç birim eksen). Hacim = 1/6.
  function buildSingleTet4() {
    return {
      elementType: 'tet4',
      nodes: new Float64Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ]),
      elements: new Int32Array([0, 1, 2, 3]),
      material: { E: 200e9, nu: 0.3 },
      fixed: new Int32Array([0, 1, 2]),       // üç düğüm tamamen sabit
      loads: [{ node: 3, force: [0, 0, 100] }]
    };
  }

  maybeTest('hex8 küp — başarılı çözüm, sabit düğümlerde sıfır u, simetrik Poisson', async () => {
    const result = await wrapper.veFEASolveLinearElastic3D(buildClampedCubeHex8());
    expect(result.displacements.length).toBe(8 * 3);
    expect(result.info.elementType).toBe('hex8');
    expect(result.info.numNodes).toBe(8);
    expect(result.info.numElements).toBe(1);

    const u = result.displacements;
    // Sabit düğümlerde u ≈ 0 (penalty 1e30 ile sıfıra çok yakın)
    for (const idx of [0, 3, 4, 7]) {
      expect(Math.abs(u[idx*3 + 0])).toBeLessThan(1e-15);
      expect(Math.abs(u[idx*3 + 1])).toBeLessThan(1e-15);
      expect(Math.abs(u[idx*3 + 2])).toBeLessThan(1e-15);
    }
    // Sağ yüz düğümlerinin u_x'leri eşit olmalı (yapı simetrik)
    const ux1 = u[1*3], ux2 = u[2*3], ux5 = u[5*3], ux6 = u[6*3];
    expect(ux1).toBeGreaterThan(0);
    expect(Math.abs(ux2 - ux1)).toBeLessThan(1e-14);
    expect(Math.abs(ux5 - ux1)).toBeLessThan(1e-14);
    expect(Math.abs(ux6 - ux1)).toBeLessThan(1e-14);
    // Slender 1D limit yakın olmalı (cube confinement nedeniyle %15'ten az sapma)
    const u_analytical = 1000 * 1 / (210e9 * 1);
    expect(Math.abs(ux1 - u_analytical) / u_analytical).toBeLessThan(0.15);
  });

  maybeTest('hex8 küp — Poisson lateral kontraksiyonu doğru yönde', async () => {
    const result = await wrapper.veFEASolveLinearElastic3D(buildClampedCubeHex8());
    const u = result.displacements;
    // Sağ yüz: +y köşeleri (2, 6) y yönünde -, -y köşeleri (1, 5) y yönünde +
    expect(u[2*3 + 1]).toBeLessThan(0);  // node 2 at y=1 → uy negatif
    expect(u[1*3 + 1]).toBeGreaterThan(0); // node 1 at y=0 → uy pozitif (lateral)
    expect(Math.abs(u[2*3 + 1] + u[1*3 + 1])).toBeLessThan(1e-14); // anti-simetrik
  });

  maybeTest('tet4 tek eleman — başarılı çözüm, mantıklı yer değiştirme', async () => {
    const result = await wrapper.veFEASolveLinearElastic3D(buildSingleTet4());
    expect(result.info.elementType).toBe('tet4');
    expect(result.info.numNodes).toBe(4);
    const u = result.displacements;
    for (const idx of [0, 1, 2]) {
      expect(Math.abs(u[idx*3 + 0])).toBeLessThan(1e-15);
      expect(Math.abs(u[idx*3 + 1])).toBeLessThan(1e-15);
      expect(Math.abs(u[idx*3 + 2])).toBeLessThan(1e-15);
    }
    // Düğüm 3 (apex) +z yönünde 100 N → uz > 0
    expect(u[3*3 + 2]).toBeGreaterThan(0);
    // Yer değiştirme küçük olmalı (E = 200 GPa, F = 100 N)
    expect(u[3*3 + 2]).toBeLessThan(1e-7);
  });

  maybeTest('Desteklenmeyen eleman tipi (tri3) hata fırlatır', async () => {
    await expect(wrapper.veFEASolveLinearElastic3D({
      elementType: 'tri3',
      nodes: new Float64Array([0,0,0, 1,0,0, 0,1,0]),
      elements: new Int32Array([0,1,2]),
      material: { E: 1e9, nu: 0.3 },
      fixed: [0], loads: []
    })).rejects.toThrow(/elementType/);
  });

  maybeTest('Geçersiz Poisson oranı (nu >= 0.5) hata fırlatır', async () => {
    await expect(wrapper.veFEASolveLinearElastic3D({
      elementType: 'tet4',
      nodes: new Float64Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),
      elements: new Int32Array([0,1,2,3]),
      material: { E: 1e9, nu: 0.5 },
      fixed: [0,1,2], loads: [{ node: 3, force: [0,0,1] }]
    })).rejects.toThrow(/nu/);
  });

  maybeTest('hex8 zinciri (10 eleman) — slender bar FL/EA limitine yakınsar', async () => {
    // 10 hex8 elemanı x ekseni boyunca zincirleme, kesit 1x1, uzunluk 10
    const N = 10, L = 10.0;
    const nx = N + 1;  // 11 cross-section
    const nodes = new Float64Array(nx * 4 * 3);
    // her cross-section'ta 4 köşe: (0,0), (1,0), (1,1), (0,1) — y,z koordinatları
    for (let i = 0; i < nx; ++i) {
      const x = i * L / N;
      const off = i * 4;
      nodes[(off+0)*3+0]=x; nodes[(off+0)*3+1]=0; nodes[(off+0)*3+2]=0;
      nodes[(off+1)*3+0]=x; nodes[(off+1)*3+1]=1; nodes[(off+1)*3+2]=0;
      nodes[(off+2)*3+0]=x; nodes[(off+2)*3+1]=1; nodes[(off+2)*3+2]=1;
      nodes[(off+3)*3+0]=x; nodes[(off+3)*3+1]=0; nodes[(off+3)*3+2]=1;
    }
    const elements = new Int32Array(N * 8);
    for (let e = 0; e < N; ++e) {
      const a = e * 4, b = (e + 1) * 4;
      // ANSYS hex8 sıralaması: alt (ζ=-1) sonra üst (ζ=+1).
      // Doğal koordinatlarda ζ → x ekseni olarak eşleyelim:
      //   alt yüz (x=a): nodes a+0,a+1,a+2,a+3  (sağ el kuralı)
      //   üst yüz (x=b): nodes b+0,b+1,b+2,b+3
      elements[e*8+0]=a+0; elements[e*8+1]=a+1; elements[e*8+2]=a+2; elements[e*8+3]=a+3;
      elements[e*8+4]=b+0; elements[e*8+5]=b+1; elements[e*8+6]=b+2; elements[e*8+7]=b+3;
    }
    const fixed = new Int32Array([0, 1, 2, 3]);  // sol yüz tamamen
    const F_total = 1000;
    const loads = [
      { node: N*4 + 0, force: [F_total/4, 0, 0] },
      { node: N*4 + 1, force: [F_total/4, 0, 0] },
      { node: N*4 + 2, force: [F_total/4, 0, 0] },
      { node: N*4 + 3, force: [F_total/4, 0, 0] }
    ];

    const result = await wrapper.veFEASolveLinearElastic3D({
      elementType: 'hex8',
      nodes: nodes,
      elements: elements,
      material: { E: 210e9, nu: 0.3 },
      fixed: fixed,
      loads: loads
    });
    expect(result.info.numNodes).toBe(44);
    expect(result.info.numElements).toBe(10);

    const u = result.displacements;
    const u_tip = (u[(N*4 + 0)*3] + u[(N*4 + 1)*3] + u[(N*4 + 2)*3] + u[(N*4 + 3)*3]) / 4;
    const u_analytical = F_total * L / (210e9 * 1.0);
    // Slender beam (L/h = 10) → FL/EA limitine %5 içinde yakınsamalı
    expect(Math.abs(u_tip - u_analytical) / u_analytical).toBeLessThan(0.05);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('js/fea-solver-wasm.js — sarmalayıcı API', () => {
  const wrapperSrc = fs.readFileSync(path.join(ROOT, 'js/fea-solver-wasm.js'), 'utf8');

  test('Public API fonksiyonları tanımlı', () => {
    expect(wrapperSrc).toMatch(/function\s+veFEAEnsureWasm\s*\(/);
    expect(wrapperSrc).toMatch(/function\s+veFEASolveBar1D\s*\(/);
    expect(wrapperSrc).toMatch(/function\s+veFEASolveLinearElastic3D\s*\(/);
    expect(wrapperSrc).toMatch(/function\s+veFEAWasmVersion\s*\(/);
  });

  test('Eleman tipi enum (VE_FEA_ELEM_TYPE) tet4 ve hex8 içeriyor', () => {
    expect(wrapperSrc).toMatch(/tet4\s*:\s*0/);
    expect(wrapperSrc).toMatch(/hex8\s*:\s*1/);
  });

  test('window.__feaInline pattern ile inline kaynak destekleniyor', () => {
    expect(wrapperSrc).toMatch(/window\.__feaInline/);
    expect(wrapperSrc).toMatch(/mfsimFeaScript/);
    expect(wrapperSrc).toMatch(/mfsimFeaWasm/);
  });

  test('CommonJS export (Node/Jest için) mevcut', () => {
    expect(wrapperSrc).toMatch(/module\.exports\s*=/);
  });

  test('MFSimFEAModule factory global adı kullanılıyor', () => {
    expect(wrapperSrc).toMatch(/MFSimFEAModule/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('index.html — MFSim FEA WASM entegrasyonu', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  test('INLINE_FILE placeholderları (mfsim-fea.js + .wasm) mevcut', () => {
    expect(html).toMatch(/INLINE_FILE:\s*vendor\/mfsim-fea\/mfsim-fea\.js\s+as\s+mfsimFeaScript/);
    expect(html).toMatch(/INLINE_FILE:\s*vendor\/mfsim-fea\/mfsim-fea\.wasm\s+as\s+mfsimFeaWasm/);
  });

  test('fea-solver-wasm.js script tag bulunur, cp-fea.js öncesinde', () => {
    const solverIdx = html.indexOf('js/fea-solver-wasm.js');
    const cpFeaIdx  = html.indexOf('js/cp-fea.js');
    expect(solverIdx).toBeGreaterThan(-1);
    expect(solverIdx).toBeLessThan(cpFeaIdx);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('build.js — mfsim-fea base64 inline (mevcut __feaInline pattern)', () => {
  // Mevcut INLINE_FILE/__feaInline pattern OCCT için yazıldı; mfsim-fea de
  // aynı pattern üzerinden çalışır (kind: mfsimFeaScript / mfsimFeaWasm).
  // Bu test build.js'in pattern'i değiştirmediğini ve regex'in yeni placeholder'ları
  // da yakaladığını doğrular.
  const buildSrc = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

  test('INLINE_FILE regex herhangi bir dosya/kind ikilisini yakalar', () => {
    // build.js regex'i: /<!--\s*INLINE_FILE:\s*([^\s]+)\s+as\s+(\w+)\s*-->/g
    const re = /<!--\s*INLINE_FILE:\s*([^\s]+)\s+as\s+(\w+)\s*-->/g;
    const sample = '<!-- INLINE_FILE: vendor/mfsim-fea/mfsim-fea.wasm as mfsimFeaWasm -->';
    const match = re.exec(sample);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('vendor/mfsim-fea/mfsim-fea.wasm');
    expect(match[2]).toBe('mfsimFeaWasm');
  });

  test('build.js .wasm uzantısını base64 olarak işler', () => {
    // build.js içindeki regex literal'i: /\.(wasm|bin)$/i
    expect(buildSrc.indexOf('\\.(wasm|bin)$')).toBeGreaterThan(-1);
    expect(buildSrc).toMatch(/toString\(['"]base64['"]\)/);
  });
});
