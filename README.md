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

原生 `android/` 和 `ios/` 目录由 Expo prebuild 生成，故不纳入版本控制。iOS 工作区只在 macOS 本机生成并由 Xcode 打开；Android debug APK 则由 GitHub Actions 自动构建。

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

生成可由 Xcode 打开的工作区并安装 Pods：

```bash
pnpm --filter @radio/mobile exec expo prebuild --platform ios
open apps/mobile/ios/Radio.xcworkspace
```

在 Xcode 中选择已连接的真机和 `Radio` scheme 后运行即可安装。该工作区是本机生成文件，不能提交；若修改 `app.json`、Expo 插件或原生模块，请重新运行上述命令。

在发布前，请把 [`apps/mobile/app.json`](apps/mobile/app.json) 中的 `com.example.radio` 替换为你自己拥有的 Android package 与 iOS bundle identifier。

## 实例与发布配置

应用本身不读取或提交 `.env` 文件。GitHub Actions 构建离线可运行的 Android release APK；在首次运行工作流前，于 GitHub 仓库的 **Settings → Secrets and variables → Actions** 配置以下 Repository secrets：

- `RADIO_UPLOAD_STORE_BASE64`：上传密钥库文件的单行 Base64 内容
- `RADIO_UPLOAD_STORE_PASSWORD`
- `RADIO_UPLOAD_KEY_ALIAS`
- `RADIO_UPLOAD_KEY_PASSWORD`

可在任意受信任且安装 JDK 的机器一次性生成密钥；生成的 `.jks` 已被 Git 忽略，务必离线备份，不要上传或提交：

```bash
keytool -genkeypair -v -keystore radio-upload.jks -storetype JKS -alias radio-upload -keyalg RSA -keysize 2048 -validity 10000
base64 < radio-upload.jks | tr -d '\n'
```

将第二条命令的输出保存为 `RADIO_UPLOAD_STORE_BASE64`，并将创建密钥时设置的密码和别名分别存入其余三个 Secret。不要把 keystore、测试密码、会话 token、API key、私钥或设备日志写入仓库。公共实例应使用 HTTPS/WSS，并在服务端实施认证、限流与常规安全更新。

## 安全与仓库卫生

- `.gitignore` 排除依赖缓存、Expo 状态、生成的原生工程、签名材料、环境变量、日志和安装包。
- 本仓库不包含服务器部署脚本、SSH 配置、云端地址、真实测试账号或端到端生产测试工具。
- GitHub Actions 在 `main` 分支推送或手动触发时，执行依赖安装、测试、静态检查和已签名的 release APK 构建；构建产物保留 30 天，不部署服务。

## 持续集成

每次推送至 `main` 或手动触发会执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm verify`
3. Expo Android prebuild 与已签名 Release APK 构建，并上传可离线运行的 `app-release.apk`

## 许可证

本项目采用 MIT 许可证。
