import UIKit

// ============================================================================
// Native lesson note canvas (iOS / Capacitor only)
//
// A fully native Swift reimplementation of the web AI-notes reader (NoteCanvas),
// with a native Apple Pencil ink layer (PencilKit) drawn over the note. Opened
// from the Study → Lessons tab via the `lmsOpenLessonNote` JS bridge. The web AI
// Notes reader is untouched — this is a separate native screen.
//
// Flow: JS posts { lessonId, aiNoteId, title, engine, token, apiBaseUrl, dark }
//   → AppBridgeViewController presents LessonNoteViewController
//   → native URLSession fetches the note JSON (Bearer auth)
//   → LessonNoteRenderer builds the note natively
//   → PKCanvasView (pencil-only) overlays the content; finger scrolls
//   → ink persists on-device per lesson (Documents/lesson-ink/<id>.drawing)
// ============================================================================

// MARK: - Theme

struct LNTheme {
    let dark: Bool

    var pageBg: UIColor { dark ? hex("#0c1018") : hex("#f4f5f8") }
    var canvasBg: UIColor { dark ? hex("#111827") : hex("#fffdf8") }
    var cardBg: UIColor { dark ? UIColor(white: 1, alpha: 0.045) : hex("#fffdf8") }
    var cardBorder: UIColor { dark ? UIColor(white: 1, alpha: 0.10) : hex("#eadfce") }
    var inkStrong: UIColor { dark ? hex("#f0f4ff") : hex("#3b465f") }
    var inkBody: UIColor { dark ? hex("#c8d4f0") : hex("#3b465f") }
    var inkMuted: UIColor { dark ? hex("#94a3b8") : hex("#64748b") }
    var accent: UIColor { dark ? hex("#60a5fa") : hex("#2563eb") }
    var topbarBg: UIColor { dark ? hex("#05070d") : hex("#ffffff") }
    var topbarBorder: UIColor { dark ? UIColor(white: 1, alpha: 0.12) : hex("#e5e7eb") }

    // Section accent rotation (mirrors NoteCanvas colors palette).
    static let lightColors = ["#2563EB","#DC2626","#0EA5E9","#D97706","#7C3AED","#60A5FA","#16A34A","#DB2777"]
    static let darkColors  = ["#7EB8FF","#FFE082","#FF8A80","#80CBC4","#CE93D8","#FFCC80","#A7F3D0","#F9A8D4"]
    static let highlightColors = ["#FBBF24","#60A5FA","#34D399","#F472B6","#A78BFA","#22D3EE","#FB7185","#FDBA74"]

    func sectionAccent(_ index: Int) -> UIColor {
        let palette = dark ? LNTheme.darkColors : LNTheme.lightColors
        return LNTheme.hex(palette[index % palette.count])
    }

    static func hex(_ raw: String) -> UIColor {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        guard s.count == 6, let v = Int(s, radix: 16) else { return .gray }
        return UIColor(
            red: CGFloat((v >> 16) & 0xff) / 255,
            green: CGFloat((v >> 8) & 0xff) / 255,
            blue: CGFloat(v & 0xff) / 255,
            alpha: 1
        )
    }
    func hex(_ raw: String) -> UIColor { LNTheme.hex(raw) }
}

private extension UIColor {
    func withAlphaHexA(_ alpha: CGFloat) -> UIColor { withAlphaComponent(alpha) }
}

// MARK: - Models

struct LNSection {
    enum Kind { case text, image, imageExplained }
    var kind: Kind = .text
    var heading: String?
    var bullets: [String] = []
    var callout: String?
    var mnemonic: String?
    var stickyNote: String?
    var src: String?
    var caption: String?
    var explanation: String?
}

struct LNNote {
    var title: String = ""
    var subtitle: String = ""
    var sections: [LNSection] = []
    var keyPoints: [String] = []
    var summary: String = ""
    var locked: Bool = false
}

// MARK: - Parser

enum LNParser {
    static func parse(_ json: [String: Any], fallbackTitle: String) -> LNNote {
        var note = LNNote()
        note.title = (json["lessonTitle"] as? String)
            ?? (json["title"] as? String)
            ?? fallbackTitle
        note.subtitle = (json["courseTitle"] as? String) ?? ""

        // noteData may be null when the student lacks access.
        guard let noteData = json["noteData"] as? [String: Any] else {
            note.locked = (json["accessLocked"] as? Bool) ?? true
            return note
        }

        let pages: [[String: Any]]
        if let arr = noteData["pages"] as? [[String: Any]] {
            pages = arr
        } else {
            pages = [noteData]
        }

        if let first = pages.first {
            if note.title.isEmpty { note.title = (first["title"] as? String) ?? note.title }
            if note.subtitle.isEmpty { note.subtitle = (first["subtitle"] as? String) ?? "" }
        }

        var summaryParts: [String] = []
        for page in pages {
            if let s = page["summary_box"] as? String, !s.isEmpty { summaryParts.append(s) }
            if let kp = page["key_points"] as? [String] { note.keyPoints.append(contentsOf: kp) }
            if let sections = page["sections"] as? [[String: Any]] {
                for raw in sections { note.sections.append(parseSection(raw)) }
            }
        }
        note.summary = summaryParts.joined(separator: " · ")
        return note
    }

