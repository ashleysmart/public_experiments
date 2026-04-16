const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

const starterGroups = [
  {
    id: crypto.randomUUID(),
    name: "Greatsword",
    modifier: 4,
    selected: true,
    dice: { 4: 0, 6: 2, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 },
  },
  {
    id: crypto.randomUUID(),
    name: "Sneak Attack",
    modifier: 0,
    selected: true,
    dice: { 4: 0, 6: 3, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 },
  },
  {
    id: crypto.randomUUID(),
    name: "Fire Bolt",
    modifier: 2,
    selected: false,
    dice: { 4: 0, 6: 0, 8: 0, 10: 2, 12: 0, 20: 0, 100: 0 },
  },
];

const state = {
  groups: structuredClone(starterGroups),
  history: [],
  lastResult: null,
};

const groupTemplate = document.querySelector("#group-template");
const historyTemplate = document.querySelector("#history-entry-template");
const groupsContainer = document.querySelector("#groups-container");
const resultPanel = document.querySelector("#result-panel");
const historyContainer = document.querySelector("#history-container");
const groupSummary = document.querySelector("#group-summary");
const addGroupButton = document.querySelector("#add-group-button");
const rollSelectedButton = document.querySelector("#roll-selected-button");
const rollSelectedCritButton = document.querySelector("#roll-selected-crit-button");
const clearHistoryButton = document.querySelector("#clear-history-button");

function createEmptyGroup() {
  return {
    id: crypto.randomUUID(),
    name: `Custom Group ${state.groups.length + 1}`,
    modifier: 0,
    selected: false,
    dice: Object.fromEntries(DIE_TYPES.map((sides) => [sides, 0])),
  };
}

function formatDiceSummary(group) {
  const parts = DIE_TYPES
    .filter((sides) => group.dice[sides] > 0)
    .map((sides) => `${group.dice[sides]}d${sides}`);

  if (group.modifier !== 0) {
    parts.push(group.modifier > 0 ? `+${group.modifier}` : `${group.modifier}`);
  }

  return parts.length ? parts.join(" ") : "No dice configured";
}

function renderGroups() {
  groupsContainer.innerHTML = "";

  state.groups.forEach((group) => {
    const fragment = groupTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".group-card");
    const nameInput = fragment.querySelector('[data-field="name"]');
    const selectedInput = fragment.querySelector('[data-field="selected"]');
    const modifierInput = fragment.querySelector('[data-field="modifier"]');
    const summary = fragment.querySelector('[data-role="summary"]');
    const diceGrid = fragment.querySelector(".dice-grid");
    const removeButton = fragment.querySelector('[data-action="remove-group"]');
    const rollButton = fragment.querySelector('[data-action="roll-group"]');
    const rollCritButton = fragment.querySelector('[data-action="roll-group-crit"]');

    card.dataset.groupId = group.id;
    nameInput.value = group.name;
    selectedInput.checked = group.selected;
    modifierInput.value = group.modifier;
    summary.textContent = formatDiceSummary(group);

    nameInput.addEventListener("input", (event) => {
      group.name = event.target.value.trimStart().slice(0, 32) || "Unnamed Group";
      renderGroups();
    });

    selectedInput.addEventListener("change", (event) => {
      group.selected = event.target.checked;
      renderGroups();
    });

    modifierInput.addEventListener("input", (event) => {
      group.modifier = Number(event.target.value) || 0;
      renderGroups();
    });

    DIE_TYPES.forEach((sides) => {
      const wrapper = document.createElement("label");
      wrapper.className = "die-field";
      wrapper.innerHTML = `
        <span class="die-field__badge">d${sides}</span>
        <input type="number" min="0" max="99" step="1" value="${group.dice[sides]}" />
      `;

      const input = wrapper.querySelector("input");
      input.addEventListener("input", (event) => {
        group.dice[sides] = clampCount(event.target.value);
        renderGroups();
      });
      diceGrid.appendChild(wrapper);
    });

    removeButton.addEventListener("click", () => {
      state.groups = state.groups.filter((entry) => entry.id !== group.id);
      render();
    });

    rollButton.addEventListener("click", () => performRoll([group.id], false));
    rollCritButton.addEventListener("click", () => performRoll([group.id], true));

    groupsContainer.appendChild(fragment);
  });

  const selectedCount = state.groups.filter((group) => group.selected).length;
  groupSummary.textContent = `${state.groups.length} groups configured, ${selectedCount} selected`;
}

function clampCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(99, Math.floor(parsed));
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollGroup(group, critEnabled) {
  const multiplier = critEnabled ? 2 : 1;
  const diceEntries = [];
  let subtotal = 0;

  DIE_TYPES.forEach((sides) => {
    const count = group.dice[sides] * multiplier;
    if (count === 0) {
      return;
    }

    const values = Array.from({ length: count }, () => rollDie(sides));
    const total = values.reduce((sum, value) => sum + value, 0);
    subtotal += total;
    diceEntries.push({
      sides,
      count,
      values,
      total,
      baseCount: group.dice[sides],
    });
  });

  return {
    groupId: group.id,
    name: group.name,
    critEnabled,
    modifier: group.modifier,
    diceEntries,
    diceTotal: subtotal,
    total: subtotal + group.modifier,
  };
}

