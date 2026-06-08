import SwiftUI
import UIKit

@Observable
@MainActor
final class StudyPlannerViewModel {
    nonisolated init() {}
    var tasks: [PlannerTask] = []
    var agenda: [AgendaItem] = []
    var isLoading = false
    var isSaving = false
    var error: String?
    var message: String?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let taskResponse: PlannerTasksResponse = try await APIClient.shared.request(.listPlannerTasks)
            let agendaResponse: PlannerAgendaResponse = try await APIClient.shared.request(.plannerAgenda)
            tasks = taskResponse.tasks ?? []
            agenda = agendaResponse.agenda ?? []
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createTask(from form: PlannerTaskFormState) async -> Bool {
        let title = form.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            error = "Task title cannot be empty."
            return false
        }
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            try await APIClient.shared.requestVoid(.createPlannerTask, body: form.createRequest)
            message = "Task added."
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await load()
            return true
        } catch let e as APIError {
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
        return false
    }

    func updateTask(_ task: PlannerTask, from form: PlannerTaskFormState) async -> Bool {
        let title = form.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            error = "Task title cannot be empty."
            return false
        }
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            try await APIClient.shared.requestVoid(.updatePlannerTask(id: task.id), body: form.updateRequest(status: task.status))
            message = "Task updated."
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await load()
            return true
        } catch let e as APIError {
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
        return false
    }

    func toggleTask(_ task: PlannerTask) async {
        let nextStatus = task.isCompleted ? "todo" : "done"
        let request = UpdatePlannerTaskRequest(
            title: nil,
            description: nil,
            dueDate: nil,
            status: nextStatus,
            category: nil,
            priority: nil,
            estimatedMinutes: nil
        )
        do {
            try await APIClient.shared.requestVoid(.updatePlannerTask(id: task.id), body: request)
            UINotificationFeedbackGenerator().notificationOccurred(nextStatus == "done" ? .success : .warning)
            await load()
        } catch let e as APIError {
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

    func deleteTask(_ task: PlannerTask) async {
        let previousTasks = tasks
        tasks.removeAll { $0.id == task.id }
        do {
            try await APIClient.shared.requestVoid(.deletePlannerTask(id: task.id))
            message = "Task deleted."
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await load()
        } catch let e as APIError {
            tasks = previousTasks
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            tasks = previousTasks
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

private enum PlannerViewMode: String, CaseIterable, Identifiable {
    case open
    case agenda
    case done

    var id: String { rawValue }

    var title: String {
        switch self {
        case .open: return "Open"
        case .agenda: return "Agenda"
        case .done: return "Done"
        }
    }
}

private enum PlannerOption {
    static let categories: [(String, String)] = [
        ("general", "General"),
        ("lesson", "Lesson"),
        ("quiz", "Quiz"),
        ("exam", "Exam"),
        ("review", "Review"),
        ("flashcards", "Flashcards")
    ]

    static let priorities: [(String, String)] = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High")
    ]
}

struct PlannerTaskFormState {
    var title = ""
    var description = ""
    var hasDueDate = true
    var dueDate = Date()
    var category = "general"
    var priority = "medium"
    var estimatedMinutes = 30

    init() {}

    init(task: PlannerTask) {
        title = task.title
        description = task.description ?? ""
        if let parsed = plannerDate(from: task.dueDate) {
            dueDate = parsed
            hasDueDate = true
        } else {
            hasDueDate = false
        }
        category = task.category ?? "general"
        priority = task.priority ?? "medium"
        estimatedMinutes = task.estimatedMinutes ?? 30
    }

    var createRequest: CreatePlannerTaskRequest {
        CreatePlannerTaskRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: trimmedDescription,
            dueDate: hasDueDate ? plannerDateKey(from: dueDate) : nil,
            category: category,
            priority: priority,
            estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : nil
        )
    }

    func updateRequest(status: String?) -> UpdatePlannerTaskRequest {
        UpdatePlannerTaskRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: trimmedDescription,
            dueDate: hasDueDate ? plannerDateKey(from: dueDate) : nil,
            status: status,
            category: category,
            priority: priority,
            estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : nil
        )
    }

    private var trimmedDescription: String? {
        let clean = description.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? nil : clean
    }
}

struct StudyPlannerView: View {
    @State private var vm = StudyPlannerViewModel()
    @State private var mode: PlannerViewMode = .open
    @State private var showTaskForm = false
    @State private var editingTask: PlannerTask?
    @State private var taskForm = PlannerTaskFormState()

    private var openTasks: [PlannerTask] {
        vm.tasks.filter { !$0.isCompleted }
    }

    private var completedTasks: [PlannerTask] {
        vm.tasks.filter(\.isCompleted)
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.tasks.isEmpty && vm.agenda.isEmpty {
                LoadingView(message: "Loading planner...")
            } else if let err = vm.error, vm.tasks.isEmpty && vm.agenda.isEmpty {
                ErrorView(message: err, onRetry: { Task { await vm.load() } })
            } else {
                plannerList
            }
        }
        .navigationTitle("Planner")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    editingTask = nil
                    taskForm = PlannerTaskFormState()
                    showTaskForm = true
                } label: {
                    Label("Add task", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showTaskForm) {
            PlannerTaskFormSheet(
                title: editingTask == nil ? "Add Task" : "Edit Task",
                form: $taskForm,
                isSaving: vm.isSaving,
                onCancel: { showTaskForm = false },
                onSave: {
                    Task {
                        let didSave: Bool
                        if let editingTask {
                            didSave = await vm.updateTask(editingTask, from: taskForm)
                        } else {
                            didSave = await vm.createTask(from: taskForm)
                        }
                        if didSave {
                            showTaskForm = false
                        }
                    }
                }
            )
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private var plannerList: some View {
        List {
            Section {
                PlannerSummaryStrip(tasks: vm.tasks, agenda: vm.agenda)
            }
            .listRowBackground(Color.clear)

            if let message = vm.message {
                Section {
                    Label(message, systemImage: "checkmark.circle.fill")
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.success)
                }
            }

            if let error = vm.error {
                Section {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.error)
                }
            }

            Section {
                Picker("Planner view", selection: $mode) {
                    ForEach(PlannerViewMode.allCases) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)

            switch mode {
            case .open:
                taskSection(title: "Open Tasks", tasks: openTasks)
            case .agenda:
                agendaSection
            case .done:
                taskSection(title: "Completed", tasks: completedTasks)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(XyndromeTheme.Colors.surface)
    }

    private func taskSection(title: String, tasks: [PlannerTask]) -> some View {
        Section {
            if tasks.isEmpty {
                EmptyPlannerRow(
                    icon: mode == .done ? "checkmark.seal" : "calendar.badge.plus",
                    title: mode == .done ? "No completed tasks yet" : "No open personal tasks",
                    message: mode == .done ? "Finished tasks will collect here." : "Add a study task when you want a reminder outside the generated agenda."
                )
            } else {
                ForEach(tasks) { task in
                    PlannerTaskRow(task: task, onToggle: {
                        Task { await vm.toggleTask(task) }
                    })
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await vm.deleteTask(task) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            editingTask = task
                            taskForm = PlannerTaskFormState(task: task)
                            showTaskForm = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(XyndromeTheme.Colors.primary)
                    }
                }
            }
        } header: {
            Text(title)
        }
    }

    private var agendaSection: some View {
        Section {
            if vm.agenda.isEmpty {
                EmptyPlannerRow(
                    icon: "calendar",
                    title: "No Agenda Yet",
                    message: "Your generated study agenda appears after lessons, quizzes, or planner tasks create study signals."
                )
            } else {
                ForEach(vm.agenda) { item in
                    if let quizId = item.sourceId,
                       item.locked != true,
                       item.type == "quiz" || item.type == "exam" {
                        NavigationLink {
                            PracticeQuizView(quizId: quizId, mode: item.type == "exam" ? .exam : .practice)
                        } label: {
                            PlannerAgendaRow(item: item)
                        }
                    } else {
                        PlannerAgendaRow(item: item)
                    }
                }
            }
        } header: {
            Text("Generated Agenda")
        }
    }
}

struct PlannerSummaryStrip: View {
    let tasks: [PlannerTask]
    let agenda: [AgendaItem]

    private var stats: [(String, Int, String, Color)] {
        [
            ("Open", tasks.filter { !$0.isCompleted }.count, "circle", XyndromeTheme.Colors.primary),
            ("Due Today", agenda.filter { ($0.status ?? "") == "due_today" || ($0.status ?? "") == "in_progress" }.count, "calendar", XyndromeTheme.Colors.warning),
            ("Overdue", agenda.filter { ($0.status ?? "") == "overdue" }.count, "exclamationmark.circle", XyndromeTheme.Colors.error),
            ("Done", tasks.filter(\.isCompleted).count + agenda.filter(\.isCompleted).count, "checkmark.circle", XyndromeTheme.Colors.success)
        ]
    }

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: XyndromeTheme.Spacing.sm) {
            ForEach(stats, id: \.0) { stat in
                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    Image(systemName: stat.2)
                        .foregroundStyle(stat.3)
                        .frame(width: 28, height: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(stat.1)")
                            .font(XyndromeTheme.Typography.title3())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text(stat.0)
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(XyndromeTheme.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(XyndromeTheme.Colors.surfaceSecondary)
                )
            }
        }
    }
}

struct PlannerTaskRow: View {
    let task: PlannerTask
    var onToggle: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
            Button(action: onToggle) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 24))
                    .foregroundStyle(task.isCompleted ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.textMuted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(task.isCompleted ? "Mark incomplete" : "Mark complete")

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    Text(plannerTitleCase(task.priority ?? "medium"))
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.semibold)
                        .foregroundStyle(priorityColor(task.priority))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(priorityColor(task.priority).opacity(0.12)))

                    Text(plannerTitleCase(task.category ?? "general"))
                        .font(XyndromeTheme.Typography.caption2())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }

                Text(task.title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .fontWeight(.semibold)
                    .foregroundStyle(task.isCompleted ? XyndromeTheme.Colors.textSecondary : XyndromeTheme.Colors.textPrimary)
                    .strikethrough(task.isCompleted)

                if let description = task.description, !description.isEmpty {
                    Text(description)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(2)
                }

                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    if let dueText = plannerDueText(task.dueDate) {
                        Label(dueText, systemImage: "calendar")
                    }
                    if let minutes = task.estimatedMinutes, minutes > 0 {
                        Label("\(minutes)m", systemImage: "clock")
                    }
                }
                .font(XyndromeTheme.Typography.caption())
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
            }
        }
        .padding(.vertical, XyndromeTheme.Spacing.xs)
    }
}

