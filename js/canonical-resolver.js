"use strict";

/*
 * EverQuest Legends Loot Explorer
 * Canonical record resolution
 *
 * Responsibilities:
 * - Resolve duplicate record_id rows deterministically.
 * - Separate loot, corrections, research, and metadata.
 * - Apply correction rows to source_record_id targets.
 * - Overlay only physically supplied, nonblank correction fields.
 * - Preserve stable canonical identity and correction provenance.
 * - Produce default-visible loot without exposing correction duplicates.
 */

const METADATA_TYPES = new Set([
  "metadata",
  "zone_metadata",
  "encounter_metadata"
]);

const PROTECTED_CORRECTION_FIELDS = new Set([
  "schema_version",
  "record_type",
  "record_status",
  "record_id",
  "source_record_id",
  "canonical_record_id",
  "parent_record_id",
  "related_record_ids",
  "core_or_supplemental",
  "eql_audit_action",
  "display_default",
  "searchable",
  "record_notes"
]);

export function resolveCanonicalRecords(
  normalizedRecords
) {
  if (!Array.isArray(normalizedRecords)) {
    throw new Error(
      "Canonical resolution requires an array of normalized records."
    );
  }

  const independentRows = [];
  const correctionRows = [];
  const researchRows = [];
  const metadataRows = [];

  for (const record of normalizedRecords) {
    const type =
      normalizeLower(
        record.record_type
      );

    const auditAction =
      normalizeLower(
        record.eql_audit_action
      );

    if (
      type === "correction" ||
      auditAction === "correct"
    ) {
      correctionRows.push(record);
      continue;
    }

    if (
      type === "research" ||
      type === "quarantined" ||
      auditAction === "quarantine" ||
      normalizeLower(
        record.record_status
      ) === "quarantined"
    ) {
      researchRows.push(record);
      continue;
    }

    if (
      METADATA_TYPES.has(type)
    ) {
      metadataRows.push(record);
      continue;
    }

    independentRows.push(record);
  }

  const duplicateRecords = [];

  const independentById =
    selectRowsByRecordId(
      independentRows,
      duplicateRecords,
      "independent"
    );

  const researchById =
    selectRowsByRecordId(
      researchRows,
      duplicateRecords,
      "research"
    );

  const metadataById =
    selectRowsByRecordId(
      metadataRows,
      duplicateRecords,
      "metadata"
    );

  const correctionById =
    selectRowsByRecordId(
      correctionRows,
      duplicateRecords,
      "correction"
    );

  const canonicalById =
    new Map();

  for (
    const [recordId, record]
    of independentById
  ) {
    canonicalById.set(
      recordId,
      cloneCanonicalRecord(record)
    );
  }

  const resolvedCorrections = [];
  const unresolvedCorrections = [];

  const sortedCorrections =
    [...correctionById.values()]
      .sort(compareCorrectionOrder);

  for (const correction of sortedCorrections) {
    const targetId =
      normalizeText(
        correction.source_record_id
      );

    const correctionId =
      normalizeText(
        correction.record_id
      );

    if (
      !targetId ||
      !canonicalById.has(targetId)
    ) {
      unresolvedCorrections.push({
        correctionId,
        targetId,

        sourceFile:
          correction.__sourceFile ?? "",

        sourceRow:
          correction.__sourceRow ?? null
      });

      continue;
    }

    const target =
      canonicalById.get(targetId);

    const overlayResult =
      applyCorrectionOverlay(
        target,
        correction
      );

    canonicalById.set(
      targetId,
      overlayResult.record
    );

    resolvedCorrections.push({
      correctionId,
      targetId,

      fieldsApplied:
        overlayResult.fieldsApplied,

      sourceFile:
        correction.__sourceFile ?? "",

      sourceRow:
        correction.__sourceRow ?? null
    });
  }

  const canonicalRecords =
    [...canonicalById.values()]
      .sort(compareCanonicalRecords);

  const defaultRecords =
    canonicalRecords.filter(
      isDefaultVisibleLoot
    );

  const hiddenLootRecords =
    canonicalRecords.filter(
      record =>
        !isDefaultVisibleLoot(record)
    );

  const researchRecords =
    [...researchById.values()]
      .sort(compareCanonicalRecords);

  const metadataRecords =
    [...metadataById.values()]
      .sort(compareCanonicalRecords);

  const correctionRecords =
    [...correctionById.values()]
      .sort(compareCorrectionOrder);

  return {
    canonicalRecords,
    defaultRecords,
    hiddenLootRecords,
    researchRecords,
    metadataRecords,
    correctionRecords,

    diagnostics: {
      duplicateRecords,

      independentRowCount:
        independentRows.length,

      correctionRowCount:
        correctionRows.length,

      researchRowCount:
        researchRows.length,

      metadataRowCount:
        metadataRows.length,

      canonicalRecordCount:
        canonicalRecords.length,

      defaultVisibleRecordCount:
        defaultRecords.length,

      hiddenLootRecordCount:
        hiddenLootRecords.length,

      resolvedCorrectionCount:
        resolvedCorrections.length,

      unresolvedCorrectionCount:
        unresolvedCorrections.length,

      resolvedCorrections,
      unresolvedCorrections
    }
  };
}

