package com.salik.tv

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * The library of titles + filter timings, with no accounts.
 *
 * Source order: the open library on GitHub (same file the extension reads, SalikConfig.LIBRARY_URL)
 * -> the last copy saved on the device -> the snapshot bundled in the app (assets/data/library.json).
 * So the app always works offline/first-run, and picks up new titles as soon as the library is public.
 *
 * Network methods are BLOCKING: call them from a background thread.
 */
class SalikBackend private constructor(private val context: Context) {

    companion object {
        private const val TAG = "SalikBackend"
        private const val LIBRARY_TTL_MS = 10 * 60 * 1000L

        @Volatile private var instance: SalikBackend? = null
        fun get(context: Context): SalikBackend =
            instance ?: synchronized(this) {
                instance ?: SalikBackend(context.applicationContext).also { instance = it }
            }
    }

    private val diskFile = File(context.filesDir, "library.json")
    private var cache: JSONObject? = null
    private var cacheRaw: String? = null
    private var fetchedAt = 0L

    /** Where the current copy came from: "online", "saved" or "bundled" (shown in Settings). */
    @Volatile var source: String = "bundled"
        private set

    /** Raw JSON for the catalog UI. [preferLocal] = open instantly from the saved/bundled copy. */
    fun libraryRaw(preferLocal: Boolean): String {
        if (preferLocal) {
            synchronized(this) { cacheRaw }?.let { return it }
            return localRaw().also { raw -> synchronized(this) { cacheRaw = raw; cache = null } }
        }
        library(force = true)
        return synchronized(this) { cacheRaw } ?: localRaw()
    }

    @Synchronized
    fun library(force: Boolean = false): JSONObject {
        val c = cache
        if (!force && c != null && System.currentTimeMillis() - fetchedAt < LIBRARY_TTL_MS) return c
        val online = runCatching { fetchOnline() }.onFailure {
            SalikLog.w(TAG, "Online library unavailable (${it.message}); using ${if (diskFile.exists()) "saved" else "bundled"} copy")
        }.getOrNull()
        if (online != null) {
            val parsed = JSONObject(online)
            cache = parsed; cacheRaw = online; fetchedAt = System.currentTimeMillis(); source = "online"
            runCatching { diskFile.writeText(online) }
            return parsed
        }
        if (c != null) { fetchedAt = System.currentTimeMillis() - LIBRARY_TTL_MS + 60_000; return c }
        val raw = cacheRaw ?: localRaw()
        return JSONObject(raw).also { cache = it; cacheRaw = raw; fetchedAt = System.currentTimeMillis() - LIBRARY_TTL_MS + 60_000 }
    }

    /** Saved copy, unless the app was installed/updated after it was saved (then the bundled copy is newer). */
    private fun localRaw(): String {
        val appUpdatedAt = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime }.getOrDefault(0L)
        if (diskFile.exists() && diskFile.lastModified() >= appUpdatedAt) {
            val saved = runCatching { diskFile.readText() }.getOrNull()
            if (saved != null && LibraryValidator.validate(saved).isEmpty()) { source = "saved"; return saved }
            SalikLog.w(TAG, "Saved library is invalid; using the bundled copy")
        }
        source = "bundled"
        return context.assets.open("data/library.json").bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    private fun fetchOnline(): String {
        val conn = URL(SalikConfig.LIBRARY_URL).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            val code = conn.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            val bytes = conn.inputStream.use { it.readBytes() }
            val body = String(bytes, Charsets.UTF_8)
            if (!body.trimStart().startsWith("{")) throw IllegalStateException("not a library")
            checkPublishedDigest(bytes)
            val errors = LibraryValidator.validate(body)
            if (errors.isNotEmpty()) {
                SalikLog.w(TAG, "Online library rejected (${errors.size} problems): ${errors.take(5)}")
                throw IllegalStateException("invalid library")
            }
            return body
        } finally {
            conn.disconnect()
        }
    }

    /**
     * If library.json.sha256 is published next to the library, the download must match it.
     * No digest file (HTTP 404) = nothing to check; any other failure to read it rejects the download.
     */
    private fun checkPublishedDigest(bytes: ByteArray) {
        val conn = URL(SalikConfig.LIBRARY_SHA256_URL).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            val code = conn.responseCode
            if (code == 404) return
            if (code !in 200..299) throw IllegalStateException("digest HTTP $code")
            val text = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val expected = LibraryValidator.parseSha256File(text) ?: throw IllegalStateException("digest file unreadable")
            val actual = LibraryValidator.sha256Hex(bytes)
            if (expected != actual) {
                SalikLog.w(TAG, "Online library rejected: SHA-256 $actual != published $expected")
                throw IllegalStateException("digest mismatch")
            }
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Same response shape Background.js sends to isolated.script.js (FETCH_FILTERS_BACKGROUND).
     * [platform] = the platform that is playing; the id is matched only against that platform's entry.
     * [episode] (when the page shows it) and [pageUrl] pick between items that share the same id.
     */
    fun fetchFilters(movieIdRaw: String, platform: String? = null, episode: Int? = null, pageUrl: String? = null): JSONObject {
        val movieId = LibraryMatcher.normalizeId(movieIdRaw)
        val lib = try { library() } catch (e: Exception) {
            return JSONObject().put("success", false).put("error", e.message ?: "FETCH_FAILED")
        }
        val item = LibraryMatcher.findItem(lib, movieId, platform, episode, pageUrl)
            ?: return JSONObject().put("success", false).put("error", "Not Found")
        SalikLog.d(TAG, "Found item for $platform:$movieId (episode=$episode): ${item.optString("title")}")
        return JSONObject().put("success", true).put("data", normalizePlatformKeys(item))
    }

    /** The engine looks platforms up by lowercase name (offset_seconds etc.); guard against "Netflix". */
    private fun normalizePlatformKeys(item: JSONObject): JSONObject {
        val platforms = item.optJSONObject("platforms") ?: return item
        val fixed = JSONObject()
        val keys = platforms.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            val lower = k.lowercase()
            if (!fixed.has(lower) || k == lower) fixed.put(lower, platforms.get(k))
        }
        return item.put("platforms", fixed)
    }
}