struct PlannerAgendaRow: View {
    let item: AgendaItem

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(statusColor.opacity(0.14))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: icon)
                        .foregroundStyle(statusColor)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    Text(plannerTitleCase(item.type ?? "task"))
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.semibold)
                        .foregroundStyle(statusColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(statusColor.opacity(0.12)))

                    if item.locked == true {
                        Image(systemName: "lock.fill")
                            .font(XyndromeTheme.Typography.caption2())
                            .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    }
                }

                Text(item.title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)

                if let context = item.contextLine {
                    Text(context)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(1)
                }

                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    if let dueText = plannerDueText(item.dueDate) {
                        Label(dueText, systemImage: "calendar")
                    }
                    if let action = item.actionLabel, !action.isEmpty {
                        Label(action, systemImage: "arrow.right.circle")
                    }
                }
                .font(XyndromeTheme.Typography.caption())
                .foregroundStyle(XyndromeTheme.Colors.textMuted)

                if let progress = item.progress, progress > 0 {
                    ProgressView(value: progress / 100)
                        .tint(statusColor)
                }

                if let accessMessage = item.accessMessage, !accessMessage.isEmpty {
                    Text(accessMessage)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.warning)
                }
            }
        }
        .padding(.vertical, XyndromeTheme.Spacing.xs)
        .opacity(item.locked == true ? 0.65 : 1)
    }

    private var icon: String {
        switch item.type {
        case "quiz": return "checkmark.circle"
        case "exam": return "timer"
        case "lesson": return "book"
        case "review": return "arrow.counterclockwise.circle"
        case "flashcards": return "rectangle.stack"
        default: return "calendar"
        }
    }

    private var statusColor: Color {
        switch item.status {
        case "completed": return XyndromeTheme.Colors.success
        case "overdue": return XyndromeTheme.Colors.error
        case "due_today", "in_progress": return XyndromeTheme.Colors.warning
        default: return XyndromeTheme.Colors.primary
        }
    }
}

