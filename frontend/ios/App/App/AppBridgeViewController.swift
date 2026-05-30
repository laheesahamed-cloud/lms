import UIKit
import WebKit
import Capacitor
import CoreHaptics
import AudioToolbox
import AVFoundation

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
    private var scribblePlayers: [AVAudioPlayer] = []
    private var activeScribblePlayer: AVAudioPlayer?
    private var lastNativeScribbleSoundAt: TimeInterval = 0
    private var lastNativeScribbleTextureAt: TimeInterval = 0

    override var preferredStatusBarStyle: UIStatusBarStyle {
        currentStatusBarStyle
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.add(self, name: "lmsHaptics")
        configuration.userContentController.add(self, name: "lmsScribbleAudio")
        configuration.userContentController.add(self, name: "lmsSecureContent")
        configuration.userContentController.add(self, name: "lmsChromeTheme")
        configuration.userContentController.addUserScript(makeScribbleAudioUserScript())
        let webView = super.webView(with: frame, configuration: configuration)
        configureWebViewForTouch(webView)
        return webView
    }

    override func viewDidLoad() {
        view.backgroundColor = appBackground
        super.viewDidLoad()
        if let webView = bridge?.webView {
            configureWebViewForTouch(webView)
        }
        prepareHapticEngine()
    }

    private func configureWebViewForTouch(_ webView: WKWebView) {
        webView.isUserInteractionEnabled = true
        webView.isOpaque = false
        webView.backgroundColor = appBackground

        let scrollView = webView.scrollView
        scrollView.isUserInteractionEnabled = true
        scrollView.backgroundColor = appBackground
        scrollView.bounces = true
        scrollView.alwaysBounceVertical = true
        scrollView.alwaysBounceHorizontal = false
        scrollView.decelerationRate = .fast
        scrollView.delaysContentTouches = false
        scrollView.canCancelContentTouches = false
        scrollView.isDirectionalLockEnabled = false
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.scrollIndicatorInsets = .zero
        scrollView.panGestureRecognizer.cancelsTouchesInView = false
        scrollView.panGestureRecognizer.delaysTouchesBegan = false
        scrollView.panGestureRecognizer.delaysTouchesEnded = false
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }

        if message.name == "lmsHaptics" {
            DispatchQueue.main.async { [weak self] in
                self?.playHapticPayload(body)
            }
            return
        }

        if message.name == "lmsScribbleAudio" {
            DispatchQueue.main.async { [weak self] in
                self?.handleNativeScribbleSound(body)
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
        badge.text = "xyndrome"
        badge.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        badge.textColor = UIColor(red: 0.733, green: 0.925, blue: 1.0, alpha: 1)
        badge.textAlignment = .center

        let title = UILabel()
        title.text = "Screenshot blocked"
        title.font = UIFont.systemFont(ofSize: 28, weight: .bold)
        title.textColor = .white
        title.textAlignment = .center

        let message = UILabel()
        message.text = "This quiz or note is protected. Please study inside the xyndrome app instead of saving questions or notes."
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

    private func handleNativeScribbleSound(_ payload: [String: Any]) {
        let action = (payload["action"] as? String ?? "play").lowercased()
        let volume = payload["volume"] as? Double
        let mode = payload["mode"] as? String

        switch action {
        case "start":
            startNativeScribbleSound(volume: volume, mode: mode)
        case "modulate":
            modulateNativeScribbleSound(
                volume: volume,
                rate: payload["rate"] as? Double,
                brightness: payload["brightness"] as? Double,
                roughness: payload["roughness"] as? Double,
                wavePulse: payload["wavePulse"] as? Double
            )
        case "stop":
            stopNativeScribbleSound()
        default:
            playNativeScribbleSound(volume: volume, mode: mode)
        }
    }

    private func configureScribbleAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        if session.category != .playback {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        }
        try session.setActive(true)
    }

    private func startNativeScribbleSound(volume: Double?, mode: String?) {
        let soundMode = mode == "secret" ? "secret" : "spen"
        stopNativeScribbleSound()

        do {
            try configureScribbleAudioSession()

            let player = try AVAudioPlayer(data: makeScribbleWavData(mode: soundMode, loopable: true))
            let fallbackVolume = soundMode == "secret" ? 0.28 : 0.16
            player.volume = Float(min(max(volume ?? fallbackVolume, 0.04), 0.42))
            player.enableRate = true
            player.rate = soundMode == "secret" ? 0.9 : 0.78
            player.numberOfLoops = -1
            player.prepareToPlay()
            if !player.play() {
                AudioServicesPlaySystemSound(1104)
            }
            activeScribblePlayer = player
        } catch {
            AudioServicesPlaySystemSound(1104)
        }
    }

    private func modulateNativeScribbleSound(volume: Double?, rate: Double?, brightness: Double?, roughness: Double?, wavePulse: Double?) {
        guard let player = activeScribblePlayer else { return }
        let movementVolume = Float(min(max(volume ?? 0.08, 0.001), 0.5))
        let resolvedRate = Float(min(max(rate ?? Double(player.rate), 0.72), 1.28))
        player.setVolume(movementVolume, fadeDuration: 0.04)
        player.rate = resolvedRate

        _ = brightness
        _ = roughness
        _ = wavePulse
    }

    private func playNativeScribbleTexture(brightness: Double, roughness: Double, volume: Double) {
        do {
            try configureScribbleAudioSession()
            scribblePlayers.removeAll { !$0.isPlaying }
            let player = try AVAudioPlayer(data: makeScribbleTextureWavData(brightness: brightness, roughness: roughness))
            player.volume = Float(min(max(volume * (0.22 + roughness * 0.18), 0.008), 0.12))
            player.enableRate = true
            player.rate = Float(min(max(0.86 + roughness * 0.22, 0.78), 1.2))
            player.prepareToPlay()
            player.play()
            scribblePlayers.append(player)
        } catch {
            // Texture accents are optional; keep the base writing sound running.
        }
    }

    private func stopNativeScribbleSound() {
        guard let player = activeScribblePlayer else { return }
        activeScribblePlayer = nil
        let originalVolume = player.volume
        let steps = 5
        for step in 1...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(step) * 0.025) { [weak player] in
                guard let player else { return }
                let remaining = Float(max(0, steps - step)) / Float(steps)
                player.volume = originalVolume * remaining
                if step == steps {
                    player.stop()
                    player.currentTime = 0
                }
            }
        }
    }

    private func playNativeScribbleSound(volume: Double?, mode: String?) {
        let now = CACurrentMediaTime()
        let soundMode = mode == "secret" ? "secret" : "spen"
        let minimumGap = soundMode == "secret" ? 0.095 : 0.32
        if now - lastNativeScribbleSoundAt < minimumGap { return }
        lastNativeScribbleSoundAt = now

        do {
            try configureScribbleAudioSession()

            scribblePlayers.removeAll { !$0.isPlaying }
            let player = try AVAudioPlayer(data: makeScribbleWavData(mode: soundMode, loopable: false))
            let fallbackVolume = soundMode == "secret" ? 0.42 : 0.2
            player.volume = Float(min(max(volume ?? fallbackVolume, 0.05), 0.65))
            player.prepareToPlay()
            if !player.play() {
                AudioServicesPlaySystemSound(1104)
            }
            scribblePlayers.append(player)
        } catch {
            AudioServicesPlaySystemSound(1104)
        }
    }

    private func makeScribbleWavData(mode: String, loopable: Bool = false) -> Data {
        let isSecret = mode == "secret"
        let sampleRate: UInt32 = 22050
        let duration = loopable ? (isSecret ? 0.32 : 0.72) : (isSecret ? 0.085 : 0.42)
        let sampleCount = Int(Double(sampleRate) * duration)
        let bitsPerSample: UInt16 = 16
        let channels: UInt16 = 1
        let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        let dataSize = UInt32(sampleCount) * UInt32(blockAlign)

        var data = Data()
        data.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // RIFF
        appendUInt32(&data, 36 + dataSize)
        data.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // WAVE
        data.append(contentsOf: [0x66, 0x6d, 0x74, 0x20]) // fmt
        appendUInt32(&data, 16)
        appendUInt16(&data, 1)
        appendUInt16(&data, channels)
        appendUInt32(&data, sampleRate)
        appendUInt32(&data, byteRate)
        appendUInt16(&data, blockAlign)
        appendUInt16(&data, bitsPerSample)
        data.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // data
        appendUInt32(&data, dataSize)

        for index in 0..<sampleCount {
            let progress = Double(index) / Double(max(1, sampleCount - 1))
            let attack = loopable ? 1 : min(1, progress / (isSecret ? 0.08 : 0.22))
            let release = loopable ? 1 : max(0, 1 - progress)
            let envelope = attack * pow(release, isSecret ? 0.7 : 1.15)
            let grain = Double.random(in: -1...1)
            let scrape = sin(progress * .pi * Double.random(in: isSecret ? 120...210 : 24...42)) * (isSecret ? 0.24 : 0.03)
            let paper = isSecret ? 0 : sin(progress * .pi * Double.random(in: 18...30)) * 0.022
            let mixed = (grain * (isSecret ? 0.78 : 0.085) + scrape + paper) * envelope * (isSecret ? 0.58 : 0.34)
            let value = Int16(max(-1, min(1, mixed)) * 32767)
            appendInt16(&data, value)
        }

        return data
    }

    private func makeScribbleTextureWavData(brightness: Double, roughness: Double) -> Data {
        let sampleRate: UInt32 = 22050
        let duration = 0.032 + min(max(roughness, 0), 1) * 0.026
        let sampleCount = Int(Double(sampleRate) * duration)
        let bitsPerSample: UInt16 = 16
        let channels: UInt16 = 1
        let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        let dataSize = UInt32(sampleCount) * UInt32(blockAlign)
        let normalizedBrightness = min(max(brightness, 260), 2600) / 2600

        var data = Data()
        data.append(contentsOf: [0x52, 0x49, 0x46, 0x46])
        appendUInt32(&data, 36 + dataSize)
        data.append(contentsOf: [0x57, 0x41, 0x56, 0x45])
        data.append(contentsOf: [0x66, 0x6d, 0x74, 0x20])
        appendUInt32(&data, 16)
        appendUInt16(&data, 1)
        appendUInt16(&data, channels)
        appendUInt32(&data, sampleRate)
        appendUInt32(&data, byteRate)
        appendUInt16(&data, blockAlign)
        appendUInt16(&data, bitsPerSample)
        data.append(contentsOf: [0x64, 0x61, 0x74, 0x61])
        appendUInt32(&data, dataSize)

        for index in 0..<sampleCount {
            let progress = Double(index) / Double(max(1, sampleCount - 1))
            let attack = min(1, progress / 0.12)
            let release = pow(max(0, 1 - progress), 1.8)
            let noise = Double.random(in: -1...1) * (0.16 + roughness * 0.42)
            let scrape = sin(progress * .pi * Double.random(in: 34...(72 + normalizedBrightness * 110))) * (0.04 + roughness * 0.06)
            let fiber = sin(progress * .pi * Double.random(in: 10...26)) * 0.025
            let mixed = (noise + scrape + fiber) * attack * release * 0.42
            appendInt16(&data, Int16(max(-1, min(1, mixed)) * 32767))
        }

        return data
    }

    private func makeScribbleAudioUserScript() -> WKUserScript {
        let source = """
        (() => {
          if (window.__lmsScribbleAudioInstalled) return;
          window.__lmsScribbleAudioInstalled = true;
          let last = 0;
          const post = (volume = 1) => {
            const now = Date.now();
            if (now - last < 70) return;
            last = now;
            try {
              window.webkit?.messageHandlers?.lmsScribbleAudio?.postMessage({ volume });
            } catch (_) {}
          };
          const isCanvasInput = target => !!target?.closest?.('[data-lms-canvas-input="true"]');
          ['beforeinput', 'input', 'compositionupdate', 'keydown'].forEach(type => {
            document.addEventListener(type, event => {
              if (isCanvasInput(event.target)) post(1);
            }, true);
          });
          ['pointerdown', 'touchstart', 'focusin'].forEach(type => {
            document.addEventListener(type, event => {
              if (isCanvasInput(event.target)) post(0.55);
            }, true);
          });
          ['pointermove', 'touchmove'].forEach(type => {
            document.addEventListener(type, event => {
              if (isCanvasInput(event.target)) post(0.9);
            }, true);
          });
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    }

    private func appendUInt16(_ data: inout Data, _ value: UInt16) {
        var littleEndian = value.littleEndian
        withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
    }

    private func appendUInt32(_ data: inout Data, _ value: UInt32) {
        var littleEndian = value.littleEndian
        withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
    }

    private func appendInt16(_ data: inout Data, _ value: Int16) {
        var littleEndian = value.littleEndian
        withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
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
