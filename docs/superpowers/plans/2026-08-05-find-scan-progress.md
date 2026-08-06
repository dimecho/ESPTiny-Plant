# Live Scan Progress in find.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the host octet currently being probed in the status line of `Web/find.html` while the /24 scan runs.

**Architecture:** `scanRange()` already probes hosts in batches of 12 via `probeIP()` + `Promise.all`. Add one `setStatus()` call per batch (showing the batch's highest octet, full IP, no `/24` suffix) and stop `scanSubnet()` from setting a static status. All changes are confined to the inline `<script>` of `Web/find.html`.

**Tech Stack:** Plain ES6 browser JS (no build step, no external assets).

## Global Constraints

- Only file modified: `Web/find.html` (inline `<script>` only — no HTML/CSS changes).
- No changes to `classic/` pages, the card layout, or any other `Web/` file.
- Found flow (`Found IP: ...` + redirect) and failure message (`No device found on that subnet.`) must remain byte-for-byte unchanged.
- Never stage unrelated dirty files: `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, `littlefs-flash-win.ps1`.
- Design doc: `docs/superpowers/specs/2026-08-05-find-scan-progress-design.md`.

---

### Task 1: Add live scan progress status

**Files:**
- Modify: `Web/find.html:113-137` (the `scanRange()` and `scanSubnet()` functions)

**Interfaces:**
- Consumes: existing `intToIp(int)` → `"a.b.c.d"` string; existing `setStatus(text)`; existing `CONCURRENCY = 12` batch loop.
- Produces: scan-progress status text of the form `Scanning <full-ip> ...` (e.g. `Scanning 192.168.1.14 ...`), updated once per batch. `scanSubnet(prefix)` no longer sets any status text itself.

- [ ] **Step 1: Add the per-batch status update in `scanRange()`**

In `Web/find.html`, change the `scanRange()` body (currently lines 113-133) to:

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
```

(Only the `setStatus(...)` line is added; the loop, early-exit, and failure path are untouched.)

- [ ] **Step 2: Remove the static status from `scanSubnet()`**

Change the `scanSubnet()` function (currently lines 134-137) to:

```js
  function scanSubnet(prefix) {
    scanRange(prefix + '.2', prefix + '.254');
  }
```

(Delete the `setStatus('Scanning ' + prefix + '.0/24 ...');` line.)

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
cd /Users/dima/Desktop/ESPTiny-Plant/Web && python3 -m http.server 8126 >/dev/null 2>&1 & SERVER=$!; sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8126/find.html; kill $SERVER
```

Expected: `200`.

- [ ] **Step 5: Verify no static /24 status remains**

Run:

```bash
grep -n "\.0/24" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add Web/find.html
git commit -m "feat(web): show live scan progress in find.html"
```

Stage ONLY `Web/find.html`; do not stage `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, or `littlefs-flash-win.ps1`.
