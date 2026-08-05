# Two-part case body: wood top + aluminum bottom

Date: 2026-08-05

## Goal

Split the single 38x38x60mm case body (`Body001`, label "Body") of
`CNC/case.FCStd` into two equal halves at the horizontal mid-plane (z=30):

- **Top half** z=30..60 — **wood** material.
- **Bottom half** z=0..30 — **aluminum** material.

All existing cavities and holes are preserved, split between the halves as
listed below, and the halves nest together with an alignment lip/step and
adhesive (no screws between the halves).

## Current state (verified in FreeCAD)

- `Body001` ("Body") = 38x38x60mm rounded box (corner r=3.5), z=0..60,
  volume 31440.48 mm^3, containing:
  - Bottom cavity: 36x36 rounded rect (r=3.5), z=0..3.
  - Ø33 bore (r=16.5): z=3..54.
  - Square cavity: 33x33 rounded rect (r=3.5), z=54..57.
  - Top cavity: 36x36 rounded rect (r=3.5), z=57..60.
  - 4x Ø2.5 blind screw pilots at (±15, ±15): z=3..9 (mates with the 4x
    Ø3.2 holes in `Bottom_Plate`, Body002).
- `Body002` (`Bottom_Plate`): 36x36x3mm, z=-10..-7, 2x Ø6 drain + 4x Ø3.2
  screw holes, unchanged by this task.
- Acrylic top plate body ("Top_Acrylic"): 36x36x3mm at z=65..68, unchanged.

## Change

Replace `Body001` with two new bodies:

### Bottom half — `body_bottom_aluminum` (z=0..30)

- 38x38x30 rounded box (r=3.5), z=0..30.
- Bottom cavity: 36x36 (r=3.5), z=0..3.
- Ø33 bore (r=16.5), z=3..30.
- 4x Ø2.5 screw pilots at (±15, ±15), z=3..9.
- Alignment recess: 36x36 (r=3.5), 4mm deep, z=26..30. Leaves a 1mm rim
  (38x38 outer -> 36x36 recess). Bore continues through the recess floor, so
  the recess floor is an annulus between the 36x36 square and the Ø33 bore.

### Top half — `body_top_wood` (z=30..60)

- 38x38x30 rounded box (r=3.5), z=30..60.
- Alignment tail: bottom 4mm (z=30..34) reduced to 36x36 (r=3.5), a 1mm step
  per side. Nests into the aluminum recess.
- Ø33 bore (r=16.5), z=30..54 (passes through the tail too, keeping the
  interior chamber continuous).
- Square cavity: 33x33 (r=3.5), z=54..57.
- Top cavity: 36x36 (r=3.5), z=57..60.

### Mating and structure

- Wood tail slides into the aluminum recess; bore continues through both, so
  the interior chamber is continuous.
- Adhesive on the flat contact faces (tail sides + tail floor against recess
  floor). No fasteners between the halves.
- Wood wall between bore and tail outer face is 1.5mm over the 4mm-tall tail
  (reinforced by the nesting aluminum rim); above z=34 the wood wall is back
  to 2.5mm.

## Construction approach

Build each half with Part primitives + boolean operations (no new sketches):

1. Rounded box helper (38x38 rect, r=3.5 fillet on the four vertical edges),
   extruded to the half height.
2. Fuse the 36x36 tail box onto the wood blank (or cut the 36x36 recess out
   of the aluminum blank) as applicable.
3. Boolean-cut the bore cylinder, cavities, recess, and pilots.
4. Verify each half by volume against manual boolean math before saving.

This avoids the sketch feature-chain corruption encountered earlier
(do not `removeObject`/recreate bore features; do not assign
`sk.Geometry = [...]` lists).

## Verification

- Bottom half bbox: (-19, -19, 0, 19, 19, 30) — note: 38x38 box spans
  ±19 about the body origin.
- Top half bbox: (-19, -19, 30, 19, 19, 60).
- Wood: outer bbox 38x38x30 with a 36x36 step over the bottom 4mm; bore Ø33
  open through z=30..54; square cavity 33x33 at z=54..57; top cavity 36x36 at
  z=57..60.
- Aluminum: 38x38x30 with 36x36 recess z=26..30; bore Ø33 z=3..30; pilots
  Ø2.5 z=3..9; bottom cavity z=0..3.
- Volumes match manual boolean math for each half (see implementation plan).
- All features valid; file saves cleanly.
- Old `Body001` removed; `Bottom_Plate` and acrylic untouched.

## Out of scope

- Acrylic top plate, bottom plate, drain/screw holes: unchanged.
- Screws joining the two halves: not used (adhesive + lip).
- Changing the 38x38x60 envelope or the Ø33 bore / cavity geometry.

## Success criteria

- Two valid bodies, wood top (z=30..60) and aluminum bottom (z=0..30), each
  with the correct cavities and holes.
- Tail/recess mate exactly (1mm step, r=3.5 corners, Ø33 bore aligned).
- Interior chamber continuous through the split.
- File saves cleanly; old single body gone.
