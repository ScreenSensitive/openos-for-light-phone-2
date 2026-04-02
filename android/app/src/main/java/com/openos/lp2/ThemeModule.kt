package com.openos.lp2

import android.content.Context
import android.os.BatteryManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ThemeModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "ThemeModule"

    private val prefs get() = ctx.getSharedPreferences("lighteros", Context.MODE_PRIVATE)

    @ReactMethod fun isDark(promise: Promise) {
        promise.resolve(prefs.getBoolean("dark", false))
    }

    @ReactMethod fun setDark(dark: Boolean, promise: Promise) {
        prefs.edit().putBoolean("dark", dark).apply()
        promise.resolve(null)
    }

    @ReactMethod fun getFontSize(promise: Promise) {
        promise.resolve(prefs.getInt("font_size", 15))
    }

    @ReactMethod fun setFontSize(size: Int, promise: Promise) {
        prefs.edit().putInt("font_size", size).apply()
        promise.resolve(null)
    }

    @ReactMethod fun getShowStatus(promise: Promise) {
        promise.resolve(prefs.getBoolean("show_status", true))
    }

    @ReactMethod fun setShowStatus(show: Boolean, promise: Promise) {
        prefs.edit().putBoolean("show_status", show).apply()
        promise.resolve(null)
    }

    @ReactMethod fun getWaveformMode(promise: Promise) {
        promise.resolve(prefs.getInt("wf_mode", 2))
    }

    @ReactMethod fun saveWaveformMode(mode: Int, promise: Promise) {
        prefs.edit().putInt("wf_mode", mode).apply()
        promise.resolve(null)
    }

    @ReactMethod fun getUseBuiltinKeyboard(promise: Promise) {
        promise.resolve(prefs.getBoolean("builtin_keyboard", true))
    }
    @ReactMethod fun setUseBuiltinKeyboard(v: Boolean, promise: Promise) {
        prefs.edit().putBoolean("builtin_keyboard", v).apply(); promise.resolve(null)
    }

    @ReactMethod fun getHideSysStatusBar(promise: Promise) {
        promise.resolve(prefs.getBoolean("hide_sys_statusbar", false))
    }
    @ReactMethod fun setHideSysStatusBar(v: Boolean, promise: Promise) {
        prefs.edit().putBoolean("hide_sys_statusbar", v).apply(); promise.resolve(null)
    }

    @ReactMethod fun getHideNavBar(promise: Promise) {
        promise.resolve(prefs.getBoolean("hide_navbar", false))
    }
    @ReactMethod fun setHideNavBar(v: Boolean, promise: Promise) {
        prefs.edit().putBoolean("hide_navbar", v).apply(); promise.resolve(null)
    }

    // 0=off, 1=low, 2=medium, 3=high
    @ReactMethod fun getVibrateStrength(promise: Promise) {
        promise.resolve(prefs.getInt("vibrate_strength", 0))
    }
    @ReactMethod fun setVibrateStrength(v: Int, promise: Promise) {
        prefs.edit().putInt("vibrate_strength", v).apply(); promise.resolve(null)
    }

    @ReactMethod fun getShowToggles(promise: Promise) {
        promise.resolve(prefs.getBoolean("show_toggles", true))
    }
    @ReactMethod fun setShowToggles(v: Boolean, promise: Promise) {
        prefs.edit().putBoolean("show_toggles", v).apply(); promise.resolve(null)
    }

    @ReactMethod fun getAlignment(promise: Promise) {
        promise.resolve(prefs.getString("alignment", "center"))
    }
    @ReactMethod fun setAlignment(v: String, promise: Promise) {
        prefs.edit().putString("alignment", v).apply(); promise.resolve(null)
    }

    @ReactMethod fun getShowNotifBell(promise: Promise) {
        promise.resolve(prefs.getBoolean("show_notif_bell", true))
    }
    @ReactMethod fun setShowNotifBell(v: Boolean, promise: Promise) {
        prefs.edit().putBoolean("show_notif_bell", v).apply(); promise.resolve(null)
    }

    @ReactMethod fun getBatteryLevel(promise: Promise) {
        try {
            val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            promise.resolve(level)
        } catch (e: Exception) {
            promise.resolve(-1)
        }
    }
}
