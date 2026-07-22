"use strict";

/*
 * EverQuest Legends Loot Explorer
 * Core database and compatibility layer
 *
 * The CSV parser retains every imported column. This module defines which
 * columns the application intentionally understands and how newer and older
 * column names map to the same logical field.
 */

export const FIELD_GROUPS = {
  mainBrowsing: [
    "item_name",
    "zone",
    "item_category",
    "slot",
    "stats_eql",
    "classes_eql",
    "races_eql",
    "source_npc",
    "source_npc_level_eql",
    "proc_click_focus",
    "drop_frequency",
    "eql_verification_status",
    "data_confidence",
    "target_priority_general"
  ],

  advancedGameplay: [
    "placeholder",
    "placeholder_level_range",
    "nearby_enemy_level_range",
    "spawn_type",
    "spawn_location",
    "respawn_timer",
    "time_condition",
    "special_abilities",
    "social_or_add_risk",
    "faction_consequences",
    "drop_rate_reported",
    "drop_notes",
    "effect_transfer_value",
    "upgradeable",
    "maximum_upgrade_rank",
    "duplicate_farming_value",
    "effect_extractable",
    "effect_extraction_rank",
    "challenge_tier_observed",
    "personal_loot_confirmed"
  ],

  researchAndProvenance: [
    "eql_audit_action",
    "eql_wiki_source",
    "eql_official_source",
    "official_patch_date",
    "eql_last_checked",
    "eql_changes_summary",
    "eql_verification_notes",
    "evidence_strength",
    "current_build_confirmed",
    "conflict_status",
    "source_primary",
    "source_secondary",
    "research_notes",
    "revision",
    "approved"
  ]
};

/*
 * Logical application fields mapped to current and legacy CSV column names.
 *
 * The first populated alias wins. Future CSV files can add columns without
 * requiring importer changes.
 */