    private static func parseSection(_ raw: [String: Any]) -> LNSection {
        var s = LNSection()
        let type = (raw["type"] as? String)?.lowercased() ?? ""
        if type == "image" { s.kind = .image }
        else if type == "image-explained" { s.kind = .imageExplained }
        else { s.kind = .text }

        s.heading = raw["heading"] as? String
        if let b = raw["bullets"] as? [String] { s.bullets = b }
        s.callout = (raw["callout"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        s.mnemonic = (raw["mnemonic"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        s.stickyNote = (raw["sticky_note"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        s.src = raw["src"] as? String
        s.caption = (raw["caption"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        s.explanation = (raw["explanation"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        return s
    }
}

// MARK: - Rich text (==highlight== and **bold**)

enum LNRichText {
    static func attributed(_ text: String, base: UIFont, color: UIColor, theme: LNTheme) -> NSAttributedString {
        let result = NSMutableAttributedString()
        var markIndex = 0
        var i = text.startIndex
        var plain = ""

        func flushPlain() {
            if !plain.isEmpty {
                result.append(NSAttributedString(string: plain, attributes: [.font: base, .foregroundColor: color]))
                plain = ""
            }
        }

        while i < text.endIndex {
            let rest = text[i...]
            if rest.hasPrefix("==") {
                if let end = rest.range(of: "==", range: rest.index(rest.startIndex, offsetBy: 2)..<rest.endIndex) {
                    flushPlain()
                    let inner = String(rest[rest.index(rest.startIndex, offsetBy: 2)..<end.lowerBound])
                    let hc = LNTheme.hex(LNTheme.highlightColors[markIndex % LNTheme.highlightColors.count])
                    markIndex += 1
                    result.append(NSAttributedString(string: inner, attributes: [
                        .font: base,
                        .foregroundColor: color,
                        .backgroundColor: hc.withAlphaComponent(theme.dark ? 0.34 : 0.23)
                    ]))
                    i = end.upperBound
                    continue
                }
            }
            if rest.hasPrefix("**") {
                if let end = rest.range(of: "**", range: rest.index(rest.startIndex, offsetBy: 2)..<rest.endIndex) {
                    flushPlain()
                    let inner = String(rest[rest.index(rest.startIndex, offsetBy: 2)..<end.lowerBound])
                    let bold = UIFont.systemFont(ofSize: base.pointSize, weight: .bold)
                    result.append(NSAttributedString(string: inner, attributes: [
                        .font: bold,
                        .foregroundColor: theme.dark ? LNTheme.hex("#ff8a80") : LNTheme.hex("#1e40af")
                    ]))
                    i = end.upperBound
                    continue
                }
            }
            plain.append(text[i])
            i = text.index(after: i)
        }
        flushPlain()
        return result
    }
}

// MARK: - Ink model + persistence (vector strokes, mirrors the web NoteCanvas)

enum InkTool: String, Codable { case pen, highlighter, eraser }

struct InkPoint: Codable { var x: CGFloat; var y: CGFloat; var f: CGFloat }  // f = pressure

struct InkStroke: Codable {
    var tool: InkTool
    var colorHex: String
    var width: CGFloat
    var points: [InkPoint]
}

enum LNInkStore {
    private static func dir() -> URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let d = base.appendingPathComponent("lesson-ink", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }
    private static func url(_ key: String) -> URL {
        dir().appendingPathComponent("\(key).ink.json")
    }
    static func load(_ key: String) -> [InkStroke] {
        guard let data = try? Data(contentsOf: url(key)),
              let strokes = try? JSONDecoder().decode([InkStroke].self, from: data) else { return [] }
        return strokes
    }
    static func save(_ key: String, _ strokes: [InkStroke]) {
        guard let data = try? JSONEncoder().encode(strokes) else { return }
        try? data.write(to: url(key), options: .atomic)
    }
}

// MARK: - Renderer

final class LessonNoteRenderer {
    let theme: LNTheme
    init(theme: LNTheme) { self.theme = theme }

    func build(_ note: LNNote, into stack: UIStackView, maxWidth: CGFloat) {
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        // Header
        if !note.title.isEmpty {
            let title = UILabel()
            title.numberOfLines = 0
            title.text = note.title
            title.font = UIFont.systemFont(ofSize: 30, weight: .heavy)
            title.textColor = theme.inkStrong
            stack.addArrangedSubview(title)
        }
        if !note.subtitle.isEmpty {
            let pill = paddedPill(note.subtitle, color: theme.accent)
            let wrap = leftAlign(pill)
            stack.addArrangedSubview(wrap)
        }

        if note.locked {
            let lock = card()
            let l = bodyLabel("This lesson is locked. Open it in your plan to view the notes.")
            embed(l, in: lock, inset: 16)
            stack.addArrangedSubview(lock)
            return
        }

        // Sections
        for (idx, section) in note.sections.enumerated() {
            let accent = theme.sectionAccent(idx)
            switch section.kind {
            case .text:
                stack.addArrangedSubview(textCard(section, accent: accent))
            case .image, .imageExplained:
                stack.addArrangedSubview(imageCard(section, accent: accent))
            }
        }

        // Key points
        if !note.keyPoints.isEmpty {
            stack.addArrangedSubview(keyPointsCard(note.keyPoints))
        }
        // Summary
        if !note.summary.isEmpty {
            stack.addArrangedSubview(summaryCard(note.summary))
        }
    }

    // MARK: card builders

    private func textCard(_ s: LNSection, accent: UIColor) -> UIView {
        let c = card()
        let inner = UIStackView()
        inner.axis = .vertical
        inner.spacing = 10
        inner.translatesAutoresizingMaskIntoConstraints = false
        c.addSubview(inner)
        NSLayoutConstraint.activate([
            inner.topAnchor.constraint(equalTo: c.topAnchor, constant: 14),
            inner.bottomAnchor.constraint(equalTo: c.bottomAnchor, constant: -14),
            inner.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 14),
            inner.trailingAnchor.constraint(equalTo: c.trailingAnchor, constant: -14),
        ])

        if let heading = s.heading, !heading.isEmpty {
            inner.addArrangedSubview(headingChip(heading, accent: accent))
        }
        for bullet in s.bullets {
            inner.addArrangedSubview(bulletRow(bullet, accent: accent))
        }
        if let callout = s.callout {
            inner.addArrangedSubview(calloutBox(callout, accent: accent))
        }
        if let mnemonic = s.mnemonic {
            inner.addArrangedSubview(mnemonicBox(mnemonic))
        }
        if let sticky = s.stickyNote {
            inner.addArrangedSubview(stickyBox(sticky, accent: accent))
        }
        return c
    }

    private func imageCard(_ s: LNSection, accent: UIColor) -> UIView {
        let c = card()
        let inner = UIStackView()
        inner.axis = .vertical
        inner.spacing = 8
        inner.translatesAutoresizingMaskIntoConstraints = false
        c.addSubview(inner)
        NSLayoutConstraint.activate([
            inner.topAnchor.constraint(equalTo: c.topAnchor, constant: 10),
            inner.bottomAnchor.constraint(equalTo: c.bottomAnchor, constant: -10),
            inner.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 10),
            inner.trailingAnchor.constraint(equalTo: c.trailingAnchor, constant: -10),
        ])

        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 6
        imageView.backgroundColor = theme.dark ? UIColor(white: 1, alpha: 0.04) : UIColor(white: 0, alpha: 0.03)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.heightAnchor.constraint(equalToConstant: s.kind == .imageExplained ? 220 : 200).isActive = true
        inner.addArrangedSubview(imageView)
        if let src = s.src { LNImageLoader.load(src, into: imageView) }

        if s.kind == .imageExplained {
            if let cap = s.caption {
                inner.addArrangedSubview(figureLabel(cap, accent: accent))
            }
            if let exp = s.explanation {
                for line in exp.components(separatedBy: "\n") where !line.trimmingCharacters(in: .whitespaces).isEmpty {
                    inner.addArrangedSubview(richBodyLabel(line))
                }
            }
        } else if let cap = s.caption {
            let lbl = UILabel()
            lbl.numberOfLines = 0
            lbl.textAlignment = .center
            lbl.text = cap
            lbl.font = UIFont.italicSystemFont(ofSize: 13)
            lbl.textColor = theme.inkMuted
            inner.addArrangedSubview(lbl)
        }
        return c
    }

    private func keyPointsCard(_ points: [String]) -> UIView {
        let c = card(border: LNTheme.hex("#f59e0b"))
        let inner = UIStackView()
        inner.axis = .vertical
        inner.spacing = 8
        inner.translatesAutoresizingMaskIntoConstraints = false
        c.addSubview(inner)
        NSLayoutConstraint.activate([
            inner.topAnchor.constraint(equalTo: c.topAnchor, constant: 14),
            inner.bottomAnchor.constraint(equalTo: c.bottomAnchor, constant: -14),
            inner.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 16),
            inner.trailingAnchor.constraint(equalTo: c.trailingAnchor, constant: -16),
        ])
        inner.addArrangedSubview(sectionLabel("★  KEY EXAM POINTS", color: LNTheme.hex("#b7791f")))
        for p in points {
            inner.addArrangedSubview(bulletRow(p, accent: LNTheme.hex("#f59e0b")))
        }
        return c
    }

    private func summaryCard(_ summary: String) -> UIView {
        let c = card(border: LNTheme.hex("#0891b2"))
        let inner = UIStackView()
        inner.axis = .vertical
        inner.spacing = 8
        inner.translatesAutoresizingMaskIntoConstraints = false
        c.addSubview(inner)
        NSLayoutConstraint.activate([
            inner.topAnchor.constraint(equalTo: c.topAnchor, constant: 14),
            inner.bottomAnchor.constraint(equalTo: c.bottomAnchor, constant: -14),
            inner.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 18),
            inner.trailingAnchor.constraint(equalTo: c.trailingAnchor, constant: -18),
        ])
        inner.addArrangedSubview(sectionLabel("SUMMARY", color: theme.dark ? LNTheme.hex("#93c5fd") : LNTheme.hex("#1d4ed8")))
        let fragments = summary.components(separatedBy: CharacterSet(charactersIn: "·|"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        for frag in fragments {
            inner.addArrangedSubview(richBodyLabel(frag))
        }
        return c
    }

    // MARK: element builders

    private func card(border: UIColor? = nil) -> UIView {
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        v.backgroundColor = theme.cardBg
        v.layer.cornerRadius = 14
        v.layer.borderWidth = 1
        v.layer.borderColor = (border ?? theme.cardBorder).withAlphaComponent(theme.dark ? 0.3 : 0.55).cgColor
        return v
    }

    private func headingChip(_ text: String, accent: UIColor) -> UIView {
        let lbl = UILabel()
        lbl.numberOfLines = 0
        lbl.text = text.uppercased()
        lbl.font = UIFont.systemFont(ofSize: 11, weight: .heavy)
        lbl.textColor = theme.inkStrong
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        wrap.backgroundColor = accent.withAlphaComponent(theme.dark ? 0.18 : 0.10)
        wrap.layer.cornerRadius = 7
        wrap.layer.borderWidth = 1
        wrap.layer.borderColor = accent.withAlphaComponent(0.38).cgColor
        embed(lbl, in: wrap, insetV: 6, insetH: 9)
        return leftAlign(wrap)
    }

    private func bulletRow(_ text: String, accent: UIColor) -> UIView {
        let isSub = text.hasPrefix("→ ")
        let clean = isSub ? String(text.dropFirst(2)) : text
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .firstBaseline
        row.spacing = 7
        row.translatesAutoresizingMaskIntoConstraints = false

        let dot = UILabel()
        dot.text = isSub ? "→" : "•"
        dot.font = UIFont.systemFont(ofSize: isSub ? 13 : 16, weight: .bold)
        dot.textColor = accent
        dot.setContentHuggingPriority(.required, for: .horizontal)

        let body = UILabel()
        body.numberOfLines = 0
        let font = UIFont.systemFont(ofSize: isSub ? 13.5 : 14.5, weight: .regular)
        body.attributedText = LNRichText.attributed(clean, base: font, color: theme.inkBody, theme: theme)

        if isSub {
            let spacer = UIView()
            spacer.widthAnchor.constraint(equalToConstant: 16).isActive = true
            row.addArrangedSubview(spacer)
        }
        row.addArrangedSubview(dot)
        row.addArrangedSubview(body)
        return row
    }

    private func calloutBox(_ text: String, accent: UIColor) -> UIView {
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        wrap.backgroundColor = theme.dark ? UIColor(white: 1, alpha: 0.075) : UIColor(red: 1, green: 0.757, blue: 0.027, alpha: 0.08)
        wrap.layer.cornerRadius = 8
        wrap.layer.borderWidth = 1
        wrap.layer.borderColor = accent.withAlphaComponent(0.5).cgColor

        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .firstBaseline
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        let icon = UILabel()
        icon.text = "⚡"
        icon.font = UIFont.systemFont(ofSize: 14)
        icon.setContentHuggingPriority(.required, for: .horizontal)
        let body = UILabel()
        body.numberOfLines = 0
        body.attributedText = LNRichText.attributed(text, base: UIFont.systemFont(ofSize: 14.5), color: theme.inkBody, theme: theme)
        row.addArrangedSubview(icon)
        row.addArrangedSubview(body)
        embed(row, in: wrap, insetV: 8, insetH: 12)
        return wrap
    }

    private func mnemonicBox(_ text: String) -> UIView {
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        wrap.backgroundColor = theme.dark ? UIColor(red: 0.39, green: 0.27, blue: 0, alpha: 0.35) : UIColor(red: 0.86, green: 0.63, blue: 0, alpha: 0.08)
        wrap.layer.cornerRadius = 8
        wrap.layer.borderWidth = 1.5
        wrap.layer.borderColor = UIColor(red: 0.71, green: 0.51, blue: 0, alpha: 0.3).cgColor
        wrap.transform = CGAffineTransform(rotationAngle: -0.0105)

        let stackV = UIStackView()
        stackV.axis = .vertical
        stackV.spacing = 4
        stackV.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel()
        label.text = "MNEMONIC"
        label.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        label.textColor = theme.dark ? LNTheme.hex("#ffe57a") : LNTheme.hex("#b86b00")
        let body = UILabel()
        body.numberOfLines = 0
        body.font = UIFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        body.textColor = theme.dark ? LNTheme.hex("#fff0b0") : LNTheme.hex("#8b6914")
        body.text = text
        stackV.addArrangedSubview(label)
        stackV.addArrangedSubview(body)
        embed(stackV, in: wrap, insetV: 10, insetH: 12)
        return wrap
    }

    private func stickyBox(_ text: String, accent: UIColor) -> UIView {
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        wrap.backgroundColor = accent.withAlphaComponent(theme.dark ? 0.055 : 0.08)
        wrap.layer.cornerRadius = 8
        wrap.layer.borderWidth = 1
        wrap.layer.borderColor = accent.withAlphaComponent(0.5).cgColor
        let body = UILabel()
        body.numberOfLines = 0
        body.attributedText = LNRichText.attributed(text, base: UIFont.systemFont(ofSize: 14.5, weight: .semibold), color: theme.inkBody, theme: theme)
        embed(body, in: wrap, insetV: 8, insetH: 12)
        return wrap
    }

    private func figureLabel(_ caption: String, accent: UIColor) -> UIView {
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        let badge = UILabel()
        badge.text = "FIGURE"
        badge.font = UIFont.systemFont(ofSize: 11, weight: .heavy)
        badge.textColor = accent
        badge.backgroundColor = accent.withAlphaComponent(0.13)
        badge.textAlignment = .center
        badge.layer.cornerRadius = 5
        badge.clipsToBounds = true
        badge.setContentHuggingPriority(.required, for: .horizontal)
        let pad = UIView()
        pad.translatesAutoresizingMaskIntoConstraints = false
        let cap = UILabel()
        cap.numberOfLines = 0
        cap.font = UIFont.italicSystemFont(ofSize: 13)
        cap.textColor = theme.inkMuted
        cap.text = caption
        row.addArrangedSubview(badge)
        row.addArrangedSubview(cap)
        return row
    }

    private func sectionLabel(_ text: String, color: UIColor) -> UILabel {
        let lbl = UILabel()
        lbl.text = text
        lbl.font = UIFont.systemFont(ofSize: 11, weight: .heavy)
        lbl.textColor = color
        return lbl
    }

    private func richBodyLabel(_ text: String) -> UILabel {
        let lbl = UILabel()
        lbl.numberOfLines = 0
        lbl.attributedText = LNRichText.attributed(text, base: UIFont.systemFont(ofSize: 14.5), color: theme.inkBody, theme: theme)
        return lbl
    }

    private func bodyLabel(_ text: String) -> UILabel {
        let lbl = UILabel()
        lbl.numberOfLines = 0
        lbl.text = text
        lbl.font = UIFont.systemFont(ofSize: 14.5)
        lbl.textColor = theme.inkBody
        return lbl
    }

    private func paddedPill(_ text: String, color: UIColor) -> UIView {
        let lbl = UILabel()
        lbl.text = text
        lbl.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        lbl.textColor = color
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        wrap.backgroundColor = color.withAlphaComponent(0.13)
        wrap.layer.cornerRadius = 9
        embed(lbl, in: wrap, insetV: 5, insetH: 11)
        return wrap
    }

    // MARK: layout helpers

    private func leftAlign(_ view: UIView) -> UIView {
        let row = UIStackView(arrangedSubviews: [view, UIView()])
        row.axis = .horizontal
        row.translatesAutoresizingMaskIntoConstraints = false
        view.setContentHuggingPriority(.required, for: .horizontal)
        return row
    }

    private func embed(_ child: UIView, in parent: UIView, inset: CGFloat) {
        embed(child, in: parent, insetV: inset, insetH: inset)
    }
    private func embed(_ child: UIView, in parent: UIView, insetV: CGFloat, insetH: CGFloat) {
        child.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(child)
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo: parent.topAnchor, constant: insetV),
            child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -insetV),
            child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: insetH),
            child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -insetH),
        ])
    }
}

// MARK: - Image loader (data URL + remote)

enum LNImageLoader {
    private static let cache = NSCache<NSString, UIImage>()

    static func load(_ src: String, into imageView: UIImageView) {
        if let cached = cache.object(forKey: src as NSString) {
            imageView.image = cached
            return
        }
        if src.hasPrefix("data:") {
            if let comma = src.firstIndex(of: ","),
               let data = Data(base64Encoded: String(src[src.index(after: comma)...])),
               let img = UIImage(data: data) {
                cache.setObject(img, forKey: src as NSString)
                imageView.image = img
            }
            return
        }
        guard let url = URL(string: src) else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data, let img = UIImage(data: data) else { return }
            cache.setObject(img, forKey: src as NSString)
            DispatchQueue.main.async { imageView.image = img }
        }.resume()
    }
}

// MARK: - View controller

final class LessonNoteViewController: UIViewController {
    private let lessonId: Int
    private let aiNoteId: Int
    private let lessonTitle: String
    private let engine: String
    private let token: String
    private let apiBaseUrl: String
    private let theme: LNTheme

