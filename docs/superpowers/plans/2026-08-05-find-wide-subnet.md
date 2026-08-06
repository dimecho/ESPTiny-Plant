# Class-Aware Subnet Scanning in find.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the find scan in `Web/find.html` derive its range from the IPv4 private class (`192.168.x` → /24, `172.16`–`172.31.x` → /16, `10.x` → /8) instead of always scanning a /24.

**Architecture:** `scanRange(startIP, endIP)` already iterates arbitrary integer ranges with bounded concurrency and `foundGlobal` early-exit. All /24 assumptions live in the call sites, so this replaces the /24-only helpers (`validPrefix`, `scanSubnet`) with class-aware ones (`prefixLenOf`, `scanPrefix`), refactors `scanRange` to return its result so a miss can trigger the wider class scan, and centralizes the miss message in `missAndPrompt()`.

**Tech Stack:** Plain ES6 browser JS (no build step, no external assets). Verification via `node --check` on the extracted inline script, a local `python3 -m http.server` smoke test, and a `node` behavior harness.

## Global Constraints

- Only file modified: `Web/find.html` — the inline `<script>` plus the two text tweaks listed below (prompt hint and invalid-input message). No layout/CSS changes.
- No changes to `classic/` pages or any other `Web/` file.
- Preserve byte-for-byte: the found flow in `probeIP` (`Found IP: ...` + `window.location.href` redirect + `lastSubnet` save), `PROBE_TIMEOUT_MS = 1000`, the default-IP probe (`192.168.8.8` with its own 3s `AbortController` signal), `CONCURRENCY = 12`, `isScanning`, and the failure message `No device found on that subnet.`
- Never stage unrelated dirty files: `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, `littlefs-flash-win.ps1`.
- Design doc: `docs/superpowers/specs/2026-08-05-find-wide-subnet-design.md`.

---

### Task 1: Class-aware subnet scanning

**Files:**
- Modify: `Web/find.html` — helpers (~lines 86-92), `scanRange`/`scanSubnet` (~lines 117-141), load handler (~lines 174-180), Scan button handler (~lines 183-191), prompt hint (line 66)

**Interfaces:**
- Consumes: existing `ipToInt`, `intToIp`, `isPrivate`, `setStatus`, `probeIP(ipInt, signal)`, `foundGlobal`, `isScanning`, `getLocalIP(timeoutMs)`, `localStorage`, `document.getElementById`.
- Produces:
  - `prefixOf(ip, len)` — first `len` octets (default 3).
  - `prefixLenOf(ip)` — 1 for `10.`, 2 for `172.(1[6-9]|2\d|3[01]).`, else 3.
  - `validPrefix(prefix)` — 1-3 octets, each `/^\d{1,3}$/` and `<= 255`.
  - `scanRange(startIP, endIP)` — returns `Promise<boolean>` (`foundGlobal`), no miss message.
  - `scanPrefix(prefix)` — returns `scanRange` over the class range: 1 octet → `prefix.0.0.2`..`prefix.255.255.254`, 2 octets → `prefix.0.2`..`prefix.255.254`, 3 octets → `prefix.2`..`prefix.254`.
  - `missAndPrompt()` — sets `No device found on that subnet.` and unhides `#prompt`.
- `lastSubnet` remains the found device's /24 (3 octets) — `probeIP` still calls `prefixOf(currentIP)`.

- [ ] **Step 1: Class-aware prefix helpers**

In `Web/find.html`, replace the helpers block (currently ~lines 86-92):

```js
  function prefixOf(ip) {
    return ip.split('.').slice(0, 3).join('.');
  }
  function validPrefix(prefix) {
    const parts = prefix.split('.');
    return parts.length === 3 && parts.every((o) => /^\d{1,3}$/.test(o) && parseInt(o, 10) <= 255);
  }
```

with:

```js
  function prefixOf(ip, len) {
    return ip.split('.').slice(0, len || 3).join('.');
  }
  function prefixLenOf(ip) {
    if (/^10\./.test(ip)) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 3;
  }
  function validPrefix(prefix) {
    const parts = prefix.split('.');
    return parts.length >= 1 && parts.length <= 3 && parts.every((o) => /^\d{1,3}$/.test(o) && parseInt(o, 10) <= 255);
  }
```

- [ ] **Step 2: Refactor `scanRange`, add `scanPrefix` and `missAndPrompt`**

In `Web/find.html`, replace `scanRange` + `scanSubnet` (currently ~lines 117-141):

```js
  async function scanRange(startIP, endIP) {
    if (isScanning) return;
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
    if (!foundGlobal) {
      setStatus('No device found on that subnet.');
      document.getElementById('prompt').hidden = false;
    }
  }
  function scanSubnet(prefix) {
    scanRange(prefix + '.2', prefix + '.254');
  }
```

with:

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
  function scanPrefix(prefix) {
    const parts = prefix.split('.');
    if (parts.length === 1) return scanRange(prefix + '.0.0.2', prefix + '.255.255.254');
    if (parts.length === 2) return scanRange(prefix + '.0.2', prefix + '.255.254');
    return scanRange(prefix + '.2', prefix + '.254');
  }
  function missAndPrompt() {
    setStatus('No device found on that subnet.');
    document.getElementById('prompt').hidden = false;
  }
