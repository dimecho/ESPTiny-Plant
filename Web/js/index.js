var started = Date.now();

var svgDoc = null;
var nvramData = null;

function applyNvramToSvg(data) {
  if (!svgDoc || !data) return;
  var soilIdx = parseInt(data[PLANT_SOIL_TYPE]);
  if (!isNaN(soilIdx) && soil_type_color[soilIdx]) {
    var sc = svgDoc.getElementById('soil-circle');
    if (sc) sc.setAttribute('fill', soil_type_color[soilIdx]);
    var st = svgDoc.getElementById('soil-text');
    if (st) st.style.fill = soil_type_color[soilIdx];
  }
  var tl = svgDoc.getElementById('timer-label');
  if (tl && data[PLANT_MANUAL_TIMER] !== undefined) tl.textContent = data[PLANT_MANUAL_TIMER];
  var pl = svgDoc.getElementById('power-label');
  if (pl && data[DEEP_SLEEP] !== undefined) pl.textContent = data[DEEP_SLEEP];
  var ml = svgDoc.getElementById('moisture-label');
  if (ml && data[PLANT_SOIL_MOISTURE] !== undefined) ml.textContent = data[PLANT_SOIL_MOISTURE];
  var psl = svgDoc.getElementById('pot-size-label');
  if (psl && data[PLANT_POT_SIZE] !== undefined) psl.textContent = data[PLANT_POT_SIZE];
}

document.getElementById('svgObject').addEventListener('load', function onLoad() {
  svgDoc = this.contentDocument;
  if (nvramData) applyNvramToSvg(nvramData);
  var elapsed = Date.now() - started;
  var remaining = Math.max(0, 1500 - elapsed);
  finishPreloader(remaining);
  if (!svgDoc) return;

  var cards = document.querySelectorAll('.feature-card');

  function findFeatureGroup(name) {
    return svgDoc.querySelector('[data-feature="' + name + '"]');
  }

  cards.forEach(function(card) {
    card.addEventListener('mouseenter', function() {
      var name = this.dataset.feature;
      var group = findFeatureGroup(name);
      if (group) group.classList.add('active');
    });

    card.addEventListener('mouseleave', function() {
      var name = this.dataset.feature;
      var group = findFeatureGroup(name);
      if (group) group.classList.remove('active');
    });
  });

  var soilGroup = findFeatureGroup('soil');
  if (soilGroup) {
    soilGroup.addEventListener('click', function(e) {
      e.stopPropagation();
      var svgSoil = document.getElementById('svgSoil');
      if (!svgSoil) return;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'svg/soil.svg', true);
      xhr.send();
      xhr.onload = function() {
        svgSoil.innerHTML = xhr.responseText;
        var t = document.documentElement.getAttribute('data-theme');
        if (t === 'dark') {
          var g = svgSoil.querySelector('#g3679');
          if (g) g.setAttribute('fill', 'white');
        }
        var tl = svgSoil.querySelector('#soil-timeline');
        if (tl) {
          tl.querySelectorAll('[id$="-badge"]').forEach(function(g) { g.classList.add('badge-shrunk'); });
        }
        svgSoil.querySelector('#soil-moss').onclick = function() {
          soilModalSelect(0);
        };
        svgSoil.querySelector('#soil-loam').onclick = function() {
          soilModalSelect(1);
        };
        svgSoil.querySelector('#soil-dirt').onclick = function() {
          soilModalSelect(2);
        };
        svgSoil.querySelector('#soil-clay').onclick = function() {
          soilModalSelect(3);
        };
        svgSoil.querySelector('#soil-sand').onclick = function() {
          soilModalSelect(4);
        };
        svgSoil.querySelector('#soil-rock').onclick = function() {
          soilModalSelect(5);
        };
      };
      document.getElementById('soilModal').classList.add('active');
    });
  }

  /* SVG feature group clicks trigger corresponding card */
  var groups = svgDoc.querySelectorAll('.feature-group');
  groups.forEach(function(g) {
    if (g.dataset.feature === 'soil') return;
    g.addEventListener('click', function(e) {
      e.stopPropagation();
      var card = document.querySelector('[data-feature="' + g.dataset.feature + '"]');
      if (card) card.click();
    });
  });

  /* Background circle opens layout selector */
  var bg = svgDoc.getElementById('backgroundCircle');
  if (bg) {
    bg.addEventListener('click', function(e) {
      e.stopPropagation();
      var thumbs = document.getElementById('layoutThumbs');
      if (!thumbs) return;
      thumbs.innerHTML = '<span style="color:#888">Loading layouts...</span>';
      document.getElementById('layoutModal').classList.add('active');
      var svgUrl = (window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('github.io')) ? 'svg' : 'api?svg=1';
      var x = new XMLHttpRequest();
      x.open('GET', svgUrl, true);
      x.send();
      x.onload = function() {
        var files = x.responseText.split('\n').filter(function(f) { return f !== '' && f.indexOf('soil.') === -1; });
        thumbs.innerHTML = '';
        files.forEach(function(file, i) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', 'svg/' + file, true);
          xhr.send();
          xhr.onload = function() {
            var parser = new DOMParser();
            var doc = parser.parseFromString(xhr.responseText, 'image/svg+xml');
            hideSvgMenu(doc);
            var svgEl = doc.getElementsByTagName('svg')[0];
            if (!svgEl) return;
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.cursor = 'pointer';
            svgEl.style.borderRadius = '6px';
            svgEl.addEventListener('click', function() {
              var s = new XMLHttpRequest();
              s.open('GET', 'nvram.json?offset=' + PLANT_TYPE + '&value=' + i, true);
              s.send();
              document.getElementById('layoutModal').classList.remove('active');
              var obj = document.getElementById('svgObject');
              if (obj) obj.data = 'svg/' + file;
            });
            thumbs.appendChild(svgEl);
          };
        });
      };
    });
  }
});

document.querySelectorAll('.soil-box').forEach(function(box) {
  var idx = soil_type_labels.indexOf(box.dataset.soil);
  if (idx > -1) box.style.setProperty('--soil-color', soil_type_color[idx]);
});

function PlantLogin() {
  var m = document.getElementById('demoLockModal');
  if (m) m.classList.add('active');
}

