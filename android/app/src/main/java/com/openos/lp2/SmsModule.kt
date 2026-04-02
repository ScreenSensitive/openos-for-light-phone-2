package com.openos.lp2

import android.content.ContentValues
import android.net.Uri
import android.telephony.SmsManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class SmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    @ReactMethod
    fun getThreads(promise: Promise) {
        try {
            val resolver = reactContext.contentResolver
            val uri = Uri.parse("content://mms-sms/conversations?simple=true")
            val projection = arrayOf(
                "thread_id",
                "address",
                "body",
                "date",
                "read"
            )
            val cursor = resolver.query(
                uri,
                null,
                null,
                null,
                "date DESC"
            )

            val result: WritableArray = Arguments.createArray()

            cursor?.use { c ->
                val colCount = c.columnCount
                val colNames = c.columnNames.toList()

                while (c.moveToNext()) {
                    val entry: WritableMap = Arguments.createMap()

                    val threadIdIdx = colNames.indexOf("_id").takeIf { it >= 0 }
                        ?: colNames.indexOf("thread_id").takeIf { it >= 0 }
                        ?: -1
                    val addrIdx = colNames.indexOf("address").takeIf { it >= 0 } ?: -1
                    val snippetIdx = colNames.indexOf("snippet").takeIf { it >= 0 }
                        ?: colNames.indexOf("body").takeIf { it >= 0 }
                        ?: -1
                    val dateIdx = colNames.indexOf("date").takeIf { it >= 0 } ?: -1
                    val readIdx = colNames.indexOf("read").takeIf { it >= 0 } ?: -1
                    val unreadIdx = colNames.indexOf("unread_count").takeIf { it >= 0 } ?: -1
                    val msgCountIdx = colNames.indexOf("msg_count").takeIf { it >= 0 } ?: -1

                    val threadId = if (threadIdIdx >= 0) c.getLong(threadIdIdx) else 0L
                    val address = if (addrIdx >= 0) c.getString(addrIdx) ?: "" else ""
                    val snippet = if (snippetIdx >= 0) c.getString(snippetIdx) ?: "" else ""
                    val rawDate = if (dateIdx >= 0) c.getLong(dateIdx) else 0L
                    // Normalize date to milliseconds (some ROMs return seconds for threads)
                    val date = if (rawDate > 0L && rawDate < 10_000_000_000L) rawDate * 1000L else rawDate
                    val unreadCount = when {
                        unreadIdx >= 0 -> c.getInt(unreadIdx)
                        readIdx >= 0 -> if (c.getInt(readIdx) == 0) 1 else 0
                        else -> 0
                    }

                    // Try to resolve name from contacts
                    val name = resolveContactName(address)

                    entry.putDouble("threadId", threadId.toDouble())
                    entry.putString("address", address)
                    entry.putString("name", name ?: "")
                    entry.putString("snippet", snippet)
                    entry.putInt("unreadCount", unreadCount)
                    entry.putDouble("date", date.toDouble())
                    result.pushMap(entry)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_THREADS_ERROR", e.message, e)
        }
    }

    private fun resolveContactName(address: String): String? {
        if (address.isBlank()) return null
        return try {
            val uri = Uri.withAppendedPath(
                android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(address)
            )
            val cursor = reactContext.contentResolver.query(
                uri,
                arrayOf(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null
            )
            cursor?.use { c ->
                if (c.moveToFirst()) {
                    val idx = c.getColumnIndex(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME)
                    if (idx >= 0) c.getString(idx) else null
                } else null
            }
        } catch (e: Exception) {
            null
        }
    }

    @ReactMethod
    fun getMessages(threadId: String, promise: Promise) {
        try {
            val resolver = reactContext.contentResolver
            val uri = Uri.parse("content://sms")
            val cursor = resolver.query(
                uri,
                null,
                "thread_id = ?",
                arrayOf(threadId),
                "date ASC"
            )

            val result: WritableArray = Arguments.createArray()

            cursor?.use { c ->
                val colNames = c.columnNames.toList()
                val idIdx = colNames.indexOf("_id").takeIf { it >= 0 } ?: -1
                val bodyIdx = colNames.indexOf("body").takeIf { it >= 0 } ?: -1
                val typeIdx = colNames.indexOf("type").takeIf { it >= 0 } ?: -1
                val dateIdx = colNames.indexOf("date").takeIf { it >= 0 } ?: -1

                while (c.moveToNext()) {
                    val entry: WritableMap = Arguments.createMap()
                    val id = if (idIdx >= 0) c.getLong(idIdx) else 0L
                    val body = if (bodyIdx >= 0) c.getString(bodyIdx) ?: "" else ""
                    val rawType = if (typeIdx >= 0) c.getInt(typeIdx) else 1
                    // SMS type 1 = inbox (received), 2 = sent
                    val msgType = if (rawType == 2) "sent" else "received"
                    val date = if (dateIdx >= 0) c.getLong(dateIdx) else 0L

                    entry.putDouble("id", id.toDouble())
                    entry.putString("body", body)
                    entry.putString("type", msgType)
                    entry.putDouble("date", date.toDouble())
                    result.pushMap(entry)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_MESSAGES_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getUnreadCount(promise: Promise) {
        try {
            val cursor = reactContext.contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("_id"), "read = 0", null, null
            )
            promise.resolve(cursor?.use { it.count } ?: 0)
        } catch (e: Exception) { promise.resolve(0) }
    }

    @ReactMethod
    fun sendSms(number: String, body: String, promise: Promise) {
        try {
            @Suppress("DEPRECATION")
            val smsManager: SmsManager = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                reactContext.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(body)
            smsManager.sendMultipartTextMessage(number, null, parts, null, null)

            // Save to sent box
            try {
                val values = ContentValues().apply {
                    put("address", number)
                    put("body", body)
                    put("type", 2) // sent
                    put("date", System.currentTimeMillis())
                    put("read", 1)
                }
                reactContext.contentResolver.insert(Uri.parse("content://sms/sent"), values)
            } catch (ex: Exception) {
                // Non-critical: ignore if we can't write to sent box
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SEND_SMS_ERROR", e.message, e)
        }
    }
}
