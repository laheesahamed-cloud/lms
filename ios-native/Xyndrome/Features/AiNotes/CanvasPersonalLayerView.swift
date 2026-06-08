import SwiftUI

struct AiNoteCanvasPersonalWorkspace: View {
    let note: AiNoteDetail
    let page: AiNoteCanvasPage

    @State private var personalLayer = StudentCanvasPersonalLayer.empty
    @State private var isPersonalizing = false
    @State private var selectedTool: StudentCanvasDrawingTool = .pen
    @State private var penColor = "#2563EB"
    @State private var highlighterColor = "#FDE047"
    @State private var penWidth = 5.0
    @State private var selectedStickerId: String?
    @State private var saveStatus = ""
    @State private var showClearConfirmation = false

    private var storageKey: String {
        StudentCanvasPersonalLayerStore.key(noteId: note.id, lessonId: note.lessonId)
    }

    private var activeColor: String {
        selectedTool == .highlighter ? highlighterColor : penColor
    }

    private var availableColors: [String] {
        selectedTool == .highlighter ? StudentCanvasPalette.highlighterColors : StudentCanvasPalette.penColors
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            header

            if isPersonalizing {
                StudentCanvasTopToolbar(
                    selectedTool: selectedTool,
                    selectedColor: activeColor,
                    availableColors: availableColors,
                    penWidth: penWidth,
                    strokeCount: personalLayer.strokes.count,
                    onSelectTool: selectTool,
                    onSelectColor: selectColor,
                    onSelectWidth: { penWidth = $0 },
                    onUndo: undoStroke,
                    onClear: { showClearConfirmation = true },
                    onAddEmoji: addEmojiSticker,
                    onAddTag: addTagSticker,
                    onAddNote: addStickyNote
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            AiNoteCanvasReader(note: note, page: page)
                .overlay(alignment: .topLeading) {
                    GeometryReader { proxy in
                        ZStack(alignment: .topLeading) {
                            StudentCanvasDrawingSurface(
                                strokes: personalLayer.strokes,
                                isEnabled: isPersonalizing,
                                tool: selectedTool,
                                colorHex: activeColor,
                                width: penWidth,
                                onCommitStroke: commitStroke
                            )

                            ForEach(personalLayer.stickers) { sticker in
                                StudentCanvasStickerView(
                                    sticker: sticker,
                                    isEditable: isPersonalizing,
                                    isSelected: selectedStickerId == sticker.id,
                                    canvasSize: proxy.size,
                                    onSelect: { selectedStickerId = sticker.id },
                                    onUpdate: updateSticker,
                                    onDelete: deleteSticker
                                )
                            }
                        }
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
                        .clipped()
                    }
                }
        }
        .onAppear(perform: loadPersonalLayer)
        .onChange(of: storageKey) { _, _ in loadPersonalLayer() }
        .alert("Clear all canvas writing?", isPresented: $showClearConfirmation) {
            Button("Clear", role: .destructive, action: clearStrokes)
            Button("Cancel", role: .cancel) { }
        }
    }

    private var header: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            Label("Personal canvas", systemImage: "pencil.and.outline")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.black)
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .textCase(.uppercase)

