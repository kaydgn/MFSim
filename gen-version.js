// ============================================================================
// gen-version.js
// CI deploy sirasinda _site/version.json ureten script.
// Kullanim: node gen-version.js [outDir=_site]
// GitHub API'ye istek atmadan kendi Pages'ten servis edilir → rate-limit yok.
//
// Kunyeyi KENDISI toplamaz: tools/version-info.js toplar, build.js de AYNI
// modulu kullanip ayni kunyeyi tek dosyaya gomer. Iki uretici olsaydi bicim
// sessizce ayrisirdi (okuyucu tek: js/deploy-status.js).
//
// gh API burada bir ZENGINLESTIRME katmani, temel degil: PR govdesi ve
// (gerekirse) baslik/URL duzeltmesi. API dusserse git'ten gelen baslıklar
// kalir — changelog BOSALMAZ.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const versionInfo = require('./tools/version-info.js');

function ghApi(endpoint) {
  try {
    const out = execSync('gh api ' + endpoint, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return JSON.parse(out);
  } catch { return null; }
}

const repo = process.env.GITHUB_REPOSITORY || 'kaydgn/MFSim';
const out = versionInfo.collect({ cwd: __dirname, repo, source: 'pages' });

// Aktif commit icin PR govdesi (git'te yok — yalnizca API'de).
if (out.prNumber) {
  const pr = ghApi('repos/' + repo + '/pulls/' + out.prNumber);
  if (pr) {
    out.prTitle = pr.title || out.prTitle;
    out.prBody = pr.body || '';
    out.prUrl = pr.html_url || out.prUrl;
  }
}

// Changelog basliklarini API ile DOGRULA (git'ten gelen baslik zaten dolu;
// API dusserse oldugu gibi kalir).
for (const c of out.changes) {
  if (c.prNumber === out.prNumber) {
    c.title = out.prTitle || c.title;
    c.url = out.prUrl || c.url;
    continue;
  }
  const pr = ghApi('repos/' + repo + '/pulls/' + c.prNumber);
  if (pr) {
    c.title = pr.title || c.title;
    c.url = pr.html_url || c.url;
  }
}

out.generatedAt = new Date().toISOString();

const outDir = process.argv[2] || '_site';
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'version.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('✓ ' + outPath + ' yazildi (runId=' + (out.runId || 'N/A') + ', changes=' + out.changes.length + ')');

// Service Worker icindeki __DEPLOY_SHA__ placeholder'ini gercek SHA ile degistir.
// Her deploy'da SW dosyasi degisir → tarayici yeni SW tetikler → eski cache silinir.
// SW kok dizindedir (kapsam <site>/ olsun diye — bkz. sw.js basligi).
const swPath = path.join(outDir, 'sw.js');
if (fs.existsSync(swPath) && out.sha) {
  const shortSha = out.sha.slice(0, 7);
  const swContent = fs.readFileSync(swPath, 'utf8').replace(/__DEPLOY_SHA__/g, shortSha);
  fs.writeFileSync(swPath, swContent);
  console.log('✓ ' + swPath + ' icindeki __DEPLOY_SHA__ → ' + shortSha);
}
