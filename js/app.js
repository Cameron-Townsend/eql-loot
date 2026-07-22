"use strict";

import {
  loadAllCsvFiles,
  loadManifest
} from "./csv-loader.js";

import {
  buildDatabase,
  getField,
  getPreferredClasses,
  getPreferredNpcLevel,
  getPreferredRaces,
  getPreferredSourceLinks,
  getPreferredStats,
  getVerificationBadgeClass,
  hasValue,
  isApproved,
  isQuarantined,
  naturalCompare
} from "./database.js";

import {
  createFilterOptions,
  filterRecords,
  getRecordEffectTypes,
  getRecordFocusEffects,
  getZoneSummary
} from "./filters.js";

const state = {
  manifest: null,
  records: [],
  filteredRecords: [],
  diagnostics: null,
  selectedStats: new Set(),
  recordsById: new Map()
};

const elements = {};

document.addEventListener(
  "DOMContentLoaded",
  initialize
);

async function initialize() {
  try {
    captureElements();
    validateRequiredElements();
    bindEvents();

    updateStatus("Loading CSV database…");

    state.manifest = await loadManifest();

    const fileResults = await loadAllCsvFiles(
      state.manifest
    );

    const database = buildDatabase(fileResults);

    state.records = database.records;
    state.diagnostics = database.diagnostics;

    state.recordsById = new Map(
      state.records.map(record => [
        getField(record, "recordId"),
        record
      ])
    );

    const filterOptions =
      createFilterOptions(state.records);

    populateFilters(filterOptions);
    renderStatOptions(filterOptions.stats);

    applyCurrentFilters();
    renderDiagnostics();

    updateStatus(
      `Database loaded: ${state.records.length} unique records`,
      "success"
    );
  } catch (error) {
    console.error(error);

    const message =
      `Database could not be loaded: ${error.message}`;

    if (elements.status) {
      updateStatus(message, "error");
    } else {
      displayFallbackError(message);
    }
  }
}

function captureElements() {
  elements.status =
    document.querySelector("#status");

  elements.fileCount =
    document.querySelector("#file-count");

  elements.recordCount =
    document.querySelector("#record-count");

  elements.matchCount =
    document.querySelector("#match-count");

  elements.zoneCount =
    document.querySelector("#zone-count");

  elements.search =
    document.querySelector("#search-filter");

  elements.continent =
    document.querySelector("#continent-filter");

  elements.zone =
    document.querySelector("#zone-filter");

  elements.category =
    document.querySelector("#category-filter");

  elements.slot =
    document.querySelector("#slot-filter");

  elements.className =
    document.querySelector("#class-filter");

  elements.race =
    document.querySelector("#race-filter");

  elements.minimumNpcLevel =
    document.querySelector("#minimum-level-filter");

  elements.maximumNpcLevel =
    document.querySelector("#maximum-level-filter");

  elements.magic =
    document.querySelector("#magic-filter");

  elements.lore =
    document.querySelector("#lore-filter");

  elements.noDrop =
    document.querySelector("#no-drop-filter");

  elements.questItem =
    document.querySelector("#quest-item-filter");

  elements.inventoryOnly =
    document.querySelector("#inventory-only-filter");

  elements.effectPresent =
    document.querySelector("#effect-present-filter");

  elements.effectType =
    document.querySelector("#effect-type-filter");

  elements.focusEffect =
    document.querySelector("#focus-effect-filter");

  elements.effectTransfer =
    document.querySelector("#effect-transfer-filter");

  elements.verification =
    document.querySelector("#verification-filter");

  elements.auditAction =
    document.querySelector("#audit-action-filter");

  elements.confidence =
    document.querySelector("#confidence-filter");

  elements.targetPriority =
    document.querySelector("#target-priority-filter");

  elements.approvedOnly =
    document.querySelector("#approved-filter");

  elements.statMode =
    document.querySelector("#stat-mode-filter");

  elements.statOptions =
    document.querySelector("#stat-options");

  elements.clearStatsButton =
    document.querySelector("#clear-stat-filters");

  elements.resetButton =
    document.querySelector("#reset-filters");

  elements.resultsBody =
    document.querySelector("#results-body");

  elements.zoneSummaryBody =
    document.querySelector("#zone-summary-body");

  elements.diagnostics =
    document.querySelector("#diagnostics");

  elements.itemDialog =
    document.querySelector("#item-dialog");

  elements.closeItemDialog =
    document.querySelector("#close-item-dialog");

  elements.detailItemName =
    document.querySelector("#detail-item-name");

  elements.detailItemSubtitle =
    document.querySelector("#detail-item-subtitle");

  elements.itemDetailContent =
    document.querySelector("#item-detail-content");
}

