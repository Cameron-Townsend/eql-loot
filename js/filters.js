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

/*
 * Known focus-effect families.
 *
 * Exact ranks, percentages, tiers, and spelling variants are collapsed
 * into one user-facing category. The original CSV text is never changed.
 *
 * Add new families here as they appear in researched EQL data.
 */
const FOCUS_EFFECT_DEFINITIONS = [
  {
    name: "Improved Healing",
    patterns: [
      /\bIMPROVED\s+HEALING\b/i,
      /\bHEALING\s+ENHANCEMENT\b/i
    ]
  },
  {
    name: "Mana Preservation",
    patterns: [
      /\bMANA\s+PRESERVATION\b/i,
      /\bMANA\s+CONSERVATION\b/i
    ]
  },
  {
    name: "Extended Enhancement",
    patterns: [
      /\bEXTENDED\s+ENHANCEMENT\b/i,
      /\bEXTENDED\s+BUFFS?\b/i
    ]
  },
  {
    name: "Spell Haste",
    patterns: [
      /\bSPELL\s+HASTE\b/i,
      /\bCASTING\s+HASTE\b/i
    ]
  },
  {
    name: "Improved Damage",
    patterns: [
      /\bIMPROVED\s+DAMAGE\b/i
    ]
  },
  {
    name: "Burning Affliction",
    patterns: [
      /\bBURNING\s+AFFLICTION\b/i
    ]
  },
  {
    name: "Affliction Efficiency",
    patterns: [
      /\bAFFLICTION\s+EFFICIENCY\b/i
    ]
  },
  {
    name: "Affliction Haste",
    patterns: [
      /\bAFFLICTION\s+HASTE\b/i
    ]
  },
  {
    name: "Affliction Duration",
    patterns: [
      /\bAFFLICTION\s+DURATION\b/i,
      /\bEXTENDED\s+AFFLICTION\b/i
    ]
  },
  {
    name: "Reagent Conservation",
    patterns: [
      /\bREAGENT\s+CONSERVATION\b/i,
      /\bCONSERVE\s+REAGENT\b/i
    ]
  },
  {
    name: "Improved Reclaim Energy",
    patterns: [
      /\bIMPROVED\s+RECLAIM\s+ENERGY\b/i,
      /\bRECLAIM\s+ENERGY\b/i
    ]
  },
  {
    name: "Pet Enhancement",
    patterns: [
      /\bPET\s+ENHANCEMENT\b/i,
      /\bENHANCED\s+MINION\b/i,
      /\bMINION\s+ENHANCEMENT\b/i
    ]
  },
  {
    name: "Summoning Efficiency",
    patterns: [
      /\bSUMMONING\s+EFFICIENCY\b/i,
      /\bSUMMONING\s+PRESERVATION\b/i
    ]
  },
  {
    name: "Improved Dodge",
    patterns: [
      /\bIMPROVED\s+DODGE\b/i
    ]
  },
  {
    name: "Improved Block",
    patterns: [
      /\bIMPROVED\s+BLOCK\b/i
    ]
  },
  {
    name: "Improved Parry",
    patterns: [
      /\bIMPROVED\s+PARRY\b/i
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

    effectTypes: getAvailableEffectTypes(records),

    focusEffects: getAvailableFocusEffects(records),

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
      filters.effectType &&
      !getRecordEffectTypes(record).includes(
        filters.effectType
      )
    ) {
      return false;
    }

    if (
      filters.focusEffect &&
      !getRecordFocusEffects(record).includes(
        filters.focusEffect
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

/*
 * Returns a record's normalized focus families.
 *
 * One item may theoretically contain multiple focus families.
 */
export function getRecordFocusEffects(record) {
  const effectText = getEffectText(record);

  if (!effectText) {
    return [];
  }

  const matchedFamilies = FOCUS_EFFECT_DEFINITIONS
    .filter(definition =>
      definition.patterns.some(pattern =>
        pattern.test(effectText)
      )
    )
    .map(definition => definition.name);

  if (matchedFamilies.length > 0) {
    return matchedFamilies;
  }

  /*
   * Future-proof fallback:
   *
   * If the CSV clearly labels something as a focus but it is not yet in
   * FOCUS_EFFECT_DEFINITIONS, create a cleaned family name by removing
   * ranks, percentages, and common tier suffixes.
   */
  if (/\bFOCUS\b/i.test(effectText)) {
    const fallbackName =
      normalizeUnknownFocusName(effectText);

    return fallbackName
      ? [fallbackName]
      : ["Other Focus Effect"];
  }

  return [];
}

export function getRecordEffectTypes(record) {
  const effectText = getEffectText(record);

  if (!effectText) {
    return [];
  }

  const types = new Set();

  if (
    /\bPROC\b/i.test(effectText) ||
    /\bPROCS?\b/i.test(effectText)
  ) {
    types.add("Proc");
  }

  if (
    /\bCLICK\b/i.test(effectText) ||
    /\bCLICKY\b/i.test(effectText) ||
    /\bRIGHT[\s-]*CLICK\b/i.test(effectText)
  ) {
    types.add("Click");
  }

  if (
    /\bFOCUS\b/i.test(effectText) ||
    getRecordFocusEffects(record).length > 0
  ) {
    types.add("Focus");
  }

  /*
   * If an effect is present but no explicit type word exists, keep it
   * available under Other rather than discarding it.
   */
  if (types.size === 0) {
    types.add("Other");
  }

  return [...types];
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

function getAvailableEffectTypes(records) {
  const values = new Set();

  for (const record of records) {
    for (const type of getRecordEffectTypes(record)) {
      values.add(type);
    }
  }

  const preferredOrder = [
    "Focus",
    "Click",
    "Proc",
    "Other"
  ];

  return [...values].sort(
    (left, right) =>
      preferredOrder.indexOf(left) -
      preferredOrder.indexOf(right)
  );
}

function getAvailableFocusEffects(records) {
  const values = new Set();

  for (const record of records) {
    for (
      const focusEffect
      of getRecordFocusEffects(record)
    ) {
      values.add(focusEffect);
    }
  }

  return [...values].sort(naturalCompare);
}

function getEffectText(record) {
  return [
    getField(record, "procClickFocus"),
    getField(record, "effectDescription")
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeUnknownFocusName(effectText) {
  let cleaned = normalizeText(effectText);

  cleaned = cleaned
    .replace(/\bFOCUS(?:\s+EFFECT)?\s*[:\-]?\s*/gi, "")
    .replace(/\bRANK\s*[IVXLCDM\d]+\b/gi, "")
    .replace(/\bTIER\s*[IVXLCDM\d]+\b/gi, "")
    .replace(/\bLEVEL\s*\d+\b/gi, "")
    .replace(/\b[IVXLCDM]+\b$/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*%\b/g, "")
    .replace(/\b\d+\b$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  /*
   * Prevent an entire descriptive sentence from becoming a dropdown value.
   */
  if (
    cleaned.length > 50 ||
    cleaned.split(/\s+/).length > 7
  ) {
    return "Other Focus Effect";
  }

  return toTitleCase(cleaned);
}

function toTitleCase(value) {
  return normalizeLower(value)
    .split(/\s+/)
    .map(word =>
      word.length > 0
        ? word[0].toUpperCase() + word.slice(1)
        : word
    )
    .join(" ");
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

  const effectText = getEffectText(record);

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
    getField(record, "effectDescription"),
    getRecordFocusEffects(record).join(" "),
    getRecordEffectTypes(record).join(" "),
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
