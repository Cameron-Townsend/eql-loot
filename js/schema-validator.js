"use strict";

/*
 * EverQuest Legends Loot Explorer
 * Registry-driven validation utilities
 *
 * This module reports data problems without changing canonical values.
 *
 * Validation warnings do not normally block the entire app. A registry
 * loading failure remains fatal, while individual CSV or row problems are
 * isolated and reported through diagnostics.
 */

const METADATA_RECORD_TYPES = new Set([
  "metadata",
  "zone_metadata",
  "encounter_metadata"
]);

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const PROTECTED_CORRECTION_FIELDS =
  new Set([
    "record_id",
    "canonical_record_id",
    "record_type"
  ]);

/**
 * Validate all loaded file results after parsing and normalization.
 *
 * This function expects fileResult.records to contain normalized records.
 */
export function validateFileResults(
  fileResults,
  registry
) {
  validateInputs(
    fileResults,
    registry
  );

  const warnings = [];
  const warningsByType =
    new Map();

  for (const fileResult of fileResults) {
    const fileName =
      getFileName(fileResult);

    if (!fileResult.loaded) {
      addWarning(
        warnings,
        warningsByType,
        {
          severity: "error",
          type: "file-load-failed",
          file: fileName,
          row: null,
          recordId: "",
          field: "",
          message:
            `${fileName}: ${fileResult.error || "File could not be loaded."}`
        }
      );

      continue;
    }

    collectParserWarnings(
      fileResult,
      warnings,
      warningsByType
    );

    validateDuplicateIdsWithinFile(
      fileResult,
      warnings,
      warningsByType
    );

    for (const record of fileResult.records) {
      validateRecord(
        record,
        registry,
        warnings,
        warningsByType
      );
    }
  }

  validateCorrectionTargets(
    fileResults,
    warnings,
    warningsByType
  );

  return {
    warnings,

    warningCount:
      warnings.length,

    errorCount:
      warnings.filter(
        warning =>
          warning.severity === "error"
      ).length,

    noticeCount:
      warnings.filter(
        warning =>
          warning.severity === "notice"
      ).length,

    warningsByType:
      Object.fromEntries(
        [...warningsByType.entries()]
          .sort((left, right) =>
            naturalCompare(
              left[0],
              right[0]
            )
          )
      )
  };
}

/**
 * Validate one normalized record.
 */
export function validateRecord(
  record,
  registry,
  warnings = [],
  warningsByType = new Map()
) {
  const file =
    normalizeText(
      record.__sourceFile
    ) || "Unknown CSV";

  const row =
    normalizeRowNumber(
      record.__sourceRow
    );

  const recordId =
    normalizeText(
      record.record_id
    );

  const recordType =
    normalizeLower(
      record.record_type
    );

  const auditAction =
    normalizeLower(
      record.eql_audit_action
    );

  if (!recordId) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "missing-record-id",
        file,
        row,
        recordId: "",
        field: "record_id",
        message:
          `${formatLocation(file, row)}: record_id is blank.`
      }
    );
  }

  if (
    recordType === "loot" &&
    !hasText(record.item_name)
  ) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "loot-without-item-name",
        file,
        row,
        recordId,
        field: "item_name",
        message:
          `${formatRecordLocation(file, row, recordId)}: ` +
          "loot record has no item_name."
      }
    );
  }

  if (
    recordType === "correction" ||
    auditAction === "correct"
  ) {
    validateCorrectionRecord(
      record,
      warnings,
      warningsByType
    );
  }

  if (
    METADATA_RECORD_TYPES.has(
      recordType
    ) &&
    normalizeLower(
      record.display_default
    ) === "yes"
  ) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "metadata-visible-by-default",
        file,
        row,
        recordId,
        field: "display_default",
        message:
          `${formatRecordLocation(file, row, recordId)}: ` +
          `${recordType} record is marked display_default=Yes.`
      }
    );
  }

  if (
    (
      recordType === "research" ||
      normalizeLower(
        record.record_status
      ) === "quarantined" ||
      auditAction === "quarantine"
    ) &&
    normalizeLower(
      record.display_default
    ) === "yes"
  ) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "quarantine-visible-by-default",
        file,
        row,
        recordId,
        field: "display_default",
        message:
          `${formatRecordLocation(file, row, recordId)}: ` +
          "quarantined/research record is marked display_default=Yes."
      }
    );
  }

  validateRegisteredFields(
    record,
    registry,
    warnings,
    warningsByType
  );

  validateExtensions(
    record,
    warnings,
    warningsByType
  );

  record.__validationWarnings =
    warnings.filter(
      warning =>
        warning.file === file &&
        warning.row === row &&
        (
          !recordId ||
          !warning.recordId ||
          warning.recordId === recordId
        )
    );

  return warnings;
}

