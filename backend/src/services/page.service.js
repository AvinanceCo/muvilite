/**
 * Page service — composes a landing page from its blocks.
 *
 * Purpose: reproduce `api/v2/index.php::page()`, which loads a page, walks its
 *          ordered blocks, and fills each one with items from a different
 *          collection depending on the block type.
 * Inputs:  a page id or slug
 * Outputs: { page, blocks: [...] } ready for a client to render
 * Deps:    repositories, config/constants, utils/ApiError
 *
 * Legacy flow:
 *   SELECT title_fa, title_en, description_fa, description_en, tags
 *     FROM pages_tbl WHERE is_active = 1 AND is_delete = 0 AND id = ?
 *   SELECT item_type, item_sort, sort_type, item_id FROM page_block_tbl
 *    WHERE is_active = 1 AND is_delete = 0 AND page_id = ? ORDER BY item_order
 *   then switch (item_type) { case 'banner': ... 'category': ... 'music': ... }
 *
 * Rules preserved:
 *   - every rail is hard-capped at RAIL_ITEM_LIMIT (10) items, with no
 *     pagination; the "see all" link goes to the category endpoint instead;
 *   - a block whose target category is missing or inactive is skipped, not
 *     rendered empty — the legacy `getBannerCategory`/`getCategory` lookups
 *     returned nothing and the switch produced no output;
 *   - block ordering comes from item_order, item ordering from the block's own
 *     item_sort/sort_type.
 */
import {
  pageRepository,
  bannerRepository,
  movieRepository,
  musicRepository,
  categoryRepository,
  musicCategoryRepository,
  bannerCategoryRepository,
  MOVIE_SORT_FIELDS,
  MUSIC_SORT_FIELDS,
} from '../repositories/index.js';
import { RAIL_ITEM_LIMIT } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

/**
 * Translates a block's stored sort into a Mongoose sort object.
 *
 * The legacy code interpolated these two values directly into the rail's SQL
 * (`ORDER BY $itemSort $sortType`) with no validation, so an admin-writable
 * column reached the query planner verbatim. Values are constrained by the
 * PageBlock enum on write and mapped through a fixed table here on read, so an
 * unrecognised value degrades to the default instead of reaching the database.
 */
function resolveBlockSort(itemSort, sortType, fieldMap, defaultField) {
  const path = fieldMap[itemSort] ?? fieldMap[defaultField];
  const direction = sortType === 'ASC' ? 1 : -1;
  // `_id` tiebreaker mirrors the legacy `ORDER BY <sort>, id`.
  return { [path]: direction, _id: direction };
}

async function resolveBannerBlock(block) {
  const category = await bannerCategoryRepository.findById(block.itemId);
  if (!category) return null;

  const items = await bannerRepository.findByCategory(block.itemId);

  return {
    type: 'banner',
    /** 'full' | 'long' | 'item' — drives the slide dimensions client-side. */
    style: category.type,
    category: { id: category._id, name: category.name },
    items,
  };
}

async function resolveCategoryBlock(block) {
  const category = await categoryRepository.findById(block.itemId);
  if (!category) return null;

  const items = await movieRepository.findByCategory(block.itemId, {
    sort: resolveBlockSort(block.itemSort, block.sortType, MOVIE_SORT_FIELDS, 'created_date'),
    skip: 0,
    limit: RAIL_ITEM_LIMIT,
  });

  return {
    type: 'category',
    style: category.style,
    category: {
      id: category._id,
      nameFa: category.nameFa,
      nameEn: category.nameEn,
      icon: category.icon,
    },
    items,
  };
}

