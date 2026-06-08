import SwiftUI
import UIKit

struct NoteContentRenderer: View {
    let markdown: String

    private var attributed: AttributedString {
        (try? AttributedString(markdown: markdown)) ?? AttributedString(stringLiteral: markdown)
    }

    var body: some View {
        Text(attributed)
            .font(XyndromeTheme.Typography.body())
            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            .lineSpacing(4)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct AiNoteCanvasReader: View {
    let note: AiNoteDetail
    let page: AiNoteCanvasPage

    private var title: String {
        page.title.nonEmpty ?? note.lessonTitle ?? note.title
    }

    private var subtitle: String? {
        page.subtitle.nonEmpty ?? note.courseTitle
    }

    private var tagValues: [String] {
        let values = page.tags.isEmpty ? page.keywords : page.tags
        return Array(values.prefix(8))
    }

    private var highlightColors: [Color] {
        page.visualStyleColors.compactMap { CanvasPalette.optionalColor($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            header

            if !page.keyPoints.isEmpty {
                CanvasKeyPoints(points: page.keyPoints, highlightColors: highlightColors)
            }

            LazyVStack(spacing: XyndromeTheme.Spacing.sm) {
                ForEach(Array(page.sections.enumerated()), id: \.element.id) { index, section in
                    CanvasSectionCard(
                        section: section,
                        accent: CanvasPalette.color(for: index, preferred: section.accentColor),
                        highlightColors: highlightColors
                    )
                }
            }

            if let summary = page.summaryBox.nonEmpty {
                CanvasSummaryBox(summary: summary, highlightColors: highlightColors)
            }
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(CanvasPalette.canvasSurface(page.canvasBg))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                        .strokeBorder(Color(hex: "#EADFCF").opacity(0.7), lineWidth: 1)
                )
        )
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.md) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(XyndromeTheme.Colors.success.opacity(0.12))
                    .frame(width: 48, height: 48)
                    .overlay {
                        Image(systemName: "leaf.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(XyndromeTheme.Colors.success)
                    }

                VStack(alignment: .leading, spacing: 6) {
                    Text(title)
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let subtitle = subtitle.nonEmpty {
                        Text(subtitle)
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.bold)
                            .foregroundStyle(XyndromeTheme.Colors.success)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(XyndromeTheme.Colors.success.opacity(0.12)))
                    }
                }
            }

            if !tagValues.isEmpty {
                FlowLayout(spacing: 6, rowSpacing: 6) {
                    ForEach(tagValues, id: \.self) { tag in
                        Text(tag)
                            .font(XyndromeTheme.Typography.caption2())
                            .fontWeight(.bold)
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(XyndromeTheme.Colors.primary.opacity(0.1)))
                    }
                }
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                        .strokeBorder(Color(hex: "#EADFCF").opacity(0.55), lineWidth: 1)
                )
        )
    }
}

private struct CanvasKeyPoints: View {
    let points: [String]
    let highlightColors: [Color]

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            Label("Key Points", systemImage: "key.fill")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.black)
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .textCase(.uppercase)

            FlowLayout(spacing: 8, rowSpacing: 8) {
                ForEach(Array(points.enumerated()), id: \.element) { index, point in
                    CanvasRichText(
                        point,
                        font: XyndromeTheme.Typography.subheadline(),
                        weight: .semibold,
                        accent: CanvasPalette.highlightColor(index: index, colors: highlightColors)
                    )
                        .font(XyndromeTheme.Typography.subheadline())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .fill(Color(hex: "#FDE68A").opacity(0.32))
                        )
                }
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(Color(hex: "#FFFBEB").opacity(0.7))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(Color(hex: "#F3C77F").opacity(0.55), lineWidth: 1)
                )
        )
    }
}

private struct CanvasSummaryBox: View {
    let summary: String
    let highlightColors: [Color]

