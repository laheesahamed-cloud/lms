import Foundation
import StoreKit

/// Native StoreKit 2 bridge for in-app subscriptions.
///
/// Deliberately implemented against Apple's own framework behind a
/// MethodChannel rather than via the `in_app_purchase` plugin: CocoaPods is
/// unusable in this project's build environment, so any pubspec dependency
/// shipping native iOS code fails the build. This mirrors how Sign in with Apple
/// is wired (`app.xyndrome.lk/apple_auth`) and additionally gets us StoreKit 2,
/// whose transactions are JWS-signed and verified server-side.
///
/// The bridge never decides entitlement. It hands Dart the signed JWS
/// (`jwsRepresentation`) and the backend verifies the signature, so a jailbroken
/// device cannot fake a purchase by patching the app.
@available(iOS 15.0, *)
final class StoreKitBridge {
  private var updatesTask: Task<Void, Never>?
  private let channel: FlutterMethodChannel

  /// Transactions that Dart has not yet confirmed as redeemed server-side.
  /// Finishing a transaction tells Apple it is fully delivered, so we hold off
  /// until our backend has actually granted access — otherwise a network drop
  /// between purchase and redemption would lose the purchase permanently.
  private var pendingTransactions: [String: Transaction] = [:]

  init(channel: FlutterMethodChannel) {
    self.channel = channel
    listenForTransactionUpdates()
  }

  deinit {
    updatesTask?.cancel()
  }

  // MARK: - Channel

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "products":
      let ids = (call.arguments as? [String: Any])?["productIds"] as? [String] ?? []
      Task { await self.products(ids: ids, result: result) }

    case "purchase":
      guard let id = (call.arguments as? [String: Any])?["productId"] as? String, !id.isEmpty else {
        result(FlutterError(code: "invalid_arguments", message: "productId is required", details: nil))
        return
      }
      Task { await self.purchase(productId: id, result: result) }

    case "restore":
      Task { await self.restore(result: result) }

    case "currentEntitlements":
      Task { await self.currentEntitlements(result: result) }

    case "finish":
      let id = (call.arguments as? [String: Any])?["transactionId"] as? String ?? ""
      Task { await self.finish(transactionId: id, result: result) }

    default:
      result(FlutterMethodNotImplemented)
    }
  }

  // MARK: - Products

  private func products(ids: [String], result: @escaping FlutterResult) async {
    do {
      let products = try await Product.products(for: ids)
      // Keep App Store order stable and predictable for the paywall.
      let ordered = ids.compactMap { id in products.first { $0.id == id } }
      result(ordered.map(Self.encode))
    } catch {
      result(FlutterError(code: "products_failed", message: error.localizedDescription, details: nil))
    }
  }

  private static func encode(_ product: Product) -> [String: Any] {
    var payload: [String: Any] = [
      "id": product.id,
      "displayName": product.displayName,
      "description": product.description,
      // Always Apple's localized string — never a price we format ourselves,
      // which would be wrong in every non-USD storefront.
      "displayPrice": product.displayPrice,
    ]
    if let subscription = product.subscription {
      payload["unit"] = Self.unitName(subscription.subscriptionPeriod.unit)
      payload["unitCount"] = subscription.subscriptionPeriod.value
    }
    return payload
  }

  private static func unitName(_ unit: Product.SubscriptionPeriod.Unit) -> String {
    switch unit {
    case .day: return "day"
    case .week: return "week"
    case .month: return "month"
    case .year: return "year"
    @unknown default: return "period"
    }
  }

  // MARK: - Purchase

  private func purchase(productId: String, result: @escaping FlutterResult) async {
    do {
      guard let product = try await Product.products(for: [productId]).first else {
        result(FlutterError(code: "product_not_found", message: "That plan is unavailable.", details: nil))
        return
      }

      switch try await product.purchase() {
      case .success(let verification):
        // `.unverified` means StoreKit itself could not validate the signature.
        // Surface it rather than forwarding a bad receipt to the backend.
        guard case .verified(let transaction) = verification else {
          result(FlutterError(code: "unverified", message: "This purchase could not be verified.", details: nil))
          return
        }
        pendingTransactions[String(transaction.id)] = transaction
        result([
          "status": "purchased",
          "transactionId": String(transaction.id),
          "jws": verification.jwsRepresentation,
        ])

      case .userCancelled:
        result(["status": "cancelled"])

      case .pending:
        // Ask to Buy / SCA. The result arrives later via Transaction.updates.
        result(["status": "pending"])

      @unknown default:
        result(["status": "unknown"])
      }
    } catch {
      result(FlutterError(code: "purchase_failed", message: error.localizedDescription, details: nil))
    }
  }

  // MARK: - Restore & entitlements

  private func restore(result: @escaping FlutterResult) async {
    do {
      // Pulls any purchase made on another device or before a reinstall.
      try await AppStore.sync()
    } catch {
      // A cancelled sign-in sheet throws; still report whatever we already hold.
    }
    await currentEntitlements(result: result)
  }

  private func currentEntitlements(result: @escaping FlutterResult) async {
    var payloads: [[String: Any]] = []
    for await verification in Transaction.currentEntitlements {
      guard case .verified(let transaction) = verification else { continue }
      pendingTransactions[String(transaction.id)] = transaction
      payloads.append([
        "transactionId": String(transaction.id),
        "productId": transaction.productID,
        "jws": verification.jwsRepresentation,
      ])
    }
    result(payloads)
  }

  /// Called by Dart once the backend has granted access for this transaction.
  private func finish(transactionId: String, result: @escaping FlutterResult) async {
    if let transaction = pendingTransactions.removeValue(forKey: transactionId) {
      await transaction.finish()
    }
    result(true)
  }

  // MARK: - Background updates

  /// Renewals, Ask-to-Buy approvals, and refunds arrive here rather than as the
  /// result of a `purchase()` call, so Dart is notified out of band.
  private func listenForTransactionUpdates() {
    updatesTask = Task.detached { [weak self] in
      for await verification in Transaction.updates {
        guard let self, case .verified(let transaction) = verification else { continue }
        await MainActor.run {
          self.pendingTransactions[String(transaction.id)] = transaction
          self.channel.invokeMethod("transactionUpdate", arguments: [
            "transactionId": String(transaction.id),
            "productId": transaction.productID,
            "jws": verification.jwsRepresentation,
            "revoked": transaction.revocationDate != nil,
          ])
        }
      }
    }
  }
}
