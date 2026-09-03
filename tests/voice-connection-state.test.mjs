import test from "node:test";
import assert from "node:assert/strict";
import { canReuseVoiceRoom } from "../apps/mobile/src/voice-connection-state.ts";

test("foregrounding preserves an established voice room", () => {
  assert.equal(canReuseVoiceRoom(true, "connected", false), true);
});

test("voice recovery only rebuilds rooms the SDK can no longer use", () => {
  assert.equal(canReuseVoiceRoom(false, "reconnecting", false), false);
  assert.equal(canReuseVoiceRoom(true, "reconnecting", false), false);
  assert.equal(canReuseVoiceRoom(true, "reconnecting", true), true);
});
