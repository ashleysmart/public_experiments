const DICE_ROW_SIDES = [20, 12, 10, 8, 6, 4];
const STORAGE_KEY = "dice-forge-tray-v1";
const LONG_PRESS_MS = 480;
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
const clearButton = document.querySelector("#clear-button");
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

    return {
      activeGroupId: groupIds.has(parsed.activeGroupId) ? parsed.activeGroupId : groups[0].id,
      groups,
      bonusTokens,
      entries,
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist tray state", error);
  }
}

const state = loadState();
const pileTiles = new Map();
const groupButtons = new Map();
const bonusButtons = new Map();

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

function buildDieTile(entry, group) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "dice-tile dice-tile--die dice-tile--rolling";
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

  window.setTimeout(() => {
    tile.classList.remove("dice-tile--rolling");
    tile.classList.add("dice-tile--settled");
  }, DIE_SPIN_MS);

  return tile;
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
    dicePileEl.appendChild(tile);
    pileTiles.set(entry.id, tile);
  });

  if (state.entries.length === 0) {
    dicePileEl.classList.add("dice-pile--empty");
  } else {
    dicePileEl.classList.remove("dice-pile--empty");
  }

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

  totalsEl.innerHTML = "";
  state.groups.forEach((group) => {
    if (!sums.has(group.id)) {
      return;
    }
    const chip = document.createElement("div");
    chip.className = "total-chip";
    chip.style.setProperty("--chip-color", group.color);

    const label = document.createElement("span");
    label.className = "total-chip__label";
    label.textContent = group.label;

    const value = document.createElement("strong");
    value.className = "total-chip__value";
    value.textContent = String(sums.get(group.id));

    chip.append(label, value);
    totalsEl.appendChild(chip);
  });

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

clearButton.addEventListener("click", clearPile);

renderDiceRow();
renderBonusRow();
renderGroupRow();
syncPile();
