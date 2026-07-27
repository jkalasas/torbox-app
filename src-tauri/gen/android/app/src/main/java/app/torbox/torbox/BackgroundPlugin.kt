package app.torbox.torbox

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import app.tauri.PermissionState
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

private const val NOTIFICATION_ALIAS = "postNotification"

@TauriPlugin(
  permissions = [
    Permission(
      strings = [Manifest.permission.POST_NOTIFICATIONS],
      alias = NOTIFICATION_ALIAS
    )
  ]
)
class BackgroundPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun startService(invoke: Invoke) {
    try {
      val intent = Intent(activity, DownloadForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        activity.startForegroundService(intent)
      } else {
        activity.startService(intent)
      }
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject(e.message ?: "Failed to start background service")
    }
  }

  @Command
  fun stopService(invoke: Invoke) {
    try {
      activity.stopService(Intent(activity, DownloadForegroundService::class.java))
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject(e.message ?: "Failed to stop background service")
    }
  }

  @Command
  fun isIgnoringBatteryOptimizations(invoke: Invoke) {
    val result = JSObject()
    result.put("ignoring", isBatteryUnrestricted())
    invoke.resolve(result)
  }

  @Command
  fun requestIgnoreBatteryOptimizations(invoke: Invoke) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || isBatteryUnrestricted()) {
      invoke.resolve()
      return
    }

    try {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${activity.packageName}")
      }
      startActivityForResult(invoke, intent, "batteryOptimizationResult")
    } catch (_: Exception) {
      try {
        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        startActivityForResult(invoke, fallback, "batteryOptimizationResult")
      } catch (e: Exception) {
        invoke.reject(e.message ?: "Could not open battery optimization settings")
      }
    }
  }

  @ActivityCallback
  fun batteryOptimizationResult(invoke: Invoke, result: ActivityResult) {
    invoke.resolve()
  }

  @Command
  fun hasNotificationPermission(invoke: Invoke) {
    val result = JSObject()
    result.put("granted", hasNotificationAccess())
    invoke.resolve(result)
  }

  @Command
  fun requestNotificationPermission(invoke: Invoke) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasNotificationAccess()) {
      invoke.resolve()
      return
    }

    if (getPermissionState(NOTIFICATION_ALIAS) == PermissionState.GRANTED) {
      invoke.resolve()
      return
    }

    requestPermissionForAlias(NOTIFICATION_ALIAS, invoke, "notificationPermissionResult")
  }

  @PermissionCallback
  fun notificationPermissionResult(invoke: Invoke) {
    invoke.resolve()
  }

  private fun isBatteryUnrestricted(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true
    }
    val pm = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(activity.packageName)
  }

  private fun hasNotificationAccess(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return true
    }
    return ContextCompat.checkSelfPermission(
      activity,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }
}