function soilModalSelect(idx) {
  var c = soil_type_color[idx];
  var soilCircle = svgDoc.getElementById('soil-circle');
  if (soilCircle) soilCircle.setAttribute('fill', c);
  var soilTextSvg = svgDoc.getElementById('soil-text');
  if (soilTextSvg) soilTextSvg.style.fill = c;
  if (DEMOLOCK) { PlantLogin(); return; }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'nvram.json?offset=' + PLANT_SOIL_TYPE + '&value=' + idx, true);
  xhr.send();
  document.getElementById('soilModal').classList.remove('active');
}

function svgText(id) {
  return svgDoc ? svgDoc.getElementById(id) : null;
}

var waterCb = document.getElementById('waterCheckbox');
if (waterCb) {
  waterCb.addEventListener('change', function() {
    var wlCb = document.getElementById('WaterLevelCheckbox');
    var wlHid = document.getElementById('WaterLevel');
    if (wlHid) wlHid.value = this.checked ? 1 : 0;
    if (wlCb) { wlCb.checked = this.checked; wlCb.dispatchEvent(new Event('change')); }
  });
}

var powerCard = document.getElementById('powerCard');
var powerNormal = document.getElementById('powerNormal');
var powerSliderWrap = document.getElementById('powerSliderWrap');
var powerSlider = document.getElementById('powerSlider');
var powerLabel = document.querySelector('.power-slider-label');
if (powerCard && powerNormal && powerSliderWrap && powerSlider) {
  powerCard.addEventListener('click', function(e) {
    if (e.target === powerSlider) return;
    var powerText = svgText('power-label');
    var val = powerText ? powerText.textContent : 10;
    powerSlider.value = val;
    if (powerLabel) powerLabel.textContent = 'Sleep in minutes ' + val;
    updateSliderFill(powerSlider);
    powerNormal.style.display = 'none';
    powerSliderWrap.classList.add('active');
  });
  powerSlider.addEventListener('input', function() {
    if (powerLabel) powerLabel.textContent = 'Sleep in minutes ' + this.value;
    updateSliderFill(this);
  });
  powerSlider.addEventListener('change', function() {
    if (DEMOLOCK) { PlantLogin(); powerSliderWrap.classList.remove('active'); powerNormal.style.display = 'flex'; return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram.json?offset=21&value=' + this.value, true);
    xhr.onload = function() { if (xhr.responseText == 'Locked') { DEMOLOCK = true; PlantLogin(); } };
    xhr.send();
    var powerText = svgText('power-label');
    if (powerText) powerText.textContent = this.value;
    powerSliderWrap.classList.remove('active');
    powerNormal.style.display = 'flex';
  });
}

var timerCard = document.getElementById('timerCard');
var timerNormal = document.getElementById('timerNormal');
var timerSliderWrap = document.getElementById('timerSliderWrap');
var timerSlider = document.getElementById('timerSlider');
var timerLabel = document.getElementById('timerSliderLabel');
if (timerCard && timerNormal && timerSliderWrap && timerSlider) {
    function updateTimerCheckbox(val) {
      var cb = document.getElementById('timerCheckbox');
      if (cb) cb.checked = parseInt(val) > 0;
    }
    timerCard.addEventListener('click', function(e) {
      if (e.target === timerSlider) return;
      var timerText = svgText('timer-label');
      var val = timerText ? timerText.textContent : 0;
      timerSlider.value = val;
      if (timerLabel) {
        var days = val >= 24 ? ' (' + Math.floor(val / 24) + ' day' + (Math.floor(val / 24) > 1 ? 's' : '') + ')' : '';
        timerLabel.textContent = 'Water every ' + val + ' hours' + days;
      }
      updateSliderFill(timerSlider);
      timerNormal.style.display = 'none';
      timerSliderWrap.classList.add('active');
    });
    timerSlider.addEventListener('input', function() {
      updateTimerCheckbox(this.value);
      var days = this.value >= 24 ? ' (' + Math.floor(this.value / 24) + ' day' + (Math.floor(this.value / 24) > 1 ? 's' : '') + ')' : '';
      if (timerLabel) timerLabel.textContent = 'Water every ' + this.value + ' hours' + days;
      updateSliderFill(this);
    });
    timerSlider.addEventListener('change', function() {
      if (DEMOLOCK) { PlantLogin(); timerSliderWrap.classList.remove('active'); timerNormal.style.display = 'flex'; return; }
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'nvram.json?offset=17&value=' + this.value, true);
      xhr.onload = function() { if (xhr.responseText == 'Locked') { DEMOLOCK = true; PlantLogin(); } };
      xhr.send();
      var timerText = svgText('timer-label');
      if (timerText) timerText.textContent = this.value;
      updateTimerCheckbox(this.value);
      timerSliderWrap.classList.remove('active');
      timerNormal.style.display = 'flex';
    });
}

