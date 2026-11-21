package com.salik.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Experimental "hide women / hide men" (YouTube & Dailymotion only: their video is not DRM-protected,
 * so the page can read its frames). A tiny hidden WebView runs open-source face + gender models
 * (assets/detector: Human library, BlazeFace, FaceRes). The player page sends small JPEG frames over
 * the native bridge; we answer with the faces found. One frame at a time; extra frames are dropped.
 */
class GenderDetector(private val activity: Activity, private val parent: ViewGroup, private val faces: Boolean = true, private val nsfw: Boolean = false) {

    companion object {
        private const val TAG = "SalikGender"
        private const val URL = "https://appassets.androidplatform.net/assets/detector/index.html"
    }

    private val ui = Handler(Looper.getMainLooper())
    private var webView: WebView? = null
    private var ready = false
    private var failed = false
    private var nextId = 1
    private val pending = HashMap<String, (JSONObject) -> Unit>()

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun ensure() {
        if (webView != null) return
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(activity)).build()
        webView = WebView(activity).apply {
            settings.javaScriptEnabled = true
            setBackgroundColor(Color.TRANSPARENT)
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                    SalikLog.e(TAG, "Detector renderer gone (didCrash=${detail.didCrash()})")
                    this@GenderDetector.parent.removeView(view)
                    view.destroy()
                    if (webView === view) { webView = null; ready = false }
                    pending.values.toList().forEach { it(JSONObject().put("error", "renderer gone")) }
                    pending.clear()
                    return true
                }
            }
            addJavascriptInterface(Host(), "SalikDetector")
            alpha = 0f
        }
        parent.addView(webView, FrameLayout.LayoutParams(2, 2))
        webView!!.loadUrl("$URL?faces=${if (faces) 1 else 0}&nsfw=${if (nsfw) 1 else 0}")
        SalikLog.d(TAG, "Loading detector")
    }

    fun detect(dataUrl: String, done: (JSONObject) -> Unit) {
        ensure()
        if (failed) { done(JSONObject().put("error", "detector failed to load")); return }
        if (!ready || pending.isNotEmpty() || !dataUrl.startsWith("data:image/")) {
            done(JSONObject().put("busy", true)); return
        }
        val id = "d${nextId++}"
        pending[id] = done
        val opts = JSONObject().put("faces", faces).put("nsfw", nsfw)
        webView?.evaluateJavascript("window.salikDetect(${JSONObject.quote(id)}, ${JSONObject.quote(dataUrl)}, $opts)", null)
        ui.postDelayed({ pending.remove(id)?.invoke(JSONObject().put("timeout", true)) }, 8000)
    }

    fun destroy() {
        webView?.let { parent.removeView(it); it.destroy() }
        webView = null
        pending.clear()
    }

    inner class Host {
        @JavascriptInterface
        fun ready(info: String) = ui.post { ready = true; SalikLog.d(TAG, "Detector ready $info") }

        @JavascriptInterface
        fun failed(message: String) = ui.post { failed = true; SalikLog.e(TAG, "Detector failed: $message") }

        @JavascriptInterface
        fun result(id: String, json: String) = ui.post {
            val r = runCatching { JSONObject(json) }.getOrElse { JSONObject().put("error", "bad result") }
            pending.remove(id)?.invoke(r)
        }
    }
}
