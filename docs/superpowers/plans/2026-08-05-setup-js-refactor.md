# Setup.js + common.js Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the setup wizard's inline JS out of `Web/setup.html` into `Web/js/setup.js`, and consolidate code shared between the wizard and `Web/js/index.js` into `Web/js/common.js`.

**Architecture:** `common.js` becomes the shared module loaded by both `index.html` and `setup.html` (before each page script). It gains small, focused helpers (`nvramGet`, `buildAlertBits`, `saveAlertFields`, `applySvgTheme`, `initThemeFont`, `finishPreloader`, `hideSvgMenu`). `setup.js` holds wizard-only logic; `index.js` drops its duplicate constants/helpers and calls the shared ones. Classic pages keep loading `common.js` and are untouched.

**Tech Stack:** Vanilla JS (ES5-style, matching codebase), node for DOM-stub tests, `python3 -m http.server` + curl for page checks.

## Global Constraints

- Do NOT change classic/ page behavior. `common.js` additions must be inert on pages that load only `common.js`.
- Do NOT change the APIs of existing `common.js` `notify`, `progressTimer`, `PlantLogin`, `saveSetting`, `hideModal`, `hideAllModals`, `RequireInput`, `resetFlash`.
- Keep `notify`, `progressTimer`, `PlantLogin` redefinitions in `index.js` (their APIs differ from common.js's; index.js loads after common.js so its definitions win, preserving today's behavior).
- Preserve exact wizard behavior (offsets, redirect timings, reboot placement) — this is a pure refactor.
- `defer` scripts execute in document order; common.js must precede the page script in both HTML files.
- Only stage refactor files. Never stage: `CNC/case.FCStd`, `Web/svg/bonsai.svg`, `semver/version.h`, `.gitignore`, `Web/nvram.json`, `littlefs-flash-win.ps1`.
- `docs/` is gitignored; tracked doc files must be added with `git add -f`.

---

### Task 1: Add shared helpers to common.js

**Files:**
- Modify: `Web/js/common.js` (append helpers at end)
- Test: `Web/tests/common.spec.js` (new)

**Interfaces:**
- Produces: `nvramGet(offset, value)`, `buildAlertBits(checkboxSelector)`, `saveAlertFields(bits, ids)`, `applySvgTheme()`, `initThemeFont()`, `finishPreloader(ms)`, `hideSvgMenu(doc)` — all module-level globals.

- [ ] **Step 1: Write the failing test**

Create `Web/tests/common.spec.js`:

