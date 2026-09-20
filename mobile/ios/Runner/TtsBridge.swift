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

  override init() {
    super.init()
    synthesizer.delegate = self
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
      utterance.voice = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate
      synthesizer.speak(utterance)
      result(true)

    case "stop":
      synthesizer.stopSpeaking(at: .immediate)
      result(true)

    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
