import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestBaseUrl } from "./requestBaseUrl.js";

test("resolveRequestBaseUrl prefers APP_BASE_URL when configured", () => {
  const baseUrl = resolveRequestBaseUrl({
    appBaseUrl: "http://localhost:4173/",
    isProduction: false,
    requestOrigin: "",
    forwardedProto: "",
    protocol: "http",
    host: "localhost:8080",
    devFallbackOrigins: ["http://localhost:5173"],
  });

  assert.equal(baseUrl, "http://localhost:4173");
});

test("resolveRequestBaseUrl uses request origin before proxy host", () => {
  const baseUrl = resolveRequestBaseUrl({
    appBaseUrl: "",
    isProduction: false,
    requestOrigin: "http://127.0.0.1:5173",
    forwardedProto: "",
    protocol: "http",
    host: "localhost:8080",
    devFallbackOrigins: ["http://localhost:5173"],
  });

  assert.equal(baseUrl, "http://127.0.0.1:5173");
});

test("resolveRequestBaseUrl falls back to the local frontend origin in development", () => {
  const baseUrl = resolveRequestBaseUrl({
    appBaseUrl: "",
    isProduction: false,
    requestOrigin: "",
    forwardedProto: "",
    protocol: "http",
    host: "localhost:8080",
    devFallbackOrigins: ["http://localhost:5173", "http://localhost:4173"],
  });

  assert.equal(baseUrl, "http://localhost:5173");
});

test("resolveRequestBaseUrl uses the request host in production", () => {
  const baseUrl = resolveRequestBaseUrl({
    appBaseUrl: "",
    isProduction: true,
    requestOrigin: "",
    forwardedProto: "https",
    protocol: "http",
    host: "dev.nanaabaackah.com",
    devFallbackOrigins: ["http://localhost:5173"],
  });

  assert.equal(baseUrl, "https://dev.nanaabaackah.com");
});
