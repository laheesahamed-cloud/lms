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

/// True when the stored name is not something we can greet anyone by.
///
/// Email/password sign-up asks for a name and Google hands one over, so this is
/// really about Apple: it releases the name only on the FIRST authorisation,
/// and with Hide My Email the fallback becomes the relay address's prefix —
/// which is how a new user ends up greeted as "Good morning, ab12xyz".
///
/// Only decides whether the welcome screen PREFILLS its name box. Whether that
/// screen is shown at all is [AppUser.needsProfileSetup], which the server
/// owns — this used to carry the same name and the two were easy to confuse.
bool isPlaceholderName({required String fullName, required String email}) {
  final name = fullName.trim();
  if (name.isEmpty) return true;
  if (name.toLowerCase() == 'student') return true;
  final local = email.contains('@') ? email.split('@').first : email;
  return name.toLowerCase() == local.trim().toLowerCase();
}
