# Port classic NTP time-sync logic to modern index.html

Date: 2026-08-05

## Goal

Transfer the classic page's NTP clock-sync call into the modern page so the device clock is set to the browser's current time on page load:

```
GET /api?&ntp=1&tz=UTC<offset>&epoch=<unix seconds>
```

## Decisions (confirmed with user)

1. **tz source**: browser auto-detection via `getPOSIXtz()` (`"UTC" + new Date().getTimezoneOffset()/60`), exactly like classic. The `DemoTimezone` dropdown stays purely for persisted `TIMEZONE_OFFSET` display — it is NOT used for the NTP call.
2. **Test Timer button**: left untouched — still sends bare `api?ntp=1`. The auto-sync happens separately, once per page load, mirroring classic.
3. **Firing point**: once, at the end of the modern page's nvram.json `onload` handler, *after* the `FIRST_SETUP` redirect check so it never fires when bouncing to `setup.html`. Mirrors classic `index.js:214` (call inside nvram onload).

## Current state

- Classic `Web/classic/js/index.js`:
  - `updateNTP()` (113-119): `epoch = Math.floor(Date.now()/1000)`, XHR `GET 'api?&ntp=1&tz=' + getPOSIXtz() + '&epoch=' + epoch`; called at line 214 inside the nvram.json fetch onload. No success/error handling.
  - `getPOSIXtz()` (121-125): `var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;` (unused), `var offset = new Date().getTimezoneOffset() / 60; return "UTC" + offset;`.
- Classic mobile `Web/classic/mobile/index.html` (21-25, 163-167): same ntp call and local `getPOSIXtz`.
- Modern `Web/js/index.js`: fetches nvram.json once on load (lines 693-698), no periodic refresh. `testNTP()` (line 911) sends bare `api?ntp=1`. Security tab has `DemoTimezone` dropdown (`Web/index.html:236-243`) persisted to offset 29.

## Changes

| File | Change |
|---|---|
| `Web/js/index.js` | ADD `getPOSIXtz()` and `updateNTP()` just before `testNTP()` (~line 911); call `updateNTP()` at the end of the nvram.json `onload` handler (after the `DEMOLOCK` block, ~line 742) |
| `Web/tests/index.spec.js` | ADD assertions (below) |

### index.js — new functions (faithful port of classic)

```js
function getPOSIXtz() {
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var offset = new Date().getTimezoneOffset() / 60;
  return "UTC" + offset;
}

function updateNTP() {
  var epoch = Math.floor(Date.now() / 1000);
  var x = new XMLHttpRequest();
  x.open('GET', 'api?&ntp=1&tz=' + getPOSIXtz() + '&epoch=' + epoch, true);
  x.send();
}
```

### index.js — firing point

At the end of the existing nvram.json `onload` success block (line 698-744), after the `FIRST_SETUP === ''` redirect check (line 701) and the `DEMOLOCK` block (lines 740-742), add `updateNTP();`. Fires exactly once per page load.

### index.spec.js — new assertions

After the existing `eval(common); eval(index);`:

- `typeof getPOSIXtz === 'function'`
- `typeof updateNTP === 'function'`
- `getPOSIXtz().match(/^UTC-?\d+(\.\d+)?$/)` is truthy (Node reports a real offset, may be fractional)
- Capture `sends.length`, call `updateNTP()`, assert the new `sends[sends.length-1]` matches `/^api\?&ntp=1&tz=UTC-?\d+(\.\d+)?&epoch=\d+$/` and that exactly one URL was added.

No changes to `Web/index.html` (button/select untouched), `common.js`, classic/ or setup pages.

## Edge cases / notes

- `getTimezoneOffset()/60` may be fractional (e.g. `UTC5.5` for UTC+5:30); classic has the same behavior — ported verbatim, not changed.
- `updateNTP()` is fire-and-forget (no onload handler), matching classic — no success/error notification.
- The test stub does not fire the nvram `onload`, so `updateNTP()` is only invoked explicitly in tests — no accidental auto-fire.

## Verification

1. `node Web/tests/index.spec.js` — all assertions pass (existing + new).
2. `python3 -m http.server 8124` from `Web/` — index.html, js/common.js, js/index.js all serve 200.
3. Grep: `getPOSIXtz` and `updateNTP` defined once each in index.js; no changes to `Web/index.html`.

## Out of scope

- Changing `testNTP()` / the Test Timer button behavior.
- Changing the `DemoTimezone` dropdown or `TIMEZONE_OFFSET` handling.
- Any classic/ or setup page changes.