```js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'js', 'common.js'), 'utf8');

class El {
  constructor(id){ this.id=id; this.listeners={}; this.attrs={}; this._v=''; this._cls=new Set(); this.checked=false;
    this._style={ getPropertyValue: () => '', setProperty: () => {}, background: '' };
    this.classList={ add:(c)=>this._cls.add(c), remove:(c)=>this._cls.delete(c), contains:(c)=>this._cls.has(c) }; this.children=[]; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  getAttribute(k){ return this.attrs[k]!==undefined?this.attrs[k]:null; }
  setAttribute(k,v){ this.attrs[k]=v; }
  click(){ (this.listeners['click']||[]).forEach(f=>f.call(this)); }
  set value(v){ this._v=v; } get value(){ return this._v; }
  set textContent(t){ this._tc=t; } get textContent(){ return this._tc; }
  set className(c){ this._cls=new Set(c.split(' ')); } get className(){ return [...this._cls].join(' '); }
  get style(){ return this._style; }
  appendChild(c){ c.parent=this; this.children.push(c); }
  dispatchEvent(ev){ ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[ev.type]||[]).forEach(f=>f.call(this,ev)); }
}
const els = {};
const get = (id) => els[id] || (els[id] = new El(id));
let theme = 'dark', font = 'medium';
const store = {};
const cbEls = [0,1,2,3,4,5,6,7].map(i => new El('cb'+i));
cbEls[0].checked = true; cbEls[3].checked = true;
const savedTheme = theme, savedFont = font;
location = { protocol:'http:', host:'192.168.4.1', pathname:'/' };
document = {
  getElementById: get,
  documentElement: get('htmlRoot'),
  querySelectorAll(sel){ return sel === '.alerts .tab-checkbox' ? cbEls : []; },
  createElement(){ return new El(); }
};
const sends = [];
const FakeXHR = function(){ this.open=(m,u)=>{ this.url=u; }; this.send=()=>sends.push(this.url); };
XMLHttpRequest = FakeXHR;
window = { isSecureContext: true };
localStorage = { getItem(k){ return k==='theme'?theme:k==='fontSize'?font:null; }, setItem(k,v){ if(k==='theme')theme=v; if(k==='fontSize')font=v; store[k]=v; } };

const assert = (c,m) => { if(!c){ console.log('FAIL:', m); process.exit(1); } };
const tick = (ms) => new Promise(r => setTimeout(r, ms));

eval(common);

(async function(){
  assert(typeof nvramGet === 'function', 'nvramGet defined');
  assert(typeof buildAlertBits === 'function', 'buildAlertBits defined');
  assert(typeof saveAlertFields === 'function', 'saveAlertFields defined');
  assert(typeof applySvgTheme === 'function', 'applySvgTheme defined');
  assert(typeof initThemeFont === 'function', 'initThemeFont defined');
  assert(typeof finishPreloader === 'function', 'finishPreloader defined');
  assert(typeof hideSvgMenu === 'function', 'hideSvgMenu defined');
  assert(WIFI_MODE === 1 && DEEP_SLEEP === 21 && DEMO_PASSWORD === 28 && FIRST_SETUP === 20, 'constants intact');

  nvramGet(6, 'hello world');
  assert(sends[0] === 'nvram.json?offset=6&value=hello%20world', 'nvramGet url: ' + sends[0]);

  const bits = buildAlertBits('.alerts .tab-checkbox');
  assert(bits === '100100000', 'buildAlertBits: ' + bits);

  get('AlertEmail').value = 'a@b.c'; get('AlertSMTPServer').value = 'smtp.x';
  get('AlertSMTPUsername').value = 'u'; get('AlertSMTPPassword').value = 'p'; get('AlertPlantName').value = 'My Plant';
  saveAlertFields(bits, { email:'AlertEmail', server:'AlertSMTPServer', username:'AlertSMTPUsername', password:'AlertSMTPPassword', plant:'AlertPlantName' });
  assert(sends.some(u => u === 'nvram.json?offset=22&value=a@b.c'), 'EMAIL_ALERT written');
  assert(sends.some(u => u === 'nvram.json?offset=27&value=100100000'), 'ALERTS written');

  hideSvgMenu({ getElementById: () => null, querySelectorAll: () => [] }); // no-throw

  initThemeFont();
  assert(get('themeToggle').textContent === '\u2600', 'theme toggle init dark');
  get('themeToggle').click();
  assert(get('htmlRoot').getAttribute('data-theme') === 'light', 'theme toggled to light');
  assert(get('themeToggle').textContent === '\u263E', 'theme toggle label updated');
  get('fontToggle').click();
  assert(get('htmlRoot').getAttribute('data-font') === 'large', 'font toggled');

  finishPreloader(1);
  await tick(10);
  assert(get('preloader-overlay').classList.contains('done'), 'preloader done added');

  console.log('ALL common.spec assertions PASS');
  process.exit(0);
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node Web/tests/common.spec.js`
Expected: FAIL with `nvramGet defined` (ReferenceError: nvramGet is not defined).

- [ ] **Step 3: Add the helpers to common.js**

Append to the end of `Web/js/common.js`:

