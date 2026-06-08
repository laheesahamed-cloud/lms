import SwiftUI
import UIKit

struct FlashcardsView: View {
    let cards: [Flashcard]
    var title: String = "Flashcards"
    var onDone: ((FlashcardSessionResult) -> Void)?

    @State private var currentIndex = 0
    @State private var isFlipped = false
    @State private var dragOffset: CGFloat = 0
    @State private var knownIds: Set<Int> = []
    @State private var learningIds: Set<Int> = []
    @State private var result: FlashcardSessionResult?
    @Environment(\.dismiss) private var dismiss

    private var currentCard: Flashcard? {
        cards[safe: currentIndex]
    }

    private var progress: Double {
        guard !cards.isEmpty else { return 0 }
        return Double(currentIndex + 1) / Double(cards.count)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    FlashcardResultView(result: result, title: title, onRestart: restart, onDone: finish)
                } else if cards.isEmpty {
                    EmptyStateView(
                        icon: "rectangle.on.rectangle.angled",
                        title: "No Flashcards Yet",
                        message: "This lesson does not have approved flashcards yet."
                    )
                    .padding()
                } else {
                    sessionBody
                }
            }
            .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { finish() }
                }
            }
        }
    }

    private var sessionBody: some View {
        VStack(spacing: XyndromeTheme.Spacing.md) {
            FlashcardSessionHeader(
                title: title,
                current: currentIndex + 1,
                total: cards.count,
                knownCount: knownIds.count,
                learningCount: learningIds.count,
                progress: progress
            )
            .padding(.horizontal, XyndromeTheme.Spacing.md)
            .padding(.top, XyndromeTheme.Spacing.sm)

            Spacer(minLength: 0)

            if let currentCard {
                FlashcardCardView(card: currentCard, isFlipped: $isFlipped)
                    .id(currentCard.id)
                    .padding(.horizontal, XyndromeTheme.Spacing.md)
                    .offset(x: dragOffset)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                guard isFlipped else { return }
                                dragOffset = value.translation.width * 0.35
                            }
                            .onEnded { value in
                                guard isFlipped else {
                                    dragOffset = 0
                                    return
                                }
                                let threshold: CGFloat = 90
                                if value.translation.width > threshold {
                                    answer(.good)
                                } else if value.translation.width < -threshold {
                                    answer(.again)
                                }
                                withAnimation(.spring(response: 0.3)) { dragOffset = 0 }
                            }
                    )

                Text(isFlipped ? "How well did you recall this?" : "Tap the card to reveal the answer")
                    .font(XyndromeTheme.Typography.footnote())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
            }

            Spacer(minLength: 0)

            FlashcardRatingBar(isVisible: isFlipped, onRate: answer)
                .padding(.horizontal, XyndromeTheme.Spacing.md)
                .padding(.bottom, XyndromeTheme.Spacing.lg)
        }
    }

    private func answer(_ rating: FlashcardReviewRating) {
        guard isFlipped, let currentCard else { return }
        FlashcardReviewStore.record(card: currentCard, rating: rating)
        if rating.isRemembered {
            knownIds.insert(currentIndex)
        } else {
            learningIds.insert(currentIndex)
        }
        UINotificationFeedbackGenerator().notificationOccurred(rating.isRemembered ? .success : .warning)

        withAnimation(.easeInOut(duration: 0.16)) {
            isFlipped = false
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
            if currentIndex + 1 >= cards.count {
                let nextResult = FlashcardSessionResult(cards: cards, knownIds: knownIds, learningIds: learningIds)
                result = nextResult
                onDone?(nextResult)
            } else {
                withAnimation(.spring(response: 0.34)) {
                    currentIndex += 1
                }
            }
        }
    }

    private func restart() {
        currentIndex = 0
        isFlipped = false
        knownIds = []
        learningIds = []
        result = nil
    }

    private func finish() {
        dismiss()
    }
}

struct FlashcardSessionResult {
    let cards: [Flashcard]
    let knownIds: Set<Int>
    let learningIds: Set<Int>

    var scorePercent: Int {
        guard !cards.isEmpty else { return 0 }
        return Int((Double(knownIds.count) / Double(cards.count) * 100).rounded())
    }
}

