"use strict";

import {
  getBooleanValue,
  getField,
  getPreferredClasses,
  getPreferredNpcLevel,
  getPreferredRaces,
  getPreferredStats,
  isApproved,
  isEqlConfirmed,
  naturalCompare,
  normalizeLower,
  normalizeText,
  parseLevelRange
} from "./database.js";

const STAT_DEFINITIONS = [
  {
    name: "AC",
    patterns: [
      /\bAC\b/i,
      /\bARMOU?R CLASS\b/i
    ]
  },
  {
    name: "HP",
    patterns: [
      /\bHP\b/i,
      /\bHIT POINTS?\b/i,
      /\bHEALTH\b/i
    ]
  },
  {
    name: "MANA",
    patterns: [
      /\bMANA\b/i
    ]
  },
  {
    name: "STR",
    patterns: [
      /\bSTR\b/i,
      /\bSTRENGTH\b/i
    ]
  },
  {
    name: "STA",
    patterns: [
      /\bSTA\b/i,
      /\bSTAMINA\b/i
    ]
  },
  {
    name: "AGI",
    patterns: [
      /\bAGI\b/i,
      /\bAGILITY\b/i
    ]
  },
  {
    name: "DEX",
    patterns: [
      /\bDEX\b/i,
      /\bDEXTERITY\b/i
    ]
  },
  {
    name: "WIS",
    patterns: [
      /\bWIS\b/i,
      /\bWISDOM\b/i
    ]
  },
  {
    name: "INT",
    patterns: [
      /\bINT\b/i,
      /\bINTELLIGENCE\b/i
    ]
  },
  {
    name: "CHA",
    patterns: [
      /\bCHA\b/i,
      /\bCHARISMA\b/i
    ]
  },
  {
    name: "SV FIRE",
    patterns: [
      /\bSV[\s_-]*FIRE\b/i,
      /\bSAVE[\s_-]*FIRE\b/i,
      /\bFIRE RESIST(?:ANCE)?\b/i,
      /\bFR\b/i
    ]
  },
  {
    name: "SV COLD",
    patterns: [
      /\bSV[\s_-]*COLD\b/i,
      /\bSAVE[\s_-]*COLD\b/i,
      /\bCOLD RESIST(?:ANCE)?\b/i,
      /\bCR\b/i
    ]
  },
  {
    name: "SV MAGIC",
    patterns: [
      /\bSV[\s_-]*MAGIC\b/i,
      /\bSAVE[\s_-]*MAGIC\b/i,
      /\bMAGIC RESIST(?:ANCE)?\b/i,
      /\bMR\b/i
    ]
  },
  {
    name: "SV DISEASE",
    patterns: [
      /\bSV[\s_-]*DISEASE\b/i,
      /\bSAVE[\s_-]*DISEASE\b/i,
      /\bDISEASE RESIST(?:ANCE)?\b/i,
      /\bDR\b/i
    ]
  },
  {
    name: "SV POISON",
    patterns: [
      /\bSV[\s_-]*POISON\b/i,
      /\bSAVE[\s_-]*POISON\b/i,
      /\bPOISON RESIST(?:ANCE)?\b/i,
      /\bPR\b/i
    ]
  },
  {
    name: "HASTE",
    patterns: [
      /\bHASTE\b/i
    ]
  },
  {
    name: "REGEN",
    patterns: [
      /\bREGEN(?:ERATION)?\b/i,
      /\bHP REGEN\b/i
    ]
  },
  {
    name: "MANA REGEN",
    patterns: [
      /\bMANA REGEN(?:ERATION)?\b/i,
      /\bFLOWING THOUGHT\b/i,
      /\bFT\s*\d+/i
    ]
  },
  {
    name: "ATK",
    patterns: [
      /\bATK\b/i,
      /\bATTACK\b/i
    ]
  },
  {
    name: "ENDURANCE",
    patterns: [
      /\bENDURANCE\b/i
    ]
  },
  {
    name: "SPELL DAMAGE",
    patterns: [
      /\bSPELL DAMAGE\b/i
    ]
  },
  {
    name: "HEAL AMOUNT",
    patterns: [
      /\bHEAL AMOUNT\b/i
    ]
  }
];

export function createFilterOptions(records) {
  return {
    continents: getUniqueLogicalValues(
      records,
      "continent"
    ),

    zones: getUniqueLogicalValues(
      records,
      "zone"
    ),

    categories: getUniqueLogicalValues(
      records,
      "itemCategory"
    ),

    slots: getLogicalMultiValues(
      records,
      "slot"
    ),

    classes: getPreferredMultiValues(
      records,
      getPreferredClasses
    ),

    races: getPreferredMultiValues(
      records,
      getPreferredRaces
    ),

    effectTransferValues: getUniqueLogicalValues(
      records,
      "effectTransferValue"
    ),

    verificationStatuses: getUniqueLogicalValues(
      records,
      "verificationStatus"
    ),

    auditActions: getUniqueLogicalValues(
      records,
      "auditAction"
    ),

    confidenceLevels: getUniqueLogicalValues(
      records,
      "confidence"
    ),

    targetPriorities: getUniqueLogicalValues(
      records,
      "targetPriority"
    ),

    stats: getAvailableStats(records)
  };
}

