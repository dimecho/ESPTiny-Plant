# First-Time Setup Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-time setup page (`Web/setup.html`) with two centered Home/Office tiles, and redirect `index.html` to it when `FIRST_SETUP` (nvram offset 20) is blank.

**Architecture:** `setup.html` reuses the existing `svg/bonsai.css` stylesheet for theme variables and shared look, adding a small setup-specific `<style>` block and inline JS for the theme toggle, preloader dismissal, and tile press feedback. `index.js` gains a guard inside the existing `nvram.onload` that redirects to `setup.html` when offset 20 is empty.

**Tech Stack:** Static HTML/CSS/vanilla JS (ES5 style, matching `index.js`), served by the ESP via LittleFS. No build step, no test framework (verification is browser-based).

## Global Constraints

- `setup.html` MUST live at `Web/setup.html` and reuse `svg/bonsai.css` via `<link href="svg/bonsai.css">` (Approach B — no new shared CSS file, no dashboard restructuring).
- Theme MUST use the same `localStorage('theme')` key (`'dark'` default, `data-theme` attribute on `<html>`), so a theme picked in setup carries to `index.html`.
- No font-size toggle and no heading/title on the setup page — theme toggle only, styled with the existing `.theme-toggle` class.
- Tiles: two squares side by side, centered to screen; each shows an inline SVG icon (house / briefcase) plus label ("Home" / "Office"); click is a no-op with visual press feedback only.
- Redirect guard: `if (data[FIRST_SETUP] === '') { location.replace('setup.html'); return; }` inside `nvram.onload`, using the already-defined `FIRST_SETUP = 20` constant. Use `location.replace`, never `location.href` (avoids Back-button loop).
- JS style: ES5 (var, function expressions) to match the existing codebase. No comments unless the surrounding code uses them.

---

### Task 1: Create `Web/setup.html`

**Files:**
- Create: `Web/setup.html`

**Interfaces:**
- Consumes: theme variables from `Web/svg/bonsai.css` (existing).
- Produces: a standalone page at `Web/setup.html` that is reachable by the redirect from Task 2.

- [ ] **Step 1: Write `Web/setup.html`**

Create the file with this exact content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>tiny plant</title>
<script>
var savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
var savedFont = localStorage.getItem('fontSize') || 'medium';
document.documentElement.setAttribute('data-font', savedFont);
</script>
  <link href="svg/bonsai.css" rel="stylesheet" type="text/css" />
  <style>
    .setup-menu {
      display: flex;
      gap: 2rem;
      align-items: center;
      justify-content: center;
      flex: 1;
      width: 100%;
      animation: grow 0.8s ease-out;
      transform-origin: center center;
    }
    .setup-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      width: 220px;
      height: 220px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.25s ease-in-out;
      user-select: none;
    }
    .setup-tile:hover {
      background: var(--card-hover-bg);
      border-color: var(--card-hover-border);
      transform: translateY(-4px);
    }
    .setup-tile.active {
      transform: scale(0.96);
    }
    .setup-tile svg {
      width: 64px;
      height: 64px;
      color: var(--card-title);
    }
    .setup-tile h3 {
      font-size: 1.2rem;
      font-weight: 500;
      letter-spacing: 2px;
      color: var(--card-title);
    }
    @media (max-width: 768px) {
      .setup-menu { flex-direction: column; }
      .setup-tile { width: 180px; height: 180px; }
    }
  </style>
</head>
<body>
<div id="preloader-overlay"><div id="preloader-bar"><div id="preloader-fill"></div></div></div>
<header>
  <button class="theme-toggle" id="themeToggle"></button>
</header>

<div class="setup-menu">
  <div class="setup-tile" id="tileHome" role="button" tabindex="0" aria-label="Home">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11.5 12 4l9 7.5"/>
      <path d="M5 9.5V20h14V9.5"/>
      <path d="M10 20v-5h4v5"/>
    </svg>
    <h3>Home</h3>
  </div>
  <div class="setup-tile" id="tileOffice" role="button" tabindex="0" aria-label="Office">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="2"/>
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
      <path d="M3 13h18"/>
    </svg>
    <h3>Office</h3>
  </div>
</div>

