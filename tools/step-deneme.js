#!/usr/bin/env node
/**
 * MFSim — BÜYÜK DENEME STEP'İ (CATIA kalıbında güç grubu)
 *
 * Kullanım:
 *   npm run step:deneme -- --mb 420                 → .step-deneme/deneme-420.stp
 *   npm run step:deneme -- --mb 5 --cikti x.stp --tohum 3
 *
 * NEDEN: Takoz'un STEP okuyucusu bütün güç grubunun analiz geometrisini
 * (~400 MB) okuyacak ve gerçek dosya depoya girmiyor. Her adımın önce/sonra
 * sayısı bu dosyayla ölçülür (tools/step-olcum.js); aynı tohum aynı dosyayı
 * üretir.
 *
 * İÇERİK — gerçek dosyanın kalıbı, testlerin yazıcısıyla
 * (tests/helpers/step-yaz.js + step-takoz.js):
 *   · döküm gövdeleri: B-spline yüzlü şişkin kutular (kelepçeli düğüm)
 *   · kasnak gibi dönel parçalar: silindir · koni · tor · düzlem
 *   · cıvatalar ve braketler: kutu + silindir
 *   · montaj CDSR → RRWT → IDT; kök → alt montajlar (Motor · Şanzıman ·
 *     Transfer kutusu · Braketler · Takozlar) → parçalar, yerel eksen dönük
 * Dosya akışla yazılır: 400 MB'lık metin bellekte birikmez. Çıktılar
 * `.step-deneme/` altına yazılır ve git'e GİRMEZ (.gitignore).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Y = require('../tests/helpers/step-yaz.js');
var T = require('../tests/helpers/step-takoz.js');

var ROOT = path.join(__dirname, '..');

function arguman(ad, yedek) {
  var i = process.argv.indexOf('--' + ad);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : yedek;
}
var MB = +arguman('mb', 420);
if (!(MB > 0)) { console.error('--mb pozitif bir sayı olmalı.'); process.exit(2); }
var CIKTI = arguman('cikti', path.join(ROOT, '.step-deneme', 'deneme-' + MB + '.stp'));
var tohum = +arguman('tohum', 11) || 11;
var rnd = function () { tohum = (tohum * 1103515245 + 12345) % 2147483648; return tohum / 2147483648; };
var ara = function (a, b) { return a + (b - a) * rnd(); };

fs.mkdirSync(path.dirname(CIKTI), { recursive: true });
var fd = fs.openSync(CIKTI, 'w');
var tampon = [], tamponBoy = 0, yazilan = 0;
function yaz(s) { tampon.push(s); tamponBoy += s.length; if (tamponBoy > (1 << 20)) bosalt(); }
function bosalt() {
  if (!tampon.length) return;
  var s = tampon.join('');
  fs.writeSync(fd, s);
  yazilan += s.length;
  tampon = []; tamponBoy = 0;
}

yaz(['ISO-10303-21;', 'HEADER;',
  "FILE_DESCRIPTION(('CATIA V5 STEP Exchange'),'2;1');",
  "FILE_NAME('" + path.basename(CIKTI) + "','2026-10-19T00:00:00',('none'),('none'),'CATIA Version 5','MFSim step-deneme','none');",
  "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
  'ENDSEC;', 'DATA;', ''].join('\r\n'));

// Testlerin yazıcısı; kayıtlar biriktirilmez, akışa yazılır
class AkisYaz extends Y.StepYaz {
  ekle(metin) { var id = ++this.id; yaz('#' + id + '=' + metin + ';\r\n'); return id; }
}
var yz = new AkisYaz();

// Parça türleri ve bayt payları (döküm baskın: blok, kafa, kapaklar, karter)
var TURLER = {
  dokum: function () { return T.bsKutuYuzleri(yz, ara(40, 260), ara(40, 220), ara(30, 200), 6 + Math.floor(rnd() * 9), ara(2, 9)); },
  kasnak: function () {
    return Y.profilYuzleri(yz, Y.eksen([0, 0, 0], [0, 0, 1], [1, 0, 0]), Y.kanalliProfil({ od: ara(70, 190), n: 4 + Math.floor(rnd() * 5) }));
  },
  civata: function () { return rnd() < 0.5 ? T.silindirYuzleri(yz, ara(4, 9), ara(16, 80)) : T.kutuYuzleri(yz, ara(10, 20), ara(10, 20), ara(5, 12)); },
  braket: function () { return T.kutuYuzleri(yz, ara(60, 200), ara(10, 25), ara(60, 160)); }
};
var PAY = [['dokum', 0.30], ['kasnak', 0.12], ['civata', 0.50], ['braket', 0.08]];
function turSec() { var r = rnd(); for (var i = 0; i < PAY.length; i++) { if ((r -= PAY[i][1]) <= 0) return PAY[i][0]; } return 'civata'; }

var kok = yz.urun('GUC_GRUBU', 'GÜÇ GRUBU — deneme');
var ALT = [
  { id: 'MOTOR', ad: 'Motor', pay: 0.55, o: [125, 0, 550], R: [450, 330, 380] },
  { id: 'SANZIMAN', ad: 'Şanzıman', pay: 0.25, o: [815, 40, 365], R: [300, 250, 250] },
  { id: 'TRANSFER', ad: 'Transfer kutusu', pay: 0.14, o: [1430, 55, 200], R: [220, 300, 200] },
  { id: 'BRAKETLER', ad: 'Braketler', pay: 0.04, o: [600, 0, 300], R: [900, 380, 260] },
  { id: 'TAKOZLAR', ad: 'Takozlar', pay: 0.02, o: [600, 0, 280], R: [900, 380, 260] }
].map(function (a) { a.urun = yz.urun(a.id, a.ad); a.taklar = []; a.parca = 0; return a; });

var sayac = { parca: 0, yuz: 0, tur: {} };
var hedef = MB * 1e6;
while (yazilan + tamponBoy < hedef) {
  var r = rnd(), A = ALT[0];
  for (var j = 0; j < ALT.length; j++) { if ((r -= ALT[j].pay) <= 0) { A = ALT[j]; break; } }
  var tur = A.id === 'TAKOZLAR' ? (rnd() < 0.5 ? 'civata' : 'dokum') : turSec();
  var no = ++sayac.parca;
  var u = yz.urun(A.id + '-' + tur.toUpperCase() + '-' + no, A.ad + ' ' + tur + ' ' + no);
  var yuzler = TURLER[tur]();
  sayac.yuz += yuzler.length;
  sayac.tur[tur] = (sayac.tur[tur] || 0) + 1;
  yz.govde(u, yuzler, 'kati');
  yz.temsil(u);
  var konum = [0, 1, 2].map(function (d) { return A.o[d] + ara(-A.R[d], A.R[d]); });
  // Yerel eksen dünyada döndürülmüş (gerçek dosyanın kalıbı)
  var th = ara(0, 2 * Math.PI), zz = [Math.cos(th) * 0.3, Math.sin(th) * 0.3, 1];
  var Lz = Math.hypot(zz[0], zz[1], zz[2]), z = zz.map(function (v) { return v / Lz; });
  var x = [1 - z[0] * z[0], -z[0] * z[1], -z[0] * z[2]], Lx = Math.hypot(x[0], x[1], x[2]);
  A.taklar.push(yz.tak(A.urun, u, A.id + '-' + no + '.1', konum, z, x.map(function (v) { return v / Lx; })));
  A.parca++;
}
var kokTak = [];
ALT.forEach(function (A) { yz.temsil(A.urun); kokTak.push(yz.tak(kok, A.urun, A.id + '.1', [0, 0, 0], [0, 0, 1], [1, 0, 0])); });
yz.temsil(kok);
ALT.forEach(function (A) { A.taklar.forEach(function (t) { yz.bagla(t); }); });
kokTak.forEach(function (t) { yz.bagla(t); });
yaz('ENDSEC;\r\nEND-ISO-10303-21;\r\n');
bosalt();
fs.closeSync(fd);
console.log(JSON.stringify({ dosya: path.relative(ROOT, CIKTI), bayt: fs.statSync(CIKTI).size, kayit: yz.id,
  parca: sayac.parca, yuz: sayac.yuz, tur: sayac.tur,
  altMontaj: ALT.map(function (a) { return a.id + ':' + a.parca; }).join(' ') }));
