package com.openos.lp2

import android.bluetooth.BluetoothManager
import android.content.Context
import android.os.Handler
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class QuickTogglesModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName() = "QuickTogglesModule"

    private val bg = android.os.HandlerThread("QuickTogglesBg").also { it.start() }
    private val bgHandler = Handler(bg.looper)

    private fun su(cmd: String) {
        try { Runtime.getRuntime().exec(arrayOf("su", "-c", cmd)).waitFor() } catch (_: Exception) {}
    }

    // ── Airplane mode ──────────────────────────────────────────────────────────

    @ReactMethod
    fun getAirplaneMode(promise: Promise) {
        try {
            val on = Settings.Global.getInt(ctx.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1
            promise.resolve(on)
        } catch (_: Exception) { promise.resolve(false) }
    }

    @ReactMethod
    fun setAirplaneMode(on: Boolean, promise: Promise) {
        bgHandler.post {
            val v = if (on) "1" else "0"
            val state = if (on) "true" else "false"
            su("settings put global airplane_mode_on $v")
            su("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state $state --receiver-foreground")
            // Secondary method via connectivity service
            su("cmd connectivity airplane-mode ${if (on) "enable" else "disable"}")
            promise.resolve(null)
        }
    }

    // ── Bluetooth ──────────────────────────────────────────────────────────────

    @ReactMethod
    fun getBluetooth(promise: Promise) {
        try {
            val bm = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            promise.resolve(bm?.adapter?.isEnabled == true)
        } catch (_: Exception) { promise.resolve(false) }
    }

    @ReactMethod
    fun setBluetooth(on: Boolean, promise: Promise) {
        bgHandler.post {
            // Try direct BluetoothAdapter API first (works on API 28 with BLUETOOTH_ADMIN)
            var done = false
            try {
                val bm = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
                val adapter = bm?.adapter
                if (adapter != null) {
                    @Suppress("DEPRECATION")
                    done = if (on) adapter.enable() else adapter.disable()
                }
            } catch (_: Exception) {}

            // Fallback to su commands
            if (!done) {
                su(if (on) "svc bluetooth enable" else "svc bluetooth disable")
            }
            promise.resolve(null)
        }
    }

    // ── Brightness ─────────────────────────────────────────────────────────────

    private val BRIGHT_MAP = mapOf(0 to 0, 25 to 64, 50 to 128, 75 to 191, 100 to 255)

    @ReactMethod
    fun getBrightness(promise: Promise) {
        try {
            val mode = Settings.System.getInt(ctx.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE, 0)
            if (mode == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC) {
                promise.resolve(-1); return
            }
            val raw = Settings.System.getInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128)
            val pct = (raw * 100f / 255f).toInt()
            val step = when { pct < 12 -> 0; pct < 37 -> 25; pct < 62 -> 50; pct < 87 -> 75; else -> 100 }
            promise.resolve(step)
        } catch (_: Exception) { promise.resolve(50) }
    }

    @ReactMethod
    fun setBrightness(level: Int, promise: Promise) {
        bgHandler.post {
            if (level == -1) {
                su("settings put system screen_brightness_mode 1")
            } else {
                val raw = BRIGHT_MAP[level] ?: (level * 255 / 100)
                su("settings put system screen_brightness_mode 0")
                su("settings put system screen_brightness $raw")
            }
            promise.resolve(null)
        }
    }

    // ── GPS ────────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getGps(promise: Promise) {
        try {
            val mode = Settings.Secure.getInt(ctx.contentResolver,
                Settings.Secure.LOCATION_MODE, Settings.Secure.LOCATION_MODE_OFF)
            promise.resolve(mode != Settings.Secure.LOCATION_MODE_OFF)
        } catch (_: Exception) { promise.resolve(false) }
    }

    @ReactMethod
    fun setGps(on: Boolean, promise: Promise) {
        bgHandler.post {
            if (on) {
                su("settings put secure location_mode 3")  // HIGH_ACCURACY = 3
                su("settings put secure location_providers_allowed +gps,+network")
            } else {
                su("settings put secure location_mode 0")  // OFF = 0
                su("settings put secure location_providers_allowed \"\"")
            }
            promise.resolve(null)
        }
    }

    // ── System bars ────────────────────────────────────────────────────────────

    @ReactMethod
    fun setSystemBars(hideStatus: Boolean, hideNav: Boolean, promise: Promise) {
        bgHandler.post {
            val policy = when {
                hideStatus && hideNav -> "immersive.full=*"
                hideStatus            -> "immersive.status=*"
                hideNav               -> "immersive.navigation=*"
                else                  -> "null"
            }
            su("settings put global policy_control $policy")
            promise.resolve(null)
        }
    }

    // ── All states at once ─────────────────────────────────────────────────────

    @ReactMethod
    fun getAll(promise: Promise) {
        bgHandler.post {
            try {
                val airplane = try {
                    Settings.Global.getInt(ctx.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1
                } catch (_: Exception) { false }

                val bt = try {
                    val bm = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
                    bm?.adapter?.isEnabled == true
                } catch (_: Exception) { false }

                val brightness = try {
                    val mode = Settings.System.getInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, 0)
                    if (mode == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC) -1 else {
                        val raw = Settings.System.getInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128)
                        val pct = (raw * 100f / 255f).toInt()
                        when { pct < 12 -> 0; pct < 37 -> 25; pct < 62 -> 50; pct < 87 -> 75; else -> 100 }
                    }
                } catch (_: Exception) { 50 }

                val gps = try {
                    Settings.Secure.getInt(ctx.contentResolver,
                        Settings.Secure.LOCATION_MODE, Settings.Secure.LOCATION_MODE_OFF) != Settings.Secure.LOCATION_MODE_OFF
                } catch (_: Exception) { false }

                val result = Arguments.createMap()
                result.putBoolean("airplane",  airplane)
                result.putBoolean("bluetooth", bt)
                result.putInt("brightness",    brightness)
                result.putBoolean("gps",       gps)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message, e)
            }
        }
    }
}
