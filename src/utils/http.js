const HTML_DOCUMENT_PATTERN = /^\s*<(?:!doctype\s+html|html)\b/i;

export const readJsonResponse = async (response) => {
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
    return JSON.parse(trimmed);
  } catch {
    if (!response.ok) {
      return { error: trimmed };
    }
    const target = response.url || "API endpoint";
    throw new Error(`API returned invalid JSON for ${target}.`);
  }
};

export const getApiErrorMessage = (payload, fallbackMessage) => {
  if (payload && typeof payload === "object") {
    const message = payload.error || payload.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallbackMessage;
};
