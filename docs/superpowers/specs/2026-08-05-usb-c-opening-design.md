# USB-C Opening Design

Date: 2026-08-05

Status: Approved
Rev 3 (2026-08-05): opening moved from the X+ face (near the chamber floor) to
the **X- face (x=-19), near the top of the bore chamber (z=49..53.5)** per user
request. Both wood bodies get the slot at the same height, so the assembled case
shows one opening near the top. Geometry and construction pattern unchanged —
only the face, sketch plane offset, pocket direction, and vertical placement
differ. Rev 2 placed the slot on X+ near the bottom; Rev 1 was the original Y+
design.

## Goal

Add a USB-C receptacle opening (a pass-through slot) on the **X- side wall**
(x=-19) of both `body_full_wood` (`old_body`) and `body_top_wood`, cutting
through the wall into the cylindrical bore chamber, positioned **near the top of
the shared bore chamber (z=49..53.5)** so the cable exits near the top of the
assembled case.

## Context

- The bore is a continuous cylindrical chamber **z=3..≈54** (Ø33, radius 16.5,
  verified by cross-sections: `old_body` z=3..7 → 558.55 with pilots, z=9..53 →
  578.19 = profile−bore; `body_top_wood` z=30..32 → 430.19 in the 36×36 tail,
  z=34..54 → 578.19 in the 38×38 profile). The square cavity (355.0) spans
  ≈z=54..57 and the top cavity (148.0) z=57..60 on both bodies.
- `old_body`: full single body, 38×38×60. Wall between the X- face (x=-19) and
  the bore (x=-16.5) is **2.5mm** throughout the bore height (verified at z=51:
  ray x=-19.0..-16.49). Slot z=49..53.5 sits 0.5mm below the square cavity
  (z=54); no interference.
- `body_top_wood`: top half, z=30..60. Profile 38×38 above z=34, bore present to
  ≈z=54. Wall at z=49..53.5 is **2.5mm** (verified at z=51: ray x=-19.0..-16.49),
  with the bore open behind it — the slot is fully pass-through along its whole
  height.
  - CORRECTION: the earlier Rev 1/2 note "the bore ends at z=34 so the slot's top
    sliver is blind" was a misreading. The z≈34 cross-section change is the
    36×36-tail → 38×38-profile transition; the bore continues to ≈z=54.
- Both bodies are editable PartDesign bodies; new features follow the file's
  sketch convention. Other objects (aluminum half, plate, acrylic) are untouched.

## Geometry

A **9.5 × 4.5 mm** rounded slot, corner radius **r=1.0**, centered on the X-
face (x=-19), spanning y ∈ [−4.75, +4.75] (9.5mm wide horizontally) and 4.5mm
tall along z from **z=49 to z=53.5** on **both** bodies (same height — the two
slots coincide in the assembled case, forming one opening). Cuts **through the
wall into the bore** (an open pass-through connecting the chamber to the
outside). No recess/counterbore for a connector flange (YAGNI).

### Design notes (verified against the live model — inherent to the geometry, do not re-gate)

- The bore is cylindrical (radius 16.5), so the slot's inner opening is fully
  pass-through near y≈0 and narrows at the lateral edges (residual ~0.7mm wall
  at y=±4.75). This applies equally to both bodies at the near-top height.
- Both slots span z=49..53.5, so the opening is continuous across the two bodies
  in the assembled case.
- Horizontal z-slices and volumes are face-independent, so gates follow directly
  from the 2.5mm wall (both bodies are in the 38×38 profile region at this
  height).

| Body | Slot bottom (z) | Slot spans z | Wall depth |
|------|-----------------|--------------|------------|
| `body_full_wood` (`old_body`) | 49 | 49 → 53.5 | 2.5mm (bore at x=-16.5) |
| `body_top_wood` | 49 | 49 → 53.5 | 2.5mm (bore at x=-16.5) |

## Construction

Per body, two new features (sketch + pocket):

