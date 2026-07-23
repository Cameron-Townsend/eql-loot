"use strict";

/*
 * EverQuest Legends Loot Explorer
 * Registry-driven canonical row normalizer
 *
 * Responsibilities:
 * - Create every registered schema field on every imported row
 * - Preserve physical CSV values
 * - Preserve unknown future columns
 * - Trim ordinary string values
 * - Apply documented legacy defaults
 * - Preserve source-file and row provenance
 *
 * This module intentionally does not:
 * - Validate enums, dates, JSON, or numbers
 * - Merge correction records
 * - Hide research or metadata records
 * - Build search indexes
 *
 * Those responsibilities belong to later stages.
 */

const INTERNAL_FIELD_PREFIX = "__";

const LEGACY_METADATA_CATEGORIES = new Set([
  "family metadata",
  "creature family metadata",
  "creature metadata",
  "zone metadata",
  "encounter metadata",
  "taxonomy metadata"
]);

const METADATA_RECORD_TYPES = new Set([
  "metadata",
  "zone_metadata",
  "encounter_metadata"
]);

/*
 * Fields whose management values should not be inferred from
 * core_or_supplemental alone.
 */
const MANAGEMENT_FIELDS = [
  "schema_version",
  "record_type",
  "record_status",
  "source_record_id",
  "canonical_record_id",
  "parent_record_id",
  "related_record_ids",
  "display_default",
  "searchable",
  "record_notes"
];

/**
 * Normalize one parsed CSV row against the loaded schema registry.
 */
export function normalizeRecord(
  rawRecord,
  registry
) {
  validateNormalizerInputs(
    rawRecord,
    registry
  );

  const canonicalRecord = {};
  const extensions = {};

  /*
   * First create every registered field.
   *
   * A field physically absent from the CSV receives the registry default.
   * Most registry defaults are blank strings.
   */
  for (const fieldDefinition of registry.fields) {
    canonicalRecord[fieldDefinition.field] =
      normalizeFieldValue(
        rawRecord[fieldDefinition.field],
        fieldDefinition.defaultValue
      );
  }

  /*
   * Preserve every physically supplied property.
   *
   * Registered fields replace the blank/default canonical value.
   * Unknown fields remain directly available for compatibility and are
   * also recorded in __extensions.
   *
   * Internal loader properties remain internal and are not treated as
   * unknown schema extensions.
   */
  for (
    const [rawKey, rawValue]
    of Object.entries(rawRecord)
  ) {
    const key =
      normalizeHeaderName(rawKey);

    if (!key) {
      continue;
    }

    if (
      key.startsWith(
        INTERNAL_FIELD_PREFIX
      )
    ) {
      canonicalRecord[key] =
        cloneInternalValue(rawValue);

      continue;
    }

    const normalizedValue =
      normalizeImportedValue(rawValue);

    canonicalRecord[key] =
      normalizedValue;

    if (
      !registry.registeredFieldNames.has(key)
    ) {
      extensions[key] =
        normalizedValue;
    }
  }

  canonicalRecord.__extensions =
    extensions;

  canonicalRecord.__physicalFields =
    getPhysicalFieldNames(rawRecord);

  canonicalRecord.__normalizedSchemaVersion =
    registry.schemaVersion;

  canonicalRecord.__evidence =
    Array.isArray(rawRecord.__evidence)
      ? [...rawRecord.__evidence]
      : [];

  canonicalRecord.__changeHistory =
    Array.isArray(rawRecord.__changeHistory)
      ? [...rawRecord.__changeHistory]
      : [];

  canonicalRecord.__appliedCorrections =
    Array.isArray(
      rawRecord.__appliedCorrections
    )
      ? [...rawRecord.__appliedCorrections]
      : [];

  canonicalRecord.__validationWarnings =
    Array.isArray(
      rawRecord.__validationWarnings
    )
      ? [...rawRecord.__validationWarnings]
      : [];

  applyLegacyRecordDefaults(
    canonicalRecord
  );

  return canonicalRecord;
}

