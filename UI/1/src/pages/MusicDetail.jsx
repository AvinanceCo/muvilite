/**
 * MusicDetail — album page and audio player.
 *
 * Purpose: show an album and play its tracks, reporting listening time.
 * Inputs:  route param `id` (music id)
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          hooks/useMediaSession, services/{media,format}
 *
 * Legacy counterpart: `sound.php`, which handed the whole track list to
 * jwplayer as a playlist. Preserved from it:
 *   - the album is one playlist; next/prev wrap around at both ends;
 *   - a track with no artwork falls back to the album cover (done server-side);
 *   - a listen session beats on an interval while audio plays and stops on
 *     pause, error and completion;
 *   - the publish year is shown in the Jalali calendar for Iranian releases —
 *     the server returns `publishYearJalali` precomputed, and it is null for
 *     everything else.
 *
 * DEFECT NOT REPRODUCED: the legacy listen-history row was INSERTed as a side
 * effect of FETCHING the album, so every crawler hit inflated the statistics.
 * The session is opened here on first play instead — loading this page records
 * nothing.
 *
 * NO PRE-ROLL HERE, unlike the film player (pages/Player.jsx). The album
 * player's legacy ad tag — `sound.php:32-33`, and again at 112 and 131 for
 * flowplayer — was `/vast.xml` at the web root, which is absent from the legacy
 * repository, so that break demonstrably never played. The film player's tags
 * DO exist (`assets/ads/vast1-5.xml`), which is why it has one and this does
 * not: adding a break here would be inventing a placement, not restoring it.
 * `GET /api/ads/preroll` is generic, so wiring one in later is a change to this
 * file alone.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMusic } from '../api/catalog.js';
import { useListenSession } from '../hooks/useMediaSession.js';
import { mediaUrl, PLACEHOLDER_SLOTS } from '../services/media.js';
import MediaImage from '../components/media/MediaImage.jsx';
import { formatTimecode, formatYear, toParagraphs } from '../services/format.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { Alert, EmptyState, Loader } from '../components/ui/Feedback.jsx';
import SectionHeader from '../components/catalog/SectionHeader.jsx';

function PlayIcon({ playing }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      {playing ? (
        <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
      ) : (
        <path d="M8 5.5v13a.5.5 0 0 0 .77.42l10-6.5a.5.5 0 0 0 0-.84l-10-6.5A.5.5 0 0 0 8 5.5Z" />
      )}
    </svg>
  );
}

export function MusicDetail() {
  const { id } = useParams();
  const audioRef = useRef(null);

  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Set when the passenger has asked for playback, so changing tracks continues
  // playing instead of stopping at each track boundary.
  const shouldPlayRef = useRef(false);

  const { data: music, isPending, isError, error, refetch } = useQuery({
    queryKey: ['music', id],
    queryFn: () => fetchMusic(id),
  });

  const { start, stop } = useListenSession(id);

  const tracks = music?.tracks ?? [];
  const currentTrack = tracks[trackIndex] ?? null;

  useDocumentTitle(music ? `آلبوم ${music.titleFa || music.titleEn}` : null, music?.descriptionFa);

  // A new track source needs an explicit load(); the element does not reload on
  // a src change alone in every browser.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.load();
    if (shouldPlayRef.current) {
      audio.play().catch(() => {
        // Autoplay refused, or the passenger navigated away mid-load. The
        // controls stay available; nothing to recover.
        shouldPlayRef.current = false;
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  const step = useCallback(
    (delta) => {
      if (tracks.length === 0) return;
      // Wraps at both ends, as the legacy next/prev buttons did.
      setTrackIndex((index) => (index + delta + tracks.length) % tracks.length);
    },
    [tracks.length],
  );

  const selectTrack = (index) => {
    shouldPlayRef.current = true;
    setTrackIndex(index);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      shouldPlayRef.current = true;
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  if (isPending) return <Loader label="در حال بارگذاری آلبوم" />;

  if (isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        {error?.isNotFound ? (
          <EmptyState
            title="این آلبوم پیدا نشد"
            hint="ممکن است حذف شده باشد یا نشانی درست نباشد."
            actionLabel="بازگشت به صفحه اصلی"
            actionTo="/"
          />
        ) : (
          <Alert title="آلبوم بارگذاری نشد" onRetry={refetch}>
            {error?.message}
          </Alert>
        )}
      </div>
    );
  }

  const year = music.publishYearJalali ?? music.publishYear;
  const description = toParagraphs(music.descriptionFa || music.descriptionEn);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <MediaImage
          path={music.coverPath}
          slot={PLACEHOLDER_SLOTS.MUSIC_COVER}
          className="mx-auto w-48 rounded-panel border border-line object-cover sm:mx-0 sm:w-56"
        />

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-azure">Album</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            {music.albumFa || music.albumEn || music.fullnameFa}
          </h1>
          <p className="mt-1.5 text-muted">{music.fullnameFa || music.fullnameEn}</p>

          <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {year ? (
              <div className="flex gap-1.5">
                <dt>سال انتشار:</dt>
                <dd className="text-paper">{formatYear(year)}</dd>
              </div>
            ) : null}
            {music.company ? (
              <div className="flex gap-1.5">
                <dt>ناشر:</dt>
                <dd className="text-paper">{music.company}</dd>
              </div>
            ) : null}
          </dl>

          {currentTrack ? (
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={toggle}
                className="flex size-12 items-center justify-center rounded-full bg-azure text-ink shadow-lg shadow-azure/25 transition-[filter] hover:brightness-110"
                aria-label={isPlaying ? 'توقف پخش' : 'پخش'}
              >
                <PlayIcon playing={isPlaying} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm text-paper">{currentTrack.title || 'بدون عنوان'}</p>
                <p className="font-mono text-xs text-muted">
                  {formatTimecode(currentTrack.duration)}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {currentTrack ? (
        <div className="mt-8 rounded-panel border border-line bg-panel p-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- audio only. */}
          <audio
            ref={audioRef}
            src={mediaUrl(currentTrack.file) ?? undefined}
            controls
            preload="metadata"
            className="w-full"
            // Heartbeat lifecycle, one handler per legacy jwplayer event.
            onPlay={() => {
              setIsPlaying(true);
              start();
            }}
            onPause={() => {
              setIsPlaying(false);
              stop();
            }}
            onError={() => {
              setIsPlaying(false);
              stop();
            }}
            onEnded={() => {
              setIsPlaying(false);
              stop();
              // Advance through the album, as the playlist did.
              if (trackIndex < tracks.length - 1) {
                shouldPlayRef.current = true;
                setTrackIndex(trackIndex + 1);
              } else {
                shouldPlayRef.current = false;
              }
            }}
          >
            مرورگر شما پخش صدا را پشتیبانی نمی‌کند.
          </audio>

          {tracks.length > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-azure-dim hover:text-azure"
              >
                قبلی
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-azure-dim hover:text-azure"
              >
                بعدی
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tracks.length > 0 ? (
        <section className="mt-10">
          <SectionHeader title="قطعه‌ها" count={tracks.length} countUnit="قطعه" />
          <ol className="divide-y divide-line rounded-panel border border-line">
            {tracks.map((track, index) => (
              <li key={track.id ?? index}>
                <button
                  type="button"
                  onClick={() => selectTrack(index)}
                  aria-current={index === trackIndex ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-panel ${
                    index === trackIndex ? 'bg-panel text-azure' : 'text-paper'
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono text-xs text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {track.title || 'بدون عنوان'}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {formatTimecode(track.duration)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="هنوز قطعه‌ای برای این آلبوم ثبت نشده"
            hint="آلبوم‌های دیگر را ببینید."
            actionLabel="جستجوی موسیقی"
            actionTo="/musics"
          />
        </div>
      )}

      {description.length > 0 ? (
        <section className="mt-10">
          <SectionHeader title="درباره این آلبوم" />
          <div className="space-y-3 leading-8 text-muted">
            {description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default MusicDetail;
