#!/usr/bin/env node
/**
 * MFSim — ÖNCESİ/SONRASI ekran görüntüsü aracı
 *
 * Kullanım (kısa):
 *   npm run shot -- --rev HEAD --module fead-analysis --out .shots/oncesi.png
 *   npm run shot --       --module fead-analysis --out .shots/sonrasi.png
 *   npm run shot -- --compose .shots/oncesi.png .shots/sonrasi.png --out .shots/karsilastirma.png
 *
 * NE ZAMAN KULLANILIR
 *
 * YALNIZ kullanıcı istediğinde ("bana ekran görüntüsü at"). Zorunlu bir teslim
 * adımı DEĞİL — 2026-08-18'de bir süre öyleydi, süreci uzattığı için kaldırıldı.
 * Araç duruyor ki istendiğinde tek komut olsun: sunucu kur, giriş yap, modülü
 * seç, senaryoyu kur… derdi burada zaten çözülü.
 *
 * ÜÇ TASARIM KARARI — üçü de karşılaştırmanın sessizce yalan söylememesi için:
 *
 *  1) `--rev` GEÇİCİ WORKTREE açar: ÖNCESİ görüntüsü, düzenlemeler çalışma
 *     kopyasındayken bile alınabiliyor (önceden çekmeyi hatırlamak gerekmiyor).
 *  2) Giriş şifresi BURADA YAZMAZ. `js/auth.js` içindeki SHA-256 özeti okunup
 *     localStorage'a tohumlanır — şifre değişirse araç kendiliğinden uyar,
 *     kopyalanmış bir parola bayatlamaz.
 *  3) `--compose` iki görüntüyü TEK ölçekle yan yana koyar. Ayrı ölçeklenseydi
 *     "kutu büyümüş" gibi görünen bir fark aslında ölçek farkı olurdu.
 *
 * Çıktılar `.shots/` altına yazılır ve git'e GİRMEZ (.gitignore).
 */

var fs = require('fs');
var path = require('path');
var os = require('os');
var http = require('http');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var SHOT_DIR = '.shots';

var USAGE = [
  '',
  'MFSim ekran görüntüsü aracı',
  '',
  'ÇEKİM:',
  '  node tools/shot.js [seçenekler] --out <dosya.png>',
  '',
  '  --out <yol>          Çıktı PNG (varsayılan .shots/shot.png)',
  '  --rev <git-rev>      O revizyonu geçici worktree\'de aç (ÖNCESİ için: --rev HEAD)',
  '  --file <hedef>       index (varsayılan) | built (MFSim_Code.html)',
  '                       | viewer (MFSim_Olcum_Goruntuleyici.html) | depo içi herhangi bir yol',
  '  --module <tip>       Karşılama kartına tıkla: arac-performans | mount-analysis | fead-analysis',
  '                       ("none" = karşılama ekranını kapat, boş kanvas)',
  '  --script <dosya.js>  Senaryo: module.exports = async function(page, ctx) {...}',
  '  --eval "<js>"        Sayfada çalıştırılacak JS (script\'ten sonra)',
  '  --click <seçici>     Tıkla       --dblclick <seçici>  Çift tıkla',
  '  --selector <seçici>  Yalnız bu ögeyi çek (varsayılan: görünür alan)',
  '  --fit                Kanvası içeriğe sığdır (veFitViewToContent)',
  '  --hide-toast         Geçici bildirimleri (toast) çekimden önce kaldır',
  '  --full               Tam sayfa   --size <GxY>  Görünüm (varsayılan 1600x1000)',
  '  --dpr <n>            Piksel oranı (varsayılan 2)   --wait <ms>  Çekimden önce bekle (400)',
  '',
  'KARŞILAŞTIRMA:',
  '  node tools/shot.js --compose <oncesi.png> <sonrasi.png> --out <karsilastirma.png>',
  '  --stack              Alt alta diz (varsayılan yan yana)',
  '  --title "<metin>"    Üst başlık',
  ''
].join('\n');

