// Transform the (Fable-authored) reference theory report into a reusable,
// self-contained TEMPLATE with injection tokens. One-time build step.
//   IN:  reference guc_grubu_6sd_takoz_modeli_raporu_1.html
//   OUT: js/mount-report-template.js  (window.MNT_REPORT_TEMPLATE = base64)
// Tokens injected at runtime by cp-mount-report.js:
//   @@ASSETS_CSS@@  fonts + KaTeX css (data-URI, offline)
//   @@KATEX_JS@@    katex + auto-render (offline)
//   @@ANTET@@       dynamic title block (model metadata)
//   @@SECTION8@@    dynamic numerical results (this model's solve)
// Çalıştırma: node tools/report-assets/build-report-template.js
'use strict';
const fs = require('fs');
const path = require('path');
const REF = process.argv[2] || path.join(__dirname, 'theory-source.html');
const OUT = process.argv[3] || path.join(__dirname, '..', '..', 'js', 'mount-report-template.js');
let h = fs.readFileSync(REF, 'utf8');
const n0 = h.length;

// ── 1) Strip all external CDN <head> deps (KaTeX + Google Fonts) ────────────
h = h.replace(/^.*cdnjs\.cloudflare\.com\/ajax\/libs\/KaTeX.*$\n?/gmi, '');
h = h.replace(/^.*<link rel="preconnect".*$\n?/gmi, '');
h = h.replace(/^.*fonts\.googleapis\.com.*$\n?/gmi, '');
// The auto-render <script ...> spans two lines (onload=...). Remove any leftover.
h = h.replace(/^\s*onload="renderMathInElement[\s\S]*?><\/script>\s*$\n?/gmi, '');
h = h.replace(/^\s*onload="renderMathInElement.*$\n?/gmi, '');

// ── 2) Inject an assets <style> right before the report's own <style> ───────
h = h.replace('<style>', '<style>@@ASSETS_CSS@@</style>\n<style>');

// ── 3) Replace the static ANTET block with the @@ANTET@@ token ──────────────
h = h.replace(/<div class="antet">[\s\S]*?(?=<div class="toc">)/, '@@ANTET@@\n\n');

// ── 4) Replace the static Section 8 (numerical example) with @@SECTION8@@ +
//       a dynamic "Motor Takozu Uygunluğu" section (@@COMPLIANCE@@) before §9.
h = h.replace(/<h2 id="s8">[\s\S]*?(?=<h2 id="s9">)/, '@@SECTION8@@\n\n@@COMPLIANCE@@\n\n');

// ── 5) Generalize example/validation-specific prose (no Adams claim) ────────
function must(sub){ if(h.indexOf(sub)<0){ console.error('EDIT ANCHOR MISSING:\n'+sub.slice(0,80)); process.exit(1);} }
const s1old = "Bölüm 8'de yöntem, 8×8 TTAR güç grubu verileriyle adım adım uygulanmış ve Adams (BMC_TTAR_2031 modeli) sonuçlarıyla doğrulanmıştır: altı doğal frekansın tamamı 0,01 Hz mertebesinde, statik çökme değerleri 0,1 mm mertebesinde örtüşmektedir.";
const s1new = "Bölüm 8, bu iki adımı — kütle birleştirme, rijitlik matrisinin kurulması, statik çökme, tahrik torku süperpozisyonu ve modal analiz — bu projede tanımlı güç grubu modeline uygular. Harici bir referans çözüm yerine, her adımın sonucu <strong>model içi tutarlılık kriterleriyle</strong> (düşey kuvvet dengesi Σf_z = −m·g, çekme / lift-off ve ±10 mm lineerlik bandı) denetlenir.";
must(s1old); h = h.replace(s1old, s1new);

const s71old = "Tüm yaylar aynı oranda sertleştiğinde frekansların yaklaşık \\( \\sqrt{k_{\\text{din}}/k_{\\text{stat}}} \\) katına çıkacağı öngörülebilir — Bölüm 8.5'te bu oran sayısal olarak da görülmektedir (≈ 1,24).";
const s71new = "Tüm yaylar aynı oranda sertleştiğinde frekansların yaklaşık \\( \\sqrt{k_{\\text{din}}/k_{\\text{stat}}} \\) katına çıkacağı öngörülebilir; Bölüm 8, bu oranı modelin kendi statik ve dinamik rijitlikleriyle sayısal olarak da verir.";
must(s71old); h = h.replace(s71old, s71new);

const footOld = /Bu doküman yöntem raporudur;[\s\S]*?Adams BMC_TTAR_2031 modeli çıktıları\./;
if(!footOld.test(h)){ console.error('FOOTER ANCHOR MISSING'); process.exit(1); }
h = h.replace(footOld, "Bu rapor, projede tanımlı güç grubu modelinden <strong>otomatik üretilmiştir</strong>; girdi değerleri modeldeki bileşen ve takoz tanımlarından alınır. Sonuçlar 6 serbestlik dereceli rijit gövde ve üç eksenli lineer yay matematiğine dayanır; model içi tutarlılık kontrolleriyle denetlenir. Tasarım kararlarında güncel CAD / tedarikçi verisiyle teyit edilmelidir.");

// ── 6) Append offline KaTeX engine + auto-render just before </body> ────────
const katexBoot = '<script>@@KATEX_JS@@</script>\n'
  + '<script>document.addEventListener("DOMContentLoaded",function(){try{renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"\\\\(",right:"\\\\)",display:false}],throwOnError:false});}catch(e){}});</script>\n';
// Fonksiyon-replacer: katexBoot içindeki "$$" delimiter'ları String.replace'in
// $$→$ desen kısaltmasıyla bozulmasın.
h = h.replace('</body>', function(){ return katexBoot + '</body>'; });

// ── 7) Sanity: tokens present exactly once, no external refs remain ─────────
for(const t of ['@@ASSETS_CSS@@','@@KATEX_JS@@','@@ANTET@@','@@SECTION8@@','@@COMPLIANCE@@']){
  const c = h.split(t).length - 1;
  if(c!==1){ console.error('TOKEN '+t+' appears '+c+' times (want 1)'); process.exit(1); }
}
if(/https?:\/\//.test(h.replace(/https:\/\/www\.w3\.org\/2000\/svg/g,''))){
  console.error('WARNING external URL remains:', (h.match(/https?:\/\/[^"')\s]+/g)||[]).filter(u=>!/w3\.org/.test(u)).slice(0,5));
}

// ── 8) Emit base64 template module ──────────────────────────────────────────
const b64 = Buffer.from(h,'utf8').toString('base64');
const js = '// AUTO-GENERATED — Takoz raporu teori şablonu (self-contained, çevrimdışı).\n'
  + '// Kaynak: Fable ile üretilen "Güç Grubu 6 SD Takoz Modeli" teori raporu,\n'
  + '// build-report-template.js ile token\'lı şablona dönüştürüldü. ELLE DÜZENLEME.\n'
  + '// Tokenlar cp-mount-report.js tarafından doldurulur.\n'
  + 'window.MNT_REPORT_TEMPLATE_B64 = ' + JSON.stringify(b64) + ';\n';
fs.writeFileSync(OUT, js, 'utf8');
console.log('ref '+n0+'B → template '+h.length+'B → '+OUT+' ('+(fs.statSync(OUT).size/1024|0)+'KB)');
console.log('tokens OK.');
