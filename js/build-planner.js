"use strict";

import {
  PLANNER_SLOT_IDS,
  getCompatiblePlannerSlots,
  getPlannerSlotLabel,
  isNormallyEquippable
} from "./item-rules.js";

export const BUILD_STORAGE_KEY =
  "eql-loot-explorer-build-v1";

export const BUILD_VERSION = 1;

/*
 * Creates the complete empty slot object used by every build.
 */
export function createEmptySlotState() {
  return Object.fromEntries(
    PLANNER_SLOT_IDS.map(slotId => [
      slotId,
      null
    ])
  );
}

/*
 * Creates a new empty build.
 *
 * Only record IDs are stored in slots. The CSV database remains the
 * source of truth for all item information.
 */
export function createEmptyBuild() {
  return {
    version: BUILD_VERSION,
    name: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slots: createEmptySlotState()
  };
}

/*
 * Loads the build from localStorage.
 *
 * Invalid, outdated, or malformed saved data is repaired rather than
 * allowing the planner to crash.
 */
export function loadBuild() {
  try {
    const savedText =
      window.localStorage.getItem(
        BUILD_STORAGE_KEY
      );

    if (!savedText) {
      return createEmptyBuild();
    }

    const savedBuild =
      JSON.parse(savedText);

    return normalizeBuild(savedBuild);
  } catch (error) {
    console.warn(
      "Saved build could not be loaded.",
      error
    );

    return createEmptyBuild();
  }
}

/*
 * Saves a normalized build to localStorage and returns the saved build.
 */
export function saveBuild(build) {
  const normalizedBuild =
    normalizeBuild({
      ...build,
      updatedAt: new Date().toISOString()
    });

  try {
    window.localStorage.setItem(
      BUILD_STORAGE_KEY,
      JSON.stringify(normalizedBuild)
    );
  } catch (error) {
    console.warn(
      "Build could not be saved.",
      error
    );
  }

  return normalizedBuild;
}

/*
 * Clears the saved planner and returns a fresh empty build.
 */
export function clearBuild() {
  const emptyBuild = createEmptyBuild();

  try {
    window.localStorage.removeItem(
      BUILD_STORAGE_KEY
    );
  } catch (error) {
    console.warn(
      "Saved build could not be removed.",
      error
    );
  }

  return emptyBuild;
}

/*
 * Updates the build name and saves the result.
 */
export function setBuildName(
  build,
  name
) {
  return saveBuild({
    ...build,
    name: String(name ?? "").trim()
  });
}

/*
 * Returns the record ID currently stored in a planner slot.
 */
export function getEquippedRecordId(
  build,
  plannerSlotId
) {
  if (!isKnownPlannerSlot(plannerSlotId)) {
    return null;
  }

  return (
    normalizeRecordId(
      build?.slots?.[plannerSlotId]
    ) || null
  );
}

/*
 * Looks up the equipped record using the app's recordsById Map.
 */
export function getEquippedRecord(
  build,
  plannerSlotId,
  recordsById
) {
  const recordId = getEquippedRecordId(
    build,
    plannerSlotId
  );

  if (!recordId) {
    return null;
  }

  return recordsById.get(recordId) ?? null;
}

/*
 * Returns one entry for every occupied planner slot.
 *
 * A missing record is retained in the result so the UI can show that a
 * saved item no longer exists in the current database.
 */
export function getOccupiedSlotEntries(
  build,
  recordsById
) {
  const entries = [];

  for (const plannerSlotId of PLANNER_SLOT_IDS) {
    const recordId = getEquippedRecordId(
      build,
      plannerSlotId
    );

    if (!recordId) {
      continue;
    }

    entries.push({
      plannerSlotId,
      plannerSlotLabel:
        getPlannerSlotLabel(plannerSlotId),
      recordId,
      record:
        recordsById.get(recordId) ?? null
    });
  }

  return entries;
}

/*
 * Returns only records that still exist in the loaded database.
 */
export function getEquippedRecords(
  build,
  recordsById
) {
  return getOccupiedSlotEntries(
    build,
    recordsById
  )
    .map(entry => entry.record)
    .filter(Boolean);
}

/*
 * Returns the number of occupied planner positions.
 */
export function getOccupiedSlotCount(build) {
  return PLANNER_SLOT_IDS.filter(
    plannerSlotId =>
      Boolean(
        getEquippedRecordId(
          build,
          plannerSlotId
        )
      )
  ).length;
}