```js
function nvramGet(offset, value) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'nvram.json?offset=' + offset + '&value=' + encodeURIComponent(value), true);
  xhr.send();
}

function buildAlertBits(checkboxSelector) {
  var set = document.querySelectorAll(checkboxSelector);
  var bits = '';
  for (var i = 0; i < set.length; i++) {
    bits += set[i].checked ? '1' : '0';
  }
  bits += '0';
  return bits;
}

function saveAlertFields(bits, ids) {
  nvramGet(EMAIL_ALERT, document.getElementById(ids.email).value);
  nvramGet(SMTP_SERVER, document.getElementById(ids.server).value);
  nvramGet(SMTP_USERNAME, document.getElementById(ids.username).value);
  nvramGet(SMTP_PASSWORD, document.getElementById(ids.password).value);
  nvramGet(PLANT_NAME, document.getElementById(ids.plant).value);
  nvramGet(ALERTS, bits);
}

function applySvgTheme() {
  try {
    var win = document.getElementById('svgObject').contentDocument.defaultView;
    if (win && win.svgApplyTheme) {
      win.svgApplyTheme(document.documentElement.getAttribute('data-theme') === 'dark');
    }
  } catch(e) {}
}

function initThemeFont() {
  var html = document.documentElement;
  var themeToggle = document.getElementById('themeToggle');
  themeToggle.textContent = savedTheme === 'dark' ? '\u2600' : '\u263E';
  themeToggle.addEventListener('click', function() {
    var current = html.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.textContent = next === 'dark' ? '\u2600' : '\u263E';
    applySvgTheme();
  });
  var fontSizes = ['small', 'medium', 'large'];
  var fontToggle = document.getElementById('fontToggle');
  fontToggle.textContent = savedFont === 'small' ? 'A' : savedFont === 'large' ? 'A\u207A' : 'A';
  fontToggle.addEventListener('click', function() {
    var current = html.getAttribute('data-font') || 'medium';
    var idx = fontSizes.indexOf(current);
    var next = fontSizes[(idx + 1) % fontSizes.length];
    html.setAttribute('data-font', next);
    localStorage.setItem('fontSize', next);
    this.textContent = next === 'small' ? 'A' : next === 'large' ? 'A\u207A' : 'A';
  });
}

function finishPreloader(ms) {
  setTimeout(function() {
    var p = document.getElementById('preloader-overlay');
    if (p) p.classList.add('done');
  }, ms);
}

function hideSvgMenu(doc) {
  var menu = doc.getElementById('menu');
  if (!menu) {
    var all = doc.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].getAttribute('inkscape:label') === 'menu') {
        menu = all[i]; break;
      }
    }
  }
  if (menu) menu.style.display = 'none';
}
```

Note: `savedTheme`/`savedFont` are globals set by each page's `<head>` bootstrap; `initThemeFont` is only called by setup.js/index.js, so classic pages are unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `node Web/tests/common.spec.js`
Expected: `ALL common.spec assertions PASS`

- [ ] **Step 5: Commit**

```bash
git add Web/js/common.js Web/tests/common.spec.js
git commit -m "refactor(web): add shared helpers to common.js"
```

---

### Task 2: Create js/setup.js with the wizard logic

**Files:**
- Create: `Web/js/setup.js`
- Test: `Web/tests/setup.spec.js` (new)

**Interfaces:**
- Consumes: `nvramGet`, `buildAlertBits`, `saveAlertFields`, `finishPreloader`, `hideSvgMenu`, `initThemeFont` (Task 1); constants `DEEP_SLEEP, WIFI_MODE, WIFI_SSID, WIFI_PASSWORD, WIFI_HIDE, EMAIL_ALERT, SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD, PLANT_NAME, ALERTS, DEMO_PASSWORD, FIRST_SETUP` (already in common.js).
- Produces: globals `showStep`, `scanWifi`, state `setupNetwork`, `setupSsid`, `setupWifiPass`.

- [ ] **Step 1: Write the failing test**

Create `Web/tests/setup.spec.js`:

