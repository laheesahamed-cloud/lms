import Flutter
import UIKit

/// Blanks the app's content in real screenshots and screen recordings.
///
/// This is a direct port of the implementation that already shipped in this
/// project's Capacitor wrapper (`frontend/ios/App/App/AppBridgeViewController
/// .swift`), adapted from the WKWebView to Flutter's `FlutterView`.
///
/// How it works — and why the layout is the way it is:
///
///   originalSuperview
///     ├─ [i]   blockedView    ← "Screenshot blocked" notice, sits BEHIND
///     └─ [i+1] secureField    ← UITextField(isSecureTextEntry: true)
///                └─ secure canvas
///                     └─ FlutterView  ← the whole app, moved in here
///
/// The OS compositor skips secure-text-entry content during *any* capture,
/// with no app code running at capture time. So in a real screenshot the
/// FlutterView is omitted and `blockedView` behind it is what lands in the
/// saved image — which is exactly the "Screenshot blocked" photo we want,
/// not a notice shown after the fact.
///
/// The essential detail, learned by breaking it twice: move the **view**
/// (`addSubview`), never the **CALayer** (`addSublayer`). Re-parenting layers
/// pulls the render surface out from under Flutter's engine and the app comes
/// up blank white. Moving a view keeps the layer and render target intact.
/// The secure field exists only to donate its capture-proof canvas — it is
/// never a real text input, has no delegate, and nothing ever reads its value.
///
/// As a plain `UITextField` it still sat in the responder chain *above* the
/// re-parented FlutterView. So when a Flutter text field resigned focus —
/// closing the "New note", planner-task or flashcard dialog — UIKit walked up
/// the chain and promoted this field to first responder. Being
/// `isSecureTextEntry`, iOS then presented the password keyboard offering the
/// saved xyndrome.lk credential: a second, ghost keyboard that ran Face ID and
/// filled nothing. It only ever appeared on capture-protected routes
/// (my-notes, planner, my-flashcards) and never on unprotected ones
/// (profile/edit), which is what pinned the cause here.
///
/// Refusing first-responder status removes it at the source. Interaction stays
/// enabled, so touches still reach the FlutterView living inside this field.
private final class SecureCanvasTextField: UITextField {
  override var canBecomeFirstResponder: Bool { false }
  override func becomeFirstResponder() -> Bool { false }
}

enum SecureQuizMode {
  private static var secureField: UITextField?
  private static var blockedView: UIView?
  private static weak var protectedView: UIView?
  private static weak var originalSuperview: UIView?
  private static var originalIndex: Int?
  private static var originalAutoresizingMask: UIView.AutoresizingMask = []
  private static var foregroundObserver: NSObjectProtocol?

  static var isActive: Bool { secureField != nil }

  // MARK: - Enable

  static func enable() {
    guard secureField == nil else { return }
    guard let flutterView = rootFlutterView(),
          let superview = flutterView.superview else { return }

    protectedView = flutterView
    originalSuperview = superview
    originalIndex = superview.subviews.firstIndex(of: flutterView)
    originalAutoresizingMask = flutterView.autoresizingMask

    let field = SecureCanvasTextField(frame: superview.bounds)
    field.isSecureTextEntry = true
    field.autocorrectionType = .no
    field.autocapitalizationType = .none
    field.spellCheckingType = .no
    field.textColor = .clear
    field.tintColor = .clear
    field.backgroundColor = .clear
    field.borderStyle = .none
    field.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    // Interaction must stay ENABLED: the FlutterView is re-parented *inside*
    // this field, and disabling it here would swallow every touch meant for
    // the app. The field never receives taps itself because the FlutterView
    // covers its full bounds. (Matches the Capacitor implementation; adding
    // `isUserInteractionEnabled = false` here is what broke touch input.)

    let insertIndex = min(originalIndex ?? superview.subviews.count, superview.subviews.count)
    let blocked = makeBlockedView(frame: superview.bounds)

    flutterView.removeFromSuperview()
    superview.insertSubview(blocked, at: insertIndex)
    superview.insertSubview(field, at: min(insertIndex + 1, superview.subviews.count))
    field.layoutIfNeeded()

    // The secure canvas is a private subview; if UIKit ever stops vending it,
    // put the app back exactly as it was rather than leaving a blank screen.
    guard let canvas = secureCanvasView(in: field) else {
      flutterView.frame = superview.bounds
      flutterView.autoresizingMask = originalAutoresizingMask
      superview.insertSubview(flutterView, at: insertIndex)
      field.removeFromSuperview()
      blocked.removeFromSuperview()
      clearState()
      return
    }

    canvas.backgroundColor = .clear
    canvas.frame = field.bounds
    canvas.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    flutterView.frame = canvas.bounds
    flutterView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    canvas.addSubview(flutterView)

    blockedView = blocked
    secureField = field
    watchForeground()
  }

