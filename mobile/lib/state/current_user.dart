import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';

/// Identity key for user-scoped caches. Every user-scoped provider
/// `ref.watch`es this (discarding the value) so that the moment the account
/// changes their cached data is invalidated and recomputed — a different
/// account can never be shown the previous user's data, not even for a frame.
///
/// Keyed on the session **token**, not the user id, deliberately. The id only
/// becomes known once `/auth/me` returns, so during the restore-from-keychain
/// window it is null and then flips — which invalidated every one of these
/// providers a second after launch and made the app refetch everything it had
/// just fetched. The token is known immediately, is equally unique per
/// account, and is equally null when logged out.
final userScopeProvider = Provider<String?>(
    (ref) => ref.watch(authControllerProvider.select((s) => s.token)));
