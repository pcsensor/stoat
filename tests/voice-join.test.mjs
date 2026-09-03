import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../packages/core/src/index.ts";
import { isAlreadyConnectedError, isRetriableVoiceError } from "../packages/voice/src/index.ts";

test("isAlreadyConnectedError reads structured bodies, not only text", () => {
  const structured = new ApiError(400, "POST", "https://x/api/channels/c/join_call", { type: "AlreadyConnected" });
  assert.equal(isAlreadyConnectedError(structured), true);
  assert.equal(isAlreadyConnectedError(new Error("AlreadyConnected to voice")), true);
  assert.equal(isAlreadyConnectedError(new Error("Forbidden")), false);
});

test("isRetriableVoiceError retries expiry and outage, not auth or capacity", () => {
  assert.equal(isRetriableVoiceError(new ApiError(500, "POST", "https://x/api", {})), true);
  assert.equal(isRetriableVoiceError(new ApiError(429, "POST", "https://x/api", {})), true);
  assert.equal(isRetriableVoiceError(new ApiError(401, "POST", "https://x/api", {})), false);
  assert.equal(isRetriableVoiceError(new ApiError(404, "POST", "https://x/api", {})), false);
  assert.equal(isRetriableVoiceError(new Error("LiveKit token expired")), true);
  assert.equal(isRetriableVoiceError(new Error("Socket closed, trying to send.")), true);
  assert.equal(isRetriableVoiceError(new Error("room is full")), false);
  assert.equal(isRetriableVoiceError(new Error("该实例未公布语音服务")), false);
});
