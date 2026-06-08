import Foundation

struct AiNotesListResponse: Decodable {
    let notes: [AiNote]
    let engine: String?

    enum CodingKeys: String, CodingKey {
        case notes
        case aiNotes
        case ai_notes
        case smartNotes
        case smart_notes
        case items
        case data
        case result
        case engine
        case engine_key
    }

    init(from decoder: Decoder) throws {
        if let list = try? [AiNote](from: decoder) {
            notes = list
            engine = nil
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let nested = Self.decodeNestedResponse(from: container) {
            notes = nested.notes
            engine = container.decodeString(for: [.engine, .engine_key]) ?? nested.engine
            return
        }

        notes = Self.decodeNotes(from: container)
        engine = container.decodeString(for: [.engine, .engine_key])
    }

    private static func decodeNestedResponse(
        from container: KeyedDecodingContainer<CodingKeys>
    ) -> AiNotesListResponse? {
        if let nested = try? container.decodeIfPresent(AiNotesListResponse.self, forKey: .data) {
            return nested
        }
        if let nested = try? container.decodeIfPresent(AiNotesListResponse.self, forKey: .result) {
            return nested
        }
        return nil
    }

    private static func decodeNotes(from container: KeyedDecodingContainer<CodingKeys>) -> [AiNote] {
        let keys: [CodingKeys] = [.notes, .aiNotes, .ai_notes, .smartNotes, .smart_notes, .items, .data, .result]
        for key in keys {
            if let notes = try? container.decodeIfPresent([AiNote].self, forKey: key) {
                return notes
            }
        }
        return []
    }
}

struct AiNote: Decodable, Identifiable {
    let id: Int
    let title: String
    let summary: String?
    let subjectArea: String?
    let createdAt: String?
    let lessonId: Int?
    let lessonTitle: String?
    let courseTitle: String?
    let topicName: String?
    let subtopicName: String?
    let engineKey: String?
    let canAccess: Bool
    let accessLocked: Bool
    let lockReason: String?
    let upgradeLabel: String?
    let isFree: Bool
    let lessonCompleted: Bool
    let lessonProgressStatus: String?
    let lessonProgressPercent: Double?
    let approvedFlashcardCount: Int?
    let cardCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case summary
        case subjectArea
        case subject_area
        case subjectName
        case createdAt
        case created_at
        case lessonId
        case lesson_id
        case lessonTitle
        case lesson_title
        case courseTitle
        case course_title
        case topicName
        case topic_name
        case subtopicName
        case subtopic_name
        case engineKey
        case engine_key
        case canAccess
        case can_access
        case accessLocked
        case access_locked
        case lockReason
        case lock_reason
        case accessMessage
        case access_message
        case upgradeLabel
        case upgrade_label
        case isFree
        case is_free
        case free
        case lessonCompleted
        case lesson_completed
        case lessonProgressStatus
        case lesson_progress_status
        case progressStatus
        case progress_status
        case lessonProgressPercent
        case lesson_progress_percent
        case progressPercent
        case progress_percent
        case approvedFlashcardCount
        case approved_flashcard_count
        case cardCount
        case card_count
    }

    init(
        id: Int,
        title: String,
        summary: String?,
        subjectArea: String?,
        createdAt: String?,
        lessonId: Int?,
        lessonTitle: String?,
        courseTitle: String?,
        topicName: String?,
        subtopicName: String?,
        engineKey: String?,
        canAccess: Bool,
        accessLocked: Bool,
        lockReason: String?,
        upgradeLabel: String?,
        isFree: Bool,
        lessonCompleted: Bool,
        lessonProgressStatus: String?,
        lessonProgressPercent: Double?,
        approvedFlashcardCount: Int?,
        cardCount: Int?
    ) {
        self.id = id
        self.title = title
        self.summary = summary
        self.subjectArea = subjectArea
        self.createdAt = createdAt
        self.lessonId = lessonId
        self.lessonTitle = lessonTitle
        self.courseTitle = courseTitle
        self.topicName = topicName
        self.subtopicName = subtopicName
        self.engineKey = engineKey
        self.canAccess = canAccess
        self.accessLocked = accessLocked
        self.lockReason = lockReason
        self.upgradeLabel = upgradeLabel
        self.isFree = isFree
        self.lessonCompleted = lessonCompleted
        self.lessonProgressStatus = lessonProgressStatus
        self.lessonProgressPercent = lessonProgressPercent
        self.approvedFlashcardCount = approvedFlashcardCount
        self.cardCount = cardCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        let decodedLessonTitle = container.decodeString(for: [.lessonTitle, .lesson_title])
        let decodedCourseTitle = container.decodeString(for: [.courseTitle, .course_title])
        let decodedTopicName = container.decodeString(for: [.topicName, .topic_name])
        let decodedSubtopicName = container.decodeString(for: [.subtopicName, .subtopic_name])
        title = container.decodeString(for: [.title])
            ?? decodedLessonTitle
            ?? decodedTopicName
            ?? "AI Note"
        summary = container.decodeString(for: [.summary])
        subjectArea = container.decodeString(for: [.subjectArea, .subject_area, .subjectName, .topicName, .topic_name])
            ?? decodedCourseTitle
        createdAt = container.decodeString(for: [.createdAt, .created_at])
        lessonId = container.decodeInt(for: [.lessonId, .lesson_id])
        lessonTitle = decodedLessonTitle
        courseTitle = decodedCourseTitle
        topicName = decodedTopicName
        subtopicName = decodedSubtopicName
        engineKey = container.decodeString(for: [.engineKey, .engine_key])
        canAccess = container.decodeBool(for: [.canAccess, .can_access]) ?? true
        accessLocked = container.decodeBool(for: [.accessLocked, .access_locked]) ?? !canAccess
        lockReason = container.decodeString(for: [.lockReason, .lock_reason, .accessMessage, .access_message])
        upgradeLabel = container.decodeString(for: [.upgradeLabel, .upgrade_label])
        isFree = container.decodeBool(for: [.isFree, .is_free, .free]) ?? false
        lessonProgressStatus = container.decodeString(for: [.lessonProgressStatus, .lesson_progress_status, .progressStatus, .progress_status])
        lessonProgressPercent = container.decodeDouble(for: [.lessonProgressPercent, .lesson_progress_percent, .progressPercent, .progress_percent])
        lessonCompleted = container.decodeBool(for: [.lessonCompleted, .lesson_completed])
            ?? (lessonProgressStatus == "completed" || (lessonProgressPercent ?? 0) >= 100)
        approvedFlashcardCount = container.decodeInt(for: [.approvedFlashcardCount, .approved_flashcard_count])
        cardCount = container.decodeInt(for: [.cardCount, .card_count])
    }

