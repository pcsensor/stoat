const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING = `
        release {
            def releaseStoreFile = project.findProperty("RADIO_UPLOAD_STORE_FILE") ?: System.getenv("RADIO_UPLOAD_STORE_FILE")
            def releaseStorePassword = project.findProperty("RADIO_UPLOAD_STORE_PASSWORD") ?: System.getenv("RADIO_UPLOAD_STORE_PASSWORD")
            def releaseKeyAlias = project.findProperty("RADIO_UPLOAD_KEY_ALIAS") ?: System.getenv("RADIO_UPLOAD_KEY_ALIAS")
            def releaseKeyPassword = project.findProperty("RADIO_UPLOAD_KEY_PASSWORD") ?: System.getenv("RADIO_UPLOAD_KEY_PASSWORD")
            def releaseSigningReady = releaseStoreFile && releaseStorePassword && releaseKeyAlias && releaseKeyPassword
            def releaseRequested = gradle.startParameter.taskNames.any { it.toLowerCase().contains("release") }
            if (releaseRequested && !releaseSigningReady) {
                throw new GradleException("发布构建必须配置 Radio release 签名凭据")
            }
            if (releaseSigningReady) {
                storeFile file(releaseStoreFile)
                storePassword releaseStorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
            }
        }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    let source = cfg.modResults.contents;
    if (!source.includes("RADIO_UPLOAD_STORE_FILE")) {
      source = source.replace(
        /(\s*keyPassword 'android'\s*\n\s*}\s*\n)(\s*}\s*\n\s*buildTypes\s*\{)/,
        `$1${RELEASE_SIGNING}$2`
      );
    }
    const buildTypesIndex = source.indexOf("buildTypes {");
    if (buildTypesIndex >= 0) {
      const beforeBuildTypes = source.slice(0, buildTypesIndex);
      const buildTypes = source.slice(buildTypesIndex);
      const releaseIndex = buildTypes.indexOf("release {");
      const beforeRelease = buildTypes.slice(0, releaseIndex);
      const release = buildTypes.slice(releaseIndex).replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release");
      source = beforeBuildTypes + beforeRelease + release;
    }
    cfg.modResults.contents = source;
    return cfg;
  });
};
