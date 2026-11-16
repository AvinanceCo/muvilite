/**
 * Game create/edit.
 *
 * Purpose: upload an HTML5 game and describe its card; later, change that
 *          description or swap the game's files for a new build.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved game
 * Deps:    react-hook-form, hooks/useResource, api/operations,
 *          components/form/GameBundleDrop
 *
 * NEW SCREEN — the legacy panel had none; the legacy application had no games.
 * The fields are Playva's upload dialog (`playva-admin/.../games/index.jsx`):
 * title, folder name, genre, emoji, two colours and the ZIP. Its leaderboard
 * block is not here — the leaderboard was left out of this section.
 *
 * CREATING IS ONE REQUEST, WITH THE FILE IN IT. Every other form in the panel
 * saves a record first and attaches files to it afterwards; a game cannot work
 * that way, because a game with no bundle is not a game. So on «افزودن» the ZIP
 * is part of the form and required, and nothing at all is stored unless the
 * server manages to unpack it.
 *
 * EDITING IS TWO SEPARATE THINGS, on purpose. The card's text and colours are an
 * ordinary save. The files are replaced by their own action, behind their own
 * button, because it swaps what every passenger is playing — and it keeps the
 * record, so the game's count of openings survives a fixed build. Playva has no
 * such action: there a broken game is deleted and uploaded again from zero.
 *
 * THE FOLDER NAME IS FIXED AFTER CREATION. It names the directory the bundle was
 * unpacked into and is part of the game's address.
 *
 * THE TEST FRAME IS SANDBOXED, and a game may behave differently in it. A game
 * is somebody else's code, and this panel's origin holds the signed-in
 * administrator's token; running the one inside the other unguarded would hand
 * the token to the game. So the preview frame carries `sandbox`, without
 * `allow-same-origin`: the game runs, but as a stranger — which also means it
 * cannot reach `localStorage`, and a game that saves progress may complain or
 * refuse to start HERE while working perfectly for passengers. The caption says
 * so; the passenger site is the real test. (backend MIGRATION.md §19.)
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useLookupOptions,
  useResourceDetail,
  useResourceMutations,
} from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as ops from '../../api/operations.js';
import { mediaUrl } from '../../services/media.js';
import { toPersianNumber } from '../../services/format.js';
import {
  GAME_DEFAULTS,
  GAME_EMOJI_SUGGESTIONS,
  GAME_FOLDER_NAME_PATTERN,
} from '../../utils/constants.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader } from '../../components/ui/Card.jsx';
import { Checkbox, CodeInput, Input, Select } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { GameBundleDrop } from '../../components/form/GameBundleDrop.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { GameTile } from './GameTile.jsx';

/** What the edit save sends. `folderName` joins them on create only. */
const EDIT_FIELDS = ['titleFa', 'genre', 'emoji', 'color1', 'color2', 'isActive'];
const FIELD_NAMES = [...EDIT_FIELDS, 'folderName'];

const EMPTY = {
  titleFa: '',
  folderName: '',
  genre: '',
  emoji: GAME_DEFAULTS.emoji,
  color1: GAME_DEFAULTS.color1,
  color2: GAME_DEFAULTS.color2,
  isActive: true,
};

/**
 * `#abc` -> `#aabbcc`. The API accepts both, but `<input type="color">` only
 * understands the long form and silently shows black for anything else.
 */