/*
 * Returns the normal item slots plus Any 1 and Any 2.
 *
 * The actual compatibility logic lives in item-rules.js.
 */
export function getAvailableDestinations(
  record
) {
  if (!record) {
    return [];
  }

  return getCompatiblePlannerSlots(record);
}

/*
 * Returns detailed destination information for the slot-choice dialog.
 */
export function getDestinationChoices(
  build,
  record,
  recordsById
) {
  return getAvailableDestinations(record)
    .map(plannerSlotId => {
      const equippedRecordId =
        getEquippedRecordId(
          build,
          plannerSlotId
        );

      const equippedRecord =
        equippedRecordId
          ? recordsById.get(equippedRecordId) ?? null
          : null;

      return {
        plannerSlotId,
        plannerSlotLabel:
          getPlannerSlotLabel(plannerSlotId),

        occupied:
          Boolean(equippedRecordId),

        equippedRecordId,
        equippedRecord,

        sameItem:
          Boolean(
            equippedRecordId &&
            equippedRecordId ===
              getRecordId(record)
          )
      };
    });
}

/*
 * Equips an item into a planner slot.
 *
 * This function validates:
 * - The record has a record_id
 * - The item is normally equippable
 * - The selected planner slot is one of its valid destinations
 *
 * Existing contents are replaced only when allowReplace is true.
 */
export function equipRecord(
  build,
  record,
  plannerSlotId,
  options = {}
) {
  const {
    allowReplace = false
  } = options;

  const recordId =
    getRecordId(record);

  if (!recordId) {
    return {
      success: false,
      reason: "missing-record-id",
      build,
      replacedRecordId: null
    };
  }

  if (!isNormallyEquippable(record)) {
    return {
      success: false,
      reason: "not-equippable",
      build,
      replacedRecordId: null
    };
  }

  const compatibleSlots =
    getCompatiblePlannerSlots(record);

  if (
    !compatibleSlots.includes(
      plannerSlotId
    )
  ) {
    return {
      success: false,
      reason: "incompatible-slot",
      build,
      replacedRecordId: null
    };
  }

  const currentRecordId =
    getEquippedRecordId(
      build,
      plannerSlotId
    );

  if (
    currentRecordId &&
    currentRecordId !== recordId &&
    !allowReplace
  ) {
    return {
      success: false,
      reason: "slot-occupied",
      build,
      replacedRecordId: currentRecordId
    };
  }

  const updatedBuild = saveBuild({
    ...normalizeBuild(build),

    slots: {
      ...normalizeBuild(build).slots,
      [plannerSlotId]: recordId
    }
  });

  return {
    success: true,
    reason:
      currentRecordId &&
      currentRecordId !== recordId
        ? "replaced"
        : "equipped",

    build: updatedBuild,

    replacedRecordId:
      currentRecordId &&
      currentRecordId !== recordId
        ? currentRecordId
        : null
  };
}

/*
 * Removes the item from one planner slot.
 */
export function removeFromSlot(
  build,
  plannerSlotId
) {
  if (!isKnownPlannerSlot(plannerSlotId)) {
    return {
      success: false,
      reason: "unknown-slot",
      build
    };
  }

  const currentRecordId =
    getEquippedRecordId(
      build,
      plannerSlotId
    );

  if (!currentRecordId) {
    return {
      success: false,
      reason: "slot-empty",
      build
    };
  }

  const normalizedBuild =
    normalizeBuild(build);

  const updatedBuild = saveBuild({
    ...normalizedBuild,

    slots: {
      ...normalizedBuild.slots,
      [plannerSlotId]: null
    }
  });

  return {
    success: true,
    reason: "removed",
    removedRecordId: currentRecordId,
    build: updatedBuild
  };
}

/*
 * Removes every occurrence of one record ID from the planner.
 *
 * This is useful if the same item was deliberately placed into more than
 * one legal position.
 */
