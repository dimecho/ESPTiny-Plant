# USB-C Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut a 9.5 × 4.5mm rounded USB-C receptacle slot (corner radius 1.0) through the X- face wall (x=-19) of both wood bodies in `CNC/case.FCStd`, positioned near the top of the bore chamber at **z=49..53.5** on both bodies (one opening in the assembled case).

**Architecture:** Two independent PartDesign features per body — a sketch `*_usbc` attached to the body's `YZ_Plane` (origin at world `(-19, 0, 0)` via `AttachmentOffset (0, 0, -19)`, local X→world Y, local Y→world Z, sketch normal→world +X) and a `Length=2.5`, **`Reversed=True`** pocket that cuts inward (+X) at the X- face. The default pocket direction is −X (outward at x=-19), so `Reversed=True` is required; verified empirically on a scratch PartDesign body (correct rounded-rect geometry removed exactly 104.73 mm³ and opened the x=-19 face). Verified numerically by volume, z-plane cross-sections, bbox, and validity.

**Tech Stack:** FreeCAD (PartDesign workbench) via the FreeCAD MCP `execute_code` tool; document `case` bound to `CNC/case.FCStd`.

## Global Constraints

- Session convention: agent cannot view images — all verification is numeric-only.
- FreeCAD MCP `execute_code` is the tool for all model operations; document name is `case`.
- NEVER assign `sk.Geometry = [...]`; use `sk.addGeometry(g, False)` / `delGeometry`. Do NOT `removeObject`+recreate features. Do NOT touch the sketch-support features' `AttachmentSupport`/`MapMode` after creation.
- Rounded-rect corner arcs need full-precision π angles — use `math.radians(...)`, never decimal degrees. **Arc centers for this slot are at x=±3.75, NOT ±4.75** — centering at ±4.75 bows the corners outward (scratch bug, volume comes out 127.2 instead of 104.7).
- Pads: `Type="Length"`, `Reversed=False`. Pockets: `Type="Length"`; for this task **`Reversed=True`** (see the pocket-depth line below).
- Sketch geometry: slot is 9.5 wide × 4.5 tall, corner radius 1.0, centered at local x=0 (= world y=0, horizontal). Straight edges connect the corner-arc endpoints ONLY (self-intersecting wires make the pocket invalid).
- Sketch plane and attachment (verified empirically): attach to the body's `YZ_Plane` with `MapMode=FlatFace`, `AttachmentSupport=[<body>.Origin, "YZ_Plane"]`, `AttachmentOffset = Placement(Vector(0, 0, -19), App.Rotation())`. This places the sketch origin at world (-19, 0, 0) with sketch-local X → world Y, sketch-local Y → world Z, sketch normal → world +X.
- Slot vertical placement (world z = sketch-local y): **both** bodies z=49..53.5 (slot bottom edge at local y=49).
- Pocket depth 2.5mm from the X- face (x=-19) inward (x=-16.5), **`Reversed=True`**. Verified empirically: the default pocket direction is −X (opposite the YZ_Plane normal +X); at the X- face −X points out into empty space, so `Reversed=True` (cutting +X, inward) is required. `Reversed=False` removes nothing — the volume/cross-section gates catch it.
- Design notes (verified against the live model, do not change the geometry or gates):
  - The bore is a continuous cylindrical chamber (Ø33, r=16.5) from z≈3 to z≈54 in `old_body` and z=30..≈54 in `body_top_wood`; both slots are fully pass-through. At z=49..53.5 both bodies are in the 38×38 profile with a 2.5mm wall to the bore.
  - The bore is cylindrical, so the slot's inner opening narrows at the lateral edges (residual ~0.7mm wall at y=±4.75). Inherent to the approved design.
  - The square cavity (355.0) starts at z≈54; the slot top (53.5) clears it by 0.5mm.
- Verification tolerances: volume ±0.1, cross-section area ±0.1, bbox ±0.01.
- Commit convention: `feat(cad): …` for `CNC/case.FCStd`, `docs: …` for plan/spec files. Stage ONLY the intended file (`CNC/case.FCStd` or the plan/spec doc). Keep everything on `master`; do NOT push.
- In-memory scratch documents (`yztest`, `usbctest`, `xminus*`, `xmtest*`) from design verification are not part of the model — they are already closed; confirm only `case` is open before/after each task.

---

### Task 1: Commit the spec Rev 3 update and the implementation plan document

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-usb-c-opening-design.md` (already edited to Rev 3 — X- face, near-top)
- Create: `docs/superpowers/plans/2026-08-05-usb-c-opening.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the spec Rev 3 (X- face, z=49..53.5) and the plan document tracked in git so later tasks commit cleanly against the right base.

