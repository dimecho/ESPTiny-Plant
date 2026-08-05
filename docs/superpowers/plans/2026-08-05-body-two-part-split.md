# Two-part case body (wood top + aluminum bottom) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 38x38x60 case body in `CNC/case.FCStd` with two equal halves split at z=30 — a wood top (z=30..60) and an aluminum bottom (z=0..30) — that nest together via a 1mm-per-side alignment tail/recess, preserving all cavities and holes.

**Architecture:** Each half is built from OCCT primitives (`Part.makeBox` + `makeFillet` + `Part.makeCylinder`) and boolean ops (`fuse`/`cut`), wrapped in a single `Part::Feature` per half. No sketches, no PartDesign bodies. Verification is purely numeric: volume, bounding box, validity, and cross-section areas must match precomputed values.

**Tech Stack:** FreeCAD Part module (OCCT geometry) driven through the FreeCAD MCP `execute_code` tool. The document `case` must be open in FreeCAD.

## Global Constraints

- FreeCAD GUI + MCP server running with `CNC/case.FCStd` open as document `case`.
- Verify numerically only (never by screenshot): `Shape.Volume`, `Shape.BoundBox`, `Shape.isValid()`, cross-section `common(face).Area`.
- Do NOT create sketches or PartDesign features for the new halves — primitives + booleans only.
- Do NOT use `sk.Geometry = [...]` list assignment or `removeObject`+recreate on bore/pocket features (both corrupt feature chains — previously hit).
- `Bottom_Plate` (Body002) and `Top_Acrylic` (Body) must remain untouched.
- Volume tolerance: ±1.0 mm^3 vs. expected.
- Save `CNC/case.FCStd` before every commit; commit only after verification passes.

---

### Task 1: Build the wood top half (`body_top_wood`)

**Files:**
- Modify: `CNC/case.FCStd` (add one `Part::Feature`)

**Interfaces:**
- Produces: document object `body_top_wood` (Part::Feature, Label `body_top_wood`) whose `Shape` is the solid wood half.
- Expected values (precomputed and verified against OCCT): volume `14793.5`, bbox `-19 -19 30 .. 19 19 60`, valid.

- [ ] **Step 1: Run the builder script in FreeCAD**

Run the following via FreeCAD MCP `execute_code`:

```python
import FreeCAD as App
import Part
from FreeCAD import Vector

doc = App.getDocument("case")

def rounded_box(sx, sy, z0, z1, r=3.5):
    h = z1 - z0
    box = Part.makeBox(sx, sy, h)
    box.translate(Vector(-sx / 2, -sy / 2, z0))
    verts = [e for e in box.Edges
             if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1e-6]
    return box.makeFillet(r, verts)          # makeFillet takes a LIST of edges

def cyl(r, z0, z1, x=0.0, y=0.0):
    c = Part.makeCylinder(r, z1 - z0)
    c.translate(Vector(x, y, z0))
    return c

blank = rounded_box(38, 38, 34, 60)          # main wall, z=34..60
tail  = rounded_box(36, 36, 30, 34)          # nesting tail, z=30..34
fuse  = blank.fuse(tail)
bore  = cyl(16.5, 30, 54)                    # Ø33 bore through tail + wall
sq    = rounded_box(33, 33, 54, 57)          # square cavity
top   = rounded_box(36, 36, 57, 60)          # top cavity

wood = fuse.cut(bore).cut(sq).cut(top)

o = doc.addObject("Part::Feature", "body_top_wood")
o.Label = "body_top_wood"
o.Shape = wood
doc.recompute()
print("built body_top_wood volume:", round(wood.Volume, 2))
```

Expected: `built body_top_wood volume: 14793.46`.

- [ ] **Step 2: Verify the wood half**

Run:

```python
import FreeCAD as App
doc = App.getDocument("case")
sh = doc.getObject("body_top_wood").Shape
print("Volume:", round(sh.Volume, 2))     # expect 14793.46
print("Valid:", sh.isValid())             # expect True
bb = sh.BoundBox
print("bbox:", bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax)
# expect: -19.0 -19.0 30.0 19.0 19.0 60.0
```

Expected output:
```
Volume: 14793.46
Valid: True
bbox: -19.0 -19.0 30.0 19.0 19.0 60.0
```

If any value differs by more than 1.0 (volume) or 0.01 (bbox), stop and investigate before continuing — do not proceed to the next task on a failed check.

- [ ] **Step 3: Save and commit**

```bash
git add CNC/case.FCStd
git commit -m "feat(cad): add wood top half of split case body"
```

---

### Task 2: Build the aluminum bottom half (`body_bottom_aluminum`)

**Files:**
- Modify: `CNC/case.FCStd` (add one `Part::Feature`)

**Interfaces:**
- Consumes: `rounded_box` / `cyl` helpers (same definitions as Task 1).
- Produces: document object `body_bottom_aluminum` (Part::Feature).
- Expected: volume `14216.5`, bbox `-19 -19 0 .. 19 19 30`, valid.

- [ ] **Step 1: Run the builder script in FreeCAD**

