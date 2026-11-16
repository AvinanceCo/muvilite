/**
 * Application logger.
 *
 * Purpose: a single place for non-HTTP logging. HTTP access logs go through
 *          Morgan (see app.js); application and error logging goes here so the
 *          two streams stay separable, as CLAUDE.md requires.
 * Inputs:  message strings and optional Error objects
 * Outputs: writes to stdout/stderr
 * Deps:    none
 */
const timestamp = () => new Date().toISOString();

const write = (stream, level, message, meta) => {
  const line = `${timestamp()} [${level}] ${message}`;
  stream.write(`${line}\n`);
  if (meta instanceof Error) {
    stream.write(`${meta.stack}\n`);
  } else if (meta !== undefined) {
    stream.write(`${JSON.stringify(meta)}\n`);
  }
};

export const logger = {
  info: (message, meta) => write(process.stdout, 'INFO', message, meta),
  warn: (message, meta) => write(process.stderr, 'WARN', message, meta),
  error: (message, meta) => write(process.stderr, 'ERROR', message, meta),
};

export default logger;
