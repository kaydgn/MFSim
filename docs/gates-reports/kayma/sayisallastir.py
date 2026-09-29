# Gates "Belt Slip Safety Factor" (log) ve "Accessory Peak Powers/Torques" (doğrusal)
# grafiklerini sayıya çevirir. Eksenler çerçeve + çentik + ızgara çizgisinden
# kalibre edilir; GÖZLE OKUNAN tek şey eksen etiketleridir (aşağıdaki OKUNAN).
import pymupdf as fitz, json, math, sys, statistics as st

S = sys.argv[1]

# Grafiklerden gözle okunan eksen etiketleri (2026-09-29).
#   sf_max : SF grafiğinin x ekseninin sağ ucu [d/dk]; çentik adımı = 0,15·sf_max
#   pp     : tepe yük grafiğinin ilk ızgara etiketi ve adımı, birimi
OKUNAN = {
  'AG00686_8PK1475HD':  {'sf_max': 2600, 'pp': (966, 483, 'kW')},
  'AG00686_8PK1520HD':  {'sf_max': 2600, 'pp': (966, 483, 'Nm')},
  'AG00810_10PK1215HD': {'sf_max': 2000, 'pp': (564, 564, 'kW')},
  'AG00879_8PK1392HD':  {'sf_max': 2850, 'pp': (960, 480, 'kW')},
  'AG00894_8PK1738HD':  {'sf_max': 2200, 'pp': (576, 576, 'kW')},
  'AG00902_8PK1275HD':  {'sf_max': 3000, 'pp': (724, 724, 'kW')},
  'AG00902_8PK1300HD':  {'sf_max': 3000, 'pp': (724, 724, 'kW')},
  'AG00976_8PK1715HD':  {'sf_max': 2300, 'pp': None},
  'AG0868_4PK1013HD':   {'sf_max': 3200, 'pp': (840, 420, 'kW')},
  'AG0868_6PK1018HD':   {'sf_max': 3200, 'pp': (840, 420, 'kW')},
  'AG0868_8PK1020HD':   {'sf_max': 3200, 'pp': (840, 420, 'kW')},
}

class Resim:
    def __init__(self, yol):
        p = fitz.Pixmap(yol)
        if p.alpha: p = fitz.Pixmap(p, 0)
        self.W, self.H, self.n, self.s = p.width, p.height, p.n, p.samples
    def c(self, x, y):
        i = (y * self.W + x) * self.n
        return self.s[i], self.s[i + 1], self.s[i + 2]

koyu = lambda c: max(c) < 110
beyaz = lambda c: min(c) > 235
pembe = lambda c: c[0] > 235 and 180 < c[1] < 228 and 180 < c[2] < 228
gri = lambda c: max(c) - min(c) < 18 and 150 < c[0] < 232
def uzak(a, b): return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))

