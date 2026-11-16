/**
 * Music create/edit.
 *
 * Purpose: album metadata, cover art, the track list and category membership.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved music document
 * Deps:    react-hook-form, hooks/useResource, api/operations, ./TrackEditor
 *
 * Legacy counterpart: `views/musics/form.php` plus `musics/upload.php` and
 * `musics/categories.php`.
 *
 * `tracks` is NOT part of this form's payload. The resource's POST/PUT
 * validators do not accept it; tracks have their own two-step endpoint, which
 * TrackEditor owns. Adding `tracks` to the save here would be silently dropped
 * at best.
 *
 * `isIranian` is not cosmetic: the passenger site renders the publish year in
 * the Jalali calendar when it is set. The stored year itself is unaffected.
 *
 * «ژانر موسیقی» IS NEW and has no legacy ancestor — `musics_tbl` had no genre
 * column. It reads its own taxonomy (`/music-genres`), NOT the film genres, so
 * the two vocabularies never mix. It is deliberately shown here and nowhere
 * else: not on the music list, and not on the passenger site, which is what the
 * maintainer asked for. Surfacing it elsewhere means adding it to the public
 * music shape in the backend's services/music.service.js first.
 */
import { useEffect } from 'react';
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
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { ImageUpload } from '../../components/form/ImageUpload.jsx';
import { RelationPicker } from '../../components/form/RelationPicker.jsx';
import { TrackEditor } from './TrackEditor.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

const FIELD_NAMES = [
  'fullnameFa',
  'fullnameEn',
  'albumFa',
  'albumEn',
  'genre',
  'descriptionFa',
  'descriptionEn',
  'publishYear',
  'tags',
  'company',
  'isIranian',
  'isActive',
];

const EMPTY = {
  fullnameFa: '',
  fullnameEn: '',
  albumFa: '',
  albumEn: '',
  genre: '',
  descriptionFa: '',
  descriptionEn: '',
  publishYear: '',
  tags: '',
  company: '',
  isIranian: false,
  isActive: true,
};

