package com.salik.tv

import android.content.ComponentName
import android.service.notification.NotificationListenerService

/**
 * Android only lets an app read other apps' media sessions (title, position, play/pause/seek) when the user
 * grants it "notification access"; this service is what that access is attached to. It reads no
 * notifications: it only hosts the companion engine while the access is on.
 */
class MediaListener : NotificationListenerService() {
    private var engine: CompanionEngine? = null

    override fun onListenerConnected() {
        engine?.stop()
        engine = CompanionEngine(this, ComponentName(this, MediaListener::class.java)).also { it.start() }
    }

    override fun onListenerDisconnected() { engine?.stop(); engine = null }

    override fun onDestroy() { engine?.stop(); engine = null; super.onDestroy() }
}