    private var fragments: [String] {
        summary
            .replacingOccurrences(of: "→", with: "·")
            .split { $0 == "·" || $0 == "|" }
            .compactMap { String($0).nonEmpty }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            Label("Summary", systemImage: "sparkles")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.black)
                .foregroundStyle(XyndromeTheme.Colors.info)
                .textCase(.uppercase)

            if fragments.count > 1 {
                FlowLayout(spacing: 8, rowSpacing: 8) {
                    ForEach(fragments, id: \.self) { fragment in
                    CanvasRichText(
                        fragment,
                        font: XyndromeTheme.Typography.subheadline(),
                        weight: .semibold,
                        accent: CanvasPalette.highlightColor(index: fragments.firstIndex(of: fragment) ?? 0, colors: highlightColors)
                    )
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                    .fill(XyndromeTheme.Colors.primary.opacity(0.08))
                            )
                    }
                }
            } else {
                CanvasRichText(summary, font: XyndromeTheme.Typography.body(), accent: CanvasPalette.highlightColor(index: 0, colors: highlightColors))
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.info.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(XyndromeTheme.Colors.info.opacity(0.16), lineWidth: 1)
                )
        )
    }
}

private struct CanvasSectionCard: View {
    let section: AiNoteCanvasSection
    let accent: Color
    let highlightColors: [Color]

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            if section.isImageOnly || section.isImageExplained {
                CanvasImageBlock(
                    source: section.src,
                    caption: section.caption,
                    explanation: section.explanation,
                    accent: accent
                )
            } else {
                textContent
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(cardBackground)
        )
        .overlay(alignment: .topTrailing) {
            Image(systemName: CanvasPalette.symbol(for: section))
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 30, height: 30)
                .background(Circle().fill(accent.opacity(0.12)))
                .padding(8)
                .opacity(0.75)
        }
    }

    private var textContent: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            if let heading = section.heading.nonEmpty {
                Text(heading)
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.black)
                    .foregroundStyle(CanvasPalette.optionalColor(section.headingColor) ?? accent)
                    .textCase(.uppercase)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                            .fill(accent.opacity(0.12))
                    )
            }

            if let image = section.sectionImage {
                CanvasImageBlock(
                    source: image.src,
                    caption: image.caption,
                    explanation: nil,
                    accent: accent
                )
            }

            if let bodyText = section.bodyText.nonEmpty {
                CanvasRichText(
                    bodyText,
                    font: XyndromeTheme.Typography.body(),
                    accent: CanvasPalette.highlightColor(index: 0, colors: highlightColors, fallback: accent)
                )
            }

            if !section.bullets.isEmpty {
                CanvasBulletList(bullets: section.bullets, accent: accent, highlightColors: highlightColors)
            }

            if let callout = section.callout.nonEmpty {
                CanvasCallout(text: callout, accent: accent, highlightColors: highlightColors)
            }

            if let mnemonic = section.mnemonic.nonEmpty {
                CanvasMnemonic(text: mnemonic)
            }

            if let sticky = section.stickyNote.nonEmpty {
                CanvasStickyNote(text: sticky, accent: accent, highlightColors: highlightColors)
            }
        }
    }

    private var cardBackground: Color {
        accent.opacity(0.075)
    }
}

private struct CanvasBulletList: View {
    let bullets: [String]
    let accent: Color
    let highlightColors: [Color]

