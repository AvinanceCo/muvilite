/**
 * Permission group editor.
 *
 * Purpose: name a group and set, per section, whether it may view, edit or
 *          delete.
 * Inputs:  the route id (`new` creates)
 * Outputs: a saved group
 * Deps:    react-hook-form, hooks/useResource, utils/constants
 *
 * Legacy counterpart: `views/groups/form.php`.
 *
 * A MATRIX, NOT A PICK LIST. Access is stored the legacy way — as references to
 * `access_permission_tbl` rows, each naming a section and the actions allowed on
 * it — and the seeded rows grant all three actions at once ("Full access:
 * movies"). This screen used to list those rows with «مشاهده» / «ویرایش» /
 * «حذف» badges beside each, but the badges were labels: they could not be
 * clicked, and clicking one simply toggled the row's checkbox. So a group could
 * only ever be given a WHOLE section — there was no way to grant view without
 * also granting edit and delete.
 *
 * The three actions are now checkboxes. The API takes the matrix as `grants` and
 * resolves each row of it back to a permission document, reusing an existing row
 * that grants exactly that combination before creating one
 * (backend services/admin/permissionGrant.service.js). Nothing about how
 * authorization is evaluated changed.
 *
 * THE MATRIX IS THE WHOLE GROUP. It is submitted in full and the API REPLACES
 * the group's permissions with what it resolves to — the legacy relation table
 * was rewritten wholesale in the same way. That is also why PERMISSION_PAGES
 * must list every section the backend knows: one missing here would be dropped
 * from every group that is saved.
 *
 * Overlapping rows — two permission documents covering one section, which the
 * legacy panel allowed and which silently DENIED access there
 * (backend/MIGRATION.md §6 defect 2) — arrive already OR-ed into the matrix, so
 * they show up as the single grant they actually amount to.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useResourceDetail, useResourceMutations } from '../../hooks/useResource.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader } from '../../components/ui/Card.jsx';
import { Checkbox, Input } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import {
  Field,
  FormActions,
  FormError,
  applyServerErrors,
} from '../../components/form/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PERMISSION_ACTIONS, PERMISSION_PAGES } from '../../utils/constants.js';

/** Every section with every action off — the shape the form always holds. */
const emptyGrants = () =>
  Object.fromEntries(
    PERMISSION_PAGES.map(({ key }) => [
      key,
      Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action.key, false])),
    ]),
  );

const EMPTY = { name: '', isActive: true, grants: emptyGrants() };

