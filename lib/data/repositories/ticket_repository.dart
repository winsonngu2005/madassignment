import '../../core/storage/local_database_service.dart';
import '../models/announcement_model.dart';
import '../models/ticket_model.dart';
import '../models/ticket_rating_model.dart';
import '../models/ticket_status_log_model.dart';

/// Bundles a ticket with its status timeline logs and optional rating.
class TicketDetailBundle {
  final TicketModel ticket;
  final List<TicketStatusLogModel> logs;
  final TicketRatingModel? rating;

  const TicketDetailBundle({
    required this.ticket,
    required this.logs,
    this.rating,
  });
}

/// Handles ticket, timeline log, rating, and announcement data backed by SQLite.
class TicketRepository {
  final LocalDatabaseService localDb;
  bool _seededChecked = false;

  TicketRepository({required this.localDb});

  final List<AnnouncementModel> _mockAnnouncements = [
    AnnouncementModel(
      id: 1,
      title: 'Scheduled Water Maintenance',
      content:
      'Water supply in Block A will be paused on Sunday from 09:00 to 12:00 for pipe inspection. Please store enough water in advance.',
      createdAt: DateTime(2026, 11, 20, 9, 0),
    ),
    AnnouncementModel(
      id: 2,
      title: 'Management Office Hours',
      content:
      'The community service counter is open Monday to Friday, 09:00 to 17:00. Emergency maintenance lines remain available 24/7.',
      createdAt: DateTime(2026, 11, 18, 10, 30),
    ),
    AnnouncementModel(
      id: 3,
      title: 'Community Recycling Drive',
      content:
      'Bring clean cardboard, glass, and e-waste to the Central Hall drop-off point this Saturday between 08:30 and 13:00.',
      createdAt: DateTime(2026, 11, 15, 11, 0),
    ),
  ];