var moistureCard = document.getElementById('moistureCard');
var moistureNormal = document.getElementById('moistureNormal');
var moistureSliderWrap = document.getElementById('moistureSliderWrap');
var moistureSlider = document.getElementById('moistureSlider');
var moistureLabel = document.getElementById('moistureSliderLabel');
if (moistureCard && moistureNormal && moistureSliderWrap && moistureSlider) {
  moistureCard.addEventListener('click', function(e) {
    if (e.target === moistureSlider) return;
    var moistureText = svgText('moisture-label');
    var val = moistureText ? moistureText.textContent : 20;
    moistureSlider.value = val;
    if (moistureLabel) moistureLabel.textContent = 'Moisture ' + val;
    updateSliderFill(moistureSlider);
    moistureNormal.style.display = 'none';
    moistureSliderWrap.classList.add('active');
  });
  moistureSlider.addEventListener('input', function() {
    if (moistureLabel) moistureLabel.textContent = 'Moisture ' + this.value;
    updateSliderFill(this);
  });
  moistureSlider.addEventListener('change', function() {
    if (DEMOLOCK) { PlantLogin(); moistureSliderWrap.classList.remove('active'); moistureNormal.style.display = 'flex'; return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram.json?offset=16&value=' + this.value, true);
    xhr.onload = function() { if (xhr.responseText == 'Locked') { DEMOLOCK = true; PlantLogin(); } };
    xhr.send();
    var moistureText = svgText('moisture-label');
    if (moistureText) moistureText.textContent = this.value;
    moistureSliderWrap.classList.remove('active');
    moistureNormal.style.display = 'flex';
  });
}

/* Wireless helper functions */
function setWiFiChannels(mode) {
  var channels = [1,2,3,4,5,6,7,8,9,10,11];
  if (mode == 4) channels = [36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,144,149,153,157,161,165];
  var sel = document.getElementById('WiFiChannel');
  if (!sel) return;
  var val = sel.value;
  sel.innerHTML = '';
  channels.forEach(function(c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  sel.value = val;
}
setWiFiChannels(1);

function SetWiFiMode() {
  var mode = document.getElementById('WiFiMode');
  var info = document.getElementById('AlertWifiInfo');
  var pwarn = document.getElementById('AlertWiFiPower');
  if (info) info.classList.add('hidden');
  if (pwarn) pwarn.classList.add('hidden');
  var v = parseInt(mode.value);
  if (v === 0) {
    var alertChecks = document.querySelectorAll('#tab-alerts .tab-checkbox');
    var anyAlert = false;
    for (var i = 0; i < alertChecks.length; i++) {
      if (alertChecks[i].checked) { anyAlert = true; break; }
    }
    if (info && anyAlert) info.classList.remove('hidden');
  } else {
    if (pwarn && parseInt(document.getElementById('WiFiPower').value) < 18) pwarn.classList.remove('hidden');
  }
  var dhcpWarn = document.getElementById('AlertWiFiDHCP');
  if (dhcpWarn && v !== 0 && document.getElementById('WiFiDHCP').value == 0) dhcpWarn.classList.remove('hidden');
}

function WarningWiFiMode() {
  var pwarn = document.getElementById('AlertWiFiPower');
  var dwarn = document.getElementById('AlertWiFiDHCP');
  if (pwarn) pwarn.classList.add('hidden');
  if (dwarn) dwarn.classList.add('hidden');
  var mode = parseInt(document.getElementById('WiFiMode').value);
  if (parseInt(document.getElementById('WiFiPower').value) < 18 && pwarn) pwarn.classList.remove('hidden');
  if (mode !== 0 && document.getElementById('WiFiDHCP').value == 0 && dwarn) dwarn.classList.remove('hidden');
}

function generateWiFiQR() {
  var ssid = document.getElementById('WiFiSSID').value;
  var mode = document.getElementById('WiFiMode').value;
  var hidden = document.getElementById('WiFiHiddenCheckbox').checked;
  var user = document.getElementById('WiFiUsername').value;
  var pass = document.getElementById('WiFiPassword').value;
  if (!pass) { document.getElementById('qrcode').innerHTML = ''; return; }
  var enc = 'WPA';
  if (mode == 2) enc = 'WPA2-EAP;E:PEAP;PH2:MS-CHAPv2;I:' + encodeURIComponent(user);
  var qrstring = 'WIFI:S:' + encodeURIComponent(ssid) + ';T:' + enc + ';P:' + encodeURIComponent(pass) + ';';
  if (hidden) qrstring += 'H:true;';
  var a = document.getElementById('qrcode');
  a.innerHTML = '';
  if (typeof QRCode !== 'function') {
    var s = document.createElement('script');
    s.onload = function() { var q = new QRCode({msg:qrstring,dim:256,ecl:'M'}); a.appendChild(q); };
    s.src = '../js/qrcode.js';
    document.head.appendChild(s);
  } else {
    a.appendChild(new QRCode({msg:qrstring,dim:256,ecl:'M'}));
  }
}

function autoWiFiPower() {
  var mode = parseInt(document.getElementById('WiFiMode').value);
  if (mode === 0) { notify('Auto Tune only in WiFi Client Mode', 'warning'); return; }
  document.getElementById('WiFiPower').value = 1;
  WarningWiFiMode();
}

function HiddenCheck(id, element) {
  document.getElementById(id).value = element.checked ? 1 : 0;
}

function loadWirelessNvram() {
  if (!nvramData) return;
  var d = nvramData;
  document.getElementById('WiFiMode').value = d[1] || 1;
  document.getElementById('WiFiHidden').value = d[2] || 0;
  document.getElementById('WiFiHiddenCheckbox').checked = d[2] == 1;
  var phy = d[3] || 1;
  setWiFiChannels(phy);
  document.getElementById('WiFiPhyMode').value = phy;
  document.getElementById('WiFiPower').value = d[4] || 1;
  document.getElementById('WiFiChannel').value = d[5] || 1;
  document.getElementById('WiFiSSID').value = d[6] || '';
  document.getElementById('WiFiUsername').value = d[7] || '';
  document.getElementById('EnableLog').value = d[9] || 0;
  document.getElementById('EnableLogCheckbox').checked = d[9] == 1;
  document.getElementById('WiFiDHCP').value = d[10] || 0;
  document.getElementById('WiFiDHCPCheckbox').checked = d[10] == 1;
  var dhcp = d[10] == 1;
  document.getElementById('WiFiIP').value = d[11] || '';
  document.getElementById('WiFiIP').disabled = dhcp;
  document.getElementById('WiFiSubnet').value = d[12] || '';
  document.getElementById('WiFiSubnet').disabled = dhcp;
  document.getElementById('WiFiGateway').value = d[13] || '';
  document.getElementById('WiFiGateway').disabled = dhcp;
  document.getElementById('WiFiDNS').value = d[14] || '';
  document.getElementById('WiFiDNS').disabled = dhcp;
  SetWiFiMode();
}

var wifiCard = document.getElementById('wifiCard');
var wifiModal = document.getElementById('wifiModal');
var wifiModalClose = document.getElementById('wifiModalClose');
if (wifiCard && wifiModal) {
  wifiCard.addEventListener('click', function() { wifiModal.classList.add('active'); document.body.classList.add('modal-open'); loadWirelessNvram(); });
  if (wifiModalClose) wifiModalClose.addEventListener('click', function() { wifiModal.classList.remove('active'); document.body.classList.remove('modal-open'); });
  document.querySelector('.modal-btn-cancel').addEventListener('click', function() { wifiModal.classList.remove('active'); document.body.classList.remove('modal-open'); });
  document.getElementById('wifiSaveBtn').addEventListener('click', function() {
    if (DEMOLOCK) { PlantLogin(); return; }
    var activeTab = document.querySelector('.tab-panel.active');
    if (activeTab) {
      if (activeTab.id === 'tab-alerts') {
        saveAlertsSettings();
        wifiModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        notify('Alert settings saved', 'success');
        return;
      }
      if (activeTab.id === 'tab-security') {
        saveSecuritySettings();
        wifiModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        notify('Security settings saved', 'success');
        return;
      }
    }
    var form = document.getElementById('wifiForm');
    var data = new FormData(form);
    var params = new URLSearchParams(data).toString();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram?wifi&' + params, true);
    xhr.onload = function() { if (xhr.responseText == 'Locked') { DEMOLOCK = true; PlantLogin(); } };
    xhr.send();
    wifiModal.classList.remove('active');
    document.body.classList.remove('modal-open');
  });
  wifiModal.addEventListener('click', function(e) { if (e.target === wifiModal) { wifiModal.classList.remove('active'); document.body.classList.remove('modal-open'); } });
  var wifiPwToggle = document.getElementById('wifiPasswordToggle');
  var wifiPwInput = document.getElementById('WiFiPassword');
  if (wifiPwToggle && wifiPwInput) {
    wifiPwToggle.addEventListener('click', function() {
      var show = wifiPwInput.type === 'password';
      wifiPwInput.type = show ? 'text' : 'password';
      wifiPwToggle.textContent = show ? 'Hide' : 'Show';
    });
  }
  /* Wireless field event handlers */
  document.getElementById('WiFiMode').addEventListener('change', function() {
    SetWiFiMode();
    var phy = document.getElementById('WiFiPhyMode').value;
    setWiFiChannels(parseInt(phy));
  });
  document.getElementById('WiFiHiddenCheckbox').addEventListener('change', function() {
    HiddenCheck('WiFiHidden', this);
  });
  document.getElementById('WiFiPhyMode').addEventListener('change', function() {
    setWiFiChannels(parseInt(this.value));
  });
  document.getElementById('WiFiPower').addEventListener('change', function() {
    WarningWiFiMode();
  });
  document.getElementById('autoWiFiPowerBtn').addEventListener('click', function() {
    autoWiFiPower();
  });
  document.getElementById('EnableLogCheckbox').addEventListener('change', function() {
    HiddenCheck('EnableLog', this);
  });
  document.getElementById('WiFiSSID').addEventListener('input', function() { generateWiFiQR(); });
  document.getElementById('WiFiPassword').addEventListener('input', function() { generateWiFiQR(); });
  document.getElementById('WiFiMode').addEventListener('change', function() { generateWiFiQR(); });
  document.getElementById('WiFiHiddenCheckbox').addEventListener('change', function() { generateWiFiQR(); });
  document.getElementById('WiFiUsername').addEventListener('input', function() { generateWiFiQR(); });
  document.getElementById('WiFiDHCPCheckbox').addEventListener('change', function() {
    HiddenCheck('WiFiDHCP', this);
    var b = this.checked;
    var mode = parseInt(document.getElementById('WiFiMode').value);
    if (b && mode === 0) notify('DHCP works only in WiFi Client mode', 'warning');
    document.getElementById('WiFiIP').disabled = b;
    document.getElementById('WiFiSubnet').disabled = b;
    document.getElementById('WiFiGateway').disabled = b;
    document.getElementById('WiFiDNS').disabled = b;
    WarningWiFiMode();
  });
  var wifiTabs = document.querySelectorAll('.modal-tab');
  var modalFooter = document.querySelector('.modal-footer');
  wifiTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      wifiTabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var panels = document.querySelectorAll('.tab-panel');
      panels.forEach(function(p) { p.classList.remove('active'); });
      var target = document.getElementById('tab-' + this.dataset.tab);
      if (target) target.classList.add('active');
      if (modalFooter) modalFooter.style.display = (this.dataset.tab === 'layout' || this.dataset.tab === 'hardware' || this.dataset.tab === 'firmware') ? 'none' : '';
    });
  });
}

