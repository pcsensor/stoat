package expo.modules.micforeground

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.example.radio.micforeground.MicForegroundService

/**
 * Expo 模块：JS 侧控制语音通话前台服务的启停与电池优化豁免。
 */
class MicForegroundModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("MicForeground")

    Function("start") { channelName: String ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, MicForegroundService::class.java).apply {
        putExtra(MicForegroundService.EXTRA_CHANNEL, channelName)
      }
      ContextCompat.startForegroundService(context, intent)
      true
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function false
      context.stopService(Intent(context, MicForegroundService::class.java))
      true
    }

    Function("isBatteryOptimizationIgnored") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.isIgnoringBatteryOptimizations(context.packageName)
      } else {
        true
      }
    }

    Function("requestIgnoreBatteryOptimization") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          return@Function true
        }
      }
      false
    }

    Function("playTone") { type: String ->
      try {
        val tg = android.media.ToneGenerator(android.media.AudioManager.STREAM_VOICE_CALL, 75)
        if (type == "join") {
          tg.startTone(android.media.ToneGenerator.TONE_PROP_BEEP2, 140)
        } else {
          tg.startTone(android.media.ToneGenerator.TONE_PROP_PROMPT, 140)
        }
        true
      } catch (e: Throwable) {
        false
      }
    }
  }
}
