# Enlarge case_body geometry ~5mm per side

Date: 2026-08-05

## Goal

Make the main case body (`case_body`, in-memory pad `side_acrylic003`) of
`CNC/case.FCStd` larger by ~5mm on all four horizontal sides. Height (40mm)
unchanged. The acrylic face plate (`case_acrylic`, 28x28mm, 3mm thick) is
NOT modified.

## Current state (verified in FreeCAD)

- case_body pad renders as a 28x28x40mm rounded-rectangle solid (corner radius
  3.5mm, symmetric about origin, z from 0 to 40).
- The pad's profile sketch `duplicate_acrylic003` (Label `case_body001`) is
  broken: it is saved as Invalid with error "Wire is not closed." Its edges do
  not join into a closed wire (5 open wires), so the pad cannot build from it
  and retains its previous cached 28mm shape. The broken sketch is ~31mm and
  asymmetric — a half-finished edit, not an intentional design.

## Change

Rebuild the profile sketch `duplicate_acrylic003` as a clean, fully closed
rounded rectangle:

- Width/depth: 38 x 38 mm (28 + 5 each side = 38), centered at origin
  (x from -19 to +19, y from -19 to +19).
- Corner radius: 3.5mm (kept, matches the acrylic plate).
- Height: unchanged (pad Length 40mm).
- Sketch constraints: none exist, so none are affected.

Implementation: replace the sketch's 8 geometry elements (4 lines + 4 corner
arcs) with exactly-closed equivalents, then touch/recompute so the pad and
`Body001` rebuild into a valid 38x38x40 solid. Verify:

- Sketch forms a single closed wire.
- Pad bounding box = (-19, -19, 0, 19, 19, 40), volume matches a
  38x38 rounded rect (r=3.5) extruded 40mm.
- No FreeCAD error flags on the pad.

## Out of scope

- case_acrylic plate (28x28x3) — intentionally unchanged; body gains a ~5mm
  rim around the plate.
- Height of the body.

## Success criteria

- case_body solid is 38x38x40mm.
- File saves cleanly with no invalid features.
