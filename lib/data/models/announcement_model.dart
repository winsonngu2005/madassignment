import 'package:equatable/equatable.dart';

/// Represents a community notice aligned with the `announcements` table.
class AnnouncementModel extends Equatable {
  final int id;
  final String title;
  final String content;
  final DateTime createdAt;

  const AnnouncementModel({
    required this.id,
    required this.title,
    required this.content,
    required this.createdAt,
  });

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    return AnnouncementModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      title: (json['title'] ?? '').toString(),
      content: (json['content'] ?? '').toString(),
      createdAt:
      DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [id, title, content, createdAt];
}