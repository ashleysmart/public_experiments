const DICE_ROW_SIDES = [20, 12, 10, 8, 6, 4];
const STORAGE_KEY = "dice-forge-tray-v1";
const COLLAPSED_KEY = "dice-forge-collapsed-v1";
const LONG_PRESS_MS = 480;
const HISTORY_LIMIT = 50;
const HISTORY_RECORD_DELAY_MS = 1500;
const PRESS_MOVE_TOLERANCE = 8;

// Spin duration must match the .dice-tile--rolling animation in styles.css —
// after it elapses the tile swaps from a spinning solid shape to a static outline+number.
const DIE_SPIN_MS = 560;

const GROUP_PALETTE = [
  "#e6483c", // red
  "#3a8bdc", // blue
  "#3aa66a", // green
  "#f0b429", // amber
  "#9b6bdb", // purple
  "#ec6fae", // pink
  "#3fc1c9", // teal
  "#f08c3a", // orange
];

const SVG_NS = "http://www.w3.org/2000/svg";

// crypto.randomUUID is only defined in secure contexts (HTTPS or localhost);
// fall back to a manual id so the app also works over plain HTTP on other hosts.
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const dicePileEl = document.querySelector("#dice-pile");
const totalsEl = document.querySelector("#dice-totals");
const diceRowEl = document.querySelector("#dice-row");
const bonusRowEl = document.querySelector("#bonus-row");
const groupRowEl = document.querySelector("#group-row");
const sortButton = document.querySelector("#sort-button");
const duplicateButton = document.querySelector("#duplicate-button");
const halveButton = document.querySelector("#halve-button");
const rerollButton = document.querySelector("#reroll-button");
const clearButton = document.querySelector("#clear-button");
const presetRowEl = document.querySelector("#preset-row");
const presetSaveButton = document.querySelector("#preset-save-button");
const historyListEl = document.querySelector("#history-list");
const historyDrawerEl = document.querySelector("#history-drawer");
const historyTabButton = document.querySelector("#history-tab");
const popoverEl = document.querySelector("#editor-popover");

function createDefaultGroups() {
  return ["A", "B", "C", "D", "E"].map((label, index) => ({
    id: createId(),
    label,
    color: GROUP_PALETTE[index % GROUP_PALETTE.length],
  }));
}

function createDefaultBonusTokens() {
  return [
    { id: createId(), value: 1 },
    { id: createId(), value: 2 },
  ];
}

