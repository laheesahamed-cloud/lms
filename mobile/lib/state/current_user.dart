import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';

/// The signed-in user's id (null when logged out). User-scoped data providers
/// `ref.watch` this so that the moment the account changes, their cached value
/// is invalidated and they recompute for the new user — a different account can
/// never be shown the previous user's data, not even for a frame.
final currentUserIdProvider = Provider<String?>(
    (ref) => ref.watch(authControllerProvider.select((s) => s.user?.id)));
