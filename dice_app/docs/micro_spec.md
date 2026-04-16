# Micro Spec: DnD Dice Rolling Web App

## Goal

Build a static, client-side Dungeons & Dragons dice rolling web app using HTML, CSS, and JavaScript. The app should feel polished and usable without any backend.

## Core User Outcome

A user can define one or more dice groups, configure how each group behaves, combine groups into a single roll, apply critical hit rules correctly, and review a roll history log.

## Product Requirements

### 1. Static Web App

- Runs entirely in the browser
- No server or database required
- Implemented as a plain HTML, CSS, and JavaScript page

### 2. Dice Groups

- A group represents a reusable set of dice plus an optional flat adjustment
- Users can create groups dynamically
- Users can edit or remove groups
- The UI includes several preconfigured starter groups on first load
- Each group should support common DnD die types:
  - `d4`
  - `d6`
  - `d8`
  - `d10`
  - `d12`
  - `d20`
  - `d100`

### 3. Group Configuration

Each group should allow the user to configure:

- Group name
- Quantity for each die type
- Flat numeric adjustment
- Whether the group is selected for a combined roll

### 4. Combined Rolling

- Users can roll a single group independently
- Users can select multiple groups and roll them together as one combined roll
- A combined roll should:
  - include all dice from selected groups
  - include all flat adjustments from selected groups
  - show both per-group breakdown and total result

### 5. Group Functions

The app must support applying roll functions at the group level.

Initial required function:

- Critical hit mode

Critical hit behavior:

- Critical mode doubles the dice rolled in the group
- Critical mode does not double the flat adjustment
- This rule must work for both single-group rolls and combined rolls

Optional implementation detail:

- Critical mode can be applied per group at roll time or be stored as part of the group state, as long as behavior is clear in the UI

### 6. Roll Results

Each roll result should display:

- Group name or combined roll label
- Dice rolled
- Individual die results
- Flat adjustment
- Whether critical mode was applied
- Final total

### 7. Roll History

- The app must maintain a visible roll history log
- Each log entry should include:
  - timestamp or relative ordering
  - rolled group or combined roll name
  - breakdown of dice and modifiers
  - final total
- Newest rolls should appear first
- History only needs to persist for the current browser session unless local persistence is added as an enhancement

## UX Requirements

- The page should look intentionally designed, not like a raw form demo
- Must be usable on desktop and mobile screen sizes
- Core actions should be obvious:
  - add group
  - configure group
  - select groups
  - roll selected groups
  - trigger critical rolls
  - inspect history

## Non-Goals

- No multiplayer support
- No account system
- No backend persistence
- No character-sheet integration in the first version

## Acceptance Criteria

- A user can create a new dice group without editing code
- A user can start from at least a few preconfigured groups
- A user can select multiple groups and roll them as a single result
- A critical roll doubles only dice, not flat modifiers
- The interface clearly shows how totals were computed
- The app records a visible history of previous rolls
- The app runs by opening the static page in a browser