function createDefaultState() {
  const groups = createDefaultGroups();
  return {
    activeGroupId: groups[0].id,
    groups,
    bonusTokens: createDefaultBonusTokens(),
    entries: [],
    presets: [],
    history: [],
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length === 0) {
      return createDefaultState();
    }

    const groups = parsed.groups.map((group, index) => ({
      id: typeof group?.id === "string" && group.id ? group.id : createId(),
      label:
        typeof group?.label === "string" && group.label.trim()
          ? group.label.trim().slice(0, 4)
          : String.fromCharCode(65 + (index % 26)),
      color:
        typeof group?.color === "string" && /^#[0-9a-f]{6}$/i.test(group.color.trim())
          ? group.color.trim().toLowerCase()
          : GROUP_PALETTE[index % GROUP_PALETTE.length],
    }));
    const groupIds = new Set(groups.map((group) => group.id));

    const bonusTokens =
      Array.isArray(parsed.bonusTokens) && parsed.bonusTokens.length > 0
        ? parsed.bonusTokens.map((token) => ({
            id: typeof token?.id === "string" && token.id ? token.id : createId(),
            value: Number.isFinite(token?.value) ? Math.trunc(token.value) : 1,
          }))
        : createDefaultBonusTokens();

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .filter(
            (entry) =>
              entry && (entry.kind === "die" || entry.kind === "token") && Number.isFinite(entry.value)
          )
          .map((entry) => ({
            id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
            kind: entry.kind,
            sides: entry.kind === "die" ? Number(entry.sides) : undefined,
            value: Math.trunc(entry.value),
            groupId: groupIds.has(entry.groupId) ? entry.groupId : groups[0].id,
          }))
      : [];

    const presets = Array.isArray(parsed.presets)
      ? parsed.presets
          .filter((preset) => preset && Array.isArray(preset.entries))
          .map((preset, index) => ({
            id: typeof preset.id === "string" && preset.id ? preset.id : createId(),
            label:
              typeof preset.label === "string" && preset.label.trim()
                ? preset.label.trim().slice(0, 12)
                : `P${index + 1}`,
            color:
              typeof preset.color === "string" && /^#[0-9a-f]{6}$/i.test(preset.color.trim())
                ? preset.color.trim().toLowerCase()
                : GROUP_PALETTE[index % GROUP_PALETTE.length],
            entries: preset.entries
              .filter(
                (entry) =>
                  entry &&
                  ((entry.kind === "die" && Number.isFinite(entry.sides)) ||
                    (entry.kind === "token" && Number.isFinite(entry.value)))
              )
              .map((entry) => ({
                kind: entry.kind,
                sides: entry.kind === "die" ? Number(entry.sides) : undefined,
                value: entry.kind === "token" ? Math.trunc(entry.value) : undefined,
                groupId: groupIds.has(entry.groupId) ? entry.groupId : groups[0].id,
              })),
          }))
      : [];

    const history = Array.isArray(parsed.history)
      ? parsed.history
          .filter((item) => item && Array.isArray(item.entries) && item.entries.length > 0)
          .map((item) => ({
            id: typeof item.id === "string" && item.id ? item.id : createId(),
            time: Number.isFinite(item.time) ? item.time : Date.now(),
            entries: item.entries
              .filter(
                (entry) =>
                  entry &&
                  (entry.kind === "die" || entry.kind === "token") &&
                  Number.isFinite(entry.value)
              )
              .map((entry) => ({
                kind: entry.kind,
                sides: entry.kind === "die" ? Number(entry.sides) : undefined,
                value: Math.trunc(entry.value),
                groupId: groupIds.has(entry.groupId) ? entry.groupId : groups[0].id,
              })),
            sums: Array.isArray(item.sums)
              ? item.sums
                  .filter((sum) => sum && Number.isFinite(sum.sum))
                  .map((sum) => ({
                    label: typeof sum.label === "string" ? sum.label.slice(0, 4) : "?",
                    color:
                      typeof sum.color === "string" && /^#[0-9a-f]{6}$/i.test(sum.color)
                        ? sum.color.toLowerCase()
                        : GROUP_PALETTE[0],
                    sum: Math.trunc(sum.sum),
                  }))
              : [],
          }))
          .filter((item) => item.entries.length > 0)
          .slice(0, HISTORY_LIMIT)
      : [];

    return {
      activeGroupId: groupIds.has(parsed.activeGroupId) ? parsed.activeGroupId : groups[0].id,
      groups,
      bonusTokens,
      entries,
      presets,
      history,
    };
  } catch {
    return createDefaultState();
  }
}

let recordingHistory = false;
let historyTimer = null;

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist tray state", error);
  }
  // Every pile change goes through saveState, so use it as the trigger for
  // recording a history snapshot once the pile has settled.
  if (!recordingHistory) {
    scheduleHistoryRecord();
  }
}

const state = loadState();
const selectedTotalGroupIds = new Set();
const pileTiles = new Map();
const groupButtons = new Map();
const bonusButtons = new Map();
const presetButtons = new Map();

function findGroup(groupId) {
  return state.groups.find((group) => group.id === groupId) ?? state.groups[0];
}

function nextGroupLabel() {
  const used = new Set(state.groups.map((group) => group.label.trim().toUpperCase()));
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index);
    if (!used.has(letter)) {
      return letter;
    }
  }
  return String(state.groups.length + 1);
}

function formatBonusValue(value) {
  return value > 0 ? `+${value}` : String(value);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function regularPolygonPoints(sides) {
  const count = Math.max(3, sides);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const x = (50 + 46 * Math.cos(angle)).toFixed(1);
    const y = (50 + 46 * Math.sin(angle)).toFixed(1);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

// Detects a tap vs. a long-press/right-click on the same control, and suppresses
// the trailing click after a long-press fires so the primary action doesn't also run.
function bindPressActions(element, { onTap, onLongPress }) {
  let timer = null;
  let longPressed = false;
  let startX = 0;
  let startY = 0;

  const clearTimer = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    longPressed = false;
    startX = event.clientX;
    startY = event.clientY;
    timer = window.setTimeout(() => {
      timer = null;
      longPressed = true;
      onLongPress(element);
    }, LONG_PRESS_MS);
  });

  element.addEventListener("pointermove", (event) => {
    if (timer === null) {
      return;
    }
    if (
      Math.abs(event.clientX - startX) > PRESS_MOVE_TOLERANCE ||
      Math.abs(event.clientY - startY) > PRESS_MOVE_TOLERANCE
    ) {
      clearTimer();
    }
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
    element.addEventListener(type, clearTimer);
  });

  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    clearTimer();
    longPressed = true;
    onLongPress(element);
  });

  element.addEventListener("click", () => {
    if (longPressed) {
      longPressed = false;
      return;
    }
    onTap();
  });
}

