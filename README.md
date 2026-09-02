<p align="center">
  <img src="apps/mobile/assets/icon.png" width="112" alt="Radio 图标" />
</p>

<h1 align="center">Radio</h1>

<p align="center">
  <strong>面向自建 Stoat 兼容实例的跨平台移动客户端</strong><br />
  在 iOS 与 Android 上提供聊天、图片附件和基于 LiveKit 的实时语音频道。
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#架构">架构</a> ·
  <a href="#功能">功能</a> ·
  <a href="#构建与安装">构建与安装</a> ·
  <a href="#android-签名-release-apk">Android CI</a> ·
  <a href="#ios-xcode-工作流">iOS Xcode</a> ·
  <a href="#安全与隐私">安全</a>
</p>

<p align="center">
  <a href="https://github.com/pcsensor/stoat/actions/workflows/android-release-apk.yml">
    <img src="https://github.com/pcsensor/stoat/actions/workflows/android-release-apk.yml/badge.svg?branch=main" alt="Android Release APK" />
  </a>
  <img src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=white" alt="React Native 0.86" />
  <img src="https://img.shields.io/badge/LiveKit-Voice-FF6F61" alt="LiveKit Voice" />
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white" alt="Node.js 22 or later" />
  <img src="https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white" alt="pnpm 11" />
</p>

---

## 概览

Radio 是一个 Expo / React Native 单仓库项目，用于连接**用户自己部署的 Stoat 兼容服务**。应用不会内置服务器地址、测试账号、会话令牌、私钥或云端运维配置；用户首次输入实例域名后，客户端通过 `/.well-known/stoat` 发现服务端点。

| 终端 | 交付方式 | 运行特性 |
| --- | --- | --- |
| Android | GitHub Actions 构建的已签名 Release APK | 内置 JS bundle，可离线启动 |
| iOS | macOS 上生成原生工作区后使用 Xcode 安装 | Debug 依赖 Metro；Release 内置 JS bundle |

## 功能

| 模块 | 能力 |
| --- | --- |
| 实例与账户 | 发现 Stoat 实例、注册、登录、恢复本地会话 |
| 社区聊天 | 服务器、文字频道、语音频道、私信、好友关系、邀请与成员状态 |
| 消息互动 | 发送、编辑、删除、回复、反应、搜索和系统消息展示 |
| 媒体附件 | 从相册或相机选择图片、上传进度与图片预览 |
| 语音频道 | 获取短时 LiveKit 凭据、发布麦克风、订阅远端音频、静音、音量控制与成员状态 |
| 断线恢复 | LiveKit 事件监听、指数退避重连与解锁/音频恢复后的主动连接检查 |
| Android 后台通话 | 麦克风前台服务、通话通知、Partial Wake Lock、Wi-Fi Lock、通信音频模式 |
| iOS 后台通话 | `audio` / `voip` 后台模式、CallKit 状态、音频中断通知和 WebRTC 音频会话同步 |

## 架构

