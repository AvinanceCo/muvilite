/**
 * Placeholder images.
 *
 * Purpose: upload the fallback artwork the passenger site draws for a record
 *          that has no image of its own — one image per kind of content.
 * Inputs:  an image file per slot
 * Outputs: Placeholder documents, through the admin API
 * Deps:    api/placeholders, components/{form/ImageUpload,ui/*}
 *
 * NEW SCREEN, matching new backend functionality. The legacy site had fallbacks
 * — `/src/images/posterHolder216x332.jpg` for posters, `posterHolder200x200.jpg`
 * for music covers, three more for the banner styles and `avatarHolder.jpg` for
 * cast photos — but they were files that shipped with the theme and were named
 * directly in the markup. Changing one meant an FTP upload, and no screen in the
 * panel touched them.
 *
 * ONE SCREEN, NO LIST/FORM SPLIT. Every other section here is a paginated list
 * over records an operator creates; this is a FIXED set of five slots defined by
 * the backend, so a list with a row count, filters and a "new" button would all
 * be furniture over five items. Each slot is a card that shows what is
 * configured and offers the two actions there are.
 *
 * The order and the labels come from the API, not from this file: the backend
 * owns the slot list (config/constants.js PLACEHOLDER_SLOTS), and duplicating it
 * here is how the two drift apart.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPlaceholders,
  removePlaceholder,
  uploadPlaceholder,
} from '../../api/placeholders.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Card, PageHeader, SectionHeader, Badge } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { ImageUpload } from '../../components/form/ImageUpload.jsx';
import { formatDateTime, toPersianNumber } from '../../services/format.js';

/** Query key for the slot list, so an upload can invalidate it from anywhere. */
export const placeholderKeys = { all: ['placeholders'] };

export function PlaceholderManager() {
  useDocumentTitle('تصاویر پیش‌فرض');

  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit, canDelete } = usePermissions();

  /** The slot awaiting delete confirmation, or null. */
  const [pendingClear, setPendingClear] = useState(null);

  const query = useQuery({
    queryKey: placeholderKeys.all,
    queryFn: fetchPlaceholders,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: placeholderKeys.all });

  const clear = useMutation({
    mutationFn: (slot) => removePlaceholder(slot),
    onSuccess: () => {
      setPendingClear(null);
      refresh();
      toast.success('تصویر پیش‌فرض حذف شد.');
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <Loader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const slots = query.data ?? [];
  const configured = slots.filter((slot) => slot.imagePath).length;

  return (
    <>
      <PageHeader
        title="تصاویر پیش‌فرض"
        description="تصویری که وقتی یک محتوا عکس ندارد، به‌جای آن در سایت اصلی نمایش داده می‌شود."
        actions={
          <Badge tone={configured > 0 ? 'accent' : 'neutral'}>
            {toPersianNumber(configured)} از {toPersianNumber(slots.length)} تنظیم شده
          </Badge>
        }
      />

      <div className="space-y-4">
        <Card>
          <SectionHeader
            title="ترتیب انتخاب تصویر"
            description="برای هر محتوا به‌ترتیب زیر جست‌وجو می‌شود و اولین مورد موجود نمایش داده می‌شود."
          />

          <ol className="mt-3 space-y-2 text-xs leading-6 text-muted">
            <li>
              <b className="text-paper">۱.</b> تصویری که برای همان فیلم، موسیقی یا بنر بارگذاری
              شده است.
            </li>
            <li>
              <b className="text-paper">۲.</b> تصویر پیش‌فرض همان نوع محتوا در همین صفحه.
            </li>
            <li>
              <b className="text-paper">۳.</b> تصویر پیش‌فرض «سایر تصاویر»، اگر نوع محتوا تصویر
              اختصاصی نداشته باشد.
            </li>
            <li>
              <b className="text-paper">۴.</b> تصویر ثابتی که همراه خود برنامه ارائه شده است.
            </li>
          </ol>

          <p className="mt-4 text-xs leading-6 text-muted/80">
            اندازه‌های پیشنهادی راهنما هستند و تصویر بریده یا تغییر اندازه داده نمی‌شود؛ همان فایلی
            که بارگذاری می‌کنید در قاب مربوطه نمایش داده می‌شود. بنر تنها موردی است که اگر تصویر
            پیش‌فرض نداشته باشد، اسلاید بدون عکس اصلاً نمایش داده نمی‌شود.
          </p>
        </Card>

        {!canEdit('placeholders') ? (
          <Alert tone="info" title="دسترسی فقط خواندنی">
            برای تغییر این تصاویر به مجوز ویرایش بخش «تصاویر پیش‌فرض» نیاز دارید.
          </Alert>
        ) : null}

        {/* `items-start`: a slot's card is as tall as its own content, rather
            than being stretched to match the tallest preview in its row. */}
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => (
            <SlotCard
              key={slot.key}
              slot={slot}
              canEdit={canEdit('placeholders')}
              canDelete={canDelete('placeholders')}
              onUploaded={refresh}
              onClear={() => setPendingClear(slot)}
            />
          ))}
        </div>
      </div>

      {/*
        Modal rather than ConfirmDialog: that component promises the record
        "stays in the database and can be restored", which is true of every soft
        deleted entity here and false of this one — the row and the file both go.
      */}
      <Modal
        open={Boolean(pendingClear)}
        onClose={clear.isPending ? () => {} : () => setPendingClear(null)}
        title="حذف تصویر پیش‌فرض"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setPendingClear(null)}
              disabled={clear.isPending}
            >
              انصراف
            </Button>
            <Button
              variant="danger"
              onClick={() => clear.mutate(pendingClear.key)}
              loading={clear.isPending}
            >
              حذف
            </Button>
          </>
        }
      >
        <p className="text-sm leading-7 text-paper">
          تصویر پیش‌فرض <b className="text-azure">«{pendingClear?.fa}»</b> حذف شود؟
        </p>
        <p className="mt-2 text-xs leading-6 text-muted">
          فایل تصویر از سرور پاک می‌شود و برگشت‌پذیر نیست. پس از آن، محتوای بدون عکس سراغ تصویر
          پیش‌فرض «سایر تصاویر» و در نبود آن تصویر ثابت برنامه می‌رود.
        </p>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------- card --- */