```python
import FreeCAD as App
import Part
from FreeCAD import Vector

doc = App.getDocument("case")

def rounded_box(sx, sy, z0, z1, r=3.5):
    h = z1 - z0
    box = Part.makeBox(sx, sy, h)
    box.translate(Vector(-sx / 2, -sy / 2, z0))
    verts = [e for e in box.Edges
             if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1e-6]
    return box.makeFillet(r, verts)

def cyl(r, z0, z1, x=0.0, y=0.0):
    c = Part.makeCylinder(r, z1 - z0)
    c.translate(Vector(x, y, z0))
    return c

blank   = rounded_box(38, 38, 0, 30)         # z=0..30
botcav  = rounded_box(36, 36, 0, 3)          # bottom cavity
bore    = cyl(16.5, 3, 30)                   # Ø33 bore
recess  = rounded_box(36, 36, 26, 30)        # alignment recess (1mm rim)
pilots  = [cyl(1.25, 3, 9, x, y)
           for (x, y) in [(15, 15), (15, -15), (-15, 15), (-15, -15)]]

al = blank
for t in [botcav, bore, recess] + pilots:
    al = al.cut(t)

o = doc.addObject("Part::Feature", "body_bottom_aluminum")
o.Label = "body_bottom_aluminum"
o.Shape = al
doc.recompute()
print("built body_bottom_aluminum volume:", round(al.Volume, 2))
```

Expected: `built body_bottom_aluminum volume: 14216.47`.

- [ ] **Step 2: Verify the aluminum half**

```python
import FreeCAD as App
doc = App.getDocument("case")
sh = doc.getObject("body_bottom_aluminum").Shape
print("Volume:", round(sh.Volume, 2))     # expect 14216.47
print("Valid:", sh.isValid())             # expect True
bb = sh.BoundBox
print("bbox:", bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax)
# expect: -19.0 -19.0 0.0 19.0 19.0 30.0
```

Expected output:
```
Volume: 14216.47
Valid: True
bbox: -19.0 -19.0 0.0 19.0 19.0 30.0
```

- [ ] **Step 3: Save and commit**

```bash
git add CNC/case.FCStd
git commit -m "feat(cad): add aluminum bottom half of split case body"
```

---

### Task 3: Remove the old single body and verify the assembly

**Files:**
- Modify: `CNC/case.FCStd` (delete `Body001` + its feature tree, set view colors)

**Interfaces:**
- Consumes: `body_top_wood`, `body_bottom_aluminum` (Tasks 1-2); existing `Bottom_Plate` (Body002) and `Top_Acrylic` (Body).
- Produces: final document containing exactly `Body` (Top_Acrylic), `Body002` (Bottom_Plate), `body_top_wood`, `body_bottom_aluminum`.

- [ ] **Step 1: Delete the old single body**

The old body's internal name is `Body001` (Label "Body"). Remove it (its child features go with it):

```python
import FreeCAD as App
doc = App.getDocument("case")
doc.removeObject("Body001")
doc.recompute()
names = [o.Name for o in doc.Objects]
print("remaining:", names)
```

Expected: `Body001` gone; `Body`, `Body002`, `body_top_wood`, `body_bottom_aluminum` present. If `removeObject` errors, remove `Body001`'s features first (iterate `doc.getObject("Body001").Group`) then retry.

- [ ] **Step 2: Verify assembly (nesting + untouched parts)**

```python
import FreeCAD as App
import Part
from FreeCAD import Vector

doc = App.getDocument("case")
wo = doc.getObject("body_top_wood").Shape
al = doc.getObject("body_bottom_aluminum").Shape

def cross_area(shape, z):
    plane = Part.Face(Part.Plane(Vector(0, 0, z), Vector(0, 0, 1)))
    return shape.common(plane).Area

checks = [
    ("wood z=40  (wall+bore)",   cross_area(wo, 40)),
    ("alum z=20 (wall+bore)",    cross_area(al, 20)),
    ("wood z=32  (tail: 36sq-bore)", cross_area(wo, 32)),
    ("alum z=28 (rim: 38sq-36sq)",   cross_area(al, 28)),
    ("wood z=58  (top cavity)",   cross_area(wo, 58)),
    ("alum z=1   (bottom cavity)", cross_area(al, 1)),
]
for name, a in checks:
    print(name, round(a, 2))

# halves untouched?
pb = doc.getObject("Body002").Shape.BoundBox
print("plate bbox:", pb.XMin, pb.YMin, pb.ZMin, pb.XMax, pb.YMax, pb.ZMax)
ab = doc.getObject("Body").Shape.BoundBox
print("acrylic bbox:", ab.XMin, ab.YMin, ab.ZMin, ab.XMax, ab.YMax, ab.ZMax)
```

Expected output (areas in mm^2, ±0.5):
```
wood z=40  (wall+bore) 578.19
alum z=20 (wall+bore) 578.19
wood z=32  (tail: 36sq-bore) 430.19
alum z=28 (rim: 38sq-36sq) 148.0
wood z=58  (top cavity) 148.0
alum z=1   (bottom cavity) 148.0
plate bbox: -18.0 -18.0 -10.0 18.0 18.0 -7.0
acrylic bbox: -18.0 -18.0 65.0 18.0 18.0 68.0
```

Interpretation: both halves share the same bore-wall cross-section (578.19) so the interior chamber is continuous; the wood tail (430.19) nests into the aluminum rim region (148.0), and 430.19 + 148.0 = 578.19 — material continuity across the split.

- [ ] **Step 3: Set material colors for visualization**

```python
import FreeCAD as App
doc = App.getDocument("case")
colors = {"body_top_wood": (0.60, 0.40, 0.20),        # wood brown
          "body_bottom_aluminum": (0.75, 0.78, 0.82)}  # aluminum gray
for name, col in colors.items():
    obj = doc.getObject(name)
    if obj.ViewObject:
        obj.ViewObject.ShapeColor = col
doc.recompute()
print("colors set")
```

- [ ] **Step 4: Save and commit**

```bash
git add CNC/case.FCStd
git commit -m "feat(cad): split case body into wood top and aluminum bottom halves"
```

Final state: document contains `body_top_wood` (z=30..60), `body_bottom_aluminum` (z=0..30), `Bottom_Plate`, and the acrylic top plate; old single body removed; both halves verified numerically.