// ── Argüman ayrıştırma ─────────────────────────────────────────────────────
// Bilinmeyen bayrak SESSİZCE YUTULMAZ: yanlış yazılmış bir "--modul" görüntüyü
// almaya devam ederdi, ama YANLIŞ ekranın görüntüsünü — karşılaştırmayı
// bozan en sinsi hata bu.
var BOOL_FLAGS = ['full', 'stack', 'help', 'fit', 'hide-toast'];
var STR_FLAGS = ['out', 'rev', 'file', 'module', 'script', 'eval', 'click',
                 'dblclick', 'selector', 'size', 'dpr', 'wait', 'title'];

// --hide-toast → opt.hideToast
function keyOf(name) { return name.replace(/-([a-z])/g, function(m, c) { return c.toUpperCase(); }); }

function parseArgs(argv) {
  var o = {
    mode: 'shot', out: null, rev: null, file: 'index', module: null,
    script: null, eval: null, click: null, dblclick: null, selector: null,
    size: '1600x1000', dpr: '2', wait: '400', title: null,
    full: false, stack: false, help: false, fit: false, hideToast: false,
    compose: null
  };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '-h') { o.help = true; continue; }
    if (a.slice(0, 2) !== '--') throw new Error('Beklenmeyen argüman: ' + a + ' (bayraklar "--" ile başlar)');
    var name = a.slice(2), val = null, eq = name.indexOf('=');
    if (eq !== -1) { val = name.slice(eq + 1); name = name.slice(0, eq); }

    if (name === 'compose') {
      var pair = [];
      if (val !== null) pair.push(val);
      while (pair.length < 2 && i + 1 < argv.length && argv[i + 1].slice(0, 2) !== '--') pair.push(argv[++i]);
      if (pair.length !== 2) throw new Error('--compose iki PNG ister: --compose <oncesi.png> <sonrasi.png>');
      o.mode = 'compose'; o.compose = pair; continue;
    }
    if (BOOL_FLAGS.indexOf(name) !== -1) { o[keyOf(name)] = true; continue; }
    if (STR_FLAGS.indexOf(name) !== -1) {
      if (val === null) {
        if (i + 1 >= argv.length) throw new Error('--' + name + ' bir değer ister');
        val = argv[++i];
      }
      o[keyOf(name)] = val; continue;
    }
    throw new Error('Bilinmeyen seçenek: --' + name + '\n' + USAGE);
  }
  if (!o.out) o.out = path.join(SHOT_DIR, o.mode === 'compose' ? 'karsilastirma.png' : 'shot.png');
  return o;
}