export function filterRecords(records, filters) {
  const searchText = normalizeLower(filters.search);

  return records.filter(record => {
    if (
      filters.approvedOnly &&
      !isApproved(record)
    ) {
      return false;
    }

    if (
      filters.continent &&
      getField(record, "continent") !== filters.continent
    ) {
      return false;
    }

    if (
      filters.zone &&
      getField(record, "zone") !== filters.zone
    ) {
      return false;
    }

    if (
      filters.category &&
      getField(record, "itemCategory") !== filters.category
    ) {
      return false;
    }

    if (
      filters.slot &&
      !containsListValue(
        getField(record, "slot"),
        filters.slot
      )
    ) {
      return false;
    }

    if (
      filters.className &&
      !matchesCompatibilityField(
        getPreferredClasses(record),
        filters.className
      )
    ) {
      return false;
    }

    if (
      filters.race &&
      !matchesCompatibilityField(
        getPreferredRaces(record),
        filters.race
      )
    ) {
      return false;
    }

    if (
      !matchesNpcLevelRange(
        record,
        filters.minimumNpcLevel,
        filters.maximumNpcLevel
      )
    ) {
      return false;
    }

    if (
      !matchesBooleanFilter(
        record,
        "magic",
        filters.magic
      )
    ) {
      return false;
    }

    if (
      !matchesBooleanFilter(
        record,
        "lore",
        filters.lore
      )
    ) {
      return false;
    }

    if (
      !matchesBooleanFilter(
        record,
        "noDrop",
        filters.noDrop
      )
    ) {
      return false;
    }

    if (
      !matchesBooleanFilter(
        record,
        "questItem",
        filters.questItem
      )
    ) {
      return false;
    }

    if (
      !matchesBooleanFilter(
        record,
        "inventoryOnly",
        filters.inventoryOnly
      )
    ) {
      return false;
    }

    if (
      !matchesEffectPresence(
        record,
        filters.effectPresent
      )
    ) {
      return false;
    }

    if (
      filters.effectTransferValue &&
      getField(record, "effectTransferValue") !==
        filters.effectTransferValue
    ) {
      return false;
    }

    if (
      filters.verification === "__confirmed_only__" &&
      !isEqlConfirmed(record)
    ) {
      return false;
    }

    if (
      filters.verification &&
      filters.verification !== "__confirmed_only__" &&
      getField(record, "verificationStatus") !==
        filters.verification
    ) {
      return false;
    }

    if (
      filters.auditAction &&
      getField(record, "auditAction") !==
        filters.auditAction
    ) {
      return false;
    }

    if (
      filters.confidence &&
      getField(record, "confidence") !==
        filters.confidence
    ) {
      return false;
    }

    if (
      filters.targetPriority &&
      getField(record, "targetPriority") !==
        filters.targetPriority
    ) {
      return false;
    }

    if (
      filters.stats.length > 0 &&
      !recordMatchesStats(
        record,
        filters.stats,
        filters.statMode
      )
    ) {
      return false;
    }

    if (
      searchText &&
      !buildSearchText(record).includes(searchText)
    ) {
      return false;
    }

    return true;
  });
}

export function getRecordStats(record) {
  const statText = [
    getField(record, "statsEql"),
    getField(record, "statsRaw"),
    getField(record, "statsClassic")
  ].join(" ");

  return STAT_DEFINITIONS
    .filter(definition =>
      definition.patterns.some(pattern =>
        pattern.test(statText)
      )
    )
    .map(definition => definition.name);
}

export function getZoneSummary(records) {
  const zoneMap = new Map();

  for (const record of records) {
    const zone =
      getField(record, "zone") || "Unknown zone";

    if (!zoneMap.has(zone)) {
      zoneMap.set(zone, {
        zone,
        itemCount: 0,
        slots: new Set(),
        confirmedCount: 0
      });
    }

    const summary = zoneMap.get(zone);

    summary.itemCount += 1;

    for (const slot of splitList(
      getField(record, "slot")
    )) {
      summary.slots.add(slot);
    }

    if (isEqlConfirmed(record)) {
      summary.confirmedCount += 1;
    }
  }

  return [...zoneMap.values()]
    .map(summary => ({
      zone: summary.zone,
      itemCount: summary.itemCount,
      slotCount: summary.slots.size,
      confirmedCount: summary.confirmedCount
    }))
    .sort((left, right) => {
      if (right.itemCount !== left.itemCount) {
        return right.itemCount - left.itemCount;
      }

      return naturalCompare(left.zone, right.zone);
    });
}