```js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'js', 'common.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'js', 'setup.js'), 'utf8');

class El {
  constructor(id){ this.id=id; this.listeners={}; this.attrs={}; this._v=''; this._cls=new Set(); this.checked=false; this._style={};
    this.classList={ add:(c)=>this._cls.add(c), remove:(c)=>this._cls.delete(c), contains:(c)=>this._cls.has(c) }; this.children=[]; this.contentDocument=null; }
  get parentNode(){ return this.parent; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  getAttribute(k){ return this.attrs[k]!==undefined?this.attrs[k]:null; }
  setAttribute(k,v){ this.attrs[k]=v; }
  click(){ (this.listeners['click']||[]).forEach(f=>f.call(this)); }
  set value(v){ this._v=v; } get value(){ return this._v; }
  set textContent(t){ this._tc=t; } get textContent(){ return this._tc; }
  set className(c){ this._cls=new Set(c.split(' ')); } get className(){ return [...this._cls].join(' '); }
  set innerHTML(h){ this.children=[]; } get innerHTML(){ return this._html||''; }
  get style(){ return this._style; }
  appendChild(c){ c.parent=this; this.children.push(c); }
  removeChild(c){ const i=this.children.indexOf(c); if(i>-1) this.children.splice(i,1); c.parent=null; }
  insertBefore(c,ref){ c.parent=this; const i=this.children.indexOf(ref); if(i<0) this.children.push(c); else this.children.splice(i,0,c); }
  get nextSibling(){ if(!this.parent) return null; const i=this.parent.children.indexOf(this); return this.parent.children[i+1]||null; }
  focus(){}
  dispatchEvent(ev){ ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[ev.type]||[]).forEach(f=>f.call(this,ev)); }
  querySelector(sel){ const cls=sel.replace('.',''); const q=(n)=>{ for(const c of n.children){ if(c._cls.has(cls)) return c; const r=q(c); if(r) return r; } return null; }; return q(this); }
}
const els = {};
const get = (id) => els[id] || (els[id] = new El(id));
const alertCbs = [0,1,2,3,4,5,6,7].map(i => new El('aCb'+i));
alertCbs[0].checked = true; alertCbs[5].checked = true;
location = { protocol:'http:', host:'192.168.4.1', pathname:'/' };
document = {
  getElementById: get,
  documentElement: get('htmlRoot'),
  querySelectorAll(sel){
    if(sel === '.setup-step') return ['step-power','step-connect','step-wifi','step-scan','step-alerts','step-plant-password'].map(get);
    if(sel === '.setup-tile') return ['tileBattery','tileOutlet','tileInternet','tileLocal'].map(get);
    if(sel === '#setupAlertsGrid .tab-checkbox') return alertCbs;
    return [];
  },
  createElement(){ return new El(); }
};
const navs = [];
const sends = [];
const xhrs = [];
window = { addEventListener(){}, isSecureContext:false, location:{ set href(v){ navs.push(v); } } };
let theme='dark', font='medium';
localStorage = { getItem(k){ return k==='theme'?theme:k==='fontSize'?font:null; }, setItem(k,v){ if(k==='theme')theme=v; if(k==='fontSize')font=v; } };
const FakeXHR = function(){ this.open=(m,u)=>{ this.url=u; }; this.send=()=>{ sends.push(this.url); xhrs.push(this); }; };
XMLHttpRequest = FakeXHR;
const savedTheme = theme, savedFont = font;

const assert = (c,m) => { if(!c){ console.log('FAIL:', m); process.exit(1); } };
const tick = (ms) => new Promise(r => setTimeout(r, ms));

eval(common);
eval(setup);

get('setupWaiting').classList.add('hidden');
get('reconnectMsg').classList.add('hidden');
get('plantPasswordForm').classList.remove('hidden');
get('scanWarning').classList.add('hidden');
get('wifiSsidRequired').classList.add('hidden');
get('wifiPassMismatch').classList.add('hidden');

const doWifi = (ssid, pass) => { get('setupSSID').value=ssid; get('setupPassword').value=pass; get('setupConfirmPassword').value=pass; get('wifiSetupForm').dispatchEvent({type:'submit'}); };
const doPlant = () => { get('setupPlantPassword').value=''; get('setupConfirmPlantPassword').value=''; get('plantPasswordForm').dispatchEvent({type:'submit'}); };
const resetWaiting = () => { get('setupWaiting').classList.add('hidden'); get('plantPasswordForm').classList.remove('hidden'); get('reconnectMsg').classList.add('hidden'); };

(async function(){
  // Power tile -> offset 21
  get('tileBattery').click();
  assert(sends[0] === 'nvram.json?offset=21&value=10', 'battery tile offset 21/10');
  assert(get('step-connect').classList.contains('active'), 'battery -> step-connect');

  // Internet -> scan fires
  get('tileInternet').click();
  assert(xhrs.some(x => x.url === 'api?wifi=scan'), 'scan fired');

  // good scan -> 2 items, no warning
  const scanReq = xhrs.filter(x => x.url === 'api?wifi=scan').pop();
  scanReq.status = 200; scanReq.responseText = 'NetA\nNetB';
  scanReq.onload();
  assert(get('scanList').children.length === 2, 'scan list rendered 2 items');
  assert(get('scanWarning').classList.contains('hidden'), 'no warning when scan ok');

  // bad scan -> warning shown, list cleared
  scanWifi();
  const badReq = xhrs.filter(x => x.url === 'api?wifi=scan').pop();
  badReq.status = 200; badReq.responseText = 'error: no wifi';
  badReq.onload();
  assert(!get('scanWarning').classList.contains('hidden'), 'warning shown on bad scan');
  assert(get('scanList').children.length === 0, 'list cleared on bad scan');

  // connect via first item (no password) -> alerts
  scanWifi();
  const okReq = xhrs.filter(x => x.url === 'api?wifi=scan').pop();
  okReq.status = 200; okReq.responseText = 'NetA\nNetB';
  okReq.onload();
  get('scanList').children[0].click();
  const connBtn = get('scanList').children[0].nextSibling.children[1];
  connBtn.click();
  assert(sends.some(u => u === 'nvram.json?offset=6&value=NetA'), 'WIFI_SSID written');
  assert(get('step-alerts').classList.contains('active'), 'connect -> step-alerts');

  // alerts save -> bits + offsets 22..27
  get('setupAlertEmail').value = 'a@b.c';
  get('setupAlertSMTPServer').value = 's';
  get('setupAlertSMTPUsername').value = 'u';
  get('setupAlertSMTPPassword').value = 'p';
  get('setupConfirmSMTPPassword').value = 'p';
  get('setupAlertPlantName').value = 'My';
  get('alertsSaveBtn').click();
  assert(get('setupAlerts').value === '100001000', 'alerts bits: ' + get('setupAlerts').value);
  assert(sends.some(u => u === 'nvram.json?offset=22&value=a@b.c'), 'EMAIL_ALERT');
  assert(sends.some(u => u === 'nvram.json?offset=27&value=100001000'), 'ALERTS');
  assert(get('step-plant-password').classList.contains('active'), 'alerts -> plant-password');

  // plant password mismatch blocks
  get('setupPlantPassword').value = 'x';
  get('setupConfirmPlantPassword').value = 'y';
  get('plantPasswordForm').dispatchEvent({type:'submit'});
  assert(!get('plantPassMismatch').classList.contains('hidden'), 'mismatch blocks');

  // internet finalize: no reboot, 6s -> find.html
  doPlant();
  assert(!sends.includes('reboot'), 'internet path no reboot');
  await tick(6200);
  assert(navs[0] === 'find.html', 'internet -> find.html');

  // local finalize: reboot + redirects
  resetWaiting();
  get('tileLocal').click();
  doWifi('Plant','');
  assert(sends.some(u => u === 'nvram.json?offset=6&value=Plant'), 'local SSID written');
  assert(sends.some(u => u === 'nvram.json?offset=2&value=0'), 'WIFI_HIDE written');
  doPlant();
  assert(sends[sends.length-1] === 'reboot', 'local Plant reboot');
  assert(navs[1] === 'index.html', 'local Plant -> index.html immediately');

  resetWaiting();
  get('tileLocal').click();
  doWifi('MyAP','');
  doPlant();
  assert(sends[sends.length-1] === 'reboot', 'local MyAP reboot');
  assert(!get('setupWaiting').classList.contains('hidden'), 'MyAP shows waiting bar');
  await tick(12200);
  assert(navs[2] === 'index.html', 'MyAP -> index.html after 12s');

  console.log('ALL setup.spec assertions PASS');
  process.exit(0);
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node Web/tests/setup.spec.js`
Expected: FAIL — ENOENT for `Web/js/setup.js` (or ReferenceError on first wizard call).

