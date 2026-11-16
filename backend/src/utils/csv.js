/**
 * CSV reading.
 *
 * Purpose: turn an uploaded spreadsheet export into rows of strings, without
 *          adding a parsing dependency for one endpoint.
 * Inputs:  the raw file text (or a Buffer)
 * Outputs: `string[][]`, one array per record
 * Deps:    none
 *
 * Follows RFC 4180: fields may be quoted with `"`, a quote inside a quoted
 * field is doubled (`""`), and a quoted field may contain the delimiter or a
 * line break. Three real-world deviations are handled deliberately, because
 * every one of them arrives from Excel:
 *
 *   1. A UTF-8 BOM. Excel writes one whenever a sheet contains non-ASCII text,
 *      which for a Persian survey is always. Left in place it would become part
 *      of the first header name and no column would ever match.
 *   2. A semicolon or tab delimiter. Excel uses the locale's list separator,
 *      not a comma, so a file saved on a machine configured for fa-IR or most
 *      of Europe is semicolon-separated. The delimiter is sniffed rather than
 *      assumed.
 *   3. Mixed CRLF / CR / LF line endings.
 *
 * The file is read whole. That is fine here — the endpoint that uses it caps
 * uploads at a couple of megabytes — but it is why this is not a stream API.
 */

/** Delimiters considered by {@link detectDelimiter}, in preference order. */
const CANDIDATE_DELIMITERS = [',', ';', '\t'];

const BOM = String.fromCharCode(0xfeff);

/**
 * Picks the delimiter by counting candidates outside quoted fields.
 *
 * Counting across the whole file rather than the first line alone matters: a
 * one-column file has no delimiter at all on its header row, and a header like
 * `"سوال, به فارسی"` would otherwise vote for a comma it does not use.
 *
 * @param {string} text
 * @returns {string} one of `,` `;` or a tab — comma when nothing is conclusive
 */
export function detectDelimiter(text) {
  const counts = new Map(CANDIDATE_DELIMITERS.map((delimiter) => [delimiter, 0]));
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      // A doubled quote inside a quoted field is an escaped quote, not a close.
      if (inQuotes && text[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && counts.has(character)) {
      counts.set(character, counts.get(character) + 1);
    }
  }

  let best = ',';
  let bestCount = 0;
  for (const delimiter of CANDIDATE_DELIMITERS) {
    if (counts.get(delimiter) > bestCount) {
      best = delimiter;
      bestCount = counts.get(delimiter);
    }
  }

  return best;
}

/**
 * Parses CSV text into rows.
 *
 * Fully empty rows are dropped — a trailing newline, or the blank line Excel
 * leaves between blocks, must not read as a record.
 *
 * @param {string|Buffer} input
 * @param {object} [options]
 * @param {string} [options.delimiter] forces a delimiter instead of sniffing
 * @returns {string[][]}
 */
export function parseCsv(input, { delimiter } = {}) {
  let text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input ?? '');

  if (text.startsWith(BOM)) {
    text = text.slice(BOM.length);
  }

  const separator = delimiter ?? detectDelimiter(text);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = '';
  };

  const endRow = () => {
    endField();
    // `['']` is what a blank line parses to; it is not a record.
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === '') {
      // A quote only opens a quoted field at the start of one; anywhere else it
      // is literal text, which is what a spreadsheet does with `12" pipe`.
      inQuotes = true;
      continue;
    }

    if (character === separator) {
      endField();
      continue;
    }

    if (character === '\r') {
      // CRLF and a bare CR both end the record.
      if (text[index + 1] === '\n') index += 1;
      endRow();
      continue;
    }

    if (character === '\n') {
      endRow();
      continue;
    }

    field += character;
  }

  // Whatever is buffered when the text runs out is the final record, unless the
  // file ended on a line break and left nothing behind.
  if (field !== '' || row.length > 0) {
    endRow();
  }

  return rows;
}

export default { parseCsv, detectDelimiter };