let closePopoverListeners = null;

function closePopover() {
  if (closePopoverListeners) {
    closePopoverListeners();
    closePopoverListeners = null;
  }
  popoverEl.classList.add("popover--hidden");
  popoverEl.innerHTML = "";
}

function positionPopover(anchorEl) {
  const anchorRect = anchorEl.getBoundingClientRect();
  const popoverRect = popoverEl.getBoundingClientRect();

  let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popoverRect.width - 8));

  let top = anchorRect.top - popoverRect.height - 10;
  if (top < 8) {
    top = anchorRect.bottom + 10;
  }

  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
}

function openPopover(anchorEl, build) {
  closePopover();
  popoverEl.classList.remove("popover--hidden");
  build(popoverEl);

  const handlePointerDown = (event) => {
    if (popoverEl.contains(event.target) || anchorEl.contains(event.target)) {
      return;
    }
    closePopover();
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      closePopover();
    }
  };

  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("keydown", handleKeydown, true);
  closePopoverListeners = () => {
    document.removeEventListener("pointerdown", handlePointerDown, true);
    document.removeEventListener("keydown", handleKeydown, true);
  };

  window.requestAnimationFrame(() => positionPopover(anchorEl));
}

function buildPopoverField(captionText, inputEl) {
  const field = document.createElement("label");
  field.className = "popover__field";
  const caption = document.createElement("span");
  caption.textContent = captionText;
  field.append(caption, inputEl);
  return field;
}

function openGroupEditor(anchorEl, group) {
  openPopover(anchorEl, (popover) => {
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = group.color;
    colorInput.addEventListener("input", () => {
      updateGroup(group.id, { color: colorInput.value });
    });

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.maxLength = 4;
    labelInput.value = group.label;
    labelInput.addEventListener("input", () => {
      updateGroup(group.id, { label: labelInput.value.slice(0, 4) });
    });
    labelInput.addEventListener("blur", () => {
      if (!labelInput.value.trim()) {
        labelInput.value = "?";
        updateGroup(group.id, { label: "?" });
      }
    });

    popover.append(buildPopoverField("Color", colorInput), buildPopoverField("Label", labelInput));
    window.requestAnimationFrame(() => labelInput.focus());
  });
}

