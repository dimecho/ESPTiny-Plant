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
  var other = document.createElement('button');
  other.type = 'button';
  other.className = 'setup-scan-item';
  other.textContent = 'Other (Hidden Network)';
  other.addEventListener('mousedown', function() { this.classList.add('active'); });
  other.addEventListener('mouseup', function() { this.classList.remove('active'); });
  other.addEventListener('mouseleave', function() { this.classList.remove('active'); });
  other.addEventListener('click', function() { openOtherNetwork(this); });
  list.appendChild(other);
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
    nvramGet(WIFI_PASSWORD, input.value);
    nvramGet(WIFI_HIDE, 0);
    nvramGet(NETWORK_DHCP, 1);
    showStep('step-alerts');
  });
  exp.appendChild(input);
  exp.appendChild(btn);
  list.insertBefore(exp, item.nextSibling);
  item.classList.add('selected');
  selectedScanItem = item;
  input.focus();
}

function openOtherNetwork(item) {
  var next = item.nextSibling;
  if (next && next.classList && next.classList.contains('setup-scan-expand')) {
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
  exp.className = 'setup-scan-expand setup-other-expand';
  var ssidInput = document.createElement('input');
  ssidInput.type = 'text';
  ssidInput.className = 'tab-input';
  ssidInput.placeholder = 'SSID';
  var passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.className = 'tab-input';
  passInput.placeholder = 'Password';
  var hint = document.createElement('div');
  hint.className = 'scan-other-hint hidden';
  hint.textContent = 'SSID is required';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tab-btn';
  btn.textContent = 'Connect';
  btn.addEventListener('click', function() {
    var ssid = ssidInput.value.trim();
    if (!ssid) {
      hint.classList.remove('hidden');
      ssidInput.focus();
      return;
    }
    nvramGet(WIFI_SSID, ssid);
    nvramGet(WIFI_PASSWORD, passInput.value);
    nvramGet(WIFI_HIDE, 1);
    nvramGet(NETWORK_DHCP, 1);
    showStep('step-alerts');
  });
  exp.appendChild(ssidInput);
  exp.appendChild(passInput);
  exp.appendChild(hint);
  exp.appendChild(btn);
  list.insertBefore(exp, item.nextSibling);
  item.classList.add('selected');
  selectedScanItem = item;
  ssidInput.focus();
}

function scanWifi() {
  var warn = document.getElementById('scanWarning');
  warn.classList.add('hidden');
  document.getElementById('scanSpinner').classList.remove('hidden');
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api?wifi=scan', true);
  xhr.send();
  xhr.onload = function() {
    document.getElementById('scanSpinner').classList.add('hidden');
    var aps = parseScanResponse(xhr.responseText, xhr.status);
    if (aps) {
      renderScan(aps);
    } else {
      showScanWarning();
    }
  };
  xhr.onerror = function() {
    document.getElementById('scanSpinner').classList.add('hidden');
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
  nvramGet(WIFI_PASSWORD, pass);
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
  nvramGet(DEMO_PASSWORD, pw);
  nvramGet(FIRST_SETUP, 0);

  document.getElementById('progressBar').style.animationDuration = '10s';
  document.getElementById('plantPasswordForm').classList.add('hidden');
  document.getElementById('setupWaiting').classList.remove('hidden');
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api?wifi=dhcp', true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      startIpPoll();
    }
  };
  xhr.send();
  function startIpPoll() {
  var pollDeadline = Date.now() + 30000;
  function pollIp() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'api?wifi=ip', true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        var ip = (xhr.responseText || '').trim();
        if (ip && ip !== '0.0.0.0') {
          if (setupNetwork === 'internet') {
            document.getElementById('ipFoundMsg').textContent = 'IP Found: ' + ip;
            document.getElementById('ipFoundMsg').classList.remove('hidden');
          }else if (setupNetwork === 'local') {
            document.getElementById('reconnectMsg').textContent = 'Reconnect to Plant WiFi (SSID: ' + setupSsid + ')';
            document.getElementById('reconnectMsg').classList.remove('hidden');
          }
          var rebootXhr = new XMLHttpRequest();
          rebootXhr.open('GET', 'reboot', true);
          rebootXhr.send();
          if (setupSsid === 'Plant' && !setupWifiPass) {
            document.getElementById('progressBar').style.animationDuration = '6s';
            setTimeout(function() { window.location.href = 'http://' + ip + '/index.html'; }, 6000);
          } else {
            document.getElementById('progressBar').style.animationDuration = '20s';
            setTimeout(function() { window.location.href = 'http://' + ip + '/index.html'; }, 20000);
          }
          return;
        } else if (ip === '0.0.0.0') {
          document.getElementById('reconnectMsg').textContent = 'No Connection to WiFi (SSID:' + setupSsid + ') ...Restoring';
          document.getElementById('reconnectMsg').classList.remove('hidden');
        }
      }
      if (Date.now() < pollDeadline) {
        setTimeout(pollIp, 2000);
      } else {
        window.location.href = 'find.html';
      }
    };
    xhr.onerror = function() {
      if (Date.now() < pollDeadline) {
        setTimeout(pollIp, 2000);
      } else {
        window.location.href = 'find.html';
      }
    };
    xhr.send();
  }
  setTimeout(pollIp, 4000);
  setTimeout(function() {
    document.getElementById('wifiReminderMsg').classList.remove('hidden');
  }, 18000);
  }
  //setTimeout(function() { window.location.href = 'find.html'; }, 6000);
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

