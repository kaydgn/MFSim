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
 */
function collect(opt) {
  opt = opt || {};
  const cwd = opt.cwd || process.cwd();
  const repo = opt.repo || process.env.GITHUB_REPOSITORY || 'kaydgn/MFSim';
  const maxChanges = opt.maxChanges || 10;

  const runId = process.env.GITHUB_RUN_ID || '';
  const sha = process.env.GITHUB_SHA || gitOut('git rev-parse HEAD', cwd);
  const branch = process.env.GITHUB_REF_NAME || gitOut('git rev-parse --abbrev-ref HEAD', cwd);
  const subject = gitOut('git log -1 --format=%s', cwd);
  const body = gitOut('git log -1 --format=%b', cwd);
  const author = gitOut('git log -1 --format=%an', cwd);
  const date = gitOut('git log -1 --format=%cI', cwd);

  const prNumber = prNumarasi(subject);
  const prTitle = prNumber ? govdedenBaslik(body) : '';
  const prUrl = prNumber ? 'https://github.com/' + repo + '/pull/' + prNumber : '';

  // Changelog: son merge-PR commit'leri (en yeniden eskiye).
  const ham = gitOut(
    'git log -80 --format=%H' + ALAN + '%s' + ALAN + '%an' + ALAN + '%cI' + ALAN + '%b' + KAYIT, cwd);
  const changes = [];
  for (const kayit of ham.split(KAYIT)) {
    const satir = kayit.replace(/^\n+/, '');
    if (!satir.trim()) continue;
    const p = satir.split(ALAN);
    if (p.length < 5) continue;
    const [csha, cmsg, cauthor, cdate, cbody] = p;
    const no = prNumarasi(cmsg);
    if (!no) continue;
    changes.push({
      sha: csha.slice(0, 7),
      prNumber: no,
      message: cmsg,
      author: cauthor,
      date: cdate,
      title: govdedenBaslik(cbody),
      url: 'https://github.com/' + repo + '/pull/' + no
    });
    if (changes.length >= maxChanges) break;
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
    status: 'completed',
    conclusion: 'success',
    source: opt.source || 'embedded'
  };
}

module.exports = { collect, gitOut, prNumarasi, govdedenBaslik };
