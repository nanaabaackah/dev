import { asyncHandler } from "../utils/asyncHandler.js";

export const registerDashboardRoutes = (
  app,
  { authMiddleware, getDashboardVerseHandler, getDashboardWeatherHandler }
) => {
  app.get("/api/dashboard/verse-of-day", authMiddleware, asyncHandler(getDashboardVerseHandler));
  app.get("/api/dashboard/weather", authMiddleware, asyncHandler(getDashboardWeatherHandler));
};