function selectRowsByRecordId(
  records,
  duplicateRecords,
  category
) {
  const selected =
    new Map();

  for (const record of records) {
    const recordId =
      normalizeText(
        record.record_id
      );

    if (!recordId) {
      continue;
    }

    const existing =
      selected.get(recordId);

    if (!existing) {
      selected.set(
        recordId,
        record
      );

      continue;
    }

    const comparison =
      compareDuplicatePriority(
        record,
        existing
      );

    if (comparison > 0) {
      selected.set(
        recordId,
        record
      );

      duplicateRecords.push({
        recordId,
        category,

        action:
          "Incoming row replaced earlier row",

        keptFile:
          record.__sourceFile ?? "",

        keptRow:
          record.__sourceRow ?? null,

        discardedFile:
          existing.__sourceFile ?? "",

        discardedRow:
          existing.__sourceRow ?? null
      });
    } else {
      duplicateRecords.push({
        recordId,
        category,

        action:
          "Earlier row retained",

        keptFile:
          existing.__sourceFile ?? "",

        keptRow:
          existing.__sourceRow ?? null,

        discardedFile:
          record.__sourceFile ?? "",

        discardedRow:
          record.__sourceRow ?? null
      });
    }
  }

  return selected;
}

function compareDuplicatePriority(
  left,
  right
) {
  const revisionComparison =
    numericRevision(left) -
    numericRevision(right);

  if (revisionComparison !== 0) {
    return revisionComparison;
  }

  const batchComparison =
    numericBatch(left) -
    numericBatch(right);

  if (batchComparison !== 0) {
    return batchComparison;
  }

  const pathComparison =
    naturalCompare(
      left.__sourcePath ??
        left.__sourceFile ??
        "",

      right.__sourcePath ??
        right.__sourceFile ??
        ""
    );

  if (pathComparison !== 0) {
    return pathComparison;
  }

  return (
    numericValue(
      left.__sourceRow
    ) -
    numericValue(
      right.__sourceRow
    )
  );
}

function compareCorrectionOrder(
  left,
  right
) {
  const targetComparison =
    naturalCompare(
      left.source_record_id,
      right.source_record_id
    );

  if (targetComparison !== 0) {
    return targetComparison;
  }

  const batchComparison =
    numericBatch(left) -
    numericBatch(right);

  if (batchComparison !== 0) {
    return batchComparison;
  }

  const revisionComparison =
    numericRevision(left) -
    numericRevision(right);

  if (revisionComparison !== 0) {
    return revisionComparison;
  }

  const pathComparison =
    naturalCompare(
      left.__sourcePath ??
        left.__sourceFile ??
        "",

      right.__sourcePath ??
        right.__sourceFile ??
        ""
    );

  if (pathComparison !== 0) {
    return pathComparison;
  }

  const rowComparison =
    numericValue(
      left.__sourceRow
    ) -
    numericValue(
      right.__sourceRow
    );

  if (rowComparison !== 0) {
    return rowComparison;
  }

  return naturalCompare(
    left.record_id,
    right.record_id
  );
}

