window.addEventListener('load', function() {
  finishPreloader(500);
});

var svgObject = document.getElementById('svgObject');
svgObject.addEventListener('load', function() {
  try {
    hideSvgMenu(svgObject.contentDocument);
  } catch(e) {}
});

initThemeFont();

var selectedScanItem = null;
var setupNetwork = null;
var setupSsid = null;
var setupWifiPass = null;

function showStep(id) {
  var steps = document.querySelectorAll('.setup-step');
  for (var i = 0; i < steps.length; i++) {
    steps[i].classList.remove('active');
  }
  document.getElementById(id).classList.add('active');
}

function bindTile(tile, offset, value, next, onShow) {
  tile.addEventListener('click', function() {
    nvramGet(offset, value);
    showStep(next);
    if (onShow) onShow();
  });
  tile.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.click();
    }
  });
}

function parseScanResponse(text, status) {
  if (status !== 200 || !text) return null;
  var t = text.trim();
  if (!t || t.charAt(0) === '{' || t.charAt(0) === '[') return null;
  var aps = [];
  var lines = t.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (line.length > 32) return null;
    if (/[<>]/.test(line)) return null;
    if (/(\b(error|failed?|invalid|exception)\b|not found)/i.test(line)) return null;
    aps.push(line);
  }
  return aps.length ? aps : null;
}

function renderScan(aps) {
  selectedScanItem = null;
  var list = document.getElementById('scanList');
  list.innerHTML = '';
  aps.forEach(function(ssid) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'setup-scan-item';
    item.setAttribute('data-ssid', ssid);
    item.textContent = ssid;
    item.addEventListener('mousedown', function() { this.classList.add('active'); });
    item.addEventListener('mouseup', function() { this.classList.remove('active'); });
    item.addEventListener('mouseleave', function() { this.classList.remove('active'); });
    item.addEventListener('click', function() { openScanPassword(this); });
    list.appendChild(item);
  });
}

function openScanPassword(item) {
  var next = item.nextSibling;
  if (next && next.className === 'setup-scan-expand') {
    item.parentNode.removeChild(next);
    item.classList.remove('selected');
    if (selectedScanItem === item) selectedScanItem = null;
    return;
  }
  if (selectedScanItem) selectedScanItem.classList.remove('selected');
  var list = item.parentNode;
  var existing = list.querySelector('.setup-scan-expand');
  if (existing) list.removeChild(existing);
  var exp = document.createElement('div');
  exp.className = 'setup-scan-expand';
  var input = document.createElement('input');
  input.type = 'password';
  input.className = 'tab-input';
  input.placeholder = 'Password';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tab-btn';
  btn.textContent = 'Connect';
  btn.addEventListener('click', function() {
    nvramGet(WIFI_SSID, item.getAttribute('data-ssid'));
    if (input.value) nvramGet(WIFI_PASSWORD, input.value);
    showStep('step-alerts');
  });
  exp.appendChild(input);
  exp.appendChild(btn);
  list.insertBefore(exp, item.nextSibling);
  item.classList.add('selected');
  selectedScanItem = item;
  input.focus();
}

function scanWifi() {
  var warn = document.getElementById('scanWarning');
  warn.classList.add('hidden');
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api?wifi=scan', true);
  xhr.send();
  xhr.onload = function() {
    var aps = parseScanResponse(xhr.responseText, xhr.status);
    if (aps) {
      renderScan(aps);
    } else {
      showScanWarning();
    }
  };
  xhr.onerror = function() {
    showScanWarning();
  };
}

function showScanWarning() {
  renderScan([]);
  document.getElementById('scanWarning').classList.remove('hidden');
}

document.querySelectorAll('.setup-tile').forEach(function(tile) {
  tile.addEventListener('mousedown', function() { this.classList.add('active'); });
  tile.addEventListener('mouseup', function() { this.classList.remove('active'); });
  tile.addEventListener('mouseleave', function() { this.classList.remove('active'); });
});

