package com.openos.lp2

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class OpenOSPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(
            PhoneModule(reactContext),
            SmsModule(reactContext),
            MusicModule(reactContext),
            ThemeModule(reactContext),
            EpdModule(reactContext),
            AppLauncherModule(reactContext),
            QuickTogglesModule(reactContext),
            NotificationsModule(reactContext)
        )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
