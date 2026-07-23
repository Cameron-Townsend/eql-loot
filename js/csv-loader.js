"use strict";

/**
 * EverQuest Legends Loot Explorer
 * CSV discovery, fetching, and parsing utilities
 *
 * Supported behavior:
 * - Generated repository manifest
 * - Multiple CSV files with different schemas
 * - UTF-8 byte-order marks
 * - Quoted cells
 * - Commas inside quoted cells
 * - Escaped quotation marks
 * - Embedded line breaks inside quoted cells
 * - Windows, Unix, and older Mac line endings
 * - Blank-value preservation
 * - Duplicate-header detection
 * - Blank-header detection
 * - Malformed row-width warnings
 * - Preservation of excess trailing cells
 * - Per-file fetch and parser isolation
 * - Stable deterministic result ordering
 */

const MANIFEST_URL =
  "./data/manifest.json";

const EXTRA_COLUMNS_FIELD =
  "__extraColumns";

/**
 * Parse CSV text into headers, records, and parser warnings.
 *
 * This parser does not rely on fixed column positions between files.
 * Each physical CSV uses its own header row.
 *
 * Unknown named columns remain normal properties on each record.
 *
 * Rows shorter or longer than the header are retained, but a warning is
 * generated. Excess unnamed cells are preserved in __extraColumns.
 *
 * Fatal parser problems such as duplicate headers, blank headers, or an
 * unclosed quoted cell throw an error. loadAllCsvFiles() isolates that
 * failure to the affected file.
 */
export function parseCsv(
  csvText,
  options = {}
) {
  const sourceName =
    normalizeText(options.sourceName) ||
    "CSV file";

  const text = normalizeCsvText(csvText);

  const parsedRows =
    parseCsvRows(text, sourceName);

  if (parsedRows.length === 0) {
    return {
      headers: [],
      records: [],
      warnings: [],
      rowCount: 0
    };
  }

  const rawHeaders =
    parsedRows[0].values;

  const headers =
    prepareHeaders(
      rawHeaders,
      sourceName
    );

  const warnings = [];
  const records = [];

  for (
    let index = 1;
    index < parsedRows.length;
    index += 1
  ) {
    const parsedRow =
      parsedRows[index];

    const values =
      parsedRow.values;

    const sourceRow =
      parsedRow.startLine;

    if (isBlankRow(values)) {
      continue;
    }

    const record = {};

    for (
      let columnIndex = 0;
      columnIndex < headers.length;
      columnIndex += 1
    ) {
      const header =
        headers[columnIndex];

      record[header] =
        normalizeCellValue(
          values[columnIndex]
        );
    }

    record.__sourceRow =
      sourceRow;

    if (
      values.length <
      headers.length
    ) {
      warnings.push({
        type: "short-row",
        sourceRow,
        expectedColumns:
          headers.length,
        actualColumns:
          values.length,

        message:
          `${sourceName}, row ${sourceRow}: ` +
          `expected ${headers.length} columns but found ` +
          `${values.length}. Missing values were left blank.`
      });
    }

    if (
      values.length >
      headers.length
    ) {
      const extraValues =
        values
          .slice(headers.length)
          .map(normalizeCellValue);

      record[EXTRA_COLUMNS_FIELD] =
        extraValues;

      warnings.push({
        type: "long-row",
        sourceRow,
        expectedColumns:
          headers.length,
        actualColumns:
          values.length,
        extraColumnCount:
          extraValues.length,

        message:
          `${sourceName}, row ${sourceRow}: ` +
          `expected ${headers.length} columns but found ` +
          `${values.length}. Extra values were preserved in ` +
          `${EXTRA_COLUMNS_FIELD}.`
      });
    }

    records.push(record);
  }

  return {
    headers,
    records,
    warnings,
    rowCount: records.length
  };
}

/**
 * Load the generated static CSV manifest.
 *
 * The timestamp query prevents an older cached manifest from hiding newly
 * uploaded CSV files after a GitHub Pages deployment.
 */
export async function loadManifest() {
  const manifestUrl =
    appendCacheBuster(
      MANIFEST_URL
    );

  let response;

  try {
    response = await fetch(
      manifestUrl,
      {
        cache: "no-store"
      }
    );
  } catch (error) {
    throw new Error(
      "The CSV manifest could not be requested. " +
      formatErrorMessage(error)
    );
  }

  if (!response.ok) {
    throw new Error(
      "Manifest request failed with HTTP " +
      `${response.status} ${response.statusText}.`
    );
  }

  let manifest;

  try {
    manifest =
      await response.json();
  } catch (error) {
    throw new Error(
      "The generated CSV manifest is not valid JSON. " +
      formatErrorMessage(error)
    );
  }

  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    throw new Error(
      "The generated CSV manifest must contain a JSON object."
    );
  }

  if (!Array.isArray(manifest.files)) {
    throw new Error(
      "The generated manifest does not contain a files array."
    );
  }

  const files =
    manifest.files.map(
      (fileEntry, index) =>
        prepareManifestFileEntry(
          fileEntry,
          index
        )
    );

  return {
    ...manifest,
    files
  };
}