    private let scrollView = UIScrollView()
    private let zoomView = UIView()
    private let contentView = UIView()
    private let stack = UIStackView()
    private let inkView = InkView()
    private let pageScrollDelegate = PageScrollDelegate()
    private let spinner = UIActivityIndicatorView(style: .large)
    private var inkKey: String { aiNoteId > 0 ? "note-\(aiNoteId)" : "lesson-\(lessonId)" }
    private var saveWorkItem: DispatchWorkItem?

    // Custom GoodNotes-style ink toolbar state.
    private var currentTool: InkTool = .pen
    private var currentColorIndex = 0
    private var currentWidthIndex = 1
    private let widthOptions: [CGFloat] = [2.5, 5, 9]
    private var toolButtons: [InkTool: UIButton] = [:]
    private var colorButtons: [UIButton] = []
    private var widthButtons: [UIButton] = []
    private var fingerButton: UIButton?
    // Off = Pencil draws / finger scrolls. On = finger (or mouse on simulator) draws.
    private var fingerDraws = false
    private var inkPalette: [String] {
        theme.dark
            ? ["#f8fafc", "#60a5fa", "#f87171", "#34d399", "#fbbf24", "#c4b5fd"]
            : ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed"]
    }

    init(lessonId: Int, aiNoteId: Int, title: String, engine: String, token: String, apiBaseUrl: String, dark: Bool) {
        self.lessonId = lessonId
        self.aiNoteId = aiNoteId
        self.lessonTitle = title
        self.engine = engine.isEmpty ? "gemini" : engine
        self.token = token
        self.apiBaseUrl = apiBaseUrl
        self.theme = LNTheme(dark: dark)
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }
    required init?(coder: NSCoder) { fatalError() }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { theme.dark ? .lightContent : .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = theme.pageBg
        setupTopBar()
        setupCanvasScroll()
        applyTool()
        spinner.color = theme.inkMuted
        spinner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        spinner.startAnimating()
        fetchNote()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        persistInk()
    }

