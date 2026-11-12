package com.salik.tv

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File

/**
 * Experimental "companion mode" probe. Shows what Android reports about the apps that are playing video
 * (Apple TV, Nuvio, Netflix…): title, live position, state, and whether they accept a seek. Two test
 * buttons check that Salik could skip (seek +10 s) and mute (3 s) inside another app. Everything is also
 * written to files/companion-probe.txt so it can be read with adb.
 */
class CompanionProbeActivity : Activity() {

    private lateinit var status: TextView
    private lateinit var sessionsBox: LinearLayout
    private val ui = Handler(Looper.getMainLooper())
    private val listener by lazy { ComponentName(this, MediaListener::class.java) }
    private val t = { ar: String, en: String -> Lang.t(this, ar, en) }
    private val ticker = object : Runnable {
        override fun run() { refresh(); ui.postDelayed(this, 500) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad); setBackgroundColor(Color.rgb(15, 17, 21)) }
        root.addView(TextView(this).apply {
            text = t("سالك: تجربة وضع المرافق", "Salik: companion mode test"); textSize = 22f; setTypeface(typeface, Typeface.BOLD); setTextColor(Color.WHITE)
        })
        root.addView(TextView(this).apply {
            text = t("شغّل فيلمًا في تطبيق آخر (Apple TV أو Nuvio…) ثم ارجع هنا.", "Play a video in another app (Apple TV, Nuvio…) and come back here.")
            setTextColor(Color.rgb(170, 176, 186)); textSize = 15f
        })
        status = TextView(this).apply { setTextColor(Color.rgb(251, 191, 36)); textSize = 15f; setPadding(0, pad / 2, 0, pad / 2) }
        root.addView(status)
        root.addView(button(t("فتح إعداد «الوصول إلى الإشعارات»", "Open “Notification access” settings")) { openAccessSettings() })
        sessionsBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(sessionsBox)
        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() { super.onResume(); ui.post(ticker) }
    override fun onPause() { ui.removeCallbacks(ticker); super.onPause() }

    private fun hasAccess(): Boolean {
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners").orEmpty()
        return enabled.split(":").any { it.equals(listener.flattenToString(), true) || it.equals(listener.flattenToShortString(), true) }
    }

    private fun openAccessSettings() {
        runCatching { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }.onFailure {
            status.text = t(
                "هذا الجهاز لا يعرض الإعداد. من الكمبيوتر:\nadb shell cmd notification allow_listener ${listener.flattenToString()}",
                "This device hides that setting. From a computer:\nadb shell cmd notification allow_listener ${listener.flattenToString()}"
            )
        }
    }

    private var lastRendered = ""

    private fun refresh() {
        if (!hasAccess()) {
            status.text = t("❌ لم يُمنح سالك «الوصول إلى الإشعارات» بعد.", "❌ Salik has no “Notification access” yet.")
            sessionsBox.removeAllViews(); lastRendered = ""
            return
        }
        val controllers = runCatching {
            (getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager).getActiveSessions(listener)
        }.getOrElse { status.text = "⚠️ ${it.message}"; return }
        status.text = if (controllers.isEmpty()) t("✅ الصلاحية تعمل. لا يوجد تطبيق يشغّل شيئًا الآن.", "✅ Access works. Nothing is playing right now.")
            else t("✅ الصلاحية تعمل. التطبيقات التي تشغّل الآن:", "✅ Access works. Apps playing now:")

        val key = controllers.joinToString { it.packageName + "|" + it.sessionToken.hashCode() }
        if (key != lastRendered) {
            lastRendered = key
            sessionsBox.removeAllViews()
            controllers.forEach { c -> sessionsBox.addView(card(c)) }
        }
        for (i in 0 until sessionsBox.childCount) {
            val v = sessionsBox.getChildAt(i)
            val c = controllers.getOrNull(i) ?: continue
            (v.findViewWithTag<TextView>("info"))?.text = describe(c)
        }
        writeLog(controllers)
    }

