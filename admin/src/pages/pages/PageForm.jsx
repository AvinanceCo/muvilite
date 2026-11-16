/**
 * Page create/edit.
 *
 * Purpose: the metadata of a landing page. Its contents live in the composer.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved page
 * Deps:    react-hook-form, hooks/useResource
 *
 * Legacy counterpart: `views/pages/_form.php`, `create.php` and `edit.php`.
 *
 * The slug is the stable address the passenger site links to
 * (`GET /api/pages/:idOrSlug` resolves either an id or a slug, and the client
 * routes as `/page/film`). It is unique and must match `^[a-z0-9-]+$`; a
 * duplicate comes back as a 409, which lands on the field.
 *
 * CHANGING A SLUG BREAKS EXISTING LINKS — the old address stops resolving, with
 * no redirect anywhere in the stack. The form says so rather than leaving it to
 * be discovered.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useResourceDetail, useResourceMutations } from '../../hooks/useResource.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Checkbox, CodeInput, Input, Textarea } from '../../components/ui/Input.jsx';
import { ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

const FIELD_NAMES = [
  'titleFa',
  'titleEn',
  'slug',
  'descriptionFa',
  'descriptionEn',
  'tags',
  'isActive',
];

const EMPTY = {
  titleFa: '',
  titleEn: '',
  slug: '',
  descriptionFa: '',
  descriptionEn: '',
  tags: '',
  isActive: true,
};

export function PageForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentTitle(isNew ? 'افزودن برگه' : 'ویرایش برگه');

  const detail = useResourceDetail('pages', isNew ? null : id);
  const { create, update } = useResourceMutations('pages');

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
    // The API rejects a slug that is not lowercase-kebab; an empty one is fine
    // (the field is sparse-unique) but an empty string is not the same as absent.
    const payload = { ...values, slug: values.slug || undefined };

    try {
      if (isNew) {
        const created = await create.mutateAsync(payload);
        toast.success('برگه ایجاد شد. اکنون بلوک‌ها را اضافه کنید.');
        navigate(`/pages/${created._id}/blocks`);
      } else {
        await update.mutateAsync({ id, payload });
        toast.success('تغییرات ذخیره شد.');
        navigate('/pages');
      }
    } catch (error) {
      // A duplicate slug is a 409 with no field errors; point it at the field.
      if (error.isConflict) {
        setError('slug', { type: 'server', message: 'این نشانی قبلاً استفاده شده است.' });
        return;
      }

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
        title={isNew ? 'افزودن برگه' : detail.data?.titleFa || 'ویرایش برگه'}
        actions={
          <>
            {!isNew ? (
              <Button variant="subtle" size="sm" to={`/pages/${id}/blocks`}>
                بلوک ها
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" to="/pages">
              بازگشت به فهرست
            </Button>
          </>
        }
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 && !submitError.isConflict ? (
            <FormError error={submitError} />
          ) : null}

          <FieldGrid>
            <Field label="عنوان" required error={errors.titleFa}>
              {({ id: fieldId, invalid }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  {...register('titleFa', {
                    required: 'عنوان الزامی است.',
                    maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                  })}
                />
              )}
            </Field>

            <Field label="عنوان لاتین">
              {({ id: fieldId }) => <Input id={fieldId} dir="ltr" {...register('titleEn')} />}
            </Field>

            <Field
              label="نشانی (slug)"
              error={errors.slug}
              hint={
                isNew
                  ? 'فقط حروف کوچک انگلیسی، عدد و خط تیره. مثال: film'
                  : 'تغییر نشانی، پیوندهای موجود به این برگه را از کار می‌اندازد.'
              }
            >
              {({ id: fieldId, invalid }) => (
                <CodeInput
                  id={fieldId}
                  invalid={invalid}
                  placeholder="film"
                  {...register('slug', {
                    pattern: {
                      value: /^[a-z0-9-]+$/,
                      message: 'فقط حروف کوچک انگلیسی، عدد و خط تیره.',
                    },
                    maxLength: { value: 100, message: 'حداکثر ۱۰۰ نویسه.' },
                  })}
                />
              )}
            </Field>

            <Field label="برچسب ها" hint="با ویرگول جدا کنید.">
              {({ id: fieldId }) => <Input id={fieldId} {...register('tags')} />}
            </Field>

            <Field label="توضیح فارسی" className="sm:col-span-2">
              {({ id: fieldId }) => (
                <Textarea id={fieldId} rows={3} {...register('descriptionFa')} />
              )}
            </Field>

            <Field label="توضیح انگلیسی" className="sm:col-span-2">
              {({ id: fieldId }) => (
                <Textarea id={fieldId} rows={3} dir="ltr" {...register('descriptionEn')} />
              )}
            </Field>
          </FieldGrid>

          <div className="mt-5 border-t border-line pt-4">
            <Checkbox label="فعال" {...register('isActive')} />
            <p className="mt-1 text-xs text-muted/80">
              برگهٔ غیرفعال در سایت اصلی با خطای «یافت نشد» پاسخ داده می‌شود.
            </p>
          </div>

          <FormActions>
            <Button variant="ghost" to="/pages">
              انصراف
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isNew ? 'ایجاد و افزودن بلوک' : 'ذخیره تغییرات'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </>
  );
}

export default PageForm;
