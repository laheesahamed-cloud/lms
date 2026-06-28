package app.xyndrome.xyndrome

import android.content.Context
import android.graphics.*
import android.os.Handler
import android.os.Looper
import android.view.*
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.platform.PlatformView

class NoteCanvasView(
    context: Context,
    viewId: Int,
    messenger: BinaryMessenger
) : PlatformView, MethodChannel.MethodCallHandler {

    private val root = FrameLayout(context)
    private val webView = WebView(context)
    private val inkView = InkSurfaceView(context)
    private val channel = MethodChannel(messenger, "app.xyndrome.lk/note_canvas_$viewId")
    private val handler = Handler(Looper.getMainLooper())
    private var saveRunnable: Runnable? = null

    init {
        webView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        with(webView.settings) {
            javaScriptEnabled = false
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = true
            displayZoomControls = false
            setSupportZoom(true)
            textZoom = 100
        }
        webView.isScrollbarFadingEnabled = true

        inkView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        inkView.onStrokeCommitted = { json ->
            saveRunnable?.let { handler.removeCallbacks(it) }
            val r = Runnable {
                channel.invokeMethod("onInkChanged", json)
            }
            saveRunnable = r
            handler.postDelayed(r, 800)
        }

        root.addView(webView)
        root.addView(inkView)

        channel.setMethodCallHandler(this)
    }

    override fun getView(): android.view.View = root

    override fun dispose() {
        channel.setMethodCallHandler(null)
        webView.destroy()
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "setTool" -> {
                val tool = call.argument<String>("tool") ?: "pen"
                val argb = call.argument<Int>("colorARGB") ?: Color.BLACK
                val width = call.argument<Double>("width") ?: 4.5
                inkView.setTool(tool, argb, width.toFloat())
                result.success(null)
            }
            "loadHTML" -> {
                val html = call.argument<String>("html") ?: ""
                webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
                result.success(null)
            }
            "loadInk" -> {
                val json = call.arguments as? String ?: ""
                inkView.loadInk(json)
                result.success(null)
            }
            "clear" -> {
                inkView.clear()
                result.success(null)
            }
            "undo" -> {
                inkView.undo()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }
}

// ---- Ink surface view ----

private data class Stroke(
    val tool: String,
    val color: Int,
    val width: Float,
    val points: MutableList<PointF> = mutableListOf()
)

class InkSurfaceView(context: Context) : SurfaceView(context), SurfaceHolder.Callback {

    var onStrokeCommitted: ((String) -> Unit)? = null

    private val committed = mutableListOf<Stroke>()
    private var active: Stroke? = null
    private var tool = "pen"
    private var color = Color.BLACK
    private var width = 4.5f

    init {
        setZOrderOnTop(true)
        holder.setFormat(PixelFormat.TRANSPARENT)
        holder.addCallback(this)
    }

    fun setTool(t: String, c: Int, w: Float) { tool = t; color = c; width = w }

    fun clear() {
        committed.clear()
        active = null
        redraw()
    }

    fun undo() {
        if (committed.isEmpty()) return
        committed.removeAt(committed.lastIndex)
        redraw()
    }

    fun loadInk(json: String) {
        committed.clear()
        try {
            val arr = org.json.JSONArray(json)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val s = Stroke(
                    tool  = o.optString("t", "pen"),
                    color = o.optInt("c", Color.BLACK),
                    width = o.optDouble("w", 4.5).toFloat()
                )
                val pts = o.optJSONArray("p") ?: continue
                for (j in 0 until pts.length()) {
                    val pt = pts.getJSONArray(j)
                    s.points.add(PointF(pt.getDouble(0).toFloat(), pt.getDouble(1).toFloat()))
                }
                if (s.points.size > 1) committed.add(s)
            }
        } catch (_: Exception) {}
        redraw()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.getToolType(0) != MotionEvent.TOOL_TYPE_STYLUS) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                active = Stroke(tool, color, width)
                active!!.points.add(PointF(event.x, event.y))
                redrawLive()
            }
            MotionEvent.ACTION_MOVE -> {
                val s = active ?: return true
                for (i in 0 until event.historySize) {
                    s.points.add(PointF(event.getHistoricalX(i), event.getHistoricalY(i)))
                }
                s.points.add(PointF(event.x, event.y))
                redrawLive()
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                val s = active
                active = null
                if (s != null && s.points.size > 1) {
                    if (s.tool == "eraser") {
                        eraseWith(s)
                    } else {
                        committed.add(s)
                    }
                    onStrokeCommitted?.invoke(inkToJson())
                }
                redraw()
            }
        }
        return true
    }

    private fun eraseWith(eraser: Stroke) {
        val ep = eraser.path()
        val region = Region()
        val clip = Region(0, 0, width.toInt(), height.toInt())
        committed.removeAll { s ->
            val sp = s.path()
            val m = Matrix()
            val r = RectF()
            sp.computeBounds(r, true)
            val sr = Region()
            sr.setPath(sp, clip)
            val er2 = Region()
            er2.setPath(ep, clip)
            !sr.op(er2, Region.Op.INTERSECT).let { sr.isEmpty }
        }
    }

    private fun Stroke.path(): Path {
        val p = Path()
        if (points.isEmpty()) return p
        p.moveTo(points[0].x, points[0].y)
        smoothCatmullRom(p, points)
        return p
    }

    private fun redrawLive() {
        val c = holder.lockCanvas() ?: return
        drawAll(c)
        holder.unlockCanvasAndPost(c)
    }

    private fun redraw() {
        if (!holder.surface.isValid) return
        val c = holder.lockCanvas() ?: return
        drawAll(c)
        holder.unlockCanvasAndPost(c)
    }

    private fun drawAll(canvas: Canvas) {
        canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
        for (s in committed) drawStroke(canvas, s)
        active?.let { drawStroke(canvas, it) }
    }

    private fun drawStroke(canvas: Canvas, s: Stroke) {
        if (s.points.size < 2) return
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            strokeWidth = s.width
            when (s.tool) {
                "highlighter" -> {
                    color = s.color
                    alpha = 100 // ~0.4 * 255
                    xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)
                }
                "eraser" -> {
                    xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
                }
                else -> {
                    color = s.color
                }
            }
        }
        val path = Path()
        path.moveTo(s.points[0].x, s.points[0].y)
        smoothCatmullRom(path, s.points)
        canvas.drawPath(path, paint)
    }

    private fun smoothCatmullRom(path: Path, pts: List<PointF>) {
        if (pts.size < 3) {
            for (i in 1 until pts.size) path.lineTo(pts[i].x, pts[i].y)
            return
        }
        for (i in 0 until pts.size - 1) {
            val p0 = pts[if (i > 0) i - 1 else 0]
            val p1 = pts[i]
            val p2 = pts[i + 1]
            val p3 = pts[if (i + 2 < pts.size) i + 2 else pts.size - 1]
            val cp1x = p1.x + (p2.x - p0.x) / 6f
            val cp1y = p1.y + (p2.y - p0.y) / 6f
            val cp2x = p2.x - (p3.x - p1.x) / 6f
            val cp2y = p2.y - (p3.y - p1.y) / 6f
            path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
        }
    }

    private fun inkToJson(): String {
        val arr = org.json.JSONArray()
        for (s in committed) {
            val o = org.json.JSONObject()
            o.put("t", s.tool)
            o.put("c", s.color)
            o.put("w", s.width.toDouble())
            val pts = org.json.JSONArray()
            for (p in s.points) {
                val pair = org.json.JSONArray()
                pair.put(p.x.toDouble())
                pair.put(p.y.toDouble())
                pts.put(pair)
            }
            o.put("p", pts)
            arr.put(o)
        }
        return arr.toString()
    }

    override fun surfaceCreated(holder: SurfaceHolder) { redraw() }
    override fun surfaceChanged(holder: SurfaceHolder, f: Int, w: Int, h: Int) { redraw() }
    override fun surfaceDestroyed(holder: SurfaceHolder) {}
}