            if !saveStatus.isEmpty {
                Text(saveStatus)
                    .font(XyndromeTheme.Typography.caption2())
                    .fontWeight(.bold)
                    .foregroundStyle(XyndromeTheme.Colors.success)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            Button {
                withAnimation(.spring(response: 0.28, dampingFraction: 0.88)) {
                    isPersonalizing.toggle()
                    selectedStickerId = nil
                    if isPersonalizing {
                        selectedTool = .pen
                    }
                }
            } label: {
                Label(isPersonalizing ? "Done" : "Personalize", systemImage: isPersonalizing ? "checkmark" : "pencil.tip")
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.black)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(isPersonalizing ? XyndromeTheme.Colors.success.opacity(0.14) : XyndromeTheme.Colors.primary.opacity(0.12))
                    )
                    .foregroundStyle(isPersonalizing ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.primary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, XyndromeTheme.Spacing.xs)
    }

    private func loadPersonalLayer() {
        personalLayer = StudentCanvasPersonalLayerStore.load(key: storageKey)
        saveStatus = personalLayer.isEmpty ? "" : "Saved on this device"
    }

    private func selectTool(_ tool: StudentCanvasDrawingTool) {
        selectedTool = tool
        if tool == .highlighter, !StudentCanvasPalette.highlighterColors.contains(highlighterColor) {
            highlighterColor = StudentCanvasPalette.highlighterColors[0]
        }
        if tool == .pen, !StudentCanvasPalette.penColors.contains(penColor) {
            penColor = StudentCanvasPalette.penColors[1]
        }
    }

    private func selectColor(_ color: String) {
        if selectedTool == .highlighter {
            highlighterColor = color
        } else {
            penColor = color
        }
    }

    private func commitStroke(_ stroke: StudentCanvasStroke) {
        updateLayer { layer in
            layer.strokes.append(stroke)
            if layer.strokes.count > 250 {
                layer.strokes.removeFirst(layer.strokes.count - 250)
            }
        }
    }

    private func undoStroke() {
        guard !personalLayer.strokes.isEmpty else { return }
        updateLayer { layer in
            _ = layer.strokes.popLast()
        }
    }

    private func clearStrokes() {
        updateLayer { layer in
            layer.strokes.removeAll()
        }
    }

    private func addEmojiSticker(_ value: String) {
        addSticker(.emoji(value))
    }

    private func addTagSticker(_ tag: StudentCanvasTagPreset) {
        addSticker(.tag(label: tag.label, colorHex: tag.colorHex))
    }

    private func addStickyNote(_ preset: StudentCanvasStickyPreset) {
        addSticker(.note(colorKey: preset.key))
    }

    private func addSticker(_ kind: StudentCanvasStickerKind) {
        let existing = personalLayer.stickers.count
        let offset = Double(existing % 5) * 0.035
        let sticker = StudentCanvasSticker(
            id: "st-\(UUID().uuidString)",
            kind: kind,
            x: 0.08 + offset,
            y: 0.10 + offset,
            rotation: kind.isFreeFloating ? Double(Int.random(in: -8...8)) : 0,
            width: kind.defaultWidth,
            height: kind.defaultHeight
        )
        selectedStickerId = sticker.id
        updateLayer { layer in
            layer.stickers.append(sticker)
        }
    }

    private func updateSticker(_ sticker: StudentCanvasSticker) {
        updateLayer { layer in
            layer.stickers = layer.stickers.map { $0.id == sticker.id ? sticker : $0 }
        }
    }

    private func deleteSticker(_ sticker: StudentCanvasSticker) {
        if selectedStickerId == sticker.id {
            selectedStickerId = nil
        }
        updateLayer { layer in
            layer.stickers.removeAll { $0.id == sticker.id }
        }
    }

    private func updateLayer(_ mutation: (inout StudentCanvasPersonalLayer) -> Void) {
        var next = personalLayer
        mutation(&next)
        next.savedAt = Date().timeIntervalSince1970 * 1000
        personalLayer = next.normalized()
        let didSave = StudentCanvasPersonalLayerStore.save(personalLayer, key: storageKey)
        saveStatus = didSave ? "Saved on this device" : "Save failed"
    }
}

private struct StudentCanvasTopToolbar: View {
    let selectedTool: StudentCanvasDrawingTool
    let selectedColor: String
    let availableColors: [String]
    let penWidth: Double
    let strokeCount: Int
    let onSelectTool: (StudentCanvasDrawingTool) -> Void
    let onSelectColor: (String) -> Void
    let onSelectWidth: (Double) -> Void
    let onUndo: () -> Void
    let onClear: () -> Void
    let onAddEmoji: (String) -> Void
    let onAddTag: (StudentCanvasTagPreset) -> Void
    let onAddNote: (StudentCanvasStickyPreset) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(StudentCanvasDrawingTool.allCases) { tool in
                    toolbarButton(systemImage: tool.systemImage, isActive: selectedTool == tool) {
                        onSelectTool(tool)
                    }
                    .accessibilityLabel(tool.title)
                }

                divider

