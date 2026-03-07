import { asyncHandler } from "../utils/asyncHandler.js";

export const registerAuthRoutes = (
  app,
  { loginHandler, logoutHandler, forgotPasswordHandler, setupAccountVerifyHandler, setupAccountCompleteHandler }
) => {
  app.post("/api/auth/login", asyncHandler(loginHandler));
  app.post("/api/auth/logout", asyncHandler(logoutHandler));
  app.post("/api/auth/forgot-password", asyncHandler(forgotPasswordHandler));
  app.get("/api/auth/setup-account/verify", asyncHandler(setupAccountVerifyHandler));
  app.post("/api/auth/setup-account/complete", asyncHandler(setupAccountCompleteHandler));
};
