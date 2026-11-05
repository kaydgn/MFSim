// ============================================================================
// tools/version-info.js
// ────────────────────────────────────────────────────────────────────────────
// Sürüm künyesinin TEK ÜRETİCİSİ. İki tüketicisi var, ikisi de aynı biçimi
// okuyor:
//
//   • build.js       → künyeyi tek dosyaya `window.__MFSIM_BUILD` olarak GÖMER
//   • gen-version.js → Pages için `_site/version.json` YAZAR (+ gh API ile
//                      zenginleştirir)
//
// Biçim iki yerde ayrı ayrı yazılsaydı sessizce ayrışırdı: okuyucusu
// (js/deploy-status.js) tek ve ayrışmayı ancak KULLANICIDA gösterirdi.
//
// PR BAŞLIĞI İÇİN GITHUB API'SİNE GEREK YOK — ÖLÇÜLDÜ. GitHub'ın ürettiği
// merge commit'i PR başlığını gövdenin ilk satırına yazıyor:
//
//     Merge pull request #851 from kaydgn/claude/friendly-brahmagupta-a2qrv4
//
//     FEAD: kayış çırpması ve burulma mod şekli animasyonu
//
// Üç merge commit'inde de böyle (#849, #850, #851). Yani changelog ÇEVRİMDIŞI
// da gerçek başlıklarla dolabiliyor; API yalnızca PR gövdesini ve URL'sini
// ekliyor. Bu, gömülü künyeyi "eksik bir kopya" olmaktan çıkarıyor.
// ============================================================================

const { execSync } = require('child_process');

// Kayıt ayırıcı olarak %x1e (RS) ŞART: alanlardan biri %b (commit gövdesi) ve
// gövde ÇOK SATIRLI. Satır başına bir kayıt varsayımı ilk merge commit'inde
// bozulurdu.
const ALAN = '\x1f';
const KAYIT = '\x1e';

