import 'package:equatable/equatable.dart';

/// Represents an authenticated resident user aligned with the `users` table.
class UserModel extends Equatable {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final String token;

  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    required this.token,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'role': role,
      'token': token,
    };
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawPhone = json['phone']?.toString().trim();
    return UserModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: (rawPhone == null || rawPhone.isEmpty) ? null : rawPhone,
      role: (json['role'] ?? 'resident').toString(),
      token: (json['token'] ?? '').toString(),
    );
  }

  @override
  List<Object?> get props => [id, name, email, phone, role, token];
}