function validateRequiredElements() {
  const missingElements = Object.entries(elements)
    .filter(([, element]) => element === null)
    .map(([name]) => name);

  if (missingElements.length > 0) {
    throw new Error(
      `Page is missing required elements: ` +
      missingElements.join(", ")
    );
  }
}

function bindEvents() {
  const controls = [
    elements.search,
    elements.continent,
    elements.zone,
    elements.category,
    elements.slot,
    elements.className,
    elements.race,
    elements.minimumNpcLevel,
    elements.maximumNpcLevel,
    elements.magic,
    elements.lore,
    elements.noDrop,
    elements.questItem,
    elements.inventoryOnly,
    elements.effectPresent,
    elements.effectType,
    elements.focusEffect,
    elements.effectTransfer,
    elements.verification,
    elements.auditAction,
    elements.confidence,
    elements.targetPriority,
    elements.approvedOnly,
    elements.statMode
  ];

  for (const control of controls) {
    control.addEventListener(
      "input",
      applyCurrentFilters
    );

    control.addEventListener(
      "change",
      applyCurrentFilters
    );
  }

  elements.effectType.addEventListener(
    "change",
    updateFocusFilterAvailability
  );

  elements.resetButton.addEventListener(
    "click",
    resetFilters
  );

  elements.clearStatsButton.addEventListener(
    "click",
    clearStatFilters
  );

  elements.statOptions.addEventListener(
    "change",
    handleStatSelection
  );

  elements.resultsBody.addEventListener(
    "click",
    handleResultClick
  );

  elements.closeItemDialog.addEventListener(
    "click",
    closeItemDetails
  );

  elements.itemDialog.addEventListener(
    "click",
    handleDialogBackdropClick
  );
}

function populateFilters(options) {
  populateSelect(
    elements.continent,
    options.continents,
    "All continents"
  );

  populateSelect(
    elements.zone,
    options.zones,
    "All zones"
  );

  populateSelect(
    elements.category,
    options.categories,
    "All categories"
  );

  populateSelect(
    elements.slot,
    options.slots,
    "All slots"
  );

  populateSelect(
    elements.className,
    options.classes,
    "All classes"
  );

  populateSelect(
    elements.race,
    options.races,
    "All races"
  );

  populateSelect(
    elements.effectType,
    options.effectTypes,
    "All effect types"
  );

  populateSelect(
    elements.focusEffect,
    options.focusEffects,
    "All focus effects"
  );

  populateSelect(
    elements.effectTransfer,
    options.effectTransferValues,
    "All values"
  );

  populateVerificationSelect(
    options.verificationStatuses
  );

  populateSelect(
    elements.auditAction,
    options.auditActions,
    "All audit actions"
  );

  populateSelect(
    elements.confidence,
    options.confidenceLevels,
    "All confidence levels"
  );

  populateSelect(
    elements.targetPriority,
    options.targetPriorities,
    "All priorities"
  );

  updateFocusFilterAvailability();
}

function updateFocusFilterAvailability() {
  const selectedType = elements.effectType.value;

  /*
   * The focus family remains usable when no effect type is selected,
   * allowing direct focus searches. It becomes disabled only when the
   * user explicitly selects a non-focus effect type.
   */
  const disabled =
    selectedType !== "" &&
    selectedType !== "Focus";

  elements.focusEffect.disabled = disabled;

  if (disabled) {
    elements.focusEffect.value = "";
  }
}

function populateVerificationSelect(statuses) {
  elements.verification.replaceChildren();

  appendOption(
    elements.verification,
    "",
    "All statuses"
  );

  appendOption(
    elements.verification,
    "__confirmed_only__",
    "EQL Confirmed only"
  );

  for (const status of statuses) {
    appendOption(
      elements.verification,
      status,
      status
    );
  }
}

function populateSelect(
  select,
  values,
  defaultLabel
) {
  select.replaceChildren();

  appendOption(
    select,
    "",
    defaultLabel
  );

  for (const value of values) {
    appendOption(
      select,
      value,
      value
    );
  }
}

