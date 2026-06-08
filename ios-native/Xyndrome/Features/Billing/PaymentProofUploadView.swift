import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct PaymentProofPayload {
    let paymentReference: String?
    let fileName: String?
    let mimeType: String?
    let dataUrl: String?
}

struct PaymentProofUploadView: View {
    let plan: SubscriptionPlan
    let isSubmitting: Bool
    let error: String?
    let onCancel: () -> Void
    let onSubmit: (PaymentProofPayload?) -> Void

    @State private var paymentReference = ""
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    @State private var payload: PaymentProofPayload?
    @State private var localError: String?
    @State private var isProcessingImage = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
                    planSummary
                    proofPicker

                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                        Text("Payment Reference")
                            .font(XyndromeTheme.Typography.subheadline())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        TextField("Bank slip reference or note", text: $paymentReference, axis: .vertical)
                            .textInputAutocapitalization(.words)
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.surfaceSecondary)
                            )
                    }

                    if let message = localError ?? error {
                        Label(message, systemImage: "exclamationmark.circle.fill")
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.error)
                            .padding(XyndromeTheme.Spacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.error.opacity(0.08))
                            )
                    }
                }
                .padding(XyndromeTheme.Spacing.md)
                .padding(.bottom, XyndromeTheme.Spacing.xl)
            }
            .background(XyndromeTheme.Colors.surface)
            .navigationTitle("Payment Proof")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onSubmit(payloadWithReference)
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Submit")
                        }
                    }
                    .disabled(isSubmitting || isProcessingImage)
                }
            }
            .onChange(of: selectedItem) { _, item in
                Task { await loadImage(from: item) }
            }
        }
    }

    private var planSummary: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
            Text(plan.name)
                .font(XyndromeTheme.Typography.title3())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)

            if let price = plan.price {
                Text("\(plan.currency ?? "LKR") \(Int(price.rounded()))")
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.primary)
            }

            Text("Upload a clear bank transfer receipt. JPG or PNG under 4 MB is accepted.")
                .font(XyndromeTheme.Typography.footnote())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
        }
        .padding(XyndromeTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }

    private var proofPicker: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            Text("Receipt Image")
                .font(XyndromeTheme.Typography.subheadline())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)

            PhotosPicker(selection: $selectedItem, matching: .images) {
                ZStack {
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                        .fill(XyndromeTheme.Colors.surfaceSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                                .strokeBorder(XyndromeTheme.Colors.primary.opacity(0.18), lineWidth: 1)
                        )

                    if let selectedImage {
                        Image(uiImage: selectedImage)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity)
                            .frame(height: 220)
                            .clipShape(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg))
                    } else {
                        VStack(spacing: XyndromeTheme.Spacing.sm) {
                            Image(systemName: "photo.badge.plus")
                                .font(.system(size: 36))
                                .foregroundStyle(XyndromeTheme.Colors.primary)
                            Text(isProcessingImage ? "Processing..." : "Choose Receipt")
                                .font(XyndromeTheme.Typography.headline())
                                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            Text("Tap to select from Photos")
                                .font(XyndromeTheme.Typography.footnote())
                                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        }
                    }
                }
                .frame(height: 220)
            }
            .buttonStyle(.plain)
            .disabled(isSubmitting || isProcessingImage)

            if payload != nil {
                Label("Receipt ready to upload", systemImage: "checkmark.circle.fill")
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.success)
            }
        }
    }

    private var payloadWithReference: PaymentProofPayload? {
        let reference = paymentReference.trimmingCharacters(in: .whitespacesAndNewlines)
        if payload == nil && reference.isEmpty {
            return nil
        }
        return PaymentProofPayload(
            paymentReference: reference.isEmpty ? nil : reference,
            fileName: payload?.fileName,
            mimeType: payload?.mimeType,
            dataUrl: payload?.dataUrl
        )
    }

    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item else { return }
        isProcessingImage = true
        localError = nil
        defer { isProcessingImage = false }

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                localError = "Could not load the selected image."
                return
            }

            let normalized = try normalizedImageData(from: data)
            guard normalized.count <= 4 * 1024 * 1024 else {
                localError = "Receipt image is too large. Please choose an image under 4 MB."
                payload = nil
                selectedImage = nil
                return
            }

            selectedImage = UIImage(data: normalized)
            payload = PaymentProofPayload(
                paymentReference: nil,
                fileName: "payment-proof-\(Int(Date().timeIntervalSince1970)).jpg",
                mimeType: "image/jpeg",
                dataUrl: "data:image/jpeg;base64,\(normalized.base64EncodedString())"
            )
        } catch {
            localError = "Could not process the selected image."
        }
    }

    private func normalizedImageData(from data: Data) throws -> Data {
        guard let image = UIImage(data: data) else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let maxDimension: CGFloat = 1600
        let largestSide = max(image.size.width, image.size.height)
        let scale = largestSide > maxDimension ? maxDimension / largestSide : 1
        let targetSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)

        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let rendered = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        guard let jpeg = rendered.jpegData(compressionQuality: 0.82) else {
            throw CocoaError(.fileWriteUnknown)
        }
        return jpeg
    }
}
