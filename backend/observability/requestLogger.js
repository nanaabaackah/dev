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
      const requestPath =
        typeof req?.originalUrl === "string" && req.originalUrl
          ? req.originalUrl.split("?")[0]
          : req?.path || req?.url || "";

      log(`[api] ${req.method} ${requestPath} ${res.statusCode} ${durationMs}ms${sizeSuffix}`);
    });

    next();
  };
};
