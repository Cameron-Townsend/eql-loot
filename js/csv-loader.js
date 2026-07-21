"use strict";

/**
 * CSV loading and parsing utilities.
 *
 * This parser supports:
 * - quoted cells
 * - commas inside quoted cells
 * - escaped quotation marks
 * - Windows and Unix line endings
 * - UTF-8 byte-order marks
 */
export function parseCsv(csvText) {
  const text = csvText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows = [];

  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n" && !insideQuotes) {
      currentRow.push(currentCell);

      if (currentRow.some(cell => cell.trim() !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);

  if (currentRow.some(cell => cell.trim() !== "")) {
    rows.push(currentRow);
  }

  if (insideQuotes) {
    throw new Error("CSV contains an unclosed quoted cell.");
  }

  if (rows.length === 0) {
    return {
      headers: [],
      records: []
    };
  }

  const headers = rows[0].map(header => header.trim());

  const records = rows.slice(1).map((values, rowIndex) => {
    const record = {};

    headers.forEach((header, columnIndex) => {
      record[header] = values[columnIndex]?.trim() ?? "";
    });

    record.__sourceRow = rowIndex + 2;

    return record;
  });

  return {
    headers,
    records
  };
}

export async function loadManifest() {
  const url = `./data/manifest.json?v=${Date.now()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Manifest request failed with HTTP ${response.status}.`
    );
  }

  const manifest = await response.json();

  if (!Array.isArray(manifest.files)) {
    throw new Error(
      "The generated manifest does not contain a files array."
    );
  }

  return manifest;
}

export async function loadCsvFile(fileEntry) {
  const response = await fetch(`./${fileEntry.path}`);

  if (!response.ok) {
    throw new Error(
      `${fileEntry.filename} returned HTTP ${response.status}.`
    );
  }

  const csvText = await response.text();
  const parsed = parseCsv(csvText);

  const records = parsed.records.map(record => ({
    ...record,

    __sourceFile: fileEntry.filename,
    __sourcePath: fileEntry.path
  }));

  return {
    file: fileEntry,
    headers: parsed.headers,
    records
  };
}

export async function loadAllCsvFiles(manifest) {
  const results = [];

  for (const file of manifest.files) {
    try {
      const result = await loadCsvFile(file);

      results.push({
        ...result,
        loaded: true,
        error: null
      });
    } catch (error) {
      console.error(error);

      results.push({
        file,
        headers: [],
        records: [],
        loaded: false,
        error: error.message
      });
    }
  }

  return results;
}
