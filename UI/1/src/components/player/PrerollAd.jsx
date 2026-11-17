/**
 * Pre-roll advertisement.
 *
 * Purpose: play one advertisement before the feature, report the outcome, and
 *          get out of the way.
 * Inputs:  an ad descriptor from `GET /api/ads/preroll`, and `onFinish`
 * Outputs: JSX; calls `onFinish()` exactly once
 * Deps:    api/tracking, services/media, services/format
 *
 * Replaces jwplayer's VAST client in `player.php:39-42`. What that did, and what
 * this reproduces:
 *
 *   - the ad plays before the content, with no seek bar and no pause;
 *   - a skip control appears after `skipoffset` — 3 seconds in every legacy VAST
 *     file, per-creative here;
 *   - `adSkipped` and `adComplete` each report the outcome to the telemetry
 *     endpoint, and the film follows either way.
 *
 * TWO LEGACY DEFECTS ARE NOT REPRODUCED:
 *
 *   1. `adComplete` sent `eventObjet.description` — the ad's DESCRIPTION field —
 *      as the seconds watched (player.php:138). The real playhead position is
 *      reported in both cases here.
 *   2. `vast1.xml` referenced a `MediaFile` that was never uploaded, so a
 *      quarter of all playbacks began with an ad that could not load. A creative
 *      with no file is not served at all now, and if playback fails anyway the
 *      film starts immediately rather than stalling behind a dead ad.
 *
 * Telemetry is fire-and-forget: a dropped report is not worth interrupting a
 * passenger's film over, and the aircraft link drops by nature.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { recordAdEvent } from '../../api/tracking.js';
import { mediaUrl } from '../../services/media.js';
import { formatTimecode } from '../../services/format.js';

/**
 * @param {object} props
 * @param {{id: string, titleFa: string, videoPath: string, durationSecond: number,
 *          skipOffsetSecond: number, clickUrl: string|null}} props.ad
 * @param {() => void} props.onFinish called once, however the ad ends
 */
export function PrerollAd({ ad, onFinish }) {
  const videoRef = useRef(null);

  // `onFinish` must fire exactly once. A skip immediately followed by the
  // element's own `ended`, or an error after a skip, would otherwise double-fire
  // and start the film twice.
  const finishedRef = useRef(false);

  const [position, setPosition] = useState(0);
  // Autoplay without a gesture is refused by every mobile browser and by
  // desktop Chrome unless the media is muted. Muting an advertisement defeats
  // it, so a refusal surfaces as a tap target rather than being worked around.
  const [needsGesture, setNeedsGesture] = useState(false);

  const skipAfter = ad.skipOffsetSecond ?? 0;
  const canSkip = position >= skipAfter;
  const remaining = Math.max(0, Math.ceil(skipAfter - position));

  /**
   * @param {'completed'|'skipped'|null} eventType null reports nothing — used
   *        when the creative failed to play, since no impression occurred.
   */
  const finish = useCallback(
    (eventType) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      if (eventType) {
        recordAdEvent({
          adId: ad.id,
          title: ad.titleFa,
          watchedSecond: Math.floor(videoRef.current?.currentTime ?? 0),
          eventType,
        }).catch(() => {
          // Reporting is best-effort; the film starts regardless.
        });
      }

      onFinish();
    },
    [ad.id, ad.titleFa, onFinish],
  );

  // Try to start as soon as the element is ready. Kept in an effect rather than
  // on `autoPlay` so the rejected promise can be caught and turned into the tap
  // target above.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => setNeedsGesture(true));
  }, [ad.id]);

  const handleGesture = () => {
    setNeedsGesture(false);
    videoRef.current?.play().catch(() => finish(null));
  };

  const source = mediaUrl(ad.videoPath);

  const progress = ad.durationSecond > 0 ? Math.min(1, position / ad.durationSecond) : 0;

  return (
    // Absolute, not fixed: the player shell around this is what goes fullscreen,
    // so the ad must be laid out against that box rather than the page viewport.
    <div className="absolute inset-0 z-20 bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- an advertisement
          creative supplied by the operator; there is no caption track for it,
          and the legacy VAST player showed none either. */}
      <video
        ref={videoRef}
        src={source}
        playsInline
        preload="auto"
        className="absolute inset-0 size-full object-contain"
        onTimeUpdate={() => setPosition(videoRef.current?.currentTime ?? 0)}
        onEnded={() => finish('completed')}
        // A creative that will not play must not hold the film hostage. No
        // impression happened, so nothing is reported.
        onError={() => finish(null)}
      />

      {needsGesture ? (
        <button
          type="button"
          onClick={handleGesture}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/80 text-paper"
        >
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-paper">
            <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="text-sm">برای شروع پخش لمس کنید</span>
        </button>
      ) : null}

      {/* The ad's own chrome. Deliberately minimal: a label saying this is an
          advertisement, the countdown or skip control, and the click-through if
          the creative has one. No seek bar and no pause, as in the legacy VAST
          playback. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <span className="rounded bg-ink/70 px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-azure backdrop-blur">
          تبلیغ
        </span>

        {ad.durationSecond > 0 ? (
          <span className="rounded bg-ink/70 px-2 py-1 font-mono text-xs text-muted backdrop-blur">
            {formatTimecode(Math.max(0, ad.durationSecond - position))}
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/85 to-transparent p-4 pt-14">
        <div className="flex items-center justify-between gap-3">
          {ad.clickUrl ? (
            <a
              href={ad.clickUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-line bg-ink/70 px-4 py-2 text-sm text-paper backdrop-blur transition-colors hover:border-azure-dim hover:text-azure"
            >
              مشاهده
            </a>
          ) : (
            <span />
          )}

          {canSkip ? (
            <button
              type="button"
              onClick={() => finish('skipped')}
              className="rounded-full border border-line bg-ink/70 px-5 py-2 text-sm font-bold text-paper backdrop-blur transition-colors hover:border-azure-dim hover:text-azure"
            >
              رد کردن تبلیغ
            </button>
          ) : (
            <span className="rounded-full bg-ink/70 px-5 py-2 text-sm text-muted backdrop-blur">
              رد کردن تا {remaining} ثانیه دیگر
            </span>
          )}
        </div>

        {/* How much of the break is left, at a glance. Not a seek bar — the
            legacy VAST playback allowed no seeking and neither does this. */}
        {ad.durationSecond > 0 ? (
          <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-paper/15">
            <div
              className="h-full bg-azure transition-[width] duration-300 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PrerollAd;