function longHex(value, fallback) {
  const hex = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}`.toLowerCase();
  }
  return fallback;
}

/** A folder name suggested from the ZIP's own name — the server's fallback rule. */
function folderNameFrom(fileName) {
  return fileName
    .replace(/\.zip$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/**
 * Puts the server's refusal of a BUNDLE into the panel's language.
 *
 * These come back as English sentences, like every API message; most errors an
 * operator meets are caught in Persian before a request is made, but what is
 * wrong inside an archive can only be discovered by the server opening it. The
 * original is kept for anything not recognised.
 */
function explainBundleError(error) {
  const message = error?.message ?? '';

  if (/No index\.html/i.test(message)) {
    return 'در این فایل ZIP، index.html پیدا نشد. باید در ریشهٔ فایل یا درون تنها پوشهٔ آن باشد.';
  }
  if (/not a readable ZIP/i.test(message)) {
    return 'این فایل یک ZIP سالم نیست. آن را دوباره فشرده و بارگذاری کنید.';
  }
  if (/points outside/i.test(message)) {
    return 'این فایل ZIP مسیرهایی دارد که به بیرون از پوشهٔ بازی اشاره می‌کنند و پذیرفته نمی‌شود.';
  }
  if (/too many files|holds \d+ files|unpacks to/i.test(message)) {
    return `بازی از سقف مجاز بزرگ‌تر است. (${message})`;
  }
  if (/too large/i.test(message)) {
    return 'حجم فایل ZIP از سقف مجاز سرور بیشتر است.';
  }
  return message;
}

export function GameForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const editable = canEdit('games');

  useDocumentTitle(isNew ? 'افزودن بازی' : 'ویرایش بازی');

  const detail = useResourceDetail('games', isNew ? null : id);
  const { update } = useResourceMutations('games');
  const { options: genreOptions, isLoading: genresLoading } = useLookupOptions('game-genres');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY });

  // The ZIP chosen for a NEW game; sent with the form.
  const [bundle, setBundle] = useState(null);
  const [bundleError, setBundleError] = useState(null);
  // A replacement build for an EXISTING game; sent by its own button.
  const [replacement, setReplacement] = useState(null);
  const [progress, setProgress] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  // The test frame is only mounted on request, and remounted after a new build.
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!detail.data) return;
    reset({
      ...EMPTY,
      ...Object.fromEntries(FIELD_NAMES.map((name) => [name, detail.data[name] ?? EMPTY[name]])),
      // Populated by the API; the select wants the id.
      genre: detail.data.genre?._id ?? '',
      color1: longHex(detail.data.color1, EMPTY.color1),
      color2: longHex(detail.data.color2, EMPTY.color2),
    });
  }, [detail.data, reset]);

  const [emoji, color1, color2, titleFa, genreId] = watch([
    'emoji',
    'color1',
    'color2',
    'titleFa',
    'genre',
  ]);

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const game = detail.data ?? null;
  const genreLabel = genreOptions.find((option) => option.value === genreId)?.label;

  const pickBundle = (file) => {
    setBundle(file);
    setBundleError(null);
    // Offer a folder name from the file's own, but never over one already typed.
    if (file && !getValues('folderName')) {
      setValue('folderName', folderNameFrom(file.name), { shouldValidate: true });
    }
  };

  /** 422s land on their fields; a taken folder name is a 409 and belongs to one. */
  const routeError = (error) => {
    const unmatched = applyServerErrors(error, setError, FIELD_NAMES);

    if (error.isConflict) {
      setError('folderName', {
        type: 'server',
        message: 'این نام پوشه را بازی دیگری گرفته است. نام دیگری انتخاب کنید.',
      });
      return;
    }

    if (unmatched.length > 0) {
      setSubmitError(new Error(unmatched.join('؛ ')));
    } else if (Object.keys(error.fieldErrors ?? {}).length === 0) {
      setSubmitError(new Error(explainBundleError(error)));
    }
  };

  const onSubmit = async (values) => {
    setSubmitError(null);

    if (isNew && !bundle) {
      setBundleError('فایل ZIP بازی را انتخاب کنید.');
      return;
    }

    try {
      if (isNew) {
        setProgress(0);
        const created = await ops.createGame(values, bundle, setProgress);
        await queryClient.invalidateQueries({ queryKey: ['games'] });
        toast.success('بازی بارگذاری و منتشر شد.');
        navigate(`/games/${created._id}`, { replace: true });
      } else {
        const payload = Object.fromEntries(EDIT_FIELDS.map((name) => [name, values[name]]));
        await update.mutateAsync({ id, payload });
        toast.success('تغییرات ذخیره شد.');
      }
    } catch (error) {
      routeError(error);
    } finally {
      setProgress(null);
    }
  };

  const replaceBundle = async () => {
    if (!replacement) return;

    setProgress(0);
    try {
      await ops.replaceGameBundle(id, replacement, setProgress);
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      setReplacement(null);
      // The frame, if open, is showing the build that was just deleted.
      setTesting(false);
      toast.success('فایل‌های بازی جایگزین شد.');
    } catch (error) {
      toast.error(explainBundleError(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <PageHeader
        title={isNew ? 'افزودن بازی' : game?.titleFa || 'ویرایش بازی'}
        description={
          isNew
            ? 'فایل ZIP بازی و مشخصات کارت آن را وارد کنید. بازی پس از بارگذاری بلافاصله در سایت اصلی دیده می‌شود، مگر آنکه تیک «فعال» را بردارید.'
            : undefined
        }
        actions={
          <Button variant="ghost" size="sm" to="/games">
            بازگشت به فهرست
          </Button>
        }
      />

      {genreOptions.length === 0 && !genresLoading ? (
        <Alert tone="warning" title="هنوز ژانری برای بازی‌ها تعریف نشده است" className="mb-5">
          هر بازی باید یک ژانر داشته باشد. ابتدا از بخش «ژانر بازی» دست‌کم یک ژانر بسازید.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FormError error={submitError} />

              <FieldGrid>
                <Field label="عنوان بازی" required error={errors.titleFa}>
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      {...register('titleFa', {
                        required: 'عنوان بازی الزامی است.',
                        maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                      })}
                    />
                  )}
                </Field>

                <Field label="ژانر" required error={errors.genre}>
                  {({ id: fieldId, invalid }) => (
                    <Select
                      id={fieldId}
                      invalid={invalid}
                      options={genreOptions}
                      placeholder="انتخاب ژانر"
                      {...register('genre', { required: 'ژانر بازی را انتخاب کنید.' })}
                    />
                  )}
                </Field>

                {isNew ? (
                  <Field
                    label="نام پوشه"
                    required
                    className="sm:col-span-2"
                    hint="نام لاتین و یکتای بازی؛ بخشی از نشانی آن می‌شود و بعداً قابل تغییر نیست. فقط حروف لاتین، رقم، خط تیره و زیرخط."
                    error={errors.folderName}
                  >
                    {({ id: fieldId, invalid }) => (
                      <CodeInput
                        id={fieldId}
                        invalid={invalid}
                        placeholder="snake-game"
                        {...register('folderName', {
                          required: 'نام پوشه الزامی است.',
                          pattern: {
                            value: GAME_FOLDER_NAME_PATTERN,
                            message: 'فقط حروف لاتین، رقم، خط تیره و زیرخط؛ حداکثر ۶۴ نویسه.',
                          },
                        })}
                      />
                    )}
                  </Field>
                ) : null}

                <Field
                  label="ایموجی کارت"
                  className="sm:col-span-2"
                  hint="بازی تصویر ندارد؛ کارت آن همین ایموجی روی زمینه‌ای از دو رنگ زیر است. هر ایموجی‌ای را می‌توان نوشت یا چسباند."
                  error={errors.emoji}
                >
                  {({ id: fieldId, invalid }) => (
                    <>
                      <Input
                        id={fieldId}
                        invalid={invalid}
                        className="max-w-28 text-center text-xl"
                        {...register('emoji', {
                          maxLength: { value: 16, message: 'تنها یک ایموجی وارد کنید.' },
                        })}
                      />
                      <div className="flex flex-wrap gap-1" role="group" aria-label="ایموجی‌های پیشنهادی">
                        {GAME_EMOJI_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setValue('emoji', suggestion, { shouldDirty: true })}
                            aria-label={`انتخاب ${suggestion}`}
                            aria-pressed={emoji === suggestion}
                            className={
                              'grid size-9 place-items-center rounded-lg border text-lg leading-none transition-colors ' +
                              (emoji === suggestion
                                ? 'border-azure bg-azure-dim/40'
                                : 'border-line bg-panel hover:border-azure-dim')
                            }
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </Field>

                <Field label="رنگ اول زمینه" error={errors.color1}>
                  {({ id: fieldId }) => (
                    <input
                      id={fieldId}
                      type="color"
                      className="h-10 w-full cursor-pointer rounded-lg border border-line bg-panel p-1"
                      {...register('color1')}
                    />
                  )}
                </Field>

                <Field label="رنگ دوم زمینه" error={errors.color2}>
                  {({ id: fieldId }) => (
                    <input
                      id={fieldId}
                      type="color"
                      className="h-10 w-full cursor-pointer rounded-lg border border-line bg-panel p-1"
                      {...register('color2')}
                    />
                  )}
                </Field>
              </FieldGrid>

              {isNew ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-2 text-xs font-bold text-muted">
                    فایل بازی
                    <span aria-hidden="true" className="ms-1 text-signal">
                      *
                    </span>
                  </p>
                  <GameBundleDrop
                    file={bundle}
                    onPick={pickBundle}
                    progress={progress}
                    invalid={Boolean(bundleError)}
                  />
                  {bundleError ? (
                    <p role="alert" className="mt-1 text-xs text-signal">
                      {bundleError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 border-t border-line pt-4">
                <Checkbox label="فعال" {...register('isActive')} />
                <p className="mt-1 text-xs text-muted/80">
                  بازی غیرفعال در سایت اصلی دیده نمی‌شود و نشانی آن هم باز نمی‌شود.
                </p>
              </div>

              <FormActions>
                <Button variant="ghost" to="/games">
                  انصراف
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  {isNew ? 'بارگذاری و ایجاد' : 'ذخیره تغییرات'}
                </Button>
              </FormActions>
            </form>
          </Card>

          {!isNew && game ? (
            <Card>
              <SectionHeader
                title="آزمودن بازی"
                description="بازی در قابی جداافتاده اجرا می‌شود تا به نشست مدیریتی شما دسترسی نداشته باشد. به همین دلیل نمی‌تواند چیزی ذخیره کند، و بازی‌ای که پیشرفت را نگه می‌دارد ممکن است اینجا خطا بدهد اما برای کاربران درست کار کند. آزمون نهایی، سایت اصلی است."
                actions={
                  <Button size="sm" onClick={() => setTesting((current) => !current)}>
                    {testing ? 'بستن' : 'اجرای آزمایشی'}
                  </Button>
                }
              />

              {testing ? (
                // `sandbox` WITHOUT allow-same-origin is the whole point: the
                // game gets an opaque origin and cannot read this panel's token.
                // Never add allow-same-origin here — together with allow-scripts
                // it lets the frame remove its own sandbox.
                <iframe
                  key={game.gameUrl}
                  src={mediaUrl(game.gameUrl)}
                  title={`آزمون ${game.titleFa}`}
                  sandbox="allow-scripts allow-pointer-lock"
                  className="aspect-video w-full rounded-lg border border-line bg-black"
                />
              ) : null}
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5">
          <Card>
            <p className="mb-2 text-xs font-bold text-muted">پیش‌نمایش کارت</p>
            <GameTile emoji={emoji} color1={color1} color2={color2} size="lg" />
            <p className="mt-2 truncate text-sm text-paper">{titleFa || 'عنوان بازی'}</p>
            <p className="truncate text-xs text-muted">{genreLabel ?? 'ژانر'}</p>
          </Card>

          {!isNew && game ? (
            <>
              <Card>
                <p className="text-xs font-bold text-muted">تعداد بازشدن</p>
                {/* The text face, not the mono one: the count is in Persian
                    digits, which the Latin mono stack does not carry. */}
                <p className="mt-1 text-lg font-bold text-paper">
                  {toPersianNumber(game.clicks ?? 0)}
                </p>
                <p className="mt-2 text-xs leading-6 text-muted/80">
                  هر بار که کاربری بازی را باز می‌کند یکی افزوده می‌شود. فهرست «پرطرفدار» در سایت
                  اصلی بر همین اساس مرتب می‌شود.
                </p>
              </Card>

              <Card>
                <p className="text-xs font-bold text-muted">فایل‌های بازی</p>
                <p className="mt-1 text-xs text-muted/80">
                  پوشه:{' '}
                  <span dir="ltr" className="font-mono text-paper">
                    {game.folderName}
                  </span>
                </p>
                <p dir="ltr" className="mt-1 break-all font-mono text-[0.7rem] text-muted">
                  {game.gameUrl}
                </p>

                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-2 text-xs leading-6 text-muted/80">
                    برای انتشار نسخهٔ تازه، ZIP جدید را انتخاب کنید. فایل‌های فعلی پاک می‌شوند؛ خودِ
                    بازی و تعداد بازشدنش باقی می‌ماند.
                  </p>
                  <GameBundleDrop
                    file={replacement}
                    onPick={setReplacement}
                    progress={progress}
                    disabled={!editable}
                    emptyLabel="ZIP نسخهٔ تازه را اینجا رها کنید"
                  />
                  {replacement ? (
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={replaceBundle}
                      loading={progress !== null}
                    >
                      جایگزینی فایل‌های بازی
                    </Button>
                  ) : null}
                </div>
              </Card>
            </>
          ) : null}
        </aside>
      </div>
    </>
  );
}

export default GameForm;