bindTile(document.getElementById('tileBattery'), DEEP_SLEEP, 10, 'step-connect');
bindTile(document.getElementById('tileOutlet'), DEEP_SLEEP, 0, 'step-connect');
bindTile(document.getElementById('tileInternet'), WIFI_MODE, 1, 'step-scan', function() {
  setupNetwork = 'internet';
  scanWifi();
});
bindTile(document.getElementById('tileLocal'), WIFI_MODE, 0, 'step-wifi', function() {
  setupNetwork = 'local';
});

document.getElementById('scanRefresh').addEventListener('click', scanWifi);

document.getElementById('wifiSetupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var ssid = document.getElementById('setupSSID').value;
  var pass = document.getElementById('setupPassword').value;
  var confirm = document.getElementById('setupConfirmPassword').value;
  if (!ssid) {
    document.getElementById('wifiSsidRequired').classList.remove('hidden');
    return;
  }
  document.getElementById('wifiSsidRequired').classList.add('hidden');
  if (pass !== confirm) {
    document.getElementById('wifiPassMismatch').classList.remove('hidden');
    return;
  }
  document.getElementById('wifiPassMismatch').classList.add('hidden');
  setupSsid = ssid;
  setupWifiPass = pass;
  nvramGet(WIFI_SSID, ssid);
  if (pass) nvramGet(WIFI_PASSWORD, pass);
  nvramGet(WIFI_HIDE, document.getElementById('setupHiddenSSID').checked ? 1 : 0);
  showStep('step-plant-password');
});

document.getElementById('plantPasswordForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var pw = document.getElementById('setupPlantPassword').value;
  var confirm = document.getElementById('setupConfirmPlantPassword').value;
  if (pw !== confirm) {
    document.getElementById('plantPassMismatch').classList.remove('hidden');
    return;
  }
  document.getElementById('plantPassMismatch').classList.add('hidden');
  if (pw) nvramGet(DEMO_PASSWORD, pw);
  nvramGet(FIRST_SETUP, 0);
  if (setupNetwork === 'internet') {
    document.getElementById('progressBar').style.animationDuration = '6s';
    document.getElementById('plantPasswordForm').classList.add('hidden');
    document.getElementById('setupWaiting').classList.remove('hidden');
    setTimeout(function() { window.location.href = 'find.html'; }, 6000);
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'reboot', true);
    xhr.send();
    if (setupSsid === 'Plant' && !setupWifiPass) {
      window.location.href = 'index.html';
    } else {
      document.getElementById('progressBar').style.animationDuration = '12s';
      document.getElementById('reconnectMsg').textContent = 'Reconnect to Plant WiFi (SSID: ' + setupSsid + ')';
      document.getElementById('reconnectMsg').classList.remove('hidden');
      document.getElementById('plantPasswordForm').classList.add('hidden');
      document.getElementById('setupWaiting').classList.remove('hidden');
      setTimeout(function() { window.location.href = 'index.html'; }, 12000);
    }
  }
});

document.getElementById('alertsSaveBtn').addEventListener('click', function() {
  var smtpPass = document.getElementById('setupAlertSMTPPassword').value;
  var confirmSmtp = document.getElementById('setupConfirmSMTPPassword').value;
  if (smtpPass !== confirmSmtp) {
    document.getElementById('smtpPassMismatch').classList.remove('hidden');
    return;
  }
  document.getElementById('smtpPassMismatch').classList.add('hidden');
  var bits = buildAlertBits('#setupAlertsGrid .tab-checkbox');
  document.getElementById('setupAlerts').value = bits;
  saveAlertFields(bits, {
    email: 'setupAlertEmail', server: 'setupAlertSMTPServer',
    username: 'setupAlertSMTPUsername', password: 'setupAlertSMTPPassword',
    plant: 'setupAlertPlantName'
  });
  showStep('step-plant-password');
});
