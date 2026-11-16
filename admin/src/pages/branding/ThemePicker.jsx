/**
 * Theme picker — the passenger site's colour theme.
 *
 * Purpose: let the operator choose one of the site's colour themes and save it.
 * Inputs:  `themes` (key, Persian label, preview swatches) and the stored
 *          `theme`, both from the branding settings; `editable`; `onSaved`
 * Outputs: `PATCH /api/admin/branding/theme`
 * Deps:    api/branding, components/ui/*
 *
 * NEW FUNCTIONALITY (2026-11-15), no legacy ancestor. The themes, their labels
 * and their preview colours come from the API (backend SITE_THEMES), not from a
 * list here, so a theme added there appears here with no edit.
 *
 * SELECT, THEN SAVE — not save-on-click. The choice repaints a public site for
 * every visitor, so a stray click on a card must not do that by itself.
 *
 * Visitors already on the site keep their current colours until their next
 * visit: the passenger site reads its branding once per session.
 */
import { useEffect, useState } from 'react';
import { updateBrandingTheme } from '../../api/branding.js';
import { Card, SectionHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormActions } from '../../components/form/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

/** A miniature of the site in one theme: ground, a raised card, text, the accent. */
function ThemePreview({ swatches }) {
  return (
    <div
      className="flex h-24 flex-col justify-between rounded-md p-3"
      style={{ backgroundColor: swatches.ground }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: swatches.text }} />
        <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: swatches.accent }} />
      </div>
      <div
        className="flex items-center justify-between rounded px-2 py-2"
        style={{ backgroundColor: swatches.surface }}
      >
        <span className="h-1.5 w-14 rounded-full opacity-70" style={{ backgroundColor: swatches.text }} />
        <span className="h-4 w-8 rounded" style={{ backgroundColor: swatches.accent }} />
      </div>
    </div>
  );
}

export function ThemePicker({ themes, theme, editable, onSaved }) {
  const toast = useToast();
  const [selected, setSelected] = useState(theme);
  const [saving, setSaving] = useState(false);

  // Follow the stored value after a save or a refetch.
  useEffect(() => setSelected(theme), [theme]);

  const save = async () => {
    setSaving(true);
    try {
      await updateBrandingTheme(selected);
      await onSaved();
      toast.success('رنگ‌بندی سایت ذخیره شد.');
    } catch (error) {
      toast.error(error.fieldErrors?.theme ?? error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionHeader
        title="رنگ‌بندی سایت"
        description="ترکیب رنگ سایت اصلی. با ذخیره، بازدیدکنندگان از بازدید بعدی خود رنگ‌بندی تازه را می‌بینند."
      />

      <div role="radiogroup" aria-label="رنگ‌بندی سایت" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {themes.map((option) => {
          const checked = option.key === selected;
          const isCurrent = option.key === theme;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={!editable || saving}
              onClick={() => setSelected(option.key)}
              className={`rounded-lg border p-2 text-start transition-colors disabled:cursor-not-allowed ${
                checked
                  ? 'border-azure bg-azure/10 ring-1 ring-azure'
                  : 'border-line hover:border-azure/50 disabled:hover:border-line'
              }`}
            >
              <ThemePreview swatches={option.swatches} />
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className="text-sm font-bold text-paper">{option.fa}</span>
                {isCurrent ? <span className="text-[0.7rem] text-muted">فعلی</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      <FormActions>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSelected(theme)}
          disabled={!editable || saving || selected === theme}
        >
          بازگردانی
        </Button>
        <Button
          type="button"
          onClick={save}
          loading={saving}
          disabled={!editable || selected === theme}
        >
          ذخیره
        </Button>
      </FormActions>
    </Card>
  );
}

export default ThemePicker;
