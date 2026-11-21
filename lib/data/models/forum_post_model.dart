import 'package:equatable/equatable.dart';

/// Represents a resident comment under a forum post.
class ForumCommentModel extends Equatable {
  final int id;
  final int postId;
  final int authorId;
  final String authorName;
  final String content;
  final DateTime createdAt;

  const ForumCommentModel({
    required this.id,
    required this.postId,
    required this.authorId,
    required this.authorName,
    required this.content,
    required this.createdAt,
  });

  factory ForumCommentModel.fromJson(Map<String, dynamic> json) {
    return ForumCommentModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      postId: int.tryParse(json['post_id'].toString()) ?? 0,
      authorId: int.tryParse(json['author_id'].toString()) ?? 0,
      authorName: (json['author_name'] ?? 'Resident').toString(),
      content: (json['content'] ?? '').toString(),
      createdAt:
      DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    postId,
    authorId,
    authorName,
    content,
    createdAt,
  ];
}

/// Represents a community forum post published by a resident.
class ForumPostModel extends Equatable {
  final int id;
  final int authorId;
  final String authorName;
  final String topic; // general, safety, lost_found, suggestion
  final String title;
  final String content;
  final List<String> photoUrls;
  final int likeCount;
  final bool isLikedByMe;
  final List<ForumCommentModel> comments;
  final DateTime createdAt;

  const ForumPostModel({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.topic,
    required this.title,
    required this.content,
    this.photoUrls = const [],
    this.likeCount = 0,
    this.isLikedByMe = false,
    this.comments = const [],
    required this.createdAt,
  });

  ForumPostModel copyWith({
    List<String>? photoUrls,
    int? likeCount,
    bool? isLikedByMe,
    List<ForumCommentModel>? comments,
  }) {
    return ForumPostModel(
      id: id,
      authorId: authorId,
      authorName: authorName,
      topic: topic,
      title: title,
      content: content,
      photoUrls: photoUrls ?? this.photoUrls,
      likeCount: likeCount ?? this.likeCount,
      isLikedByMe: isLikedByMe ?? this.isLikedByMe,
      comments: comments ?? this.comments,
      createdAt: createdAt,
    );
  }

  factory ForumPostModel.fromJson(Map<String, dynamic> json) {
    final rawPhotos = json['photo_urls'];
    final List<String> parsedPhotos = [];
    if (rawPhotos is List) {
      for (final item in rawPhotos) {
        parsedPhotos.add(item.toString());
      }
    }

    final rawComments = json['comments'];
    final List<ForumCommentModel> parsedComments = [];
    if (rawComments is List) {
      for (final item in rawComments) {
        if (item is Map<String, dynamic>) {
          parsedComments.add(ForumCommentModel.fromJson(item));
        }
      }
    }

    return ForumPostModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      authorId: int.tryParse(json['author_id'].toString()) ?? 0,
      authorName: (json['author_name'] ?? 'Resident').toString(),
      topic: (json['topic'] ?? 'general').toString(),
      title: (json['title'] ?? '').toString(),
      content: (json['content'] ?? '').toString(),
      photoUrls: parsedPhotos,
      likeCount: int.tryParse((json['like_count'] ?? '0').toString()) ?? 0,
      isLikedByMe:
      json['is_liked_by_me'] == true || json['is_liked_by_me'] == 1,
      comments: parsedComments,
      createdAt:
      DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    authorId,
    authorName,
    topic,
    title,
    content,
    photoUrls,
    likeCount,
    isLikedByMe,
    comments,
    createdAt,
  ];
}