    @State private var checked: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
            if !checked.isEmpty {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    ProgressView(value: Double(checked.count), total: Double(max(bullets.count, 1)))
                        .tint(XyndromeTheme.Colors.success)
                    Text("\(checked.count)/\(bullets.count)")
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.bold)
                        .foregroundStyle(XyndromeTheme.Colors.success)
                }
            }

            VStack(alignment: .leading, spacing: 7) {
                ForEach(Array(bullets.enumerated()), id: \.offset) { index, bullet in
                    Button {
                        if checked.contains(index) {
                            checked.remove(index)
                        } else {
                            checked.insert(index)
                        }
                    } label: {
                        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.xs) {
                            bulletMark(isSub: bullet.isSubBullet, isChecked: checked.contains(index))
                            CanvasRichText(
                                bullet.cleanedBullet,
                                font: XyndromeTheme.Typography.subheadline(),
                                accent: CanvasPalette.highlightColor(index: index, colors: highlightColors, fallback: accent),
                                opacity: checked.contains(index) ? 0.45 : 1,
                                strikethrough: checked.contains(index)
                            )
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func bulletMark(isSub: Bool, isChecked: Bool) -> some View {
        Group {
            if isSub {
                Image(systemName: "arrow.turn.down.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(isChecked ? XyndromeTheme.Colors.success : accent)
            } else {
                Circle()
                    .fill(isChecked ? XyndromeTheme.Colors.success : accent)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
            }
        }
        .frame(width: 16)
    }
}

private struct CanvasCallout: View {
    let text: String
    let accent: Color
    let highlightColors: [Color]

    private var parsed: (label: String?, text: String) {
        let raw = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lowered = raw.lowercased()
        for prefix in ["[exam trap]", "exam trap:", "trap:", "warning:"] {
            if lowered.hasPrefix(prefix) {
                let start = raw.index(raw.startIndex, offsetBy: prefix.count)
                return ("Exam Trap", String(raw[start...]).trimmingCharacters(in: .whitespacesAndNewlines))
            }
        }
        return (nil, raw)
    }

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.xs) {
            Image(systemName: parsed.label == nil ? "bolt.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(parsed.label == nil ? accent : XyndromeTheme.Colors.error)
                .frame(width: 18)

            VStack(alignment: .leading, spacing: 4) {
                if let label = parsed.label {
                    Text(label)
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.black)
                        .foregroundStyle(XyndromeTheme.Colors.error)
                        .textCase(.uppercase)
                }
                CanvasRichText(
                    parsed.text,
                    font: XyndromeTheme.Typography.subheadline(),
                    accent: CanvasPalette.highlightColor(index: 0, colors: highlightColors, fallback: accent)
                )
            }
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(accent.opacity(0.1))
        )
    }
}

private struct CanvasMnemonic: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Mnemonic")
                .font(XyndromeTheme.Typography.caption2())
                .fontWeight(.black)
                .foregroundStyle(Color(hex: "#B45309"))
                .textCase(.uppercase)
            CanvasRichText(text, font: XyndromeTheme.Typography.subheadline(), weight: .semibold)
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(Color(hex: "#FDE68A").opacity(0.28))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .strokeBorder(Color(hex: "#D97706").opacity(0.22), lineWidth: 1)
                )
        )
    }
}

private struct CanvasStickyNote: View {
    let text: String
    let accent: Color
    let highlightColors: [Color]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(.white.opacity(0.6))
                .frame(width: 18, height: 6)
                .frame(maxWidth: .infinity)
                .offset(y: -8)

            CanvasRichText(
                text,
                font: XyndromeTheme.Typography.subheadline(),
                weight: .semibold,
                accent: CanvasPalette.highlightColor(index: 0, colors: highlightColors, fallback: accent)
            )
        }
        .padding(.horizontal, XyndromeTheme.Spacing.sm)
        .padding(.bottom, XyndromeTheme.Spacing.sm)
        .padding(.top, 2)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(accent.opacity(0.13))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .strokeBorder(accent.opacity(0.24), lineWidth: 1)
                )
        )
    }
}

private struct CanvasImageBlock: View {
    let source: String?
    let caption: String?
    let explanation: String?
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            if let source = source.nonEmpty {
                CanvasImage(source: source)
            }

            if let caption = caption.nonEmpty {
                Label(caption, systemImage: "photo")
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.bold)
                    .foregroundStyle(accent)
            }

            if let explanation = explanation.nonEmpty {
                CanvasRichText(explanation, font: XyndromeTheme.Typography.subheadline())
                    .padding(.top, 2)
            }
        }
    }
}

private struct CanvasImage: View {
    let source: String
    @State private var decodedDataImage: UIImage?
    @State private var didFailDataImage = false

