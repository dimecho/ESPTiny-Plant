# First-Time Setup Page (`setup.html`)

Date: 2026-08-05

## Purpose

Provide a first-time setup screen for the ESPTiny-Plant device. When the device
has no setup configuration yet, the dashboard (`index.html`) redirects to
`setup.html`, which asks the user to choose a setup profile ("Home" or "Office").

The tiles are intentionally non-functional in this version — clicking gives
visual feedback only. The Home/Office behavior is a future plan.

## Requirements

- Create `Web/setup.html` in the same visual style as `Web/index.html`.
- Light/dark theme support matching the dashboard (same CSS variables, same
  `localStorage` key).
- NO bonsai SVG diagram — the setup page is a centered menu only.
- Two square, clickable tiles side by side: **Home** and **Office**.
- Each tile shows an inline SVG icon (house / briefcase) plus the label.
- Clicking a tile is a no-op with visual press feedback.
- Add a redirect in `index.js`: when `FIRST_SETUP` (offset 20) is blank in
  `nvram.json`, `index.html` redirects to `setup.html`.

## Implementation Approach

- **B**: `setup.html` reuses the existing `svg/bonsai.css` via `<link>` and adds
  a small setup-specific `<style>` block. No new shared CSS file; no dashboard
  restructuring.

## Design

### Page structure (`Web/setup.html`)

- `<link href="svg/bonsai.css">` — reuses theme variables, body background/font,
  preloader, and animation keyframes.
- Head script sets `data-theme` from `localStorage('theme')` **before** first
  paint (mirrors `index.html`), so there is no theme flash.
- Header contains only the theme toggle (☀/☾) styled with the existing
  `.theme-toggle` class. No font toggle, no heading.
- A centered container (flex, both axes centered, min-height viewport) holds the
  two square tiles side by side with a gap, using the `grow` scale-in animation.
- Each tile:
  - Inline SVG icon (house for Home, briefcase for Office) above the label.
  - Square aspect ratio; styled like a `.feature-card` using shared vars
    (`--card-bg`, `--card-border`, `--card-hover-bg`, `--card-hover-border`).
  - Click = no-op. Pressed state via `.active`: scale ~0.96 + border highlight,
    released on mouseup (pure visual feedback).
- Setup-specific `<style>` block only (tile layout, icon sizing, press state).

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

## Out of Scope

- Home/Office tile behavior (future plan).
- Any change to how nvram values are written.
- Font-size toggle on the setup page.
