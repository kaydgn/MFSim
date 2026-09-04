// ============================================================================
// DEPLOY STATUS GÖSTERGESİ
// Manuel kontrol: 🔄 butonuna tıklayınca önce kendi Pages'imizden version.json
// çekilir (rate-limit yok). Bulunamazsa GitHub Actions API fallback'ine düşer.
// ============================================================================

var DEPLOY_REPO = 'kaydgn/MFSim';
var DEPLOY_RUN_ID = '__DEPLOY_RUN_ID__'; // Workflow sırasında run ID ile değiştirilir

// ═══ GÖMÜLÜ SÜRÜM KÜNYESİ ═══
// build.js tek dosyaya yazar (window.__MFSIM_BUILD): commit, tarih, PR ve son
// on değişiklik. Kaynağı git — ağ değil. Modüler index.html'de YOKTUR; o
// durumda aşağıdaki yollar eski davranışa düşer.
function _veBuildInfo() {
  var b = (typeof window !== 'undefined') ? window.__MFSIM_BUILD : null;
  return (b && b.sha) ? b : null;
}

// ═══ ÇEVRİMDIŞI KAPISI ═══
// İndirilen tek dosya file:// ile açılıyor. ÖLÇÜLDÜ (gerçek Chrome, yanında
// pwa/ olmayan bir kopya): version.json → ERR_FAILED (file:// CORS), ardından
// yedek yol api.github.com'a çıkıyor ve kullanıcının ağı GitHub'a çıkamadığı
// için o da düşüyor. Sonuç her açılışta 2 başarısız istek + 2 konsol hatası,
// ve nokta kalıcı olarak "Bağlantı yok". Üstelik 15 dakikada bir tekrar.
//
// file:// üzerinde ağda ARANACAK BİR ŞEY YOK: version.json deploy ürünüdür,
// dosyanın yanında hiçbir zaman bulunmaz. Bu yüzden ağ hiç denenmez; künye
// gömülü olandan okunur.
function _veOfflineOnly() {
  return (typeof location !== 'undefined') && location.protocol === 'file:';
}

// ═══ 🔄 REFRESH BUTONU ═══
function veRefreshApp() {
  var btn = document.getElementById('ve-deploy-refresh');
  var dot = document.getElementById('ve-deploy-dot');
  if(btn) btn.style.animation = 'deploySpin 0.6s linear infinite';

  _veCheckDeploy(function(info) {
    if(btn) btn.style.animation = '';
    if(!info || !dot) return;

    // Gömülü künyede karşılaştırılacak bir "yayın" yok; elindeki kopya
    // gösterilir, güncellik iddiası edilmez.
    if(info.source === 'embedded') {
      _veShowPopup(dot, info, 'Bu Kopya', false);
      return;
    }

    if(info.status === 'completed' && info.conclusion === 'success') {
      // Bu sayfa hangi workflow run'dan deploy edildi?
      var runId = DEPLOY_RUN_ID;
      var isNewer = true;
      if(runId && runId !== '__DEPLOY_RUN_ID__' && info.runId) {
        isNewer = String(info.runId) !== String(runId);
      }
      if(isNewer) {
        _veShowPopup(dot, info, '<span class="mf-ico mf-ico-bell"></span> Güncelleme Mevcut', true);
      } else {
        _veShowPopup(dot, info, '✓ Program Güncel', false);
      }
    } else if(info.status === 'in_progress' || info.status === 'queued') {
      _veShowPopup(dot, info, '⏳ Deploy Devam Ediyor', false);
    } else {
      _veShowPopup(dot, info, '✗ Deploy Başarısız', false);
    }
  });
}

// ═══ YEŞİL NOKTAYA TIKLAMA ═══
function veShowDeployDetails() {
  var dot = document.getElementById('ve-deploy-dot');
  if(!dot) return;
  var raw = dot.getAttribute('data-deploy-info');
  if(!raw) {
    // Henüz veri yok, ilk kontrolü yap
    veRefreshApp();
    return;
  }

  // Mevcut popup varsa kapat
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) { existing.remove(); return; }

  var info;
  try { info = JSON.parse(raw); } catch(e) { return; }
  _veShowPopup(dot, info, 'Son Güncelleme', false);
}

