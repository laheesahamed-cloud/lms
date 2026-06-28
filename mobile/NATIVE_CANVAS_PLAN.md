# Native Ink Canvas Plan — iOS (PencilKit) + Android (SurfaceView)

## Why

Flutter CustomPainter ceiling:
- ~8–16ms tip-to-ink lag (1 frame minimum, uncloseable in Dart)
- No Apple Pencil latency prediction
- RepaintBoundary rasterizes at 1x → pixelated edges at zoom
- No sub-frame historical events on iOS
- No palm rejection

Native ceiling:
- iOS PencilKit: ~1–2ms, built-in predictive strokes, palm rejection, any zoom crisp
- Android SurfaceView: MotionEvent.getHistoricalX/Y gives ALL 240Hz sub-frame points

---

## Architecture

```
Flutter Page
├── AppHeader                     (Flutter — unchanged)
├── Tool strip                    (Flutter — MethodChannel → native)
└── Expanded
      ├── iOS  → UiKitView  → NoteCanvasView.swift
      └── Android → AndroidView → NoteCanvasView.kt
            Both contain:
              ├── WebView / WKWebView  (note HTML, crisp text at any zoom)
              └── Ink layer on top     (PencilKit / SurfaceView, transparent)
```

Note content is HTML rendered by WebView — re-rasterizes text at native resolution at every zoom. Zero softness. Ink layer is transparent, sits on top, only captures stylus input.

---

## Step 1 — iOS skeleton

**Files to create:**
- `ios/Runner/NoteCanvasViewFactory.swift`
- `ios/Runner/NoteCanvasView.swift`

**AppDelegate.swift** — add registration block (same pattern as Apple-auth):
```swift
let noteCanvasFactory = NoteCanvasViewFactory(messenger: flutterViewController.binaryMessenger)
registrar(forPlugin: "NoteCanvas").register(noteCanvasFactory, withId: "app.xyndrome.lk/note_canvas")
```

**NoteCanvasViewFactory.swift:**
```swift
import Flutter
import UIKit

class NoteCanvasViewFactory: NSObject, FlutterPlatformViewFactory {
    private let messenger: FlutterBinaryMessenger
    init(messenger: FlutterBinaryMessenger) { self.messenger = messenger; super.init() }
    func create(withFrame frame: CGRect, viewIdentifier viewId: Int64, arguments args: Any?) -> FlutterPlatformView {
        return NoteCanvasView(frame: frame, viewId: viewId, messenger: messenger)
    }
    func createArgsCodec() -> FlutterMessageCodec & NSObjectProtocol { FlutterStandardMessageCodec.sharedInstance() }
}
```

**NoteCanvasView.swift (skeleton):**
```swift
import Flutter
import UIKit
import PencilKit
import WebKit

class NoteCanvasView: NSObject, FlutterPlatformView, PKCanvasViewDelegate {
    private let container: UIView
    private let wkWeb: WKWebView
    private let canvas: PKCanvasView
    private let channel: FlutterMethodChannel
    private var saveTimer: Timer?

    init(frame: CGRect, viewId: Int64, messenger: FlutterBinaryMessenger) {
        container = UIView(frame: frame)
        wkWeb = WKWebView(frame: container.bounds)
        canvas = PKCanvasView(frame: container.bounds)
        channel = FlutterMethodChannel(name: "app.xyndrome.lk/note_canvas_\(viewId)", binaryMessenger: messenger)
        super.init()
        setupViews()
        setupChannel()
    }

    func view() -> UIView { container }

    private func setupViews() {
        // WKWebView — note content, fills canvas content area
        wkWeb.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        wkWeb.scrollView.isScrollEnabled = false // PKCanvasView scroll drives everything
        wkWeb.isOpaque = false
        wkWeb.backgroundColor = .clear

        // PKCanvasView — UIScrollView, handles pan/zoom natively
        canvas.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        if #available(iOS 14.0, *) {
            canvas.drawingPolicy = .pencilOnly
        } else {
            canvas.allowsFingerDrawing = false
        }
        canvas.minimumZoomScale = 1.0
        canvas.maximumZoomScale = 5.0
        canvas.delegate = self

        // WKWebView goes INSIDE PKCanvasView's scroll content, below ink
        canvas.insertSubview(wkWeb, at: 0)

        container.addSubview(canvas)
    }

    private func setupChannel() {
        channel.setMethodCallHandler { [weak self] call, result in
            guard let self else { return }
            switch call.method {
            case "setTool":   self.setTool(call.arguments);  result(nil)
            case "loadHTML":  self.loadHTML(call.arguments);  result(nil)
            case "loadInk":   self.loadInk(call.arguments);   result(nil)
            case "clear":     self.canvas.drawing = PKDrawing(); result(nil)
            case "undo":      self.canvas.undoManager?.undo(); result(nil)
            default:          result(FlutterMethodNotImplemented)
            }
        }
    }

    private func setTool(_ args: Any?) {
        guard let m = args as? [String: Any],
              let tool = m["tool"] as? String,
              let argb = m["colorARGB"] as? Int,
              let width = m["width"] as? Double else { return }
        let color = UIColor(
            red:   CGFloat((argb >> 16) & 0xFF) / 255,
            green: CGFloat((argb >>  8) & 0xFF) / 255,
            blue:  CGFloat( argb        & 0xFF) / 255,
            alpha: CGFloat((argb >> 24) & 0xFF) / 255
        )
        switch tool {
        case "pen":
            canvas.tool = PKInkingTool(.pen, color: color, width: CGFloat(width))
        case "highlighter":
            // Rounded translucent pen (NOT .marker chisel) — user's explicit preference
            canvas.tool = PKInkingTool(.pen, color: color.withAlphaComponent(0.4), width: CGFloat(width))
        case "eraser":
            canvas.tool = PKEraserTool(.vector)
        default: break
        }
    }

    private func loadHTML(_ args: Any?) {
        guard let html = (args as? [String: Any])?["html"] as? String else { return }
        wkWeb.loadHTMLString(html, baseURL: nil)
    }

    private func loadInk(_ args: Any?) {
        guard let bytes = (args as? FlutterStandardTypedData)?.data else { return }
        if let drawing = try? PKDrawing(data: bytes) {
            canvas.drawing = drawing
        }
    }

    // PKCanvasViewDelegate — debounced save
    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        saveTimer?.invalidate()
        saveTimer = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: false) { [weak self] _ in
            guard let self else { return }
            let data = self.canvas.drawing.dataRepresentation()
            self.channel.invokeMethod("onInkChanged", arguments: FlutterStandardTypedData(bytes: data))
        }
    }
}
```

