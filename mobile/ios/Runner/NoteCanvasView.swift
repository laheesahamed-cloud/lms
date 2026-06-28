import Flutter
import UIKit
import PencilKit
import WebKit

class NoteCanvasView: NSObject, FlutterPlatformView, PKCanvasViewDelegate {

  // MARK: – Views
  private let container: UIView
  private let webView: WKWebView
  private let canvas: PKCanvasView

  // MARK: – Channel
  private let channel: FlutterMethodChannel
  private var saveTimer: Timer?

  // MARK: – Init

  init(frame: CGRect, viewId: Int64, messenger: FlutterBinaryMessenger) {
    container = UIView(frame: frame)
    container.backgroundColor = .clear
    container.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    // WKWebView — note content.  No scrolling of its own; the PKCanvasView
    // (which IS a UIScrollView) drives all pan/zoom and we size the webView
    // to fill the canvas content area.
    let webCfg = WKWebViewConfiguration()
    webCfg.suppressesIncrementalRendering = false
    webView = WKWebView(frame: .zero, configuration: webCfg)
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.isScrollEnabled = false
    webView.scrollView.bounces = false

    // PKCanvasView — transparent ink layer that is also the scroll container.
    canvas = PKCanvasView(frame: frame)
    canvas.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    canvas.backgroundColor = .clear
    canvas.isOpaque = false
    canvas.minimumZoomScale = 1.0
    canvas.maximumZoomScale = 5.0
    canvas.bouncesZoom = true
    canvas.showsVerticalScrollIndicator = true
    canvas.showsHorizontalScrollIndicator = false
    if #available(iOS 14.0, *) {
      canvas.drawingPolicy = .pencilOnly
    } else {
      canvas.allowsFingerDrawing = false
    }

    channel = FlutterMethodChannel(
      name: "app.xyndrome.lk/note_canvas_\(viewId)",
      binaryMessenger: messenger
    )

    super.init()

    setupViews()
    setupChannel()
  }

  func view() -> UIView { container }

  // MARK: – Layout

  private func setupViews() {
    // webView lives inside the canvas's scroll content view so it moves/zooms
    // with the ink automatically — no manual sync needed.
    webView.translatesAutoresizingMaskIntoConstraints = false
    canvas.addSubview(webView)
    canvas.sendSubviewToBack(webView)

    canvas.delegate = self
    container.addSubview(canvas)

    // Once the canvas is laid out we size the webView to match its content area.
    canvas.addObserver(self, forKeyPath: "contentSize", options: .new, context: nil)
  }

  override func observeValue(forKeyPath keyPath: String?,
                             of object: Any?,
                             change: [NSKeyValueChangeKey: Any]?,
                             context: UnsafeMutableRawPointer?) {
    if keyPath == "contentSize" {
      webView.frame = CGRect(origin: .zero, size: canvas.contentSize)
    }
  }

  deinit {
    canvas.removeObserver(self, forKeyPath: "contentSize")
    saveTimer?.invalidate()
  }

  // MARK: – Channel

  private func setupChannel() {
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else { return }
      switch call.method {
      case "setTool":
        self.setTool(call.arguments)
        result(nil)
      case "loadHTML":
        self.loadHTML(call.arguments)
        result(nil)
      case "setContentHeight":
        self.setContentHeight(call.arguments)
        result(nil)
      case "loadInk":
        self.loadInk(call.arguments)
        result(nil)
      case "clear":
        self.canvas.drawing = PKDrawing()
        result(nil)
      case "undo":
        self.canvas.undoManager?.undo()
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  // MARK: – Tool

  private func setTool(_ args: Any?) {
    guard let m = args as? [String: Any],
          let tool = m["tool"] as? String,
          let argb = m["colorARGB"] as? Int,
          let width = m["width"] as? Double else { return }

    let a = CGFloat((argb >> 24) & 0xFF) / 255
    let r = CGFloat((argb >> 16) & 0xFF) / 255
    let g = CGFloat((argb >>  8) & 0xFF) / 255
    let b = CGFloat( argb        & 0xFF) / 255
    let color = UIColor(red: r, green: g, blue: b, alpha: a)

    switch tool {
    case "pen":
      canvas.tool = PKInkingTool(.pen, color: color, width: CGFloat(width))
    case "highlighter":
      // Rounded translucent pen brush — NOT the chisel .marker.
      // Alpha 0.4 gives the GoodNotes multiply-blend look over the paper.
      canvas.tool = PKInkingTool(.pen, color: color.withAlphaComponent(0.4), width: CGFloat(width))
    case "eraser":
      canvas.tool = PKEraserTool(.vector)
    default:
      break
    }
  }

  // MARK: – Content

  private func loadHTML(_ args: Any?) {
    guard let m = args as? [String: Any],
          let html = m["html"] as? String else { return }
    webView.loadHTMLString(html, baseURL: nil)
  }

  private func setContentHeight(_ args: Any?) {
    guard let m = args as? [String: Any],
          let h = m["height"] as? Double else { return }
    let w = canvas.bounds.width > 0 ? canvas.bounds.width : UIScreen.main.bounds.width
    canvas.contentSize = CGSize(width: w, height: CGFloat(h))
    webView.frame = CGRect(origin: .zero, size: canvas.contentSize)
  }

  // MARK: – Ink persistence

  private func loadInk(_ args: Any?) {
    guard let data = (args as? FlutterStandardTypedData)?.data,
          let drawing = try? PKDrawing(data: data) else { return }
    canvas.drawing = drawing
  }

  // PKCanvasViewDelegate — debounce saves so we don't flood Dart on every stroke
  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    saveTimer?.invalidate()
    saveTimer = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: false) { [weak self] _ in
      guard let self else { return }
      let data = self.canvas.drawing.dataRepresentation()
      self.channel.invokeMethod("onInkChanged",
                                arguments: FlutterStandardTypedData(bytes: data))
    }
  }
}
