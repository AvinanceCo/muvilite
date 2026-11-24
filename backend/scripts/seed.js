/**
 * Database seed.
 *
 * Purpose: populate a fresh database with the reference data the application
 *          cannot function without, plus a minimal amount of demo content so
 *          every read path can be exercised end to end.
 * Usage:   npm run seed
 * Deps:    models, config/{env,db}
 *
 * Idempotent: every write is an upsert keyed on a natural business key, so
 * running it repeatedly converges rather than duplicating.
 *
 * IMPORTANT — if a real legacy database is ever imported, the poll questions
 * below will already exist in `poll_tbl`. Import first, then skip this script's
 * poll section (or delete the seeded duplicates), or you will end up with two
 * copies of each question.
 */
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import {
  Genre,
  MusicGenre,
  GameGenre,
  AgeRange,
  Country,
  AccessPermission,
  PermissionGroup,
  User,
  Poll,
  Page,
  Category,
  BannerCategory,
} from '../src/models/index.js';
import { PERMISSION_PAGES } from '../src/config/constants.js';
import { normalizeMobile } from '../src/utils/mobile.js';
import logger from '../src/utils/logger.js';

/** Seed administrator. Change the password immediately after first sign-in. */
const ADMIN_MOBILE = process.env.SEED_ADMIN_MOBILE ?? '09120000000';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';

/**
 * The nine survey questions, transcribed from legacy-php/poll.php lines
 * 23-287. The legacy page hardcoded these in HTML even though `poll_tbl`
 * existed; serving them from the table is what the schema was built for.
 */
const POLL_QUESTIONS = [
  'میزان رضایت شما نسبت به مراحل صدور کارت پرواز',
  'راحتی صندلی ها و تمیزی داخل هواپیما',
  'میزان رضایت شما از کادر پرواز',
  'کیفیت غذا و نوشیدنی در پرواز',
  'میزان رضایت شما از سرگرمی های داخل پرواز',
  'میزان رضایتمندی شما از به موقع انجام شدن پرواز ها',
  'میزان رضایتمندی شما از این شرکت هواپیمایی نسبت به شرکت های داخلی',
  'میزان رضایتمندی شما از این شرکت هواپیمایی نسبت به شرکت های خارجی',
  'در صورتیکه بلیط خود را از دفاتر فروش تهیه نموده اید میزان رضایت شما از رفتار و سرعت عمل کارکنان چیست؟',
];

/** legacy: the genre chips rendered on movie.php, with their colour classes. */
const GENRES = [
  { nameFa: 'اکشن', nameEn: 'Action', colorClass: 'genre-action' },
  { nameFa: 'درام', nameEn: 'Drama', colorClass: 'genre-drama' },
  { nameFa: 'کمدی', nameEn: 'Comedy', colorClass: 'genre-comedy' },
  { nameFa: 'علمی تخیلی', nameEn: 'Sci-Fi', colorClass: 'genre-scifi' },
  { nameFa: 'مستند', nameEn: 'Documentary', colorClass: 'genre-documentary' },
  { nameFa: 'انیمیشن', nameEn: 'Animation', colorClass: 'genre-animation' },
  { nameFa: 'خانوادگی', nameEn: 'Family', colorClass: 'genre-family' },
];

/**
 * NEW — the legacy application had no music genre at all. A starting vocabulary
 * so the music form's dropdown is not empty on a fresh installation; the panel
 * manages the list from there.
 */
const MUSIC_GENRES = [
  { nameFa: 'پاپ', nameEn: 'Pop' },
  { nameFa: 'سنتی', nameEn: 'Traditional' },
  { nameFa: 'کلاسیک', nameEn: 'Classical' },
  { nameFa: 'راک', nameEn: 'Rock' },
  { nameFa: 'رپ', nameEn: 'Rap' },
  { nameFa: 'بی‌کلام', nameEn: 'Instrumental' },
  { nameFa: 'محلی', nameEn: 'Folk' },
];

/**
 * NEW — the legacy application had no games. A starting vocabulary so the game
 * form's genre dropdown, which is REQUIRED, is not empty on a fresh
 * installation; the panel manages the list from there.
 */
const GAME_GENRES = [
  { nameFa: 'آرکید', nameEn: 'Arcade' },
  { nameFa: 'پازل', nameEn: 'Puzzle' },
  { nameFa: 'اکشن', nameEn: 'Action' },
  { nameFa: 'ورزشی', nameEn: 'Sports' },
  { nameFa: 'مسابقه‌ای', nameEn: 'Racing' },
  { nameFa: 'فکری', nameEn: 'Strategy' },
  { nameFa: 'ماجراجویی', nameEn: 'Adventure' },
  { nameFa: 'کارتی', nameEn: 'Card' },
];

/** legacy: the twelve-entry RATINGS constant in other/rating.php. */
const AGE_RANGES = [
  { nameFa: 'کودکان خردسال', nameEn: 'TV-Y' },
  { nameFa: 'کودکان', nameEn: 'TV-Y7' },
  { nameFa: 'همه سنین', nameEn: 'G' },
  { nameFa: 'با راهنمایی والدین', nameEn: 'PG' },
  { nameFa: 'بالای ۱۳ سال', nameEn: 'PG-13' },
  { nameFa: 'بالای ۱۷ سال', nameEn: 'R' },
  { nameFa: 'بزرگسالان', nameEn: 'NC-17' },
  { nameFa: 'بدون رده‌بندی', nameEn: 'Not rated' },
];