- [ ] **Step 3: Create Web/js/setup.js**

Move the wizard logic from `Web/setup.html` lines 353-639 verbatim, with these substitutions:
- Delete the local constant declarations (they come from common.js now).
- Replace the preloader block with:
```js
window.addEventListener('load', function() {
  finishPreloader(500);
});
```
- Replace the svgObject load body with:
```js
var svgObject = document.getElementById('svgObject');
svgObject.addEventListener('load', function() {
  try {
    hideSvgMenu(svgObject.contentDocument);
  } catch(e) {}
});
```
- Replace the themeToggle/fontToggle blocks with a single call:
```js
initThemeFont();
```
- Replace the local `nvramGet` definition with nothing (comes from common.js).
- Replace the alerts-save field writes with `buildAlertBits` + `saveAlertFields`:
```js
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
```
- Keep everything else byte-identical: `showStep`, `bindTile`, `parseScanResponse`, `renderScan`, `openScanPassword`, `scanWifi`, `showScanWarning`, tile mousedown bindings, tile bindings, `scanRefresh`, wifi form submit, plant password form submit (reboot placement included), state vars.

The file starts with the `window load`/`svgObject`/`initThemeFont()` bootstrap, then the functions above.

- [ ] **Step 4: Run test to verify it passes**

Run: `node Web/tests/setup.spec.js`
Expected: `ALL setup.spec assertions PASS`

