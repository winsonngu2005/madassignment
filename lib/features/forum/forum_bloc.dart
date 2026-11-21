import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/forum_post_model.dart';
import '../../data/repositories/forum_repository.dart';

// ============================================================================
// Events
// ============================================================================
abstract class ForumEvent extends Equatable {
  const ForumEvent();

  @override
  List<Object?> get props => [];
}

class ForumLoadRequested extends ForumEvent {
  const ForumLoadRequested();
}

class ForumRefreshRequested extends ForumEvent {
  const ForumRefreshRequested();
}

class ForumTopicChanged extends ForumEvent {
  final String topic; // all, general, safety, lost_found, suggestion

  const ForumTopicChanged(this.topic);

  @override
  List<Object?> get props => [topic];
}

class ForumPostCreated extends ForumEvent {
  final int authorId;
  final String authorName;
  final String topic;
  final String title;
  final String content;
  final List<String> photoPaths;

  const ForumPostCreated({
    required this.authorId,
    required this.authorName,
    required this.topic,
    required this.title,
    required this.content,
    this.photoPaths = const [],
  });

  @override
  List<Object?> get props => [
    authorId,
    authorName,
    topic,
    title,
    content,
    photoPaths,
  ];
}

class ForumPostLikeToggled extends ForumEvent {
  final int postId;

  const ForumPostLikeToggled(this.postId);

  @override
  List<Object?> get props => [postId];
}

class ForumCommentAdded extends ForumEvent {
  final int postId;
  final int authorId;
  final String authorName;
  final String content;

  const ForumCommentAdded({
    required this.postId,
    required this.authorId,
    required this.authorName,
    required this.content,
  });

  @override
  List<Object?> get props => [postId, authorId, authorName, content];
}

class ForumPostDeleted extends ForumEvent {
  final int postId;

  const ForumPostDeleted(this.postId);

  @override
  List<Object?> get props => [postId];
}

// ============================================================================
// States
// ============================================================================
abstract class ForumState extends Equatable {
  const ForumState();

  @override
  List<Object?> get props => [];
}

class ForumInitial extends ForumState {
  const ForumInitial();
}

class ForumLoading extends ForumState {
  const ForumLoading();
}

class ForumLoaded extends ForumState {
  final List<ForumPostModel> allPosts;
  final String selectedTopic;
  final bool isSubmitting;
  final String? feedbackMessage;
  final bool isErrorFeedback;
  final int feedbackTick;

  const ForumLoaded({
    required this.allPosts,
    this.selectedTopic = 'all',
    this.isSubmitting = false,
    this.feedbackMessage,
    this.isErrorFeedback = false,
    this.feedbackTick = 0,
  });

  List<ForumPostModel> get filteredPosts {
    if (selectedTopic == 'all') return allPosts;
    return allPosts.where((p) => p.topic == selectedTopic).toList();
  }

  ForumPostModel? findPostById(int postId) {
    for (final post in allPosts) {
      if (post.id == postId) return post;
    }
    return null;
  }

  ForumLoaded copyWith({
    List<ForumPostModel>? allPosts,
    String? selectedTopic,
    bool? isSubmitting,
    String? feedbackMessage,
    bool? isErrorFeedback,
    int? feedbackTick,
  }) {
    return ForumLoaded(
      allPosts: allPosts ?? this.allPosts,
      selectedTopic: selectedTopic ?? this.selectedTopic,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      feedbackMessage: feedbackMessage,
      isErrorFeedback: isErrorFeedback ?? false,
      feedbackTick: feedbackTick ?? this.feedbackTick,
    );
  }

  @override
  List<Object?> get props => [
    allPosts,
    selectedTopic,
    isSubmitting,
    feedbackMessage,
    isErrorFeedback,
    feedbackTick,
  ];
}

class ForumError extends ForumState {
  final String message;

  const ForumError(this.message);

  @override
  List<Object?> get props => [message];
}

// ============================================================================
// BLoC
// ============================================================================
class ForumBloc extends Bloc<ForumEvent, ForumState> {
  final ForumRepository forumRepository;

  ForumBloc({required this.forumRepository}) : super(const ForumInitial()) {
    on<ForumLoadRequested>(_onLoadRequested);
    on<ForumRefreshRequested>(_onRefreshRequested);
    on<ForumTopicChanged>(_onTopicChanged);
    on<ForumPostCreated>(_onPostCreated);
    on<ForumPostLikeToggled>(_onLikeToggled);
    on<ForumCommentAdded>(_onCommentAdded);
    on<ForumPostDeleted>(_onPostDeleted);
  }

  Future<void> _onLoadRequested(
      ForumLoadRequested event,
      Emitter<ForumState> emit,
      ) async {
    emit(const ForumLoading());
    try {
      final posts = await forumRepository.fetchPosts();
      emit(ForumLoaded(allPosts: posts));
    } catch (e) {
      emit(ForumError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> _onRefreshRequested(
      ForumRefreshRequested event,
      Emitter<ForumState> emit,
      ) async {
    final currentTopic = state is ForumLoaded
        ? (state as ForumLoaded).selectedTopic
        : 'all';
    try {
      final posts = await forumRepository.fetchPosts();
      emit(ForumLoaded(allPosts: posts, selectedTopic: currentTopic));
    } catch (e) {
      emit(ForumError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  void _onTopicChanged(
      ForumTopicChanged event,
      Emitter<ForumState> emit,
      ) {
    if (state is ForumLoaded) {
      emit((state as ForumLoaded).copyWith(selectedTopic: event.topic));
    }
  }

  Future<void> _onPostCreated(
      ForumPostCreated event,
      Emitter<ForumState> emit,
      ) async {
    if (state is! ForumLoaded) return;
    final current = state as ForumLoaded;
    emit(current.copyWith(isSubmitting: true));

    try {
      final updatedPosts = await forumRepository.createPost(
        authorId: event.authorId,
        authorName: event.authorName,
        topic: event.topic,
        title: event.title,
        content: event.content,
        photoUrls: event.photoPaths,
      );
      emit(ForumLoaded(
        allPosts: updatedPosts,
        selectedTopic: 'all',
        isSubmitting: false,
        feedbackMessage: 'Post published to the community forum!',
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        isSubmitting: false,
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }

  Future<void> _onLikeToggled(
      ForumPostLikeToggled event,
      Emitter<ForumState> emit,
      ) async {
    if (state is! ForumLoaded) return;
    final current = state as ForumLoaded;

    try {
      final updatedPosts = await forumRepository.toggleLike(event.postId);
      emit(current.copyWith(allPosts: updatedPosts));
    } catch (e) {
      emit(current.copyWith(
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }

  Future<void> _onCommentAdded(
      ForumCommentAdded event,
      Emitter<ForumState> emit,
      ) async {
    if (state is! ForumLoaded) return;
    final current = state as ForumLoaded;
    emit(current.copyWith(isSubmitting: true));

    try {
      final updatedPosts = await forumRepository.addComment(
        postId: event.postId,
        authorId: event.authorId,
        authorName: event.authorName,
        content: event.content,
      );
      emit(current.copyWith(
        allPosts: updatedPosts,
        isSubmitting: false,
        feedbackMessage: 'Comment posted.',
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        isSubmitting: false,
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }

  Future<void> _onPostDeleted(
      ForumPostDeleted event,
      Emitter<ForumState> emit,
      ) async {
    if (state is! ForumLoaded) return;
    final current = state as ForumLoaded;

    try {
      final updatedPosts = await forumRepository.deletePost(event.postId);
      emit(current.copyWith(
        allPosts: updatedPosts,
        feedbackMessage: 'Post deleted.',
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }
}