function openBonusEditor(anchorEl, token) {
  openPopover(anchorEl, (popover) => {
    const valueInput = document.createElement("input");
    valueInput.type = "number";
    valueInput.inputMode = "numeric";
    valueInput.value = String(token.value);
    valueInput.addEventListener("input", () => {
      const parsed = Number.parseInt(valueInput.value, 10);
      if (Number.isFinite(parsed)) {
        updateBonusToken(token.id, parsed);
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "popover__delete";
    deleteButton.textContent = "Delete token";
    deleteButton.addEventListener("click", () => {
      removeBonusToken(token.id);
      closePopover();
    });

    popover.append(buildPopoverField("Value", valueInput), deleteButton);
    window.requestAnimationFrame(() => valueInput.focus());
  });
}

function entriesSignature(entries) {
  return entries
    .map((entry) => `${entry.kind}:${entry.sides ?? ""}:${entry.value}:${entry.groupId}`)
    .join("|");
}

function scheduleHistoryRecord() {
  window.clearTimeout(historyTimer);
  historyTimer = window.setTimeout(recordHistory, HISTORY_RECORD_DELAY_MS);
}

// Snapshots the settled pile (rolls plus per-group sums). A pile identical to
// one already in the history is skipped, so loading an old entry doesn't copy it.
function recordHistory() {
  historyTimer = null;
  if (state.entries.length === 0) {
    return;
  }
  const signature = entriesSignature(state.entries);
  if (state.history.some((item) => entriesSignature(item.entries) === signature)) {
    return;
  }

  const sums = new Map();
  state.entries.forEach((entry) => {
    sums.set(entry.groupId, (sums.get(entry.groupId) ?? 0) + entry.value);
  });

  state.history.unshift({
    id: createId(),
    time: Date.now(),
    entries: state.entries.map((entry) => ({
      kind: entry.kind,
      sides: entry.sides,
      value: entry.value,
      groupId: entry.groupId,
    })),
    sums: state.groups
      .filter((group) => sums.has(group.id))
      .map((group) => ({ label: group.label, color: group.color, sum: sums.get(group.id) })),
  });
  state.history.length = Math.min(state.history.length, HISTORY_LIMIT);

  recordingHistory = true;
  saveState();
  recordingHistory = false;
  renderHistory();
}

function loadHistoryItem(itemId) {
  const item = state.history.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }
  state.entries = item.entries.map((entry) => ({
    id: createId(),
    kind: entry.kind,
    sides: entry.sides,
    value: entry.value,
    groupId: findGroup(entry.groupId) ? entry.groupId : state.groups[0].id,
  }));
  saveState();
  syncPile();
}

function removeHistoryItem(itemId) {
  state.history = state.history.filter((entry) => entry.id !== itemId);
  recordingHistory = true;
  saveState();
  recordingHistory = false;
  renderHistory();
}

function openHistoryEditor(anchorEl, item) {
  openPopover(anchorEl, (popover) => {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "popover__delete";
    deleteButton.textContent = "Delete entry";
    deleteButton.addEventListener("click", () => {
      removeHistoryItem(item.id);
      closePopover();
    });
    popover.append(deleteButton);
  });
}

function setHistoryOpen(open) {
  historyDrawerEl.classList.toggle("history-drawer--open", open);
  historyTabButton.setAttribute("aria-expanded", String(open));
}

function formatHistoryRolls(entries) {
  return entries
    .map((entry) =>
      entry.kind === "die" ? `d${entry.sides}:${entry.value}` : formatBonusValue(entry.value)
    )
    .join(" ");
}

function renderHistory() {
  historyListEl.innerHTML = "";

  state.history.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "history-item";

    const time = document.createElement("span");
    time.className = "history-item__time";
    time.textContent = new Date(item.time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const rolls = document.createElement("span");
    rolls.className = "history-item__rolls";
    rolls.textContent = formatHistoryRolls(item.entries);

    const sums = document.createElement("span");
    sums.className = "history-item__sums";
    item.sums.forEach((sum) => {
      const chip = document.createElement("span");
      chip.className = "history-item__sum";
      chip.style.setProperty("--chip-color", sum.color);
      chip.textContent = `${sum.label} ${sum.sum}`;
      sums.appendChild(chip);
    });

    row.append(time, rolls, sums);
    bindPressActions(row, {
      onTap: () => loadHistoryItem(item.id),
      onLongPress: () => openHistoryEditor(row, item),
    });
    historyListEl.appendChild(row);
  });

  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "dice-totals__empty";
    empty.textContent = "Rolls are recorded here once the pile settles.";
    historyListEl.appendChild(empty);
  }
}

function openPresetEditor(anchorEl, preset) {
  openPopover(anchorEl, (popover) => {
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.maxLength = 12;
    labelInput.value = preset.label;
    labelInput.addEventListener("input", () => {
      const label = labelInput.value.trim().slice(0, 12);
      if (label) {
        updatePreset(preset.id, { label });
      }
    });
    labelInput.addEventListener("blur", () => {
      labelInput.value = preset.label;
    });

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = preset.color;
    colorInput.addEventListener("input", () => {
      updatePreset(preset.id, { color: colorInput.value });
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "popover__delete";
    deleteButton.textContent = "Delete preset";
    deleteButton.addEventListener("click", () => {
      removePreset(preset.id);
      closePopover();
    });

    popover.append(
      buildPopoverField("Color", colorInput),
      buildPopoverField("Name", labelInput),
      deleteButton
    );
    window.requestAnimationFrame(() => labelInput.focus());
  });
}

function nextPresetLabel() {
  const used = new Set(state.presets.map((preset) => preset.label));
  let index = 1;
  while (used.has(`P${index}`)) {
    index += 1;
  }
  return `P${index}`;
}

// A preset remembers which dice/tokens were in the pile and which group each
// belonged to — not the rolled values, so loading a preset rolls the dice fresh.
function savePreset() {
  if (state.entries.length === 0) {
    return;
  }
  state.presets.push({
    id: createId(),
    label: nextPresetLabel(),
    color: GROUP_PALETTE[state.presets.length % GROUP_PALETTE.length],
    entries: state.entries.map((entry) => ({
      kind: entry.kind,
      sides: entry.sides,
      value: entry.kind === "token" ? entry.value : undefined,
      groupId: entry.groupId,
    })),
  });
  saveState();
  renderPresetRow();
}

function addPresetToPile(presetId) {
  const preset = state.presets.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }
  const fallbackGroupId = state.groups[0].id;
  const added = preset.entries.map((entry) => ({
    id: createId(),
    kind: entry.kind,
    sides: entry.sides,
    value: entry.kind === "die" ? rollDie(entry.sides) : entry.value,
    groupId: findGroup(entry.groupId) ? entry.groupId : fallbackGroupId,
  }));
  state.entries.push(...added);
  saveState();
  syncPile();
}

function updatePreset(presetId, changes) {
  const preset = state.presets.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }
  Object.assign(preset, changes);
  saveState();
  const button = presetButtons.get(presetId);
  if (button) {
    button.textContent = preset.label;
    button.style.setProperty("--preset-color", preset.color);
  }
}

