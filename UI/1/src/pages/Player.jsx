/**
 * Player — fullscreen video playback.
 *
 * Purpose: play a movie and report watch time.
 * Inputs:  route param `id` (movie id)
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/tracking,
 *          hooks/useMediaSession, components/player/{MuviFilm,PrerollAd}
 *
 * Legacy counterpart: `player2.php`, with the ad break from `player.php`.
 * Preserved from them:
 *   - the page is chromeless and the only navigation is a back link to the
 *     movie (`/movie?id=` there, `/movie/:id` here);
 *   - ±15 / +30 second seek buttons beside the play control;
 *   - `?seek=<seconds>` resumes at a position, applied once the media is ready;
 *   - a watch session is opened for the movie, and a heartbeat is sent on an
 *     interval while playing, cleared on pause/stop/error/complete;
 *   - an advertisement plays before the film, skippable after a few seconds,
 *     and the film follows whether it was watched or skipped.
 *
 * The ad break is a SEPARATE video element, not a source swap on this one. Two
 * elements keep the watch heartbeat off the advertisement for free: the handlers
 * that start and stop it are bound to the film, so ad time can never be credited
 * as watch time. `?seek=` is likewise untouched by the ad.
 *
 * WATCH TIME IS NOT CHARGED FOR THE AD, but the watch session is opened before
 * it — as the legacy page did, since `watch_add` ran on page load while jwplayer
 * played the pre-roll. A session with zero seconds is therefore normal.
 *
 * Not carried over: flowplayer, jQuery and the automatic fullscreen-on-load.
 * A browser will reject a programmatic fullscreen request that no user gesture
 * triggered, so the legacy call worked only incidentally. The film is drawn at
 * the full size of the viewport instead, and a fullscreen control in the chrome
 * gives the real thing on a tap.
 *
 * DEFECT NOT REPRODUCED: the legacy heartbeat posted the MOVIE id where the
 * session id belonged, so every beat updated the wrong row. The session id is a
 * path parameter now (see hooks/useMediaSession.js).
 *
 * The video URL comes from `videoPath` on the session response. The legacy page
 * built it as `/assets/video/{id}.mp4`; media paths are stored fields now,
 * because uploads get unique filenames and can no longer be derived from an id.
 *
 * ONE PLAYER (NEW, beyond parity). Every source plays in the Muvi player
 * (components/player/MuviFilm.jsx): an uploaded video, which the server has
 * transcoded to an adaptive HLS set, and equally an external MP4 link or a file
 * uploaded before the transcoder existed, which Muvi plays as a single
 * progressive file. Muvi owns the control bar, including the legacy −15/+30 pair.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createWatchSession } from '../api/tracking.js';
import { fetchPrerollAd } from '../api/ads.js';
import { useWatchSession } from '../hooks/useMediaSession.js';
import { mediaUrl, PLACEHOLDER_SLOTS } from '../services/media.js';
import { usePlaceholderUrl } from '../context/PlaceholderContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { Alert, Loader } from '../components/ui/Feedback.jsx';
import Button from '../components/ui/Button.jsx';
import PrerollAd from '../components/player/PrerollAd.jsx';
import MuviFilm from '../components/player/MuviFilm.jsx';

/** Transcoder states in which a title's first upload is still on its way. */
const PREPARING_STATUSES = new Set(['queued', 'processing']);