  /// Seeds initial demo tickets and status logs into SQLite only on first launch.
  Future<void> _ensureSeeded() async {
    if (_seededChecked) return;
    final hasData = await localDb.hasAnyTickets();
    if (!hasData) {
      final seedTickets = [
        TicketModel(
          id: 101,
          ticketNo: 'CS-20261121-0001',
          residentId: 1,
          categoryId: 1,
          categoryCode: 'lighting',
          categoryName: 'Lighting',
          title: 'Corridor light out for three nights',
          description:
          'The ceiling light near the staircase on Level 3 does not turn on after 7 PM. The stairwell becomes very dark at night.',
          locationDesc: 'Block A, Level 3, end of corridor',
          lat: 2.341400,
          lng: 111.842500,
          photoUrls: const [
            'https://picsum.photos/seed/corridor_light_1/800/600',
            'https://picsum.photos/seed/corridor_light_2/800/600',
            'https://picsum.photos/seed/corridor_light_3/800/600',
          ],
          status: 'pending',
          priority: 'normal',
          createdAt: DateTime(2026, 11, 21, 8, 15),
        ),
        TicketModel(
          id: 102,
          ticketNo: 'CS-20261119-0004',
          residentId: 1,
          categoryId: 2,
          categoryCode: 'garbage',
          categoryName: 'Garbage Collection',
          title: 'Overflowing recycling bins',
          description:
          'Cardboard boxes and plastic bags have piled up outside the bin enclosure.',
          locationDesc: 'Block B, Ground Floor, east bin bay',
          photoUrls: const [
            'https://picsum.photos/seed/recycling_bins_1/800/600',
          ],
          status: 'in_progress',
          priority: 'urgent',
          createdAt: DateTime(2026, 11, 19, 14, 40),
          dueAt: DateTime(2026, 11, 21, 14, 40),
        ),
        TicketModel(
          id: 103,
          ticketNo: 'CS-20261117-0002',
          residentId: 1,
          categoryId: 3,
          categoryCode: 'facility',
          categoryName: 'Public Facility',
          title: 'Loose handrail on playground steps',
          description: '',
          locationDesc: 'Central Playground, north entrance steps',
          photoUrls: const [],
          status: 'accepted',
          priority: 'normal',
          createdAt: DateTime(2026, 11, 17, 17, 20),
        ),
        TicketModel(
          id: 104,
          ticketNo: 'CS-20261112-0003',
          residentId: 1,
          categoryId: 4,
          categoryCode: 'noise',
          categoryName: 'Noise Disturbance',
          title: 'Late-night generator vibration noise',
          description:
          'Persistent humming sound coming from the utility room after 11 PM.',
          locationDesc: 'Block C, Level 1, near utility room',
          photoUrls: const [
            'https://picsum.photos/seed/generator_room_1/800/600',
            'https://picsum.photos/seed/generator_room_2/800/600',
          ],
          status: 'completed',
          priority: 'low',
          createdAt: DateTime(2026, 11, 12, 23, 5),
        ),
      ];

      for (final ticket in seedTickets) {
        await localDb.upsertTicket(ticket);
      }

      final seedLogs = [
        TicketStatusLogModel(
          id: 1,
          ticketId: 101,
          fromStatus: null,
          toStatus: 'pending',
          actorName: 'Winson Resident',
          note: 'Ticket submitted by resident.',
          createdAt: DateTime(2026, 11, 21, 8, 15),
        ),
        TicketStatusLogModel(
          id: 2,
          ticketId: 102,
          fromStatus: null,
          toStatus: 'pending',
          actorName: 'Winson Resident',
          note: 'Ticket submitted by resident.',
          createdAt: DateTime(2026, 11, 19, 14, 40),
        ),
        TicketStatusLogModel(
          id: 3,
          ticketId: 102,
          fromStatus: 'pending',
          toStatus: 'accepted',
          actorName: 'Community Admin',
          note: 'Verified and assigned to sanitation crew.',
          createdAt: DateTime(2026, 11, 19, 16, 10),
        ),
        TicketStatusLogModel(
          id: 4,
          ticketId: 102,
          fromStatus: 'accepted',
          toStatus: 'in_progress',
          actorName: 'Sanitation Team A',
          note: 'Crew arrived on site to clear overflow and replace bin liners.',
          createdAt: DateTime(2026, 11, 20, 9, 25),
        ),
        TicketStatusLogModel(
          id: 5,
          ticketId: 103,
          fromStatus: null,
          toStatus: 'pending',
          actorName: 'Winson Resident',
          note: 'Ticket submitted by resident.',
          createdAt: DateTime(2026, 11, 17, 17, 20),
        ),
        TicketStatusLogModel(
          id: 6,
          ticketId: 103,
          fromStatus: 'pending',
          toStatus: 'accepted',
          actorName: 'Community Admin',
          note: 'Scheduled for facilities technician inspection.',
          createdAt: DateTime(2026, 11, 18, 10, 0),
        ),
        TicketStatusLogModel(
          id: 7,
          ticketId: 104,
          fromStatus: null,
          toStatus: 'pending',
          actorName: 'Winson Resident',
          note: 'Ticket submitted by resident.',
          createdAt: DateTime(2026, 11, 12, 23, 5),
        ),
        TicketStatusLogModel(
          id: 8,
          ticketId: 104,
          fromStatus: 'pending',
          toStatus: 'accepted',
          actorName: 'Community Admin',
          note: 'Escalated to building electrical engineering team.',
          createdAt: DateTime(2026, 11, 13, 8, 45),
        ),
        TicketStatusLogModel(
          id: 9,
          ticketId: 104,
          fromStatus: 'accepted',
          toStatus: 'in_progress',
          actorName: 'Technician Lim',
          note: 'Inspecting generator rubber mounts and acoustic padding.',
          createdAt: DateTime(2026, 11, 13, 14, 15),
        ),
        TicketStatusLogModel(
          id: 10,
          ticketId: 104,
          fromStatus: 'in_progress',
          toStatus: 'completed',
          actorName: 'Technician Lim',
          note: 'Replaced worn anti-vibration pads and tested noise level.',
          createdAt: DateTime(2026, 11, 14, 11, 30),
        ),
      ];

      for (final log in seedLogs) {
        await localDb.insertLog(log);
      }
    }
    _seededChecked = true;
  }

  /// Simulates GET /api/announcements
  Future<List<AnnouncementModel>> fetchAnnouncements() async {
    await Future.delayed(const Duration(milliseconds: 250));
    return List<AnnouncementModel>.from(_mockAnnouncements);
  }

  /// Loads resident's tickets from local SQLite database.
  Future<List<TicketModel>> fetchMyTickets() async {
    await _ensureSeeded();
    return localDb.getAllTickets();
  }

  /// Loads ticket, timeline logs, and optional rating from SQLite.
  Future<TicketDetailBundle> fetchTicketDetail(int ticketId) async {
    await _ensureSeeded();
    final ticket = await localDb.getTicketById(ticketId);
    if (ticket == null) {
      throw Exception('Ticket not found.');
    }

    final logs = await localDb.getLogsForTicket(ticketId);
    final rating = await localDb.getRatingForTicket(ticketId);

    return TicketDetailBundle(
      ticket: ticket,
      logs: logs,
      rating: rating,
    );
  }

