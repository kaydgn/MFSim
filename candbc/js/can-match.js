// ═══════════════════════════════════════════════════════════════════════════
// KANAL ÇÖZÜMLEMESİ — kayıttaki kimlik ↔ DBC mesajı
// ═══════════════════════════════════════════════════════════════════════════
//
// DOM'suz saf modül.
//
// ── KANAL NEDİR ──────────────────────────────────────────────────────────
// Programın çalışma birimi DBC mesajı DEĞİL, **kayıtta gerçekten geçen bir
// kimlik**tir. Buna KANAL diyoruz. Bir kanalın bir DBC tanımı olabilir de
// olmayabilir de; aynı DBC tanımına birden fazla kanal düşebilir.
//
// Ağaç neden DBC'den değil KAYITTAN sürülüyor:
//   • Gerçek bir J1939 veritabanında 950 mesaj var, kayıtta 81 kimlik geçiyor.
//     Ağacı DBC'den sürmek 950 satırın 869'unu boşuna göstermek demek.
//   • Aynı mesajı BİRDEN FAZLA KAYNAK gönderiyor. Ölçüldü (kullanıcının
//     kaydı): TSC1 yedi ayrı kaynak adresinden geliyor. Bunları tek bir
//     "TSC1" satırında birleştirmek yedi ayrı ECU'nun isteğini tek eğriye
//     karıştırmak olurdu — makul görünen, yanlış bir eğri.
//   Bu yüzden her kaynak KENDİ satırında durur ve adresiyle etiketlenir.
//
// ── EŞLEŞTİRME SIRASI ────────────────────────────────────────────────────
//   1. TAM: kimlik + çerçeve tipi birebir aynı.
//   2. PGN: yalnız 29 bitlik çerçevede, yalnız tam eşleşme YOKSA. Kaynak
//      adresi (ve PDU1'de hedef adresi) yok sayılır.
//   3. Eşleşme yok → kanal "tanımsız" kalır; sessizce atılmaz, ağaçta ve
//      Tanı sekmesinde listelenir.
//
// PGN eşleştirmesi KAPATILABİLİR (opts.j1939 === false): J1939 olmayan ama
// 29 bit kullanan bir otobüste PGN yorumu anlamsız eşleşmeler üretebilir.

// Vector'ün "sahipsiz sinyal" kabı. Gerçek bir mesaj değildir: CANdb++ hangi
// mesaja da ait olmayan sinyalleri buraya toplar ve kimliği 0xC0000000'dır →
// PGN 0. Eşleştirmeye sokulursa TSC1'in (PGN 0) yerine geçer ve gerçek
// mesajı gölgeler.
var CDB_VECTOR_BUCKET = 'VECTOR__INDEPENDENT_SIG_MSG';

function cdbPgnIndex(db) {
  if (db._pgnIndex) return db._pgnIndex;
  var ix = {};
  for (var i = 0; i < db.messages.length; i++) {
    var m = db.messages[i];
    if (!m.extended) continue;
    if (m.name === CDB_VECTOR_BUCKET) continue;
    var p = cdbJ1939(m.id).pgn;
    (ix[p] = ix[p] || []).push(m);
  }
  db._pgnIndex = ix;
  return ix;
}

// Aynı PGN'i paylaşan adaylar arasında seçim. Puanlama GÖRÜNÜR: kazanan da
// kaybedenler de kanalın `alts` alanında duruyor ve Tanı sekmesinde yazılıyor.
// Sessizce "ilkini al" demek, CCVS1 yerine CCVS1_Trip_Recorder çözüp
// kullanıcıya haber vermemek olurdu.
function cdbScoreCandidate(msg, ch) {
  var s = 0;
  if (ch.j && cdbJ1939(msg.id).prio === ch.j.prio) s += 4;   // öncelik tutuyor
  if (ch.dlc && msg.dlc === ch.dlc) s += 3;                  // uzunluk tutuyor
  if (!/_Copy_\d*$/.test(msg.name)) s += 2;                  // CANdb++ kopyası değil
  if (msg.signals.length) s += 1;                            // sinyali var
  return s;
}

// İki tanım BİREBİR AYNI mı? Ölçüldü: kullanıcının J1939 veritabanında
// PGN 65265'i üç mesaj paylaşıyor (CCVS1, CCVS1_J3, CCVS1_Trip_Recorder) ve
// üçünün sinyal yerleşimi TIPATIP aynı — fark yalnız addan ibaret. Böyle bir
// belirsizlik sayıyı değiştirmiyor; kullanıcıyı "hangisi doğru?" diye
// düşündürmemek için Tanı sekmesi bunu ayrıca söylüyor.
function cdbSameLayout(a, b) {
  if (a.signals.length !== b.signals.length || a.dlc !== b.dlc) return false;
  for (var i = 0; i < a.signals.length; i++) {
    var x = a.signals[i], y = b.sigByName[x.name];
    if (!y) return false;
    if (x.startBit !== y.startBit || x.length !== y.length ||
        x.littleEndian !== y.littleEndian || x.signed !== y.signed ||
        x.factor !== y.factor || x.offset !== y.offset) return false;
  }
  return true;
}

/**
 * Kayıttaki her kimlik için bir kanal kurar.
 * @returns {{channels: Array, report: Object}}
 */
