/**
 * Search — the movie finder.
 *
 * Purpose: find a title by name, or browse everything when nothing is typed.
 * Inputs:  query string `text`, `page`, `item_sort`
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          hooks/useDebouncedValue, utils/constants, components/{catalog,ui}
 *
 * Legacy counterpart: `search.php` — a GET form with a single `text` field that
 * called `?@=search` and printed a poster grid. Preserved from it:
 *   - THE URL IS THE STATE. It was a GET form, so a result page could be
 *     bookmarked, refreshed, shared and reached with the back button. That still
 *     has to hold, which is why every parameter lives in `useSearchParams` and
 *     the text field is only a mirror of it.
 *   - AN EMPTY `text` IS A VALID REQUEST. The legacy endpoint answered it with
 *     the first page of every active movie (backend movie.service.js
 *     searchMovies), and the page linked from the site header with no query at
 *     all — so an empty box is a browse screen, never an error.
 *
 * Added here: sorting and pagination. The legacy page rendered neither, and its
 * result set was silently truncated to the API's page size (MIGRATION.md §7.6).
 *
 * Sort keys come from SEARCH_SORT_OPTIONS, which is NARROWER than the category
 * listing's whitelist and defaults to `id`. The server rejects anything outside
 * it with a 400 rather than falling back (backend utils/pagination.js
 * resolveSort), so a hand-edited URL is normalised here before it is sent.
 *
 * The same shell exists on MusicSearch.jsx. They are kept as two pages rather
 * than one generic one because they were two legacy pages with different result
 * cards and different capabilities — music search accepts no sort at all.
 *
 * GAMES ARE SEARCHED HERE TOO, which no legacy page did — the legacy portal had
 * no games (MIGRATION.md §9). A typed term is also sent to `GET /api/games`, and
 * any games it matches are shown as one rail ABOVE the film results, with the
 * real total and a «نمایش همه» into the games page carrying the same term.
 *
 * A rail rather than a second grid, so that games never push the films — still
 * what this page is for — more than one row down, on a phone or on a desktop.
 * And only when something has been typed: with an empty box this page is the
 * film catalog, and the games page is its counterpart for games.
 *
 * The games request is independent of the film one. It cannot delay the film
 * results, and if it fails the rail is simply absent — the films have their own
 * error state, and a second alert for an extra would be noise. The sort control
 * does not apply to it either: those keys are the film endpoint's.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchMovies } from '../api/catalog.js';
import { fetchGames } from '../api/games.js';
import { PAGE_SIZE, SEARCH_GAME_LIMIT, SEARCH_SORT_OPTIONS } from '../utils/constants.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import MovieCard from '../components/catalog/MovieCard.jsx';
import GameCard from '../components/catalog/GameCard.jsx';
import { MediaGrid, MediaRail, RailItem } from '../components/catalog/MediaGrid.jsx';
import { Alert, EmptyState, PosterSkeleton } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { Input, Select } from '../components/ui/Input.jsx';

const DEFAULT_SORT = SEARCH_SORT_OPTIONS[0].value;

/** Keeps a hand-typed `item_sort` from turning into a 400 from the server. */
function normalizeSort(value) {
  return SEARCH_SORT_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_SORT;
}

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();

  const text = searchParams.get('text') ?? '';
  const sort = normalizeSort(searchParams.get('item_sort') ?? DEFAULT_SORT);
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [term, setTerm] = useState(text);
  const debouncedTerm = useDebouncedValue(term, 350);

  /**
   * The last value this page pushed into the URL. It is what tells a URL change
   * that WE caused apart from one the passenger caused (back button, a shared
   * link), so the field is only overwritten by the latter and never mid-word.
   */
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

  // Typing settles into the URL. `replace` keeps a word typed one letter at a
  // time from filling the history stack; any new term restarts at page 1.
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
    queryKey: ['search', 'movies', { text, page, sort }],
    queryFn: () =>
      searchMovies({
        // Omitted rather than sent empty: an absent `text` is the endpoint's own
        // "everything" case, and the server trims and length-checks it anyway.
        text: text || undefined,
        page,
        limit: PAGE_SIZE,
        item_sort: sort,
      }),
    // Posters stay on screen while the next page arrives, so paging does not
    // blank the grid on a slow link.
    placeholderData: keepPreviousData,
  });

  /**
   * Games matching the same term. Keyed on `text` alone: paging or re-sorting
   * the films must not refetch a rail that neither of them changes.
   */
  const gamesQuery = useQuery({
    queryKey: ['search', 'games', { text }],
    queryFn: () => fetchGames({ text, limit: SEARCH_GAME_LIMIT }),
    enabled: Boolean(text),
    retry: false,
  });

  useDocumentTitle(text ? `جستجوی ${text}` : 'جستجوی فیلم');

  const movies = query.data?.data ?? [];
  const meta = query.data?.meta ?? null;

  // The key carries the term, so an emptied box has no data and no rail.
  const games = gamesQuery.data?.data ?? [];
  const gamesTotal = gamesQuery.data?.meta?.total ?? games.length;

  const handleSubmit = (event) => {
    // The field is already debounced into the URL; submitting commits it at
    // once, and keeps the form working for anyone pressing Enter.
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
      <h1 className="sr-only">جستجو</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row" role="search">
        <Input
          label="جستجوی فیلم و بازی"
          srLabel
          type="search"
          name="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="نام فیلم یا بازی را بنویسید"
          autoComplete="off"
        />

        <div className="sm:w-52 sm:shrink-0">
          <Select
            label="ترتیب نمایش"
            srLabel
            options={SEARCH_SORT_OPTIONS}
            value={sort}
            onChange={(event) => commit({ item_sort: event.target.value, page: null })}
          />
        </div>
      </form>

      {games.length > 0 ? (
        <section className="mt-8">
          <SectionHeader
            title="بازی‌ها"
            count={gamesTotal}
            countUnit="بازی"
            // Only when the rail is not already the whole answer: a «نمایش همه»
            // that leads to the same three games is a wasted tap.
            to={gamesTotal > games.length ? `/games?text=${encodeURIComponent(text)}` : undefined}
          />
          <MediaRail>
            {games.map((game) => (
              <RailItem key={game._id} wide>
                <GameCard game={game} />
              </RailItem>
            ))}
          </MediaRail>
        </section>
      ) : null}

      <div className="mt-8">
        <SectionHeader
          // Named for what it holds once a second kind of result shares the page.
          title={!text ? 'همه فیلم‌ها' : games.length > 0 ? 'فیلم‌ها' : 'نتایج جستجو'}
          count={meta?.total}
          countUnit="عنوان"
        />

        {query.isError ? (
          <Alert title="جستجو انجام نشد" onRetry={() => query.refetch()}>
            {query.error?.message}
          </Alert>
        ) : null}

        {query.isPending ? (
          <MediaGrid>
            <PosterSkeleton count={12} />
          </MediaGrid>
        ) : null}

        {query.isSuccess && movies.length === 0 ? (
          <EmptyState
            // With games found above, "nothing found" would be untrue.
            title={games.length > 0 ? 'فیلمی با این نام پیدا نشد' : 'نتیجه‌ای پیدا نشد'}
            hint={
              text
                ? games.length > 0
                  ? `برای «${text}» فیلمی در فهرست سایت نیست؛ بازی‌های هم‌نام بالاتر آمده‌اند.`
                  : `برای «${text}» عنوانی در فهرست سایت نیست. املای دیگری را امتحان کنید یا جستجو را پاک کنید.`
                : 'فهرست فیلم‌ها هنوز خالی است.'
            }
            actionLabel={text ? 'پاک کردن جستجو' : undefined}
            actionTo={text ? '/search' : undefined}
          />
        ) : null}

        {movies.length > 0 ? (
          <>
            <MediaGrid>
              {movies.map((movie) => (
                <MovieCard key={movie._id} movie={movie} />
              ))}
            </MediaGrid>
            <Pagination meta={meta} onChange={handlePageChange} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Search;
