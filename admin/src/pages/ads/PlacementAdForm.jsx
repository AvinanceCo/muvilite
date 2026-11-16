/**
 * Landing-page advertisement create/edit.
 *
 * Purpose: the slot, link, ordering and two artworks of one still ad.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved placement ad
 * Deps:    react-hook-form, hooks/useResource, api/operations
 *
 * NEW SCREEN. It replaces editing `index.php` by hand.
 *
 * TWO IMAGES, NOT ONE. Each legacy slot contained two anchors and the
 * stylesheet chose between them by viewport orientation:
 *
 *     .ads>a:last-child { display: none }
 *     @media (orientation:landscape) {
 *       .ads>a:first-child { display: none }
 *       .ads>a:last-child  { display: initial }
 *     }
 *
 * So the first artwork is the narrow one — «موبایل» here — and the second the
 * wide one — «دسکتاپ». That installation shipped the same GIF twice, which is
 * why the desktop upload is optional: leaving it empty reproduces exactly that,
 * with the mobile artwork served in both orientations.
 *
 * EACH VARIANT HAS ONE ACCEPTED SIZE (utils/constants.js AD_PLACEMENTS). The
 * file is measured before it is sent and the server measures it again, so
 * artwork prepared for the wrong slot is refused rather than stretched into
 * place the way the legacy CSS did.
 *
 * Animated GIFs are accepted, since that is what the legacy slots used.
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
import { Checkbox, CodeInput, Input, Select } from '../../components/ui/Input.jsx';
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
import { AD_PLACEMENTS, AD_VARIANT_LABELS } from '../../utils/constants.js';
import { formatImageSize } from '../../services/media.js';

const FIELD_NAMES = ['titleFa', 'placement', 'url', 'order', 'isActive'];

const EMPTY = {
  titleFa: '',
  placement: 'top',
  url: '',
  order: 0,
  isActive: true,
};

const PLACEMENT_OPTIONS = AD_PLACEMENTS.map(({ value, label }) => ({ value, label }));

/** Everything the upload panels need to describe the selected slot. */
const slotFor = (placement) =>
  AD_PLACEMENTS.find((entry) => entry.value === placement) ?? AD_PLACEMENTS[0];