                ForEach(availableColors, id: \.self) { color in
                    Button {
                        onSelectColor(color)
                    } label: {
                        Circle()
                            .fill(Color(hex: color))
                            .frame(width: 18, height: 18)
                            .overlay(
                                Circle()
                                    .strokeBorder(selectedColor == color ? XyndromeTheme.Colors.textPrimary : XyndromeTheme.Colors.textMuted.opacity(0.24), lineWidth: selectedColor == color ? 2 : 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .frame(width: 30, height: 30)
                    .accessibilityLabel("Color \(color)")
                }

                divider

                ForEach(StudentCanvasPalette.widths, id: \.self) { width in
                    Button {
                        onSelectWidth(width)
                    } label: {
                        RoundedRectangle(cornerRadius: 999)
                            .fill(Color(hex: selectedColor))
                            .frame(width: 19, height: max(2, width))
                            .frame(width: 30, height: 30)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                    .fill(width == penWidth ? XyndromeTheme.Colors.accent.opacity(0.12) : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Stroke width \(Int(width))")
                }

                divider

                toolbarButton(systemImage: "arrow.uturn.backward", isActive: false, isDisabled: strokeCount == 0, action: onUndo)
                    .accessibilityLabel("Undo stroke")
                toolbarButton(systemImage: "trash", isActive: false, isDestructive: strokeCount > 0, isDisabled: strokeCount == 0, action: onClear)
                    .accessibilityLabel("Clear writing")

                divider

                Menu {
                    Section("Sticky notes") {
                        ForEach(StudentCanvasPalette.stickyPresets) { preset in
                            Button(preset.title) { onAddNote(preset) }
                        }
                    }

                    Section("Tags") {
                        ForEach(StudentCanvasPalette.tagPresets) { tag in
                            Button(tag.label) { onAddTag(tag) }
                        }
                    }

                    Section("Stickers") {
                        ForEach(StudentCanvasPalette.emojiStickers, id: \.self) { sticker in
                            Button(sticker) { onAddEmoji(sticker) }
                        }
                    }
                } label: {
                    Image(systemName: "note.text.badge.plus")
                        .font(.system(size: 13, weight: .bold))
                        .frame(width: 32, height: 32)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .fill(XyndromeTheme.Colors.surfaceTertiary)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add sticker or sticky note")
            }
            .padding(6)
        }
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(XyndromeTheme.Colors.textMuted.opacity(0.14), lineWidth: 1)
                )
        )
    }

    private var divider: some View {
        Rectangle()
            .fill(XyndromeTheme.Colors.textMuted.opacity(0.18))
            .frame(width: 1, height: 20)
            .padding(.horizontal, 2)
    }

    private func toolbarButton(
        systemImage: String,
        isActive: Bool,
        isDestructive: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(
                    isActive
                    ? XyndromeTheme.Colors.primary
                    : isDestructive ? XyndromeTheme.Colors.error : XyndromeTheme.Colors.textSecondary
                )
                .frame(width: 32, height: 32)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(isActive ? XyndromeTheme.Colors.primary.opacity(0.12) : XyndromeTheme.Colors.surfaceTertiary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .strokeBorder(isActive ? XyndromeTheme.Colors.primary.opacity(0.3) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.42 : 1)
    }
}

private struct StudentCanvasDrawingSurface: View {
    let strokes: [StudentCanvasStroke]
    let isEnabled: Bool
    let tool: StudentCanvasDrawingTool
    let colorHex: String
    let width: Double
    let onCommitStroke: (StudentCanvasStroke) -> Void

    @State private var currentStroke: StudentCanvasStroke?

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                for stroke in strokes {
                    draw(stroke, in: &context, size: size)
                }
                if let currentStroke {
                    draw(currentStroke, in: &context, size: size)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { value in
                        handleDragChange(value, size: proxy.size)
                    }
                    .onEnded { value in
                        handleDragEnd(value, size: proxy.size)
                    }
            )
            .allowsHitTesting(isEnabled)
            .accessibilityHidden(true)
        }
    }

