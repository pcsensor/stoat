/**
 * RN 平台适配：必须在任何 stoat.js / livekit 使用之前导入。
 *
 * 1. URL：RN 无全局 URL，EventClient 用 new URL() 拼查询参数。
 * 2. WebSocket：stoat.js EventClient 可能传 URL 对象，RN 原生实现要求字符串。
 * 3. crypto.getRandomValues：stoat.js 的 ulid 幂等键依赖 Web Crypto。
 * 4. LogBox 忽略 LiveKit 挂断正常断开连接时的内部信令日志噪音。
 */
import "react-native-url-polyfill/auto";
import { LogBox } from "react-native";
import { getRandomValues } from "expo-crypto";

if (!globalThis.crypto?.getRandomValues) {
  globalThis.crypto = { ...(globalThis.crypto ?? {}), getRandomValues };
}

const NativeWebSocket = globalThis.WebSocket;

class WebSocketCompat extends NativeWebSocket {
  constructor(address, protocols) {
    super(String(address), protocols);
  }
}

globalThis.WebSocket = WebSocketCompat;

// 忽略 LiveKit 在主动挂断时，WebSocket 关闭导致的 signal stream 读取终止日志
LogBox.ignoreLogs([
  "error reading from signal stream",
  /error reading from signal stream/i,
]);

// 拦截 console.error 打印的正常信令关闭噪音，防止其冒泡至开发调试弹窗
const originalConsoleError = console.error;
console.error = (...args) => {
  const first = args[0];
  if (typeof first === "string" && first.includes("error reading from signal stream")) {
    console.debug("[livekit] signal stream closed gracefully");
    return;
  }
  originalConsoleError.apply(console, args);
};
