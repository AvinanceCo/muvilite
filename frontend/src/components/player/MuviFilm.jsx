/**
 * MuviFilm — the film, played by the Muvi player.
 *
 * Purpose: play a title's video inside the full-viewport player shell and
 *          report playback to the watch heartbeat. The only film player in the
 *          app.
 * Inputs:  the video URL, poster, title, start position, back link, and the
 *          heartbeat callbacks of pages/Player.jsx
 * Outputs: JSX; `ref` exposes `play()` for the hand-over after the pre-roll
 * Deps:    @avinance/muvi-player-react (vendored under frontend/vendor/muvi)
 *
 * NEW (beyond parity, requested by the maintainer). Uploads are transcoded on
 * the server to an adaptive HLS ladder, which Muvi plays with automatic
 * quality switching when the cabin Wi-Fi is crowded. Muvi also plays a single
 * progressive file — an external MP4 link, or a file uploaded before the
 * transcoder existed — so one player covers every source (see `sourceType`).
 *
 * What is carried over from the app's earlier player of its own (removed), so
 * the passenger sees the same controls:
 *   - the legacy −15 / +30 seek pair (player2.php's `[data-seek]` buttons),
 *     placed beside the play control rather than Muvi's symmetric ±10, which
 *     is removed from the control set;
 *   - the arrow keys still move 5 seconds;
 *   - `?seek=` resumes at a position (the playlist item's `starttime`);
 *   - a back link to the movie page, fading with the controls.
 * Muvi draws the title, the scrubber, volume, quality/settings and fullscreen;
 * the quality choice hides itself for a single-file source.
 *
 * NO THIRD-PARTY HOSTS. The site depends on no external host (it was first
 * built for a network with no internet). The player bundle, its styles and hls.js all ship inside this app's
 * build, and the one thing Muvi can fetch from outside — Google's Cast sender —
 * loads only when `remote.castAppId` is configured, which it is not.
 */
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MuviPlayer } from '@avinance/muvi-player-react';
import { useBranding } from '../../context/BrandingContext.jsx';
import { SITE_THEMES } from '../../utils/themes.js';

/** Container id, and the id `window.muviplayer(id)` answers to. */
const PLAYER_ID = 'muvilite-film';

/**
 * Extensions Muvi recognises by itself (its engine/source.ts): HLS, or a file
 * it hands straight to the media element.
 */
const KNOWN_EXTENSIONS = new Set([
  'm3u8', 'm3u', 'mp4', 'm4v', 'mov', 'webm', 'ogv', 'ogg', 'm4a', 'aac', 'mp3', 'oga',
]);

/**
 * The playlist item's `type`, or undefined to let Muvi read the extension.
 *
 * Muvi takes an extension-less URL to be HLS. Here such a URL can only be an
 * external link an operator pasted — every upload has an extension — and the
 * native player this app used before treated every non-HLS link as a plain
 * file, so it is marked as one. The browser sniffs the real container, so an
 * extension-less WebM still plays.
 */
