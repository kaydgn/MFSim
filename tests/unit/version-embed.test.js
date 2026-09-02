/**
 * version-embed.test.js — SÜRÜM KÜNYESİNİN ÜRETİCİSİ
 * ──────────────────────────────────────────────────
 *
 * NEDEN VAR: indirilen tek dosyada sürümü söyleyen HİÇBİR şey yoktu.
 * `__DEPLOY_RUN_ID__` yer tutucusu yalnız CI'da (GITHUB_RUN_ID) doluyor,
 * version.json yalnız Pages'te üretiliyor. Yani elindeki kopyanın hangi
 * commit olduğu ölçülemiyordu; bayat bir dosyayla güncel olanı ayırt etmenin
 * yolu yoktu. Künye artık build sırasında git'ten toplanıp dosyaya gömülüyor.
 *
 * BURADAKİ ASIL KAPI, ÇOK SATIRLI COMMIT GÖVDESİDİR. PR başlığı GitHub'ın
 * merge commit'inin GÖVDESİNDE durur ve gövde çok satırlıdır; kayıtlar satır
 * başına bir tane varsayılırsa ilk merge commit'inde ayrıştırma kayar ve
 * changelog SESSİZCE başlıksız kalır (görünürde çalışır, içerik boş).
 * Bu yüzden testler gerçek bir git deposu kurup ölçüyor.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const versionInfo = require('../../tools/version-info.js');
const ROOT = path.join(__dirname, '../..');

// ── Yardımcı: tek kullanımlık bir git deposu kur ───────────────────────────
function depoKur() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-vi-'));
  const g = (cmd) => execSync(cmd, { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] });
  g('git init -q');
  g('git config user.email t@t.test');
  g('git config user.name Test');
  g('git config commit.gpgsign false');
  return { dir, g };
}

function commit(g, dir, mesaj) {
  fs.writeFileSync(path.join(dir, 'f.txt'), String(Math.random()));
  g('git add -A');
  execSync('git commit -q -F -', { cwd: dir, input: mesaj, stdio: ['pipe', 'pipe', 'ignore'] });
}

describe('tools/version-info.js — ayrıştırma çekirdeği', () => {
  test('PR numarası merge commit konusundan okunur', () => {
    expect(versionInfo.prNumarasi('Merge pull request #851 from kaydgn/dal')).toBe(851);
    expect(versionInfo.prNumarasi('FEAD: sıradan bir commit')).toBe(0);
    expect(versionInfo.prNumarasi('')).toBe(0);
    expect(versionInfo.prNumarasi(null)).toBe(0);
  });

  test('başlık gövdenin ilk DOLU satırıdır (baştaki boş satırlar atlanır)', () => {
    expect(versionInfo.govdedenBaslik('\n\nFEAD: kayış çırpması\n\nayrıntı')).toBe('FEAD: kayış çırpması');
    expect(versionInfo.govdedenBaslik('')).toBe('');
    expect(versionInfo.govdedenBaslik(null)).toBe('');
  });
});

describe('tools/version-info.js — gerçek depo üzerinde', () => {
  let depo;
  beforeAll(() => {
    depo = depoKur();
    commit(depo.g, depo.dir, 'ilk commit');
    // GitHub'ın ürettiği merge commit biçimi: konu + BOŞ SATIR + PR başlığı,
    // ardından çok satırlı gövde. Kayıt ayırıcısı satır sonu olsaydı burada kayardı.
    commit(depo.g, depo.dir,
      'Merge pull request #101 from kaydgn/dal-a\n\nİlk özellik: iki satırlı\ngövdenin ikinci satırı\n\nüçüncü paragraf');
    commit(depo.g, depo.dir, 'araya giren düz commit\n\ngövdesi de var');
    commit(depo.g, depo.dir,
      'Merge pull request #102 from kaydgn/dal-b\n\nİkinci özellik');
  });
  afterAll(() => { if (depo) fs.rmSync(depo.dir, { recursive: true, force: true }); });

  test('changelog YALNIZ merge-PR commit\'lerini alır, en yeniden eskiye', () => {
    const info = versionInfo.collect({ cwd: depo.dir, repo: 'kaydgn/MFSim' });
    expect(info.changes.map((c) => c.prNumber)).toEqual([102, 101]);
  });

  test('ÇOK SATIRLI gövdeden başlık doğru çıkar — kayıt ayırıcı kapısı', () => {
    const info = versionInfo.collect({ cwd: depo.dir, repo: 'kaydgn/MFSim' });
    expect(info.changes.map((c) => c.title)).toEqual(['İkinci özellik', 'İlk özellik: iki satırlı']);
  });

  test('HEAD merge commit ise PR künyesi doldurulur', () => {
    const info = versionInfo.collect({ cwd: depo.dir, repo: 'kaydgn/MFSim' });
    expect(info.prNumber).toBe(102);
    expect(info.prTitle).toBe('İkinci özellik');
    expect(info.prUrl).toBe('https://github.com/kaydgn/MFSim/pull/102');
    expect(info.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(info.shortSha).toBe(info.sha.slice(0, 7));
  });

  test('maxChanges changelog\'u kırpar', () => {
    const info = versionInfo.collect({ cwd: depo.dir, maxChanges: 1 });
    expect(info.changes).toHaveLength(1);
    expect(info.changes[0].prNumber).toBe(102);
  });

  test('git OLMAYAN dizinde patlamaz — alanlar boş döner', () => {
    const bos = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-nogit-'));
    try {
      const info = versionInfo.collect({ cwd: bos });
      expect(info.sha).toBe('');
      expect(info.changes).toEqual([]);
      expect(info.source).toBe('embedded');
    } finally {
      fs.rmSync(bos, { recursive: true, force: true });
    }
  });
});

describe('künye tek dosyaya gömülebilir', () => {
  test('JSON içinde ham "</script" KALMAZ — gömme kalkanı', () => {
    // Bir PR başlığı "</script>" içerseydi gömülen blok erken kapanır ve
    // program açılışta ham kaynak dökerdi (2026-08'de aynı sınıf bir olay
    // yaşandı, bkz. tests/e2e/published.spec.js).
    const kotu = {
      changes: [{ prNumber: 1, title: 'Kötü </script><script>alert(1)</script> başlık', message: '', author: '', date: '', sha: '', url: '' }]
    };
    const gomulu = JSON.stringify(kotu).replace(/</g, '\\u003c');
    expect(gomulu).not.toMatch(/<\/script/i);
    expect(JSON.parse(gomulu.replace(/\\u003c/g, '<')).changes[0].title).toContain('</script>');
  });

  test('gerçek depo künyesi de temiz', () => {
    const info = versionInfo.collect({ cwd: ROOT });
    expect(JSON.stringify(info).replace(/</g, '\\u003c')).not.toMatch(/<\/script/i);
  });
});

describe('build.js — indirilen dosyada kırık başvuru bırakmaz', () => {
  const buildJs = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

  test('favicon data URI olarak GÖMÜLÜYOR, izinli listede DEĞİL', () => {
    // Ölçüldü (gerçek Chrome, file://): yanında pwa/ olmayan bir kopyada
    // pwa/icon.svg → net::ERR_FILE_NOT_FOUND. İzinli listeye geri konması
    // o hatayı sessizce geri getirir.
    const m = /var IZINLI_DIS_KAYNAK = \[([\s\S]*?)\];/.exec(buildJs);
    expect(m).not.toBeNull();
    const izinli = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(izinli).toEqual(['pwa/manifest.json']);
    expect(buildJs).toMatch(/data:image\/svg\+xml;base64,/);
  });

  test('künye build sırasında TEK üreticiden geliyor', () => {
    // İkinci bir üretici biçimi sessizce ayrıştırırdı; okuyucu tek.
    expect(buildJs).toMatch(/require\(['"]\.\/tools\/version-info\.js['"]\)/);
    expect(buildJs).toMatch(/window\.__MFSIM_BUILD/);
  });
});
