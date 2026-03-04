const formatDurationMs = (startTime) => {
  const elapsedNs = globalThis.process.hrtime.bigint() - startTime;
  return Number(elapsedNs) / 1_000_000;
};

export const createRequestLogger = ({ logger = console } = {}) => {
  const log = typeof logger?.info === "function" ? logger.info.bind(logger) : console.log;

  return (req, res, next) => {
    const startedAt = globalThis.process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = formatDurationMs(startedAt).toFixed(1);
      const contentLength = res.getHeader("content-length");
      const sizeSuffix =
        contentLength === undefined || contentLength === null ? "" : ` ${contentLength}b`;

      log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms${sizeSuffix}`);
    });

    next();
  };
};
