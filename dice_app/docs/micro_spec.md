# Micro Spec: Dice Forge

## Goal

Build a static, client-side DnD dice roller with a minimal mobile-style screen, reorderable square dice-group tiles, critical-roll support, damage-type aggregation, and client-side persistence.

## Product Shape

- Plain HTML, CSS, and JavaScript
- No backend
- Runs directly in the browser
- Mobile-friendly
- Works as a single static app page

## Core Interaction Model

- The main page should read like a smartphone-style game utility
- The center of the screen is a compact 2-column grid of dice-group tiles
- A right-edge handle opens saved sets
- A floating right-side roll control triggers rolls for selected groups
- Result and history panels should only appear after they are relevant
- Remove decorative or repetitive header content that does not support rolling

## Dice Group Tiles

Each dice group is represented by a square tile in a 2D grid.

Each group must support:

- Group name
- 3-character short name
- Dice equation
  - examples: `2d6+4`, `d20+7`, `3d8-1`
- Flat numeric adjustment
- Damage type
  - examples: `slashing`, `fire`, `force`
- Selected state for combined rolling

## Tile Behaviour

Closed state:

- Every dice group starts closed
- Closed dice groups are square tiles
- A closed tile shows only:
  - the 3-character short label
  - the include checkbox
  - the expand button
- Tapping the closed tile toggles the checkbox selection state
- Tapping the expand button opens the tile into the full editor

Expanded state:

- An expanded tile becomes a full-width editor card inside the same grid
- The expanded card exposes:
  - group name
  - dice equation
  - damage type
  - adjustment
  - remove action
- The collapse button closes the expanded card back to a square tile

Drag behaviour:

- Closed or expanded dice-group tiles can be dragged
- Dragging a tile changes its location in the 2D grid
- Reordering must update the underlying JSON array order
- The visual order after drag-drop must match saved JSON order

Add tile:

- The add-group control appears in the same grid as the dice-group tiles
- It should not be visually separated by an extra block or wrapper gap
- It should look like another square tile, but with `New` and `+`

## Group JSON Model

Configured dice groups are driven by a JSON structure.

Canonical group shape:

```json
{
  "id": "uuid",
  "name": "Greatsword",
  "modifier": 0,
  "equation": "2d6+4",
  "damageType": "slashing",
  "selected": true
}
```

Requirements:

- Render tiles in the same order as the JSON array
- Use that array as the single source of truth for configured tiles
- Normalize invalid or missing fields on load
- Force groups to restore in the closed state on load

## Group Ordering

- Users must be able to drag group tiles to new positions in the grid
- Reordering a tile must reorder the underlying JSON array
- The visual order after drag-drop must match the saved JSON order
- Reordered groups must remain in the same order after reload

## Preconfigured Groups

- The app should ship with starter groups on first load
- Starter groups should be expressed with the same JSON group structure used by live state

## Rolling

### Combined Roll

- Users can roll all selected groups together
- Users can crit all selected groups together
- Combined rolls should preserve per-group breakdowns

## Critical Rules

- Critical mode doubles dice terms only
- Critical mode does not double flat numeric adjustments
- This applies to:
  - equation-derived dice
  - single-group rolls
  - combined rolls

## Damage Type Aggregation

- Every group has a damage type
- Combined results must sum totals by damage type
- Result displays must show aggregated damage totals
- History entries must also show damage totals by type
- If no damage type is provided, treat it as `untyped`

## Result Display

After every roll a result panel appears inline below the group panels.

Each roll result must display:

- Label for the roll (group name for single rolls, "Combined Roll" for multi-group)
- Timestamp and roll mode (Normal / Crit / Adv / Disadv)
- Whether the roll was critical
- Overall total (prominent)
- Per-group breakdown:
  - Group name and damage type
  - Equation and modifier context
  - Individual dice values
  - Group subtotal
- Spinner visualisation per group (see Spinner Visualisation)
- Damage totals grouped by damage type (tag row)

## Spinner Visualization

- Each rolled group should render as one composite spinner
- A spinner contains multiple dials, one per dice term
- Combined rolls should show multiple spinners, one per rolled group
- Spinner visuals are a presentation layer only; totals are driven by roll logic

## History

- Maintain a visible roll history log
- Newest entries first
- Each entry includes:
  - timestamp
  - roll label
  - per-group summary
  - total
  - grouped damage totals
- History only needs to persist for the current page session

## Saved Sets Drawer

- A right-side drawer stores named saved sets
- A fixed edge handle should open the drawer
- The drawer should support:
  - save current configured groups as a named set
  - load a saved set
  - delete a saved set
- The drawer should close via:
  - close button
  - backdrop click
  - Escape key

Saved set shape:

```json
{
  "id": "uuid",
  "name": "Boss opener",
  "groups": [
    {
      "id": "uuid",
      "name": "Greatsword",
      "modifier": 0,
      "equation": "2d6+4",
      "damageType": "slashing",
      "selected": true
    }
  ]
}
```

## Client-Side Persistence

Persist data in browser local storage.

Required persisted data:

- Current configured groups
- Saved sets

Persistence requirements:

- Current groups must restore after reload
- Saved sets must restore after reload
- Edits to groups must persist immediately
- Group add/remove actions must persist immediately
- Reordering must persist immediately
- Loading a saved set must replace current groups and persist them

## Layout Requirements

- Keep the page visually short and focused
- Use a compact smartphone-like shell and proportions
- Use a 2-column square-tile grid for dice groups
- Closed tiles should remain true squares
- The add tile should sit in the same grid with no separating block between it and the dice groups
- Avoid non-functional hero sections and redundant headers
- Support small mobile screens without horizontal overflow

## Non-Goals

- No backend sync
- No accounts
- No multiplayer
- No server persistence

## Acceptance Criteria

- A user can configure groups entirely through expanded tiles
- A user can reorder tiles by drag-and-drop
- Tile order always matches the stored JSON array
- The current tile configuration survives reload
- Saved sets survive reload
- Combined rolls show damage totals grouped by type
- Critical rolls double dice but not flat adjustments
- The page remains usable on mobile
