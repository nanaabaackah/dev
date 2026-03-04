export const createGetJobRecommendationsHandler =
  ({
    normalizeJobSearch,
    parseJobWorkTypes,
    buildJobRecommendationCacheKey,
    withCache,
    cacheTtlMs,
    fetchRecommendedJobs,
  }) =>
  async (req, res) => {
    const search = normalizeJobSearch(req.query?.search);
    const workTypes = parseJobWorkTypes(req.query?.workTypes);
    const parsedLimit = Number(req.query?.limit);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 24)
      : 12;

    try {
      const cacheKey = `jobs:${buildJobRecommendationCacheKey({ search, workTypes, limit })}`;
      const getJobs = withCache(cacheKey, cacheTtlMs, async () => {
        const result = await fetchRecommendedJobs({ search, workTypes, limit });
        const jobs = Array.isArray(result?.jobs) ? result.jobs : [];
        const sources = Array.isArray(result?.sources) ? result.sources : [];
        return {
          jobs,
          meta: {
            source: sources.join(",") || "job-boards",
            sources,
            search,
            workTypes,
            total: jobs.length,
            fetchedAt: new Date().toISOString(),
            ...(result?.warning ? { warning: result.warning } : {}),
          },
        };
      });
      const payload = await getJobs();
      return res.json(payload);
    } catch (error) {
      console.warn("Unable to fetch job recommendations", error);
      return res.json({
        jobs: [],
        meta: {
          source: "job-boards",
          sources: [],
          search,
          workTypes,
          total: 0,
          fetchedAt: new Date().toISOString(),
          warning: "Live recommendations are temporarily unavailable.",
        },
      });
    }
  };
