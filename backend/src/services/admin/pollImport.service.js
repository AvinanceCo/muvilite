/**
 * Poll question CSV import.
 *
 * Purpose: create survey questions in bulk from a spreadsheet, so a nine- or
 *          ninety-question survey does not have to be typed one form at a time.
 * Inputs:  an uploaded CSV buffer, plus the `dryRun` / `skipInvalid` switches
 * Outputs: a report — what would be created, what is a duplicate, what is wrong
 * Deps:    repositories/poll, services/auditLog, utils/{csv,ApiError}
 *
 * NEW FUNCTIONALITY. The legacy panel had no import of any kind; its
 * `views/polls/` pair was an unfinished copy of the banner screens (it posted to
 * BannerController and its model pointed at `page_block_tbl`), so the nine
 * questions in `poll.php` were hardcoded HTML that no screen could edit. This
 * writes ordinary Poll documents through the same repository the single-record
 * form uses — the import is a faster way in, not a second kind of question.
 *
 * The rules, all of them chosen so that running the same file twice is safe:
 *
 *   - A question already stored (comparing `questionFa` with whitespace
 *     collapsed, case-insensitively) is SKIPPED, not created again and not
 *     treated as an error. Re-importing a corrected file therefore adds only
 *     what is new. Soft-deleted questions do not count as stored, so a question
 *     deleted on purpose can be imported back.
 *   - A row repeating an earlier row of the same file is skipped the same way.
 *   - A row that cannot be understood is an ERROR. By default one bad row fails
 *     the whole file and nothing is written, because a half-loaded survey is
 *     worse than none; `skipInvalid` imports the good rows instead.
 *   - `dryRun` runs every check and writes nothing, which is what the admin
 *     screen previews before it commits. A dry run never refuses: it reports
 *     the bad rows and sets `wouldFail`, since refusing to describe a file is
 *     no help to whoever has to fix it.
 *
 * Column recognition is deliberately generous — Persian or English headers, in
 * any order — because the file usually comes from whoever wrote the survey
 * rather than from an export of this system.
 */
import { pollRepository } from '../../repositories/index.js';
import { recordAction } from '../auditLog.service.js';
import { USER_LOG_ACTIONS } from '../../config/constants.js';
import { parseCsv } from '../../utils/csv.js';
import ApiError from '../../utils/ApiError.js';

/** Longest question text accepted, matching `pollWriteRules`. */
const MAX_QUESTION_LENGTH = 500;

/** Rows per file. A survey is tens of questions; a file of thousands is a mistake. */
const MAX_ROWS = 500;

/**
 * Header aliases per field. Compared after lower-casing, collapsing whitespace
 * and stripping `_`, `-` and the Arabic/Persian letter variants that make
 * "سوال" and "سؤال" different strings.
 */
const HEADER_ALIASES = Object.freeze({
  questionFa: ['questionfa', 'question', 'questionpersian', 'سوال', 'سوالفارسی', 'پرسش', 'متنسوال'],
  questionEn: ['questionen', 'questionenglish', 'english', 'سواللاتین', 'سوالانگلیسی', 'لاتین'],
  order: ['order', 'sort', 'sortorder', 'position', 'ترتیب', 'اولویت', 'ردیف'],
  isActive: ['isactive', 'active', 'enabled', 'status', 'وضعیت', 'فعال'],
});

/** Column order used when the file has no header row. */
const POSITIONAL_FIELDS = Object.freeze(['questionFa', 'questionEn', 'order', 'isActive']);

/**
 * Truthy and falsy spellings accepted in the `isActive` column, already in the
 * form `normalizeHeader` produces — hence `اری` rather than `آری`.
 */
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on', 'active', 'فعال', 'بله', 'اری']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off', 'inactive', 'غیرفعال', 'خیر', 'نه']);

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Rewrites Persian/Arabic-Indic digits as ASCII so `۳` parses as 3. */
function toAsciiDigits(value) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit));
  });
}

/** Collapses a header cell to its comparable form. */
function normalizeHeader(value) {
  return toAsciiDigits(String(value ?? ''))
    .toLowerCase()
    .replace(/[\s_\-.]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ؤئأإآ]/g, (letter) => ({ ؤ: 'و', ئ: 'ی', أ: 'ا', إ: 'ا', آ: 'ا' })[letter]);
}

