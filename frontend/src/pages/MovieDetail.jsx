/**
 * Movie detail — the title card.
 *
 * Purpose: everything a passenger needs to decide to watch, and one control that
 *          starts playback.
 * Inputs:  route param `id` (movie id)
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          services/{media,format}, components/{catalog,ui}
 *
 * Legacy counterpart: `movie.php`, which called `?@=movie` and `?@=similar` and
 * rendered a poster header, a small-details strip, genre links, a play button,
 * the storyline, the credits grid and a similar-titles strip. All of it is here.
 *
 * Preserved from the legacy page:
 *   - the small-details strip showed COUNTRY and RUNTIME only; the age rating
 *     and the production company were commented out in the markup. The strip
 *     below keeps country and runtime first and adds the IMDb rank and age
 *     rating when the API reports them, because both are now part of the detail
 *     response (backend movie.service.js getMovieDetail) and neither pushes the
 *     strip past one compact row.
 *   - the credits grid is rendered only when there are credits, and each face
 *     shows the Persian name over the Persian role label.
 *   - the document title is `title_fa - title_en (publish_date)` with the
 *     Persian description as the meta description.
 *
 * A MOVIE WITHOUT A PRIMARY GENRE IS A 404. That is deliberate: the legacy
 * `Movie::withGenre()` INNER JOINed genres_tbl on genre_1, so such a row never
 * rendered, and backend movie.service.js enforces it explicitly. A 404 here
 * therefore means "this title is not published", not "something broke", and it
 * gets a real empty state with a way onward rather than an error box.
 *
 * Media paths are stored fields read off the document — never rebuilt from the
 * id. The legacy `/assets/movies/{id}.jpg` convention is gone because uploads
 * now get unique filenames (services/media.js).
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMovie, fetchSimilarMovies } from '../api/catalog.js';
import { PLACEHOLDER_SLOTS } from '../services/media.js';
import MediaImage from '../components/media/MediaImage.jsx';
import { formatRank, formatRuntime, formatYear, toParagraphs } from '../services/format.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import MovieCard from '../components/catalog/MovieCard.jsx';
import { MediaGrid } from '../components/catalog/MediaGrid.jsx';
import { Alert, EmptyState, Loader } from '../components/ui/Feedback.jsx';
import Button from '../components/ui/Button.jsx';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

/**
 * The compact strip under the title. Entries with nothing to show are dropped
 * rather than rendered empty — `formatRank` returns '' for an unrated title
 * (rank 0) and `formatRuntime` returns '' when the length was never recorded.
 */