    // MARK: setup

    private let topBar = UIView()

    private func setupTopBar() {
        topBar.translatesAutoresizingMaskIntoConstraints = false
        topBar.backgroundColor = theme.topbarBg
        view.addSubview(topBar)

        let border = UIView()
        border.translatesAutoresizingMaskIntoConstraints = false
        border.backgroundColor = theme.topbarBorder
        topBar.addSubview(border)

        // ── Nav row: Back · title · clear ──
        let back = UIButton(type: .system)
        back.setImage(UIImage(systemName: "chevron.left"), for: .normal)
        back.setTitle(" Back", for: .normal)
        back.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        back.tintColor = theme.accent
        back.setTitleColor(theme.accent, for: .normal)
        back.translatesAutoresizingMaskIntoConstraints = false
        back.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        topBar.addSubview(back)

        let titleLabel = UILabel()
        titleLabel.text = lessonTitle
        titleLabel.font = UIFont.systemFont(ofSize: 15, weight: .bold)
        titleLabel.textColor = theme.inkStrong
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(titleLabel)

        let clear = UIButton(type: .system)
        clear.setImage(UIImage(systemName: "trash"), for: .normal)
        clear.tintColor = theme.inkMuted
        clear.translatesAutoresizingMaskIntoConstraints = false
        clear.addTarget(self, action: #selector(clearTapped), for: .touchUpInside)
        topBar.addSubview(clear)

        // ── Tools row: pen/hl/eraser · colors · widths · undo/redo (h-scroll) ──
        let toolsScroll = UIScrollView()
        toolsScroll.translatesAutoresizingMaskIntoConstraints = false
        toolsScroll.showsHorizontalScrollIndicator = false
        topBar.addSubview(toolsScroll)

        let tools = UIStackView()
        tools.axis = .horizontal
        tools.alignment = .center
        tools.spacing = 7
        tools.translatesAutoresizingMaskIntoConstraints = false
        toolsScroll.addSubview(tools)

        tools.addArrangedSubview(toolButton("pencil.tip", tool: .pen))
        tools.addArrangedSubview(toolButton("highlighter", tool: .highlighter))
        tools.addArrangedSubview(toolButton("eraser", tool: .eraser))
        tools.addArrangedSubview(divider())
        for (i, hexc) in inkPalette.enumerated() {
            let b = colorButton(LNTheme.hex(hexc), index: i)
            colorButtons.append(b)
            tools.addArrangedSubview(b)
        }
        tools.addArrangedSubview(divider())
        for (i, w) in widthOptions.enumerated() {
            let b = widthButton(w, index: i)
            widthButtons.append(b)
            tools.addArrangedSubview(b)
        }
        tools.addArrangedSubview(divider())
        let finger = iconButton("hand.draw")
        finger.layer.cornerRadius = 9
        finger.addTarget(self, action: #selector(fingerToggleTapped), for: .touchUpInside)
        fingerButton = finger
        tools.addArrangedSubview(finger)
        tools.addArrangedSubview(divider())
        let undo = iconButton("arrow.uturn.backward")
        undo.addTarget(self, action: #selector(undoTapped), for: .touchUpInside)
        let redo = iconButton("arrow.uturn.forward")
        redo.addTarget(self, action: #selector(redoTapped), for: .touchUpInside)
        tools.addArrangedSubview(undo)
        tools.addArrangedSubview(redo)

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            back.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 10),
            back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            back.heightAnchor.constraint(equalToConstant: 34),

            clear.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -12),
            clear.centerYAnchor.constraint(equalTo: back.centerYAnchor),
            clear.widthAnchor.constraint(equalToConstant: 34),

            titleLabel.centerXAnchor.constraint(equalTo: topBar.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: back.centerYAnchor),
            titleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: back.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: clear.leadingAnchor, constant: -8),

            toolsScroll.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 4),
            toolsScroll.leadingAnchor.constraint(equalTo: topBar.leadingAnchor),
            toolsScroll.trailingAnchor.constraint(equalTo: topBar.trailingAnchor),
            toolsScroll.heightAnchor.constraint(equalToConstant: 44),

            tools.topAnchor.constraint(equalTo: toolsScroll.topAnchor),
            tools.bottomAnchor.constraint(equalTo: toolsScroll.bottomAnchor),
            tools.leadingAnchor.constraint(equalTo: toolsScroll.leadingAnchor, constant: 12),
            tools.trailingAnchor.constraint(equalTo: toolsScroll.trailingAnchor, constant: -12),
            tools.heightAnchor.constraint(equalTo: toolsScroll.heightAnchor),

            topBar.bottomAnchor.constraint(equalTo: toolsScroll.bottomAnchor),

            border.leadingAnchor.constraint(equalTo: topBar.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: topBar.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: topBar.bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 0.5),
        ])

