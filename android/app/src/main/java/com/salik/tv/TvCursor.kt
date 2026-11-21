package com.salik.tv

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * A mouse pointer for TV remotes. Streaming sites (sign-in pages above all) are made for a mouse or a
 * finger, so the D-pad alone often cannot reach their fields and buttons.
 *
 * Arrows move the pointer (faster while held), OK clicks where it points, and at the screen edge the page
 * under the pointer scrolls. After a few idle seconds the pointer hides; the next arrow only shows it again,
 * and OK while it is hidden goes to the page as a normal key (play/pause, focused button).
 */
class TvCursor(context: Context, private val root: FrameLayout, private val target: WebView) {

    var enabled = true
        set(value) { field = value; if (!value) hide() }

    private val density = context.resources.displayMetrics.density
    private val view = PointerView(context)
    private var x = -1f
    private var y = -1f
    private var visible = false
    private var lastMoveAt = 0L
    private var downTime = 0L
    private val ui = Handler(Looper.getMainLooper())
    private val autoHide = Runnable { if (SystemClock.uptimeMillis() - lastMoveAt >= HIDE_AFTER_MS - 50) hide() }

    init {
        view.visibility = View.GONE
        root.addView(view, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    }

    /** true when the key was used by the pointer. */
    fun handle(event: KeyEvent): Boolean {
        if (!enabled || target.width == 0) return false
        val code = event.keyCode
        val isArrow = code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN ||
            code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT
        val isOk = code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER
        if (!isArrow && !isOk) return false

        if (isOk) {
            if (!visible) return false
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) { touch(MotionEvent.ACTION_DOWN); keepAlive() }
            if (event.action == KeyEvent.ACTION_UP) { touch(MotionEvent.ACTION_UP); keepAlive() }
            return true
        }

        if (event.action != KeyEvent.ACTION_DOWN) return true
        if (!visible) { show(); return true }
        val step = (STEP_DP + minOf(event.repeatCount, 20) * ACCEL_DP) * density
        var dx = 0f
        var dy = 0f
        when (code) {
            KeyEvent.KEYCODE_DPAD_UP -> dy = -step
            KeyEvent.KEYCODE_DPAD_DOWN -> dy = step
            KeyEvent.KEYCODE_DPAD_LEFT -> dx = -step
            KeyEvent.KEYCODE_DPAD_RIGHT -> dx = step
        }
        moveBy(dx, dy)
        return true
    }

    private fun moveBy(dx: Float, dy: Float) {
        val w = target.width.toFloat()
        val h = target.height.toFloat()
        val nx = x + dx
        val ny = y + dy
        val edge = EDGE_DP * density
        if (ny < edge && dy < 0) scroll(0f, 1f) else if (ny > h - edge && dy > 0) scroll(0f, -1f)
        if (nx < edge && dx < 0) scroll(-1f, 0f) else if (nx > w - edge && dx > 0) scroll(1f, 0f)
        x = nx.coerceIn(0f, w - 1)
        y = ny.coerceIn(0f, h - 1)
        place()
        hover()
        keepAlive()
    }

    private fun show() {
        if (x < 0 || y < 0) { x = target.width / 2f; y = target.height / 2f }
        visible = true
        view.visibility = View.VISIBLE
        view.bringToFront()
        place()
        hover()
        keepAlive()
    }

    fun hide() {
        visible = false
        view.visibility = View.GONE
        ui.removeCallbacks(autoHide)
    }

    private fun keepAlive() {
        lastMoveAt = SystemClock.uptimeMillis()
        ui.removeCallbacks(autoHide)
        ui.postDelayed(autoHide, HIDE_AFTER_MS)
    }

    private fun place() {
        val loc = IntArray(2)
        target.getLocationInWindow(loc)
        val rootLoc = IntArray(2)
        root.getLocationInWindow(rootLoc)
        view.translationX = loc[0] - rootLoc[0] + x
        view.translationY = loc[1] - rootLoc[1] + y
    }

    private fun touch(action: Int) {
        val now = SystemClock.uptimeMillis()
        if (action == MotionEvent.ACTION_DOWN) downTime = now
        val ev = MotionEvent.obtain(downTime, now, action, x, y, 0)
        ev.source = InputDevice.SOURCE_TOUCHSCREEN
        target.dispatchTouchEvent(ev)
        ev.recycle()
    }

    private fun hover() {
        val now = SystemClock.uptimeMillis()
        val props = arrayOf(MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_MOUSE })
        val coords = arrayOf(MotionEvent.PointerCoords().apply { this.x = this@TvCursor.x; this.y = this@TvCursor.y })
        val ev = MotionEvent.obtain(now, now, MotionEvent.ACTION_HOVER_MOVE, 1, props, coords, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_MOUSE, 0)
        target.dispatchGenericMotionEvent(ev)
        ev.recycle()
    }

    /** Scrolls whatever is under the pointer (page or inner panel), like a mouse wheel. */
    private fun scroll(h: Float, v: Float) {
        val now = SystemClock.uptimeMillis()
        val props = arrayOf(MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_MOUSE })
        val coords = arrayOf(MotionEvent.PointerCoords().apply {
            this.x = this@TvCursor.x; this.y = this@TvCursor.y
            setAxisValue(MotionEvent.AXIS_VSCROLL, v)
            setAxisValue(MotionEvent.AXIS_HSCROLL, h)
        })
        val ev = MotionEvent.obtain(now, now, MotionEvent.ACTION_SCROLL, 1, props, coords, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_MOUSE, 0)
        target.dispatchGenericMotionEvent(ev)
        ev.recycle()
    }

    private inner class PointerView(context: Context) : View(context) {
        private val size = 30 * density
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.FILL }
        private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 2 * density; strokeJoin = Paint.Join.ROUND }
        private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x66000000; style = Paint.Style.FILL }
        private val arrow = Path().apply {
            moveTo(0f, 0f); lineTo(0f, size * 0.86f); lineTo(size * 0.24f, size * 0.64f); lineTo(size * 0.40f, size)
            lineTo(size * 0.54f, size * 0.94f); lineTo(size * 0.38f, size * 0.60f); lineTo(size * 0.68f, size * 0.60f); close()
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) = setMeasuredDimension((size + 6 * density).toInt(), (size + 6 * density).toInt())

        override fun onDraw(canvas: Canvas) {
            val p = 2 * density
            canvas.save(); canvas.translate(p + 2 * density, p + 2 * density); canvas.drawPath(arrow, shadow); canvas.restore()
            canvas.save(); canvas.translate(p, p); canvas.drawPath(arrow, fill); canvas.drawPath(arrow, stroke); canvas.restore()
        }
    }

    companion object {
        private const val STEP_DP = 12f
        private const val ACCEL_DP = 3f
        private const val EDGE_DP = 24f
        private const val HIDE_AFTER_MS = 5000L

        /** TV-like device: Android TV (leanback) or no touch screen. */
        fun isTv(context: Context): Boolean {
            val pm = context.packageManager
            val ui = context.getSystemService(Context.UI_MODE_SERVICE) as? android.app.UiModeManager
            return pm.hasSystemFeature("android.software.leanback") ||
                ui?.currentModeType == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION ||
                !pm.hasSystemFeature("android.hardware.touchscreen")
        }
    }
}
