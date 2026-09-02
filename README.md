# Radio

Radio 是一个基于 React Native 与 Expo 的移动客户端，用于连接自建的 Stoat 兼容实例。项目不内置任何服务地址、测试账号、云端运维信息或发布凭据；首次使用时由用户在应用内输入实例地址。

## 功能

- 通过 `/.well-known/stoat` 发现兼容实例并建立会话
- 服务器、频道、私信、消息、回复、反应与图片附件
- 基于 LiveKit 的语音频道，以及 Android 前台麦克风服务
- 使用 Expo SecureStore 保存本机会话
- Android 与 iOS 的 Expo prebuild 支持

## 工程结构

```text
.
├── apps/mobile/                 # Expo / React Native 应用
│   ├── src/                     # 页面、组件、会话与业务适配层
│   ├── modules/mic-foreground/  # 前台麦克风原生模块
│   ├── plugins/                 # Expo 配置插件
│   └── app.json                 # 应用标识、权限与插件配置
├── packages/core/               # 实例发现、认证与 HTTP 客户端
├── packages/voice/              # 语音 API 封装
├── tests/                       # 不依赖真实服务的单元测试
├── .github/workflows/           # 持续集成
└── package.json                 # 工作区脚本
```

原生 `android/` 和 `ios/` 目录由 Expo prebuild 生成，故不纳入版本控制。

## 环境要求

- Node.js 22 或更高版本
- pnpm 11
- Android 开发：Android SDK 与 JDK 21
- iOS 开发：macOS、Xcode 与 CocoaPods

## 安装与验证

```bash
pnpm install
pnpm test
pnpm typecheck
```

执行完整静态验证与 Android bundle 导出：

```bash
pnpm verify
```

## 本地开发

启动 Expo 开发服务器：

```bash
pnpm mobile
```

生成并构建 Android debug APK：

```bash
pnpm android:debug
```

生成 iOS 原生工程：

```bash
pnpm --filter @radio/mobile exec expo prebuild --platform ios --no-install
```

在发布前，请把 [`apps/mobile/app.json`](apps/mobile/app.json) 中的 `com.example.radio` 替换为你自己拥有的 Android package 与 iOS bundle identifier。

## 实例与发布配置

应用本身不读取或提交 `.env` 文件。若构建 Android release 包，发布环境需要通过安全的 CI 变量或本机密钥管理提供：

- `RADIO_UPLOAD_STORE_FILE`
- `RADIO_UPLOAD_STORE_PASSWORD`
- `RADIO_UPLOAD_KEY_ALIAS`
- `RADIO_UPLOAD_KEY_PASSWORD`

不要把这些变量、keystore、测试密码、会话 token、API key、私钥或设备日志写入仓库。公共实例应使用 HTTPS/WSS，并在服务端实施认证、限流与常规安全更新。

## 安全与仓库卫生

- `.gitignore` 排除依赖缓存、Expo 状态、生成的原生工程、签名材料、环境变量、日志和安装包。
- 本仓库不包含服务器部署脚本、SSH 配置、云端地址、真实测试账号或端到端生产测试工具。
- GitHub Actions 只执行依赖安装、测试、静态检查和 debug 构建；不部署服务，也不需要云端 Secret。

## 持续集成

每次 push 和 pull request 会执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm verify`
3. Expo Android prebuild 与 debug APK 构建

## 许可证

本项目采用 MIT 许可证。

