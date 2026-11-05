package com.salik.tv

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLDecoder
import java.security.MessageDigest

/**
 * Finds the library item that a playing page belongs to. Pure (org.json only) so it runs in JVM tests.
 *
 * Rules: the id is matched only against platforms[platform].id of the platform that is playing, with a
 * fallback to the id appearing as a whole segment of that same platform's url. The library key is never
 * used and no other platform's entry is looked at; without a known platform nothing is returned.
 * Same rules as SalikFilterCore.findLibraryItem (shared/filter-core.js). When several items share
 * that id (e.g. two episodes of one show), the episode number and the page url pick the right one.
 */
object LibraryMatcher {

    private val stremioIdRe = Regex("^tt\\d{7,9}(?::\\d+:\\d+)?$", RegexOption.IGNORE_CASE)
    private val stremioMovieOrSeriesRe = Regex("^tt\\d{7,9}$", RegexOption.IGNORE_CASE)
    private val NO_PLATFORM = setOf("", "general", "unknown")

    fun normalizeId(raw: String?): String = raw.orEmpty().trim().replace("%3A", ":").replace("%3a", ":")

    fun findItem(lib: JSONObject, movieIdRaw: String?, platformRaw: String? = null, episode: Int? = null, pageUrl: String? = null): JSONObject? {
        val movieId = normalizeId(movieIdRaw)
        if (movieId.isEmpty()) return null
        val platform = platformRaw?.trim()?.lowercase().orEmpty()
        if (platform in NO_PLATFORM) return null
        if (platform == "stremio") return if (stremioIdRe.matches(movieId)) findStremio(lib, movieId) else null

        val byId = candidates(lib, platform) { entry -> entry.opt("id")?.toString() == movieId }
        val found = byId.ifEmpty {
            candidates(lib, platform) { entry ->
                val url = entry.optString("url", "")
                url.isNotEmpty() && idAppearsAsWholeSegment(url, movieId)
            }
        }
        val pick = pickBest(found, platform, episode, pageUrl) ?: return null
        return JSONObject(pick.second.toString()).put("_libraryKey", pick.first)
    }

    private fun candidates(lib: JSONObject, platform: String, test: (JSONObject) -> Boolean): List<Pair<String, JSONObject>> {
        val out = ArrayList<Pair<String, JSONObject>>()
        val keys = lib.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val item = lib.optJSONObject(key) ?: continue
            if (item.optString("type") == "series") continue
            val entry = platformEntry(item.optJSONObject("platforms") ?: continue, platform) ?: continue
            if (test(entry)) out.add(key to item)
        }
        return out
    }

    private fun pickBest(found: List<Pair<String, JSONObject>>, platform: String, episode: Int?, pageUrl: String?): Pair<String, JSONObject>? {
        if (found.size <= 1) return found.firstOrNull()
        var pool = found
        if (episode != null && episode > 0) {
            val sameEp = pool.filter { it.second.optInt("episode", -1) == episode }
            if (sameEp.isNotEmpty()) pool = sameEp
        }
        if (pool.size > 1 && !pageUrl.isNullOrBlank()) {
            val page = urlTokens(pageUrl)
            val scored = pool.map { c ->
                val u = platformEntry(c.second.optJSONObject("platforms")!!, platform)?.optString("url", "").orEmpty()
                c to urlTokens(u).count { it in page }
            }
            val best = scored.maxOf { it.second }
            pool = scored.filter { it.second == best }.map { it.first }
        }
        return pool.first()
    }

    private fun urlTokens(url: String): Set<String> {
        val decoded = runCatching { URLDecoder.decode(url.replace("+", "%2B"), "UTF-8") }.getOrDefault(url)
        val noScheme = decoded.lowercase().substringAfter("://", decoded.lowercase())
        return noScheme.substringAfter('/', "").split('/', '#', '?', '&', '=').filter { it.length >= 2 }.toSet()
    }

    private fun findStremio(lib: JSONObject, movieId: String): JSONObject? {
        val bare = stremioMovieOrSeriesRe.matches(movieId)
        val keys = lib.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val item = lib.optJSONObject(key) ?: continue
            val type = item.optString("type")
            if (type == "series") continue
            if (bare && type == "episode") continue
            val st = platformEntry(item.optJSONObject("platforms") ?: continue, "stremio") ?: continue
            val sid = normalizeId(st.opt("id")?.toString())
            if (sid.equals(movieId, ignoreCase = true)) return JSONObject(item.toString()).put("_libraryKey", key)
        }
        return null
    }

    fun platformEntry(platforms: JSONObject, name: String): JSONObject? {
        platforms.optJSONObject(name)?.let { return it }
        val keys = platforms.keys()
        while (keys.hasNext()) { val k = keys.next(); if (k.equals(name, ignoreCase = true)) return platforms.optJSONObject(k) }
        return null
    }

    fun idAppearsAsWholeSegment(url: String, id: String): Boolean {
        if (id.length < 3) return false
        if (id.none { it.isDigit() } && id.length < 8) return false
        val re = Regex("(^|[^0-9A-Za-z])" + Regex.escape(id) + "($|[^0-9A-Za-z])")
        return re.containsMatchIn(url)
    }
}

/** Same rules as SalikFilterCore.validateLibrary (shared/filter-core.js). */
object LibraryValidator {

    fun validate(raw: String): List<String> {
        val lib = runCatching { JSONObject(raw) }.getOrElse { return listOf("not valid JSON: ${it.message}") }
        val errors = ArrayList<String>()
        if (lib.length() == 0) errors.add("library is empty")
        val keys = lib.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val item = lib.opt(key) as? JSONObject
            if (item == null) { errors.add("$key: item is not an object"); continue }
            if (!item.has("filters") || item.isNull("filters") || item.opt("filters") == "") continue
            val filters = item.opt("filters") as? JSONArray
            if (filters == null) { errors.add("$key: filters is not an array"); continue }
            val seen = HashSet<String>()
            for (i in 0 until filters.length()) {
                val where = "$key#$i"
                val f = filters.opt(i) as? JSONObject
                if (f == null) { errors.add("$where: filter is not an object"); continue }
                val id = f.opt("id")
                if (id == null || id == JSONObject.NULL || id.toString().isEmpty()) errors.add("$where: missing id")
                else if (!seen.add(id.toString())) errors.add("$where: duplicate id $id")
                val s = f.opt("start") as? Number
                val e = f.opt("end") as? Number
                if (s == null || !s.toDouble().isFinite()) errors.add("$where: start is not a number")
                if (e == null || !e.toDouble().isFinite()) errors.add("$where: end is not a number")
                if (s != null && e != null && e.toDouble() < s.toDouble()) errors.add("$where: end < start")
            }
        }
        return errors
    }

    fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    /** "<hex>  library.json" or just "<hex>" -> lowercase hex, or null when the text holds no digest. */
    fun parseSha256File(text: String): String? =
        Regex("\\b([0-9a-fA-F]{64})\\b").find(text)?.groupValues?.get(1)?.lowercase()
}