function updateAppPassTip(serverValue) {
  var v = String(serverValue).toLowerCase();
  document.getElementById('gmailAppPassTip').classList.toggle('hidden', v.indexOf('gmail') === -1);
  var isMicrosoft = v.indexOf('outlook') !== -1 || v.indexOf('office365') !== -1;
  document.getElementById('microsoftAppPassTip').classList.toggle('hidden', !isMicrosoft);
}

document.getElementById('setupAlertSMTPServer').addEventListener('input', function() {
  updateAppPassTip(this.value);
});

var MX_PROVIDERS = [
  { url: 'https://dns.google/resolve', accept: 'application/dns-json' },
  { url: 'https://dns.alidns.com/resolve', accept: 'application/dns-json' }
];

function lookupMx(domain) {
  return lookupMxFrom(domain, 0);
}

function lookupMxFrom(domain, index) {
  if (index >= MX_PROVIDERS.length) return Promise.resolve([]);
  var provider = MX_PROVIDERS[index];
  var opts = {};
  if (provider.accept) opts.headers = { 'Accept': provider.accept };
  return fetch(provider.url + '?name=' + encodeURIComponent(domain) + '&type=MX', opts)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var mx = [];
      if (data && data.Answer) {
        for (var i = 0; i < data.Answer.length; i++) {
          if (data.Answer[i].type === 15) mx.push(data.Answer[i].data);
        }
      }
      if (mx.length === 0) throw new Error('no MX records');
      return mx;
    })
    .catch(function() { return lookupMxFrom(domain, index + 1); });
}

function isGoogleMx(mxList) {
  for (var i = 0; i < mxList.length; i++) {
    var host = String(mxList[i]).toLowerCase().replace(/^\d+\s+/, '').replace(/\.$/, '');
    if (host === 'google.com' || host === 'googlemail.com' ||
        host.indexOf('.google.com') !== -1 || host.indexOf('.googlemail.com') !== -1) {
      return true;
    }
  }
  return false;
}

function isMicrosoftMx(mxList) {
  for (var i = 0; i < mxList.length; i++) {
    var host = String(mxList[i]).toLowerCase().replace(/^\d+\s+/, '').replace(/\.$/, '');
    if (host === 'outlook.com' || host === 'outlook.office365.com' ||
        host.indexOf('.outlook.com') !== -1 || host.indexOf('.outlook.office365.com') !== -1 ||
        host.indexOf('.office365.com') !== -1 || host.indexOf('.microsofthosting.com') !== -1) {
      return true;
    }
  }
  return false;
}

var mxTimer = null;

function checkMxAutofill() {
  var email = document.getElementById('setupAlertEmail').value.trim();
  var at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return;
  var domain = email.substring(at + 1);
  var usernameField = document.getElementById('setupAlertSMTPUsername');
  if (usernameField.value.trim() === '') {
    usernameField.value = email;
  }
  var serverField = document.getElementById('setupAlertSMTPServer');
  if (serverField.value.trim() !== '') return;
  lookupMx(domain).then(function(mxList) {
    if (serverField.value.trim() !== '') return;
    if (isGoogleMx(mxList)) {
      serverField.value = 'smtp.gmail.com:587';
      updateAppPassTip(serverField.value);
    } else if (isMicrosoftMx(mxList)) {
      serverField.value = 'smtp.office365.com:587';
      updateAppPassTip(serverField.value);
    }
  });
}

document.getElementById('setupAlertEmail').addEventListener('input', function() {
  clearTimeout(mxTimer);
  mxTimer = setTimeout(checkMxAutofill, 800);
});

document.getElementById('setupAlertEmail').addEventListener('blur', function() {
  clearTimeout(mxTimer);
  checkMxAutofill();
});