- [ ] **Step 1: Confirm the spec and plan are updated**

The spec is already edited to Rev 3 (opening on the X- face at z=49..53.5, `YZ_Plane` attachment, `AttachmentOffset (0,0,-19)`, `Reversed=True`, gates 31217.94 / 14688.73). The plan document at `docs/superpowers/plans/2026-08-05-usb-c-opening.md` already reflects the same design. Verify both files are complete.

- [ ] **Step 2: Commit**

```bash
git status --porcelain
git add docs/superpowers/specs/2026-08-05-usb-c-opening-design.md docs/superpowers/plans/2026-08-05-usb-c-opening.md
git commit -m "docs: update USB-C opening design to X- near-top and add implementation plan"
git log --oneline -3
```

Expected: commit succeeds, only the two docs staged, `git log` shows the new `docs:` commit on top of `efe5967`.

---

### Task 2: USB-C slot on the full wood body (`old_body`)

**Files:**
- Modify: `CNC/case.FCStd` (add `o_usbc` sketch + `o_usbc_pocket` pocket to `old_body`)

**Interfaces:**
- Consumes: `old_body` (PartDesign::Body, tip `o_pilots_pocket`, volume 31322.672, bbox (−19,−19,0)..(19,19,60)). Baseline z-slices: z=51.25→578.19, z=48→578.19, z=55→355.0.
- Produces: `old_body` with tip `o_usbc_pocket`; the slot on the X- face spanning z=49..53.5, cutting 2.5mm to the cylindrical bore (inner face x=-16.5 at y=0).

- [ ] **Step 1: Create the `o_usbc` sketch**

Run this in FreeCAD MCP `execute_code` (document `case`):

```python
import FreeCAD as App
import Part, math
from FreeCAD import Vector

doc = App.getDocument("case")
bd = doc.getObject("old_body")

sk = bd.newObject("Sketcher::SketchObject", "o_usbc")
sk.AttachmentSupport = [bd.Origin, "YZ_Plane"]
sk.MapMode = "FlatFace"
sk.AttachmentOffset = App.Placement(Vector(0, 0, -19), App.Rotation())

# rounded rect 9.5x4.5, r=1.0, centered local (0, 51.25); slot bottom at local y=49.0 (= world z=49)
# local X -> world Y (9.5 width horizontal), local Y -> world Z (4.5 height vertical)
edges = [
    Part.LineSegment(Vector(-3.75, 49.0, 0), Vector(3.75, 49.0, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(3.75, 50.0, 0), Vector(0,0,1), 1.0), math.radians(-90), math.radians(0)),
    Part.LineSegment(Vector(4.75, 50.0, 0), Vector(4.75, 52.5, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(3.75, 52.5, 0), Vector(0,0,1), 1.0), math.radians(0), math.radians(90)),
    Part.LineSegment(Vector(3.75, 53.5, 0), Vector(-3.75, 53.5, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(-3.75, 52.5, 0), Vector(0,0,1), 1.0), math.radians(90), math.radians(180)),
    Part.LineSegment(Vector(-4.75, 52.5, 0), Vector(-4.75, 50.0, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(-3.75, 50.0, 0), Vector(0,0,1), 1.0), math.radians(180), math.radians(270)),
]
for g in edges:
    sk.addGeometry(g, False)
doc.recompute()

sh = sk.Shape
print("o_usbc bbox (expect x=-19, y -4.75..4.75, z 49..53.5):", sh.BoundBox)
print("wires:", len(sh.Wires), "closed:", all(w.isClosed() for w in sh.Wires))
```

Expected output: bbox `(-19, -4.75, 49, -19, 4.75, 53.5)`, `wires: 1 closed: True`. If `wires: 0` or `wires: 2`, the straight edges do not meet the corner-arc endpoints — re-check the edge coordinates (arc centers at ±3.75, straight edges at ±4.75).

- [ ] **Step 2: Create the `o_usbc_pocket`**

```python
import FreeCAD as App
from FreeCAD import Vector

doc = App.getDocument("case")
bd = doc.getObject("old_body")

pk = bd.newObject("PartDesign::Pocket", "o_usbc_pocket")
pk.Profile = doc.getObject("o_usbc")
pk.Type = "Length"
pk.Length = 2.5
pk.Reversed = True
doc.recompute()

sh = doc.getObject("old_body").Shape
print("valid:", sh.isValid())
print("volume:", round(sh.Volume, 3))
```

