/**
 * Banner create/edit.
 *
 * Purpose: the text, link and image of one promotional slide.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved banner
 * Deps:    react-hook-form, hooks/useResource, api/operations
 *
 * Legacy counterpart: `views/banners/form.php` plus `banners/upload.php`.
 *
 * Every field is optional, matching the API's write rules — a banner is often
 * just an image and a link. Nothing here is marked required for that reason.
 *
 * The legacy form also carried `color_class`, which the new schema does not
 * have: no query ever read it and the passenger site derives slide styling from
 * the banner *category*'s `type` instead. It is not reintroduced.
 *
 * THE ARTWORK HAS ACCEPTED SIZES, listed under the uploader and enforced on both
 * sides (utils/constants.js BANNER_IMAGE_SIZES, backend BANNER_ACCEPTED_SIZES).
 * A banner carries no type of its own — the rail it appears in does, and it can
 * appear in several — so ANY of the banner sizes is accepted rather than the one
 * belonging to whichever category it happens to be filed under. Filing usually
 * happens after the upload, so a stricter rule would change under the operator
 * as they added the banner to a rail.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useResourceDetail, useResourceMutations } from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as ops from '../../api/operations.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Checkbox, CodeInput, Input } from '../../components/ui/Input.jsx';
import { ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { ImageUpload } from '../../components/form/ImageUpload.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatImageSize } from '../../services/media.js';
import { BANNER_IMAGE_SIZES } from '../../utils/constants.js';

const FIELD_NAMES = [
  'titleFa',
  'titleEn',
  'subtitleFa',
  'subtitleEn',
  'labelFa',
  'labelEn',
  'url',
  'isActive',
];

const EMPTY = {
  titleFa: '',
  titleEn: '',
  subtitleFa: '',
  subtitleEn: '',
  labelFa: '',
  labelEn: '',
  url: '',
  isActive: true,
};

export function BannerForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  useDocumentTitle(isNew ? 'افزودن بنر' : 'ویرایش بنر');

  const detail = useResourceDetail('banners', isNew ? null : id);
  const { create, update } = useResourceMutations('banners');

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
      ...Object.fromEntries(FIELD_NAMES.map((name) => [name, detail.data[name] ?? EMPTY[name]])),
    });
  }, [detail.data, reset]);

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const onSubmit = async (values) => {
    try {
      if (isNew) {
        const created = await create.mutateAsync(values);
        toast.success('بنر ایجاد شد. اکنون می‌توانید تصویر را بارگذاری کنید.');
        navigate(`/banners/${created._id}`, { replace: true });
      } else {
        await update.mutateAsync({ id, payload: values });
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
        title={isNew ? 'افزودن بنر' : detail.data?.titleFa || 'ویرایش بنر'}
        actions={
          <Button variant="ghost" size="sm" to="/banners">
            بازگشت به فهرست
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 ? (
              <FormError error={submitError} />
            ) : null}

            <FieldGrid>
              <Field label="عنوان" error={errors.titleFa}>
                {({ id: fieldId, invalid }) => (
                  <Input id={fieldId} invalid={invalid} {...register('titleFa')} />
                )}
              </Field>

              <Field label="عنوان لاتین">
                {({ id: fieldId }) => <Input id={fieldId} dir="ltr" {...register('titleEn')} />}
              </Field>

              <Field label="زیرعنوان">
                {({ id: fieldId }) => <Input id={fieldId} {...register('subtitleFa')} />}
              </Field>

              <Field label="زیرعنوان لاتین">
                {({ id: fieldId }) => <Input id={fieldId} dir="ltr" {...register('subtitleEn')} />}
              </Field>

              <Field label="برچسب" hint="متن کوتاه روی بنر، مثلاً «جدید».">
                {({ id: fieldId }) => <Input id={fieldId} {...register('labelFa')} />}
              </Field>

              <Field label="برچسب لاتین">
                {({ id: fieldId }) => <Input id={fieldId} dir="ltr" {...register('labelEn')} />}
              </Field>

              <Field
                label="پیوند"
                className="sm:col-span-2"
                hint="نشانی مقصد هنگام کلیک روی بنر."
                error={errors.url}
              >
                {({ id: fieldId, invalid }) => (
                  <CodeInput
                    id={fieldId}
                    invalid={invalid}
                    placeholder="/movie/…"
                    {...register('url')}
                  />
                )}
              </Field>
            </FieldGrid>

            <div className="mt-5 border-t border-line pt-4">
              <Checkbox label="فعال" {...register('isActive')} />
            </div>

            <FormActions>
              <Button variant="ghost" to="/banners">
                انصراف
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {isNew ? 'ایجاد' : 'ذخیره تغییرات'}
              </Button>
            </FormActions>
          </form>
        </Card>

        <aside>
          <Card>
            <ImageUpload
              label="تصویر بنر"
              path={detail.data?.imagePath}
              disabled={isNew || !canEdit('banners')}
              // The wider of the accepted shapes, so the frame does not imply a
              // size that is not on the list.
              aspect="1920 / 360"
              acceptedSizes={BANNER_IMAGE_SIZES}
              onUpload={(file) => ops.uploadBannerImage(id, file)}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ['banners'] })}
            />

            {/* Stated under the uploader, and ALWAYS — `ImageUpload` shows
                either its hint or its disabled reason, never both, and a brand
                new banner needs these figures before it is saved. */}
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs font-bold text-muted">ابعاد مورد تایید</p>
              <ul className="mt-1.5 space-y-1">
                {BANNER_IMAGE_SIZES.map((size) => (
                  <li key={size.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted/80">دستهٔ «{size.label}»</span>
                    <span className="font-mono text-paper" dir="ltr">
                      {formatImageSize(size)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-6 text-muted/80">
                یکی از این دو اندازه پذیرفته می‌شود؛ اندازهٔ دیگر رد می‌شود. بنر نوع مخصوص خودش را
                ندارد و ابعاد نمایش را دسته‌بندی‌ای که در آن قرار می‌گیرد تعیین می‌کند.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default BannerForm;
