package com.salik.tv

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SalikConfigTest {
    @Test fun httpIsOffByDefault() {
        assertFalse(SalikConfig.cleartextAllowed(null, "http", "192.168.1.23"))
        assertFalse(SalikConfig.cleartextAllowed("", "http", "example.com"))
        assertTrue(SalikConfig.cleartextAllowed(null, "https", "example.com"))
    }

    @Test fun httpOnlyForTheUsersOwnLanServer() {
        val s = "192.168.1.23:11470"
        assertTrue(SalikConfig.cleartextAllowed(s, "http", "192.168.1.23"))
        assertFalse(SalikConfig.cleartextAllowed(s, "http", "192.168.1.24"))
        assertFalse(SalikConfig.cleartextAllowed(s, "http", "example.com"))
        assertFalse(SalikConfig.cleartextAllowed("8.8.8.8:11470", "http", "8.8.8.8"))
    }

    @Test fun parsesServerSetting() {
        assertTrue(SalikConfig.parseServer("http://10.0.0.5:8080")?.host == "10.0.0.5")
        assertTrue(SalikConfig.parseServer("  ") == null)
    }
}