```

- [ ] **Step 3: Class-aware auto-detect + saved-subnet path in the load handler**

In `Web/find.html`, replace the detection block in the 15s `setTimeout` (currently ~lines 174-180):

```js
    const ip = await getLocalIP(2000);
    if (ip) { scanSubnet(prefixOf(ip)); return; }
    const saved = localStorage.getItem('lastSubnet');
    if (saved && validPrefix(saved)) { scanSubnet(saved); return; }
    setStatus('Enter your router IP');
    document.getElementById('prompt').hidden = false;
```

with:

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
    setStatus('Enter your router IP');
    document.getElementById('prompt').hidden = false;
```

The fast-path /24 scan runs first; the wider class scan (`10` → /8, `172.16`–`172.31` → /16) runs only when the /24 missed and `prefixLenOf(ip) < 3`. `192.168.x` scans exactly as before (single /24, no expansion).

- [ ] **Step 4: Scan button handler + prompt hint text**

In `Web/find.html`, replace the button handler (currently ~lines 183-191):

```js
  document.getElementById('scanBtn').addEventListener('click', () => {
    const value = document.getElementById('subnet').value.trim();
    if (!validPrefix(value)) {
      setStatus('Enter three octets, e.g. 192.168.1');
      return;
    }
    document.getElementById('prompt').hidden = true;
    scanSubnet(value);
  });
```

with:

```js
  document.getElementById('scanBtn').addEventListener('click', async () => {
    const value = document.getElementById('subnet').value.trim();
    if (!validPrefix(value)) {
      setStatus('Enter 1-3 octets, e.g. 192.168.1');
      return;
    }
    document.getElementById('prompt').hidden = true;
    if (!(await scanPrefix(value))) missAndPrompt();
  });
```

And in the prompt HTML (line ~66), change:

```html
      <p>Enter the first three octets of your router IP (e.g. 192.168.1).</p>
```

to:

```html
      <p>Enter your router IP prefix (1-3 octets, e.g. 192.168.1, 10, or 172.20).</p>
```

- [ ] **Step 5: Verify inline-script syntax**

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

- [ ] **Step 6: Verify behavior harness for the class logic**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const src = fs.readFileSync('/tmp/find-check.js', 'utf8');
function grab(name) {
  const m = src.match(new RegExp('function ' + name + '[\\s\\S]*?\\n  }'));
  if (!m) throw new Error('function ' + name + ' not found');
  return m[0];
}
function scanRange(a, b) { return a + '~' + b; }
const prefixOf = eval('(' + grab('prefixOf') + ')');
const prefixLenOf = eval('(' + grab('prefixLenOf') + ')');
const validPrefix = eval('(' + grab('validPrefix') + ')');
const scanPrefix = eval('(' + grab('scanPrefix') + ')');
const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };
assert(prefixLenOf('10.3.42.8') === 1, '10.x is /8');
assert(prefixLenOf('172.20.5.3') === 2, '172.20 is /16');
assert(prefixLenOf('172.16.0.1') === 2, '172.16 is /16');
assert(prefixLenOf('172.31.255.1') === 2, '172.31 is /16');
assert(prefixLenOf('172.15.0.1') === 3, '172.15 is not private');
assert(prefixLenOf('192.168.1.42') === 3, '192.168 is /24');
assert(prefixOf('10.3.42.8') === '10.3.42', 'prefixOf defaults to 3 octets');
assert(prefixOf('172.20.5.3', 2) === '172.20', 'prefixOf len 2');
assert(validPrefix('10'), '1-octet valid');
assert(validPrefix('172.20'), '2-octet valid');
assert(validPrefix('192.168.1'), '3-octet valid');
assert(!validPrefix('192.168.1.5'), '4 octets invalid');
assert(!validPrefix('256.1'), 'octet >255 invalid');
assert(!validPrefix('abc'), 'non-numeric invalid');
assert(scanPrefix('192.168.1') === '192.168.1.2~192.168.1.254', '/24 range');
assert(scanPrefix('172.20') === '172.20.0.2~172.20.255.254', '/16 range');
assert(scanPrefix('10') === '10.0.0.2~10.255.255.254', '/8 range');
console.log('all behavior checks passed');
NODE
```

Expected: prints `all behavior checks passed`.

- [ ] **Step 7: Verify served page returns 200**

Run:

```bash
cd /Users/dima/Desktop/ESPTiny-Plant/Web && python3 -m http.server 8128 >/dev/null 2>&1 & SERVER=$!; sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8128/find.html; kill $SERVER
```

Expected: `200`.

- [ ] **Step 8: Verify preserved invariants and absence of old helpers**

Run:

```bash
grep -n "prefixLenOf" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "scanSubnet" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "missAndPrompt" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "PROBE_TIMEOUT_MS" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "Found IP" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "No device found on that subnet" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "192.168.8.8" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
```

Expected: `prefixLenOf` defined and used 3+ times; `missAndPrompt` defined and used 3+ times; `PROBE_TIMEOUT_MS`, `Found IP`, `No device found on that subnet.`, `192.168.8.8` all present; `scanSubnet` has NO matches (old helper fully removed).

- [ ] **Step 9: Commit**

```bash
git add Web/find.html
git commit -m "feat(web): class-aware subnet scanning in find scan"
```

Stage ONLY `Web/find.html`; do not stage `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, or `littlefs-flash-win.ps1`.
