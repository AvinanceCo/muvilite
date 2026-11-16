/**
 * Branding — the site's colour theme, the customer logo and the landing-page copy.
 *
 * Purpose: put the two things that identify a particular customer, rather than
 *          the product, in one place: the logo the passenger site shows in its
 *          footer, and the heading and sentence on its landing page.
 * Inputs:  an image file, and the text fields the backend defines
 * Outputs: the Branding document, through the admin API
 * Deps:    api/branding, react-hook-form, components/{form,ui}/*
 *
 * NEW SCREEN, matching new backend functionality. Neither of these was data in
 * the legacy application: the footer logo was an image that shipped with the
 * theme, and the landing-page heading and its sentence were Persian literals in
 * `index.php`. Changing either meant editing files on the server.
 *
 * The colour theme card (ThemePicker.jsx) was added 2026-11-15 and saves on its
 * own route, apart from the text form.
 *
 * ONE SCREEN, A FEW CARDS, NO LIST/FORM SPLIT — the same reasoning as the
 * placeholders screen. There is exactly one branding record per installation, so
 * a list with a row count and a "new" button would be furniture over a single
 * row that always exists.
 *
 * THE FORM IS BUILT FROM THE API's `fields`, not from a list in this file. The
 * backend owns the text fields, their Persian labels, their length limits and
 * their default wording (config/constants.js BRANDING_TEXT_FIELDS); duplicating
 * any of that here is how the two drift apart. Adding a third field there makes
 * it appear here with no edit.
 *
 * WHY THE INPUTS START EMPTY RATHER THAN PRE-FILLED WITH THE DEFAULT. The
 * default is the input's PLACEHOLDER. An operator who saw it as a value could
 * not tell their own text from the fallback, and saving the form would then
 * freeze the shipped wording into the database, so a later release could never
 * improve it. Clearing a field is therefore a real action — it restores the
 * default — and the screen says so.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBranding,
  removeBrandingLogo,
  updateBranding,
  uploadBrandingLogo,
} from '../../api/branding.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Card, PageHeader, SectionHeader, Badge } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { ImageUpload } from '../../components/form/ImageUpload.jsx';
import { Field, FormActions, applyServerErrors } from '../../components/form/Field.jsx';
import { formatDateTime, toPersianNumber } from '../../services/format.js';
import { ThemePicker } from './ThemePicker.jsx';

/** Query key for the settings, so an upload can invalidate it from anywhere. */
export const brandingKeys = { all: ['branding'] };