function parseSize(s) {
  var m = /^(\d{3,5})x(\d{3,5})$/.exec(String(s).trim());
  if (!m) throw new Error('--size "GENİŞLİKxYÜKSEKLİK" olmalı (örn. 1600x1000), gelen: ' + s);
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

function parseNum(v, name, min, max) {
  var n = Number(v);
  if (!isFinite(n) || n < min || n > max) throw new Error('--' + name + ' ' + min + '..' + max + ' arasında sayı olmalı, gelen: ' + v);
  return n;
}

// index / built / viewer takma adları → depo içi gerçek yol
var TARGET_ALIASES = {
  'index': 'index.html',
  'built': 'MFSim_Code.html',
  'code': 'MFSim_Code.html',
  'viewer': 'MFSim_Olcum_Goruntuleyici.html'
};

function resolveTarget(file) {
  var key = String(file || 'index').replace(/^\.\//, '');
  if (TARGET_ALIASES[key]) return TARGET_ALIASES[key];
  return key;
}

// ── PNG başlığından ölçü (IHDR) — resim kitaplığı YOK, 8 bayt yeter ────────
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG değil');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ── Karşılaştırma sayfası (yan yana / alt alta) ────────────────────────────
var COMPOSE_MAX_W = 2800;   // yan yana toplam
var COMPOSE_PAD = 20;
var COMPOSE_GAP = 18;

function composePlan(a, b, opt) {
  var maxW = Math.max(a.w, b.w);
  var cell = opt.stack
    ? Math.min(maxW, 1800)
    : Math.min(maxW, Math.floor((COMPOSE_MAX_W - 2 * COMPOSE_PAD - COMPOSE_GAP) / 2));
  // TEK ölçek: iki görüntü aynı k ile küçülür, yoksa boyut farkı yalan söyler.
  var k = cell / maxW;
  var wA = Math.round(a.w * k), wB = Math.round(b.w * k);
  var width = opt.stack
    ? 2 * COMPOSE_PAD + Math.max(wA, wB)
    : 2 * COMPOSE_PAD + COMPOSE_GAP + wA + wB;
  return { k: k, wA: wA, wB: wB, width: Math.max(400, width) };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function composeHtml(a, b, plan, opt) {
  var fig = function(item, w, label, tone) {
    return '<figure style="width:' + w + 'px">' +
      '<figcaption><span class="chip ' + tone + '">' + esc(label) + '</span>' +
      '<span class="name">' + esc(item.name) + '</span></figcaption>' +
      '<img src="' + item.uri + '" style="width:' + w + 'px">' +
      '</figure>';
  };
  return '<!doctype html><meta charset="utf-8"><style>' +
    'body{margin:0;background:#0f1115;color:#e6e9ef;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.wrap{display:flex;gap:' + COMPOSE_GAP + 'px;padding:' + COMPOSE_PAD + 'px;align-items:flex-start}' +
    '.wrap.stack{flex-direction:column}' +
    'h1{font-size:15px;font-weight:600;margin:' + COMPOSE_PAD + 'px ' + COMPOSE_PAD + 'px 0;color:#cfd6e4}' +
    'figure{margin:0}' +
    'figcaption{display:flex;align-items:center;gap:8px;margin:0 0 8px}' +
    '.chip{font-size:12px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:4px}' +
    '.before{background:#3a2b1a;color:#f0b429;border:1px solid #6b4d1f}' +
    '.after{background:#16301f;color:#4ade80;border:1px solid #245c38}' +
    '.name{font-size:11px;color:#8b93a5;font-family:ui-monospace,Menlo,Consolas,monospace}' +
    'img{display:block;border:1px solid #2a2f3a;border-radius:6px}' +
    '</style>' +
    (opt.title ? '<h1>' + esc(opt.title) + '</h1>' : '') +
    '<div class="wrap' + (opt.stack ? ' stack' : '') + '">' +
    fig(a, plan.wA, 'ÖNCESİ', 'before') +
    fig(b, plan.wB, 'SONRASI', 'after') +
    '</div>';
}

// ── Tarayıcı: ortamda hazır Chromium varsa ONU kullan ──────────────────────
// playwright.config.js ile aynı sözleşme (MFSIM_CHROMIUM). CI konteynerinde
// tarayıcı zaten kurulu; "npx playwright install" ya engelli ya gereksiz.
function chromiumExecutable() {
  if (process.env.MFSIM_CHROMIUM) return process.env.MFSIM_CHROMIUM;
  var base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base) {
    var link = path.join(base, 'chromium');
    try { if (fs.existsSync(link)) return link; } catch (e) {}
  }
  return null;   // Playwright kendi indirdiğine düşsün
}

// ── Statik sunucu — 404'ler GERÇEK ──────────────────────────────────────────
// (published.spec.js ile aynı gerekçe: "-s" SPA kipi eksik kaynağı gizlerdi.)
var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

// Yerel ağaçta DOĞAL olarak bulunmayan yollar — uyarı kanalını kirletmesinler,
// yoksa her çekimde "hata var" yazar ve uyarı okunmaz hâle gelir.
//   /version.json → yalnız CI deploy'unda üretilir (gen-version.js → _site/)
//   /             → sw.js kapsam isteği
var BENIGN_404 = ['/', '/version.json', '/favicon.ico'];

function startServer(root) {
  var missing = [];
  return new Promise(function(resolve, reject) {
    var server = http.createServer(function(req, res) {
      var rel = decodeURIComponent(String(req.url).split('?')[0]);
      var file = path.join(root, rel);
      if (file.indexOf(root) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        missing.push(rel);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('yok: ' + rel);
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', function() {
      resolve({ server: server, base: 'http://127.0.0.1:' + server.address().port, missing: missing });
    });
  });
}

// ── ÖNCESİ için geçici worktree ────────────────────────────────────────────
function addWorktree(rev) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-shot-'));
  try {
    childProcess.execFileSync('git', ['worktree', 'add', '--detach', dir, rev],
      { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e2) {}
    throw new Error('git worktree kurulamadı (--rev ' + rev + '): ' +
      String(e.stderr || e.message).trim());
  }
  return dir;
}

function removeWorktree(dir) {
  try { childProcess.execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e2) {} }
}

// Şifre burada YAZMAZ: özet kaynaktan okunur (bkz. dosya başı, karar 2).
function authHashOf(root, targetRel) {
  var candidates = [path.join(root, 'js', 'auth.js'), path.join(root, targetRel)];
  for (var i = 0; i < candidates.length; i++) {
    try {
      var src = fs.readFileSync(candidates[i], 'utf8');
      var m = /MFSIM_AUTH_HASH\s*=\s*'([0-9a-f]{64})'/.exec(src);
      if (m) return m[1];
    } catch (e) {}
  }
  return null;
}

function ensureDir(file) {
  var dir = path.dirname(path.resolve(file));
  if (dir) fs.mkdirSync(dir, { recursive: true });
}

// ── Uygulamayı aç ve kullanılabilir hâle gelmesini bekle ───────────────────
async function bootPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Oturum tohumlandıysa loader kendiliğinden başlar; yine de çağır (idempotent).
  await page.evaluate(function() {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  }).catch(function() {});

  // Splash + giriş kapanmış olmalı. Görüntüleyicide bu ögeler YOK → koşul
  // kendiliğinden sağlanır; tek dosya sürümü de aynı yolu yürür.
  await page.waitForFunction(function() {
    var vis = function(id) {
      var el = document.getElementById(id);
      return !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    };
    if (vis('mfsim-loading-screen') || vis('mfsim-login-overlay')) return false;
    if (document.getElementById('ve-canvas') && typeof window.createNode !== 'function') return false;
    return document.readyState === 'complete';
  }, null, { timeout: 60000 });
}

async function shoot(opt) {
  var pw = require('@playwright/test');
  var size = parseSize(opt.size);
  var dpr = parseNum(opt.dpr, 'dpr', 1, 4);
  var waitMs = parseNum(opt.wait, 'wait', 0, 60000);
  var target = resolveTarget(opt.file);

  var worktree = opt.rev ? addWorktree(opt.rev) : null;
  var root = worktree || ROOT;
  var srv = null, browser = null;
  try {
    if (!fs.existsSync(path.join(root, target))) {
      throw new Error(target + ' yok' + (worktree ? ' (' + opt.rev + ' revizyonunda)' : '') +
        (target === 'MFSim_Code.html' ? ' — önce: npm run build (bu dosya git\'e dahil değil, --rev ile çekilemez)' : ''));
    }
    srv = await startServer(root);
    var exe = chromiumExecutable();
    browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
    var ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: dpr
    });
    var hash = authHashOf(root, target);
    if (hash) {
      await ctx.addInitScript(function(h) {
        try { localStorage.setItem('mfsim_auth_token', h); } catch (e) {}
      }, hash);
    }
    var page = await ctx.newPage();
    var problems = [];
    page.on('pageerror', function(e) { problems.push('pageerror: ' + e.message); });
    page.on('console', function(m) {
      // "Failed to load resource" mesajı URL taşımıyor; eksik kaynakları
      // sunucunun kendi listesi (srv.missing) daha kullanışlı biçimde veriyor.
      if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) problems.push('console: ' + m.text());
    });

    await bootPage(page, srv.base + '/' + target);

    if (opt.module) {
      if (opt.module === 'none') {
        await page.evaluate(function() {
          var o = document.getElementById('ve-module-overlay');
          if (o) o.style.display = 'none';
          if (typeof veSyncModuleShell === 'function') veSyncModuleShell();
        });
      } else {
        await page.waitForFunction(function() { return typeof window.veStartModule === 'function'; },
          null, { timeout: 30000 });
        await page.evaluate(function(m) { veStartModule(m); }, opt.module);
        await page.locator('#ve-module-overlay').waitFor({ state: 'hidden', timeout: 15000 });
      }
    }

    if (opt.script) {
      var scenario = require(path.resolve(opt.script));
      if (typeof scenario !== 'function') throw new Error('--script dosyası bir fonksiyon dışa aktarmalı: ' + opt.script);
      await scenario(page, { base: srv.base, root: root, opt: opt });
    }
    if (opt.eval) await page.evaluate('(async () => { ' + opt.eval + ' })()');
    if (opt.click) await page.locator(opt.click).first().click();
    if (opt.dblclick) await page.locator(opt.dblclick).first().dblclick();

    // Kanvası içeriğe sığdır: topolojinin bir kısmı kadraj dışında kalırsa
    // "öncesi" ile "sonrası" farklı bölgeyi gösterir ve karşılaştırma yalan olur.
    if (opt.fit) {
      await page.evaluate(function() {
        // Kanvas SARMALAYICISININ kaydırması sıfırlanmadan sığdırma yanıltır:
        // düğüm oluşturulurken tarayıcı sarmalayıcıyı kaydırmış olabiliyor
        // (ölçüldü: scrollLeft≈551, scrollTop≈391) ve veFitViewToContent
        // kamerayı ayarlarken bu kaymayı hesaba KATMAZ — içerik kadrajın
        // sol üstüne taşardı.
        var wrap = document.getElementById('ve-canvas-wrapper');
        if (wrap) { wrap.scrollLeft = 0; wrap.scrollTop = 0; }
        if (typeof veFitViewToContent === 'function') veFitViewToContent({ maxZoom: 2 });
      });
      // #ve-canvas dönüşümü GEÇİŞLİ (transition) — hemen ölçmek/çekmek eski
      // kadrajı verir. 450 ms geçişin bitmesine yeter.
      await page.waitForTimeout(450);
    }
    if (waitMs) await page.waitForTimeout(waitMs);
    // Toast'lar geçici ve zamana bağlı — iki çekimde farklı çıkarlar.
    if (opt.hideToast) {
      await page.evaluate(function() {
        ['.ve-toast-stack', '.ve-toast-confirm'].forEach(function(sel) {
          Array.prototype.slice.call(document.querySelectorAll(sel)).forEach(function(el) { el.remove(); });
        });
      });
    }

    ensureDir(opt.out);
    var shotOpts = { path: opt.out, animations: 'disabled', caret: 'hide' };
    if (opt.selector) await page.locator(opt.selector).first().screenshot(shotOpts);
    else await page.screenshot(Object.assign({ fullPage: !!opt.full }, shotOpts));

    var dim = pngSize(fs.readFileSync(opt.out));
    console.log('  ✓ ' + opt.out + '  (' + dim.w + '×' + dim.h + ' px' +
      (worktree ? ', rev ' + opt.rev : '') + ')');
    srv.missing.forEach(function(m) {
      if (BENIGN_404.indexOf(m.split('?')[0]) === -1) problems.push('404: ' + m);
    });
    if (problems.length) {
      console.error('  ! sayfada hata var (' + problems.length + '):');
      problems.slice(0, 5).forEach(function(p) { console.error('    ' + p); });
    }
  } finally {
    if (browser) await browser.close().catch(function() {});
    if (srv) srv.server.close();
    if (worktree) removeWorktree(worktree);
  }
}