/**
 * One slot: what it is for, what is configured, and the two actions.
 *
 * The preview frame uses the slot's own recommended ratio, so an operator sees
 * the shape the passenger site will draw the image into before uploading. A
 * portrait slot is narrowed rather than allowed to fill the card: a 216×332
 * frame at full card width is over 500px tall, which would set the height of
 * every card in its grid row and leave the landscape ones mostly empty.
 */
function SlotCard({ slot, canEdit, canDelete, onUploaded, onClear }) {
  const portrait = slot.height > slot.width;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-paper">{slot.fa}</p>
          <p className="mt-0.5 truncate font-mono text-[0.7rem] text-muted/70" dir="ltr">
            {slot.key}
          </p>
        </div>

        <Badge tone={slot.imagePath ? 'accent' : 'neutral'}>
          {slot.imagePath ? 'تنظیم شده' : 'خالی'}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-6 text-muted">{slot.usageFa}</p>

      <div className={`mt-3 ${portrait ? 'mx-auto w-48' : ''}`}>
        <ImageUpload
          label=""
          path={slot.imagePath}
          disabled={!canEdit}
          disabledHint="برای تغییر این تصویر مجوز ویرایش لازم است."
          aspect={`${slot.width} / ${slot.height}`}
          hint={`اندازهٔ پیشنهادی ${toPersianNumber(slot.width)}×${toPersianNumber(slot.height)} پیکسل.`}
          onUpload={(file) => uploadPlaceholder(slot.key, file)}
          onUploaded={onUploaded}
        />
      </div>

      {slot.imagePath ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="truncate text-[0.7rem] text-muted/80">
            {slot.updatedAt ? `آخرین تغییر: ${formatDateTime(slot.updatedAt)}` : ''}
          </span>

          {canDelete ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              حذف
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default PlaceholderManager;
