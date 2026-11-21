import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';

// ============================================================================
// Events
// ============================================================================
abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

class AuthLoginRequested extends AuthEvent {
  final String email;
  final String password;

  const AuthLoginRequested({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [email, password];
}

class AuthRegisterRequested extends AuthEvent {
  final String name;
  final String email;
  final String? phone;
  final String password;

  const AuthRegisterRequested({
    required this.name,
    required this.email,
    this.phone,
    required this.password,
  });

  @override
  List<Object?> get props => [name, email, phone, password];
}

class AuthProfileUpdateRequested extends AuthEvent {
  final String name;
  final String? phone;

  const AuthProfileUpdateRequested({
    required this.name,
    this.phone,
  });

  @override
  List<Object?> get props => [name, phone];
}

class AuthPasswordChangeRequested extends AuthEvent {
  final String currentPassword;
  final String newPassword;

  const AuthPasswordChangeRequested({
    required this.currentPassword,
    required this.newPassword,
  });

  @override
  List<Object?> get props => [currentPassword, newPassword];
}

class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

// ============================================================================
// States
// ============================================================================
abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final UserModel user;
  final bool isUpdating;
  final String? feedbackMessage;
  final bool isErrorFeedback;
  final int feedbackTick;

  const AuthAuthenticated(
      this.user, {
        this.isUpdating = false,
        this.feedbackMessage,
        this.isErrorFeedback = false,
        this.feedbackTick = 0,
      });

  AuthAuthenticated copyWith({
    UserModel? user,
    bool? isUpdating,
    String? feedbackMessage,
    bool? isErrorFeedback,
    int? feedbackTick,
  }) {
    return AuthAuthenticated(
      user ?? this.user,
      isUpdating: isUpdating ?? this.isUpdating,
      feedbackMessage: feedbackMessage,
      isErrorFeedback: isErrorFeedback ?? false,
      feedbackTick: feedbackTick ?? this.feedbackTick,
    );
  }

  @override
  List<Object?> get props => [
    user,
    isUpdating,
    feedbackMessage,
    isErrorFeedback,
    feedbackTick,
  ];
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

// ============================================================================
// BLoC (Connects Events -> Repository -> States)
// ============================================================================
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository authRepository;
  String? _lastEmail;

  /// Exposes the most recently signed-in email so LoginScreen can pre-fill it.
  String? get lastEmail => _lastEmail;

  AuthBloc({required this.authRepository}) : super(const AuthInitial()) {
    on<AuthCheckRequested>(_onCheckRequested);
    on<AuthLoginRequested>(_onLoginRequested);
    on<AuthRegisterRequested>(_onRegisterRequested);
    on<AuthProfileUpdateRequested>(_onProfileUpdateRequested);
    on<AuthPasswordChangeRequested>(_onPasswordChangeRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
  }

  Future<void> _onCheckRequested(
      AuthCheckRequested event,
      Emitter<AuthState> emit,
      ) async {
    _lastEmail = await authRepository.getLastEmail();
    final savedUser = await authRepository.restoreSession();
    if (savedUser != null) {
      _lastEmail = savedUser.email;
      emit(AuthAuthenticated(savedUser));
    } else {
      emit(const AuthUnauthenticated());
    }
  }

  Future<void> _onLoginRequested(
      AuthLoginRequested event,
      Emitter<AuthState> emit,
      ) async {
    emit(const AuthLoading());
    try {
      final user = await authRepository.login(
        email: event.email,
        password: event.password,
      );
      _lastEmail = user.email;
      emit(AuthAuthenticated(user));
    } catch (e) {
      emit(AuthError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> _onRegisterRequested(
      AuthRegisterRequested event,
      Emitter<AuthState> emit,
      ) async {
    emit(const AuthLoading());
    try {
      final user = await authRepository.register(
        name: event.name,
        email: event.email,
        phone: event.phone,
        password: event.password,
      );
      _lastEmail = user.email;
      emit(AuthAuthenticated(user));
    } catch (e) {
      emit(AuthError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> _onProfileUpdateRequested(
      AuthProfileUpdateRequested event,
      Emitter<AuthState> emit,
      ) async {
    if (state is! AuthAuthenticated) return;
    final current = state as AuthAuthenticated;

    emit(current.copyWith(isUpdating: true));
    try {
      final updatedUser = await authRepository.updateProfile(
        userId: current.user.id,
        name: event.name,
        phone: event.phone,
      );
      emit(AuthAuthenticated(
        updatedUser,
        isUpdating: false,
        feedbackMessage: 'Profile updated successfully.',
        isErrorFeedback: false,
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        isUpdating: false,
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }

  Future<void> _onPasswordChangeRequested(
      AuthPasswordChangeRequested event,
      Emitter<AuthState> emit,
      ) async {
    if (state is! AuthAuthenticated) return;
    final current = state as AuthAuthenticated;

    emit(current.copyWith(isUpdating: true));
    try {
      await authRepository.changePassword(
        userId: current.user.id,
        currentPassword: event.currentPassword,
        newPassword: event.newPassword,
      );
      emit(current.copyWith(
        isUpdating: false,
        feedbackMessage: 'Password changed successfully.',
        isErrorFeedback: false,
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        isUpdating: false,
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }

  Future<void> _onLogoutRequested(
      AuthLogoutRequested event,
      Emitter<AuthState> emit,
      ) async {
    await authRepository.logout();
    emit(const AuthUnauthenticated());
  }
}