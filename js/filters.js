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
    )
  };
}

export function filterRecords(records, filters) {
  const searchText = normalizeLower(filters.search);
  const selectedClass = normalizeLower(filters.className);

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
      searchText &&
      !buildSearchText(record).includes(searchText)
    ) {
      return false;
    }

    return true;
  });
}

export function getZoneSummary(records) {
  const zoneMap = new Map();

  for (const record of records) {
    const zone = normalizeText(record.zone) || "Unknown zone";

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
      .map(record => normalizeText(record[fieldName]))
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
      if (
        normalizeLower(value) !== "all" &&
        !normalizeLower(value).startsWith("all except")
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

  const values = splitList(classText)
    .map(normalizeLower);

  return values.includes(selectedClass);
}

function containsListValue(fieldValue, selectedValue) {
  const normalizedSelection = normalizeLower(selectedValue);

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