export const FIELD_ALIASES = {
  recordId: [
    "record_id",
    "id"
  ],

  batch: [
    "batch",
    "batch_id",
    "batch_number"
  ],

  itemName: [
    "item_name",
    "name"
  ],

  continent: [
    "continent",
    "region",
    "world_region"
  ],

  zone: [
    "zone",
    "zone_name"
  ],

  itemCategory: [
    "item_category",
    "category",
    "item_type"
  ],

  slot: [
    "slot",
    "slots",
    "equipment_slot"
  ],

  statsEql: [
    "stats_eql",
    "eql_stats"
  ],

  statsRaw: [
    "stats_raw",
    "raw_stats",
    "stats"
  ],

  statsClassic: [
    "stats_classic",
    "classic_stats"
  ],

  classesEql: [
    "classes_eql",
    "eql_classes"
  ],

  classesClassic: [
    "classes_classic",
    "classic_classes"
  ],

  racesEql: [
    "races_eql",
    "eql_races"
  ],

  racesClassic: [
    "races_classic",
    "classic_races"
  ],

  sourceNpc: [
    "source_npc",
    "npc_name",
    "drop_source"
  ],

  sourceNpcLevelEql: [
    "source_npc_level_eql",
    "eql_npc_level",
    "npc_level_eql"
  ],

  sourceNpcLevel: [
    "source_npc_level",
    "npc_level",
    "source_level"
  ],

  sourceNpcLevelClassic: [
    "source_npc_level_classic",
    "classic_npc_level",
    "npc_level_classic"
  ],

  procClickFocus: [
    "proc_click_focus",
    "proc_click_effect",
    "effect",
    "effect_name"
  ],

  effectDescription: [
    "effect_description",
    "proc_click_focus_description"
  ],

  dropFrequency: [
    "drop_frequency",
    "drop_rarity"
  ],

  dropRateReported: [
    "drop_rate_reported",
    "reported_drop_rate",
    "drop_rate"
  ],

  verificationStatus: [
    "eql_verification_status",
    "verification_status",
    "eql_status"
  ],

  confidence: [
    "data_confidence",
    "confidence"
  ],

  targetPriority: [
    "target_priority_general",
    "target_priority"
  ],

  generalValueNotes: [
    "general_value_notes",
    "general_value",
    "value_notes"
  ],

  magic: [
    "magic",
    "is_magic"
  ],

  lore: [
    "lore",
    "is_lore"
  ],

  noDrop: [
    "no_drop",
    "nodrop",
    "no_drop_flag"
  ],

  questItem: [
    "quest_item",
    "is_quest_item"
  ],

  inventoryOnly: [
    "inventory_only",
    "is_inventory_only"
  ],

  placeholder: [
    "placeholder",
    "placeholder_npc"
  ],

  placeholderLevelRange: [
    "placeholder_level_range",
    "placeholder_levels"
  ],

  nearbyEnemyLevelRange: [
    "nearby_enemy_level_range",
    "nearby_enemy_levels"
  ],

  spawnType: [
    "spawn_type"
  ],

  spawnLocation: [
    "spawn_location",
    "location",
    "spawn_notes"
  ],

  respawnTimer: [
    "respawn_timer",
    "respawn"
  ],

  timeCondition: [
    "time_condition",
    "spawn_time_condition"
  ],

  specialAbilities: [
    "special_abilities",
    "npc_special_abilities"
  ],

  socialAddRisk: [
    "social_or_add_risk",
    "social_add_risk",
    "add_risk"
  ],

  factionConsequences: [
    "faction_consequences",
    "faction_impact"
  ],

  dropNotes: [
    "drop_notes",
    "drop_rate_notes"
  ],

  effectTransferValue: [
    "effect_transfer_value",
    "transfer_value"
  ],

  upgradeable: [
    "upgradeable",
    "is_upgradeable"
  ],

  maximumUpgradeRank: [
    "maximum_upgrade_rank",
    "max_upgrade_rank"
  ],

  duplicateFarmingValue: [
    "duplicate_farming_value"
  ],

  effectExtractable: [
    "effect_extractable",
    "extractable_effect"
  ],

  effectExtractionRank: [
    "effect_extraction_rank",
    "extraction_rank"
  ],

  challengeTierObserved: [
    "challenge_tier_observed",
    "observed_challenge_tier"
  ],

  personalLootConfirmed: [
    "personal_loot_confirmed"
  ],

  auditAction: [
    "eql_audit_action",
    "audit_action"
  ],

  eqlWikiSource: [
    "eql_wiki_source",
    "eql_wiki_url",
    "eql_source_url"
  ],

  eqlOfficialSource: [
    "eql_official_source",
    "official_eql_source",
    "official_source_url"
  ],

  officialPatchDate: [
    "official_patch_date",
    "patch_date"
  ],

  eqlLastChecked: [
    "eql_last_checked",
    "last_checked"
  ],

  eqlChangesSummary: [
    "eql_changes_summary",
    "changes_summary"
  ],

  eqlVerificationNotes: [
    "eql_verification_notes",
    "verification_notes"
  ],

  evidenceStrength: [
    "evidence_strength"
  ],

  currentBuildConfirmed: [
    "current_build_confirmed"
  ],

  conflictStatus: [
    "conflict_status"
  ],

  sourcePrimary: [
    "source_primary",
    "primary_source"
  ],

  sourceSecondary: [
    "source_secondary",
    "secondary_source"
  ],

  researchNotes: [
    "research_notes"
  ],

  revision: [
    "revision",
    "record_revision"
  ],

  approved: [
    "approved",
    "approval_status"
  ],

  classicSource: [
    "classic_source",
    "classic_source_url",
    "project1999_url",
    "p99_source",
    "p99_url"
  ],

  classicBaselineNotes: [
    "classic_baseline_notes",
    "classic_notes",
    "classic_research_notes"
  ],

  eraStatus: [
    "era_status",
    "eql_era_status"
  ],

  sourceNpcClass: [
    "source_npc_class",
    "npc_class"
  ],

  sourceNpcRaceType: [
    "source_npc_race_type",
    "npc_race_type",
    "npc_type"
  ],

  damage: [
    "damage"
  ],

  delay: [
    "delay"
  ],

  weaponSkill: [
    "weapon_skill"
  ],

  weight: [
    "weight"
  ],

  size: [
    "size"
  ]
};

/*
 * Only these fields are required for a row to function as a loot record.
 * New research fields remain optional.
 */
export const REQUIRED_LOOT_COLUMNS = [
  "record_id",
  "item_name"
];