        updateToolSelectionUI()
    }

    private func setupCanvasScroll() {
        // GoodNotes-style "ink over a zoomable page" — the WEB NoteCanvas mechanism,
        // native: the page (scrollView → zoomView → contentView note) is zoomed by
        // transform; the `inkView` (custom vector-stroke layer) lives INSIDE zoomView
        // on top of the note, so it's always aligned. On zoom-settle, BOTH the note
        // text and the ink are re-rasterised at a higher backing scale
        // (contentScaleFactor / renderScale = screenScale × zoom) → crisp.
        // Gestures: scrollView.pan is FINGER-only, so a Pencil draws (inkView) and a
        // finger scrolls/zooms; ✋ mode lets a single finger draw (2 fingers scroll).
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.backgroundColor = theme.canvasBg
        scrollView.alwaysBounceVertical = true
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 4.0
        scrollView.bouncesZoom = true
        scrollView.contentInsetAdjustmentBehavior = .never
        pageScrollDelegate.zoomTarget = zoomView
        pageScrollDelegate.onEndZoom = { [weak self] scale in self?.applyRenderScale(for: scale) }
        scrollView.delegate = pageScrollDelegate
        // Pencil never scrolls the page (it draws); only fingers scroll/zoom.
        scrollView.panGestureRecognizer.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        view.addSubview(scrollView)

        zoomView.translatesAutoresizingMaskIntoConstraints = false
        zoomView.backgroundColor = .clear
        scrollView.addSubview(zoomView)

        contentView.translatesAutoresizingMaskIntoConstraints = false
        contentView.backgroundColor = .clear
        zoomView.addSubview(contentView)

        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)

        // Custom vector ink overlay, on top of the note, inside the zoom container.
        inkView.translatesAutoresizingMaskIntoConstraints = false
        inkView.onChange = { [weak self] in self?.scheduleInkSave() }
        inkView.setStrokes(LNInkStore.load(inkKey))
        applyDrawingPolicy()
        zoomView.addSubview(inkView)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: topBar.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            zoomView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            zoomView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            zoomView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            zoomView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            zoomView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            contentView.topAnchor.constraint(equalTo: zoomView.topAnchor),
            contentView.bottomAnchor.constraint(equalTo: zoomView.bottomAnchor),
            contentView.leadingAnchor.constraint(equalTo: zoomView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: zoomView.trailingAnchor),

            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 18),
            stack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -90),
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

            inkView.topAnchor.constraint(equalTo: zoomView.topAnchor),
            inkView.bottomAnchor.constraint(equalTo: zoomView.bottomAnchor),
            inkView.leadingAnchor.constraint(equalTo: zoomView.leadingAnchor),
            inkView.trailingAnchor.constraint(equalTo: zoomView.trailingAnchor),
        ])
    }

    // MARK: ink toolbar builders

    private func iconButton(_ symbol: String) -> UIButton {
        let b = UIButton(type: .system)
        b.setImage(UIImage(systemName: symbol), for: .normal)
        b.tintColor = theme.inkStrong
        b.translatesAutoresizingMaskIntoConstraints = false
        b.widthAnchor.constraint(equalToConstant: 34).isActive = true
        b.heightAnchor.constraint(equalToConstant: 34).isActive = true
        return b
    }

    private func toolButton(_ symbol: String, tool: InkTool) -> UIButton {
        let b = iconButton(symbol)
        b.layer.cornerRadius = 9
        b.tag = tool == .pen ? 0 : (tool == .highlighter ? 1 : 2)
        b.addTarget(self, action: #selector(toolTapped(_:)), for: .touchUpInside)
        toolButtons[tool] = b
        return b
    }

    private func colorButton(_ color: UIColor, index: Int) -> UIButton {
        let b = UIButton(type: .custom)
        b.translatesAutoresizingMaskIntoConstraints = false
        b.backgroundColor = color
        b.layer.cornerRadius = 13
        b.layer.borderWidth = 2.5
        b.layer.borderColor = UIColor.clear.cgColor
        b.tag = index
        b.widthAnchor.constraint(equalToConstant: 26).isActive = true
        b.heightAnchor.constraint(equalToConstant: 26).isActive = true
        b.addTarget(self, action: #selector(colorTapped(_:)), for: .touchUpInside)
        return b
    }

    private func widthButton(_ w: CGFloat, index: Int) -> UIButton {
        let b = UIButton(type: .custom)
        b.translatesAutoresizingMaskIntoConstraints = false
        b.tag = index
        b.layer.cornerRadius = 9
        b.widthAnchor.constraint(equalToConstant: 34).isActive = true
        b.heightAnchor.constraint(equalToConstant: 34).isActive = true
        let dot = UIView()
        dot.translatesAutoresizingMaskIntoConstraints = false
        dot.backgroundColor = theme.inkStrong
        dot.isUserInteractionEnabled = false
        let size = 4 + CGFloat(index) * 4
        dot.layer.cornerRadius = size / 2
        b.addSubview(dot)
        NSLayoutConstraint.activate([
            dot.centerXAnchor.constraint(equalTo: b.centerXAnchor),
            dot.centerYAnchor.constraint(equalTo: b.centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: size),
            dot.heightAnchor.constraint(equalToConstant: size),
        ])
        b.addTarget(self, action: #selector(widthTapped(_:)), for: .touchUpInside)
        return b
    }

    private func divider() -> UIView {
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        v.backgroundColor = theme.topbarBorder
        v.widthAnchor.constraint(equalToConstant: 1).isActive = true
        v.heightAnchor.constraint(equalToConstant: 22).isActive = true
        return v
    }

    // MARK: ink toolbar actions

    @objc private func toolTapped(_ sender: UIButton) {
        currentTool = sender.tag == 0 ? .pen : (sender.tag == 1 ? .highlighter : .eraser)
        applyTool()
        updateToolSelectionUI()
    }

    @objc private func colorTapped(_ sender: UIButton) {
        currentColorIndex = sender.tag
        if currentTool == .eraser { currentTool = .pen }
        applyTool()
        updateToolSelectionUI()
    }

    @objc private func widthTapped(_ sender: UIButton) {
        currentWidthIndex = sender.tag
        applyTool()
        updateToolSelectionUI()
    }

    @objc private func undoTapped() { inkView.undo() }
    @objc private func redoTapped() { inkView.redo() }

    @objc private func fingerToggleTapped() {
        fingerDraws.toggle()
        applyDrawingPolicy()
        updateToolSelectionUI()
    }

    private func applyDrawingPolicy() {
        inkView.fingerDrawingEnabled = fingerDraws
        // ✋ ON: a single finger draws, so the page must scroll with TWO fingers.
        // OFF: only the Pencil draws; one finger scrolls.
        scrollView.panGestureRecognizer.minimumNumberOfTouches = fingerDraws ? 2 : 1
        let types: [NSNumber] = fingerDraws
            ? [NSNumber(value: UITouch.TouchType.direct.rawValue)]
            : [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        scrollView.panGestureRecognizer.allowedTouchTypes = types
    }

    private func applyTool() {
        inkView.tool = currentTool
        inkView.inkColor = LNTheme.hex(inkPalette[currentColorIndex])
        inkView.baseWidth = widthOptions[currentWidthIndex]
    }

    private func updateToolSelectionUI() {
        let selBg = theme.accent.withAlphaComponent(theme.dark ? 0.30 : 0.15)
        for (tool, btn) in toolButtons {
            let on = tool == currentTool
            btn.backgroundColor = on ? selBg : .clear
            btn.tintColor = on ? theme.accent : theme.inkStrong
        }
        for (i, btn) in colorButtons.enumerated() {
            let on = i == currentColorIndex && currentTool != .eraser
            btn.layer.borderColor = on ? theme.inkStrong.cgColor : UIColor.clear.cgColor
            btn.transform = on ? CGAffineTransform(scaleX: 1.14, y: 1.14) : .identity
        }
        for (i, btn) in widthButtons.enumerated() {
            btn.backgroundColor = i == currentWidthIndex ? selBg : .clear
        }
        fingerButton?.backgroundColor = fingerDraws ? selBg : .clear
        fingerButton?.tintColor = fingerDraws ? theme.accent : theme.inkStrong
    }

    // MARK: data

    private func fetchNote() {
        let path: String
        if aiNoteId > 0 {
            path = "\(apiBaseUrl)/student/ai-notes/\(aiNoteId)?engine=\(engine)"
        } else {
            path = "\(apiBaseUrl)/student/ai-notes/lesson/\(lessonId)?engine=\(engine)"
        }
        guard let url = URL(string: path) else { renderFailure(); return }
        var request = URLRequest(url: url)
        if !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            guard let self else { return }
            guard let data,
                  let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
                DispatchQueue.main.async { self.renderFailure() }
                return
            }
            let note = LNParser.parse(json, fallbackTitle: self.lessonTitle)
            DispatchQueue.main.async { self.renderNote(note) }
        }.resume()
    }

    private func renderNote(_ note: LNNote) {
        spinner.stopAnimating()
        let renderer = LessonNoteRenderer(theme: theme)
        renderer.build(note, into: stack, maxWidth: view.bounds.width - 32)
        view.layoutIfNeeded()
    }

    private func renderFailure() {
        spinner.stopAnimating()
        let lbl = UILabel()
        lbl.numberOfLines = 0
        lbl.textAlignment = .center
        lbl.text = "Couldn't load this lesson's notes.\nCheck your connection and try again."
        lbl.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        lbl.textColor = theme.inkMuted
        stack.addArrangedSubview(lbl)
    }

    // MARK: ink lifecycle

    // Re-render the NOTE TEXT and the INK at a backing resolution matching the zoom
    // (both are bitmap-scaled by the page's zoom transform). Custom drawing honours
    // contentScaleFactor, so this keeps glyphs AND vector ink crisp — the same idea
    // as the web's `dpr = base × zoom`. Capped at ~3× to bound memory.
    private func applyRenderScale(for zoom: CGFloat) {
        let target = UIScreen.main.scale * min(max(zoom, 1), 3)
        func bumpLayers(_ layer: CALayer) {
            layer.contentsScale = target
            layer.rasterizationScale = target
            layer.sublayers?.forEach(bumpLayers)
        }
        func bump(_ v: UIView) {
            v.contentScaleFactor = target
            bumpLayers(v.layer)
            v.setNeedsDisplay()
            v.subviews.forEach(bump)
        }
        bump(contentView)
        inkView.renderScale = target
    }

    private func scheduleInkSave() {
        saveWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.persistInk() }
        saveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8, execute: work)
    }

    private func persistInk() {
        LNInkStore.save(inkKey, inkView.strokes)
    }

    @objc private func closeTapped() {
        persistInk()
        dismiss(animated: true)
    }

    @objc private func clearTapped() {
        let alert = UIAlertController(title: "Clear ink?", message: "This removes your handwriting on this lesson.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Clear", style: .destructive) { [weak self] _ in
            self?.inkView.clear()
        })
        present(alert, animated: true)
    }
}

