# Dice App Microspec

## Scope
- Applies to `dice_app`.
- Covers local persistence, group editing, dice tray color assignment, and post-roll settle behavior.

## Group Model
- Each group stores:
  - `id`
  - `name`
  - `shortName`
  - `color`
  - `equation`
  - `damageType`
  - `selected`
  - `collapsed`
- `shortName` is limited to 4 alphanumeric uppercase characters.
- `color` is a hex string like `#d95f43`.

## Client Persistence
- Group state is stored in `window.localStorage` under `dice-forge-groups-v1`.
- Saved sets are stored in `window.localStorage` under `dice-forge-saved-sets-v1`.
- Any user edit to a group must persist immediately on the client:
  - name
  - short name
  - equation
  - damage type
  - color
  - selected state
  - collapsed state
  - reorder
  - add/remove
- If stored group JSON is missing, invalid, or empty, the app must fall back to starter groups and re-seed local storage with valid JSON.

## Group UI
- Expanded cards expose a color picker that controls the group dice color.
- Collapsed cards show a small dot using the group color.
- Group tiles fill the available page width.

## Dice Tray
- Dice colors are assigned per group, not per die type.
- Every die rolled from a given group uses that group's color.
- The tray uses the prerolled result from app state and must snap each die to the matching face-up orientation.

## Dice Settle Rules
- Dice may move only during an active roll.
- Once a die reaches its snapped face-up orientation:
  - all translation velocity is zero
  - all angular velocity is zero
  - the die is marked settled
- Once all dice in a roll are settled:
  - the tray animation frame loop stops
  - the rendered scene remains static
  - no idle drift or decorative rotation is allowed

## History Sheet
- The history sheet is hidden when there are no results.
- New rolls append to history but do not forcibly reopen the sheet.
- The sheet opens only via explicit user interaction.
- The visible sheet remains compact and scrollable for older entries.