  // MARK: - Surviving the app switcher

  /// Rebuilds the wrapper every time the app comes back to the foreground.
  ///
  /// The protection worked once and then quietly stopped: send the app to the
  /// switcher, open something else, come back, and screenshots saved normally
  /// again. Nothing retried, because everything believed it was still on —
  /// `secureField` was non-nil here and Dart's `_secureModeOn` mirror still
  /// said true, so `syncForRoute` early-returned on every later navigation.
  /// The app kept rendering and responding normally, which is what made it
  /// look fine.
  ///
  /// iOS does something to a secure field's private canvas across a trip
  /// through the background — the exclusion the compositor applies to it does
  /// not survive. Rather than guess at which part of that state was reset and
  /// inspect for it, this tears the wrapper down and builds a fresh one: a new
  /// field, a new canvas, the FlutterView moved back inside. That holds
  /// whatever iOS actually did.
  ///
  /// `didBecomeActive` deliberately, not `willEnterForeground`: the latter
  /// fires before iOS has finished restoring the app from its snapshot, so a
  /// wrapper rebuilt there can be torn straight back down again.
  private static func watchForeground() {
    guard foregroundObserver == nil else { return }
    // Kept for the process's lifetime rather than removed in `disable()`. The
    // handler is a no-op unless a protected screen is actually showing, and an
    // observer that is itself torn down is one more thing that can be missing
    // at the moment it is needed.
    foregroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil,
      queue: .main
    ) { _ in
      // Next run-loop turn: re-parenting the Flutter view while UIKit is still
      // mid-restore is how this broke before (blank launches, dead touches).
      DispatchQueue.main.async { rearm() }
    }
  }

  /// Re-applies protection if a protected screen is on top. No-op otherwise,
  /// so returning to the app on a hub or list screen costs nothing.
  private static func rearm() {
    guard isActive else { return }
    disable()
    enable()
  }

  // MARK: - Disable

  static func disable() {
    guard let field = secureField else { return }
    guard let flutterView = protectedView, let superview = originalSuperview else {
      field.removeFromSuperview()
      blockedView?.removeFromSuperview()
      clearState()
      return
    }

    let insertIndex = min(originalIndex ?? superview.subviews.count, superview.subviews.count)
    flutterView.removeFromSuperview()
    flutterView.frame = superview.bounds
    flutterView.autoresizingMask = originalAutoresizingMask
    superview.insertSubview(flutterView, at: insertIndex)
    field.removeFromSuperview()
    blockedView?.removeFromSuperview()
    clearState()
  }

  // MARK: - Internals

  /// Flutter's rendering view — the FlutterViewController's own view.
  private static func rootFlutterView() -> UIView? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?
      .rootViewController?.view
  }

  /// The secure text field's internal content view. Matched by class name
  /// because it's private API surface — hence the fallback in `enable()`.
  private static func secureCanvasView(in field: UITextField) -> UIView? {
    field.subviews.first { subview in
      let name = String(describing: type(of: subview))
      return name.contains("Canvas") || name.contains("Content")
    } ?? field.subviews.first
  }

  /// What actually lands in the saved screenshot.
  private static func makeBlockedView(frame: CGRect) -> UIView {
    let container = UIView(frame: frame)
    container.backgroundColor = UIColor(red: 0.043, green: 0.071, blue: 0.106, alpha: 1)
    container.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    let badge = UILabel()
    badge.text = "xyndrome"
    badge.font = UIFontMetrics(forTextStyle: .caption1)
      .scaledFont(for: UIFont.systemFont(ofSize: 13, weight: .bold))
    badge.adjustsFontForContentSizeCategory = true
    badge.textColor = UIColor(red: 0.733, green: 0.925, blue: 1.0, alpha: 1)
    badge.textAlignment = .center

    let title = UILabel()
    title.text = "Screenshot blocked"
    title.font = UIFontMetrics(forTextStyle: .title1)
      .scaledFont(for: UIFont.systemFont(ofSize: 28, weight: .bold))
    title.adjustsFontForContentSizeCategory = true
    title.textColor = .white
    title.textAlignment = .center

    let subtitle = UILabel()
    subtitle.text = "This content is protected."
    subtitle.font = UIFontMetrics(forTextStyle: .body)
      .scaledFont(for: UIFont.systemFont(ofSize: 15, weight: .regular))
    subtitle.adjustsFontForContentSizeCategory = true
    subtitle.textColor = UIColor(white: 1, alpha: 0.72)
    subtitle.textAlignment = .center
    subtitle.numberOfLines = 0

    let stack = UIStackView(arrangedSubviews: [badge, title, subtitle])
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: container.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 32),
      stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -32),
    ])

    return container
  }

  private static func clearState() {
    secureField = nil
    blockedView = nil
    protectedView = nil
    originalSuperview = nil
    originalIndex = nil
    originalAutoresizingMask = []
  }
}
