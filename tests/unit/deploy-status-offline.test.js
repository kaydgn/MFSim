/**
 * @jest-environment-options {"url": "file:///indirilenler/MFSim_Code.html"}
 */

/**
 * deploy-status-offline.test.js — İNDİRİLEN TEK DOSYANIN AĞ DAVRANIŞI
 * ───────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN OLAY (gerçek Chrome, yanında pwa/ klasörü olmayan bir kopya,
 * file:// ile açık):
 *
 *     4 istek, 3'ü BAŞARISIZ:
 *        pwa/icon.svg                          net::ERR_FILE_NOT_FOUND
 *        version.json?t=…                      net::ERR_FAILED (file:// CORS)
 *        api.github.com/…/actions/runs         (kullanıcının ağı GitHub'a çıkamıyor)
 *     4 konsol hatası · nokta kalıcı olarak "Bağlantı yok"
 *
 * Zincir açılıştan 2 sn sonra başlıyor ve HER 15 DAKİKADA BİR tekrarlanıyordu.
 * Oysa file:// üzerinde aranacak bir uç YOK: version.json bir deploy ürünüdür,
 * indirilen dosyanın yanında hiçbir zaman bulunmaz.
 *
 * Bu dosya jsdom'u file:// adresiyle kurar (yukarıdaki docblock) ve ölçtüğü
 * şey tek bir cümledir: ÇEVRİMDIŞI KOPYA AĞA ÇIKMAZ. Karşı kapı —
 * http(s) üzerinde ağ yolunun HÂLÂ çalıştığı — tests/unit/deploy-status.test.js
 * içindedir; ikisi olmadan "hiç sorma" da testten geçerdi.
 */

const KUNYE = {
  sha: 'f820711052ede2598ce5ab1c736dd1828226caee',
  shortSha: 'f820711',
  branch: 'main',
  message: 'Merge pull request #851 from kaydgn/dal',
  author: 'kaydgn',
  date: '2026-09-02T16:45:56+03:00',
  prNumber: 851,
  prTitle: 'FEAD: kayış çırpması ve burulma mod şekli animasyonu',
  prUrl: 'https://github.com/kaydgn/MFSim/pull/851',
  changes: [
    { sha: 'f820711', prNumber: 851, message: 'Merge pull request #851 from kaydgn/dal',
      author: 'kaydgn', date: '2026-09-02T16:45:56+03:00', title: 'FEAD: kayış çırpması', url: '' },
    { sha: 'd30da1d', prNumber: 850, message: 'Merge pull request #850 from kaydgn/dal2',
      author: 'kaydgn', date: '2026-09-02T16:42:30+03:00', title: 'Teslim akışı', url: '' }
  ],
  status: 'completed',
  conclusion: 'success',
  source: 'embedded'
};

// jsdom, file:// adresinde origin'i OPAK saydığı için localStorage vermiyor;
// gerçek Chrome file:// üzerinde dosya başına bir localStorage AÇAR (uygulamanın
// tema kaydı da oradan çalışıyor — ölçüldü). Test ortamının bu farkı kapatılır,
// yoksa ölçülen şey kodun davranışı değil jsdom'un eksiği olur.
function sahteDepo() {
  const kutu = new Map();
  return {
    getItem: (k) => (kutu.has(k) ? kutu.get(k) : null),
    setItem: (k, v) => kutu.set(k, String(v)),
    removeItem: (k) => kutu.delete(k),
    clear: () => kutu.clear()
  };
}
// jsdom bu özellikleri SALT OKUNUR erişimci olarak tanımlıyor; düz atama
// sessizce düşer (ilk denemede tam olarak öyle oldu) — defineProperty şart.
for (const ad of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(window, ad, { value: sahteDepo(), configurable: true, writable: true });
  global[ad] = window[ad];
}

