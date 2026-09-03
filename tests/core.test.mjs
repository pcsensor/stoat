import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, isSessionInvalidError, joinUrl, normalizeDomain, parseInstanceConfig } from "../packages/core/src/index.ts";

test("normalizeDomain accepts bare hosts and removes paths", () => {
  assert.equal(normalizeDomain(" chat.example.com/path?q=1 "), "https://chat.example.com");
  assert.equal(normalizeDomain("http://localhost:14702/api"), "http://localhost:14702");
});

test("normalizeDomain rejects unsupported protocols", () => {
  assert.throws(() => normalizeDomain("ftp://chat.example.com"), /http 或 https/);
  assert.throws(() => normalizeDomain(""), /不能为空/);
});

test("parseInstanceConfig prefers advertised endpoints", () => {
  const config = parseInstanceConfig("https://chat.example.com/api/", {
    ws: "wss://events.example.com/socket",
    autumn: "https://files.example.com",
    features: { livekit: { nodes: [{ name: "near", public_url: "wss://voice.example.com" }] } },
    version: "0.15.1",
  });
  assert.deepEqual(config.endpoints, {
    api: "https://chat.example.com/api",
    ws: "wss://events.example.com/socket",
    autumn: "https://files.example.com",
    january: "https://chat.example.com/january",
    gifbox: "https://chat.example.com/gifbox",
    livekit: "wss://voice.example.com",
  });
  assert.equal(config.version, "0.15.1");
});

test("parseInstanceConfig derives compatible fallback endpoints", () => {
  const config = parseInstanceConfig("http://localhost:14702/api", { features: {} });
  assert.equal(config.endpoints.ws, "ws://localhost:14702/ws");
  assert.equal(config.endpoints.autumn, "http://localhost:14702/autumn");
  assert.equal(config.endpoints.livekit, "ws://localhost:14702/livekit");
});

test("joinUrl and ApiError preserve useful request context", () => {
  assert.equal(joinUrl("https://chat.example.com/api/", "/users/@me"), "https://chat.example.com/api/users/@me");
  assert.equal(joinUrl("https://chat.example.com/api", "https://files.example.com/a"), "https://files.example.com/a");
  const error = new ApiError(403, "POST", "https://chat.example.com/api/channels/x", { type: "Forbidden" });
  assert.match(error.message, /403/);
  assert.match(error.message, /Forbidden/);
});

test("parseInstanceConfig marks advertised versus fallback services", () => {
  const advertised = parseInstanceConfig("https://chat.example.com/api/", {
    ws: "wss://events.example.com/socket",
    autumn: "https://files.example.com",
    features: { livekit: { nodes: [{ name: "near", public_url: "wss://voice.example.com" }] } },
  });
  assert.deepEqual(advertised.availability, {
    ws: true,
    autumn: true,
    january: false,
    gifbox: false,
    livekit: true,
  });
  const bare = parseInstanceConfig("http://localhost:14702/api", { features: {} });
  assert.deepEqual(bare.availability, {
    ws: false,
    autumn: false,
    january: false,
    gifbox: false,
    livekit: false,
  });
});

test("isSessionInvalidError only matches dead credentials", () => {
  assert.equal(isSessionInvalidError(new ApiError(401, "GET", "https://x/api", { type: "Unauthorized" })), true);
  assert.equal(isSessionInvalidError(new ApiError(500, "GET", "https://x/api", {})), false);
  assert.equal(isSessionInvalidError(new ApiError(408, "GET", "https://x/api", {})), false);
  assert.equal(isSessionInvalidError(new Error("fetch failed")), false);
  assert.equal(isSessionInvalidError(new Error("InvalidSession")), true);
});
