# Design — Stop button during scanning in find.html

Date: 2026-08-05

## Problem

The find scan can sweep hundreds of thousands of hosts (a /16 or /8 class scan from the class-aware feature) with no way to cancel it. The user must wait for the sweep to finish or find the device. A Stop control is needed during scanning.

## Solution

Show a Stop button whenever a scan is running; clicking it ends the scan within ~1s and re-displays the input prompt.

**HTML/CSS** — the card gains a Stop button below the status text, hidden by default, styled to match the existing card buttons in red:

```html
<p class="status" id="status">Rebooting ...</p>
<button id="stopBtn" type="button" hidden>Stop</button>
```

```css
#stopBtn { background: #a34a4a; margin-top: 8px; }
#stopBtn:hover { background: #8f3f3f; }
```

**JS:**

- New global `let stopRequested = false;` next to `foundGlobal`/`isScanning`.
- `scanRange()` (the one function every scan path — auto-detect, saved subnet, manual Scan button — funnels through):
  - On entry (after the `isScanning` guard): reset `stopRequested = false;` and unhide `#stopBtn`.
  - Loop condition becomes `while (currentIPInt <= endIPInt && !foundGlobal && !stopRequested)`.
  - After the loop: hide `#stopBtn` before returning.
  - Stop takes effect within ~1s: the in-flight batch (≤12 probes, each already bounded by `PROBE_TIMEOUT_MS = 1000`) completes, then the loop exits. No `probeIP` changes.
- Stop handler: `document.getElementById('stopBtn').addEventListener('click', () => { stopRequested = true; });`
- Replace `missAndPrompt()` with `scanEndUI()`, which shows the stop or miss message and re-displays the prompt:

```js
  function scanEndUI() {
    if (stopRequested) setStatus('Scan stopped.');
    else setStatus('No device found on that subnet.');
    document.getElementById('prompt').hidden = false;
  }
```

- Callers updated:
  - Auto-detect: `let found = await scanPrefix(prefixOf(ip)); if (!found && !stopRequested && prefixLenOf(ip) < 3) { found = await scanPrefix(prefixOf(ip, prefixLenOf(ip))); } if (found) return; scanEndUI(); return;` — the `!stopRequested` guard prevents a stop during the fast /24 from launching the /16 or /8 sweep.
  - Saved subnet: `const found = await scanPrefix(saved); if (found) return; scanEndUI(); return;`
  - Manual Scan button: `if (!(await scanPrefix(value))) scanEndUI();`

The default-IP probe and the `getLocalIP` phase are quick (<3s) and show no Stop button; only actual scanning does.

## Timing

- Stop is effective within ~1s (one in-flight batch of ≤12 probes finishes first).
- A found device still redirects immediately regardless of `stopRequested`.

## Scope

- Single file: `Web/find.html` — one HTML element + two CSS rules + JS changes above.
- Unchanged: found flow (`Found IP: ...` + redirect), default-IP probe (`192.168.8.8`, 3s signal), per-probe timeout (`PROBE_TIMEOUT_MS = 1000`), `CONCURRENCY = 12`, `scanPrefix`/`prefixLenOf` class logic, `lastSubnet`.
- No changes to `classic/` or any other `Web/` file.
