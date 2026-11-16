/**
 * Track list editor.
 *
 * Purpose: upload audio files, name and order the resulting tracks, and save
 *          the list.
 * Inputs:  the music id and its current tracks
 * Outputs: a replaced track list
 * Deps:    api/operations, components/ui/*
 *
 * THE SAVE IS A FULL REPLACE, AND THAT IS DANGEROUS TO GET WRONG.
 * `PUT /musics/:id/tracks` overwrites the whole array and DELETES FROM DISK any
 * file the new list no longer references. So the editor holds the complete list
 * in local state and always sends all of it — sending only the changed rows
 * would destroy the others' files irrecoverably.
 *
 * Uploading is a separate first step (`POST /track-files`): it stores bytes and
 * returns paths without touching the document. A file uploaded but never saved
 * is orphaned on disk, so the pending count is shown and the operator is warned
 * before leaving.
 *
 * Local state is deliberate here rather than react-hook-form: this is a
 * reorderable array of rows, and the "unsaved" state is the point.
 */
import { useEffect, useRef, useState } from 'react';
import * as ops from '../../api/operations.js';
import { AUDIO_ACCEPT } from '../../services/media.js';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { SectionHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatBytes, formatTimecode, toPersianNumber } from '../../services/format.js';
import { MAX_TRACK_FILES } from '../../utils/constants.js';

/**
 * @param {object} props
 * @param {string} props.musicId
 * @param {object[]} props.tracks   the saved list
 * @param {() => void} props.onSaved
 * @param {boolean} props.canEdit
 */
export function TrackEditor({ musicId, tracks = [], onSaved, canEdit }) {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  // Re-seed from the server whenever the saved list changes, but never over
  // unsaved edits — that would silently discard the operator's work.
  useEffect(() => {
    if (dirty) return;
    setRows(
      tracks.map((track, index) => ({
        localKey: `${track.file}-${index}`,
        title: track.title ?? '',
        file: track.file,
        image: track.image ?? null,
        duration: track.duration ?? 0,
        order: track.order ?? index,
        isNew: false,
      })),
    );
  }, [tracks, dirty]);

  // Warn before a reload or tab close drops unsaved rows — and, with them, any
  // uploaded-but-unsaved files.
  useEffect(() => {
    if (!dirty) return undefined;

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patchRow = (localKey, changes) => {
    setRows((current) =>
      current.map((row) => (row.localKey === localKey ? { ...row, ...changes } : row)),
    );
    setDirty(true);
  };

  const removeRow = (localKey) => {
    setRows((current) => current.filter((row) => row.localKey !== localKey));
    setDirty(true);
  };

  /** Reorders by swapping with the neighbour, then renumbering. */
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, position) => ({ ...row, order: position }));
    });
    setDirty(true);
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    if (rows.length + files.length > MAX_TRACK_FILES) {
      toast.error(`حداکثر ${toPersianNumber(MAX_TRACK_FILES)} قطعه در هر آلبوم مجاز است.`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await ops.uploadMusicTrackFiles(musicId, files);
      setRows((current) => [
        ...current,
        ...uploaded.map((item, index) => ({
          localKey: item.file,
          // The original filename is the best first guess at a title.
          title: item.originalName?.replace(/\.[^.]+$/, '') ?? '',
          file: item.file,
          image: null,
          duration: 0,
          order: current.length + index,
          size: item.size,
          isNew: true,
        })),
      ]);
      setDirty(true);
      toast.info('فایل‌ها بارگذاری شدند. برای ثبت، «ذخیره قطعات» را بزنید.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (rows.length === 0) {
      toast.error('حداقل یک قطعه لازم است. برای حذف همهٔ قطعات، خود آلبوم را حذف کنید.');
      return;
    }

    setSaving(true);
    try {
      await ops.putMusicTracks(
        musicId,
        rows.map((row, index) => ({
          title: row.title,
          file: row.file,
          image: row.image,
          duration: Number(row.duration) || 0,
          order: index,
        })),
      );
      setDirty(false);
      onSaved?.();
      toast.success('قطعات ذخیره شد.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = rows.filter((row) => row.isNew).length;

  return (
    <div>
      <SectionHeader
        title="قطعات"
        description={`${toPersianNumber(rows.length)} قطعه`}
        actions={
          canEdit ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={AUDIO_ACCEPT}
                multiple
                onChange={handleFiles}
                className="hidden"
              />
              <Button size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
                افزودن فایل
              </Button>
              <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty}>
                ذخیره قطعات
              </Button>
            </>
          ) : null
        }
      />

      {dirty ? (
        <Alert tone="warning" className="mb-3">
          تغییرات ذخیره نشده است
          {pendingCount > 0
            ? ` و ${toPersianNumber(pendingCount)} فایل بارگذاری‌شده هنوز ثبت نشده‌اند.`
            : '.'}{' '}
          ذخیره، فهرست قطعات را به‌طور کامل جایگزین می‌کند و فایل‌های حذف‌شده از سرور پاک می‌شوند.
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">قطعه‌ای افزوده نشده است.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.localKey}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-hi p-2"
            >
              <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">
                {toPersianNumber(index + 1)}
              </span>

              <Input
                value={row.title}
                onChange={(event) => patchRow(row.localKey, { title: event.target.value })}
                placeholder="نام قطعه"
                disabled={!canEdit}
                className="h-8 min-w-40 flex-1 text-xs"
                aria-label={`نام قطعه ${index + 1}`}
              />

              <Input
                type="number"
                min={0}
                value={row.duration}
                onChange={(event) => patchRow(row.localKey, { duration: event.target.value })}
                disabled={!canEdit}
                dir="ltr"
                className="h-8 w-24 text-xs"
                aria-label={`مدت قطعه ${index + 1} به ثانیه`}
                title="مدت به ثانیه"
              />

              <span className="w-14 shrink-0 text-center font-mono text-[0.7rem] text-muted">
                {formatTimecode(row.duration)}
              </span>

              <span
                dir="ltr"
                title={row.file}
                className="hidden max-w-48 truncate font-mono text-[0.65rem] text-muted lg:block"
              >
                {row.file.split('/').pop()}
              </span>

              {row.isNew ? (
                <span className="shrink-0 text-[0.65rem] text-azure">
                  جدید{row.size ? ` · ${formatBytes(row.size)}` : ''}
                </span>
              ) : null}

              {canEdit ? (
                <span className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label="بالا"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    ▲
                  </IconButton>
                  <IconButton
                    label="پایین"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                  >
                    ▼
                  </IconButton>
                  <IconButton
                    label={`حذف قطعه ${index + 1}`}
                    onClick={() => removeRow(row.localKey)}
                    className="hover:border-signal/50 hover:text-signal"
                  >
                    ✕
                  </IconButton>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default TrackEditor;