    private func handleDragChange(_ value: DragGesture.Value, size: CGSize) {
        guard isEnabled, size.width > 1, size.height > 1 else { return }
        if currentStroke == nil {
            let startPoint = normalizedPoint(value.startLocation, size: size)
            currentStroke = StudentCanvasStroke(
                id: "\(tool.rawValue)-\(UUID().uuidString)",
                colorHex: colorHex,
                width: resolvedWidth,
                opacity: tool.opacity,
                tool: tool,
                points: [startPoint]
            )
        }

        guard var stroke = currentStroke else { return }
        let nextPoint = normalizedPoint(value.location, size: size)
        if stroke.shouldAppend(nextPoint) {
            stroke.points.append(nextPoint)
            if stroke.points.count > 2_200 {
                stroke.points.removeFirst(stroke.points.count - 2_200)
            }
            currentStroke = stroke
        }
    }

    private func handleDragEnd(_ value: DragGesture.Value, size: CGSize) {
        handleDragChange(value, size: size)
        guard let stroke = currentStroke?.simplified(), !stroke.points.isEmpty else {
            currentStroke = nil
            return
        }
        onCommitStroke(stroke)
        currentStroke = nil
    }

    private var resolvedWidth: Double {
        switch tool {
        case .pen:
            return max(1.5, width)
        case .highlighter:
            return max(10, width * 2.4)
        case .eraser:
            return max(24, width * 7)
        }
    }

    private func normalizedPoint(_ location: CGPoint, size: CGSize) -> StudentCanvasStrokePoint {
        StudentCanvasStrokePoint(
            x: min(1, max(0, Double(location.x / max(size.width, 1)))),
            y: min(1, max(0, Double(location.y / max(size.height, 1)))),
            pressure: 0.78
        )
    }

    private func draw(_ stroke: StudentCanvasStroke, in context: inout GraphicsContext, size: CGSize) {
        guard let first = stroke.points.first else { return }
        let style = StrokeStyle(lineWidth: stroke.width, lineCap: .round, lineJoin: .round)
        let color = Color(hex: stroke.colorHex)

        if stroke.points.count == 1 {
            let center = first.point(in: size)
            let diameter = max(2, stroke.width)
            let dot = Path(ellipseIn: CGRect(x: center.x - diameter / 2, y: center.y - diameter / 2, width: diameter, height: diameter))
            context.drawLayer { layer in
                if stroke.tool == .eraser {
                    layer.blendMode = .destinationOut
                    layer.fill(dot, with: .color(.black))
                } else {
                    if stroke.tool == .highlighter {
                        layer.blendMode = .multiply
                    }
                    layer.opacity = stroke.opacity
                    layer.fill(dot, with: .color(color))
                }
            }
            return
        }

        let path = smoothPath(points: stroke.points, size: size)
        context.drawLayer { layer in
            switch stroke.tool {
            case .eraser:
                layer.blendMode = .destinationOut
                layer.stroke(path, with: .color(.black), style: style)
            case .highlighter:
                layer.blendMode = .multiply
                layer.opacity = stroke.opacity
                layer.stroke(path, with: .color(color), style: style)
            case .pen:
                layer.opacity = stroke.opacity
                layer.stroke(path, with: .color(color), style: style)
            }
        }
    }

    private func smoothPath(points: [StudentCanvasStrokePoint], size: CGSize) -> Path {
        var path = Path()
        let cgPoints = points.map { $0.point(in: size) }
        guard let first = cgPoints.first else { return path }
        path.move(to: first)
        guard cgPoints.count > 2 else {
            if let last = cgPoints.last {
                path.addLine(to: last)
            }
            return path
        }

        for index in 1..<(cgPoints.count - 1) {
            let current = cgPoints[index]
            let next = cgPoints[index + 1]
            let mid = CGPoint(x: (current.x + next.x) / 2, y: (current.y + next.y) / 2)
            path.addQuadCurve(to: mid, control: current)
        }
        if let last = cgPoints.last {
            path.addLine(to: last)
        }
        return path
    }
}

private struct StudentCanvasStickerView: View {
    let sticker: StudentCanvasSticker
    let isEditable: Bool
    let isSelected: Bool
    let canvasSize: CGSize
    let onSelect: () -> Void
    let onUpdate: (StudentCanvasSticker) -> Void
    let onDelete: (StudentCanvasSticker) -> Void

    @State private var dragOrigin: CGPoint?

    private var itemSize: CGSize {
        CGSize(width: max(32, sticker.width), height: max(32, sticker.height))
    }

