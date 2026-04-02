package com.openos.lp2

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppLauncherModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName() = "AppLauncherModule"

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = ctx.packageManager
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val apps = pm.queryIntentActivities(intent, 0)
                .map { it.loadLabel(pm).toString() to it.activityInfo.packageName }
                .filter { it.second != ctx.packageName }
                .sortedBy { it.first.uppercase() }
            val result = Arguments.createArray()
            for ((name, pkg) in apps) {
                val entry = Arguments.createMap()
                entry.putString("name", name)
                entry.putString("package", pkg)
                result.pushMap(entry)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun launchApp(packageName: String) {
        try {
            // Switch to GL16 for external apps — richer refresh mode
            epdWrite("wf_mode", "3")
            val intent = ctx.packageManager.getLaunchIntentForPackage(packageName) ?: return
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
        } catch (_: Exception) {}
    }

    private fun epdWrite(file: String, value: String) {
        val path = "/sys/devices/virtual/graphics/fb0/$file"
        try { java.io.FileOutputStream(path).use { it.write(value.toByteArray()) } }
        catch (_: Exception) {
            try { Runtime.getRuntime().exec(arrayOf("su", "-c", "echo $value > $path")).waitFor() } catch (_: Exception) {}
        }
    }

    @ReactMethod
    fun openAppInfo(packageName: String) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
        } catch (_: Exception) {}
    }
}