  /// Inserts a newly submitted ticket and its initial pending log into SQLite.
  Future<TicketModel> submitTicket({
    required int residentId,
    required int categoryId,
    required String categoryCode,
    required String categoryName,
    required String title,
    required String description,
    required String locationDesc,
    double? lat,
    double? lng,
    required List<String> photoUrls,
    required String priority,
  }) async {
    await _ensureSeeded();
    await Future.delayed(const Duration(milliseconds: 350));

    final now = DateTime.now();
    final existing = await localDb.getAllTickets();
    final nextTicketId =
    await localDb.getNextId('local_tickets', fallbackStart: 101);
    final nextLogId =
    await localDb.getNextId('local_ticket_logs', fallbackStart: 1);

    final yyyy = now.year.toString();
    final mm = now.month.toString().padLeft(2, '0');
    final dd = now.day.toString().padLeft(2, '0');
    final seq = (existing.length + 1).toString().padLeft(4, '0');

    final newTicket = TicketModel(
      id: nextTicketId,
      ticketNo: 'CS-$yyyy$mm$dd-$seq',
      residentId: residentId,
      categoryId: categoryId,
      categoryCode: categoryCode,
      categoryName: categoryName,
      title: title.trim(),
      description: description.trim(),
      locationDesc: locationDesc.trim(),
      lat: lat,
      lng: lng,
      photoUrls: List<String>.from(photoUrls),
      status: 'pending',
      priority: priority,
      createdAt: now,
    );

    await localDb.upsertTicket(newTicket);
    await localDb.insertLog(
      TicketStatusLogModel(
        id: nextLogId,
        ticketId: nextTicketId,
        fromStatus: null,
        toStatus: 'pending',
        actorName: 'Resident',
        note: 'Ticket submitted via mobile app.',
        createdAt: now,
      ),
    );

    return newTicket;
  }

  /// Updates ticket status to cancelled in SQLite and appends a timeline log.
  Future<TicketDetailBundle> cancelTicket({
    required int ticketId,
    required String reason,
    required String residentName,
  }) async {
    await _ensureSeeded();
    await Future.delayed(const Duration(milliseconds: 350));

    final current = await localDb.getTicketById(ticketId);
    if (current == null) {
      throw Exception('Ticket not found.');
    }

    if (current.status != 'pending' && current.status != 'accepted') {
      throw Exception('Only pending or accepted tickets can be cancelled.');
    }

    final now = DateTime.now();
    final trimmedReason = reason.trim();
    final updated = current.copyWith(
      status: 'cancelled',
      cancelledReason: trimmedReason,
      cancelledAt: now,
    );

    await localDb.upsertTicket(updated);
    final nextLogId =
    await localDb.getNextId('local_ticket_logs', fallbackStart: 1);
    await localDb.insertLog(
      TicketStatusLogModel(
        id: nextLogId,
        ticketId: ticketId,
        fromStatus: current.status,
        toStatus: 'cancelled',
        actorName: residentName,
        note: 'Cancelled by resident: $trimmedReason',
        createdAt: now,
      ),
    );

    final logs = await localDb.getLogsForTicket(ticketId);
    final rating = await localDb.getRatingForTicket(ticketId);

    return TicketDetailBundle(
      ticket: updated,
      logs: logs,
      rating: rating,
    );
  }

  /// Persists a 1-5 star service rating into SQLite.
  Future<TicketDetailBundle> submitRating({
    required int ticketId,
    required int residentId,
    required int stars,
    String? comment,
  }) async {
    await _ensureSeeded();
    await Future.delayed(const Duration(milliseconds: 350));

    final current = await localDb.getTicketById(ticketId);
    if (current == null) {
      throw Exception('Ticket not found.');
    }

    if (current.status != 'completed') {
      throw Exception('Only completed tickets can be rated.');
    }

    final existingRating = await localDb.getRatingForTicket(ticketId);
    if (existingRating != null) {
      throw Exception('This ticket has already been rated.');
    }

    final nextRatingId =
    await localDb.getNextId('local_ticket_ratings', fallbackStart: 1);
    final trimmedComment = (comment ?? '').trim();
    final rating = TicketRatingModel(
      id: nextRatingId,
      ticketId: ticketId,
      residentId: residentId,
      stars: stars,
      comment: trimmedComment.isEmpty ? null : trimmedComment,
      createdAt: DateTime.now(),
    );

    await localDb.upsertRating(rating);
    final logs = await localDb.getLogsForTicket(ticketId);

    return TicketDetailBundle(
      ticket: current,
      logs: logs,
      rating: rating,
    );
  }
}