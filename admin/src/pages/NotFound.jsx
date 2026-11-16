/**
 * Unmatched route.
 *
 * Purpose: tell an operator a URL does not exist instead of showing a blank
 *          shell.
 * Inputs:  none
 * Outputs: a notice with a way back
 * Deps:    components/ui/*
 */
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export function NotFound() {
  useDocumentTitle('صفحه یافت نشد');

  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <span aria-hidden="true" className="font-mono text-3xl text-azure">
        404
      </span>
      <h1 className="text-lg font-bold text-paper">این صفحه وجود ندارد</h1>
      <p className="max-w-sm text-xs text-muted">
        نشانی را بررسی کنید یا از منوی کناری بخش مورد نظر را انتخاب کنید.
      </p>
      <Button to="/" variant="primary" size="sm" className="mt-2">
        بازگشت به خانه
      </Button>
    </Card>
  );
}

/**
 * Shown when an administrator's group grants nothing at all. Signing them out
 * would be wrong — they are correctly authenticated — but there is no screen
 * they may open.
 */
export function NoAccess() {
  useDocumentTitle('بدون دسترسی');

  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <span aria-hidden="true" className="text-3xl">
        🔒
      </span>
      <h1 className="text-lg font-bold text-paper">هیچ دسترسی‌ای برای شما تعریف نشده است</h1>
      <p className="max-w-md text-xs leading-6 text-muted">
        حساب شما فعال است اما گروه دسترسی آن هیچ بخشی را شامل نمی‌شود. از مدیر سامانه بخواهید
        دسترسی‌های لازم را به گروه شما اضافه کند؛ تغییر بلافاصله و بدون نیاز به ورود دوباره اعمال
        می‌شود.
      </p>
    </Card>
  );
}

export default NotFound;
