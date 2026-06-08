# Xyndrome iOS Native App — Build Progress

## Overview

Native SwiftUI iOS app for xyndrome.lk, built from scratch. No WebView, no Capacitor, no React Native. All screens are pure Swift/SwiftUI targeting iOS 17+.

**Bundle ID:** `com.erpm.medical.lms`  
**Minimum iOS:** 17.0  
**Architecture:** MVVM, `@Observable`, `async/await`, `URLSession`, Keychain  
**Xcode project:** `ios-native/Xyndrome.xcodeproj`

---

## Phase Status

| Phase | Description | Status |
|---|---|---|
| 1 | Repo scan + iOS migration plan | ✅ Complete |
| 2 | Xcode project scaffold | ✅ Complete |
| 3 | Core foundation (API, auth, Keychain, navigation, theme) | ✅ Complete |
| 4 | Auth screens (login, register, forgot/reset password, session restore) | ✅ Complete |
| 5 | Student core (dashboard, courses, course detail, profile) | ✅ Complete |
| 6 | Learning (AI notes list/detail, flashcards, bookmarks, planner) | ✅ Complete |
| 7 | Assessment (quiz list, practice + exam mode, results, review) | ✅ Complete |
| 8 | Billing + notifications | ✅ Partial — billing view + notifications list done; payment proof upload pending |
| 9 | Polish, accessibility, offline, release prep | ✅ Partial — asset catalog baseline done; accessibility/offline/release prep pending |

**Build status:** `BUILD SUCCEEDED` (Xcode 26.5, iOS Simulator SDK 26.5, generic simulator destination)

---

## Files Created

```
ios-native/
  PROGRESS.md                          ← this file
  Xyndrome.xcodeproj/
    project.pbxproj
  Xyndrome/
    XyndromeApp.swift                  ← @main entry, tab bar, APNs setup
    Info.plist                         ← bundle config, API_BASE_URL, privacy strings
    Xyndrome.entitlements              ← Keychain only (push/domains need paid account)
    Resources/
      Assets.xcassets                  ← app icon set + adaptive accent color
    Core/
      Network/
        APIClient.swift                ← URLSession, Bearer token, X-LMS-Native header, 401 handler
        APIEndpoint.swift              ← all 50+ endpoint routes as enum
        APIError.swift                 ← typed error enum with user-friendly messages
      Auth/
        AuthSession.swift              ← @Observable session: user, token, isAuthenticated
        AuthStore.swift                ← login/register/logout/forgotPassword/resetPassword
        KeychainStore.swift            ← SecItemAdd/Copy/Delete for session token
      Storage/
        AppPreferences.swift           ← UserDefaults wrapper (theme, last tab, push enabled)
        CacheStore.swift               ← in-memory TTL cache (mirrors web API cache)
      Design/
        XyndromeTheme.swift            ← brand colors, typography scale, spacing, shadows
        Components/
          LoadingView.swift            ← full-screen and inline loading states
          ErrorView.swift              ← error + empty state + 3 button styles
          XyndromeTextField.swift      ← text field + secure field with show/hide toggle
      Navigation/
        AppRouter.swift                ← root switch: splash → auth → tabs → pending
        AppRoute.swift                 ← NavigationPath destination enum
        DeepLinkHandler.swift          ← push notification route → AppRoute mapper
      Notifications/
        PushNotificationManager.swift  ← APNs permission, token registration, badge clear
    Models/
      AuthModels.swift                 ← LoginRequest, RegisterRequest, User, AuthResponse
      CourseModels.swift               ← Course list/detail, subject/topic/lesson map DTOs
      AiNoteModels.swift               ← AiNote, AiNoteDetail, CanvasSection, Flashcard
      QuizModels.swift                 ← QuizSummary (Hashable), QuizQuestion, QuizOption
      ResultModels.swift               ← AttemptResult, ResultAnalysis, ReviewAnswer
      BillingModels.swift              ← Subscription, plan, request, payment settings models
      NotificationModels.swift         ← AppNotification, NativePushTokenRequest
      PlannerModels.swift              ← PlannerTask, AgendaItem, planner create/update DTOs
      BookmarkModels.swift             ← Bookmark, ToggleBookmarkRequest, backend-compatible saved item DTOs
      DashboardModels.swift            ← Dashboard response, stats, goals, performance snapshot
    Features/
      Auth/
        AuthViewModel.swift            ← shared VM for all auth screens
        LoginView.swift
        RegisterView.swift
        ForgotPasswordView.swift
        ResetPasswordView.swift
      Dashboard/
        StudentDashboardView.swift     ← stats grid, upcoming tasks, recent courses
      Courses/
        CoursesView.swift              ← course list with progress bars
        CourseDetailView.swift         ← subject/topic/lesson map, lesson completion
      AiNotes/
        AiNotesListView.swift          ← AI note list with subject badges
        AiNoteDetailView.swift         ← note body + flashcard launcher
        NoteContentRenderer.swift      ← AttributedString markdown renderer
      Quizzes/
        QuizListView.swift             ← quiz list + mode picker sheet
        PracticeQuizView.swift         ← full quiz engine: options, timer, autosave, submit
      Results/
        ResultDetailView.swift         ← score circle, analysis, review workspace
      Flashcards/
        FlashcardsView.swift           ← 3D flip card, swipe to advance, haptics
      Bookmarks/
        BookmarksView.swift            ← saved items list, filters, native swipe remove, native destinations
      Planner/
        StudyPlannerView.swift         ← task CRUD, agenda list, native form sheet, haptics
      Profile/
        ProfileView.swift              ← edit name, sign out, billing/bookmarks/planner/notifications links
      Billing/
        BillingView.swift              ← subscription status, plan list, bank transfer invoice requests
      Notifications/
        NotificationsListView.swift    ← list with unread dot, optimistic mark-read
```

