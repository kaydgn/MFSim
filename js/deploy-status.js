// ============================================================================
// DEPLOY STATUS GÖSTERGESİ
// GitHub Actions deployment durumunu kontrol eder ve gösterir.
// ============================================================================

var DEPLOY_REPO = 'kaydgn/MFSim';
var DEPLOY_POLL_INTERVAL = 10000; // 10 saniye
var _deployTimerId = null;
var _deployKnownRunId = null; // Sayfa yüklendiğindeki son deploy ID
var _deployInitDone = false;

// ═══ ANA KONTROL FONKSİYONU ═══
function veCheckDeployStatus(onComplete) {
  var dot = document.getElementById('ve-deploy-dot');
  if(!dot) return;

  fetch('https://api.github.com/repos/' + DEPLOY_REPO + '/actions/runs?per_page=1&branch=main')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if(!data.workflow_runs || data.workflow_runs.length === 0) {
        _veSetDeployDot(dot, 'unknown', null);
        _veScheduleNextCheck();
        if(onComplete) onComplete(null);
        return;
      }
      var run = data.workflow_runs[0];
      var info = _veBuildRunInfo(run);

      // İlk kontrol: mevcut deploy ID'sini kaydet
      if(!_deployInitDone) {
        _deployKnownRunId = run.id;
        _deployInitDone = true;
      }

      // PR bilgisini çek
      _veFetchPRInfo(info, function(infoWithPR) {
        // Durumu göster
        if(run.status === 'in_progress' || run.status === 'queued') {
          _veSetDeployDot(dot, 'pending', infoWithPR);
        } else if(run.status === 'completed' && run.conclusion === 'success') {
          _veSetDeployDot(dot, 'success', infoWithPR);
        } else {
          _veSetDeployDot(dot, 'error', infoWithPR);
        }

        // Yeni deploy algılama (otomatik)
        if(_deployKnownRunId && run.id !== _deployKnownRunId && run.status === 'completed' && run.conclusion === 'success') {
          _deployKnownRunId = run.id;
          _veShowUpdatePopup(dot, infoWithPR);
        }

        _veScheduleNextCheck();
        if(onComplete) onComplete(infoWithPR);
      });
    })
    .catch(function() {
      _veSetDeployDot(dot, 'offline', null);
      _veScheduleNextCheck();
      if(onComplete) onComplete(null);
    });
}

// ═══ RUN BİLGİSİ OLUŞTUR ═══
function _veBuildRunInfo(run) {
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    message: run.head_commit ? run.head_commit.message : '',
    author: run.head_commit ? run.head_commit.author.name : '',
    date: run.updated_at,
    url: run.html_url,
    prTitle: '',
    prNumber: 0,
    prBody: '',
    prUrl: ''
  };
}