// MARK: - Custom vector ink view (mirrors the web NoteCanvas mechanism)

// Stores strokes as vector point arrays and redraws them via Core Graphics. Lives
// INSIDE the zoomed page (so it's always aligned with the text). Because custom
// drawing honours `contentScaleFactor`, bumping it to screenScale×zoom on
// zoom-settle re-rasterises the ink CRISP at any magnification — exactly what the
// web does with `dpr = base × zoom`. Pencil always draws; a finger draws only in
// ✋ mode (the page scroll view's pan is finger-only, so a finger otherwise
// scrolls/zooms while the Pencil draws).
final class InkView: UIView {
    private(set) var strokes: [InkStroke] = []
    private var redoStack: [InkStroke] = []
    private var current: InkStroke?

    var tool: InkTool = .pen
    var inkColor: UIColor = .label
    var baseWidth: CGFloat = 5
    var fingerDrawingEnabled = false
    var onChange: (() -> Void)?

    var renderScale: CGFloat = UIScreen.main.scale {
        didSet {
            guard abs(renderScale - oldValue) > 0.01 else { return }
            contentScaleFactor = renderScale
            setNeedsDisplay()
        }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isMultipleTouchEnabled = true
        contentScaleFactor = renderScale
    }
    required init?(coder: NSCoder) { fatalError() }

