(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CasStore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STORAGE_KEY = "entry_list";
  var idCounter = 0;

  // Version-based optimistic concurrency control.
  // Loop: read version -> apply op -> write new version -> verify version unchanged.
  function commitWithCas(op, options) {
    var storage = getStorage(options && options.storage);
    var key = (options && options.key) || STORAGE_KEY;
    var maxRetries = (options && options.maxRetries) || 3;
    var attempt;

    for (attempt = 1; attempt <= maxRetries; attempt += 1) {
      // 1. read current state and version
      var state = loadState({ storage: storage, key: key });

      // 2. apply op on top of current state
      var result = applyOp(state, op);

      if (!result.applied) {
        return { ok: false, reason: result.reason, state: state };
      }

      // 3. write new state with incremented version
      var nextState = {
        version: state.version + 1,
        entries: result.state.entries,
      };

      writeRaw(storage, key, JSON.stringify(nextState));

      // 4. verify that version is unchanged (i.e. no concurrent modifications)
      var verifyRaw = readRaw(storage, key);
      var verifyState = parseRaw(verifyRaw);

      if (verifyState && verifyState.version === nextState.version) {
        return { ok: true, state: nextState };
      }
    }
    
    // Failed to commit after max retries due to conflicts.
    return {
      ok: false,
      reason: "conflict",
      state: loadState({ storage: storage, key: key }),
    };
  }


  function generateId() {
    idCounter += 1;
    return "e_" + Date.now() + "_" + idCounter;
  }

  function getStorage(storage) {
    if (storage) return storage;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
  }

  function readRaw(storage, key) {
    if (!storage) return null;
    return storage.getItem(key);
  }

  function writeRaw(storage, key, value) {
    if (!storage) return;
    storage.setItem(key, value);
  }

  function parseRaw(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function ensureEntryIds(entries) {
    for (var i = 0; i < entries.length; i += 1) {
      if (!entries[i].id) {
        entries[i].id = generateId();
      }
    }
  }

  function loadState(options) {
    var storage = getStorage(options && options.storage);
    var key = (options && options.key) || STORAGE_KEY;
    var raw = readRaw(storage, key);
    var parsed = parseRaw(raw);
    var state;

    if (!parsed) {
      state = { version: 0, entries: [] };
    } else if (Array.isArray(parsed)) {
      state = { version: 0, entries: parsed.slice() };
    } else {
      state = {
        version: typeof parsed.version === "number" ? parsed.version : 0,
        entries: Array.isArray(parsed.entries) ? parsed.entries.slice() : [],
      };
    }

    ensureEntryIds(state.entries);

    if (options && options.persistIfNeeded) {
      writeRaw(storage, key, JSON.stringify(state));
    }

    return state;
  }

  // Apply a user operation on top of the current state.
  function applyOp(state, op) {
    var entries = state.entries.slice();
    var i;

    if (!op || !op.type) {
      return { applied: false, reason: "invalid_op", state: state };
    }

    if (op.type === "ADD") {
      var entry = op.entry;
      if (!entry || !entry.id) {
        return { applied: false, reason: "missing_id", state: state };
      }
      for (i = 0; i < entries.length; i += 1) {
        if (entries[i].id === entry.id) {
          return { applied: false, reason: "exists", state: state };
        }
      }
      entries.push(entry);
      return {
        applied: true,
        state: { version: state.version, entries: entries },
      };
    }

    if (op.type === "EDIT") {
      for (i = 0; i < entries.length; i += 1) {
        if (entries[i].id === op.id) {
          var nextTitle =
            op.patch && op.patch.title !== undefined
              ? op.patch.title
              : entries[i].title;
          var nextAmount =
            op.patch && op.patch.amount !== undefined
              ? op.patch.amount
              : entries[i].amount;
          entries[i] = {
            id: entries[i].id,
            type: entries[i].type,
            title: nextTitle,
            amount: nextAmount,
          };
          return {
            applied: true,
            state: { version: state.version, entries: entries },
          };
        }
      }
      return { applied: false, reason: "missing", state: state };
    }

    if (op.type === "DELETE") {
      for (i = 0; i < entries.length; i += 1) {
        if (entries[i].id === op.id) {
          entries.splice(i, 1);
          break;
        }
      }
      return {
        applied: true,
        state: { version: state.version, entries: entries },
      };
    }

    return { applied: false, reason: "unknown_op", state: state };
  }


  function createAddOp(entry) {
    return { type: "ADD", entry: entry };
  }

  function createEditOp(id, patch) {
    return { type: "EDIT", id: id, patch: patch };
  }

  function createDeleteOp(id) {
    return { type: "DELETE", id: id };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    generateId: generateId,
    loadState: loadState,
    applyOp: applyOp,
    commitWithCas: commitWithCas,
    createAddOp: createAddOp,
    createEditOp: createEditOp,
    createDeleteOp: createDeleteOp,
  };
});
