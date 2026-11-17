/**
 * GamePlay — one game, filling the screen.
 *
 * Purpose: load a game's bundle into a frame and get out of its way.
 * Inputs:  route param `id`
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/games, services/media,
 *          components/ui
 *
 * No legacy counterpart — the legacy portal had no games. The screen is Playva's
 * `GamePlayer` (`playva-front/app/game/[id]/GamePlayer.js`): a bar with a way
 * back, the game's name, a fullscreen toggle and "open in a new tab", over an
 * iframe pointed at the bundle's `index.html`. Playva's leaderboard panel is not
 * here; the leaderboard was left out of this section altogether.
 *
 * IT SITS IN THE PLAYER LAYOUT, not the main one, for the reason the film player
 * does: on a phone held in a seat the game should have every pixel the browser
 * will give it. The bar is the only chrome, and it is forty-eight pixels.
 *
 * THE FRAME IS NOT SANDBOXED, and that is deliberate. Games keep their progress
 * in `localStorage` and IndexedDB, which a sandboxed frame without
 * `allow-same-origin` is denied — and a frame WITH it, on this origin, is not
 * sandboxed in any way that matters. The passenger site holds nothing a game
 * could take: there is no sign-in here, and the one stored value is an anonymous
 * poll token. The admin panel is a different matter and is handled where it is
 * served (backend MIGRATION.md §19).
 *
 * FULLSCREEN is the browser's own, on the whole screen including the bar — so
 * the way out stays visible and reachable without knowing a gesture. The button
 * is only drawn where the browser supports it; an iPhone does not, for anything
 * but video, and offering a control that does nothing is worse than not
 * offering it.
 *
 * AN OPENING IS COUNTED ONCE, when the game's record has arrived — not when the
 * route is entered, so an address that leads nowhere counts nothing. The ref
 * guards against the double effect React runs in development, and against a
 * refetch counting a second time.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGame, registerGameClick } from '../api/games.js';
import { mediaUrl } from '../services/media.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { Button } from '../components/ui/Button.jsx';
import { Loader } from '../components/ui/Feedback.jsx';

/** The square control every action in the bar shares. */
const BAR_BUTTON =
  'grid size-10 shrink-0 place-items-center rounded-lg text-paper transition-colors hover:bg-panel';

function BackIcon() {
  // Points right: in a right-to-left page, "back" is toward the start edge.
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      {active ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function NewTabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A dead end inside the chromeless layout, with the one way forward. */
function Notice({ title, children, onRetry }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-sm text-sm leading-6 text-muted">{children}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button size="sm" onClick={onRetry}>
            تلاش دوباره
          </Button>
        ) : null}
        <Button to="/games" variant="primary" size="sm">
          همه بازی‌ها
        </Button>
      </div>
    </div>
  );
}

export function GamePlay() {
  const { id } = useParams();
  const shellRef = useRef(null);
  const countedRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const query = useQuery({
    queryKey: ['games', 'detail', id],
    queryFn: () => fetchGame(id),
    // A missing game stays missing; retrying only delays saying so.
    retry: (failureCount, error) => !error?.isNotFound && failureCount < 2,
  });

  const game = query.data ?? null;

  useDocumentTitle(game?.titleFa ?? 'بازی');

  // A different game is a different frame: the loading state starts over.
  useEffect(() => setLoaded(false), [id]);

  useEffect(() => {
    if (!game?._id || countedRef.current === game._id) return;
    countedRef.current = game._id;
    // Nothing on screen depends on the answer, so a failure is not shown.
    registerGameClick(game._id).catch(() => {});
  }, [game?._id]);

  // The browser can leave fullscreen without us — Escape, a back gesture — so
  // the icon follows the document rather than the last click.
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      // Refused when the browser decides the gesture does not qualify; there is
      // nothing useful to tell the passenger, and the game is still playable.
      shellRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  if (query.isPending) {
    return (
      <div className="flex h-full items-center justify-center bg-ink">
        <Loader label="در حال بارگذاری بازی" />
      </div>
    );
  }

  if (query.isError) {
    return query.error?.isNotFound ? (
      <Notice title="این بازی پیدا نشد">
        نشانی‌ای که باز کردید به بازی‌ای نمی‌رسد؛ شاید از فهرست سایت برداشته شده باشد.
      </Notice>
    ) : (
      <Notice title="بازی بارگذاری نشد" onRetry={() => query.refetch()}>
        {query.error?.message}
      </Notice>
    );
  }

  const gameUrl = mediaUrl(game.gameUrl);
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  return (
    <div ref={shellRef} className="flex h-full flex-col bg-ink">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-1.5">
        <Link to="/games" className={BAR_BUTTON} aria-label="بازگشت به بازی‌ها">
          <BackIcon />
        </Link>

        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-md text-lg leading-none"
          style={{ backgroundImage: `linear-gradient(135deg, ${game.color1}, ${game.color2})` }}
        >
          {game.emoji}
        </span>

        <div className="min-w-0 flex-1 px-1.5">
          <h1 className="truncate text-sm font-bold leading-5">{game.titleFa}</h1>
          {game.genre?.nameFa ? (
            <p className="truncate text-xs leading-4 text-muted">{game.genre.nameFa}</p>
          ) : null}
        </div>

        {canFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className={BAR_BUTTON}
            aria-label={fullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
            aria-pressed={fullscreen}
          >
            <FullscreenIcon active={fullscreen} />
          </button>
        ) : null}

        {/* For the game that misbehaves inside a frame — and Playva's escape
            hatch for the same reason. */}
        <a
          href={gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={BAR_BUTTON}
          aria-label="باز کردن بازی در زبانهٔ جدید"
        >
          <NewTabIcon />
        </a>
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        {loaded ? null : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink">
            <span
              aria-hidden="true"
              className="grid size-16 animate-pulse place-items-center rounded-full text-3xl leading-none"
              style={{ backgroundImage: `linear-gradient(135deg, ${game.color1}, ${game.color2})` }}
            >
              {game.emoji}
            </span>
            <p className="text-sm text-muted" role="status">
              در حال بارگذاری بازی
            </p>
          </div>
        )}

        {/* `key` so that moving from one game to another builds a new frame
            instead of navigating the old one, which would leave the previous
            game's page in the frame's own history. */}
        <iframe
          key={game._id}
          src={gameUrl}
          title={game.titleFa}
          onLoad={() => setLoaded(true)}
          allow="fullscreen; autoplay; gamepad"
          allowFullScreen
          className={`absolute inset-0 size-full border-0 transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  );
}

export default GamePlay;
