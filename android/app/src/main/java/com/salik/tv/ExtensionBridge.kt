package com.salik.tv

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Native side of chrome-shim.js. Receives chrome.runtime / chrome.storage calls from the extension
 * scripts running in every platform frame and answers them, playing the role of Background.js.
 */
class ExtensionBridge(
    context: Context,
    private val backend: SalikBackend
) : WebViewCompat.WebMessageListener {

    companion object {
        private const val TAG = "SalikBridge"
        const val JS_OBJECT_NAME = "SalikNative"

        /** Builds the script injected at document start: chrome shim + the extension content scripts. */
        fun buildBundle(context: Context): String {
            fun asset(path: String) = context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
            val shim = asset("salik/chrome-shim.js")
            val disabled = context.getSharedPreferences("salik_settings", Context.MODE_PRIVATE)
                .getString("disabledScripts", "").orEmpty().split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
            if (disabled.isNotEmpty()) SalikLog.w(TAG, "Disabled scripts: $disabled")
            val isolated = SalikConfig.ISOLATED_SCRIPTS.filter { it !in disabled }.joinToString("\n;\n") { asset(it) }
            val main = SalikConfig.MAIN_SCRIPTS.filter { it !in disabled }.joinToString("\n;\n") { asset(it) }
            return buildString {
                append("(function () {\n")
                append("if (window.__salikExtLoaded) return;\n")
                append("window.__salikExtLoaded = true;\n")
                append(shim).append("\n")
                append("var __salikChrome = __salikCreateChrome();\n")
                append("if (!__salikChrome) return;\n")
                append("function __salikRun() {\n")
                append("try { (function (chrome) {\n").append(isolated)
                append("\n})(__salikChrome); } catch (e) { console.error('[Salik] isolated scripts failed', e); }\n")
                append("try { (function () {\n").append(main)
                append("\n})(); } catch (e) { console.error('[Salik] main script failed', e); }\n")
                append("console.log('[Salik] extension engine loaded on ' + location.href);\n")
                append("}\n")
                append("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __salikRun, { once: true });\n")
                append("else __salikRun();\n")
                append("})();\n")
            }
        }

        fun isSupported() = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
    }

    private val storage = context.getSharedPreferences("salik_ext_storage", Context.MODE_PRIVATE)
    private val io = Executors.newCachedThreadPool()
    private val ui = Handler(Looper.getMainLooper())
    private val frames = LinkedHashSet<JavaScriptReplyProxy>()

    /** Experimental gender detection (YouTube/Dailymotion): set by MainActivity when it is turned on. */
    var genderDetector: GenderDetector? = null

    fun attach(webView: WebView) {
        WebViewCompat.addWebMessageListener(webView, JS_OBJECT_NAME, SalikConfig.engineOrigins(webView.context), this)
    }

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy
    ) {
        if (frames.size > 50) frames.remove(frames.first())
        frames.add(replyProxy)

        val req = runCatching { JSONObject(message.data ?: return) }.getOrNull() ?: return
        val id = req.optInt("id")
        val data = req.opt("data")

        when (req.optString("kind")) {
            "gender.frame" -> {
                val gid = req.optString("id")
                val det = genderDetector
                if (det == null) replyRaw(replyProxy, gid, JSONObject().put("off", true))
                else det.detect((data as? JSONObject)?.optString("img").orEmpty()) { result -> replyRaw(replyProxy, gid, result) }
                return
            }
            "storage.get" -> reply(replyProxy, id, storageGet(data as? JSONObject ?: JSONObject()))
            "storage.set" -> {
                val d = data as? JSONObject ?: JSONObject()
                storageSet(d.optString("area", "local"), d.optJSONObject("items") ?: JSONObject())
                reply(replyProxy, id, JSONObject())
            }
            "storage.remove" -> {
                val d = data as? JSONObject ?: JSONObject()
                storageRemove(d.optString("area", "local"), d.opt("keys"))
                reply(replyProxy, id, JSONObject())
            }
            "runtime" -> {
                val msg = data as? JSONObject ?: JSONObject()
                io.execute {
                    val result = try { handleRuntime(msg) } catch (e: Exception) {
                        SalikLog.e(TAG, "runtime ${msg.optString("type")} failed", e)
                        JSONObject().put("success", false).put("error", e.message ?: "ERROR")
                    }
                    ui.post { reply(replyProxy, id, result) }
                }
            }
        }
    }

    private fun handleRuntime(msg: JSONObject): Any? {
        return when (msg.optString("type")) {
            "GET_SUBSCRIPTION_STATUS" -> JSONObject().put("success", true).put("isPremium", true).put("status", "free")
            "FETCH_FILTERS_BACKGROUND" -> {
                val movieId = msg.opt("movieId")?.toString() ?: ""
                val platform = msg.optString("platform", "").ifEmpty { null }
                val episode = ((msg.opt("episode") as? Number) ?: (msg.opt("domEpisode") as? Number))?.toInt()?.takeIf { it > 0 }
                val pageUrl = msg.optString("pageUrl", "").ifEmpty { null }
                SalikLog.d(TAG, "FETCH_FILTERS_BACKGROUND platform=$platform movieId=$movieId episode=$episode")
                backend.fetchFilters(movieId, platform, episode, pageUrl)
            }
            "FETCH_SPONSORBLOCK" -> backend.fetchSponsorBlock(msg.optString("prefix"), msg.optJSONArray("categories"))
            else -> {
                SalikLog.d(TAG, "Unhandled runtime message: ${msg.optString("type")}")
                null
            }
        }
    }

    fun broadcastRuntime(payload: JSONObject) {
        val text = JSONObject().put("event", "runtime").put("payload", payload).toString()
        ui.post { frames.toList().forEach { runCatching { it.postMessage(text) } } }
    }

    private fun replyRaw(proxy: JavaScriptReplyProxy, id: String, payload: JSONObject) {
        runCatching { proxy.postMessage(JSONObject().put("replyTo", id).put("payload", payload).toString()) }
    }

    private fun reply(proxy: JavaScriptReplyProxy, id: Int, payload: Any?) {
        val text = JSONObject().put("replyTo", id).put("payload", payload ?: JSONObject.NULL).toString()
        runCatching { proxy.postMessage(text) }.onFailure { SalikLog.w(TAG, "reply failed", it) }
    }

    private fun prefKey(area: String, key: String) = "$area::$key"

    private fun readValue(area: String, key: String): Any? =
        storage.getString(prefKey(area, key), null)?.let { runCatching { JSONArray(it).get(0) }.getOrNull() }

    private fun storageGet(d: JSONObject): JSONObject {
        val area = d.optString("area", "local")
        val keys = d.opt("keys")
        val out = JSONObject()
        when (keys) {
            null, JSONObject.NULL -> storage.all.keys.filter { it.startsWith("$area::") }.forEach { k ->
                val key = k.removePrefix("$area::")
                readValue(area, key)?.let { out.put(key, it) }
            }
            is String -> readValue(area, keys)?.let { out.put(keys, it) }
            is JSONArray -> for (i in 0 until keys.length()) {
                val k = keys.optString(i)
                readValue(area, k)?.let { out.put(k, it) }
            }
            is JSONObject -> keys.keys().forEach { k -> out.put(k, readValue(area, k) ?: keys.get(k)) }
        }
        return out
    }

    private fun storageSet(area: String, items: JSONObject) {
        val changes = JSONObject()
        val edit = storage.edit()
        items.keys().forEach { k ->
            val newValue = items.get(k)
            val change = JSONObject().put("newValue", newValue)
            readValue(area, k)?.let { change.put("oldValue", it) }
            changes.put(k, change)
            edit.putString(prefKey(area, k), JSONArray().put(newValue).toString())
        }
        edit.apply()
        broadcastStorage(area, changes)
    }

    private fun storageRemove(area: String, keys: Any?) {
        val list = when (keys) {
            is String -> listOf(keys)
            is JSONArray -> (0 until keys.length()).map { keys.optString(it) }
            else -> emptyList()
        }
        val changes = JSONObject()
        val edit = storage.edit()
        list.forEach { k ->
            readValue(area, k)?.let { changes.put(k, JSONObject().put("oldValue", it)) }
            edit.remove(prefKey(area, k))
        }
        edit.apply()
        if (changes.length() > 0) broadcastStorage(area, changes)
    }

    private fun broadcastStorage(area: String, changes: JSONObject) {
        val text = JSONObject().put("event", "storage").put("area", area).put("changes", changes).toString()
        frames.toList().forEach { runCatching { it.postMessage(text) } }
    }
}
