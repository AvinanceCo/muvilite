/**
 * HLS transcoder — one source video in, an adaptive HLS set out.
 *
 * Purpose: turn an uploaded film or clip (any container ffmpeg reads) into an
 *          H.264/AAC HLS ladder with a master playlist, reporting progress and
 *          stopping on request.
 * Inputs:  the source path, its probe result, an output directory
 * Outputs: `<outDir>/master.m3u8` plus one sub-directory per rung
 *          (`360p/index.m3u8`, `360p/seg_00001.ts`, …)
 * Deps:    node:child_process, config/env, config/constants
 *
 * NEW (beyond parity). The legacy player streamed one progressive MP4. The
 * maintainer asked for HLS so the Muvi player can switch quality when the cabin
 * Wi-Fi is crowded.
 *
 * ONE ffmpeg RUN FOR THE WHOLE LADDER. The source is decoded once and `split`
 * into one scaler per rung, so a four-rung film costs one decode, not four. Every
 * rung is cut at the same forced keyframes (`HLS_SEGMENT_SECONDS`), which is what
 * lets the player switch rungs at a segment boundary without a glitch.
 *
 * Choices worth knowing:
 *   - H.264 Main + yuv420p + AAC stereo: the one combination every browser,
 *     phone and TV decodes. A 10-bit or 4:4:4 source is converted, and 5.1
 *     audio is folded down.
 *   - MPEG-TS segments: the most widely compatible kind, and what hls.js and
 *     Safari's native HLS both handle without a codec probe.
 *   - Rotation: ffmpeg applies a phone's rotation flag before the filters, so
 *     the output is upright and the probe's display dimensions are the ones the
 *     ladder is sized from.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { probeFrameRate } from './videoProbe.service.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';
import {
  HLS_LADDER,
  HLS_AUDIO_KBPS,
  HLS_SEGMENT_SECONDS,
  HLS_MASTER_PLAYLIST,
} from '../config/constants.js';

/** Lines of ffmpeg's stderr kept for the failure message. */
const STDERR_TAIL_LINES = 12;

const isWindows = process.platform === 'win32';

/**
 * Kills ffmpeg AND anything it started.
 *
 * `child.kill()` is not enough, because the `ffmpeg` on PATH is not always
 * ffmpeg: Chocolatey installs a launcher shim that starts the real binary as
 * its own child, and snap and some distro packages wrap it in a script. Killing
 * only the process we spawned leaves the real encoder running — holding the CPU,
 * and holding our pipes open, so `close` never fires and a cancel waits forever
 * (found in testing, on a Chocolatey install).
 *
 * So the whole tree goes: `taskkill /T` on Windows, and on POSIX the process
 * GROUP, which is why the child is spawned `detached` there (its own group).
 */
