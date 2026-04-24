// ============================================================================
// gen-version.js
// CI deploy sirasinda _site/version.json ureten script.
// Kullanim: node gen-version.js [outDir=_site]
// GitHub API'ye istek atmadan kendi Pages'ten servis edilir → rate-limit yok.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function gitOut(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

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
const runId = process.env.GITHUB_RUN_ID || '';
const sha = process.env.GITHUB_SHA || gitOut('git rev-parse HEAD');
const branch = process.env.GITHUB_REF_NAME || gitOut('git rev-parse --abbrev-ref HEAD');
const subject = gitOut('git log -1 --format=%s');
const author = gitOut('git log -1 --format=%an');
const date = gitOut('git log -1 --format=%cI');
const runUrl = runId ? 'https://github.com/' + repo + '/actions/runs/' + runId : '';

// Aktif commit icin PR bilgisi
let prNumber = 0, prTitle = '', prBody = '', prUrl = '';
const prMatch = subject.match(/Merge pull request #(\d+)/);
if (prMatch) {
  prNumber = parseInt(prMatch[1], 10);
  const pr = ghApi('repos/' + repo + '/pulls/' + prNumber);
  if (pr) {
    prTitle = pr.title || '';
    prBody = pr.body || '';
    prUrl = pr.html_url || '';
  }
}

// Changelog: son merge commit'leri (en yeniden eskiye, maks 10)
const recent = gitOut("git log -50 --format=%H%x1f%s%x1f%an%x1f%cI");
const changes = [];
for (const line of recent.split('\n')) {
  if (!line) continue;
  const parts = line.split('\x1f');
  if (parts.length < 4) continue;
  const [csha, cmsg, cauthor, cdate] = parts;
  const m = cmsg.match(/Merge pull request #(\d+)/);
  if (!m) continue;
  changes.push({
    sha: csha.slice(0, 7),
    prNumber: parseInt(m[1], 10),
    message: cmsg,
    author: cauthor,
    date: cdate
  });
  if (changes.length >= 10) break;
}

const out = {
  runId,
  sha,
  branch,
  message: subject,
  author,
  date,
  url: runUrl,
  prNumber,
  prTitle,
  prBody,
  prUrl,
  changes,
  status: 'completed',
  conclusion: 'success',
  generatedAt: new Date().toISOString()
};

const outDir = process.argv[2] || '_site';
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'version.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('✓ ' + outPath + ' yazildi (runId=' + (runId || 'N/A') + ', changes=' + changes.length + ')');

// Service Worker icindeki __DEPLOY_SHA__ placeholder'ini gercek SHA ile degistir.
// Her deploy'da SW dosyasi degisir → tarayici yeni SW tetikler → eski cache silinir.
const swPath = path.join(outDir, 'pwa', 'sw.js');
if (fs.existsSync(swPath) && sha) {
  const shortSha = sha.slice(0, 7);
  const swContent = fs.readFileSync(swPath, 'utf8').replace('__DEPLOY_SHA__', shortSha);
  fs.writeFileSync(swPath, swContent);
  console.log('✓ ' + swPath + ' icindeki __DEPLOY_SHA__ → ' + shortSha);
}