def cerceve(R, esik=0.4):
    kol = [x for x in range(R.W) if sum(1 for y in range(R.H) if koyu(R.c(x, y))) > esik * R.H]
    sat = [y for y in range(R.H) if sum(1 for x in range(R.W) if koyu(R.c(x, y))) > esik * R.W]
    birles = lambda v: [g[len(g) // 2] for g in _grup(v)]
    return birles(kol), birles(sat)

def _grup(v, ara=1):
    g = []
    for a in sorted(v):
        if g and a - g[-1][-1] <= ara: g[-1].append(a)
        else: g.append([a])
    return g

def lejant(R, sag, ust, alt):
    """Çerçevenin sağındaki çizgi örnekleri: (y, renk) listesi, yukarıdan aşağı.
    Satırda sağ çerçeveden sonraki İLK parça; soluk (kenar yumuşatması) satırlar
    elenir, bitişik satırlar tek örnek sayılır, örnekler aynı sütunda başlar."""
    sat = []
    for y in range(ust, min(R.H, alt)):
        x = sag + 5
        while x < R.W and beyaz(R.c(x, y)): x += 1
        x0, renkler = x, []
        while x < R.W and not beyaz(R.c(x, y)): renkler.append(R.c(x, y)); x += 1
        if 12 <= len(renkler) <= 45:
            med = tuple(st.median([c[i] for c in renkler]) for i in range(3))
            if uzak(med, (255, 255, 255)) > 110: sat.append((y, x0, renkler))
    gr = _grup([a[0] for a in sat], 3)
    if not gr: return []
    basla = st.mode([a[1] for a in sat])
    out = []
    for g in gr:
        satirlar = [a for a in sat if a[0] in g and abs(a[1] - basla) <= 3]
        if not satirlar: continue
        rs = sorted((c for a in satirlar for c in a[2]), key=lambda c: -uzak(c, (255, 255, 255)))
        rs = rs[:max(1, len(rs) // 2)]
        med = tuple(int(st.median([c[i] for c in rs])) for i in range(3))
        out.append((st.mean([a[0] for a in satirlar]), med))
    return out

def izler(R, renkler, x0, x1, y0, y1, yasak=lambda x, y: False, tol=70, pay=16, izgara=True, altPay=16):
    """Her renk için sütun sütun eğri izi; aynı renkli iki eğri iki iz verir.
    Piksel en yakın lejant rengine atanır; iz, önceki sütundaki konuma en yakın
    kümeyle sürer, başlangıçta EN ÇOK pikselli küme seçilir (kenar yumuşatması
    başka bir eğrinin kenarını bu renge atayabilir, çekirdeği atayamaz)."""
    tekil = []
    for c in renkler:
        if not any(uzak(c, t) < 25 for t in tekil): tekil.append(c)
    sutun = {c: {} for c in tekil}
    for x in range(x0 + pay, x1):
        sinif = []
        for y in range(y0, y1 - altPay + 1):
            p = R.c(x, y)
            if yasak(x, y) or beyaz(p) or pembe(p) or (izgara and gri(p)): continue
            best = min(tekil, key=lambda t: uzak(p, t))
            dd = uzak(p, best)
            if dd > (tol + 40 if max(best) < 130 else tol): continue
            sinif.append((y, best))
        for c in tekil:
            ys = [y for y, b in sinif if b is c]
            sutun[c][x] = [(st.mean(g), len(g)) for g in _grup(ys, 2)]
    sonuc = {}
    for c in tekil:
        kac = sum(1 for d in renkler if uzak(c, d) < 25)
        iz = [dict() for _ in range(kac)]
        onceki = [None] * kac
        bos = 0
        for x in range(x0 + pay, x1):
            k = sutun[c].get(x, [])
            if not k:
                bos += 1
                if bos > 30: onceki = [None] * kac
                continue
            bos = 0
            if all(o is None for o in onceki):
                sec = sorted(sorted(k, key=lambda a: -a[1])[:kac], key=lambda a: a[0])
                for j, (yv, n) in enumerate(sec):
                    if n >= 2: iz[j][x] = yv; onceki[j] = yv
                continue
            for j in range(kac):
                if onceki[j] is None: continue
                yak = min(k, key=lambda a: abs(a[0] - onceki[j]))
                if abs(yak[0] - onceki[j]) < 12:
                    iz[j][x] = yak[0]; onceki[j] = yak[0]
            if kac > 1 and any(o is None for o in onceki):
                for j in range(kac):
                    if onceki[j] is None:
                        kalan = [a for a in k if all(abs(a[0] - o) > 6 for o in onceki if o is not None)]
                        if kalan:
                            yv = max(kalan, key=lambda a: a[1])[0]; iz[j][x] = yv; onceki[j] = yv
        sonuc[c] = iz
    return sonuc

def sf_grafik(ad):
    R = Resim(f'{S}/sf/{ad}.png')
    kol, sat = cerceve(R)
    sol, sag = kol[0], kol[-1]
    ust, alt = sat[0], sat[-1]
    # eşik: çerçeve içinde kesikli koyu satır, altı pembe
    esik = [y for y in range(ust + 3, alt - 3)
            if sum(1 for x in range(sol, sag) if koyu(R.c(x, y))) > 0.25 * (sag - sol)
            and pembe(R.c((sol + sag) // 2 + 7, y + 6))]
    y1 = st.mean(_grup(esik)[0])
    # sol eksen çentikleri
    boy = {}
    for y in range(ust + 3, alt - 2):
        n = 0
        for x in range(sol + 1, sol + 16):
            if koyu(R.c(x, y)): n += 1
            else: break
        if n >= 2: boy[y] = n
    uzun = max(boy.values()) if boy else 0
    buyuk = [st.mean(g) for g in _grup([y for y, n in boy.items() if n >= uzun - 2])]
    fark = [b - a for a, b in zip(buyuk, buyuk[1:])]
    dmin = min(fark)
    d = st.median([f / round(f / dmin) for f in fark])
    en = (len(buyuk), round(min(abs(y1 - b) for b in buyuk), 1))
    # alt eksen çentikleri
    xc = [x for x in range(sol - 2, sag + 3)
          if sum(1 for y in list(range(alt - 7, alt - 1)) + list(range(alt + 2, alt + 8))
                 if 0 <= y < R.H and koyu(R.c(x, y))) >= 3]
    xc = [st.mean(g) for g in _grup(xc)]
    ic = [x for x in xc if sol + 5 < x < sag - 5]
    s = st.median([b - a for a, b in zip(ic, ic[1:])]) if len(ic) > 2 else None
    xmax = OKUNAN[ad]['sf_max']
    oran = (sag - sol) / s if s else None
    lj = lejant(R, sag, ust, alt)
    yasak = lambda x, y: abs(y - y1) <= 2 or (y1 < y < y1 + 0.35 * d)
    I = izler(R, [c for _, c in lj], sol + 2, sag - 1, ust + 2, alt - 1, yasak, izgara=False,
              tol=(45 if R.W > 700 else 70))
    egriler = []
    kull = {}
    for (yl, c) in lj:
        anahtar = next(k for k in I if uzak(k, c) < 25)
        j = kull.get(anahtar, 0); kull[anahtar] = j + 1
        iz = I[anahtar][j] if j < len(I[anahtar]) else {}
        nokta = sorted((round((x - sol) / (sag - sol) * xmax, 1), round(10 ** ((y1 - y) / d), 4)) for x, y in iz.items())
        egriler.append({'renk': c, 'lejantY': yl, 'nokta': nokta})
    return {'cerceve': [sol, sag, ust, alt], 'y1': y1, 'onKat': d, 'centikEslesen': en,
            'xAdim': s, 'cerceveBoluAdim': oran, 'xmax': xmax, 'lejant': len(lj), 'egriler': egriler}

def pp_grafik(ad):
    o = OKUNAN[ad]['pp']
    if not o: return None
    ilk, adim, birim = o
    R = Resim(f'{S}/pp/{ad}.png')
    kol, sat = cerceve(R, 0.35)
    sol, sag = kol[0], kol[-1]
    ust, alt = sat[0], sat[-1]
    # dikey ızgara (kesikli gri)
    gx = [x for x in range(sol + 3, sag - 2) if sum(1 for y in range(ust, alt) if gri(R.c(x, y))) > 0.3 * (alt - ust)]
    gx = [st.mean(g) for g in _grup(gx)]
    s = st.median([b - a for a, b in zip(gx, gx[1:])])
    rpm = lambda x: ilk + (x - gx[0]) / s * adim
    # min/max devir kesikli çizgileri
    mavi = [x for x in range(sol - 2, sag + 3) if sum(1 for y in range(ust, alt) if (lambda c: c[2] > 200 and c[0] < 60 and c[1] < 60)(R.c(x, y))) > 0.3 * (alt - ust)]
    kirmizi = [x for x in range(sol - 2, sag + 3) if sum(1 for y in range(ust, alt) if (lambda c: c[0] > 200 and c[1] < 60 and c[2] < 60)(R.c(x, y))) > 0.3 * (alt - ust)]
    lj = lejant(R, sag, ust, alt)
    lj = [(y, c) for (y, c) in lj]
    yuk = lambda y: (alt - y) / (alt - ust) * 50.0
    I = izler(R, [c for _, c in lj], sol + 2, sag - 1, ust + 2, alt + 1,
              yasak=lambda x, y: any(abs(x - m) <= 2 for m in mavi + kirmizi), tol=80, altPay=3)
    egriler = []; kull = {}
    for (yl, c) in lj:
        anahtar = next(k for k in I if uzak(k, c) < 25)
        j = kull.get(anahtar, 0); kull[anahtar] = j + 1
        iz = I[anahtar][j] if j < len(I[anahtar]) else {}
        nokta = sorted((round(rpm(x), 1), round(yuk(y), 3)) for x, y in iz.items())
        egriler.append({'renk': c, 'lejantY': yl, 'nokta': nokta})
    return {'cerceve': [sol, sag, ust, alt], 'izgaraX': gx, 'birim': birim,
            'minDevir': [round(rpm(x)) for x in [st.mean(g) for g in _grup(mavi)]],
            'maxDevir': [round(rpm(x)) for x in [st.mean(g) for g in _grup(kirmizi)]],
            'lejant': len(lj), 'egriler': egriler}

out = {}
for ad in OKUNAN:
    r = {'sf': sf_grafik(ad)}
    try: r['pp'] = pp_grafik(ad)
    except Exception as e: r['pp'] = {'hata': str(e)}
    out[ad] = r
    sf = r['sf']
    print(ad, 'SF: çerçeve', sf['cerceve'], 'y1', round(sf['y1'], 1), 'on-kat', sf['onKat'], 'çentik', sf['centikEslesen'],
          'x adım', sf['xAdim'], 'çerçeve/adım', round(sf['cerceveBoluAdim'], 3) if sf['cerceveBoluAdim'] else None,
          'lejant', sf['lejant'], [len(e['nokta']) for e in sf['egriler']])
    pp = r['pp']
    if pp and 'hata' not in pp:
        print('   PP: ızgara', [round(g) for g in pp['izgaraX']], 'min', pp['minDevir'], 'max', pp['maxDevir'],
              'lejant', pp['lejant'], [len(e['nokta']) for e in pp['egriler']])
    elif pp: print('   PP hata', pp['hata'])
json.dump(out, open(f'{S}/sayisal.json', 'w'))