/**
 * Fetch and parse one CSV file.
 *
 * Failure is allowed to propagate to loadAllCsvFiles(), which converts it
 * into a failed file result without stopping other files.
 */
export async function loadCsvFile(
  fileEntry
) {
  const preparedFile =
    prepareManifestFileEntry(
      fileEntry,
      fileEntry?.__manifestIndex ?? 0
    );

  const fileUrl =
    appendCacheBuster(
      `./${preparedFile.path}`
    );

  let response;

  try {
    response = await fetch(
      fileUrl,
      {
        cache: "no-store"
      }
    );
  } catch (error) {
    throw new Error(
      `${preparedFile.filename} could not be requested. ` +
      formatErrorMessage(error)
    );
  }

  if (!response.ok) {
    throw new Error(
      `${preparedFile.filename} returned HTTP ` +
      `${response.status} ${response.statusText}.`
    );
  }

  let csvText;

  try {
    csvText =
      await response.text();
  } catch (error) {
    throw new Error(
      `${preparedFile.filename} could not be read. ` +
      formatErrorMessage(error)
    );
  }

  const parsed = parseCsv(
    csvText,
    {
      sourceName:
        preparedFile.filename
    }
  );

  const records =
    parsed.records.map(
      (record, recordIndex) => ({
        ...record,

        __sourceFile:
          preparedFile.filename,

        __sourcePath:
          preparedFile.path,

        __manifestIndex:
          preparedFile.__manifestIndex,

        /*
         * Preserve a deterministic row-order value even if a future parser
         * warning or unusual multiline record affects physical line numbers.
         */
        __recordIndex:
          recordIndex
      })
    );

  return {
    file: preparedFile,
    headers: parsed.headers,
    records,
    warnings: parsed.warnings,
    rowCount: parsed.rowCount
  };
}

/**
 * Fetch and parse all manifest CSV files.
 *
 * All requests begin without waiting for the previous file to finish.
 * Promise.all preserves the order of the task array even when individual
 * network requests finish in a different order.
 *
 * Each task catches its own error, so one unavailable or malformed CSV does
 * not prevent all other valid CSV files from loading.
 */
export async function loadAllCsvFiles(
  manifest
) {
  if (
    !manifest ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error(
      "CSV loading requires a valid manifest files array."
    );
  }

  /*
   * Use deterministic natural ordering for diagnostics and future
   * tie-breaking. Canonical correction resolution must still remain
   * independent of this ordering.
   */
  const sortedFiles =
    manifest.files
      .map(
        (fileEntry, index) =>
          prepareManifestFileEntry(
            fileEntry,
            fileEntry?.__manifestIndex ??
              index
          )
      )
      .sort(compareManifestEntries);

  const tasks =
    sortedFiles.map(
      async file => {
        try {
          const result =
            await loadCsvFile(file);

          return {
            ...result,
            loaded: true,
            error: null
          };
        } catch (error) {
          console.error(error);

          return {
            file,
            headers: [],
            records: [],
            warnings: [],
            rowCount: 0,
            loaded: false,
            error:
              formatErrorMessage(error)
          };
        }
      }
    );

  return Promise.all(tasks);
}

/**
 * Convert physical CSV text into rows while retaining the physical line on
 * which each logical row began.
 *
 * A quoted field may contain line breaks. In that case one logical CSV row
 * can span multiple physical lines.
 */
function parseCsvRows(
  text,
  sourceName
) {
  const rows = [];

  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  let physicalLine = 1;
  let rowStartLine = 1;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];

    const nextCharacter =
      text[index + 1];

    if (character === '"') {
      if (
        insideQuotes &&
        nextCharacter === '"'
      ) {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      currentRow.push(
        currentCell
      );

      currentCell = "";
      continue;
    }

    if (character === "\n") {
      if (insideQuotes) {
        currentCell += "\n";
        physicalLine += 1;
        continue;
      }

      currentRow.push(
        currentCell
      );

      rows.push({
        values: currentRow,
        startLine: rowStartLine
      });

      currentRow = [];
      currentCell = "";

      physicalLine += 1;
      rowStartLine =
        physicalLine;

      continue;
    }

    currentCell +=
      character;
  }

  if (insideQuotes) {
    throw new Error(
      `${sourceName} contains an unclosed quoted cell ` +
      `beginning on or before line ${rowStartLine}.`
    );
  }

  /*
   * Preserve the final logical row when the file does not end with a
   * newline. Avoid adding an artificial empty row after a terminal newline.
   */
  if (
    currentCell !== "" ||
    currentRow.length > 0
  ) {
    currentRow.push(
      currentCell
    );

    rows.push({
      values: currentRow,
      startLine: rowStartLine
    });
  }

  return rows;
}

