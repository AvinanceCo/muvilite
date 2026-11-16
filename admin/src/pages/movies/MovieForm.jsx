/**
 * Movie create/edit.
 *
 * Purpose: the catalog's main data-entry screen — metadata, poster, cast
 *          credits and category membership.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved movie
 * Deps:    react-hook-form, hooks/useResource, api/operations, components/form/*
 *
 * Legacy counterpart: `views/movies/form.php`, 1368 lines carrying the same
 * field set plus its poster uploader, cast picker and category picker inline.
 *
 * CLIPS SHARE THIS SCREEN. Ticking «کلیپ» marks the record as a short vertical
 * clip, and every film-only input is then disabled: a clip carries a title, a
 * primary genre, descriptions, tags and category membership, and nothing else.
 * The API drops the rest of the fields from a clip's write rather than clearing
 * them (backend registry.js CLIP_FIELDS), so unticking the box brings a film's
 * metadata back intact — and that drop, not the disabling here, is what keeps a
 * clip's record clean.
 *
 * FOUR THINGS TO KNOW BEFORE CHANGING THIS FILE:
 *
 * 1. **The publish year is a bare year, in whichever calendar `defaultOrigin`
 *    names.** With `defaultOrigin === 0` the operator types a Jalali year and
 *    the SERVER converts it to Gregorian on write. So the stored value must be
 *    converted BACK for display when loading (services/jalali toFormYear) and
 *    the entered value passed through untouched on save. Converting on both
 *    sides double-converts and shifts every year by 621.
 *
 * 2. **Poster, casts and categories are separate endpoints** and save
 *    immediately, independent of this form. A movie must exist before any of
 *    them can be attached, so they are disabled until the record has an id.
 *
 * 3. **A movie with no `genre1` is invisible on the passenger site** — the
 *    public detail query INNER JOINs the genre. That is legacy behaviour
 *    deliberately preserved (MIGRATION.md §6), not a bug, so the field is
 *    marked and a warning is shown rather than the rule being quietly relaxed.
 *
 * 4. **The video is its own endpoint too**, and the standard it must meet
 *    depends on the clip flag — which lives in this form and is only persisted
 *    on save. The video panel therefore reads the SAVED value from the record,
 *    not the checkbox: uploading against a rule the record does not have yet
 *    would be checked one way here and the other way by the server.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useLookupOptions,
  useResourceDetail,
  useResourceMutations,
} from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as ops from '../../api/operations.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader } from '../../components/ui/Card.jsx';
import { Checkbox, CodeInput, Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { ImageUpload } from '../../components/form/ImageUpload.jsx';
import { MovieVideoField } from '../../components/form/MovieVideoField.jsx';
import { RelationPicker } from '../../components/form/RelationPicker.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { toFormYear } from '../../services/jalali.js';
import {
  CALENDAR_ORIGINS,
  CAST_ROLES,
  ORIGIN_JALALI,
  // PLATFORMS, // unused while the platforms fieldset below stays commented out
  castRoleLabel,
  isClipCategory,
} from '../../utils/constants.js';

/** The fields this form owns, for mapping a 422 back onto the inputs. */
const FIELD_NAMES = [
  'isClip',
  'titleFa',
  'titleEn',
  'descriptionFa',
  'descriptionEn',
  'publishYear',
  'defaultOrigin',
  'imdbRank',
  'imdbCode',
  'country',
  'company',
  'location',
  'tags',
  'genre1',
  'genre2',
  'genre3',
  'ageRange',
  'movieLength',
  'price',
  'priceDiscount',
  'cinemaExpireHour',
  'isKids',
  'isReview',
  'isActive',
];

const EMPTY = {
  isClip: false,
  titleFa: '',
  titleEn: '',
  descriptionFa: '',
  descriptionEn: '',
  publishYear: '',
  defaultOrigin: ORIGIN_JALALI,
  imdbRank: '',
  imdbCode: '',
  country: '',
  company: '',
  location: '',
  tags: '',
  genre1: '',
  genre2: '',
  genre3: '',
  ageRange: '',
  movieLength: '',
  price: 0,
  priceDiscount: 0,
  cinemaExpireHour: '',
  isKids: false,
  isReview: false,
  isActive: true,
  platform: [],
};

