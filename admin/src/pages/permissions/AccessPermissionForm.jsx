/**
 * Access permission editor.
 *
 * Purpose: define one permission — a section plus the actions it grants —
 *          which groups can then hold.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved access permission
 * Deps:    react-hook-form, hooks/useResource
 *
 * NEW TO THE UI. The legacy panel had no editor for these: the rows were
 * seeded into `access_permission_tbl` directly and `views/groups/form.php` only
 * picked from whatever was there. The API exposes full CRUD, so the panel does.
 *
 * `actionPage` is a CLOSED ENUM of thirteen values, enforced by the backend
 * schema. It is a select, not a text field, because a typo would create a
 * permission that guards nothing and silently grants nothing — the sparse
 * permission map makes that failure invisible.
 *
 * Own screen rather than a descriptor because of the three action checkboxes,
 * which no descriptor field type expresses.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useResourceDetail, useResourceMutations } from '../../hooks/useResource.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Checkbox, Input, Select } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PERMISSION_PAGES } from '../../utils/constants.js';

const FIELD_NAMES = [
  'displayName',
  'actionPage',
  'actionView',
  'actionEdit',
  'actionDelete',
  'isActive',
];

const EMPTY = {
  displayName: '',
  actionPage: '',
  actionView: true,
  actionEdit: false,
  actionDelete: false,
  isActive: true,
};

export function AccessPermissionForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentTitle(isNew ? 'افزودن مجوز' : 'ویرایش مجوز');

  const detail = useResourceDetail('access-permissions', isNew ? null : id);
  const { create, update } = useResourceMutations('access-permissions');

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
        await create.mutateAsync(values);
        toast.success('مجوز ایجاد شد.');
      } else {
        await update.mutateAsync({ id, payload: values });
        toast.success('تغییرات ذخیره شد.');
      }
      navigate('/access-permissions');
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
        title={isNew ? 'افزودن مجوز دسترسی' : 'ویرایش مجوز دسترسی'}
        description="مجوز به تنهایی اثری ندارد؛ باید به یک گروه دسترسی داده شود."
        actions={
          <Button variant="ghost" size="sm" to="/access-permissions">
            بازگشت به فهرست
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 ? (
            <FormError error={submitError} />
          ) : null}

          <FieldGrid>
            <Field
              label="عنوان"
              required
              error={errors.displayName}
              hint="در فهرست گروه‌ها نمایش داده می‌شود، مثلاً «مدیریت کامل فیلم ها»."
            >
              {({ id: fieldId, invalid }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  {...register('displayName', {
                    required: 'عنوان الزامی است.',
                    maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                  })}
                />
              )}
            </Field>

            <Field
              label="بخش"
              required
              error={errors.actionPage}
              hint="فهرست بخش‌ها ثابت است و در سرور تعریف شده."
            >
              {({ id: fieldId, invalid }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  options={PERMISSION_PAGES.map((page) => ({
                    value: page.key,
                    label: `${page.label} (${page.key})`,
                  }))}
                  placeholder="انتخاب کنید"
                  {...register('actionPage', { required: 'بخش را انتخاب کنید.' })}
                />
              )}
            </Field>
          </FieldGrid>

          <fieldset className="mt-5 rounded-lg border border-line p-4">
            <legend className="px-2 text-xs font-bold text-muted">اقدامات مجاز</legend>

            <div className="flex flex-wrap gap-6">
              <Checkbox label="مشاهده" {...register('actionView')} />
              <Checkbox label="ویرایش" {...register('actionEdit')} />
              <Checkbox label="حذف" {...register('actionDelete')} />
            </div>

            <Alert tone="info" className="mt-4">
              «ویرایش» شامل ایجاد و تغییر وضعیت هم می‌شود. بدون «مشاهده»، بخش در منو دیده نمی‌شود
              حتی اگر ویرایش داده شده باشد.
            </Alert>
          </fieldset>

          <div className="mt-5 border-t border-line pt-4">
            <Checkbox label="فعال" {...register('isActive')} />
          </div>

          <FormActions>
            <Button variant="ghost" to="/access-permissions">
              انصراف
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isNew ? 'ایجاد' : 'ذخیره تغییرات'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </>
  );
}

export default AccessPermissionForm;
