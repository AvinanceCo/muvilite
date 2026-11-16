/**
 * Pre-roll advertisement create/edit.
 *
 * Purpose: the text, timing and video file of one creative.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved creative
 * Deps:    react-hook-form, hooks/useResource, api/operations
 *
 * NEW SCREEN. This form replaces hand-editing a VAST document; each field is
 * the element it becomes in the tag the server generates
 * (backend services/ad.service.js):
 *
 *   عنوان            -> <AdTitle>, and the title stored on every telemetry row
 *   مدت زمان         -> <Duration>
 *   رد شدن پس از     -> Linear@skipoffset  (every legacy file used 3 seconds)
 *   پیوند            -> <ClickThrough>     (no legacy file had one)
 *   فایل ویدئو       -> <MediaFile>
 *
 * `durationSecond` is NOT sent by this form. It is written by the upload, from
 * the file the browser measured, so the two can never disagree — the field below
 * is read-only and shows what was measured.
 *
 * Selection is weighted, and equal weights reproduce the legacy uniform draw.
 * That is worth stating on the form, because "weight" means nothing on its own:
 * it is only ever relative to the other active creatives.
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
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { VideoUpload } from '../../components/form/VideoUpload.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatTimecode } from '../../services/format.js';

/** The fields this form owns. `durationSecond` and `videoPath` are not among them. */
const FIELD_NAMES = ['titleFa', 'titleEn', 'skipOffsetSecond', 'weight', 'clickUrl', 'isActive'];

const EMPTY = {
  titleFa: '',
  titleEn: '',
  // The legacy default, from `skipoffset="00:00:03"` in every VAST file.
  skipOffsetSecond: 3,
  weight: 1,
  clickUrl: '',
  isActive: true,
};

export function VideoAdForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  useDocumentTitle(isNew ? 'افزودن تبلیغ' : 'ویرایش تبلیغ');

  const detail = useResourceDetail('video-ads', isNew ? null : id);
  const { create, update } = useResourceMutations('video-ads');

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
    const payload = {
      ...values,
      // Number inputs arrive as strings from the DOM; the API rejects those.
      skipOffsetSecond: Number(values.skipOffsetSecond),
      weight: Number(values.weight),
    };

    try {
      if (isNew) {
        const created = await create.mutateAsync(payload);
        toast.success('تبلیغ ایجاد شد. اکنون فایل ویدئو را بارگذاری کنید.');
        navigate(`/video-ads/${created._id}`, { replace: true });
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
        title={isNew ? 'افزودن تبلیغ پیش از پخش' : detail.data?.titleFa || 'ویرایش تبلیغ'}
        actions={
          <Button variant="ghost" size="sm" to="/video-ads">
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
                required
                hint="در گزارش «سوابق نمایش تبلیغ» با همین عنوان ثبت می‌شود."
                error={errors.titleFa}
              >
                {({ id: fieldId, invalid }) => (
                  <Input
                    id={fieldId}
                    invalid={invalid}
                    {...register('titleFa', { required: 'عنوان الزامی است.' })}
                  />
                )}
              </Field>

              <Field label="عنوان لاتین">
                {({ id: fieldId }) => <Input id={fieldId} dir="ltr" {...register('titleEn')} />}
              </Field>

              <Field
                label="رد شدن پس از (ثانیه)"
                hint="پیش از این زمان دکمهٔ رد کردن نمایش داده نمی‌شود. مقدار قدیمی سامانه ۳ بود."
                error={errors.skipOffsetSecond}
              >
                {({ id: fieldId, invalid }) => (
                  <Input
                    id={fieldId}
                    type="number"
                    min={0}
                    max={300}
                    invalid={invalid}
                    {...register('skipOffsetSecond', {
                      min: { value: 0, message: 'کمتر از صفر مجاز نیست.' },
                    })}
                  />
                )}
              </Field>

              <Field
                label="وزن انتخاب"
                hint="نسبت پخش در برابر بقیهٔ تبلیغ‌های فعال. وزن‌های برابر یعنی انتخاب کاملاً تصادفی؛ صفر یعنی هرگز پخش نشود."
                error={errors.weight}
              >
                {({ id: fieldId, invalid }) => (
                  <Input
                    id={fieldId}
                    type="number"
                    min={0}
                    max={1000}
                    invalid={invalid}
                    {...register('weight', {
                      min: { value: 0, message: 'کمتر از صفر مجاز نیست.' },
                    })}
                  />
                )}
              </Field>

              <Field
                label="پیوند تبلیغ"
                className="sm:col-span-2"
                hint="با کلیک روی تبلیغ باز می‌شود. خالی بگذارید تا تبلیغ قابل کلیک نباشد."
                error={errors.clickUrl}
              >
                {({ id: fieldId, invalid }) => (
                  <CodeInput
                    id={fieldId}
                    invalid={invalid}
                    placeholder="https://…"
                    {...register('clickUrl')}
                  />
                )}
              </Field>
            </FieldGrid>

            <div className="mt-5 border-t border-line pt-4">
              <Checkbox label="فعال" {...register('isActive')} />
              <p className="mt-1 text-xs text-muted/80">
                تبلیغ غیرفعال هرگز انتخاب نمی‌شود. تبلیغی هم که فایل ویدئو نداشته باشد پخش نمی‌شود.
              </p>
            </div>

            <FormActions>
              <Button variant="ghost" to="/video-ads">
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
            <VideoUpload
              label="فایل ویدئو"
              path={detail.data?.videoPath}
              durationSecond={detail.data?.durationSecond}
              disabled={isNew || !canEdit('ads')}
              hint="MP4 یا WebM. مدت زمان به‌صورت خودکار از روی فایل خوانده و ثبت می‌شود."
              onUpload={(file, duration) => ops.uploadVideoAdFile(id, file, duration)}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ['video-ads'] })}
            />
          </Card>

          {!isNew && detail.data && !detail.data.videoPath ? (
            <Alert tone="warning" title="این تبلیغ پخش نمی‌شود">
              تا وقتی فایل ویدئو بارگذاری نشده باشد، این تبلیغ در انتخاب سرور نادیده گرفته می‌شود.
            </Alert>
          ) : null}

          {!isNew && detail.data?.durationSecond ? (
            <Card>
              <p className="text-xs font-bold text-muted">مدت زمان اعلام‌شده</p>
              <p className="mt-1 font-mono text-lg text-paper">
                {formatTimecode(detail.data.durationSecond)}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted/80">
                از روی فایل اندازه‌گیری شده و در تگ VAST اعلام می‌شود. با بارگذاری فایل تازه
                به‌روزرسانی می‌شود.
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

export default VideoAdForm;
