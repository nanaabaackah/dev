import assert from "node:assert/strict";
import test from "node:test";
import { createProductivityAiHandler } from "./ai.controller.js";

const createMockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

test("createProductivityAiHandler rejects invalid prompts before calling OpenAI", async () => {
  let fetchCalled = false;

  const handler = createProductivityAiHandler({
    openAiApiKey: "test-key",
    openAiResponsesUrl: "https://api.openai.test/responses",
    openAiModel: "gpt-test",
    openAiTimeoutMs: 5000,
    productivityAiSystemPrompt: "system prompt",
    validateAiPrompt() {
      return { value: "", error: "Prompt is required" };
    },
    sanitizeAiPrompt(value) {
      return value;
    },
    buildProductivityAiInput() {
      return "unused";
    },
    extractOpenAiResponseText() {
      return "unused";
    },
    async fetchImpl() {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    },
  });

  const res = createMockResponse();

  await handler({ body: { prompt: null } }, res);

  assert.equal(fetchCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "Prompt is required" });
});

test("createProductivityAiHandler returns AI output for valid requests", async () => {
  const calls = {
    sanitizedPrompt: null,
    builtInput: null,
    fetchUrl: null,
    fetchOptions: null,
  };

  const handler = createProductivityAiHandler({
    openAiApiKey: "test-key",
    openAiResponsesUrl: "https://api.openai.test/responses",
    openAiModel: "gpt-test",
    openAiTimeoutMs: 5000,
    productivityAiSystemPrompt: "system prompt",
    validateAiPrompt(prompt) {
      return { value: prompt, error: "" };
    },
    sanitizeAiPrompt(value) {
      calls.sanitizedPrompt = value.trim();
      return value.trim();
    },
    buildProductivityAiInput({ prompt, context }) {
      calls.builtInput = { prompt, context };
      return `Prompt: ${prompt}; Context: ${context}`;
    },
    extractOpenAiResponseText(payload) {
      return payload.output_text;
    },
    async fetchImpl(url, options) {
      calls.fetchUrl = url;
      calls.fetchOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            model: "gpt-test",
            output_text: "Focus on the most important task first.",
          };
        },
      };
    },
  });

  const req = {
    body: {
      prompt: "  Ship the invoice flow  ",
      context: "Two urgent client deadlines",
    },
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(calls.sanitizedPrompt, "Ship the invoice flow");
  assert.deepEqual(calls.builtInput, {
    prompt: "Ship the invoice flow",
    context: "Two urgent client deadlines",
  });
  assert.equal(calls.fetchUrl, "https://api.openai.test/responses");
  assert.equal(calls.fetchOptions.method, "POST");

  const requestBody = JSON.parse(calls.fetchOptions.body);
  assert.equal(requestBody.model, "gpt-test");
  assert.equal(requestBody.input[0].content, "system prompt");
  assert.equal(
    requestBody.input[1].content,
    "Prompt: Ship the invoice flow; Context: Two urgent client deadlines"
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, "Focus on the most important task first.");
  assert.equal(res.body.model, "gpt-test");
  assert.match(res.body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});
