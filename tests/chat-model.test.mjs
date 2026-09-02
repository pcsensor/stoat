import test from "node:test";
import assert from "node:assert/strict";
import { formatSystemEvent } from "../apps/mobile/src/chat-model.ts";

test("formatSystemEvent handles user_joined event", () => {
  const msg = {
    id: "msg1",
    authorId: "00000000000000000000000000",
    content: "",
    systemMessage: {
      type: "user_joined",
      userId: "u123",
      user: { username: "Alice" },
    },
  };
  assert.equal(formatSystemEvent(msg), "👉 @Alice 加入了服务器");
});

test("formatSystemEvent handles user_left event with fallback user resolver", () => {
  const msg = {
    id: "msg2",
    authorId: "00000000000000000000000000",
    content: "",
    systemMessage: {
      type: "user_left",
      userId: "u456",
    },
  };
  const resolveUser = (id) => (id === "u456" ? { username: "Bob" } : undefined);
  assert.equal(formatSystemEvent(msg, resolveUser), "👈 @Bob 离开了服务器");
});

test("formatSystemEvent handles channel_renamed event", () => {
  const msg = {
    id: "msg3",
    authorId: "00000000000000000000000000",
    content: "",
    systemMessage: {
      type: "channel_renamed",
      byId: "admin1",
      name: "新大厅",
      by: { username: "Admin" },
    },
  };
  assert.equal(formatSystemEvent(msg), '✏️ @Admin 将频道重命名为 "新大厅"');
});

test("formatSystemEvent handles raw system object from WebSocket", () => {
  const msg = {
    id: "msg4",
    authorId: "00000000000000000000000000",
    content: "",
    system: {
      type: "user_joined",
      id: "u789",
    },
  };
  const resolveUser = (id) => (id === "u789" ? { username: "Hmm" } : undefined);
  assert.equal(formatSystemEvent(msg, resolveUser), "👉 @Hmm 加入了服务器");
});

test("formatSystemEvent returns null for normal user messages", () => {
  const msg = {
    id: "msg5",
    authorId: "user1",
    author: { username: "justin" },
    content: "hello world",
  };
  assert.equal(formatSystemEvent(msg), null);
});