    var flashcardTotal: Int {
        cardCount ?? approvedFlashcardCount ?? 0
    }

    var isCompleted: Bool {
        lessonCompleted || lessonProgressStatus == "completed" || (lessonProgressPercent ?? 0) >= 100
    }

    var contextLine: String? {
        AiNoteContext.make([courseTitle, topicName, subtopicName, lessonTitle])
    }

    var courseKey: String {
        courseTitle?.nonEmpty ?? "General"
    }

    var subjectKey: String {
        topicName?.nonEmpty ?? subjectArea?.nonEmpty ?? "General"
    }

    var engineScopedId: String {
        "\(normalizedEngineKey ?? "default"):\(id)"
    }

    func withFallbackEngine(_ fallbackEngine: String?) -> AiNote {
        AiNote(
            id: id,
            title: title,
            summary: summary,
            subjectArea: subjectArea,
            createdAt: createdAt,
            lessonId: lessonId,
            lessonTitle: lessonTitle,
            courseTitle: courseTitle,
            topicName: topicName,
            subtopicName: subtopicName,
            engineKey: normalizedEngineKey ?? fallbackEngine?.normalizedEngineKey,
            canAccess: canAccess,
            accessLocked: accessLocked,
            lockReason: lockReason,
            upgradeLabel: upgradeLabel,
            isFree: isFree,
            lessonCompleted: lessonCompleted,
            lessonProgressStatus: lessonProgressStatus,
            lessonProgressPercent: lessonProgressPercent,
            approvedFlashcardCount: approvedFlashcardCount,
            cardCount: cardCount
        )
    }

    func markingCompleted() -> AiNote {
        AiNote(
            id: id,
            title: title,
            summary: summary,
            subjectArea: subjectArea,
            createdAt: createdAt,
            lessonId: lessonId,
            lessonTitle: lessonTitle,
            courseTitle: courseTitle,
            topicName: topicName,
            subtopicName: subtopicName,
            engineKey: engineKey,
            canAccess: canAccess,
            accessLocked: accessLocked,
            lockReason: lockReason,
            upgradeLabel: upgradeLabel,
            isFree: isFree,
            lessonCompleted: true,
            lessonProgressStatus: "completed",
            lessonProgressPercent: 100,
            approvedFlashcardCount: approvedFlashcardCount,
            cardCount: cardCount
        )
    }

    private var normalizedEngineKey: String? {
        engineKey?.normalizedEngineKey
    }
}

struct AiNoteDetailResponse: Decodable {
    let note: AiNoteDetail
    let content: String?
    let canvas: AiNoteCanvas?
    let flashcards: [Flashcard]

    enum CodingKeys: String, CodingKey {
        case note
        case content
        case canvas
        case noteData
        case note_data
        case flashcards
        case data
        case item
        case result
        case engine
        case engine_key
    }

    init(from decoder: Decoder) throws {
        let container = try? decoder.container(keyedBy: CodingKeys.self)
        if let container, let nested = Self.decodeNestedResponse(from: container) {
            let engine = container.decodeString(for: [.engine, .engine_key]) ?? nested.note.engineKey
            let resolvedCanvas = nested.note.canvas ?? nested.canvas
            let resolvedContent = nested.note.content.nonEmpty
                ?? nested.content.nonEmpty
                ?? resolvedCanvas?.markdownSummary.nonEmpty
            note = nested.note.resolving(content: resolvedContent, canvas: resolvedCanvas, fallbackEngine: engine)
            content = resolvedContent
            canvas = resolvedCanvas
            flashcards = nested.flashcards
            return
        }

        let decodedCanvas: AiNoteCanvas?
        let topLevelContent: String?
        let fallbackEngine: String?
        let decodedFlashcards: [Flashcard]
        if let container {
            let topLevelNoteData = (try? container.decodeIfPresent(JSONValue.self, forKey: .noteData))
                ?? (try? container.decodeIfPresent(JSONValue.self, forKey: .note_data))
            decodedCanvas = (try? container.decodeIfPresent(AiNoteCanvas.self, forKey: .canvas))
                ?? AiNoteCanvas(json: topLevelNoteData)
            topLevelContent = try? container.decodeIfPresent(String.self, forKey: .content)
            fallbackEngine = container.decodeString(for: [.engine, .engine_key])
            decodedFlashcards = (try? container.decodeIfPresent([Flashcard].self, forKey: .flashcards)) ?? []
        } else {
            decodedCanvas = nil
            topLevelContent = nil
            fallbackEngine = nil
            decodedFlashcards = []
        }

        let decodedNote: AiNoteDetail
        if let container, let wrapped = try? container.decodeIfPresent(AiNoteDetail.self, forKey: .note) {
            decodedNote = wrapped
        } else {
            decodedNote = try AiNoteDetail(from: decoder)
        }

        let resolvedCanvas = decodedNote.canvas ?? decodedCanvas
        let resolvedContent = decodedNote.content.nonEmpty
            ?? topLevelContent.nonEmpty
            ?? resolvedCanvas?.markdownSummary.nonEmpty
        note = decodedNote.resolving(content: resolvedContent, canvas: resolvedCanvas, fallbackEngine: fallbackEngine)
        content = resolvedContent
        canvas = resolvedCanvas
        flashcards = decodedFlashcards
    }

