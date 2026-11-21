import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../data/models/forum_post_model.dart';
import '../../data/models/user_model.dart';
import 'forum_bloc.dart';

/// Displays a full forum post with attached photos, comments, and a reply box.
class ForumPostDetailScreen extends StatefulWidget {
  final int postId;
  final UserModel currentUser;

  const ForumPostDetailScreen({
    super.key,
    required this.postId,
    required this.currentUser,
  });

  @override
  State<ForumPostDetailScreen> createState() => _ForumPostDetailScreenState();
}

class _ForumPostDetailScreenState extends State<ForumPostDetailScreen> {
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _sendComment() {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    FocusScope.of(context).unfocus();
    context.read<ForumBloc>().add(
      ForumCommentAdded(
        postId: widget.postId,
        authorId: widget.currentUser.id,
        authorName: widget.currentUser.name,
        content: text,
      ),
    );
    _commentController.clear();
  }

  void _confirmDelete(int postId) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete Post'),
        content: const Text('Are you sure you want to delete this post?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<ForumBloc>().add(ForumPostDeleted(postId));
              Navigator.of(context).pop();
            },
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return BlocBuilder<ForumBloc, ForumState>(
      builder: (context, state) {
        final ForumPostModel? post = state is ForumLoaded
            ? state.findPostById(widget.postId)
            : null;
        final isSubmitting = state is ForumLoaded && state.isSubmitting;

        if (post == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Discussion')),
            body: const Center(
              child: Text('This post is no longer available.'),
            ),
          );
        }

        final isOwner = post.authorId == widget.currentUser.id;
        final initial = post.authorName.trim().isNotEmpty
            ? post.authorName.trim()[0].toUpperCase()
            : 'R';

        return Scaffold(
          appBar: AppBar(
            title: const Text('Discussion'),
            actions: [
              if (isOwner)
                IconButton(
                  tooltip: 'Delete Post',
                  onPressed: () => _confirmDelete(post.id),
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    color: AppColors.error,
                  ),
                ),
            ],
          ),
          body: Column(
            children: [
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        // 1. Main Post Card
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 20,
                                      backgroundColor: AppColors.primaryLight,
                                      child: Text(
                                        initial,
                                        style: textTheme.titleMedium?.copyWith(
                                          color: AppColors.primaryDark,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            post.authorName,
                                            style: textTheme.titleMedium,
                                          ),
                                          Text(
                                            _formatDate(post.createdAt),
                                            style:
                                            textTheme.labelSmall?.copyWith(
                                              fontWeight: FontWeight.w400,
                                              color: AppColors.textHint,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    _TopicTag(topic: post.topic),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                Text(post.title, style: textTheme.titleLarge),
                                const SizedBox(height: 10),
                                Text(post.content, style: textTheme.bodyLarge),

                                // Attached Photos (full preview, tap to zoom)
                                if (post.photoUrls.isNotEmpty) ...[
                                  const SizedBox(height: 14),
                                  _PostPhotoGrid(photoUrls: post.photoUrls),
                                ],

                                const SizedBox(height: 16),
                                const Divider(
                                  height: 1,
                                  color: AppColors.border,
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    TextButton.icon(
                                      onPressed: () {
                                        context.read<ForumBloc>().add(
                                          ForumPostLikeToggled(post.id),
                                        );
                                      },
                                      icon: Icon(
                                        post.isLikedByMe
                                            ? Icons.favorite_rounded
                                            : Icons.favorite_border_rounded,
                                        size: 20,
                                        color: post.isLikedByMe
                                            ? AppColors.error
                                            : AppColors.textSecondary,
                                      ),
                                      label: Text(
                                        '${post.likeCount} Like(s)',
                                        style: TextStyle(
                                          color: post.isLikedByMe
                                              ? AppColors.error
                                              : AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.chat_bubble_outline_rounded,
                                          size: 18,
                                          color: AppColors.textSecondary,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '${post.comments.length} Comment(s)',
                                          style: textTheme.bodyMedium,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),

                        // 2. Comments Section
                        Text(
                          'Comments (${post.comments.length})',
                          style: textTheme.titleMedium,
                        ),
                        const SizedBox(height: 10),
                        if (post.comments.isEmpty)
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Text(
                                'No comments yet. Be the first to reply!',
                                textAlign: TextAlign.center,
                                style: textTheme.bodyMedium,
                              ),
                            ),
                          )
                        else
                          ...post.comments.map(
                                (comment) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _CommentCard(comment: comment),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),

              // 3. Bottom Comment Composer
              Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: SafeArea(
                  top: false,
                  child: Center(
                    heightFactor: 1,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 720),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _commentController,
                                enabled: !isSubmitting,
                                textInputAction: TextInputAction.send,
                                onSubmitted: (_) => _sendComment(),
                                decoration: const InputDecoration(
                                  hintText: 'Write a comment...',
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 10,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            IconButton(
                              tooltip: 'Send Comment',
                              onPressed: isSubmitting ? null : _sendComment,
                              icon: isSubmitting
                                  ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                                  : const Icon(
                                Icons.send_rounded,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDate(DateTime dt) {
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${dt.year}-$m-$d $hh:$mm';
  }
}

class _PostPhotoGrid extends StatelessWidget {
  final List<String> photoUrls;

  const _PostPhotoGrid({required this.photoUrls});

  @override
  Widget build(BuildContext context) {
    // Show a single wide photo cleanly, or a balanced grid for 2-3 photos
    if (photoUrls.length == 1) {
      return GestureDetector(
        onTap: () {
          PhotoGalleryViewer.open(
            context,
            photoUrls: photoUrls,
            initialIndex: 0,
          );
        },
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: double.infinity,
            height: 210,
            child: TicketNetworkImage(imageUrl: photoUrls.first),
          ),
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: photoUrls.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: photoUrls.length == 2 ? 2 : 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemBuilder: (context, index) {
        return GestureDetector(
          onTap: () {
            PhotoGalleryViewer.open(
              context,
              photoUrls: photoUrls,
              initialIndex: index,
            );
          },
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: TicketNetworkImage(imageUrl: photoUrls[index]),
          ),
        );
      },
    );
  }
}

class _CommentCard extends StatelessWidget {
  final ForumCommentModel comment;

  const _CommentCard({required this.comment});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final initial = comment.authorName.trim().isNotEmpty
        ? comment.authorName.trim()[0].toUpperCase()
        : 'R';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFFE2E8F0),
              child: Text(
                initial,
                style: textTheme.labelSmall?.copyWith(
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        comment.authorName,
                        style: textTheme.titleMedium?.copyWith(fontSize: 14),
                      ),
                      Text(
                        _formatDate(comment.createdAt),
                        style: textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w400,
                          color: AppColors.textHint,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(comment.content, style: textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${dt.year}-$m-$d $hh:$mm';
  }
}

class _TopicTag extends StatelessWidget {
  final String topic;

  const _TopicTag({required this.topic});

  @override
  Widget build(BuildContext context) {
    final (label, color, bg) = switch (topic) {
      'safety' => ('Safety', AppColors.error, const Color(0xFFFEE2E2)),
      'lost_found' => (
      'Lost & Found',
      AppColors.warning,
      const Color(0xFFFEF3C7),
      ),
      'suggestion' => (
      'Suggestion',
      const Color(0xFF2563EB),
      const Color(0xFFDBEAFE),
      ),
      _ => ('General', AppColors.primaryDark, AppColors.primaryLight),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}