function removePreset(presetId) {
  state.presets = state.presets.filter((item) => item.id !== presetId);
  saveState();
  renderPresetRow();
}

function setActiveGroup(groupId) {
  if (state.activeGroupId === groupId) {
    return;
  }
  groupButtons.get(state.activeGroupId)?.classList.remove("is-active");
  groupButtons.get(state.activeGroupId)?.setAttribute("aria-pressed", "false");
  state.activeGroupId = groupId;
  groupButtons.get(groupId)?.classList.add("is-active");
  groupButtons.get(groupId)?.setAttribute("aria-pressed", "true");
  saveState();
}

function addGroup() {
  const group = {
    id: createId(),
    label: nextGroupLabel(),
    color: GROUP_PALETTE[state.groups.length % GROUP_PALETTE.length],
  };
  state.groups.push(group);
  state.activeGroupId = group.id;
  saveState();
  renderGroupRow();
}

function updateGroup(groupId, changes) {
  Object.assign(findGroup(groupId), changes);
  saveState();

  const button = groupButtons.get(groupId);
  if (button) {
    button.style.setProperty("--group-color", findGroup(groupId).color);
    button.querySelector(".group-button__label").textContent = findGroup(groupId).label;
  }
  refreshTileColors();
  renderTotals();
}

function addBonusToken() {
  const last = state.bonusTokens[state.bonusTokens.length - 1];
  state.bonusTokens.push({ id: createId(), value: last ? last.value + 1 : 1 });
  saveState();
  renderBonusRow();
}

function updateBonusToken(tokenId, value) {
  const token = state.bonusTokens.find((entry) => entry.id === tokenId);
  if (!token) {
    return;
  }
  token.value = value;
  saveState();
  const button = bonusButtons.get(tokenId);
  if (button) {
    button.querySelector(".bonus-button__value").textContent = formatBonusValue(value);
  }
}

function removeBonusToken(tokenId) {
  state.bonusTokens = state.bonusTokens.filter((entry) => entry.id !== tokenId);
  saveState();
  renderBonusRow();
}

function rollDieIntoPile(sides) {
  state.entries.push({
    id: createId(),
    kind: "die",
    sides,
    value: rollDie(sides),
    groupId: state.activeGroupId,
  });
  saveState();
  syncPile();
}

function addTokenToPile(token) {
  state.entries.push({
    id: createId(),
    kind: "token",
    value: token.value,
    groupId: state.activeGroupId,
  });
  saveState();
  syncPile();
}

function removeEntry(entryId) {
  const index = state.entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) {
    return;
  }
  state.entries.splice(index, 1);
  saveState();
  syncPile();
}

function clearPile() {
  if (state.entries.length === 0) {
    return;
  }
  state.entries = [];
  saveState();
  syncPile();
}

// Combined ordering used by the sort button: within a group, tokens rank by
// value and dice rank by side count, with every token ranking below every die
// — e.g. +1 < +10 < d4 < d6. The sort clusters entries by group first (group A
// before group B), then arranges each group's entries largest to smallest.
function entryRank(entry) {
  return entry.kind === "token" ? [0, entry.value] : [1, entry.sides];
}

function groupOrderIndex(groupId) {
  const index = state.groups.findIndex((group) => group.id === groupId);
  return index === -1 ? state.groups.length : index;
}

function sortPile() {
  if (state.entries.length < 2) {
    return;
  }

  state.entries.sort((a, b) => {
    const groupDiff = groupOrderIndex(a.groupId) - groupOrderIndex(b.groupId);
    if (groupDiff !== 0) {
      return groupDiff;
    }
    const [kindA, sizeA] = entryRank(a);
    const [kindB, sizeB] = entryRank(b);
    if (kindA !== kindB) {
      return kindB - kindA;
    }
    return sizeB - sizeA;
  });

  saveState();
  syncPile();
}

