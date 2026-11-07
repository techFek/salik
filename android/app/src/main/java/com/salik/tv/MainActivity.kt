package com.salik.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.webkit.UserAgentMetadata
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.util.concurrent.Executors

class MainActivity : Activity() {

    companion object {
        private const val TAG = "SalikTV"
        const val EXTRA_URL = "com.salik.tv.URL"

    }

    private val chromeFullVersion: String by lazy {
        Regex("Chrome/([\\d.]+)").find(WebSettings.getDefaultUserAgent(this))?.groupValues?.get(1) ?: "141.0.0.0"
    }
    private val chromeMajor: String get() = chromeFullVersion.substringBefore('.')

    private val desktopUa: String get() =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/$chromeMajor.0.0.0 Safari/537.36"

    private val tvUa = "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36"
    private var tvMode = false
    private var webViewDead = false

    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var backend: SalikBackend
    private var bridge: ExtensionBridge? = null
    private var genderDetector: GenderDetector? = null
    private var cursor: TvCursor? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var documentStartSupported = false
    private var spoofJs = ""
    private var diagJs = ""
    private var extensionBundle = ""
    private val io = Executors.newSingleThreadExecutor()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        SalikLog.init(this)
        backend = SalikBackend.get(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)

        root = FrameLayout(this)
        webView = WebView(this)
        root.addView(webView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        setContentView(root)
        if (TvCursor.isTv(this)) cursor = TvCursor(this, root, webView).also { it.enabled = settings.getBoolean("tvCursor", true) }

        spoofJs = assets.open("salik/spoof.js").bufferedReader().use { it.readText() }
        diagJs = assets.open("salik/diag.js").bufferedReader().use { it.readText() }
        extensionBundle = ExtensionBridge.buildBundle(this)

        configureWebView()
        installScripts()

        if (savedInstanceState != null) {
            if (savedInstanceState.getBoolean("tvMode")) setTvMode(true)
            webView.restoreState(savedInstanceState)
        } else {
            val start = intent.getStringExtra(EXTRA_URL) ?: SalikConfig.START_URL
            updateMixedContent(Uri.parse(start))
            val tv = youTubeTvUrl(start)
            if (tv != null) { setTvMode(true); webView.loadUrl(tv) } else webView.loadUrl(start)
        }
        io.execute { runCatching { backend.library() } }
    }

    /**
     * web.stremio.com (https) has to reach the streaming server on the user's PC over plain http
     * (http://192.168.1.23:11470). Allowed only on Stremio pages and only when such a server is set.
     */
    private fun updateMixedContent(u: Uri) {
        val stremio = u.host?.let { it == "stremio.com" || it.endsWith(".stremio.com") } == true
        val mode = if (stremio && SalikConfig.stremioStreamingUrl(this) != null) WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            else WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        if (webView.settings.mixedContentMode != mode) webView.settings.mixedContentMode = mode
    }

    private fun isYouTube(u: Uri) = u.host?.let { it == "youtube.com" || it.endsWith(".youtube.com") } == true

    /** The youtube.com/tv address for [url] when YouTube should open as TV (signed in that way, or already /tv). */
    private fun youTubeTvUrl(url: String): String? {
        val u = Uri.parse(url)
        if (!isYouTube(u)) return null
        if (u.path?.startsWith("/tv") == true) return url
        if (!settings.getBoolean("youtubeTv", false)) return null
        val id = u.getQueryParameter("v") ?: Regex("/shorts/([\\w-]+)").find(u.path ?: "")?.groupValues?.get(1)
        return if (id != null) "https://www.youtube.com/tv#/watch?v=$id" else "https://www.youtube.com/tv#/"
    }

    /** YouTube's Google sign-in from the desktop site (blocked in WebViews) -> switch to YouTube TV and sign in by code. */
    private fun isYouTubeGoogleSignIn(u: Uri): Boolean =
        u.host == "accounts.google.com" &&
            (u.getQueryParameter("continue")?.contains("youtube.com") == true || u.getQueryParameter("service") == "youtube")

