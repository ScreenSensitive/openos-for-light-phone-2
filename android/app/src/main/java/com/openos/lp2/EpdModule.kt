package com.openos.lp2

import android.os.Handler
import android.os.HandlerThread
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class EpdModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "EpdModule"

    private val BASE = "/sys/devices/virtual/graphics/fb0/"
    private val worker = HandlerThread("epd-worker").also { it.start() }
    private val handler = Handler(worker.looper)
    private var lastPartialMs = 0L

    // Files confirmed present on LP2:
    //   os_mode, wf_mode, Bflash, partial_update_en, partial_update_x/y/w/l
    // Files NOT present (do not write):
    //   full_update_en, partial_wf_mode

    // os_mode=0 + wf_mode=2 (DU) only — set once, never change.
    // eink_fix daemon already caps any GC16/GL16 to DU.
    // Kernel auto-fires EPD on every framebuffer change in os_mode=0.
    @ReactMethod fun init(promise: Promise) {
        handler.post {
            su("am force-stop com.lightos")
            write("os_mode",           "0")
            write("partial_update_en", "0")
            write("wf_mode",           "2")
            promise.resolve(null)
        }
    }

    @ReactMethod fun fullUpdate(mode: Int, flashCount: Int, promise: Promise) {
        // No-op: os_mode=0 + kernel auto-refresh handles all updates
        promise.resolve(null)
    }

    @ReactMethod fun partialUpdate(x: Int, y: Int, w: Int, h: Int, mode: Int, promise: Promise) {
        // No-op: os_mode=0 + kernel auto-refresh handles all updates
        promise.resolve(null)
    }

    @ReactMethod fun setWaveformMode(mode: Int, promise: Promise) {
        handler.post {
            write("wf_mode", mode.toString())
            promise.resolve(null)
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private fun write(file: String, value: String) {
        try {
            java.io.FileOutputStream(BASE + file).use { it.write(value.toByteArray()) }
        } catch (_: Exception) {
            su("echo $value > $BASE$file")
        }
    }

    private fun su(cmd: String) {
        try { Runtime.getRuntime().exec(arrayOf("su", "-c", cmd)).waitFor() } catch (_: Exception) {}
    }
}