| Body | Sketch | Pocket |
|------|--------|--------|
| `old_body` | `o_usbc` | `o_usbc_pocket` |
| `body_top_wood` | `w_usbc` | `w_usbc_pocket` |

- Sketch is a rounded rect (4 lines + 4 arcs, r=1.0, full-precision π angles),
  9.5 wide × 4.5 tall, drawn on the body's `YZ_Plane` (plane normal along X,
  spanning Y and Z), attached with `MapMode=FlatFace`,
  `AttachmentSupport=[body.Origin, "YZ_Plane"]`,
  `AttachmentOffset = Placement(Vector(0, 0, -19))`, which places the sketch
  origin at world **(-19, 0, 0)** with sketch-local X → world Y and sketch-local
  Y → world Z (verified empirically), so the slot's 9.5mm width maps to world Y
  and its 4.5mm height maps to world Z. Straight edges: bottom (−3.75,49)→
  (3.75,49), right (4.75,50)→(4.75,52.5), top (3.75,53.5)→(−3.75,53.5), left
  (−4.75,52.5)→(−4.75,50); corner arcs centered (±3.75, 50) and (±3.75, 52.5)
  with r=1.0 (this is the correct rounded-rect construction — the earlier
  scratch mistake of centering arcs at ±4.75 bows the corners outward and must
  not be used).
- Pocket cuts from the X- face inward (+X) through the wall into the bore
  (`Type="Length"`, `Length=2.5`, **`Reversed=True`**). Empirically verified on
  a scratch body: the default pocket direction is −X (opposite the YZ_Plane
  normal); at the X- face (x=-19) −X points out into empty space, so
  `Reversed=True` (cutting +X) is required to remove material. `Reversed=False`
  cuts nothing — the volume/cross-section gates catch this if it happens. (The
  X+ face needed `Reversed=False`; the X- face is the mirror image.)

## Verification (numeric only)

Primary gates — cross-section at slot mid-height shows the wall opened into the
bore; cross-sections just outside the slot range are unchanged:

| Body | z | Expected area | Meaning |
|------|---|---------------|---------|
| `old_body` | 51.25 | **554.44** | 578.19 (bore) − 23.75 (9.5×2.5 slot) |
| `old_body` | 48.0 | 578.19 | unchanged (below slot, bore region) |
| `old_body` | 55.0 | 355.0 | unchanged (above slot, square cavity) |
| `body_top_wood` | 51.25 | **554.44** | 578.19 (bore) − 23.75 (9.5×2.5 slot) |
| `body_top_wood` | 48.0 | 578.19 | unchanged (below slot, bore region) |
| `body_top_wood` | 55.0 | 355.0 | unchanged (above slot, square cavity) |

Volume gates (slot volume = 41.8916 mm² × 2.5mm wall = 104.73):

| Body | Before | Slot volume | After |
|------|--------|-------------|-------|
| `old_body` | 31322.67 | 104.73 | **31217.94** |
| `body_top_wood` | 14793.46 | 104.73 | **14688.73** |

- `Shape.isValid()` True for both; outer bbox unchanged for both.
- `body_bottom_aluminum` (14216.47), `Body` (3856.45), `Body002` (3590.30) untouched.
- Tolerances: volume ±0.1 mm³, cross-section ±0.1 mm², bbox ±0.01 mm.

## Construction traps (bind across the whole session)

- Never assign `sk.Geometry = [...]`; use `addGeometry`/`delGeometry`.
- Do NOT `removeObject` + recreate features.
- Rounded-rect arcs use full-precision π angles; circle-only sketches stay
  circle-only. Arc centers for this slot are at x=±3.75 (NOT ±4.75).
- Sketches attach to the body Origin plane with `FlatFace` map mode + offset.
- Verify numerically after each feature (never by screenshot; agent cannot view
  images).

## Commit

- Files: only `CNC/case.FCStd`
- Message: `feat(cad): add USB-C opening to wood bodies`
