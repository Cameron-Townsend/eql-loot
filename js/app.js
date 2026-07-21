"use strict";

const elements = {
  status: document.querySelector("#status"),
  fileCount: document.querySelector("#file-count"),
  recordCount: document.querySelector("#record-count"),
  generatedAt: document.querySelector("#generated-at"),
  fileList: document.querySelector("#file-list")
};

async function loadManifest() {
  try {
    /*
     * The timestamp discourages the browser from using
     * an older cached manifest after a deployment.
     */
    const manifestUrl =
      `./data/manifest.json?v=${Date.now()}`;

    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(
        `Manifest request returned HTTP ${response.status}.`
      );
    }

    const manifest = await response.json();

    if (!Array.isArray(manifest.files)) {
      throw new Error(
        "Manifest does not contain a valid files array."
      );
    }

    renderManifest(manifest);
  } catch (error) {
    console.error(error);

    elements.status.textContent =
      `Database could not be loaded: ${error.message}`;
  }
}

function renderManifest(manifest) {
  elements.status.textContent =
    "Manifest loaded successfully.";

  elements.fileCount.textContent =
    manifest.fileCount ?? manifest.files.length;

  elements.recordCount.textContent =
    manifest.totalDeclaredRecords ?? 0;

  elements.generatedAt.textContent =
    formatDate(manifest.generatedAt);

  elements.fileList.replaceChildren();

  if (manifest.files.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No CSV files were discovered.";
    elements.fileList.append(item);
    return;
  }

  for (const file of manifest.files) {
    const item = document.createElement("li");

    item.textContent =
      `${file.filename} — ` +
      `${file.recordCount.toLocaleString()} records`;

    elements.fileList.append(item);
  }
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

loadManifest();