function updateSliderFill(slider) {
  var min = slider.min ? parseInt(slider.min) : 0;
  var max = slider.max ? parseInt(slider.max) : 100;
  var val = parseInt(slider.value);
  var pct = ((val - min) / (max - min)) * 100;
  var color = slider.style.getPropertyValue('--slider-color') || '#33b5e5';
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var trackBg = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
  slider.style.background = 'linear-gradient(to right, ' + color + ' ' + pct + '%, ' + trackBg + ' ' + pct + '%)';
}

var graphCard = document.getElementById('graphCard');
if (graphCard) {
  graphCard.addEventListener('click', function() {
    window.location.href = 'graph.html';
  });
}

var soilCard = document.getElementById('soilCard');
var soilNormal = document.getElementById('soilNormal');
var soilBoxesWrap = document.getElementById('soilBoxesWrap');
if (soilCard && soilNormal && soilBoxesWrap) {
  var soilSelected = null;
  soilCard.addEventListener('click', function(e) {
    if (soilBoxesWrap.classList.contains('active')) return;
    soilNormal.style.display = 'none';
    soilBoxesWrap.classList.add('active');
  });
  soilBoxesWrap.addEventListener('click', function(e) {
    var box = e.target.closest('.soil-box');
    if (!box) return;
    if (box.classList.contains('selected')) {
      soilBoxesWrap.classList.remove('active');
      soilNormal.style.display = 'flex';
      soilBoxesWrap.querySelectorAll('.soil-box').forEach(function(b) {
        b.classList.remove('selected', 'greyed');
      });
      soilSelected = null;
      return;
    }
    soilSelected = box.dataset.soil;
    soilBoxesWrap.querySelectorAll('.soil-box').forEach(function(b) {
      b.classList.toggle('selected', b === box);
      b.classList.toggle('greyed', b !== box);
    });
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram.json?offset=15&value=' + soilSelected, true);
    xhr.send();
  });
}

