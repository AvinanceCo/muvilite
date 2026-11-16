/**
 * Own-account screen.
 *
 * Purpose: let an administrator see who they are signed in as and change their
 *          own password.
 * Inputs:  current and new password
 * Outputs: a password change
 * Deps:    react-hook-form, api/auth, context/AuthContext
 *
 * The legacy panel had no such screen. `UserController::update()` would have
 * handled a password change but `require`d `models/UserTokenModel.php`, which
 * does not exist in the tree — so every attempt was a guaranteed fatal error
 * (backend/MIGRATION.md §6 defect 7). Changing your own password meant asking
 * someone with `users` permission to reset it for you.
 *
 * Unlike the administrative reset on the users screen, this one requires the
 * current password: it is the account's owner proving identity, not an
 * administrator acting on someone else's account.
 */
import { useForm } from 'react-hook-form';
import { changeOwnPassword } from '../api/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader, Badge } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Field, FieldGrid, FormActions, applyServerErrors } from '../components/form/Field.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { PERMISSION_ACTIONS, PERMISSION_PAGES } from '../utils/constants.js';

export function Profile() {
  useDocumentTitle('حساب کاربری');

  const { user } = useAuth();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      toast.success('رمز عبور تغییر کرد.');
      reset();
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, ['currentPassword', 'newPassword']);
      if (unmatched.length > 0 || Object.keys(error.fieldErrors ?? {}).length === 0) {
        toast.error(error.message);
      }
    }
  };

  return (
    <>
      <PageHeader title="حساب کاربری" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader title="مشخصات" />

          <dl className="space-y-3 text-sm">
            <Row label="نام نمایشی" value={user?.displayName} />
            <Row label="شماره موبایل" value={user?.mobile} mono />
            <Row label="گروه دسترسی" value={user?.permissionGroup?.name} />
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs font-bold text-muted">دسترسی های شما</p>
            <PermissionSummary permissions={user?.permissions ?? {}} />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="تغییر رمز عبور"
            description="برای تغییر رمز، رمز فعلی خود را وارد کنید."
          />

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGrid columns={1}>
              <Field label="رمز عبور فعلی" required error={errors.currentPassword}>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    type="password"
                    autoComplete="current-password"
                    {...register('currentPassword', { required: 'رمز فعلی را وارد کنید.' })}
                  />
                )}
              </Field>

              <Field
                label="رمز عبور جدید"
                required
                hint="حداقل ۶ نویسه."
                error={errors.newPassword}
              >
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    type="password"
                    autoComplete="new-password"
                    {...register('newPassword', {
                      required: 'رمز جدید را وارد کنید.',
                      minLength: { value: 6, message: 'حداقل ۶ نویسه.' },
                    })}
                  />
                )}
              </Field>

              <Field label="تکرار رمز جدید" required error={errors.confirmPassword}>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    type="password"
                    autoComplete="new-password"
                    {...register('confirmPassword', {
                      required: 'تکرار رمز را وارد کنید.',
                      validate: (value) =>
                        value === watch('newPassword') || 'با رمز جدید یکسان نیست.',
                    })}
                  />
                )}
              </Field>
            </FieldGrid>

            <FormActions>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                تغییر رمز
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        dir={mono ? 'ltr' : undefined}
        className={`text-paper ${mono ? 'font-mono text-xs' : 'text-sm'}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

/**
 * The granted sections. Reads the sparse permission map — a section with no
 * grant is absent, so only what is actually held is listed.
 */
function PermissionSummary({ permissions }) {
  const granted = PERMISSION_PAGES.filter((page) => permissions[page.key]);

  if (granted.length === 0) {
    return <p className="text-xs text-muted">هیچ دسترسی‌ای تعریف نشده است.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {granted.map((page) => (
        <li key={page.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-paper">{page.label}</span>
          <span className="flex gap-1">
            {PERMISSION_ACTIONS.filter((action) => permissions[page.key][action.key]).map(
              (action) => (
                <Badge key={action.key} tone="accent">
                  {action.label}
                </Badge>
              ),
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default Profile;
