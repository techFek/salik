package com.salik.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.concurrent.Executors

/**
 * The Salik catalog (home / browse / title details / account), built as local web pages in
 * assets/ui and served from https://appassets.androidplatform.net (a secure origin, so fetch and
 * ES modules work). Native features are reached through the "SalikApp" bridge and /data/ URLs.
 */
class HomeActivity : Activity() {

    companion object {
        private const val TAG = "SalikHome"
        private const val ORIGIN = "https://appassets.androidplatform.net"
        const val UI_URL = "$ORIGIN/assets/ui/index.html"
    }

    private lateinit var webView: WebView
    private lateinit var backend: SalikBackend
    private val io = Executors.newCachedThreadPool()
    private val settings by lazy { getSharedPreferences("salik_settings", MODE_PRIVATE) }
    private val extStorage by lazy { getSharedPreferences("salik_ext_storage", MODE_PRIVATE) }

    /** Set when companion mode opened the catalog to ask which title is playing in another app. */
    @Volatile private var companionAsk: JSONObject? = null

    private fun readCompanionAsk(intent: Intent?) {
        val key = intent?.getStringExtra("companionKey") ?: return
        companionAsk = JSONObject()
            .put("key", key)
            .put("package", intent.getStringExtra("companionPackage") ?: "")
            .put("platform", intent.getStringExtra("companionPlatform") ?: "")
            .put("duration", intent.getLongExtra("companionDuration", 0L))
            .put("title", intent.getStringExtra("companionTitle") ?: "")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readCompanionAsk(intent)
        val ask = companionAsk ?: return
        if (::webView.isInitialized) webView.evaluateJavascript("window.salikCompanionAsk && window.salikCompanionAsk(${ask})", null)
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SalikLog.init(this)
        backend = SalikBackend.get(this)
        readCompanionAsk(intent)
        WebView.setWebContentsDebuggingEnabled((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/data/", DataHandler())
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#EEF4F2"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            isFocusable = true
            isFocusableInTouchMode = true
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.toString().startsWith(ORIGIN)) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                SalikLog.d(TAG, "JS: ${msg.message()} @${msg.lineNumber()}")
                return true
            }
        }
        webView.addJavascriptInterface(Bridge(), "SalikApp")
        setContentView(webView)
        webView.loadUrl(UI_URL)
        webView.requestFocus()
    }

    /** /data/library.json and /data/account.json for the UI (run on a background thread by WebView). */
    private inner class DataHandler : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val body: String = try {
                when (path.substringBefore('?')) {
                    "library.json" -> backend.libraryRaw(preferLocal = true)
                    "library-fresh.json" -> backend.libraryRaw(preferLocal = false)
                    "app.json" -> appJson().toString()
                    else -> return null
                }
            } catch (e: Exception) {
                SalikLog.w(TAG, "/data/$path failed: ${e.message}")
                JSONObject().put("__error", e.message ?: "FETCH_FAILED").toString()
            }
            return WebResourceResponse("application/json", "utf-8", ByteArrayInputStream(body.toByteArray()))
                .apply { responseHeaders = mapOf("Cache-Control" to "no-store") }
        }
    }

    private fun appJson(): JSONObject = JSONObject()
        .put("engineEnabled", settings.getBoolean("engineEnabled", true))
        .put("appVersion", packageManager.getPackageInfo(packageName, 0).versionName)
        .put("librarySource", backend.source)
        .put("youtubeTv", settings.getBoolean("youtubeTv", false))
        .put("stremioServer", settings.getString("stremioServer", "") ?: "")
        .put("hideFemale", settings.getBoolean("hideFemale", false))
        .put("hideMale", settings.getBoolean("hideMale", false))
        .put("stremioOrigin", SalikConfig.stremioServerOrigin(this) ?: "")
        .put("stremioStreaming", SalikConfig.stremioStreamingUrl(this) ?: "")
        .put("companionEnabled", CompanionEngine.isEnabled(this))
        .put("companionAccess", companionAccess())
        .put("companionOverlay", CompanionEngine.canOverlay(this))
        .put("companionAsk", companionAsk ?: JSONObject.NULL)

    private fun companionAccess(): Boolean {
        val me = android.content.ComponentName(this, MediaListener::class.java)
        val enabled = android.provider.Settings.Secure.getString(contentResolver, "enabled_notification_listeners").orEmpty()
        return enabled.split(":").any { it.equals(me.flattenToString(), true) || it.equals(me.flattenToShortString(), true) }
    }

    private fun readValue(area: String, key: String): Any? =
        extStorage.getString("$area::$key", null)?.let { runCatching { JSONArray(it).get(0) }.getOrNull() }

    inner class Bridge {
        @JavascriptInterface
        fun storageGet(area: String, keysJson: String): String {
            val out = JSONObject()
            val keys = runCatching { JSONArray(keysJson) }.getOrNull()
            if (keys == null) {
                extStorage.all.keys.filter { it.startsWith("$area::") }.forEach { k ->
                    val key = k.removePrefix("$area::")
                    readValue(area, key)?.let { out.put(key, it) }
                }
            } else {
                for (i in 0 until keys.length()) {
                    val k = keys.optString(i)
                    readValue(area, k)?.let { out.put(k, it) }
                }
            }
            return out.toString()
        }

        @JavascriptInterface
        fun storageSet(area: String, itemsJson: String) {
            val items = runCatching { JSONObject(itemsJson) }.getOrNull() ?: return
            val edit = extStorage.edit()
            items.keys().forEach { k -> edit.putString("$area::$k", JSONArray().put(items.get(k)).toString()) }
            edit.apply()
        }

        @JavascriptInterface
        fun storageRemove(area: String, keysJson: String) {
            val keys = runCatching { JSONArray(keysJson) }.getOrNull() ?: return
            val edit = extStorage.edit()
            for (i in 0 until keys.length()) edit.remove("$area::${keys.optString(i)}")
            edit.apply()
        }

        /** Opens a title (or a platform's home page) in the filtering player. */
        @JavascriptInterface
        fun openUrl(url: String, label: String) {
            if (!url.startsWith("https://") && !url.startsWith("http://")) return
            SalikLog.d(TAG, "Open $label -> $url")
            runOnUiThread {
                startActivity(Intent(this@HomeActivity, MainActivity::class.java).putExtra(MainActivity.EXTRA_URL, url))
            }
        }

        /** GitHub pages (reports, suggestions, source): the phone's browser, or inside Salik when there is none. */
        @JavascriptInterface
        fun openExternal(url: String) {
            if (!url.startsWith("https://")) return
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (e: android.content.ActivityNotFoundException) {
                    startActivity(Intent(this@HomeActivity, MainActivity::class.java).putExtra(MainActivity.EXTRA_URL, url))
                }
            }
        }

        @JavascriptInterface
        fun setEngineEnabled(enabled: Boolean) {
            settings.edit().putBoolean("engineEnabled", enabled).apply()
        }

        /** YouTube opens as YouTube for TV (sign-in with a code). */
        @JavascriptInterface
        fun setYoutubeTv(enabled: Boolean) {
            settings.edit().putBoolean("youtubeTv", enabled).apply()
        }

        /** Experimental gender blur toggles (YouTube & Dailymotion only). */
        @JavascriptInterface
        fun setGenderBlur(female: Boolean, male: Boolean) {
            settings.edit().putBoolean("hideFemale", female).putBoolean("hideMale", male).apply()
        }

        /** Address of the user's own Stremio server ("192.168.1.10:8080"), "" to clear. */
        @JavascriptInterface
        fun setStremioServer(address: String) {
            settings.edit().putString("stremioServer", address.trim().take(200)).apply()
        }

        /** Companion mode (experimental): filter video playing in other apps. */
        @JavascriptInterface
        fun setCompanionEnabled(enabled: Boolean) {
            settings.edit().putBoolean("companionEnabled", enabled).apply()
        }

        @JavascriptInterface
        fun openCompanionAccess() = runOnUiThread {
            runCatching { startActivity(Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
                .onFailure { android.widget.Toast.makeText(this@HomeActivity, Lang.t(this@HomeActivity, "هذا الجهاز لا يعرض الإعداد؛ راجع دليل وضع المرافق", "This device hides the setting; see the companion guide"), android.widget.Toast.LENGTH_LONG).show() }
        }

        @JavascriptInterface
        fun openOverlaySettings() = runOnUiThread {
            val i = Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:$packageName"))
            runCatching { startActivity(i) }.onFailure { runCatching { startActivity(Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION)) } }
        }

        /** The title the user picked for the app that is playing: filters already chosen by the catalog (settings applied). */
        @JavascriptInterface
        fun companionChoose(json: String) {
            val o = runCatching { JSONObject(json) }.getOrNull() ?: return
            val key = o.optString("key").takeIf { it.isNotEmpty() } ?: return
            o.remove("key")
            CompanionStore.put(this@HomeActivity, key, o)
            companionAsk = null
            SalikLog.d(TAG, "companion: $key -> ${o.optString("libraryKey").ifEmpty { "none" }} (${o.optJSONArray("filters")?.length() ?: 0} scenes)")
            runOnUiThread { moveTaskToBack(true) }
        }

        @JavascriptInterface
        fun companionForget() { CompanionStore.clear(this@HomeActivity) }

        @JavascriptInterface
        fun shareLog() = runOnUiThread { shareDiagnosticLog(this@HomeActivity) }

        @JavascriptInterface
        fun exitApp() = runOnUiThread { finish() }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && ::webView.isInitialized) {
            webView.evaluateJavascript("window.salikBack ? window.salikBack() : false") { handled ->
                if (handled != "true") finish()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.evaluateJavascript("window.salikResume && window.salikResume()", null)
    }

    override fun onDestroy() {
        io.shutdownNow()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}

/** Shares the persisted diagnostic log as a file (used by the catalog and the player). */
fun shareDiagnosticLog(context: Context) {
    val text = buildString {
        append("Salik diagnostic log\nlibrary=").append(SalikBackend.get(context).source).append("\n----\n")
        append(SalikLog.dump())
        val prev = SalikLog.previousSession()
        if (prev.isNotEmpty()) append("\n\n==== PREVIOUS SESSION ====\n").append(prev.takeLast(150_000))
    }
    val dir = java.io.File(context.cacheDir, "logs").apply { mkdirs() }
    val file = java.io.File(dir, "salik-log.txt").apply { writeText(text) }
    val uri = androidx.core.content.FileProvider.getUriForFile(context, "com.salik.tv.files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, Lang.t(context, "إرسال السجل عبر", "Send the log via")))
}