function duplicateDicePile() {
  if (!state.entries.some((entry) => entry.kind === "die")) {
    return;
  }

  const expanded = [];
  state.entries.forEach((entry) => {
    expanded.push(entry);
    if (entry.kind === "die") {
      expanded.push({
        id: createId(),
        kind: "die",
        sides: entry.sides,
        value: rollDie(entry.sides),
        groupId: entry.groupId,
      });
    }
  });

  state.entries = expanded;
  saveState();
  syncPile();
}

// Reverses duplicateDicePile: walks the dice in pile order and drops every
// second one, leaving tokens (and any unpaired die) untouched.
function halveDicePile() {
  let dieIndex = 0;
  const halved = state.entries.filter((entry) => {
    if (entry.kind !== "die") {
      return true;
    }
    const keep = dieIndex % 2 === 0;
    dieIndex += 1;
    return keep;
  });

  if (halved.length === state.entries.length) {
    return;
  }

  state.entries = halved;
  saveState();
  syncPile();
}

// (Re)starts the spin animation on a die tile, then settles it to an outline + number.
// Restarting requires clearing both state classes and forcing a reflow so the
// CSS animation (keyed off .dice-tile--rolling) replays from its first frame.
function spinDieTile(tile) {
  const shape = tile.querySelector(".dice-tile__shape");
  tile.classList.remove("dice-tile--rolling", "dice-tile--settled");
  void shape.getBoundingClientRect();
  tile.classList.add("dice-tile--rolling");

  window.setTimeout(() => {
    tile.classList.remove("dice-tile--rolling");
    tile.classList.add("dice-tile--settled");
  }, DIE_SPIN_MS);
}

function buildDieTile(entry, group) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "dice-tile dice-tile--die";
  tile.style.setProperty("--tile-color", group.color);
  tile.setAttribute("aria-label", `${group.label} d${entry.sides}: ${entry.value}. Tap to remove.`);

  const shape = document.createElementNS(SVG_NS, "svg");
  shape.setAttribute("viewBox", "0 0 100 100");
  shape.setAttribute("aria-hidden", "true");
  shape.classList.add("dice-tile__shape");
  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute("points", regularPolygonPoints(entry.sides));
  polygon.classList.add("dice-tile__polygon");
  shape.appendChild(polygon);

  const value = document.createElement("span");
  value.className = "dice-tile__value";
  value.textContent = String(entry.value);

  const type = document.createElement("span");
  type.className = "dice-tile__type";
  type.textContent = `d${entry.sides}`;

  tile.append(shape, value, type);
  spinDieTile(tile);

  return tile;
}

function rerollPile() {
  const dieEntries = state.entries.filter((entry) => entry.kind === "die");
  if (dieEntries.length === 0) {
    return;
  }

  dieEntries.forEach((entry) => {
    entry.value = rollDie(entry.sides);
    const tile = pileTiles.get(entry.id);
    if (!tile) {
      return;
    }
    const group = findGroup(entry.groupId);
    tile.setAttribute("aria-label", `${group.label} d${entry.sides}: ${entry.value}. Tap to remove.`);
    tile.querySelector(".dice-tile__value").textContent = String(entry.value);
    spinDieTile(tile);
  });

  saveState();
  renderTotals();
}

function buildTokenTile(entry, group) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "dice-tile dice-tile--token dice-tile--settled";
  tile.style.setProperty("--tile-color", group.color);
  tile.setAttribute("aria-label", `${group.label} token: ${formatBonusValue(entry.value)}. Tap to remove.`);

  const value = document.createElement("span");
  value.className = "dice-tile__value";
  value.textContent = formatBonusValue(entry.value);
  tile.appendChild(value);

  return tile;
}

function syncPile() {
  const currentIds = new Set(state.entries.map((entry) => entry.id));

  pileTiles.forEach((tile, id) => {
    if (!currentIds.has(id)) {
      tile.remove();
      pileTiles.delete(id);
    }
  });

  state.entries.forEach((entry) => {
    if (pileTiles.has(entry.id)) {
      return;
    }
    const group = findGroup(entry.groupId);
    const tile = entry.kind === "die" ? buildDieTile(entry, group) : buildTokenTile(entry, group);
    tile.addEventListener("click", () => removeEntry(entry.id));
    pileTiles.set(entry.id, tile);
  });

  // Re-append every tile (existing + new) in entry order. Moving an existing
  // node doesn't restart its animation, so sorting/duplicating/halving can
  // freely reorder state.entries and rely on this pass to match the DOM to it.
  state.entries.forEach((entry) => {
    const tile = pileTiles.get(entry.id);
    if (tile) {
      dicePileEl.appendChild(tile);
    }
  });

  if (state.entries.length === 0) {
    dicePileEl.classList.add("dice-pile--empty");
  } else {
    dicePileEl.classList.remove("dice-pile--empty");
  }

  presetSaveButton.disabled = state.entries.length === 0;
  renderTotals();
}

