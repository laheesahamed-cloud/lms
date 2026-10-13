/// Minimal user model — parsed defensively from the existing backend.
class AppUser {
  final String id;
  final String fullName;
  final String email;
  final String role;
  final String? plan;
  final String? avatar;
  final String avatarKey;

  /// Whether this ACCOUNT still owes us an answer to "what should we call
  /// you?". Set by the server when an Apple or Google sign-in creates the
  /// account, and cleared the moment the student names themselves or skips.
  ///
  /// It lives on the account rather than in this handset's storage because the
  /// question is about the person, not the phone: answering on one device must
  /// answer it everywhere, and a brand new account on a phone that has seen the
  /// screen before still deserves to be asked.
  final bool needsProfileSetup;

  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.role = 'student',
    this.plan,
    this.avatar,
    this.avatarKey = '',
    this.needsProfileSetup = false,
  });

  AppUser copyWith({
    String? fullName,
    String? avatarKey,
    bool? needsProfileSetup,
  }) =>
      AppUser(
        id: id,
        fullName: fullName ?? this.fullName,
        email: email,
        role: role,
        plan: plan,
        avatar: avatar,
        avatarKey: avatarKey ?? this.avatarKey,
        needsProfileSetup: needsProfileSetup ?? this.needsProfileSetup,
      );

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) {
      return email.isNotEmpty ? email[0].toUpperCase() : '?';
    }
    final first = parts.first[0];
    final last = parts.length > 1 ? parts.last[0] : '';
    return (first + last).toUpperCase();
  }

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: '${j['id'] ?? j['_id'] ?? ''}',
        fullName: (j['fullName'] ?? j['name'] ?? '').toString(),
        email: (j['email'] ?? '').toString(),
        role: (j['role'] ?? 'student').toString(),
        plan: (j['plan'] ?? j['subscriptionPlan'] ?? j['currentPlanName'])
            ?.toString(),
        avatar: j['avatar']?.toString(),
        avatarKey: (j['avatarKey'] ?? j['avatar_key'] ?? '').toString(),
        // Absent on an older backend, which must read as "nothing to ask" —
        // defaulting the other way would show the welcome screen to every
        // signed-in student the first time they opened a newer app build.
        needsProfileSetup:
            j['needsProfileSetup'] == true || j['needs_profile_setup'] == 1,
      );
}