- [ ] **Step 5: Commit**

```bash
git add Web/js/setup.js Web/tests/setup.spec.js
git commit -m "refactor(web): move wizard JS from setup.html to js/setup.js"
```

---

### Task 3: Wire up setup.html

**Files:**
- Modify: `Web/setup.html`

- [ ] **Step 1: Trim the head bootstrap**

Replace the inline `<script>` in `<head>` (currently lines 7-21) with:

```html
<script>
var savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
var savedFont = localStorage.getItem('fontSize') || 'medium';
document.documentElement.setAttribute('data-font', savedFont);
</script>
```

`applySvgTheme` now lives in common.js.

- [ ] **Step 2: Delete the body script block, add script tags**

Delete the entire `<script>...</script>` block currently at lines 353-639. In its place add:

```html
<script defer src="js/common.js"></script>
<script defer src="js/setup.js"></script>
```

- [ ] **Step 3: Verify**

Run: `node Web/tests/common.spec.js && node Web/tests/setup.spec.js`
Expected: both PASS (they read the .js files, not setup.html).

Run: `grep -c "wifiSetupForm\|alertsSaveBtn" Web/setup.html`
Expected: 0 matches in a `<script>` block — the ids still appear in HTML markup (input/button elements), so confirm each match is an HTML attribute occurrence, NOT inside `<script>`.

Run: `grep -n "script" Web/setup.html`
Expected: only the head bootstrap `<script>`, the two `src=` script tags, and `svg/bonsai.svg` object.

- [ ] **Step 4: Commit**

```bash
git add Web/setup.html
git commit -m "refactor(web): load wizard scripts from js/ in setup.html"
```

---

### Task 4: Wire up index.html

**Files:**
- Modify: `Web/index.html`

- [ ] **Step 1: Trim the head bootstrap**

Same replacement as Task 3 Step 1 — the inline `<script>` in `<head>` (currently lines 7-20) becomes the 4-line savedTheme/data-theme/savedFont/data-font block.

- [ ] **Step 2: Add common.js script tag**

Immediately before `<script defer src="js/index.js"></script>` (line 402) add:

```html
<script defer src="js/common.js"></script>
```

- [ ] **Step 3: Verify**

Run: `grep -n "js/common.js" Web/index.html` — expected: exactly one match.
Run: `grep -n "applySvgTheme" Web/index.html` — expected: no matches (moved to common.js).

- [ ] **Step 4: Commit**

```bash
git add Web/index.html
git commit -m "refactor(web): load common.js in index.html"
```

---

### Task 5: Refactor index.js to use shared helpers

**Files:**
- Modify: `Web/js/index.js`
- Test: `Web/tests/index.spec.js` (new)

**Interfaces:**
- Consumes: `nvramGet`, `buildAlertBits`, `saveAlertFields`, `finishPreloader`, `hideSvgMenu`, `initThemeFont`, constants (all from common.js via Task 1).

- [ ] **Step 1: Write the failing test**

Create `Web/tests/index.spec.js`:

