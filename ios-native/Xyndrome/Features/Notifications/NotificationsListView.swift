import SwiftUI

@Observable
@MainActor
final class NotificationsViewModel {
    nonisolated init() {}
    var notifications: [AppNotification] = []
    var isLoading = false
    var error: String?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: NotificationsResponse = try await APIClient.shared.request(.listNotifications)
            notifications = response.notifications ?? []
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markRead(id: Int) async {
        guard let index = notifications.firstIndex(where: { $0.id == id }) else { return }
        // Optimistic update
        notifications[index] = AppNotification(
            id: notifications[index].id,
            title: notifications[index].title,
            body: notifications[index].body,
            type: notifications[index].type,
            isRead: true,
            createdAt: notifications[index].createdAt,
            route: notifications[index].route
        )
        try? await APIClient.shared.requestVoid(.markNotificationRead(id: id))
    }
}

struct NotificationsListView: View {
    @State private var vm = NotificationsViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.notifications.isEmpty {
                LoadingView(message: "Loading notifications...")
            } else if let err = vm.error, vm.notifications.isEmpty {
                ErrorView(message: err, onRetry: { Task { await vm.load() } })
            } else if vm.notifications.isEmpty {
                EmptyStateView(
                    icon: "bell.slash",
                    title: "No Notifications",
                    message: "You're all caught up!"
                )
            } else {
                List(vm.notifications) { notification in
                    NotificationRow(notification: notification)
                        .onTapGesture {
                            if notification.isRead != true {
                                Task { await vm.markRead(id: notification.id) }
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
                .listStyle(.plain)
                .background(XyndromeTheme.Colors.surface)
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.large)
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }
}

struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
            Circle()
                .fill(notification.isRead == true ? Color.clear : XyndromeTheme.Colors.primary)
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(notification.title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .fontWeight(notification.isRead == true ? .regular : .semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                if let body = notification.body {
                    Text(body)
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(2)
                }

                if let date = notification.createdAt {
                    Text(date)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                }
            }

            Spacer()
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(notification.isRead == true
                      ? XyndromeTheme.Colors.surfaceSecondary
                      : XyndromeTheme.Colors.primary.opacity(0.05))
        )
    }
}
