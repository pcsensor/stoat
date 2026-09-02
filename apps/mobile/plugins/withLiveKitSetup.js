const { withMainApplication, withAppDelegate } = require("expo/config-plugins");

const ANDROID_SETUP_LINE =
  "LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())";
const ANDROID_IMPORTS = [
  "import com.livekit.reactnative.LiveKitReactNative",
  "import com.livekit.reactnative.audio.AudioType",
];

module.exports = function withLiveKitSetup(config) {
  config = withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (!src.includes("LiveKitReactNative")) {
      // 插入 import（放在首个 import 之前，保持 Kotlin 文件头整洁）
      const firstImport = src.indexOf("import ");
      src =
        src.slice(0, firstImport) + ANDROID_IMPORTS.join("\n") + "\n" + src.slice(firstImport);

      // 在 onCreate 的 super.onCreate() 之后立即 setup（必须先于任何 RN 初始化）
      src = src.replace(
        /(override fun onCreate\(\) \{\s*\n(\s*)super\.onCreate\(\))/,
        (_m, head, indent) =>
          `${head}\n${indent}// LiveKit RN 要求在任何 RN 初始化前 setup 音频设备模块（communication 模式启用硬件 AEC/NS）\n${indent}${ANDROID_SETUP_LINE}`
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (cfg.modResults.language === "objc" || cfg.modResults.language === "objcpp") {
      if (!src.includes("LivekitReactNative.h")) {
        src = `#import "LivekitReactNative.h"\n` + src;
      }
      if (!src.includes("[LivekitReactNative setup]")) {
        src = src.replace(
          /(- \(BOOL\)application:\(UIApplication \*\)application didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{)/,
          `$1\n  [LivekitReactNative setup];`
        );
      }
    } else if (cfg.modResults.language === "swift") {
      if (!src.includes("LivekitReactNative.setup()")) {
        src = src.replace(
          /(func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\) -> Bool \{\s*)/,
          `$1\n    LivekitReactNative.setup()\n`
        );
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
};