```js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'js', 'common.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'js', 'index.js'), 'utf8');

class El {
  constructor(id){ this.id=id; this.listeners={}; this.attrs={}; this._v=''; this._cls=new Set(); this.checked=false;
    this._style={ getPropertyValue: () => '', setProperty: () => {}, background: '' };
    this.classList={ add:(c)=>this._cls.add(c), remove:(c)=>this._cls.delete(c), contains:(c)=>this._cls.has(c) }; this.children=[]; this.contentDocument=null; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  getAttribute(k){ return this.attrs[k]!==undefined?this.attrs[k]:null; }
  setAttribute(k,v){ this.attrs[k]=v; }
  click(){ (this.listeners['click']||[]).forEach(f=>f.call(this)); }
  set value(v){ this._v=v; } get value(){ return this._v; }
  set textContent(t){ this._tc=t; } get textContent(){ return this._tc; }
  set innerHTML(h){ this.children=[]; } get innerHTML(){ return this._html||''; }
  get style(){ return this._style; }
  appendChild(c){ c.parent=this; this.children.push(c); }
  dispatchEvent(ev){ ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[ev.type]||[]).forEach(f=>f.call(this,ev)); }
}
const els = {};
const get = (id) => els[id] || (els[id] = new El(id));
const alertCbs = [0,1,2,3,4,5,6,7].map(i => new El('tCb'+i));
alertCbs[0].checked = true; alertCbs[7].checked = true;
location = { protocol:'http:', host:'192.168.4.1', pathname:'/' };
document = {
  getElementById: get,
  documentElement: get('htmlRoot'),
  querySelectorAll(sel){
    if(sel === '#tab-alerts .tab-checkbox') return alertCbs;
    return [];
  },
  querySelector(sel){ return get('query:'+sel); },
  createElement(){ return new El(); },
  body: new El('body')
};
const sends = [];
window = { addEventListener(){}, isSecureContext:false, location:{ hostname:'192.168.4.1', protocol:'http:', host:'192.168.4.1', pathname:'/', set href(v){} }, open(){ } };
let theme='dark', font='medium';
localStorage = { getItem(k){ return k==='theme'?theme:k==='fontSize'?font:null; }, setItem(k,v){ if(k==='theme')theme=v; if(k==='fontSize')font=v; } };
const FakeXHR = function(){ this.responseType=null; this.open=(m,u)=>{ this.url=u; }; this.send=()=>sends.push(this.url); this.setRequestHeader=()=>{}; };
XMLHttpRequest = FakeXHR;
const savedTheme = theme, savedFont = font;

const assert = (c,m) => { if(!c){ console.log('FAIL:', m); process.exit(1); } };

eval(common);
eval(index);

assert(typeof nvramGet === 'function', 'nvramGet shared');
assert(typeof buildAlertBits === 'function', 'buildAlertBits shared');
assert(typeof saveAlertFields === 'function', 'saveAlertFields shared');
assert(typeof initThemeFont === 'function', 'initThemeFont shared');
assert(typeof hideSvgMenu === 'function', 'hideSvgMenu shared');
assert(typeof saveAlertField === 'undefined', 'index.js no longer defines saveAlertField');
assert(WIFI_MODE === 1 && DEEP_SLEEP === 21 && PLANT_POT_SIZE === 15 && PNP_ADC === 31, 'constants from common.js');

get('AlertEmail').value = 'x@y.z';
get('AlertSMTPServer').value = 'smtp';
get('AlertSMTPUsername').value = 'u';
get('AlertSMTPPassword').value = 'p';
get('AlertPlantName').value = 'Plant';
saveAlertsSettings();
assert(get('Alerts').value === '100000010', 'saveAlertsSettings bits: ' + get('Alerts').value);
assert(sends.some(u => u === 'nvram.json?offset=22&value=x@y.z'), 'EMAIL_ALERT via nvramGet');
assert(sends.some(u => u === 'nvram.json?offset=27&value=100000010'), 'ALERTS via nvramGet');
assert(sends.some(u => u === 'nvram.json?offset=24&value=u'), 'SMTP_USERNAME via nvramGet');

console.log('ALL index.spec assertions PASS');
process.exit(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node Web/tests/index.spec.js`
Expected: FAIL at `typeof saveAlertField === 'undefined'` (index.js still defines it) or duplicate-constant mismatch.

