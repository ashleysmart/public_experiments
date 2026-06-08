# Micro Spec: Dice Forge

## Goal

A minimal, client-side tap-to-roll dice tray, inspired by Google's d20 roller widget.
Two panels: a pile of rolled dice/tokens color-coded by group, and a button panel that
populates it.

## Product Shape

- Plain HTML, CSS, and JavaScript
- No backend, no build step
- Runs directly in the browser as a single static page
- Mobile-friendly

## Layout

The app is a single column shell with two panels:

1. **Dice panel** (top) — a scrollable pile of rolled dice and bonus tokens, a Clear
   button, and a footer row of running per-group totals.
2. **Button panel** (bottom) — three rows of controls:
   - **Dice row**: d20, d12, d10, d8, d6, d4
   - **Bonus row**: tokens that drop an *exact* numeric value into the pile (no roll),
     plus a `+` button to add new tokens
   - **Group row**: color-coded group buttons (default labels A–E) plus a `+` button to
     add new groups

## Interaction Model

- Tapping a **group button** makes it the active group; new entries are tagged with
  that group's color and label.
- Tapping a **dice button** rolls that die and drops a tile into the pile (die-type
  label + result), colored by the active group.
- Tapping a **bonus token** drops a round token showing its exact value into the pile,
  colored by the active group.
- Tapping an entry already in the **dice pile** removes it; totals update immediately.
- **Clear** empties the whole pile.
- **Long-press or right-click a group button** opens a popover with a native color
  picker and a short text field to rename the group's label. New groups are
  auto-assigned the next unused letter and a palette color.
- **Long-press or right-click a bonus token** opens a popover to edit its numeric value
  or delete it.

## Die Roll Animation

Tapping a die button drops a tile that:

1. Spins as a solid, color-filled polygon (matching the die's side count) with no
   number visible.
2. Settles into an outline-only polygon with the rolled number and die type shown on
   top.

## Damage / Group Totals

- The dice panel footer shows one chip per group that has at least one entry in the
  pile, displaying the group's letter/label, color, and running total.
- Totals recompute whenever entries are added or removed.

## Data Model

Tray state is a single JSON object:

```json
{
  "activeGroupId": "uuid",
  "groups": [
    { "id": "uuid", "label": "A", "color": "#e6483c" }
  ],
  "bonusTokens": [
    { "id": "uuid", "value": 1 }
  ],
  "entries": [
    { "id": "uuid", "kind": "die", "sides": 20, "value": 14, "groupId": "uuid" },
    { "id": "uuid", "kind": "token", "value": 2, "groupId": "uuid" }
  ]
}
```

## Persistence

- Entire tray state (active group, groups, bonus tokens, current pile) is persisted to
  `localStorage` under a single key.
- State is normalized defensively on load; missing or invalid fields fall back to
  sensible defaults (five lettered groups with palette colors, `+1`/`+2` bonus tokens,
  an empty pile).
- Every action that changes state (rolling, adding tokens, removing entries, clearing,
  editing/adding groups or tokens) persists immediately.

## Layout Requirements

- Keep the page visually short and focused — a compact, smartphone-style shell
- Single column: dice panel flexes to fill height, button panel stays pinned below
- Support small mobile screens without horizontal overflow

## Non-Goals

- No backend sync, accounts, or multiplayer
- No dice equations, damage types, or saved sets
- No roll history (the pile *is* the current state)

## Acceptance Criteria

- Selecting a group, then tapping a die or token, adds a correctly colored entry to
  the pile
- Tapping a pile entry removes it and updates totals
- Clear empties the pile
- Group and bonus token popovers allow live editing (color/label, value/delete)
- Tray state (groups, tokens, pile, active group) survives reload
- Die tiles spin as a filled polygon, then settle into an outline with the result shown
- The page remains usable on mobile widths
