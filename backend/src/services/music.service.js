/**
 * Music service — public music catalog business logic.
 *
 * Purpose: reproduce `api/v2/index.php::music()`, `::musics()` and
 *          `::music_categories()`.
 * Inputs:  ids, query parameters
 * Outputs: view models for the music detail, listing and search endpoints
 * Deps:    repositories, utils/{pagination,dates,ApiError}
 */
import {
  musicRepository,
  musicCategoryRepository,
  MUSIC_SORT_FIELDS,
} from '../repositories/index.js';
import { resolvePagination, resolveSort, buildMeta } from '../utils/pagination.js';
import { gregorianYearToJalali } from '../utils/dates.js';
import ApiError from '../utils/ApiError.js';

/**
 * legacy (api/v2/index.php::music_categories) whitelist — note it differs from
 * the movie side: only three keys, and the default is `id`, not created_date.
 */
const MUSIC_CATEGORY_SORTS = Object.freeze({
  visit_count: MUSIC_SORT_FIELDS.visit_count,
  id: MUSIC_SORT_FIELDS.id,
  publish_date: MUSIC_SORT_FIELDS.publish_date,
});

/** Legacy list titles were CONCAT(fullname, ' - ', album). */
const displayTitle = (name, album) => [name, album].filter(Boolean).join(' - ');

/**
 * Music detail with its track playlist.
 *
 * Legacy behaviour (api/v2/index.php::music):
 *   - `tracks` was a JSON column, decoded and then rewritten so each entry
 *     pointed at assets/musics/{id}/{file}.mp3 with the album cover as its
 *     image. Tracks are stored with real paths here, so no rewriting is needed;
 *     the cover fallback is preserved.
 *   - when `is_iranian = 1`, the publish year is converted to the Jalali
 *     calendar via `helper::year_gregorian_to_jalali()`.
 *   - the endpoint also OPENED a listen-history row as a side effect of
 *     fetching the music. That side effect is now its own explicit call
 *     (POST /api/listen-sessions), so a metadata read no longer writes.
 */
export async function getMusicDetail(musicId) {
  const music = await musicRepository.findById(musicId);
  if (!music) {
    throw ApiError.notFound('Music not found');
  }

  return {
    id: music._id,
    fullnameFa: music.fullnameFa,
    fullnameEn: music.fullnameEn,
    albumFa: music.albumFa,
    albumEn: music.albumEn,
    titleFa: displayTitle(music.fullnameFa, music.albumFa),
    titleEn: displayTitle(music.fullnameEn, music.albumEn),
    descriptionFa: music.descriptionFa,
    descriptionEn: music.descriptionEn,
    publishYear: music.publishYear,
    /** Jalali rendering of publishYear for Iranian releases. */
    publishYearJalali: music.isIranian ? gregorianYearToJalali(music.publishYear) : null,
    isIranian: music.isIranian,
    tags: music.tags,
    company: music.company,
    coverPath: music.coverPath,
    visitCount: music.visitCount,
    tracks: [...music.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => ({
        id: track._id,
        title: track.title,
        file: track.file,
        image: track.image ?? music.coverPath,
        duration: track.duration,
      })),
  };
}

/**
 * Music entries in a category, paginated.
 * legacy: api/v2/index.php::music_categories.
 */
export async function listMusicByCategory(categoryId, query) {
  const category = await musicCategoryRepository.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Music category not found');
  }

  const { page, limit, skip } = resolvePagination(query);
  const sort = resolveSort(query.item_sort, query.sort_type, {
    allowed: MUSIC_CATEGORY_SORTS,
    defaultField: 'id',
    defaultDirection: 'DESC',
    tiebreaker: { _id: -1 },
  });

  const [items, total] = await Promise.all([
    musicRepository.findByCategory(category._id, { sort, skip, limit }),
    musicRepository.countByCategory(category._id),
  ]);

  return {
    category: { id: category._id, nameFa: category.nameFa, nameEn: category.nameEn },
    items: items.map((item) => ({
      ...item,
      titleFa: displayTitle(item.fullnameFa, item.albumFa),
      titleEn: displayTitle(item.fullnameEn, item.albumEn),
    })),
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * Music search.
 *
 * legacy (api/v2/index.php::musics) ordered by `id DESC` with NO LIMIT at all,
 * returning every match. Pagination is applied here — a deliberate correction
 * recorded in MIGRATION.md. Which rows match is unchanged.
 */
export async function searchMusic(query) {
  const { page, limit, skip } = resolvePagination(query);
  const filter = musicRepository.buildSearchFilter(query.text);

  const { items, total } = await musicRepository.paginate(filter, {
    sort: { _id: -1 },
    skip,
    limit,
    select: 'fullnameFa fullnameEn albumFa albumEn coverPath visitCount',
  });

  return {
    items: items.map((item) => ({
      ...item,
      titleFa: displayTitle(item.fullnameFa, item.albumFa),
      titleEn: displayTitle(item.fullnameEn, item.albumEn),
    })),
    meta: buildMeta({ page, limit, total }),
  };
}

export default { getMusicDetail, listMusicByCategory, searchMusic };
