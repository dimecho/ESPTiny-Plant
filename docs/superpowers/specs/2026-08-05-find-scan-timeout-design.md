# Design — per-probe scan timeout in find.html

Date: 2026-08-05

## Problem

Individual probes in the `Web/find.html` scan have no timeout. A `fetch` to a dead IP waits on the OS-level TCP connect, which can hang for tens of seconds. Since batches complete only when their slowest in-flight probe settles, a full miss-scan of a /24 (22 batches of 12) can take many minutes.

## Solution

Bound every scan probe with an internal `AbortController` timeout of 1000 ms.

- Add a top-level constant `const PROBE_TIMEOUT_MS = 1000;` next to the existing globals (`foundGlobal`, `isScanning`).
- In `probeIP(ipInt, signal)`:
  - When no `signal` argument is passed (the scan's `batch.map(probeIP)` calls), create an internal `AbortController` and abort it after `PROBE_TIMEOUT_MS`; pass `controller.signal` to `fetch`.
  - When a `signal` IS passed (the default-IP probe passes its own 3s signal), use it as-is — no internal controller.
  - Clear the internal timer when the fetch settles via a chained `.finally(() => { if (timer) clearTimeout(timer); })`.
- The abort is already swallowed by `probeIP`'s existing `.catch(() => {})`, so a timed-out probe simply contributes a non-response.

## Timing

- Worst-case full miss-scan: ~22 batches × 1s ≈ 22s (previously unbounded, minutes).
- A present device is still found in <100 ms (same-subnet HTTP response) and the found flow/redirect is unchanged.

## Scope

- Single file: `Web/find.html` (inline `<script>` only).
- Unchanged: scan batch mechanics, `CONCURRENCY = 12`, the found flow, the failure message, and the default-IP probe (keeps its 3s signal).
- No changes to `classic/` pages, layout/CSS, or any other `Web/` file.