    private static func decodeNestedResponse(
        from container: KeyedDecodingContainer<CodingKeys>
    ) -> AiNoteDetailResponse? {
        if let nested = try? container.decodeIfPresent(AiNoteDetailResponse.self, forKey: .data) {
            return nested
        }
        if let nested = try? container.decodeIfPresent(AiNoteDetailResponse.self, forKey: .item) {
            return nested
        }
        if let nested = try? container.decodeIfPresent(AiNoteDetailResponse.self, forKey: .result) {
            return nested
        }
        return nil
    }
}

struct AiNoteDetail: Decodable, Identifiable {
    let id: Int
    let title: String
    let summary: String?
    let content: String?
    let subjectArea: String?
    let createdAt: String?
    let lessonId: Int?
    let lessonTitle: String?
    let courseTitle: String?
    let topicName: String?
    let subtopicName: String?
    let engineKey: String?
    let canAccess: Bool
    let accessLocked: Bool
    let lockReason: String?
    let upgradeLabel: String?
    let isFree: Bool
    let lessonCompleted: Bool
    let lessonProgressStatus: String?
    let lessonProgressPercent: Double?
    let videoUrl: String?
    let videoCaptionUrl: String?
    let canvas: AiNoteCanvas?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case summary
        case content
        case rawText
        case raw_text
        case noteData
        case note_data
        case canvas
        case subjectArea
        case subject_area
        case subjectName
        case createdAt
        case created_at
        case lessonId
        case lesson_id
        case lessonTitle
        case lesson_title
        case courseTitle
        case course_title
        case topicName
        case topic_name
        case subtopicName
        case subtopic_name
        case engineKey
        case engine_key
        case canAccess
        case can_access
        case accessLocked
        case access_locked
        case lockReason
        case lock_reason
        case accessMessage
        case access_message
        case upgradeLabel
        case upgrade_label
        case isFree
        case is_free
        case free
        case lessonCompleted
        case lesson_completed
        case lessonProgressStatus
        case lesson_progress_status
        case progressStatus
        case progress_status
        case lessonProgressPercent
        case lesson_progress_percent
        case progressPercent
        case progress_percent
        case videoUrl
        case video_url
        case captionUrl
        case caption_url
        case captionsUrl
        case captions_url
        case subtitleUrl
        case subtitle_url
        case subtitlesUrl
        case subtitles_url
        case videoCaptionUrl
        case video_caption_url
    }

    init(
        id: Int,
        title: String,
        summary: String?,
        content: String?,
        subjectArea: String?,
        createdAt: String?,
        lessonId: Int?,
        lessonTitle: String?,
        courseTitle: String?,
        topicName: String?,
        subtopicName: String?,
        engineKey: String?,
        canAccess: Bool,
        accessLocked: Bool,
        lockReason: String?,
        upgradeLabel: String?,
        isFree: Bool,
        lessonCompleted: Bool,
        lessonProgressStatus: String?,
        lessonProgressPercent: Double?,
        videoUrl: String?,
        videoCaptionUrl: String?,
        canvas: AiNoteCanvas?
    ) {
        self.id = id
        self.title = title
        self.summary = summary
        self.content = content
        self.subjectArea = subjectArea
        self.createdAt = createdAt
        self.lessonId = lessonId
        self.lessonTitle = lessonTitle
        self.courseTitle = courseTitle
        self.topicName = topicName
        self.subtopicName = subtopicName
        self.engineKey = engineKey
        self.canAccess = canAccess
        self.accessLocked = accessLocked
        self.lockReason = lockReason
        self.upgradeLabel = upgradeLabel
        self.isFree = isFree
        self.lessonCompleted = lessonCompleted
        self.lessonProgressStatus = lessonProgressStatus
        self.lessonProgressPercent = lessonProgressPercent
        self.videoUrl = videoUrl
        self.videoCaptionUrl = videoCaptionUrl
        self.canvas = canvas
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        let decodedLessonTitle = container.decodeString(for: [.lessonTitle, .lesson_title])
        let decodedCourseTitle = container.decodeString(for: [.courseTitle, .course_title])
        let decodedTopicName = container.decodeString(for: [.topicName, .topic_name])
        let decodedSubtopicName = container.decodeString(for: [.subtopicName, .subtopic_name])
        title = container.decodeString(for: [.title])
            ?? decodedLessonTitle
            ?? decodedTopicName
            ?? "AI Note"
        summary = container.decodeString(for: [.summary])
        subjectArea = container.decodeString(for: [.subjectArea, .subject_area, .subjectName, .topicName, .topic_name])
            ?? decodedCourseTitle
        createdAt = container.decodeString(for: [.createdAt, .created_at])
        lessonId = container.decodeInt(for: [.lessonId, .lesson_id])
        lessonTitle = decodedLessonTitle
        courseTitle = decodedCourseTitle
        topicName = decodedTopicName
        subtopicName = decodedSubtopicName
        engineKey = container.decodeString(for: [.engineKey, .engine_key])
        canAccess = container.decodeBool(for: [.canAccess, .can_access]) ?? true
        accessLocked = container.decodeBool(for: [.accessLocked, .access_locked]) ?? !canAccess
        lockReason = container.decodeString(for: [.lockReason, .lock_reason, .accessMessage, .access_message])
        upgradeLabel = container.decodeString(for: [.upgradeLabel, .upgrade_label])
        isFree = container.decodeBool(for: [.isFree, .is_free, .free]) ?? false
        lessonProgressStatus = container.decodeString(for: [.lessonProgressStatus, .lesson_progress_status, .progressStatus, .progress_status])
        lessonProgressPercent = container.decodeDouble(for: [.lessonProgressPercent, .lesson_progress_percent, .progressPercent, .progress_percent])
        lessonCompleted = container.decodeBool(for: [.lessonCompleted, .lesson_completed])
            ?? (lessonProgressStatus == "completed" || (lessonProgressPercent ?? 0) >= 100)
        videoUrl = container.decodeString(for: [.videoUrl, .video_url])

        let noteData = (try? container.decodeIfPresent(JSONValue.self, forKey: .noteData))
            ?? (try? container.decodeIfPresent(JSONValue.self, forKey: .note_data))
        let noteDataCanvas = AiNoteCanvas(json: noteData)
        let explicitCanvas = try? container.decodeIfPresent(AiNoteCanvas.self, forKey: .canvas)
        canvas = explicitCanvas ?? noteDataCanvas

        let explicitContent = container.decodeString(for: [.content]).nonEmpty
        let rawText = container.decodeString(for: [.rawText, .raw_text])
        content = explicitContent
            ?? canvas?.markdownSummary.nonEmpty
            ?? rawText.nonEmpty

        videoCaptionUrl = container.decodeString(for: [
            .videoCaptionUrl,
            .video_caption_url,
            .captionUrl,
            .caption_url,
            .captionsUrl,
            .captions_url,
            .subtitleUrl,
            .subtitle_url,
            .subtitlesUrl,
            .subtitles_url
        ]) ?? AiNoteCanvas.videoCaptionUrl(from: noteData)
    }

    var isCompleted: Bool {
        lessonCompleted || lessonProgressStatus == "completed" || (lessonProgressPercent ?? 0) >= 100
    }

    var contextLine: String? {
        AiNoteContext.make([courseTitle, topicName, subtopicName])
    }

    func resolving(content resolvedContent: String?, canvas resolvedCanvas: AiNoteCanvas?, fallbackEngine: String?) -> AiNoteDetail {
        AiNoteDetail(
            id: id,
            title: title,
            summary: summary,
            content: content.nonEmpty ?? resolvedContent.nonEmpty ?? resolvedCanvas?.markdownSummary.nonEmpty,
            subjectArea: subjectArea,
            createdAt: createdAt,
            lessonId: lessonId,
            lessonTitle: lessonTitle,
            courseTitle: courseTitle,
            topicName: topicName,
            subtopicName: subtopicName,
            engineKey: engineKey?.normalizedEngineKey ?? fallbackEngine?.normalizedEngineKey,
            canAccess: canAccess,
            accessLocked: accessLocked,
            lockReason: lockReason,
            upgradeLabel: upgradeLabel,
            isFree: isFree,
            lessonCompleted: lessonCompleted,
            lessonProgressStatus: lessonProgressStatus,
            lessonProgressPercent: lessonProgressPercent,
            videoUrl: videoUrl,
            videoCaptionUrl: videoCaptionUrl,
            canvas: canvas ?? resolvedCanvas
        )
    }

    func withFallbackEngine(_ fallbackEngine: String?) -> AiNoteDetail {
        resolving(content: content, canvas: canvas, fallbackEngine: fallbackEngine)
    }

    func markingCompleted() -> AiNoteDetail {
        AiNoteDetail(
            id: id,
            title: title,
            summary: summary,
            content: content,
            subjectArea: subjectArea,
            createdAt: createdAt,
            lessonId: lessonId,
            lessonTitle: lessonTitle,
            courseTitle: courseTitle,
            topicName: topicName,
            subtopicName: subtopicName,
            engineKey: engineKey,
            canAccess: canAccess,
            accessLocked: accessLocked,
            lockReason: lockReason,
            upgradeLabel: upgradeLabel,
            isFree: isFree,
            lessonCompleted: true,
            lessonProgressStatus: "completed",
            lessonProgressPercent: 100,
            videoUrl: videoUrl,
            videoCaptionUrl: videoCaptionUrl,
            canvas: canvas
        )
    }
}