/**
 * Normalize every row from one parsed file result.
 */
export function normalizeFileRecords(
  fileResult,
  registry
) {
  if (
    !fileResult ||
    !Array.isArray(fileResult.records)
  ) {
    return [];
  }

  return fileResult.records.map(
    rawRecord =>
      normalizeRecord(
        rawRecord,
        registry
      )
  );
}

/**
 * Return a concise summary useful for diagnostics and browser testing.
 */
export function getNormalizationSummary(
  records
) {
  const summary = {
    totalRecords: 0,
    lootRecords: 0,
    correctionRecords: 0,
    researchRecords: 0,
    metadataRecords: 0,
    unknownTypeRecords: 0,
    recordsWithExtensions: 0,
    extensionFieldCount: 0
  };

  if (!Array.isArray(records)) {
    return summary;
  }

  const extensionNames =
    new Set();

  for (const record of records) {
    summary.totalRecords += 1;

    const recordType =
      normalizeLower(
        record.record_type
      );

    if (recordType === "loot") {
      summary.lootRecords += 1;
    } else if (
      recordType === "correction"
    ) {
      summary.correctionRecords += 1;
    } else if (
      recordType === "research"
    ) {
      summary.researchRecords += 1;
    } else if (
      METADATA_RECORD_TYPES.has(
        recordType
      )
    ) {
      summary.metadataRecords += 1;
    } else {
      summary.unknownTypeRecords += 1;
    }

    const extensionEntries =
      Object.entries(
        record.__extensions ?? {}
      );

    if (extensionEntries.length > 0) {
      summary.recordsWithExtensions += 1;

      for (
        const [extensionName]
        of extensionEntries
      ) {
        extensionNames.add(
          extensionName
        );
      }
    }
  }

  summary.extensionFieldCount =
    extensionNames.size;

  return summary;
}

/**
 * Apply only documented legacy inference.
 *
 * core_or_supplemental does not determine record type.
 */
function applyLegacyRecordDefaults(
  record
) {
  const auditAction =
    normalizeLower(
      record.eql_audit_action
    );

  const existingRecordType =
    normalizeLower(
      record.record_type
    );

  const itemCategory =
    normalizeLower(
      record.item_category
    );

  /*
   * Record type priority:
   *
   * 1. Explicit record_type
   * 2. Correct audit action
   * 3. Quarantine audit action/status
   * 4. Explicit legacy metadata category
   * 5. Ordinary loot
   */
  if (!existingRecordType) {
    if (auditAction === "correct") {
      record.record_type =
        "correction";
    } else if (
      auditAction === "quarantine" ||
      normalizeLower(
        record.record_status
      ) === "quarantined" ||
      normalizeLower(
        record.eql_verification_status
      ).includes("quarantine")
    ) {
      record.record_type =
        "research";
    } else if (
      isLegacyMetadataCategory(
        itemCategory
      )
    ) {
      record.record_type =
        inferMetadataRecordType(
          itemCategory
        );
    } else {
      record.record_type =
        "loot";
    }
  }

  const recordType =
    normalizeLower(
      record.record_type
    );

  /*
   * Stable identity defaults.
   *
   * For independent loot/research/metadata rows, canonical identity is
   * their own record_id.
   *
   * For correction rows, the intended canonical target is
   * source_record_id when supplied. The later merge engine will preserve
   * the target's actual record_id.
   */
  if (
    !hasText(
      record.canonical_record_id
    )
  ) {
    if (
      recordType === "correction" &&
      hasText(
        record.source_record_id
      )
    ) {
      record.canonical_record_id =
        normalizeText(
          record.source_record_id
        );
    } else {
      record.canonical_record_id =
        normalizeText(
          record.record_id
        );
    }
  }

  if (recordType === "correction") {
    setDefaultIfBlank(
      record,
      "display_default",
      "No"
    );

    setDefaultIfBlank(
      record,
      "searchable",
      "No"
    );

    return;
  }

  if (recordType === "research") {
    setDefaultIfBlank(
      record,
      "record_status",
      "Quarantined"
    );

    setDefaultIfBlank(
      record,
      "display_default",
      "No"
    );

    setDefaultIfBlank(
      record,
      "searchable",
      "Yes"
    );

    return;
  }

  if (
    METADATA_RECORD_TYPES.has(
      recordType
    )
  ) {
    setDefaultIfBlank(
      record,
      "record_status",
      "Metadata"
    );

    setDefaultIfBlank(
      record,
      "display_default",
      "No"
    );

    /*
     * Metadata is preserved internally but does not enter ordinary
     * searchable loot results.
     */
    setDefaultIfBlank(
      record,
      "searchable",
      "No"
    );

    return;
  }

  /*
   * Ordinary active loot, including supplemental Add records.
   */
  setDefaultIfBlank(
    record,
    "record_type",
    "loot"
  );

  setDefaultIfBlank(
    record,
    "record_status",
    "Active"
  );

  setDefaultIfBlank(
    record,
    "display_default",
    "Yes"
  );

  setDefaultIfBlank(
    record,
    "searchable",
    "Yes"
  );
}

