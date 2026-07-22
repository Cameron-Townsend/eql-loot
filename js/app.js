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
      getPreferredStats(record)
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
      getField(record, "verificationStatus")
    );

    appendCell(
      row,
      getField(record, "confidence")
    );

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

function appendBadgeCell(row, status) {
  const cell = document.createElement("td");
  const badge = createVerificationBadge(status);

  cell.append(badge);
  row.append(cell);
}

function createVerificationBadge(status) {
  const badge = document.createElement("span");

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
  const itemName =
    getField(record, "itemName") ||
    "Unnamed item";

  const category =
    getField(record, "itemCategory");

  const slot =
    getField(record, "slot");

  elements.detailItemName.textContent = itemName;

  elements.detailItemSubtitle.textContent = [
    slot,
    category,
    getField(record, "zone")
  ]
    .filter(Boolean)
    .join(" • ");

  elements.itemDetailContent.replaceChildren();

  const statusRow = document.createElement("div");
  statusRow.className = "popup-status-row";

  statusRow.append(
    createVerificationBadge(
      getField(record, "verificationStatus")
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

  elements.itemDetailContent.append(statusRow);

  if (isQuarantined(record)) {
    appendQuarantineWarning(
      elements.itemDetailContent
    );
  }

  const quickCard =
    document.createElement("section");

  quickCard.className = "quick-detail-card";

  appendQuickField(
    quickCard,
    "Slot and category",
    combineValues(slot, category)
  );

  appendQuickField(
    quickCard,
    "EQL stats",
    getPreferredStats(record),
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
    combineValues(
      getField(record, "procClickFocus"),
      getField(record, "effectDescription")
    ),
    "quick-field-wide"
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

  elements.itemDetailContent.append(quickCard);

  appendExpandableSection(
    elements.itemDetailContent,
    "Drop Details",
    "Spawn behavior, hazards, and drop information",
    [
      ["Placeholder", getField(record, "placeholder")],
      [
        "Placeholder level range",
        getField(record, "placeholderLevelRange")
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
        getField(record, "nearbyEnemyLevelRange")
      ],
      [
        "Spawn type",
        getField(record, "spawnType")
      ],
      [
        "Special abilities",
        getField(record, "specialAbilities")
      ],
      [
        "Add risk",
        getField(record, "socialAddRisk")
      ],
      [
        "Faction consequences",
        getField(record, "factionConsequences")
      ],
      [
        "Drop-rate notes",
        combineValues(
          getField(record, "dropRateReported"),
          getField(record, "dropNotes")
        )
      ]
    ]
  );

  appendExpandableSection(
    elements.itemDetailContent,
    "EQL Mechanics",
    "Transfer, extraction, upgrading, and observed mechanics",
    [
      [
        "Effect-transfer value",
        getField(record, "effectTransferValue")
      ],
      [
        "Effect extractable",
        getField(record, "effectExtractable")
      ],
      [
        "Effect extraction rank",
        getField(record, "effectExtractionRank")
      ],
      [
        "Upgradeable",
        getField(record, "upgradeable")
      ],
      [
        "Maximum upgrade rank",
        getField(record, "maximumUpgradeRank")
      ],
      [
        "Duplicate-farming value",
        getField(record, "duplicateFarmingValue")
      ],
      [
        "Challenge tier observed",
        getField(record, "challengeTierObserved")
      ],
      [
        "Personal loot confirmed",
        getField(record, "personalLootConfirmed")
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
        getField(record, "classesClassic")
      ],
      [
        "Classic races",
        getField(record, "racesClassic")
      ],
      [
        "Classic NPC level",
        getField(record, "sourceNpcLevelClassic")
      ],
      [
        "Era status",
        getField(record, "eraStatus")
      ],
      [
        "Classic baseline notes",
        getField(record, "classicBaselineNotes")
      ]
    ]
  );

  appendResearchSection(record);

  elements.itemDialog.showModal();
}

function appendQuarantineWarning(container) {
  const warning = document.createElement("aside");

  warning.className = "quarantine-warning";

  const heading = document.createElement("strong");
  const body = document.createElement("p");

  heading.textContent =
    "Quarantined research record";

  body.textContent =
    "This item or drop source is retained as classic or investigative " +
    "research, but it is not currently confirmed for EverQuest Legends.";

  warning.append(heading, body);
  container.append(warning);
}

function appendResearchSection(record) {
  const fields = [
    [
      "Last checked",
      getField(record, "eqlLastChecked")
    ],
    [
      "Official patch date",
      getField(record, "officialPatchDate")
    ],
    [
      "Evidence strength",
      getField(record, "evidenceStrength")
    ],
    [
      "Current-build confirmed",
      getField(record, "currentBuildConfirmed")
    ],
    [
      "Conflict status",
      getField(record, "conflictStatus")
    ],
    [
      "Audit action",
      getField(record, "auditAction")
    ],
    [
      "Change summary",
      getField(record, "eqlChangesSummary")
    ],
    [
      "Verification notes",
      getField(record, "eqlVerificationNotes")
    ],
    [
      "Research notes",
      getField(record, "researchNotes")
    ],
    [
      "Revision",
      getField(record, "revision")
    ],
    [
      "Approved",
      getField(record, "approved")
    ],
    [
      "Source file",
      record.__sourceFile
    ]
  ];

  const links =
    getPreferredSourceLinks(record);

  const evidenceCount =
    record.__evidence?.length ?? 0;

  const historyCount =
    record.__changeHistory?.length ?? 0;

  if (evidenceCount > 0) {
    fields.push([
      "Attached evidence records",
      String(evidenceCount)
    ]);
  }

  if (historyCount > 0) {
    fields.push([
      "Attached change-history records",
      String(historyCount)
    ]);
  }

  appendExpandableSection(
    elements.itemDetailContent,
    "Research & Sources",
    "Verification, conflicts, provenance, and research notes",
    fields,
    links
  );
}

function appendExpandableSection(
  container,
  title,
  hint,
  fields,
  links = []
) {
  const populatedFields = fields.filter(
    ([, value]) => hasValue(value)
  );

  if (
    populatedFields.length === 0 &&
    links.length === 0
  ) {
    return;
  }

  const drawer = document.createElement("details");

  drawer.className = "advanced-detail-drawer";

  const summary = document.createElement("summary");
  const label = document.createElement("span");
  const hintElement = document.createElement("span");

  label.className = "drawer-label";
  label.textContent = title;

  hintElement.className = "drawer-hint";
  hintElement.textContent = hint;

  summary.append(label, hintElement);
  drawer.append(summary);

  const content = document.createElement("div");

  content.className = "advanced-detail-content";

  if (populatedFields.length > 0) {
    const grid = document.createElement("dl");

    grid.className = "detail-grid";

    for (const [fieldLabel, value] of populatedFields) {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = fieldLabel;
      description.textContent = value;

      item.append(term, description);
      grid.append(item);
    }

    content.append(grid);
  }

  if (links.length > 0) {
    const sourceHeading = document.createElement("h3");
    const sourceLinks = document.createElement("div");

    sourceHeading.textContent = "Source links";
    sourceLinks.className = "source-links";

    for (const linkData of links) {
      const link = document.createElement("a");

      link.href = linkData.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = linkData.label;

      sourceLinks.append(link);
    }

    content.append(
      sourceHeading,
      sourceLinks
    );
  }

  drawer.append(content);
  container.append(drawer);
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
  content.textContent = value;

  field.append(term, content);
  container.append(field);
}

function combineValues(...values) {
  return values
    .filter(value => hasValue(value))
    .map(value => String(value).trim())
    .join(" • ");
}

function closeItemDetails() {
  elements.itemDialog.close();
}

function handleDialogBackdropClick(event) {
  if (event.target === elements.itemDialog) {
    closeItemDetails();
  }
}

function appendCell(
  row,
  value,
  className = ""
) {
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
      .map(record =>
        getField(record, "zone")
      )
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
    `Loot files: ${diagnostics.lootFiles}`
  );

  appendDiagnostic(
    `Evidence files attached: ${diagnostics.evidenceFiles}`
  );

  appendDiagnostic(
    `Change-history files attached: ${diagnostics.historyFiles}`
  );

  appendDiagnostic(
    `Unknown datasets ignored: ${diagnostics.unknownFiles}`
  );

  appendDiagnostic(
    `Files failed: ${diagnostics.filesFailed}`
  );

  appendDiagnostic(
    `Raw loot records: ${diagnostics.rawLootRecords}`
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
    `Loot files missing required columns: ${
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

function appendDiagnostic(
  text,
  className = ""
) {
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
  elements.race.value = "";
  elements.minimumNpcLevel.value = "";
  elements.maximumNpcLevel.value = "";
  elements.magic.value = "";
  elements.lore.value = "";
  elements.noDrop.value = "";
  elements.questItem.value = "";
  elements.inventoryOnly.value = "";
  elements.effectPresent.value = "";
  elements.effectTransfer.value = "";
  elements.verification.value = "";
  elements.auditAction.value = "";
  elements.confidence.value = "";
  elements.targetPriority.value = "";
  elements.approvedOnly.checked = false;
  elements.statMode.value = "all";

  clearStatFilters();
}

function updateStatus(
  message,
  statusType = ""
) {
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
