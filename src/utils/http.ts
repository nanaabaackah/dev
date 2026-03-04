const HTML_DOCUMENT_PATTERN = /^\s*<(?:!doctype\s+html|html)\b/i;

type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
};

export const readJsonResponse = async <T = unknown>(
  response: Response
): Promise<T | ApiErrorPayload | null> => {
  const bodyText = await response.text();
  if (!bodyText) return null;

  const trimmed = bodyText.trim();
  if (!trimmed) return null;

  const contentType = String(response.headers?.get("content-type") || "").toLowerCase();
  const looksLikeHtml =
    HTML_DOCUMENT_PATTERN.test(trimmed) || (contentType.includes("text/html") && trimmed.startsWith("<"));

  if (looksLikeHtml) {
    const target = response.url || "API endpoint";
    throw new Error(
      `API returned HTML instead of JSON for ${target}. Check VITE_API_BASE and /api proxy routing.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (!response.ok) {
      return { error: trimmed };
    }
    const target = response.url || "API endpoint";
    throw new Error(`API returned invalid JSON for ${target}.`);
  }
};

export const getApiErrorMessage = (payload: unknown, fallbackMessage: string): string => {
  if (payload && typeof payload === "object") {
    const apiPayload = payload as ApiErrorPayload;
    const message = apiPayload.error || apiPayload.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallbackMessage;
};
