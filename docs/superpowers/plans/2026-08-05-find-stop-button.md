# Stop Button During Scanning in find.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Stop button while a scan runs in `Web/find.html`; clicking it ends the scan within ~1s and re-displays the input prompt with "Scan stopped.".

**Architecture:** A global `stopRequested` flag is checked in `scanRange()`'s loop condition (`&& !stopRequested`). `scanRange()` is the single funnel for every scan path (auto-detect, saved subnet, manual Scan), so it owns the Stop button's visibility: unhide on entry, hide after the loop. `missAndPrompt()` becomes `scanEndUI()`, which branches on `stopRequested` for the message but always re-displays the prompt. The in-flight batch (≤12 probes, each ≤1s via `PROBE_TIMEOUT_MS`) finishes first, so stop takes effect within ~1s with no `probeIP` changes.

**Tech Stack:** Plain ES6 browser JS + minimal HTML/CSS (one button, two CSS rules). Verification via `node --check` on the extracted inline script, a `node` stop-behavior harness with DOM/fetch stubs, a local `python3 -m http.server` smoke test, and greps.

## Global Constraints

- Only file modified: `Web/find.html` — the inline `<script>`, one HTML button element, and the two CSS rules in the spec.
- No changes to `classic/` pages or any other `Web/` file.
- Preserve byte-for-byte: the found flow in `probeIP` (`Found IP: ...` + redirect + `lastSubnet` save), `PROBE_TIMEOUT_MS = 1000`, the default-IP probe (`192.168.8.8` with its 3s `AbortController` signal), `CONCURRENCY = 12`, `scanPrefix`/`prefixLenOf`/`validPrefix` class logic, and the miss message `No device found on that subnet.`.
- Never stage unrelated dirty files: `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, `littlefs-flash-win.ps1`.
- Design doc: `docs/superpowers/specs/2026-08-05-find-stop-button-design.md`.

---

### Task 1: Stop button during scanning

**Files:**
- Modify: `Web/find.html` — CSS (~line 52), HTML (~line 64), globals (~line 74), `scanRange` (~lines 122-140), `missAndPrompt` (~lines 147-150), load handler (~lines 185-196), Scan button handler (~line 208), and a new stop handler after the Scan handler (~line 209)

**Interfaces:**
- Consumes: existing `scanRange(startIP, endIP)` → `Promise<boolean>`, `scanPrefix(prefix)` → `Promise<boolean>`, `foundGlobal`, `isScanning`, `setStatus`, `document.getElementById`, `localStorage`.
- Produces:
  - `let stopRequested = false;` — global, reset to `false` at the start of every `scanRange` call, set to `true` by the Stop button handler.
  - `scanEndUI()` — shows `Scan stopped.` if `stopRequested`, else `No device found on that subnet.`, and unhides `#prompt`.
  - `#stopBtn` — hidden by default; shown by `scanRange` on entry, hidden after its loop.
- `scanRange` loop condition becomes `currentIPInt <= endIPInt && !foundGlobal && !stopRequested`.

- [ ] **Step 1: Add the Stop button markup and CSS**

In `Web/find.html`, add the CSS rules after the existing hover rule (line 52, `.card button:hover { background: #3f714a; }`):

```css
  #stopBtn { background: #a34a4a; margin-top: 8px; }
  #stopBtn:hover { background: #8f3f3f; }
```

Add the button after the status paragraph (line 64, `<p class="status" id="status">Rebooting ...</p>`):

```html
    <button id="stopBtn" type="button" hidden>Stop</button>
```

- [ ] **Step 2: Add the `stopRequested` global**

In `Web/find.html`, change the globals block (currently lines 73-75):

```js
  let foundGlobal = false;
  let isScanning = false;
  const PROBE_TIMEOUT_MS = 1000;
```

to:

```js
  let foundGlobal = false;
  let isScanning = false;
  let stopRequested = false;
  const PROBE_TIMEOUT_MS = 1000;
```

- [ ] **Step 3: Wire `stopRequested` and the button into `scanRange()`**

