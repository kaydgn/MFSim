/**
 * github-fikstur.js (e2e) — GitHub API'sinin SABİT cevabı
 * ─────────────────────────────────────────────────────────────────────────
 * Program ağa çıkabildiğinde GitHub'dan iki şey okur: son commit'ler
 * (js/status.js → Program Durumu) ve son koşu + PR (js/deploy-status.js).
 * Yüzey turu o cevabı CANLI tarıyordu, yani kapının sonucu başka oturumların
 * o an ne yazdığına bağlıydı: #1119'un birleşme kısaltması "0352592" yalnız
 * rakamdı ((10/16)^7 ≈ %4) ve bir sonraki commit'in KONUSUNDA da geçti —
 * e2e-urun iki birleşme boyunca kırmızı kaldı, ağı olmayan konteynerde yeşildi.
 *
 * Fikstür o günün gerçek commit'leridir ve iki durumu BİLEREK taşır: tamamı
 * rakam kısaltma (kodda) ve onu KONUSUNDA yazan commit (dış metin). Tarihler
 * istek anına göre: "Bugün" ve "Dün" grupları ile "N dk önce" yazısı çizilir.
 *
 * Servis çalışanı açıkken istek route'a uğramaz (sw.js bütün GET'leri kendi
 * bağlamından çeker) — çağıran spec `serviceWorkers: 'block'` kullanır.
 */
const RAKAM_SHA = '0352592a9c6afc9c623f777c15243c29f12a380f';   // #1119 birleşmesi

const COMMITLER = [
  { sha: '35b98c8adefabbf9cf26b07dac6cee2ca1c4443f', dk: 3, yazar: 'kaydgn',
    mesaj: 'Merge pull request #1120 from kaydgn/claude/github-pages-access-issue-0bzsse\n\n'
      + 'Boyut defteri: 2026-10-16 iki teslim (2f9051a · 0352592)' },
  { sha: '6d572af5eae25a4a9eab87fa02a6231c53e149ca', dk: 5, yazar: 'Claude',
    mesaj: 'Boyut defteri: 2026-10-16 iki teslim (2f9051a · 0352592)\n\n'
      + '- 2f9051a: 29.981.718 bayt, +15 KB kod (Takoz doğrulama turu #1112–#1118),\n  kareler aynı.' },
  { sha: RAKAM_SHA, dk: 9, yazar: 'kaydgn',
    mesaj: 'Merge pull request #1119 from kaydgn/claude/lucid-allen-02ffb5\n\n'
      + 'Takoz örnek şeması: araç adı componentDefs\'ten — kayıttaki 40 ad kopyası kalktı' },
  { sha: 'f64efd40980518a643b384446ef724f2ccb350c2', dk: 10, yazar: 'Claude',
    mesaj: 'Takoz örnek şeması: araç adı componentDefs\'ten — kayıttaki 40 ad kopyası kalktı\n\n'
      + '#1117 "2D Görünüm" bileşenini "Görünümler" diye yeniden adlandırdı; #1118\'in\n'
      + 'üç kurgu örneği (kutu · hafif · kamyon) aynı anda birleşti ve araç listesinde\n'
      + 'eski adı taşıyordu.' },
  { sha: '2f9051ab7b910fe88fae113e534eeb7e053d0ca8', dk: 26 * 60, yazar: 'kaydgn',
    mesaj: 'Merge pull request #1118 from kaydgn/claude/lucid-allen-02ffb5\n\n'
      + 'Takoz: başlangıç sayfasına kurgu doğrulama örnekleri — analitik kutu, hafif ticari, orta kamyon' },
];

const once = (dk) => new Date(Date.now() - dk * 60000).toISOString();

function commitler() {
  return COMMITLER.map((c) => ({
    sha: c.sha,
    html_url: 'https://github.com/kaydgn/MFSim/commit/' + c.sha,
    commit: { message: c.mesaj, author: { name: c.yazar, date: once(c.dk) } },
    author: { login: c.yazar === 'kaydgn' ? 'kaydgn' : '' },
  }));
}

function cevap(yol) {
  if (/\/repos\/kaydgn\/MFSim\/commits$/.test(yol)) return commitler();
  if (/\/repos\/kaydgn\/MFSim\/actions\/runs$/.test(yol)) {
    const c = COMMITLER[2];
    return { total_count: 1, workflow_runs: [{
      id: 38907694942, status: 'completed', conclusion: 'success', head_branch: 'main',
      head_sha: c.sha, head_commit: { message: c.mesaj, author: { name: c.yazar } },
      updated_at: once(c.dk - 1), html_url: 'https://github.com/kaydgn/MFSim/actions/runs/38907694942',
    }] };
  }
  const pr = /\/repos\/kaydgn\/MFSim\/pulls\/(\d+)$/.exec(yol);
  if (pr) {
    const c = COMMITLER.find((x) => x.mesaj.startsWith('Merge pull request #' + pr[1] + ' '));
    if (c) return { number: +pr[1], title: c.mesaj.split('\n\n')[1], body: '', html_url: 'https://github.com/kaydgn/MFSim/pull/' + pr[1] };
  }
  return null;
}

async function githubFikstur(page) {
  await page.route('https://api.github.com/**', (r) => {
    const json = cevap(new URL(r.request().url()).pathname);
    return json ? r.fulfill({ json }) : r.fulfill({ status: 404, json: { message: 'Not Found' } });
  });
}

module.exports = { githubFikstur, RAKAM_SHA, COMMITLER };
