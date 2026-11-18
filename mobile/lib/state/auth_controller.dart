import '../core/perf_log.dart';
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../data/api_client.dart';
import 'practice_sync.dart';
import '../data/auth_repository.dart';
import '../data/apple_auth.dart';
import '../data/google_auth.dart';
import '../data/public_settings.dart';
import '../data/models.dart';
import '../data/secure_store.dart';
import 'onboarding.dart';
import '../services/push.dart';
import '../services/study_reminders.dart';
import '../services/flashcard_reminders.dart';
import '../services/streak_reminders.dart';
import 'local_scope.dart';
import 'catalogue.dart';
import 'notice_store.dart';
import 'flash_store.dart';
import '../services/plan_reminders.dart';
import 'saved_first.dart';
import 'user_data_reset.dart';
import '../features/dashboard/dashboard_repository.dart';
import '../features/notifications/notifications_repository.dart';

/// Mirrors the web authStore keys (§8): token, user, isAuthenticated,
/// isHydrating, error.
class AuthState {
  final bool isHydrating;
  final bool isAuthenticated;
  final AppUser? user;
  final String? token;
  final String? error;

  const AuthState({
    this.isHydrating = false,
    this.isAuthenticated = false,
    this.user,
    this.token,
    this.error,
  });

  AuthState copyWith({
    bool? isHydrating,
    bool? isAuthenticated,
    AppUser? user,
    String? token,
    String? error,
  }) =>
      AuthState(
        isHydrating: isHydrating ?? this.isHydrating,
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        user: user ?? this.user,
        token: token ?? this.token,
        error: error,
      );
}