struct EmptyPlannerRow: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 34))
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
            Text(title)
                .font(XyndromeTheme.Typography.headline())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            Text(message)
                .font(XyndromeTheme.Typography.subheadline())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, XyndromeTheme.Spacing.xl)
    }
}

struct PlannerTaskFormSheet: View {
    let title: String
    @Binding var form: PlannerTaskFormState
    let isSaving: Bool
    var onCancel: () -> Void
    var onSave: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Study task", text: $form.title)
                        .textInputAutocapitalization(.sentences)
                    TextField("Optional note", text: $form.description, axis: .vertical)
                        .lineLimit(2...4)
                }

                Section("Schedule") {
                    Toggle("Due date", isOn: $form.hasDueDate)
                    if form.hasDueDate {
                        DatePicker("Date", selection: $form.dueDate, displayedComponents: .date)
                    }
                    Stepper(value: $form.estimatedMinutes, in: 0...240, step: 5) {
                        Text(form.estimatedMinutes > 0 ? "\(form.estimatedMinutes) minutes" : "No time estimate")
                    }
                }

                Section("Type") {
                    Picker("Category", selection: $form.category) {
                        ForEach(PlannerOption.categories, id: \.0) { option in
                            Text(option.1).tag(option.0)
                        }
                    }
                    Picker("Priority", selection: $form.priority) {
                        ForEach(PlannerOption.priorities, id: \.0) { option in
                            Text(option.1).tag(option.0)
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving" : "Save", action: onSave)
                        .disabled(isSaving)
                }
            }
        }
    }
}

private func priorityColor(_ priority: String?) -> Color {
    switch priority {
    case "high": return XyndromeTheme.Colors.error
    case "low": return XyndromeTheme.Colors.success
    default: return XyndromeTheme.Colors.warning
    }
}

private func plannerTitleCase(_ value: String) -> String {
    value
        .replacingOccurrences(of: "_", with: " ")
        .split(separator: " ")
        .map { $0.prefix(1).uppercased() + $0.dropFirst() }
        .joined(separator: " ")
}

private func plannerDateKey(from date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

private func plannerDate(from raw: String?) -> Date? {
    guard let raw, !raw.isEmpty else { return nil }
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    if let date = formatter.date(from: raw) {
        return date
    }
    return ISO8601DateFormatter().date(from: raw)
}

private func plannerDueText(_ raw: String?) -> String? {
    guard let date = plannerDate(from: raw) else { return nil }
    let calendar = Calendar.current
    if calendar.isDateInToday(date) {
        return "Today"
    }
    if calendar.isDateInTomorrow(date) {
        return "Tomorrow"
    }
    if calendar.isDateInYesterday(date) {
        return "Yesterday"
    }
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter.string(from: date)
}