export function buildDatabase(fileResults) {
  const diagnostics = {
    filesDiscovered: fileResults.length,
    filesLoaded: 0,
    filesFailed: 0,

    lootFiles: 0,
    evidenceFiles: 0,
    historyFiles: 0,
    unknownFiles: 0,

    rawLootRecords: 0,
    uniqueRecords: 0,

    duplicateRecords: [],
    malformedRecords: [],
    missingRequiredColumns: [],
    fileErrors: []
  };

  const recordsById = new Map();
  const pendingEvidence = [];
  const pendingHistory = [];

  for (const fileResult of fileResults) {
    if (!fileResult.loaded) {
      diagnostics.filesFailed += 1;

      diagnostics.fileErrors.push({
        file: fileResult.file.filename,
        error: fileResult.error
      });

      continue;
    }

    diagnostics.filesLoaded += 1;

    const datasetType = classifyDataset(
      fileResult.headers,
      fileResult.file.filename
    );

    if (datasetType === "evidence") {
      diagnostics.evidenceFiles += 1;
      pendingEvidence.push(...fileResult.records);
      continue;
    }

    if (datasetType === "history") {
      diagnostics.historyFiles += 1;
      pendingHistory.push(...fileResult.records);
      continue;
    }

    if (datasetType !== "loot") {
      diagnostics.unknownFiles += 1;
      continue;
    }

    diagnostics.lootFiles += 1;
    diagnostics.rawLootRecords += fileResult.records.length;

    const missingColumns = REQUIRED_LOOT_COLUMNS.filter(
      column => !fileResult.headers.includes(column)
    );

    if (missingColumns.length > 0) {
      diagnostics.missingRequiredColumns.push({
        file: fileResult.file.filename,
        columns: missingColumns
      });
    }

    for (const rawRecord of fileResult.records) {
      const record = prepareLootRecord(rawRecord);
      const recordId = getField(record, "recordId");

      if (!recordId) {
        diagnostics.malformedRecords.push({
          file: record.__sourceFile,
          row: record.__sourceRow,
          problem: "Missing record_id"
        });

        continue;
      }

      const existingRecord = recordsById.get(recordId);

      if (!existingRecord) {
        recordsById.set(recordId, record);
        continue;
      }

      const incomingRevision = parseRevision(
        getField(record, "revision")
      );

      const existingRevision = parseRevision(
        getField(existingRecord, "revision")
      );

      if (incomingRevision > existingRevision) {
        recordsById.set(recordId, record);

        diagnostics.duplicateRecords.push({
          recordId,
          action: "Higher revision replaced earlier record",
          keptRevision: incomingRevision,
          discardedRevision: existingRevision
        });
      } else {
        diagnostics.duplicateRecords.push({
          recordId,
          action: "Earlier or equal revision retained",
          keptRevision: existingRevision,
          discardedRevision: incomingRevision
        });
      }
    }
  }

  const records = [...recordsById.values()];

  attachRelatedRecords(
    recordsById,
    pendingEvidence,
    "__evidence"
  );

  attachRelatedRecords(
    recordsById,
    pendingHistory,
    "__changeHistory"
  );

  records.sort((left, right) => {
    const zoneComparison = naturalCompare(
      getField(left, "zone"),
      getField(right, "zone")
    );

    if (zoneComparison !== 0) {
      return zoneComparison;
    }

    return naturalCompare(
      getField(left, "itemName"),
      getField(right, "itemName")
    );
  });

  diagnostics.uniqueRecords = records.length;

  return {
    records,
    diagnostics
  };
}

export function classifyDataset(headers, filename = "") {
  const normalizedHeaders = new Set(
    headers.map(header => normalizeLower(header))
  );

  const normalizedFilename = normalizeLower(filename);

  if (
    normalizedHeaders.has("evidence_id") ||
    normalizedHeaders.has("evidence_type") ||
    normalizedFilename.includes("evidence")
  ) {
    return "evidence";
  }

  if (
    normalizedHeaders.has("change_id") ||
    normalizedHeaders.has("change_type") ||
    normalizedHeaders.has("changed_field") ||
    normalizedFilename.includes("change-history") ||
    normalizedFilename.includes("change_history")
  ) {
    return "history";
  }

  if (
    normalizedHeaders.has("record_id") &&
    (
      normalizedHeaders.has("item_name") ||
      normalizedHeaders.has("name")
    )
  ) {
    return "loot";
  }

  return "unknown";
}

export function prepareLootRecord(record) {
  return {
    ...record,

    /*
     * Hooks for future related CSV datasets.
     * These arrays remain empty when the primary loot CSV is used alone.
     */
    __evidence: [],
    __changeHistory: []
  };
}

function attachRelatedRecords(
  recordsById,
  relatedRecords,
  propertyName
) {
  for (const relatedRecord of relatedRecords) {
    const recordId = normalizeText(
      relatedRecord.record_id
    );

    if (!recordId) {
      continue;
    }

    const lootRecord = recordsById.get(recordId);

    if (!lootRecord) {
      continue;
    }

    lootRecord[propertyName].push(relatedRecord);
  }
}

export function getField(record, logicalFieldName) {
  const aliases =
    FIELD_ALIASES[logicalFieldName] ?? [logicalFieldName];

  for (const alias of aliases) {
    if (
      Object.prototype.hasOwnProperty.call(record, alias) &&
      hasValue(record[alias])
    ) {
      return normalizeText(record[alias]);
    }
  }

  return "";
}

export function getPreferredStats(record) {
  return (
    getField(record, "statsEql") ||
    getField(record, "statsRaw") ||
    getField(record, "statsClassic")
  );
}

export function getPreferredClasses(record) {
  return (
    getField(record, "classesEql") ||
    getField(record, "classesClassic")
  );
}

export function getPreferredRaces(record) {
  return (
    getField(record, "racesEql") ||
    getField(record, "racesClassic")
  );
}