export function PlacementAdForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  useDocumentTitle(isNew ? 'افزودن تبلیغ صفحهٔ اصلی' : 'ویرایش تبلیغ صفحهٔ اصلی');

  const detail = useResourceDetail('placement-ads', isNew ? null : id);
  const { create, update } = useResourceMutations('placement-ads');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY });

  useEffect(() => {
    if (!detail.data) return;
    reset({
      ...EMPTY,
      ...Object.fromEntries(FIELD_NAMES.map((name) => [name, detail.data[name] ?? EMPTY[name]])),
    });
  }, [detail.data, reset]);

  // Watched so the upload panels re-shape and re-describe themselves the moment
  // the operator changes the slot, rather than after a save round trip.
  const slot = slotFor(watch('placement'));

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const onSubmit = async (values) => {
    const payload = { ...values, order: Number(values.order) || 0 };

    try {
      if (isNew) {
        const created = await create.mutateAsync(payload);
        toast.success('تبلیغ ایجاد شد. اکنون می‌توانید تصویر را بارگذاری کنید.');
        navigate(`/placement-ads/${created._id}`, { replace: true });
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
  const invalidateAds = () => queryClient.invalidateQueries({ queryKey: ['placement-ads'] });

  return (
    <>
      <PageHeader
        title={isNew ? 'افزودن تبلیغ صفحهٔ اصلی' : detail.data?.titleFa || 'ویرایش تبلیغ'}
        actions={
          <Button variant="ghost" size="sm" to="/placement-ads">
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
              <Field
                label="عنوان"
                hint="فقط برای شناسایی در پنل؛ روی تصویر نمایش داده نمی‌شود."
                error={errors.titleFa}
              >
                {({ id: fieldId, invalid }) => (
                  <Input id={fieldId} invalid={invalid} {...register('titleFa')} />
                )}
              </Field>

              <Field label="جایگاه" required error={errors.placement}>
                {({ id: fieldId, invalid }) => (
                  <Select
                    id={fieldId}
                    invalid={invalid}
                    options={PLACEMENT_OPTIONS}
                    {...register('placement', { required: 'جایگاه الزامی است.' })}
                  />
                )}
              </Field>

              <Field
                label="ترتیب نمایش"
                hint="اگر چند تبلیغ در یک جایگاه باشد، کوچک‌تر بالاتر نمایش داده می‌شود."
                error={errors.order}
              >
                {({ id: fieldId, invalid }) => (
                  <Input
                    id={fieldId}
                    type="number"
                    min={0}
                    invalid={invalid}
                    {...register('order', { min: { value: 0, message: 'کمتر از صفر مجاز نیست.' } })}
                  />
                )}
              </Field>

              <Field
                label="پیوند"
                hint="با کلیک روی تبلیغ باز می‌شود. خالی بگذارید تا تبلیغ قابل کلیک نباشد."
                error={errors.url}
              >
                {({ id: fieldId, invalid }) => (
                  <CodeInput
                    id={fieldId}
                    invalid={invalid}
                    placeholder="https://…"
                    {...register('url')}
                  />
                )}
              </Field>
            </FieldGrid>

            <div className="mt-5 border-t border-line pt-4">
              <Checkbox label="فعال" {...register('isActive')} />
              <p className="mt-1 text-xs text-muted/80">
                تبلیغ غیرفعال، و همچنین تبلیغ بدون تصویر، در سایت اصلی نمایش داده نمی‌شود.
              </p>
            </div>

            <FormActions>
              <Button variant="ghost" to="/placement-ads">
                انصراف
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {isNew ? 'ایجاد' : 'ذخیره تغییرات'}
              </Button>
            </FormActions>
          </form>
        </Card>

        <aside className="flex flex-col gap-5">
          <Card>
            <p className="text-xs font-bold text-muted">محل نمایش</p>
            <p className="mt-1 text-xs leading-6 text-muted/80">{slot.where}</p>
            {/* Both accepted sizes together, so the artwork can be prepared
                before either upload panel is opened. */}
            <p className="mt-2 text-xs leading-6 text-muted/80">
              اندازهٔ مجاز — {AD_VARIANT_LABELS.mobile}: {formatImageSize(slot.variants.mobile)} پیکسل،{' '}
              {AD_VARIANT_LABELS.desktop}: {formatImageSize(slot.variants.desktop)} پیکسل.
            </p>
          </Card>

          <Card>
            <ImageUpload
              label={`تصویر ${AD_VARIANT_LABELS.mobile}`}
              path={detail.data?.imagePath}
              disabled={isNew || !canEdit('ads')}
              aspect={slot.variants.mobile.aspect}
              acceptedSizes={[slot.variants.mobile]}
              hint={`اندازه باید دقیقاً ${formatImageSize(slot.variants.mobile)} پیکسل باشد. GIF متحرک هم پذیرفته می‌شود.`}
              onUpload={(file) => ops.uploadPlacementAdImage(id, file, 'portrait')}
              onUploaded={invalidateAds}
            />
          </Card>

          <Card>
            <ImageUpload
              label={`تصویر ${AD_VARIANT_LABELS.desktop}`}
              path={detail.data?.imageLandscapePath}
              disabled={isNew || !canEdit('ads')}
              aspect={slot.variants.desktop.aspect}
              acceptedSizes={[slot.variants.desktop]}
              hint={
                `اندازه باید دقیقاً ${formatImageSize(slot.variants.desktop)} پیکسل باشد. ` +
                `اختیاری است: اگر خالی بماند، روی نمایشگرهای عریض هم همان تصویر ${AD_VARIANT_LABELS.mobile} نمایش داده می‌شود.`
              }
              onUpload={(file) => ops.uploadPlacementAdImage(id, file, 'landscape')}
              onUploaded={invalidateAds}
            />
          </Card>
        </aside>
      </div>
    </>
  );
}

export default PlacementAdForm;
