package com.salik.tv

import android.service.notification.NotificationListenerService

/**
 * Empty notification listener. Android only lets an app read other apps' media sessions (title, position,
 * play/pause/seek) when the user grants it "notification access"; this service is what that access is
 * attached to. It reads no notifications.
 */
class MediaListener : NotificationListenerService()