var potSizeCard = document.getElementById('potSizeCard');
var potSizeNormal = document.getElementById('potSizeNormal');
var potSizeSliderWrap = document.getElementById('potSizeSliderWrap');
var potSizeSlider = document.getElementById('potSizeSlider');
var potSizeLabel = document.getElementById('potSizeSliderLabel');
if (potSizeCard && potSizeNormal && potSizeSliderWrap && potSizeSlider) {
  potSizeCard.addEventListener('click', function(e) {
    if (e.target === potSizeSlider) return;
    var potText = svgText('pot-size-label');
    var val = potText ? potText.textContent : 4;
    potSizeSlider.value = val;
    var mins = val >= 60 ? ' (' + Math.floor(val / 60) + ' minute' + (Math.floor(val / 60) > 1 ? 's' : '') + ')' : '';
    if (potSizeLabel) potSizeLabel.textContent = 'Water for ' + val + ' seconds' + mins;
    updateSliderFill(potSizeSlider);
    potSizeNormal.style.display = 'none';
    potSizeSliderWrap.classList.add('active');
  });
  potSizeSlider.addEventListener('input', function() {
    var mins = this.value >= 60 ? ' (' + Math.floor(this.value / 60) + ' minute' + (Math.floor(this.value / 60) > 1 ? 's' : '') + ')' : '';
    if (potSizeLabel) potSizeLabel.textContent = 'Water for ' + this.value + ' seconds' + mins;
    updateSliderFill(this);
  });
  potSizeSlider.addEventListener('change', function() {
    if (DEMOLOCK) { PlantLogin(); potSizeSliderWrap.classList.remove('active'); potSizeNormal.style.display = 'flex'; return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram.json?offset=15&value=' + this.value, true);
    xhr.onload = function() { if (xhr.responseText == 'Locked') { DEMOLOCK = true; PlantLogin(); } };
    xhr.send();
    var potText = svgText('pot-size-label');
    if (potText) potText.textContent = this.value;
    potSizeSliderWrap.classList.remove('active');
    potSizeNormal.style.display = 'flex';
  });
}

/* Firmware tab */
(function() {
  var PNP_ADC = 31;
  var pnpState = 0; // 0=NPN, 1=PNP

  var pnpToggle = document.getElementById('pnpToggle');
  var npnLabel = document.getElementById('pnpLabelNPN');
  var pnpLabel = document.getElementById('pnpLabelPNP');

  function updatePNP(v) {
    pnpState = v;
    pnpToggle.classList.toggle('on', v === 1);
    npnLabel.classList.toggle('active', v === 0);
    pnpLabel.classList.toggle('active', v === 1);
  }

  if (pnpToggle) {
    pnpToggle.addEventListener('click', function() {
      updatePNP(pnpState === 0 ? 1 : 0);
      savePNPADC();
    });
  }

  function savePNPADC() {
    var adcVal = document.getElementById('adcSlider') ? document.getElementById('adcSlider').value : 0;
    var waterLevel = document.getElementById('WaterLevelCheckbox') && document.getElementById('WaterLevelCheckbox').checked ? 1 : 0;
    var mosfet = document.getElementById('MOSFETCheckbox') && document.getElementById('MOSFETCheckbox').checked ? 1 : 0;
    var pnpDigit = pnpState === 0 ? 1 : 0; // classic: NPN=1, PNP=0
    var val = pnpDigit + '' + adcVal + '' + waterLevel + '' + mosfet;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'nvram.json?offset=' + PNP_ADC + '&value=' + val, true);
    xhr.send();
  }

  var adcSlider = document.getElementById('adcSlider');
  var adcText = document.getElementById('adcSensitivityText');
  if (adcSlider && adcText) {
    updateSliderFill(adcSlider);
    adcSlider.addEventListener('input', function() {
      adcText.textContent = this.value;
      updateSliderFill(this);
    });
    adcSlider.addEventListener('change', function() {
      savePNPADC();
    });
  }

  var wlCheckbox = document.getElementById('WaterLevelCheckbox');
  var wlHidden = document.getElementById('WaterLevel');
  if (wlCheckbox && wlHidden) {
    wlCheckbox.addEventListener('change', function() {
      wlHidden.value = this.checked ? 1 : 0;
      if (waterCb) waterCb.checked = this.checked;
      savePNPADC();
    });
  }

  var mosfetCheckbox = document.getElementById('MOSFETCheckbox');
  var mosfetHidden = document.getElementById('MOSFET');
  if (mosfetCheckbox && mosfetHidden) {
    mosfetCheckbox.addEventListener('change', function() {
      mosfetHidden.value = this.checked ? 1 : 0;
      savePNPADC();
    });
  }

  function setupFileBrowse(btnId, fileId, formId) {
    var btn = document.getElementById(btnId);
    var file = document.getElementById(fileId);
    var form = document.getElementById(formId);
    if (btn && file) {
      btn.addEventListener('click', function() { file.click(); });
      file.addEventListener('change', function() {
        if (form) {
          form.setAttribute('action', 'http://' + window.location.hostname + '/update');
          form.submit();
        }
      });
    }
  }
  setupFileBrowse('browseLittleFS', 'fileLittleFS', 'formLittleFS');
  setupFileBrowse('browseFirmware', 'fileFirmware', 'formFirmware');

  var certBtn = document.getElementById('browseCertificate');
  var certFile = document.getElementById('fileCertificate');
  var certForm = document.getElementById('formCertificate');
  if (certBtn && certFile) {
    certBtn.addEventListener('click', function() { certFile.click(); });
    certFile.addEventListener('change', function() { if (certForm) certForm.submit(); });
  }

  var keyBtn = document.getElementById('browsePrivateKey');
  var keyFile = document.getElementById('filePrivateKey');
  var keyForm = document.getElementById('formPrivateKey');
  if (keyBtn && keyFile) {
    keyBtn.addEventListener('click', function() { keyFile.click(); });
    keyFile.addEventListener('change', function() { if (keyForm) keyForm.submit(); });
  }

  /* Fetch nvram.json for initial values */
  var nvram = new XMLHttpRequest();
  nvram.responseType = 'json';
  nvram.open('GET', 'nvram.json', true);
  nvram.send();
  nvram.onload = function() {
    if (nvram.response && nvram.response['nvram']) {
      var data = nvram.response['nvram'];
      if (data[FIRST_SETUP] === '') { location.replace('setup.html'); return; }
      try {
        var v = data[0].split('|');
        var cv = document.getElementById('coreVersion');
        if (cv) cv.textContent = 'Core Version: ' + v[0];
        var sv = document.getElementById('sdkVersion');
        if (sv) sv.textContent = 'SDK Version: ' + v[1];
        var fsv = document.getElementById('fsVersion');
        if (fsv) fsv.textContent = 'LittleFS Version: ' + (0xffff & (v[2] >> 16)) + '.' + (0xffff & (v[2] >> 0)) + '.' + (0xffff & (v[2] >> 20));
        var fwv = document.getElementById('firmwareVersion');
        if (fwv) fwv.textContent = 'Firmware Version: ' + v[3];
        var fsr = document.getElementById('fsram');
        if (fsr) fsr.textContent = 'Flash: ' + Math.round(v[4]/1024) + ' KB (' + v[4] + ')';
        var dr = document.getElementById('dram');
        if (dr) dr.textContent = 'Memory: ' + Math.round(v[5]/1024) + ' KB (' + v[5] + ')';
      } catch(e) {}

      /* Parse PNP_ADC (classic: NPN=1, PNP=0) */
      var pnp_adc = data[PNP_ADC] + '0000';
      var pnp_raw = parseInt(pnp_adc.charAt(0));
      var pnp_val = pnp_raw === 1 ? 0 : 1;
      var adc_val = parseInt(pnp_adc.charAt(1));
      var water_val = pnp_adc.charAt(2) === '1';
      var mosfet_val = pnp_adc.charAt(3) === '1';
      updatePNP(pnp_val);
      if (adcSlider && adcText) {
        adcSlider.value = adc_val;
        adcText.textContent = adc_val;
      }
      if (wlCheckbox) wlCheckbox.checked = water_val;
      if (wlHidden) wlHidden.value = water_val ? 1 : 0;
      if (mosfetCheckbox) mosfetCheckbox.checked = mosfet_val;
      if (mosfetHidden) mosfetHidden.value = mosfet_val ? 1 : 0;

      nvramData = data;
      applyNvramToSvg(data);
      populateAlertsFromNvram({ nvram: data });
      populateSecurityFromNvram({ nvram: data });

      if (data[DEMO_PASSWORD] && data[DEMO_PASSWORD] != '') {
        DEMOLOCK = true;
      }
    }
  };

  /* Demo-lock modal */
  var demoLockModal = document.getElementById('demoLockModal');
  var demoLockClose = document.getElementById('demoLockClose');
  var demoLockForm = document.getElementById('demo-lock-form');
  if (demoLockClose) {
    demoLockClose.onclick = function() {
      if (demoLockModal) demoLockModal.classList.remove('active');
    };
  }
  if (demoLockForm) {
    demoLockForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'login', true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.onload = function() {
        if (xhr.status == 200) {
          DEMOLOCK = false;
          if (demoLockModal) demoLockModal.classList.remove('active');
        }
      };
      xhr.send('password=' + encodeURIComponent(document.getElementById('DemoPassword').value));
    });
  }
})();