/** Comparable form of a question, for duplicate detection. */
function normalizeQuestion(value) {
  return String(value ?? '')
    .replace(/[‌\s]+/g, ' ') // ZWNJ and any run of whitespace -> one space
    .trim()
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک');
}

/**
 * Maps a header row onto field names.
 * @returns {{map: Record<number,string>, matched: number}}
 */
function mapHeaderRow(cells) {
  const map = {};
  let matched = 0;

  cells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      // First column wins, so a duplicated header does not silently shadow.
      if (aliases.includes(normalized) && !Object.values(map).includes(field)) {
        map[index] = field;
        matched += 1;
        return;
      }
    }
  });

  return { map, matched };
}

/** Reads one field out of a row, given the column map. */
function cellOf(row, columnMap, field) {
  for (const [index, mapped] of Object.entries(columnMap)) {
    if (mapped === field) {
      return String(row[index] ?? '').trim();
    }
  }
  return '';
}

/**
 * Validates one row into a poll payload.
 * @returns {{ok: true, value: object}|{ok: false, message: string}}
 */
function readRow(row, columnMap) {
  const questionFa = cellOf(row, columnMap, 'questionFa');
  const questionEn = cellOf(row, columnMap, 'questionEn');
  const orderCell = cellOf(row, columnMap, 'order');
  const activeCell = cellOf(row, columnMap, 'isActive');

  if (!questionFa) {
    return { ok: false, message: 'ستون «سوال» خالی است.' };
  }

  if (questionFa.length > MAX_QUESTION_LENGTH) {
    return { ok: false, message: `متن سوال بیش از ${MAX_QUESTION_LENGTH} نویسه است.` };
  }

  if (questionEn.length > MAX_QUESTION_LENGTH) {
    return { ok: false, message: `متن سوال لاتین بیش از ${MAX_QUESTION_LENGTH} نویسه است.` };
  }

  // Blank means "put it after the others"; the caller fills it in once it knows
  // where the survey currently ends.
  let order = null;
  if (orderCell !== '') {
    const parsed = Number(toAsciiDigits(orderCell));
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, message: `ترتیب «${orderCell}» یک عدد صحیح و نامنفی نیست.` };
    }
    order = parsed;
  }

  let isActive = true;
  if (activeCell !== '') {
    const normalized = normalizeHeader(activeCell);
    if (TRUE_VALUES.has(normalized)) {
      isActive = true;
    } else if (FALSE_VALUES.has(normalized)) {
      isActive = false;
    } else {
      return { ok: false, message: `وضعیت «${activeCell}» قابل تشخیص نیست.` };
    }
  }

  return { ok: true, value: { questionFa, questionEn, order, isActive } };
}

/**
 * Imports questions from a CSV buffer.
 *
 * @param {object} input
 * @param {Buffer} input.buffer        the uploaded file
 * @param {string} [input.fileName]
 * @param {boolean} [input.dryRun]     validate and report, write nothing
 * @param {boolean} [input.skipInvalid] import the good rows instead of failing
 * @param {{userId: string, userIp: string}} context
 * @returns {Promise<object>} the import report
 */
