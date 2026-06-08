import SwiftUI

@Observable
@MainActor
final class BillingViewModel {
    nonisolated init() {}
    var billing: SubscriptionResponse?
    var isLoading = false
    var error: String?
    var successMessage: String?
    var requestingPlanId: Int?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            billing = try await APIClient.shared.request(.mySubscription)
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func requestManualPayment(plan: SubscriptionPlan, proof: PaymentProofPayload? = nil) async {
        requestingPlanId = plan.id
        error = nil
        successMessage = nil
        defer { requestingPlanId = nil }
        do {
            let body = ManualPaymentRequest(
                planId: plan.id,
                message: proof?.dataUrl == nil ? "Native iOS bank transfer invoice request." : "Native iOS bank transfer proof upload.",
                paymentReference: proof?.paymentReference,
                proofFileName: proof?.fileName,
                proofMimeType: proof?.mimeType,
                proofDataUrl: proof?.dataUrl
            )
            let response: SubscriptionRequestResponse = try await APIClient.shared.request(.requestManualPayment, body: body)
            if response.proofUploaded == true, let invoiceId = response.invoiceId {
                successMessage = "Payment proof uploaded for invoice #\(invoiceId)."
            } else if response.proofUploaded == true {
                successMessage = "Payment proof uploaded."
            } else if let invoiceId = response.invoiceId {
                successMessage = "Invoice #\(invoiceId) created."
            } else {
                successMessage = "Payment request submitted."
            }
            await load()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct BillingView: View {
    @State private var vm = BillingViewModel()
    @State private var selectedPlanForProof: SubscriptionPlan?

    var body: some View {
        Group {
            if vm.isLoading && vm.billing == nil {
                LoadingView(message: "Loading subscription...")
            } else if let err = vm.error, vm.billing == nil {
                ErrorView(message: err, onRetry: { Task { await vm.load() } })
            } else {
                billingContent
            }
        }
        .navigationTitle("Subscription")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedPlanForProof) { plan in
            PaymentProofUploadView(
                plan: plan,
                isSubmitting: vm.requestingPlanId == plan.id,
                error: vm.error,
                onCancel: { selectedPlanForProof = nil },
                onSubmit: { proof in
                    Task {
                        await vm.requestManualPayment(plan: plan, proof: proof)
                        if vm.error == nil {
                            selectedPlanForProof = nil
                        }
                    }
                }
            )
        }
        .task { await vm.load() }
    }

    @ViewBuilder
    private var billingContent: some View {
        ScrollView {
            LazyVStack(spacing: XyndromeTheme.Spacing.lg) {
                currentPlanSection

                if let success = vm.successMessage {
                    FeedbackRow(icon: "checkmark.circle.fill", message: success, color: XyndromeTheme.Colors.success)
                }

                if let error = vm.error {
                    FeedbackRow(icon: "exclamationmark.circle.fill", message: error, color: XyndromeTheme.Colors.error)
                }

                if let billing = vm.billing, !billing.availablePlans.isEmpty {
                    plansSection(billing.availablePlans)
                }
            }
            .padding(XyndromeTheme.Spacing.md)
            .padding(.bottom, XyndromeTheme.Spacing.xl)
        }
        .background(XyndromeTheme.Colors.surface)
        .refreshable { await vm.load() }
    }

    @ViewBuilder
    private var currentPlanSection: some View {
        if let subscription = vm.billing?.subscription {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                        Text(vm.billing?.plan?.name ?? subscription.planName ?? "Current Plan")
                            .font(XyndromeTheme.Typography.title3())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                        Text((subscription.computedStatus ?? subscription.status).capitalized)
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(subscription.isActive ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                Capsule().fill(subscription.isActive
                                               ? XyndromeTheme.Colors.success.opacity(0.1)
                                               : XyndromeTheme.Colors.error.opacity(0.1))
                            )
                    }

                    Spacer()

                    if let price = vm.billing?.plan?.price {
                        Text(priceText(price, currency: vm.billing?.plan?.currency))
                            .font(XyndromeTheme.Typography.title2())
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                    }
                }

                if let expiry = vm.billing?.expiryDate {
                    Label("Expires \(expiry)", systemImage: "calendar")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }
            .padding(XyndromeTheme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                    .fill(XyndromeTheme.Colors.surfaceSecondary)
            )
        } else {
            VStack(spacing: XyndromeTheme.Spacing.sm) {
                Image(systemName: "creditcard")
                    .font(.system(size: 44))
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                Text("No active subscription")
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text("Choose a plan to unlock full access to courses, quizzes, and AI notes.")
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(XyndromeTheme.Spacing.xl)
            .frame(maxWidth: .infinity)
        }
    }

    private func plansSection(_ plans: [SubscriptionPlan]) -> some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            Text("Plans")
                .font(XyndromeTheme.Typography.title3())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)

            ForEach(plans) { plan in
                planRow(plan)
            }
        }
    }

    private func planRow(_ plan: SubscriptionPlan) -> some View {
        let pending = pendingRequest(for: plan)
        return VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                    HStack(spacing: XyndromeTheme.Spacing.xs) {
                        Text(plan.name)
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        if plan.recommended {
                            Text("Recommended")
                                .font(XyndromeTheme.Typography.caption2())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(XyndromeTheme.Colors.primary))
                        }
                    }

                    if let days = plan.durationDays {
                        Text("\(days) days")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                }

                Spacer()

                if let price = plan.price {
                    Text(priceText(price, currency: plan.currency))
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                }
            }

            if let features = plan.features, !features.isEmpty {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                    ForEach(features.prefix(3), id: \.self) { feature in
                        Label(feature, systemImage: "checkmark")
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                }
            }

            if let pending {
                Label(pending.paymentProofDataUrl?.isEmpty == false ? "Waiting for approval" : "Invoice pending", systemImage: "clock")
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.warning)

                if pending.paymentProofDataUrl?.isEmpty != false {
                    Button {
                        selectedPlanForProof = plan
                    } label: {
                        Text("Upload Payment Proof")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(vm.requestingPlanId != nil)
                }
            } else {
                Button {
                    selectedPlanForProof = plan
                } label: {
                    if vm.requestingPlanId == plan.id {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Bank Transfer")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(vm.requestingPlanId != nil)
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }

    private func pendingRequest(for plan: SubscriptionPlan) -> SubscriptionRequest? {
        vm.billing?.requests.first {
            $0.planId == plan.id && $0.status == "pending"
        }
    }

    private func priceText(_ price: Double, currency: String?) -> String {
        "\(currency ?? "LKR") \(Int(price.rounded()))"
    }
}

private struct FeedbackRow: View {
    let icon: String
    let message: String
    let color: Color

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            Image(systemName: icon)
            Text(message)
            Spacer()
        }
        .font(XyndromeTheme.Typography.subheadline())
        .foregroundStyle(color)
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(color.opacity(0.08))
        )
    }
}
