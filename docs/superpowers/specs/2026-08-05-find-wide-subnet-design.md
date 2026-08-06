# Design — class-aware subnet scanning in find.html

Date: 2026-08-05

## Problem

The find scan hardcodes a /24: `scanSubnet(prefix)` always probes `prefix + '.2' .. prefix + '.254'`, `validPrefix()` requires exactly three octets, and auto-detection scans only the detected IP's /24. On networks where the plant lives outside that /24 — e.g. a `10.x.x.x` (/8) or `172.16.x`–`172.31.x` (/16) network — the scan can never reach the device. `scanRange(startIP, endIP)` already works on arbitrary ranges; only the call sites assume /24.

## Solution

Derive the scan prefix from the IPv4 private class:

| Detected/saved IP | Prefix length | Scanned range |
|---|---|---|
| `192.168.x.x` | 3 (`192.168.x`) | `192.168.x.2` – `192.168.x.254` (unchanged) |
| `172.16.x`–`172.31.x` | 2 (`172.16`…`172.31`) | `prefix.0.2` – `prefix.255.254` (the /16) |
| `10.x.x.x` | 1 (`10`) | `10.0.0.2` – `10.255.255.254` (the /8) |
| anything else | 3 | the /24 (fallback) |

Concretely:

- Add `prefixLenOf(ip)`: returns 1 for `10.`, 2 for `172.(1[6-9]|2\d|3[01]).`, else 3.
- Generalize `prefixOf(ip, len)` (default 3) and `validPrefix(prefix)` to accept 1–3 octets (each 0–255).
- Replace `scanSubnet(prefix)` with `scanPrefix(prefix)`, which builds the range from the prefix length:
  - 1 octet → `prefix.0.0.2` .. `prefix.255.255.254`
  - 2 octets → `prefix.0.2` .. `prefix.255.254`
  - 3 octets → `prefix.2` .. `prefix.254`
- Refactor `scanRange()` to return a boolean (`foundGlobal`) and stop doing the "No device found …" message + prompt-showing itself. New `missAndPrompt()` helper (status text + unhide `#prompt`) is called by the three call sites after a miss.
- Auto-detect: scan the detected IP's own /24 first; if that misses and `prefixLenOf(ip) < 3`, continue with the class range (`prefixOf(ip, prefixLenOf(ip))`). `foundGlobal` early-exit is unchanged.
- `lastSubnet` stays the found device's /24 (3 octets) — unchanged from today — so a repeat visit rescans a fast 253-host range. Class prefixes apply to auto-detect expansion and the prompt, not to the saved subnet.
- Two small text tweaks (only text, no layout/CSS): the prompt hint ("Enter the first three octets…" → 1–3 octet phrasing) and the button's invalid-input message ("Enter three octets…" → "Enter 1-3 octets…").

## Timing

- /24: unchanged — ~22 s worst-case miss, <100 ms on hit.
- /16 (`172.16`–`172.31`): ~91 min worst-case full sweep, aborts instantly on a hit.
- /8 (`10.x`): hours-days worst-case full sweep, aborts instantly on a hit.
- Same-/24 hit stays <100 ms in every class via the fast path.

## Scope

- Single file: `Web/find.html` — inline `<script>` (logic) plus the two text tweaks above.
- Unchanged: `probeIP` found flow + per-probe timeout, default-IP probe (`192.168.8.8`, 3 s signal), `CONCURRENCY = 12`, `PROBE_TIMEOUT_MS = 1000`, `isScanning` guard.
- No changes to `classic/`, layout/CSS, or any other `Web/` file.
