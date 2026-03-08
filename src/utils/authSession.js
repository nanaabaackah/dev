export const AUTH_SESSION_STORAGE_MARKER = "cookie-session";

export const normalizeLegacySessionToken = () => {
  if (typeof window === "undefined") return;

  const currentToken = localStorage.getItem("token");
  if (!currentToken) return;
  if (currentToken === AUTH_SESSION_STORAGE_MARKER) return;

  localStorage.setItem("token", AUTH_SESSION_STORAGE_MARKER);
};
