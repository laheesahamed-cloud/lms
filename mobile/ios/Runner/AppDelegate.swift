import AuthenticationServices
import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var pushChannel: FlutterMethodChannel?
  private var pendingToken: String?
  private var appleAuthHandler: AppleSignInHandler?
  private var pencilChannel: FlutterMethodChannel?
  private var pencilInteraction: UIPencilInteraction?
  private var storeKitBridge: AnyObject?
  private var screenProtection: ScreenProtection?

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

    // Apple Pencil double-tap → send "doubleTap" to Dart for eraser toggle.
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "XyndromePencil")?.messenger() {
      let ch = FlutterMethodChannel(name: "app.xyndrome.lk/pencil", binaryMessenger: messenger)
      pencilChannel = ch
      DispatchQueue.main.async { self.attachPencilInteraction() }
    }

    // Native Sign in with Apple. Flutter calls "signIn"; we run the system
    // ASAuthorization flow and return { identityToken, fullName?, email? } — or
    // nil if the user cancels. The backend (/auth/apple) verifies the token.
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "XyndromeAppleAuth")?.messenger() {
      let appleChannel = FlutterMethodChannel(name: "app.xyndrome.lk/apple_auth", binaryMessenger: messenger)
      appleChannel.setMethodCallHandler { [weak self] call, result in
        switch call.method {
        case "signIn":
          let handler = AppleSignInHandler { outcome in
            DispatchQueue.main.async {
              switch outcome {
              case .success(let payload):
                result(payload) // nil = cancelled, dict = signed in
              case .failure(let error):
                result(FlutterError(code: "apple_auth_failed",
                                    message: error.localizedDescription,
                                    details: nil))
              }
              self?.appleAuthHandler = nil
            }
          }
          self?.appleAuthHandler = handler
          handler.start()
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    // In-app subscriptions via StoreKit 2. The bridge returns Apple-signed
    // transactions (JWS); the backend (/subscriptions/apple/verify) verifies the
    // signature before granting anything, so nothing here is trusted on its own.
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "XyndromeStoreKit")?.messenger() {
      let storeChannel = FlutterMethodChannel(name: "app.xyndrome.lk/storekit", binaryMessenger: messenger)
      if #available(iOS 15.0, *) {
        let bridge = StoreKitBridge(channel: storeChannel)
        storeKitBridge = bridge
        storeChannel.setMethodCallHandler { call, result in
          bridge.handle(call, result: result)
        }
      } else {
        // Below iOS 15 there is no StoreKit 2; report unavailable rather than
        // crashing, and the paywall stays hidden.
        storeChannel.setMethodCallHandler { _, result in
          result(FlutterError(code: "unsupported_os",
                              message: "In-app purchases require iOS 15 or later.",
                              details: nil))
        }
      }
    }

    // Screen protection. iOS cannot block the screenshot gesture (no public
    // API exists), so this covers the screen during recording/AirPlay and in
    // the app switcher, and reports screenshots after the fact.
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "XyndromeScreenProtection")?.messenger() {
      let protectionChannel = FlutterMethodChannel(name: "app.xyndrome.lk/screen_protection",
                                                   binaryMessenger: messenger)
      let protection = ScreenProtection(channel: protectionChannel)
      screenProtection = protection
      protectionChannel.setMethodCallHandler { call, result in
        protection.handle(call, result: result)
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

  func attachPencilInteraction() {
    let interaction = UIPencilInteraction()
    interaction.delegate = self
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?
      .addInteraction(interaction)
    pencilInteraction = interaction
  }
}

extension AppDelegate: UIPencilInteractionDelegate {
  func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
    pencilChannel?.invokeMethod("doubleTap", arguments: nil)
  }
}

/// Drives one native Sign in with Apple request. Held strongly by AppDelegate
/// for the duration of the (async) system sheet, then released.
final class AppleSignInHandler: NSObject, ASAuthorizationControllerDelegate,
                                ASAuthorizationControllerPresentationContextProviding {
  private let completion: (Result<[String: Any]?, Error>) -> Void
  private var finished = false

  init(completion: @escaping (Result<[String: Any]?, Error>) -> Void) {
    self.completion = completion
    super.init()
  }

  func start() {
    let request = ASAuthorizationAppleIDProvider().createRequest()
    request.requestedScopes = [.fullName, .email]
    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let keyWindow = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
    return keyWindow ?? ASPresentationAnchor()
  }

  func authorizationController(controller: ASAuthorizationController,
                               didCompleteWithAuthorization authorization: ASAuthorization) {
    guard !finished else { return }
    finished = true
    guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
          let tokenData = credential.identityToken,
          let token = String(data: tokenData, encoding: .utf8) else {
      completion(.failure(NSError(domain: "apple_auth", code: -1,
                                  userInfo: [NSLocalizedDescriptionKey: "No identity token returned"])))
      return
    }
    var payload: [String: Any] = ["identityToken": token]
    if let name = credential.fullName {
      let parts = [name.givenName, name.familyName].compactMap { $0 }.filter { !$0.isEmpty }
      if !parts.isEmpty { payload["fullName"] = parts.joined(separator: " ") }
    }
    if let email = credential.email, !email.isEmpty { payload["email"] = email }
    completion(.success(payload))
  }

  func authorizationController(controller: ASAuthorizationController,
                               didCompleteWithError error: Error) {
    guard !finished else { return }
    finished = true
    if let authError = error as? ASAuthorizationError, authError.code == .canceled {
      completion(.success(nil)) // user cancelled the sheet
      return
    }
    completion(.failure(error))
  }
}
