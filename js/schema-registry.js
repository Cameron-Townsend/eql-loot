"use strict";

/*
 * EverQuest Legends Loot Explorer
 * Static master-schema registry loader
 *
 * The registry is a required application asset. The app must not proceed
 * with CSV processing if this file cannot be loaded or does not contain the
 * expected schema structure.
 */

export const EXPECTED_SCHEMA_VERSION =
  "EQL-LOOT-1.0";

export const EXPECTED_FIELD_COUNT = 257;

export const DEFAULT_SCHEMA_REGISTRY_URL =
  new URL(
    "../schema/EQL_Loot_Master_Schema_v1_0_Registry.json",
    import.meta.url
  ).href;

/*
 * Loads and validates the static schema registry.
 *
 * A registry failure is intentionally fatal. Silently continuing without
 * the registry would allow later CSV files to be interpreted using unsafe
 * or incomplete assumptions.
 */
export async function loadSchemaRegistry(
  registryUrl = DEFAULT_SCHEMA_REGISTRY_URL
) {
  let response;

  try {
    response = await fetch(
      registryUrl,
      {
        cache: "no-store"
      }
    );
  } catch (error) {
    throw new Error(
      "The EQL schema registry could not be requested. " +
      formatErrorMessage(error)
    );
  }

  if (!response.ok) {
    throw new Error(
      "The EQL schema registry could not be loaded " +
      `(${response.status} ${response.statusText}).`
    );
  }

  let rawRegistry;

  try {
    rawRegistry = await response.json();
  } catch (error) {
    throw new Error(
      "The EQL schema registry is not valid JSON. " +
      formatErrorMessage(error)
    );
  }

  return validateAndPrepareSchemaRegistry(
    rawRegistry,
    registryUrl
  );
}

/*
 * Confirms the minimum structure required by the application and builds
 * convenient indexes for later normalization and validation stages.
 */
export function validateAndPrepareSchemaRegistry(
  rawRegistry,
  sourceUrl = ""
) {
  if (
    !rawRegistry ||
    typeof rawRegistry !== "object" ||
    Array.isArray(rawRegistry)
  ) {
    throw new Error(
      "The EQL schema registry must contain a JSON object."
    );
  }

  const schemaName =
    normalizeText(rawRegistry.schema_name);

  const schemaVersion =
    normalizeText(rawRegistry.schema_version);

  const declaredFieldCount =
    parsePositiveInteger(
      rawRegistry.total_field_count
    );

  const listDelimiter =
    normalizeText(
      rawRegistry.delimiter_for_list_fields
    );

  const blankSemantics =
    normalizeText(
      rawRegistry.blank_semantics
    );

  if (!schemaName) {
    throw new Error(
      "The EQL schema registry is missing schema_name."
    );
  }

  if (!schemaVersion) {
    throw new Error(
      "The EQL schema registry is missing schema_version."
    );
  }

  if (
    schemaVersion !== EXPECTED_SCHEMA_VERSION
  ) {
    throw new Error(
      "Unsupported EQL schema version. " +
      `Expected ${EXPECTED_SCHEMA_VERSION}, ` +
      `but received ${schemaVersion}.`
    );
  }

  if (!Array.isArray(rawRegistry.fields)) {
    throw new Error(
      "The EQL schema registry is missing its fields array."
    );
  }

  if (
    rawRegistry.fields.length !==
    EXPECTED_FIELD_COUNT
  ) {
    throw new Error(
      "Unexpected EQL schema field count. " +
      `Expected ${EXPECTED_FIELD_COUNT}, ` +
      `but found ${rawRegistry.fields.length}.`
    );
  }

  if (
    declaredFieldCount !==
    EXPECTED_FIELD_COUNT
  ) {
    throw new Error(
      "The registry's total_field_count does not match " +
      `the expected ${EXPECTED_FIELD_COUNT} fields.`
    );
  }

  const fields = [];
  const fieldsByName = new Map();
  const registeredFieldNames = new Set();
  const registeredOrders = new Set();

  for (
    let index = 0;
    index < rawRegistry.fields.length;
    index += 1
  ) {
    const rawField =
      rawRegistry.fields[index];

    const field =
      prepareFieldDefinition(
        rawField,
        index
      );

    if (
      registeredFieldNames.has(field.field)
    ) {
      throw new Error(
        "The EQL schema registry contains a duplicate field: " +
        field.field
      );
    }

    if (
      registeredOrders.has(field.order)
    ) {
      throw new Error(
        "The EQL schema registry contains a duplicate order: " +
        field.order
      );
    }

    registeredFieldNames.add(field.field);
    registeredOrders.add(field.order);
    fieldsByName.set(field.field, field);
    fields.push(field);
  }

  fields.sort(
    (left, right) =>
      left.order - right.order
  );

  validateRequiredRegistryFields(
    registeredFieldNames
  );

  return {
    schemaName,
    schemaVersion,
    baseSchema:
      normalizeText(
        rawRegistry.base_schema
      ),

    baseFieldCount:
      parsePositiveInteger(
        rawRegistry.base_field_count
      ),

    totalFieldCount:
      declaredFieldCount,

    listDelimiter:
      listDelimiter || "; ",

    blankSemantics,

    canonicalMerge:
      prepareCanonicalMergeRules(
        rawRegistry.canonical_merge
      ),

    fields,
    fieldsByName,
    registeredFieldNames,

    sourceUrl,

    raw: rawRegistry
  };
}

