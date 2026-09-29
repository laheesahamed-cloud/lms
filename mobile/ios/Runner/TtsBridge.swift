import AVFoundation
import Flutter

/// Read-aloud for the "How to approach this question" text, via Apple's
/// built-in `AVSpeechSynthesizer` — part of the OS, zero CocoaPods.
///
/// Deliberately implemented behind a MethodChannel rather than a Flutter
/// plugin: CocoaPods is unusable in this project's build environment, so any
/// pubspec dependency shipping native iOS code fails the build. Mirrors
/// StoreKitBridge / how Sign in with Apple is wired.
final class TtsBridge: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()

  /// Voice lookup walks every installed voice, so resolve it once.
  private lazy var bestVoice: AVSpeechSynthesisVoice? = Self.pickBestVoice()

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  /// The best-sounding installed voice for the device's language.
  ///
  /// `AVSpeechSynthesisVoice(language:)` — what this used to call — returns the
  /// *compact* voice, which is the flat robotic one everybody recognises. iOS
  /// also ships `enhanced` and, from iOS 16, `premium` voices that sound close
  /// to human, but they are never chosen unless you ask for them by quality.
  ///
  /// Enhanced and premium voices are downloaded on demand by the user, so what
  /// is actually installed varies per device; this takes the best present and
  /// falls back gracefully rather than assuming.
  private static func pickBestVoice() -> AVSpeechSynthesisVoice? {
    let language = AVSpeechSynthesisVoice.currentLanguageCode()
    // Match the full tag first (en-GB), then any variant of the same language
    // (en-*), so an en-US premium voice still beats an en-GB compact one.
    let prefix = String(language.prefix(2))
    let candidates = AVSpeechSynthesisVoice.speechVoices().filter {
      $0.language == language || $0.language.hasPrefix(prefix)
    }
    guard !candidates.isEmpty else {
      return AVSpeechSynthesisVoice(language: language)
    }

    func best(_ quality: AVSpeechSynthesisVoiceQuality) -> AVSpeechSynthesisVoice? {
      // Exact-language matches first, so a regional accent is kept when the
      // same quality exists in both.
      candidates.first { $0.quality == quality && $0.language == language }
        ?? candidates.first { $0.quality == quality }
    }

    if #available(iOS 16.0, *), let premium = best(.premium) {
      return premium
    }
    return best(.enhanced)
      ?? best(.default)
      ?? AVSpeechSynthesisVoice(language: language)
  }

  /// Which quality the student is actually hearing, so the app can offer to
  /// point them at Settings when only the compact voice is installed.
  private func voiceQualityName() -> String {
    guard let voice = bestVoice else { return "none" }
    if #available(iOS 16.0, *), voice.quality == .premium { return "premium" }
    switch voice.quality {
    case .enhanced: return "enhanced"
    default: return "compact"
    }
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "speak":
      let text = (call.arguments as? [String: Any])?["text"] as? String ?? ""
      guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        result(false)
        return
      }
      try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try? AVAudioSession.sharedInstance().setActive(true)
      if synthesizer.isSpeaking {
        synthesizer.stopSpeaking(at: .immediate)
      }
      let utterance = AVSpeechUtterance(string: text)
      utterance.voice = bestVoice
      // A touch under the default: this is dense clinical reasoning, not prose,
      // and the default clip rushes the clause breaks that carry the meaning.
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.95
      utterance.pitchMultiplier = 1.0
      utterance.postUtteranceDelay = 0.2
      synthesizer.speak(utterance)
      result(true)

    case "stop":
      synthesizer.stopSpeaking(at: .immediate)
      result(true)

    // Lets the app tell the student a better voice is a free download away,
    // instead of leaving them to assume this is as good as it gets.
    case "voiceQuality":
      result(voiceQualityName())

    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