/* Hardware test functions */
function notify(msg, type) {
  var n = document.getElementById('notify');
  if (!n) {
    n = document.createElement('div');
    n.id = 'notify';
    n.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:0.3rem;';
    document.body.appendChild(n);
  }
  var t = document.createElement('div');
  t.style.cssText = 'padding:0.4rem 0.8rem;border-radius:6px;font-size:0.8rem;font-weight:600;color:#fff;animation:fade-in 0.2s ease;' + (type === 'danger' ? 'background:#cc3333;' : type === 'warning' ? 'background:#d4873a;' : 'background:#3d9eaa;');
  t.textContent = msg;
  n.appendChild(t);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}
function progressTimer(speed, bar, callback) {
  var counter = 0;
  var tm = setInterval(function() {
    counter++;
    if (counter == 100) { clearInterval(tm); if (callback) callback(counter); }
    var bars = document.getElementsByClassName('progress-fill');
    if (bars[bar]) bars[bar].style.width = counter + '%';
  }, speed);
}

function testPumpRun(tm) {
  notify('Running Pump ...', 'warning');
  var timer = setInterval(function() {
    tm -= 10;
    notify('... ' + tm + ' Seconds Remaining', 'warning');
  }, 10000);
  progressTimer((tm * 10), 1, function() {
    clearInterval(timer);
    var log = new XMLHttpRequest();
    log.open('GET', 'log', true);
    log.send();
    log.onload = function() {
      if (log.status == 200) {
        if (log.responseText.indexOf('M:') != -1) notify('Pump OK', 'success');
        else if (log.responseText.indexOf('e:') != -1) notify('Empty Water Protection', 'warning');
        else notify('Pump Status Unknown', 'warning');
      }
      if (document.getElementById('EnableLog') && document.getElementById('EnableLog').value == 0) {
        var elog = new XMLHttpRequest();
        elog.open('GET', 'log?end=1', true);
        elog.send();
      }
    };
  });
}

