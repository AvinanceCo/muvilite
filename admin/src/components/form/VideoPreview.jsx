/**
 * VideoPreview — an operator's preview of a catalog video, HLS or not.
 *
 * Purpose: play back what a title will show passengers: an HLS master playlist
 *          (an upload, after the server transcoded it), a progressive file
 *          (an older upload, an external link) or a local blob being chosen.
 * Inputs:  `src`, plus an `onError` for when nothing can be played
 * Outputs: a <video> with native controls
 * Deps:    hls.js (loaded only when an .m3u8 needs it)
 *
 * NEW, with the HLS transcoder. Safari plays HLS by itself; Chrome and Firefox
 * do not, and hls.js feeds them through Media Source Extensions — the same
 * engine, and the same pinned version, as the Muvi player the passenger site
 * uses. It is imported on demand, so the rest of the panel never downloads it.
 */
import { useEffect, useRef } from 'react';

const isHls = (url) => /\.m3u8(?:[?#]|$)/i.test(url ?? '');

/**
 * @param {object} props
 * @param {string} props.src
 * @param {() => void} [props.onError]
 * @param {string} [props.className]
 */
export function VideoPreview({ src, onError, className = '' }) {
  const videoRef = useRef(null);
  // Read through a ref, so a new callback identity does not reload the video.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;

    if (!isHls(src) || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    let hls = null;
    let cancelled = false;

    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          onErrorRef.current?.();
          return;
        }
        hls = new Hls({ enableWorker: true });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) onErrorRef.current?.();
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    // No caption track: an operator preview of catalog media, and subtitles
    // are not part of this migration (backend MIGRATION §7.4).
    <video
      ref={videoRef}
      controls
      preload="metadata"
      onError={() => onErrorRef.current?.()}
      className={className}
    />
  );
}

export default VideoPreview;