function refreshTileColors() {
  pileTiles.forEach((tile, id) => {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) {
      return;
    }
    tile.style.setProperty("--tile-color", findGroup(entry.groupId).color);
  });
}

function renderTotals() {
  const sums = new Map();
  state.entries.forEach((entry) => {
    sums.set(entry.groupId, (sums.get(entry.groupId) ?? 0) + entry.value);
  });

  // Drop selections for groups that no longer have a total (cleared, deleted, etc.).
  [...selectedTotalGroupIds].forEach((groupId) => {
    if (!sums.has(groupId)) {
      selectedTotalGroupIds.delete(groupId);
    }
  });

  totalsEl.innerHTML = "";
  state.groups.forEach((group) => {
    if (!sums.has(group.id)) {
      return;
    }
    const selected = selectedTotalGroupIds.has(group.id);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "total-chip total-chip--selectable";
    chip.classList.toggle("total-chip--selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
    chip.style.setProperty("--chip-color", group.color);
    chip.addEventListener("click", () => {
      if (selectedTotalGroupIds.has(group.id)) {
        selectedTotalGroupIds.delete(group.id);
      } else {
        selectedTotalGroupIds.add(group.id);
      }
      renderTotals();
    });

    const label = document.createElement("span");
    label.className = "total-chip__label";
    label.textContent = group.label;

    const value = document.createElement("strong");
    value.className = "total-chip__value";
    value.textContent = String(sums.get(group.id));

    chip.append(label, value);
    totalsEl.appendChild(chip);
  });

  if (selectedTotalGroupIds.size > 0) {
    let combined = 0;
    selectedTotalGroupIds.forEach((groupId) => {
      combined += sums.get(groupId);
    });

    const chip = document.createElement("div");
    chip.className = "total-chip total-chip--combined";

    const label = document.createElement("span");
    label.className = "total-chip__label";
    label.textContent = "Σ";

    const value = document.createElement("strong");
    value.className = "total-chip__value";
    value.textContent = String(combined);

    chip.append(label, value);
    totalsEl.appendChild(chip);
  }

  if (!totalsEl.children.length) {
    const empty = document.createElement("p");
    empty.className = "dice-totals__empty";
    empty.textContent = "No rolls yet.";
    totalsEl.appendChild(empty);
  }
}

function renderDiceRow() {
  diceRowEl.innerHTML = "";
  DICE_ROW_SIDES.forEach((sides) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dice-button";
    button.textContent = `d${sides}`;
    button.addEventListener("click", () => rollDieIntoPile(sides));
    diceRowEl.appendChild(button);
  });
}

function buildAddButton(className, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.textContent = "+";
  button.addEventListener("click", onClick);
  return button;
}

// Drag-to-reorder for a preset button. Moving past the press tolerance turns the
// gesture into a drag (which also cancels the long-press timer in bindPressActions);
// the button is moved around the row live and the new order is saved on release.
function bindPresetDrag(button) {
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let dragging = false;
  let dropped = false;

  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
  });

  button.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }
    if (!dragging) {
      if (
        Math.abs(event.clientX - startX) <= PRESS_MOVE_TOLERANCE &&
        Math.abs(event.clientY - startY) <= PRESS_MOVE_TOLERANCE
      ) {
        return;
      }
      dragging = true;
      try {
        button.setPointerCapture(pointerId);
      } catch {
        // Capture is best-effort; reordering still works while the pointer stays over the row.
      }
      button.classList.add("preset-button--dragging");
    }

    const under = document.elementFromPoint(event.clientX, event.clientY);
    const target = under?.closest(".preset-button");
    if (!target || target === button || !presetRowEl.contains(target)) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const before = event.clientX < rect.left + rect.width / 2;
    presetRowEl.insertBefore(button, before ? target : target.nextSibling);
  });

  const finish = (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }
    pointerId = null;
    if (!dragging) {
      return;
    }
    dragging = false;
    dropped = true;
    window.setTimeout(() => {
      dropped = false;
    }, 0);
    button.classList.remove("preset-button--dragging");

    const order = [...presetRowEl.querySelectorAll(".preset-button")].map(
      (el) => el.dataset.presetId
    );
    state.presets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    saveState();
  };
  button.addEventListener("pointerup", finish);
  button.addEventListener("pointercancel", finish);

  return {
    // The click that follows a drag must not also add the preset to the pile.
    consumeDrop: () => dropped,
  };
}