function testPump() {
  var m = document.getElementById('testPumpModal');
  if (!m) return;
  m.classList.add('active');
  document.body.classList.add('modal-open');

  var pumpSlider = document.getElementById('testPumpSlider');
  var delayTimer = document.getElementById('test-pump-delay-timer');
  if (pumpSlider) {
    pumpSlider.value = 1;
    updateSliderFill(pumpSlider);
    pumpSlider.oninput = function() {
      if (delayTimer) delayTimer.textContent = this.value;
      updateSliderFill(this);
    };
  }
  if (delayTimer) delayTimer.textContent = '1';

  var startBtn = document.getElementById('testPumpStart');
  var closeBtn = document.getElementById('testPumpClose');
  var closeModal = function() {
    m.classList.remove('active');
    document.body.classList.remove('modal-open');
  };
  if (closeBtn) closeBtn.onclick = closeModal;
  m.addEventListener('click', function(e) { if (e.target === m) closeModal(); });

  if (startBtn) {
    startBtn.onclick = function() {
      var t = (pumpSlider ? parseInt(pumpSlider.value) : 1) - 1;
      var xi = setInterval(function() {
        if (t == 0) {
          clearInterval(xi);
          if (delayTimer) delayTimer.textContent = pumpSlider ? pumpSlider.value : 1;
          var checkwithlog = 'api?adc=1';
          var el = document.getElementById('EnableLog');
          if (el && el.value == 0) checkwithlog = 'log?start=1';
          var log = new XMLHttpRequest();
          log.open('GET', checkwithlog, true);
          log.send();
          log.onload = function() {
            if (log.status == 200) {
              var xhr = new XMLHttpRequest();
              var wifiOff = document.getElementById('TestNoWifiCheckbox') && document.getElementById('TestNoWifiCheckbox').checked ? 0 : 1;
              xhr.open('POST', 'appi?pump=1&wifi=' + wifiOff, true);
              xhr.send();
              xhr.onload = function() {
                if (xhr.status == 200) {
                  if (xhr.responseText == 'Locked') { notify('Locked', 'danger'); return; }
                  var potText = svgText ? svgText('pot-size-label') : null;
                  var tm = (potText ? parseInt(potText.textContent) : 4) + 1;
                  var wl = document.getElementById('WaterLevel');
                  if (wl && wl.value == 1) {
                    notify('Water Level Sensor is On', 'warning');
                    var adc = new XMLHttpRequest();
                    adc.open('GET', 'api?adc=2', true);
                    adc.send();
                    adc.onloadend = function() {
                      if (adc.status == 200 && adc.responseText > 0) testPumpRun(tm);
                      else notify('Check Water Level', 'danger');
                    };
                  } else {
                    testPumpRun(tm);
                  }
                } else {
                  notify('Pump Test Failed', 'danger');
                }
              };
            }
          };
        } else if (t % 1 == 0 && delayTimer) {
          delayTimer.textContent = t;
        }
        t--;
      }, 1000);
    };
  }
}
function testGraph() { var x=new XMLHttpRequest(); x.open('GET','log?clear=1',true); x.send(); x.onload=function(){if(x.responseText=='Locked'){notify('Locked','danger');}else{notify('Graph test started','success');}}; }
function testBattery() { notify('Battery test','warning'); }
function testSleep() { var x=new XMLHttpRequest(); x.open('GET','api?esp=1',true); x.send(); notify('Sleep test sent','warning'); }
function testFlood(water) { var x=new XMLHttpRequest(); x.open('GET','api?water='+water+'&empty=1',true); x.send(); x.onload=function(){notify(water>3?'Flood protection started':'Water set to '+water,x.responseText=='Locked'?'danger':'success');}; }
function testEmpty(loop,flood) { loop++; var x=new XMLHttpRequest(); x.open('GET','pump',true); x.send(); x.onload=function(){notify('Empty simulation started','success');}; }
function testRefill() { var x=new XMLHttpRequest(); x.open('GET','api?refill=1',true); x.send(); x.onload=function(){notify('Refill test started','success');}; }
function testEmail() { var x=new XMLHttpRequest(); x.open('GET','api?smtp=1',true); x.send(); x.onload=function(){notify(x.responseText=='OK'?'Email OK':'Email: '+x.responseText,x.responseText=='OK'?'success':'warning');}; }
function testLED() { var x=new XMLHttpRequest(); x.open('GET','api?led=3',true); x.send(); x.onload=function(){notify('LED test sent','success');}; }
function testSoil() { var x=new XMLHttpRequest(); x.open('GET','api?adc=1',true); x.send(); x.onload=function(){notify('Soil: '+x.responseText,'success');}; }
function testWater() { var x=new XMLHttpRequest(); x.open('GET','api?adc=2',true); x.send(); x.onload=function(){notify('Water: '+x.responseText+'%','success');}; }
function testNTP() { var x=new XMLHttpRequest(); x.open('GET','api?ntp=1',true); x.send(); x.onload=function(){notify('Timer test sent','success');}; }
function flushWater() {
  var m = document.getElementById('flushWaterModal');
  if (!m) return;
  m.classList.add('active');
  document.body.classList.add('modal-open');

  var xhr = new XMLHttpRequest();
  var timer;
  var closeModal = function() { m.classList.remove('active'); document.body.classList.remove('modal-open'); };
  document.getElementById('flushWaterClose').onclick = closeModal;
  m.addEventListener('click', function(e) { if (e.target === m) closeModal(); });

  document.getElementById('flushWaterStart').onclick = function() {
    xhr.open('POST', 'appi?pump=2', true);
    xhr.send();
    xhr.onload = function() {
      if (xhr.status == 200) {
        notify('Flush Started', 'success');
        timer = setInterval(function() { notify('Running Flush ...', 'warning'); }, 5000);
      }
    };
  };
  document.getElementById('flushWaterStop').onclick = function() {
    clearInterval(timer);
    xhr.open('POST', 'appi?pump=0', true);
    xhr.send();
    xhr.onload = function() {
      if (xhr.status == 200) {
        clearInterval(timer);
        notify('Flush Stopped', 'danger');
      }
    };
  };
}

function getOAuthToken() {
  notify('OAuth2.0 requires HTTPS - use client-side oauth2.js on a live server', 'warning');
}

function AlertSet(alerts) {
  var set = document.querySelectorAll('#tab-alerts .tab-checkbox');
  for (var i = 0; i < set.length; i++) {
    if (alerts && alerts[i] == 1) {
      set[i].checked = true;
    }
  }
}

function saveAlertsSettings() {
  var bits = buildAlertBits('#tab-alerts .tab-checkbox');
  document.getElementById('Alerts').value = bits;
  saveAlertFields(bits, {
    email: 'AlertEmail', server: 'AlertSMTPServer',
    username: 'AlertSMTPUsername', password: 'AlertSMTPPassword',
    plant: 'AlertPlantName'
  });
}

/* SMTP password toggle */
(function() {
  var pwToggle = document.getElementById('smtpPwToggle');
  var pwInput = document.getElementById('AlertSMTPPassword');
  if (pwToggle && pwInput) {
    pwToggle.addEventListener('click', function() {
      if (pwInput.type === 'password') {
        pwInput.type = 'text';
        pwToggle.textContent = 'Hide';
      } else {
        pwInput.type = 'password';
        pwToggle.textContent = 'Show';
      }
    });
  }
})();

