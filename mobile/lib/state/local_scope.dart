/// Namespaces on-device, per-user local storage (personal notes & flashcards)
/// so two accounts signed in on the same device never see each other's data.
///
/// Set from [authController] on login / restore / logout, exactly like
/// `StudyReminders.userId`. Storage keys interpolate [uid], so switching
/// accounts switches to that account's isolated bucket.
class LocalScope {
  LocalScope._();

  /// The signed-in user's id, or `'anon'` when logged out.
  static String uid = 'anon';
}