struct AiNoteCanvas: Decodable {
    let pages: [AiNoteCanvasPage]

    init(from decoder: Decoder) throws {
        let raw = try JSONValue(from: decoder)
        self.init(json: raw)
    }

    init?(json: JSONValue?) {
        guard let json else {
            return nil
        }
        self.init(json: json)
        if pages.isEmpty {
            return nil
        }
    }

    private init(json: JSONValue) {
        let parsedPages = Self.parsePages(from: json)
        pages = parsedPages.filter(\.hasContent)
    }

    var markdownSummary: String {
        pages.map(\.markdownSummary)
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: "\n\n")
    }

    func mergedPage(note: AiNoteDetail) -> AiNoteCanvasPage {
        guard pages.count > 1 else {
            var page = pages.first ?? AiNoteCanvasPage.empty
            page.title = page.title.nonEmpty ?? note.lessonTitle ?? note.title
            page.subtitle = page.subtitle.nonEmpty ?? note.courseTitle ?? ""
            return page
        }

        let first = pages.first ?? .empty
        let sections = pages.flatMap(\.sections)
        let keyPoints = pages.flatMap(\.keyPoints)
        let summary = pages.compactMap(\.summaryBox.nonEmpty).joined(separator: " · ")
        let tags = AiNoteContext.unique(pages.flatMap(\.tags))
        let keywords = AiNoteContext.unique(pages.flatMap(\.keywords))
        let visualStyleColors = AiNoteContext.unique(pages.flatMap(\.visualStyleColors))

        return AiNoteCanvasPage(
            id: first.id,
            title: note.lessonTitle ?? note.title,
            subtitle: first.subtitle.nonEmpty ?? note.courseTitle ?? "",
            layout: first.layout,
            canvasBg: first.canvasBg,
            visualStyleColors: visualStyleColors,
            tags: tags,
            keywords: keywords,
            keyPoints: keyPoints,
            summaryBox: summary.nonEmpty,
            sections: sections
        )
    }

    static func videoCaptionUrl(from json: JSONValue?) -> String? {
        guard let object = json?.objectValue else {
            return nil
        }
        let topLevel = JSONValue.object(object).string(for: [
            "captionUrl",
            "captionsUrl",
            "subtitleUrl",
            "subtitlesUrl",
            "videoCaptionUrl",
            "caption_url",
            "captions_url",
            "subtitle_url",
            "subtitles_url",
            "video_caption_url"
        ])
        if let topLevel {
            return topLevel
        }
        if case .object(let video)? = object["video"] {
            return JSONValue.object(video).string(for: [
                "captionUrl",
                "captionsUrl",
                "subtitleUrl",
                "subtitlesUrl",
                "videoCaptionUrl",
                "caption_url",
                "captions_url",
                "subtitle_url",
                "subtitles_url",
                "video_caption_url"
            ])
        }
        return nil
    }

    private static func parsePages(from json: JSONValue) -> [AiNoteCanvasPage] {
        if case .object(let object) = json {
            if case .array(let rawPages)? = object["pages"] {
                return rawPages.enumerated().map { index, value in
                    AiNoteCanvasPage(json: value, index: index)
                }
            }
            return [AiNoteCanvasPage(json: json, index: 0)]
        }

        if case .array(let values) = json {
            return values.enumerated().map { index, value in
                AiNoteCanvasPage(json: value, index: index)
            }
        }

        let text = json.markdownSummary.nonEmpty
        guard let text else {
            return []
        }
        return [
            AiNoteCanvasPage(
                id: "plain-text",
                title: nil,
                subtitle: nil,
                layout: "1col",
                canvasBg: nil,
                visualStyleColors: [],
                tags: [],
                keywords: [],
                keyPoints: [],
                summaryBox: nil,
                sections: [
                    AiNoteCanvasSection(
                        id: "plain-text-section",
                        type: "text",
                        heading: nil,
                        bodyText: text,
                        bullets: [],
                        callout: nil,
                        mnemonic: nil,
                        stickyNote: nil,
                        accentColor: nil,
                        headingColor: nil,
                        span: "full",
                        src: nil,
                        caption: nil,
                        explanation: nil,
                        sectionImage: nil,
                        height: nil,
                        imageFit: nil
                    )
                ]
            )
        ]
    }
}

