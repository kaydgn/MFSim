/* SUITE E — D1 düzeltmesi + flutter oranının GERÇEKÇİ tasarımlarda ölçümü */
const L = require('./lib.js'); const C = L.C; const OUT = {}; const say = (...a) => console.log(...a);

/* ═════ E1 — BEŞ PROFİL × MARKA, doğru sırt yerleşimiyle ═════ */
say('═════ E1 — ÇAP KATMANI: 11 PROFİL-MARKA ÇİFTİ ═════');
{
  const rows = [];
  Object.keys(C.BELT_DB).forEach(prof => Object.keys(C.BELT_DB[prof]).forEach(brand => {
    const bp = C.beltProps({ profile: prof, brand });
    const od = Math.max(bp.minPulleyDia * 1.6, 60), Rc = od * 3;
    /* 5 kaburgalı gövde + kirişin DIŞINA konmuş 1 sırt avarası */
    const P = [];
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * Math.PI / 5;
      P.push({ name: 'P' + i, contact: 'grooved', od, c: [Rc * Math.cos(a), Rc * Math.sin(a)] });
    }
    const odB = od * 0.6, rB = odB / 2 + bp.hr;
    const M = [(P[0].c[0] + P[1].c[0]) / 2, (P[0].c[1] + P[1].c[1]) / 2];
    const nn = Math.hypot(M[0], M[1]);
    const it = rB * 0.7;                                  /* kirişi içe bastır */
    const cB = [M[0] * (1 + it / nn), M[1] * (1 + it / nn)];
    P.splice(1, 0, { name: 'S', contact: 'back', od: odB, c: cB });
    const res = P.map(p => Object.assign({ name: p.name, contact: p.contact, c: p.c },
      C.radiiFromOD(p.od, p.contact, bp)));
    let g, ok = true, msg = '';
    try { g = C.solveGeometry(res); } catch (e) { ok = false; msg = e.message.slice(0, 45); }
    const idOK = g ? Math.abs(g.LpitchMm - g.LeffMm - 2 * Math.PI * bp.hb) < 1e-9 : false;
    const wrapOK = g ? Math.abs(Math.abs(g.signedWrapDeg) - 360) < 1e-9 : false;
    /* sırt kasnağının pitch yarıçapı od/2+hr, efektif od/2+hr+hb olmalı */
    const sb = g ? g.pulleys.find(p => p.name === 'S') : null;
    const rOK = sb ? (Math.abs(sb.rPitch - (odB / 2 + bp.hr)) < 1e-12
      && Math.abs(sb.rEff - (odB / 2 + bp.hr + bp.hb)) < 1e-12) : false;
    rows.push({ prof, brand, hb: bp.hb, hr: bp.hr, ok, idOK, wrapOK, rOK, msg });
    say(`  ${(prof + '/' + brand).padEnd(16)} hb=${String(bp.hb).padEnd(5)} hr=${String(bp.hr).padEnd(4)} ` +
      (ok ? `Σsarım ${wrapOK ? '✓' : '✗'} · L_p−L_e=2πhb ${idOK ? '✓' : '✗'} · sırt yarıçapları ${rOK ? '✓' : '✗'}`
        : `çözülemedi: ${msg}`));
  }));
  const tam = rows.filter(r => r.ok && r.idOK && r.wrapOK && r.rOK).length;
  say(`  → ${tam}/${rows.length} çiftte çap katmanı, sarım değişmezi ve sırt yarıçapları TAM`);
  OUT.E1 = { rows, tam, n: rows.length };
}

