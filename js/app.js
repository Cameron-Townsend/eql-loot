"use strict";

import {
  loadAllCsvFiles,
  loadManifest
} from "./csv-loader.js";

import {
  buildDatabase,
  getPreferredClasses,
  getPreferredNpcLevel,
  getPreferredRaces,
  getPreferredStats,
  isApproved,
  naturalCompare
} from "./database.js";

import {
  createFilterOptions,
  filterRecords,
  getRecordStats,
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

document.addEventListener("DOMContentLoaded", initialize);

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
        record.record_id,
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

  elements.verification =
    document.querySelector("#verification-filter");

  elements.confidence =
    document.querySelector("#confidence-filter");

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
    elements.verification,
    elements.confidence,
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
    elements.verification,
    options.verificationStatuses,
    "All verification statuses"
  );

  populateSelect(
    elements.confidence,
    options.confidenceLevels,
    "All confidence levels"
  );
}

function populateSelect(select, values, defaultLabel) {
  select.replaceChildren();

  const defaultOption = document.createElement("option");

  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;

  select.append(defaultOption);

  for (const value of values) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.append(option);
  }
}

function renderStatOptions(stats) {
  elements.statOptions.replaceChildren();

  if (stats.length === 0) {
    const message = document.createElement("p");

    message.className = "muted-message";
    message.textContent =
      "No recognized stat values were found in the database.";

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
    verification: elements.verification.value,
    confidence: elements.confidence.value,
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

  renderResults();
  renderZoneSummary();
  updateCounts();
}

function renderResults() {
  elements.resultsBody.replaceChildren();

  const maximumRows = 500;

  const displayedRecords =
    state.filteredRecords.slice(0, maximumRows);

  for (const record of displayedRecords) {
    const row = document.createElement("tr");

    const itemCell = document.createElement("td");
    const itemButton = document.createElement("button");

    itemButton.type = "button";
    itemButton.className = "item-link-button";
    itemButton.dataset.recordId = record.record_id;
    itemButton.textContent =
      record.item_name || "Unnamed item";

    itemCell.className = "item-name";
    itemCell.append(itemButton);
    row.append(itemCell);

    appendCell(row, record.slot);
    appendCell(row, record.zone);
    appendCell(row, record.source_npc);
    appendCell(row, getPreferredNpcLevel(record));
    appendCell(row, getPreferredClasses(record));
    appendCell(row, getPreferredStats(record));
    appendCell(row, record.eql_verification_status);
    appendCell(row, record.data_confidence);
    appendCell(row, isApproved(record) ? "Yes" : "No");

    elements.resultsBody.append(row);
  }

  if (displayedRecords.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 10;
    cell.textContent =
      "No loot records match the active filters.";

    row.append(cell);
    elements.resultsBody.append(row);
  }
}

function renderZoneSummary() {
  const summaries = getZoneSummary(
    state.filteredRecords
  );

  elements.zoneSummaryBody.replaceChildren();

  for (const summary of summaries) {
    const row = document.createElement("tr");

    appendCell(row, summary.zone);
    appendCell(row, summary.itemCount);
    appendCell(row, summary.slotCount);
    appendCell(row, summary.confirmedCount);

    elements.zoneSummaryBody.append(row);
  }

  if (summaries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.textContent =
      "No zones match the active filters.";

    row.append(cell);
    elements.zoneSummaryBody.append(row);
  }
}

function handleResultClick(event) {
  const button = event.target.closest(
    "button[data-record-id]"
  );

  if (!button) {
    return;
  }

  const record =
    state.recordsById.get(button.dataset.recordId);

  if (!record) {
    return;
  }

  openItemDetails(record);
}

function openItemDetails(record) {
  const preferredStats =
    getPreferredStats(record) || "No stats listed";

  const preferredClasses =
    getPreferredClasses(record) || "Not listed";

  const preferredRaces =
    getPreferredRaces(record) || "Not listed";

  const preferredNpcLevel =
    getPreferredNpcLevel(record) || "Unknown";

  elements.detailItemName.textContent =
    record.item_name || "Unnamed item";

  elements.detailItemSubtitle.textContent = [
    record.item_category,
    record.slot,
    record.zone
  ]
    .filter(Boolean)
    .join(" • ");

  elements.itemDetailContent.replaceChildren();

  const summaryCard = document.createElement("section");
  summaryCard.className = "quick-detail-card";

  appendQuickField(
    summaryCard,
    "Stats",
    preferredStats,
    "quick-field-wide"
  );

  appendQuickField(
    summaryCard,
    "Classes",
    preferredClasses
  );

  appendQuickField(
    summaryCard,
    "Races",
    preferredRaces
  );

  appendQuickField(
    summaryCard,
    "Zone",
    record.zone
  );

  appendQuickField(
    summaryCard,
    "Dropped by",
    record.source_npc
  );

  appendQuickField(
    summaryCard,
    "NPC level",
    preferredNpcLevel
  );

  appendQuickField(
    summaryCard,
    "Drop frequency",
    firstPopulatedValue(
      record.drop_frequency,
      record.reported_drop_rate
    )
  );

  appendQuickField(
    summaryCard,
    "Respawn",
    record.respawn_timer
  );

  appendQuickField(
    summaryCard,
    "Effect",
    firstPopulatedValue(
      record.proc_click_focus,
      record.effect_name,
      record.effect_description
    ),
    "quick-field-wide"
  );

  appendQuickField(
    summaryCard,
    "Verification",
    combineValues(
      record.eql_verification_status,
      record.data_confidence
    ),
    "quick-field-wide"
  );

  elements.itemDetailContent.append(summaryCard);

  const detailsDrawer = document.createElement("details");
  detailsDrawer.className = "advanced-detail-drawer";

  const drawerSummary = document.createElement("summary");
  const drawerLabel = document.createElement("span");
  const drawerHint = document.createElement("span");

  drawerLabel.className = "drawer-label";
  drawerLabel.textContent = "More details";

  drawerHint.className = "drawer-hint";
  drawerHint.textContent =
    "Classic comparison, spawn information, notes, audit data, and sources";

  drawerSummary.append(drawerLabel, drawerHint);
  detailsDrawer.append(drawerSummary);

  const drawerContent = document.createElement("div");
  drawerContent.className = "advanced-detail-content";

  detailsDrawer.append(drawerContent);
  elements.itemDetailContent.append(detailsDrawer);

  appendDetailSectionTo(
    drawerContent,
    "Item information",
    [
      ["Record ID", record.record_id],
      ["Batch", record.batch],
      ["Continent", record.continent],
      ["Category", record.item_category],
      ["Slot", record.slot],
      ["Recognized stats", getRecordStats(record).join(", ")],
      ["Equippable", record.equippable],
      ["Inventory only", record.inventory_only],
      ["Magic", record.magic],
      ["Lore", record.lore],
      ["No Drop", record.no_drop],
      ["Quest item", record.quest_item],
      ["Size", record.size],
      ["Weight", record.weight],
      ["Damage", record.damage],
      ["Delay", record.delay],
      ["Weapon skill", record.weapon_skill]
    ]
  );

  appendDetailSectionTo(
    drawerContent,
    "EQL item data",
    [
      ["EQL stats", record.stats_eql],
      ["EQL classes", record.classes_eql],
      ["EQL races", record.races_eql],
      ["Proc / click / focus", record.proc_click_focus],
      ["Effect name", record.effect_name],
      ["Effect description", record.effect_description]
    ]
  );

  appendDetailSectionTo(
    drawerContent,
    "Classic comparison",
    [
      ["Classic stats", record.stats_classic],
      ["Classic classes", record.classes_classic],
      ["Classic races", record.races_classic],
      ["EQL stats match", record.eql_stats_match],
      ["EQL classes match", record.eql_classes_match],
      ["EQL races match", record.eql_races_match],
      ["EQL effect match", record.eql_effect_match],
      ["EQL changes", record.eql_changes_summary]
    ]
  );

  appendDetailSectionTo(
    drawerContent,
    "Spawn and drop details",
    [
      ["EQL NPC level", record.source_npc_level_eql],
      ["Classic NPC level", record.source_npc_level_classic],
      ["NPC class", record.source_npc_class],
      ["NPC race/type", record.source_npc_race_type],
      ["Spawn location", record.spawn_location],
      ["Spawn type", record.spawn_type],
      ["Placeholder", record.placeholder],
      ["Placeholder levels", record.placeholder_level_range],
      ["Nearby enemy levels", record.nearby_enemy_level_range],
      ["Respawn timer", record.respawn_timer],
      ["Drop frequency", record.drop_frequency],
      ["Reported drop rate", record.reported_drop_rate],
      ["Time condition", record.time_condition],
      ["Special abilities", record.special_abilities],
      ["Social/add risk", record.social_add_risk],
      ["Faction consequences", record.faction_consequences],
      ["Drop notes", record.drop_notes]
    ]
  );

  appendDetailSectionTo(
    drawerContent,
    "Recommended use",
    [
      ["Best for classes", record.best_for_classes],
      ["Best for archetypes", record.best_for_archetypes],
      ["Target priority", record.target_priority],
      ["General value", record.general_value_notes],
      ["Personal build notes", record.personal_build_notes]
    ]
  );

  appendDetailSectionTo(
    drawerContent,
    "Audit information",
    [
      ["Verification status", record.eql_verification_status],
      ["Data confidence", record.data_confidence],
      ["Audit action", record.eql_audit_action],
      ["EQL item confirmed", record.eql_item_confirmed],
      ["EQL NPC confirmed", record.eql_npc_confirmed],
      [
        "Drop source confirmed",
        record.eql_drop_source_confirmed
      ],
      ["Spawn confirmed", record.eql_spawn_match],
      ["Verification notes", record.eql_verification_notes],
      ["Last checked", record.last_checked],
      ["Approved", record.approved],
      ["Revision", record.revision],
      ["Source file", record.__sourceFile]
    ]
  );

  appendSourceSectionTo(drawerContent, record);

  elements.itemDialog.showModal();
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

  const field = document.createElement("div");
  const term = document.createElement("span");
  const content = document.createElement("strong");

  field.className = "quick-field";

  if (className) {
    field.classList.add(className);
  }

  term.textContent = label;
  content.textContent = String(value).trim();

  field.append(term, content);
  container.append(field);
}

function appendDetailSectionTo(
  container,
  title,
  fields
) {
  const populatedFields = fields.filter(
    ([, value]) => hasValue(value)
  );

  if (populatedFields.length === 0) {
    return;
  }

  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const grid = document.createElement("dl");

  section.className = "detail-section";
  heading.textContent = title;
  grid.className = "detail-grid";

  for (const [label, value] of populatedFields) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = String(value).trim();

    item.append(term, description);
    grid.append(item);
  }

  section.append(heading, grid);
  container.append(section);
}