struct AiNoteCanvasPage: Identifiable {
    var id: String
    var title: String?
    var subtitle: String?
    var layout: String?
    var canvasBg: String?
    var visualStyleColors: [String]
    var tags: [String]
    var keywords: [String]
    var keyPoints: [String]
    var summaryBox: String?
    var sections: [AiNoteCanvasSection]

    static let empty = AiNoteCanvasPage(
        id: "empty",
        title: nil,
        subtitle: nil,
        layout: nil,
        canvasBg: nil,
        visualStyleColors: [],
        tags: [],
        keywords: [],
        keyPoints: [],
        summaryBox: nil,
        sections: []
    )

    init(
        id: String,
        title: String?,
        subtitle: String?,
        layout: String?,
        canvasBg: String?,
        visualStyleColors: [String],
        tags: [String],
        keywords: [String],
        keyPoints: [String],
        summaryBox: String?,
        sections: [AiNoteCanvasSection]
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.layout = layout
        self.canvasBg = canvasBg
        self.visualStyleColors = visualStyleColors
        self.tags = tags
        self.keywords = keywords
        self.keyPoints = keyPoints
        self.summaryBox = summaryBox
        self.sections = sections
    }

    init(json: JSONValue, index: Int) {
        let object = json.objectValue ?? [:]
        id = JSONValue.object(object).string(for: ["id", "key", "slug"]) ?? "page-\(index)"
        title = JSONValue.object(object).string(for: ["title", "heading", "name"])
        subtitle = JSONValue.object(object).string(for: ["subtitle", "courseTitle", "course_title", "subject"])
        layout = JSONValue.object(object).string(for: ["layout", "columns"])
        canvasBg = JSONValue.object(object).string(for: ["canvasBg", "canvas_bg", "background", "backgroundColor"])
        let visualStyle = object["visual_style"] ?? object["visualStyle"]
        let nestedVisualColors = visualStyle?.objectValue.map {
            JSONValue.object($0).stringArray(for: ["colors", "highlightColors", "highlight_colors"])
        } ?? []
        visualStyleColors = AiNoteContext.unique(
            JSONValue.object(object).stringArray(for: ["colors", "highlightColors", "highlight_colors"]) + nestedVisualColors
        )
        tags = JSONValue.object(object).stringArray(for: ["tags"])
        keywords = JSONValue.object(object).stringArray(for: ["keywords"])
        keyPoints = JSONValue.object(object).stringArray(for: ["key_points", "keyPoints", "takeaways"])
        summaryBox = JSONValue.object(object).string(for: ["summary_box", "summaryBox", "summary"])

        let rawSections = JSONValue.object(object).array(for: ["sections", "blocks", "cards"])
        sections = rawSections.enumerated().map { sectionIndex, rawSection in
            AiNoteCanvasSection(json: rawSection, index: sectionIndex)
        }.filter(\.hasContent)

        if sections.isEmpty, let text = JSONValue.object(object).string(for: ["content", "body", "text", "description"]) {
            sections = [
                AiNoteCanvasSection(
                    id: "page-\(index)-content",
                    type: "text",
                    heading: nil,
                    bodyText: text,
                    bullets: [],
                    callout: nil,
                    mnemonic: nil,
                    stickyNote: nil,
                    accentColor: nil,
                    headingColor: nil,
                    span: "full",
                    src: nil,
                    caption: nil,
                    explanation: nil,
                    sectionImage: nil,
                    height: nil,
                    imageFit: nil
                )
            ]
        }
    }

