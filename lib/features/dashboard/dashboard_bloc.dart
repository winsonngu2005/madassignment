import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/announcement_model.dart';
import '../../data/models/ticket_model.dart';
import '../../data/repositories/ticket_repository.dart';

// ============================================================================
// Events
// ============================================================================
abstract class DashboardEvent extends Equatable {
  const DashboardEvent();

  @override
  List<Object?> get props => [];
}

class DashboardLoadRequested extends DashboardEvent {
  const DashboardLoadRequested();
}

class DashboardRefreshRequested extends DashboardEvent {
  const DashboardRefreshRequested();
}

class DashboardFilterChanged extends DashboardEvent {
  final String filter; // all, active, completed, closed

  const DashboardFilterChanged(this.filter);

  @override
  List<Object?> get props => [filter];
}

// ============================================================================
// States (Initial, Loading, Loaded/Empty, Error)
// ============================================================================
abstract class DashboardState extends Equatable {
  const DashboardState();

  @override
  List<Object?> get props => [];
}

class DashboardInitial extends DashboardState {
  const DashboardInitial();
}

class DashboardLoading extends DashboardState {
  const DashboardLoading();
}

class DashboardLoaded extends DashboardState {
  final List<AnnouncementModel> announcements;
  final List<TicketModel> allTickets;
  final String selectedFilter;

  const DashboardLoaded({
    required this.announcements,
    required this.allTickets,
    this.selectedFilter = 'all',
  });

  /// Filters tickets reactively without triggering another network call.
  List<TicketModel> get filteredTickets {
    switch (selectedFilter) {
      case 'active':
        return allTickets
            .where((t) =>
        t.status == 'pending' ||
            t.status == 'accepted' ||
            t.status == 'in_progress')
            .toList();
      case 'completed':
        return allTickets.where((t) => t.status == 'completed').toList();
      case 'closed':
        return allTickets
            .where((t) => t.status == 'rejected' || t.status == 'cancelled')
            .toList();
      case 'all':
      default:
      // Exclude cancelled tickets from 'All'; they appear under 'Closed' only
        return allTickets
            .where((t) => t.status != 'cancelled')
            .toList();
    }
  }

  DashboardLoaded copyWith({
    List<AnnouncementModel>? announcements,
    List<TicketModel>? allTickets,
    String? selectedFilter,
  }) {
    return DashboardLoaded(
      announcements: announcements ?? this.announcements,
      allTickets: allTickets ?? this.allTickets,
      selectedFilter: selectedFilter ?? this.selectedFilter,
    );
  }

  @override
  List<Object?> get props => [announcements, allTickets, selectedFilter];
}

class DashboardError extends DashboardState {
  final String message;

  const DashboardError(this.message);

  @override
  List<Object?> get props => [message];
}

// ============================================================================
// BLoC
// ============================================================================
class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  final TicketRepository ticketRepository;

  DashboardBloc({required this.ticketRepository})
      : super(const DashboardInitial()) {
    on<DashboardLoadRequested>(_onLoadRequested);
    on<DashboardRefreshRequested>(_onRefreshRequested);
    on<DashboardFilterChanged>(_onFilterChanged);
  }

  Future<void> _onLoadRequested(
      DashboardLoadRequested event,
      Emitter<DashboardState> emit,
      ) async {
    emit(const DashboardLoading());
    await _fetchAndEmit(emit, currentFilter: 'all');
  }

  Future<void> _onRefreshRequested(
      DashboardRefreshRequested event,
      Emitter<DashboardState> emit,
      ) async {
    final currentFilter = state is DashboardLoaded
        ? (state as DashboardLoaded).selectedFilter
        : 'all';
    await _fetchAndEmit(emit, currentFilter: currentFilter);
  }

  void _onFilterChanged(
      DashboardFilterChanged event,
      Emitter<DashboardState> emit,
      ) {
    if (state is DashboardLoaded) {
      emit((state as DashboardLoaded).copyWith(selectedFilter: event.filter));
    }
  }

  Future<void> _fetchAndEmit(
      Emitter<DashboardState> emit, {
        required String currentFilter,
      }) async {
    try {
      final results = await Future.wait([
        ticketRepository.fetchAnnouncements(),
        ticketRepository.fetchMyTickets(),
      ]);

      emit(DashboardLoaded(
        announcements: results[0] as List<AnnouncementModel>,
        allTickets: results[1] as List<TicketModel>,
        selectedFilter: currentFilter,
      ));
    } catch (e) {
      emit(DashboardError(e.toString().replaceFirst('Exception: ', '')));
    }
  }
}