    private var topLeft: CGPoint {
        CGPoint(x: sticker.x * canvasSize.width, y: sticker.y * canvasSize.height)
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            stickerContent
                .frame(width: itemSize.width, alignment: .topLeading)
                .frame(minHeight: itemSize.height, alignment: .topLeading)
                .rotationEffect(.degrees(sticker.kind.isFreeFloating ? sticker.rotation : 0))
                .shadow(color: .black.opacity(isSelected ? 0.18 : 0.08), radius: isSelected ? 8 : 3, x: 0, y: 2)

            if isEditable && isSelected {
                Button {
                    onDelete(sticker)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20, weight: .bold))
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, XyndromeTheme.Colors.error)
                }
                .buttonStyle(.plain)
                .offset(x: 8, y: -8)
                .accessibilityLabel("Delete canvas item")
            }
        }
        .offset(x: topLeft.x, y: topLeft.y)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .gesture(dragGesture)
        .allowsHitTesting(isEditable)
    }

    @ViewBuilder
    private var stickerContent: some View {
        switch sticker.kind {
        case .emoji(let value):
            Text(value)
                .font(.system(size: 28))
                .frame(width: itemSize.width, height: itemSize.height)
                .background(
                    Circle()
                        .fill(isSelected ? XyndromeTheme.Colors.surface.opacity(0.9) : Color.clear)
                )
        case .tag(let label, let colorHex):
            Text(label)
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.black)
                .foregroundStyle(Color(hex: colorHex))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(Color(hex: colorHex).opacity(0.12))
                        .overlay(
                            Capsule()
                                .strokeBorder(Color(hex: colorHex).opacity(isSelected ? 0.75 : 0.35), lineWidth: isSelected ? 1.5 : 1)
                        )
                )
        case .note(let colorKey, let text):
            let preset = StudentCanvasPalette.stickyPreset(for: colorKey)
            VStack(alignment: .leading, spacing: 7) {
                Capsule()
                    .fill(Color(hex: preset.edgeHex).opacity(0.55))
                    .frame(width: 36, height: 3)
                    .frame(maxWidth: .infinity)

                TextEditor(text: Binding(
                    get: { text },
                    set: { newValue in
                        var next = sticker
                        next.kind = .note(colorKey: colorKey, text: newValue)
                        onUpdate(next)
                    }
                ))
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundStyle(Color(hex: preset.inkHex))
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .frame(minHeight: max(68, itemSize.height - 38))
                .disabled(!isEditable)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 11)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(LinearGradient(colors: [Color(hex: preset.bgHex), Color(hex: preset.bg2Hex)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                            .strokeBorder(Color(hex: isSelected ? preset.inkHex : preset.edgeHex), lineWidth: isSelected ? 1.5 : 1)
                    )
            )
        }
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .local)
            .onChanged { value in
                guard isEditable, canvasSize.width > 1, canvasSize.height > 1 else { return }
                if dragOrigin == nil {
                    dragOrigin = topLeft
                }
                let origin = dragOrigin ?? topLeft
                let maxX = max(0, canvasSize.width - itemSize.width)
                let maxY = max(0, canvasSize.height - itemSize.height)
                let nextX = min(maxX, max(0, origin.x + value.translation.width))
                let nextY = min(maxY, max(0, origin.y + value.translation.height))
                var next = sticker
                next.x = Double(nextX / max(canvasSize.width, 1))
                next.y = Double(nextY / max(canvasSize.height, 1))
                onUpdate(next)
            }
            .onEnded { _ in
                dragOrigin = nil
            }
    }
}

private enum StudentCanvasDrawingTool: String, Codable, CaseIterable, Identifiable {
    case pen
    case highlighter
    case eraser

    var id: String { rawValue }

    var title: String {
        switch self {
        case .pen: return "Pen"
        case .highlighter: return "Highlighter"
        case .eraser: return "Eraser"
        }
    }

    var systemImage: String {
        switch self {
        case .pen: return "pencil.tip"
        case .highlighter: return "paintbrush.pointed"
        case .eraser: return "eraser"
        }
    }

    var opacity: Double {
        switch self {
        case .pen: return 0.98
        case .highlighter: return 0.36
        case .eraser: return 1
        }
    }
}

