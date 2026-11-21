import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/ticket_model.dart';
import '../../data/models/ticket_rating_model.dart';
import '../../data/models/ticket_status_log_model.dart';
import '../../data/repositories/ticket_repository.dart';

// ============================================================================
// Events
// ============================================================================
abstract class TicketDetailEvent extends Equatable {
  const TicketDetailEvent();

  @override
  List<Object?> get props => [];
}

class TicketDetailLoadRequested extends TicketDetailEvent {
  final int ticketId;

  const TicketDetailLoadRequested(this.ticketId);

  @override
  List<Object?> get props => [ticketId];
}

class TicketCancelRequested extends TicketDetailEvent {
  final int ticketId;
  final String reason;
  final String residentName;

  const TicketCancelRequested({
    required this.ticketId,
    required this.reason,
    required this.residentName,
  });

  @override
  List<Object?> get props => [ticketId, reason, residentName];
}

class TicketRatingSubmitted extends TicketDetailEvent {
  final int ticketId;
  final int residentId;
  final int stars;
  final String? comment;

  const TicketRatingSubmitted({
    required this.ticketId,
    required this.residentId,
    required this.stars,
    this.comment,
  });

  @override
  List<Object?> get props => [ticketId, residentId, stars, comment];
}

// ============================================================================
// States
// ============================================================================
abstract class TicketDetailState extends Equatable {
  const TicketDetailState();

  @override
  List<Object?> get props => [];
}

class TicketDetailLoading extends TicketDetailState {
  const TicketDetailLoading();
}

class TicketDetailLoaded extends TicketDetailState {
  final TicketModel ticket;
  final List<TicketStatusLogModel> logs;
  final TicketRatingModel? rating;
  final bool isSubmittingAction;
  final String? feedbackMessage;
  final bool isErrorFeedback;
  final bool shouldRefreshDashboard;
  final int feedbackTick;

  const TicketDetailLoaded({
    required this.ticket,
    required this.logs,
    this.rating,
    this.isSubmittingAction = false,
    this.feedbackMessage,
    this.isErrorFeedback = false,
    this.shouldRefreshDashboard = false,
    this.feedbackTick = 0,
  });

  TicketDetailLoaded copyWith({
    TicketModel? ticket,
    List<TicketStatusLogModel>? logs,
    TicketRatingModel? rating,
    bool? isSubmittingAction,
    String? feedbackMessage,
    bool? isErrorFeedback,
    bool? shouldRefreshDashboard,
    int? feedbackTick,
  }) {
    return TicketDetailLoaded(
      ticket: ticket ?? this.ticket,
      logs: logs ?? this.logs,
      rating: rating ?? this.rating,
      isSubmittingAction: isSubmittingAction ?? this.isSubmittingAction,
      feedbackMessage: feedbackMessage,
      isErrorFeedback: isErrorFeedback ?? false,
      shouldRefreshDashboard: shouldRefreshDashboard ?? false,
      feedbackTick: feedbackTick ?? this.feedbackTick,
    );
  }

  @override
  List<Object?> get props => [
    ticket,
    logs,
    rating,
    isSubmittingAction,
    feedbackMessage,
    isErrorFeedback,
    shouldRefreshDashboard,
    feedbackTick,
  ];
}

class TicketDetailError extends TicketDetailState {
  final String message;

  const TicketDetailError(this.message);

  @override
  List<Object?> get props => [message];
}

// ============================================================================
// BLoC
// ============================================================================
class TicketDetailBloc extends Bloc<TicketDetailEvent, TicketDetailState> {
  final TicketRepository ticketRepository;

  TicketDetailBloc({required this.ticketRepository})
      : super(const TicketDetailLoading()) {
    on<TicketDetailLoadRequested>(_onLoadRequested);
    on<TicketCancelRequested>(_onCancelRequested);
    on<TicketRatingSubmitted>(_onRatingSubmitted);
  }

  Future<void> _onLoadRequested(
      TicketDetailLoadRequested event,
      Emitter<TicketDetailState> emit,
      ) async {
    emit(const TicketDetailLoading());
    try {
      final bundle = await ticketRepository.fetchTicketDetail(event.ticketId);
      emit(TicketDetailLoaded(
        ticket: bundle.ticket,
        logs: bundle.logs,
        rating: bundle.rating,
      ));
    } catch (e) {
      emit(TicketDetailError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> _onCancelRequested(
      TicketCancelRequested event,
      Emitter<TicketDetailState> emit,
      ) async {
    if (state is! TicketDetailLoaded) return;
    final current = state as TicketDetailLoaded;

    emit(current.copyWith(isSubmittingAction: true));
    try {
      final bundle = await ticketRepository.cancelTicket(
        ticketId: event.ticketId,
        reason: event.reason,
        residentName: event.residentName,
      );
      emit(TicketDetailLoaded(
        ticket: bundle.ticket,
        logs: bundle.logs,
        rating: bundle.rating,
        isSubmittingAction: false,
        feedbackMessage: 'Ticket ${bundle.ticket.ticketNo} has been cancelled.',
        isErrorFeedback: false,
        shouldRefreshDashboard: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        isSubmittingAction: false,
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }

  Future<void> _onRatingSubmitted(
      TicketRatingSubmitted event,
      Emitter<TicketDetailState> emit,
      ) async {
    if (state is! TicketDetailLoaded) return;
    final current = state as TicketDetailLoaded;

    emit(current.copyWith(isSubmittingAction: true));
    try {
      final bundle = await ticketRepository.submitRating(
        ticketId: event.ticketId,
        residentId: event.residentId,
        stars: event.stars,
        comment: event.comment,
      );
      emit(TicketDetailLoaded(
        ticket: bundle.ticket,
        logs: bundle.logs,
        rating: bundle.rating,
        isSubmittingAction: false,
        feedbackMessage: 'Thank you for rating our service!',
        isErrorFeedback: false,
        shouldRefreshDashboard: false,
        feedbackTick: current.feedbackTick + 1,
      ));
    } catch (e) {
      emit(current.copyWith(
        isSubmittingAction: false,
        feedbackMessage: e.toString().replaceFirst('Exception: ', ''),
        isErrorFeedback: true,
        feedbackTick: current.feedbackTick + 1,
      ));
    }
  }
}