    private var isDataImage: Bool {
        source.hasPrefix("data:image")
    }

    private var remoteURL: URL? {
        guard !isDataImage else { return nil }
        return URL(string: source)
    }

    var body: some View {
        Group {
            if isDataImage {
                if let decodedDataImage {
                    imageView(Image(uiImage: decodedDataImage))
                } else if didFailDataImage {
                    imagePlaceholder
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
                        imagePlaceholder
                    @unknown default:
                        imagePlaceholder
                    }
                }
            } else {
                imagePlaceholder
            }
        }
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.surface.opacity(0.75))
        )
        .clipShape(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm))
        .task(id: source) {
            await decodeDataImageIfNeeded()
        }
    }

    @MainActor
    private func decodeDataImageIfNeeded() async {
        decodedDataImage = nil
        didFailDataImage = false
        guard isDataImage else { return }

        let imageSource = source
        let image = await Task.detached(priority: .utility) {
            NoteDataImageDecoder.decode(imageSource)
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
            .scaledToFit()
    }

    private var loadingPlaceholder: some View {
        ProgressView()
            .tint(XyndromeTheme.Colors.primary)
            .frame(maxWidth: .infinity, minHeight: 160)
    }

    private var imagePlaceholder: some View {
        VStack(spacing: XyndromeTheme.Spacing.xs) {
            Image(systemName: "photo")
                .font(.system(size: 28, weight: .semibold))
            Text("Image unavailable")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
        }
        .foregroundStyle(XyndromeTheme.Colors.textMuted)
        .frame(maxWidth: .infinity, minHeight: 160)
    }
}

private enum NoteDataImageDecoder {
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

private struct CanvasRichText: View {
    let text: String
    var font: Font
    var weight: Font.Weight?
    var accent: Color?
    var opacity: Double
    var strikethrough: Bool

    init(
        _ text: String,
        font: Font,
        weight: Font.Weight? = nil,
        accent: Color? = nil,
        opacity: Double = 1,
        strikethrough: Bool = false
    ) {
        self.text = text
        self.font = font
        self.weight = weight
        self.accent = accent
        self.opacity = opacity
        self.strikethrough = strikethrough
    }

    private var attributed: AttributedString {
        var output = AttributedString()
        var remaining = text[...]

        func append(_ value: String, strong: Bool = false, highlighted: Bool = false) {
            guard !value.isEmpty else { return }
            var segment = AttributedString(value)
            if strong || highlighted {
                segment.inlinePresentationIntent = .stronglyEmphasized
            }
            if highlighted {
                segment.foregroundColor = accent ?? XyndromeTheme.Colors.primaryDark
                segment.backgroundColor = (accent ?? XyndromeTheme.Colors.primary).opacity(0.16)
            }
            output += segment
        }

        while !remaining.isEmpty {
            let highlightRange = remaining.range(of: "==")
            let boldRange = remaining.range(of: "**")
            let nextRange: Range<String.Index>?
            let marker: String

            switch (highlightRange, boldRange) {
            case let (highlight?, bold?):
                if highlight.lowerBound <= bold.lowerBound {
                    nextRange = highlight
                    marker = "=="
                } else {
                    nextRange = bold
                    marker = "**"
                }
            case let (highlight?, nil):
                nextRange = highlight
                marker = "=="
            case let (nil, bold?):
                nextRange = bold
                marker = "**"
            default:
                append(String(remaining))
                remaining = remaining[remaining.endIndex...]
                continue
            }

            guard let range = nextRange else { break }
            append(String(remaining[..<range.lowerBound]))
            let contentStart = range.upperBound
            guard let closeRange = remaining[contentStart...].range(of: marker) else {
                append(String(remaining[range.lowerBound...]))
                break
            }
            append(
                String(remaining[contentStart..<closeRange.lowerBound]),
                strong: marker == "**",
                highlighted: marker == "=="
            )
            remaining = remaining[closeRange.upperBound...]
        }

        return output
    }

