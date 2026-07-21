"use strict";

import {
  loadAllCsvFiles,
  loadManifest
} from "./csv-loader.js";

import {
  buildDatabase,
  getPreferredClasses,
  getPreferredNpcLevel,
  getPreferredStats,
  isApproved,
  naturalCompare
} from "./database.js";

import {
  createFilterOptions,
  filterRecords,
  getZoneSummary
} from "./filters.js";

const state = {
  manifest: null,
  records: [],
  filteredRecords: [],
  diagnostics: null
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

    populateFilters(
      createFilterOptions(state.records)
    );

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

  elements.resetButton =
    document.querySelector("#reset-filters");

  elements.resultsBody =
    document.querySelector("#results-body");

  elements.zoneSummaryBody =
    document.querySelector("#zone-summary-body");

  elements.diagnostics =
    document.querySelector("#diagnostics");
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
    elements.approvedOnly
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
    approvedOnly: elements.approvedOnly.checked
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

    appendCell(row, record.item_name, "item-name");
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

function appendCell(row, value, className = "") {
  const cell = document.createElement("td");

  cell.textContent = value || "—";

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

  applyCurrentFilters();
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