private struct StudentCanvasPersonalLayer: Codable, Equatable {
    var stickers: [StudentCanvasSticker]
    var strokes: [StudentCanvasStroke]
    var savedAt: Double?
    var storage: String?
    var sync: String?

    static let empty = StudentCanvasPersonalLayer(stickers: [], strokes: [], savedAt: nil, storage: "device", sync: "local-only")

    var isEmpty: Bool {
        stickers.isEmpty && strokes.isEmpty
    }

    func normalized() -> StudentCanvasPersonalLayer {
        StudentCanvasPersonalLayer(
            stickers: stickers,
            strokes: Array(strokes.filter { !$0.points.isEmpty }.suffix(250)),
            savedAt: savedAt,
            storage: storage ?? "device",
            sync: sync ?? "local-only"
        )
    }
}

private struct StudentCanvasStroke: Codable, Equatable, Identifiable {
    var id: String
    var colorHex: String
    var width: Double
    var opacity: Double
    var tool: StudentCanvasDrawingTool
    var points: [StudentCanvasStrokePoint]

    func shouldAppend(_ point: StudentCanvasStrokePoint) -> Bool {
        guard let last = points.last else { return true }
        let distance = hypot(last.x - point.x, last.y - point.y)
        let pressureDelta = abs(last.pressure - point.pressure)
        return distance >= 0.00035 || pressureDelta >= 0.06
    }

    func simplified() -> StudentCanvasStroke {
        guard points.count > 2 else { return self }
        var refined = [points[0]]
        for point in points.dropFirst().dropLast() {
            guard let last = refined.last else { continue }
            let distance = hypot(last.x - point.x, last.y - point.y)
            let pressureDelta = abs(last.pressure - point.pressure)
            if distance >= 0.0003 || pressureDelta >= 0.045 {
                refined.append(point)
            }
        }
        if let last = points.last {
            refined.append(last)
        }
        var copy = self
        copy.points = Array(refined.suffix(2_200))
        return copy
    }
}

private struct StudentCanvasStrokePoint: Codable, Equatable {
    var x: Double
    var y: Double
    var pressure: Double

    func point(in size: CGSize) -> CGPoint {
        CGPoint(x: x * size.width, y: y * size.height)
    }
}

private struct StudentCanvasSticker: Codable, Equatable, Identifiable {
    var id: String
    var kind: StudentCanvasStickerKind
    var x: Double
    var y: Double
    var rotation: Double
    var width: Double
    var height: Double
}

private enum StudentCanvasStickerKind: Codable, Equatable {
    case emoji(String)
    case tag(label: String, colorHex: String)
    case note(colorKey: String, text: String = "")

    enum CodingKeys: String, CodingKey {
        case type
        case emoji
        case label
        case colorHex
        case colorKey
        case text
    }

    var isFreeFloating: Bool {
        if case .emoji = self { return true }
        return false
    }

    var defaultWidth: Double {
        switch self {
        case .emoji: return 44
        case .tag: return 132
        case .note: return 194
        }
    }

    var defaultHeight: Double {
        switch self {
        case .emoji: return 44
        case .tag: return 34
        case .note: return 112
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = (try? container.decode(String.self, forKey: .type)) ?? "emoji"
        switch type {
        case "tag":
            self = .tag(
                label: (try? container.decode(String.self, forKey: .label)) ?? "Tag",
                colorHex: (try? container.decode(String.self, forKey: .colorHex)) ?? "#2563EB"
            )
        case "note":
            self = .note(
                colorKey: (try? container.decode(String.self, forKey: .colorKey)) ?? "yellow",
                text: (try? container.decode(String.self, forKey: .text)) ?? ""
            )
        default:
            self = .emoji((try? container.decode(String.self, forKey: .emoji)) ?? "☆")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .emoji(let value):
            try container.encode("emoji", forKey: .type)
            try container.encode(value, forKey: .emoji)
        case .tag(let label, let colorHex):
            try container.encode("tag", forKey: .type)
            try container.encode(label, forKey: .label)
            try container.encode(colorHex, forKey: .colorHex)
        case .note(let colorKey, let text):
            try container.encode("note", forKey: .type)
            try container.encode(colorKey, forKey: .colorKey)
            try container.encode(text, forKey: .text)
        }
    }
}

private enum StudentCanvasPersonalLayerStore {
    static func key(noteId: Int, lessonId: Int?) -> String {
        if noteId > 0 {
            return "lms.studentCanvas.personal.\(noteId)"
        }
        if let lessonId, lessonId > 0 {
            return "lms.studentCanvas.personal.lesson.\(lessonId)"
        }
        return ""
    }

