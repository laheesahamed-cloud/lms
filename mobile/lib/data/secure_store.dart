import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// iOS Keychain / Android EncryptedSharedPreferences token store
/// (the native analog of the web's localStorage session token).
class SecureStore {
  static const _storage = FlutterSecureStorage();
  static const _kToken = 'lms_native_session_token';

  static Future<String?> readToken() => _storage.read(key: _kToken);
  static Future<void> writeToken(String token) =>
      _storage.write(key: _kToken, value: token);
  static Future<void> clear() => _storage.delete(key: _kToken);
}