    func setStrokes(_ s: [InkStroke]) { strokes = s; redoStack = []; setNeedsDisplay() }
    func clear() { strokes = []; current = nil; redoStack = []; setNeedsDisplay(); onChange?() }
    func undo() { if let s = strokes.popLast() { redoStack.append(s); setNeedsDisplay(); onChange?() } }
    func redo() { if let s = redoStack.popLast() { strokes.append(s); setNeedsDisplay(); onChange?() } }

    // MARK: touches

    private func shouldDraw(_ touch: UITouch, event: UIEvent?) -> Bool {
        if touch.type == .pencil { return true }
        // Finger: only when ✋ on AND single-touch (multi-touch → page scroll/zoom).
        return fingerDrawingEnabled && (event?.allTouches?.count ?? 1) <= 1
    }

    private func point(_ t: UITouch) -> InkPoint {
        let p = t.location(in: self)
        var f: CGFloat = 0.7
        if t.maximumPossibleForce > 0 { f = t.force / t.maximumPossibleForce }
        if f <= 0.01 { f = 0.7 }
        return InkPoint(x: p.x, y: p.y, f: f)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = touches.first, shouldDraw(t, event: event) else {
            super.touchesBegan(touches, with: event); return
        }
        redoStack.removeAll()
        let w: CGFloat = tool == .highlighter ? max(baseWidth * 3.5, 16)
                       : tool == .eraser ? max(baseWidth * 4, 24)
                       : baseWidth
        current = InkStroke(tool: tool, colorHex: InkView.hex(inkColor), width: w, points: [point(t)])
        setNeedsDisplay()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard current != nil, let t = touches.first else { super.touchesMoved(touches, with: event); return }
        for c in event?.coalescedTouches(for: t) ?? [t] { current?.points.append(point(c)) }
        setNeedsDisplay()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let s = current else { super.touchesEnded(touches, with: event); return }
        strokes.append(s); current = nil; setNeedsDisplay(); onChange?()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        current = nil; setNeedsDisplay()
    }