function cdbBuildChannels(db, store, opts) {
  opts = opts || {};
  var useJ1939 = opts.j1939 !== false;
  var channels = [];
  var report = {
    total: 0, exact: 0, pgn: 0, unmatched: 0,
    ambiguous: [], multiSource: [], proprietary: 0
  };
  if (!store) return { channels: channels, report: report };

  var pgnIx = db ? cdbPgnIndex(db) : {};
  var keys = Object.keys(store.counts);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var ext = key.charAt(0) === 'E';
    var id = parseInt(key.slice(1), 16);
    var idx = store.byKey[key];
    var ch = {
      key: key, id: id, ext: ext,
      count: store.counts[key],
      dlc: idx && idx.length ? store.len[idx[0]] : 0,
      j: ext ? cdbJ1939(id) : null,
      msg: null, match: null, alts: null
    };
    report.total++;

    if (db && db.byKey[key] && db.byKey[key].name !== CDB_VECTOR_BUCKET) {
      ch.msg = db.byKey[key];
      ch.match = 'exact';
      report.exact++;
    } else if (db && ext && useJ1939) {
      var cands = pgnIx[ch.j.pgn];
      if (cands && cands.length) {
        var best = cands[0], bestS = -1;
        for (var c = 0; c < cands.length; c++) {
          var sc = cdbScoreCandidate(cands[c], ch);
          // Eşit puanda KISA ad kazanır: varyantlar sonek alır
          // (CCVS1 ↔ CCVS1_J3 ↔ CCVS1_Trip_Recorder). Kanonik ad soneksiz olan.
          if (sc > bestS || (sc === bestS && cands[c].name.length < best.name.length)) {
            bestS = sc; best = cands[c];
          }
        }
        ch.msg = best;
        ch.match = 'pgn';
        report.pgn++;
        if (cands.length > 1) {
          ch.alts = cands.slice();
          var ayni = true;
          for (var z = 0; z < cands.length; z++)
            if (cands[z] !== best && !cdbSameLayout(best, cands[z])) { ayni = false; break; }
          ch.altsIdentical = ayni;
          report.ambiguous.push({ ch: ch, cands: cands, identical: ayni });
        }
      }
    }

    if (!ch.match) {
      report.unmatched++;
      if (ext && cdbJ1939Proprietary(id)) report.proprietary++;
    }
    ch.label = cdbChannelLabel(ch);
    channels.push(ch);
  }

  // Aynı DBC mesajına düşen birden fazla kanal → BİRLEŞTİRİLMEZ, söylenir.
  var byMsg = {};
  for (var k = 0; k < channels.length; k++) {
    if (!channels[k].msg) continue;
    var n = channels[k].msg.name;
    (byMsg[n] = byMsg[n] || []).push(channels[k]);
  }
  for (var name in byMsg) {
    if (byMsg[name].length > 1) report.multiSource.push({ name: name, chans: byMsg[name] });
  }

  // Sıra: çok kare gönderen üstte. Kullanıcı önce otobüsün gövdesini görür.
  channels.sort(function(a, b) {
    if (!!b.msg !== !!a.msg) return a.msg ? -1 : 1;   // çözülenler önce
    return b.count - a.count;
  });
  return { channels: channels, report: report };
}

// Ağaçta görünen ad. Kaynak adresi ADIN PARÇASI: aynı mesajı gönderen iki
// ECU ağaçta ayırt edilemezse kullanıcı yanlış eğriyi okur.
function cdbChannelLabel(ch) {
  if (!ch.msg) return cdbFmtId(ch.id, ch.ext);
  if (ch.match === 'exact' || !ch.j) return ch.msg.name;
  return ch.msg.name + ' · SA ' + cdbFmtAddr(ch.j.sa);
}

// Kanalın ipucu metni — eşleşmenin NASIL kurulduğunu söyler.
function cdbChannelTitle(ch) {
  var p = [];
  p.push(cdbFmtId(ch.id, ch.ext) + (ch.ext ? '  (29 bit)' : '  (11 bit)'));
  if (ch.j) {
    p.push('PGN ' + cdbFmtPgn(ch.j.pgn) + ' · öncelik ' + ch.j.prio +
           ' · kaynak ' + cdbFmtAddr(ch.j.sa) +
           (ch.j.da !== null ? ' · hedef ' + cdbFmtAddr(ch.j.da) : ''));
  }
  p.push('Kayıtta ' + ch.count + ' kare · DLC ' + ch.dlc);
  if (ch.match === 'exact') p.push('', 'DBC: ' + ch.msg.name + ' (kimlik birebir eşleşti)');
  else if (ch.match === 'pgn') {
    p.push('', 'DBC: ' + ch.msg.name + ' (J1939 PGN eşleşmesi — kaynak adresi yok sayıldı)');
    if (ch.alts && ch.alts.length > 1) {
      p.push('Aynı PGN\'i paylaşan öteki tanımlar: ' +
             ch.alts.filter(function(m) { return m !== ch.msg; }).map(function(m) { return m.name; }).join(', '));
      p.push(ch.altsIdentical
        ? 'Bu tanımların sinyal yerleşimi BİREBİR AYNI — hangisi seçilirse seçilsin sayılar değişmez.'
        : 'DİKKAT: tanımlar birbirinden FARKLI; seçilen yanlışsa sayılar da yanlış olur.');
    }
  } else {
    p.push('', 'Yüklü DBC bu kimliği tanımlamıyor — çözülemez.');
    if (ch.ext && cdbJ1939Proprietary(ch.id)) p.push('PF alanı üretici tanımlı (proprietary): standartta karşılığı yok.');
  }
  if (ch.msg && ch.msg.cycleTime) p.push('DBC çevrimi: ' + ch.msg.cycleTime + ' ms');
  if (ch.msg && ch.msg.comment) p.push('', ch.msg.comment);
  return p.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cdbBuildChannels: cdbBuildChannels,
    cdbPgnIndex: cdbPgnIndex,
    cdbScoreCandidate: cdbScoreCandidate,
    cdbSameLayout: cdbSameLayout,
    cdbChannelLabel: cdbChannelLabel,
    cdbChannelTitle: cdbChannelTitle,
    CDB_VECTOR_BUCKET: CDB_VECTOR_BUCKET
  };
}
