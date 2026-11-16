/**
 * Spreadsheet export service.
 *
 * Purpose: stream movie and user lists out as .xlsx.
 * Inputs:  the same filter queries the list endpoints accept
 * Outputs: an ExcelJS workbook written to a stream
 * Deps:    exceljs, repositories
 *
 * Legacy counterparts: admin/.../views/movies/export.php and views/users/export.php,
 * reached by passing `excel=1` to the list controller.
 *
 * The legacy exports ran the same unbounded query the grid used and built the
 * sheet in memory. These stream row by row and cap the row count, so exporting
 * a large catalog cannot exhaust the process.
 */
import ExcelJS from 'exceljs';
import { movieRepository, userRepository } from '../../repositories/index.js';

/** Upper bound on exported rows, so one request cannot pull the whole database. */
export const EXPORT_ROW_LIMIT = 50_000;

const formatDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/**
 * Writes a workbook to the response stream.
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {{header: string, key: string, width?: number}[]} columns
 * @param {object[]} rows
 */
async function writeWorkbook(res, filename, columns, rows) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: false });
  const sheet = workbook.addWorksheet('Export');

  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row).commit();
  }

  sheet.commit();
  await workbook.commit();
}

const like = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** legacy: views/movies/export.php */
export async function exportMovies(res, query = {}) {
  const filter = movieRepository.adminScope();
  if (query.titleFa) filter.titleFa = like(query.titleFa);
  if (query.company) filter.company = like(query.company);
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const movies = await movieRepository.find(filter, {
    sort: { createdAt: -1 },
    limit: EXPORT_ROW_LIMIT,
    populate: ['genre1', 'ageRange'],
  });

  const columns = [
    { header: 'ID', key: 'id', width: 26 },
    { header: 'Title (FA)', key: 'titleFa', width: 30 },
    { header: 'Title (EN)', key: 'titleEn', width: 30 },
    { header: 'Publish year', key: 'publishYear', width: 14 },
    { header: 'IMDb', key: 'imdbRank', width: 8 },
    { header: 'IMDb code', key: 'imdbCode', width: 14 },
    { header: 'Genre', key: 'genre', width: 18 },
    { header: 'Age range', key: 'ageRange', width: 14 },
    { header: 'Country', key: 'country', width: 10 },
    { header: 'Company', key: 'company', width: 24 },
    { header: 'Length (min)', key: 'movieLength', width: 12 },
    { header: 'Views', key: 'visitCount', width: 10 },
    { header: 'Active', key: 'isActive', width: 8 },
    { header: 'Created', key: 'createdAt', width: 14 },
  ];

  const rows = movies.map((movie) => ({
    id: String(movie._id),
    titleFa: movie.titleFa,
    titleEn: movie.titleEn,
    publishYear: movie.publishYear ?? '',
    imdbRank: movie.imdbRank ?? '',
    imdbCode: movie.imdbCode ?? '',
    genre: movie.genre1?.nameFa ?? '',
    ageRange: movie.ageRange?.nameFa ?? '',
    country: movie.country ?? '',
    company: movie.company ?? '',
    movieLength: movie.movieLength ?? 0,
    visitCount: movie.visitCount ?? 0,
    isActive: movie.isActive ? 'yes' : 'no',
    createdAt: formatDate(movie.createdAt),
  }));

  await writeWorkbook(res, 'movies.xlsx', columns, rows);
}

/** legacy: views/users/export.php */
export async function exportUsers(res, query = {}) {
  const filter = userRepository.adminScope();
  if (query.mobile) filter.mobile = like(query.mobile);
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.permissionGroup) filter.permissionGroup = query.permissionGroup;

  const users = await userRepository.find(filter, {
    sort: { createdAt: -1 },
    limit: EXPORT_ROW_LIMIT,
    // Both hashes stay excluded.
    select: '-password -legacyPasswordHash',
    populate: ['permissionGroup'],
  });

  const columns = [
    { header: 'ID', key: 'id', width: 26 },
    { header: 'Mobile', key: 'mobile', width: 16 },
    { header: 'Display name', key: 'displayName', width: 24 },
    { header: 'First name', key: 'firstname', width: 18 },
    { header: 'Last name', key: 'lastname', width: 18 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Group', key: 'group', width: 18 },
    { header: 'Active', key: 'isActive', width: 8 },
    { header: 'Last login', key: 'lastLoginAt', width: 14 },
    { header: 'Created', key: 'createdAt', width: 14 },
  ];

  const rows = users.map((user) => ({
    id: String(user._id),
    mobile: user.mobile,
    displayName: user.displayName ?? '',
    firstname: user.firstname ?? '',
    lastname: user.lastname ?? '',
    email: user.email ?? '',
    group: user.permissionGroup?.name ?? '',
    isActive: user.isActive ? 'yes' : 'no',
    lastLoginAt: formatDate(user.lastLoginAt),
    createdAt: formatDate(user.createdAt),
  }));

  await writeWorkbook(res, 'users.xlsx', columns, rows);
}

export default { exportMovies, exportUsers, EXPORT_ROW_LIMIT };
