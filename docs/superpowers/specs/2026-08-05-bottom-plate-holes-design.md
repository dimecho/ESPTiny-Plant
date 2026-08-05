# Bottom_Plate two Ø10 through-holes

Date: 2026-08-05

## Goal

Add two small through-holes (~10mm each) to the `Bottom_Plate` body of
`CNC/case.FCStd`, positioned symmetrically about center and evenly spaced
from each other. The bottom plate is a separate 36x36x3mm part below the main
case body, so the body's Ø34 bore is not involved.

## Current state (verified in FreeCAD)

- `Bottom_Plate` (Body002) = profile sketch `duplicate_acrylic004`
  (Label `case_bottom001`, 36x36 rounded rect, r=3.5, at z=-10) padded 3mm
  upward: solid 36x36x3mm, z from -10 to -7, no holes.

## Change

Add two Ø10 through-holes on the 45° diagonal:

- Centers at (6.4, 6.4) and (-6.4, -6.4) in the plate sketch frame.
- Radial distance from center: 9.05mm; hole center spacing: 18.1mm.
- Inner hole edges ~4.05mm from center; outer edges ~14.05mm; ~3mm clear of
  the rounded corners (r=3.5). Nothing overlaps the plate outline.

Implementation (mirrors the existing bore pattern in Body001):

1. New sketch `bottom_holes` in Body002, attached to the plate base plane
   (XY_Plane002, AttachmentOffset z=-10), with two Ø10 circles.
2. New `bottom_holes_pocket`, Type ThroughAll, Reversed=True so it cuts
   upward through the 3mm plate.

Verify:

- Plate solid bbox unchanged: (-18, -18, -10, 18, 18, -7).
- Bottom face (z=-10) and top face (z=-7) each show 3 wires: outer rect +
  two holes.
- Volume = plate volume minus two Ø10x3 cylinders
  (1285.48*3 - 2*pi*25*3 ≈ 3385.2 mm^3).
- File saves cleanly with no invalid features.

## Out of scope

- Main case body, bore, cavity, and acrylic plate are untouched.
- Hole size/spacing beyond the approved values.

## Success criteria

- Two clean Ø10 holes present, symmetric about center on the diagonal.
- File saves cleanly, all features valid.