<script>
var preloader = document.getElementById('preloader-overlay');
window.addEventListener('load', function() {
  setTimeout(function() { preloader.classList.add('done'); }, 500);
});

var html = document.documentElement;
var themeToggle = document.getElementById('themeToggle');
themeToggle.textContent = savedTheme === 'dark' ? '\u2600' : '\u263E';
themeToggle.addEventListener('click', function() {
  var current = html.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  this.textContent = next === 'dark' ? '\u2600' : '\u263E';
});

document.querySelectorAll('.setup-tile').forEach(function(tile) {
  tile.addEventListener('mousedown', function() { this.classList.add('active'); });
  tile.addEventListener('mouseup', function() { this.classList.remove('active'); });
  tile.addEventListener('mouseleave', function() { this.classList.remove('active'); });
});
</script>
</body>
</html>
```

- [ ] **Step 2: Verify the page renders and interactions work**

Serve the `Web/` directory and inspect in a browser:

Run: `python3 -m http.server 8123 --directory /Users/dima/Desktop/ESPTiny-Plant/Web`

Open a headless/controlled browser at `http://127.0.0.1:8123/setup.html` and verify:
- Two square tiles (Home with house icon, Office with briefcase icon) are centered side-by-side.
- Theme toggle button (☀/☾) exists in the header and flips light/dark on click; `localStorage.theme` is updated.
- Preloader overlay fades out shortly after load.
- `mousedown` on a tile adds `.active` (scale down), `mouseup`/`mouseleave` removes it.
- Page has no SVG object/diagram.

- [ ] **Step 3: Commit**

```bash
git add Web/setup.html
git commit -m "feat(web): add first-time setup page"
```

---

### Task 2: Add `FIRST_SETUP` redirect to `index.html`

**Files:**
- Modify: `Web/js/index.js:755` (inside `nvram.onload`, right after `var data = nvram.response['nvram'];`)

**Interfaces:**
- Consumes: `FIRST_SETUP` constant already defined at `Web/js/index.js:190`; `nvram.json` served by the device (index 20 currently `""`).
- Produces: redirect to `Web/setup.html` whenever nvram offset 20 is blank.

- [ ] **Step 1: Add the redirect guard**

Edit `Web/js/index.js` — inside `nvram.onload`, immediately after the line:

```js
      var data = nvram.response['nvram'];
```

insert:

```js
      if (data[FIRST_SETUP] === '') { location.replace('setup.html'); return; }
```

The resulting block must read:

```js
    if (nvram.response && nvram.response['nvram']) {
      var data = nvram.response['nvram'];
      if (data[FIRST_SETUP] === '') { location.replace('setup.html'); return; }
      try {
```

- [ ] **Step 2: Verify the redirect fires**

With the server from Task 1 still running at `http://127.0.0.1:8123`, open `http://127.0.0.1:8123/index.html` in the browser. Expected: it redirects to `setup.html` (because `Web/nvram.json` has `""` at index 20). Confirm the final URL is `http://127.0.0.1:8123/setup.html`.

- [ ] **Step 3: Verify non-blank `FIRST_SETUP` does NOT redirect**

Temporarily edit `Web/nvram.json`, changing the 21st element of the array (0-indexed element 20, currently `""`, sitting between `"0"` and `"2"` in the value list) from `""` to `"1"`. Reload `http://127.0.0.1:8123/index.html`. Expected: no redirect; the dashboard loads normally. Revert `nvram.json` to `""` afterwards (leave it as committed).

- [ ] **Step 4: Commit**

```bash
git add Web/js/index.js
git commit -m "feat(web): redirect to setup page when FIRST_SETUP is blank"
```

---

### Task 3: End-to-end verification

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: `Web/setup.html` (Task 1) and the redirect guard (Task 2).

- [ ] **Step 1: Full flow check**

With the HTTP server running:
1. Open `http://127.0.0.1:8123/index.html` → must land on `setup.html`.
2. Toggle the theme to light, reload → stays light (persisted via shared `localStorage` key).
3. Press and release each tile → visual scale feedback only, no navigation, no console errors.
4. Confirm `git status` is clean except for the two expected commits.

- [ ] **Step 2: Stop the test server**

Run: `kill %1` (or the PID from the python http.server) to stop `python3 -m http.server 8123`.
