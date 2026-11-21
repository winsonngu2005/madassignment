import 'package:equatable/equatable.dart';

/// Represents a status transition record aligned with `ticket_status_logs`.
class TicketStatusLogModel extends Equatable {
  final int id;
  final int ticketId;
  final String? fromStatus;
  final String toStatus;
  final String actorName;
  final String? note;
  final DateTime createdAt;

  const TicketStatusLogModel({
    required this.id,
    required this.ticketId,
    this.fromStatus,
    required this.toStatus,
    required this.actorName,
    this.note,
    required this.createdAt,
  });

  factory TicketStatusLogModel.fromJson(Map<String, dynamic> json) {
    return TicketStatusLogModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      ticketId: int.tryParse(json['ticket_id'].toString()) ?? 0,
      fromStatus: json['from_status']?.toString(),
      toStatus: (json['to_status'] ?? 'pending').toString(),
      actorName: (json['actor_name'] ?? 'System').toString(),
      note: json['note']?.toString(),
      createdAt:
      DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    ticketId,
    fromStatus,
    toStatus,
    actorName,
    note,
    createdAt,
  ];
}