private struct FlashcardSessionHeader: View {
    let title: String
    let current: Int
    let total: Int
    let knownCount: Int
    let learningCount: Int
    let progress: Double

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack(alignment: .center, spacing: XyndromeTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(1)
                    Text("Card \(current) of \(total)")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }

                Spacer()

                FlashcardCountPill(title: "Know", count: knownCount, color: XyndromeTheme.Colors.success, icon: "checkmark")
                FlashcardCountPill(title: "Review", count: learningCount, color: XyndromeTheme.Colors.warning, icon: "arrow.clockwise")
            }

            ProgressView(value: progress)
                .tint(XyndromeTheme.Colors.primary)
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

private struct FlashcardCountPill: View {
    let title: String
    let count: Int
    let color: Color
    let icon: String

    var body: some View {
        Label("\(count) \(title)", systemImage: icon)
            .font(XyndromeTheme.Typography.caption2())
            .fontWeight(.black)
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(Capsule().fill(color.opacity(0.12)))
    }
}

private struct FlashcardCardView: View {
    let card: Flashcard
    @Binding var isFlipped: Bool

    private var rotation: Double {
        isFlipped ? 180 : 0
    }

    var body: some View {
        ZStack {
            FlashcardFrontFace(card: card)
                .opacity(rotation < 90 ? 1 : 0)

            FlashcardBackFace(card: card)
                .opacity(rotation >= 90 ? 1 : 0)
                .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 430)
        .rotation3DEffect(.degrees(rotation), axis: (x: 0, y: 1, z: 0))
        .animation(.spring(response: 0.42, dampingFraction: 0.82), value: isFlipped)
        .contentShape(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.xl))
        .onTapGesture {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            isFlipped.toggle()
        }
        .accessibilityLabel(isFlipped ? "Flashcard answer" : "Flashcard question")
        .accessibilityHint("Double tap to flip")
    }
}

private struct FlashcardFrontFace: View {
    let card: Flashcard

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.md) {
            HStack {
                FlashcardBadge(title: "Q&A", color: XyndromeTheme.Colors.primary)
                FlashcardBadge(title: card.difficultyLabel, color: card.difficultyColor)
                Spacer()
            }

            Spacer(minLength: 0)

            Text(card.front)
                .font(.system(size: 22, weight: .black, design: .rounded))
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                if let source = card.sourceHint {
                    Text(source)
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                }

                Label("Tap to reveal answer", systemImage: "rectangle.2.swap")
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.bold)
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(XyndromeTheme.Colors.surfaceTertiary))
            }
        }
        .padding(XyndromeTheme.Spacing.lg)
        .frame(maxWidth: .infinity, minHeight: 430)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.xl)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
        .modifier(XyndromeTheme.Shadow.card())
    }
}

private struct FlashcardBackFace: View {
    let card: Flashcard

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack {
                FlashcardBadge(title: "Answer", color: XyndromeTheme.Colors.success)
                Spacer()
                if let source = card.sourceHint {
                    Text(source)
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                        .lineLimit(1)
                }
            }

            ScrollView {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                    Text(card.back)
                        .font(XyndromeTheme.Typography.body())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)

                    if !card.imageUrls.isEmpty {
                        FlashcardImageGallery(urls: card.imageUrls, imageFit: card.imageFit)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack {
                Button {
                    FlashcardReviewStore.report(card: card)
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                } label: {
                    Text(FlashcardReviewStore.isReported(card: card) ? "Reported" : "Report bad card")
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.bold)
                }
                .buttonStyle(.bordered)
                .disabled(FlashcardReviewStore.isReported(card: card))

                Spacer()

                Text("Swipe right = Good, left = Again")
                    .font(XyndromeTheme.Typography.caption2())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
            }
        }
        .padding(XyndromeTheme.Spacing.lg)
        .frame(maxWidth: .infinity, minHeight: 430)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.xl)
                .fill(XyndromeTheme.Colors.primary.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.xl)
                        .strokeBorder(XyndromeTheme.Colors.primary.opacity(0.22), lineWidth: 1.5)
                )
        )
        .modifier(XyndromeTheme.Shadow.card())
    }
}

