import UIKit
import WebKit
import Capacitor
import CoreHaptics
import AudioToolbox

final class AppBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private var appBackground = UIColor(red: 0.862745098, green: 0.9019607843, blue: 0.9568627451, alpha: 1)
    private var currentStatusBarStyle: UIStatusBarStyle = .darkContent
    private var hapticEngine: CHHapticEngine?
    private var secureContentField: UITextField?
    private var secureContentBlockedView: UIView?
    private weak var protectedWebView: WKWebView?
    private weak var protectedWebViewOriginalSuperview: UIView?
    private var protectedWebViewOriginalIndex: Int?
    private var protectedWebViewOriginalAutoresizingMask: UIView.AutoresizingMask = []

    override var preferredStatusBarStyle: UIStatusBarStyle {
        currentStatusBarStyle
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.add(self, name: "lmsHaptics")
        configuration.userContentController.add(self, name: "lmsSecureContent")
        configuration.userContentController.add(self, name: "lmsChromeTheme")
        let webView = super.webView(with: frame, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = appBackground
        webView.scrollView.backgroundColor = appBackground
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.decelerationRate = .fast
        webView.scrollView.delaysContentTouches = false
        webView.scrollView.canCancelContentTouches = true
        webView.scrollView.isDirectionalLockEnabled = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.scrollIndicatorInsets = .zero
        return webView
    }

    override func viewDidLoad() {
        view.backgroundColor = appBackground
        super.viewDidLoad()
        bridge?.webView?.isOpaque = false
        bridge?.webView?.backgroundColor = appBackground
        bridge?.webView?.scrollView.backgroundColor = appBackground
        bridge?.webView?.scrollView.bounces = true
        bridge?.webView?.scrollView.alwaysBounceVertical = true
        bridge?.webView?.scrollView.alwaysBounceHorizontal = false
        bridge?.webView?.scrollView.decelerationRate = .fast
        bridge?.webView?.scrollView.delaysContentTouches = false
        bridge?.webView?.scrollView.canCancelContentTouches = true
        bridge?.webView?.scrollView.isDirectionalLockEnabled = true
        bridge?.webView?.scrollView.contentInsetAdjustmentBehavior = .never
        bridge?.webView?.scrollView.scrollIndicatorInsets = .zero
        prepareHapticEngine()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }

        if message.name == "lmsHaptics" {
            DispatchQueue.main.async { [weak self] in
                self?.playHapticPayload(body)
            }
            return
        }

        if message.name == "lmsSecureContent" {
            setSecureContentProtection(active: body["active"] as? Bool == true)
            return
        }

        if message.name == "lmsChromeTheme" {
            DispatchQueue.main.async { [weak self] in
                self?.applyChromeTheme(body)
            }
        }
    }

    private func applyChromeTheme(_ payload: [String: Any]) {
        let theme = (payload["theme"] as? String ?? "").lowercased()
        let color = uiColor(fromHex: payload["color"] as? String) ?? appBackground

        appBackground = color
        currentStatusBarStyle = theme == "dark" || color.isDarkColor ? .lightContent : .darkContent
        applyAppBackground(color)
        setNeedsStatusBarAppearanceUpdate()
    }

    private func applyAppBackground(_ color: UIColor) {
        view.backgroundColor = color
        view.window?.backgroundColor = color
        bridge?.webView?.backgroundColor = color
        bridge?.webView?.scrollView.backgroundColor = color
    }

    private func setSecureContentProtection(active: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            active ? self.enableSecureContentProtection() : self.disableSecureContentProtection()
        }
    }

    private func enableSecureContentProtection() {
        guard secureContentField == nil else { return }
        guard let webView = bridge?.webView else { return }
        guard let originalSuperview = webView.superview else { return }

        protectedWebView = webView
        protectedWebViewOriginalSuperview = originalSuperview
        protectedWebViewOriginalIndex = originalSuperview.subviews.firstIndex(of: webView)
        protectedWebViewOriginalAutoresizingMask = webView.autoresizingMask

        let secureField = UITextField(frame: originalSuperview.bounds)
        secureField.isSecureTextEntry = true
        secureField.autocorrectionType = .no
        secureField.autocapitalizationType = .none
        secureField.spellCheckingType = .no
        secureField.textColor = .clear
        secureField.tintColor = .clear
        secureField.backgroundColor = .clear
        secureField.borderStyle = .none
        secureField.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let insertIndex = min(protectedWebViewOriginalIndex ?? originalSuperview.subviews.count, originalSuperview.subviews.count)
        let blockedView = makeSecureContentBlockedView(frame: originalSuperview.bounds)

        webView.removeFromSuperview()
        originalSuperview.insertSubview(blockedView, at: insertIndex)
        originalSuperview.insertSubview(secureField, at: min(insertIndex + 1, originalSuperview.subviews.count))
        secureField.layoutIfNeeded()

        guard let secureCanvas = secureCanvasView(in: secureField) else {
            webView.frame = originalSuperview.bounds
            webView.autoresizingMask = protectedWebViewOriginalAutoresizingMask
            originalSuperview.insertSubview(webView, at: insertIndex)
            secureField.removeFromSuperview()
            blockedView.removeFromSuperview()
            clearSecureContentState()
            return
        }

        secureCanvas.backgroundColor = .clear
        secureCanvas.frame = secureField.bounds
        secureCanvas.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        webView.frame = secureCanvas.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        secureCanvas.addSubview(webView)

        secureContentBlockedView = blockedView
        secureContentField = secureField
    }

    private func disableSecureContentProtection() {
        guard let secureField = secureContentField else { return }
        guard let webView = protectedWebView else {
            secureField.removeFromSuperview()
            secureContentBlockedView?.removeFromSuperview()
            clearSecureContentState()
            return
        }

        guard let fallbackSuperview = view else {
            secureField.removeFromSuperview()
            secureContentBlockedView?.removeFromSuperview()
            clearSecureContentState()
            return
        }
        let originalSuperview = protectedWebViewOriginalSuperview ?? fallbackSuperview
        let insertIndex = min(protectedWebViewOriginalIndex ?? originalSuperview.subviews.count, originalSuperview.subviews.count)

        webView.removeFromSuperview()
        webView.frame = originalSuperview.bounds
        webView.autoresizingMask = protectedWebViewOriginalAutoresizingMask
        originalSuperview.insertSubview(webView, at: insertIndex)
        secureField.removeFromSuperview()
        secureContentBlockedView?.removeFromSuperview()
        clearSecureContentState()
    }

    private func makeSecureContentBlockedView(frame: CGRect) -> UIView {
        let container = UIView(frame: frame)
        container.backgroundColor = UIColor(red: 0.043, green: 0.071, blue: 0.106, alpha: 1)
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        let badge = UILabel()
        badge.text = "ERPM LMS"
        badge.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        badge.textColor = UIColor(red: 0.733, green: 0.925, blue: 1.0, alpha: 1)
        badge.textAlignment = .center

        let title = UILabel()
        title.text = "Screenshot blocked"
        title.font = UIFont.systemFont(ofSize: 28, weight: .bold)
        title.textColor = .white
        title.textAlignment = .center

        let message = UILabel()
        message.text = "This quiz or note is protected. Please study inside the ERPM Medical LMS app instead of saving questions or notes."
        message.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        message.textColor = UIColor(white: 1, alpha: 0.76)
        message.textAlignment = .center
        message.numberOfLines = 0

        stack.addArrangedSubview(badge)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(message)
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -28),
            message.widthAnchor.constraint(lessThanOrEqualToConstant: 320)
        ])

        return container
    }

    private func secureCanvasView(in secureField: UITextField) -> UIView? {
        return secureField.subviews.first { subview in
            let className = String(describing: type(of: subview))
            return className.contains("Canvas") || className.contains("Content")
        } ?? secureField.subviews.first
    }

    private func clearSecureContentState() {
        secureContentField = nil
        secureContentBlockedView = nil
        protectedWebView = nil
        protectedWebViewOriginalSuperview = nil
        protectedWebViewOriginalIndex = nil
        protectedWebViewOriginalAutoresizingMask = []
    }

    private func clampedHapticValue(_ value: Double?, fallback: Double) -> Float {
        let resolved = value ?? fallback
        return Float(min(max(resolved, 0), 1))
    }

    private func uiColor(fromHex hex: String?) -> UIColor? {
        guard var hex = hex?.trimmingCharacters(in: .whitespacesAndNewlines), !hex.isEmpty else {
            return nil
        }

        if hex.hasPrefix("#") {
            hex.removeFirst()
        }

        if hex.count == 3 {
            hex = hex.map { String(repeating: String($0), count: 2) }.joined()
        }

        guard hex.count == 6, let value = Int(hex, radix: 16) else {
            return nil
        }

        return UIColor(
            red: CGFloat((value >> 16) & 0xff) / 255.0,
            green: CGFloat((value >> 8) & 0xff) / 255.0,
            blue: CGFloat(value & 0xff) / 255.0,
            alpha: 1.0
        )
    }

    private func playHapticPayload(_ payload: [String: Any]) {
        let type = (payload["type"] as? String ?? "transient").lowercased()

        switch type {
        case "impact":
            playImpactHaptic(style: payload["style"] as? String)
        case "selection":
            playSelectionHaptic()
        case "notification":
            playNotificationHaptic(type: payload["notificationType"] as? String)
        default:
            let intensity = clampedHapticValue(payload["intensity"] as? Double, fallback: 0.45)
            let sharpness = clampedHapticValue(payload["sharpness"] as? Double, fallback: 0.75)
            playTransientHaptic(intensity: intensity, sharpness: sharpness)
        }
    }

    private func playImpactHaptic(style: String?) {
        let normalizedStyle = (style ?? "light").lowercased()
        let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle

        switch normalizedStyle {
        case "heavy":
            feedbackStyle = .heavy
        case "medium":
            feedbackStyle = .medium
        case "soft":
            feedbackStyle = .soft
        case "rigid":
            feedbackStyle = .rigid
        default:
            feedbackStyle = .light
        }

        let generator = UIImpactFeedbackGenerator(style: feedbackStyle)
        generator.prepare()
        generator.impactOccurred()
    }

    private func playSelectionHaptic() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    private func playNotificationHaptic(type: String?) {
        let normalizedType = (type ?? "success").lowercased()
        let feedbackType: UINotificationFeedbackGenerator.FeedbackType

        switch normalizedType {
        case "warning":
            feedbackType = .warning
        case "error":
            feedbackType = .error
        default:
            feedbackType = .success
        }

        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(feedbackType)
    }

    private func prepareHapticEngine() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            let engine = try CHHapticEngine()
            engine.isAutoShutdownEnabled = true
            engine.stoppedHandler = { [weak self] _ in
                self?.hapticEngine = nil
            }
            engine.resetHandler = { [weak self] in
                self?.prepareHapticEngine()
            }
            try engine.start()
            hapticEngine = engine
        } catch {
            hapticEngine = nil
        }
    }

    private func playTransientHaptic(intensity: Float, sharpness: Float) {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            AudioServicesPlaySystemSound(1519)
            return
        }

        if hapticEngine == nil {
            prepareHapticEngine()
        }

        guard let hapticEngine else {
            AudioServicesPlaySystemSound(1519)
            return
        }

        do {
            let event = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
                ],
                relativeTime: 0
            )
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try hapticEngine.makePlayer(with: pattern)
            try hapticEngine.start()
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            AudioServicesPlaySystemSound(1519)
        }
    }
}

private extension UIColor {
    var isDarkColor: Bool {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0

        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return false
        }

        let luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
        return luminance < 0.48
    }
}
