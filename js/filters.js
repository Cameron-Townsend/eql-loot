"use strict";

import {
  getPreferredClasses,
  getPreferredNpcLevel,
  getPreferredRaces,
  getPreferredStats,
  isApproved,
  naturalCompare,
  normalizeLower,
  normalizeText
} from "./database.js";

/*
 * Canonical stat names and the forms that may appear in CSV fields.
 *
 * The canonical value is what appears in the filter interface.
 */
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
      /\bFT\b/i,
      /\bFLOWING THOUGHT\b/i
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
    continents: getUniqueValues(records, "continent"),
    zones: getUniqueValues(records, "zone"),
    categories: getUniqueValues(records, "item_category"),
    slots: getMultiValues(records, "slot"),
    classes: getPreferredClassValues(records),

    verificationStatuses: getUniqueValues(
      records,
      "eql_verification_status"
    ),

    confidenceLevels: getUniqueValues(
      records,
      "data_confidence"
    ),

    stats: getAvailableStats(records)
  };
}

export function filterRecords(records, filters) {
  const searchText = normalizeLower(filters.search);
  const selectedClass = normalizeLower(filters.className);

  const selectedStats = Array.isArray(filters.stats)
    ? filters.stats
    : [];

  return records.filter(record => {
    if (
      filters.approvedOnly &&
      !isApproved(record)
    ) {
      return false;
    }

    if (
      filters.continent &&
      record.continent !== filters.continent
    ) {
      return false;
    }

    if (
      filters.zone &&
      record.zone !== filters.zone
    ) {
      return false;
    }

    if (
      filters.category &&
      record.item_category !== filters.category
    ) {
      return false;
    }

    if (
      filters.slot &&
      !containsListValue(record.slot, filters.slot)
    ) {
      return false;
    }

    if (
      filters.verification &&
      record.eql_verification_status !== filters.verification
    ) {
      return false;
    }

    if (
      filters.confidence &&
      record.data_confidence !== filters.confidence
    ) {
      return false;
    }

    if (
      selectedClass &&
      !recordMatchesClass(record, selectedClass)
    ) {
      return false;
    }

    if (
      selectedStats.length > 0 &&
      !recordMatchesStats(
        record,
        selectedStats,
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
  const statText = buildStatText(record);

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
      normalizeText(record.zone) || "Unknown zone";

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

    for (const slot of splitList(record.slot)) {
      summary.slots.add(slot);
    }

    if (
      normalizeLower(record.eql_verification_status)
        .startsWith("eql confirmed")
    ) {
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

function getAvailableStats(records) {
  const stats = new Set();

  for (const record of records) {
    for (const stat of getRecordStats(record)) {
      stats.add(stat);
    }
  }

  return [...stats].sort(statSort);
}

function recordMatchesStats(
  record,
  selectedStats,
  statMode
) {
  const recordStats = new Set(getRecordStats(record));

  if (statMode === "any") {
    return selectedStats.some(stat =>
      recordStats.has(stat)
    );
  }

  return selectedStats.every(stat =>
    recordStats.has(stat)
  );
}

function buildStatText(record) {
  return [
    record.stats_eql,
    record.stats_classic,
    record.stats_raw,
    record.proc_click_focus,
    record.effect_name,
    record.effect_description,
    record.general_value_notes
  ]
    .map(normalizeText)
    .join(" ");
}

function buildSearchText(record) {
  return [
    record.item_name,
    record.item_category,
    record.zone,
    record.continent,
    record.slot,
    record.source_npc,
    record.source_npc_class,
    record.source_npc_race_type,
    record.proc_click_focus,
    getPreferredStats(record),
    getPreferredClasses(record),
    getPreferredRaces(record),
    getPreferredNpcLevel(record),
    record.best_for_classes,
    record.best_for_archetypes,
    record.general_value_notes,
    record.personal_build_notes,
    record.drop_notes,
    record.eql_changes_summary,
    record.eql_verification_notes
  ]
    .map(normalizeLower)
    .join(" ");
}

function getUniqueValues(records, fieldName) {
  return [...new Set(
    records
      .map(record =>
        normalizeText(record[fieldName])
      )
      .filter(Boolean)
  )].sort(naturalCompare);
}

function getMultiValues(records, fieldName) {
  return [...new Set(
    records.flatMap(record =>
      splitList(record[fieldName])
    )
  )].sort(naturalCompare);
}

function getPreferredClassValues(records) {
  const classValues = new Set();

  for (const record of records) {
    const classText = getPreferredClasses(record);

    for (const value of splitList(classText)) {
      const normalized = normalizeLower(value);

      if (
        normalized !== "all" &&
        !normalized.startsWith("all except")
      ) {
        classValues.add(value);
      }
    }
  }

  return [...classValues].sort(naturalCompare);
}

function recordMatchesClass(record, selectedClass) {
  const classText = normalizeLower(
    getPreferredClasses(record)
  );

  if (!classText) {
    return false;
  }

  if (classText === "all") {
    return true;
  }

  if (classText.startsWith("all except")) {
    const exclusions = classText
      .replace("all except", "")
      .split(/[;,/|]+/)
      .map(value => value.trim())
      .filter(Boolean);

    return !exclusions.includes(selectedClass);
  }

  return splitList(classText)
    .map(normalizeLower)
    .includes(selectedClass);
}

function containsListValue(fieldValue, selectedValue) {
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

function statSort(left, right) {
  const order = STAT_DEFINITIONS.map(
    definition => definition.name
  );

  return (
    order.indexOf(left) -
    order.indexOf(right)
  );
}