export function BrandingManager() {
  useDocumentTitle('هویت بصری');

  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit, canDelete } = usePermissions();

  /** True while the logo removal awaits confirmation. */
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const query = useQuery({
    queryKey: brandingKeys.all,
    queryFn: fetchBranding,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: brandingKeys.all });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ defaultValues: {} });

  // The field list arrives with the data, so the form's shape is only known
  // after the first response — reset once it is, and again after every save.
  useEffect(() => {
    if (!query.data) return;
    reset(
      Object.fromEntries(query.data.fields.map((field) => [field.key, query.data[field.key] ?? ''])),
    );
  }, [query.data, reset]);

  const removeLogo = useMutation({
    mutationFn: removeBrandingLogo,
    onSuccess: () => {
      setConfirmingRemove(false);
      refresh();
      toast.success('لوگو حذف شد.');
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <Loader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const settings = query.data;
  const fields = settings.fields ?? [];
  const editable = canEdit('branding');

  const onSubmit = async (values) => {
    try {
      await updateBranding(values);
      await refresh();
      toast.success('نام سایت و متن‌های صفحهٔ اصلی ذخیره شد.');
    } catch (error) {
      const unmatched = applyServerErrors(
        error,
        setError,
        fields.map((field) => field.key),
      );
      if (unmatched.length > 0 || Object.keys(error.fieldErrors ?? {}).length === 0) {
        toast.error(unmatched.length > 0 ? unmatched.join('؛ ') : error.message);
      }
    }
  };

  return (
    <>
      <PageHeader
        title="هویت بصری"
        description="نام سایت، رنگ‌بندی، لوگوی مشتری و متن‌های صفحهٔ اصلی سایت اصلی، در یک جا."
        actions={
          settings.updatedAt ? (
            <Badge tone="neutral">آخرین تغییر: {formatDateTime(settings.updatedAt)}</Badge>
          ) : null
        }
      />

      <div className="space-y-4">
        {!editable ? (
          <Alert tone="info" title="دسترسی فقط خواندنی">
            برای تغییر این موارد به مجوز ویرایش بخش «هویت بصری» نیاز دارید.
          </Alert>
        ) : null}

        {/* ------------------------------------------------------ theme --- */}
        <ThemePicker
          themes={settings.themes ?? []}
          theme={settings.theme}
          editable={editable}
          onSaved={refresh}
        />

        {/* ------------------------------------------------------- logo --- */}
        <Card>
          <SectionHeader
            title="لوگوی مشتری"
            description="در پاورقی سایت اصلی نمایش داده می‌شود، به‌جای لوگوی خود سامانه."
          />

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <ImageUpload
              label=""
              path={settings.footerLogoPath}
              disabled={!editable}
              disabledHint="برای بارگذاری لوگو مجوز ویرایش لازم است."
              aspect={`${settings.logoSize.width} / ${settings.logoSize.height}`}
              hint={`اندازهٔ پیشنهادی ${toPersianNumber(settings.logoSize.width)}×${toPersianNumber(
                settings.logoSize.height,
              )} پیکسل. تصویر بریده یا تغییر اندازه نمی‌شود؛ در پاورقی با ارتفاع ثابت و عرض متناسب نمایش داده می‌شود، پس پی‌ان‌جی با پس‌زمینهٔ شفاف بهترین نتیجه را می‌دهد.`}
              onUpload={(file) => uploadBrandingLogo(file)}
              onUploaded={refresh}
            />

            <div className="space-y-3 text-xs leading-6 text-muted">
              <p>
                لوگوی خود سامانه از پاورقی برداشته شده است؛ آنچه اینجا بارگذاری می‌کنید جای آن را
                می‌گیرد. نشان بالای صفحه (هدر) تغییری نمی‌کند و همچنان لوگوی سامانه است.
              </p>
              <p>
                اگر لوگویی بارگذاری نشود، پاورقی فقط متن حق نشر را نشان می‌دهد و هیچ تصویری در آن
                نمایش داده نمی‌شود.
              </p>

              {settings.footerLogoPath ? (
                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[0.7rem] text-muted/80">
                    یک لوگو بارگذاری شده است. بارگذاری تصویر تازه، فایل قبلی را جایگزین می‌کند.
                  </span>

                  {canDelete('branding') ? (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(true)}>
                      حذف لوگو
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------------- text --- */}
        <Card>
          <SectionHeader
            title="نام سایت و متن صفحهٔ اصلی"
            description="نام سایت در سربرگ و عنوان مرورگر، و تیتر و توضیح بالای فهرست بخش‌ها در صفحهٔ اصلی."
          />

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            {fields.map((field) => (
              <Field
                key={field.key}
                label={field.fa}
                error={errors[field.key]}
                hint={`${field.usageFa} — حداکثر ${toPersianNumber(
                  field.maxLength,
                )} نویسه. اگر خالی بماند، متن پیش‌فرض نمایش داده می‌شود.`}
              >
                {({ id, invalid }) =>
                  field.multiline ? (
                    <Textarea
                      id={id}
                      rows={3}
                      invalid={invalid}
                      disabled={!editable}
                      maxLength={field.maxLength}
                      placeholder={field.default}
                      {...register(field.key)}
                    />
                  ) : (
                    <Input
                      id={id}
                      invalid={invalid}
                      disabled={!editable}
                      maxLength={field.maxLength}
                      placeholder={field.default}
                      {...register(field.key)}
                    />
                  )
                }
              </Field>
            ))}

            <p className="text-xs leading-6 text-muted/80">
              متن نوشته‌شده در جعبه‌ها همان چیزی است که ذخیره می‌شود؛ متنِ کم‌رنگِ داخل جعبهٔ خالی
              فقط نمونهٔ متن پیش‌فرض است. برای بازگشت به متن پیش‌فرض، جعبه را خالی کنید و ذخیره
              بزنید.
            </p>

            <FormActions>
              <Button
                type="button"
                variant="ghost"
                onClick={() => reset()}
                disabled={!editable || !isDirty || isSubmitting}
              >
                بازگردانی تغییرات
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={!editable}>
                ذخیره
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>

      {/*
        Modal rather than ConfirmDialog: that component promises the record
        "stays in the database and can be restored", which is false here — the
        image file is deleted from the server.
      */}
      <Modal
        open={confirmingRemove}
        onClose={removeLogo.isPending ? () => {} : () => setConfirmingRemove(false)}
        title="حذف لوگوی مشتری"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmingRemove(false)}
              disabled={removeLogo.isPending}
            >
              انصراف
            </Button>
            <Button
              variant="danger"
              onClick={() => removeLogo.mutate()}
              loading={removeLogo.isPending}
            >
              حذف
            </Button>
          </>
        }
      >
        <p className="text-sm leading-7 text-paper">لوگوی بارگذاری‌شده حذف شود؟</p>
        <p className="mt-2 text-xs leading-6 text-muted">
          فایل تصویر از سرور پاک می‌شود و برگشت‌پذیر نیست. پس از آن، پاورقی سایت اصلی فقط متن حق
          نشر را نشان می‌دهد.
        </p>
      </Modal>
    </>
  );
}

export default BrandingManager;
