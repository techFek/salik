package com.salik.tv

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class LibraryMatcherTest {

    private val lib = JSONObject(
        """
        {
          "movie-on-netflix": { "type": "movie", "title": "A", "platforms": { "netflix": { "id": "81234567", "url": "https://www.netflix.com/title/81234567" } } },
          "movie-on-shahid":  { "type": "movie", "title": "B", "platforms": { "shahid":  { "id": "81234567", "url": "https://shahid.mbc.net/ar/movie/b/movie-81234567" } } },
          "show":     { "type": "series", "title": "Show", "platforms": { "osnplus": { "id": "68999" } } },
          "show-s1e12": { "type": "episode", "episode": 12, "season": 1, "parent_series_id": "show", "title": "S1E12",
                          "platforms": { "osnplus": { "id": "68999", "url": "https://osnplus.com/en/episode/show-s1-e12-68999" } } },
          "show-s2e8":  { "type": "episode", "episode": 8, "season": 2, "parent_series_id": "show", "title": "S2E8",
                          "platforms": { "osnplus": { "id": "68999", "url": "https://osnplus.com/en/episode/show-s2-e8-68999" } } },
          "a-s1e1": { "type": "episode", "episode": 1, "title": "Al sofara 1", "platforms": { "starzplay": { "id": "s1e1", "url": "https://starzplay.com/ar/watch/series/al-sofara/648572456358/s1e1" } } },
          "b-s1e1": { "type": "episode", "episode": 1, "title": "Other 1",     "platforms": { "starzplay": { "id": "s1e1", "url": "https://starzplay.com/ar/watch/series/other-show/111111111111/s1e1" } } },
          "inception": { "type": "movie", "title": "Inception", "platforms": { "stremio": { "id": "tt1375666" } } }
        }
        """.trimIndent()
    )

    private fun key(o: JSONObject?) = o?.optString("_libraryKey")

    @Test fun numericIdOnTwoPlatformsReturnsEachPlatformsOwnTitle() {
        assertEquals("movie-on-netflix", key(LibraryMatcher.findItem(lib, "81234567", "netflix")))
        assertEquals("movie-on-shahid", key(LibraryMatcher.findItem(lib, "81234567", "shahid")))
    }

    @Test fun idIsNotMatchedOnAnotherPlatform() {
        assertNull(LibraryMatcher.findItem(lib, "81234567", "disney"))
    }

    @Test fun urlSegmentFallbackStaysOnTheSamePlatform() {
        val lib2 = JSONObject("""{ "x": { "type": "movie", "platforms": { "disney": { "id": "other", "url": "https://www.disneyplus.com/play/0f3c7d2e-1111-2222-3333-444455556666" } } } }""")
        assertEquals("x", key(LibraryMatcher.findItem(lib2, "0f3c7d2e-1111-2222-3333-444455556666", "disney")))
        assertNull(LibraryMatcher.findItem(lib2, "0f3c7d2e-1111-2222-3333-444455556666", "netflix"))
    }

    @Test fun seriesEpisodeIsChosenByEpisodeNumber() {
        assertEquals("show-s1e12", key(LibraryMatcher.findItem(lib, "68999", "osnplus", 12)))
        assertEquals("show-s2e8", key(LibraryMatcher.findItem(lib, "68999", "osnplus", 8)))
    }

    @Test fun sameEpisodeIdInTwoShowsIsChosenByPageUrl() {
        assertEquals("a-s1e1", key(LibraryMatcher.findItem(lib, "s1e1", "starzplay", 1, "https://starzplay.com/ar/watch/series/al-sofara/648572456358/s1e1")))
        assertEquals("b-s1e1", key(LibraryMatcher.findItem(lib, "s1e1", "starzplay", 1, "https://starzplay.com/ar/watch/series/other-show/111111111111/s1e1")))
    }

    @Test fun seriesEntriesAreNeverReturned() {
        val only = JSONObject("""{ "show": { "type": "series", "platforms": { "osnplus": { "id": "5555" } } } }""")
        assertNull(LibraryMatcher.findItem(only, "5555", "osnplus"))
    }

    @Test fun stremioIdsStayStrict() {
        assertEquals("inception", key(LibraryMatcher.findItem(lib, "tt1375666", "stremio")))
        assertNull(LibraryMatcher.findItem(lib, "tt1375666", "general"))
        assertNull(LibraryMatcher.findItem(lib, "tt1375666", "netflix"))
        assertNull(LibraryMatcher.findItem(lib, "tt1375666:1:2", "stremio"))
    }

    @Test fun libraryKeyIsNeverMatchedDirectly() {
        assertNull(LibraryMatcher.findItem(lib, "movie-on-netflix", "netflix"))
        assertNull(LibraryMatcher.findItem(lib, "81234567", null))
    }

    @Test fun watchitMovie79IsFoundOnlyOnWatchit() {
        val real = JSONObject(File("src/main/assets/data/library.json").readText())
        assertEquals("3asal-eswed", key(LibraryMatcher.findItem(real, "79", "watchit", null, "https://www.watchit.com/#/details/movies/79")))
        assertNull(LibraryMatcher.findItem(real, "79", "netflix", null, "https://www.netflix.com/title/79"))
    }

    @Test fun validatorRejectsBrokenLibraries() {
        assertTrue(LibraryValidator.validate("not json").isNotEmpty())
        assertTrue(LibraryValidator.validate("""{"a":{"filters":[{"id":1,"start":5,"end":4}]}}""").any { it.contains("end < start") })
        assertTrue(LibraryValidator.validate("""{"a":{"filters":[{"id":1,"start":1,"end":2},{"id":1,"start":3,"end":4}]}}""").any { it.contains("duplicate") })
        assertTrue(LibraryValidator.validate("""{"a":{"filters":[{"id":1,"start":"1","end":2}]}}""").any { it.contains("start") })
        assertTrue(LibraryValidator.validate("""{"a":{"filters":""}}""").isEmpty())
    }

    @Test fun sha256DigestFileIsParsed() {
        val hex = LibraryValidator.sha256Hex("abc".toByteArray())
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", hex)
        assertEquals(hex, LibraryValidator.parseSha256File("$hex  library.json\n"))
        assertNull(LibraryValidator.parseSha256File("nope"))
    }

    @Test fun realBundledLibraryIsValid() {
        val f = File("src/main/assets/data/library.json")
        val errors = LibraryValidator.validate(f.readText())
        assertTrue("bundled library has problems: ${errors.take(5)}", errors.isEmpty())
    }

    @Test fun realLibraryEveryPlatformIdResolvesToItsOwnTitle() {
        val real = JSONObject(File("src/main/assets/data/library.json").readText())
        var checked = 0
        val bad = ArrayList<String>()
        for (k in real.keys()) {
            val item = real.optJSONObject(k) ?: continue
            if (item.optString("type") == "series") continue
            val platforms = item.optJSONObject("platforms") ?: continue
            for (p in platforms.keys()) {
                val id = platforms.optJSONObject(p)?.opt("id")?.toString() ?: continue
                if (id.isEmpty()) continue
                val ep = item.optInt("episode", -1).takeIf { it > 0 }
                val url = platforms.optJSONObject(p)?.optString("url", "")
                val got = LibraryMatcher.findItem(real, id, p, ep, url)?.optString("_libraryKey")
                checked++
                if (got != k) bad.add("$p:$id -> $got (expected $k)")
            }
        }
        println("Real library: $checked platform ids checked, ${bad.size} resolve elsewhere")
        bad.forEach { println("  $it") }
        assertTrue("ids that resolve to another title: $bad", bad.isEmpty())
    }
}
