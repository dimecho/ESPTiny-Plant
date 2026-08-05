# Old Body Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original single-piece case body into `CNC/case.FCStd` as a hidden, fully editable `PartDesign::Body` named `old_body`, geometrically identical to the pre-split original.

**Architecture:** One new `PartDesign::Body` whose `Group` is an ordered feature chain: 38×38 profile sketch → pad (z=0..60), then five pockets (each `Type=Length`, `Reversed=True`, cutting upward in +Z from its sketch plane): bottom cavity 36×36 z=0..3, bore Ø33 z=3..54, square cavity 33×33 z=54..57, top cavity 36×36 z=57..60, and 4×Ø2.5 pilots z=3..9. Sketches are unconstrained `Sketcher::SketchObject`s attached to the body `XY_Plane` with an `AttachmentOffset` z-position — identical to `body_top_wood`/`body_bottom_aluminum`. The body is hidden (`ViewObject.Visibility = False`) and does not interact with any other object.

**Tech Stack:** FreeCAD PartDesign/Sketcher modules driven through the FreeCAD MCP `execute_code` tool. Document `case` is open in FreeCAD and bound to `CNC/case.FCStd`.

## Global Constraints

- FreeCAD GUI + MCP server running with `CNC/case.FCStd` open as document `case`.
- Verify numerically only (never by screenshot — the agent cannot view images): `Shape.Volume`, `Shape.BoundBox`, `Shape.isValid()`, cross-section `common(face).Area`.
- Rounded-rect sketches = 4 lines + 4 corner arcs (r=3.5). **Corner arc angles MUST be full-precision π values** (`-math.pi/2`, `0.0`, `math.pi/2`, `math.pi`, `3*math.pi/2`). Truncated angles leave ~5e-6 endpoint gaps so the pad/pocket fails.
- **Circle-only sketches (bore, pilots) MUST contain ONLY circles.**
- Build sketches via `sk.addGeometry(geo, False)` only. NEVER assign `sk.Geometry = [...]`. NEVER `removeObject` a feature to recreate it.
- Set `sk.AttachmentSupport = [body.Origin, "XY_Plane"]`, `sk.MapMode = "FlatFace"`, `sk.AttachmentOffset = App.Placement(Vector(0,0,z), App.Rotation())`.
- Pads: `Type="Length"`, `Reversed=False`. Pockets: `Type="Length"`, `Reversed=True`.
- `Body` (acrylic), `Body002` (bottom plate), `body_top_wood`, `body_bottom_aluminum` must remain untouched.
- Volume tolerance ±0.01 mm³; cross-section area ±0.1 mm²; bbox ±0.01 mm.
- Save `CNC/case.FCStd` before every commit; commit only after verification passes.

---

### Task 1: Build the hidden `old_body` PartDesign body

**Files:**
- Modify: `CNC/case.FCStd` (add one `PartDesign::Body`)

**Interfaces:**
- Consumes: existing `case` document; the four existing top-level objects untouched.
- Produces: document object `old_body` of type `PartDesign::Body`, Label `old_body`, hidden (`ViewObject.Visibility == False`), with 12 features (6 sketches + 1 pad + 5 pockets). Expected `Shape`: volume `31322.67`, bbox `-19 -19 0 .. 19 19 60`, valid.

- [ ] **Step 1: Build the body and its feature chain**

Run via FreeCAD MCP `execute_code`:

