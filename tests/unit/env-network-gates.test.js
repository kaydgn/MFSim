/**
 * Ağ kapıları — js/env.js ve onu kullanan dört özellik
 * ────────────────────────────────────────────────────
 * Artifact önizlemesi (claude.ai) dış hosta istek atamaz: sayfanın CSP'si
 * engeller. Engellenen istek SESSİZ bir bozulma üretir — harita boş gri bir
 * kare, deploy noktası KIRMIZI ("deploy başarısız" diye yanlış bir şey söyler),
 * commit listesi boş. Bu yüzden kapı: artifact ortamında bu yollar fetch'e
 * HİÇ GİRMEZ ve sebebini yazar.
 *
 * Bu testin değeri sessiz regresyonda: biri kapıyı kaldırırsa program yine
 * "çalışır" görünür, yalnız önizlemede yanlış şeyler gösterir.
 */

const fs = require('fs');
const path = require('path');
const JS = f => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');

const env = require(path.join(__dirname, '../../js/env.js'));

describe('js/env.js — ortam bayrağı', () => {
  afterEach(() => { delete global.window.MFSIM_ENV; });

  test('bayrak yokken ağ AÇIK sayılır (index.html ve Pages sürümü)', () => {
    expect(env.veArtifactEnv()).toBe(false);
    expect(env.veNetworkAllowed()).toBe(true);
  });

  test('bayrak "artifact" iken ağ KAPALI sayılır', () => {
    global.window.MFSIM_ENV = 'artifact';
    expect(env.veArtifactEnv()).toBe(true);
    expect(env.veNetworkAllowed()).toBe(false);
  });

  test('başka bir bayrak değeri ağı kapatmaz — kapı yalnız artifact\'e özel', () => {
    global.window.MFSIM_ENV = 'pages';
    expect(env.veArtifactEnv()).toBe(false);
  });

  test('not metni TEK kaynaktan gelir ve özelliği adıyla anar', () => {
    expect(env.veOfflineNote('Harita')).toMatch(/^Harita: /);
    expect(env.veOfflineNote('Harita')).toContain('claude.ai');
  });
});

// Kapılı yolları izole koşturmak için ortak ortam. eval TEST GÖVDESİNDE
// çağrılır (projenin kalıbı): bir yardımcı fonksiyonun içinde eval edilirse
// üst-seviye bildirimler o fonksiyonun kapsamında kalır ve çağrılamaz.
function ortamKur(ekstra) {
  const fetchStub = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  global.fetch = fetchStub;
  global.veArtifactEnv = () => true;
  global.veOfflineNote = env.veOfflineNote;
  Object.keys(ekstra || {}).forEach(k => { global[k] = ekstra[k]; });
  return fetchStub;
}

describe('artifact ortamında ağ yollarına GİRİLMEZ', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  test('deploy durumu: fetch çağrılmaz, nokta nötr duruma alınır', () => {
    document.body.innerHTML = '<span id="ve-deploy-dot" class="ve-deploy-dot ve-deploy-unknown"></span>';
    const fetchStub = ortamKur();
    const geriCagri = jest.fn();
    // eslint-disable-next-line no-eval
    eval(JS('deploy-status.js'));
    _veCheckDeploy(geriCagri);

    expect(fetchStub).not.toHaveBeenCalled();
    const dot = document.getElementById('ve-deploy-dot');
    // KIRMIZI OLMAMALI: "deploy başarısız" burada YANLIŞ bir ifade olurdu.
    expect(dot.className).not.toMatch(/ve-deploy-error/);
    expect(dot.className).toMatch(/ve-deploy-offline/);
    expect(dot.title).toMatch(/claude\.ai/);
    expect(geriCagri).toHaveBeenCalledWith(null);
  });

  test('commit listesi: fetch çağrılmaz, sebebi yazılır', () => {
    document.body.innerHTML = '<div id="ve-status-commits"></div>';
    const fetchStub = ortamKur();
    // eslint-disable-next-line no-eval
    eval(JS('status.js'));
    _veStatusLoadCommits();

    expect(fetchStub).not.toHaveBeenCalled();
    const el = document.getElementById('ve-status-commits');
    expect(el.textContent).toContain('Commit listesi');
    expect(el.textContent).toContain('claude.ai');
  });

  test('harita: karo sunucusuna gidilmez, L.map hiç kurulmaz, sebebi yazılır', () => {
    document.body.innerHTML = '<div id="ve-road-map-N1"></div>';
    // L.map çağrılırsa stub FIRLATIR → kurulmadığını, testin geçmesiyle ölçüyoruz.
    const fetchStub = ortamKur({
      L: { map: () => { throw new Error('harita kurulmamalıydı'); }, tileLayer: () => { throw new Error('karo istenmemeliydi'); } }
    });
    // eslint-disable-next-line no-eval
    eval(JS('map.js'));
    veInitRoadMap('N1');

    expect(fetchStub).not.toHaveBeenCalled();
    const el = document.getElementById('ve-road-map-N1');
    expect(el.textContent).toContain('Harita ve rota');
    expect(el.textContent).toContain('claude.ai');
  });
});

describe('kapıların KURULU olduğu — yapısal', () => {
  test('canlı radyo yayını kapıdan geçer, YEREL kütüphane geçmez', () => {
    const src = JS('radio.js');
    const i = src.indexOf('function playStation');
    const j = src.indexOf('a.src = station.url', i);
    expect(i).toBeGreaterThan(-1);
    // Kapı, yayın URL'si <audio>'ya verilmeden ÖNCE olmalı.
    expect(src.slice(i, j)).toMatch(/veArtifactEnv\(\)/);

    // playTrack (yerel dosya, object-url) kapıya TAKILMAMALI: onun ağı yok,
    // kapatmak kullanıcıdan çalışan bir özelliği sebepsiz alırdı.
    const t = src.indexOf('function playTrack');
    const t2 = src.indexOf('a.play()', t);
    expect(src.slice(t, t2)).not.toMatch(/veArtifactEnv\(\)/);
  });

  test('service worker kaydı artifact\'te denenmiyor', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    const i = html.indexOf("serviceWorker.register");
    expect(i).toBeGreaterThan(-1);
    // Kayıt satırından geriye doğru bakınca kapı görünmeli.
    expect(html.slice(Math.max(0, i - 400), i)).toMatch(/veArtifactEnv\(\)/);
  });

  test('env.js index.html\'de diğer TÜM js/ modüllerinden önce yüklenir', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    const envIdx = html.indexOf('src="js/env.js"');
    expect(envIdx).toBeGreaterThan(-1);
    const digerleri = [...html.matchAll(/src="js\/([a-z0-9-]+)\.js"/g)]
      .filter(m => m[1] !== 'env')
      .map(m => m.index);
    // Bayrak geç kurulursa arkasındaki modüller onu göremeden koşar.
    expect(Math.min(...digerleri)).toBeGreaterThan(envIdx);
  });
});
