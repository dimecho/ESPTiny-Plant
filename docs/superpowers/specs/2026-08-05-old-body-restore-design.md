# Old Body Restore Design

Date: 2026-08-05

Status: Approved

## Goal

Restore the original single-piece case body (the one that existed before the
two-part split) into `CNC/case.FCStd` as a **hidden, fully editable**
`PartDesign::Body`. It serves as a geometry-only reference/datum object: present
in the model tree, not visible in the 3D view, overlapping the two split halves
without participating in any boolean.

## Context

- Original body (pre-split `Body001`) was deleted in two parts of history:
  the body itself at commit `0a5ea00`, its 10 orphaned features + 2 extra
  orphans at `ea13976`.
- The file now contains `Body` (top acrylic), `Body002` (bottom plate),
  `body_top_wood`, `body_bottom_aluminum` (both editable PartDesign bodies).
- The current request: get the original single body back, hidden as an object.
  This overrides the earlier parts-only convention.

## Decisions

| # | Decision |
|---|----------|
| 1 | Rebuild as an editable `PartDesign::Body`, matching the construction pattern of the two halves (sketches on `XY_Plane`, `FlatFace` map mode, `AttachmentOffset` at target z). |
| 2 | Internal name and label: `old_body`. Hidden by default (`ViewObject.Visibility = False`). |
| 3 | Rebuild the true original geometry, including the 4 screw pilots. |
| 4 | Only `CNC/case.FCStd` is touched; no other files. |

## Geometry

Single body, 38×38×60 mm rounded box (corner r=3.5), z=0..60, with all
cavities cut (feature chain in build order):

| Feature | Sketch content | Sketch z | Pocket length | Cuts |
|---------|----------------|----------|---------------|------|
| `o_profile` + `o_profile_pad` | rounded rect 38×38, r=3.5 | 0 | pad 60 | z=0..60 |
| `o_botcav` + `o_botcav_pocket` | rounded rect 36×36, r=3.5 | 0 | 3 | z=0..3 |
| `o_bore` + `o_bore_pocket` | circle Ø33 | 3 | 51 | z=3..54 |
| `o_sq` + `o_sq_pocket` | rounded rect 33×33, r=3.5 | 54 | 3 | z=54..57 |
| `o_top` + `o_top_pocket` | rounded rect 36×36, r=3.5 | 57 | 3 | z=57..60 |
| `o_pilots` + `o_pilots_pocket` | 4 circles Ø2.5 at (±15,±15) | 3 | 6 | z=3..9 |

Pockets use `Reversed=True` (cut in +Z from sketch plane), exactly like the
halves. No two cut features overlap in XY, so order among pockets is irrelevant.

### Volume note

The split spec documented the original body volume as **31440.48**, but that
number computes *without* the pilots. The true original body (with the 4×Ø2.5
pilots) computes to **≈31322.67**:

```
38x38 pad (1433.4845 x 60)           = 86009.07
- bottom cavity (1285.4845 x 3)      =  3856.45
- bore (855.2986 x 51)               = 43620.23
- square cavity (1078.4845 x 3)      =  3235.45
- top cavity (1285.4845 x 3)         =  3856.45
- pilots (19.635 x 6)                =   117.81
                                       --------
body                                  = 31322.67
```

The restored body is built with the pilots (matching the real original) and
verified against this computed value.

## Verification (numeric only)

- `Shape.Volume` ≈ 31322.67 (±0.01)
- `Shape.BoundBox` = (-19, -19, 0) .. (19, 19, 60)
- `Shape.isValid()` = True
- Cross-section areas via `shape.common(Part.Face(Part.Plane(...))).Area`:
  - z=1  → 148.0   (bottom cavity: 38sq − 36sq)
  - z=6  → 558.55  (wall+bore − 4 pilots: 578.19 − 19.635)
  - z=20 → 578.19  (wall+bore: 1433.4845 − 855.2986)
  - z=55 → 355.0   (square cavity: 38sq − 33sq)
  - z=58 → 148.0   (top cavity: 38sq − 36sq)
- No image-based checks; screenshots are not available to the agent.

## Construction traps (bind across the whole session)

- Never assign `sk.Geometry = [...]` directly; use `addGeometry`/`delGeometry`.
- Do NOT `removeObject` + recreate features; build once, in order.
- Rounded-rect corners: 4 arcs with full-precision π angles.
- Circle-only sketches (bore, pilots) contain ONLY circles.
- After each pocket, `doc.recompute()` and confirm volume before continuing.

## Commit

- Files: only `CNC/case.FCStd`
- Message: `feat(cad): restore original single case body as hidden object`
