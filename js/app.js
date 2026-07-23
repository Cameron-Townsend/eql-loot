"use strict";

import {
  loadAllCsvFiles,
  loadManifest
} from "./csv-loader.js";

import {
  loadSchemaRegistry
} from "./schema-registry.js";

import {
  buildDatabase,
  getField,
  getPreferredClasses,
  getPreferredNpcLevel,
  getPreferredRaces,
  getPreferredSourceLinks,
  getVerificationBadgeClass,
  hasValue,
  isQuarantined,
  naturalCompare
} from "./database.js";

import {
  createConditionalFilterOptions,
  createFilterOptions,
  filterRecords,
  getRecordEffectTypes,
  getRecordFocusEffects,
  getZoneSummary
} from "./filters.js";

import {
  PLANNER_SLOTS,
  getCompactWeaponDisplay,
  getItemStatsDisplay,
  getNativeSlotDisplay,
  getNormalPlannerSlots,
  getPlannerSlotLabel,
  getWeaponSkill,
  isAnyPlannerSlot,
  isNormallyEquippable
} from "./item-rules.js";

import {
  clearBuild,
  equipRecord,
  getBuildDiagnostics,
  getDestinationChoices,
  getEquippedRecord,
  getOccupiedSlotEntries,
  loadBuild,
  removeFromSlot,
  setBuildName
} from "./build-planner.js";

const state = {
  manifest: null,
  records: [],
  filteredRecords: [],
  diagnostics: null,
  selectedStats: new Set(),
  recordsById: new Map(),
  build: null,
  pendingEquipRecord: null,
  pendingReplace: null,
  selectedPlannerSlot: null,
  currentDetailRecord: null
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

    state.build = loadBuild();

    const filterOptions =
      createFilterOptions(state.records);

    populateFilters(filterOptions);
    renderStatOptions(filterOptions.stats);

    applyCurrentFilters();
    renderBuildPlanner();
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

  elements.sourceNpc =
    document.querySelector("#source-npc-filter");

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

  elements.npcLevelHint =
    document.querySelector("#npc-level-hint");

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

  elements.buildNameInput =
    document.querySelector("#build-name-input");

  elements.buildSaveStatus =
    document.querySelector("#build-save-status");

  elements.clearBuildButton =
    document.querySelector("#clear-build-button");

  elements.buildEquippedCount =
    document.querySelector("#build-equipped-count");

  elements.buildStatSummary =
    document.querySelector("#build-stat-summary");

  elements.buildEffectSummary =
    document.querySelector("#build-effect-summary");

  elements.buildWeaponSummary =
    document.querySelector("#build-weapon-summary");

  elements.buildVerificationSummary =
    document.querySelector("#build-verification-summary");

  elements.plannerSlots = [
    ...document.querySelectorAll(
      "[data-planner-slot]"
    )
  ];

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

  elements.equipDetailItemButton =
    document.querySelector("#equip-detail-item-button");

  elements.equipSlotDialog =
    document.querySelector("#equip-slot-dialog");

  elements.equipSlotDialogTitle =
    document.querySelector("#equip-slot-dialog-title");

  elements.equipSlotDialogSubtitle =
    document.querySelector("#equip-slot-dialog-subtitle");

  elements.closeEquipSlotDialog =
    document.querySelector("#close-equip-slot-dialog");

  elements.normalSlotChoices =
    document.querySelector("#normal-slot-choices");

  elements.anySlotChoices =
    document.querySelector("#any-slot-choices");

  elements.replaceItemDialog =
    document.querySelector("#replace-item-dialog");

  elements.replaceItemMessage =
    document.querySelector("#replace-item-message");

  elements.confirmReplaceItem =
    document.querySelector("#confirm-replace-item");

  elements.cancelReplaceItem =
    document.querySelector("#cancel-replace-item");

  elements.equippedSlotDialog =
    document.querySelector("#equipped-slot-dialog");

  elements.equippedSlotDialogTitle =
    document.querySelector("#equipped-slot-dialog-title");

  elements.equippedSlotDialogSubtitle =
    document.querySelector("#equipped-slot-dialog-subtitle");

  elements.equippedSlotItemContent =
    document.querySelector("#equipped-slot-item-content");

  elements.viewEquippedItemButton =
    document.querySelector("#view-equipped-item-button");

  elements.removeEquippedItemButton =
    document.querySelector("#remove-equipped-item-button");

  elements.closeEquippedSlotDialog =
    document.querySelector("#close-equipped-slot-dialog");

  elements.clearBuildDialog =
    document.querySelector("#clear-build-dialog");

  elements.confirmClearBuild =
    document.querySelector("#confirm-clear-build");

  elements.cancelClearBuild =
    document.querySelector("#cancel-clear-build");
}

function validateRequiredElements() {
  const missingElements = Object.entries(elements)
    .filter(([, element]) => {
      if (Array.isArray(element)) {
        return element.length === 0;
      }

      return element === null;
    })
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
    elements.sourceNpc,
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
      handleFilterChange
    );

    control.addEventListener(
      "change",
      handleFilterChange
    );
  }

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

  elements.equipDetailItemButton.addEventListener(
    "click",
    handleDetailEquipClick
  );

  elements.buildNameInput.addEventListener(
    "input",
    handleBuildNameInput
  );

  elements.clearBuildButton.addEventListener(
    "click",
    () => elements.clearBuildDialog.showModal()
  );

  for (const slotButton of elements.plannerSlots) {
    slotButton.addEventListener(
      "click",
      handlePlannerSlotClick
    );
  }

  elements.normalSlotChoices.addEventListener(
    "click",
    handleDestinationChoiceClick
  );

  elements.anySlotChoices.addEventListener(
    "click",
    handleDestinationChoiceClick
  );

  elements.closeEquipSlotDialog.addEventListener(
    "click",
    closeEquipSlotDialog
  );

  elements.confirmReplaceItem.addEventListener(
    "click",
    confirmPendingReplacement
  );

  elements.cancelReplaceItem.addEventListener(
    "click",
    cancelPendingReplacement
  );

  elements.closeEquippedSlotDialog.addEventListener(
    "click",
    closeEquippedSlotDialog
  );

  elements.viewEquippedItemButton.addEventListener(
    "click",
    viewSelectedEquippedItem
  );

  elements.removeEquippedItemButton.addEventListener(
    "click",
    removeSelectedEquippedItem
  );

  elements.confirmClearBuild.addEventListener(
    "click",
    confirmClearBuild
  );

  elements.cancelClearBuild.addEventListener(
    "click",
    () => elements.clearBuildDialog.close()
  );

  for (const dialog of [
    elements.equipSlotDialog,
    elements.replaceItemDialog,
    elements.equippedSlotDialog,
    elements.clearBuildDialog
  ]) {
    dialog.addEventListener(
      "click",
      handleGenericDialogBackdropClick
    );
  }
}