/// Outcome the auth pages branch on: signed in, needs email verification, or
/// failed (with the error already surfaced via [AuthState.error]).
class AuthAttempt {
  final bool signedIn;
  final String? verifyEmail; // non-null → route to the verify-email screen
  final String? devCode;
  const AuthAttempt({this.signedIn = false, this.verifyEmail, this.devCode});
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    api.onUnauthorized = _onUnauthorized;
    Push.init(api);
    Future.microtask(_hydrate);
    return const AuthState(isHydrating: true);
  }

  ApiClient get _api => ref.read(apiClientProvider);
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Set once real SharedPreferences data exists on this install. Checked
  /// before ever trusting the Keychain — see [_clearStaleKeychainOnFreshInstall].
  static const String _installedFlagKey = 'xyndrome.installed';

  /// The Keychain survives deleting the app — that's Apple's own design, not
  /// a bug in this app, and it exists so things like saved passwords survive
  /// a reinstall. But this app was trusting it unconditionally: delete the
  /// app, reinstall, and whichever account was last logged in came back
  /// automatically, Keychain-deep, with no way to tell that had happened.
  ///
  /// SharedPreferences, unlike the Keychain, genuinely IS wiped when the app
  /// is deleted. So its absence is a reliable "this is a fresh install" — and
  /// on a fresh install any Keychain token left over from before must be a
  /// leftover from a previous, now-deleted copy of the app, never a real
  /// active session, since nothing has had the chance to write one yet.
  Future<void> _clearStaleKeychainOnFreshInstall() async {
    try {
      final prefs = ref.read(sharedPrefsProvider);
      if (prefs.getBool(_installedFlagKey) == true) return;
      await SecureStore.clear();
      await prefs.setBool(_installedFlagKey, true);
    } catch (_) {
      // Never let this block startup — worst case, a stale Keychain token
      // survives one more launch than it should.
    }
  }

  Future<void> _hydrate() async {
    await _clearStaleKeychainOnFreshInstall();

    // The keychain read must never be allowed to throw uncaught. The router
    // pins to /splash for as long as `isHydrating` is true, so a failure here
    // leaves the app on a blank splash screen forever with no way out.
    // Keychain entries survive app deletion, so a reinstall signed with
    // different entitlements can fail this read on an otherwise healthy app —
    // treat any failure as simply "not signed in".
    String? token;
    try {
      token = await SecureStore.readToken();
    } catch (_) {
      try {
        await SecureStore.clear();
      } catch (_) {
        // Nothing more to do — fall through to the logged-out state.
      }
      state = const AuthState(isHydrating: false);
      return;
    }

    if (token == null || token.isEmpty) {
      state = const AuthState(isHydrating: false);
      return;
    }
    _api.setToken(token);

    try {
      // One request on a cold open: renews the access token (the account
      // check), and brings the user, the catalogue version and Study Hub.
      // The phone's inbox is per account; the last account on this phone is
      // the likely one, so its newest notice id goes with the request.
      final lastUid = await NoticeStore.lastAccount();
      if (lastUid != null) LocalScope.uid = lastUid;
      PerfLog.mark('hydrate: start-up request');
      final started = await _repo.start(
          lastNoticeId: lastUid == null ? 0 : await NoticeStore.lastId());
      PerfLog.mark('hydrate: start-up reply');
      final user = started.user;
      catalogueVersion = started.contentVersion;
      DashboardPrefetch.seed(started.dashboard);
      StudyReminders.userId = user.id;
      FlashcardReminders.userId = user.id;
      StreakReminders.userId = user.id;
      PlanReminders.userId = user.id;
      LocalScope.uid = user.id;
      await FlashStore.applyStart(started.raw, user.id);
      await NoticeStore.rememberAccount(user.id);
      // The reply carries the student's progress: saved as that list's
      // fresh copy, so no separate progress request (step 5).
      await seedSaved('progress', await mergeProgress(started.raw['progress']));
      if (lastUid == user.id) {
        await NoticeStore.applyServer(started.raw);
      } else {
        await NoticeStore.savePopups(started.raw['popups']);
        unawaited(NoticeStore.pull(_api)); // another account: ask from its own last id
      }
      unawaited(PlanReminders.reconcile(user));
      state = AuthState(
          isHydrating: false,
          isAuthenticated: true,
          user: user,
          token: token);
      Push.onAuthenticated(userId: user.id);
    } catch (_) {
      DashboardPrefetch.clear();
      await SecureStore.clear();
      _api.setToken(null);
      StudyReminders.userId = 'anon';
      FlashcardReminders.userId = 'anon';
      StreakReminders.userId = 'anon';
      PlanReminders.userId = 'anon';
      LocalScope.uid = 'anon';
      resetUserScopedData(ref);
      state = const AuthState(isHydrating: false);
    }
  }

  void _onUnauthorized() {
    SecureStore.clear();
    _api.setToken(null);
    StudyReminders.cancelScheduled();
    FlashcardReminders.cancelScheduled();
    StreakReminders.cancelScheduled();
    PlanReminders.cancelScheduled();
    StudyReminders.userId = 'anon';
    FlashcardReminders.userId = 'anon';
    StreakReminders.userId = 'anon';
    PlanReminders.userId = 'anon';
    LocalScope.uid = 'anon';
    resetUserScopedData(ref);
    state = const AuthState(isHydrating: false, error: 'Your session expired.');
  }

  Future<AuthAttempt> login(String email, String password) async {
    try {
      final out = await _repo.login(email.trim(), password);
      if (out.needsVerification) {
        state = state.copyWith(error: null);
        return AuthAttempt(verifyEmail: out.verifyEmail, devCode: out.devCode);
      }
      _applySession(out.session!);
      return const AuthAttempt(signedIn: true);
    } catch (e) {
      state = state.copyWith(error: _loginMsg(e));
      return const AuthAttempt();
    }
  }

  /// Email sign-in errors as ONE plain message (2026-11-17): a wrong or badly
  /// typed email / password never shows the server's field messages
  /// ("email must be an email").
  String _loginMsg(Object e) {
    if (e is DioException) {
      final code = e.response?.statusCode ?? 0;
      if (code == 400 || code == 401 || code == 404) return 'Incorrect email or password.';
      if (code == 429) return 'Too many tries. Wait a few minutes and try again.';
    }
    return _msg(e);
  }

  /// Shows a sign-in form message without a request (e.g. an empty field).
  void showError(String message) => state = state.copyWith(error: message);

  /// Native Google sign-in: get an ID token from Google, exchange it at
  /// POST /auth/google, then store the session exactly like [login].
  /// Returns false (with no error) if the user cancels the Google picker.
  Future<bool> loginWithGoogle() async {
    try {
      // Instant: use the live server client id if it has already loaded,
      // otherwise the baked fallback — never block on /settings/public.
      final loaded = ref.read(publicAuthSettingsProvider).asData?.value;
      final clientId = (loaded != null && loaded.googleClientId.isNotEmpty)
          ? loaded.googleClientId
          : AppConfig.googleWebClientId;
      final idToken = await googleSignInIdToken(serverClientId: clientId);
      if (idToken == null) return false; // user cancelled
      // Google accounts are pre-verified by Google, so they never hit the OTP
      // step — the backend always returns a live session here.
      await _applySession(await _repo.loginWithGoogle(idToken));
      return true;
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return false;
    }
  }

  /// Native Sign in with Apple: run the system sheet, exchange the identity
  /// token at POST /auth/apple, then store the session like [login].
  /// Returns false (with no error) if the user cancels the Apple sheet.
  Future<bool> loginWithApple() async {
    try {
      final cred = await appleSignIn();
      if (cred == null) return false; // user cancelled
      // Apple verifies the email itself, so these accounts skip the OTP step —
      // the backend always returns a live session here.
      await _applySession(
          await _repo.loginWithApple(cred.identityToken, fullName: cred.fullName));
      return true;
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return false;
    }
  }

  Future<AuthAttempt> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool acceptedTerms,
    required String country,
    required String university,
  }) async {
    try {
      final out = await _repo.register(
        fullName: fullName.trim(),
        email: email.trim(),
        password: password,
        confirmPassword: confirmPassword,
        acceptedTerms: acceptedTerms,
        country: country,
        university: university.trim(),
      );
      if (out.needsVerification) {
        state = state.copyWith(error: null);
        return AuthAttempt(verifyEmail: out.verifyEmail, devCode: out.devCode);
      }
      _applySession(out.session!);
      return const AuthAttempt(signedIn: true);
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return const AuthAttempt();
    }
  }

  /// Verify the 6-digit onboarding code, then sign in. Returns null on success,
  /// or a user-facing error message.
  Future<String?> verifyEmail(
      {required String email, required String code}) async {
    try {
      _applySession(await _repo.verifyEmailOtp(email.trim(), code.trim()));
      return null;
    } catch (e) {
      return _msg(e);
    }
  }

  /// Re-send the verification code. Returns the cooldown seconds (if any) and an
  /// error message (null on success).
  Future<({String? error, int? retryAfter})> resendEmail(String email) async {
    try {
      return (error: null, retryAfter: await _repo.resendEmailOtp(email.trim()));
    } catch (e) {
      return (error: _msg(e), retryAfter: null);
    }
  }

  Future<void> _applySession(AuthResult res) async {
    await SecureStore.writeToken(res.token);
    // The sign-in reply's access token is kept (no /auth/token renewal).
    _api.setToken(res.token, keepAccess: true);
    // Clear any data cached for a previously signed-in account before the new
    // user's screens read these providers.
    resetUserScopedData(ref);
    StudyReminders.userId = res.user.id;
    FlashcardReminders.userId = res.user.id;
    StreakReminders.userId = res.user.id;
    PlanReminders.userId = res.user.id;
    LocalScope.uid = res.user.id;
    // One-request sign-in (step 5): keep what the reply carried BEFORE the
    // signed-in state is set. Setting it rebuilds the first screen at once;
    // seeded first, that rebuild reads these copies instead of asking the
    // server again (it sent /student/progress and /student/dashboard/top).
    final start = res.start;
    if (start != null) {
      final v = (start['contentVersion'] as num?)?.toInt();
      if (v != null) catalogueVersion = v;
      await FlashStore.applyStart(start, res.user.id);
      await seedSaved('progress', await mergeProgress(start['progress']));
      DashboardPrefetch.seed(start['dashboard']);
    }
    state = AuthState(
        isHydrating: false,
        isAuthenticated: true,
        user: res.user,
        token: res.token);
    Push.onAuthenticated(userId: res.user.id, fresh: true);
    // A fresh sign-in skips the start-up reply: fetch the inbox and the
    // announcements from the notice files (no database), then the reminders.
    // Through the container, not this controller's ref: these providers
    // depend on the signed-in user (userScopeProvider -> this controller), and
    // the debug build refuses that as a circular dependency, which stopped
    // sign-in half way (same fix as resetUserScopedData).
    final container = ref.container;
    if (start != null) {
      unawaited(NoticeStore.rememberAccount(res.user.id)
          .then((_) => NoticeStore.applyServer(start))
          .then((_) {
        container.invalidate(notificationsProvider);
        container.invalidate(currentPopupProvider);
      }));
    } else {
      unawaited(NoticeStore.rememberAccount(res.user.id));
      unawaited(NoticeStore.pull(_api).then((_) {
        container.invalidate(notificationsProvider);
        container.invalidate(currentPopupProvider);
      }));
    }
    unawaited(PlanReminders.reconcile(res.user));
  }

  /// Edit profile. Returns null on success, or a user-facing error message.
  Future<String?> updateProfile({
    required String fullName,
    String? avatarKey,
    String? country,
    String? university,
  }) async {
    try {
      final user = await _repo.updateProfile(
        current: state.user,
        fullName: fullName.trim(),
        avatarKey: avatarKey,
        country: country,
        university: university?.trim(),
      );
      state = state.copyWith(user: user);
      return null;
    } catch (e) {
      return _msg(e);
    }
  }

  /// Records that the welcome screen was answered without saving a name.
  ///
  /// A failure here is deliberately swallowed: the screen is a courtesy, and
  /// refusing to let someone past it because a flag-clearing call failed would
  /// trap a brand new student on their first screen. The flag is cleared
  /// locally either way, so this run goes through; a dropped call at worst
  /// means the question is asked once more.
  Future<void> completeProfileSetup() async {
    final current = state.user;
    if (current != null) {
      state = state.copyWith(user: current.copyWith(needsProfileSetup: false));
    }
    try {
      final user = await _repo.completeProfileSetup();
      state = state.copyWith(user: user);
    } catch (_) {
      // Already cleared locally above.
    }
  }

  /// Change password. Returns null on success, or a user-facing error message.
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    try {
      await _repo.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      return null;
    } catch (e) {
      return _msg(e);
    }
  }

  Future<void> logout() async {
    // 10.28: practices still waiting on the phone are sent first.
    await syncPracticesIfOverdue(_api, force: true);
    await _repo.logout();
    await SecureStore.clear();
    _api.setToken(null);
    await StudyReminders.cancelScheduled();
    await FlashcardReminders.cancelScheduled();
    await StreakReminders.cancelScheduled();
    await PlanReminders.cancelScheduled();
    StudyReminders.userId = 'anon';
    FlashcardReminders.userId = 'anon';
    StreakReminders.userId = 'anon';
    PlanReminders.userId = 'anon';
    LocalScope.uid = 'anon';
    resetUserScopedData(ref);
    state = const AuthState(isHydrating: false);
  }

  /// Permanently delete the account, then sign out locally. Returns an error
  /// message on failure; local session is cleared only once the server confirms.
  Future<String?> deleteAccount() async {
    try {
      await _repo.deleteAccount();
    } catch (e) {
      return _msg(e);
    }
    await forgetSavedForAccount(LocalScope.uid); // this account's saved data goes
    await SecureStore.clear();
    _api.setToken(null);
    await StudyReminders.cancelScheduled();
    await FlashcardReminders.cancelScheduled();
    await StreakReminders.cancelScheduled();
    await PlanReminders.cancelScheduled();
    StudyReminders.userId = 'anon';
    FlashcardReminders.userId = 'anon';
    StreakReminders.userId = 'anon';
    PlanReminders.userId = 'anon';
    LocalScope.uid = 'anon';
    resetUserScopedData(ref);
    state = const AuthState(isHydrating: false);
    return null;
  }

  String _msg(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        return m is List ? m.join('\n') : m.toString();
      }
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout) {
        return 'Can\'t reach the server. Check your connection.';
      }
    }
    return 'Something went wrong. Please try again.';
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