async function resolveMusicBlock(block) {
  const category = await musicCategoryRepository.findById(block.itemId);
  if (!category) return null;

  const items = await musicRepository.findByCategory(block.itemId, {
    sort: resolveBlockSort(block.itemSort, block.sortType, MUSIC_SORT_FIELDS, 'id'),
    skip: 0,
    limit: RAIL_ITEM_LIMIT,
  });

  return {
    type: 'music',
    style: category.style,
    category: {
      id: category._id,
      nameFa: category.nameFa,
      nameEn: category.nameEn,
      icon: category.icon,
    },
    // Legacy listed these as CONCAT(fullname, ' - ', album); the parts are kept
    // separate here and joined for convenience.
    items: items.map((item) => ({
      ...item,
      titleFa: [item.fullnameFa, item.albumFa].filter(Boolean).join(' - '),
      titleEn: [item.fullnameEn, item.albumEn].filter(Boolean).join(' - '),
    })),
  };
}

const BLOCK_RESOLVERS = {
  banner: resolveBannerBlock,
  category: resolveCategoryBlock,
  music: resolveMusicBlock,
};

/**
 * @param {string} idOrSlug
 * @returns {Promise<{page: object, blocks: object[]}>}
 */
export async function getPageWithBlocks(idOrSlug) {
  const page = await pageRepository.findPublic(idOrSlug);
  if (!page) {
    throw ApiError.notFound('Page not found');
  }

  const blocks = await pageRepository.findBlocks(page._id);

  // Blocks resolve independently, so one slow rail doesn't serialize the rest.
  const resolved = await Promise.all(
    blocks.map((block) => {
      const resolver = BLOCK_RESOLVERS[block.itemType];
      return resolver ? resolver(block) : Promise.resolve(null);
    }),
  );

  return {
    page: {
      id: page._id,
      slug: page.slug,
      titleFa: page.titleFa,
      titleEn: page.titleEn,
      descriptionFa: page.descriptionFa,
      descriptionEn: page.descriptionEn,
      tags: page.tags,
    },
    // Drop blocks whose target category no longer resolves.
    blocks: resolved.filter(Boolean),
  };
}

/* ------------------------------------------------------------------ admin --- */

/**
 * Where a block's untyped `itemId` points, and which fields name the target.
 *
 * `PageBlock.itemId` carries no ref: the collection it addresses depends on
 * `itemType`. The public resolvers above look the target up to fill a rail; the
 * admin composer needs the same lookup purely to show the operator what a block
 * points at.
 */
const BLOCK_TARGETS = {
  banner: { repository: bannerCategoryRepository, label: (doc) => doc.name },
  category: { repository: categoryRepository, label: (doc) => doc.nameFa },
  music: { repository: musicCategoryRepository, label: (doc) => doc.nameFa },
};

/**
 * A page with its blocks and each block's resolved target name, in display
 * order — one request for the admin's page composer.
 *
 * Legacy counterpart: `views/pages/content.php` and `graph.php`, which rendered
 * the block list and the go.js diagram of a page's composition.
 *
 * Differences from the public reader above, both deliberate:
 *   - deactivated pages and blocks are included, so they remain editable — the
 *     admin scope everywhere else in this migration;
 *   - a block whose target no longer resolves is returned with `target: null`
 *     rather than dropped. The public page hides such a block; the admin has to
 *     see it to fix or delete it.
 *
 * @param {string} pageId
 * @returns {Promise<{page: object, blocks: object[]}>}
 */
export async function getPageBlocksForAdmin(pageId) {
  const page = await pageRepository.findById(pageId, { scope: 'admin' });
  if (!page) {
    throw ApiError.notFound('Page not found');
  }

  const blocks = await pageRepository.findBlocksForAdmin(pageId);

  const resolved = await Promise.all(
    blocks.map(async (block) => {
      const target = BLOCK_TARGETS[block.itemType];
      if (!target) return { ...block, target: null };

      const doc = await target.repository.findById(block.itemId, { scope: 'admin' });
      return {
        ...block,
        target: doc ? { id: doc._id, name: target.label(doc), isActive: doc.isActive } : null,
      };
    }),
  );

  return { page, blocks: resolved };
}

export default { getPageWithBlocks, getPageBlocksForAdmin };