In `Web/find.html`, replace `scanRange` (currently lines 122-140):

```js
  async function scanRange(startIP, endIP) {
    if (isScanning) return foundGlobal;
    isScanning = true;
    const startIPInt = ipToInt(startIP);
    const endIPInt = ipToInt(endIP);
    const CONCURRENCY = 12;
    let currentIPInt = startIPInt;
    while (currentIPInt <= endIPInt && !foundGlobal) {
      const batch = [];
      for (let i = 0; i < CONCURRENCY && currentIPInt <= endIPInt; i++) {
        batch.push(currentIPInt);
        currentIPInt++;
      }
      setStatus('Scanning ' + intToIp(batch[batch.length - 1]) + ' ...');
      await Promise.all(batch.map(probeIP));
    }
    isScanning = false;
    return foundGlobal;
  }
```

with:

```js
  async function scanRange(startIP, endIP) {
    if (isScanning) return foundGlobal;
    isScanning = true;
    stopRequested = false;
    document.getElementById('stopBtn').hidden = false;
    const startIPInt = ipToInt(startIP);
    const endIPInt = ipToInt(endIP);
    const CONCURRENCY = 12;
    let currentIPInt = startIPInt;
    while (currentIPInt <= endIPInt && !foundGlobal && !stopRequested) {
      const batch = [];
      for (let i = 0; i < CONCURRENCY && currentIPInt <= endIPInt; i++) {
        batch.push(currentIPInt);
        currentIPInt++;
      }
      setStatus('Scanning ' + intToIp(batch[batch.length - 1]) + ' ...');
      await Promise.all(batch.map(probeIP));
    }
    isScanning = false;
    document.getElementById('stopBtn').hidden = true;
    return foundGlobal;
  }
```

- [ ] **Step 4: Replace `missAndPrompt()` with `scanEndUI()`**

In `Web/find.html`, replace (currently lines 147-150):

```js
  function missAndPrompt() {
    setStatus('No device found on that subnet.');
    document.getElementById('prompt').hidden = false;
  }
```

with:

```js
  function scanEndUI() {
    if (stopRequested) setStatus('Scan stopped.');
    else setStatus('No device found on that subnet.');
    document.getElementById('prompt').hidden = false;
  }
```

- [ ] **Step 5: Update the auto-detect and saved-subnet callers**

In `Web/find.html`, replace the detection block in the 15s `setTimeout` (currently lines 185-196):

```js
    const ip = await getLocalIP(2000);
    if (ip) {
      if (await scanPrefix(prefixOf(ip))) return;
      if (prefixLenOf(ip) < 3 && (await scanPrefix(prefixOf(ip, prefixLenOf(ip))))) return;
      missAndPrompt();
      return;
    }
    const saved = localStorage.getItem('lastSubnet');
    if (saved && validPrefix(saved)) {
      if (await scanPrefix(saved)) return;
      missAndPrompt();
      return;
    }
```

with:

```js
    const ip = await getLocalIP(2000);
    if (ip) {
      let found = await scanPrefix(prefixOf(ip));
      if (!found && !stopRequested && prefixLenOf(ip) < 3) {
        found = await scanPrefix(prefixOf(ip, prefixLenOf(ip)));
      }
      if (found) return;
      scanEndUI();
      return;
    }
    const saved = localStorage.getItem('lastSubnet');
    if (saved && validPrefix(saved)) {
      const found = await scanPrefix(saved);
      if (found) return;
      scanEndUI();
      return;
    }
```

The `!stopRequested` guard prevents a stop during the fast /24 from launching the wider /16 or /8 sweep.

- [ ] **Step 6: Update the Scan button handler and add the Stop handler**

In `Web/find.html`, in the Scan handler (line 208), change:

```js
    if (!(await scanPrefix(value))) missAndPrompt();
```

to:

```js
    if (!(await scanPrefix(value))) scanEndUI();
```

Then add the Stop handler immediately after the Scan handler's closing `});` (currently line 209):

