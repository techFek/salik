package com.salik.tv

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject

/**
 * Companion mode (experimental): filters video playing in other apps (Apple TV, OSN+, Netflix, Nuvio…)
 * through Android's media sessions. The app reports its position; Salik seeks over skipped scenes, mutes
 * the device sound and covers the screen (a dark panel: other apps' pictures cannot be blurred).
 *
 * Which title is playing: the user picks it once in the catalog (most apps send no title); the choice is
 * remembered per app + duration. The catalog applies the user's filter settings and sends the final list
 * of scenes here (CompanionStore), so the filtering rules stay in one place (shared/filter-core.js).
 */
class CompanionEngine(private val context: Context, private val listener: ComponentName) {

    companion object {
        private const val TAG = "Companion"
        private const val TICK_MS = 100L
        /** While nothing is being filtered, checking twice a second is enough. */
        private const val IDLE_TICK_MS = 500L
        private const val LEAD_S = 0.3
        private const val MUTE_LEAD_S = 0.1
        private const val ASK_AFTER_PLAYING_MS = 2500L

        /** Known video apps -> Salik platform key (phone and TV builds). */
        val PACKAGES = mapOf(
            "com.osn.go" to "osnplus", "com.osn.orion" to "osnplus",
            "com.netflix.mediaclient" to "netflix", "com.netflix.ninja" to "netflix",
            "com.disney.disneyplus" to "disney",
            "net.mbc.shahid" to "shahid", "net.mbc.shahidTV" to "shahid",
            "com.apple.atve.androidtv.appletv" to "appletv", "com.apple.atve.amazon.appletv" to "appletv",
            "com.amazon.avod.thirdpartyclient" to "amazon", "com.amazon.amazonvideo.livingroom" to "amazon",
            "com.parsifal.starz" to "starzplay",
            "com.stremio.one" to "stremio"
        )
        /** Never asked about (music, podcasts, YouTube, ourselves). */
        private val IGNORED = setOf(
            "com.salik.tv", "com.google.android.youtube", "com.google.android.youtube.tv", "com.google.android.apps.youtube.music",
            "com.spotify.music", "com.anghami", "com.soundcloud.android", "com.google.android.apps.podcasts", "deezer.android.app"
        )
        /** Other apps are asked about only when they play something at least this long (films, episodes). */
        private const val MIN_UNKNOWN_DURATION_MS = 20 * 60 * 1000L

        fun isEnabled(context: Context) = context.getSharedPreferences("salik_settings", Context.MODE_PRIVATE).getBoolean("companionEnabled", false)
        fun canOverlay(context: Context) = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context)
    }

    private val ui = Handler(Looper.getMainLooper())
    private val msm = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
    private val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var running = false
    private var busy = false
    private var weMuted = false
    private var cover: View? = null
    private var coverText: TextView? = null
    private var lastSkipId: String? = null
    private var lastSkipAt = 0L
    private var playingSince = 0L
    private var playingKey: String? = null
    private val asked = HashMap<String, Long>()

    private val tick = object : Runnable {
        override fun run() {
            if (!running) return
            busy = false
            runCatching { step() }.onFailure { SalikLog.w(TAG, "step failed", it) }
            ui.postDelayed(this, if (busy) TICK_MS else IDLE_TICK_MS)
        }
    }

    fun start() { if (!running) { running = true; ui.post(tick); SalikLog.d(TAG, "engine started") } }
    fun stop() { running = false; ui.removeCallbacks(tick); release() }

    private fun step() {
        if (!isEnabled(context)) { release(); return }
        val controllers = runCatching { msm.getActiveSessions(listener) }.getOrDefault(emptyList())
        val c = controllers.firstOrNull { candidate(it) && it.playbackState?.state == PlaybackState.STATE_PLAYING }
        if (c == null) { playingKey = null; release(); return }

        val key = sessionKey(c)
        if (key != playingKey) { playingKey = key; playingSince = SystemClock.elapsedRealtime(); lastSkipId = null }
        val entry = CompanionStore.get(context, key)
        if (entry == null) {
            busy = true
            release()
            if (SystemClock.elapsedRealtime() - playingSince > ASK_AFTER_PLAYING_MS) askWhatIsPlaying(c, key)
            return
        }
        if (entry.optBoolean("none")) { release(); return }
        busy = true
        apply(c, entry)
    }

    private fun candidate(c: MediaController): Boolean {
        val pkg = c.packageName
        if (pkg in IGNORED) return false
        if (pkg in PACKAGES) return true
        val dur = c.metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        return dur >= MIN_UNKNOWN_DURATION_MS || CompanionStore.hasAny(context, pkg)
    }

    private fun durationSec(c: MediaController) = ((c.metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L) / 1000L)

    private fun titleOf(c: MediaController): String =
        c.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: c.metadata?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: ""

    /** Same title in the same app = same duration (titles are rarely sent). */
    private fun sessionKey(c: MediaController): String {
        val d = durationSec(c)
        return c.packageName + "|" + (if (d > 0) d.toString() else "t:" + titleOf(c))
    }

    private fun askWhatIsPlaying(c: MediaController, key: String) {
        val now = SystemClock.elapsedRealtime()
        if ((asked[key] ?: 0L) > now - 10 * 60 * 1000L) return
        asked[key] = now
        val intent = Intent(context, HomeActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("companionKey", key)
            .putExtra("companionPackage", c.packageName)
            .putExtra("companionPlatform", PACKAGES[c.packageName] ?: "")
            .putExtra("companionDuration", durationSec(c))
            .putExtra("companionTitle", titleOf(c))
        runCatching { context.startActivity(intent) }.onFailure { SalikLog.w(TAG, "could not open the title picker", it) }
    }

    private fun livePositionSec(s: PlaybackState): Double {
        val elapsed = SystemClock.elapsedRealtime() - s.lastPositionUpdateTime
        return (s.position + elapsed * s.playbackSpeed) / 1000.0
    }

    private fun apply(c: MediaController, entry: JSONObject) {
        val s = c.playbackState ?: return
        val offset = entry.optDouble("offset", 0.0)
        val t = livePositionSec(s) + offset
        val filters = entry.optJSONArray("filters") ?: JSONArray()
        var skip: JSONObject? = null
        var mute = false
        var blur: JSONObject? = null
        for (i in 0 until filters.length()) {
            val f = filters.optJSONObject(i) ?: continue
            val start = f.optDouble("start"); val end = f.optDouble("end")
            val action = f.optString("action")
            if (!(t >= start - (if (action == "mute") MUTE_LEAD_S else LEAD_S) && t <= end)) continue
            when (action) {
                "skip" -> if (end > t && (skip == null || end > skip.optDouble("end"))) skip = f
                "mute" -> mute = true
                "blur", "partial_blur" -> if (blur == null) blur = f
            }
        }
        if (skip != null) {
            val id = skip.optString("id")
            val now = SystemClock.elapsedRealtime()
            if (id != lastSkipId || now - lastSkipAt > 3000) {
                lastSkipId = id; lastSkipAt = now
                val target = ((skip.optDouble("end") - offset) * 1000).toLong() + 300
                c.transportControls.seekTo(target)
                SalikLog.d(TAG, "skip ${skip.optString("desc")} -> ${target / 1000}s")
            }
        }
        setMuted(mute)
        setCover(blur?.optString("desc"))
    }

    private fun setMuted(on: Boolean) {
        if (on && !weMuted) {
            if (am.isStreamMute(AudioManager.STREAM_MUSIC)) return
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0)
            weMuted = true
        } else if (!on && weMuted) {
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, 0)
            weMuted = false
        }
    }

    private fun setCover(desc: String?) {
        if (desc == null) { cover?.let { runCatching { wm.removeView(it) } }; cover = null; return }
        if (!canOverlay(context)) return
        if (cover == null) {
            val text = TextView(context).apply {
                setTextColor(Color.rgb(200, 200, 200)); textSize = 20f; gravity = Gravity.CENTER
            }
            val box = FrameLayout(context).apply { setBackgroundColor(Color.BLACK); addView(text, FrameLayout.LayoutParams(-1, -1)) }
            val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
            val lp = WindowManager.LayoutParams(-1, -1, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.OPAQUE)
            runCatching { wm.addView(box, lp); cover = box; coverText = text }.onFailure { SalikLog.w(TAG, "overlay failed", it) }
        }
        coverText?.text = "🛡️ " + Lang.t(context, "سالك: تم حجب هذا المشهد", "Salik: scene hidden") + if (desc.isNotBlank()) "\n$desc" else ""
    }

    private fun release() {
        setMuted(false)
        setCover(null)
    }
}

/** Title choices made in the catalog: "package|duration" -> { libraryKey, title, offset, filters[] } or { none: true }. */
object CompanionStore {
    private fun prefs(c: Context) = c.getSharedPreferences("salik_companion", Context.MODE_PRIVATE)
    fun get(c: Context, key: String): JSONObject? = prefs(c).getString(key, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    fun put(c: Context, key: String, value: JSONObject) { prefs(c).edit().putString(key, value.toString()).apply() }
    fun hasAny(c: Context, pkg: String) = prefs(c).all.keys.any { it.startsWith("$pkg|") }
    fun clear(c: Context) { prefs(c).edit().clear().apply() }
}
