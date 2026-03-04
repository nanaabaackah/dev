import { asyncHandler } from "../utils/asyncHandler.js";

export const registerAuthRoutes = (
  app,
  { loginHandler, logoutHandler, forgotPasswordHandler }
) => {
  app.post("/api/auth/login", asyncHandler(loginHandler));
  app.post("/api/auth/logout", asyncHandler(logoutHandler));
  app.post("/api/auth/forgot-password", asyncHandler(forgotPasswordHandler));
};
