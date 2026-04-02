package com.openos.lp2

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotificationListener : NotificationListenerService() {

    companion object {
        private val lock = Any()
        private val cache = mutableListOf<NotifEntry>()

        data class NotifEntry(
            val id: String,
            val title: String,
            val text: String,
            val pkg: String,
            val time: Long,
        )

        fun getAll(): List<NotifEntry> = synchronized(lock) { cache.toList() }
        fun getCount(): Int = synchronized(lock) { cache.size }
    }

    override fun onListenerConnected() {
        synchronized(lock) {
            cache.clear()
            activeNotifications?.forEach { add(it) }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val entry = toEntry(sbn) ?: return
        synchronized(lock) {
            cache.removeAll { it.id == entry.id }
            cache.add(0, entry)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        val id = keyOf(sbn)
        synchronized(lock) { cache.removeAll { it.id == id } }
    }

    private fun add(sbn: StatusBarNotification) {
        val e = toEntry(sbn) ?: return
        cache.removeAll { it.id == e.id }
        cache.add(e)
    }

    private fun toEntry(sbn: StatusBarNotification): NotifEntry? {
        return try {
            val extras = sbn.notification.extras
            NotifEntry(
                id    = keyOf(sbn),
                title = extras.getString(Notification.EXTRA_TITLE) ?: "",
                text  = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "",
                pkg   = sbn.packageName ?: "",
                time  = sbn.postTime,
            )
        } catch (_: Throwable) { null }
    }

    private fun keyOf(sbn: StatusBarNotification) = "${sbn.id}_${sbn.packageName}"
}