/* ═════ E2 — FLUTTER BAYRAĞI: gerçekçi tasarımlarda oranı ═════ */
say('\n═════ E2 — ÇIRPINMA (flutter) BAYRAĞININ SIKLIĞI ═════');
{
  for (const mr of [0.0144, 0.0196]) {
    for (const rpm of [1800, 3000]) {
      const rr = L.rng(90210);
      let n = 0, fl = 0, nGercek = 0, flGercek = 0, sapma = [];
      for (let i = 0; i < 500; i++) {
        const S = L.genSystem(rr); if (!S) continue;
        S.sys.belt.massPerRibKgM = mr;
        try {
          const rel = C.meanRel(S.sys), st = C.tensionerState(S.sys, rel);
          const tn = C.spanTensions(S.sys, { engineRpm: rpm, loadsKw: S.loads });
          const fr = C.spanFrequencies(S.sys, st.geom, tn.spanN, { engineRpm: rpm });
          const mp = C.massPerM(S.sys);
          const perRib = S.sys.designTensionN / S.sys.belt.ribs;
          const gercekci = perRib >= 60 && perRib <= 130 && tn.vMs <= 45;
          n++; if (fr.some(f => f.flutter)) fl++;
          if (gercekci) {
            nGercek++; if (fr.some(f => f.flutter)) flGercek++;
            fr.forEach((f, k) => {
              if (f.fHz[0] <= 0) return;
              const ce = Math.sqrt(Math.max(tn.spanN[k], 0) / mp), Lm = st.geom.spans[k].L / 1000;
              const dogru = ce * ce / (2 * Lm * Math.sqrt(ce * ce + tn.vMs * tn.vMs));
              sapma.push((f.fHz[0] / dogru - 1) * 100);
            });
          }
        } catch (e) { }
      }
      sapma.sort((a, b) => a - b);
      say(`  m′/kaburga=${mr} · ${rpm} d/d → flutter: tümü ${fl}/${n} (%${(fl / n * 100).toFixed(1)}) · ` +
        `gerçekçi tasarımlar ${flGercek}/${nGercek} (%${(flGercek / Math.max(1, nGercek) * 100).toFixed(1)})`);
      if (sapma.length) say(`      frekans sapması (gerçekçi): ortanca %${sapma[Math.floor(sapma.length / 2)].toFixed(1)} · en kötü %${sapma[0].toFixed(1)}`);
      OUT['E2_' + mr + '_' + rpm] = { n, fl, nGercek, flGercek,
        ortanca: sapma.length ? sapma[Math.floor(sapma.length / 2)] : null, enKotu: sapma[0] };
    }
  }
}

/* ═════ E3 — KAYMA EMNİYETİ: YÜK TAŞIYAN kasnaklarda ═════
 * Gerginlik oranı ≈1 olan avarada SF bir MARJ değil, o sarımın KAPASİTESİ.
 * MFSim bunu köprüde ayırıyor (VE_FEAD_SLIP_LOADED_RATIO = 1.01). */
say('\n═════ E3 — KAYMA EMNİYETİ: YÜKLÜ KASNAK AYRIMI ═════');
{
  const ref = require('./ref.js');
  const R = ref.refSys();
  const LOADS = { FAN: 4.2, AC: 3.6, ALT: 2.8 };
  const tn = C.spanTensions(R.sys, { engineRpm: 1800, loadsKw: LOADS });
  const sl = C.slipSafety(R.st.geom, tn.spanN);
  say('  kasnak   sarım[°]  T_gir  T_çık  oran    kapasite   SF     yük taşıyor?');
  sl.forEach((s, i) => {
    const yuklu = s.tensionRatio > 1.01;
    say(`  ${s.name.padEnd(8)} ${R.st.geom.wrapDeg(i).toFixed(1).padStart(7)} ${tn.perPulley[i].entryTensionN.toFixed(0).padStart(6)} ${tn.perPulley[i].exitTensionN.toFixed(0).padStart(6)} ${s.tensionRatio.toFixed(3).padStart(7)} ${s.capstanCapacity.toFixed(2).padStart(9)} ${s.SF.toFixed(2).padStart(6)}   ${yuklu ? 'EVET' : 'hayır (kapasite)'}`);
  });
  const yuklu = sl.filter(s => s.tensionRatio > 1.01);
  say(`  → yük taşıyan kasnakların en küçük SF'i: ${Math.min.apply(null, yuklu.map(s => s.SF)).toFixed(2)}`);
  say(`     (tüm kasnaklar alınsaydı ${Math.min.apply(null, sl.map(s => s.SF)).toFixed(2)} — avaranın kapasitesi, bir marj DEĞİL)`);
  OUT.E3 = { yukluMin: Math.min.apply(null, yuklu.map(s => s.SF)), hepsiMin: Math.min.apply(null, sl.map(s => s.SF)) };
}