export async function importPollQuestions(
  { buffer, fileName = '', dryRun = false, skipInvalid = false },
  context,
) {
  const rows = parseCsv(buffer);

  if (rows.length === 0) {
    throw ApiError.badRequest('فایل خالی است یا هیچ سطر معتبری ندارد.');
  }

  // A header row is one where at least one cell is a name we recognise. Without
  // that test a headerless file's first question would be eaten as a header.
  const header = mapHeaderRow(rows[0]);
  const hasHeader = header.matched > 0;
  const columnMap = hasHeader
    ? header.map
    : Object.fromEntries(POSITIONAL_FIELDS.map((field, index) => [index, field]));

  if (hasHeader && !Object.values(columnMap).includes('questionFa')) {
    throw ApiError.badRequest(
      'ستون «سوال» در سربرگ فایل پیدا نشد. سربرگ‌های شناخته‌شده: سوال، سوال لاتین، ترتیب، وضعیت.',
    );
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  // Line numbers are the operator's coordinates back into their spreadsheet, so
  // they count the header and start at 1.
  const firstDataLine = hasHeader ? 2 : 1;

  if (dataRows.length === 0) {
    throw ApiError.badRequest('فایل جز سربرگ هیچ سطری ندارد.');
  }

  if (dataRows.length > MAX_ROWS) {
    throw ApiError.badRequest(`حداکثر ${MAX_ROWS} سطر در هر فایل پذیرفته می‌شود.`);
  }

  const existing = await pollRepository.find(pollRepository.adminScope(), {
    select: 'questionFa order',
  });

  const existingQuestions = new Map(
    existing.map((poll) => [normalizeQuestion(poll.questionFa), poll]),
  );
  const highestOrder = existing.reduce((max, poll) => Math.max(max, poll.order ?? 0), 0);

  const accepted = [];
  const duplicates = [];
  const errors = [];
  const seenInFile = new Map();

  dataRows.forEach((row, index) => {
    const line = firstDataLine + index;
    const parsed = readRow(row, columnMap);

    if (!parsed.ok) {
      errors.push({ line, message: parsed.message, value: String(row[0] ?? '').trim() });
      return;
    }

    const key = normalizeQuestion(parsed.value.questionFa);

    if (existingQuestions.has(key)) {
      duplicates.push({ line, questionFa: parsed.value.questionFa, reason: 'existing' });
      return;
    }

    if (seenInFile.has(key)) {
      duplicates.push({
        line,
        questionFa: parsed.value.questionFa,
        reason: 'file',
        firstSeenLine: seenInFile.get(key),
      });
      return;
    }

    seenInFile.set(key, line);
    accepted.push({ line, ...parsed.value });
  });

  // A dry run REPORTS bad rows instead of refusing, because its whole job is to
  // show the operator what is wrong before they commit. Only the real import
  // refuses — and `report.wouldFail` below tells the preview that it would.
  if (errors.length > 0 && !skipInvalid && !dryRun) {
    throw ApiError.badRequest(
      `فایل ${errors.length} سطر نامعتبر دارد و چیزی وارد نشد. سطرها را اصلاح کنید یا گزینهٔ نادیده گرفتن سطرهای نامعتبر را فعال کنید.`,
      errors.map((error) => ({ field: `line ${error.line}`, message: error.message })),
    );
  }

  // Rows that named their own position keep it; the rest are appended after the
  // survey's current end, in file order, so the CSV's sequence is preserved.
  let nextOrder = highestOrder;
  const payloads = accepted.map((item) => {
    const order = item.order ?? (nextOrder += 1);
    return {
      line: item.line,
      questionFa: item.questionFa,
      questionEn: item.questionEn,
      order,
      isActive: item.isActive,
    };
  });

  const report = {
    dryRun,
    fileName,
    hasHeader,
    /** True when committing this file as-is would be refused. */
    wouldFail: errors.length > 0 && !skipInvalid,
    totals: {
      rows: dataRows.length,
      created: dryRun ? 0 : payloads.length,
      pending: dryRun ? payloads.length : 0,
      duplicates: duplicates.length,
      invalid: errors.length,
    },
    questions: payloads,
    duplicates,
    errors,
  };

  if (dryRun || payloads.length === 0) {
    return report;
  }

  const created = await pollRepository.insertMany(
    payloads.map(({ line: _line, ...document }) => document),
  );

  report.questions = payloads.map((payload, index) => ({
    ...payload,
    _id: created[index]?._id,
  }));

  // One audit entry for the import as a whole. Fifty entries would bury every
  // other action in the log, and the interesting fact is the batch.
  await recordAction({
    user: context.userId,
    userIp: context.userIp,
    page: 'pages',
    action: USER_LOG_ACTIONS.CREATE,
    targetId: null,
    details: {
      import: 'polls',
      fileName,
      created: created.length,
      duplicates: duplicates.length,
      invalid: errors.length,
      ids: created.map((poll) => String(poll._id)),
    },
  });

  return report;
}

export default { importPollQuestions };
