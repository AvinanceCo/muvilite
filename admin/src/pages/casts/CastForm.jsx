/**
 * Cast create/edit.
 *
 * Purpose: record a person and their photo.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved cast document
 * Deps:    react-hook-form, hooks/useResource, api/operations
 *
 * Legacy counterpart: `views/casts/form.php` plus `casts/upload.php`.
 *
 * `birthDate` is a real date here, unlike a movie's publish year — the schema
 * stores a Date and the API validates ISO 8601. It is entered with the native
 * date input, which shows the operator's locale calendar; the value on the wire
 * is always ISO.
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
import { Checkbox, Input, Textarea } from '../../components/ui/Input.jsx';
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

const FIELD_NAMES = ['fullnameFa', 'fullnameEn', 'birthDate', 'briefFa', 'briefEn', 'isActive'];

const EMPTY = {
  fullnameFa: '',
  fullnameEn: '',
  birthDate: '',
  briefFa: '',
  briefEn: '',
  isActive: true,
};

/** A stored ISO timestamp as the `yyyy-mm-dd` the date input requires. */
function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function CastForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  useDocumentTitle(isNew ? 'افزودن شخصیت' : 'ویرایش شخصیت');

  const detail = useResourceDetail('casts', isNew ? null : id);
  const { create, update } = useResourceMutations('casts');

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
      birthDate: toDateInput(detail.data.birthDate),
    });
  }, [detail.data, reset]);

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      // An empty date input must not be sent as '', which fails ISO8601.
      birthDate: values.birthDate || undefined,
    };

    try {
      if (isNew) {
        const created = await create.mutateAsync(payload);
        toast.success('شخصیت ایجاد شد. اکنون می‌توانید تصویر را بارگذاری کنید.');
        navigate(`/casts/${created._id}`, { replace: true });
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
        title={isNew ? 'افزودن شخصیت' : detail.data?.fullnameFa || 'ویرایش شخصیت'}
        actions={
          <Button variant="ghost" size="sm" to="/casts">
            بازگشت به فهرست
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 ? (
              <FormError error={submitError} />
            ) : null}

            <FieldGrid>
              <Field label="نام" required error={errors.fullnameFa}>
                {({ id: fieldId, invalid }) => (
                  <Input
                    id={fieldId}
                    invalid={invalid}
                    {...register('fullnameFa', {
                      required: 'نام الزامی است.',
                      maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                    })}
                  />
                )}
              </Field>

              <Field label="نام لاتین">
                {({ id: fieldId }) => (
                  <Input id={fieldId} dir="ltr" {...register('fullnameEn')} />
                )}
              </Field>

              <Field label="تاریخ تولد">
                {({ id: fieldId }) => (
                  <Input id={fieldId} type="date" dir="ltr" {...register('birthDate')} />
                )}
              </Field>

              <div />

              <Field label="معرفی فارسی" className="sm:col-span-2">
                {({ id: fieldId }) => <Textarea id={fieldId} rows={4} {...register('briefFa')} />}
              </Field>

              <Field label="معرفی انگلیسی" className="sm:col-span-2">
                {({ id: fieldId }) => (
                  <Textarea id={fieldId} rows={4} dir="ltr" {...register('briefEn')} />
                )}
              </Field>
            </FieldGrid>

            <div className="mt-5 border-t border-line pt-4">
              <Checkbox label="فعال" {...register('isActive')} />
            </div>

            <FormActions>
              <Button variant="ghost" to="/casts">
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
              label="تصویر"
              path={detail.data?.photoPath}
              disabled={isNew || !canEdit('casts')}
              aspect="1 / 1"
              onUpload={(file) => ops.uploadCastPhoto(id, file)}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ['casts'] })}
            />
          </Card>
        </aside>
      </div>
    </>
  );
}

export default CastForm;