Expected: `valid: True`, `volume: 31217.94` (±0.1). If the recompute throws or the volume is off, STOP — do not force; report to the user (see Global Constraints design notes: do not change pocket depth as a workaround).

- [ ] **Step 3: Verify numeric gates**

```python
import FreeCAD as App
import Part
from FreeCAD import Vector

doc = App.getDocument("case")

def zslice(name, z):
    sh = doc.getObject(name).Shape
    return round(sh.common(Part.Face(Part.Plane(Vector(0,0,z), Vector(0,0,1)))).Area, 2)

sh = doc.getObject("old_body").Shape
print("old_body volume:", round(sh.Volume, 3))          # EXPECT 31217.94
print("old_body z=51.25:", zslice("old_body", 51.25))   # EXPECT 554.44
print("old_body z=48.0:", zslice("old_body", 48.0))     # EXPECT 578.19
print("old_body z=55.0:", zslice("old_body", 55.0))     # EXPECT 355.0
print("old_body bbox:", sh.BoundBox)                    # EXPECT (-19,-19,0)..(19,19,60)
print("old_body valid:", sh.isValid())                  # EXPECT True
print("top_wood:", round(doc.getObject("body_top_wood").Shape.Volume, 3))   # EXPECT 14793.46 (unchanged)
print("alum:", round(doc.getObject("body_bottom_aluminum").Shape.Volume, 3)) # EXPECT 14216.47
print("acrylic:", round(doc.getObject("Body").Shape.Volume, 3))              # EXPECT 3856.45
print("plate:", round(doc.getObject("Body002").Shape.Volume, 3))             # EXPECT 3590.30
```

All values must be within tolerance (volume ±0.1, cross-section ±0.1, bbox ±0.01). The four "unchanged" bodies must match exactly.

- [ ] **Step 4: Commit**

```bash
git status --porcelain
git add CNC/case.FCStd
git commit -m "feat(cad): add USB-C opening to full wood body"
git log --oneline -3
```

Expected: only `CNC/case.FCStd` staged and committed; `git log` shows the new `feat(cad):` commit on top of the `docs:` commit from Task 1.

---

### Task 3: USB-C slot on the top wood body (`body_top_wood`)

**Files:**
- Modify: `CNC/case.FCStd` (add `w_usbc` sketch + `w_usbc_pocket` pocket to `body_top_wood`)

**Interfaces:**
- Consumes: `body_top_wood` (PartDesign::Body, tip `w_top_pocket`, volume 14793.462, bbox (−19,−19,30)..(19,19,60)). Baseline z-slices: z=51.25→578.19, z=48→578.19, z=55→355.0. `old_body` from Task 2 (volume 31217.94).
- Produces: `body_top_wood` with tip `w_usbc_pocket`; the slot on the X- face spanning z=49..53.5, cutting 2.5mm to the cylindrical bore (inner face x=-16.5 at y=0). Same height as the `old_body` slot — the two coincide in the assembled case.

- [ ] **Step 1: Create the `w_usbc` sketch**

Run this in FreeCAD MCP `execute_code` (document `case`):

```python
import FreeCAD as App
import Part, math
from FreeCAD import Vector

doc = App.getDocument("case")
bd = doc.getObject("body_top_wood")

sk = bd.newObject("Sketcher::SketchObject", "w_usbc")
sk.AttachmentSupport = [bd.Origin, "YZ_Plane"]
sk.MapMode = "FlatFace"
sk.AttachmentOffset = App.Placement(Vector(0, 0, -19), App.Rotation())

# rounded rect 9.5x4.5, r=1.0, centered local (0, 51.25); slot bottom at local y=49.0 (= world z=49)
# local X -> world Y (9.5 width horizontal), local Y -> world Z (4.5 height vertical)
edges = [
    Part.LineSegment(Vector(-3.75, 49.0, 0), Vector(3.75, 49.0, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(3.75, 50.0, 0), Vector(0,0,1), 1.0), math.radians(-90), math.radians(0)),
    Part.LineSegment(Vector(4.75, 50.0, 0), Vector(4.75, 52.5, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(3.75, 52.5, 0), Vector(0,0,1), 1.0), math.radians(0), math.radians(90)),
    Part.LineSegment(Vector(3.75, 53.5, 0), Vector(-3.75, 53.5, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(-3.75, 52.5, 0), Vector(0,0,1), 1.0), math.radians(90), math.radians(180)),
    Part.LineSegment(Vector(-4.75, 52.5, 0), Vector(-4.75, 50.0, 0)),
    Part.ArcOfCircle(Part.Circle(Vector(-3.75, 50.0, 0), Vector(0,0,1), 1.0), math.radians(180), math.radians(270)),
]
for g in edges:
    sk.addGeometry(g, False)
doc.recompute()

sh = sk.Shape
print("w_usbc bbox (expect x=-19, y -4.75..4.75, z 49..53.5):", sh.BoundBox)
print("wires:", len(sh.Wires), "closed:", all(w.isClosed() for w in sh.Wires))
```