---

## API Integration

All endpoints call `https://xyndrome.lk/api` (configurable via `Info.plist → API_BASE_URL`).

Every authenticated request sends:
```
Authorization: Bearer <token>
```

Login and Register additionally send:
```
X-LMS-Native: 1
```
This causes the backend to return `sessionToken` in the response body (required for native apps — the web app uses HTTP-only cookies instead).

The token is stored in Keychain under key `session_token`, service `com.erpm.medical.lms`.

---

## Known Limitations / Pending Work

### Needs paid Apple Developer account ($99/yr)
- **Push Notifications** — `aps-environment` entitlement stripped from `Xyndrome.entitlements`; `PushNotificationManager.swift` is fully implemented and will work once re-added
- **Associated Domains / Universal Links** — `com.apple.developer.associated-domains` stripped; deep links from web still route via URL scheme `xyndrome://`

### Phase 8 remaining
- `PaymentProofUploadView.swift` — native file/image picker + backend-compatible proof data URL upload

### Phase 9 remaining
- Production launch/splash artwork refinement; native `Assets.xcassets` baseline is already in place
- Accessibility labels on interactive elements
- `NWPathMonitor` offline banner
- Dynamic Type pass on quiz and note screens
- App Store release build configuration (production `aps-environment`, privacy manifest)

---

## How to Build & Run

### Simulator (works today, free account)
```bash
open /Applications/XAMPP/xamppfiles/htdocs/lms/ios-native/Xyndrome.xcodeproj
# Select iPhone 17 simulator → ⌘R
```

Or from terminal:
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/lms/ios-native
xcodebuild \
  -project Xyndrome.xcodeproj \
  -scheme Xyndrome \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=2A4C5617-D887-44F3-A45F-53BDBF885801" \
  -configuration Debug \
  CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  build
```

### Real device (requires paid account)
1. Join [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr)
2. In Xcode → Signing & Capabilities → set your Team
3. Re-add to `Xyndrome.entitlements`:
   ```xml
   <key>aps-environment</key>
   <string>development</string>
   <key>com.apple.developer.associated-domains</key>
   <array><string>applinks:xyndrome.lk</string></array>
   ```
4. Add Push Notifications + Associated Domains capabilities in the Xcode target editor
5. Review production app icon and launch branding in `Assets.xcassets`
6. ⌘R to run on connected iPhone/iPad

---

## Backend Compatibility

No backend changes were made. The existing NestJS backend is fully compatible:
- All API endpoints consumed are under `/student/*`, `/auth/*`, `/subscriptions/*`, `/push/*`
- The `X-LMS-Native: 1` header pattern was already implemented on the backend
- Session tokens work as Bearer auth with 7-day TTL
- Dashboard and courses models now tolerate the current backend response shapes for `dailyGoals`, `performanceSnapshot`, `courseProgress`, `/student/courses`, and `/student/courses/:id`
- Bookmarks now use the backend `itemType`/`itemId` contract and support the `/student/bookmarks` rewrite to `/study-bookmarks`
- Planner now uses camelCase create/update fields (`dueDate`, `estimatedMinutes`, `status`) and decodes both personal tasks and generated agenda items from `/student/planner`
- PayHere hosted checkout returns form fields from the backend; embedded browser UI is not used in the native app and native-safe payment handoff remains pending

---

## Next Recommended Steps (Priority Order)

1. **`PaymentProofUploadView.swift`** — native file/image picker + data URL upload
2. **Paid Apple account** → re-enable push + universal links
3. **Phase 9 polish** — accessibility, offline banner, Dynamic Type