    var hasContent: Bool {
        title.nonEmpty != nil
            || subtitle.nonEmpty != nil
            || !tags.isEmpty
            || !keywords.isEmpty
            || !keyPoints.isEmpty
            || summaryBox.nonEmpty != nil
            || !sections.isEmpty
    }

    var markdownSummary: String {
        var parts: [String] = []
        if let title = title.nonEmpty {
            parts.append("# \(title)")
        }
        if let subtitle = subtitle.nonEmpty {
            parts.append(subtitle)
        }
        if !keyPoints.isEmpty {
            parts.append(keyPoints.map { "- \($0)" }.joined(separator: "\n"))
        }
        parts.append(contentsOf: sections.compactMap(\.markdownSummary.nonEmpty))
        if let summaryBox = summaryBox.nonEmpty {
            parts.append(summaryBox)
        }
        return parts.joined(separator: "\n\n")
    }
}

struct AiNoteCanvasSection: Identifiable {
    let id: String
    let type: String
    let heading: String?
    let bodyText: String?
    let bullets: [String]
    let callout: String?
    let mnemonic: String?
    let stickyNote: String?
    let accentColor: String?
    let headingColor: String?
    let span: String?
    let src: String?
    let caption: String?
    let explanation: String?
    let sectionImage: AiNoteCanvasImage?
    let height: Double?
    let imageFit: String?

    init(
        id: String,
        type: String,
        heading: String?,
        bodyText: String?,
        bullets: [String],
        callout: String?,
        mnemonic: String?,
        stickyNote: String?,
        accentColor: String?,
        headingColor: String?,
        span: String?,
        src: String?,
        caption: String?,
        explanation: String?,
        sectionImage: AiNoteCanvasImage?,
        height: Double?,
        imageFit: String?
    ) {
        self.id = id
        self.type = type
        self.heading = heading
        self.bodyText = bodyText
        self.bullets = bullets
        self.callout = callout
        self.mnemonic = mnemonic
        self.stickyNote = stickyNote
        self.accentColor = accentColor
        self.headingColor = headingColor
        self.span = span
        self.src = src
        self.caption = caption
        self.explanation = explanation
        self.sectionImage = sectionImage
        self.height = height
        self.imageFit = imageFit
    }

    init(json: JSONValue, index: Int) {
        let object = json.objectValue ?? [:]
        let wrapper = JSONValue.object(object)
        id = wrapper.string(for: ["id", "key", "slug"]) ?? "section-\(index)"
        src = wrapper.string(for: ["src", "url", "imageUrl", "image_url"])
        type = wrapper.string(for: ["type"]) ?? (src == nil ? "text" : "image")
        heading = wrapper.string(for: ["heading", "title", "name"])
        bodyText = wrapper.string(for: ["content", "body", "text", "description", "definition"])
        bullets = wrapper.stringArray(for: ["bullets", "items", "points", "key_points", "keyPoints"])
        callout = wrapper.string(for: ["callout", "clinicalPearl", "clinical_pearl", "examTip", "exam_tip"])
        mnemonic = wrapper.string(for: ["mnemonic"])
        stickyNote = wrapper.string(for: ["sticky_note", "stickyNote", "takeaway", "highYield", "high_yield"])
        accentColor = wrapper.string(for: ["accentColor", "accent_color", "color"])
        headingColor = wrapper.string(for: ["headingColor", "heading_color"])
        span = wrapper.string(for: ["span", "width"])
        caption = wrapper.string(for: ["caption", "alt", "title"])
        explanation = wrapper.string(for: ["explanation", "note", "notes"])
        sectionImage = AiNoteCanvasImage(json: object["sectionImage"] ?? object["section_image"])
        height = wrapper.double(for: ["height"])
        imageFit = wrapper.string(for: ["imageFit", "image_fit"])
    }

