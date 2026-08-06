# find.html Smart Subnet Detection + Layout Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace find.html's hardcoded multi-subnet brute-force scan with smart subnet detection (WebRTC auto-detect → remembered subnet → user prompt) and give the page a small, self-contained modern layout.

**Architecture:** A single static `Web/find.html` rewritten with inline `<style>` + `<script>`. The existing reboot flow (`fetch('/reboot')`, 15 s wait) and probe (`GET /update`, `response.ok`) are preserved. Detection order: `getLocalIP(2000)` → `localStorage['lastSubnet']` → prompt UI. On success, store the found prefix in `localStorage['lastSubnet']` and redirect.

**Tech Stack:** Vanilla HTML/CSS/JS, no external assets, no build step.

## Global Constraints

- Only `Web/find.html` changes. No new files, no external CSS/JS, no build step.
- Preserve: `fetch('/reboot')`, the 15 s `setTimeout`, `ipToInt`/`intToIp`, and the probe (`GET /update`, check `response.ok`).
- Detection order is fixed: WebRTC auto-detect → remembered subnet → user prompt.
- `localStorage['lastSubnet']` stores only the first three octets, validated by `/^\d{1,3}\.\d{1,3}\.\d{1,3}$/`.
- Do not touch `classic/` pages or any other `Web/` page.
- Spec: `docs/superpowers/specs/2026-08-05-find-subnet-detect-design.md`.

---

### Task 1: Rewrite Web/find.html

**Files:**
- Rewrite: `Web/find.html` (entire file)

**Interfaces:**
- Consumes: nothing (standalone page).
- Produces: the complete new page. No other task depends on it.

- [ ] **Step 1: Write the complete new `Web/find.html`**