// ═══ DOT DURUM YARDIMCISI ═══
function _veApplyDotState(dot, info) {
  if(!dot || !info) return;
  // Gömülü künye "yayın güncel mi" sorusunu YANITLAMAZ — yalnız elindeki
  // kopyanın ne olduğunu söyler. "Güncel" demek olmayan bir bilgiyi iddia
  // etmek olurdu; ayrı bir durum kullanılır.
  if(info.source === 'embedded') {
    dot.className = 've-deploy-dot ve-deploy-local';
    dot.title = 'Bu kopya: ' + (info.shortSha || '') +
      (info.prNumber ? ' · PR #' + info.prNumber : '') +
      (info.date ? ' · ' + new Date(info.date).toLocaleDateString('tr-TR') : '');
    return;
  }
  if(info.status === 'in_progress' || info.status === 'queued') {
    dot.className = 've-deploy-dot ve-deploy-pending';
    dot.title = '⏳ Deploy devam ediyor...';
  } else if(info.status === 'completed' && info.conclusion === 'success') {
    dot.className = 've-deploy-dot ve-deploy-success';
    dot.title = 'Güncel';
  } else {
    dot.className = 've-deploy-dot ve-deploy-error';
    dot.title = 'Deploy başarısız';
  }
}

// ═══ DEPLOY KONTROL (version.json önce, API fallback) ═══
function _veCheckDeploy(callback) {
  var dot = document.getElementById('ve-deploy-dot');

  // file:// → ağa HİÇ çıkma; gömülü künyeyi kullan (bkz. _veOfflineOnly).
  if(_veOfflineOnly()) {
    var gomulu = _veBuildInfo();
    if(!gomulu) { callback(null); return; }
    _veApplyDotState(dot, gomulu);
    if(dot) dot.setAttribute('data-deploy-info', JSON.stringify(gomulu));
    callback(gomulu);
    return;
  }

  // Cache-buster: SW veya tarayıcı bayat sürüm tutmasın
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function(r) {
      if(!r.ok) throw new Error('version.json yok');
      return r.json();
    })
    .then(function(info) {
      _veApplyDotState(dot, info);
      if(dot) dot.setAttribute('data-deploy-info', JSON.stringify(info));
      callback(info);
    })
    .catch(function() {
      _veCheckDeployViaApi(callback);
    });
}

// ═══ FALLBACK: GITHUB API ═══
function _veCheckDeployViaApi(callback) {
  var dot = document.getElementById('ve-deploy-dot');

  fetch('https://api.github.com/repos/' + DEPLOY_REPO + '/actions/runs?per_page=1')
    .then(function(r) {
      if(r.status === 403 || r.status === 429) {
        if(dot) { dot.className = 've-deploy-dot ve-deploy-ratelimit'; dot.title = 'API limiti — birkaç dakika bekleyin'; }
        callback(null);
        return null;
      }
      if(!r.ok) {
        if(dot) { dot.className = 've-deploy-dot ve-deploy-offline'; dot.title = 'Bağlantı hatası'; }
        callback(null);
        return null;
      }
      return r.json();
    })
    .then(function(data) {
      if(!data) return;
      if(!data.workflow_runs || data.workflow_runs.length === 0) {
        if(dot) { dot.className = 've-deploy-dot ve-deploy-unknown'; dot.title = 'Deploy bilgisi yok'; }
        callback(null);
        return;
      }

      var run = data.workflow_runs[0];
      var info = {
        runId: run.id,
        status: run.status,
        conclusion: run.conclusion,
        branch: run.head_branch,
        message: run.head_commit ? run.head_commit.message : '',
        author: run.head_commit ? run.head_commit.author.name : '',
        date: run.updated_at,
        url: run.html_url,
        headSha: run.head_sha || '',
        prTitle: '', prNumber: 0, prBody: '', prUrl: '',
        changes: []
      };

      _veApplyDotState(dot, info);

      var prMatch = info.message.match(/Merge pull request #(\d+)/);
      if(prMatch) {
        info.prNumber = parseInt(prMatch[1]);
        fetch('https://api.github.com/repos/' + DEPLOY_REPO + '/pulls/' + info.prNumber)
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(pr) {
            if(pr) {
              info.prTitle = pr.title || '';
              info.prBody = pr.body || '';
              info.prUrl = pr.html_url || '';
            }
            if(dot) dot.setAttribute('data-deploy-info', JSON.stringify(info));
            callback(info);
          })
          .catch(function() {
            if(dot) dot.setAttribute('data-deploy-info', JSON.stringify(info));
            callback(info);
          });
      } else {
        if(dot) dot.setAttribute('data-deploy-info', JSON.stringify(info));
        callback(info);
      }
    })
    .catch(function() {
      if(dot) { dot.className = 've-deploy-dot ve-deploy-offline'; dot.title = 'Bağlantı yok'; }
      callback(null);
    });
}