function appendSourceSectionTo(container, record) {
  const sourceFields = [
    ["EQL source", record.eql_source_url],
    ["EQL Wiki", record.eql_wiki_url],
    ["Classic source", record.classic_source_url],
    ["Project 1999", record.project1999_url],
    ["Item source", record.item_url],
    ["NPC source", record.npc_url]
  ];

  const validSources = sourceFields.filter(
    ([, value]) => isSafeHttpUrl(value)
  );

  if (validSources.length === 0) {
    return;
  }

  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const links = document.createElement("div");

  section.className = "detail-section";
  heading.textContent = "Sources";
  links.className = "source-links";

  for (const [label, value] of validSources) {
    const link = document.createElement("a");

    link.href = value;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;

    links.append(link);
  }

  section.append(heading, links);
  container.append(section);
}

function firstPopulatedValue(...values) {
  return values.find(value => hasValue(value)) ?? "";
}

function combineValues(...values) {
  return values
    .filter(value => hasValue(value))
    .map(value => String(value).trim())
    .join(" • ");
}

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}

function closeItemDetails() {
  elements.itemDialog.close();
}

function handleDialogBackdropClick(event) {
  if (event.target === elements.itemDialog) {
    closeItemDetails();
  }
}

function appendCell(row, value, className = "") {
  const cell = document.createElement("td");

  cell.textContent = hasValue(value)
    ? String(value)
    : "—";

  if (className) {
    cell.className = className;
  }

  row.append(cell);
}

