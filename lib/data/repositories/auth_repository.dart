import '../../core/storage/session_storage.dart';
import '../models/user_model.dart';

/// Handles authentication, profile updates, and local session persistence.
/// Swap the mock lookups with PHP HTTP calls in Route A while keeping SessionStorage.
class AuthRepository {
  final SessionStorage sessionStorage;

  AuthRepository({required this.sessionStorage});

  final List<StringMap> _defaultUsers = [
    {
      'id': '1',
      'name': 'Winson Resident',
      'email': 'resident@uts.edu.my',
      'phone': '+60123456789',
      'password': 'password123',
      'role': 'resident',
    },
  ];

  Future<List<StringMap>> _loadUsers() async {
    final saved = await sessionStorage.getMockUsers();
    if (saved != null && saved.isNotEmpty) {
      return saved;
    }
    final initial = _defaultUsers.map((u) => StringMap.from(u)).toList();
    await sessionStorage.saveMockUsers(initial);
    return initial;
  }

  Future<UserModel?> restoreSession() {
    return sessionStorage.getCurrentUser();
  }

  Future<String?> getLastEmail() {
    return sessionStorage.getLastEmail();
  }

  Future<void> logout() {
    return sessionStorage.clearCurrentUser();
  }

  /// Simulates POST /api/login
  Future<UserModel> login({
    required String email,
    required String password,
  }) async {
    await Future.delayed(const Duration(milliseconds: 600));

    final users = await _loadUsers();
    final normalizedEmail = email.trim().toLowerCase();
    final match = users.where(
          (u) =>
      u['email']!.toLowerCase() == normalizedEmail &&
          u['password'] == password,
    );

    if (match.isEmpty) {
      throw Exception('Invalid email or password.');
    }

    final userRow = match.first;
    final user = UserModel(
      id: int.parse(userRow['id']!),
      name: userRow['name']!,
      email: userRow['email']!,
      phone: userRow['phone']!.isEmpty ? null : userRow['phone'],
      role: userRow['role']!,
      token: 'mock_jwt_token_user_${userRow['id']}',
    );

    await sessionStorage.saveCurrentUser(user);
    return user;
  }

  /// Simulates POST /api/register
  Future<UserModel> register({
    required String name,
    required String email,
    String? phone,
    required String password,
  }) async {
    await Future.delayed(const Duration(milliseconds: 700));

    final users = await _loadUsers();
    final normalizedEmail = email.trim().toLowerCase();
    final exists = users.any(
          (u) => u['email']!.toLowerCase() == normalizedEmail,
    );

    if (exists) {
      throw Exception('This email is already registered.');
    }

    final newId = users.length + 1;
    final StringMap newUserRow = {
      'id': newId.toString(),
      'name': name.trim(),
      'email': normalizedEmail,
      'phone': (phone ?? '').trim(),
      'password': password,
      'role': 'resident',
    };
    users.add(newUserRow);
    await sessionStorage.saveMockUsers(users);

    final user = UserModel(
      id: newId,
      name: newUserRow['name']!,
      email: newUserRow['email']!,
      phone: newUserRow['phone']!.isEmpty ? null : newUserRow['phone'],
      role: 'resident',
      token: 'mock_jwt_token_user_$newId',
    );

    await sessionStorage.saveCurrentUser(user);
    return user;
  }

  /// Simulates PATCH /api/profile
  Future<UserModel> updateProfile({
    required int userId,
    required String name,
    String? phone,
  }) async {
    await Future.delayed(const Duration(milliseconds: 450));

    final users = await _loadUsers();
    final index = users.indexWhere((u) => u['id'] == userId.toString());
    if (index == -1) {
      throw Exception('Account not found.');
    }

    users[index]['name'] = name.trim();
    users[index]['phone'] = (phone ?? '').trim();
    await sessionStorage.saveMockUsers(users);

    final userRow = users[index];
    final updatedUser = UserModel(
      id: int.parse(userRow['id']!),
      name: userRow['name']!,
      email: userRow['email']!,
      phone: userRow['phone']!.isEmpty ? null : userRow['phone'],
      role: userRow['role']!,
      token: 'mock_jwt_token_user_${userRow['id']}',
    );

    await sessionStorage.saveCurrentUser(updatedUser);
    return updatedUser;
  }

  /// Simulates PATCH /api/profile/password
  Future<void> changePassword({
    required int userId,
    required String currentPassword,
    required String newPassword,
  }) async {
    await Future.delayed(const Duration(milliseconds: 500));

    final users = await _loadUsers();
    final index = users.indexWhere((u) => u['id'] == userId.toString());
    if (index == -1) {
      throw Exception('Account not found.');
    }

    if (users[index]['password'] != currentPassword) {
      throw Exception('Current password is incorrect.');
    }

    if (currentPassword == newPassword) {
      throw Exception('New password must be different from current password.');
    }

    users[index]['password'] = newPassword;
    await sessionStorage.saveMockUsers(users);
  }
}