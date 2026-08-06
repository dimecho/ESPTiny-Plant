# Design — live scan progress in find.html

Date: 2026-08-05

## Goal

While `Web/find.html` scans a /24 subnet, the status line should show the host octet currently being probed, instead of the static `Scanning <prefix>.0/24 ...`.

## Behavior

- The scan probes hosts in batches of 12 concurrent requests (existing `CONCURRENCY = 12` loop in `scanRange()`).
- Right before each batch is dispatched, set the status to the highest octet in that batch:
  `Scanning <ip> ...` (full IP, no `/24` suffix).
- Displayed sequence example for `192.168.1.0/24`:
  `Scanning 192.168.1.2 ...` → `192.168.1.14` → `192.168.1.26` → ... advancing by 12 per batch.
- `scanSubnet()` no longer sets the initial static status; `scanRange()` drives all scan-progress status text (it already runs behind the `isScanning` guard).
- Found flow and failure messages (`Found IP: ...`, `No device found on that subnet.`) are unchanged.

## Scope

- Single file: `Web/find.html` (inline `<script>` only).
- No changes to `classic/` pages, layout/CSS, or any other `Web/` file.