    var isImageOnly: Bool {
        type == "image" || (src != nil && heading == nil && bullets.isEmpty && bodyText == nil)
    }

    var isImageExplained: Bool {
        type == "image-explained"
    }

    var hasContent: Bool {
        heading.nonEmpty != nil
            || bodyText.nonEmpty != nil
            || !bullets.isEmpty
            || callout.nonEmpty != nil
            || mnemonic.nonEmpty != nil
            || stickyNote.nonEmpty != nil
            || src.nonEmpty != nil
            || caption.nonEmpty != nil
            || explanation.nonEmpty != nil
            || sectionImage?.src.nonEmpty != nil
    }

    var markdownSummary: String {
        var parts: [String] = []
        if let heading = heading.nonEmpty {
            parts.append("## \(heading)")
        }
        if let bodyText = bodyText.nonEmpty {
            parts.append(bodyText)
        }
        if !bullets.isEmpty {
            parts.append(bullets.map { "- \($0)" }.joined(separator: "\n"))
        }
        if let callout = callout.nonEmpty {
            parts.append("> \(callout)")
        }
        if let mnemonic = mnemonic.nonEmpty {
            parts.append("Mnemonic: \(mnemonic)")
        }
        if let stickyNote = stickyNote.nonEmpty {
            parts.append(stickyNote)
        }
        if let explanation = explanation.nonEmpty {
            parts.append(explanation)
        }
        return parts.joined(separator: "\n\n")
    }
}

struct AiNoteCanvasImage {
    let src: String?
    let caption: String?
    let position: String?
    let height: Double?
    let imageWidth: Double?
    let imageHeight: Double?
    let imageFit: String?

    init?(json: JSONValue?) {
        guard let object = json?.objectValue else {
            return nil
        }
        let wrapper = JSONValue.object(object)
        src = wrapper.string(for: ["src", "url", "imageUrl", "image_url"])
        caption = wrapper.string(for: ["caption", "alt", "title"])
        position = wrapper.string(for: ["position"])
        height = wrapper.double(for: ["height"])
        imageWidth = wrapper.double(for: ["imageWidth", "image_width"])
        imageHeight = wrapper.double(for: ["imageHeight", "image_height"])
        imageFit = wrapper.string(for: ["imageFit", "image_fit"])

        if src.nonEmpty == nil {
            return nil
        }
    }
}

struct Flashcard: Decodable, Identifiable {
    let id: Int
    let noteId: Int?
    let lessonId: Int?
    let front: String
    let back: String
    let hint: String?
    let imageUrl: String?
    let imageUrls: [String]
    let imageFit: String
    let status: String?
    let sortOrder: Int?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case noteId
        case note_id
        case lessonId
        case lesson_id
        case front
        case back
        case question
        case answer
        case hint
        case sourceHint
        case source_hint
        case imageUrl
        case image_url
        case imageUrls
        case image_urls
        case imageFit
        case image_fit
        case status
        case sortOrder
        case sort_order
        case createdAt
        case created_at
        case updatedAt
        case updated_at
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        noteId = container.decodeInt(for: [.noteId, .note_id])
        lessonId = container.decodeInt(for: [.lessonId, .lesson_id])
        front = container.decodeString(for: [.front, .question]) ?? ""
        back = container.decodeString(for: [.back, .answer]) ?? ""
        hint = container.decodeString(for: [.hint, .sourceHint, .source_hint])
        let decodedImageUrls = (try? container.decodeIfPresent([String].self, forKey: .imageUrls))
            ?? (try? container.decodeIfPresent([String].self, forKey: .image_urls))
            ?? []
        let singleImage = container.decodeString(for: [.imageUrl, .image_url])
        imageUrls = AiNoteContext.unique((decodedImageUrls + [singleImage].compactMap { $0 }).compactMap(\.nonEmpty))
        imageUrl = imageUrls.first
        imageFit = container.decodeString(for: [.imageFit, .image_fit]) == "cover" ? "cover" : "contain"
        status = container.decodeString(for: [.status])
        sortOrder = container.decodeInt(for: [.sortOrder, .sort_order])
        createdAt = container.decodeString(for: [.createdAt, .created_at])
        updatedAt = container.decodeString(for: [.updatedAt, .updated_at])
    }

    var isApproved: Bool {
        status == nil || status == "approved"
    }

    var sourceHint: String? {
        hint?.nonEmpty
    }
}

