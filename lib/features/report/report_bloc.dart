import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/ticket_model.dart';
import '../../data/repositories/ticket_repository.dart';

// ============================================================================
// Events
// ============================================================================
abstract class ReportEvent extends Equatable {
  const ReportEvent();

  @override
  List<Object?> get props => [];
}

class ReportSubmitted extends ReportEvent {
  final int residentId;
  final int categoryId;
  final String categoryCode;
  final String categoryName;
  final String title;
  final String description;
  final String locationDesc;
  final double? lat;
  final double? lng;
  final List<String> photoPaths;
  final String priority;

  const ReportSubmitted({
    required this.residentId,
    required this.categoryId,
    required this.categoryCode,
    required this.categoryName,
    required this.title,
    required this.description,
    required this.locationDesc,
    this.lat,
    this.lng,
    required this.photoPaths,
    required this.priority,
  });

  @override
  List<Object?> get props => [
    residentId,
    categoryId,
    categoryCode,
    categoryName,
    title,
    description,
    locationDesc,
    lat,
    lng,
    photoPaths,
    priority,
  ];
}

class ReportReset extends ReportEvent {
  const ReportReset();
}

// ============================================================================
// States
// ============================================================================
abstract class ReportState extends Equatable {
  const ReportState();

  @override
  List<Object?> get props => [];
}

class ReportInitial extends ReportState {
  const ReportInitial();
}

class ReportSubmitting extends ReportState {
  const ReportSubmitting();
}

class ReportSuccess extends ReportState {
  final TicketModel createdTicket;

  const ReportSuccess(this.createdTicket);

  @override
  List<Object?> get props => [createdTicket];
}

class ReportFailure extends ReportState {
  final String message;

  const ReportFailure(this.message);

  @override
  List<Object?> get props => [message];
}

// ============================================================================
// BLoC
// ============================================================================
class ReportBloc extends Bloc<ReportEvent, ReportState> {
  final TicketRepository ticketRepository;

  ReportBloc({required this.ticketRepository}) : super(const ReportInitial()) {
    on<ReportSubmitted>(_onSubmitted);
    on<ReportReset>(_onReset);
  }

  Future<void> _onSubmitted(
      ReportSubmitted event,
      Emitter<ReportState> emit,
      ) async {
    emit(const ReportSubmitting());
    try {
      final ticket = await ticketRepository.submitTicket(
        residentId: event.residentId,
        categoryId: event.categoryId,
        categoryCode: event.categoryCode,
        categoryName: event.categoryName,
        title: event.title,
        description: event.description,
        locationDesc: event.locationDesc,
        lat: event.lat,
        lng: event.lng,
        photoUrls: event.photoPaths,
        priority: event.priority,
      );
      emit(ReportSuccess(ticket));
    } catch (e) {
      emit(ReportFailure(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  void _onReset(ReportReset event, Emitter<ReportState> emit) {
    emit(const ReportInitial());
  }
}