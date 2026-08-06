# First-Time Setup Page (`setup.html`)

Date: 2026-08-05

## Purpose

Provide a first-time setup screen for the ESPTiny-Plant device. When the device
has no setup configuration yet, the dashboard (`index.html`) redirects to
`setup.html`, which guides the user through a three-step setup wizard.

The wizard steps are intentionally **GET-only** in this version — each screen
fires `nvram.json?offset=…&value=…` GETs (mirroring the dashboard's nvram write
pattern) and advances, but nothing writes the completion flag (`FIRST_SETUP`,
offset 20) and nothing navigates back to the dashboard. The finish flow is a
future plan.

## Requirements

- Create `Web/setup.html` in the same visual style as `Web/index.html`.
- Light/dark theme support matching the dashboard (same CSS variables, same
  `localStorage` key).
- The bonsai SVG diagram (`svg/bonsai.svg`) is loaded as a dimmed, centered
  backdrop behind the tiles, with its `menu` group hidden.
- **Wizard step 1 — power source:** two square, clickable tiles side by side:
  **Battery** and **Plug**. Each shows an inline SVG icon plus the label.
- **Wizard step 2 — connection:** two tiles: **Internet** and **Local**.
- **Wizard step 3 — credentials:** an SSID/password form (Internet path) or a
  live scanned-SSID list (Local path).
- Clicking a tile fires its nvram GET and fades in the next step.
- Add a redirect in `index.js`: when `FIRST_SETUP` (offset 20) is blank in
  `nvram.json`, `index.html` redirects to `setup.html`.

## Implementation Approach

- **B**: `setup.html` reuses the existing `svg/bonsai.css` via `<link>` and adds
  a small setup-specific `<style>` block. No new shared CSS file; no dashboard
  restructuring.

## Design

### Page structure (`Web/setup.html`)

- `<link href="svg/bonsai.css">` — reuses theme variables, body background/font,
  preloader, animation keyframes, and `.tab-label`/`.tab-input`/`.tab-btn`
  form styles.
- Head script sets `data-theme` from `localStorage('theme')` **before** first
  paint (mirrors `index.html`), so there is no theme flash.
- Header contains the theme toggle (☀/☾) styled with the existing
  `.theme-toggle` class and a font-size toggle (`A`) styled with the existing
  `.font-toggle` class, mirroring the dashboard header. No heading.
- The wizard is a sequence of `.setup-step` sections; exactly one has `.active`
  at a time. `.setup-step.active` fades in (`fade-in` keyframe); the first step
  (`#step-power`) additionally reuses the `grow` scale-in. Steps:
  1. `#step-power` — two square `.setup-tile`s (Battery / Plug), side by side
     with a gap, each with an inline SVG icon above the label. Battery click
     fires `GET nvram.json?offset=21&value=10` (deep-sleep 10 min); Plug click
     fires `value=0` (always on). Both then `showStep('step-connect')`.
  2. `#step-connect` — two `.setup-tile`s (Internet / Local), icons: globe /
     wifi. Internet fires `GET nvram.json?offset=1&value=1` (WiFi client,
     WPA2) then `showStep('step-scan')` (scan to join a network); Local fires
     `offset=1&value=0` (access point) then `showStep('step-wifi')` (name the
     device's own network).
  3. `#step-wifi` — a `.setup-form` card with SSID, password, and confirm
     password `.tab-input`s and a submit button. SSID is required (a blank
     SSID shows "SSID cannot be blank" and nothing is written); password is
     optional but if entered must match confirm ("Passwords do not match"). On
     a valid submit it GETs `offset=6` (SSID) and, only if password is
     non-blank, `offset=8` (password), then `showStep('step-alerts')`.
     `#step-scan` — fetches `GET api?wifi=scan` (one AP per line, SSID only).
     The response is validated by `parseScanResponse()`: it must be a 200 with
     a non-blank, non-JSON body whose non-empty lines are each ≤32 chars
     (802.11 max SSID), contain no `<`/`>` HTML markup, and contain no error
     words (`error`, `failed/fail`, `invalid`, `exception`, `not found`).
     Invalid responses and network errors fall back to a temporary
     `MOCK_WIFI_SCAN` list (`Plant-2G`, `Plant-5G`, `NeighborNet`,
     `CoffeeShop`) — remove the fallback when the firmware endpoint lands. On
     load it builds `.setup-scan-item` buttons from the list. Clicking an SSID
     expands a `.setup-scan-expand` row in place (no new step) with a password
     `.tab-input` and a **Connect** button; clicking the same SSID again
     collapses it, and clicking a different one moves the row. **Connect** GETs
     `offset=6` (SSID) and, if a password was entered, `offset=8`, then
     `showStep('step-alerts')`. If a future scan yields no valid list at all, a
     `.setup-scan-warning` card is shown with a **Refresh** button that re-runs
     the scan.
  4. `#step-alerts` — a `.setup-form` card modeled on the dashboard's
     `#tab-alerts` panel (`index.html:196-231`): Recipient Email, SMTP Server,
     SMTP Username, SMTP Password, **Confirm SMTP Password** (no Show/Hide
     toggle in the wizard), Plant Name, and a `Send Email Alerts`
     `.alert-checkbox-grid` of eight checkboxes. **Done** validates the SMTP
     password matches its confirm (a blank password is allowed), builds the
     alert bitmask (8 checkbox bits + trailing `0`, a single combined string
     like `000000000`), and GETs offsets 22–27: email, server, username,
     password, plant name, alerts bits. The OAuth2 access-token row is omitted
     from the wizard.
- Tile press feedback via `.active` (scale ~0.96) on mousedown, released on
  mouseup/mouseleave. Tiles also activate on Enter/Space (`keydown`).
- `nvramGet(offset, value)` is a small helper that opens a GET to
  `nvram.json?offset=…&value=…` (URL-encoded) and sends it; mirrors the
  dashboard's write pattern at `index.js:266`.
- `showStep(id)` toggles `.active` across the `.setup-step` sections.
- Setup-specific `<style>` block only (step/tile/form/scan layout, icon sizing,
  press state).

### Bonsai backdrop

- A `.setup-bg` fixed, full-viewport layer containing
  `<object data="svg/bonsai.svg" type="image/svg+xml" id="svgObject">`
  (mirrors `index.html`), centered via flex.
- Dimmed (`opacity: ~0.4`), `z-index: 0`, `pointer-events: none` so it never
  blocks tile clicks. The tiles and header sit at `z-index: 1`.
- The object preserves the SVG's 1950:2018 aspect ratio (`aspect-ratio`,
  `height: 100vh`, `max-width: 100vw`) so the plant is not distorted.