private struct FlashcardImageGallery: View {
    let urls: [String]
    let imageFit: String

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: XyndromeTheme.Spacing.xs), count: min(max(urls.count, 1), 3))
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: XyndromeTheme.Spacing.xs) {
            ForEach(urls.prefix(3), id: \.self) { url in
                FlashcardImage(urlString: url, imageFit: imageFit)
                    .frame(height: urls.count == 1 ? 210 : 140)
            }
        }
    }
}

private struct FlashcardImage: View {
    let urlString: String
    let imageFit: String
    @State private var decodedDataImage: UIImage?
    @State private var didFailDataImage = false

    private var isDataImage: Bool {
        urlString.hasPrefix("data:image")
    }

    private var remoteURL: URL? {
        guard !isDataImage else { return nil }
        return URL(string: urlString)
    }

    var body: some View {
        Group {
            if isDataImage {
                if let decodedDataImage {
                    imageView(Image(uiImage: decodedDataImage))
                } else if didFailDataImage {
                    placeholder
                } else {
                    loadingPlaceholder
                }
            } else if let remoteURL {
                AsyncImage(url: remoteURL) { phase in
                    switch phase {
                    case .empty:
                        loadingPlaceholder
                    case .success(let image):
                        imageView(image)
                    case .failure:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .task(id: urlString) {
            await decodeDataImageIfNeeded()
        }
        .background(XyndromeTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .strokeBorder(XyndromeTheme.Colors.textMuted.opacity(0.12), lineWidth: 1)
        )
    }

    @MainActor
    private func decodeDataImageIfNeeded() async {
        decodedDataImage = nil
        didFailDataImage = false
        guard isDataImage else { return }

        let source = urlString
        let image = await Task.detached(priority: .utility) {
            FlashcardDataImageDecoder.decode(source)
        }.value

        guard !Task.isCancelled else { return }
        if let image {
            decodedDataImage = image
        } else {
            didFailDataImage = true
        }
    }

    private func imageView(_ image: Image) -> some View {
        image
            .resizable()
            .aspectRatio(contentMode: imageFit == "cover" ? .fill : .fit)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
    }

    private var loadingPlaceholder: some View {
        ProgressView()
            .tint(XyndromeTheme.Colors.primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var placeholder: some View {
        VStack(spacing: XyndromeTheme.Spacing.xs) {
            Image(systemName: "photo")
                .font(.system(size: 24, weight: .semibold))
            Text("Image unavailable")
                .font(XyndromeTheme.Typography.caption2())
                .fontWeight(.bold)
        }
        .foregroundStyle(XyndromeTheme.Colors.textMuted)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private enum FlashcardDataImageDecoder {
    private static let maxEncodedCharacters = 12_000_000
    private static let maxCompressedBytes = 9_000_000
    private static let maxPixelSide: CGFloat = 1_600

    static func decode(_ source: String) -> UIImage? {
        guard source.hasPrefix("data:image"),
              let comma = source.firstIndex(of: ",") else {
            return nil
        }

        let base64 = String(source[source.index(after: comma)...])
        guard base64.count <= maxEncodedCharacters,
              let data = Data(base64Encoded: base64),
              data.count <= maxCompressedBytes,
              let image = UIImage(data: data) else {
            return nil
        }

        let largestSide = max(image.size.width, image.size.height)
        guard largestSide > maxPixelSide else { return image }
        return image.preparingThumbnail(of: CGSize(width: maxPixelSide, height: maxPixelSide)) ?? image
    }
}

private struct FlashcardBadge: View {
    let title: String
    let color: Color

    var body: some View {
        Text(title)
            .font(XyndromeTheme.Typography.caption2())
            .fontWeight(.black)
            .foregroundStyle(color)
            .textCase(.uppercase)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Capsule().fill(color.opacity(0.12)))
    }
}

private struct FlashcardRatingBar: View {
    let isVisible: Bool
    let onRate: (FlashcardReviewRating) -> Void

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.xs) {
            HStack(spacing: XyndromeTheme.Spacing.xs) {
                FlashcardRatingButton(rating: .again, isEnabled: isVisible, onRate: onRate)
                FlashcardRatingButton(rating: .hard, isEnabled: isVisible, onRate: onRate)
                FlashcardRatingButton(rating: .good, isEnabled: isVisible, onRate: onRate)
                FlashcardRatingButton(rating: .easy, isEnabled: isVisible, onRate: onRate)
            }

            Text(isVisible ? "Again · Hard · Good · Easy" : "Reveal the answer to rate your recall")
                .font(XyndromeTheme.Typography.caption2())
                .fontWeight(.semibold)
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
        }
        .opacity(isVisible ? 1 : 0.45)
    }
}

private struct FlashcardRatingButton: View {
    let rating: FlashcardReviewRating
    let isEnabled: Bool
    let onRate: (FlashcardReviewRating) -> Void

    var body: some View {
        Button {
            onRate(rating)
        } label: {
            Label(rating.title, systemImage: rating.icon)
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.black)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(rating.color)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(rating.color.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .strokeBorder(rating.color.opacity(0.22), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

private struct FlashcardResultView: View {
    let result: FlashcardSessionResult
    let title: String
    let onRestart: () -> Void
    let onDone: () -> Void

    private var accent: Color {
        if result.scorePercent >= 80 { return XyndromeTheme.Colors.success }
        if result.scorePercent >= 50 { return XyndromeTheme.Colors.warning }
        return XyndromeTheme.Colors.accent
    }

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.lg) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(accent.opacity(0.12))
                .frame(width: 86, height: 86)
                .overlay {
                    Image(systemName: result.scorePercent >= 80 ? "trophy.fill" : "graduationcap.fill")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(accent)
                }

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                Text(result.scorePercent >= 80 ? "Excellent work!" : result.scorePercent >= 50 ? "Good progress!" : "Keep practicing!")
                    .font(XyndromeTheme.Typography.title1())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text(title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            }

            HStack(spacing: XyndromeTheme.Spacing.lg) {
                resultMetric(title: "Know It", value: result.knownIds.count, color: XyndromeTheme.Colors.success)
                ZStack {
                    Circle()
                        .stroke(XyndromeTheme.Colors.surfaceTertiary, lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: CGFloat(result.scorePercent) / 100)
                        .stroke(accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(result.scorePercent)%")
                            .font(.system(size: 22, weight: .black, design: .rounded))
                        Text("score")
                            .font(XyndromeTheme.Typography.caption2())
                            .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    }
                }
                .frame(width: 112, height: 112)
                resultMetric(title: "Still Learning", value: result.learningIds.count, color: XyndromeTheme.Colors.warning)
            }

            VStack(spacing: XyndromeTheme.Spacing.sm) {
                Button("Restart Deck", action: onRestart)
                    .buttonStyle(PrimaryButtonStyle())

                Button("Pick Another Lesson", action: onDone)
                    .buttonStyle(SecondaryButtonStyle())
            }
            .frame(maxWidth: 280)
        }
        .padding(XyndromeTheme.Spacing.xl)
    }

    private func resultMetric(title: String, value: Int, color: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.system(size: 34, weight: .black, design: .rounded))
                .foregroundStyle(color)
            Text(title)
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(minWidth: 74)
    }
}

enum FlashcardReviewRating: String, Codable {
    case again
    case hard
    case good
    case easy

    var title: String {
        switch self {
        case .again: "Again"
        case .hard: "Hard"
        case .good: "Good"
        case .easy: "Easy"
        }
    }

    var icon: String {
        switch self {
        case .again: "xmark"
        case .hard: "arrow.clockwise"
        case .good: "checkmark"
        case .easy: "sparkles"
        }
    }

    var color: Color {
        switch self {
        case .again: XyndromeTheme.Colors.error
        case .hard: XyndromeTheme.Colors.warning
        case .good: XyndromeTheme.Colors.success
        case .easy: XyndromeTheme.Colors.primary
        }
    }

    var isRemembered: Bool {
        self == .good || self == .easy
    }
}

private enum FlashcardReviewStore {
    private static let reviewStatsKey = "lms.flashcards.reviewStats.v1"
    private static let badIdsKey = "lms.flashcards.badIds.v1"

    static func record(card: Flashcard, rating: FlashcardReviewRating) {
        let key = storageId(for: card)
        guard !key.isEmpty else { return }
        var stats = loadStats()
        let previous = stats[key]
        let now = Date()
        let remembered = rating.isRemembered
        stats[key] = FlashcardReviewRow(
            id: key,
            questionText: card.front,
            context: card.sourceHint,
            attempts: (previous?.attempts ?? 0) + 1,
            correct: (previous?.correct ?? 0) + (remembered ? 1 : 0),
            learning: (previous?.learning ?? 0) + (remembered ? 0 : 1),
            lapses: (previous?.lapses ?? 0) + (rating == .again ? 1 : 0),
            lastRating: rating.rawValue,
            lastReviewedAt: now,
            dueAt: dueDate(previous: previous, rating: rating, now: now)
        )
        saveStats(stats)
    }

    static func report(card: Flashcard) {
        var ids = loadBadIds()
        ids.insert(storageId(for: card))
        UserDefaults.standard.set(Array(ids), forKey: badIdsKey)
    }

    static func isReported(card: Flashcard) -> Bool {
        loadBadIds().contains(storageId(for: card))
    }

    static func reviewCount(for note: AiNote) -> Int {
        let noteId = String(note.id)
        return loadStats().keys.filter { $0.hasPrefix("\(noteId)-") }.count
    }

    private static func dueDate(previous: FlashcardReviewRow?, rating: FlashcardReviewRating, now: Date) -> Date {
        let base: TimeInterval
        switch rating {
        case .again:
            base = 10 * 60
        case .hard:
            base = 30 * 60
        case .good:
            base = previous == nil ? 24 * 60 * 60 : 2 * 24 * 60 * 60
        case .easy:
            base = previous == nil ? 4 * 24 * 60 * 60 : 6 * 24 * 60 * 60
        }
        return now.addingTimeInterval(base)
    }

    private static func storageId(for card: Flashcard) -> String {
        let prefix = card.noteId.map(String.init) ?? "note"
        return "\(prefix)-qna-\(card.id)"
    }

    private static func loadStats() -> [String: FlashcardReviewRow] {
        guard let data = UserDefaults.standard.data(forKey: reviewStatsKey),
              let stats = try? JSONDecoder().decode([String: FlashcardReviewRow].self, from: data) else {
            return [:]
        }
        return stats
    }

    private static func saveStats(_ stats: [String: FlashcardReviewRow]) {
        guard let data = try? JSONEncoder().encode(stats) else { return }
        UserDefaults.standard.set(data, forKey: reviewStatsKey)
    }

    private static func loadBadIds() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: badIdsKey) ?? [])
    }
}

private struct FlashcardReviewRow: Codable {
    let id: String
    let questionText: String
    let context: String?
    let attempts: Int
    let correct: Int
    let learning: Int
    let lapses: Int
    let lastRating: String
    let lastReviewedAt: Date
    let dueAt: Date
}

@Observable
@MainActor
final class FlashcardsLibraryViewModel {
    nonisolated init() {}
    var notes: [AiNote] = []
    var activeCards: [Flashcard] = []
    var activeTitle = "Flashcards"
    var isLoading = false
    var isStarting = false
    var error: String?
    var showSession = false

    var decks: [AiNote] {
        notes
            .filter { $0.flashcardTotal > 0 }
            .sorted {
                [$0.courseTitle, $0.topicName, $0.subtopicName, $0.lessonTitle, $0.title]
                    .compactMap { $0 }
                    .joined(separator: " ")
                    .localizedStandardCompare(
                        [$1.courseTitle, $1.topicName, $1.subtopicName, $1.lessonTitle, $1.title]
                            .compactMap { $0 }
                            .joined(separator: " ")
                    ) == .orderedAscending
            }
    }

    var groups: [FlashcardCourseGroup] {
        let courseBuckets = Dictionary(grouping: decks, by: \.courseKey)
        return courseBuckets.keys.sorted { lhs, rhs in
            if lhs == "General" { return false }
            if rhs == "General" { return true }
            return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
        }.map { courseTitle in
            let notes = courseBuckets[courseTitle] ?? []
            let subjectBuckets = Dictionary(grouping: notes, by: \.subjectKey)
            let subjects = subjectBuckets.keys.sorted { lhs, rhs in
                if lhs == "General" { return false }
                if rhs == "General" { return true }
                return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
            }.map { subjectTitle in
                FlashcardSubjectGroup(
                    title: subjectTitle,
                    notes: (subjectBuckets[subjectTitle] ?? []).sorted {
                        ($0.lessonTitle ?? $0.title).localizedStandardCompare($1.lessonTitle ?? $1.title) == .orderedAscending
                    }
                )
            }
            return FlashcardCourseGroup(title: courseTitle, subjects: subjects)
        }
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            notes = try await AiNotesNativeAPI.listNotes()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func start(note: AiNote) async {
        guard !isStarting else { return }
        isStarting = true
        error = nil
        defer { isStarting = false }

        do {
            let response = try await AiNotesNativeAPI.getNote(id: note.id, preferredEngine: note.engineKey)
            let cards = response.flashcards
                .filter(\.isApproved)
                .filter { !$0.front.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !$0.back.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                .sorted {
                    if let left = $0.sortOrder, let right = $1.sortOrder, left != right {
                        return left < right
                    }
                    return $0.id < $1.id
                }
            guard !cards.isEmpty else {
                error = "This lesson does not have approved flashcards yet."
                return
            }
            activeCards = cards
            activeTitle = response.note.lessonTitle ?? response.note.title
            showSession = true
            await AiNotesNativeAPI.recordAiNoteViewed(itemId: response.note.id)
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func start(notes selectedNotes: [AiNote], title: String) async {
        guard !isStarting else { return }
        isStarting = true
        error = nil
        defer { isStarting = false }

        do {
            var cards: [Flashcard] = []
            for note in selectedNotes.filter({ !$0.accessLocked }) {
                let response = try await AiNotesNativeAPI.getNote(id: note.id, preferredEngine: note.engineKey)
                cards.append(contentsOf: response.flashcards.filter(\.isApproved))
            }
            let unique = cards.reduce(into: [Int: Flashcard]()) { result, card in
                result[card.id] = card
            }
            let sortedCards = Array(unique.values)
                .filter { !$0.front.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !$0.back.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                .sorted { $0.id < $1.id }
            guard !sortedCards.isEmpty else {
                error = "This deck does not have approved flashcards yet."
                return
            }
            activeCards = sortedCards
            activeTitle = "\(title) Flashcards"
            showSession = true
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct FlashcardCourseGroup: Identifiable {
    let title: String
    let subjects: [FlashcardSubjectGroup]

    var id: String { title }

    var notes: [AiNote] {
        subjects.flatMap(\.notes)
    }

    var cardCount: Int {
        notes.reduce(0) { $0 + $1.flashcardTotal }
    }
}

struct FlashcardSubjectGroup: Identifiable {
    let title: String
    let notes: [AiNote]

    var id: String { title }

    var cardCount: Int {
        notes.reduce(0) { $0 + $1.flashcardTotal }
    }
}

struct FlashcardsLibraryView: View {
    @State private var vm = FlashcardsLibraryViewModel()
    @State private var expandedCourses: Set<String> = []
    @State private var expandedSubjects: Set<String> = []

    var body: some View {
        Group {
            if vm.isLoading && vm.decks.isEmpty {
                FlashcardLibrarySkeleton()
            } else if let error = vm.error, vm.decks.isEmpty {
                ErrorView(message: error, onRetry: { Task { await vm.load() } })
            } else if vm.decks.isEmpty {
                EmptyStateView(
                    icon: "rectangle.on.rectangle.angled",
                    title: "No Flashcards Yet",
                    message: "Flashcards will appear here when lessons publish approved practice cards."
                )
            } else {
                deckList
            }
        }
        .background(XyndromeTheme.Colors.surface)
        .navigationTitle("Flashcards")
        .navigationBarTitleDisplayMode(.large)
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .sheet(isPresented: $vm.showSession) {
            FlashcardsView(cards: vm.activeCards, title: vm.activeTitle)
        }
        .overlay {
            if vm.isStarting {
                ProgressView("Loading deck...")
                    .padding(XyndromeTheme.Spacing.md)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg))
            }
        }
    }

    private var deckList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                FlashcardsLibraryHeader(deckCount: vm.decks.count, cardCount: vm.decks.reduce(0) { $0 + $1.flashcardTotal })

                if let error = vm.error {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.error)
                        .padding(XyndromeTheme.Spacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .fill(XyndromeTheme.Colors.error.opacity(0.08))
                        )
                }

                VStack(spacing: XyndromeTheme.Spacing.md) {
                    ForEach(vm.groups) { course in
                        FlashcardCourseSection(
                            course: course,
                            isExpanded: expandedCourses.contains(course.id),
                            expandedSubjects: $expandedSubjects,
                            onToggle: { toggleCourse(course.id) },
                            onStartCourse: { Task { await vm.start(notes: course.notes, title: course.title) } },
                            onStartSubject: { notes, title in Task { await vm.start(notes: notes, title: title) } },
                            onStartNote: { note in Task { await vm.start(note: note) } }
                        )
                    }
                }
            }
            .padding(XyndromeTheme.Spacing.md)
            .padding(.bottom, XyndromeTheme.Spacing.xl)
        }
    }

    private func toggleCourse(_ id: String) {
        if expandedCourses.contains(id) {
            expandedCourses.remove(id)
        } else {
            expandedCourses.insert(id)
        }
    }
}

private struct FlashcardsLibraryHeader: View {
    let deckCount: Int
    let cardCount: Int

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.accent.opacity(0.12))
                .frame(width: 54, height: 54)
                .overlay {
                    Image(systemName: "rectangle.on.rectangle.angled")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(XyndromeTheme.Colors.accent)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text("Spaced Review")
                    .font(XyndromeTheme.Typography.title3())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .textCase(.uppercase)
                Text("\(deckCount) deck\(deckCount == 1 ? "" : "s") · \(cardCount) card\(cardCount == 1 ? "" : "s")")
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            }

            Spacer()
        }
    }
}

private struct FlashcardCourseSection: View {
    let course: FlashcardCourseGroup
    let isExpanded: Bool
    @Binding var expandedSubjects: Set<String>
    let onToggle: () -> Void
    let onStartCourse: () -> Void
    let onStartSubject: ([AiNote], String) -> Void
    let onStartNote: (AiNote) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(course.title)
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            .lineLimit(2)
                        Text("\(course.subjects.count) subject\(course.subjects.count == 1 ? "" : "s")")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(course.cardCount)")
                            .font(.system(size: 24, weight: .black, design: .rounded))
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text("cards")
                            .font(XyndromeTheme.Typography.caption2())
                            .fontWeight(.black)
                            .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            .textCase(.uppercase)
                    }
                }
                .padding(XyndromeTheme.Spacing.md)
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(spacing: XyndromeTheme.Spacing.xs) {
                    Button(action: onStartCourse) {
                        Label("Study Course", systemImage: "play.fill")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.black)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.horizontal, XyndromeTheme.Spacing.sm)
                    .padding(.bottom, XyndromeTheme.Spacing.xs)

                    ForEach(course.subjects) { subject in
                        FlashcardSubjectSection(
                            subject: subject,
                            isExpanded: expandedSubjects.contains(subject.id),
                            onToggle: {
                                if expandedSubjects.contains(subject.id) {
                                    expandedSubjects.remove(subject.id)
                                } else {
                                    expandedSubjects.insert(subject.id)
                                }
                            },
                            onStartSubject: { onStartSubject(subject.notes, subject.title) },
                            onStartNote: onStartNote
                        )
                    }
                }
                .padding(.horizontal, XyndromeTheme.Spacing.sm)
                .padding(.bottom, XyndromeTheme.Spacing.sm)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .strokeBorder(XyndromeTheme.Colors.accent.opacity(0.08), lineWidth: 1)
        )
    }
}

