// ============================================================================
// DEPLOY STATUS GÖSTERGESİ
// GitHub Actions deployment durumunu kontrol eder ve gösterir.
// ============================================================================

var DEPLOY_REPO = 'kaydgn/MFSim';
var DEPLOY_CHECK_INTERVAL = 60000; // 60 saniye
var _deployTimerId = null;

function veCheckDeployStatus() {
  var dot = document.getElementById('ve-deploy-dot');
  var tooltip = document.getElementById('ve-deploy-tooltip');
  if(!dot) return;

  fetch('https://api.github.com/repos/' + DEPLOY_REPO + '/actions/runs?per_page=1&branch=main')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if(!data.workflow_runs || data.workflow_runs.length === 0) {
        _veSetDeployState(dot, tooltip, 'unknown', null);
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
        url: run.html_url
      };

      if(run.status === 'in_progress' || run.status === 'queued') {
        _veSetDeployState(dot, tooltip, 'pending', info);
        // Daha sık kontrol et
        _veScheduleNextCheck(10000);
        return;
      }
      if(run.status === 'completed' && run.conclusion === 'success') {
        _veSetDeployState(dot, tooltip, 'success', info);
      } else {
        _veSetDeployState(dot, tooltip, 'error', info);
      }
      _veScheduleNextCheck(DEPLOY_CHECK_INTERVAL);
    })
    .catch(function() {
      _veSetDeployState(dot, tooltip, 'offline', null);
      _veScheduleNextCheck(DEPLOY_CHECK_INTERVAL);
    });
}

function _veScheduleNextCheck(ms) {
  if(_deployTimerId) clearTimeout(_deployTimerId);
  _deployTimerId = setTimeout(veCheckDeployStatus, ms);
}

function _veSetDeployState(dot, tooltip, state, info) {
  // Renk ve animasyon
  dot.className = 've-deploy-dot ve-deploy-' + state;

  // Tooltip içeriği
  if(!info) {
    dot.title = state === 'offline' ? 'Bağlantı yok' : 'Durum bilinmiyor';
    return;
  }

  var dateStr = _veFormatDeployDate(info.date);
  var msg = info.message.split('\n')[0]; // İlk satır
  if(msg.length > 60) msg = msg.substring(0, 57) + '...';

  var statusText = '';
  if(state === 'pending') statusText = '⏳ Güncelleme yükleniyor...';
  else if(state === 'success') statusText = '✅ Güncel';
  else if(state === 'error') statusText = '❌ Deploy başarısız';

  dot.title = statusText + '\n' + msg + '\n' + dateStr + ' — ' + info.author;

  // Detay verilerini sakla
  dot.setAttribute('data-deploy-info', JSON.stringify(info));
}

function _veFormatDeployDate(isoStr) {
  if(!isoStr) return '';
  var d = new Date(isoStr);
  var now = new Date();
  var diff = Math.floor((now - d) / 60000); // dakika

  if(diff < 1) return 'Az önce';
  if(diff < 60) return diff + ' dk önce';
  if(diff < 1440) return Math.floor(diff / 60) + ' saat önce';
  return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
}

function veShowDeployDetails() {
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
  popup.style.cssText = 'position:fixed; top:42px; right:12px; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:10005; width:320px; padding:16px; font-size:0.78rem;';

  popup.innerHTML =
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
      '<span style="font-weight:600; color:var(--text-heading);">Son Deploy</span>' +
      '<button onclick="document.getElementById(\'ve-deploy-popup\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">✕</button>' +
    '</div>' +
    '<div style="margin-bottom:8px;">' +
      '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + statusColor + '; margin-right:6px;"></span>' +
      '<span style="color:' + statusColor + '; font-weight:600;">' + statusText + '</span>' +
      '<span style="color:var(--text-muted); margin-left:8px;">' + dateStr + '</span>' +
    '</div>' +
    '<div style="color:var(--text-primary); margin-bottom:6px; line-height:1.4;">' + msg + '</div>' +
    '<div style="color:var(--text-muted); font-size:0.7rem;">' +
      '👤 ' + info.author + '<br>' +
      '🕐 ' + fullDate + '<br>' +
      '🌿 ' + info.branch +
    '</div>' +
    '<a href="' + info.url + '" target="_blank" rel="noopener" style="display:inline-block; margin-top:10px; font-size:0.7rem; color:var(--accent-primary); text-decoration:none;">GitHub Actions\'da Görüntüle →</a>';

  document.body.appendChild(popup);

  // Dışarı tıklayınca kapat
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      if(!popup.contains(e.target) && e.target !== dot) {
        popup.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 100);
}

// Sayfa yüklenince başlat
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(veCheckDeployStatus, 2000);
});
