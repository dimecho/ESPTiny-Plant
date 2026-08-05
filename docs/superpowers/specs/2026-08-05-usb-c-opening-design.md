# USB-C Opening Design

Date: 2026-08-05

Status: Approved

## Goal

Add a USB-C receptacle opening (a pass-through slot) on the **Y+ side wall** of
both `body_full_wood` (`old_body`) and `body_top_wood`, cutting through the wall
into the cylindrical bore chamber. The slot's **bottom edge sits at each body's
bore start** (the lowest point of the interior chamber).

## Context

- `body_full_wood` (`old_body`): full single body, 38×38×60, bore Ø33 spanning
  z=3..54 (bore starts at **z=3**), wall between the Y+ face (y=19) and the bore
  (y=16.5) is 2.5mm thick over the slot height. 4×Ø2.5 pilots at (±15,±15),
  z=3..9 (clear of the slot).
- `body_top_wood`: top half, z=30..60, bore Ø33 spanning z=30..54 (bore starts at
  **z=30**, its bottom face). Wall is 1.5mm thick in the tail region (z=30..34,
  36×36) and 2.5mm in the profile region (z=34+).
- Both bodies are editable PartDesign bodies; new features follow the file's
  sketch convention. Other objects (aluminum half, plate, acrylic) are untouched.

## Geometry

A **9.5 × 4.5 mm** rounded slot, corner radius **r=1.0**, centered on the Y+ face
(y=19), spanning x ∈ [−4.75, +4.75], bottom edge at the bore start, cutting
**through the wall into the bore** (an open pass-through connecting the chamber
to the outside). No recess/counterbore for a connector flange (YAGNI).

| Body | Slot bottom (z) | Slot spans z | Wall depth |
|------|-----------------|--------------|------------|
| `body_full_wood` (`old_body`) | 3 | 3 → 7.5 | 2.5mm constant |
| `body_top_wood` | 30 | 30 → 34.5 | 1.5mm (z=30..34), 2.5mm (z=34..34.5) |

## Construction

Per body, two new features (sketch + pocket):

| Body | Sketch | Pocket |
|------|--------|--------|
| `old_body` | `o_usbc` | `o_usbc_pocket` |
| `body_top_wood` | `w_usbc` | `w_usbc_pocket` |

- Sketch is a rounded rect (4 lines + 4 arcs, r=1.0, full-precision π angles),
  9.5 wide × 4.5 tall, drawn on the body's `XZ_Plane` (plane normal along Y,
  spanning X and Z), attached with `MapMode=FlatFace`,
  `AttachmentSupport=[body.Origin, "XZ_Plane"]`,
  `AttachmentOffset = Placement(Vector(0, 19, 0))`, positioned so the slot's
  bottom edge (world z = bore start) is at the correct sketch-local coordinate.
  NOTE: on `XZ_Plane` the sketch-local Y axis maps to world **−Z** — the plan
  must handle the sign; numeric cross-section verification is the gate.
- Pocket cuts from the Y+ face inward through the wall into the bore
  (`Type="Length"` or `ThroughAll` direction −Y; verify by cross-section that
  the wall is opened all the way to the bore).

## Verification (numeric only)

Primary gates — cross-section at slot mid-height shows the wall opened into the
bore; cross-sections just outside the slot range are unchanged:

| Body | z | Expected area | Meaning |
|------|---|---------------|---------|
| `old_body` | 5.25 | **534.80** | 558.55 (wall+bore−pilots) − 23.75 (9.5×2.5 slot) |
| `old_body` | 2.5 | 148.0 | unchanged (bottom cavity zone, below slot) |
| `old_body` | 8.0 | 558.55 | unchanged (above slot, pilots+bore) |
| `body_top_wood` | 32.25 | **415.94** | 430.19 (tail 36sq−bore) − 14.25 (9.5×1.5 slot) |
| `body_top_wood` | 35.0 | 578.19 | unchanged (above slot, profile wall+bore) |
| `body_top_wood` | 40.0 | 578.19 | unchanged (mid chamber) |

Volume gates (slot volume = 41.8916 mm² × effective wall depth):

| Body | Before | Slot volume | After |
|------|--------|-------------|-------|
| `old_body` | 31322.67 | 104.73 | **31217.94** |
| `body_top_wood` | 14793.46 | 67.16 | **14726.30** |

- `Shape.isValid()` True for both; outer bbox unchanged for both.
- `body_bottom_aluminum` (14216.47), `Body` (3856.45), `Body002` (3590.30) untouched.
- Tolerances: volume ±0.1 mm³, cross-section ±0.1 mm², bbox ±0.01 mm.

## Construction traps (bind across the whole session)

- Never assign `sk.Geometry = [...]`; use `addGeometry`/`delGeometry`.
- Do NOT `removeObject` + recreate features.
- Rounded-rect arcs use full-precision π angles; circle-only sketches stay
  circle-only.
- Sketches attach to the body Origin plane with `FlatFace` map mode + offset.
- Verify numerically after each feature (never by screenshot; agent cannot view
  images).

## Commit

- Files: only `CNC/case.FCStd`
- Message: `feat(cad): add USB-C opening to wood bodies`