private struct FlashcardSubjectSection: View {
    let subject: FlashcardSubjectGroup
    let isExpanded: Bool
    let onToggle: () -> Void
    let onStartSubject: () -> Void
    let onStartNote: (AiNote) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                HStack {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    Text(subject.title)
                        .font(XyndromeTheme.Typography.subheadline())
                        .fontWeight(.bold)
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Spacer()
                    Text("\(subject.cardCount)")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.black)
                        .foregroundStyle(XyndromeTheme.Colors.accent)
                }
                .padding(.horizontal, XyndromeTheme.Spacing.sm)
                .padding(.vertical, 10)
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(spacing: 6) {
                    Button(action: onStartSubject) {
                        Label("Study Subject", systemImage: "play.fill")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.black)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SecondaryButtonStyle())

                    ForEach(subject.notes, id: \.engineScopedId) { note in
                        FlashcardLessonDeckRow(note: note, onStart: { onStartNote(note) })
                    }
                }
                .padding(.horizontal, XyndromeTheme.Spacing.sm)
                .padding(.bottom, XyndromeTheme.Spacing.sm)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surface)
        )
    }
}

private struct FlashcardLessonDeckRow: View {
    let note: AiNote
    let onStart: () -> Void

    var body: some View {
        Button(action: onStart) {
            HStack(spacing: XyndromeTheme.Spacing.sm) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(XyndromeTheme.Colors.accent.opacity(0.12))
                    .frame(width: 38, height: 38)
                    .overlay {
                        Image(systemName: note.accessLocked ? "lock.fill" : "rectangle.stack.fill")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(note.accessLocked ? XyndromeTheme.Colors.warning : XyndromeTheme.Colors.accent)
                    }

                VStack(alignment: .leading, spacing: 3) {
                    Text(note.lessonTitle ?? note.title)
                        .font(XyndromeTheme.Typography.subheadline())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)

                    HStack(spacing: XyndromeTheme.Spacing.xs) {
                        Label("\(note.flashcardTotal) cards", systemImage: "rectangle.stack.fill")
                        let reviewed = FlashcardReviewStore.reviewCount(for: note)
                        if reviewed > 0 {
                            Label("\(reviewed) reviewed", systemImage: "checkmark.circle")
                        }
                    }
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }

                Spacer()

                Text(note.accessLocked ? "Locked" : "Start")
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.black)
                    .foregroundStyle(note.accessLocked ? XyndromeTheme.Colors.warning : .white)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 8)
                    .background(
                        Capsule().fill(note.accessLocked ? XyndromeTheme.Colors.warning.opacity(0.12) : XyndromeTheme.Colors.accent)
                    )
            }
            .padding(XyndromeTheme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(XyndromeTheme.Colors.surfaceSecondary)
            )
        }
        .buttonStyle(.plain)
        .disabled(note.accessLocked)
        .opacity(note.accessLocked ? 0.6 : 1)
    }
}

private struct FlashcardLibrarySkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(spacing: XyndromeTheme.Spacing.md) {
                    skeleton(width: 54, height: 54)
                    VStack(alignment: .leading, spacing: 8) {
                        skeleton(width: 150, height: 18)
                        skeleton(width: 190, height: 12)
                    }
                }
                ForEach(0..<5, id: \.self) { _ in
                    skeleton(width: nil, height: 92)
                }
            }
            .padding(XyndromeTheme.Spacing.md)
        }
    }

    private func skeleton(width: CGFloat?, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
            .fill(XyndromeTheme.Colors.surfaceSecondary)
            .frame(width: width, height: height)
            .redacted(reason: .placeholder)
    }
}

private extension Flashcard {
    var difficultyLabel: String {
        let words = back.split { $0.isWhitespace || $0.isNewline }.count
        if words > 70 { return "Hard" }
        if words < 22 { return "Easy" }
        return "Medium"
    }

    var difficultyColor: Color {
        switch difficultyLabel {
        case "Hard": return XyndromeTheme.Colors.error
        case "Easy": return XyndromeTheme.Colors.success
        default: return XyndromeTheme.Colors.warning
        }
    }
}
