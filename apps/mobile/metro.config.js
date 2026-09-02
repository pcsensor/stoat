// Expo 默认配置 + RN 兼容 shim：
// @vladfrangu/async_event_emitter 内联了 node-inspect-extracted，
// 顶层初始化在 Metro/RN 下抛 "target is not an object"，
// 用本地最小实现替换（stoat.js 只用 on/emit）。
//
// 注意：extraNodeModules 仅在常规解析失败后生效，真实包存在时永不命中，
// 必须用 resolveRequest 主动拦截。
const { getDefaultConfig } = require("expo/metro-config");

const SHIM = require.resolve("./shims/async-event-emitter.js");
const TARGET = "@vladfrangu/async_event_emitter";

const config = getDefaultConfig(__dirname);

const originalResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === TARGET || moduleName.startsWith(TARGET + "/")) {
    return { type: "sourceFile", filePath: SHIM };
  }
  if (originalResolve) return originalResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
