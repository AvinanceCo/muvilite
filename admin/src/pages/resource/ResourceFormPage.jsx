/**
 * Generic resource form.
 *
 * Purpose: create and edit any descriptor-driven resource.
 * Inputs:  a descriptor key; the record id comes from the route (`new` creates)
 * Outputs: a create/edit screen
 * Deps:    react-hook-form, hooks/useResource, components/form/*
 *
 * One form serves both modes. On edit the record is loaded and the whole object
 * is sent back on save, because the API applies the SAME validation rules to
 * POST and PUT — a required field omitted from an update is a 422, not a
 * partial write. Sending the full record is therefore not laziness; it is the
 * contract.
 *
 * Server-side validation is authoritative and its 422 is mapped back onto the
 * inputs (components/form/Field applyServerErrors). Client-side rules here only
 * spare a round trip; they never decide what is valid.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useResourceDetail, useResourceMutations } from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { AccessDenied } from '../../components/auth/Guards.jsx';
import { getDescriptor } from './descriptors.jsx';

/** Blank values, so every input is controlled from the first render. */
function emptyValues(fields) {
  const values = { isActive: true };
  for (const field of fields) {
    values[field.name] = field.defaultValue ?? (field.type === 'number' ? '' : '');
  }
  return values;
}

/** The loaded record, reduced to the fields this form owns. */
function recordValues(fields, record) {
  const values = { isActive: record.isActive ?? true };
  for (const field of fields) {
    const value = record[field.name];
    values[field.name] = value === null || value === undefined ? '' : value;
  }
  return values;
}

/** @param {{descriptorKey: string}} props */
export function ResourceFormPage({ descriptorKey }) {
  const descriptor = getDescriptor(descriptorKey);
  const { key, permission, labels, fields, formNote } = descriptor;

  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { canEdit } = usePermissions();

  useDocumentTitle(isNew ? labels.addNew : `ویرایش ${labels.singular}`);

  const detail = useResourceDetail(key, isNew ? null : id);
  const { create, update } = useResourceMutations(key);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: emptyValues(fields) });

  // Populate once the record arrives. `reset` rather than per-field setValue so
  // the form's dirty state starts clean.
  useEffect(() => {
    if (detail.data) {
      reset(recordValues(fields, detail.data));
    }
    // `fields` is a stable module-level array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data, reset]);

  if (!canEdit(permission)) {
    return <AccessDenied page={permission} action="edit" />;
  }

  if (!isNew && detail.isLoading) {
    return <Loader />;
  }

  if (!isNew && detail.error) {
    return <ErrorState error={detail.error} onRetry={detail.refetch} />;
  }

  const onSubmit = async (values) => {
    // Empty numeric inputs arrive as '' and must not be sent as strings.
    const payload = { ...values };
    for (const field of fields) {
      if (field.type === 'number') {
        payload[field.name] = payload[field.name] === '' ? undefined : Number(payload[field.name]);
      }
    }

    try {
      if (isNew) {
        await create.mutateAsync(payload);
        toast.success(`${labels.singular} ایجاد شد.`);
      } else {
        await update.mutateAsync({ id, payload });
        toast.success('تغییرات ذخیره شد.');
      }
      navigate(`/${key}`);
    } catch (error) {
      const unmatched = applyServerErrors(
        error,
        setError,
        fields.map((field) => field.name),
      );
      if (unmatched.length > 0 || Object.keys(error.fieldErrors ?? {}).length === 0) {
        toast.error(unmatched.length > 0 ? unmatched.join('؛ ') : error.message);
      }
    }
  };

  const submitError = create.error ?? update.error;

  return (
    <>
      <PageHeader
        title={isNew ? labels.addNew : `ویرایش ${labels.singular}`}
        description={formNote}
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Only a non-field failure lands here; 422s go to the inputs. */}
          {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 ? (
            <FormError error={submitError} />
          ) : null}

          <FieldGrid>
            {fields.map((field) => (
              <Field
                key={field.name}
                label={field.label}
                required={field.required}
                hint={field.hint}
                error={errors[field.name]}
                className={field.full ? 'sm:col-span-2' : ''}
              >
                {({ id: fieldId, invalid }) =>
                  renderControl(field, fieldId, invalid, register)
                }
              </Field>
            ))}
          </FieldGrid>

          <div className="mt-5 border-t border-line pt-4">
            <Checkbox label="فعال" {...register('isActive')} />
            <p className="mt-1 text-xs text-muted/80">
              موارد غیرفعال در سایت اصلی نمایش داده نمی‌شوند اما در پنل قابل ویرایش می‌مانند.
            </p>
          </div>

          {isNew ? null : (
            <Alert tone="info" className="mt-4">
              ذخیره، همهٔ فیلدهای این فرم را بازنویسی می‌کند.
            </Alert>
          )}

          <FormActions>
            <Button variant="ghost" onClick={() => navigate(`/${key}`)}>
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

/** Maps a descriptor field type onto a control. */
function renderControl(field, id, invalid, register) {
  const rules = {
    ...(field.required ? { required: `${field.label} الزامی است.` } : {}),
    ...(field.maxLength
      ? { maxLength: { value: field.maxLength, message: `حداکثر ${field.maxLength} نویسه.` } }
      : {}),
    ...(field.type === 'number' && field.min !== undefined
      ? { min: { value: field.min, message: `کمتر از ${field.min} مجاز نیست.` } }
      : {}),
  };

  const common = { id, invalid, dir: field.dir, ...register(field.name, rules) };

  switch (field.type) {
    case 'textarea':
      return <Textarea rows={field.rows ?? 4} {...common} />;
    case 'select':
      return <Select options={field.options ?? []} placeholder={field.placeholder} {...common} />;
    case 'number':
      return <Input type="number" min={field.min} max={field.max} {...common} />;
    default:
      return <Input {...common} />;
  }
}

export default ResourceFormPage;
