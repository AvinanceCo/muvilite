/**
 * Sign-in screen.
 *
 * Purpose: authenticate an administrator and hand them to where they were
 *          headed.
 * Inputs:  mobile and password
 * Outputs: an authenticated session
 * Deps:    react-hook-form, context/AuthContext, routes/nav
 *
 * Legacy counterpart: `views/users/login.php`. Two of its properties are gone
 * on purpose (backend/MIGRATION.md §6):
 *
 *   - **No captcha.** The legacy page checked it *after* verifying credentials
 *     and writing the session, so a wrong captcha still produced a fully
 *     authenticated user — it only changed the redirect. The control was
 *     decorative, and the login route is rate limited server-side (10 attempts
 *     per 15 minutes, successes excluded) which is what it was reaching for.
 *   - **No "wrong password" versus "no such user" distinction.** The API
 *     answers both with one message, so this screen cannot leak which mobile
 *     numbers exist.
 *
 * The mobile number is sent as typed: the server normalizes `09121234567`,
 * `9121234567` and `+989121234567` to the same account.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { landingRoute } from '../routes/nav.js';
import { Button } from '../components/ui/Button.jsx';
import { CodeInput, Input } from '../components/ui/Input.jsx';
import { Field } from '../components/form/Field.jsx';
import { Alert, Loader } from '../components/ui/Feedback.jsx';
// The bare mark, not the full lockup: the lockup's own "MEDIA WIFI" lettering is
// illegible at this size and the heading below already names the product.
import muviliteMark from '../assets/images/muvilite-mark.png';

export function Login() {
  const { signIn, isAuthenticated, isChecking } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [failure, setFailure] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { mobile: '', password: '' } });

  if (isChecking) {
    return <Loader label="در حال بررسی نشست" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values) => {
    setFailure(null);

    try {
      const user = await signIn(values);
      const can = (page, action = 'view') => user?.permissions?.[page]?.[action] === true;
      // Back to whatever was being opened when the session expired, if that
      // is where they came from; otherwise the best landing page for the
      // permissions they actually hold.
      navigate(location.state?.from ?? landingRoute(can), { replace: true });
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src={muviliteMark}
            alt=""
            aria-hidden="true"
            className="mx-auto mb-3 h-10 w-auto"
          />
          <h1 className="text-lg font-bold text-paper">پنل مدیریت MuviLite</h1>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-muted">
            administration
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-panel border border-line bg-panel p-5"
        >
          {failure ? (
            <Alert tone="danger" title="ورود ناموفق">
              {failure.status === 429
                ? 'تعداد تلاش‌های ناموفق زیاد بوده است. کمی بعد دوباره تلاش کنید.'
                : failure.message}
            </Alert>
          ) : null}

          <Field label="شماره موبایل" required error={errors.mobile}>
            {({ id, invalid }) => (
              <CodeInput
                id={id}
                invalid={invalid}
                autoComplete="username"
                inputMode="tel"
                placeholder="09121234567"
                autoFocus
                {...register('mobile', { required: 'شماره موبایل را وارد کنید.' })}
              />
            )}
          </Field>

          <Field label="رمز عبور" required error={errors.password}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="password"
                autoComplete="current-password"
                {...register('password', { required: 'رمز عبور را وارد کنید.' })}
              />
            )}
          </Field>

          <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full">
            ورود
          </Button>
        </form>
      </div>
    </div>
  );
}

export default Login;
