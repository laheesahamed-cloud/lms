/// Which study tools this build ships with.
///
/// These five features are COMPLETE and WORKING — they have real content, no
/// stub code, and they were being actively polished right up to the v1.0
/// submission. They are hidden for the first App Store release only because
/// their content libraries are still thin and we would rather grow them before
/// putting them in front of students, not because anything is broken.
///
/// NOTHING IS DELETED. Every screen, route, repository and asset is still in
/// the binary exactly as it was. These flags only decide whether the entry
/// points are drawn and whether the routes resolve, so bringing a feature back
/// is one word — `false` to `true` — with no re-wiring and no merge pain.
///
/// See mobile/LAUNCH_FEATURE_FLAG.md for the full plan, what was changed, and
/// how to restore.
library;

class LaunchFlags {
  const LaunchFlags._();

  // `final`, not `const`, on purpose: a `const false` makes every guarded
  // branch provably unreachable, so the analyzer fills the project with
  // dead_code warnings and buries the real ones. These are decided at startup
  // instead, which costs nothing and keeps `flutter analyze` honest.
  static final bool osce = false;
  static final bool ecg = false;
  static final bool auscultation = false;
  static final bool drugs = false;
  static final bool myNotes = false;

  /// Route prefixes belonging to features that are switched off.
  ///
  /// The router consults this as well as the navigation hiding each entry
  /// point, because hiding a button does not close a route: restored
  /// navigation state, a notification, a stale deep link or a `push()` left in
  /// some other screen would all still land on a hidden page.
  static List<String> get hiddenRoutePrefixes => [
        if (!osce) '/app/osce',
        if (!ecg) '/app/ecg',
        if (!auscultation) '/app/auscultation',
        if (!drugs) '/app/drugs',
        if (!myNotes) '/app/my-notes',
      ];

  /// Whether [location] belongs to a feature that is switched off.
  static bool isHidden(String location) {
    for (final prefix in hiddenRoutePrefixes) {
      if (location == prefix || location.startsWith('$prefix/')) return true;
    }
    return false;
  }
}