export function getRegisteredField(
  registry,
  fieldName
) {
  if (
    !registry?.fieldsByName ||
    !(registry.fieldsByName instanceof Map)
  ) {
    return null;
  }

  return (
    registry.fieldsByName.get(
      normalizeText(fieldName)
    ) ?? null
  );
}

export function isRegisteredField(
  registry,
  fieldName
) {
  if (
    !registry?.registeredFieldNames ||
    !(
      registry.registeredFieldNames
      instanceof Set
    )
  ) {
    return false;
  }

  return registry.registeredFieldNames.has(
    normalizeText(fieldName)
  );
}

function prepareFieldDefinition(
  rawField,
  index
) {
  if (
    !rawField ||
    typeof rawField !== "object" ||
    Array.isArray(rawField)
  ) {
    throw new Error(
      `Registry field ${index + 1} is not a valid object.`
    );
  }

  const field =
    normalizeText(rawField.field);

  const order =
    parsePositiveInteger(rawField.order);

  const type =
    normalizeText(rawField.type);

  const group =
    normalizeText(rawField.group);

  const mergePolicy =
    normalizeText(rawField.merge_policy);

  if (!field) {
    throw new Error(
      `Registry field ${index + 1} is missing its field name.`
    );
  }

  if (!order) {
    throw new Error(
      `Registry field ${field} has an invalid order.`
    );
  }

  if (!type) {
    throw new Error(
      `Registry field ${field} is missing its type.`
    );
  }

  const allowedValues =
    Array.isArray(rawField.allowed_values)
      ? rawField.allowed_values
          .map(normalizeText)
          .filter(Boolean)
      : [];

  return {
    order,
    field,
    group,
    type,

    requiredInPhysicalCsv:
      rawField.required_in_physical_csv === true,

    defaultValue:
      normalizeText(rawField.default),

    allowedValues,

    mergePolicy,

    description:
      normalizeText(rawField.description)
  };
}

function prepareCanonicalMergeRules(
  rawRules
) {
  if (
    !rawRules ||
    typeof rawRules !== "object" ||
    Array.isArray(rawRules)
  ) {
    throw new Error(
      "The EQL schema registry is missing canonical_merge rules."
    );
  }

  return {
    stableIdentity:
      normalizeText(
        rawRules.stable_identity
      ),

    correctionTarget:
      normalizeText(
        rawRules.correction_target
      ),

    overlayRule:
      normalizeText(
        rawRules.overlay_rule
      ),

    blankRule:
      normalizeText(
        rawRules.blank_rule
      ),

    orderingRule:
      normalizeText(
        rawRules.ordering_rule
      ),

    multipleCorrections:
      normalizeText(
        rawRules.multiple_corrections
      )
  };
}

function validateRequiredRegistryFields(
  registeredFieldNames
) {
  const requiredFields = [
    "record_id",
    "batch",
    "item_name",
    "schema_version",
    "record_type",
    "record_status",
    "source_record_id",
    "canonical_record_id",
    "display_default",
    "searchable",
    "core_or_supplemental",
    "eql_audit_action",
    "revision"
  ];

  const missingFields =
    requiredFields.filter(
      fieldName =>
        !registeredFieldNames.has(fieldName)
    );

  if (missingFields.length > 0) {
    throw new Error(
      "The EQL schema registry is missing required fields: " +
      missingFields.join(", ")
    );
  }
}

function parsePositiveInteger(value) {
  const parsed =
    Number.parseInt(value, 10);

  return (
    Number.isInteger(parsed) &&
    parsed > 0
  )
    ? parsed
    : 0;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function formatErrorMessage(error) {
  if (
    error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return String(error ?? "Unknown error");
}
