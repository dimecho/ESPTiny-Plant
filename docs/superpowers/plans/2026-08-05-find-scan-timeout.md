# Per-Probe Scan Timeout in find.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound each scan probe in `Web/find.html` with a 1000 ms abort timeout so a full miss-scan of a /24 completes in ~22s instead of hanging on OS-level TCP connects for minutes.

**Architecture:** `probeIP()` already accepts an optional `signal`. When no signal is passed (the scan's `batch.map(probeIP)` calls), it creates an internal `AbortController` that aborts after `PROBE_TIMEOUT_MS` and passes `controller.signal` to `fetch`; the existing `.catch(() => {})` swallows the abort. When a signal IS passed (the default-IP probe's 3s signal), it is used as-is. An internal timer is cleared via `.finally`.

**Tech Stack:** Plain ES6 browser JS (no build step, no external assets).

## Global Constraints

- Only file modified: `Web/find.html` (inline `<script>` only — no HTML/CSS changes).
- No changes to `classic/` pages or any other `Web/` file.
- The default-IP probe keeps its own 3s signal; the found flow (`Found IP: ...` + redirect), the failure message, `CONCURRENCY = 12`, and the scan batch mechanics must remain byte-for-byte unchanged.
- Never stage unrelated dirty files: `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, `littlefs-flash-win.ps1`.
- Design doc: `docs/superpowers/specs/2026-08-05-find-scan-timeout-design.md`.

---

### Task 1: Add the per-probe timeout

**Files:**
- Modify: `Web/find.html` — add `PROBE_TIMEOUT_MS` (~line 74) and update `probeIP()` (~line 95)

**Interfaces:**
- Consumes: existing `probeIP(ipInt, signal)`, `foundGlobal`, `intToIp(ip)`, `prefixOf(ip)`, `localStorage.setItem`, `window.location.href`.
- Produces: top-level `const PROBE_TIMEOUT_MS = 1000;`. `probeIP(ipInt, signal)` still accepts an optional `signal`; when omitted, an internal 1000 ms abort timeout is applied. Signature and return contract unchanged for all callers.

- [ ] **Step 1: Add the timeout constant**

In `Web/find.html`, change the globals block (currently ~lines 73-74):

```js
  let foundGlobal = false;
  let isScanning = false;
```

to:

```js
  let foundGlobal = false;
  let isScanning = false;
  const PROBE_TIMEOUT_MS = 1000;
```

- [ ] **Step 2: Bound each scan probe in `probeIP()`**

In `Web/find.html`, replace the `probeIP()` function (currently ~lines 95-112):

```js
  function probeIP(ipInt, signal) {
    const currentIP = intToIp(ipInt);
    return fetch('http://' + currentIP + '/update', { method: 'GET', signal })
      .then((response) => {
        if (response.ok && !foundGlobal) {
          foundGlobal = true;
          try {
            localStorage.setItem('lastSubnet', prefixOf(currentIP));
          } catch (e) {}
          const foundEl = document.getElementById('found');
          foundEl.textContent = 'Found IP: ' + currentIP;
          foundEl.hidden = false;
          document.getElementById('prompt').hidden = true;
          window.location.href = 'http://' + currentIP;
        }
      })
      .catch(() => {});
  }
```

with:

```js
  function probeIP(ipInt, signal) {
    const currentIP = intToIp(ipInt);
    const controller = signal ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null;
    return fetch('http://' + currentIP + '/update', { method: 'GET', signal: controller ? controller.signal : signal })
      .then((response) => {
        if (response.ok && !foundGlobal) {
          foundGlobal = true;
          try {
            localStorage.setItem('lastSubnet', prefixOf(currentIP));
          } catch (e) {}
          const foundEl = document.getElementById('found');
          foundEl.textContent = 'Found IP: ' + currentIP;
          foundEl.hidden = false;
          document.getElementById('prompt').hidden = true;
          window.location.href = 'http://' + currentIP;
        }
      })
      .catch(() => {})
      .finally(() => { if (timer) clearTimeout(timer); });
  }
```

(The found branch inside `.then` is unchanged; only the fetch options, the added controller/timer lines, and the `.finally` differ.)

- [ ] **Step 3: Verify inline-script syntax**

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

- [ ] **Step 4: Verify served page returns 200**

Run:

```bash
cd /Users/dima/Desktop/ESPTiny-Plant/Web && python3 -m http.server 8128 >/dev/null 2>&1 & SERVER=$!; sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8128/find.html; kill $SERVER
```

Expected: `200`.

- [ ] **Step 5: Verify the constant and default-IP probe signal are both present**

Run:

```bash
grep -n "PROBE_TIMEOUT_MS" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "controller.signal" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
```

Expected: the first shows the constant definition and its use in the `setTimeout`; the second shows `signal: controller ? controller.signal : signal` in `probeIP` and `controller.signal` at the default-IP probe call (line ~167).

- [ ] **Step 6: Commit**

```bash
git add Web/find.html
git commit -m "feat(web): bound find scan probes with 1s timeout"
```

Stage ONLY `Web/find.html`; do not stage `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, or `littlefs-flash-win.ps1`.
