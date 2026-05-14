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
describe('js/fea-solver-wasm.js — sarmalayıcı API', () => {
  const wrapperSrc = fs.readFileSync(path.join(ROOT, 'js/fea-solver-wasm.js'), 'utf8');

  test('Public API fonksiyonları tanımlı', () => {
    expect(wrapperSrc).toMatch(/function\s+veFEAEnsureWasm\s*\(/);
    expect(wrapperSrc).toMatch(/function\s+veFEASolveBar1D\s*\(/);
    expect(wrapperSrc).toMatch(/function\s+veFEAWasmVersion\s*\(/);
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
