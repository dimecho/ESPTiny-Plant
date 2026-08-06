# Smart subnet detection in find.html

Date: 2026-08-05

## Goal

Replace the hardcoded multi-subnet brute-force scan in `Web/find.html` with smart subnet detection:

1. Auto-detect the browser's own LAN subnet via WebRTC when the browser exposes it.
2. Fall back to a remembered subnet (localStorage).
3. Fall back to a small user prompt asking for the first three octets of the router IP.
4. Scan only the derived `/24` subnet.

## Background / problem

`find.html` is served by the device when the wizard switches the plant to DHCP mode (firmware `ESPTiny-Plant.ino:1368`, `6;url=find.html`). The page:

- `fetch('/reboot')` then `document.write('Rebooting ... ')`.
- After a 15 s `setTimeout`, scans hardcoded ranges hitting `GET /update` on every host until one returns `response.ok` (`scanRange('192.168.8.8','192.168.8.8')`, `10.0.0.2-254`, `192.168.0.2-254`, `192.168.1.2-254`, `192.168.50.2-192.168.1.254` — note the last range is malformed).
- On success: `document.write('Found IP: ...')` and redirect to the found IP.

Key insight: by scan time the browser has reconnected to the router (the device AP vanished), so **the browser's LAN subnet equals the device's new DHCP subnet**. The only missing piece is discovering the browser's own IP — and browsers have no standard API for it. WebRTC `RTCPeerConnection` host candidates expose it on some browsers but are mDNS-obfuscated on others.

## Decisions (confirmed with user)

1. **Hybrid**: try WebRTC auto-detect first; if it fails, prompt the user. (No STUN servers are used, so no public-IP leak.)
2. **Remove** the hardcoded subnet list entirely (including the malformed range).
3. **Remember** the last successful subnet in `localStorage['lastSubnet']` so repeat finds skip the prompt when DHCP reissues the same IP.

## Changes

Only `Web/find.html` changes (script + inline style; no new files).

### New helper: `getLocalIP(timeoutMs)`

```js
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
```

- Returns a private LAN IP (e.g. `192.168.1.50`) where host candidates are not obfuscated (Safari/macOS/iOS); returns `null` where they are (Chrome/Firefox/Android, mDNS `*.local`).
- `isPrivate(ip)`: true for `10.x`, `172.16-31.x`, `192.168.x` (matches `/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/`).
- Times out and resolves `null` if no private candidate appears within `timeoutMs`.
- `prefixOf(ip)`: the first three octets, e.g. `192.168.1.50` → `192.168.1`.

### New helper: `scanSubnet(prefix)`

```js
function scanSubnet(prefix) {
  scanRange(prefix + '.2', prefix + '.254');
}
```

`scanRange`, `ipToInt`, `intToIp` stay unchanged. The probe (`GET /update`, check `response.ok`) stays unchanged. All code follows find.html's existing modern style (`let`/`const`/`async`).

### Detection order (inside the existing 15 s `setTimeout`)

1. `getLocalIP(2000)` → on success, `scanSubnet(prefixOf(ip))`.
2. Else `localStorage['lastSubnet']` → `scanSubnet(prefix)`.
3. Else render the prompt UI → on submit, `scanSubnet(prefix)`.

On success (`response.ok`): store `localStorage['lastSubnet'] = <prefix of found IP>` before redirecting.

### Prompt UI

- The page currently writes `Rebooting ... ` via `document.write` during parse. After the wait, render the prompt with DOM APIs (creating elements and appending to `document.body`), since `document.write` after load would wipe the document.
- Minimal UI: label "Router IP (first 3 octets)", an `<input>` pre-filled with `192.168.1`, and a "Scan" button. The input is sanitized/validated to `/^\d{1,3}\.\d{1,3}\.\d{1,3}$/` before scanning.
- Reuse `foundGlobal` guard: once a host responds, stop scanning (existing behavior), show "Found IP: ...", store the subnet, and redirect.

### Layout modernization (standalone inline CSS)

- Add a small `<style>` block to `find.html`. No external assets (no bonsai.css, no SVG).
- Dark background, a single centered card containing: a status line ("Rebooting ...", then detection/progress/error messages), the prompt (label + input + button when needed), and the found-IP line.
- Simple readability styling: system font stack, comfortable padding, rounded input/button, accent color consistent with the app's palette. A `prefers-color-scheme: light` override keeps text readable on light backgrounds if desired — keep to a few rules.
- Responsive: card max-width so it fits phone screens.
- The page stays a single static HTML file with inline JS + CSS; no build step.

## Error handling / edge cases

- WebRTC unavailable or blocked (`RTCPeerConnection` throws) → resolves `null` → falls through to prompt.
- No candidate at all (e.g. candidate gathering never fires) → timeout resolves `null`.
- Invalid user input → button does nothing / re-highlights; validated against the 3-octet regex.
- All hosts in the /24 respond negatively → no redirect; page stays on the prompt (user can correct the prefix and rescan).

## Verification

1. Serve `Web/` with `python3 -m http.server`; `curl` `find.html` → 200.
2. Node syntax check: extract the `<script>` block and `node --check` it.
3. Manual (device): run through wizard → DHCP flow → confirm page reboots, waits 15 s, and either auto-scans (Safari) or shows the prompt (Chrome/Android); confirm a correct prefix finds the device and redirects; confirm `localStorage['lastSubnet']` is set and a repeat run skips the prompt.

## Out of scope

- Changing the `/update` probe or the redirect target.
- Changing the reboot wait or the wizard/firmware flow.
- Any change to `classic/` pages or other `Web/` pages (including not reusing bonsai.css).
- Adding external CSS/JS libraries or a build step.
