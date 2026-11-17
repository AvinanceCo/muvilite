/**
 * Games — the games list.
 *
 * Purpose: browse every game, narrow by genre or to the popular ones, or find
 *          one by name.
 * Inputs:  query string `text`, `genre`, `popular`, `page`
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/games,
 *          hooks/useDebouncedValue, utils/constants, components/{catalog,ui}
 *
 * No legacy counterpart — the legacy portal had no games. The screen is Playva's
 * home page list (`playva-front/components/GamesList.js`): a search box, a row
 * of genre filters led by «همه» and «پرطرفدار», a grid, pagination.
 *
 * Built on the same rules as Search.jsx and MusicSearch.jsx, because a passenger
 * should not have to learn a third way a listing behaves:
 *   - THE URL IS THE STATE. A filtered, paged view survives a refresh, the back
 *     button after a game, and being shared.
 *   - AN EMPTY BOX IS A BROWSE SCREEN. No `text` means every game.
 *   - typing settles into the URL with `replace`, so a word typed letter by
 *     letter does not fill the history stack.
 *
 * «پرطرفدار» AND A GENRE ARE ALTERNATIVES, not a combination — one row, one
 * selection, as in Playva, where both lived in a single `genre` value. Choosing
 * one clears the other. The API would accept both together; this screen simply
 * never asks.
 *
 * There is no sort control. The catalog is newest-first, and «پرطرفدار» is the
 * one other ordering on offer — it is a filter and an order at once (games opened
 * at least once, most opened first), which a separate dropdown could only
 * contradict.
 *
 * The genre row is the one thing here that is fetched separately, and the page
 * does not wait for it: the grid renders with «همه» and «پرطرفدار» alone and the
 * genres join them when they arrive. If that request fails the row just stays
 * short — a missing filter is not worth an error message.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchGames, fetchGameGenres } from '../api/games.js';
import { PAGE_SIZE } from '../utils/constants.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import GameCard from '../components/catalog/GameCard.jsx';
import { MediaGrid } from '../components/catalog/MediaGrid.jsx';
import { Alert, EmptyState, Loader } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { Input } from '../components/ui/Input.jsx';

/** The API's ids are 24 hex characters; anything else in the URL is ignored. */
const isObjectId = (value) => /^[0-9a-f]{24}$/i.test(value ?? '');

/**
 * One entry in the filter row.
 *
 * A tint, not a fill: the selected chip is "where you are", and a screen's one
 * solid fill is reserved for its loudest action (src/index.css).
 */
function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'h-9 shrink-0 rounded-full border px-4 text-sm transition-colors ' +
        (active
          ? 'border-azure bg-azure-dim/40 text-azure'
          : 'border-line bg-panel text-muted hover:border-azure-dim hover:text-paper')
      }
    >
      {children}
    </button>
  );
}

export function Games() {
  const [searchParams, setSearchParams] = useSearchParams();

  const text = searchParams.get('text') ?? '';
  // A hand-edited `genre` that is not an id would be a 422 from the server;
  // it is dropped here instead, and the page shows everything.
  const genre = isObjectId(searchParams.get('genre')) ? searchParams.get('genre') : '';
  // A genre in the URL wins over `popular`, so the two can never both be lit.
  const popular = !genre && searchParams.get('popular') === '1';
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

  const genres = useQuery({
    queryKey: ['games', 'genres'],
    queryFn: fetchGameGenres,
    // Reference data: it changes when an operator edits it, not during a flight.
    staleTime: 10 * 60_000,
    retry: false,
  });

  const query = useQuery({
    queryKey: ['games', 'list', { text, genre, popular, page }],
    queryFn: () =>
      fetchGames({
        text: text || undefined,
        genre: genre || undefined,
        popular: popular || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    // The grid stays on screen while the next page or filter arrives.
    placeholderData: keepPreviousData,
  });

  const genreList = genres.data ?? [];
  const activeGenre = genreList.find((entry) => entry._id === genre) ?? null;

  useDocumentTitle(text ? `جستجوی بازی ${text}` : 'بازی‌ها');

  const games = query.data?.data ?? [];
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

  /** One selection in the row: everything, the popular ones, or one genre. */
  const select = ({ nextGenre = null, nextPopular = false }) =>
    commit({ genre: nextGenre, popular: nextPopular ? '1' : null, page: null });

  const heading = text
    ? 'نتایج جستجو'
    : popular
      ? 'پرطرفدارترین بازی‌ها'
      : (activeGenre?.nameFa ?? 'همه بازی‌ها');

  const filtered = Boolean(genre || popular);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="sr-only">بازی‌ها</h1>

      <form onSubmit={handleSubmit} role="search">
        <Input
          label="جستجوی بازی"
          srLabel
          type="search"
          name="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="نام بازی را بنویسید"
          autoComplete="off"
        />
      </form>

      {/* Scrolls sideways on a phone rather than wrapping into a wall of chips
          above the first game. The negative margin lets it run to the screen
          edge, which is what tells a thumb there is more to the left. */}
      <div
        className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label="دسته‌بندی بازی‌ها"
      >
        <FilterChip active={!filtered} onClick={() => select({})}>
          همه
        </FilterChip>
        <FilterChip active={popular} onClick={() => select({ nextPopular: true })}>
          پرطرفدار
        </FilterChip>
        {genreList.map((entry) => (
          <FilterChip
            key={entry._id}
            active={entry._id === genre}
            onClick={() => select({ nextGenre: entry._id })}
          >
            {entry.nameFa}
          </FilterChip>
        ))}
      </div>

      <div className="mt-8">
        <SectionHeader title={heading} count={meta?.total} countUnit="بازی" />

        {query.isError ? (
          <Alert title="فهرست بازی‌ها بارگذاری نشد" onRetry={() => query.refetch()}>
            {query.error?.message}
          </Alert>
        ) : null}

        {/* A spinner rather than PosterSkeleton, for the reason MusicSearch
            gives: that skeleton is a tall poster block and these tiles are wide,
            so it would shift the grid the moment the games land. */}
        {query.isPending ? <Loader label="در حال بارگذاری بازی‌ها" /> : null}

        {query.isSuccess && games.length === 0 ? (
          <EmptyState
            title={text || filtered ? 'بازی‌ای پیدا نشد' : 'هنوز بازی‌ای نیست'}
            hint={
              text
                ? `برای «${text}» بازی‌ای در فهرست سایت نیست. نام دیگری را امتحان کنید یا جستجو را پاک کنید.`
                : popular
                  ? 'هنوز هیچ بازی‌ای باز نشده است. از فهرست همه بازی‌ها یکی را انتخاب کنید.'
                  : genre
                    ? 'در این دسته هنوز بازی‌ای نیست.'
                    : 'فهرست بازی‌ها هنوز خالی است.'
            }
            actionLabel={text || filtered ? 'نمایش همه بازی‌ها' : undefined}
            actionTo={text || filtered ? '/games' : undefined}
          />
        ) : null}

        {games.length > 0 ? (
          <>
            <MediaGrid>
              {games.map((game) => (
                <GameCard key={game._id} game={game} />
              ))}
            </MediaGrid>
            <Pagination meta={meta} onChange={handlePageChange} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Games;