function killTree(child) {
  if (!child.pid) return;
  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

/**
 * The rungs this source gets.
 *
 * @param {{width: number, height: number}} probe display dimensions
 * @returns {Array<{name: string, size: number|null, videoKbps: number, maxKbps: number, bufKbps: number}>}
 *          `size: null` means "the source's own size" (a source below the lowest rung)
 */
export function selectLadder({ width, height }) {
  const shortSide = Math.min(width, height);
  const rungs = HLS_LADDER.filter((rung) => rung.size <= shortSide);
  if (rungs.length > 0) return rungs;

  // Smaller than 360p: one rendition at its own size, never upscaled.
  const lowest = HLS_LADDER[0];
  return [{ ...lowest, name: `${shortSide}p`, size: null }];
}

/**
 * The scale filter for one rung. The short side is set to the rung size and the
 * long side follows the aspect ratio, rounded to an even number (`-2`) because
 * 4:2:0 chroma needs even dimensions.
 */
function scaleFilter(rung, { width, height }) {
  if (rung.size === null) return 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  return width >= height ? `scale=-2:${rung.size}` : `scale=${rung.size}:-2`;
}

/**
 * The complete ffmpeg argument list. Pure, so it can be inspected and tested
 * without running anything.
 *
 * @param {object} options
 * @param {string} options.sourcePath
 * @param {string} options.outDir        must exist; ffmpeg creates the rung folders
 * @param {{width: number, height: number, hasAudio: boolean}} options.probe
 * @param {string} [options.preset]
 * @returns {{args: string[], ladder: object[]}}
 */
export function buildHlsArgs({ sourcePath, outDir, probe, preset = env.transcodePreset }) {
  const ladder = selectLadder(probe);
  const count = ladder.length;

  // [0:v:0] split=N [s0][s1]… ; [s0] scale=… [v0] ; …
  const splitLabels = ladder.map((_, index) => `[s${index}]`).join('');
  const scalers = ladder
    .map((rung, index) => `[s${index}]${scaleFilter(rung, probe)}[v${index}]`)
    .join(';');
  const filter = `[0:v:0]split=${count}${splitLabels};${scalers}`;

  const args = [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i', sourcePath,
    '-filter_complex', filter,
  ];

  ladder.forEach((_, index) => {
    args.push('-map', `[v${index}]`);
    if (probe.hasAudio) args.push('-map', '0:a:0');
  });

  args.push(
    '-c:v', 'libx264',
    '-preset', preset,
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    // Identical keyframes on every rung, exactly on the segment grid.
    '-force_key_frames', `expr:gte(t,n_forced*${HLS_SEGMENT_SECONDS})`,
    '-sc_threshold', '0',
  );

  ladder.forEach((rung, index) => {
    args.push(
      `-b:v:${index}`, `${rung.videoKbps}k`,
      `-maxrate:v:${index}`, `${rung.maxKbps}k`,
      `-bufsize:v:${index}`, `${rung.bufKbps}k`,
    );
  });

  if (probe.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', `${HLS_AUDIO_KBPS}k`, '-ac', '2', '-ar', '48000');
  }

  const streamMap = ladder
    .map((rung, index) =>
      probe.hasAudio ? `v:${index},a:${index},name:${rung.name}` : `v:${index},name:${rung.name}`,
    )
    .join(' ');

  // Forward slashes: ffmpeg's HLS muxer writes these into the playlists and
  // treats them as paths on every platform, including Windows.
  const out = outDir.split('\\').join('/');

  args.push(
    '-f', 'hls',
    '-hls_time', String(HLS_SEGMENT_SECONDS),
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', `${out}/%v/seg_%05d.ts`,
    '-master_pl_name', HLS_MASTER_PLAYLIST,
    '-var_stream_map', streamMap,
    // Machine-readable progress on stdout; the human banner stays on stderr.
    '-progress', 'pipe:1',
    '-nostats',
    `${out}/%v/index.m3u8`,
  );

  return { args, ladder };
}

/**
 * Runs the transcode.
 *
 * @param {object} options
 * @param {string} options.sourcePath
 * @param {string} options.outDir
 * @param {{durationSecond: number|null, width: number, height: number, hasAudio: boolean}} options.probe
 * @param {(percent: number) => void} [options.onProgress] 0–99 while running
 * @param {AbortSignal} [options.signal] aborting kills ffmpeg
 * @returns {Promise<{ladder: object[]}>}
 * @throws {Error} with the tail of ffmpeg's stderr, or `name === 'AbortError'`
 */
export function transcodeToHls({ sourcePath, outDir, probe, onProgress, signal }) {
  const { args, ladder } = buildHlsArgs({ sourcePath, outDir, probe });

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(Object.assign(new Error('Transcode cancelled'), { name: 'AbortError' }));
    }

    const child = spawn(env.ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Its own process group on POSIX, so killTree() can take the whole tree.
      detached: !isWindows,
    });

    const stderrTail = [];
    let stdoutBuffer = '';
    let lastPercent = -1;
    let aborted = false;

    const onAbort = () => {
      aborted = true;
      killTree(child);
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        // `out_time_us` is microseconds. (`out_time_ms` is ALSO microseconds,
        // despite its name — a long-standing ffmpeg quirk — so it is not used.)
        const match = /^out_time_us=(\d+)/.exec(line.trim());
        if (!match || !probe.durationSecond) continue;
        const percent = Math.min(99, Math.floor((Number(match[1]) / 1e6 / probe.durationSecond) * 100));
        if (percent > lastPercent) {
          lastPercent = percent;
          onProgress?.(percent);
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line.trim()) continue;
        stderrTail.push(line.trim());
        if (stderrTail.length > STDERR_TAIL_LINES) stderrTail.shift();
      }
    });

    child.once('error', (error) => {
      signal?.removeEventListener('abort', onAbort);
      reject(
        error.code === 'ENOENT'
          ? new Error('ffmpeg is not installed on the server')
          : error,
      );
    });

    child.once('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (aborted) {
        return reject(Object.assign(new Error('Transcode cancelled'), { name: 'AbortError' }));
      }
      if (code === 0) return addFrameRateSafely(outDir).then(() => resolve({ ladder }));
      return reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.join(' | ')}`));
    });
  });
}

/**
 * Writes `FRAME-RATE` into every variant of a finished set's master playlist.
 *
 * WHY. ffmpeg's HLS muxer leaves the attribute out. hls.js then reports each
 * level's frame rate as 0, and the Muvi player passes that 0 to the browser's
 * `mediaCapabilities.decodingInfo()` when it checks whether each quality can be
 * decoded — which rejects a zero frame rate as invalid, so EVERY quality in the
 * player's menu showed as «در دسترس نیست» and only «خودکار» could be picked.
 * The fix belongs here, in what we publish, not in the player.
 *
 * Measured from the OUTPUT (the first segment of the first variant), not the
 * source, so it is right by construction and needs no database — which is also
 * what lets scripts/hls-frame-rate-backfill.js repair sets made before this
 * existed. Idempotent: a variant that already has the attribute is left alone.
 *
 * @param {string} outDir directory holding the master playlist
 * @returns {Promise<{changed: boolean, frameRate: number|null}>}
 */
export async function addFrameRateToMaster(outDir) {
  const masterPath = path.join(outDir, HLS_MASTER_PLAYLIST);
  const master = await readFile(masterPath, 'utf8');
  const lines = master.split('\n');

  const variants = lines.filter((line) => line.startsWith('#EXT-X-STREAM-INF:'));
  if (variants.length === 0 || variants.every((line) => /FRAME-RATE=/.test(line))) {
    return { changed: false, frameRate: null };
  }

  // The first variant's playlist, then its first segment.
  const firstVariant = lines.find((line, index) => index > 0 && line.trim() && !line.startsWith('#'));
  const variantPath = path.join(outDir, firstVariant.trim());
  const variant = await readFile(variantPath, 'utf8');
  const firstSegment = variant.split('\n').find((line) => line.trim() && !line.startsWith('#'));
  if (!firstSegment) return { changed: false, frameRate: null };

  const frameRate = await probeFrameRate(path.join(path.dirname(variantPath), firstSegment.trim()));
  if (!frameRate) return { changed: false, frameRate: null };

  // The attribute is a decimal with at most three places (RFC 8216 §4.3.4.2).
  const value = Number(frameRate.toFixed(3));
  const patched = lines
    .map((line) =>
      line.startsWith('#EXT-X-STREAM-INF:') && !/FRAME-RATE=/.test(line)
        ? `${line.trimEnd()},FRAME-RATE=${value}`
        : line,
    )
    .join('\n');

  await writeFile(masterPath, patched, 'utf8');
  return { changed: true, frameRate: value };
}

/**
 * `addFrameRateToMaster` for a set that has just been published. Never fails
 * the transcode: without the attribute the film still plays, and «خودکار»
 * still switches quality — only the manual choices are lost — so a failure
 * here is logged, not raised.
 */
async function addFrameRateSafely(outDir) {
  try {
    await addFrameRateToMaster(outDir);
  } catch (error) {
    logger.warn(`Could not add FRAME-RATE to ${outDir}: ${error.message}`);
  }
}

export default { selectLadder, buildHlsArgs, transcodeToHls, addFrameRateToMaster };