async function compose(opt) {
  var pw = require('@playwright/test');
  var items = opt.compose.map(function(p) {
    var buf = fs.readFileSync(p);
    var d = pngSize(buf);
    return { name: path.basename(p), uri: 'data:image/png;base64,' + buf.toString('base64'), w: d.w, h: d.h };
  });
  var plan = composePlan(items[0], items[1], opt);
  var exe = chromiumExecutable();
  var browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  try {
    var page = await browser.newPage({ viewport: { width: plan.width, height: 800 } });
    await page.setContent(composeHtml(items[0], items[1], plan, opt));
    ensureDir(opt.out);
    await page.screenshot({ path: opt.out, fullPage: true, animations: 'disabled' });
    var dim = pngSize(fs.readFileSync(opt.out));
    console.log('  ✓ ' + opt.out + '  (' + dim.w + '×' + dim.h + ' px, ölçek ×' + plan.k.toFixed(2) + ')');
  } finally {
    await browser.close().catch(function() {});
  }
}

async function main() {
  var opt;
  try { opt = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
  if (opt.help) { console.log(USAGE); return; }
  try {
    if (opt.mode === 'compose') await compose(opt);
    else await shoot(opt);
  } catch (e) {
    console.error('✗ ' + (e && e.message ? e.message : e));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { parseArgs: parseArgs, parseSize: parseSize, resolveTarget: resolveTarget,
                   pngSize: pngSize, composePlan: composePlan, composeHtml: composeHtml,
                   chromiumExecutable: chromiumExecutable, USAGE: USAGE };