document.body.innerHTML = `
  <span id="ve-deploy-dot" class="ve-deploy-dot ve-deploy-unknown"></span>
  <span id="ve-deploy-refresh"></span>
  <div id="ve-status-commits"></div>
`;

// Modüllerin kurduğu DOMContentLoaded handler'ları yakala: açılış davranışı
// ancak çalıştırılarak ölçülebilir (jsdom'da olay çoktan geçmiş olur).
const domReady = [];
const origAdd = document.addEventListener.bind(document);
document.addEventListener = function (t, h, o) {
  if (t === 'DOMContentLoaded') { domReady.push(h); return; }
  return origAdd(t, h, o);
};
eval(loadSource('deploy-status.js'));
eval(loadSource('status.js'));
document.addEventListener = origAdd;

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(() => Promise.reject(new Error('ağa çıkılmamalıydı')));
  window.__MFSIM_BUILD = JSON.parse(JSON.stringify(KUNYE));
  const dot = document.getElementById('ve-deploy-dot');
  dot.className = 've-deploy-dot ve-deploy-unknown';
  dot.removeAttribute('data-deploy-info');
});

describe('file:// — ağa HİÇ çıkılmaz', () => {
  test('protokol kapısı açık', () => {
    expect(location.protocol).toBe('file:');
    expect(_veOfflineOnly()).toBe(true);
  });

  test('_veCheckDeploy fetch ÇAĞIRMAZ, gömülü künyeyi döndürür', () => {
    const geri = jest.fn();
    _veCheckDeploy(geri);
    expect(fetch).not.toHaveBeenCalled();
    expect(geri).toHaveBeenCalledTimes(1);
    expect(geri.mock.calls[0][0].shortSha).toBe('f820711');
  });

  test('açılış handler\'ı ne istek atar ne 15 dakikalık zamanlayıcı kurar', () => {
    const araci = jest.spyOn(global, 'setInterval');
    const gecikmeli = jest.spyOn(global, 'setTimeout');
    try {
      domReady.forEach((h) => h({ type: 'DOMContentLoaded', target: document }));
      expect(fetch).not.toHaveBeenCalled();
      expect(araci).not.toHaveBeenCalled();
      // Otomatik kontrolün 2 sn'lik açılış gecikmesi de kurulmamalı.
      const gecikmeler = gecikmeli.mock.calls.map((c) => c[1]);
      expect(gecikmeler).not.toContain(2000);
    } finally {
      araci.mockRestore();
      gecikmeli.mockRestore();
    }
  });

  test('künye yoksa sessizce vazgeçer — patlamaz, uydurmaz', () => {
    delete window.__MFSIM_BUILD;
    const geri = jest.fn();
    expect(() => _veCheckDeploy(geri)).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(geri).toHaveBeenCalledWith(null);
  });
});

describe('gömülü künye ekrana ne yazıyor', () => {
  test('nokta "yeşil/güncel" DEĞİL, ayrı bir durum — güncellik iddia edilmez', () => {
    const dot = document.getElementById('ve-deploy-dot');
    _veApplyDotState(dot, window.__MFSIM_BUILD);
    expect(dot.className).toContain('ve-deploy-local');
    expect(dot.className).not.toContain('ve-deploy-success');
    expect(dot.title).toContain('f820711');
    expect(dot.title).toContain('PR #851');
  });

  test('"Son Güncellemeler" ağ olmadan DOLAR', () => {
    _veStatusLoadCommits();
    expect(fetch).not.toHaveBeenCalled();
    const el = document.getElementById('ve-status-commits').innerHTML;
    expect(el).toContain('f820711');
    expect(el).toContain('FEAD: kayış çırpması');
    expect(el).toContain('Teslim akışı');
  });

  test('künye yoksa "Yükleniyor..."\'da ASILI KALMAZ', () => {
    delete window.__MFSIM_BUILD;
    _veStatusLoadCommits();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById('ve-status-commits').innerHTML).toContain('sürüm künyesi yok');
  });
});