enum JSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let single = try decoder.singleValueContainer()
        if single.decodeNil() {
            self = .null
            return
        }
        if let value = try? single.decode(String.self) {
            self = .string(value)
            return
        }
        if let value = try? single.decode(Double.self) {
            self = .number(value)
            return
        }
        if let value = try? single.decode(Bool.self) {
            self = .bool(value)
            return
        }
        if var array = try? decoder.unkeyedContainer() {
            var values: [JSONValue] = []
            while !array.isAtEnd {
                values.append(try array.decode(JSONValue.self))
            }
            self = .array(values)
            return
        }

        let object = try decoder.container(keyedBy: DynamicCodingKey.self)
        var values: [String: JSONValue] = [:]
        for key in object.allKeys {
            values[key.stringValue] = try object.decode(JSONValue.self, forKey: key)
        }
        self = .object(values)
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let object) = self { return object }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let values) = self { return values }
        return nil
    }

    var markdownSummary: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return ""
        case .array(let values):
            return values.map(\.markdownSummary)
                .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                .joined(separator: "\n\n")
        case .object(let object):
            return objectMarkdown(object)
        }
    }

    func string(for keys: [String]) -> String? {
        guard case .object(let object) = self else {
            return nil
        }
        for key in keys {
            if let value = object[key]?.plainString {
                return value.nonEmpty
            }
        }
        return nil
    }

    func double(for keys: [String]) -> Double? {
        guard case .object(let object) = self else {
            return nil
        }
        for key in keys {
            if let value = object[key]?.doubleValue {
                return value
            }
        }
        return nil
    }

    func stringArray(for keys: [String]) -> [String] {
        guard case .object(let object) = self else {
            return []
        }
        for key in keys {
            guard let value = object[key] else {
                continue
            }
            let strings = value.asStringArray
            if !strings.isEmpty {
                return strings
            }
        }
        return []
    }

    func array(for keys: [String]) -> [JSONValue] {
        guard case .object(let object) = self else {
            return []
        }
        for key in keys {
            if let array = object[key]?.arrayValue {
                return array
            }
        }
        return []
    }

    private var plainString: String? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        default:
            return nil
        }
    }

    private var doubleValue: Double? {
        switch self {
        case .number(let value):
            return value
        case .string(let value):
            return Double(value.trimmingCharacters(in: .whitespacesAndNewlines))
        case .bool(let value):
            return value ? 1 : 0
        default:
            return nil
        }
    }

    private var asStringArray: [String] {
        switch self {
        case .array(let values):
            return values.compactMap { $0.markdownSummary.nonEmpty }
        case .string(let value):
            return value.components(separatedBy: .newlines).compactMap(\.nonEmpty)
        default:
            return []
        }
    }

    private func objectMarkdown(_ object: [String: JSONValue]) -> String {
        var parts: [String] = []

        for key in ["title", "heading", "name"] {
            if let text = object[key]?.plainString?.nonEmpty {
                parts.append("## \(text)")
                break
            }
        }

        for key in ["summary", "overview", "content", "text", "body", "description", "definition"] {
            if let value = object[key] {
                let text = value.markdownSummary.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty { parts.append(text) }
            }
        }

        for key in ["bullets", "key_points", "keyPoints", "points", "items"] {
            if case .array(let items)? = object[key] {
                let bulletText = items.map { "- \($0.markdownSummary)" }
                    .filter { $0 != "- " }
                    .joined(separator: "\n")
                if !bulletText.isEmpty { parts.append(bulletText) }
            }
        }

        for key in ["callout", "clinicalPearl", "clinical_pearl", "examTip", "exam_tip", "mnemonic", "sticky_note", "stickyNote", "takeaway", "highYield", "high_yield"] {
            if let value = object[key] {
                let text = value.markdownSummary.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty { parts.append("> \(text)") }
            }
        }

        for key in ["sections", "pages", "blocks", "cards"] {
            if let value = object[key] {
                let text = value.markdownSummary.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty { parts.append(text) }
            }
        }

        if parts.isEmpty {
            return object.keys.sorted().compactMap { key in
                let text = object[key]?.markdownSummary.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return text.isEmpty ? nil : text
            }.joined(separator: "\n\n")
        }

        return parts.joined(separator: "\n\n")
    }
}

struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
    }

    init?(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}

enum AiNoteContext {
    static func make(_ values: [String?]) -> String? {
        let parts = unique(values.compactMap(\.nonEmpty))
        return parts.isEmpty ? nil : parts.joined(separator: " / ")
    }

    static func unique(_ values: [String]) -> [String] {
        values.reduce(into: [String]()) { result, value in
            let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !clean.isEmpty else { return }
            if !result.contains(where: { $0.caseInsensitiveCompare(clean) == .orderedSame }) {
                result.append(clean)
            }
        }
    }
}

private extension String {
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var normalizedEngineKey: String? {
        nonEmpty?.lowercased()
    }
}

private extension Optional where Wrapped == String {
    var nonEmpty: String? {
        self?.nonEmpty
    }

    var normalizedEngineKey: String? {
        self?.normalizedEngineKey
    }
}

private extension KeyedDecodingContainer {
    func decodeString(for keys: [Key]) -> String? {
        for key in keys {
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return String(value)
            }
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return String(value)
            }
        }
        return nil
    }

    func decodeInt(for keys: [Key]) -> Int? {
        for key in keys {
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return Int(value)
            }
            if let value = try? decodeIfPresent(String.self, forKey: key),
               let intValue = Int(value) {
                return intValue
            }
        }
        return nil
    }

    func decodeDouble(for keys: [Key]) -> Double? {
        for key in keys {
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return Double(value)
            }
            if let value = try? decodeIfPresent(String.self, forKey: key),
               let doubleValue = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)) {
                return doubleValue
            }
        }
        return nil
    }

    func decodeBool(for keys: [Key]) -> Bool? {
        for key in keys {
            if let value = try? decodeIfPresent(Bool.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return value != 0
            }
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if ["1", "true", "yes"].contains(normalized) { return true }
                if ["0", "false", "no"].contains(normalized) { return false }
            }
        }
        return nil
    }
}
