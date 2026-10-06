import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  static const _key = 'seenProfileSetup';

  @override
  bool build() => ref.read(sharedPrefsProvider).getBool(_key) ?? false;

  Future<void> complete() async {
    await ref.read(sharedPrefsProvider).setBool(_key, true);
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