    static func load(key: String) -> StudentCanvasPersonalLayer {
        guard !key.isEmpty,
              let data = UserDefaults.standard.data(forKey: key),
              let layer = try? JSONDecoder().decode(StudentCanvasPersonalLayer.self, from: data) else {
            return .empty
        }
        return layer.normalized()
    }

    static func save(_ layer: StudentCanvasPersonalLayer, key: String) -> Bool {
        guard !key.isEmpty, let data = try? JSONEncoder().encode(layer.normalized()) else {
            return false
        }
        UserDefaults.standard.set(data, forKey: key)
        return true
    }
}

private enum StudentCanvasPalette {
    static let penColors = ["#1F2937", "#2563EB", "#7C3AED", "#DC2626", "#047857", "#F59E0B"]
    static let highlighterColors = ["#FDE047", "#86EFAC", "#93C5FD", "#F0ABFC"]
    static let widths = [3.0, 5.0, 8.0]

    static let emojiStickers = ["☆", "💡", "📚", "🌿", "📅", "🏷️", "💬", "✅", "⚠️", "❓", "🔄", "📌", "🩺", "💊", "🧬", "🔬", "✦", "✧", "♡", "☁", "〰", "🍃", "✿", "✾", "❋", "◆", "◇"]

    static let tagPresets = [
        StudentCanvasTagPreset(label: "Exam trap", colorHex: "#EF4444"),
        StudentCanvasTagPreset(label: "Must know", colorHex: "#2563EB"),
        StudentCanvasTagPreset(label: "Review", colorHex: "#7C3AED"),
        StudentCanvasTagPreset(label: "High yield", colorHex: "#059669"),
        StudentCanvasTagPreset(label: "Formula", colorHex: "#D97706"),
        StudentCanvasTagPreset(label: "Doubt", colorHex: "#0891B2")
    ]

    static let stickyPresets = [
        StudentCanvasStickyPreset(key: "yellow", title: "Yellow", bgHex: "#FFF59D", bg2Hex: "#FFE97A", edgeHex: "#F6DD5B", inkHex: "#5A4A10"),
        StudentCanvasStickyPreset(key: "pink", title: "Pink", bgHex: "#FFD0E0", bg2Hex: "#FFB6D2", edgeHex: "#FFA6C8", inkHex: "#7A2347"),
        StudentCanvasStickyPreset(key: "blue", title: "Blue", bgHex: "#BFE3FF", bg2Hex: "#A6D6FF", edgeHex: "#93CCFF", inkHex: "#1D456E"),
        StudentCanvasStickyPreset(key: "green", title: "Green", bgHex: "#C7F0CF", bg2Hex: "#AAE8B9", edgeHex: "#97E1AA", inkHex: "#1D6638"),
        StudentCanvasStickyPreset(key: "purple", title: "Purple", bgHex: "#E0D4FF", bg2Hex: "#CDB8FF", edgeHex: "#C1A8FF", inkHex: "#472D78"),
        StudentCanvasStickyPreset(key: "orange", title: "Orange", bgHex: "#FFDCAB", bg2Hex: "#FFCA85", edgeHex: "#FFBD6E", inkHex: "#7A3D0F")
    ]

    static func stickyPreset(for key: String) -> StudentCanvasStickyPreset {
        stickyPresets.first { $0.key == key } ?? stickyPresets[0]
    }
}

private struct StudentCanvasTagPreset: Identifiable {
    var id: String { label }
    let label: String
    let colorHex: String
}

private struct StudentCanvasStickyPreset: Identifiable {
    var id: String { key }
    let key: String
    let title: String
    let bgHex: String
    let bg2Hex: String
    let edgeHex: String
    let inkHex: String
}