function validateCorrectionRecord(
  record,
  warnings,
  warningsByType
) {
  const file =
    normalizeText(
      record.__sourceFile
    ) || "Unknown CSV";

  const row =
    normalizeRowNumber(
      record.__sourceRow
    );

  const recordId =
    normalizeText(
      record.record_id
    );

  const sourceRecordId =
    normalizeText(
      record.source_record_id
    );

  if (!sourceRecordId) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "correction-without-target",
        file,
        row,
        recordId,
        field: "source_record_id",
        message:
          `${formatRecordLocation(file, row, recordId)}: ` +
          "correction has no source_record_id."
      }
    );
  }

  const canonicalRecordId =
    normalizeText(
      record.canonical_record_id
    );

  if (
    canonicalRecordId &&
    sourceRecordId &&
    canonicalRecordId !== sourceRecordId
  ) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "correction-canonical-id-mismatch",
        file,
        row,
        recordId,
        field: "canonical_record_id",
        message:
          `${formatRecordLocation(file, row, recordId)}: ` +
          `canonical_record_id "${canonicalRecordId}" does not match ` +
          `source_record_id "${sourceRecordId}".`
      }
    );
  }

  for (
    const protectedField
    of PROTECTED_CORRECTION_FIELDS
  ) {
    if (
      protectedField === "record_id"
    ) {
      continue;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        record.__physicalFields ?? [],
        protectedField
      )
    ) {
      continue;
    }
  }
}

function validateRegisteredFields(
  record,
  registry,
  warnings,
  warningsByType
) {
  for (
    const fieldDefinition
    of registry.fields
  ) {
    const fieldName =
      fieldDefinition.field;

    const value =
      record[fieldName];

    if (!hasText(value)) {
      continue;
    }

    if (
      fieldDefinition.type === "enum"
    ) {
      validateEnumField(
        record,
        fieldDefinition,
        warnings,
        warningsByType
      );

      continue;
    }

    if (
      fieldDefinition.type === "number"
    ) {
      validateNumberField(
        record,
        fieldDefinition,
        warnings,
        warningsByType
      );

      continue;
    }

    if (
      fieldDefinition.type === "date"
    ) {
      validateDateField(
        record,
        fieldDefinition,
        warnings,
        warningsByType
      );

      continue;
    }

    if (
      fieldDefinition.type === "json"
    ) {
      validateJsonField(
        record,
        fieldDefinition,
        warnings,
        warningsByType
      );
    }
  }
}

function validateEnumField(
  record,
  fieldDefinition,
  warnings,
  warningsByType
) {
  if (
    !Array.isArray(
      fieldDefinition.allowedValues
    ) ||
    fieldDefinition.allowedValues.length === 0
  ) {
    return;
  }

  const value =
    normalizeText(
      record[fieldDefinition.field]
    );

  const validValue =
    fieldDefinition.allowedValues.some(
      allowedValue =>
        normalizeLower(allowedValue) ===
        normalizeLower(value)
    );

  if (validValue) {
    return;
  }

  addFieldWarning(
    record,
    warnings,
    warningsByType,
    {
      severity: "warning",
      type: "invalid-enum",
      field: fieldDefinition.field,
      message:
        `${fieldDefinition.field} contains unregistered value ` +
        `"${value}". Allowed values: ` +
        fieldDefinition.allowedValues.join(", ")
    }
  );
}

