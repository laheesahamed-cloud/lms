/// Minimal user model — parsed defensively from the existing backend.
class AppUser {
  final String id;
  final String fullName;
  final String email;
  final String role;
  final String? plan;
  final String? avatar;

  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.role = 'student',
    this.plan,
    this.avatar,
  });

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
        plan: (j['plan'] ?? j['subscriptionPlan'])?.toString(),
        avatar: j['avatar']?.toString(),
      );
}