function MetaStrip({ movie }) {
  const entries = [
    { key: 'country', label: 'کشور', value: movie.country?.fa },
    { key: 'runtime', label: 'مدت', value: formatRuntime(movie.movieLength) },
    { key: 'rank', label: 'IMDb', value: formatRank(movie.imdbRank), mono: true },
    { key: 'age', label: 'رده سنی', value: movie.ageRange?.nameFa },
  ].filter((entry) => Boolean(entry.value));

  if (entries.length === 0) return null;

  return (
    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {entries.map((entry) => (
        <div key={entry.key} className="flex items-center gap-1.5">
          <dt className="text-muted">{entry.label}</dt>
          <dd className={entry.mono ? 'font-mono text-azure' : 'text-paper'}>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MovieDetail() {
  const { id } = useParams();

  const movieQuery = useQuery({
    queryKey: ['movie', id],
    queryFn: () => fetchMovie(id),
  });

  const movie = movieQuery.data;

  /**
   * Related titles are a second request because they are a second endpoint, and
   * they are held until the movie itself resolves: when the movie 404s the
   * similar endpoint 404s for the same reason, and a doomed request costs a
   * round trip on a cabin link.
   */
  const similarQuery = useQuery({
    queryKey: ['movie', id, 'similar'],
    queryFn: () => fetchSimilarMovies(id),
    enabled: movieQuery.isSuccess,
  });

  const year = formatYear(movie?.publishYear);
  const documentTitle = movie
    ? `${[movie.titleFa, movie.titleEn].filter(Boolean).join(' — ')}${year ? ` (${year})` : ''}`
    : null;

  useDocumentTitle(documentTitle, movie?.descriptionFa ?? '');

  if (movieQuery.isPending) {
    return <Loader label="در حال بارگذاری فیلم" />;
  }

  // A 404 is an answer: the title is unpublished, deleted, or has no primary
  // genre (see the file header). Nothing to retry.
  if (movieQuery.error?.isNotFound) {
    return (
      <EmptyState
        title="این فیلم در دسترس نیست"
        hint="ممکن است از فهرست سایت برداشته شده باشد. عنوان دیگری را جستجو کنید."
        actionLabel="جستجوی فیلم"
        actionTo="/search"
      />
    );
  }

  if (movieQuery.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Alert title="اطلاعات فیلم بارگذاری نشد" onRetry={() => movieQuery.refetch()}>
          {movieQuery.error?.message}
        </Alert>
      </div>
    );
  }

  // Both the blurred backdrop and the poster itself draw this, and both fall
  // back to the configured placeholder when it is missing.
  const posterPath = movie.posterPath ?? movie.thumbnailPath;
  const storyline = toParagraphs(movie.descriptionFa);
  const similar = similarQuery.data ?? [];

  return (
    <article>
      <header className="relative overflow-hidden">
        {/*
          The legacy header layered the poster as a blurred `background-cover`
          behind the content. Same idea, at low opacity, faded into the cabin
          ground so the text keeps its contrast.
        */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 sm:h-96">
          <MediaImage
            path={posterPath}
            slot={PLACEHOLDER_SLOTS.MOVIE_POSTER}
            loading="lazy"
            decoding="async"
            className="size-full scale-110 object-cover opacity-25 blur-2xl"
          />
          <div className="absolute inset-0 bg-linear-to-b from-ink/50 via-ink/85 to-ink" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-8 sm:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            <div className="w-36 shrink-0 sm:w-52">
              <MediaImage
                path={posterPath}
                slot={PLACEHOLDER_SLOTS.MOVIE_POSTER}
                alt={movie.titleFa || movie.titleEn}
                loading="lazy"
                decoding="async"
                className="aspect-[216/332] w-full rounded-panel border border-line bg-panel object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {movie.titleFa || movie.titleEn}
                {year ? <span className="ms-2 font-mono text-lg text-muted">{year}</span> : null}
              </h1>

              {movie.titleEn && movie.titleFa ? (
                <p className="mt-1 text-sm text-muted" dir="ltr">
                  {movie.titleEn}
                </p>
              ) : null}

              <MetaStrip movie={movie} />

              {movie.genres.length > 0 ? (
                /*
                  Genres are chips, not links. The legacy page linked each one to
                  `/search?genre={id}`, but `search.php` read only `text` and the
                  search endpoint accepts no genre filter (backend
                  movie.service.js searchMovies -> buildSearchFilter), so those
                  links led to an unfiltered result page. A dead link is worse
                  than a label, so the label is what is rendered.
                */
                <ul className="mt-4 flex flex-wrap gap-2">
                  {movie.genres.map((genre) => (
                    <li
                      key={genre.id}
                      className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted"
                    >
                      {genre.nameFa || genre.nameEn}
                    </li>
                  ))}
                </ul>
              ) : null}

              <Button
                to={`/player/${movie.id}`}
                variant="play"
                size="lg"
                className="mt-6 w-full sm:w-auto"
              >
                <PlayIcon />
                نمایش
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-4 pb-14">
        {storyline.length > 0 ? (
          <section>
            <SectionHeader title="خلاصه داستان" />
            {/*
              The legacy page echoed the description after replacing \r\n with
              <br>. `toParagraphs` keeps that line structure without injecting
              markup — the text is admin-entered and is never trusted as HTML.
            */}
            <div className="space-y-3 text-sm leading-7 text-muted sm:text-base">
              {storyline.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        ) : null}

        {movie.casts.length > 0 ? (
          <section>
            <SectionHeader title="دست‌اندرکاران" />
            <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
              {movie.casts.map((cast) => (
                <li key={cast.id} className="text-center">
                  <MediaImage
                    path={cast.photoPath}
                    slot={PLACEHOLDER_SLOTS.CAST_PHOTO}
                    loading="lazy"
                    decoding="async"
                    className="mx-auto aspect-square w-20 rounded-full border border-line bg-panel object-cover sm:w-24"
                  />
                  <p className="mt-2 truncate text-sm leading-6">
                    {cast.fullnameFa || cast.fullnameEn}
                  </p>
                  {cast.roleLabel ? (
                    <p className="truncate text-xs text-muted">{cast.roleLabel.fa}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {similar.length > 0 ? (
          <section>
            {/*
              No count and no "see all": the endpoint returns exactly four titles
              in random order and there is no listing behind it
              (backend SIMILAR_MOVIE_LIMIT, `ORDER BY RAND() LIMIT 0,4`).
            */}
            <SectionHeader title="فیلم‌های مشابه" />
            <MediaGrid>
              {similar.map((item) => (
                <MovieCard key={item._id} movie={item} />
              ))}
            </MediaGrid>
          </section>
        ) : null}
      </div>
    </article>
  );
}

export default MovieDetail;