export function getPreferredNpcLevel(record) {
  return (
    getField(record, "sourceNpcLevelEql") ||
    getField(record, "sourceNpcLevel")
  );
}

export function getPreferredSourceLinks(record) {
  const links = [];

  addSourceLink(
    links,
    "EQL Wiki",
    getField(record, "eqlWikiSource")
  );

  addSourceLink(
    links,
    "Official EQL",
    getField(record, "eqlOfficialSource")
  );

  addSourceLink(
    links,
    "Classic/P99",
    getField(record, "classicSource")
  );

  addSourceLink(
    links,
    "Primary source",
    getField(record, "sourcePrimary")
  );

  addSourceLink(
    links,
    "Secondary source",
    getField(record, "sourceSecondary")
  );

  return deduplicateSourceLinks(links);
}

function addSourceLink(links, label, url) {
  if (!isSafeHttpUrl(url)) {
    return;
  }

  links.push({
    label,
    url
  });
}

function deduplicateSourceLinks(links) {
  const seen = new Set();

  return links.filter(link => {
    if (seen.has(link.url)) {
      return false;
    }

    seen.add(link.url);
    return true;
  });
}

export function getBooleanValue(record, logicalFieldName) {
  const value = normalizeLower(
    getField(record, logicalFieldName)
  );

  if (
    value === "yes" ||
    value === "true" ||
    value === "1" ||
    value === "y" ||
    value === "confirmed"
  ) {
    return true;
  }

  if (
    value === "no" ||
    value === "false" ||
    value === "0" ||
    value === "n" ||
    value === "not confirmed"
  ) {
    return false;
  }

  return null;
}

export function isApproved(record) {
  const value = normalizeLower(
    getField(record, "approved")
  );

  return (
    value === "yes" ||
    value === "true" ||
    value === "1" ||
    value === "approved"
  );
}

export function isQuarantined(record) {
  const status = normalizeLower(
    getField(record, "verificationStatus")
  );

  const auditAction = normalizeLower(
    getField(record, "auditAction")
  );

  return (
    status.includes("quarantine") ||
    auditAction.includes("quarantine")
  );
}

export function isEqlConfirmed(record) {
  if (isQuarantined(record)) {
    return false;
  }

  const status = normalizeLower(
    getField(record, "verificationStatus")
  );

  return (
    status === "eql confirmed" ||
    status === "eql confirmed — modified" ||
    status === "eql confirmed - modified"
  );
}

export function getVerificationBadgeClass(statusValue) {
  const status = normalizeLower(statusValue)
    .replaceAll("–", "-")
    .replaceAll("—", "-");

  if (status === "eql confirmed") {
    return "badge-confirmed";
  }

  if (status.includes("eql confirmed") && status.includes("modified")) {
    return "badge-modified";
  }

  if (
    status.includes("item confirmed") &&
    status.includes("source unverified")
  ) {
    return "badge-item-confirmed";
  }

  if (
    status.includes("npc confirmed") &&
    status.includes("drop unverified")
  ) {
    return "badge-npc-confirmed";
  }

  if (
    status.includes("wiki listed") &&
    status.includes("unclear")
  ) {
    return "badge-wiki-unclear";
  }

  if (status.includes("classic baseline only")) {
    return "badge-classic";
  }

  if (status.includes("out of current eql era")) {
    return "badge-era";
  }

  if (status.includes("removed or replaced")) {
    return "badge-removed";
  }

  if (status.includes("conflicting")) {
    return "badge-conflicting";
  }

  if (status.includes("quarantine")) {
    return "badge-quarantine";
  }

  if (status.includes("needs in-game verification")) {
    return "badge-needs-verification";
  }

  return "badge-neutral";
}

export function parseLevelRange(value) {
  const text = normalizeText(value);

  if (!text) {
    return {
      minimum: null,
      maximum: null
    };
  }

  const numbers = text
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite) ?? [];

  if (numbers.length === 0) {
    return {
      minimum: null,
      maximum: null
    };
  }

  if (numbers.length === 1) {
    return {
      minimum: numbers[0],
      maximum: numbers[0]
    };
  }

  return {
    minimum: Math.min(...numbers),
    maximum: Math.max(...numbers)
  };
}

export function parseRevision(value) {
  const revision = Number.parseInt(value, 10);

  return Number.isFinite(revision)
    ? revision
    : 0;
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

export function naturalCompare(left, right) {
  return String(left ?? "").localeCompare(
    String(right ?? ""),
    undefined,
    {
      numeric: true,
      sensitivity: "base"
    }
  );
}

export function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    normalizeText(value) !== ""
  );
}

export function isSafeHttpUrl(value) {
  if (!hasValue(value)) {
    return false;
  }

  try {
    const url = new URL(normalizeText(value));

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}