function applyCorrectionOverlay(
  target,
  correction
) {
  const merged =
    cloneCanonicalRecord(target);

  const fieldsApplied = [];

  const physicalFields =
    Array.isArray(
      correction.__physicalFields
    )
      ? correction.__physicalFields
      : [];

  for (const fieldName of physicalFields) {
    if (
      !fieldName ||
      fieldName.startsWith("__") ||
      PROTECTED_CORRECTION_FIELDS.has(
        fieldName
      )
    ) {
      continue;
    }

    const correctionValue =
      correction[fieldName];

    if (!hasText(correctionValue)) {
      continue;
    }

    merged[fieldName] =
      cloneValue(
        correctionValue
      );

    fieldsApplied.push(
      fieldName
    );
  }

  merged.record_id =
    normalizeText(
      target.record_id
    );

  merged.canonical_record_id =
    normalizeText(
      target.record_id
    );

  merged.record_type =
    normalizeText(
      target.record_type
    ) || "loot";

  merged.__appliedCorrections = [
    ...(
      Array.isArray(
        target.__appliedCorrections
      )
        ? target.__appliedCorrections
        : []
    ),
    {
      correctionRecordId:
        normalizeText(
          correction.record_id
        ),

      targetRecordId:
        normalizeText(
          target.record_id
        ),

      sourceFile:
        correction.__sourceFile ?? "",

      sourcePath:
        correction.__sourcePath ?? "",

      sourceRow:
        correction.__sourceRow ?? null,

      batch:
        normalizeText(
          correction.batch ||
          correction.batch_id ||
          correction.batch_number
        ),

      revision:
        normalizeText(
          correction.revision ||
          correction.record_revision
        ),

      fieldsApplied:
        [...fieldsApplied]
    }
  ];

  merged.__extensions = {
    ...(
      target.__extensions ?? {}
    )
  };

  for (
    const [fieldName, value]
    of Object.entries(
      correction.__extensions ?? {}
    )
  ) {
    if (
      hasText(value) &&
      fieldsApplied.includes(
        fieldName
      )
    ) {
      merged.__extensions[fieldName] =
        cloneValue(value);
    }
  }

  return {
    record: merged,
    fieldsApplied
  };
}

function cloneCanonicalRecord(
  record
) {
  const clone = {};

  for (
    const [key, value]
    of Object.entries(record)
  ) {
    clone[key] =
      cloneValue(value);
  }

  clone.__appliedCorrections =
    Array.isArray(
      record.__appliedCorrections
    )
      ? record.__appliedCorrections.map(
          correction =>
            cloneValue(correction)
        )
      : [];

  clone.canonical_record_id =
    normalizeText(
      record.record_id
    );

  return clone;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(
      cloneValue
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const clone = {};

    for (
      const [key, nestedValue]
      of Object.entries(value)
    ) {
      clone[key] =
        cloneValue(nestedValue);
    }

    return clone;
  }

  return value;
}

function isDefaultVisibleLoot(
  record
) {
  const recordType =
    normalizeLower(
      record.record_type
    );

  if (
    recordType &&
    recordType !== "loot"
  ) {
    return false;
  }

  if (
    normalizeLower(
      record.display_default
    ) === "no"
  ) {
    return false;
  }

  if (
    normalizeLower(
      record.searchable
    ) === "no"
  ) {
    return false;
  }

  return hasText(
    record.item_name
  );
}

function compareCanonicalRecords(
  left,
  right
) {
  const zoneComparison =
    naturalCompare(
      left.zone,
      right.zone
    );

  if (zoneComparison !== 0) {
    return zoneComparison;
  }

  const itemComparison =
    naturalCompare(
      left.item_name,
      right.item_name
    );

  if (itemComparison !== 0) {
    return itemComparison;
  }

  return naturalCompare(
    left.record_id,
    right.record_id
  );
}

function numericBatch(record) {
  return numericValue(
    record.batch ||
    record.batch_id ||
    record.batch_number
  );
}

function numericRevision(record) {
  return numericValue(
    record.revision ||
    record.record_revision
  );
}

function numericValue(value) {
  const number =
    Number.parseInt(
      String(value ?? "")
        .match(/-?\d+/)?.[0] ??
        "",
      10
    );

  return Number.isFinite(number)
    ? number
    : 0;
}

function hasText(value) {
  return (
    value !== null &&
    value !== undefined &&
    normalizeText(value) !== ""
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .trim();
}

function normalizeLower(value) {
  return normalizeText(value)
    .toLowerCase();
}

function naturalCompare(
  left,
  right
) {
  return String(left ?? "")
    .localeCompare(
      String(right ?? ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base"
      }
    );
}