// ═══ TARİH FORMAT ═══
function _veFormatDeployDate(isoStr) {
  if(!isoStr) return '';
  var d = new Date(isoStr);
  var now = new Date();
  var diff = Math.floor((now - d) / 60000);
  if(diff < 1) return 'Az önce';
  if(diff < 60) return diff + ' dk önce';
  if(diff < 1440) return Math.floor(diff / 60) + ' saat önce';
  return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
}

// ═══ POPUP GÖSTER ═══
function _veEscHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _veDismissPopup() {
  var p = document.getElementById('ve-deploy-popup');
  if(!p) return;
  var pr = parseInt(p.getAttribute('data-pr-number') || '0', 10);
  if(pr) localStorage.setItem('ve-deploy-last-seen-pr', String(pr));
  p.remove();
}

function _veShowPopup(dot, info, title, showUpdateBtn) {
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) existing.remove();

  var fullDate = new Date(info.date).toLocaleString('tr-TR');
  var msg = (info.message || '').split('\n')[0];

  var isPending = info.status === 'in_progress' || info.status === 'queued';
  var isSuccess = info.status === 'completed' && info.conclusion === 'success';
  var titleColor = isPending ? 'var(--accent-warning)' : isSuccess ? 'var(--accent-success)' : 'var(--accent-danger)';

  var popup = document.createElement('div');
  popup.id = 've-deploy-popup';
  popup.setAttribute('data-pr-number', String(info.prNumber || 0));
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:360px; padding:16px; font-size:var(--fs-md);';

  var html = '';

  // Başlık
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  html += '<span style="font-weight:600; color:' + titleColor + '; font-size:var(--fs-lg);">' + title + '</span>';
  html += '<button onclick="_veDismissPopup()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:var(--fs-title);">✕</button>';
  html += '</div>';

  // PR bilgisi
  if(info.prTitle) {
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-size:var(--fs-body); color:var(--text-muted); margin-bottom:3px;">Pull Request #' + info.prNumber + '</div>';
    html += '<div style="font-weight:600; color:var(--text-heading); line-height:1.4;">' + _veEscHtml(info.prTitle) + '</div>';
    if(info.prBody) {
      var bodyHtml = info.prBody
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary); padding:1px 4px;">$1</code>')
        .replace(/^### (.+)$/gm, '<div style="font-weight:600; margin-top:8px;">$1</div>')
        .replace(/^## (.+)$/gm, '<div style="font-weight:600; font-size:var(--fs-lg); margin-top:8px;">$1</div>')
        .replace(/^- (.+)$/gm, '• $1')
        .replace(/\n/g, '<br>');
      html += '<div style="color:var(--text-secondary); font-size:var(--fs-body); margin-top:6px; line-height:1.5; max-height:300px; overflow-y:auto; padding-right:4px;">' + bodyHtml + '</div>';
    }
    html += '</div>';
  } else {
    html += '<div style="color:var(--text-primary); margin-bottom:10px; line-height:1.4;">' + _veEscHtml(msg) + '</div>';
  }

  // Detaylar
  html += '<div style="color:var(--text-muted); font-size:var(--fs-body); border-top:1px solid var(--border-color); padding-top:10px; line-height:1.8;">';
  html += '<span class="mf-ico mf-ico-user"></span> ' + _veEscHtml(info.author);
  html += '<br><span class="mf-ico mf-ico-clock"></span> ' + fullDate;
  html += '<br><span class="mf-ico mf-ico-git-branch"></span> ' + _veEscHtml(info.branch);
  html += '</div>';

  // Otomatik kontrol ayarı — yoklanacak uç yoksa gösterilmez.
  var autoOn = _veAutoCheckEnabled();
  if(!_veOfflineOnly()) {
  html += '<label style="margin-top:10px; display:flex; align-items:center; gap:6px; font-size:var(--fs-body); color:var(--text-muted); cursor:pointer; user-select:none;">';
  html += '<input type="checkbox"' + (autoOn ? ' checked' : '') + ' onchange="_veToggleAutoCheck(this.checked)" style="margin:0; cursor:pointer;">';
  html += 'Otomatik kontrol (15 dk)';
  html += '</label>';
  }

  // Son değişiklikler (changelog)
  if(info.changes && info.changes.length > 1) {
    var lastSeen = parseInt(localStorage.getItem('ve-deploy-last-seen-pr') || '0', 10);
    var newCount = 0;
    for(var k = 0; k < info.changes.length; k++) {
      if(info.changes[k].prNumber && info.changes[k].prNumber > lastSeen) newCount++;
    }
    var summaryLabel = 'Son değişiklikler (' + info.changes.length + ')';
    if(newCount > 0 && lastSeen > 0) {
      summaryLabel += ' — <span style="color:var(--accent-success); font-weight:600;">' + newCount + ' yeni</span>';
    }
    html += '<details style="margin-top:10px; border-top:1px solid var(--border-color); padding-top:10px;"' + (showUpdateBtn ? ' open' : '') + '>';
    html += '<summary style="cursor:pointer; font-weight:600; color:var(--text-heading); font-size:var(--fs-md);">' + summaryLabel + '</summary>';
    html += '<div style="margin-top:8px; display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto;">';
    for(var i = 0; i < info.changes.length; i++) {
      var c = info.changes[i];
      if(!c.prNumber) continue;
      var isNew = lastSeen > 0 && c.prNumber > lastSeen;
      var cTitle = c.title || c.message || ('PR #' + c.prNumber);
      var cDate = _veFormatDeployDate(c.date);
      var bg = isNew ? 'background:color-mix(in srgb, var(--accent-success) 8%, transparent); border-left:2px solid var(--accent-success); padding:4px 6px;' : 'padding:4px 6px; border-left:2px solid transparent;';
      html += '<div style="font-size:var(--fs-body); line-height:1.4; ' + bg + '">';
      if(c.url) {
        html += '<a href="' + c.url + '" target="_blank" rel="noopener" style="color:var(--accent-primary); text-decoration:none; font-weight:600;">#' + c.prNumber + '</a> ';
      } else {
        html += '<span style="font-weight:600;">#' + c.prNumber + '</span> ';
      }
      html += '<span style="color:var(--text-primary);">' + _veEscHtml(cTitle) + '</span>';
      html += '<div style="color:var(--text-muted); font-size:var(--fs-body); margin-top:1px;">' + _veEscHtml(c.author) + ' • ' + cDate + '</div>';
      html += '</div>';
    }
    html += '</div></details>';
  }

  // Güncelle butonu
  if(showUpdateBtn) {
    html += '<button onclick="_veApplyUpdate()" style="width:100%; margin-top:12px; padding:10px; background:var(--accent-success); color:white; border:none; cursor:pointer; font-weight:600; font-size:var(--fs-lg); transition:background 0.2s;" onmouseenter="this.style.background=\'#16a34a\'" onmouseleave="this.style.background=\'#22c55e\'">Şimdi Güncelle</button>';
  } else if(isPending) {
    html += '<div style="margin-top:12px; padding:10px; background:var(--bg-primary); text-align:center; color:var(--accent-warning); font-size:var(--fs-md);">Deploy devam ediyor, biraz sonra tekrar deneyin.</div>';
  }

  // Linkler
  html += '<div style="margin-top:10px; display:flex; gap:12px;">';
  if(info.prUrl) {
    html += '<a href="' + info.prUrl + '" target="_blank" rel="noopener" style="font-size:var(--fs-body); color:var(--accent-primary); text-decoration:none;">PR Detayı →</a>';
  }
  if(info.url) {
    html += '<a href="' + info.url + '" target="_blank" rel="noopener" style="font-size:var(--fs-body); color:var(--accent-primary); text-decoration:none;">Actions Log →</a>';
  }
  html += '</div>';

  popup.innerHTML = html;
  document.body.appendChild(popup);

  // Dışarı tıklayınca kapat (last-seen güncellemesi dahil)
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      var p = document.getElementById('ve-deploy-popup');
      if(p && !p.contains(e.target) && e.target !== dot && e.target.id !== 've-deploy-refresh') {
        _veDismissPopup();
        document.removeEventListener('click', _close);
      }
    });
  }, 100);
}

