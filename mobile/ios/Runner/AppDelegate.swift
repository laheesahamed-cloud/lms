import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var pushChannel: FlutterMethodChannel?
  private var pendingToken: String?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Do NOT ask for notification permission at launch — that prompts before the
    // user has any context. The app requests it on demand (after login, via a
    // priming sheet) by calling the "requestAuthorization" method channel below.
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "XyndromePush")?.messenger() {
      let channel = FlutterMethodChannel(name: "app.xyndrome.lk/push", binaryMessenger: messenger)
      channel.setMethodCallHandler { [weak self] call, result in
        switch call.method {
        case "getApnsToken":
          result(self?.pendingToken)
        case "requestAuthorization":
          // Triggered when the user opts in (priming sheet → Enable). Show the
          // OS dialog, then register with APNs so we can receive push tokens.
          UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            DispatchQueue.main.async {
              if granted {
                UIApplication.shared.registerForRemoteNotifications()
              }
              result(granted)
            }
          }
        default:
          result(FlutterMethodNotImplemented)
        }
      }
      pushChannel = channel
      // Flush a token that arrived before the channel existed.
      if let token = pendingToken {
        channel.invokeMethod("apnsToken", arguments: token)
      }
    }
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    pendingToken = hex
    pushChannel?.invokeMethod("apnsToken", arguments: hex)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("APNs registration failed: \(error.localizedDescription)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
}