function validateNumberField(
  record,
  fieldDefinition,
  warnings,
  warningsByType
) {
  const value =
    normalizeText(
      record[fieldDefinition.field]
    );

  if (isFiniteNumberString(value)) {
    return;
  }

  addFieldWarning(
    record,
    warnings,
    warningsByType,
    {
      severity: "warning",
      type: "invalid-number",
      field: fieldDefinition.field,
      message:
        `${fieldDefinition.field} contains nonnumeric value "${value}".`
    }
  );
}

function validateDateField(
  record,
  fieldDefinition,
  warnings,
  warningsByType
) {
  const value =
    normalizeText(
      record[fieldDefinition.field]
    );

  if (isValidIsoDate(value)) {
    return;
  }

  addFieldWarning(
    record,
    warnings,
    warningsByType,
    {
      severity: "warning",
      type: "invalid-date",
      field: fieldDefinition.field,
      message:
        `${fieldDefinition.field} must use ISO YYYY-MM-DD; found "${value}".`
    }
  );
}

function validateJsonField(
  record,
  fieldDefinition,
  warnings,
  warningsByType
) {
  const value =
    normalizeText(
      record[fieldDefinition.field]
    );

  try {
    JSON.parse(value);
  } catch {
    addFieldWarning(
      record,
      warnings,
      warningsByType,
      {
        severity: "warning",
        type: "invalid-json",
        field: fieldDefinition.field,
        message:
          `${fieldDefinition.field} does not contain valid JSON.`
      }
    );
  }
}

function validateExtensions(
  record,
  warnings,
  warningsByType
) {
  const extensions =
    record.__extensions;

  if (
    !extensions ||
    typeof extensions !== "object" ||
    Array.isArray(extensions)
  ) {
    return;
  }

  for (
    const extensionName
    of Object.keys(extensions)
  ) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "notice",
        type: "unregistered-field",
        file:
          normalizeText(
            record.__sourceFile
          ) || "Unknown CSV",

        row:
          normalizeRowNumber(
            record.__sourceRow
          ),

        recordId:
          normalizeText(
            record.record_id
          ),

        field:
          extensionName,

        message:
          `${formatRecordLocation(
            normalizeText(
              record.__sourceFile
            ) || "Unknown CSV",
            normalizeRowNumber(
              record.__sourceRow
            ),
            normalizeText(
              record.record_id
            )
          )}: unregistered field "${extensionName}" was preserved.`
      }
    );
  }
}

function validateDuplicateIdsWithinFile(
  fileResult,
  warnings,
  warningsByType
) {
  const seenIds =
    new Map();

  const fileName =
    getFileName(fileResult);

  for (const record of fileResult.records) {
    const recordId =
      normalizeText(
        record.record_id
      );

    if (!recordId) {
      continue;
    }

    const previousRow =
      seenIds.get(recordId);

    if (previousRow === undefined) {
      seenIds.set(
        recordId,
        normalizeRowNumber(
          record.__sourceRow
        )
      );

      continue;
    }

    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "duplicate-id-within-file",
        file: fileName,
        row:
          normalizeRowNumber(
            record.__sourceRow
          ),

        recordId,
        field: "record_id",

        message:
          `${formatRecordLocation(
            fileName,
            normalizeRowNumber(
              record.__sourceRow
            ),
            recordId
          )}: duplicate record_id also appeared on row ${previousRow}.`
      }
    );
  }
}

function collectParserWarnings(
  fileResult,
  warnings,
  warningsByType
) {
  if (
    !Array.isArray(
      fileResult.warnings
    )
  ) {
    return;
  }

  const fileName =
    getFileName(fileResult);

  for (
    const parserWarning
    of fileResult.warnings
  ) {
    addWarning(
      warnings,
      warningsByType,
      {
        severity: "warning",
        type:
          normalizeText(
            parserWarning.type
          ) || "csv-parser-warning",

        file: fileName,

        row:
          normalizeRowNumber(
            parserWarning.sourceRow
          ),

        recordId: "",
        field: "",

        message:
          normalizeText(
            parserWarning.message
          ) ||
          `${fileName}: CSV parsing warning.`
      }
    );
  }
}