function inferMetadataRecordType(
  itemCategory
) {
  if (
    itemCategory ===
    "zone metadata"
  ) {
    return "zone_metadata";
  }

  if (
    itemCategory ===
    "encounter metadata"
  ) {
    return "encounter_metadata";
  }

  return "metadata";
}

function isLegacyMetadataCategory(
  itemCategory
) {
  if (
    LEGACY_METADATA_CATEGORIES.has(
      itemCategory
    )
  ) {
    return true;
  }

  return (
    itemCategory.endsWith(
      " metadata"
    )
  );
}

function normalizeFieldValue(
  physicalValue,
  defaultValue
) {
  if (
    physicalValue === null ||
    physicalValue === undefined
  ) {
    return normalizeImportedValue(
      defaultValue
    );
  }

  return normalizeImportedValue(
    physicalValue
  );
}

function normalizeImportedValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(item =>
      normalizeImportedValue(item)
    );
  }

  if (
    typeof value === "object"
  ) {
    return cloneInternalValue(value);
  }

  return String(value).trim();
}

function cloneInternalValue(value) {
  if (Array.isArray(value)) {
    return value.map(
      cloneInternalValue
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return {
      ...value
    };
  }

  return value;
}

function getPhysicalFieldNames(
  rawRecord
) {
  return Object.keys(rawRecord)
    .map(normalizeHeaderName)
    .filter(Boolean)
    .filter(
      fieldName =>
        !fieldName.startsWith(
          INTERNAL_FIELD_PREFIX
        )
    );
}

function normalizeHeaderName(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function setDefaultIfBlank(
  record,
  fieldName,
  defaultValue
) {
  if (
    hasText(record[fieldName])
  ) {
    return;
  }

  record[fieldName] =
    defaultValue;
}

function hasText(value) {
  return (
    value !== null &&
    value !== undefined &&
    normalizeText(value) !== ""
  );
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value)
    .toLowerCase();
}

function validateNormalizerInputs(
  rawRecord,
  registry
) {
  if (
    !rawRecord ||
    typeof rawRecord !== "object" ||
    Array.isArray(rawRecord)
  ) {
    throw new Error(
      "Schema normalization requires a row object."
    );
  }

  if (
    !registry ||
    !Array.isArray(registry.fields) ||
    !(
      registry.registeredFieldNames
      instanceof Set
    )
  ) {
    throw new Error(
      "Schema normalization requires a prepared schema registry."
    );
  }

  for (
    const requiredManagementField
    of MANAGEMENT_FIELDS
  ) {
    if (
      !registry.registeredFieldNames.has(
        requiredManagementField
      )
    ) {
      throw new Error(
        "The schema registry is missing required management field: " +
        requiredManagementField
      );
    }
  }
}
