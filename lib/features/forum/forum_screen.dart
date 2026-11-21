import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../core/widgets/primary_button.dart';
import '../../data/models/forum_post_model.dart';
import '../../data/models/user_model.dart';
import 'forum_bloc.dart';
import 'forum_post_detail_screen.dart';

/// Tab 4: Community Forum for residents to post updates, photos, and discussions.
class ForumScreen extends StatefulWidget {
  final UserModel user;

  const ForumScreen({super.key, required this.user});

  @override
  State<ForumScreen> createState() => _ForumScreenState();
}

class _ForumScreenState extends State<ForumScreen> {
  @override
  void initState() {
    super.initState();
    final bloc = context.read<ForumBloc>();
    if (bloc.state is ForumInitial) {
      bloc.add(const ForumLoadRequested());
    }
  }

  Future<void> _handleRefresh() async {
    final bloc = context.read<ForumBloc>();
    bloc.add(const ForumRefreshRequested());
    await bloc.stream.firstWhere(
          (state) => state is ForumLoaded || state is ForumError,
    );
  }

  void _openCreatePost() {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _CreatePostScreen(user: widget.user),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Community Forum'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: _openCreatePost,
              icon: const Icon(Icons.edit_outlined, size: 18),
              label: const Text('New Post'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
      body: BlocConsumer<ForumBloc, ForumState>(
        listenWhen: (previous, current) {
          if (current is! ForumLoaded) return false;
          if (current.feedbackMessage == null) return false;
          if (previous is ForumLoaded) {
            return previous.feedbackTick != current.feedbackTick;
          }
          return true;
        },
        listener: (context, state) {
          if (state is! ForumLoaded || state.feedbackMessage == null) return;
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              SnackBar(
                content: Text(state.feedbackMessage!),
                backgroundColor: state.isErrorFeedback
                    ? AppColors.error
                    : AppColors.success,
              ),
            );
        },
        builder: (context, state) {
          if (state is ForumInitial || state is ForumLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ForumError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.cloud_off_rounded,
                      size: 52,
                      color: AppColors.textHint,
                    ),
                    const SizedBox(height: 12),
                    Text(state.message, style: textTheme.bodyLarge),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        context
                            .read<ForumBloc>()
                            .add(const ForumLoadRequested());
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final loaded = state as ForumLoaded;
          final posts = loaded.filteredPosts;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _handleRefresh,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  // Bottom padding prevents cards from hiding behind the floating pill bar
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Filter by Topic', style: textTheme.titleMedium),
                        Text(
                          '${posts.length} post(s)',
                          style: textTheme.labelSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _TopicFilterBar(
                      selectedTopic: loaded.selectedTopic,
                      onSelected: (topic) {
                        context.read<ForumBloc>().add(ForumTopicChanged(topic));
                      },
                    ),
                    const SizedBox(height: 14),
                    if (posts.isEmpty)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 32,
                          ),
                          child: Column(
                            children: [
                              const Icon(
                                Icons.forum_outlined,
                                size: 44,
                                color: AppColors.textHint,
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'No posts in this topic yet',
                                style: textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Tap "New Post" at the top right to start a discussion.',
                                textAlign: TextAlign.center,
                                style: textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ...posts.map(
                            (post) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _ForumPostCard(
                            post: post,
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ForumPostDetailScreen(
                                    postId: post.id,
                                    currentUser: widget.user,
                                  ),
                                ),
                              );
                            },
                            onLikeTap: () {
                              context
                                  .read<ForumBloc>()
                                  .add(ForumPostLikeToggled(post.id));
                            },
                            onPhotoTap: (photoIndex) {
                              PhotoGalleryViewer.open(
                                context,
                                photoUrls: post.photoUrls,
                                initialIndex: photoIndex,
                              );
                            },
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _TopicFilterBar extends StatelessWidget {
  final String selectedTopic;
  final ValueChanged<String> onSelected;

  const _TopicFilterBar({
    required this.selectedTopic,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final topics = [
      ('all', 'All'),
      ('general', 'General'),
      ('safety', 'Safety'),
      ('lost_found', 'Lost & Found'),
      ('suggestion', 'Suggestion'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: topics.map((item) {
          final isSelected = selectedTopic == item.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(item.$2),
              selected: isSelected,
              selectedColor: AppColors.primaryLight,
              labelStyle: TextStyle(
                color: isSelected
                    ? AppColors.primaryDark
                    : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
              side: BorderSide(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
              onSelected: (_) => onSelected(item.$1),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ForumPostCard extends StatelessWidget {
  final ForumPostModel post;
  final VoidCallback onTap;
  final VoidCallback onLikeTap;
  final ValueChanged<int> onPhotoTap;

  const _ForumPostCard({
    required this.post,
    required this.onTap,
    required this.onLikeTap,
    required this.onPhotoTap,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final initial = post.authorName.trim().isNotEmpty
        ? post.authorName.trim()[0].toUpperCase()
        : 'R';

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Author + Topic Tag
              Row(
                children: [
                  CircleAvatar(
                    radius: 17,
                    backgroundColor: AppColors.primaryLight,
                    child: Text(
                      initial,
                      style: textTheme.labelSmall?.copyWith(
                        color: AppColors.primaryDark,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          post.authorName,
                          style: textTheme.titleMedium?.copyWith(fontSize: 14),
                        ),
                        Text(
                          _formatDate(post.createdAt),
                          style: textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w400,
                            color: AppColors.textHint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _TopicBadge(topic: post.topic),
                ],
              ),
              const SizedBox(height: 12),

              // Title & Content snippet
              Text(
                post.title,
                style: textTheme.titleMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Text(
                post.content,
                style: textTheme.bodyMedium,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),

              // Attached photo strip preview (tap directly to open full gallery)
              if (post.photoUrls.isNotEmpty) ...[
                const SizedBox(height: 12),
                _CardPhotoPreview(
                  photoUrls: post.photoUrls,
                  onPhotoTap: onPhotoTap,
                ),
              ],

              const SizedBox(height: 12),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 8),

              // Bottom interactive bar: Like + Comments count
              Row(
                children: [
                  InkWell(
                    onTap: onLikeTap,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 4,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            post.isLikedByMe
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            size: 18,
                            color: post.isLikedByMe
                                ? AppColors.error
                                : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '${post.likeCount}',
                            style: textTheme.labelSmall?.copyWith(
                              color: post.isLikedByMe
                                  ? AppColors.error
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 18),
                  Row(
                    children: [
                      const Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 17,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${post.comments.length} comment(s)',
                        style: textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
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

class _CardPhotoPreview extends StatelessWidget {
  final List<String> photoUrls;
  final ValueChanged<int> onPhotoTap;

  const _CardPhotoPreview({
    required this.photoUrls,
    required this.onPhotoTap,
  });

  @override
  Widget build(BuildContext context) {
    if (photoUrls.length == 1) {
      return GestureDetector(
        onTap: () => onPhotoTap(0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: double.infinity,
            height: 165,
            child: TicketNetworkImage(imageUrl: photoUrls.first),
          ),
        ),
      );
    }

    return SizedBox(
      height: 112,
      child: Row(
        children: List.generate(photoUrls.length, (index) {
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                right: index == photoUrls.length - 1 ? 0 : 8,
              ),
              child: GestureDetector(
                onTap: () => onPhotoTap(index),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: TicketNetworkImage(imageUrl: photoUrls[index]),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _TopicBadge extends StatelessWidget {
  final String topic;

  const _TopicBadge({required this.topic});

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

// ============================================================================
// Create New Post Screen (Fullscreen Dialog with Photo Picker)
// ============================================================================
class _CreatePostScreen extends StatefulWidget {
  final UserModel user;

  const _CreatePostScreen({required this.user});

  @override
  State<_CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<_CreatePostScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _imagePicker = ImagePicker();
  final List<String> _selectedPhotoPaths = [];
  String _selectedTopic = 'general';

  static const _topics = [
    ('general', 'General'),
    ('safety', 'Safety'),
    ('lost_found', 'Lost & Found'),
    ('suggestion', 'Suggestion'),
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    if (_selectedPhotoPaths.length >= 3) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('You can attach up to 3 photos.')),
        );
      return;
    }

    try {
      final XFile? file = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 75,
      );
      if (file == null || !mounted) return;
      setState(() {
        _selectedPhotoPaths.add(file.path);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text('Unable to open camera or gallery: $e'),
            backgroundColor: AppColors.error,
          ),
        );
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _selectedPhotoPaths.removeAt(index);
    });
  }

  void _publish() {
    if (!_formKey.currentState!.validate()) return;

    FocusScope.of(context).unfocus();
    context.read<ForumBloc>().add(
      ForumPostCreated(
        authorId: widget.user.id,
        authorName: widget.user.name,
        topic: _selectedTopic,
        title: _titleController.text,
        content: _contentController.text,
        photoPaths: List<String>.from(_selectedPhotoPaths),
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Forum Post'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Topic', style: textTheme.titleMedium),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _topics.map((item) {
                            final isSelected = _selectedTopic == item.$1;
                            return ChoiceChip(
                              label: Text(item.$2),
                              selected: isSelected,
                              selectedColor: AppColors.primaryLight,
                              labelStyle: TextStyle(
                                color: isSelected
                                    ? AppColors.primaryDark
                                    : AppColors.textSecondary,
                                fontWeight: isSelected
                                    ? FontWeight.w600
                                    : FontWeight.w500,
                              ),
                              side: BorderSide(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.border,
                              ),
                              onSelected: (_) {
                                setState(() => _selectedTopic = item.$1);
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 18),
                        TextFormField(
                          controller: _titleController,
                          textInputAction: TextInputAction.next,
                          maxLength: 100,
                          decoration: const InputDecoration(
                            labelText: 'Post Title *',
                            hintText: 'e.g. Lost umbrella at Central Hall',
                          ),
                          validator: (value) {
                            if ((value ?? '').trim().isEmpty) {
                              return 'Please enter a title for your post.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _contentController,
                          maxLines: 5,
                          maxLength: 600,
                          decoration: const InputDecoration(
                            labelText: 'Content *',
                            hintText:
                            'Share updates, reminders, or ideas with your neighbours...',
                            alignLabelWithHint: true,
                          ),
                          validator: (value) {
                            if ((value ?? '').trim().isEmpty) {
                              return 'Please write some content before publishing.';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Optional Photos Card (Camera + Gallery, max 3)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Photos (Optional)',
                              style: textTheme.titleMedium,
                            ),
                            Text(
                              '${_selectedPhotoPaths.length} / 3',
                              style: textTheme.labelSmall?.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _pickPhoto(ImageSource.camera),
                                icon: const Icon(Icons.photo_camera_outlined),
                                label: const Text('Take Photo'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () =>
                                    _pickPhoto(ImageSource.gallery),
                                icon: const Icon(Icons.photo_library_outlined),
                                label: const Text('From Gallery'),
                              ),
                            ),
                          ],
                        ),
                        if (_selectedPhotoPaths.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 92,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: _selectedPhotoPaths.length,
                              separatorBuilder: (_, _) =>
                              const SizedBox(width: 10),
                              itemBuilder: (context, index) {
                                final path = _selectedPhotoPaths[index];
                                return Stack(
                                  children: [
                                    GestureDetector(
                                      onTap: () {
                                        PhotoGalleryViewer.open(
                                          context,
                                          photoUrls: _selectedPhotoPaths,
                                          initialIndex: index,
                                        );
                                      },
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(10),
                                        child: Image.file(
                                          File(path),
                                          width: 92,
                                          height: 92,
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    ),
                                    Positioned(
                                      top: 4,
                                      right: 4,
                                      child: GestureDetector(
                                        onTap: () => _removePhoto(index),
                                        child: Container(
                                          padding: const EdgeInsets.all(3),
                                          decoration: const BoxDecoration(
                                            color: Colors.black87,
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(
                                            Icons.close,
                                            size: 14,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                );
                              },
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                PrimaryButton(
                  label: 'Publish Post',
                  icon: Icons.send_rounded,
                  onPressed: _publish,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}