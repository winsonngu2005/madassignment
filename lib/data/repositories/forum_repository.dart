import '../models/forum_post_model.dart';

/// Handles community forum posts, photos, likes, and comments.
/// Currently uses in-memory mock data; swap with PHP REST API calls later.
class ForumRepository {
  final List<ForumPostModel> _mockPosts = [
    ForumPostModel(
      id: 1,
      authorId: 2,
      authorName: 'Mei Ling',
      topic: 'lost_found',
      title: 'Found a set of car keys near Block B lift',
      content:
      'Picked up a silver keychain with two keys on the ground floor bench around 8:30 AM. I have handed them over to the security guardhouse.',
      photoUrls: const [
        'https://picsum.photos/seed/forum_keys_1/800/600',
        'https://picsum.photos/seed/forum_keys_2/800/600',
      ],
      likeCount: 6,
      isLikedByMe: false,
      createdAt: DateTime(2026, 11, 21, 9, 10),
      comments: [
        ForumCommentModel(
          id: 1,
          postId: 1,
          authorId: 3,
          authorName: 'Daniel Tan',
          content: 'Thanks for handing it to security! Very helpful.',
          createdAt: DateTime(2026, 11, 21, 9, 45),
        ),
      ],
    ),
    ForumPostModel(
      id: 2,
      authorId: 3,
      authorName: 'Daniel Tan',
      topic: 'safety',
      title: 'Slippery walkway after heavy rain',
      content:
      'Heads up everyone, the tiled path between Block A and the car park gets very slippery after rain. Please walk carefully, especially with children.',
      photoUrls: const [
        'https://picsum.photos/seed/forum_walkway_1/800/600',
      ],
      likeCount: 11,
      isLikedByMe: true,
      createdAt: DateTime(2026, 11, 20, 18, 20),
      comments: [
        ForumCommentModel(
          id: 2,
          postId: 2,
          authorId: 4,
          authorName: 'Siti Aishah',
          content:
          'Agreed, maybe we can also submit a facility ticket to request anti-slip strips.',
          createdAt: DateTime(2026, 11, 20, 19, 5),
        ),
      ],
    ),
    ForumPostModel(
      id: 3,
      authorId: 1,
      authorName: 'Winson Resident',
      topic: 'suggestion',
      title: 'Weekend community badminton session?',
      content:
      'Would any neighbours be interested in booking the multipurpose hall on Saturday mornings for a casual badminton group?',
      photoUrls: const [],
      likeCount: 8,
      isLikedByMe: false,
      createdAt: DateTime(2026, 11, 19, 15, 0),
      comments: const [],
    ),
  ];

  int _nextPostId = 4;
  int _nextCommentId = 3;

  /// Simulates GET /api/forum/posts
  Future<List<ForumPostModel>> fetchPosts() async {
    await Future.delayed(const Duration(milliseconds: 350));
    return List<ForumPostModel>.from(_mockPosts);
  }

  /// Simulates POST /api/forum/posts
  Future<List<ForumPostModel>> createPost({
    required int authorId,
    required String authorName,
    required String topic,
    required String title,
    required String content,
    List<String> photoUrls = const [],
  }) async {
    await Future.delayed(const Duration(milliseconds: 450));

    final newPost = ForumPostModel(
      id: _nextPostId++,
      authorId: authorId,
      authorName: authorName,
      topic: topic,
      title: title.trim(),
      content: content.trim(),
      photoUrls: List<String>.from(photoUrls),
      likeCount: 0,
      isLikedByMe: false,
      comments: const [],
      createdAt: DateTime.now(),
    );

    _mockPosts.insert(0, newPost);
    return List<ForumPostModel>.from(_mockPosts);
  }

  /// Simulates POST /api/forum/posts/{id}/like
  Future<List<ForumPostModel>> toggleLike(int postId) async {
    final index = _mockPosts.indexWhere((p) => p.id == postId);
    if (index == -1) {
      throw Exception('Post not found.');
    }

    final post = _mockPosts[index];
    final nextLiked = !post.isLikedByMe;
    final nextCount = nextLiked
        ? post.likeCount + 1
        : (post.likeCount > 0 ? post.likeCount - 1 : 0);

    _mockPosts[index] = post.copyWith(
      isLikedByMe: nextLiked,
      likeCount: nextCount,
    );
    return List<ForumPostModel>.from(_mockPosts);
  }

  /// Simulates POST /api/forum/posts/{id}/comments
  Future<List<ForumPostModel>> addComment({
    required int postId,
    required int authorId,
    required String authorName,
    required String content,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));

    final index = _mockPosts.indexWhere((p) => p.id == postId);
    if (index == -1) {
      throw Exception('Post not found.');
    }

    final post = _mockPosts[index];
    final newComment = ForumCommentModel(
      id: _nextCommentId++,
      postId: postId,
      authorId: authorId,
      authorName: authorName,
      content: content.trim(),
      createdAt: DateTime.now(),
    );

    final updatedComments = List<ForumCommentModel>.from(post.comments)
      ..add(newComment);

    _mockPosts[index] = post.copyWith(comments: updatedComments);
    return List<ForumPostModel>.from(_mockPosts);
  }

  /// Simulates DELETE /api/forum/posts/{id}
  Future<List<ForumPostModel>> deletePost(int postId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    _mockPosts.removeWhere((p) => p.id == postId);
    return List<ForumPostModel>.from(_mockPosts);
  }
}