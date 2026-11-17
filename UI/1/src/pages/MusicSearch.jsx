/**
 * Music search — the album finder.
 *
 * Purpose: find an album or artist by name, or browse everything when nothing
 *          is typed.
 * Inputs:  query string `text`, `page`
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          hooks/useDebouncedValue, utils/constants, components/{catalog,ui}
 *
 * Legacy counterpart: `music.php` — the same GET form as `search.php` pointed at
 * `?@=musics`, printing square covers titled `fullname_fa - album_fa`. Preserved
 * from it:
 *   - the URL is the state, so a result page survives a refresh, a share and the
 *     back button;
 *   - an empty `text` returns the first page of everything rather than an error,
 *     which is what makes an empty box a browse screen;
 *   - results are newest-first and that is not negotiable: the endpoint takes NO
 *     sort parameters at all (backend music.service.js searchMusic sorts by
 *     `_id` descending, the legacy `ORDER BY id DESC`). There is deliberately no
 *     sort control here — offering one would imply a choice the API does not
 *     have.
 *
 * Added here: pagination. The legacy query ran with no LIMIT and returned every
 * matching row (MIGRATION.md); which rows match is unchanged.
 *
 * This is the sibling of Search.jsx. The two share a shape but not an
 * implementation, because they were two legacy pages whose result cards and
 * capabilities differ.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchMusics } from '../api/catalog.js';
import { PAGE_SIZE } from '../utils/constants.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import MusicCard from '../components/catalog/MusicCard.jsx';
import { MediaGrid } from '../components/catalog/MediaGrid.jsx';
import { Alert, EmptyState, Loader } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { Input } from '../components/ui/Input.jsx';

export function MusicSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  const text = searchParams.get('text') ?? '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [term, setTerm] = useState(text);
  const debouncedTerm = useDebouncedValue(term, 350);

  /** The last value this page pushed into the URL — see Search.jsx. */
  const committedRef = useRef(text);

  /** Writes parameters to the URL, dropping the ones at their default. */
  const commit = (next, { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(next).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) params.delete(key);
      else params.set(key, String(value));
    });

    setSearchParams(params, { replace });
  };

  // Typing settles into the URL, replacing rather than stacking history.
  useEffect(() => {
    if (debouncedTerm === committedRef.current) return;
    committedRef.current = debouncedTerm;
    commit({ text: debouncedTerm, page: null }, { replace: true });
    // `commit` closes over the current searchParams; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  // A URL we did not write (back button, shared link) refills the field.
  useEffect(() => {
    if (text === committedRef.current) return;
    committedRef.current = text;
    setTerm(text);
  }, [text]);

  const query = useQuery({
    queryKey: ['search', 'musics', { text, page }],
    queryFn: () => searchMusics({ text: text || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  useDocumentTitle(text ? `جستجوی موسیقی ${text}` : 'جستجوی موسیقی');

  const musics = query.data?.data ?? [];
  const meta = query.data?.meta ?? null;

  const handleSubmit = (event) => {
    event.preventDefault();
    committedRef.current = term;
    commit({ text: term, page: null });
  };

  const handlePageChange = (nextPage) => {
    commit({ page: nextPage > 1 ? nextPage : null });
    window.scrollTo(0, 0);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="sr-only">جستجوی موسیقی</h1>

      <form onSubmit={handleSubmit} role="search">
        <Input
          label="جستجوی موسیقی"
          srLabel
          type="search"
          name="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="نام خواننده یا آلبوم را بنویسید"
          autoComplete="off"
        />
      </form>

      <div className="mt-8">
        <SectionHeader
          title={text ? 'نتایج جستجو' : 'همه آلبوم‌ها'}
          count={meta?.total}
          countUnit="آلبوم"
        />

        {query.isError ? (
          <Alert title="جستجو انجام نشد" onRetry={() => query.refetch()}>
            {query.error?.message}
          </Alert>
        ) : null}

        {/*
          A spinner rather than PosterSkeleton: that skeleton is a 216×332 poster
          block and music covers are square, so a wrong-shaped placeholder would
          shift the grid the moment the covers land.
        */}
        {query.isPending ? <Loader label="در حال جستجو" /> : null}

        {query.isSuccess && musics.length === 0 ? (
          <EmptyState
            title="نتیجه‌ای پیدا نشد"
            hint={
              text
                ? `برای «${text}» آلبومی در فهرست سایت نیست. نام خواننده را امتحان کنید یا جستجو را پاک کنید.`
                : 'فهرست موسیقی هنوز خالی است.'
            }
            actionLabel={text ? 'پاک کردن جستجو' : undefined}
            actionTo={text ? '/musics' : undefined}
          />
        ) : null}

        {musics.length > 0 ? (
          <>
            <MediaGrid>
              {musics.map((music) => (
                <MusicCard key={music._id} music={music} />
              ))}
            </MediaGrid>
            <Pagination meta={meta} onChange={handlePageChange} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default MusicSearch;