function performRoll(groupIds, critEnabled) {
  const groups = state.groups.filter((group) => groupIds.includes(group.id));
  if (groups.length === 0) {
    return;
  }

  const groupResults = groups.map((group) => rollGroup(group, critEnabled));
  const total = groupResults.reduce((sum, result) => sum + result.total, 0);
  const label = groups.length === 1 ? groupResults[0].name : "Combined Roll";

  const result = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    label,
    critEnabled,
    total,
    groupResults,
  };

  state.lastResult = result;
  state.history.unshift(result);
  render();
}

function renderResult() {
  if (!state.lastResult) {
    resultPanel.className = "result-panel empty-state";
    resultPanel.textContent =
      "Roll a group or combine selected groups to see the full breakdown.";
    return;
  }

  const { label, total, critEnabled, groupResults, createdAt } = state.lastResult;
  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <article class="result-card">
      <div class="result-topline">
        <div>
          <p class="panel__eyebrow">Resolved ${formatTime(createdAt)}</p>
          <h3>${escapeHtml(label)}</h3>
          <p class="result-subtitle">${groupResults.length} group${groupResults.length === 1 ? "" : "s"} ${
    critEnabled ? "with critical dice doubling" : "at normal roll"
  }</p>
        </div>
        <div class="result-total">
          <span>Total</span>
          <strong>${total}</strong>
        </div>
      </div>
      <div class="tag-row">
        ${critEnabled ? '<span class="tag">Critical dice applied</span>' : '<span class="tag">Standard roll</span>'}
      </div>
      <div class="result-group-list">
        ${groupResults.map(renderGroupResult).join("")}
      </div>
    </article>
  `;
}

function renderGroupResult(result) {
  const diceMarkup =
    result.diceEntries.length > 0
      ? result.diceEntries
          .map((entry) => {
            const baseLabel =
              result.critEnabled && entry.baseCount > 0
                ? `${entry.baseCount}d${entry.sides} -> ${entry.count}d${entry.sides}`
                : `${entry.count}d${entry.sides}`;

            return `
              <div class="result-dice-line">
                <strong>${baseLabel}</strong>
                <span>[${entry.values.join(", ")}] = ${entry.total}</span>
              </div>
            `;
          })
          .join("")
      : '<div class="result-dice-line"><strong>No dice</strong><span>Flat modifier only</span></div>';

  const modifierText =
    result.modifier === 0
      ? "No adjustment"
      : result.modifier > 0
        ? `+${result.modifier} adjustment`
        : `${result.modifier} adjustment`;

  return `
    <section class="result-group">
      <div class="result-topline">
        <div>
          <h3>${escapeHtml(result.name)}</h3>
          <p class="result-meta">${modifierText}</p>
        </div>
        <div class="result-total">
          <span>Group</span>
          <strong>${result.total}</strong>
        </div>
      </div>
      <div class="result-dice-line">${diceMarkup}</div>
    </section>
  `;
}

function renderHistory() {
  if (state.history.length === 0) {
    historyContainer.className = "history-list empty-state";
    historyContainer.textContent = "No rolls yet.";
    return;
  }

  historyContainer.className = "history-list";
  historyContainer.innerHTML = "";

  state.history.forEach((entry) => {
    const fragment = historyTemplate.content.cloneNode(true);
    fragment.querySelector('[data-role="title"]').textContent = entry.label;
    fragment.querySelector('[data-role="total"]').textContent = `Total ${entry.total}`;
    fragment.querySelector('[data-role="meta"]').textContent = `${formatTime(entry.createdAt)} • ${
      entry.critEnabled ? "Critical roll" : "Standard roll"
    }`;
    fragment.querySelector('[data-role="detail"]').innerHTML = entry.groupResults
      .map(
        (groupResult) =>
          `<div><strong>${escapeHtml(groupResult.name)}:</strong> ${escapeHtml(
            summarizeResult(groupResult)
          )}</div>`
      )
      .join("");
    historyContainer.appendChild(fragment);
  });
}

function summarizeResult(result) {
  const dice = result.diceEntries
    .map((entry) => `${entry.count}d${entry.sides} [${entry.values.join(", ")}]`)
    .join("; ");
  const modifier =
    result.modifier === 0 ? "" : result.modifier > 0 ? ` +${result.modifier}` : ` ${result.modifier}`;
  return `${dice || "no dice"}${modifier} = ${result.total}`;
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render() {
  renderGroups();
  renderResult();
  renderHistory();
}

addGroupButton.addEventListener("click", () => {
  state.groups.push(createEmptyGroup());
  render();
});

rollSelectedButton.addEventListener("click", () => {
  performRoll(
    state.groups.filter((group) => group.selected).map((group) => group.id),
    false
  );
});

rollSelectedCritButton.addEventListener("click", () => {
  performRoll(
    state.groups.filter((group) => group.selected).map((group) => group.id),
    true
  );
});

clearHistoryButton.addEventListener("click", () => {
  state.history = [];
  renderHistory();
});

render();
