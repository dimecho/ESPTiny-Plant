# Refactor: move setup.html JS to js/setup.js, consolidate shared code into js/common.js

Date: 2026-08-05

## Goal

1. Move the setup wizard's inline JavaScript out of `Web/setup.html` into a new `Web/js/setup.js`.
2. Consolidate the code duplicated between the setup wizard and `Web/js/index.js` into the shared `Web/js/common.js`, with both `index.html` and `setup.html` loading `common.js`.

Classic pages (`Web/classic/**`) are out of scope and must not change behavior.

## Current state

- `setup.html` (lines 353-639) has the entire wizard script inline. It defines its own constants (DEEP_SLEEP, WIFI_MODE, WIFI_SSID, WIFI_PASSWORD, WIFI_HIDE, EMAIL_ALERT..DEMO_PASSWORD, FIRST_SETUP), a `nvramGet` helper, step/tile/scan/form logic, and its own theme/font/preloader code. The `<head>` also defines `applySvgTheme` + a savedTheme/savedFont bootstrap (lines 7-21).
- `index.html` loads `js/index.js` but NOT `common.js`. `index.js` duplicates: the full nvram constants block (lines 169-204), `saveAlertField` (identical to setup's `nvramGet`), the alerts bitmask+save logic (`saveAlertsSettings`, lines 1028-1043), the theme/font toggle handlers (lines 1233-1260), `resetFlash` (line 648, identical to common.js), inline SVG menu-hiding in two places, and preloader handling.
- `common.js` is loaded only by the legacy `classic/` pages. It already holds the nvram constants (1-31), `notify`, `saveSetting`, `PlantLogin`, `hideModal`, `hideAllModals`, `RequireInput`, `resetFlash`, `progressTimer`, `DEMOLOCK`, `ESP32`, `redirectURL`.

## Target layout

| File | Change |
|---|---|
| `Web/js/setup.js` | NEW: wizard logic moved out of `setup.html` |
| `Web/js/common.js` | ADD shared helpers below; existing classic code untouched |
| `Web/js/index.js` | REMOVE duplicated blocks; keep page logic |
| `Web/setup.html` | Delete inline `<script>` block; load `js/common.js` + `js/setup.js` (defer, in that order) |
| `Web/index.html` | Add `<script defer src="js/common.js">` before `js/index.js`; trim head bootstrap |

## common.js additions (shared by setup.js and index.js)

All additions are inert on classic/ pages (they are only invoked by setup.js/index.js).

- `nvramGet(offset, value)` — `GET nvram.json?offset=X&value=encodeURIComponent(value)`. Absorbs setup's `nvramGet` and index's `saveAlertField`.
- `buildAlertBits(checkboxSelector)` — reads `querySelectorAll(selector)`, returns checkbox bitmask string + trailing `'0'`.
- `saveAlertFields(bits, ids)` — writes offsets EMAIL_ALERT, SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD, PLANT_NAME, ALERTS from `document.getElementById(ids.email | .server | .username | .password | .plant)` plus the given `bits`.
- `applySvgTheme()` — moves out of the HTML `<head>` inline scripts.
- `initThemeFont()` — binds `themeToggle` and `fontToggle` click handlers (reads global `savedTheme`/`savedFont` set by the head bootstrap; calls `applySvgTheme()` on theme toggle).
- `finishPreloader(ms)` — after `ms`, adds class `done` to `#preloader-overlay`.
- `hideSvgMenu(doc)` — hides `#menu` (falling back to `[inkscape:label="menu"]`) inside a parsed SVG document.

## index.js changes

- Delete the constants block (lines 169-204) — now supplied by common.js (loaded first).
- Delete `saveAlertField` (lines 1022-1026); replace call sites with `nvramGet`.
- Rewrite `saveAlertsSettings` (lines 1028-1043) to use `buildAlertBits('#tab-alerts .tab-checkbox')` + `saveAlertFields(bits, {email:'AlertEmail', server:'AlertSMTPServer', username:'AlertSMTPUsername', password:'AlertSMTPPassword', plant:'AlertPlantName'})`, still writing the bits into `#Alerts`.
- Delete the duplicate `resetFlash` (line 648) — identical to common.js's.
- Delete theme/font toggle block (lines 1233-1260); call `initThemeFont()` instead.
- Replace the two inline SVG menu-hiding copies (layout modal thumbnails, loadLayoutList) with `hideSvgMenu(doc)`.
- Replace the svgObject-load preloader with `finishPreloader(remaining)`.
- KEEP the `notify`, `progressTimer`, and `PlantLogin` redefinitions. Their APIs differ from the classic `common.js` versions and classic pages depend on the classic versions; loading order (common.js then index.js) lets the index.js definitions win, preserving current behavior.

## setup.js content (new)

Move from the setup.html inline script, adapted to use common.js helpers:

- Preloader: `window load` -> `finishPreloader(500)`.
- `svgObject` load -> `hideSvgMenu(svgObject.contentDocument)`.
- `initThemeFont()` call.
- Constants: REMOVED (use common.js's).
- `showStep`, `bindTile`, tile bindings (Battery/Plug/Internet/Local), state vars (`selectedScanItem`, `setupNetwork`, `setupSsid`, `setupWifiPass`).
- Scan: `parseScanResponse`, `renderScan`, `openScanPassword`, `scanWifi`, `showScanWarning`.
- WiFi form submit (SSID required, password match, writes WIFI_SSID/WIFI_PASSWORD/WIFI_HIDE, goes to plant-password).
- Plant password form submit (mismatch check, writes DEMO_PASSWORD if set + FIRST_SETUP=0, reboot only for Local path, 6s->find.html for Internet, immediate index.html for `Plant`+no-pass, 12s reconnect otherwise).
- Alerts save button (SMTP confirm mismatch check; `buildAlertBits('#setupAlertsGrid .tab-checkbox')`; `saveAlertFields(bits, {email:'setupAlertEmail', server:'setupAlertSMTPServer', username:'setupAlertSMTPUsername', password:'setupAlertSMTPPassword', plant:'setupAlertPlantName'})`; writes bits to `#setupAlerts`; `showStep('step-plant-password')`).

## setup.html changes

- `<head>`: trim bootstrap to 4 lines (savedTheme/data-theme, savedFont/data-font). `applySvgTheme` now lives in common.js.
- `<body>`: delete the inline script block (lines 353-639); add:

```html
<script defer src="js/common.js"></script>
<script defer src="js/setup.js"></script>
```

## index.html changes

- `<head>`: trim bootstrap to 4 lines (same as setup.html).
- `<body>`: add `<script defer src="js/common.js"></script>` immediately before `<script defer src="js/index.js"></script>`.

## Script order guarantee

`defer` scripts execute in document order. common.js must appear before setup.js/index.js in each page. Page scripts may still redeclare globals (e.g. `notify`) after common.js; the last definition wins, preserving today's behavior.

## Verification

1. Node DOM-stub suite: load `js/common.js` + `js/setup.js` (seed head-bootstrap globals `savedTheme`/`savedFont`) and re-run ALL existing wizard assertions: tile writes (offset 21), Internet->scan, scan list/warning, Connect offsets 6/8, Hidden SSID offset 2, wifi form SSID-required + mismatch + offsets 6/8/2, alerts bits + offsets 22-27, plant-password mismatch, FIRST_SETUP=0, reboot placement (none for Internet, yes for Local), redirects (6s find.html, immediate index.html for Plant+no-pass, 12s index.html otherwise).
2. Node-load `js/common.js` + `js/index.js` in the stub env to confirm no ReferenceError (constants resolve) and that `initThemeFont`, `nvramGet`, `buildAlertBits`, `saveAlertFields`, `hideSvgMenu` are used without error.
3. `python3 -m http.server` + curl 200 for: index.html, setup.html, find.html, classic/index.html, js/common.js, js/setup.js, js/index.js.
4. Grep confirmations: no `saveAlertField` remaining in index.js; setup.html contains no inline wizard script block; both HTML files load common.js.
5. Only stage the refactor files; leave unrelated dirty files (case.FCStd, bonsai.svg, version.h, .gitignore) untouched.

## Out of scope

- Changing classic/ pages or their behavior.
- Changing the shared `notify`/`progressTimer`/`PlantLogin` APIs.
- Any wizard feature/behavior change.