- [ ] **Step 3: Apply index.js edits**

1. Delete lines 165-204 (the duplicate `soil_type_labels`/`soil_type_color` + full constants block). Keep the earlier `applyNvramToSvg` function which references these globals — they now come from common.js.
2. Delete the `resetFlash` redefinition at line 648.
3. Replace the two inline SVG menu-hide blocks (around lines 133-142) with `hideSvgMenu(doc);`.
4. In the svgObject `load` handler, replace:
```js
  var elapsed = Date.now() - started;
  var remaining = Math.max(0, 1500 - elapsed);
  setTimeout(function() {
    preloader.classList.add('done');
  }, remaining);
```
with:
```js
  var elapsed = Date.now() - started;
  var remaining = Math.max(0, 1500 - elapsed);
  finishPreloader(remaining);
```
and delete `var preloader = document.getElementById('preloader-overlay');` (line 1).
5. Delete `saveAlertField` (lines 1022-1026) and replace every call site `saveAlertField(...)` with `nvramGet(...)`. Call sites: `saveAlertsSettings`, `saveSecuritySettings` (2 uses), `defaultLayout`.
6. Rewrite `saveAlertsSettings` (lines 1028-1043) as:
```js
function saveAlertsSettings() {
  var bits = buildAlertBits('#tab-alerts .tab-checkbox');
  document.getElementById('Alerts').value = bits;
  saveAlertFields(bits, {
    email: 'AlertEmail', server: 'AlertSMTPServer',
    username: 'AlertSMTPUsername', password: 'AlertSMTPPassword',
    plant: 'AlertPlantName'
  });
}
```
7. Replace the theme/font block (lines 1233-1260) with `initThemeFont();`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node Web/tests/index.spec.js`
Expected: `ALL index.spec assertions PASS`

Also run the other suites:
Run: `node Web/tests/common.spec.js && node Web/tests/setup.spec.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add Web/js/index.js Web/tests/index.spec.js
git commit -m "refactor(web): use shared helpers from common.js in index.js"
```

---

### Task 6: Full verification

**Files:** (read-only checks)

- [ ] **Step 1: Grep confirmations**

Run:
```bash
cd /Users/dima/Desktop/ESPTiny-Plant/Web
grep -rn "saveAlertField" js/ || echo "no saveAlertField"
grep -rn "<script>" setup.html index.html
```
Expected: no `saveAlertField` anywhere in `js/`; `<script>` appears in setup.html/index.html only once each (the head bootstrap).

- [ ] **Step 2: Serve and curl all pages + JS**

```bash
cd /Users/dima/Desktop/ESPTiny-Plant/Web
(python3 -m http.server 8124 >/dev/null 2>&1 & echo $! > /tmp/ps.pid)
sleep 1
for f in index.html setup.html find.html classic/index.html js/common.js js/setup.js js/index.js; do
  printf "%s %s\n" "$f" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8124/$f)"
done
kill $(cat /tmp/ps.pid)
```
Expected: all `200`.

- [ ] **Step 3: Node suites**

Run: `node Web/tests/common.spec.js && node Web/tests/setup.spec.js && node Web/tests/index.spec.js`
Expected: all three print `ALL ... assertions PASS`.

- [ ] **Step 4: Commit any leftover refactor changes**

If `git status --short` shows any modified refactor file not yet committed (should not happen if each task committed), commit them:
```bash
cd /Users/dima/Desktop/ESPTiny-Plant
git add Web/ docs/superpowers/plans/2026-08-05-setup-js-refactor-design.md
git commit -m "refactor(web): setup.js + common.js consolidation"
```
Do NOT stage: `CNC/case.FCStd`, `Web/svg/bonsai.svg`, `semver/version.h`, `.gitignore`, `Web/nvram.json`, `littlefs-flash-win.ps1`.

- [ ] **Step 5: Final log**

Run: `git log --oneline -6`
Expected: the refactor commits from Tasks 1-5 (and Task 6 if a commit was made) on top of the prior feature commit.