export function PermissionGroupForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refresh } = useAuth();

  useDocumentTitle(isNew ? 'افزودن گروه دسترسی' : 'ویرایش گروه دسترسی');

  const detail = useResourceDetail('permission-groups', isNew ? null : id);
  const { create, update } = useResourceMutations('permission-groups');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY });

  useEffect(() => {
    if (!detail.data) return;

    // Merged over the empty matrix rather than used as-is: the API only returns
    // the sections a group actually holds, and every checkbox needs a value.
    const grants = emptyGrants();
    for (const [page, actions] of Object.entries(detail.data.grants ?? {})) {
      if (!grants[page]) continue; // a section this build does not know about
      for (const action of PERMISSION_ACTIONS) {
        grants[page][action.key] = Boolean(actions?.[action.key]);
      }
    }

    reset({ name: detail.data.name ?? '', isActive: detail.data.isActive ?? true, grants });
  }, [detail.data, reset]);

  // Watched so the row toggle and the "no view" notice track the boxes live.
  const grants = watch('grants');

  if (!isNew && detail.isLoading) return <Loader />;
  if (!isNew && detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />;

  const isOwnGroup = !isNew && user?.permissionGroup?.id === id;

  /** Ticks or clears a whole section at once — 15 rows of three add up. */
  const toggleSection = (page, next) => {
    for (const action of PERMISSION_ACTIONS) {
      setValue(`grants.${page}.${action.key}`, next, { shouldDirty: true });
    }
  };

  const onSubmit = async (values) => {
    const payload = {
      name: values.name,
      isActive: values.isActive,
      // The full matrix — see the file header.
      grants: values.grants,
    };

    try {
      if (isNew) {
        await create.mutateAsync(payload);
        toast.success('گروه ایجاد شد.');
      } else {
        await update.mutateAsync({ id, payload });
        toast.success('تغییرات ذخیره شد.');
        // Editing your own group changes your own menu immediately, because
        // the server re-resolves permissions per request.
        if (isOwnGroup) await refresh();
      }
      navigate('/permission-groups');
    } catch (error) {
      if (error.isConflict) {
        setError('name', { type: 'server', message: 'گروهی با این نام وجود دارد.' });
        return;
      }
      const unmatched = applyServerErrors(error, setError, ['name', 'grants', 'isActive']);
      if (unmatched.length > 0 || Object.keys(error.fieldErrors ?? {}).length === 0) {
        toast.error(unmatched.length > 0 ? unmatched.join('؛ ') : error.message);
      }
    }
  };

  const submitError = create.error ?? update.error;

  return (
    <>
      <PageHeader
        title={isNew ? 'افزودن گروه دسترسی' : `ویرایش «${detail.data?.name ?? ''}»`}
        actions={
          <Button variant="ghost" size="sm" to="/permission-groups">
            بازگشت به فهرست
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {submitError && Object.keys(submitError.fieldErrors ?? {}).length === 0 && !submitError.isConflict ? (
            <FormError error={submitError} />
          ) : null}

          <Field label="نام گروه" required error={errors.name} className="max-w-sm">
            {({ id: fieldId, invalid }) => (
              <Input
                id={fieldId}
                invalid={invalid}
                {...register('name', {
                  required: 'نام گروه الزامی است.',
                  maxLength: { value: 255, message: 'حداکثر ۲۵۵ نویسه.' },
                })}
              />
            )}
          </Field>

          <div className="mt-6">
            <SectionHeader
              title="دسترسی ها"
              description="برای هر بخش مشخص کنید اعضای این گروه چه کاری می‌توانند انجام دهند."
            />

            {isOwnGroup ? (
              <Alert tone="warning" className="mb-4">
                این گروه خودتان است. برداشتن یک دسترسی، بلافاصله آن بخش را از منوی شما حذف می‌کند.
              </Alert>
            ) : null}

            <div className="thin-scroll overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel-hi/50">
                    <th scope="col" className="px-3 py-2.5 text-start text-xs font-bold text-muted">
                      بخش
                    </th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <th
                        key={action.key}
                        scope="col"
                        className="w-24 px-3 py-2.5 text-center text-xs font-bold text-muted"
                      >
                        {action.label}
                      </th>
                    ))}
                    <th scope="col" className="w-20 px-3 py-2.5 text-center text-xs font-bold text-muted">
                      همه
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {PERMISSION_PAGES.map((page) => {
                    const row = grants?.[page.key] ?? {};
                    const all = PERMISSION_ACTIONS.every((action) => row[action.key]);
                    // Edit or delete without view is legal — the legacy schema
                    // allowed any combination — but the section then has no
                    // menu entry, which is worth saying out loud.
                    const editableButUnlisted = !row.view && (row.edit || row.delete);

                    return (
                      <tr
                        key={page.key}
                        className="border-b border-line/60 transition-colors last:border-0 hover:bg-panel-hi"
                      >
                        <th scope="row" className="px-3 py-2 text-start font-normal">
                          <span className="text-paper">{page.label}</span>
                          <span className="block font-mono text-[0.7rem] text-muted" dir="ltr">
                            {page.key}
                          </span>
                          {/* Azure, not red: this is a consequence worth
                              knowing, not an error. Red is destructive-only in
                              this panel. */}
                          {editableButUnlisted ? (
                            <span className="mt-0.5 block text-[0.7rem] text-azure">
                              بدون «مشاهده»، این بخش در منو دیده نمی‌شود.
                            </span>
                          ) : null}
                        </th>

                        {PERMISSION_ACTIONS.map((action) => (
                          <td key={action.key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="size-4 cursor-pointer accent-azure"
                              aria-label={`${action.label} ${page.label}`}
                              {...register(`grants.${page.key}.${action.key}`)}
                            />
                          </td>
                        ))}

                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer accent-azure"
                            aria-label={`همهٔ دسترسی های ${page.label}`}
                            // Not a form field: it only drives the three real
                            // ones, so its state is derived, never submitted.
                            checked={all}
                            onChange={(event) => toggleSection(page.key, event.target.checked)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <Checkbox label="فعال" {...register('isActive')} />
          </div>

          <FormActions>
            <Button variant="ghost" to="/permission-groups">
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

export default PermissionGroupForm;
