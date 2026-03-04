export const createGetDashboardWeatherHandler =
  ({
    googleWeatherApiKey,
    parseCoordinate,
    buildWeatherCacheKey,
    withCache,
    cacheTtlMs,
    fetchGoogleCurrentWeather,
  }) =>
  async (req, res) => {
    if (!googleWeatherApiKey) {
      return res.status(503).json({
        error: "Google Weather API is not configured. Add GOOGLE_WEATHER_API_KEY on the server.",
      });
    }

    const latitude = parseCoordinate(req.query?.lat, -90, 90);
    const longitude = parseCoordinate(req.query?.lng, -180, 180);
    if (latitude === null || longitude === null) {
      return res.status(400).json({
        error: "lat and lng query params are required and must be valid coordinates.",
      });
    }

    try {
      const cacheKey = `dashboard-weather:${buildWeatherCacheKey({ latitude, longitude })}`;
      const getWeather = withCache(cacheKey, cacheTtlMs, async () => {
        const weatherPayload = await fetchGoogleCurrentWeather({ latitude, longitude });
        return {
          ...weatherPayload,
          meta: {
            source: "google-weather",
            fetchedAt: new Date().toISOString(),
            coordinates: { latitude, longitude },
          },
        };
      });
      const payload = await getWeather();
      return res.json(payload);
    } catch (error) {
      console.warn("Unable to load weather conditions", error);
      return res.status(502).json({
        error: "Unable to fetch weather right now.",
        details: error?.message || "Unknown weather provider error",
      });
    }
  };
