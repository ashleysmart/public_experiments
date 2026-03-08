(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DiceForgeGroupStorage = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalizeGroup(group, fallbackIndex = 0, options = {}) {
    const fallbackColor = options.palette?.[fallbackIndex % options.palette.length]?.face ?? "#d95f43";
    const createId = typeof options.createId === "function" ? options.createId : () => `group-${fallbackIndex + 1}`;

    return {
      id: typeof group?.id === "string" && group.id ? group.id : createId(),
      name:
        typeof group?.name === "string" && group.name.trim()
          ? group.name.trim().slice(0, 32)
          : `Custom Group ${fallbackIndex + 1}`,
      shortName:
        typeof group?.shortName === "string" && group.shortName.trim()
          ? group.shortName.trim().slice(0, 4).toUpperCase()
          : "",
      color:
        typeof group?.color === "string" && /^#[0-9a-f]{6}$/i.test(group.color.trim())
          ? group.color.trim().toLowerCase()
          : fallbackColor,
      equation: typeof group?.equation === "string" ? group.equation.slice(0, 80) : "",
      damageType: typeof group?.damageType === "string" ? group.damageType.slice(0, 24) : "",
      selected: Boolean(group?.selected),
      collapsed: Boolean(group?.collapsed),
    };
  }

  function persistGroups(storage, storageKey, groups) {
    storage.setItem(storageKey, JSON.stringify(groups));
    return groups;
  }

  function loadGroups(storage, options) {
    const defaultsFactory =
      typeof options?.defaultsFactory === "function" ? options.defaultsFactory : () => [];
    const normalize = typeof options?.normalizeGroup === "function" ? options.normalizeGroup : normalizeGroup;
    const storageKey = options?.storageKey;

    try {
      const raw = storage.getItem(storageKey);
      if (!raw) {
        const defaults = defaultsFactory();
        persistGroups(storage, storageKey, defaults);
        return defaults;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const defaults = defaultsFactory();
        persistGroups(storage, storageKey, defaults);
        return defaults;
      }

      const normalized = parsed.map((group, index) => normalize(group, index));
      return normalized;
    } catch {
      const defaults = defaultsFactory();
      try {
        persistGroups(storage, storageKey, defaults);
      } catch {
        // Ignore storage write failures and still return usable defaults.
      }
      return defaults;
    }
  }

  return {
    loadGroups,
    normalizeGroup,
    persistGroups,
  };
});