Replace the entire file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Find Plant</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #16181d;
    color: #e8e6e3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 360px;
    margin: 16px;
    padding: 24px;
    background: #1e2126;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,.35);
  }
  .card h1 { margin: 0 0 12px; font-size: 20px; }
  .card p { margin: 8px 0; font-size: 14px; color: #a8a6a2; }
  .status { font-weight: 600; color: #d4b84c; }
  .found { color: #62a29a; font-weight: 600; }
  .card input {
    width: 100%;
    padding: 10px 12px;
    margin: 8px 0 12px;
    border: 1px solid #3a3f47;
    border-radius: 8px;
    background: #16181d;
    color: #e8e6e3;
    font-size: 15px;
  }
  .card button {
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 8px;
    background: #4a8257;
    color: #fff;
    font-size: 15px;
    cursor: pointer;
  }
  .card button:hover { background: #3f714a; }
  @media (prefers-color-scheme: light) {
    body { background: #f2f2f4; color: #222; }
    .card { background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); }
    .card p { color: #555; }
    .card input { border-color: #ccc; background: #fff; color: #222; }
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Find Plant</h1>
    <p class="status" id="status">Rebooting ...</p>
    <div id="prompt" hidden>
      <p>Enter the first three octets of your router IP (e.g. 192.168.1).</p>
      <input id="subnet" type="text" inputmode="decimal" value="192.168.1">
      <button id="scanBtn" type="button">Scan</button>
    </div>
    <p class="found" id="found" hidden></p>
  </div>
  <script>
  let foundGlobal = false;

  function ipToInt(ip) {
    return ip.split('.').reduce((int, octet) => (int << 8) + parseInt(octet), 0);
  }
  function intToIp(int) {
    return [(int >> 24) & 255, (int >> 16) & 255, (int >> 8) & 255, int & 255].join('.');
  }
  function isPrivate(ip) {
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  }
  function prefixOf(ip) {
    return ip.split('.').slice(0, 3).join('.');
  }
  function setStatus(text) {
    document.getElementById('status').textContent = text;
  }
  async function scanRange(startIP, endIP) {
    const startIPInt = ipToInt(startIP);
    const endIPInt = ipToInt(endIP);
    for (let currentIPInt = startIPInt; currentIPInt <= endIPInt; currentIPInt++) {
      if (foundGlobal) break;
      const currentIP = intToIp(currentIPInt);
      try {
        const response = await fetch('http://' + currentIP + '/update', { method: 'GET' });
        if (response.ok) {
          foundGlobal = true;
          localStorage.setItem('lastSubnet', prefixOf(currentIP));
          const foundEl = document.getElementById('found');
          foundEl.textContent = 'Found IP: ' + currentIP;
          foundEl.hidden = false;
          document.getElementById('prompt').hidden = true;
          window.location.href = 'http://' + currentIP;
          return;
        }
      } catch (e) {}
    }
    if (!foundGlobal) {
      setStatus('No device found on that subnet.');
      document.getElementById('prompt').hidden = false;
    }
  }
  function scanSubnet(prefix) {
    setStatus('Scanning ' + prefix + '.0/24 ...');
    scanRange(prefix + '.2', prefix + '.254');
  }
  function getLocalIP(timeoutMs) {
    return new Promise((resolve) => {
      let pc;
      try {
        pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then((o) => pc.setLocalDescription(o));
        pc.onicecandidate = (e) => {
          if (!e.candidate) { if (pc) pc.close(); resolve(null); return; }
          const m = /(\d{1,3}\.){3}\d{1,3}/.exec(e.candidate.candidate);
          if (m && isPrivate(m[0])) { if (pc) pc.close(); resolve(m[0]); }
        };
      } catch (err) {
        if (pc) pc.close();
        resolve(null);
        return;
      }
      setTimeout(() => { if (pc) pc.close(); resolve(null); }, timeoutMs);
    });
  }

  fetch('/reboot');

  setTimeout(async () => {
    setStatus('Looking for the plant ...');
    const ip = await getLocalIP(2000);
    if (ip) { scanSubnet(prefixOf(ip)); return; }
    const saved = localStorage.getItem('lastSubnet');
    if (saved && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(saved)) { scanSubnet(saved); return; }
    setStatus('Enter your router IP');
    document.getElementById('prompt').hidden = false;
  }, 15000);

  document.getElementById('scanBtn').addEventListener('click', () => {
    const value = document.getElementById('subnet').value.trim();
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
      setStatus('Enter three octets, e.g. 192.168.1');
      return;
    }
    document.getElementById('prompt').hidden = true;
    scanSubnet(value);
  });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify the inline script is syntactically valid**

Run:

```bash
python3 - <<'PY'
import re
html = open('Web/find.html').read()
m = re.search(r'<script>(.*?)</script>', html, re.S)
assert m, 'script block not found'
open('/tmp/find-check.js', 'w').write(m.group(1))
PY
node --check /tmp/find-check.js
```

Expected: exits 0 with no output (syntax OK).

- [ ] **Step 3: Verify the page serves**

Run:

```bash
cd Web && python3 -m http.server 8124 >/dev/null 2>&1 & SERVER=$!
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8124/find.html
kill $SERVER
```

Expected: `200`.

- [ ] **Step 4: Confirm the old hardcoded ranges are gone**

Run: `grep -n "scanRange('" Web/find.html`
Expected: no output (no hardcoded `scanRange('...')` literals remain).

- [ ] **Step 5: Commit**

```bash
git add Web/find.html
git commit -m "feat(web): smart subnet detection and modern layout in find.html"
```

---

### Task 2: Manual device verification

**Files:** none.

**Interfaces:**
- Consumes: the page produced in Task 1.

- [ ] **Step 1: Verify reboot flow on device**

Flash/build the LittleFS with the new find.html, then in the wizard switch the plant to DHCP (Internet path). Confirm the page loads, shows "Rebooting ...", reboots the device, and waits ~15 s.

- [ ] **Step 2: Verify prompt path (Chrome/Android)**

On a browser where WebRTC is mDNS-obfuscated: after the 15 s wait, confirm the prompt appears with `192.168.1` pre-filled. Enter the correct 3-octet prefix, press Scan, confirm the /24 is scanned, the device is found, `localStorage['lastSubnet']` is set, and the page redirects to the device's new IP.

- [ ] **Step 3: Verify remembered-subnet path**

Repeat the flow on the same origin/IP. Confirm the scan starts immediately from the remembered subnet without prompting.

- [ ] **Step 4: Verify auto-detect path (Safari)**

On Safari/iOS, confirm detection happens without the prompt when a private host candidate is exposed.

- [ ] **Step 5: Verify failure path**

Enter a wrong prefix (no plant on it) and confirm the page shows "No device found on that subnet." and re-shows the prompt.
