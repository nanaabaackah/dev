import { asyncHandler } from "../utils/asyncHandler.js";

export const registerProductivityRoutes = (
  app,
  { authMiddleware, productivityAiHandler }
) => {
  app.post("/api/ai/productivity-coach", authMiddleware, asyncHandler(productivityAiHandler));
};