// ═══ GÜNCELLEME UYGULA ═══
// Akış: SW'yi update'e zorla → yeni SW install olunca SKIP_WAITING → controllerchange → reload
function _veApplyUpdate() {
  var popup = document.getElementById('ve-deploy-popup');
  if(popup) {
    popup.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-heading);"><div style="font-size:var(--fs-h1); margin-bottom:8px;"><span class="mf-ico mf-ico-refresh"></span></div>Güncelleniyor...</div>';
  }
  localStorage.setItem('ve-deploy-refreshed', '1');

  var reloaded = false;
  function doReload() {
    if(reloaded) return;
    reloaded = true;
    location.reload();
  }

  if(!navigator.serviceWorker) {
    // SW yoksa (yerel file://, eski tarayıcı) klasik reload
    doReload();
    return;
  }

  navigator.serviceWorker.getRegistration().then(function(reg) {
    if(!reg) { doReload(); return; }

    // Yeni SW aktive olduğunda tarayıcı controller'ı değiştirir → o an reload et
    navigator.serviceWorker.addEventListener('controllerchange', doReload);

    // Zaten bekleyen bir SW varsa hemen skip waiting
    if(reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Yeni sürümü tetikle
    reg.update().then(function() {
      if(reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if(reg.installing) {
        reg.installing.addEventListener('statechange', function(e) {
          if(e.target.state === 'installed' && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    // Güvenlik ağı: SW 4 sn içinde devreye girmezse yine de reload et
    setTimeout(doReload, 4000);
  }).catch(doReload);
}

// ═══ OTOMATİK KONTROL ═══
// version.json kendi origin'imizden servis edildiği için rate-limit sorunu yok.
// Sessiz: popup açmaz, sadece dot'u günceller; kullanıcı tıklarsa detay gelir.
var VE_AUTOCHECK_INTERVAL_MS = 15 * 60 * 1000;

function _veAutoCheck() {
  try { sessionStorage.setItem('ve-deploy-last-auto-check', String(Date.now())); } catch(e) {}
  _veCheckDeploy(function(info) {
    if(!info) return;
    var dot = document.getElementById('ve-deploy-dot');
    if(!dot) return;
    var runId = DEPLOY_RUN_ID;
    var isNewer = false;
    if(runId && runId !== '__DEPLOY_RUN_ID__' && info.runId) {
      isNewer = String(info.runId) !== String(runId);
    }
    if(isNewer && info.status === 'completed' && info.conclusion === 'success') {
      dot.className = 've-deploy-dot ve-deploy-update-available';
      dot.title = 'Yeni sürüm mevcut — tıklayın';
    }
  });
}

function _veToggleAutoCheck(on) {
  localStorage.setItem('ve-deploy-autocheck', on ? 'on' : 'off');
}

// TEK ÇEVRİMDIŞI YÜKLEMİ VAR: `_veOfflineOnly` (dosyanın başında). Bu satırda
// bir dönem ikinci bir tane (`_veIsLocalFile`) duruyordu — aynı kuralı iki
// yerden okumak bu depoda kusur sayılıyor ve ikincisi ÖLÜ koddu: açılış
// handler'ı file:// üzerinde `_veOfflineOnly` ile zaten daha yukarıda
// dönüyor, buraya hiç gelinmiyordu.
function _veAutoCheckEnabled() {
  return localStorage.getItem('ve-deploy-autocheck') !== 'off';
}

// ═══ SAYFA BAŞLANGIÇ ═══
document.addEventListener('DOMContentLoaded', function() {
  var wasRefreshed = localStorage.getItem('ve-deploy-refreshed');
  if(wasRefreshed) {
    localStorage.removeItem('ve-deploy-refreshed');
    setTimeout(function() {
      var dot = document.getElementById('ve-deploy-dot');
      if(dot) {
        dot.className = 've-deploy-dot ve-deploy-success';
        dot.title = 'Güncel';
      }
      _veShowRefreshedPopup();
    }, 1000);
    return;
  }

  // file:// → yoklanacak bir uç yok. Künye BİR KEZ uygulanır, zamanlayıcı
  // hiç kurulmaz: 15 dakikada bir tekrarlanan başarısız istek buradan
  // çıkıyordu.
  if(_veOfflineOnly()) {
    var gomulu = _veBuildInfo();
    if(gomulu) {
      var dotEl = document.getElementById('ve-deploy-dot');
      _veApplyDotState(dotEl, gomulu);
      if(dotEl) dotEl.setAttribute('data-deploy-info', JSON.stringify(gomulu));
    }
    return;
  }

  if(!_veAutoCheckEnabled()) return;

  // Sayfa açılışı (2 sn gecikme — başlangıç yükünü rahatlat)
  setTimeout(_veAutoCheck, 2000);

  // Periyodik kontrol (yalnız sekme görünürken)
  setInterval(function() {
    if(document.visibilityState === 'visible') _veAutoCheck();
  }, VE_AUTOCHECK_INTERVAL_MS);

  // Sekme yeniden görünür olunca son kontrolden yeterince zaman geçtiyse tazele
  document.addEventListener('visibilitychange', function() {
    if(document.visibilityState !== 'visible') return;
    var last = 0;
    try { last = parseInt(sessionStorage.getItem('ve-deploy-last-auto-check') || '0', 10); } catch(e) {}
    if(Date.now() - last > VE_AUTOCHECK_INTERVAL_MS) _veAutoCheck();
  });
});

// Güncelleme sonrası basit popup (API çağırmaz)
function _veShowRefreshedPopup() {
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) existing.remove();

  var popup = document.createElement('div');
  popup.id = 've-deploy-popup';
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:360px; padding:16px; font-size:var(--fs-md);';

  popup.innerHTML =
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
      '<span style="font-weight:600; color:var(--accent-success); font-size:var(--fs-lg);">✓ Program Güncellendi</span>' +
      '<button onclick="_veDismissPopup()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:var(--fs-title);">✕</button>' +
    '</div>' +
    '<div style="color:var(--text-secondary); line-height:1.5;">Program en son sürüme güncellendi. Detayları görmek için yeşil noktaya tıklayın.</div>';

  document.body.appendChild(popup);

  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      var p = document.getElementById('ve-deploy-popup');
      if(p && !p.contains(e.target)) {
        p.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 100);
}
