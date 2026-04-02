package com.openos.lp2

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  private val epdThread = HandlerThread("epd-init").also { it.start() }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Handler(epdThread.looper).post {
      // Kill LightOS so it stops overriding os_mode
      try { Runtime.getRuntime().exec(arrayOf("su", "-c", "am force-stop com.lightos")).waitFor() } catch (_: Exception) {}
      // os_mode=0: kernel auto-fires EPD on every framebuffer change.
      // eink_fix daemon (lp2_eink_fix module) caps all modes to DU so no GC16 strobing.
      epd("os_mode", "0")
      epd("partial_update_en", "0")
      epd("wf_mode", "2")
    }
  }

  override fun onResume() {
    super.onResume()
    Handler(epdThread.looper).post {
      val prefs = getSharedPreferences("lighteros", Context.MODE_PRIVATE)
      val wfMode = prefs.getInt("wf_mode", 2)
      epd("wf_mode", wfMode.toString())
    }
  }

  private fun epd(file: String, value: String) {
    val path = "/sys/devices/virtual/graphics/fb0/$file"
    try { java.io.FileOutputStream(path).use { it.write(value.toByteArray()) } }
    catch (_: Exception) {
      try { Runtime.getRuntime().exec(arrayOf("su", "-c", "echo $value > $path")).waitFor() } catch (_: Exception) {}
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "openos"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
