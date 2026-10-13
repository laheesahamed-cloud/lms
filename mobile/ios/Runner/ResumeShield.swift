import AVFoundation
import UIKit

extension UIWindow {
  /// Marks a window this app puts ON TOP of Flutter — the resume shield and
  /// the post-screenshot notice. `SecureQuizMode.rootFlutterView()` skips
  /// these: wrapping one of them in the secure field instead of the real
  /// FlutterView installs protection that protects nothing.
  private static let overlayTag = "app.xyndrome.lk.overlay-window"

  var isXyndromeOverlayWindow: Bool {
    get { accessibilityIdentifier == Self.overlayTag }
    set { accessibilityIdentifier = newValue ? Self.overlayTag : nil }
  }
}

/// Shows a pixel-perfect snapshot of the screen in a capture-protected layer
/// while the secure-text shield is being rebuilt.
///
/// The point is that the user sees nothing happen. Measured on a device:
///
///   * `AVSampleBufferDisplayLayer.preventsCapture` (public, documented, iOS
///     13+) excludes the layer's own displayed frame from screenshots, and a
///     capture shows WHATEVER IS BEHIND IT — not black.
///   * A FRESH protected layer is excluded from its first frame. No delay. The
///     secure-text canvas, by contrast, needs over a second of foreground time
///     before it excludes anything, which is the gap this covers.
///   * Re-using a layer does not work: exclusion is lost whenever iOS suspends
///     the app's render context, and re-asserting it changes nothing. So every
///     raise builds a new window AND a new layer.
///
/// Which gives, during the gap:
///
///     shield window   fresh protected layer showing the snapshot
///                     -> the user sees their lesson; a capture skips it
///     app window      Flutter paints the "screenshot blocked" placeholder
///                     -> a capture records the placeholder
///
/// It is still a cover, but an invisible one — the honest framing is that the
/// gap cannot be removed on the secure-field path, only hidden.
///
/// A separate `UIWindow` on purpose. An opaque cover added as a subview of the
/// app's own window broke secure-field registration outright; a window has its
/// own layer tree, which may keep it clear of whatever that disturbed.
final class ResumeShield {
  static let shared = ResumeShield()

  private var window: UIWindow?
  private var snapshot: CGImage?

  var hasSnapshot: Bool { snapshot != nil }

  /// Latest frame of the protected screen, pushed from Dart while it is still
  /// on screen — so rendering it leaks nothing that was not already visible.
  func updateSnapshot(_ png: Data) {
    snapshot = UIImage(data: png)?.cgImage
  }

  /// Always builds a new window and a new layer; reused ones stay dead.
  @discardableResult
  func raise() -> Bool {
    guard let img = snapshot else { return false }
    guard let scene = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first(where: { $0.activationState == .foregroundActive })
      ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
    else { return false }

    lower()
    let w = UIWindow(windowScene: scene)
    w.isXyndromeOverlayWindow = true
    w.windowLevel = .alert + 1
    w.backgroundColor = .clear
    w.isUserInteractionEnabled = true
    let vc = UIViewController()
    let v = ProtectedImageView(frame: scene.coordinateSpace.bounds)
    // Touches are absorbed for the duration. A scroll or pencil stroke started
    // the instant the app returns would otherwise move content the frozen
    // snapshot cannot follow, and jump when the shield drops.
    v.isUserInteractionEnabled = true
    v.show(img)
    vc.view = v
    w.rootViewController = vc
    w.isHidden = false
    window = w
    return true
  }

  func lower() {
    window?.isHidden = true
    window = nil
  }
}

/// A view whose layer is capture-protected and displays a single still frame.
final class ProtectedImageView: UIView {
  override class var layerClass: AnyClass { AVSampleBufferDisplayLayer.self }
  private var displayLayer: AVSampleBufferDisplayLayer { layer as! AVSampleBufferDisplayLayer }
  private var current: CGImage?

  override init(frame: CGRect) {
    super.init(frame: frame)
    displayLayer.preventsCapture = true
    displayLayer.videoGravity = .resize
    backgroundColor = .clear
    // Deliberately no foreground observer: re-asserting `preventsCapture` and
    // re-enqueueing was measured and does NOT revive a dead layer. A new
    // instance is the only thing that works, so ResumeShield makes one.
  }

  required init?(coder: NSCoder) { fatalError("not used") }

  func show(_ image: CGImage) {
    current = image
    guard let sb = Self.sampleBuffer(from: image) else { return }
    if #available(iOS 17.0, *) {
      let r = displayLayer.sampleBufferRenderer
      if r.status == .failed || r.requiresFlushToResumeDecoding { r.flush() }
      r.enqueue(sb)
    } else {
      if displayLayer.status == .failed || displayLayer.requiresFlushToResumeDecoding {
        displayLayer.flush()
      }
      displayLayer.enqueue(sb)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if let img = current { show(img) }
  }

  static func sampleBuffer(from image: CGImage) -> CMSampleBuffer? {
    let w = image.width, h = image.height
    let attrs: [CFString: Any] = [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
      kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary,
    ]
    var pbOut: CVPixelBuffer?
    guard CVPixelBufferCreate(kCFAllocatorDefault, w, h, kCVPixelFormatType_32BGRA,
                              attrs as CFDictionary, &pbOut) == kCVReturnSuccess,
          let pb = pbOut else { return nil }

    CVPixelBufferLockBaseAddress(pb, [])
    if let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: w, height: h,
                           bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
                           space: CGColorSpaceCreateDeviceRGB(),
                           bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                             | CGBitmapInfo.byteOrder32Little.rawValue) {
      ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    CVPixelBufferUnlockBaseAddress(pb, [])

    var fmt: CMVideoFormatDescription?
    CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault,
                                                 imageBuffer: pb, formatDescriptionOut: &fmt)
    guard let format = fmt else { return nil }
    var timing = CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: .zero,
                                    decodeTimeStamp: .invalid)
    var sbOut: CMSampleBuffer?
    CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: pb,
                                             formatDescription: format, sampleTiming: &timing,
                                             sampleBufferOut: &sbOut)
    guard let sb = sbOut else { return nil }
    if let arr = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: true),
       CFArrayGetCount(arr) > 0 {
      let dict = unsafeBitCast(CFArrayGetValueAtIndex(arr, 0), to: CFMutableDictionary.self)
      CFDictionarySetValue(dict,
                           Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
                           Unmanaged.passUnretained(kCFBooleanTrue).toOpaque())
    }
    return sb
  }
}
