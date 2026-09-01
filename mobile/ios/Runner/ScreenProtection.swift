import Flutter
import UIKit

/// Screenshot handling for iOS.
///
/// Two distinct mechanisms, matching how WhatsApp does this:
///
/// 1. **Detection** (always on) — `userDidTakeScreenshotNotification` fires
///    *after* the real content is already saved to Photos; nothing can undo
///    that. Used only to show a brief on-screen notice. No Photos permission
///    is needed because nothing here writes to the photo library.
/// 2. **Real blocking** (only while a quiz/exam screen is open, via
///    `SecureQuizMode`) — genuinely blanks the app's content in the actual
///    screenshot, using the same undocumented technique WhatsApp uses. See
///    `SecureQuizMode.swift` for how and why it's scoped to those screens.
final class ScreenProtection {
  private let channel: FlutterMethodChannel
  private var enabled = false
  private var observer: NSObjectProtocol?
  private var overlayWindow: UIWindow?

  init(channel: FlutterMethodChannel) {
    self.channel = channel
  }

  deinit {
    if let observer { NotificationCenter.default.removeObserver(observer) }
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "enable":
      enable()
      result(true)

    case "disable":
      disable()
      result(true)

    case "enableSecureMode":
      SecureQuizMode.enable()
      result(true)

    case "disableSecureMode":
      SecureQuizMode.disable()
      result(true)

    case "capabilities":
      result([
        // True only while a quiz/exam screen has secure mode on — see
        // SecureQuizMode. Off elsewhere in the app, matching how WhatsApp
        // only protects specific screens, not the whole app.
        "blocksScreenshots": true,
        "blocksRecording": true,
        "hidesInAppSwitcher": false,
        "detectsScreenshots": true,
      ])

    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func enable() {
    guard !enabled else { return }
    enabled = true
    observer = NotificationCenter.default.addObserver(
      forName: UIApplication.userDidTakeScreenshotNotification,
      object: nil, queue: .main
    ) { [weak self] _ in
      self?.handleScreenshotDetected()
    }
  }

  private func disable() {
    guard enabled else { return }
    enabled = false
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
  }

  // MARK: - Reaction

  private func handleScreenshotDetected() {
    channel.invokeMethod("screenshotTaken", arguments: nil)
    // Only react on screens that are actually protected. On the open hub/list
    // pages a screenshot is allowed, so flashing a "Screenshot blocked" notice
    // there would be both wrong and confusing. SecureQuizMode.isActive tracks
    // exactly that, kept in step with the route by ScreenProtection.syncForRoute.
    guard SecureQuizMode.isActive else { return }
    showBlockedOverlay()
  }

  /// Shows a solid black "Screenshot Blocked" screen in its own window, above
  /// Flutter's own rendering, for a moment.
  private func showBlockedOverlay() {
    guard let scene = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first(where: { $0.activationState == .foregroundActive }) else { return }

    let window = UIWindow(windowScene: scene)
    window.windowLevel = .alert + 1
    window.backgroundColor = .black
    window.rootViewController = BlockedScreenViewController()
    window.isHidden = false
    overlayWindow = window

    // Held for a moment so it reads as a deliberate notice, not a flicker.
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { [weak self] in
      self?.overlayWindow?.isHidden = true
      self?.overlayWindow = nil
    }
  }
}

/// Plain, solid-black notice screen shown reactively after a screenshot.
private final class BlockedScreenViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black

    let title = UILabel()
    title.text = "Screenshot Blocked"
    title.textColor = .white
    title.font = .systemFont(ofSize: 22, weight: .bold)
    title.textAlignment = .center

    let subtitle = UILabel()
    subtitle.text = "This content is protected."
    subtitle.textColor = UIColor(white: 1, alpha: 0.7)
    subtitle.font = .systemFont(ofSize: 14, weight: .regular)
    subtitle.textAlignment = .center

    let stack = UIStackView(arrangedSubviews: [title, subtitle])
    stack.axis = .vertical
    stack.spacing = 8
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 32),
      stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -32),
    ])
  }
}
