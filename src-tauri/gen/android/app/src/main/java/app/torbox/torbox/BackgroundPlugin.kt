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
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class BackgroundPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun startService(invoke: Invoke) {
    val intent = Intent(activity, DownloadForegroundService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      activity.startForegroundService(intent)
    } else {
      activity.startService(intent)
    }
    invoke.resolve()
  }

  @Command
  fun stopService(invoke: Invoke) {
    activity.stopService(Intent(activity, DownloadForegroundService::class.java))
    invoke.resolve()
  }

  @Command
  fun isIgnoringBatteryOptimizations(invoke: Invoke) {
    val ignoring = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val pm = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(activity.packageName)
    } else {
      true
    }
    val result = JSObject()
    result.put("ignoring", ignoring)
    invoke.resolve(result)
  }

  @Command
  fun requestIgnoreBatteryOptimizations(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val pm = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (!pm.isIgnoringBatteryOptimizations(activity.packageName)) {
        try {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${activity.packageName}")
          }
          activity.startActivity(intent)
        } catch (_: Exception) {
          val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          activity.startActivity(fallback)
        }
      }
    }
    invoke.resolve()
  }

  @Command
  fun hasNotificationPermission(invoke: Invoke) {
    val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true
    }
    val result = JSObject()
    result.put("granted", granted)
    invoke.resolve(result)
  }

  @Command
  fun requestNotificationPermission(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val granted = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
      if (!granted) {
        ActivityCompat.requestPermissions(
          activity,
          arrayOf(Manifest.permission.POST_NOTIFICATIONS),
          4202
        )
      }
    }
    invoke.resolve()
  }
}
