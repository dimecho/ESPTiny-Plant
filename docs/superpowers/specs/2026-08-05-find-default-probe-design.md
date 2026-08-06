# Design — default-IP probe in find.html

Date: 2026-08-05

## Goal

When `Web/find.html` loads (after the device reboot wait), first probe the default IP `192.168.8.8` in case the device's saved settings did not persist (e.g. it booted back at its factory IP). If not found there, fall through to the existing subnet detection flow.

## Behavior

- The load handler (currently Web/find.html:163-171) keeps `fetch('/reboot')` and the 15s wait unchanged.
- After the 15s wait, before WebRTC detection:
  1. Set status: `Trying default IP 192.168.8.8 ...`
  2. Probe `http://192.168.8.8/update` (GET) reusing the existing `probeIP()` found-logic: on `response.ok` it sets `foundGlobal`, stores `lastSubnet` = `192.168.8`, shows `Found IP: 192.168.8.8`, hides the prompt, and redirects to `http://192.168.8.8`.
  3. The probe is bounded by a 3s `AbortController` timeout. `probeIP()` gains an optional `signal` parameter passed to `fetch`; the scan loop's calls pass no signal and are unchanged. The abort is swallowed by `probeIP`'s existing `.catch`.
  4. If `foundGlobal` is set after the probe, the handler returns (redirect is already in flight).
  5. Otherwise the existing flow proceeds unchanged: WebRTC detect → saved subnet → prompt → scan.

## Timing

- Device at default IP: found in ~0.1s.
- Device at custom IP: worst-case ~3s added before normal detection starts.

## Scope

- Single file: `Web/find.html` (inline `<script>` only).
- `probeIP` signature changes to `probeIP(ipInt, signal)` — no caller behavior changes.
- No changes to `classic/` pages, layout/CSS, or the scan loop.