function matchesNpcLevelRange(
  record,
  requestedMinimum,
  requestedMaximum
) {
  const requestedMin = parseOptionalNumber(
    requestedMinimum
  );

  const requestedMax = parseOptionalNumber(
    requestedMaximum
  );

  if (
    requestedMin === null &&
    requestedMax === null
  ) {
    return true;
  }

  const recordRange = parseLevelRange(
    getPreferredNpcLevel(record)
  );

  if (
    recordRange.minimum === null &&
    recordRange.maximum === null
  ) {
    return false;
  }

  if (
    requestedMin !== null &&
    recordRange.maximum < requestedMin
  ) {
    return false;
  }

  if (
    requestedMax !== null &&
    recordRange.minimum > requestedMax
  ) {
    return false;
  }

  return true;
}

function matchesBooleanFilter(
  record,
  logicalFieldName,
  filterValue
) {
  if (!filterValue) {
    return true;
  }

  const booleanValue = getBooleanValue(
    record,
    logicalFieldName
  );

  if (filterValue === "yes") {
    return booleanValue === true;
  }

  if (filterValue === "no") {
    return booleanValue === false;
  }

  if (filterValue === "unknown") {
    return booleanValue === null;
  }

  return true;
}

function matchesEffectPresence(record, filterValue) {
  if (!filterValue) {
    return true;
  }

  const effectText = [
    getField(record, "procClickFocus"),
    getField(record, "effectDescription")
  ]
    .filter(Boolean)
    .join(" ");

  if (filterValue === "yes") {
    return effectText !== "";
  }

  if (filterValue === "no") {
    return effectText === "";
  }

  return true;
}

function recordMatchesStats(
  record,
  selectedStats,
  statMode
) {
  const recordStats = new Set(
    getRecordStats(record)
  );

  if (statMode === "any") {
    return selectedStats.some(stat =>
      recordStats.has(stat)
    );
  }

  return selectedStats.every(stat =>
    recordStats.has(stat)
  );
}

function buildSearchText(record) {
  return [
    getField(record, "itemName"),
    getField(record, "continent"),
    getField(record, "zone"),
    getField(record, "itemCategory"),
    getField(record, "slot"),
    getPreferredStats(record),
    getPreferredClasses(record),
    getPreferredRaces(record),
    getField(record, "sourceNpc"),
    getPreferredNpcLevel(record),
    getField(record, "procClickFocus"),
    getField(record, "dropFrequency"),
    getField(record, "generalValueNotes"),
    getField(record, "spawnLocation"),
    getField(record, "dropNotes"),
    getField(record, "eqlChangesSummary"),
    getField(record, "eqlVerificationNotes"),
    getField(record, "researchNotes")
  ]
    .map(normalizeLower)
    .join(" ");
}

function getUniqueLogicalValues(
  records,
  logicalFieldName
) {
  return [...new Set(
    records
      .map(record =>
        getField(record, logicalFieldName)
      )
      .filter(Boolean)
  )].sort(naturalCompare);
}

function getLogicalMultiValues(
  records,
  logicalFieldName
) {
  return [...new Set(
    records.flatMap(record =>
      splitList(
        getField(record, logicalFieldName)
      )
    )
  )].sort(naturalCompare);
}

function getPreferredMultiValues(
  records,
  getter
) {
  const values = new Set();

  for (const record of records) {
    for (const value of splitList(getter(record))) {
      const normalized = normalizeLower(value);

      if (
        normalized !== "all" &&
        !normalized.startsWith("all except")
      ) {
        values.add(value);
      }
    }
  }

  return [...values].sort(naturalCompare);
}

function matchesCompatibilityField(
  fieldValue,
  selectedValue
) {
  const normalizedField = normalizeLower(fieldValue);
  const normalizedSelection =
    normalizeLower(selectedValue);

  if (!normalizedField) {
    return false;
  }

  if (
    normalizedField === "all" ||
    normalizedField === "all races" ||
    normalizedField === "all classes"
  ) {
    return true;
  }

  if (normalizedField.startsWith("all except")) {
    const exclusions = splitList(
      normalizedField.replace("all except", "")
    ).map(normalizeLower);

    return !exclusions.includes(
      normalizedSelection
    );
  }

  return splitList(normalizedField)
    .map(normalizeLower)
    .includes(normalizedSelection);
}

function containsListValue(
  fieldValue,
  selectedValue
) {
  const normalizedSelection =
    normalizeLower(selectedValue);

  return splitList(fieldValue)
    .map(normalizeLower)
    .includes(normalizedSelection);
}

function splitList(value) {
  return normalizeText(value)
    .split(/\s*(?:,|\/|\||;)\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

function getAvailableStats(records) {
  const stats = new Set();

  for (const record of records) {
    for (const stat of getRecordStats(record)) {
      stats.add(stat);
    }
  }

  const canonicalOrder = STAT_DEFINITIONS.map(
    definition => definition.name
  );

  return [...stats].sort(
    (left, right) =>
      canonicalOrder.indexOf(left) -
      canonicalOrder.indexOf(right)
  );
}

function parseOptionalNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}