function appendOption(
  select,
  value,
  label
) {
  const option = document.createElement("option");

  option.value = value;
  option.textContent = label;

  select.append(option);
}

function renderStatOptions(stats) {
  elements.statOptions.replaceChildren();

  if (stats.length === 0) {
    const message = document.createElement("p");

    message.className = "muted-message";
    message.textContent =
      "No recognized stat values were found.";

    elements.statOptions.append(message);
    return;
  }

  for (const stat of stats) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");

    label.className = "stat-option";

    checkbox.type = "checkbox";
    checkbox.value = stat;
    checkbox.dataset.statFilter = "true";

    text.textContent = stat;

    label.append(checkbox, text);
    elements.statOptions.append(label);
  }
}

function handleStatSelection(event) {
  const checkbox = event.target.closest(
    'input[data-stat-filter="true"]'
  );

  if (!checkbox) {
    return;
  }

  if (checkbox.checked) {
    state.selectedStats.add(checkbox.value);
  } else {
    state.selectedStats.delete(checkbox.value);
  }

  applyCurrentFilters();
}

function clearStatFilters() {
  state.selectedStats.clear();

  const checkboxes =
    elements.statOptions.querySelectorAll(
      'input[data-stat-filter="true"]'
    );

  for (const checkbox of checkboxes) {
    checkbox.checked = false;
  }

  applyCurrentFilters();
}

function applyCurrentFilters() {
  const filters = {
    search: elements.search.value,
    continent: elements.continent.value,
    zone: elements.zone.value,
    category: elements.category.value,
    slot: elements.slot.value,
    className: elements.className.value,
    race: elements.race.value,

    minimumNpcLevel:
      elements.minimumNpcLevel.value,

    maximumNpcLevel:
      elements.maximumNpcLevel.value,

    magic: elements.magic.value,
    lore: elements.lore.value,
    noDrop: elements.noDrop.value,
    questItem: elements.questItem.value,
    inventoryOnly: elements.inventoryOnly.value,
    effectPresent: elements.effectPresent.value,
    effectType: elements.effectType.value,
    focusEffect: elements.focusEffect.value,

    effectTransferValue:
      elements.effectTransfer.value,

    verification: elements.verification.value,
    auditAction: elements.auditAction.value,
    confidence: elements.confidence.value,
    targetPriority: elements.targetPriority.value,
    approvedOnly: elements.approvedOnly.checked,

    stats: [...state.selectedStats],
    statMode: elements.statMode.value
  };

  state.filteredRecords = filterRecords(
    state.records,
    filters
  );

  state.filteredRecords.sort((left, right) => {
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

  renderResults();
  renderZoneSummary();
  updateCounts();
}

/*
 * Keep the remainder of your current app.js functions unchanged:
 *
 * renderResults
 * appendBadgeCell
 * createVerificationBadge
 * renderZoneSummary
 * handleResultClick
 * openItemDetails
 * appendQuarantineWarning
 * appendResearchSection
 * appendExpandableSection
 * appendQuickField
 * combineValues
 * closeItemDetails
 * handleDialogBackdropClick
 * appendCell
 * updateCounts
 * renderDiagnostics
 * appendDiagnostic
 * updateStatus
 * displayFallbackError
 *
 * Replace resetFilters with the version below.
 */

function resetFilters() {
  elements.search.value = "";
  elements.continent.value = "";
  elements.zone.value = "";
  elements.category.value = "";
  elements.slot.value = "";
  elements.className.value = "";
  elements.race.value = "";
  elements.minimumNpcLevel.value = "";
  elements.maximumNpcLevel.value = "";
  elements.magic.value = "";
  elements.lore.value = "";
  elements.noDrop.value = "";
  elements.questItem.value = "";
  elements.inventoryOnly.value = "";
  elements.effectPresent.value = "";
  elements.effectType.value = "";
  elements.focusEffect.value = "";
  elements.effectTransfer.value = "";
  elements.verification.value = "";
  elements.auditAction.value = "";
  elements.confidence.value = "";
  elements.targetPriority.value = "";
  elements.approvedOnly.checked = false;
  elements.statMode.value = "all";

  updateFocusFilterAvailability();
  clearStatFilters();
}