function updateCounts() {
  const zones = new Set(
    state.filteredRecords
      .map(record => record.zone)
      .filter(Boolean)
  );

  elements.fileCount.textContent =
    String(state.manifest?.fileCount ?? 0);

  elements.recordCount.textContent =
    String(state.records.length);

  elements.matchCount.textContent =
    String(state.filteredRecords.length);

  elements.zoneCount.textContent =
    String(zones.size);
}

function renderDiagnostics() {
  const diagnostics = state.diagnostics;

  elements.diagnostics.replaceChildren();

  appendDiagnostic(
    `Files discovered: ${diagnostics.filesDiscovered}`
  );

  appendDiagnostic(
    `Files loaded: ${diagnostics.filesLoaded}`
  );

  appendDiagnostic(
    `Files failed: ${diagnostics.filesFailed}`
  );

  appendDiagnostic(
    `Raw records: ${diagnostics.rawRecords}`
  );

  appendDiagnostic(
    `Unique records: ${diagnostics.uniqueRecords}`
  );

  appendDiagnostic(
    `Duplicate record IDs: ${
      diagnostics.duplicateRecords.length
    }`
  );

  appendDiagnostic(
    `Malformed records: ${
      diagnostics.malformedRecords.length
    }`
  );

  appendDiagnostic(
    `Files missing required columns: ${
      diagnostics.missingRequiredColumns.length
    }`
  );

  for (
    const problem
    of diagnostics.missingRequiredColumns
  ) {
    appendDiagnostic(
      `${problem.file}: missing ${problem.columns.join(", ")}`,
      "warning"
    );
  }

  for (const error of diagnostics.fileErrors) {
    appendDiagnostic(
      `${error.file}: ${error.error}`,
      "error"
    );
  }
}

function appendDiagnostic(text, className = "") {
  const paragraph = document.createElement("p");

  paragraph.textContent = text;

  if (className) {
    paragraph.className = className;
  }

  elements.diagnostics.append(paragraph);
}

function resetFilters() {
  elements.search.value = "";
  elements.continent.value = "";
  elements.zone.value = "";
  elements.category.value = "";
  elements.slot.value = "";
  elements.className.value = "";
  elements.verification.value = "";
  elements.confidence.value = "";
  elements.approvedOnly.checked = true;
  elements.statMode.value = "all";

  clearStatFilters();
}

function updateStatus(message, statusType = "") {
  elements.status.textContent = message;
  elements.status.className = "status";

  if (statusType) {
    elements.status.classList.add(statusType);
  }
}

function displayFallbackError(message) {
  const errorBox = document.createElement("p");

  errorBox.className = "fallback-error";
  errorBox.textContent = message;

  document.body.prepend(errorBox);
}

function isSafeHttpUrl(value) {
  if (!hasValue(value)) {
    return false;
  }

  try {
    const url = new URL(String(value).trim());

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}