export function MusicForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit, canDelete } = usePermissions();

  useDocumentTitle(isNew ? 'افزودن آلبوم' : 'ویرایش آلبوم');

  const detail = useResourceDetail('musics', isNew ? null : id);
  const { create, update } = useResourceMutations('musics');

  // The MUSIC taxonomy, not the film one — a separate collection, so a film
  // genre can never appear in this dropdown. Managed at /music-genres.
  const { options: genreOptions } = useLookupOptions('music-genres');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY });

  useEffect(() => {
    if (!detail.data) return;
    reset({
      ...EMPTY,
      ...Object.fromEntries(
        FIELD_NAMES.map((name) => [name, detail.data[name] ?? EMPTY[name]]),
      ),
      // Populated by the API; the select wants the id.
      genre: detail.data.genre?._id ?? '',
    });
  }, [detail.data, reset]);

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      publishYear: values.publishYear === '' ? undefined : Number(values.publishYear),
      // An empty select clears the genre, which the API accepts as ''.
      genre: values.genre || '',
    };

    try {
      if (isNew) {
        const created = await create.mutateAsync(payload);
        toast.success('آلبوم ایجاد شد. اکنون می‌توانید جلد و قطعات را اضافه کنید.');
        navigate(`/musics/${created._id}`, { replace: true });
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

  return (
    <>
      <PageHeader
        title={isNew ? 'افزودن آلبوم' : detail.data?.albumFa || detail.data?.fullnameFa || 'ویرایش آلبوم'}
        actions={
          <Button variant="ghost" size="sm" to="/musics">
            بازگشت به فهرست
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 ? (
                <FormError error={submitError} />
              ) : null}

              <FieldGrid>
                <Field label="نام هنرمند" required error={errors.fullnameFa}>
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      {...register('fullnameFa', {
                        required: 'نام هنرمند الزامی است.',
                        maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                      })}
                    />
                  )}
                </Field>

                <Field label="نام لاتین هنرمند">
                  {({ id: fieldId }) => (
                    <Input id={fieldId} dir="ltr" {...register('fullnameEn')} />
                  )}
                </Field>

                <Field label="نام آلبوم">
                  {({ id: fieldId }) => <Input id={fieldId} {...register('albumFa')} />}
                </Field>

                <Field label="نام لاتین آلبوم">
                  {({ id: fieldId }) => <Input id={fieldId} dir="ltr" {...register('albumEn')} />}
                </Field>

                {/* The music taxonomy. It appears here and nowhere else — not on
                    the film form, and not on the passenger site. */}
                <Field label="ژانر موسیقی" error={errors.genre}>
                  {({ id: fieldId, invalid }) => (
                    <Select
                      id={fieldId}
                      invalid={invalid}
                      options={genreOptions}
                      placeholder="—"
                      {...register('genre')}
                    />
                  )}
                </Field>

                <Field
                  label="سال انتشار"
                  error={errors.publishYear}
                  hint="سال میلادی ذخیره می‌شود."
                >
                  {({ id: fieldId, invalid }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      type="number"
                      dir="ltr"
                      {...register('publishYear', {
                        min: { value: 1000, message: 'سال نامعتبر است.' },
                        max: { value: 2200, message: 'سال نامعتبر است.' },
                      })}
                    />
                  )}
                </Field>

                <Field label="ناشر">
                  {({ id: fieldId }) => <Input id={fieldId} {...register('company')} />}
                </Field>

                <Field label="برچسب ها" className="sm:col-span-2" hint="با ویرگول جدا کنید.">
                  {({ id: fieldId }) => <Input id={fieldId} {...register('tags')} />}
                </Field>

                <Field label="توضیحات فارسی" className="sm:col-span-2">
                  {({ id: fieldId }) => (
                    <Textarea id={fieldId} rows={4} {...register('descriptionFa')} />
                  )}
                </Field>

                <Field label="توضیحات انگلیسی" className="sm:col-span-2">
                  {({ id: fieldId }) => (
                    <Textarea id={fieldId} rows={4} dir="ltr" {...register('descriptionEn')} />
                  )}
                </Field>
              </FieldGrid>

              <div className="mt-5 flex flex-wrap gap-5 border-t border-line pt-4">
                <Checkbox label="فعال" {...register('isActive')} />
                <Checkbox label="ایرانی" {...register('isIranian')} />
              </div>
              <p className="mt-1 text-xs text-muted/80">
                برای آثار ایرانی، سال انتشار در سایت اصلی به تقویم شمسی نمایش داده می‌شود.
              </p>

              <FormActions>
                <Button variant="ghost" to="/musics">
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
              <Card>
                <TrackEditor
                  musicId={id}
                  tracks={detail.data?.tracks ?? []}
                  canEdit={canEdit('musics')}
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ['musics'] })}
                />
              </Card>

              <MusicCategories
                musicId={id}
                canEdit={canEdit('categories')}
                canDelete={canDelete('categories')}
              />
            </>
          ) : null}
        </div>

        <aside>
          <Card>
            <ImageUpload
              label="جلد"
              path={detail.data?.coverPath}
              disabled={isNew || !canEdit('musics')}
              aspect="1 / 1"
              onUpload={(file) => ops.uploadMusicCover(id, file)}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ['musics'] })}
            />
          </Card>
        </aside>
      </div>
    </>
  );
}

/** Music-category membership. Gated on `categories`, as the API requires. */
function MusicCategories({ musicId, canEdit, canDelete }) {
  const queryClient = useQueryClient();

  const links = useQuery({
    queryKey: ['musics', 'categories', musicId],
    queryFn: () => ops.fetchMusicCategories(musicId),
  });

  const { options } = useLookupOptions('music-categories');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['musics', 'categories', musicId] });

  const rows = (links.data ?? []).map((link) => ({
    key: link._id,
    id: link.category?._id,
    label: link.category?.nameFa ?? '—',
    link,
  }));

  return (
    <Card>
      <SectionHeader title="دسته بندی ها" />
      <RelationPicker
        rows={rows}
        options={options}
        loading={links.isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        addPlaceholder="انتخاب دسته بندی"
        emptyLabel="در هیچ دسته‌بندی‌ای نیست"
        onAdd={async (value) => {
          await ops.addMusicCategory({ category: value, item: musicId });
          await invalidate();
        }}
        onRemove={async (row) => {
          await ops.removeMusicCategory({
            category: row.link.category?._id ?? row.link.category,
            item: musicId,
          });
          await invalidate();
        }}
      />
    </Card>
  );
}

export default MusicForm;
