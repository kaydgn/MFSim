// ============================================================================
// DEPLOY STATUS GÖSTERGESİ
// Manuel kontrol: 🔄 butonuna tıklayınca GitHub API'den deploy durumunu çeker.
// Otomatik sorgu yok — rate limit riski sıfır.
// ============================================================================

var DEPLOY_REPO = 'kaydgn/MFSim';

// ═══ 🔄 REFRESH BUTONU ═══
function veRefreshApp() {
  var btn = document.getElementById('ve-deploy-refresh');
  var dot = document.getElementById('ve-deploy-dot');
  if(btn) btn.style.animation = 'deploySpin 0.6s linear infinite';

  _veCheckDeploy(function(info) {
    if(btn) btn.style.animation = '';
    if(!info || !dot) return;

    if(info.status === 'completed' && info.conclusion === 'success') {
      // Bu deploy'u zaten almış mıyız?
      var knownId = localStorage.getItem('ve-deploy-known-id');
      if(knownId && knownId === String(info.id)) {
        _veShowPopup(dot, info, '✅ Program Güncel', false);
      } else {
        _veShowPopup(dot, info, '🔔 Güncelleme Mevcut', true);
      }
    } else if(info.status === 'in_progress' || info.status === 'queued') {
      _veShowPopup(dot, info, '⏳ Deploy Devam Ediyor', false);
    } else {
      _veShowPopup(dot, info, '❌ Deploy Başarısız', false);
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

// ═══ GITHUB API KONTROL ═══
function _veCheckDeploy(callback) {
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
        status: run.status,
        conclusion: run.conclusion,
        branch: run.head_branch,
        message: run.head_commit ? run.head_commit.message : '',
        author: run.head_commit ? run.head_commit.author.name : '',
        date: run.updated_at,
        url: run.html_url,
        prTitle: '', prNumber: 0, prBody: '', prUrl: ''
      };

      // Dot durumunu güncelle
      if(dot) {
        if(run.status === 'in_progress' || run.status === 'queued') {
          dot.className = 've-deploy-dot ve-deploy-pending';
          dot.title = '⏳ Deploy devam ediyor...';
        } else if(run.status === 'completed' && run.conclusion === 'success') {
          dot.className = 've-deploy-dot ve-deploy-success';
          dot.title = '✅ Güncel';
        } else {
          dot.className = 've-deploy-dot ve-deploy-error';
          dot.title = '❌ Deploy başarısız';
        }
      }

      // PR bilgisini çek
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
function _veShowPopup(dot, info, title, showUpdateBtn) {
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) existing.remove();

  var dateStr = _veFormatDeployDate(info.date);
  var fullDate = new Date(info.date).toLocaleString('tr-TR');
  var msg = info.message.split('\n')[0];

  var isPending = info.status === 'in_progress' || info.status === 'queued';
  var isSuccess = info.status === 'completed' && info.conclusion === 'success';
  var titleColor = isPending ? '#f59e0b' : isSuccess ? '#22c55e' : '#ef4444';

  var popup = document.createElement('div');
  popup.id = 've-deploy-popup';
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:360px; padding:16px; font-size:0.78rem;';

  var html = '';

  // Başlık
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  html += '<span style="font-weight:600; color:' + titleColor + '; font-size:0.85rem;">' + title + '</span>';
  html += '<button onclick="document.getElementById(\'ve-deploy-popup\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">✕</button>';
  html += '</div>';

  // PR bilgisi
  if(info.prTitle) {
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">Pull Request #' + info.prNumber + '</div>';
    html += '<div style="font-weight:600; color:var(--text-heading); line-height:1.4;">' + info.prTitle + '</div>';
    if(info.prBody) {
      // Markdown'ı basit HTML'e çevir
      var bodyHtml = info.prBody
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary); padding:1px 4px;">$1</code>')
        .replace(/^### (.+)$/gm, '<div style="font-weight:600; margin-top:8px;">$1</div>')
        .replace(/^## (.+)$/gm, '<div style="font-weight:600; font-size:0.8rem; margin-top:8px;">$1</div>')
        .replace(/^- (.+)$/gm, '• $1')
        .replace(/\n/g, '<br>');
      html += '<div style="color:var(--text-secondary); font-size:0.72rem; margin-top:6px; line-height:1.5; max-height:300px; overflow-y:auto; padding-right:4px;">' + bodyHtml + '</div>';
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

  // Güncelle butonu
  if(showUpdateBtn) {
    html += '<button onclick="_veApplyUpdate()" style="width:100%; margin-top:12px; padding:10px; background:#22c55e; color:white; border:none; cursor:pointer; font-weight:600; font-size:0.82rem; transition:background 0.2s;" onmouseenter="this.style.background=\'#16a34a\'" onmouseleave="this.style.background=\'#22c55e\'">Şimdi Güncelle</button>';
  } else if(isPending) {
    html += '<div style="margin-top:12px; padding:10px; background:var(--bg-primary); text-align:center; color:#f59e0b; font-size:0.75rem;">Deploy devam ediyor, biraz sonra tekrar deneyin.</div>';
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
  // Güncellenen deploy ID'sini kaydet
  var dot = document.getElementById('ve-deploy-dot');
  if(dot) {
    var raw = dot.getAttribute('data-deploy-info');
    if(raw) {
      try { var info = JSON.parse(raw); localStorage.setItem('ve-deploy-known-id', String(info.id)); } catch(e) {}
    }
  }
  localStorage.setItem('ve-deploy-refreshed', '1');

  // Service worker cache'ini temizle, sonra sayfayı yenile
  if('caches' in window) {
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      if(navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
          regs.forEach(function(r) { r.unregister(); });
          location.reload(true);
        });
      } else {
        location.reload(true);
      }
    });
  } else {
    location.reload(true);
  }
}

// ═══ SAYFA BAŞLANGIÇ ═══
document.addEventListener('DOMContentLoaded', function() {
  var wasRefreshed = localStorage.getItem('ve-deploy-refreshed');
  if(wasRefreshed) {
    localStorage.removeItem('ve-deploy-refreshed');
    // Güncelleme tamamlandı — API'ye sormadan doğrudan göster
    setTimeout(function() {
      var dot = document.getElementById('ve-deploy-dot');
      if(dot) {
        dot.className = 've-deploy-dot ve-deploy-success';
        dot.title = '✅ Güncel';
      }
      _veShowRefreshedPopup();
    }, 500);
  }
});

// Güncelleme sonrası basit popup (API çağırmaz)
function _veShowRefreshedPopup() {
  var existing = document.getElementById('ve-deploy-popup');
  if(existing) existing.remove();

  var popup = document.createElement('div');
  popup.id = 've-deploy-popup';
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:360px; padding:16px; font-size:0.78rem;';

  popup.innerHTML =
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
      '<span style="font-weight:600; color:#22c55e; font-size:0.85rem;">✅ Program Güncellendi</span>' +
      '<button onclick="document.getElementById(\'ve-deploy-popup\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">✕</button>' +
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
