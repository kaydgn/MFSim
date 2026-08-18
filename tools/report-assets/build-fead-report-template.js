// FEAD raporu teori şablonunu üretir.
//   IN : tools/report-assets/fead-theory-source.html   (elle yazılan teori, §1–7, 9, 10, Ek A)
//   OUT: js/fead-report-template.js                    (window.FEAD_REPORT_TEMPLATE_B64)
//
// Takoz şablonundan (build-report-template.js) FARKI: orada kaynak, harici bir
// referans belgeydi ve script regex ameliyatıyla token'lı hâle getiriyordu.
// Burada kaynak ZATEN token'lı yazıldı; bu yüzden bu script cerrahi yapmaz,
// yalnız DOĞRULAR ve paketler. Regex ameliyatı, kaynak metin bir kelime
// değiştiğinde sessizce yanlış yere token koyabilecek tek yerdi.
//
// Çalıştırma: npm run build:fead-report
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || path.join(__dirname, 'fead-theory-source.html');
const OUT = process.argv[3] || path.join(__dirname, '..', '..', 'js', 'fead-report-template.js');

let h = fs.readFileSync(SRC, 'utf8');
const n0 = h.length;

// ── 1) KaTeX motoru + otomatik render, </body>'den hemen önce ───────────────
// Fonksiyon-replacer ŞART: katexBoot içindeki "$$" sınırlayıcıları String.replace'in
// $$→$ desen kısaltmasıyla bozulur (Takoz üretecinde aynı tuzak yorumlanmış).
const katexBoot = '<script>@@KATEX_JS@@</script>\n'
  + '<script>document.addEventListener("DOMContentLoaded",function(){try{'
  + 'renderMathInElement(document.body,{delimiters:['
  + '{left:"$$",right:"$$",display:true},{left:"\\\\(",right:"\\\\)",display:false}],'
  + 'throwOnError:false});}catch(e){}});</script>\n';
if (h.indexOf('@@KATEX_JS@@') >= 0) { console.error('KAYNAKTA @@KATEX_JS@@ ZATEN VAR'); process.exit(1); }
if (h.indexOf('</body>') < 0) { console.error('</body> BULUNAMADI'); process.exit(1); }
h = h.replace('</body>', function(){ return katexBoot + '</body>'; });

// ── 2) Token doğrulaması: her biri TAM BİR KEZ ─────────────────────────────
const TOKENS = ['@@ASSETS_CSS@@', '@@KATEX_JS@@', '@@ANTET@@',
                '@@FIGURE1@@', '@@SECTION8@@', '@@COMPLIANCE@@'];
let hata = false;
for (const t of TOKENS) {
  const c = h.split(t).length - 1;
  if (c !== 1) { console.error('TOKEN ' + t + ' ' + c + ' kez geçiyor (1 olmalı)'); hata = true; }
}
if (hata) process.exit(1);

// ── 3) Çevrimdışılık: harici URL kalmamalı ─────────────────────────────────
// Rapor tek dosya olarak indirilip ağsız açılabilmeli. w3.org SVG ad alanı
// bir ADRES değil, XML namespace kimliği — o muaf.
const dis = (h.replace(/https?:\/\/www\.w3\.org\/[^"')\s]*/g, '').match(/https?:\/\/[^"')\s]+/g) || []);
if (dis.length) { console.error('HARİCİ URL KALDI:', dis.slice(0, 5)); process.exit(1); }

// ── 4) Yapısal kontrol: şablon içinde kapanmamış script/style yok ──────────
for (const tag of ['script', 'style']) {
  const ac = (h.match(new RegExp('<' + tag + '[\\s>]', 'gi')) || []).length;
  const kap = (h.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
  if (ac !== kap) { console.error(tag + ': ' + ac + ' açılış, ' + kap + ' kapanış'); process.exit(1); }
}

// ── 5) base64 modül ────────────────────────────────────────────────────────
const b64 = Buffer.from(h, 'utf8').toString('base64');
const js = '// AUTO-GENERATED — FEAD raporu teori şablonu (self-contained, çevrimdışı).\n'
  + '// Kaynak: tools/report-assets/fead-theory-source.html\n'
  + '// Üretim: npm run build:fead-report   ELLE DÜZENLENMEZ.\n'
  + '// Tokenlar js/cp-fead-report.js tarafından doldurulur.\n'
  + 'window.FEAD_REPORT_TEMPLATE_B64 = ' + JSON.stringify(b64) + ';\n';
fs.writeFileSync(OUT, js, 'utf8');
console.log('kaynak ' + n0 + 'B → şablon ' + h.length + 'B → ' + OUT
  + ' (' + (fs.statSync(OUT).size / 1024 | 0) + 'KB)');
console.log('token ✓  çevrimdışı ✓  yapı ✓');