```text
┌──────────────────────────── Radio mobile app ────────────────────────────┐
│ apps/mobile                                                               │
│                                                                            │
│  App.tsx / UI components                                                   │
│       │                                                                    │
│       ├── StoatSession ──────────────── stoat.js 实时客户端 ─────────┐   │
│       ├── @radio/core ──────────────── 实例发现、认证、HTTP 客户端 ──┼───┼──► Stoat
│       ├── @radio/voice ─────────────── join_call 短时凭据 ────────────┘   │    实例
│       │                                                                    │
│       └── VoiceRoomController                                              │
│             ├── livekit-client / WebRTC ───────────────────────────────► LiveKit
│             └── mic-foreground 原生模块                                   │
│                   ├── Android: Foreground Service + Wake/Wi-Fi Lock      │
│                   └── iOS: CallKit + AVAudioSession lifecycle            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 数据与连接流

1. 用户输入实例域名；`@radio/core` 读取 `/.well-known/stoat`，解析 API、WebSocket、媒体和 LiveKit 端点。
2. 登录或注册后，`StoatSession` 建立实时连接；会话令牌只存于设备的 Expo SecureStore。
3. 加入语音频道时，`@radio/voice` 请求 `join_call` 短时凭据，`VoiceRoomController` 再连接 LiveKit 并发布本地麦克风轨道。
4. 原生通话层在连接前启动：Android 进入麦克风前台服务；iOS 登记 CallKit 通话。
5. 网络断开、音频会话恢复或应用解锁后，控制器会检查房间状态并按指数退避重新加入。

### 目录结构

```text
.
├── apps/mobile/                         # Expo / React Native 应用
│   ├── App.tsx                           # 根组件、会话与前后台协调
│   ├── src/
│   │   ├── components/                   # 聊天、频道、语音等界面
│   │   ├── session.ts                    # Stoat 实时会话封装
│   │   ├── session-store.ts              # SecureStore 本地持久化
│   │   ├── stoat-api.ts                  # 业务 API 适配
│   │   └── voice-room.ts                 # LiveKit 房间与重连控制器
│   ├── modules/mic-foreground/           # Android / iOS 原生通话模块
│   ├── plugins/                          # Expo 预构建配置插件
│   └── app.json                          # App 标识、权限、后台模式与插件
├── packages/core/                        # 实例发现、认证、通用 HTTP
├── packages/voice/                       # Stoat 语音接口封装
├── tests/                                # 无真实服务器依赖的单元测试
└── .github/workflows/                    # GitHub Actions 发布构建
```

`apps/mobile/android/` 与 `apps/mobile/ios/` 是 Expo Continuous Native Generation（CNG）生成的目录，因此不会提交。所有应提交的原生实现都位于 `modules/` 和 `plugins/`。

## 环境要求

- Node.js 22 或更高版本
- pnpm 11（仓库通过 `packageManager` 锁定版本）
- iOS：macOS、Xcode、CocoaPods
- Android 本地构建：JDK 21 与 Android SDK

## 快速开始

```bash
# 1. 安装依赖
pnpm install --frozen-lockfile

# 2. 运行单元测试、类型检查和 Android JS bundle 导出
pnpm verify