const COUNTRIES = [
  { countryCode: 'IR', countryFa: 'ایران', countryEn: 'Iran' },
  { countryCode: 'US', countryFa: 'آمریکا', countryEn: 'United States' },
  { countryCode: 'GB', countryFa: 'انگلستان', countryEn: 'United Kingdom' },
  { countryCode: 'FR', countryFa: 'فرانسه', countryEn: 'France' },
  { countryCode: 'DE', countryFa: 'آلمان', countryEn: 'Germany' },
  { countryCode: 'JP', countryFa: 'ژاپن', countryEn: 'Japan' },
  { countryCode: 'KR', countryFa: 'کره جنوبی', countryEn: 'South Korea' },
  { countryCode: 'TR', countryFa: 'ترکیه', countryEn: 'Turkey' },
];

/** Upserts a list keyed on one field, returning the resulting documents. */
async function upsertAll(Model, key, rows) {
  await Promise.all(
    rows.map((row) =>
      Model.updateOne({ [key]: row[key] }, { $setOnInsert: row }, { upsert: true }),
    ),
  );
  return Model.find({ [key]: { $in: rows.map((row) => row[key]) } }).lean();
}

async function seedTaxonomies() {
  const [genres, musicGenres, gameGenres, ageRanges, countries] = await Promise.all([
    upsertAll(Genre, 'nameFa', GENRES),
    upsertAll(MusicGenre, 'nameFa', MUSIC_GENRES),
    upsertAll(GameGenre, 'nameFa', GAME_GENRES),
    upsertAll(AgeRange, 'nameEn', AGE_RANGES),
    upsertAll(Country, 'countryCode', COUNTRIES),
  ]);

  logger.info(
    `Taxonomies: ${genres.length} genres, ${musicGenres.length} music genres, ` +
      `${gameGenres.length} game genres, ${ageRanges.length} age ranges, ` +
      `${countries.length} countries`,
  );
  return { genres, musicGenres, gameGenres, ageRanges, countries };
}

/**
 * One permission per guarded section, granting all three actions — the
 * "full access" building block. Finer-grained rows can be created in the panel.
 */
async function seedPermissions() {
  const rows = PERMISSION_PAGES.map((page) => ({
    displayName: `Full access: ${page}`,
    actionPage: page,
    actionView: true,
    actionEdit: true,
    actionDelete: true,
  }));

  await Promise.all(
    rows.map((row) =>
      AccessPermission.updateOne(
        { actionPage: row.actionPage, displayName: row.displayName },
        { $setOnInsert: row },
        { upsert: true },
      ),
    ),
  );

  const permissions = await AccessPermission.find({ isDeleted: false }).lean();

  await PermissionGroup.updateOne(
    { name: 'Administrators' },
    { $set: { permissions: permissions.map((permission) => permission._id) } },
    { upsert: true },
  );

  const group = await PermissionGroup.findOne({ name: 'Administrators' }).lean();

  logger.info(`Permissions: ${permissions.length} rows, group "Administrators"`);
  return group;
}

async function seedAdmin(group) {
  const mobile = normalizeMobile(ADMIN_MOBILE);
  const existing = await User.findOne({ mobile });

  if (existing) {
    // Keep the group current, but never silently reset an existing password.
    existing.permissionGroup = group._id;
    existing.isActive = true;
    await existing.save();
    logger.info(`Admin user already exists: ${mobile} (password unchanged)`);
    return existing;
  }

  // create() so the password-hashing pre-save hook runs.
  const admin = await User.create({
    mobile,
    password: ADMIN_PASSWORD,
    displayName: 'Administrator',
    firstname: 'Site',
    lastname: 'Admin',
    permissionGroup: group._id,
    isActive: true,
  });

  logger.info(`Admin user created: ${mobile}`);
  return admin;
}

async function seedPolls() {
  await Promise.all(
    POLL_QUESTIONS.map((questionFa, index) =>
      Poll.updateOne(
        { questionFa },
        { $setOnInsert: { questionFa, order: index + 1 } },
        { upsert: true },
      ),
    ),
  );
  logger.info(`Polls: ${POLL_QUESTIONS.length} questions`);
}

/**
 * Minimal demo content: the three pages the legacy site ran (film, music,
 * clips), a movie category and a banner category. Enough for
 * GET /api/pages/film to return a page with rails once content is attached.
 */
async function seedPages() {
  const pages = [
    { slug: 'film', titleFa: 'فیلم', titleEn: 'Movies' },
    { slug: 'music', titleFa: 'موسیقی', titleEn: 'Music' },
    { slug: 'clips', titleFa: 'کلیپ', titleEn: 'Clips' },
  ];

  await Promise.all(
    pages.map((page) => Page.updateOne({ slug: page.slug }, { $setOnInsert: page }, { upsert: true })),
  );

  await Category.updateOne(
    { nameFa: 'جدیدترین ها' },
    { $setOnInsert: { nameFa: 'جدیدترین ها', nameEn: 'Latest', style: 'grid' } },
    { upsert: true },
  );

  await BannerCategory.updateOne(
    { name: 'Home hero' },
    // 'long', not the retired 'full' — a fresh installation must not be seeded
    // with a type the panel refuses to save.
    { $setOnInsert: { name: 'Home hero', type: 'long', description: 'Top of the film page' } },
    { upsert: true },
  );

  logger.info(`Pages: ${pages.length} pages, 1 category, 1 banner category`);
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  logger.info(`Seeding ${mongoose.connection.name}`);

  try {
    await seedTaxonomies();
    const group = await seedPermissions();
    await seedAdmin(group);
    await seedPolls();
    await seedPages();
    logger.info('Seed complete');
  } finally {
    await mongoose.disconnect();
  }
}

try {
  await main();
  process.exit(0);
} catch (error) {
  logger.error('Seed failed', error);
  process.exit(1);
}