function gitOut(cmd, cwd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: cwd || process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

// Yalnız belgeye dokunan birleşme (boyut defterinin teslim satırı gibi)
// programı değiştirmez; karşılamanın "son değişiklikler"i ve Program Durumu
// onu saymaz. Ölçüldü (2026-10-14): karşılamadaki 10 kaydın 4'ü boyut
// defteri satırıydı. Dosya listesi alınamazsa (sığ klon) kayıt KALIR —
// bilinmeyeni atmak listeyi sessizce eksiltirdi.
function yalnizBelge(csha, cwd) {
  const dosyalar = gitOut('git diff --name-only ' + csha + '^1 ' + csha, cwd).split('\n').filter(Boolean);
  return dosyalar.length > 0 && dosyalar.every((d) => /^docs\//.test(d));
}

// MODÜLÜN SON DEĞİŞİKLİKLERİ (kullanıcı 2026-11-05, Canlı Not 6: *"takoz çökme ve
// titreşim modülü için yapılan güncellemeleri mi yazsak? … sadece takoz çökme ve
// titreşim özelinde gelişmeler olacak"*): birleşme, değiştirdiği modül dosyalarının
// en az yarısı o modülünse modülün listesine girer — Takoz başlangıç sayfasının
// sağı. Ortak dosyalar (kabuk, tema, kit) sayılmaz; program geneli bir değişiklik
// (tema: Takoz 5 · FEAD 5 · Araç 1 dosya) modülün kaydı DEĞİLDİR. Dosya listesi
// alınamayan kayıt (sığ klon) modüle yazılmaz: bilinmeyeni modülün kaydı saymak
// listeyi yanıltırdı.
const MODUL_DESEN = {
  takoz: /^js\/(cp-mount|mount-|guide-mount)/,
  fead: /^js\/(cp-fead|fead-|guide-fead)/,
  arac: /^js\/(cp-arac|ft-|cp-engine|cp-gearbox|cp-torque-converter|cp-matching|simulation-engine|guide-arac)/
};
const MODUL_LISTE = ['takoz'];   // listesi tutulan modüller
function modulleri(csha, cwd) {
  const dosyalar = gitOut('git diff --name-only ' + csha + '^1 ' + csha, cwd).split('\n').filter(Boolean);
  const say = {};
  Object.keys(MODUL_DESEN).forEach((m) => { say[m] = dosyalar.filter((d) => MODUL_DESEN[m].test(d)).length; });
  const hepsi = Object.keys(say).reduce((t, m) => t + say[m], 0);
  return MODUL_LISTE.filter((m) => say[m] > 0 && 2 * say[m] >= hepsi);
}

// BİRLEŞMENİN AYRINTISI (kullanıcı 2026-11-05, Canlı Not 23: *"Son değişikliklere
// tıkladığım zaman detaylarını okuyabilmem lazım"*): birleşen dalın commit'leri,
// eskiden yeniye — konu ve gövdenin paragrafları. İmza satırları atılır, sert
// satır kırılımı paragrafa birleşir, madde ("- ") kendi paragrafını açar. İkinci
// ebeveyni olmayan kayıt (squash, sığ klon) boş döner: bilinmeyen ayrıntı uydurulmaz.
const IMZA = /^(Co-Authored-By|Claude-Session|Signed-off-by):/i;
const AYRINTI_SINIR = { commit: 20, paragraf: 8, harf: 1600 };
function paragraflar(govde) {
  const out = [];
  let par = [];
  const bitir = () => { if (par.length) { out.push(par.join(' ')); par = []; } };
  String(govde || '').replace(/\r/g, '').split('\n').forEach((l) => {
    const t = l.trim();
    if (IMZA.test(t)) return;
    if (!t) { bitir(); return; }
    if (/^[-*•] /.test(t)) bitir();
    par.push(t);
  });
  bitir();
  let kalan = AYRINTI_SINIR.harf;
  const kisa = [];
  for (const p of out.slice(0, AYRINTI_SINIR.paragraf)) {
    if (kalan <= 0) break;
    kisa.push(p.length > kalan ? p.slice(0, kalan).replace(/\s+\S*$/, '') + ' …' : p);
    kalan -= p.length;
  }
  return kisa;
}
// Commit'in notları (Canlı Not 27 — görseli nota bağlı, tools/degisiklik-resim.js):
// "Canlı not 22: …" → [22] · "Canlı not 9 · 10 · 16: …" → [9, 10, 16] · "Canlı not 8–10: …"
// → [8, 9, 10]; numarasız ("Canlı Not: …") ya da başka konu → [].
function konudanNotlar(konu) {
  const m = /^Canlı not(?:lar)?\s+(\d[\d\s·,–-]*?)\s*:/i.exec(String(konu || ''));
  if (!m) return [];
  const out = [];
  m[1].split(/\s*[·,]\s*/).forEach((p) => {
    const r = /^(\d+)\s*[–-]\s*(\d+)$/.exec(p.trim());
    if (r) { for (let i = +r[1]; i <= +r[2] && i - +r[1] < 50; i++) out.push(i); }
    else if (/^\d+$/.test(p.trim())) out.push(+p.trim());
  });
  return out.filter((n, i) => out.indexOf(n) === i);
}
function birlesmeAyrintisi(csha, cwd) {
  const ham = gitOut('git log --no-merges --reverse --format=%s' + ALAN + '%b' + KAYIT + ' ' + csha + '^1..' + csha + '^2', cwd);
  const out = [];
  for (const kayit of ham.split(KAYIT)) {
    const satir = kayit.replace(/^\n+/, '');
    if (!satir.trim()) continue;
    const [konu, govde] = satir.split(ALAN);
    if (konu && konu.trim()) out.push({ konu: konu.trim(), govde: paragraflar(govde), notlar: konudanNotlar(konu) });
  }
  return out.slice(-AYRINTI_SINIR.commit);
}

// "Merge pull request #851 from …" → 851 ; değilse 0
function prNumarasi(konu) {
  const m = /Merge pull request #(\d+)/.exec(konu || '');
  return m ? parseInt(m[1], 10) : 0;
}

// Merge commit gövdesinin ilk DOLU satırı = PR başlığı (yukarıdaki ölçüm).
function govdedenBaslik(govde) {
  const satirlar = String(govde || '').split('\n');
  for (const s of satirlar) {
    const t = s.trim();
    if (t) return t;
  }
  return '';
}

/**
 * Depodan sürüm künyesini toplar. Ağ ERİŞİMİ YOK — yalnız `git`.
 *
 * @param {object} [opt]
 * @param {string} [opt.cwd]      depo kökü
 * @param {string} [opt.repo]     "sahip/depo" (PR bağlantıları için)
 * @param {number} [opt.maxChanges] changelog uzunluğu (varsayılan 10)
 * @param {string} [opt.source]   'embedded' | 'pages'
 * @param {object} [opt.env]      ortam değişkenleri (varsayılan process.env)
 */
function collect(opt) {
  opt = opt || {};
  const cwd = opt.cwd || process.cwd();
  const repo = opt.repo || (opt.env || process.env).GITHUB_REPOSITORY || 'kaydgn/MFSim';
  const maxChanges = opt.maxChanges || 10;
  const maxModul = opt.maxModul || 12;

  // ORTAM AÇIKÇA GEÇİLEBİLİR. Varsayılan process.env: CI'da GITHUB_SHA zaten
  // checkout edilmiş commit'tir, yani `cwd` ile aynı şeyi söyler. Ama `cwd`
  // BAŞKA bir dizini gösterdiğinde process.env'in kazanması sessiz bir yalan
  // olur — fonksiyon incelemesi istenen dizini değil koşucuyu anlatır.
  // CI'da tam olarak bu oldu: git'siz bir dizin için toplanan künye runner'ın
  // SHA'sını döndürdü ve test kırmızıya döndü (yerelde o değişkenler yok, bu
  // yüzden yerelde yeşildi). Testler `env: {}` geçerek DİZİNİ ölçer.
  const env = opt.env || process.env;
  const runId = env.GITHUB_RUN_ID || '';
  const sha = env.GITHUB_SHA || gitOut('git rev-parse HEAD', cwd);
  const branch = env.GITHUB_REF_NAME || gitOut('git rev-parse --abbrev-ref HEAD', cwd);
  const subject = gitOut('git log -1 --format=%s', cwd);
  const body = gitOut('git log -1 --format=%b', cwd);
  const author = gitOut('git log -1 --format=%an', cwd);
  const date = gitOut('git log -1 --format=%cI', cwd);

  const prNumber = prNumarasi(subject);
  const prTitle = prNumber ? govdedenBaslik(body) : '';
  const prUrl = prNumber ? 'https://github.com/' + repo + '/pull/' + prNumber : '';

  // Changelog: son merge-PR commit'leri (en yeniden eskiye). Modüllerin listesi
  // aynı taramadan, daha geriye (modülün kaydı her birleşmede olmaz).
  const ham = gitOut(
    'git log -400 --format=%H' + ALAN + '%s' + ALAN + '%an' + ALAN + '%cI' + ALAN + '%b' + KAYIT, cwd);
  const changes = [];
  const moduller = {};
  MODUL_LISTE.forEach((m) => { moduller[m] = []; });
  const modulDolu = () => Object.keys(moduller).every((m) => moduller[m].length >= maxModul);
  for (const kayit of ham.split(KAYIT)) {
    const satir = kayit.replace(/^\n+/, '');
    if (!satir.trim()) continue;
    const p = satir.split(ALAN);
    if (p.length < 5) continue;
    const [csha, cmsg, cauthor, cdate, cbody] = p;
    const no = prNumarasi(cmsg);
    if (!no) continue;
    if (yalnizBelge(csha, cwd)) continue;
    const kayitO = {
      sha: csha.slice(0, 7),
      prNumber: no,
      message: cmsg,
      author: cauthor,
      date: cdate,
      title: govdedenBaslik(cbody),
      url: 'https://github.com/' + repo + '/pull/' + no
    };
    if (changes.length < maxChanges) changes.push(kayitO);
    if (!modulDolu()) modulleri(csha, cwd).forEach((m) => {
      if (moduller[m].length < maxModul) {
        moduller[m].push({ sha: kayitO.sha, prNumber: no, date: cdate, title: kayitO.title, ayrinti: birlesmeAyrintisi(csha, cwd) });
      }
    });
    if (changes.length >= maxChanges && modulDolu()) break;
  }

  return {
    runId,
    sha,
    shortSha: sha ? sha.slice(0, 7) : '',
    branch,
    message: subject,
    author,
    date,
    url: runId ? 'https://github.com/' + repo + '/actions/runs/' + runId : '',
    prNumber,
    prTitle,
    prBody: '',
    prUrl,
    changes,
    moduller,
    status: 'completed',
    conclusion: 'success',
    source: opt.source || 'embedded'
  };
}

module.exports = { collect, gitOut, prNumarasi, govdedenBaslik, yalnizBelge, modulleri, MODUL_DESEN, MODUL_LISTE,
  paragraflar, birlesmeAyrintisi, konudanNotlar };