```python
import FreeCAD as App
import Part
import math
from FreeCAD import Vector

doc = App.getDocument("case")

def rect_sketch(body, name, size, z):
    sk = body.newObject("Sketcher::SketchObject", name)
    r = 3.5; c = size / 2.0; p = c - r; h = math.pi / 2
    sk.addGeometry(Part.LineSegment(Vector(-p, -c, 0), Vector(p, -c, 0)), False)
    sk.addGeometry(Part.LineSegment(Vector(c, -p, 0), Vector(c, p, 0)), False)
    sk.addGeometry(Part.LineSegment(Vector(p, c, 0), Vector(-p, c, 0)), False)
    sk.addGeometry(Part.LineSegment(Vector(-c, p, 0), Vector(-c, -p, 0)), False)
    def arc(cx, cy, a0, a1):
        return Part.ArcOfCircle(Part.Circle(Vector(cx, cy, 0), Vector(0,0,1), r), a0, a1)
    sk.addGeometry(arc(p, -p, -h, 0.0), False)
    sk.addGeometry(arc(p, p, 0.0, h), False)
    sk.addGeometry(arc(-p, p, h, math.pi), False)
    sk.addGeometry(arc(-p, -p, math.pi, 3*h), False)
    sk.AttachmentSupport = [body.Origin, "XY_Plane"]
    sk.MapMode = "FlatFace"
    sk.AttachmentOffset = App.Placement(Vector(0, 0, z), App.Rotation())
    doc.recompute()
    return sk

def circle_sketch(body, name, z, circles):
    sk = body.newObject("Sketcher::SketchObject", name)
    for (x, y, rr) in circles:
        sk.addGeometry(Part.Circle(Vector(x, y, 0), Vector(0,0,1), rr), False)
    sk.AttachmentSupport = [body.Origin, "XY_Plane"]
    sk.MapMode = "FlatFace"
    sk.AttachmentOffset = App.Placement(Vector(0, 0, z), App.Rotation())
    doc.recompute()
    return sk

def add_pad(body, sk, length, name):
    pad = body.newObject("PartDesign::Pad", name)
    pad.Profile = sk; pad.Length = length; pad.Reversed = False; pad.Type = "Length"
    doc.recompute()
    return pad

def add_pocket(body, sk, length, name):
    pk = body.newObject("PartDesign::Pocket", name)
    pk.Profile = sk; pk.Length = length; pk.Reversed = True; pk.Type = "Length"
    doc.recompute()
    return pk

ob = doc.addObject("PartDesign::Body", "old_body")
ob.Label = "old_body"
add_pad(ob, rect_sketch(ob, "o_profile", 38, 0), 60, "o_profile_pad")      # z=0..60
add_pocket(ob, rect_sketch(ob, "o_botcav", 36, 0), 3, "o_botcav_pocket")   # z=0..3
add_pocket(ob, circle_sketch(ob, "o_bore", 3, [(0, 0, 16.5)]), 51, "o_bore_pocket")  # z=3..54
add_pocket(ob, rect_sketch(ob, "o_sq", 33, 54), 3, "o_sq_pocket")          # z=54..57
add_pocket(ob, rect_sketch(ob, "o_top", 36, 57), 3, "o_top_pocket")        # z=57..60
add_pocket(ob, circle_sketch(ob, "o_pilots", 3,
    [(15,15,1.25),(15,-15,1.25),(-15,15,1.25),(-15,-15,1.25)]), 6, "o_pilots_pocket")  # z=3..9
doc.recompute()
print("features:", [g.Name for g in ob.Group])
```

Expected `features`: `['o_profile', 'o_profile_pad', 'o_botcav', 'o_botcav_pocket', 'o_bore', 'o_bore_pocket', 'o_sq', 'o_sq_pocket', 'o_top', 'o_top_pocket', 'o_pilots', 'o_pilots_pocket']`.

- [ ] **Step 2: Verify numerically**

```python
import FreeCAD as App
import Part
from FreeCAD import Vector

doc = App.getDocument("case")
sh = doc.getObject("old_body").Shape
print("Volume:", round(sh.Volume, 2))          # expect 31322.67
print("Valid:", sh.isValid())                  # expect True
bb = sh.BoundBox
print("bbox:", round(bb.XMin,2), round(bb.YMin,2), round(bb.ZMin,2),
      round(bb.XMax,2), round(bb.YMax,2), round(bb.ZMax,2))
# expect: -19.0 -19.0 0.0 19.0 19.0 60.0

def cross(shape, z):
    plane = Part.Face(Part.Plane(Vector(0, 0, z), Vector(0, 0, 1)))
    return shape.common(plane).Area

for z in [1, 6, 20, 55, 58]:
    print(f"cross z={z}:", round(cross(sh, z), 2))
```

Expected output:
```
Volume: 31322.67
Valid: True
bbox: -19.0 -19.0 0.0 19.0 19.0 60.0
cross z=1: 148.0
cross z=6: 558.55
cross z=20: 578.19
cross z=55: 355.0
cross z=58: 148.0
```

Interpretation: z=1 bottom cavity (38sq−36sq); z=6 wall+bore−pilots (578.19−19.63); z=20 wall+bore (1433.48−855.30); z=55 square cavity (38sq−33sq); z=58 top cavity (38sq−36sq). If any value differs beyond the tolerances, STOP and investigate (circle sketch polluted with rect elements, or truncated arc angles).

- [ ] **Step 3: Hide the body, confirm visibility off, final sanity, save**

```python
import FreeCAD as App
doc = App.getDocument("case")
ob = doc.getObject("old_body")
ob.ViewObject.Visibility = False
doc.recompute()
print("hidden:", ob.ViewObject.Visibility is False)
for name in ["old_body", "body_top_wood", "body_bottom_aluminum", "Body", "Body002"]:
    o = doc.getObject(name)
    print(name, "|", o.TypeId, "| volume:", round(o.Shape.Volume, 2),
          "| valid:", o.Shape.isValid())
doc.save()
print("saved")
```

Expected: `hidden: True`; `old_body` is `PartDesign::Body` volume `31322.67`; `body_top_wood` `14793.46` and `body_bottom_aluminum` `14216.47` unchanged; `Body` (acrylic) and `Body002` (plate) present and valid with volumes unchanged from their pre-task values (their exact numbers are controls — do not hard-code expectations, just confirm they are valid and unchanged); `saved` printed (document writes to `CNC/case.FCStd`).

- [ ] **Step 4: Commit**

```bash
git add CNC/case.FCStd
git commit -m "feat(cad): restore original single case body as hidden object"
```

Final state: `old_body` (hidden, editable PartDesign body, geometry identical to the pre-split original) added to the tree; all four existing objects untouched.
