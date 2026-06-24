import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

/// Public auth settings read LIVE from the server (`GET /settings/public`) —
/// the same source the website uses. Keeps the web/server Google client id
/// server-driven, so it can change without rebuilding the app.
class PublicAuthSettings {
  final String googleClientId; // web / server client id (the token audience)
  final bool googleConfigured;
  const PublicAuthSettings(this.googleClientId, this.googleConfigured);

  static const empty = PublicAuthSettings('', false);
}

final publicAuthSettingsProvider =
    FutureProvider<PublicAuthSettings>((ref) async {
  final api = ref.read(apiClientProvider);
  try {
    final res = await api.dio.get('/settings/public');
    final data = res.data;
    final auth = (data is Map && data['auth'] is Map)
        ? Map<String, dynamic>.from(data['auth'] as Map)
        : const <String, dynamic>{};
    final id = (auth['googleClientId'] ?? '').toString();
    final configured = (auth['googleConfigured'] == true) && id.isNotEmpty;
    return PublicAuthSettings(id, configured);
  } catch (_) {
    return PublicAuthSettings.empty;
  }
});