    private fun card(c: MediaController): View {
        val pad = (12 * resources.displayMetrics.density).toInt()
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad); setBackgroundColor(Color.rgb(28, 31, 39)) }
        box.addView(TextView(this).apply { tag = "info"; setTextColor(Color.WHITE); textSize = 15f; typeface = Typeface.MONOSPACE })
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.START }
        row.addView(button(t("تجربة التقديم +10 ث", "Test seek +10 s")) { seekBy(c, 10_000) })
        row.addView(button(t("تجربة الكتم 3 ث", "Test mute 3 s")) { muteFor(3_000) })
        box.addView(row)
        return LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, pad, 0, 0); addView(box) }
    }

    private fun livePosition(s: PlaybackState?): Long? {
        if (s == null || s.position < 0) return null
        if (s.state != PlaybackState.STATE_PLAYING) return s.position
        val elapsed = SystemClock.elapsedRealtime() - s.lastPositionUpdateTime
        return s.position + (elapsed * s.playbackSpeed).toLong()
    }

    private fun fmt(ms: Long?): String {
        if (ms == null || ms < 0) return "—"
        val s = ms / 1000
        return "%d:%02d:%02d.%d".format(s / 3600, (s / 60) % 60, s % 60, (ms % 1000) / 100)
    }

    private fun stateName(s: Int?) = when (s) {
        PlaybackState.STATE_PLAYING -> "PLAYING"; PlaybackState.STATE_PAUSED -> "PAUSED"; PlaybackState.STATE_BUFFERING -> "BUFFERING"
        PlaybackState.STATE_STOPPED -> "STOPPED"; PlaybackState.STATE_NONE -> "NONE"; null -> "—"; else -> s.toString()
    }

    private fun describe(c: MediaController): String {
        val m = c.metadata
        val s = c.playbackState
        val title = m?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: m?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: "—"
        val sub = m?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: m?.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE) ?: ""
        val dur = m?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.takeIf { it > 0 }
        val canSeek = s != null && (s.actions and PlaybackState.ACTION_SEEK_TO) != 0L
        return buildString {
            appendLine("App:      ${c.packageName}")
            appendLine("Title:    $title")
            if (sub.isNotEmpty()) appendLine("Subtitle: $sub")
            appendLine("State:    ${stateName(s?.state)}")
            appendLine("Position: ${fmt(livePosition(s))}  /  ${fmt(dur)}")
            appendLine("Updated:  ${if (s == null) "—" else "${(SystemClock.elapsedRealtime() - s.lastPositionUpdateTime) / 1000}s ago"}  speed ${s?.playbackSpeed ?: "—"}")
            append("Seek:     ${if (canSeek) "✅ supported" else "❌ not announced"}")
        }
    }

    private fun seekBy(c: MediaController, deltaMs: Long) {
        val pos = livePosition(c.playbackState) ?: return
        c.transportControls.seekTo(pos + deltaMs)
        status.text = t("أُرسل طلب التقديم إلى ${c.packageName}", "Seek sent to ${c.packageName}")
    }

    private fun muteFor(ms: Long) {
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0)
        ui.postDelayed({ am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, 0) }, ms)
        status.text = t("الصوت مكتوم 3 ثوانٍ…", "Muted for 3 s…")
    }

    private var lastLogAt = 0L
    private fun writeLog(controllers: List<MediaController>) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastLogAt < 2000) return
        lastLogAt = now
        runCatching {
            val text = "=== ${java.util.Date()} ===\n" + controllers.joinToString("\n---\n") { describe(it) } + "\n\n"
            val f = File(filesDir, "companion-probe.txt")
            if (f.length() > 200_000) f.writeText("")
            f.appendText(text)
            SalikLog.d("CompanionProbe", text)
        }
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label; isAllCaps = false; isFocusable = true; setOnClickListener { onClick() }
    }
}
