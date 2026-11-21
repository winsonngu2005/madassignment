import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../data/models/user_model.dart';

typedef StringMap = Map<String, String>;

/// Persists login session, last used email, and local mock accounts.
class SessionStorage {
  static const String _keyCurrentUser = 'auth_current_user';
  static const String _keyLastEmail = 'auth_last_email';
  static const String _keyMockUsers = 'auth_mock_users_v1';

  Future<void> saveCurrentUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyCurrentUser, jsonEncode(user.toJson()));
    await prefs.setString(_keyLastEmail, user.email);
  }

  Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyCurrentUser);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return UserModel.fromJson(decoded);
      }
    } catch (_) {
      // Ignore corrupted local session and fall back to LoginScreen
    }
    return null;
  }

  Future<void> clearCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyCurrentUser);
  }

  Future<String?> getLastEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyLastEmail);
  }

  Future<void> saveMockUsers(List<StringMap> users) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyMockUsers, jsonEncode(users));
  }

  Future<List<StringMap>?> getMockUsers() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyMockUsers);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        final List<StringMap> parsed = [];
        for (final item in decoded) {
          if (item is Map) {
            final StringMap row = {};
            item.forEach((key, value) {
              row[key.toString()] = (value ?? '').toString();
            });
            parsed.add(row);
          }
        }
        return parsed;
      }
    } catch (_) {
      return null;
    }
    return null;
  }
}