Expected output: bbox `(-19, -4.75, 49, -19, 4.75, 53.5)`, `wires: 1 closed: True`.

- [ ] **Step 2: Create the `w_usbc_pocket`**

```python
import FreeCAD as App
from FreeCAD import Vector

doc = App.getDocument("case")
bd = doc.getObject("body_top_wood")

pk = bd.newObject("PartDesign::Pocket", "w_usbc_pocket")
pk.Profile = doc.getObject("w_usbc")
pk.Type = "Length"
pk.Length = 2.5
pk.Reversed = True
doc.recompute()

sh = doc.getObject("body_top_wood").Shape
print("valid:", sh.isValid())
print("volume:", round(sh.Volume, 3))
```

Expected: `valid: True`, `volume: 14688.73` (±0.1). If not, STOP and report.

- [ ] **Step 3: Verify numeric gates**

```python
import FreeCAD as App
import Part
from FreeCAD import Vector

doc = App.getDocument("case")

def zslice(name, z):
    sh = doc.getObject(name).Shape
    return round(sh.common(Part.Face(Part.Plane(Vector(0,0,z), Vector(0,0,1)))).Area, 2)

sh = doc.getObject("body_top_wood").Shape
print("top_wood volume:", round(sh.Volume, 3))              # EXPECT 14688.73
print("top_wood z=51.25:", zslice("body_top_wood", 51.25))  # EXPECT 554.44
print("top_wood z=48.0:", zslice("body_top_wood", 48.0))    # EXPECT 578.19
print("top_wood z=55.0:", zslice("body_top_wood", 55.0))    # EXPECT 355.0
print("top_wood bbox:", sh.BoundBox)                        # EXPECT (-19,-19,30)..(19,19,60)
print("top_wood valid:", sh.isValid())                      # EXPECT True
print("old_body:", round(doc.getObject("old_body").Shape.Volume, 3))        # EXPECT 31217.94 (unchanged)
print("alum:", round(doc.getObject("body_bottom_aluminum").Shape.Volume, 3)) # EXPECT 14216.47
print("acrylic:", round(doc.getObject("Body").Shape.Volume, 3))              # EXPECT 3856.45
print("plate:", round(doc.getObject("Body002").Shape.Volume, 3))             # EXPECT 3590.30
```

All values within tolerance; unchanged bodies match exactly.

- [ ] **Step 4: Commit**

```bash
git status --porcelain
git add CNC/case.FCStd
git commit -m "feat(cad): add USB-C opening to top wood body"
git log --oneline -3
```

Expected: only `CNC/case.FCStd` staged and committed on top of the Task 2 commit.

---

## Self-Review

- **Spec coverage:** Spec requirements map to tasks — slot geometry (9.5×4.5, r=1.0, centered y=0) in Tasks 2/3 Step 1; pass-through pocket (2.5mm, Reversed=True) in Steps 2; vertical placement (bottom z=49 on both) in the sketch coordinates; all spec gates (volume 31217.94/14688.73, z=51.25/48/55) asserted in Step 3 of each task. The design notes (continuous bore, lateral-edge narrowing, square-cavity clearance) are documented in Global Constraints and do not change gates.
- **Placeholder scan:** All steps contain concrete Python and exact expected values; no TBD/TODO.
- **Type consistency:** Feature names `o_usbc`/`o_usbc_pocket` and `w_usbc`/`w_usbc_pocket` are used consistently in sketch creation, pocket creation, and verification. `Reversed=True`, `Type="Length"`, `Length=2.5`, `AttachmentOffset (0,0,-19)`, and `AttachmentSupport [<body>.Origin, "YZ_Plane"]` are identical across tasks.
- **Empirical basis:** The X- attachment mapping, `Reversed=True` convention, correct rounded-rect construction (arc centers ±3.75), and the 2.5mm wall at z=49..53.5 were all verified against a scratch PartDesign body and the live model before writing this plan.
