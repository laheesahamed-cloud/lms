import Flutter
import UIKit

/// Screen protection for iOS.
///
/// **iOS cannot block screenshots.** There is no public API to suppress the
/// screenshot gesture — Apple treats it as a user right, and any library
/// claiming otherwise either relies on a private API (rejected at review) or on
/// a trick that only obscures `UITextField` contents. Android's `FLAG_SECURE`
/// has no counterpart here.
///
/// What is genuinely possible, and is implemented below:
///
///  1. **Screen recording / AirPlay** — `UIScreen.isCaptured` reports when the
///     screen is being captured, so the content can be covered while it lasts.
///     This one really does deny the capture: the recording shows the cover.
///  2. **App switcher** — the snapshot iOS takes when backgrounding is covered,
///     so lesson content doesn't sit in the multitasking preview.
///  3. **Screenshot detection** — `userDidTakeScreenshot` fires *after* the
///     image is already saved. It cannot prevent anything; it only lets the app
///     tell the user that the capture was noticed.
///
/// Point 3 is a deterrent, not a control. It is reported to Dart honestly so the
/// UI never implies a screenshot was blocked when it wasn't.
final class ScreenProtection {
  private let channel: FlutterMethodChannel
  private weak var window: UIWindow?

  private var enabled = false
  private var coverView: UIView?
  private var observers: [NSObjectProtocol] = []

  init(channel: FlutterMethodChannel) {
    self.channel = channel
  }

  deinit {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
  }

  // MARK: - Channel

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "enable":
      enable()
      result(true)

    case "disable":
      disable()
      result(true)

    case "capabilities":
      // Reported truthfully so Dart can word the UI correctly per platform.
      result([
        "blocksScreenshots": false,
        "blocksRecording": true,
        "hidesInAppSwitcher": true,
        "detectsScreenshots": true,
      ])

    default:
      result(FlutterMethodNotImplemented)
    }
  }

  // MARK: - Lifecycle

  private func enable() {
    guard !enabled else { return }
    enabled = true

    let center = NotificationCenter.default

    // Fires after the screenshot is already in Photos — detection only.
    observers.append(center.addObserver(
      forName: UIApplication.userDidTakeScreenshotNotification,
      object: nil, queue: .main
    ) { [weak self] _ in
      self?.channel.invokeMethod("screenshotTaken", arguments: nil)
    })

    // Screen recording or AirPlay started/stopped.
    observers.append(center.addObserver(
      forName: UIScreen.capturedDidChangeNotification,
      object: nil, queue: .main
    ) { [weak self] _ in
      self?.applyCaptureCover()
    })

    // Cover before iOS snapshots the window for the app switcher, uncover once
    // the app is frontmost again.
    observers.append(center.addObserver(
      forName: UIApplication.willResignActiveNotification,
      object: nil, queue: .main
    ) { [weak self] _ in
      self?.showCover()
    })

    observers.append(center.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil, queue: .main
    ) { [weak self] _ in
      // Keep the cover up if a recording is still running.
      self?.applyCaptureCover()
    })

    applyCaptureCover()
  }

  private func disable() {
    guard enabled else { return }
    enabled = false
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
    hideCover()
  }

  // MARK: - Cover

  private func keyWindow() -> UIWindow? {
    if let window { return window }
    let found = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    window = found
    return found
  }

  private func applyCaptureCover() {
    if UIScreen.main.isCaptured {
      showCover()
      channel.invokeMethod("captureStateChanged", arguments: ["captured": true])
    } else {
      hideCover()
      channel.invokeMethod("captureStateChanged", arguments: ["captured": false])
    }
  }

  private func showCover() {
    guard enabled, let window = keyWindow() else { return }
    if coverView != nil { return }

    let cover = UIView(frame: window.bounds)
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    // Purely visual. If this ever lands over a system sheet (the purchase sheet,
    // or a web sign-in that resigns active), taps must still reach it — the
    // cover must never make the app unusable.
    cover.isUserInteractionEnabled = false
    cover.backgroundColor = UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 0.06, green: 0.07, blue: 0.12, alpha: 1)
        : UIColor(red: 0.98, green: 0.99, blue: 1.0, alpha: 1)
    }

    let label = UILabel()
    label.text = "Content hidden"
    label.textAlignment = .center
    label.font = .systemFont(ofSize: 15, weight: .semibold)
    label.textColor = UIColor { traits in
      traits.userInterfaceStyle == .dark ? .lightGray : .darkGray
    }
    label.translatesAutoresizingMaskIntoConstraints = false
    cover.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
    ])

    window.addSubview(cover)
    coverView = cover
  }

  private func hideCover() {
    // Never lift the cover while a recording is still in progress.
    if UIScreen.main.isCaptured && enabled { return }
    coverView?.removeFromSuperview()
    coverView = nil
  }
}