export function Player() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // The Muvi player; exposes play() for the hand-over after the pre-roll.
  const filmRef = useRef(null);
  // Read by the heartbeat as `lastSecond`. A ref, not state, so reporting the
  // position never re-renders the player.
  const positionRef = useRef(0);
  // Whether an advertisement actually ran, which decides whether the film may
  // be started programmatically once it finishes.
  const adPlayedRef = useRef(false);

  const [movie, setMovie] = useState(null);
  const [playbackError, setPlaybackError] = useState(false);
  /** True once the ad break is over — or immediately, when there is no ad. */
  const [adDone, setAdDone] = useState(false);

  const getPosition = useCallback(() => positionRef.current, []);
  const { start, stop } = useWatchSession(id, getPosition);

  /**
   * Opening the session is a write, so it is a mutation rather than a query:
   * it must not be retried on focus, replayed from cache, or fired twice for
   * one visit — each call creates a watch_history row and increments the
   * movie's visit count.
   */
  const session = useMutation({
    mutationFn: () => createWatchSession(id),
    onSuccess: (data) => setMovie(data.movie),
  });

  const openSession = session.mutate;
  useEffect(() => {
    openSession();
  }, [openSession, id]);

  /**
   * The pre-roll draw for this playback.
   *
   * Every option here exists to keep it a genuine draw. It must not be shared
   * between films, replayed from cache, or refetched when the tab regains focus
   * — each of those would either show the same creative every time or swap the
   * advertisement mid-play. A failure resolves to "no ad": a passenger must
   * never be kept from their film because an ad server was unreachable, which is
   * also why it is not retried.
   */
  const preroll = useQuery({
    queryKey: ['preroll', id],
    queryFn: () => fetchPrerollAd().catch(() => null),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // A new film is a new draw, and its ad has not been seen yet.
  useEffect(() => {
    setAdDone(false);
    adPlayedRef.current = false;
  }, [id]);

  /**
   * Hands playback over from the ad to the film.
   *
   * The film is asked to start because the passenger already tapped once to
   * begin the ad, and user activation persists for the document — the same
   * continuity the legacy player had, where content followed the ad break
   * without a second tap. A browser that refuses leaves the film paused behind
   * its own controls, which is the no-ad behaviour and no worse.
   *
   * An effect, not the finish handler: the handler runs before React has
   * committed `adDone`, and `play()` on a film still covered by the ad would
   * start it underneath.
   */
  useEffect(() => {
    if (!adDone || !adPlayedRef.current) return;
    filmRef.current?.play();
  }, [adDone]);

  useDocumentTitle(movie ? `پخش ${movie.titleFa}` : null);

  /** `?seek=` from the legacy player; Muvi applies it once the media can seek. */
  const initialSeek = Number.parseInt(searchParams.get('seek') ?? '', 10);

  const source = mediaUrl(movie?.videoPath);
  const preparing = !source && PREPARING_STATUSES.has(movie?.videoStatus);

  const reportPosition = useCallback((seconds) => {
    positionRef.current = seconds;
  }, []);
  const failPlayback = useCallback(() => setPlaybackError(true), []);

  /**
   * The still shown before playback starts.
   *
   * The configured placeholder only: with nothing configured this stays
   * undefined and the player shows black, which is what a player should do —
   * the bundled 216×332 holder floating in the middle of a full-screen player
   * would look like a fault.
   */
  const placeholderFor = usePlaceholderUrl();
  const poster =
    mediaUrl(movie?.posterPath) ?? placeholderFor(PLACEHOLDER_SLOTS.MOVIE_POSTER) ?? undefined;

  /**
   * Whether an ad should play before this film.
   *
   * A film with no video file gets no ad: leading into an error screen with an
   * advertisement would be worse than the error alone.
   */
  const ad = preroll.data ?? null;
  const showAd = Boolean(ad?.videoPath) && !adDone && Boolean(source);

  const handleAdFinished = useCallback(() => {
    adPlayedRef.current = true;
    setAdDone(true);
  }, []);

  // The ad draw resolves in parallel with the session, so both are waited on —
  // otherwise the film flashes on screen for a frame before the ad replaces it.
  // Every state below fills the player shell, so the screen never jumps between
  // a short loading page and a full-height film.
  if (session.isPending || preroll.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader label="در حال آماده‌سازی پخش" />
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Alert title="پخش شروع نشد" onRetry={() => session.mutate()}>
            {session.error?.message}
          </Alert>
          <Button to={`/movie/${id}`} variant="ghost" size="sm" className="mt-4">
            بازگشت به صفحه فیلم
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Rendered over the film rather than instead of it, so the film is
          already mounted and buffering when the ad hands over. */}
      {showAd ? <PrerollAd ad={ad} onFinish={handleAdFinished} /> : null}

      {source && !playbackError ? (
        <MuviFilm
          ref={filmRef}
          source={source}
          poster={poster}
          title={movie?.titleFa}
          movieId={id}
          startAt={initialSeek}
          backTo={`/movie/${id}`}
          onStart={start}
          onStop={stop}
          onPosition={reportPosition}
          onFatalError={failPlayback}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4">
          <div className="w-full max-w-md">
            <Alert
              title={
                playbackError
                  ? 'پخش این فیلم ممکن نشد'
                  : preparing
                    ? 'این فیلم در حال آماده‌سازی است'
                    : 'فایل این فیلم هنوز بارگذاری نشده'
              }
            >
              {playbackError
                ? 'فایل ویدئو باز نشد. کمی بعد دوباره تلاش کنید.'
                : preparing
                  ? 'ویدئوی این عنوان در حال پردازش است و به‌زودی قابل پخش می‌شود.'
                  : 'این عنوان در فهرست هست اما فایل تصویری‌اش ثبت نشده است.'}
            </Alert>
            <Button to={`/movie/${id}`} variant="ghost" size="sm" className="mt-4">
              بازگشت به صفحه فیلم
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Player;
