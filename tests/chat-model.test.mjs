import test from "node:test";
import assert from "node:assert/strict";
import { formatMessageTime, formatSystemEvent, toChatMessage } from "../apps/mobile/src/chat-model.ts";

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

test("formatSystemEvent no longer trusts a username for system detection", () => {
  const msg = {
    id: "msg6",
    authorId: "user9",
    author: { username: "Revolt" },
    content: "我是假系统消息",
  };
  assert.equal(formatSystemEvent(msg), null);
});

test("formatSystemEvent still accepts the reserved system account", () => {
  const msg = {
    id: "msg7",
    authorId: "00000000000000000000000000",
    content: "旧实例系统通知",
  };
  assert.equal(formatSystemEvent(msg), "旧实例系统通知");
});

test("toChatMessage keeps every reply preview", () => {
  const ref1 = { id: "r1", author: { username: "A" }, authorId: "a", content: "first", attachments: [] };
  const ref2 = { id: "r2", author: { username: "B" }, authorId: "b", content: "", attachments: [{ length: 1 }] };
  const msg = {
    id: "m1",
    authorId: "me",
    author: { username: "me" },
    content: "hello",
    createdAt: new Date().toISOString(),
    replyIds: ["r1", "r2", "missing"],
    attachments: [],
    reactions: new Map(),
  };
  const chat = toChatMessage(msg, "me", (id) => ({ r1: ref1, r2: ref2 })[id]);
  assert.deepEqual(chat.replyIds, ["r1", "r2", "missing"]);
  assert.equal(chat.replyPreviews.length, 3);
  assert.equal(chat.replyPreview.author, "A");
  assert.deepEqual(chat.replyPreviews[2], { id: "missing", author: "引用消息", content: "..." });
});

test("formatMessageTime shows time today and date otherwise", () => {
  const today = formatMessageTime(new Date());
  assert.match(today, /^\d{1,2}:\d{2}/);
  const old = formatMessageTime("2020-05-06T12:34:00Z");
  assert.match(old, /2020/);
  assert.equal(formatMessageTime("not-a-date"), "");
});