function validateCorrectionTargets(
  fileResults,
  warnings,
  warningsByType
) {
  const independentRecordIds =
    new Set();

  const correctionRecords = [];

  for (const fileResult of fileResults) {
    if (!fileResult.loaded) {
      continue;
    }

    for (const record of fileResult.records) {
      const recordType =
        normalizeLower(
          record.record_type
        );

      const auditAction =
        normalizeLower(
          record.eql_audit_action
        );

      const recordId =
        normalizeText(
          record.record_id
        );

      if (
        recordType === "correction" ||
        auditAction === "correct"
      ) {
        correctionRecords.push(record);
        continue;
      }

      if (recordId) {
        independentRecordIds.add(
          recordId
        );
      }
    }
  }

  for (const correction of correctionRecords) {
    const sourceRecordId =
      normalizeText(
        correction.source_record_id
      );

    if (
      !sourceRecordId ||
      independentRecordIds.has(
        sourceRecordId
      )
    ) {
      continue;
    }

    addWarning(
      warnings,
      warningsByType,
      {
        severity: "error",
        type: "unresolved-correction-target",

        file:
          normalizeText(
            correction.__sourceFile
          ) || "Unknown CSV",

        row:
          normalizeRowNumber(
            correction.__sourceRow
          ),

        recordId:
          normalizeText(
            correction.record_id
          ),

        field:
          "source_record_id",

        message:
          `${formatRecordLocation(
            normalizeText(
              correction.__sourceFile
            ) || "Unknown CSV",
            normalizeRowNumber(
              correction.__sourceRow
            ),
            normalizeText(
              correction.record_id
            )
          )}: correction target "${sourceRecordId}" was not found.`
      }
    );
  }
}

function addFieldWarning(
  record,
  warnings,
  warningsByType,
  warning
) {
  const file =
    normalizeText(
      record.__sourceFile
    ) || "Unknown CSV";

  const row =
    normalizeRowNumber(
      record.__sourceRow
    );

  const recordId =
    normalizeText(
      record.record_id
    );

  addWarning(
    warnings,
    warningsByType,
    {
      ...warning,
      file,
      row,
      recordId,

      message:
        `${formatRecordLocation(
          file,
          row,
          recordId
        )}: ${warning.message}`
    }
  );
}

function addWarning(
  warnings,
  warningsByType,
  warning
) {
  warnings.push(warning);

  warningsByType.set(
    warning.type,
    (
      warningsByType.get(
        warning.type
      ) ?? 0
    ) + 1
  );
}

function isFiniteNumberString(value) {
  if (!value) {
    return false;
  }

  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  );
}

function isValidIsoDate(value) {
  if (
    !ISO_DATE_PATTERN.test(
      value
    )
  ) {
    return false;
  }

  const [
    yearText,
    monthText,
    dayText
  ] = value.split("-");

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day
  );
}

function formatRecordLocation(
  file,
  row,
  recordId
) {
  const location =
    formatLocation(
      file,
      row
    );

  if (!recordId) {
    return location;
  }

  return (
    `${location}, record ${recordId}`
  );
}

function formatLocation(
  file,
  row
) {
  if (row === null) {
    return file;
  }

  return `${file}, row ${row}`;
}

function getFileName(fileResult) {
  return (
    normalizeText(
      fileResult?.file?.filename
    ) ||
    normalizeText(
      fileResult?.file?.path
    ) ||
    "Unknown CSV"
  );
}

function normalizeRowNumber(value) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  return Number.isInteger(parsed)
    ? parsed
    : null;
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

function validateInputs(
  fileResults,
  registry
) {
  if (!Array.isArray(fileResults)) {
    throw new Error(
      "Schema validation requires a file-results array."
    );
  }

  if (
    !registry ||
    !Array.isArray(registry.fields)
  ) {
    throw new Error(
      "Schema validation requires the loaded schema registry."
    );
  }
}
