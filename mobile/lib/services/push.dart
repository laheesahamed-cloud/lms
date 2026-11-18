import 'dart:io' show Platform;
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../data/api_client.dart';

/// APNs registration → sends the device token to the LMS `/push/native-token`
/// endpoint (same pipeline the web Capacitor app uses). The native side
/// (AppDelegate) registers with APNs and pushes the token over this channel.
class Push {
  static const _channel = MethodChannel('app.xyndrome.lk/push');
  static String? _token;
  static ApiClient? _api;
  static bool _synced = false;
  static String? _userId;
  static bool _fresh = false; // a new sign-in: always sent once
  static const _sentKey = 'xyndrome.push.sent'; // "userId:token" last sent

  static void init(ApiClient api) {
    if (!Platform.isIOS) return;
    _api = api;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'apnsToken' && call.arguments is String) {
        _token = call.arguments as String;
        _synced = false;
        await sync();
      }
      return null;
    });
    // Pull a token that may have been captured before this handler was set.
    _channel.invokeMethod<String>('getApnsToken').then((t) {
      if (t != null && t.isNotEmpty) {
        _token = t;
        sync();
      }
    }).catchError((_) {});
  }

  /// Ask iOS for notification permission and (if granted) register with APNs.
  /// Called on demand when the user opts in via the priming sheet — never at
  /// launch. Returns whether permission was granted.
  static Future<bool> requestAuthorization() async {
    if (!Platform.isIOS) return false;
    try {
      final granted = await _channel.invokeMethod<bool>('requestAuthorization');
      return granted ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Call after a successful login ([fresh]) / session restore.
  static void onAuthenticated({required String userId, bool fresh = false}) {
    _userId = userId;
    _fresh = fresh;
    _synced = false;
    sync();
  }

  /// POST the token once we have both a token and an authenticated session —
  /// OPTIMIZE 10.19: only when the token or the account changed since it was
  /// last sent (or after a new sign-in), not on every app start.
  static Future<void> sync() async {
    final api = _api;
    final token = _token;
    if (api == null || token == null || token.isEmpty || _synced) return;
    final key = '${_userId ?? ''}:$token';
    final sp = await SharedPreferences.getInstance();
    if (!_fresh && sp.getString(_sentKey) == key) {
      _synced = true;
      return;
    }
    try {
      await api.dio.post('/push/native-token', data: {
        'token': token,
        'platform': 'ios',
        'deliveryMode': 'outside',
      });
      _synced = true;
      _fresh = false;
      await sp.setString(_sentKey, key);
    } catch (_) {
      // Not authenticated yet (401) or offline — retried on next auth.
    }
  }
}