/**
 * Prepare and validate the physical header row.
 *
 * Duplicate headers are fatal because JavaScript object properties cannot
 * safely retain two different values under the same name.
 */
function prepareHeaders(
  rawHeaders,
  sourceName
) {
  if (!Array.isArray(rawHeaders)) {
    throw new Error(
      `${sourceName} does not contain a valid header row.`
    );
  }

  const headers =
    rawHeaders.map(
      normalizeHeader
    );

  if (headers.length === 0) {
    throw new Error(
      `${sourceName} contains no CSV headers.`
    );
  }

  const blankHeaderIndexes = [];

  for (
    let index = 0;
    index < headers.length;
    index += 1
  ) {
    if (!headers[index]) {
      blankHeaderIndexes.push(
        index + 1
      );
    }
  }

  if (
    blankHeaderIndexes.length > 0
  ) {
    throw new Error(
      `${sourceName} contains blank header names in ` +
      `column${blankHeaderIndexes.length === 1 ? "" : "s"} ` +
      `${blankHeaderIndexes.join(", ")}.`
    );
  }

  const headerCounts =
    new Map();

  for (const header of headers) {
    const normalizedKey =
      header.toLocaleLowerCase();

    headerCounts.set(
      normalizedKey,
      (headerCounts.get(normalizedKey) ?? 0) + 1
    );
  }

  const duplicateHeaders =
    [...headerCounts.entries()]
      .filter(([, count]) =>
        count > 1
      )
      .map(([header]) =>
        header
      );

  if (
    duplicateHeaders.length > 0
  ) {
    throw new Error(
      `${sourceName} contains duplicate CSV headers: ` +
      duplicateHeaders.join(", ")
    );
  }

  return headers;
}

function prepareManifestFileEntry(
  fileEntry,
  manifestIndex
) {
  if (
    !fileEntry ||
    typeof fileEntry !== "object" ||
    Array.isArray(fileEntry)
  ) {
    throw new Error(
      `Manifest file entry ${manifestIndex + 1} is invalid.`
    );
  }

  const path =
    normalizeText(
      fileEntry.path
    );

  if (!path) {
    throw new Error(
      `Manifest file entry ${manifestIndex + 1} is missing its path.`
    );
  }

  if (
    path.startsWith("/") ||
    path.includes("..")
  ) {
    throw new Error(
      `Manifest file entry ${manifestIndex + 1} has an unsafe path: ` +
      path
    );
  }

  const filename =
    normalizeText(
      fileEntry.filename
    ) ||
    getFilenameFromPath(path);

  if (!filename) {
    throw new Error(
      `Manifest file entry ${manifestIndex + 1} has no filename.`
    );
  }

  return {
    ...fileEntry,
    filename,
    path,
    __manifestIndex:
      Number.isInteger(manifestIndex)
        ? manifestIndex
        : 0
  };
}

function compareManifestEntries(
  left,
  right
) {
  const pathComparison =
    naturalCompare(
      left.path,
      right.path
    );

  if (pathComparison !== 0) {
    return pathComparison;
  }

  return (
    left.__manifestIndex -
    right.__manifestIndex
  );
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

function normalizeCsvText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizeCellValue(value) {
  return String(value ?? "")
    .trim();
}

function normalizeText(value) {
  return String(value ?? "")
    .trim();
}

function isBlankRow(values) {
  return values.every(
    value =>
      normalizeCellValue(value) === ""
  );
}

function getFilenameFromPath(path) {
  const pathParts =
    String(path)
      .split("/")
      .filter(Boolean);

  return (
    pathParts[
      pathParts.length - 1
    ] ?? ""
  );
}

function appendCacheBuster(url) {
  const separator =
    String(url).includes("?")
      ? "&"
      : "?";

  return (
    `${url}${separator}` +
    `v=${Date.now()}`
  );
}

function formatErrorMessage(error) {
  if (
    error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return String(
    error ?? "Unknown error"
  );
}