// ═══ PR BİLGİSİNİ ÇEK ═══
function _veFetchPRInfo(info, callback) {
  var prMatch = info.message.match(/Merge pull request #(\d+)/);
  if(prMatch) {
    info.prNumber = parseInt(prMatch[1]);
    fetch('https://api.github.com/repos/' + DEPLOY_REPO + '/pulls/' + info.prNumber)
      .then(function(r) { return r.json(); })
      .then(function(pr) {
        info.prTitle = pr.title || '';
        info.prBody = pr.body || '';
        info.prUrl = pr.html_url || '';
        callback(info);
      })
      .catch(function() { callback(info); });
  } else {
    callback(info);
  }
}

// ═══ ZAMANLAYICI ═══
function _veScheduleNextCheck() {
  if(_deployTimerId) clearTimeout(_deployTimerId);
  _deployTimerId = setTimeout(function() { veCheckDeployStatus(); }, DEPLOY_POLL_INTERVAL);
}

// ═══ DOT DURUMU AYARLA ═══
function _veSetDeployDot(dot, state, info) {
  dot.className = 've-deploy-dot ve-deploy-' + state;

  if(!info) {
    dot.title = state === 'offline' ? 'Bağlantı yok' : 'Durum bilinmiyor';
    return;
  }

  var dateStr = _veFormatDeployDate(info.date);
  var msg = info.message.split('\n')[0];
  if(msg.length > 60) msg = msg.substring(0, 57) + '...';

  var statusText = '';
  if(state === 'pending') statusText = '⏳ Güncelleme yükleniyor...';
  else if(state === 'success') statusText = '✅ Güncel';
  else if(state === 'error') statusText = '❌ Deploy başarısız';

  dot.title = statusText + '\n' + msg + '\n' + dateStr + ' — ' + info.author;
  dot.setAttribute('data-deploy-info', JSON.stringify(info));
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

// ═══ 🔄 REFRESH BUTONU ═══
function veRefreshApp() {
  var btn = document.getElementById('ve-deploy-refresh');
  if(btn) { btn.style.animation = 'deploySpin 0.6s linear infinite'; }

  veCheckDeployStatus(function(info) {
    if(btn) { btn.style.animation = ''; }

    if(!info) return;

    var dot = document.getElementById('ve-deploy-dot');
    // Her durumda güncelleme popup'ı göster
    _veShowUpdatePopup(dot, info);
  });
}

// ═══ GÜNCELLEME POPUP'I ═══
function _veShowUpdatePopup(dot, info) {
  // Mevcut popup varsa kapat
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) existing.remove();

  var dateStr = _veFormatDeployDate(info.date);
  var fullDate = new Date(info.date).toLocaleString('tr-TR');
  var msg = info.message.split('\n')[0];

  var isNew = info.status === 'completed' && info.conclusion === 'success';
  var isPending = info.status === 'in_progress' || info.status === 'queued';

  var popup = document.createElement('div');
  popup.id = 've-deploy-popup';
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:360px; padding:16px; font-size:0.78rem;';

  var html = '';

  // Başlık
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  if(isPending) {
    html += '<span style="font-weight:600; color:#f59e0b; font-size:0.85rem;">⏳ Güncelleme Yükleniyor...</span>';
  } else if(isNew) {
    html += '<span style="font-weight:600; color:#22c55e; font-size:0.85rem;">🔔 Güncelleme Mevcut</span>';
  } else {
    html += '<span style="font-weight:600; color:#ef4444; font-size:0.85rem;">❌ Deploy Başarısız</span>';
  }
  html += '<button onclick="document.getElementById(\'ve-deploy-popup\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">✕</button>';
  html += '</div>';

  // PR bilgisi
  if(info.prTitle) {
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">Pull Request #' + info.prNumber + '</div>';
    html += '<div style="font-weight:600; color:var(--text-heading); line-height:1.4;">' + info.prTitle + '</div>';
    if(info.prBody) {
      var bodyPreview = info.prBody.replace(/[#*`>\-]/g, '').trim();
      if(bodyPreview.length > 200) bodyPreview = bodyPreview.substring(0, 197) + '...';
      if(bodyPreview) {
        html += '<div style="color:var(--text-secondary); font-size:0.72rem; margin-top:4px; line-height:1.4;">' + bodyPreview + '</div>';
      }
    }
    html += '</div>';
  } else {
    html += '<div style="color:var(--text-primary); margin-bottom:10px; line-height:1.4;">' + msg + '</div>';
  }

  // Detay bilgileri
  html += '<div style="color:var(--text-muted); font-size:0.7rem; border-top:1px solid var(--border-color); padding-top:10px; line-height:1.8;">';
  html += '👤 ' + info.author;
  html += '<br>🕐 ' + fullDate;
  html += '<br>🌿 ' + info.branch;
  html += '</div>';

  // Güncelle butonu (sadece başarılı deploy'da)
  if(isNew) {
    html += '<button onclick="_veApplyUpdate()" style="width:100%; margin-top:12px; padding:10px; background:#22c55e; color:white; border:none; cursor:pointer; font-weight:600; font-size:0.82rem; transition:background 0.2s;" onmouseenter="this.style.background=\'#16a34a\'" onmouseleave="this.style.background=\'#22c55e\'">Şimdi Güncelle</button>';
  } else if(isPending) {
    html += '<div style="margin-top:12px; padding:10px; background:var(--bg-primary); text-align:center; color:#f59e0b; font-size:0.75rem;">Deploy tamamlandığında tekrar bilgilendirileceksiniz.</div>';
  }

  // Linkler
  html += '<div style="margin-top:10px; display:flex; gap:12px;">';
  if(info.prUrl) {
    html += '<a href="' + info.prUrl + '" target="_blank" rel="noopener" style="font-size:0.7rem; color:var(--accent-primary); text-decoration:none;">PR Detayı →</a>';
  }
  html += '<a href="' + info.url + '" target="_blank" rel="noopener" style="font-size:0.7rem; color:var(--accent-primary); text-decoration:none;">Actions Log →</a>';
  html += '</div>';

  popup.innerHTML = html;
  document.body.appendChild(popup);

  // Dışarı tıklayınca kapat
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      var p = document.getElementById('ve-deploy-popup');
      if(p && !p.contains(e.target) && e.target !== dot && e.target.id !== 've-deploy-refresh') {
        p.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 100);
}

// ═══ GÜNCELLEME UYGULA ═══
function _veApplyUpdate() {
  var popup = document.getElementById('ve-deploy-popup');
  if(popup) {
    popup.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-heading);"><div style="font-size:1.5rem; margin-bottom:8px;">🔄</div>Güncelleniyor...</div>';
  }
  localStorage.setItem('ve-deploy-refreshed', '1');
  setTimeout(function() { location.reload(true); }, 500);
}

// ═══ YEŞİL NOKTAYA TIKLAMA (Son güncelleme detayları) ═══
function veShowDeployDetails(titleOverride) {
  var dot = document.getElementById('ve-deploy-dot');
  if(!dot) return;
  var raw = dot.getAttribute('data-deploy-info');
  if(!raw) return;

  var info;
  try { info = JSON.parse(raw); } catch(e) { return; }

  // Mevcut popup varsa kapat
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) { existing.remove(); return; }

  var dateStr = _veFormatDeployDate(info.date);
  var fullDate = new Date(info.date).toLocaleString('tr-TR');
  var msg = info.message.split('\n')[0];

  var statusText, statusColor;
  if(info.status === 'in_progress' || info.status === 'queued') {
    statusText = 'Yükleniyor...'; statusColor = '#f59e0b';
  } else if(info.conclusion === 'success') {
    statusText = 'Başarılı'; statusColor = '#22c55e';
  } else {
    statusText = 'Başarısız'; statusColor = '#ef4444';
  }

  var popup = document.createElement('div');
  popup.id = 've-deploy-popup';
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:360px; padding:16px; font-size:0.78rem;';

  var html = '';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  var popupTitle = titleOverride || 'Son Güncelleme';
  html += '<span style="font-weight:600; color:var(--text-heading); font-size:0.85rem;">' + popupTitle + '</span>';
  html += '<button onclick="document.getElementById(\'ve-deploy-popup\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">✕</button>';
  html += '</div>';

  // Durum satırı
  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:8px 10px; background:var(--bg-primary); border-left:3px solid ' + statusColor + ';">';
  html += '<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:' + statusColor + '; flex-shrink:0;"></span>';
  html += '<span style="color:' + statusColor + '; font-weight:600;">' + statusText + '</span>';
  html += '<span style="color:var(--text-muted); margin-left:auto; font-size:0.7rem;">' + dateStr + '</span>';
  html += '</div>';

  // PR bilgisi
  if(info.prTitle) {
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">Pull Request #' + info.prNumber + '</div>';
    html += '<div style="font-weight:600; color:var(--text-heading); line-height:1.4;">' + info.prTitle + '</div>';
    if(info.prBody) {
      var bodyPreview = info.prBody.replace(/[#*`>\-]/g, '').trim();
      if(bodyPreview.length > 200) bodyPreview = bodyPreview.substring(0, 197) + '...';
      if(bodyPreview) {
        html += '<div style="color:var(--text-secondary); font-size:0.72rem; margin-top:4px; line-height:1.4;">' + bodyPreview + '</div>';
      }
    }
    html += '</div>';
  } else {
    html += '<div style="color:var(--text-primary); margin-bottom:10px; line-height:1.4;">' + msg + '</div>';
  }

  // Detaylar
  html += '<div style="color:var(--text-muted); font-size:0.7rem; border-top:1px solid var(--border-color); padding-top:10px; line-height:1.8;">';
  html += '👤 ' + info.author;
  html += '<br>🕐 ' + fullDate;
  html += '<br>🌿 ' + info.branch;
  html += '</div>';

  // Linkler
  html += '<div style="margin-top:10px; display:flex; gap:12px;">';
  if(info.prUrl) {
    html += '<a href="' + info.prUrl + '" target="_blank" rel="noopener" style="font-size:0.7rem; color:var(--accent-primary); text-decoration:none;">PR Detayı →</a>';
  }
  html += '<a href="' + info.url + '" target="_blank" rel="noopener" style="font-size:0.7rem; color:var(--accent-primary); text-decoration:none;">Actions Log →</a>';
  html += '</div>';

  popup.innerHTML = html;
  document.body.appendChild(popup);

  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      var p = document.getElementById('ve-deploy-popup');
      if(p && !p.contains(e.target) && e.target !== dot) {
        p.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 100);
}

// ═══ SAYFA BAŞLANGIÇ ═══
document.addEventListener('DOMContentLoaded', function() {
  var wasRefreshed = localStorage.getItem('ve-deploy-refreshed');
  if(wasRefreshed) {
    localStorage.removeItem('ve-deploy-refreshed');
    // Güncelleme sonrası: bilgiyi çek, "Program Güncellendi" popup'ı aç
    setTimeout(function() {
      veCheckDeployStatus(function(info) {
        if(info) {
          var dot = document.getElementById('ve-deploy-dot');
          // "Son Güncelleme" popup'ını özel başlıkla aç
          veShowDeployDetails('✅ Program Güncellendi');
        }
      });
    }, 1500);
  } else {
    // Normal başlangıç: durumu kontrol et, 10 sn'de bir tekrarla
    setTimeout(function() { veCheckDeployStatus(); }, 2000);
  }
});
