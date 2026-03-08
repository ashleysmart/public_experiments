const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadGroups,
  normalizeGroup,
  persistGroups,
} = require("../dice_app/group_storage.js");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(data.entries());
    },
  };
}

const STORAGE_KEY = "dice-forge-groups-v1";
const PALETTE = [{ face: "#d95f43" }, { face: "#4aa885" }];

function testNormalizeGroup(group, index = 0) {
  return normalizeGroup(group, index, {
    palette: PALETTE,
    createId: () => `id-${index + 1}`,
  });
}

test("normalizeGroup preserves expected fields for persisted groups", () => {
  const normalized = testNormalizeGroup(
    {
      id: "abc",
      name: "  Greatsword  ",
      shortName: "gswd-extra",
      color: "#ABCDEF",
      equation: "2d6+4",
      damageType: "slashing",
      selected: 1,
      collapsed: true,
    },
    2
  );

  assert.deepEqual(normalized, {
    id: "abc",
    name: "Greatsword",
    shortName: "GSWD",
    color: "#abcdef",
    equation: "2d6+4",
    damageType: "slashing",
    selected: true,
    collapsed: true,
  });
});

test("loadGroups seeds defaults when storage is empty", () => {
  const storage = createStorage();
  const defaults = [{ id: "starter", name: "Starter", shortName: "", color: "#d95f43", equation: "1d6", damageType: "", selected: false, collapsed: true }];

  const groups = loadGroups(storage, {
    storageKey: STORAGE_KEY,
    defaultsFactory: () => defaults,
    normalizeGroup: testNormalizeGroup,
  });

  assert.deepEqual(groups, defaults);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(defaults));
});

test("loadGroups preserves an empty persisted groups array", () => {
  const storage = createStorage({
    [STORAGE_KEY]: "[]",
  });

  const groups = loadGroups(storage, {
    storageKey: STORAGE_KEY,
    defaultsFactory: () => [{ id: "starter" }],
    normalizeGroup: testNormalizeGroup,
  });

  assert.deepEqual(groups, []);
  assert.equal(storage.getItem(STORAGE_KEY), "[]");
});

test("loadGroups normalizes persisted groups and writes normalized data back", () => {
  const storage = createStorage({
    [STORAGE_KEY]: JSON.stringify([
      {
        name: "  Fire Bolt ",
        shortName: "fbt1",
        equation: "2d10+2",
        damageType: "fire",
        selected: true,
        collapsed: false,
      },
    ]),
  });

  const groups = loadGroups(storage, {
    storageKey: STORAGE_KEY,
    defaultsFactory: () => [],
    normalizeGroup: testNormalizeGroup,
  });

  assert.deepEqual(groups, [
    {
      id: "id-1",
      name: "Fire Bolt",
      shortName: "FBT1",
      color: "#d95f43",
      equation: "2d10+2",
      damageType: "fire",
      selected: true,
      collapsed: false,
    },
  ]);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(groups));
});

test("persistGroups writes group updates to storage", () => {
  const storage = createStorage();
  const groups = [
    {
      id: "abc",
      name: "Sneak Attack",
      shortName: "SNK",
      color: "#4aa885",
      equation: "3d6",
      damageType: "piercing",
      selected: true,
      collapsed: true,
    },
  ];

  persistGroups(storage, STORAGE_KEY, groups);

  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(groups));
});
