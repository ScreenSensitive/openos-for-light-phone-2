package com.openos.lp2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.view.KeyEvent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfoItem

class MusicModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val mainHandler  = Handler(Looper.getMainLooper())
    private val bgThread     = android.os.HandlerThread("MusicModuleBg").also { it.start() }
    private val bgHandler    = Handler(bgThread.looper)
    private val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private var player    : MediaPlayer?         = null
    private var isPlaying : Boolean              = false

    data class QueueItem(val id: String, val title: String, val channel: String)
    private val queue = mutableListOf<QueueItem>()
    private var queueIndex = 0

    // Preloaded next-song stream URL cache
    private var preloadedId  : String? = null
    private var preloadedUrl : String? = null

    private val prefs get() = reactContext.getSharedPreferences("lighteros_music", Context.MODE_PRIVATE)

    companion object { private var newPipeInit = false }

    override fun getName() = "MusicModule"

    // ── NewPipe ────────────────────────────────────────────────────────────────

    private fun ensureNewPipe() {
        if (!newPipeInit) { NewPipe.init(NewPipeDownloader); newPipeInit = true }
    }

    private fun extractVideoId(url: String): String? = when {
        url.contains("v=")        -> url.substringAfter("v=").substringBefore("&").substringBefore("?").take(11)
        url.contains("youtu.be/") -> url.substringAfter("youtu.be/").substringBefore("?").substringBefore("&").take(11)
        url.contains("/shorts/")  -> url.substringAfter("/shorts/").substringBefore("?").substringBefore("&").take(11)
        url.contains("embed/")    -> url.substringAfter("embed/").substringBefore("?").take(11)
        else                      -> url.substringAfterLast("/").substringBefore("?").take(11)
    }?.takeIf { it.length >= 8 }

    private fun qualityIndex(sorted: List<*>): Int {
        val q    = prefs.getInt("stream_quality", 1)
        val last = (sorted.size - 1).coerceAtLeast(0)
        return when (q) { 0 -> 0; 2 -> last; else -> (sorted.size / 2).coerceIn(0, last) }
    }

    // ── Audio focus ────────────────────────────────────────────────────────────

    private val focusChangeListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> pauseInternal()
            else -> {}
        }
    }

    @Suppress("DEPRECATION")
    private fun requestFocus() = audioManager.requestAudioFocus(
        focusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN
    ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED

    @Suppress("DEPRECATION")
    private fun abandonFocus() { audioManager.abandonAudioFocus(focusChangeListener) }

    // ── Noisy receiver (headphone disconnect) ──────────────────────────────────

    private var noisyRegistered = false
    private val noisyReceiver   = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) pauseInternal()
        }
    }

    private fun registerNoisy() {
        if (!noisyRegistered) {
            reactContext.registerReceiver(noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
            noisyRegistered = true
        }
    }

    private fun unregisterNoisy() {
        if (noisyRegistered) {
            try { reactContext.unregisterReceiver(noisyReceiver) } catch (_: Throwable) {}
            noisyRegistered = false
        }
    }

    // ── MediaSession (headphone buttons) ──────────────────────────────────────

    private val mediaSession: MediaSessionCompat by lazy {
        MediaSessionCompat(reactContext, "OpenOSMusic").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay()            { resumeInternal() }
                override fun onPause()           { pauseInternal() }
                override fun onStop()            { pauseInternal() }
                override fun onSkipToNext()      { bgHandler.post { if (queueIndex < queue.size - 1) { queueIndex++; fetchAndPlayItem(queueIndex) } } }
                override fun onSkipToPrevious()  { bgHandler.post { if (queueIndex > 0) { queueIndex--; fetchAndPlayItem(queueIndex) } } }
                override fun onMediaButtonEvent(mediaButtonEvent: Intent): Boolean {
                    val key = mediaButtonEvent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    if (key?.action == KeyEvent.ACTION_DOWN) {
                        when (key.keyCode) {
                            KeyEvent.KEYCODE_VOLUME_UP -> {
                                audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                                return true
                            }
                            KeyEvent.KEYCODE_VOLUME_DOWN -> {
                                audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                                return true
                            }
                        }
                    }
                    return super.onMediaButtonEvent(mediaButtonEvent)
                }
            })
        }
    }

    private fun updateSessionState(playing: Boolean) {
        val state = if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val actions = PlaybackStateCompat.ACTION_PLAY or
                      PlaybackStateCompat.ACTION_PAUSE or
                      PlaybackStateCompat.ACTION_PLAY_PAUSE or
                      PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                      PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                      PlaybackStateCompat.ACTION_STOP
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder().setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f).setActions(actions).build()
        )
        mediaSession.isActive = playing
    }

    // ── Internal pause / resume helpers ───────────────────────────────────────

    private fun pauseInternal() {
        mainHandler.post {
            player?.takeIf { it.isPlaying }?.pause()
            isPlaying = false
            updateSessionState(false)
            emitNowPlaying()
        }
    }

    private fun resumeInternal() {
        mainHandler.post {
            if (requestFocus()) {
                player?.takeIf { !it.isPlaying }?.start()
                isPlaying = player?.isPlaying ?: false
                updateSessionState(isPlaying)
                emitNowPlaying()
            }
        }
    }

    // ── Preload next song stream URL in background ────────────────────────────

    private fun preloadNext() {
        val nextIdx  = queueIndex + 1
        val nextItem = queue.getOrNull(nextIdx) ?: return
        if (preloadedId == nextItem.id) return
        bgHandler.postDelayed({
            if (queue.getOrNull(nextIdx)?.id != nextItem.id) return@postDelayed
            try {
                ensureNewPipe()
                val ext    = ServiceList.YouTube.getStreamExtractor("https://www.youtube.com/watch?v=${nextItem.id}")
                ext.fetchPage()
                val sorted = ext.audioStreams.filter { it.isUrl }.sortedBy { it.averageBitrate }
                val url    = sorted.getOrNull(qualityIndex(sorted))?.content ?: return@postDelayed
                preloadedId  = nextItem.id
                preloadedUrl = url
            } catch (_: Throwable) {}
        }, 8_000L)
    }

    // ── Fetch stream and play (call from bgHandler thread) ────────────────────

    private fun fetchAndPlayItem(index: Int) {
        val item = queue.getOrNull(index) ?: return
        mainHandler.post { emitNowPlaying() } // Show song info immediately
        try {
            ensureNewPipe()
            val cached = if (preloadedId == item.id) preloadedUrl else null
            preloadedId = null; preloadedUrl = null
            val streamUrl: String
            if (cached != null) {
                streamUrl = cached
            } else {
                val ext    = ServiceList.YouTube.getStreamExtractor("https://www.youtube.com/watch?v=${item.id}")
                ext.fetchPage()
                val sorted = ext.audioStreams.filter { it.isUrl }.sortedBy { it.averageBitrate }
                val s      = sorted.getOrNull(qualityIndex(sorted)) ?: return
                val title   = item.title.takeIf   { it.isNotBlank() } ?: ext.name         ?: ""
                val channel = item.channel.takeIf { it.isNotBlank() } ?: ext.uploaderName ?: ""
                if (index < queue.size) queue[index] = item.copy(title = title, channel = channel)
                streamUrl = s.content
            }
            startPlayer(streamUrl, queue.getOrNull(index)?.title ?: item.title, queue.getOrNull(index)?.channel ?: item.channel)
        } catch (_: Throwable) {}
    }

    // ── Search and instantly play ──────────────────────────────────────────────

    @ReactMethod
    fun searchAndPlay(query: String, promise: Promise) {
        bgHandler.post {
            try {
                ensureNewPipe()
                val source = prefs.getInt("search_source", 0)
                val best: StreamInfoItem = run {
                    if (source == 1) {
                        // Try YT Music filter first, fall back to standard YouTube search
                        try {
                            val ext = ServiceList.YouTube.getSearchExtractor(query.trim(), listOf("music_songs"), "")
                            ext.fetchPage()
                            ext.initialPage.items.filterIsInstance<StreamInfoItem>().firstOrNull()
                        } catch (_: Throwable) { null }
                        ?: run {
                            val ext = ServiceList.YouTube.getSearchExtractor("${query.trim()} music")
                            ext.fetchPage()
                            ext.initialPage.items.filterIsInstance<StreamInfoItem>().firstOrNull()
                        }
                    } else {
                        val ext = ServiceList.YouTube.getSearchExtractor("${query.trim()} music")
                        ext.fetchPage()
                        ext.initialPage.items.filterIsInstance<StreamInfoItem>().firstOrNull()
                    }
                } ?: run { promise.reject("NOT_FOUND", "No results for: $query"); return@post }
                val videoId = extractVideoId(best.url)
                    ?: run { promise.reject("BAD_URL", "Bad URL: ${best.url}"); return@post }
                val streamExt = ServiceList.YouTube.getStreamExtractor("https://www.youtube.com/watch?v=$videoId")
                streamExt.fetchPage()
                val sorted = streamExt.audioStreams.filter { it.isUrl }.sortedBy { it.averageBitrate }
                val stream = sorted.getOrNull(qualityIndex(sorted))
                    ?: run { promise.reject("NO_STREAM", "No audio stream"); return@post }
                val title   = streamExt.name?.takeIf         { it.isNotBlank() } ?: best.name         ?: query
                val channel = streamExt.uploaderName?.takeIf { it.isNotBlank() } ?: best.uploaderName ?: ""
                queue.clear(); queue.add(QueueItem(videoId, title, channel)); queueIndex = 0
                startPlayer(stream.content, title, channel)
                val r = Arguments.createMap()
                r.putString("id", videoId); r.putString("title", title); r.putString("channel", channel)
                promise.resolve(r)
            } catch (e: Throwable) { promise.reject("SEARCH_PLAY_ERROR", e.message ?: "Unknown") }
        }
    }

    // ── Play queue from a given index ──────────────────────────────────────────

    @ReactMethod
    fun playQueue(idsArr: ReadableArray, titlesArr: ReadableArray, channelsArr: ReadableArray, startIndex: Int, promise: Promise) {
        val items = (0 until idsArr.size()).map {
            QueueItem(idsArr.getString(it) ?: "", titlesArr.getString(it) ?: "", channelsArr.getString(it) ?: "")
        }
        bgHandler.post {
            queue.clear(); queue.addAll(items)
            queueIndex = startIndex.coerceIn(0, (queue.size - 1).coerceAtLeast(0))
            promise.resolve(null)
            fetchAndPlayItem(queueIndex)
        }
    }

    // ── Prev / Next ────────────────────────────────────────────────────────────

    @ReactMethod
    fun next(promise: Promise) {
        bgHandler.post {
            if (queue.isEmpty() || queueIndex >= queue.size - 1) { promise.resolve(null); return@post }
            queueIndex++; promise.resolve(null); fetchAndPlayItem(queueIndex)
        }
    }

    @ReactMethod
    fun prev(promise: Promise) {
        bgHandler.post {
            if (queue.isEmpty() || queueIndex <= 0) { promise.resolve(null); return@post }
            queueIndex--; promise.resolve(null); fetchAndPlayItem(queueIndex)
        }
    }

    // ── Controls ───────────────────────────────────────────────────────────────

    @ReactMethod fun pause()  { pauseInternal() }
    @ReactMethod fun resume() { resumeInternal() }

    @ReactMethod fun getNowPlaying(promise: Promise) {
        val qi = queue.getOrNull(queueIndex)
        val r: WritableMap = Arguments.createMap()
        r.putString("title",  qi?.title   ?: "")
        r.putString("artist", qi?.channel ?: "")
        r.putString("id",     qi?.id      ?: "")
        r.putBoolean("isPlaying", isPlaying)
        r.putInt("queueIndex", queueIndex)
        r.putInt("queueSize",  queue.size)
        promise.resolve(r)
    }

    // ── Music settings ─────────────────────────────────────────────────────────

    @ReactMethod fun getStreamQuality(promise: Promise)             { promise.resolve(prefs.getInt("stream_quality", 1)) }
    @ReactMethod fun setStreamQuality(q: Int, promise: Promise)     { prefs.edit().putInt("stream_quality", q).apply(); promise.resolve(null) }
    @ReactMethod fun getSearchSource(promise: Promise)              { promise.resolve(prefs.getInt("search_source", 0)) }
    @ReactMethod fun setSearchSource(s: Int, promise: Promise)      { prefs.edit().putInt("search_source", s).apply(); promise.resolve(null) }
    @ReactMethod fun getConfirmUnlike(promise: Promise)             { promise.resolve(prefs.getBoolean("confirm_unlike", true)) }
    @ReactMethod fun setConfirmUnlike(v: Boolean, promise: Promise) { prefs.edit().putBoolean("confirm_unlike", v).apply(); promise.resolve(null) }

    // ── Favorites ──────────────────────────────────────────────────────────────

    private fun readFavs(): MutableList<Triple<String,String,String>> = try {
        val arr = JSONArray(prefs.getString("favorites","[]") ?: "[]")
        (0 until arr.length()).map { arr.getJSONObject(it).let { o -> Triple(o.getString("id"), o.getString("title"), o.optString("channel","")) } }.toMutableList()
    } catch (_: Throwable) { mutableListOf() }

    private fun writeFavs(list: List<Triple<String,String,String>>) {
        val arr = JSONArray()
        list.forEach { (id,t,ch) -> arr.put(JSONObject().apply { put("id",id); put("title",t); put("channel",ch) }) }
        prefs.edit().putString("favorites", arr.toString()).apply()
    }

    @ReactMethod fun getFavorites(promise: Promise) {
        bgHandler.post {
            val result = Arguments.createArray()
            readFavs().forEach { (id,t,ch) ->
                val e = Arguments.createMap(); e.putString("id",id); e.putString("title",t); e.putString("channel",ch); result.pushMap(e)
            }
            promise.resolve(result)
        }
    }

    @ReactMethod fun addFavorite(id: String, title: String, channel: String, promise: Promise) {
        bgHandler.post { val l = readFavs(); if (l.none { it.first == id }) { l.add(Triple(id,title,channel)); writeFavs(l) }; promise.resolve(null) }
    }

    @ReactMethod fun removeFavorite(id: String, promise: Promise) {
        bgHandler.post { writeFavs(readFavs().filter { it.first != id }); promise.resolve(null) }
    }

    @ReactMethod fun isFavorite(id: String, promise: Promise) {
        bgHandler.post { promise.resolve(readFavs().any { it.first == id }) }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── Internal player ────────────────────────────────────────────────────────

    private fun startPlayer(uri: String, title: String, artist: String) {
        mainHandler.post {
            try {
                if (!requestFocus()) return@post
                registerNoisy()
                player?.release()
                player = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .setUsage(AudioAttributes.USAGE_MEDIA).build()
                    )
                    setDataSource(uri)
                    setOnPreparedListener {
                        it.start()
                        this@MusicModule.isPlaying = true
                        updateSessionState(true)
                        emitNowPlaying()
                        bgHandler.post { preloadNext() }
                    }
                    setOnCompletionListener {
                        this@MusicModule.isPlaying = false
                        updateSessionState(false)
                        if (queueIndex < queue.size - 1) {
                            queueIndex++
                            bgHandler.post { fetchAndPlayItem(queueIndex) }
                        } else {
                            unregisterNoisy(); abandonFocus(); emitNowPlaying()
                        }
                    }
                    setOnErrorListener { _,_,_ ->
                        this@MusicModule.isPlaying = false; updateSessionState(false)
                        unregisterNoisy(); abandonFocus(); emitNowPlaying(); false
                    }
                    prepareAsync()
                }
            } catch (_: Throwable) { isPlaying = false }
        }
    }

    private fun emitNowPlaying() {
        val qi = queue.getOrNull(queueIndex)
        val p: WritableMap = Arguments.createMap()
        p.putString("title",    qi?.title   ?: "")
        p.putString("artist",   qi?.channel ?: "")
        p.putString("id",       qi?.id      ?: "")
        p.putBoolean("isPlaying", isPlaying)
        p.putInt("queueIndex", queueIndex)
        p.putInt("queueSize",  queue.size)
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onNowPlayingChanged", p)
    }
}