    private fun setTvMode(on: Boolean) {
        if (tvMode == on) return
        tvMode = on
        if (on) cursor?.hide()
        webView.settings.userAgentString = if (on) tvUa else desktopUa
        applyUaMetadata()
        SalikLog.d(TAG, "YouTube TV mode = $on")
    }

    private fun switchToYouTubeTv(from: Uri) {
        SalikLog.d(TAG, "Google sign-in blocked in WebView -> YouTube TV sign-in by code ($from)")
        settings.edit().putBoolean("youtubeTv", true).apply()
        setTvMode(true)
        webView.stopLoading()
        webView.loadUrl("https://www.youtube.com/tv#/")
        Toast.makeText(this, Lang.t(this,
            "سجّل الدخول من «يوتيوب للتلفزيون»: سيظهر رمز، أدخله في youtube.com/activate من هاتفك",
            "Sign in through YouTube for TV: enter the code shown at youtube.com/activate on your phone"), Toast.LENGTH_LONG).show()
    }

    private fun applyUaMetadata() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.USER_AGENT_METADATA)) return
        val brands = listOf("Chromium", "Google Chrome").map {
            UserAgentMetadata.BrandVersion.Builder()
                .setBrand(it).setMajorVersion(chromeMajor).setFullVersion(chromeFullVersion).build()
        }
        WebSettingsCompat.setUserAgentMetadata(
            webView.settings,
            UserAgentMetadata.Builder()
                .setBrandVersionList(brands)
                .setFullVersion(chromeFullVersion)
                .setPlatform(if (tvMode) "Linux" else "Windows")
                .setPlatformVersion(if (tvMode) "" else "15.0.0")
                .setArchitecture(if (tvMode) "arm" else "x86")
                .setBitness(64)
                .setModel("")
                .setMobile(false)
                .build()
        )
    }

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString = desktopUa
            textZoom = 100
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.USER_AGENT_METADATA)) applyUaMetadata()
        else SalikLog.w(TAG, "USER_AGENT_METADATA not supported: update Android System WebView")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val scheme = request.url.scheme ?: return false
                if (scheme != "http" && scheme != "https") {
                    SalikLog.d(TAG, "Blocked non-web redirect: ${request.url}")
                    return true
                }
                if (!SalikConfig.cleartextAllowed(this@MainActivity, request.url)) {
                    SalikLog.w(TAG, "Blocked plain-http page: ${request.url.host}")
                    return true
                }
                if (request.isForMainFrame) {
                    if (isYouTubeGoogleSignIn(request.url)) { switchToYouTubeTv(request.url); return true }
                    val url = request.url.toString()
                    val tv = youTubeTvUrl(url)
                    if (tv != null && tv != url) { setTvMode(true); view.loadUrl(tv); return true }
                    if (tvMode && !isYouTube(request.url) && request.url.host != "accounts.google.com") setTvMode(false)
                }
                return false
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): android.webkit.WebResourceResponse? {
                if (SalikConfig.cleartextAllowed(this@MainActivity, request.url)) return null
                SalikLog.w(TAG, "Blocked plain-http request: ${request.url.host}")
                return android.webkit.WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), java.io.ByteArrayInputStream(ByteArray(0)))
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                SalikLog.d(TAG, "Page started: $url")
                updateMixedContent(Uri.parse(url))
                if (isYouTubeGoogleSignIn(Uri.parse(url))) { switchToYouTubeTv(Uri.parse(url)); return }
                if (!documentStartSupported) {
                    view.evaluateJavascript(spoofJs, null)
                    view.evaluateJavascript(diagJs, null)
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                SalikLog.e(TAG, "RENDERER GONE: didCrash=${detail.didCrash()} priority=${detail.rendererPriorityAtExit()} " +
                    "(didCrash=false means Android killed it for memory)")
                logMemory("at renderer death")
                if (view !== webView) return true
                webViewDead = true
                Toast.makeText(this@MainActivity, Lang.t(this@MainActivity, "توقفت الصفحة، تجري إعادة تحميلها…", "The page stopped, reloading…"), Toast.LENGTH_LONG).show()
                root.removeView(view)
                view.destroy()
                recreate()
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!documentStartSupported && bridge != null) view.evaluateJavascript(extensionBundle, null)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val granted = request.resources.filter { it == PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID }
                SalikLog.d(TAG, "Permission request ${request.origin}: ${request.resources.joinToString()} -> granted ${granted.joinToString()}")
                if (granted.isNotEmpty()) request.grant(granted.toTypedArray()) else request.deny()
            }

            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                SalikLog.d(TAG, "JS: ${msg.message()}")
                return true
            }

            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (customView != null) { callback.onCustomViewHidden(); return }
                customView = view
                cursor?.hide()
                customViewCallback = callback
                root.addView(view, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
                webView.visibility = View.GONE
            }

            override fun onHideCustomView() = exitFullscreen()
        }
    }

    private val settings by lazy { getSharedPreferences("salik_settings", MODE_PRIVATE) }
    private val engineEnabled get() = settings.getBoolean("engineEnabled", true)

    private fun logEnvironment() {
        val wv = WebViewCompat.getCurrentWebViewPackage(this)
        SalikLog.d(TAG, "App ${packageManager.getPackageInfo(packageName, 0).versionName} | " +
            "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL} | Android ${android.os.Build.VERSION.RELEASE} " +
            "(API ${android.os.Build.VERSION.SDK_INT}) | WebView ${wv?.packageName} ${wv?.versionName} | engine=$engineEnabled")
    }

    private fun installScripts() {
        logEnvironment()
        documentStartSupported = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (documentStartSupported) {
            WebViewCompat.addDocumentStartJavaScript(webView, diagJs, setOf("*"))
        }
        if (!engineEnabled) {
            SalikLog.w(TAG, "Filtering engine DISABLED by user (diagnostic mode)")
            Toast.makeText(this, Lang.t(this, "وضع الاختبار: الفلترة متوقفة", "Test mode: filtering is off"), Toast.LENGTH_SHORT).show()
            if (documentStartSupported) WebViewCompat.addDocumentStartJavaScript(webView, spoofJs, setOf("*"))
            return
        }
        if (ExtensionBridge.isSupported()) {
            bridge = ExtensionBridge(this, backend).also { it.attach(webView) }
        } else {
            SalikLog.e(TAG, "WEB_MESSAGE_LISTENER not supported: filtering disabled")
            Toast.makeText(this, Lang.t(this, "حدّث Android System WebView لتعمل الفلترة", "Update Android System WebView to enable filtering"), Toast.LENGTH_LONG).show()
        }

        if (documentStartSupported) {
            WebViewCompat.addDocumentStartJavaScript(webView, spoofJs, setOf("*"))
            if (bridge != null) {
                SalikConfig.stremioStreamingUrl(this)?.let { url ->
                    val q = org.json.JSONObject.quote(url)
                    val js = """(function(){var U=$q;try{var p=JSON.parse(localStorage.getItem("profile")||"null");
                        if(p&&p.settings&&p.settings.streamingServerUrl!==U){p.settings.streamingServerUrl=U;localStorage.setItem("profile",JSON.stringify(p));}
                        var s=JSON.parse(localStorage.getItem("streaming_server_urls")||"null");
                        if(s&&s.items&&!s.items[U]){s.items[U]=new Date().toISOString();localStorage.setItem("streaming_server_urls",JSON.stringify(s));}
                        }catch(e){}})();"""
                    WebViewCompat.addDocumentStartJavaScript(webView, js, setOf("https://web.stremio.com"))
                    SalikLog.d(TAG, "Stremio streaming server: $url")
                }
                SalikConfig.stremioServerOrigin(this)?.let { origin ->
                    WebViewCompat.addDocumentStartJavaScript(webView, "window.__SALIK_STREMIO_ORIGIN=${org.json.JSONObject.quote(origin)};", setOf(origin))
                    SalikLog.d(TAG, "Stremio server: $origin")
                }
                WebViewCompat.addDocumentStartJavaScript(webView, extensionBundle, SalikConfig.engineOrigins(this))
                installGenderBlur()
            }
        } else {
            SalikLog.w(TAG, "DOCUMENT_START_SCRIPT not supported: falling back to onPageStarted/onPageFinished")
        }
    }

    /** Experimental "hide women / hide men": YouTube, Dailymotion & Stremio only (their video can be read; DRM video can't). */
    private fun installGenderBlur() {
        val female = settings.getBoolean("hideFemale", false)
        val male = settings.getBoolean("hideMale", false)
        if (!female && !male) return
        val b = bridge ?: return
        genderDetector = GenderDetector(this, root).also { b.genderDetector = it }
        val cfg = org.json.JSONObject().put("female", female).put("male", male).put("ar", !Lang.isEnglish(this))
        val js = "window.__SALIK_GENDER=$cfg;\n" + assets.open("salik/genderblur.js").bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(webView, js, SalikConfig.GENDER_BLUR_ORIGINS + listOfNotNull(SalikConfig.stremioServerOrigin(this)?.takeIf { it.startsWith("https://") }))
        SalikLog.d(TAG, "Experimental gender blur on: female=$female male=$male")
    }

    private fun exitFullscreen() {
        customView?.let { root.removeView(it) }
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        webView.visibility = View.VISIBLE
    }

    private fun showMenu() {
        val t = { ar: String, en: String -> Lang.t(this, ar, en) }
        val c = cursor
        val items = listOfNotNull(
            t("العودة إلى الرئيسية", "Back to home"),
            t("إرسال سجل التشخيص", "Send diagnostic log"),
            if (engineEnabled) t("إيقاف محرك الفلترة مؤقتًا", "Turn off the filtering engine") else t("تشغيل محرك الفلترة", "Turn on the filtering engine"),
            t("إغلاق التطبيق", "Exit app"),
            c?.let { if (it.enabled) t("إخفاء مؤشر الماوس", "Hide the mouse pointer") else t("إظهار مؤشر الماوس", "Show the mouse pointer") }
        ).toTypedArray<CharSequence>()
        AlertDialog.Builder(this)
            .setTitle("Salik")
            .setItems(items) { _, which ->
                when (which) {
                    0 -> finish()
                    1 -> shareDiagnosticLog(this)
                    2 -> {
                        settings.edit().putBoolean("engineEnabled", !engineEnabled).commit()
                        recreate()
                    }
                    3 -> finishAffinity()
                    4 -> if (c != null) {
                        c.enabled = !c.enabled
                        settings.edit().putBoolean("tvCursor", c.enabled).apply()
                    }
                }
            }
            .setNegativeButton(t("رجوع", "Back"), null)
            .show()
    }

    /** TV remote: arrows/OK drive the mouse pointer on websites (not in fullscreen video or YouTube TV, which use the D-pad). */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val c = cursor
        if (c != null && customView == null && !tvMode && c.handle(event)) return true
        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_BACK -> when {
                customView != null -> { exitFullscreen(); return true }
                webView.canGoBack() -> { webView.goBack(); return true }
                else -> { finish(); return true }
            }
            KeyEvent.KEYCODE_MENU -> { showMenu(); return true }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized && !webViewDead) webView.saveState(outState)
        outState.putBoolean("tvMode", tvMode)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized && !webViewDead) webView.onResume()
    }

    override fun onPause() {
        if (::webView.isInitialized && !webViewDead) webView.onPause()
        super.onPause()
    }

    private val memHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val memTick = object : Runnable {
        override fun run() { logMemory("periodic"); memHandler.postDelayed(this, 20_000) }
    }

    private fun logMemory(label: String) {
        val am = getSystemService(ACTIVITY_SERVICE) as android.app.ActivityManager
        val mi = android.app.ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val rt = Runtime.getRuntime()
        SalikLog.d(TAG, "MEM $label: deviceAvail=${mi.availMem / 1048576}MB/${mi.totalMem / 1048576}MB " +
            "low=${mi.lowMemory} appHeap=${(rt.totalMemory() - rt.freeMemory()) / 1048576}MB")
    }

    override fun onStart() { super.onStart(); memHandler.post(memTick) }
    override fun onStop() { memHandler.removeCallbacks(memTick); super.onStop() }

    override fun onDestroy() {
        genderDetector?.destroy()
        io.shutdownNow()
        if (::webView.isInitialized && !webViewDead) webView.destroy()
        super.onDestroy()
    }
}
