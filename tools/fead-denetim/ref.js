const C = require('../../js/fead-core.js');
const DEG = Math.PI / 180;
function refSys(o) {
  o = o || {};
  const belt = { profile: 'PK', brand: 'GATES', ribs: o.ribs || 6, massPerRibKgM: 0.0196 };
  const TCEN = [430, 270];
  const P = [
    { name: 'KRANK', od: 180, contact: 'grooved', x: 0, y: 0, crank: true, inertiaKgM2: 0.060 },
    { name: 'FAN', od: 150, contact: 'grooved', x: 30, y: 300, inertiaKgM2: 0.011 },
    { name: 'AC', od: 120, contact: 'grooved', x: 300, y: 330, inertiaKgM2: 0.0042 },
    { name: 'GERGI', od: 76, contact: 'grooved', x: TCEN[0], y: TCEN[1], inertiaKgM2: 0.0009 },
    { name: 'ALT', od: 62, contact: 'grooved', x: 420, y: 60, inertiaKgM2: 0.0021 },
    { name: 'AVARA', od: 70, contact: 'back', x: 213, y: 8, inertiaKgM2: 0.0007 },
  ];
  const bp = C.beltProps(belt);
  const g0 = C.solveGeometry(P.map(p => Object.assign(
    { name: p.name, contact: p.contact, c: [p.x, p.y] }, C.radiiFromOD(p.od, p.contact, bp))));
  const uIn = g0.spans[2].u, uOut = g0.spans[3].u;
  const hubDir = Math.atan2(uOut[1] - uIn[1], uOut[0] - uIn[0]);
  const armLength = 70, pAng = hubDir - Math.PI / 2;
  const pivot = [TCEN[0] + armLength * Math.cos(pAng), TCEN[1] + armLength * Math.sin(pAng)];
  const freeAngleDeg = Math.atan2(TCEN[1] - pivot[1], TCEN[0] - pivot[0]) / DEG;
  const pl = JSON.parse(JSON.stringify(P));
  pl[3].tensioner = true; delete pl[3].x; delete pl[3].y;
  const cfg = {
    pulleys: pl, belt, driveRatio: o.driveRatio != null ? o.driveRatio : 1,
    tensioner: { pivot, armLength,
      preloadNm: o.preloadNm != null ? o.preloadNm : 34,
      rateNmPerDeg: o.rateNmPerDeg != null ? o.rateNmPerDeg : 0.22,
      freeAngleDeg, armInertiaKgM2: 0.0009, pulleyMassKg: 0.5 },
  };
  const sys = C.makeSystem(cfg);
  const st = C.tensionerState(sys, o.rel != null ? o.rel : 18);
  sys.belt.effLength = st.driveLenMm;
  sys.designTensionN = st.tensionN;
  return { sys, cfg, st };
}
module.exports = { refSys };
