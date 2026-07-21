"use strict";

export const REQUIRED_COLUMNS = [
  "record_id",
  "batch",
  "continent",
  "zone",
  "item_name",
  "item_category",
  "slot",
  "source_npc",
  "approved",
  "revision",
  "eql_verification_status"
];

export function buildDatabase(fileResults) {
  const diagnostics = {
    filesDiscovered: fileResults.length,
    filesLoaded: 0,
    filesFailed: 0,
    rawRecords: 0,
    uniqueRecords: 0,
    duplicateRecords: [],
    missingRequiredColumns: [],
    malformedRecords: [],
    fileErrors: []
  };

  const recordsById = new Map();

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
    diagnostics.rawRecords += fileResult.records.length;

    const missingColumns = REQUIRED_COLUMNS.filter(
      column => !fileResult.headers.includes(column)
    );

    if (missingColumns.length > 0) {
      diagnostics.missingRequiredColumns.push({
        file: fileResult.file.filename,
        columns: missingColumns
      });
    }

    for (const record of fileResult.records) {
      const recordId = normalizeText(record.record_id);

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

      const existingRevision = parseRevision(
        existingRecord.revision
      );

      const incomingRevision = parseRevision(record.revision);

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

  records.sort((left, right) => {
    const zoneComparison = naturalCompare(
      left.zone,
      right.zone
    );

    if (zoneComparison !== 0) {
      return zoneComparison;
    }

    return naturalCompare(
      left.item_name,
      right.item_name
    );
  });

  diagnostics.uniqueRecords = records.length;

  return {
    records,
    diagnostics
  };
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

export function parseRevision(value) {
  const revision = Number.parseInt(value, 10);

  return Number.isFinite(revision) ? revision : 0;
}

export function isApproved(record) {
  const value = normalizeLower(record.approved);

  return (
    value === "yes" ||
    value === "true" ||
    value === "1" ||
    value === "approved"
  );
}

export function getPreferredStats(record) {
  return (
    normalizeText(record.stats_eql) ||
    normalizeText(record.stats_classic) ||
    normalizeText(record.stats_raw)
  );
}

export function getPreferredClasses(record) {
  return (
    normalizeText(record.classes_eql) ||
    normalizeText(record.classes_classic)
  );
}

export function getPreferredRaces(record) {
  return (
    normalizeText(record.races_eql) ||
    normalizeText(record.races_classic)
  );
}

export function getPreferredNpcLevel(record) {
  return (
    normalizeText(record.source_npc_level_eql) ||
    normalizeText(record.source_npc_level_classic) ||
    normalizeText(record.source_npc_level)
  );
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