function handleFilterChange() {
  updateEffectFilterAvailability();
  applyCurrentFilters();
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
    elements.sourceNpc,
    options.sourceNpcs,
    "All source NPCs"
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

  updateEffectFilterAvailability();
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

function updateEffectFilterAvailability() {
  const effectPresence =
    elements.effectPresent.value;

  const selectedType =
    elements.effectType.value;

  const noEffectSelected =
    effectPresence === "no";

  elements.effectType.disabled =
    noEffectSelected;

  elements.effectTransfer.disabled =
    noEffectSelected;

  elements.focusEffect.disabled =
    noEffectSelected ||
    (
      selectedType !== "" &&
      selectedType !== "Focus"
    );

  if (noEffectSelected) {
    elements.effectType.value = "";
    elements.focusEffect.value = "";
    elements.effectTransfer.value = "";
  } else if (
    selectedType !== "" &&
    selectedType !== "Focus"
  ) {
    elements.focusEffect.value = "";
  }
}

function getCurrentFilters() {
  return {
    search: elements.search.value,
    continent: elements.continent.value,
    zone: elements.zone.value,
    sourceNpc: elements.sourceNpc.value,
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

    effectPresent:
      elements.effectPresent.value,

    effectType:
      elements.effectType.value,

    focusEffect:
      elements.focusEffect.value,

    effectTransferValue:
      elements.effectTransfer.value,

    verification:
      elements.verification.value,

    auditAction:
      elements.auditAction.value,

    confidence:
      elements.confidence.value,

    targetPriority:
      elements.targetPriority.value,

    approvedOnly:
      elements.approvedOnly.checked,

    stats: [...state.selectedStats],
    statMode: elements.statMode.value
  };
}

function refreshConditionalFilters(filters) {
  const options = createConditionalFilterOptions(
    state.records,
    filters
  );

  populateConditionalSelect(
    elements.continent,
    options.continents,
    "All continents",
    filters.continent
  );

  populateConditionalSelect(
    elements.zone,
    options.zones,
    "All zones",
    filters.zone
  );

  populateConditionalSelect(
    elements.sourceNpc,
    options.sourceNpcs,
    "All source NPCs",
    filters.sourceNpc
  );

  populateConditionalSelect(
    elements.category,
    options.categories,
    "All categories",
    filters.category
  );

  populateConditionalSelect(
    elements.slot,
    options.slots,
    "All slots",
    filters.slot
  );

  populateConditionalSelect(
    elements.className,
    options.classes,
    "All classes",
    filters.className
  );

  populateConditionalSelect(
    elements.race,
    options.races,
    "All races",
    filters.race
  );

  populateConditionalSelect(
    elements.effectType,
    options.effectTypes,
    "All effect types",
    filters.effectType
  );

  populateConditionalSelect(
    elements.focusEffect,
    options.focusEffects,
    "All focus effects",
    filters.focusEffect
  );

  populateConditionalSelect(
    elements.effectTransfer,
    options.effectTransferValues,
    "All values",
    filters.effectTransferValue
  );

  populateConditionalVerificationSelect(
    options.verificationStatuses,
    filters.verification
  );

  populateConditionalSelect(
    elements.auditAction,
    options.auditActions,
    "All audit actions",
    filters.auditAction
  );

  populateConditionalSelect(
    elements.confidence,
    options.confidenceLevels,
    "All confidence levels",
    filters.confidence
  );

  populateConditionalSelect(
    elements.targetPriority,
    options.targetPriorities,
    "All priorities",
    filters.targetPriority
  );

  populateBooleanSelect(
    elements.magic,
    options.booleanCounts.magic,
    "Any",
    filters.magic,
    {
      yes: "Magic only",
      no: "Not magic",
      unknown: "Unknown"
    }
  );

  populateBooleanSelect(
    elements.lore,
    options.booleanCounts.lore,
    "Any",
    filters.lore,
    {
      yes: "Lore only",
      no: "Not lore",
      unknown: "Unknown"
    }
  );

  populateBooleanSelect(
    elements.noDrop,
    options.booleanCounts.noDrop,
    "Any",
    filters.noDrop,
    {
      yes: "No Drop only",
      no: "Tradeable only",
      unknown: "Unknown"
    }
  );

  populateBooleanSelect(
    elements.questItem,
    options.booleanCounts.questItem,
    "Any",
    filters.questItem,
    {
      yes: "Quest items only",
      no: "Non-quest items",
      unknown: "Unknown"
    }
  );

  populateBooleanSelect(
    elements.inventoryOnly,
    options.booleanCounts.inventoryOnly,
    "Any",
    filters.inventoryOnly,
    {
      yes: "Inventory only",
      no: "Equippable/non-inventory",
      unknown: "Unknown"
    }
  );

  populateBooleanSelect(
    elements.effectPresent,
    options.booleanCounts.effectPresent,
    "Any",
    filters.effectPresent,
    {
      yes: "Effect present",
      no: "No effect listed"
    }
  );

  renderConditionalStatOptions(
    options.stats
  );

  updateNpcLevelHint(
    options.npcLevelRange
  );

  updateEffectFilterAvailability();
}

function populateConditionalSelect(
  select,
  options,
  defaultLabel,
  selectedValue
) {
  select.replaceChildren();

  appendOption(
    select,
    "",
    defaultLabel
  );

  const optionMap = new Map(
    options.map(option => [
      option.value,
      option.count
    ])
  );

  if (
    selectedValue &&
    !optionMap.has(selectedValue)
  ) {
    optionMap.set(selectedValue, 0);
  }

  const sortedOptions =
    [...optionMap.entries()]
      .sort((left, right) =>
        naturalCompare(left[0], right[0])
      );

  for (const [value, count] of sortedOptions) {
    const option =
      document.createElement("option");

    option.value = value;

    option.textContent =
      count > 0
        ? `${value} (${count})`
        : `${value} (0 matches)`;

    if (
      count === 0 &&
      value !== selectedValue
    ) {
      option.disabled = true;
    }

    select.append(option);
  }

  select.value = selectedValue || "";
}

function populateConditionalVerificationSelect(
  options,
  selectedValue
) {
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

  const optionMap = new Map(
    options.map(option => [
      option.value,
      option.count
    ])
  );

  if (
    selectedValue &&
    selectedValue !== "__confirmed_only__" &&
    !optionMap.has(selectedValue)
  ) {
    optionMap.set(selectedValue, 0);
  }

  const sortedOptions =
    [...optionMap.entries()]
      .sort((left, right) =>
        naturalCompare(left[0], right[0])
      );

  for (const [value, count] of sortedOptions) {
    const option =
      document.createElement("option");

    option.value = value;

    option.textContent =
      count > 0
        ? `${value} (${count})`
        : `${value} (0 matches)`;

    if (
      count === 0 &&
      value !== selectedValue
    ) {
      option.disabled = true;
    }

    elements.verification.append(option);
  }

  elements.verification.value =
    selectedValue || "";
}

function populateBooleanSelect(
  select,
  counts,
  defaultLabel,
  selectedValue,
  labels
) {
  select.replaceChildren();

  appendOption(
    select,
    "",
    defaultLabel
  );

  for (
    const [value, label]
    of Object.entries(labels)
  ) {
    const count = counts[value] ?? 0;
    const option =
      document.createElement("option");

    option.value = value;

    option.textContent =
      count > 0
        ? `${label} (${count})`
        : `${label} (0 matches)`;

    if (
      count === 0 &&
      value !== selectedValue
    ) {
      option.disabled = true;
    }

    select.append(option);
  }

  select.value = selectedValue || "";
}

function renderStatOptions(stats) {
  elements.statOptions.replaceChildren();

  if (stats.length === 0) {
    const message =
      document.createElement("p");

    message.className = "muted-message";
    message.textContent =
      "No recognized stat values were found.";

    elements.statOptions.append(message);
    return;
  }

  for (const stat of stats) {
    const label =
      document.createElement("label");

    const checkbox =
      document.createElement("input");

    const text =
      document.createElement("span");

    label.className = "stat-option";

    checkbox.type = "checkbox";
    checkbox.value = stat;
    checkbox.dataset.statFilter = "true";

    text.textContent = stat;

    label.append(checkbox, text);
    elements.statOptions.append(label);
  }
}

function renderConditionalStatOptions(options) {
  elements.statOptions.replaceChildren();

  const optionMap = new Map(
    options.map(option => [
      option.value,
      option.count
    ])
  );

  for (const selectedStat of state.selectedStats) {
    if (!optionMap.has(selectedStat)) {
      optionMap.set(selectedStat, 0);
    }
  }

  if (optionMap.size === 0) {
    const message =
      document.createElement("p");

    message.className = "muted-message";
    message.textContent =
      "No recognized stats are available under the current filters.";

    elements.statOptions.append(message);
    return;
  }

  const sortedOptions =
    [...optionMap.entries()]
      .sort((left, right) =>
        naturalCompare(left[0], right[0])
      );

  for (const [stat, count] of sortedOptions) {
    const label =
      document.createElement("label");

    const checkbox =
      document.createElement("input");

    const text =
      document.createElement("span");

    const isSelected =
      state.selectedStats.has(stat);

    label.className = "stat-option";

    if (count === 0) {
      label.classList.add(
        "is-unavailable"
      );
    }

    checkbox.type = "checkbox";
    checkbox.value = stat;
    checkbox.dataset.statFilter = "true";
    checkbox.checked = isSelected;

    checkbox.disabled =
      count === 0 &&
      !isSelected;

    text.textContent =
      count > 0
        ? `${stat} (${count})`
        : `${stat} (0 matches)`;

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
    state.selectedStats.add(
      checkbox.value
    );
  } else {
    state.selectedStats.delete(
      checkbox.value
    );
  }

  applyCurrentFilters();
}

function clearStatFilters() {
  state.selectedStats.clear();

  applyCurrentFilters();
}

function updateNpcLevelHint(range) {
  if (
    range.minimum === null ||
    range.maximum === null
  ) {
    elements.npcLevelHint.textContent =
      "No source NPC levels are available under the current filters.";

    return;
  }

  const rangeText =
    range.minimum === range.maximum
      ? `level ${range.minimum}`
      : `levels ${range.minimum}–${range.maximum}`;

  elements.npcLevelHint.textContent =
    `Available source NPC ${rangeText} across ` +
    `${range.recordCount} candidate record` +
    `${range.recordCount === 1 ? "" : "s"}.`;
}

function applyCurrentFilters() {
  const filters = getCurrentFilters();

  state.filteredRecords = filterRecords(
    state.records,
    filters
  );

  state.filteredRecords.sort(
    (left, right) => {
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
    }
  );

  refreshConditionalFilters(filters);
  renderResults();
  renderZoneSummary();
  updateCounts();
}

function renderResults() {
  elements.resultsBody.replaceChildren();

  const maximumRows = 500;

  const displayedRecords =
    state.filteredRecords.slice(
      0,
      maximumRows
    );

  for (const record of displayedRecords) {
    const row =
      document.createElement("tr");

    const itemCell =
      document.createElement("td");

    const itemButton =
      document.createElement("button");

    itemButton.type = "button";
    itemButton.className =
      "item-link-button";

    itemButton.dataset.recordId =
      getField(record, "recordId");

    itemButton.textContent =
      getField(record, "itemName") ||
      "Unnamed item";

    itemCell.className = "item-name";
    itemCell.append(itemButton);
    row.append(itemCell);

    appendCell(
      row,
      getField(record, "zone")
    );

    appendCell(
      row,
      getField(record, "slot")
    );

    appendCell(
      row,
      getItemStatsDisplay(record),
      "item-stats-cell"
    );

    appendCell(
      row,
      getPreferredClasses(record)
    );

    appendCell(
      row,
      getField(record, "sourceNpc")
    );

    appendCell(
      row,
      getPreferredNpcLevel(record)
    );

    appendCell(
      row,
      getField(record, "procClickFocus")
    );

    appendBadgeCell(
      row,
      getField(
        record,
        "verificationStatus"
      )
    );

    appendCell(
      row,
      getField(record, "confidence")
    );

    appendEquipCell(row, record);

    elements.resultsBody.append(row);
  }

  if (displayedRecords.length === 0) {
    const row =
      document.createElement("tr");

    const cell =
      document.createElement("td");

    cell.colSpan = 11;

    cell.textContent =
      "No loot records match the active filters.";

    row.append(cell);
    elements.resultsBody.append(row);
  }
}

function appendEquipCell(row, record) {
  const cell =
    document.createElement("td");

  cell.className = "equip-action-cell";

  const button =
    document.createElement("button");

  button.type = "button";

  if (isNormallyEquippable(record)) {
    button.className =
      "equip-to-build-button";

    button.dataset.equipRecordId =
      getField(record, "recordId");

    button.textContent =
      "Equip to Build";
  } else {
    button.className =
      "equip-to-build-button";

    button.disabled = true;
    button.textContent =
      "Not equippable";
  }

  cell.append(button);
  row.append(cell);
}
function appendBadgeCell(row, status) {
  const cell =
    document.createElement("td");

  const badge =
    createVerificationBadge(status);

  cell.append(badge);
  row.append(cell);
}

function createVerificationBadge(status) {
  const badge =
    document.createElement("span");

  badge.className = [
    "verification-badge",
    getVerificationBadgeClass(status)
  ].join(" ");

  badge.textContent =
    status || "Status not recorded";

  return badge;
}

function renderZoneSummary() {
  const summaries = getZoneSummary(
    state.filteredRecords
  );

  elements.zoneSummaryBody.replaceChildren();

  for (const summary of summaries) {
    const row =
      document.createElement("tr");

    appendCell(row, summary.zone);
    appendCell(row, summary.itemCount);
    appendCell(row, summary.slotCount);
    appendCell(row, summary.confirmedCount);

    elements.zoneSummaryBody.append(row);
  }

  if (summaries.length === 0) {
    const row =
      document.createElement("tr");

    const cell =
      document.createElement("td");

    cell.colSpan = 4;

    cell.textContent =
      "No zones match the active filters.";

    row.append(cell);
    elements.zoneSummaryBody.append(row);
  }
}

function handleResultClick(event) {
  const equipButton = event.target.closest(
    "button[data-equip-record-id]"
  );

  if (equipButton) {
    const record = state.recordsById.get(
      equipButton.dataset.equipRecordId
    );

    if (record) {
      openEquipSlotDialog(record);
    }

    return;
  }

  const itemButton = event.target.closest(
    "button[data-record-id]"
  );

  if (!itemButton) {
    return;
  }

  const record = state.recordsById.get(
    itemButton.dataset.recordId
  );

  if (!record) {
    return;
  }

  openItemDetails(record);
}

function handleDetailEquipClick() {
  if (!state.currentDetailRecord) {
    return;
  }

  closeItemDetails();
  openEquipSlotDialog(
    state.currentDetailRecord
  );
}

function openItemDetails(record) {
  state.currentDetailRecord = record;

  const itemName =
    getField(record, "itemName") ||
    "Unnamed item";

  const category =
    getField(record, "itemCategory");

  const slot =
    getField(record, "slot");

  const exactEffect =
    combineValues(
      getField(record, "procClickFocus"),
      getField(record, "effectDescription")
    );

  const normalizedEffectTypes =
    getRecordEffectTypes(record);

  const normalizedFocusEffects =
    getRecordFocusEffects(record);

  elements.detailItemName.textContent =
    itemName;

  elements.detailItemSubtitle.textContent = [
    slot,
    category,
    getField(record, "zone")
  ]
    .filter(Boolean)
    .join(" • ");

  elements.equipDetailItemButton.disabled =
    !isNormallyEquippable(record);

  elements.equipDetailItemButton.textContent =
    isNormallyEquippable(record)
      ? "Equip to Build"
      : "Not equippable";

  elements.itemDetailContent.replaceChildren();

  const statusRow =
    document.createElement("div");

  statusRow.className =
    "popup-status-row";

  statusRow.append(
    createVerificationBadge(
      getField(
        record,
        "verificationStatus"
      )
    )
  );

  const confidence =
    getField(record, "confidence");

  if (confidence) {
    const confidenceBadge =
      document.createElement("span");

    confidenceBadge.className =
      "confidence-badge";

    confidenceBadge.textContent =
      `${confidence} confidence`;

    statusRow.append(confidenceBadge);
  }

  elements.itemDetailContent.append(
    statusRow
  );

  if (isQuarantined(record)) {
    appendQuarantineWarning(
      elements.itemDetailContent
    );
  }

  const quickCard =
    document.createElement("section");

  quickCard.className =
    "quick-detail-card";

  appendQuickField(
    quickCard,
    "Slot and category",
    combineValues(slot, category)
  );

  appendQuickField(
    quickCard,
    "EQL stats",
    getItemStatsDisplay(record),
    "quick-field-wide"
  );

  appendQuickField(
    quickCard,
    "EQL classes",
    getPreferredClasses(record)
  );

  appendQuickField(
    quickCard,
    "EQL races",
    getPreferredRaces(record)
  );

  appendQuickField(
    quickCard,
    "Source NPC",
    getField(record, "sourceNpc")
  );

  appendQuickField(
    quickCard,
    "NPC level",
    getPreferredNpcLevel(record)
  );

  appendQuickField(
    quickCard,
    "Zone",
    getField(record, "zone")
  );

  appendQuickField(
    quickCard,
    "Spawn location",
    getField(record, "spawnLocation")
  );

  appendQuickField(
    quickCard,
    "Proc, click, or focus",
    exactEffect,
    "quick-field-wide"
  );

  appendQuickField(
    quickCard,
    "Focus-effect family",
    normalizedFocusEffects.join(", "),
    "quick-field-wide"
  );

  appendQuickField(
    quickCard,
    "Weapon skill",
    getWeaponSkill(record)
  );

  appendQuickField(
    quickCard,
    "Drop frequency",
    combineValues(
      getField(record, "dropFrequency"),
      getField(record, "dropRateReported")
    )
  );

  appendQuickField(
    quickCard,
    "General value",
    getField(record, "generalValueNotes"),
    "quick-field-wide"
  );

  elements.itemDetailContent.append(
    quickCard
  );

  appendExpandableSection(
    elements.itemDetailContent,
    "Drop Details",
    "Spawn behavior, hazards, and drop information",
    [
      [
        "Placeholder",
        getField(record, "placeholder")
      ],
      [
        "Placeholder level range",
        getField(
          record,
          "placeholderLevelRange"
        )
      ],
      [
        "Respawn timer",
        getField(record, "respawnTimer")
      ],
      [
        "Time condition",
        getField(record, "timeCondition")
      ],
      [
        "Nearby enemy levels",
        getField(
          record,
          "nearbyEnemyLevelRange"
        )
      ],
      [
        "Spawn type",
        getField(record, "spawnType")
      ],
      [
        "Special abilities",
        getField(
          record,
          "specialAbilities"
        )
      ],
      [
        "Add risk",
        getField(record, "socialAddRisk")
      ],
      [
        "Faction consequences",
        getField(
          record,
          "factionConsequences"
        )
      ],
      [
        "Drop-rate notes",
        combineValues(
          getField(
            record,
            "dropRateReported"
          ),
          getField(record, "dropNotes")
        )
      ]
    ]
  );

  appendExpandableSection(
    elements.itemDetailContent,
    "EQL Mechanics",
    "Focus families, transfer, extraction, upgrading, and observed mechanics",
    [
      [
        "Exact effect text",
        exactEffect
      ],
      [
        "Effect type",
        normalizedEffectTypes.join(", ")
      ],
      [
        "Normalized focus family",
        normalizedFocusEffects.join(", ")
      ],
      [
        "Effect-transfer value",
        getField(
          record,
          "effectTransferValue"
        )
      ],
      [
        "Effect extractable",
        getField(
          record,
          "effectExtractable"
        )
      ],
      [
        "Effect extraction rank",
        getField(
          record,
          "effectExtractionRank"
        )
      ],
      [
        "Upgradeable",
        getField(record, "upgradeable")
      ],
      [
        "Maximum upgrade rank",
        getField(
          record,
          "maximumUpgradeRank"
        )
      ],
      [
        "Duplicate-farming value",
        getField(
          record,
          "duplicateFarmingValue"
        )
      ],
      [
        "Challenge tier observed",
        getField(
          record,
          "challengeTierObserved"
        )
      ],
      [
        "Personal loot confirmed",
        getField(
          record,
          "personalLootConfirmed"
        )
      ]
    ]
  );

  appendExpandableSection(
    elements.itemDetailContent,
    "Classic Comparison",
    "Classic baseline values retained for comparison",
    [
      [
        "Classic stats",
        getField(record, "statsClassic")
      ],
      [
        "Classic classes",
        getField(
          record,
          "classesClassic"
        )
      ],
      [
        "Classic races",
        getField(record, "racesClassic")
      ],
      [
        "Classic NPC level",
        getField(
          record,
          "sourceNpcLevelClassic"
        )
      ],
      [
        "Era status",
        getField(record, "eraStatus")
      ],
      [
        "Classic baseline notes",
        getField(
          record,
          "classicBaselineNotes"
        )
      ]
    ]
  );

  appendResearchSection(record);

  elements.itemDialog.showModal();
}

function closeItemDetails() {
  elements.itemDialog.close();
}

function handleDialogBackdropClick(event) {
  if (event.target === elements.itemDialog) {
    closeItemDetails();
  }
}

function openEquipSlotDialog(record) {
  if (!isNormallyEquippable(record)) {
    return;
  }

  state.pendingEquipRecord = record;
  state.pendingReplace = null;

  const itemName =
    getField(record, "itemName") ||
    "Unnamed item";

  elements.equipSlotDialogTitle.textContent =
    `Equip ${itemName}`;

  elements.equipSlotDialogSubtitle.textContent =
    getItemStatsDisplay(record);

  renderDestinationChoices(record);

  elements.equipSlotDialog.showModal();
}

function renderDestinationChoices(record) {
  elements.normalSlotChoices.replaceChildren();
  elements.anySlotChoices.replaceChildren();

  const choices = getDestinationChoices(
    state.build,
    record,
    state.recordsById
  );

  const normalSlots =
    new Set(
      getNormalPlannerSlots(record)
    );

  const normalChoices = choices.filter(
    choice =>
      normalSlots.has(
        choice.plannerSlotId
      )
  );

  const anyChoices = choices.filter(
    choice =>
      isAnyPlannerSlot(
        choice.plannerSlotId
      )
  );

  appendDestinationButtons(
    elements.normalSlotChoices,
    normalChoices,
    "No recognized normal slots are available."
  );

  appendDestinationButtons(
    elements.anySlotChoices,
    anyChoices,
    "This item is not eligible for an Any slot."
  );
}

function appendDestinationButtons(
  container,
  choices,
  emptyMessage
) {
  if (choices.length === 0) {
    const message =
      document.createElement("p");

    message.className = "muted-message";
    message.textContent = emptyMessage;

    container.append(message);
    return;
  }

  for (const choice of choices) {
    const button =
      document.createElement("button");

    const slotLabel =
      choice.plannerSlotLabel;

    let occupancyText = "Empty";

    if (choice.equippedRecord) {
      occupancyText =
        getField(
          choice.equippedRecord,
          "itemName"
        ) || "Occupied";
    } else if (
      choice.equippedRecordId &&
      !choice.equippedRecord
    ) {
      occupancyText =
        "Saved item missing from database";
    }

    button.type = "button";
    button.className =
      "slot-choice-button";

    button.dataset.destinationSlot =
      choice.plannerSlotId;

    button.innerHTML = `
      <span class="slot-choice-name"></span>
      <span class="slot-choice-occupancy"></span>
    `;

    button.querySelector(
      ".slot-choice-name"
    ).textContent = slotLabel;

    button.querySelector(
      ".slot-choice-occupancy"
    ).textContent = occupancyText;

    if (choice.occupied) {
      button.classList.add("is-occupied");
    }

    if (choice.sameItem) {
      button.classList.add("contains-same-item");
    }

    container.append(button);
  }
}

function handleDestinationChoiceClick(event) {
  const button = event.target.closest(
    "button[data-destination-slot]"
  );

  if (
    !button ||
    !state.pendingEquipRecord
  ) {
    return;
  }

  const plannerSlotId =
    button.dataset.destinationSlot;

  const existingRecord =
    getEquippedRecord(
      state.build,
      plannerSlotId,
      state.recordsById
    );

  const existingRecordId =
    state.build?.slots?.[plannerSlotId] ??
    null;

  const incomingRecordId =
    getField(
      state.pendingEquipRecord,
      "recordId"
    );

  if (
    existingRecordId &&
    existingRecordId !== incomingRecordId
  ) {
    state.pendingReplace = {
      record: state.pendingEquipRecord,
      plannerSlotId,
      existingRecord
    };

    const existingName =
      existingRecord
        ? getField(
            existingRecord,
            "itemName"
          )
        : "a saved item missing from the current database";

    const incomingName =
      getField(
        state.pendingEquipRecord,
        "itemName"
      ) || "this item";

    elements.replaceItemMessage.textContent =
      `${getPlannerSlotLabel(plannerSlotId)} currently contains ` +
      `${existingName}. Replace it with ${incomingName}?`;

    elements.equipSlotDialog.close();
    elements.replaceItemDialog.showModal();

    return;
  }

  equipPendingRecord(
    plannerSlotId,
    false
  );
}

function equipPendingRecord(
  plannerSlotId,
  allowReplace
) {
  if (!state.pendingEquipRecord) {
    return;
  }

  const result = equipRecord(
    state.build,
    state.pendingEquipRecord,
    plannerSlotId,
    {
      allowReplace
    }
  );

  if (!result.success) {
    console.warn(
      "Item could not be equipped.",
      result.reason
    );

    return;
  }

  state.build = result.build;

  renderBuildPlanner();

  elements.equipSlotDialog.close();

  if (elements.replaceItemDialog.open) {
    elements.replaceItemDialog.close();
  }

  const itemName =
    getField(
      state.pendingEquipRecord,
      "itemName"
    ) || "Item";

  elements.buildSaveStatus.textContent =
    `${itemName} equipped to ` +
    `${getPlannerSlotLabel(plannerSlotId)}.`;

  state.pendingEquipRecord = null;
  state.pendingReplace = null;
}

function confirmPendingReplacement() {
  if (!state.pendingReplace) {
    return;
  }

  const {
    plannerSlotId
  } = state.pendingReplace;

  equipPendingRecord(
    plannerSlotId,
    true
  );
}

function cancelPendingReplacement() {
  state.pendingReplace = null;

  elements.replaceItemDialog.close();

  if (state.pendingEquipRecord) {
    elements.equipSlotDialog.showModal();
  }
}

function closeEquipSlotDialog() {
  state.pendingEquipRecord = null;
  state.pendingReplace = null;

  elements.equipSlotDialog.close();
}
function renderBuildPlanner() {
  if (!state.build) {
    state.build = loadBuild();
  }

  elements.buildNameInput.value =
    state.build.name || "";

  for (const slotButton of elements.plannerSlots) {
    const plannerSlotId =
      slotButton.dataset.plannerSlot;

    const recordId =
      state.build.slots?.[plannerSlotId] ??
      null;

    const record =
      recordId
        ? state.recordsById.get(recordId) ?? null
        : null;

    renderPlannerSlot(
      slotButton,
      plannerSlotId,
      record,
      recordId
    );
  }

  renderBuildSummary();
}

function renderPlannerSlot(
  slotButton,
  plannerSlotId,
  record,
  recordId
) {
  const itemElement =
    slotButton.querySelector(
      ".planner-slot-item"
    );

  slotButton.classList.remove(
    "is-empty",
    "is-occupied",
    "is-missing-record",
    "is-quarantined"
  );

  if (!recordId) {
    slotButton.classList.add("is-empty");

    itemElement.textContent =
      isAnyPlannerSlot(plannerSlotId)
        ? "Any equippable item"
        : "Empty";

    slotButton.title =
      `${getPlannerSlotLabel(plannerSlotId)}: Empty`;

    return;
  }

  if (!record) {
    slotButton.classList.add(
      "is-occupied",
      "is-missing-record"
    );

    itemElement.textContent =
      "Saved item unavailable";

    slotButton.title =
      `${getPlannerSlotLabel(plannerSlotId)}: ` +
      `The saved record is missing from the database`;

    return;
  }

  slotButton.classList.add(
    "is-occupied"
  );

  if (isQuarantined(record)) {
    slotButton.classList.add(
      "is-quarantined"
    );
  }

  const itemName =
    getField(record, "itemName") ||
    "Unnamed item";

  const compactWeapon =
    getCompactWeaponDisplay(record);

  const nativeSlot =
    getNativeSlotDisplay(record);

  const displayParts = [
    itemName
  ];

  if (
    isAnyPlannerSlot(plannerSlotId) &&
    nativeSlot
  ) {
    displayParts.push(
      `Native: ${nativeSlot}`
    );
  }

  if (compactWeapon) {
    displayParts.push(compactWeapon);
  }

  itemElement.replaceChildren();

  const nameElement =
    document.createElement("strong");

  nameElement.className =
    "planner-equipped-item-name";

  nameElement.textContent = itemName;

  itemElement.append(nameElement);

  if (
    isAnyPlannerSlot(plannerSlotId) &&
    nativeSlot
  ) {
    const nativeSlotElement =
      document.createElement("span");

    nativeSlotElement.className =
      "planner-native-slot";

    nativeSlotElement.textContent =
      `Native slot: ${nativeSlot}`;

    itemElement.append(nativeSlotElement);
  }

  if (compactWeapon) {
    const weaponElement =
      document.createElement("span");

    weaponElement.className =
      "planner-weapon-ratio";

    weaponElement.textContent =
      compactWeapon;

    itemElement.append(weaponElement);
  }

  slotButton.title =
    `${getPlannerSlotLabel(plannerSlotId)}: ` +
    displayParts.join(" • ");
}

function handlePlannerSlotClick(event) {
  const slotButton =
    event.currentTarget;

  const plannerSlotId =
    slotButton.dataset.plannerSlot;

  const recordId =
    state.build?.slots?.[plannerSlotId] ??
    null;

  if (!recordId) {
    return;
  }

  state.selectedPlannerSlot =
    plannerSlotId;

  const record =
    state.recordsById.get(recordId) ??
    null;

  openEquippedSlotDialog(
    plannerSlotId,
    record,
    recordId
  );
}

function openEquippedSlotDialog(
  plannerSlotId,
  record,
  recordId
) {
  const slotLabel =
    getPlannerSlotLabel(plannerSlotId);

  elements.equippedSlotDialogTitle.textContent =
    slotLabel;

  elements.equippedSlotItemContent.replaceChildren();

  if (!record) {
    elements.equippedSlotDialogSubtitle.textContent =
      "Saved item missing from the current database";

    const warning =
      document.createElement("p");

    warning.className =
      "warning-message";

    warning.textContent =
      `The saved record ${recordId} is no longer available. ` +
      `You may remove it from this slot.`;

    elements.equippedSlotItemContent.append(
      warning
    );

    elements.viewEquippedItemButton.disabled =
      true;

    elements.removeEquippedItemButton.disabled =
      false;

    elements.equippedSlotDialog.showModal();
    return;
  }

  const itemName =
    getField(record, "itemName") ||
    "Unnamed item";

  elements.equippedSlotDialogSubtitle.textContent =
    itemName;

  elements.viewEquippedItemButton.disabled =
    false;

  elements.removeEquippedItemButton.disabled =
    false;

  const card =
    document.createElement("section");

  card.className =
    "quick-detail-card";

  appendQuickField(
    card,
    "Item",
    itemName
  );

  appendQuickField(
    card,
    "Native slot",
    getNativeSlotDisplay(record)
  );

  appendQuickField(
    card,
    "Stats",
    getItemStatsDisplay(record),
    "quick-field-wide"
  );

  appendQuickField(
    card,
    "Classes",
    getPreferredClasses(record)
  );

  appendQuickField(
    card,
    "Races",
    getPreferredRaces(record)
  );

  appendQuickField(
    card,
    "Effect",
    combineValues(
      getField(record, "procClickFocus"),
      getField(record, "effectDescription")
    ),
    "quick-field-wide"
  );

  appendQuickField(
    card,
    "Verification",
    getField(
      record,
      "verificationStatus"
    )
  );

  elements.equippedSlotItemContent.append(
    card
  );

  elements.equippedSlotDialog.showModal();
}

function closeEquippedSlotDialog() {
  state.selectedPlannerSlot = null;
  elements.equippedSlotDialog.close();
}

function viewSelectedEquippedItem() {
  if (!state.selectedPlannerSlot) {
    return;
  }

  const record = getEquippedRecord(
    state.build,
    state.selectedPlannerSlot,
    state.recordsById
  );

  if (!record) {
    return;
  }

  elements.equippedSlotDialog.close();
  openItemDetails(record);
}

function removeSelectedEquippedItem() {
  if (!state.selectedPlannerSlot) {
    return;
  }

  const plannerSlotId =
    state.selectedPlannerSlot;

  const result = removeFromSlot(
    state.build,
    plannerSlotId
  );

  if (!result.success) {
    return;
  }

  state.build = result.build;

  elements.equippedSlotDialog.close();
  state.selectedPlannerSlot = null;

  renderBuildPlanner();

  elements.buildSaveStatus.textContent =
    `Removed item from ` +
    `${getPlannerSlotLabel(plannerSlotId)}.`;
}

function handleBuildNameInput() {
  state.build = setBuildName(
    state.build,
    elements.buildNameInput.value
  );

  elements.buildSaveStatus.textContent =
    "Build name saved in this browser.";
}

function confirmClearBuild() {
  state.build = clearBuild();

  state.pendingEquipRecord = null;
  state.pendingReplace = null;
  state.selectedPlannerSlot = null;

  elements.clearBuildDialog.close();

  renderBuildPlanner();

  elements.buildSaveStatus.textContent =
    "Build cleared.";
}

function renderBuildSummary() {
  const diagnostics =
    getBuildDiagnostics(
      state.build,
      state.recordsById
    );

  elements.buildEquippedCount.textContent =
    `${diagnostics.occupiedSlots} / ` +
    `${diagnostics.totalSlots} slots equipped`;

  const occupiedEntries =
    getOccupiedSlotEntries(
      state.build,
      state.recordsById
    );

  const validRecords =
    occupiedEntries
      .map(entry => entry.record)
      .filter(Boolean);

  renderBuildStatSummary(
    validRecords,
    diagnostics
  );

  renderBuildEffectSummary(
    validRecords
  );

  renderBuildWeaponSummary();

  renderBuildVerificationSummary(
    validRecords,
    diagnostics
  );
}

function renderBuildStatSummary(
  records,
  diagnostics
) {
  elements.buildStatSummary.replaceChildren();

  if (records.length === 0) {
    appendMutedMessage(
      elements.buildStatSummary,
      diagnostics.missingRecordCount > 0
        ? "The equipped records are missing from the current database."
        : "Equip items to begin building a stat summary."
    );

    return;
  }

  /*
   * The initial planner presents each item's complete formatted stat line.
   * Numeric totals will be added later after the historical stat formats
   * have been audited and normalized.
   */
  const list =
    document.createElement("ul");

  list.className =
    "build-summary-list";

  for (
    const entry
    of getOccupiedSlotEntries(
      state.build,
      state.recordsById
    )
  ) {
    if (!entry.record) {
      continue;
    }

    const itemName =
      getField(
        entry.record,
        "itemName"
      ) || "Unnamed item";

    const stats =
      getItemStatsDisplay(
        entry.record
      ) || "No stats recorded";

    const listItem =
      document.createElement("li");

    const label =
      document.createElement("strong");

    const value =
      document.createElement("span");

    label.textContent =
      `${entry.plannerSlotLabel}: `;

    value.textContent =
      `${itemName} — ${stats}`;

    listItem.append(label, value);
    list.append(listItem);
  }

  elements.buildStatSummary.append(list);
}

function renderBuildEffectSummary(records) {
  elements.buildEffectSummary.replaceChildren();

  if (records.length === 0) {
    appendMutedMessage(
      elements.buildEffectSummary,
      "No focus, proc, or click effects equipped."
    );

    return;
  }

  const focusFamilies = new Set();
  const effectTypes = new Set();
  const exactEffects = [];

  for (const record of records) {
    for (
      const family
      of getRecordFocusEffects(record)
    ) {
      focusFamilies.add(family);
    }

    for (
      const effectType
      of getRecordEffectTypes(record)
    ) {
      effectTypes.add(effectType);
    }

    const exactEffect =
      combineValues(
        getField(record, "procClickFocus"),
        getField(
          record,
          "effectDescription"
        )
      );

    if (exactEffect) {
      exactEffects.push({
        itemName:
          getField(record, "itemName") ||
          "Unnamed item",

        effect: exactEffect
      });
    }
  }

  if (
    focusFamilies.size === 0 &&
    effectTypes.size === 0 &&
    exactEffects.length === 0
  ) {
    appendMutedMessage(
      elements.buildEffectSummary,
      "No focus, proc, or click effects equipped."
    );

    return;
  }

  if (effectTypes.size > 0) {
    appendSummaryValue(
      elements.buildEffectSummary,
      "Effect types",
      [...effectTypes]
        .sort(naturalCompare)
        .join(", ")
    );
  }

  if (focusFamilies.size > 0) {
    appendSummaryValue(
      elements.buildEffectSummary,
      "Focus families",
      [...focusFamilies]
        .sort(naturalCompare)
        .join(", ")
    );
  }

  if (exactEffects.length > 0) {
    const list =
      document.createElement("ul");

    list.className =
      "build-summary-list";

    for (const entry of exactEffects) {
      const listItem =
        document.createElement("li");

      const itemName =
        document.createElement("strong");

      const effect =
        document.createElement("span");

      itemName.textContent =
        `${entry.itemName}: `;

      effect.textContent =
        entry.effect;

      listItem.append(
        itemName,
        effect
      );

      list.append(listItem);
    }

    elements.buildEffectSummary.append(
      list
    );
  }
}

function renderBuildWeaponSummary() {
  elements.buildWeaponSummary.replaceChildren();

  const weaponSlotIds = [
    "primary",
    "secondary",
    "range"
  ];

  const weaponEntries = [];

  for (const plannerSlotId of weaponSlotIds) {
    const record = getEquippedRecord(
      state.build,
      plannerSlotId,
      state.recordsById
    );

    if (!record) {
      continue;
    }

    const weaponDisplay =
      getCompactWeaponDisplay(record);

    const weaponSkill =
      getWeaponSkill(record);

    if (
      !weaponDisplay &&
      !weaponSkill
    ) {
      continue;
    }

    weaponEntries.push({
      slotLabel:
        getPlannerSlotLabel(
          plannerSlotId
        ),

      itemName:
        getField(record, "itemName") ||
        "Unnamed item",

      weaponDisplay,
      weaponSkill
    });
  }

  const anyWeaponEntries = [];

  for (const plannerSlotId of [
    "any_1",
    "any_2"
  ]) {
    const record = getEquippedRecord(
      state.build,
      plannerSlotId,
      state.recordsById
    );

    if (!record) {
      continue;
    }

    const weaponDisplay =
      getCompactWeaponDisplay(record);

    if (!weaponDisplay) {
      continue;
    }

    anyWeaponEntries.push({
      slotLabel:
        getPlannerSlotLabel(
          plannerSlotId
        ),

      itemName:
        getField(record, "itemName") ||
        "Unnamed item",

      weaponDisplay
    });
  }

  if (
    weaponEntries.length === 0 &&
    anyWeaponEntries.length === 0
  ) {
    appendMutedMessage(
      elements.buildWeaponSummary,
      "No weapons equipped."
    );

    return;
  }

  const list =
    document.createElement("ul");

  list.className =
    "build-summary-list";

  for (const entry of weaponEntries) {
    const listItem =
      document.createElement("li");

    const slot =
      document.createElement("strong");

    const details =
      document.createElement("span");

    slot.textContent =
      `${entry.slotLabel}: `;

    details.textContent = [
      entry.itemName,
      entry.weaponDisplay,
      entry.weaponSkill
        ? `Skill: ${entry.weaponSkill}`
        : ""
    ]
      .filter(Boolean)
      .join(" — ");

    listItem.append(slot, details);
    list.append(listItem);
  }

  for (const entry of anyWeaponEntries) {
    const listItem =
      document.createElement("li");

    const slot =
      document.createElement("strong");

    const details =
      document.createElement("span");

    slot.textContent =
      `${entry.slotLabel}: `;

    details.textContent =
      `${entry.itemName} — ` +
      `${entry.weaponDisplay} ` +
      `(equipped for stats)`;

    listItem.append(slot, details);
    list.append(listItem);
  }

  elements.buildWeaponSummary.append(list);
}

function renderBuildVerificationSummary(
  records,
  diagnostics
) {
  elements.buildVerificationSummary.replaceChildren();

  if (
    records.length === 0 &&
    diagnostics.missingRecordCount === 0
  ) {
    appendMutedMessage(
      elements.buildVerificationSummary,
      "No equipped records to evaluate."
    );

    return;
  }

  const statusCounts = new Map();
  let quarantinedCount = 0;

  for (const record of records) {
    const status =
      getField(
        record,
        "verificationStatus"
      ) || "Status not recorded";

    statusCounts.set(
      status,
      (statusCounts.get(status) ?? 0) + 1
    );

    if (isQuarantined(record)) {
      quarantinedCount += 1;
    }
  }

  const list =
    document.createElement("ul");

  list.className =
    "build-summary-list";

  const sortedStatuses =
    [...statusCounts.entries()]
      .sort((left, right) =>
        naturalCompare(
          left[0],
          right[0]
        )
      );

  for (
    const [status, count]
    of sortedStatuses
  ) {
    const listItem =
      document.createElement("li");

    listItem.textContent =
      `${status}: ${count}`;

    list.append(listItem);
  }

  if (quarantinedCount > 0) {
    const listItem =
      document.createElement("li");

    listItem.className =
      "warning-message";

    listItem.textContent =
      `${quarantinedCount} quarantined ` +
      `record${quarantinedCount === 1 ? "" : "s"}`;

    list.append(listItem);
  }

  if (diagnostics.missingRecordCount > 0) {
    const listItem =
      document.createElement("li");

    listItem.className =
      "warning-message";

    listItem.textContent =
      `${diagnostics.missingRecordCount} saved ` +
      `record${diagnostics.missingRecordCount === 1 ? "" : "s"} ` +
      `missing from the current database`;

    list.append(listItem);
  }

  elements.buildVerificationSummary.append(
    list
  );
}

function appendSummaryValue(
  container,
  label,
  value
) {
  const paragraph =
    document.createElement("p");

  const labelElement =
    document.createElement("strong");

  const valueElement =
    document.createElement("span");

  labelElement.textContent =
    `${label}: `;

  valueElement.textContent = value;

  paragraph.append(
    labelElement,
    valueElement
  );

  container.append(paragraph);
}

function appendMutedMessage(
  container,
  message
) {
  const paragraph =
    document.createElement("p");

  paragraph.className =
    "muted-message";

  paragraph.textContent = message;

  container.append(paragraph);
}

function appendCell(
  row,
  value,
  className = ""
) {
  const cell =
    document.createElement("td");

  if (className) {
    cell.className = className;
  }

  cell.textContent =
    hasValue(value)
      ? String(value)
      : "—";

  row.append(cell);
}

function appendQuickField(
  container,
  label,
  value,
  className = ""
) {
  if (!hasValue(value)) {
    return;
  }

  const field =
    document.createElement("div");

  field.className = [
    "quick-field",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const term =
    document.createElement("strong");

  const description =
    document.createElement("span");

  term.textContent = label;
  description.textContent =
    String(value);

  field.append(term, description);
  container.append(field);
}

function appendExpandableSection(
  container,
  title,
  summary,
  fields
) {
  const populatedFields =
    fields.filter(([, value]) =>
      hasValue(value)
    );

  if (populatedFields.length === 0) {
    return;
  }

  const details =
    document.createElement("details");

  details.className =
    "detail-section";

  const summaryElement =
    document.createElement("summary");

  const titleElement =
    document.createElement("strong");

  const summaryText =
    document.createElement("span");

  titleElement.textContent = title;
  summaryText.textContent = summary;

  summaryElement.append(
    titleElement,
    summaryText
  );

  const content =
    document.createElement("div");

  content.className =
    "detail-section-content";

  for (
    const [label, value]
    of populatedFields
  ) {
    appendQuickField(
      content,
      label,
      value,
      "quick-field-wide"
    );
  }

  details.append(
    summaryElement,
    content
  );

  container.append(details);
}

function appendResearchSection(record) {
  const sourceLinks =
    getPreferredSourceLinks(record);

  const researchFields = [
    [
      "Verification status",
      getField(
        record,
        "verificationStatus"
      )
    ],
    [
      "Audit action",
      getField(record, "auditAction")
    ],
    [
      "Confidence",
      getField(record, "confidence")
    ],
    [
      "Target priority",
      getField(
        record,
        "targetPriority"
      )
    ],
    [
      "EQL evidence notes",
      getField(
        record,
        "eqlEvidenceNotes"
      )
    ],
    [
      "EQL change notes",
      getField(
        record,
        "eqlChangeNotes"
      )
    ],
    [
      "Research notes",
      getField(record, "researchNotes")
    ],
    [
      "Disagreement notes",
      getField(
        record,
        "disagreementNotes"
      )
    ],
    [
      "Source links",
      sourceLinks
    ],
    [
      "Record ID",
      getField(record, "recordId")
    ],
    [
      "Revision",
      getField(record, "revision")
    ],
    [
      "Approved",
      getField(record, "approved")
    ]
  ];

  appendExpandableSection(
    elements.itemDetailContent,
    "Research and Provenance",
    "Verification, source links, disagreements, and audit notes",
    researchFields
  );
}

function appendQuarantineWarning(container) {
  const warning =
    document.createElement("div");

  warning.className =
    "quarantine-warning";

  const heading =
    document.createElement("strong");

  const text =
    document.createElement("p");

  heading.textContent =
    "Quarantined research record";

  text.textContent =
    "This item may contain inherited, disputed, incomplete, or " +
    "unverified EQL information. Review its research notes before " +
    "using it as a definitive build recommendation.";

  warning.append(heading, text);
  container.append(warning);
}

function combineValues(...values) {
  return values
    .filter(value => hasValue(value))
    .map(value => String(value).trim())
    .filter(Boolean)
    .filter(
      (value, index, array) =>
        array.indexOf(value) === index
    )
    .join(" • ");
}

function resetFilters() {
  elements.search.value = "";
  elements.continent.value = "";
  elements.zone.value = "";
  elements.sourceNpc.value = "";
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

  state.selectedStats.clear();

  updateEffectFilterAvailability();
  applyCurrentFilters();
}

function updateCounts() {
  elements.fileCount.textContent =
    state.manifest?.files?.length ??
    state.diagnostics?.fileCount ??
    0;

  elements.recordCount.textContent =
    state.records.length;

  elements.matchCount.textContent =
    state.filteredRecords.length;

  elements.zoneCount.textContent =
    new Set(
      state.filteredRecords
        .map(record =>
          getField(record, "zone")
        )
        .filter(Boolean)
    ).size;
}

function renderDiagnostics() {
  elements.diagnostics.replaceChildren();

  if (!state.diagnostics) {
    appendMutedMessage(
      elements.diagnostics,
      "No diagnostics are available."
    );

    return;
  }

  const diagnosticFields = [
    [
      "CSV files processed",
      state.diagnostics.fileCount
    ],
    [
      "Rows loaded",
      state.diagnostics.rowCount
    ],
    [
      "Unique records",
      state.records.length
    ],
    [
      "Duplicate records resolved",
      state.diagnostics.duplicateCount
    ],
    [
      "Rows missing record IDs",
      state.diagnostics.missingRecordIdCount
    ],
    [
      "Rows with parsing warnings",
      state.diagnostics.warningCount
    ]
  ];

  const list =
    document.createElement("dl");

  list.className =
    "diagnostic-list";

  for (
    const [label, value]
    of diagnosticFields
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    const term =
      document.createElement("dt");

    const description =
      document.createElement("dd");

    term.textContent = label;
    description.textContent =
      String(value);

    list.append(
      term,
      description
    );
  }

  elements.diagnostics.append(list);

  if (
    Array.isArray(
      state.diagnostics.warnings
    ) &&
    state.diagnostics.warnings.length > 0
  ) {
    const warningHeading =
      document.createElement("h3");

    warningHeading.textContent =
      "Warnings";

    const warningList =
      document.createElement("ul");

    for (
      const warning
      of state.diagnostics.warnings
    ) {
      const item =
        document.createElement("li");

      item.textContent =
        typeof warning === "string"
          ? warning
          : JSON.stringify(warning);

      warningList.append(item);
    }

    elements.diagnostics.append(
      warningHeading,
      warningList
    );
  }
}

function handleGenericDialogBackdropClick(
  event
) {
  if (
    event.target instanceof HTMLDialogElement
  ) {
    event.target.close();

    if (
      event.target ===
      elements.equipSlotDialog
    ) {
      state.pendingEquipRecord = null;
      state.pendingReplace = null;
    }

    if (
      event.target ===
      elements.replaceItemDialog
    ) {
      state.pendingReplace = null;
    }

    if (
      event.target ===
      elements.equippedSlotDialog
    ) {
      state.selectedPlannerSlot = null;
    }
  }
}

function updateStatus(
  message,
  type = ""
) {
  elements.status.textContent = message;

  elements.status.className = [
    "status",
    type
  ]
    .filter(Boolean)
    .join(" ");
}

function displayFallbackError(message) {
  const paragraph =
    document.createElement("p");

  paragraph.style.padding = "1rem";
  paragraph.style.color = "crimson";
  paragraph.textContent = message;

  document.body.prepend(paragraph);
}
