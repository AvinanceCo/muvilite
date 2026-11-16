/**
 * NotFound — the catch-all route.
 *
 * Purpose: tell a passenger the address they opened has nothing behind it, and
 *          give them the two ways forward.
 * Inputs:  none
 * Outputs: JSX
 * Deps:    react-router-dom, components/ui/Button, hooks/useDocumentTitle
 *
 * Replaces `other/404.php`, a full page whose content was a cinema photograph
 * with "404" and "صفحه موردنظر یافت نشد" laid over it. The photograph was a
 * decorative asset in `src/images/`; it is not carried over, because a dead end
 * on a metered cabin link should cost nothing to load and the message is the
 * whole point of the screen.
 *
 * Deliberately makes no network request and offers no automatic redirect: the
 * passenger typed or followed the address, and moving them somewhere else on
 * their behalf would hide what happened.
 */
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export function NotFound() {
  useDocumentTitle('صفحه پیدا نشد');

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:py-28">
      <p className="font-mono text-5xl tracking-[0.2em] text-azure sm:text-6xl">404</p>

      <h1 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl">این صفحه پیدا نشد</h1>

      <p className="mt-3 leading-7 text-muted">
        نشانی‌ای که باز کردید وجود ندارد یا محتوای آن برداشته شده است. از صفحه اصلی ادامه دهید یا
        عنوان مورد نظرتان را جستجو کنید.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button to="/" variant="primary">
          صفحه اصلی
        </Button>
        <Button to="/search" variant="subtle">
          جستجو
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted">
        دنبال موسیقی می‌گردید؟{' '}
        <Link to="/musics" className="text-azure transition-colors hover:text-paper">
          بخش موسیقی
        </Link>
        .
      </p>
    </div>
  );
}

export default NotFound;