export function removeRecordFromBuild(
  build,
  recordId
) {
  const normalizedRecordId =
    normalizeRecordId(recordId);

  if (!normalizedRecordId) {
    return {
      success: false,
      reason: "missing-record-id",
      build,
      removedSlots: []
    };
  }

  const normalizedBuild =
    normalizeBuild(build);

  const updatedSlots = {
    ...normalizedBuild.slots
  };

  const removedSlots = [];

  for (const plannerSlotId of PLANNER_SLOT_IDS) {
    if (
      updatedSlots[plannerSlotId] ===
      normalizedRecordId
    ) {
      updatedSlots[plannerSlotId] = null;
      removedSlots.push(plannerSlotId);
    }
  }

  if (removedSlots.length === 0) {
    return {
      success: false,
      reason: "record-not-equipped",
      build,
      removedSlots: []
    };
  }

  const updatedBuild = saveBuild({
    ...normalizedBuild,
    slots: updatedSlots
  });

  return {
    success: true,
    reason: "removed",
    build: updatedBuild,
    removedSlots
  };
}

/*
 * Returns true when a specific record is equipped anywhere.
 */
export function isRecordEquipped(
  build,
  recordId
) {
  const normalizedRecordId =
    normalizeRecordId(recordId);

  if (!normalizedRecordId) {
    return false;
  }

  return PLANNER_SLOT_IDS.some(
    plannerSlotId =>
      getEquippedRecordId(
        build,
        plannerSlotId
      ) === normalizedRecordId
  );
}

/*
 * Returns every planner position containing the record.
 */
export function getSlotsContainingRecord(
  build,
  recordId
) {
  const normalizedRecordId =
    normalizeRecordId(recordId);

  if (!normalizedRecordId) {
    return [];
  }

  return PLANNER_SLOT_IDS.filter(
    plannerSlotId =>
      getEquippedRecordId(
        build,
        plannerSlotId
      ) === normalizedRecordId
  );
}

/*
 * Returns basic build diagnostics for the UI.
 */
export function getBuildDiagnostics(
  build,
  recordsById
) {
  const normalizedBuild =
    normalizeBuild(build);

  const occupiedEntries =
    getOccupiedSlotEntries(
      normalizedBuild,
      recordsById
    );

  const missingEntries =
    occupiedEntries.filter(
      entry => !entry.record
    );

  return {
    version: normalizedBuild.version,
    name: normalizedBuild.name,

    totalSlots:
      PLANNER_SLOT_IDS.length,

    occupiedSlots:
      occupiedEntries.length,

    emptySlots:
      PLANNER_SLOT_IDS.length -
      occupiedEntries.length,

    missingRecordCount:
      missingEntries.length,

    missingRecordIds:
      missingEntries.map(
        entry => entry.recordId
      )
  };
}

/*
 * Repairs a build loaded from localStorage.
 *
 * This ensures:
 * - Every current planner slot exists
 * - Unknown saved slots are discarded
 * - Invalid values become null
 * - Missing metadata receives a safe default
 */
export function normalizeBuild(build) {
  const emptyBuild =
    createEmptyBuild();

  if (
    !build ||
    typeof build !== "object" ||
    Array.isArray(build)
  ) {
    return emptyBuild;
  }

  const normalizedSlots =
    createEmptySlotState();

  for (const plannerSlotId of PLANNER_SLOT_IDS) {
    normalizedSlots[plannerSlotId] =
      normalizeRecordId(
        build?.slots?.[plannerSlotId]
      ) || null;
  }

  return {
    version: BUILD_VERSION,

    name:
      typeof build.name === "string"
        ? build.name.trim()
        : "",

    createdAt:
      isValidDateString(build.createdAt)
        ? build.createdAt
        : emptyBuild.createdAt,

    updatedAt:
      isValidDateString(build.updatedAt)
        ? build.updatedAt
        : emptyBuild.updatedAt,

    slots: normalizedSlots
  };
}

/*
 * Internal helpers
 */

function isKnownPlannerSlot(
  plannerSlotId
) {
  return PLANNER_SLOT_IDS.includes(
    plannerSlotId
  );
}

function normalizeRecordId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

/*
 * The planner module deliberately avoids importing database.js.
 *
 * item-rules.js already depends on database.js, while the planner only
 * needs a stable record ID. Supporting both record_id and id also keeps
 * the planner compatible with older records.
 */
function getRecordId(record) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return "";
  }

  return normalizeRecordId(
    record.record_id ??
    record.id ??
    ""
  );
}

function isValidDateString(value) {
  if (typeof value !== "string") {
    return false;
  }

  return Number.isFinite(
    Date.parse(value)
  );
}
