/**
 * User create/edit.
 *
 * Purpose: an account's identity, its permission group, its categories, and an
 *          administrative password reset.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved user
 * Deps:    react-hook-form, api/operations, hooks/useResource
 *
 * Legacy counterpart: `views/users/form.php`.
 *
 * PASSWORDS BEHAVE DIFFERENTLY ON CREATE AND EDIT, and conflating them is the
 * mistake to avoid:
 *   - create: `password` is REQUIRED, at least 6 characters;
 *   - edit:   the field is absent from this form entirely. Sending an empty
 *             string is a 422, and sending a new one silently through the
 *             normal save would make an accidental keystroke a password change.
 *             Resetting is a separate, deliberate action with its own endpoint
 *             (`PATCH /users/:id/password`) — no current-password challenge,
 *             because this is an administrator acting on someone else's
 *             account. Changing YOUR OWN password is on the profile screen and
 *             does require it.
 *
 * `provinceId` and `cityId` exist on the model but no endpoint accepts them and
 * no lookup serves the cascade, so the legacy `views/users/cities.php` screen
 * is not ported — see admin/MIGRATION.md.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ops from '../../api/operations.js';
import { useLookupOptions } from '../../hooks/useResource.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader } from '../../components/ui/Card.jsx';
import { Checkbox, CodeInput, Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import {
  Field,
  FieldGrid,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

const FIELD_NAMES = [
  'mobile',
  'password',
  'firstname',
  'lastname',
  'displayName',
  'email',
  'comment',
  'permissionGroup',
  'isActive',
];

const EMPTY = {
  mobile: '',
  password: '',
  firstname: '',
  lastname: '',
  displayName: '',
  email: '',
  comment: '',
  permissionGroup: '',
  isActive: true,
  categories: [],
};

export function UserForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, refresh } = useAuth();
  const [resetOpen, setResetOpen] = useState(false);

  useDocumentTitle(isNew ? 'افزودن کاربر' : 'ویرایش کاربر');

  const detail = useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => ops.fetchUser(id),
    enabled: !isNew,
  });

  const { options: groupOptions } = useLookupOptions('permission-groups', {
    labelKey: 'name',
    sort: 'name',
  });
  const { options: categoryOptions } = useLookupOptions('user-categories', {
    labelKey: 'name',
    sort: 'name',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({ mutationFn: ops.createUser, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ userId, payload }) => ops.updateUser(userId, payload),
    onSuccess: invalidate,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY });

  useEffect(() => {
    if (!detail.data) return;
    const user = detail.data;
    reset({
      ...EMPTY,
      ...Object.fromEntries(
        FIELD_NAMES.filter((name) => name !== 'password').map((name) => [
          name,
          user[name] ?? EMPTY[name],
        ]),
      ),
      permissionGroup: user.permissionGroup?._id ?? '',
      categories: (user.categories ?? []).map((category) => category._id ?? category),
    });
  }, [detail.data, reset]);

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const isSelf = !isNew && detail.data?._id === currentUser?.id;

  const onSubmit = async (values) => {
    const payload = {
      firstname: values.firstname,
      lastname: values.lastname,
      displayName: values.displayName,
      email: values.email || undefined,
      comment: values.comment,
      // '' clears the group server-side, which is how an account is demoted.
      permissionGroup: values.permissionGroup,
      categories: values.categories ?? [],
      isActive: values.isActive,
    };

    try {
      if (isNew) {
        await create.mutateAsync({
          ...payload,
          mobile: values.mobile,
          password: values.password,
        });
        toast.success('کاربر ایجاد شد.');
        navigate('/users');
      } else {
        // `mobile` is optional on update and left alone here: changing it moves
        // the account's identity, and the API enforces uniqueness on it.
        await update.mutateAsync({ userId: id, payload });
        toast.success('تغییرات ذخیره شد.');

        // Editing your own group changes your own menu; re-read the session so
        // the sidebar reflects it without a sign-out.
        if (isSelf) await refresh();
        navigate('/users');
      }
    } catch (error) {
      if (error.isConflict) {
        setError('mobile', { type: 'server', message: 'این شماره قبلاً ثبت شده است.' });
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
        title={isNew ? 'افزودن کاربر' : detail.data?.displayName || detail.data?.mobile || 'ویرایش کاربر'}
        actions={
          <>
            {!isNew ? (
              <Button variant="subtle" size="sm" onClick={() => setResetOpen(true)}>
                بازنشانی رمز
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" to="/users">
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

          <SectionHeader title="هویت" />

          <FieldGrid>
            <Field
              label="شماره موبایل"
              required={isNew}
              error={errors.mobile}
              hint={isNew ? 'با ۰۹ یا +۹۸ — هر دو پذیرفته می‌شود.' : 'شماره پس از ایجاد تغییر نمی‌کند.'}
            >
              {({ id: fieldId, invalid }) => (
                <CodeInput
                  id={fieldId}
                  invalid={invalid}
                  inputMode="tel"
                  placeholder="09121234567"
                  disabled={!isNew}
                  {...register('mobile', isNew ? { required: 'شماره موبایل الزامی است.' } : {})}
                />
              )}
            </Field>

            {isNew ? (
              <Field label="رمز عبور" required error={errors.password} hint="حداقل ۶ نویسه.">
                {({ id: fieldId, invalid }) => (
                  <Input
                    id={fieldId}
                    invalid={invalid}
                    type="password"
                    autoComplete="new-password"
                    {...register('password', {
                      required: 'رمز عبور الزامی است.',
                      minLength: { value: 6, message: 'حداقل ۶ نویسه.' },
                    })}
                  />
                )}
              </Field>
            ) : (
              <div />
            )}

            <Field label="نام">
              {({ id: fieldId }) => <Input id={fieldId} {...register('firstname')} />}
            </Field>

            <Field label="نام خانوادگی">
              {({ id: fieldId }) => <Input id={fieldId} {...register('lastname')} />}
            </Field>

            <Field label="نام نمایشی" hint="در نوار بالای پنل نمایش داده می‌شود.">
              {({ id: fieldId }) => <Input id={fieldId} {...register('displayName')} />}
            </Field>

            <Field label="ایمیل" error={errors.email}>
              {({ id: fieldId, invalid }) => (
                <CodeInput id={fieldId} invalid={invalid} type="email" {...register('email')} />
              )}
            </Field>

            <Field label="یادداشت" className="sm:col-span-2">
              {({ id: fieldId }) => <Textarea id={fieldId} rows={3} {...register('comment')} />}
            </Field>
          </FieldGrid>

          <div className="mt-6">
            <SectionHeader title="دسترسی" />

            <FieldGrid>
              <Field
                label="گروه دسترسی"
                hint="بدون گروه، این حساب نمی‌تواند وارد پنل شود."
                error={errors.permissionGroup}
              >
                {({ id: fieldId, invalid }) => (
                  <Select
                    id={fieldId}
                    invalid={invalid}
                    options={groupOptions}
                    placeholder="بدون گروه"
                    {...register('permissionGroup')}
                  />
                )}
              </Field>

              <Field label="دسته بندی ها" hint="برای بخش‌بندی کاربران استفاده می‌شود.">
                {({ id: fieldId }) => (
                  <select
                    id={fieldId}
                    multiple
                    size={4}
                    className="thin-scroll w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-paper"
                    {...register('categories')}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </FieldGrid>

            {isSelf ? (
              <Alert tone="warning" className="mt-4">
                این حساب خودتان است. تغییر گروه دسترسی، بلافاصله روی منوی شما اثر می‌گذارد و ممکن
                است دسترسی فعلی‌تان را از دست بدهید.
              </Alert>
            ) : null}

            <div className="mt-4 border-t border-line pt-4">
              <Checkbox label="فعال" {...register('isActive')} />
              <p className="mt-1 text-xs text-muted/80">
                حساب غیرفعال نمی‌تواند وارد شود و نشست فعلی‌اش نیز در نخستین درخواست پایان می‌یابد.
              </p>
            </div>
          </div>

          <FormActions>
            <Button variant="ghost" to="/users">
              انصراف
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isNew ? 'ایجاد' : 'ذخیره تغییرات'}
            </Button>
          </FormActions>
        </form>
      </Card>

      {resetOpen ? (
        <PasswordResetDialog
          userId={id}
          label={detail.data?.displayName || detail.data?.mobile}
          onClose={() => setResetOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The administrative reset. Deliberately its own dialog and its own endpoint:
 * a password must never change as a side effect of saving the rest of a form.
 */
function PasswordResetDialog({ userId, label, onClose }) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { newPassword: '' } });

  const onSubmit = async ({ newPassword }) => {
    try {
      await ops.resetUserPassword(userId, newPassword);
      toast.success('رمز عبور بازنشانی شد.');
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="بازنشانی رمز عبور"
      description={label ? `برای «${label}»` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            بازنشانی
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="رمز عبور جدید" required error={errors.newPassword} hint="حداقل ۶ نویسه.">
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              type="password"
              autoComplete="new-password"
              autoFocus
              {...register('newPassword', {
                required: 'رمز جدید را وارد کنید.',
                minLength: { value: 6, message: 'حداقل ۶ نویسه.' },
              })}
            />
          )}
        </Field>

        <Alert tone="warning" className="mt-3">
          رمز فعلی کاربر پرسیده نمی‌شود. رمز جدید را از راه امنی به او اطلاع دهید.
        </Alert>
      </form>
    </Modal>
  );
}

export default UserForm;