    var body: some View {
        Text(attributed)
            .font(font)
            .fontWeight(weight)
            .foregroundStyle(XyndromeTheme.Colors.textPrimary.opacity(opacity))
            .strikethrough(strikethrough, color: XyndromeTheme.Colors.textSecondary)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
            .textSelection(.enabled)
    }
}

private enum CanvasPalette {
    static let colors: [Color] = [
        Color(hex: "#2563EB"),
        Color(hex: "#DC2626"),
        Color(hex: "#0EA5E9"),
        Color(hex: "#D97706"),
        Color(hex: "#7C3AED"),
        Color(hex: "#16A34A"),
        Color(hex: "#DB2777"),
        Color(hex: "#0891B2")
    ]

    static func color(for index: Int, preferred: String? = nil) -> Color {
        optionalColor(preferred) ?? colors[index % colors.count]
    }

    static func optionalColor(_ hex: String?) -> Color? {
        guard let value = hex?.trimmingCharacters(in: .whitespacesAndNewlines),
              value.range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) != nil else {
            return nil
        }
        return Color(hex: value.hasPrefix("#") ? value : "#\(value)")
    }

    static func highlightColor(index: Int, colors customColors: [Color], fallback: Color? = nil) -> Color {
        if !customColors.isEmpty {
            return customColors[index % customColors.count]
        }
        return fallback ?? colors[index % colors.count]
    }

    static func canvasSurface(_ hex: String?) -> Color {
        optionalColor(hex) ?? XyndromeTheme.Colors.surfaceSecondary
    }

    static func symbol(for section: AiNoteCanvasSection) -> String {
        if section.isImageOnly || section.isImageExplained { return "photo.on.rectangle.angled" }
        if section.mnemonic != nil { return "lightbulb.fill" }
        if section.callout != nil { return "bolt.fill" }
        if section.stickyNote != nil { return "note.text" }
        return "cross.case"
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        let rows = rows(in: width, subviews: subviews)
        return CGSize(width: width, height: rows.last.map { $0.maxY } ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = rows(in: bounds.width, subviews: subviews)
        for row in rows {
            for item in row.items {
                subviews[item.index].place(
                    at: CGPoint(x: bounds.minX + item.x, y: bounds.minY + row.y),
                    proposal: ProposedViewSize(width: item.size.width, height: item.size.height)
                )
            }
        }
    }

    private func rows(in width: CGFloat, subviews: Subviews) -> [FlowRow] {
        var rows: [FlowRow] = []
        var currentItems: [FlowItem] = []
        var currentX: CGFloat = 0
        var currentHeight: CGFloat = 0
        var currentY: CGFloat = 0
        let availableWidth = max(width, 1)

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let itemWidth = min(size.width, availableWidth)
            let itemSize = CGSize(width: itemWidth, height: size.height)
            let needsNewRow = currentX > 0 && currentX + itemWidth > availableWidth

            if needsNewRow {
                rows.append(FlowRow(y: currentY, height: currentHeight, items: currentItems))
                currentY += currentHeight + rowSpacing
                currentItems = []
                currentX = 0
                currentHeight = 0
            }

            currentItems.append(FlowItem(index: index, x: currentX, size: itemSize))
            currentX += itemWidth + spacing
            currentHeight = max(currentHeight, itemSize.height)
        }

        if !currentItems.isEmpty {
            rows.append(FlowRow(y: currentY, height: currentHeight, items: currentItems))
        }

        return rows
    }

    private struct FlowRow {
        let y: CGFloat
        let height: CGFloat
        let items: [FlowItem]

        var maxY: CGFloat { y + height }
    }

    private struct FlowItem {
        let index: Int
        let x: CGFloat
        let size: CGSize
    }
}

private extension String {
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var isSubBullet: Bool {
        trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("→")
    }

    var cleanedBullet: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "→", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private extension Optional where Wrapped == String {
    var nonEmpty: String? {
        self?.nonEmpty
    }
}
