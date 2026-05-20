import UIKit
import WebKit
import Capacitor
import CoreHaptics
import AudioToolbox

final class AppBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let appBackground = UIColor(red: 0.862745098, green: 0.9019607843, blue: 0.9568627451, alpha: 1)
    private var hapticEngine: CHHapticEngine?

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.add(self, name: "lmsHaptics")
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
        guard message.name == "lmsHaptics" else { return }
        guard let body = message.body as? [String: Any] else { return }
        let intensity = clampedHapticValue(body["intensity"] as? Double, fallback: 0.45)
        let sharpness = clampedHapticValue(body["sharpness"] as? Double, fallback: 0.75)
        playTransientHaptic(intensity: intensity, sharpness: sharpness)
    }

    private func clampedHapticValue(_ value: Double?, fallback: Double) -> Float {
        let resolved = value ?? fallback
        return Float(min(max(resolved, 0), 1))
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