- On `svgObject` load, the `menu` group is hidden by mirroring the dashboard's
  layout-thumbnail logic (`index.js`): try `getElementById('menu')`, fall back
  to scanning all elements for `inkscape:label === 'menu'`, then
  `style.display = 'none'`. (The group's real id is `g1665`, so the fallback
  does the work.)
- Theme re-apply: the head script gains `applySvgTheme()` (copy of
  `index.html`), and the theme-toggle handler calls it, so the backdrop
  recolors on toggle. The SVG's embedded script only themes itself on load.
- No changes to `bonsai.svg` or `index.js`.

### Redirect wiring (`Web/js/index.js`)

Insert at the top of `nvram.onload` (after `var data = nvram.response['nvram'];`):

```js
if (data[FIRST_SETUP] === '') { location.replace('setup.html'); return; }
```

- `FIRST_SETUP = 20` is already defined in `index.js` (line ~190).
- `return` prevents the dashboard from initializing when redirected.
- `location.replace` prevents the Back button from re-triggering a loop.
- Current `Web/nvram.json` has `""` at index 20, so the redirect triggers.
- Future plan: writing a non-blank value at offset 20 stops the redirect, which
  is where the Home/Office tile logic will hook in.

### Theme persistence

Uses the same `localStorage('theme')` key as the dashboard, so a theme chosen
during setup carries over to `index.html`.

### Font-size toggle

- Mirrors `index.js` exactly: cycles `small → medium → large`, shares the
  `localStorage('fontSize')` key and `data-font` attribute with the dashboard.
- Glyph logic byte-identical to the dashboard (`small`→`A`, `medium`→`A`,
  `large`→`A⁺`).

## nvram offsets used

| Offset | Constant | Value written | Meaning |
|--------|----------|---------------|---------|
| 21 | `DEEP_SLEEP` | `10` (Battery) / `0` (Plug) | Deep-sleep minutes |
| 1 | `WIFI_MODE` | `1` (Internet) / `0` (Local) | WiFi client / access point |
| 6 | `WIFI_SSID` | form SSID or scanned pick | Network SSID |
| 8 | `WIFI_PASSWORD` | form password | Network password |
| 22 | `EMAIL_ALERT` | alert recipient email | Alert recipient |
| 23 | `SMTP_SERVER` | alert SMTP server | SMTP host |
| 24 | `SMTP_USERNAME` | alert SMTP username | SMTP user |
| 25 | `SMTP_PASSWORD` | alert SMTP password | SMTP password |
| 26 | `PLANT_NAME` | alert plant name | Plant label |
| 27 | `ALERTS` | 8 checkbox bits + `0` | Alert flags |

These mirror the constants in `index.js:169-191` / `common.js`. The wizard is
GET-only: it writes these values but never writes `FIRST_SETUP` (offset 20) and
never navigates.

## Out of Scope

- Writing `FIRST_SETUP` (offset 20) to complete setup, and the final navigation
  back to `index.html` (future plan).
- No firmware `api?wifi=scan` endpoint yet — the client renders whatever
  newline-separated SSIDs the endpoint will return; wiring the endpoint is
  future firmware work.
- Any change to how nvram values are written.