function sourceType(url) {
  const path = url.split(/[?#]/, 1)[0];
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return KNOWN_EXTENSIONS.has(extension) ? undefined : 'mp4';
}

/**
 * The legacy pair, as SVG markup (Muvi's `addButton` takes a string and
 * sanitizes it). A curling arrow, mirrored for forward, with the seconds drawn
 * inside so the two are told apart at a glance.
 */
function seekIconSvg(forward, seconds) {
  const mirror = forward ? ' transform="matrix(-1 0 0 1 24 0)"' : '';
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
    `<g${mirror}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" stroke-linecap="round"/>` +
    '<path d="M4 3.5v4h4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
    `<text x="12" y="15.2" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="Vazir, Tahoma, sans-serif">${seconds}</text>` +
    '</svg>'
  );
}

const SEEK_BUTTONS = [
  { id: 'seek-back-15', delta: -15, label: 'پانزده ثانیه به عقب', svg: seekIconSvg(false, 15) },
  { id: 'seek-forward-30', delta: 30, label: 'سی ثانیه به جلو', svg: seekIconSvg(true, 30) },
];

/**
 * Setup-level options, one frozen object per site theme. Built once at module
 * level: the React wrapper re-creates the whole player whenever these change by
 * value, which would restart the film — so only a change of theme itself can.
 */
const customPropsFor = (themeTokens) => Object.freeze({
  controls: true,
  locale: 'fa',
  // Keeps Muvi's saved preferences (volume, quality) apart from any other
  // product using the same player on the same device.
  tenantId: 'muvilite',
  engine: 'auto',
  stretching: 'uniform',
  theme: {
    schemaVersion: 1,
    locale: 'fa',
    direction: 'rtl',
    preset: 'general',
    // The site theme's accent and ground (utils/themes.js, mirroring index.css).
    tokens: themeTokens,
    // Muvi's ±10 (`rewind`/`forward`) is left out: the legacy −15/+30 pair
    // replaces it. Cast, AirPlay and the TV remote need the internet or a
    // paired device and have no place on a cabin network.
    controls: ['play', 'volume', 'time', 'spacer', 'audio', 'captions', 'settings', 'pip', 'fullscreen'],
    autoHideSeconds: 3,
    // Arrow keys, as the app's earlier player of its own had them.
    seekStepSeconds: 5,
  },
});

const CUSTOM_PROPS_BY_THEME = Object.freeze(
  Object.fromEntries(
    Object.entries(SITE_THEMES).map(([key, theme]) => [key, customPropsFor(theme.player)]),
  ),
);

/** Seeks by a delta, clamped to the film. */
function seekBy(player, delta) {
  const duration = player.getDuration();
  const target = Math.max(0, player.getPosition() + delta);
  player.seek(Number.isFinite(duration) && duration > 0 ? Math.min(target, duration - 0.5) : target);
}

/**
 * Adds the legacy pair and moves it beside the play control. Muvi's public
 * `addButton` always appends to the end of the bar; if the play control is not
 * where this expects, the buttons simply stay there, which still works.
 */
function installSeekButtons(player) {
  for (const button of SEEK_BUTTONS) {
    player.addButton(button.svg, button.label, () => seekBy(player, button.delta), button.id);
  }

  const container = player.getContainer?.();
  const play = container?.querySelector('[data-control="play"]');
  const buttons = SEEK_BUTTONS.map((button) => container?.querySelector(`[button="${button.id}"]`));
  if (play && buttons.every(Boolean)) play.after(...buttons);
}

/**
 * @param {object} props
 * @param {string} props.source       HLS master playlist, or a single video file
 * @param {string} [props.poster]
 * @param {string} [props.title]
 * @param {string} props.movieId      becomes Muvi's `mediaid`
 * @param {number} [props.startAt]    seconds, from `?seek=`
 * @param {string} props.backTo       the movie page
 * @param {() => void} props.onStart  heartbeat on
 * @param {() => void} props.onStop   heartbeat off
 * @param {(seconds: number) => void} props.onPosition
 * @param {() => void} props.onFatalError
 */
export const MuviFilm = forwardRef(function MuviFilm(
  { source, poster, title, movieId, startAt, backTo, onStart, onStop, onPosition, onFatalError },
  ref,
) {
  const playerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.play(),
  }));

  // Resolved by the context, so always a key of CUSTOM_PROPS_BY_THEME.
  const { theme } = useBranding();

  const playlist = useMemo(
    () => [
      {
        file: source,
        ...(sourceType(source) ? { type: sourceType(source) } : {}),
        ...(poster ? { image: poster } : {}),
        ...(title ? { title } : {}),
        mediaid: String(movieId),
        ...(Number.isFinite(startAt) && startAt > 0 ? { starttime: startAt } : {}),
      },
    ],
    [source, poster, title, movieId, startAt],
  );

  const handleTime = useCallback((event) => onPosition(event?.position ?? 0), [onPosition]);

  const handleError = useCallback(() => {
    onStop();
    onFatalError();
  }, [onStop, onFatalError]);

  return (
    <div className="film-shell absolute inset-0 bg-black">
      <MuviPlayer
        ref={playerRef}
        playerId={PLAYER_ID}
        aspectRatio="inherit"
        className="size-full"
        playlist={playlist}
        isAutoPlay={false}
        customProps={CUSTOM_PROPS_BY_THEME[theme]}
        onReady={(_event, player) => installSeekButtons(player)}
        // The heartbeat lifecycle, as on the native element: on with the
        // first play and every resume, off with pause, end and failure.
        onPlay={onStart}
        onResume={onStart}
        onPause={onStop}
        onComplete={onStop}
        onTime={handleTime}
        onError={handleError}
        onSetupError={handleError}
      />

      {/* The back link, at the corner opposite Muvi's title, fading with its
          controls (Muvi marks its container `muvi-flag-user-inactive`). */}
      <Link
        to={backTo}
        aria-label="بازگشت به صفحه فیلم"
        className="absolute top-3 left-3 z-10 flex size-10 items-center justify-center rounded-full bg-ink/60 text-paper backdrop-blur transition-opacity duration-300 hover:text-azure focus-visible:opacity-100 [.film-shell:has(.muvi-flag-user-inactive)_&]:pointer-events-none [.film-shell:has(.muvi-flag-user-inactive)_&]:opacity-0"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
});

export default MuviFilm;
