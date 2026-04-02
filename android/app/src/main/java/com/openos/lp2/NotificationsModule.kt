package com.openos.lp2

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationsModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName() = "NotificationsModule"

    @ReactMethod fun getNotifications(promise: Promise) {
        try {
            val result = Arguments.createArray()
            NotificationListener.getAll().forEach { e ->
                val m = Arguments.createMap()
                m.putString("id",    e.id)
                m.putString("title", e.title)
                m.putString("text",  e.text)
                m.putString("pkg",   e.pkg)
                m.putDouble("time",  e.time.toDouble())
                result.pushMap(m)
            }
            promise.resolve(result)
        } catch (e: Throwable) {
            promise.resolve(Arguments.createArray())
        }
    }

    @ReactMethod fun getCount(promise: Promise) {
        promise.resolve(NotificationListener.getCount())
    }

    @ReactMethod fun hasPermission(promise: Promise) {
        val enabled = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: ""
        promise.resolve(enabled.contains(ctx.packageName))
    }

    @ReactMethod fun openPermissionSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(null)
        } catch (e: Throwable) {
            promise.reject("ERR", e.message ?: "")
        }
    }
}