    // MARK: rendering

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        var all = strokes
        if let c = current { all.append(c) }
        for s in all { render(s, in: ctx) }
    }

    private func render(_ s: InkStroke, in ctx: CGContext) {
        guard !s.points.isEmpty else { return }
        ctx.saveGState()
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)

        let color = InkView.color(s.colorHex)
        switch s.tool {
        case .eraser:
            ctx.setBlendMode(.clear)
            ctx.setStrokeColor(UIColor.black.cgColor)
        case .highlighter:
            ctx.setBlendMode(.normal)
            ctx.setStrokeColor(color.withAlphaComponent(0.32).cgColor)
        case .pen:
            ctx.setBlendMode(.normal)
            ctx.setStrokeColor(color.cgColor)
        }

        let pts = s.points
        let avgF = pts.reduce(0) { $0 + $1.f } / CGFloat(pts.count)
        let w = s.tool == .pen ? s.width * (0.65 + 0.7 * avgF) : s.width
        ctx.setLineWidth(max(0.6, w))

        if pts.count == 1 {
            let p = pts[0]
            ctx.setFillColor((s.tool == .eraser ? UIColor.black : (s.tool == .highlighter ? color.withAlphaComponent(0.32) : color)).cgColor)
            ctx.fillEllipse(in: CGRect(x: p.x - w/2, y: p.y - w/2, width: w, height: w))
            ctx.restoreGState(); return
        }

        let path = CGMutablePath()
        path.move(to: CGPoint(x: pts[0].x, y: pts[0].y))
        if pts.count == 2 {
            path.addLine(to: CGPoint(x: pts[1].x, y: pts[1].y))
        } else {
            // Quadratic smoothing through midpoints (same as the web canvas).
            for i in 1..<(pts.count - 1) {
                let mid = CGPoint(x: (pts[i].x + pts[i+1].x) / 2, y: (pts[i].y + pts[i+1].y) / 2)
                path.addQuadCurve(to: mid, control: CGPoint(x: pts[i].x, y: pts[i].y))
            }
            path.addLine(to: CGPoint(x: pts[pts.count-1].x, y: pts[pts.count-1].y))
        }
        ctx.addPath(path)
        ctx.strokePath()
        ctx.restoreGState()
    }

    // MARK: color hex helpers
    static func hex(_ c: UIColor) -> String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        c.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X", Int(r*255), Int(g*255), Int(b*255))
    }
    static func color(_ hex: String) -> UIColor { LNTheme.hex(hex) }
}

// Scroll-view delegate proxy for the PAGE scroll view.
final class PageScrollDelegate: NSObject, UIScrollViewDelegate {
    weak var zoomTarget: UIView?
    var onEndZoom: ((CGFloat) -> Void)?

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { zoomTarget }
    func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
        onEndZoom?(scale)
    }
}