export function MovieForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit, canDelete } = usePermissions();

  useDocumentTitle(isNew ? 'افزودن ویدئو' : 'ویرایش ویدئو');

  const detail = useResourceDetail('movies', isNew ? null : id);
  const { create, update } = useResourceMutations('movies');

  // The MP4/HLS switch («تنظیمات ویدئو»): the mode the video card starts on —
  // the operator can change it per upload — and whether HLS is available.
  const videoSettings = useQuery({
    queryKey: ['movies', 'video-settings'],
    queryFn: ops.getMovieVideoSettings,
    enabled: !isNew,
  });

  const { options: genreOptions } = useLookupOptions('genres');
  const { options: ageRangeOptions } = useLookupOptions('age-ranges');
  const { options: countryOptions } = useLookupOptions('countries', {
    // A movie stores the country CODE, not the Country document's id.
    labelKey: 'countryFa',
    valueKey: 'countryCode',
    sort: 'country_fa',
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY });

  const origin = Number(watch('defaultOrigin'));
  const genre1 = watch('genre1');
  // Drives the disabling below. Watched rather than read on submit so the form
  // reshapes itself the moment the box is ticked.
  const isClip = watch('isClip');
  /**
   * Spread onto every film-only input.
   *
   * Disabling is presentation only — react-hook-form keeps a disabled field's
   * last value in its own state and submits it regardless of the DOM attribute.
   * What actually stops a clip from carrying a stale year or price is the API,
   * which drops every non-clip field from a clip's write
   * (backend registry.js CLIP_FIELDS). Do not move that rule into this form.
   */
  const filmOnly = { disabled: Boolean(isClip) };

  useEffect(() => {
    if (!detail.data) return;

    const movie = detail.data;
    reset({
      ...EMPTY,
      ...Object.fromEntries(
        FIELD_NAMES.map((name) => [name, movie[name] ?? EMPTY[name] ?? '']),
      ),
      // Populated relations come back as objects; the selects want ids.
      genre1: movie.genre1?._id ?? '',
      genre2: movie.genre2?._id ?? '',
      genre3: movie.genre3?._id ?? '',
      ageRange: movie.ageRange?._id ?? '',
      publishYear: toFormYear(movie.publishYear, movie.defaultOrigin ?? ORIGIN_JALALI),
      // Checkbox `value` attributes are strings, and react-hook-form matches a
      // group's checked state against them by identity. The stored array holds
      // numbers, so without this every platform box would render unchecked on a
      // record that has them set. Converted back with Number() on submit.
      //
      // Kept while the platforms fieldset is commented out (see below): reading
      // the saved value in and writing it straight back out is what stops a save
      // from clearing platforms the hidden picker can no longer show.
      platform: (movie.platform ?? []).map(String),
    });
  }, [detail.data, reset]);

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      // Empty selects must clear the field, which the API accepts as ''.
      genre2: values.genre2 || '',
      genre3: values.genre3 || '',
      ageRange: values.ageRange || '',
      // Numeric inputs arrive as strings; '' means "not set".
      publishYear: values.publishYear === '' ? undefined : Number(values.publishYear),
      imdbRank: values.imdbRank === '' ? undefined : Number(values.imdbRank),
      movieLength: values.movieLength === '' ? 0 : Number(values.movieLength),
      price: Number(values.price) || 0,
      priceDiscount: Number(values.priceDiscount) || 0,
      cinemaExpireHour:
        values.cinemaExpireHour === '' ? undefined : Number(values.cinemaExpireHour),
      defaultOrigin: Number(values.defaultOrigin),
      platform: (values.platform ?? []).map(Number),
    };

    try {
      if (isNew) {
        const created = await create.mutateAsync(payload);
        toast.success('فیلم ایجاد شد. اکنون می‌توانید پوستر و عوامل را اضافه کنید.');
        // Stay on the record: poster, casts and categories need its id.
        navigate(`/movies/${created._id}`, { replace: true });
      } else {
        await update.mutateAsync({ id, payload });
        toast.success('تغییرات ذخیره شد.');
      }
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, FIELD_NAMES);
      if (unmatched.length > 0 || Object.keys(error.fieldErrors ?? {}).length === 0) {
        toast.error(unmatched.length > 0 ? unmatched.join('؛ ') : error.message);
      }
    }
  };

  const submitError = create.error ?? update.error;
  const movie = detail.data;

  return (
    <>
      <PageHeader
        title={isNew ? 'افزودن ویدئو' : movie?.titleFa || 'ویرایش ویدئو'}
        actions={
          <Button variant="ghost" size="sm" to="/movies">
            بازگشت به فهرست
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 ? (
                <FormError error={submitError} />
              ) : null}

              {/* First, because it decides what the rest of the form even is. */}
              <div className="mb-5 rounded-lg border border-line bg-panel-hi px-4 py-3">
                <Checkbox label="این رکورد یک کلیپ است" {...register('isClip')} />
                <p className="mt-1.5 text-xs leading-6 text-muted/80">
                  {isClip
                    ? 'کلیپ فقط نام، ژانر اصلی، توضیحات، برچسب‌ها و دسته‌بندی می‌گیرد؛ بقیهٔ گزینه‌ها غیرفعال‌اند. ویدئوی کلیپ باید عمودی و کوتاه‌تر از ۳ دقیقه باشد.'
                    : 'کلیپ‌ها ویدئوهای کوتاه عمودی هستند. با زدن این تیک، گزینه‌های مخصوص فیلم غیرفعال می‌شوند.'}
                </p>
              </div>

              <SectionHeader title="مشخصات اصلی" />

              <FieldGrid>
                <Field label="نام ویدئو" required error={errors.titleFa}>
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      {...register('titleFa', {
                        required: 'نام ویدئو الزامی است.',
                        maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                      })}
                    />
                  )}
                </Field>

                <Field label="نام لاتین" error={errors.titleEn}>
                  {({ id: fieldId, invalid }) => (
                    <Input id={fieldId} invalid={invalid} dir="ltr" {...register('titleEn')} />
                  )}
                </Field>

                <Field
                  label="ژانر اصلی"
                  error={errors.genre1}
                  hint={
                    genre1
                      ? undefined
                      : 'بدون ژانر اصلی، این فیلم در سایت اصلی نمایش داده نمی‌شود.'
                  }
                >
                  {({ id: fieldId, invalid }) => (
                    <Select
                      id={fieldId}
                      invalid={invalid}
                      options={genreOptions}
                      placeholder="انتخاب کنید"
                      {...register('genre1')}
                    />
                  )}
                </Field>

                <Field label="ژانر دوم">
                  {({ id: fieldId }) => (
                    <Select
                      id={fieldId}
                      options={genreOptions}
                      placeholder="—"
                      {...filmOnly}
                      {...register('genre2')}
                    />
                  )}
                </Field>

                <Field label="ژانر سوم">
                  {({ id: fieldId }) => (
                    <Select
                      id={fieldId}
                      options={genreOptions}
                      placeholder="—"
                      {...filmOnly}
                      {...register('genre3')}
                    />
                  )}
                </Field>

                <Field label="رده سنی">
                  {({ id: fieldId }) => (
                    <Select
                      id={fieldId}
                      options={ageRangeOptions}
                      placeholder="—"
                      {...filmOnly}
                      {...register('ageRange')}
                    />
                  )}
                </Field>

                <Field label="تقویم سال انتشار" hint="تعیین می‌کند سال زیر شمسی است یا میلادی.">
                  {({ id: fieldId }) => (
                    <Select
                      id={fieldId}
                      options={[...CALENDAR_ORIGINS]}
                      {...filmOnly}
                      {...register('defaultOrigin')}
                    />
                  )}
                </Field>

                <Field
                  label={`سال انتشار (${origin === ORIGIN_JALALI ? 'شمسی' : 'میلادی'})`}
                  error={errors.publishYear}
                  hint={
                    origin === ORIGIN_JALALI
                      ? 'سال شمسی وارد کنید؛ هنگام ذخیره به میلادی تبدیل می‌شود.'
                      : undefined
                  }
                >
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      type="number"
                      dir="ltr"
                      placeholder={origin === ORIGIN_JALALI ? '1399' : '2020'}
                      {...filmOnly}
                      {...register('publishYear', {
                        min: { value: 1000, message: 'سال نامعتبر است.' },
                        max: { value: 2200, message: 'سال نامعتبر است.' },
                      })}
                    />
                  )}
                </Field>

                <Field label="امتیاز IMDb" error={errors.imdbRank}>
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      type="number"
                      step="0.1"
                      dir="ltr"
                      {...filmOnly}
                      {...register('imdbRank', {
                        min: { value: 0, message: 'بین ۰ تا ۱۰.' },
                        max: { value: 10, message: 'بین ۰ تا ۱۰.' },
                      })}
                    />
                  )}
                </Field>

                <Field label="کد IMDb">
                  {({ id: fieldId }) => (
                    <CodeInput
                      id={fieldId}
                      placeholder="tt0000000"
                      {...filmOnly}
                      {...register('imdbCode')}
                    />
                  )}
                </Field>

                <Field label="مدت (دقیقه)" error={errors.movieLength}>
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      type="number"
                      dir="ltr"
                      min={0}
                      {...filmOnly}
                      {...register('movieLength', { min: { value: 0, message: 'نامعتبر.' } })}
                    />
                  )}
                </Field>

                <Field label="کشور">
                  {({ id: fieldId }) => (
                    <Select
                      id={fieldId}
                      options={countryOptions}
                      placeholder="—"
                      {...filmOnly}
                      {...register('country')}
                    />
                  )}
                </Field>

                <Field label="تولید کننده">
                  {({ id: fieldId }) => (
                    <Input id={fieldId} {...filmOnly} {...register('company')} />
                  )}
                </Field>

                <Field label="محل تولید">
                  {({ id: fieldId }) => (
                    <Input id={fieldId} {...filmOnly} {...register('location')} />
                  )}
                </Field>

                <Field label="برچسب ها" className="sm:col-span-2" hint="با ویرگول جدا کنید.">
                  {({ id: fieldId }) => <Input id={fieldId} {...register('tags')} />}
                </Field>

                <Field label="توضیحات فارسی" className="sm:col-span-2">
                  {({ id: fieldId }) => (
                    <Textarea id={fieldId} rows={5} {...register('descriptionFa')} />
                  )}
                </Field>

                <Field label="توضیحات انگلیسی" className="sm:col-span-2">
                  {({ id: fieldId }) => (
                    <Textarea id={fieldId} rows={5} dir="ltr" {...register('descriptionEn')} />
                  )}
                </Field>
              </FieldGrid>

              <div className="mt-6">
                <SectionHeader title="انتشار و دسترسی" />

                <FieldGrid columns={3}>
                  <Field label="قیمت" hint="۰ یعنی رایگان.">
                    {({ id: fieldId }) => (
                      <Input
                        id={fieldId}
                        type="number"
                        dir="ltr"
                        min={0}
                        {...filmOnly}
                        {...register('price')}
                      />
                    )}
                  </Field>

                  <Field label="تخفیف">
                    {({ id: fieldId }) => (
                      <Input
                        id={fieldId}
                        type="number"
                        dir="ltr"
                        min={0}
                        {...filmOnly}
                        {...register('priceDiscount')}
                      />
                    )}
                  </Field>

                  <Field label="مهلت نمایش (ساعت)" hint="برای عرضهٔ زمان‌دار؛ خالی یعنی بدون مهلت.">
                    {({ id: fieldId }) => (
                      <Input
                        id={fieldId}
                        type="number"
                        dir="ltr"
                        min={0}
                        {...filmOnly}
                        {...register('cinemaExpireHour')}
                      />
                    )}
                  </Field>
                </FieldGrid>

                {/*
                  PLATFORMS PICKER — HIDDEN ON REQUEST.

                  Commented out rather than deleted (same treatment as the
                  retired full-width banner type) so the legacy field set stays
                  legible to whoever reads this next.

                  The VALUE PLUMBING IS LEFT IN PLACE on purpose — EMPTY.platform,
                  the reset() mapping and the onSubmit Number() mapping. A
                  default value that was never registered still travels through
                  react-hook-form's state, so an existing record's platforms are
                  read back and written out unchanged instead of being cleared by
                  every save made while this section is hidden.

                  To bring it back: uncomment this block and the PLATFORMS import.

                <fieldset className="mt-4">
                  <legend className="mb-2 text-xs font-bold text-muted">پلتفرم ها</legend>
                  <div className="flex flex-wrap gap-4">
                    {PLATFORMS.map((platform) => (
                      <Checkbox
                        key={platform.value}
                        label={platform.label}
                        value={platform.value}
                        {...filmOnly}
                        {...register('platform')}
                      />
                    ))}
                  </div>
                </fieldset>
                */}

                <div className="mt-4 flex flex-wrap gap-5 border-t border-line pt-4">
                  <Checkbox label="فعال" {...register('isActive')} />
                  <Checkbox label="مناسب کودکان" {...filmOnly} {...register('isKids')} />
                  <Checkbox label="نیازمند بازبینی" {...filmOnly} {...register('isReview')} />
                </div>
              </div>

              <FormActions>
                <Button variant="ghost" to="/movies">
                  انصراف
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  {isNew ? 'ایجاد' : 'ذخیره تغییرات'}
                </Button>
              </FormActions>
            </form>
          </Card>

          {!isNew ? (
            <>
              {/* A clip has no cast credits to keep — the section is one of the
                  film-only ones and disappears rather than sitting empty. Keyed
                  off the checkbox, like the inputs above it, so the form reads
                  as one thing that changed. */}
              {isClip ? null : (
                <MovieCasts movieId={id} canEdit={canEdit('movies')} canDelete={canDelete('movies')} />
              )}
              <MovieCategories
                movieId={id}
                isClip={Boolean(isClip)}
                // Which categories the API will ACCEPT is decided by the saved
                // record, not the checkbox. So the list re-filters immediately
                // while adding waits for the save — otherwise the picker would
                // offer a clip category and the server would refuse it.
                kindUnsaved={Boolean(isClip) !== Boolean(movie?.isClip)}
                canEdit={canEdit('categories')}
                canDelete={canDelete('categories')}
              />
            </>
          ) : null}
        </div>

        {/* Poster sits outside the form: it is its own request. */}
        <aside className="space-y-5">
          <Card>
            <ImageUpload
              label="پوستر"
              path={movie?.posterPath}
              disabled={isNew || !canEdit('movies')}
              aspect="216 / 332"
              hint="بندانگشتی ۲۱۶×۳۳۲ به صورت خودکار ساخته می‌شود."
              onUpload={(file) => ops.uploadMoviePoster(id, file)}
              onUploaded={() =>
                queryClient.invalidateQueries({ queryKey: ['movies'] })
              }
            />
            {movie && !movie.thumbnailPath && movie.posterPath ? (
              <Alert tone="warning" className="mt-3">
                بندانگشتی ساخته نشده است؛ تصویر اصلی نمایش داده می‌شود.
              </Alert>
            ) : null}
          </Card>

          {/* Its own endpoint, like the poster — and gated on the SAVED clip
              flag rather than the checkbox, so the rule the panel checks is the
              one the server will apply. */}
          <Card>
            <MovieVideoField
              path={movie?.videoPath}
              isClip={Boolean(movie?.isClip)}
              durationSecond={movie?.videoDurationSecond}
              width={movie?.videoWidth}
              height={movie?.videoHeight}
              transcode={videoSettings.data?.transcodeEnabled ?? null}
              transcoderAvailable={videoSettings.data?.transcoderAvailable ?? null}
              status={movie?.videoStatus}
              progress={movie?.videoProgress}
              error={movie?.videoError}
              disabled={isNew || !canEdit('movies')}
              onUploadFile={(file, meta, onProgress, mode) =>
                ops.uploadMovieVideo(id, file, meta, onProgress, mode)
              }
              onSaveLink={(url, meta) => ops.setMovieVideoLink(id, url, meta)}
              onRemove={() => ops.removeMovieVideo(id)}
              onLoadStatus={() => ops.getMovieVideoStatus(id)}
              onRetry={() => ops.retryMovieVideo(id)}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['movies'] });
                detail.refetch();
              }}
            />
            {!isNew && isClip !== Boolean(movie?.isClip) ? (
              <Alert tone="warning" className="mt-3">
                تیک «کلیپ» را ذخیره کنید تا استاندارد ویدئو مطابق آن بررسی شود.
              </Alert>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- relations --- */

/**
 * Cast credits. `(movie, cast, role)` is the unique key, so one person can hold
 * two roles on the same title — director and writer, say — which the picker
 * allows by keeping the role in the add control.
 *
 * The cast list is fetched at the API's 100-row cap. A catalog with more
 * people than that needs a search-as-you-type picker; the legacy panel had one
 * (`views/movies/search_casts.php`) but no endpoint backs it, so the filtered
 * list endpoint is the honest substitute and the limit is stated in the hint.
 */
function MovieCasts({ movieId, canEdit, canDelete }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState(String(CAST_ROLES[0].value));
  const [castId, setCastId] = useState('');

  const credits = useQuery({
    queryKey: ['movies', 'casts', movieId],
    queryFn: () => ops.fetchMovieCasts(movieId),
  });

  const { options: castOptions } = useLookupOptions('casts', {
    labelKey: 'fullnameFa',
    sort: 'fullname_fa',
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['movies', 'casts', movieId] });

  const rows = (credits.data ?? []).map((credit) => ({
    key: credit._id,
    id: credit.cast?._id,
    label: credit.cast?.fullnameFa ?? '—',
    meta: castRoleLabel(credit.role),
    credit,
  }));

  return (
    <Card>
      <SectionHeader title="عوامل" description={`از میان ${castOptions.length} شخصیت ثبت‌شده.`} />
      <RelationPicker
        rows={rows}
        options={castOptions}
        loading={credits.isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        // (movie, cast, role) is the unique key, so the same person can hold a
        // second role on this title.
        allowDuplicates
        addValue={castId}
        onAddValueChange={setCastId}
        addPlaceholder="انتخاب شخصیت"
        emptyLabel="عاملی ثبت نشده است"
        extraControl={
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={CAST_ROLES.map((item) => ({ value: item.value, label: item.label }))}
            className="w-40"
            aria-label="نقش"
          />
        }
        onAdd={async (value) => {
          await ops.addMovieCast({ movie: movieId, cast: value, role: Number(role) });
          await invalidate();
        }}
        onRemove={async (row) => {
          await ops.removeMovieCast({
            movie: movieId,
            cast: row.credit.cast?._id ?? row.credit.cast,
            role: row.credit.role,
          });
          await invalidate();
        }}
      />
    </Card>
  );
}

/**
 * Category membership. Gated on `categories`, which is what the API requires.
 *
 * A category whose name contains «کلیپ» or "clip" takes clips only, so a film's
 * picker leaves those out entirely rather than offering a choice the API will
 * refuse. A clip may go anywhere — an ordinary category is free to mix the two.
 *
 * `isClip` is the LIVE checkbox and `kindUnsaved` says it has not been saved
 * yet. The two are separate because they answer different questions: the
 * checkbox decides what this list should show, and the saved record decides what
 * the API will accept. Following only the saved value left the section looking
 * frozen when the box was ticked; following only the checkbox would offer an
 * add that comes back 400.
 */
function MovieCategories({ movieId, isClip, kindUnsaved = false, canEdit, canDelete }) {
  const queryClient = useQueryClient();

  const links = useQuery({
    queryKey: ['movies', 'categories', movieId],
    queryFn: () => ops.fetchMovieCategories(movieId),
  });

  // `raw` carries nameFa/nameEn, which is what the clip-category test reads;
  // the option's label alone would miss a match on the Latin name.
  const { options: allCategories } = useLookupOptions('categories');
  const categoryOptions = isClip
    ? allCategories
    : allCategories.filter((option) => !isClipCategory(option.raw ?? { nameFa: option.label }));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['movies', 'categories', movieId] });

  const rows = (links.data ?? []).map((link) => ({
    key: link._id,
    id: link.category?._id,
    label: link.category?.nameFa ?? '—',
    link,
  }));

  return (
    <Card>
      <SectionHeader
        title="دسته بندی ها"
        description={
          isClip
            ? 'کلیپ در هر دسته‌بندی‌ای قابل افزودن است.'
            : 'دسته‌بندی‌های کلیپ در این فهرست نیستند؛ آن‌ها فقط کلیپ می‌پذیرند.'
        }
      />

      <RelationPicker
        rows={rows}
        options={categoryOptions}
        loading={links.isLoading}
        // Adding is checked against the SAVED record, so it waits for the save.
        // Removing is not — a link can always be undone — so `canDelete` is
        // left alone.
        disabled={kindUnsaved}
        disabledHint="فهرست بر اساس تیک «کلیپ» به‌روز شد؛ برای افزودن، ابتدا تغییر را ذخیره کنید."
        canEdit={canEdit}
        canDelete={canDelete}
        addPlaceholder="انتخاب دسته بندی"
        emptyLabel="در هیچ دسته‌بندی‌ای نیست"
        onAdd={async (value) => {
          await ops.addMovieCategory({ category: value, item: movieId });
          await invalidate();
        }}
        onRemove={async (row) => {
          await ops.removeMovieCategory({
            category: row.link.category?._id ?? row.link.category,
            item: movieId,
          });
          await invalidate();
        }}
      />
    </Card>
  );
}

export default MovieForm;
