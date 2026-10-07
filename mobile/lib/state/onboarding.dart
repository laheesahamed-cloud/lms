import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_controller.dart';

/// Provided by an override in main() after prefs load.
final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPrefsProvider must be overridden'),
);

/// First-run welcome flag (§5.5) — onboarding shown only once.
class OnboardingController extends Notifier<bool> {
  static const _key = 'seenOnboarding';

  @override
  bool build() => ref.read(sharedPrefsProvider).getBool(_key) ?? false;

  Future<void> complete() async {
    await ref.read(sharedPrefsProvider).setBool(_key, true);
    state = true;
  }
}

final onboardingSeenProvider =
    NotifierProvider<OnboardingController, bool>(OnboardingController.new);

/// Whether the "Hi, future doctor" profile-setup screen has already been
/// offered on this device.
///
/// Device-local rather than a column on the user: it only decides whether to
/// ask once, and a reinstall asking a second time is a far smaller cost than a
/// migration and a deploy. Skipping counts as answered — the screen is a
/// courtesy, not a gate.
class ProfileSetupController extends Notifier<bool> {
  /// Keyed by user, not by device. Device-wide, signing out and in as somebody
  /// else left the first account's answer standing — so a genuinely new user on
  /// a phone that had already shown the screen was never welcomed. A new
  /// account is a new person, whatever handset they are holding.
  static String _key(String uid) => 'seenProfileSetup:$uid';

  @override
  bool build() {
    final uid = ref.watch(authControllerProvider).user?.id ?? '';
    // Nobody signed in yet: nothing to ask, and saying "not seen" here would
    // send the router at the screen before there is a user to set up.
    if (uid.isEmpty) return true;
    return ref.read(sharedPrefsProvider).getBool(_key(uid)) ?? false;
  }

  Future<void> complete() async {
    final uid = ref.read(authControllerProvider).user?.id ?? '';
    if (uid.isEmpty) return;
    await ref.read(sharedPrefsProvider).setBool(_key(uid), true);
    state = true;
  }
}

final profileSetupSeenProvider =
    NotifierProvider<ProfileSetupController, bool>(ProfileSetupController.new);

/// True when the stored name is not something we can greet anyone by.
///
/// Email/password sign-up asks for a name and Google hands one over, so this is
/// really about Apple: it releases the name only on the FIRST authorisation,
/// and with Hide My Email the fallback becomes the relay address's prefix —
/// which is how a new user ends up greeted as "Good morning, ab12xyz".
bool needsProfileSetup({required String fullName, required String email}) {
  final name = fullName.trim();
  if (name.isEmpty) return true;
  if (name.toLowerCase() == 'student') return true;
  final local = email.contains('@') ? email.split('@').first : email;
  return name.toLowerCase() == local.trim().toLowerCase();
}
