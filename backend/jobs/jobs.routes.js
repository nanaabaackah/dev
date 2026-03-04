import { asyncHandler } from "../utils/asyncHandler.js";

export const registerJobRoutes = (app, { authMiddleware, getJobRecommendationsHandler }) => {
  app.get(
    "/api/jobs/recommendations",
    authMiddleware,
    asyncHandler(getJobRecommendationsHandler)
  );
};