---

## Step 2 — Flutter side (UiKitView + channel)

Replace the `InteractiveViewer` block in `note_canvas_page.dart`:

```dart
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';

// In state:
MethodChannel? _nativeChannel;

Widget _nativeCanvas(NoteDoc note) {
  return UiKitView(
    viewType: 'app.xyndrome.lk/note_canvas',
    onPlatformViewCreated: (id) {
      _nativeChannel = MethodChannel('app.xyndrome.lk/note_canvas_$id');
      _nativeChannel!.setMethodCallHandler(_onNativeCall);
      _initNativeCanvas(note);
    },
    gestureRecognizers: {
      Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
    },
  );
}

Future<void> _initNativeCanvas(NoteDoc note) async {
  final ch = _nativeChannel;
  if (ch == null) return;
  // Send note HTML
  await ch.invokeMethod('loadHTML', {'html': _buildNoteHtml(note, _dark)});
  // Send tool
  _syncTool();
  // Load saved ink
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getBytes('lms.pkink.${widget.lessonId}');
  if (raw != null) await ch.invokeMethod('loadInk', raw);
}

Future<dynamic> _onNativeCall(MethodCall call) async {
  if (call.method == 'onInkChanged') {
    final bytes = (call.arguments as Uint8List);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBytes('lms.pkink.${widget.lessonId}', bytes);
  }
}

void _syncTool() {
  _nativeChannel?.invokeMethod('setTool', {
    'tool': _tool.name,
    'colorARGB': _activeColor.toARGB32(),
    'width': _activeSize,
  });
}
```

---

## Step 3 — HTML generator

```dart
String _buildNoteHtml(NoteDoc note, bool dark) {
  final bg = dark ? '#17150F' : '#FAF3E6';
  final fg = dark ? '#DCE6FF' : '#322F29';
  final sb = StringBuffer()
    ..write('<html><head><meta name="viewport" content="width=device-width,initial-scale=1">')
    ..write('<style>body{margin:16px;background:$bg;color:$fg;font-family:-apple-system;font-size:16px;line-height:1.6}</style></head><body>');
  for (final section in note.sections) {
    _renderSection(sb, section, dark);
  }
  sb.write('</body></html>');
  return sb.toString();
}
```

Mirror the existing `NoteCanvas` section types (heading, body, bullet, code, etc.).

---

## Step 4 — Android

**Files:**
- `android/app/src/main/kotlin/lk/xyndrome/app/NoteCanvasViewFactory.kt`
- `android/app/src/main/kotlin/lk/xyndrome/app/NoteCanvasView.kt`
- Register in `MainActivity.kt`

**NoteCanvasView.kt (key ink logic):**
```kotlin
override fun onTouchEvent(event: MotionEvent): Boolean {
    if (event.getToolType(0) != MotionEvent.TOOL_TYPE_STYLUS) return false
    when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> startStroke(event.x, event.y)
        MotionEvent.ACTION_MOVE -> {
            // Historical events — ALL sub-frame 240Hz samples (Android advantage)
            for (i in 0 until event.historySize) {
                addPoint(event.getHistoricalX(i), event.getHistoricalY(i))
            }
            addPoint(event.x, event.y)
        }
        MotionEvent.ACTION_UP -> commitStroke()
    }
    return true
}
```

Ink stored as JSON strokes (same schema as `lms.ink.<id>`). Sent via `onInkChanged` method call to Flutter.

---

## Tool strip — Flutter changes

Tool strip calls `_syncTool()` on every tap (color, size, tool type). Add undo button that calls `_nativeChannel?.invokeMethod('undo')`.

Remove all `_InkPainter`, `_LivePainter`, `_Stroke`, `_smoothPath`, `_linePaint`, `CustomPaint`, `InteractiveViewer` from `note_canvas_page.dart`. State reduces to: tool, colors, sizes, `_nativeChannel`.

---

## Build order

- [ ] Step 1: iOS Swift files + AppDelegate register + blank UiKitView visible
- [ ] Step 2: WKWebView loads HTML — note content visible and crisp
- [ ] Step 3: PKCanvasView ink + tool channel — drawing works
- [ ] Step 4: Ink persist (PKDrawing binary)
- [ ] Step 5: Flutter tool strip → _syncTool() wired
- [ ] Step 6: Android NoteCanvasViewFactory skeleton
- [ ] Step 7: Android WebView content
- [ ] Step 8: Android InkSurfaceView stylus + historical events
- [ ] Step 9: Android ink persist (JSON)
- [ ] Step 10: Clean up Flutter canvas code (remove CustomPainter etc.)
