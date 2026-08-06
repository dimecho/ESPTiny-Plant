# Default-IP Probe in find.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On page load, probe the default IP `192.168.8.8` before subnet detection, so a device that lost its saved settings (booted back at factory IP) is still found.

**Architecture:** After the existing 15s reboot wait, probe `http://192.168.8.8/update` by reusing `probeIP()` (its found-logic already saves `lastSubnet`, displays `Found IP`, and redirects). `probeIP()` gains an optional `signal` parameter; a 3s `AbortController` bounds the probe, and on abort/failure the handler falls through to the existing WebRTC → saved-subnet → prompt → scan flow.

**Tech Stack:** Plain ES6 browser JS (no build step, no external assets).

## Global Constraints

- Only file modified: `Web/find.html` (inline `<script>` only — no HTML/CSS changes).
- No changes to `classic/` pages or any other `Web/` file.
- The scan loop's `probeIP()` calls must remain unchanged (they pass no `signal`); `fetch('/reboot')`, the 15s wait, the found flow (`Found IP: ...` + redirect), and the failure message must stay intact.
- Never stage unrelated dirty files: `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, `littlefs-flash-win.ps1`.
- Design doc: `docs/superpowers/specs/2026-08-05-find-default-probe-design.md`.

---

### Task 1: Add the default-IP probe

**Files:**
- Modify: `Web/find.html` — `probeIP()` (~line 95) and the load handler `setTimeout(async () => { ... }, 15000)` (~line 163)

**Interfaces:**
- Consumes: existing `ipToInt(ip)` → integer, `probeIP(ipInt)`, `foundGlobal`, `setStatus(text)`, `getLocalIP(ms)`, `scanSubnet(prefix)`, `validPrefix(prefix)`, `prefixOf(ip)`, `localStorage.getItem('lastSubnet')`.
- Produces: `probeIP(ipInt, signal)` — the optional second argument is passed to `fetch(..., { method: 'GET', signal })`; behavior is unchanged when `signal` is omitted. The load handler now probes the default IP first.

- [ ] **Step 1: Add the optional `signal` parameter to `probeIP()`**

In `Web/find.html`, change the `probeIP()` signature and its `fetch` call (currently ~lines 95-97) from:

```js
  function probeIP(ipInt) {
    const currentIP = intToIp(ipInt);
    return fetch('http://' + currentIP + '/update', { method: 'GET' })
```

to:

```js
  function probeIP(ipInt, signal) {
    const currentIP = intToIp(ipInt);
    return fetch('http://' + currentIP + '/update', { method: 'GET', signal })
```

Everything else in `probeIP()` (the `.then` found-branch and the `.catch(() => {})`) stays byte-for-byte identical.

- [ ] **Step 2: Probe the default IP in the load handler**

In `Web/find.html`, replace the load handler body (currently ~lines 163-171):

```js
  setTimeout(async () => {
    setStatus('Looking for the plant ...');
    const ip = await getLocalIP(2000);
    if (ip) { scanSubnet(prefixOf(ip)); return; }
    const saved = localStorage.getItem('lastSubnet');
    if (saved && validPrefix(saved)) { scanSubnet(saved); return; }
    setStatus('Enter your router IP');
    document.getElementById('prompt').hidden = false;
  }, 15000);
```

with:

```js
  setTimeout(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    setStatus('Trying default IP 192.168.8.8 ...');
    await probeIP(ipToInt('192.168.8.8'), controller.signal);
    clearTimeout(timer);
    if (foundGlobal) return;
    setStatus('Looking for the plant ...');
    const ip = await getLocalIP(2000);
    if (ip) { scanSubnet(prefixOf(ip)); return; }
    const saved = localStorage.getItem('lastSubnet');
    if (saved && validPrefix(saved)) { scanSubnet(saved); return; }
    setStatus('Enter your router IP');
    document.getElementById('prompt').hidden = false;
  }, 15000);
```

(Keeps the 15s delay; adds the bounded default-IP probe in front of the existing detection.)

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
cd /Users/dima/Desktop/ESPTiny-Plant/Web && python3 -m http.server 8127 >/dev/null 2>&1 & SERVER=$!; sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8127/find.html; kill $SERVER
```

Expected: `200`.

- [ ] **Step 5: Verify the probe is present and scan calls unchanged**

Run:

```bash
grep -n "192.168.8.8" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
grep -n "probeIP(" /Users/dima/Desktop/ESPTiny-Plant/Web/find.html
```

Expected: the first grep shows the two lines referencing `192.168.8.8` (the status text and the probe call); the second shows `probeIP(ipInt, signal)` at the definition and `probeIP(currentIPInt)` (no second arg) inside `batch.map(...)`.

- [ ] **Step 6: Commit**

```bash
git add Web/find.html
git commit -m "feat(web): probe default IP before subnet scan in find.html"
```

Stage ONLY `Web/find.html`; do not stage `.gitignore`, `CNC/case.FCStd`, `ESPTiny-Plant.ino`, `Web/svg/bonsai.svg`, `semver/version.h`, or `littlefs-flash-win.ps1`.