/* Load alerts data from nvram.json */
function populateAlertsFromNvram(data) {
  var d = data['nvram'];
  if (!d) { return; }
  document.getElementById('AlertEmail').value = d[EMAIL_ALERT] || '';
  document.getElementById('AlertSMTPUsername').value = d[SMTP_USERNAME] || '';
  var smtp = d[SMTP_SERVER] || '';
  if (smtp != '') {
    document.getElementById('AlertSMTPServer').value = smtp;
  }
  document.getElementById('AlertPlantName').value = d[PLANT_NAME] || '';
  var alertsStr = d[ALERTS] || '000000000';
  AlertSet([alertsStr.charAt(0), alertsStr.charAt(1), alertsStr.charAt(2), alertsStr.charAt(3), alertsStr.charAt(4), alertsStr.charAt(5), alertsStr.charAt(6), alertsStr.charAt(7)]);
}

function AvailabilityWeek(availability) {
  var week = document.querySelectorAll('#tab-security .tab-checkbox');
  for (var i = 0; i < week.length; i++) {
    if (week[i].checked) {
      availability[i] = 1;
    } else if (availability[i] == 1) {
      week[i].checked = true;
    }
  }
  var start = document.getElementById('AvailStart').value;
  var end = document.getElementById('AvailEnd').value;
  var availabilityText = availability.join('');
  availabilityText += (start < 10 ? '0' + start : start);
  availabilityText += (end < 10 ? '0' + end : end);
  document.getElementById('DemoAvailability').value = availabilityText;
  return availabilityText;
}

function saveSecuritySettings() {
  var avail = AvailabilityWeek([0,0,0,0,0,0,0]);
  nvramGet(DEMO_PASSWORD, document.getElementById('DemoPassword').value);
  nvramGet(TIMEZONE_OFFSET, document.getElementById('DemoTimezone').value);
  nvramGet(DEMO_AVAILABILITY, avail);
}

function populateSecurityFromNvram(data) {
  var d = data['nvram'];
  if (!d) return;
  var tz = document.getElementById('DemoTimezone');
  if (tz && d[TIMEZONE_OFFSET]) tz.value = d[TIMEZONE_OFFSET];
  if (d[DEMO_AVAILABILITY]) {
    var a = d[DEMO_AVAILABILITY];
    var dayBits = [];
    for (var i = 0; i < 7; i++) dayBits.push(a.charAt(i) == '1' ? 1 : 0);
    AvailabilityWeek(dayBits);
    var st = parseInt(a.substring(7,9));
    var en = parseInt(a.substring(9,11));
    if (!isNaN(st)) document.getElementById('AvailStart').value = st;
    if (!isNaN(en)) document.getElementById('AvailEnd').value = en;
  }
}

/* Passkey */
var passkeyBtn = document.getElementById('createPasskey');
if (passkeyBtn && window.isSecureContext) {
  passkeyBtn.style.display = 'flex';
  passkeyBtn.addEventListener('click', async function() {
    try {
      var rpId = window.location.hostname;
      var cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'tinyplant', id: rpId },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'tinyplant', displayName: 'Tiny Plant' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none'
        }
      });
      notify('Passkey created!', 'success');
    } catch(e) {
      notify('Passkey failed: ' + e.message, 'danger');
    }
  });
}

/* Security password toggle */
(function() {
  var t = document.getElementById('secPwToggle');
  var i = document.getElementById('DemoPassword');
  if (t && i) {
    t.addEventListener('click', function() {
      i.type = i.type === 'password' ? 'text' : 'password';
      t.textContent = i.type === 'password' ? 'Show' : 'Hide';
    });
  }
})();

/* Layout tab */
(function() {
  var browseBtn = document.getElementById('browseLayout');
  var fileInput = document.getElementById('fileLayout');
  var layoutForm = document.getElementById('formLayout');
  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function() {
      if (layoutForm) layoutForm.submit();
    });
  }

  var defaultBtn = document.getElementById('defaultLayout');
  var removeBtn = document.getElementById('removeLayout');
  var listDiv = document.getElementById('listLayout');

  /* Fetch SVG list */
  function loadLayoutList() {
    var x = new XMLHttpRequest();
    var svgUrl = (window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('github.io')) ? 'svg' : 'api?svg=1';
    x.open('GET', svgUrl, true);
    x.send();
    x.onload = function() {
      if (!listDiv) return;
      listDiv.innerHTML = '';
      var lines = x.responseText.split('\n');
      var n = 0;
      lines.forEach(function(item) {
        if (item === '') return;
        if (item.indexOf('soil.') === -1) {
          var label = document.createElement('label');
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'tab-checkbox';
          cb.dataset.index = n;
          label.appendChild(cb);
          label.appendChild(document.createTextNode(' ' + item));
          listDiv.appendChild(label);
          cb.addEventListener('change', function() {
            if (this.checked) {
              listDiv.querySelectorAll('input[type="checkbox"]').forEach(function(c) {
                if (c !== cb) c.checked = false;
              });
            }
          });
        }
        n++;
      });
    };
  }
  loadLayoutList();

  if (defaultBtn) {
    defaultBtn.addEventListener('click', function() {
      var checked = listDiv ? listDiv.querySelector('input[type="checkbox"]:checked') : null;
      if (!checked) { notify('Select a layout first', 'warning'); return; }
      nvramGet(19, checked.dataset.index);
      notify('Default layout set', 'success');
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      var checked = listDiv ? listDiv.querySelector('input[type="checkbox"]:checked') : null;
      if (!checked) { notify('Select a layout first', 'warning'); return; }
      var name = checked.parentNode.textContent.trim();
      var x = new XMLHttpRequest();
      x.open('GET', 'api?delete=' + encodeURIComponent('svg/' + name), true);
      x.send();
      x.onload = function() {
        notify('Layout ' + name + ' removed', 'success');
        loadLayoutList();
      };
    });
  }
})();

/* Theme and font toggles */
initThemeFont();

/* Soil modal close */
document.getElementById('soilModalClose').addEventListener('click', function() {
  document.getElementById('soilModal').classList.remove('active');
});

/* Layout modal close */
document.getElementById('layoutModalClose').addEventListener('click', function() {
  document.getElementById('layoutModal').classList.remove('active');
});
