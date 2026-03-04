export const createProductivityAiHandler =
  ({
    openAiApiKey,
    openAiResponsesUrl,
    openAiModel,
    openAiTimeoutMs,
    productivityAiSystemPrompt,
    validateAiPrompt,
    sanitizeAiPrompt,
    buildProductivityAiInput,
    extractOpenAiResponseText,
    fetchImpl = fetch,
  }) =>
  async (req, res) => {
    if (!openAiApiKey) {
      return res.status(503).json({
        error: "AI assistant is not configured. Add OPENAI_API_KEY on the server.",
      });
    }

    const promptValidation = validateAiPrompt(req.body?.prompt);
    if (!promptValidation.value) {
      return res.status(400).json({ error: promptValidation.error });
    }
    const prompt = sanitizeAiPrompt(promptValidation.value);

    const controller = new AbortController();
    const timeoutMs = Number.isFinite(openAiTimeoutMs) ? Math.max(openAiTimeoutMs, 5000) : 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const openAiResponse = await fetchImpl(openAiResponsesUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openAiModel,
          max_output_tokens: 700,
          temperature: 0.4,
          input: [
            {
              role: "system",
              content: productivityAiSystemPrompt,
            },
            {
              role: "user",
              content: buildProductivityAiInput({
                prompt,
                context: req.body?.context,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });

      const payload = await openAiResponse.json().catch(() => null);
      if (!openAiResponse.ok) {
        const message =
          payload?.error?.message ||
          payload?.error ||
          `OpenAI request failed with status ${openAiResponse.status}`;
        return res.status(502).json({ error: message });
      }

      const reply = extractOpenAiResponseText(payload);
      if (!reply) {
        return res.status(502).json({ error: "AI response did not include text output." });
      }

      return res.json({
        reply,
        model: payload?.model || openAiModel,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return res.status(504).json({ error: "AI request timed out." });
      }
      console.error("Productivity AI request failed", error);
      return res.status(500).json({ error: "Unable to generate AI guidance right now." });
    } finally {
      clearTimeout(timeoutId);
    }
  };
