const CasStore = require("../storage");

describe("cas-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("commitWithCas adds entry and increments version", () => {
    const entry = {
      id: CasStore.generateId(),
      type: "income",
      title: "Salary",
      amount: 100,
    };

    const result = CasStore.commitWithCas(CasStore.createAddOp(entry));
    expect(result.ok).toBe(true);

    const state = CasStore.loadState();
    expect(state.version).toBe(1);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      type: "income",
      title: "Salary",
      amount: 100,
    });
  });

  test("commitWithCas returns conflict when verify phase detects mismatch", () => {
    var raw = null;
    var conflictStorage = {
      getItem: function () {
        return raw;
      },
      setItem: function (_key, value) {
        // Force a different version than what commitWithCas just wrote,
        // so verify phase always sees a mismatch.
        var parsed = JSON.parse(value);
        parsed.version = parsed.version + 1;
        raw = JSON.stringify(parsed);
      },
    };

    const entry = {
      id: CasStore.generateId(),
      type: "income",
      title: "A",
      amount: 10,
    };

    const result = CasStore.commitWithCas(CasStore.createAddOp(entry), {
      storage: conflictStorage,
      maxRetries: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("conflict");
  });

  test("delete removes entry when it exists", () => {
    const entry = {
      id: CasStore.generateId(),
      type: "income",
      title: "Bonus",
      amount: 30,
    };

    CasStore.commitWithCas(CasStore.createAddOp(entry));
    CasStore.commitWithCas(CasStore.createDeleteOp(entry.id));

    const state = CasStore.loadState();
    expect(state.entries).toHaveLength(0);
  });

  test("edit updates an existing entry", () => {
    const entry = {
      id: CasStore.generateId(),
      type: "income",
      title: "Base",
      amount: 20,
    };

    CasStore.commitWithCas(CasStore.createAddOp(entry));
    CasStore.commitWithCas(
      CasStore.createEditOp(entry.id, { title: "Updated", amount: 25 })
    );

    const state = CasStore.loadState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      title: "Updated",
      amount: 25,
    });
  });

  test("edit fails when entry is missing", () => {
    const entry = {
      id: CasStore.generateId(),
      type: "expense",
      title: "Old",
      amount: 5,
    };

    CasStore.commitWithCas(CasStore.createAddOp(entry));
    CasStore.commitWithCas(CasStore.createDeleteOp(entry.id));

    const result = CasStore.commitWithCas(
      CasStore.createEditOp(entry.id, { title: "New" })
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing");
  });

  test("delete is idempotent when entry is missing", () => {
    const entry = {
      id: CasStore.generateId(),
      type: "income",
      title: "Solo",
      amount: 1,
    };

    CasStore.commitWithCas(CasStore.createAddOp(entry));
    CasStore.commitWithCas(CasStore.createDeleteOp(entry.id));
    const result = CasStore.commitWithCas(CasStore.createDeleteOp(entry.id));

    expect(result.ok).toBe(true);
    expect(result.state.entries).toHaveLength(0);
  });
});
