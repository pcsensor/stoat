package com.example.radio.micforeground

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat

/**
 * 语音通话系统级前台服务（类 Jitsi Meet 架构）。
 *
 * 1. 系统级通话识别：声明 foregroundServiceType="microphone|phoneCall"，
 *    配合 NotificationCompat.CallStyle，被 Android 系统直接识别为 Ongoing Phone Call。
 *    在状态栏显示系统通话胶囊，在通知栏和锁屏上显示专用通话卡片与“挂断”按钮。
 * 2. 锁屏防断网与防休眠：持有 PARTIAL_WAKE_LOCK 与 WIFI_MODE_FULL_LOW_LATENCY / FULL_HIGH_PERF，
 *    在手机锁屏时阻止 CPU 睡眠与 Wi-Fi 节电降频，防止语音数据包与 WebSocket 连接中断。
 * 3. 音频通信状态：设置 AudioManager.MODE_IN_COMMUNICATION，保持音频子系统活跃。
 */
class MicForegroundService : Service() {

  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val channelName = intent?.getStringExtra(EXTRA_CHANNEL) ?: "语音频道"

    acquireLocks()
    setAudioMode(true)

    val stopIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("radio://voice/stop")
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    } ?: error("Radio 主 Activity 不存在")

    val contentIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 1, it, PendingIntent.FLAG_IMMUTABLE)
    }

    val caller = Person.Builder()
      .setName("Radio · $channelName")
      .setImportant(true)
      .build()

    val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.presence_audio_online)
      .setContentTitle("Radio 语音通话中")
      .setContentText(channelName)
      .setContentIntent(contentIntent)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MAX)

    // 系统通话专属 CallStyle（Android 12+ 原生通话胶囊与锁屏通话控制）
    try {
      val callStyle = NotificationCompat.CallStyle.forOngoingCall(caller, stopIntent)
      notificationBuilder.setStyle(callStyle)
    } catch (_: Throwable) {
      notificationBuilder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "挂断", stopIntent)
    }

    val notification = notificationBuilder.build()

    // 优先声明 MICROPHONE | PHONE_CALL（类 Jitsi Meet 通话规范，豁免 Doze 节电断网）
    val preferredType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    } else {
      0
    }

    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, preferredType)
    } catch (e: SecurityException) {
      // 容灾降级：若特定定制 ROM 限制 phoneCall，则降级为 microphone
      val fallbackType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      } else {
        0
      }
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fallbackType)
    }

    return START_STICKY
  }

  private fun acquireLocks() {
    if (wakeLock == null) {
      try {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Radio:VoiceCallWakeLock").apply {
          setReferenceCounted(false)
          acquire(6 * 60 * 60 * 1000L) // 保护上限 6 小时
        }
      } catch (e: Throwable) {
        e.printStackTrace()
      }
    }

    if (wifiLock == null) {
      try {
        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          WifiManager.WIFI_MODE_FULL_LOW_LATENCY
        } else {
          WifiManager.WIFI_MODE_FULL_HIGH_PERF
        }
        wifiLock = wm.createWifiLock(mode, "Radio:VoiceCallWifiLock").apply {
          setReferenceCounted(false)
          acquire()
        }
      } catch (e: Throwable) {
        e.printStackTrace()
      }
    }
  }

  private fun releaseLocks() {
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (_: Throwable) {}
    wakeLock = null

    try {
      wifiLock?.let { if (it.isHeld) it.release() }
    } catch (_: Throwable) {}
    wifiLock = null
  }

  private fun setAudioMode(inCall: Boolean) {
    try {
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      am.mode = if (inCall) AudioManager.MODE_IN_COMMUNICATION else AudioManager.MODE_NORMAL
    } catch (_: Throwable) {}
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(
            CHANNEL_ID,
            "语音通话",
            // 通话频道需要 HIGH 级别以激活系统锁屏通话控件与状态栏通话标识
            NotificationManager.IMPORTANCE_HIGH
          ).apply {
            description = "语音频道通话期间显示系统通话状态"
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          }
        )
      }
    }
  }

  override fun onDestroy() {
    releaseLocks()
    setAudioMode(false)
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    const val CHANNEL_ID = "radio.voice"
    const val NOTIFICATION_ID = 1729
    const val EXTRA_CHANNEL = "channel"
  }
}