```js
  document.getElementById('stopBtn').addEventListener('click', () => { stopRequested = true; });
```

- [ ] **Step 7: Verify inline-script syntax**

Run:

```bash
python3 - <<'PY'
import re
src = open('/Users/dima/Desktop/ESPTiny-Plant/Web/find.html').read()
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/find-check.js', 'w').write(m.group(1))
PY
node --check /tmp/find-check.js
echo "exit=$?"
```

Expected: `exit=0`, no error output.

- [ ] **Step 8: Verify stop behavior with the harness**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const src = fs.readFileSync('/tmp/find-check.js', 'utf8');
const grab = (name) => {
  const m = src.match(new RegExp('(async\\s+)?function ' + name + '[\\s\\S]*?\\n  }'));
  if (!m) throw new Error('function ' + name + ' not found');
  return m[0];
};
let isScanning = false;
let foundGlobal = false;
let stopRequested = false;
let statusText = '';
let probeCalls = 0;
const releases = [];
function ipToInt(ip) { return ip.split('.').reduce((i, o) => (i << 8) + parseInt(o, 10), 0); }
function intToIp(i) { return [(i >> 24) & 255, (i >> 16) & 255, (i >> 8) & 255, i & 255].join('.'); }
function setStatus(t) { statusText = t; }
function probeIP() { probeCalls++; return new Promise((r) => { releases.push(r); }); }
const els = {};
function getElementById(id) { return els[id] || (els[id] = { hidden: false, textContent: '' }); }
const document = { getElementById };
const scanRange = eval('(' + grab('scanRange') + ')');
const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };
(async () => {
  const pr = scanRange('192.168.1.2', '192.168.1.255');
  await Promise.resolve();
  await Promise.resolve();
  assert(els['stopBtn'].hidden === false, 'stop button shown during scan');
  assert(probeCalls === 12, 'first batch of 12 probes in flight');
  assert(stopRequested === false, 'stopRequested reset on scan entry');
  stopRequested = true;
  releases.forEach((r) => r());
  const found = await pr;
  assert(found === false, 'stopped scan returns false');
  assert(probeCalls === 12, 'no further batches after stop');
  assert(isScanning === false, 'isScanning cleared after stop');
  assert(els['stopBtn'].hidden === true, 'stop button hidden after scan');
  const pr2 = scanRange('192.168.1.2', '192.168.1.3');
  await Promise.resolve();
  assert(stopRequested === false, 'stopRequested reset on next scan entry');
  assert(probeCalls === 14, 'next scan probes run');
  releases.forEach((r) => r());
  await pr2;
  console.log('all stop checks passed');
})();
NODE
```

Expected: prints `all stop checks passed`.

- [ ] **Step 9: Verify served page returns 200**

Run:

```bash
cd /Users/dima/Desktop/ESPTiny-Plant/Web && python3 -m http.server 8128 >/dev/null 2>&1 & SERVER=$!; sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8128/find.html; kill $SERVER
```

Expected: `200`.

- [ ] **Step 10: Verify preserved invariants and absence of old helper**

Run:

```bash
grep -n "stopRequested" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "stopBtn" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "scanEndUI" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "missAndPrompt" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "Scan stopped" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "PROBE_TIMEOUT_MS" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "Found IP" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "No device found on that subnet" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "192.168.8.8" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "prefixLenOf" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
```

Expected: `stopRequested` appears 5+ times (declaration, reset, loop condition, guard, handler); `stopBtn` appears 6+ times (CSS x2, HTML x1, scanRange x2, handler x1); `scanEndUI` defined and used 3 times; `Scan stopped.` present once; `missAndPrompt` has NO matches (fully removed); `PROBE_TIMEOUT_MS`, `Found IP`, `No device found on that subnet.`, `192.168.8.8`, `prefixLenOf` all present.

- [ ] **Step 11: Commit**

```bash
git add Web/find.html
git commit -m "feat(web): add stop button to find scan"
```

Stage ONLY `Web/find.html`; do not stage `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, or `littlefs-flash-win.ps1`.
