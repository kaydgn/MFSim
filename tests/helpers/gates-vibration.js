/* =========================================================================
 * gates-vibration.js — Gates raporlarının "System Vibration Analysis"
 *                      sayfasındaki girdileri KAYNAĞINDAN okur
 * =========================================================================
 * NEDEN KOPYA YOK: bu sayfadaki dört büyüklük (krank mili ataleti, gergi kol
 * ataleti, gergi kasnak kütlesi, aksesuar ataletleri) ve referans (Mode 1)
 * burulma kalibrasyonunun TAMAMINI besliyor. Teste elle yazılsalardı ikinci
 * bir kopya doğar ve kaynağından sessizce ayrışabilirdi — bu projenin en
 * pahalı hata sınıfı. Arşiv `docs/gates-reports/pdf/` altında olduğu için
 * doğrudan okumak mümkün; 10 PDF 261 ms (ölçüldü), modül önbellekli.
 *
 * NE DÜZELTTİ (üçü de ölçülmüş sessiz kusurdu):
 *   1. Test krank mili ataletini BEŞ sistem için 0.7'ye sabitliyordu; raporlar
 *      sistem başına 0.15 / 0.5 / 0.7 diyor. Fixture doğru değeri iki sistemde
 *      zaten taşıyordu, test onu okumuyordu.
 *   2. AG00810'un gergi kasnak kütlesi "BİLİNMİYOR" diye belgeliydi; raporunun
 *      kendi sayfası 0.80 kg yazıyor.
 *   3. Üç NF referansı kaynağıyla uyuşmuyordu (11.87 ↔ 12.61 · 13.35 ↔ 12.61 ·
 *      13.29 ↔ 15.05). Gates SÜRÜM farkı değil: damgalar birebir aynı.
 * ========================================================================= */
'use strict';
const path = require('path');
const { gatesPdfPages, numbersAfter } = require('./gates-pdf.js');

const DIR = path.join(__dirname, '../../docs/gates-reports/pdf');

/** Doğrulama anahtarı → arşivdeki rapor dosyası. */
const REPORT = {
  'AG00686':      'AG00686_8PK1475HD_T38624-24.6Nm_2023-09-07.pdf',
  'AG00686-1520': 'AG00686_8PK1520HD_T38624-22.2Nm_2023-09-07.pdf',
  'AG00810':      'AG00810_10PK1215HD_T38519-v8_2021-09-16.pdf',
  'AG00879':      'AG00879_8PK1392HD_T38665-31Nm_2023-05-17.pdf',
  'AG0868-4PK':   'AG0868_4PK1013HD_E9843-16Nm_2022-12-27.pdf',
  'AG0868-6PK':   'AG0868_6PK1018HD_E9843-19Nm_2022-12-27.pdf',
  'AG0868':       'AG0868_8PK1020HD_E9843-22.5Nm_2022-12-27.pdf',
};

const cache = {};

/**
 * Aksesuar adları sayfanın KENDİ başlığından okunur, fixture sırasından değil.
 * Sınır etiketi ÖNEKLE aranır: bazı raporlarda `File Name -if used` tek parça,
 * bazılarında `File Name` + `-` + `if used` olarak bölünmüş. Tam eşitlik arayan
 * sürüm ikinci gruptaki raporlarda tabloyu BOŞ döndürüyordu — sessiz, çünkü boş
 * sözlük "aksesuar ataleti yok" gibi görünüp varsayılana düşerdi.
 */
function accessoryNames(lines) {
  const a = lines.indexOf('Accessory Data');
  if (a < 0) return [];
  const b = lines.findIndex((x, i) => i > a && x.indexOf('File Name') === 0);
  if (b < 0) return [];
  return lines.slice(a + 1, b);
}

/** Bir raporun titreşim sayfasındaki girdiler + Gates'in Mode 1 referansı. */
function vibrationOf(key) {
  if (cache[key]) return cache[key];
  const file = REPORT[key];
  if (!file) throw new Error('arşivde titreşim raporu yok: ' + key);
  const page = gatesPdfPages(path.join(DIR, file))
    .find((t) => t.indexOf('System Vibration Analysis') >= 0);
  if (!page) throw new Error('titreşim sayfası yok: ' + file);

  const lines = page.split('\n').map((x) => x.trim()).filter(Boolean);
  const names = accessoryNames(lines);
  const vals = numbersAfter(page, 'Moment of Inertia kg m^2', names.length);
  const inertia = {};
  names.forEach((n, i) => { if (vals[i] != null) inertia[n] = vals[i]; });

  const m = /Mode 1:\s*([\d.]+)/.exec(page);
  if (!m) throw new Error('System Resonance (Mode 1) yok: ' + file);

  cache[key] = {
    file: file,
    crankInertiaKgM2: numbersAfter(page, 'Crankshaft Moment of Inertia kg m^2', 1)[0],
    armInertiaKgM2:   numbersAfter(page, 'Inertia of the Tensioner Arm Kg', 1)[0],
    pulleyMassKg:     numbersAfter(page, 'Tensioner Pulley Mass kg', 1)[0],
    accessoryInertia: inertia,
    mode1Hz:          parseFloat(m[1]),
  };
  return cache[key];
}

module.exports = { REPORT, vibrationOf };
