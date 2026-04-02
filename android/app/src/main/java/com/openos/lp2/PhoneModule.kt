package com.openos.lp2

import android.content.Intent
import android.net.Uri
import android.provider.CallLog
import android.provider.ContactsContract
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class PhoneModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PhoneModule"

    @ReactMethod
    fun getCallLog(promise: Promise) {
        try {
            val resolver = reactContext.contentResolver
            val projection = arrayOf(
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            )
            val cursor = resolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                "${CallLog.Calls.DATE} DESC LIMIT 50"
            )

            val result: WritableArray = Arguments.createArray()

            cursor?.use { c ->
                val nameIdx = c.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val numIdx = c.getColumnIndex(CallLog.Calls.NUMBER)
                val typeIdx = c.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx = c.getColumnIndex(CallLog.Calls.DATE)
                val durIdx = c.getColumnIndex(CallLog.Calls.DURATION)

                var count = 0
                while (c.moveToNext() && count < 50) {
                    val callType = when (c.getInt(typeIdx)) {
                        CallLog.Calls.INCOMING_TYPE -> "in"
                        CallLog.Calls.OUTGOING_TYPE -> "out"
                        CallLog.Calls.MISSED_TYPE -> "missed"
                        else -> "out"
                    }
                    val entry: WritableMap = Arguments.createMap()
                    entry.putString("name", if (nameIdx >= 0) c.getString(nameIdx) ?: "" else "")
                    entry.putString("number", if (numIdx >= 0) c.getString(numIdx) ?: "" else "")
                    entry.putString("type", callType)
                    entry.putDouble("date", if (dateIdx >= 0) c.getLong(dateIdx).toDouble() else 0.0)
                    entry.putInt("duration", if (durIdx >= 0) c.getInt(durIdx) else 0)
                    result.pushMap(entry)
                    count++
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_CALL_LOG_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getMissedCallCount(promise: Promise) {
        try {
            val cursor = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                "${CallLog.Calls.TYPE} = ${CallLog.Calls.MISSED_TYPE} AND ${CallLog.Calls.NEW} = 1",
                null, null
            )
            promise.resolve(cursor?.use { it.count } ?: 0)
        } catch (e: Exception) { promise.resolve(0) }
    }

    @ReactMethod
    fun makeCall(number: String) {
        try {
            val callIntent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number"))
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(callIntent)
        } catch (e: SecurityException) {
            try {
                val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(dialIntent)
            } catch (ex: Exception) {
                // Ignore
            }
        } catch (e: Exception) {
            try {
                val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(dialIntent)
            } catch (ex: Exception) {
                // Ignore
            }
        }
    }

    @ReactMethod
    fun getContacts(promise: Promise) {
        try {
            val resolver = reactContext.contentResolver
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            )
            val cursor = resolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                projection,
                null,
                null,
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
            )

            // Dedup by last 7 digits of number
            val seen = mutableSetOf<String>()
            val contacts = mutableListOf<WritableMap>()

            cursor?.use { c ->
                val nameIdx = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numIdx = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)

                while (c.moveToNext()) {
                    val name = if (nameIdx >= 0) c.getString(nameIdx) ?: "" else ""
                    val rawNumber = if (numIdx >= 0) c.getString(numIdx) ?: "" else ""
                    val normalized = rawNumber.replace(Regex("[^0-9]"), "")
                    val key = if (normalized.length >= 7) normalized.takeLast(7) else normalized

                    if (key.isNotEmpty() && !seen.contains(key)) {
                        seen.add(key)
                        val entry: WritableMap = Arguments.createMap()
                        entry.putString("name", name)
                        entry.putString("number", rawNumber)
                        contacts.add(entry)
                    }
                }
            }

            val result: WritableArray = Arguments.createArray()
            contacts.forEach { result.pushMap(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_CONTACTS_ERROR", e.message, e)
        }
    }
}