# 3. 启动 Expo / Metro 开发服务器
pnpm mobile
```

随后在原生开发构建中打开应用。首次使用时输入你的 Stoat 实例地址并登录。

## 开发命令

| 命令 | 作用 |
| --- | --- |
| `pnpm test` | 运行单元测试 |
| `pnpm typecheck` | 检查所有工作区包的 TypeScript 类型 |
| `pnpm verify` | 测试、类型检查并导出 Android JS bundle |
| `pnpm mobile` | 启动 Expo / Metro 开发服务器 |
| `pnpm android:debug` | 预构建 Android 并生成 Debug APK；需要 Metro 才能运行 JS |
| `pnpm android:release` | 预构建 Android 并生成已签名的 Release APK；需要签名环境变量 |

## 构建与安装

### Android 本地 Debug

仅用于开发调试；Debug APK 不适合作为独立分发包，因为它通常从 Metro 加载 JS：

```bash
pnpm mobile
pnpm android:debug
```

### Android 签名 Release APK

Release APK 会内置 JS bundle，可在没有 Metro 的设备上离线启动。推荐使用下文的 GitHub Actions 构建，而不是在本机保留 Android 工具链。

### iOS Xcode 工作流

生成 iOS 工程与 Pods：

```bash
pnpm --filter @radio/mobile exec expo prebuild --platform ios
open apps/mobile/ios/Radio.xcworkspace
```

请打开 **`Radio.xcworkspace`**，不要打开 `.xcodeproj`。在 Xcode 中选择你的 Signing Team、唯一 Bundle Identifier 与真机后即可运行。

| Xcode 配置 | 适用场景 | JS 来源 |
| --- | --- | --- |
| Debug | 日常开发 | 先执行 `pnpm mobile`，由 Metro 提供 |
| Release | 手动安装、离线验证 | Xcode 构建时嵌入 `main.jsbundle` |

若 Debug 版出现 `No script URL provided`，说明 Metro 没有启动或设备无法连接到它；先运行 `pnpm mobile` 并保持终端开启即可。

## Android 签名 Release APK

工作流 [Android signed release APK](https://github.com/pcsensor/stoat/actions/workflows/android-release-apk.yml) 会在推送到 `main` 或手动触发时：

1. 安装 Node.js、pnpm 和 JDK 21；
2. 运行 `pnpm verify`；
3. 从 GitHub Secrets 恢复签名密钥到 runner 临时目录；
4. 执行 `pnpm android:release`；
5. 上传 `radio-android-release-apk` 工件，其中包含 `app-release.apk`（保留 30 天）。

### 首次配置 GitHub Secrets

在受信任并安装 JDK 的设备上生成一次密钥。请将文件保存在仓库外并进行离线备份：

```bash
keytool -genkeypair -v -keystore radio-upload.jks -storetype JKS -alias radio-upload -keyalg RSA -keysize 2048 -validity 10000
base64 < radio-upload.jks | tr -d '\\n'
```

然后到 GitHub 仓库 **Settings → Secrets and variables → Actions**，添加以下 Repository secrets：

| Secret | 内容 |
| --- | --- |
| `RADIO_UPLOAD_STORE_BASE64` | 上述 Base64 命令的单行输出 |
| `RADIO_UPLOAD_STORE_PASSWORD` | keystore 密码 |
| `RADIO_UPLOAD_KEY_ALIAS` | key alias，例如 `radio-upload` |
| `RADIO_UPLOAD_KEY_PASSWORD` | key 密码 |

工作流从不记录或上传密钥。**请勿丢失 keystore**：Android 更新必须使用同一签名，否则用户需要先卸载旧版才能安装新版。

## 应用标识、权限与原生配置

发布前，请在 [`apps/mobile/app.json`](apps/mobile/app.json) 中将默认的 `com.example.radio` 替换为你拥有的 Android package name 和 iOS bundle identifier。

| 平台 | 配置 | 用途 |
| --- | --- | --- |
| iOS | `UIBackgroundModes: audio, voip` | 锁屏期间持续语音与 CallKit 通话状态 |
| iOS | 麦克风、相册、相机用途说明 | 发言与图片附件 |
| Android | `RECORD_AUDIO`、前台麦克风服务 | 语音采集与后台通话 |
| Android | 通话通知、Wake Lock、通信音频权限 | 保持通话状态、通知和防休眠 |

若修改 `app.json`、Expo 插件或原生模块，请重新执行对应平台的 `expo prebuild`，让生成工程同步配置。

## 语音后台策略

### Android

加入语音时，应用先启动麦克风前台服务，再连接并发布 LiveKit 音频。服务显示常驻通话通知，持有 CPU / Wi-Fi 锁，并使用通信音频模式。服务不会在应用进程被杀后伪造重启通话，避免出现“通知显示通话中、实际房间已经断开”的状态。

### iOS

应用启用音频后台模式，并通过 CallKit 反馈系统通话、静音、音频激活/失活和中断事件。事件会同步给 WebRTC，并在可恢复时主动检查 LiveKit 房间连接。实际锁屏稳定性仍应在真机上测试：包括锁屏、网络切换、蓝牙路由变化、来电和闹钟中断。

## 安全与隐私

- 不提交 `.env`、keystore、证书、私钥、Firebase 配置、服务账号文件、会话令牌、设备日志或生成安装包；具体规则见 [`.gitignore`](.gitignore)。
- 会话令牌仅存放在当前设备的 Expo SecureStore，使用设备专属的解锁访问策略。
- 应使用 HTTPS / WSS 部署公开实例，并在服务端继续承担认证、授权、限流、日志治理与安全更新。
- Android 签名密钥应存放在 GitHub Secrets 与离线安全备份中；不要上传到 issue、聊天记录或仓库。

## 验证清单

提交前建议执行：

```bash
pnpm verify
```

发布构建前额外确认：

- Android：四项 `RADIO_UPLOAD_*` GitHub Secrets 都已配置，且可下载并安装 Release APK。
- iOS：在真机上以 Release 配置安装一次；Debug 验证时 Metro 正在运行。
- 语音：至少覆盖锁屏、网络切换、静音、蓝牙连接/断开与系统音频中断。

## 许可证

本项目采用 MIT 许可证。