function renderPresetRow() {
  presetRowEl.innerHTML = "";
  presetButtons.clear();

  state.presets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-button";
    button.textContent = preset.label;
    button.dataset.presetId = preset.id;
    button.style.setProperty("--preset-color", preset.color);

    const drag = bindPresetDrag(button);
    bindPressActions(button, {
      onTap: () => {
        if (!drag.consumeDrop()) {
          addPresetToPile(preset.id);
        }
      },
      onLongPress: () => openPresetEditor(button, preset),
    });

    presetRowEl.appendChild(button);
    presetButtons.set(preset.id, button);
  });

  if (!state.presets.length) {
    const empty = document.createElement("p");
    empty.className = "dice-totals__empty";
    empty.textContent = "Build a pile, then tap Save to keep it as a preset.";
    presetRowEl.appendChild(empty);
  }
}

function renderBonusRow() {
  bonusRowEl.innerHTML = "";
  bonusButtons.clear();

  state.bonusTokens.forEach((token) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bonus-button";

    const value = document.createElement("span");
    value.className = "bonus-button__value";
    value.textContent = formatBonusValue(token.value);
    button.appendChild(value);

    bindPressActions(button, {
      onTap: () => addTokenToPile(token),
      onLongPress: () => openBonusEditor(button, token),
    });

    bonusRowEl.appendChild(button);
    bonusButtons.set(token.id, button);
  });

  bonusRowEl.appendChild(buildAddButton("bonus-button bonus-button--add", "Add bonus token", addBonusToken));
}

function renderGroupRow() {
  groupRowEl.innerHTML = "";
  groupButtons.clear();

  state.groups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-button";
    button.classList.toggle("is-active", group.id === state.activeGroupId);
    button.setAttribute("aria-pressed", String(group.id === state.activeGroupId));
    button.style.setProperty("--group-color", group.color);

    const label = document.createElement("span");
    label.className = "group-button__label";
    label.textContent = group.label;
    button.appendChild(label);

    bindPressActions(button, {
      onTap: () => setActiveGroup(group.id),
      onLongPress: () => openGroupEditor(button, group),
    });

    groupRowEl.appendChild(button);
    groupButtons.set(group.id, button);
  });

  groupRowEl.appendChild(buildAddButton("group-button group-button--add", "Add group", addGroup));
}

sortButton.addEventListener("click", sortPile);
duplicateButton.addEventListener("click", duplicateDicePile);
halveButton.addEventListener("click", halveDicePile);
rerollButton.addEventListener("click", rerollPile);
clearButton.addEventListener("click", clearPile);
presetSaveButton.addEventListener("click", savePreset);
historyTabButton.addEventListener("click", () => {
  setHistoryOpen(!historyDrawerEl.classList.contains("history-drawer--open"));
});
document.addEventListener("pointerdown", (event) => {
  if (
    historyDrawerEl.classList.contains("history-drawer--open") &&
    !historyDrawerEl.contains(event.target) &&
    !popoverEl.contains(event.target)
  ) {
    setHistoryOpen(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setHistoryOpen(false);
  }
});

function loadCollapsedPanels() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY));
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function setupPanelToggles() {
  const collapsed = loadCollapsedPanels();

  document.querySelectorAll("[data-panel-toggle]").forEach((toggle) => {
    const panelId = toggle.dataset.panelToggle;
    const panel = document.getElementById(panelId);

    const apply = () => {
      const isCollapsed = collapsed.has(panelId);
      panel.classList.toggle("panel--collapsed", isCollapsed);
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    };

    toggle.addEventListener("click", () => {
      if (collapsed.has(panelId)) {
        collapsed.delete(panelId);
      } else {
        collapsed.add(panelId);
      }
      apply();
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
      } catch (error) {
        console.warn("Failed to persist collapsed panels", error);
      }
    });

    apply();
  });
}

renderDiceRow();
renderBonusRow();
renderGroupRow();
renderPresetRow();
renderHistory();
syncPile();
setupPanelToggles();
