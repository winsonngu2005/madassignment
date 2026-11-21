import 'package:equatable/equatable.dart';

/// Represents a resident's service rating aligned with the `ratings` table.
class TicketRatingModel extends Equatable {
  final int id;
  final int ticketId;
  final int residentId;
  final int stars; // 1 to 5
  final String? comment;
  final DateTime createdAt;

  const TicketRatingModel({
    required this.id,
    required this.ticketId,
    required this.residentId,
    required this.stars,
    this.comment,
    required this.createdAt,
  });

  factory TicketRatingModel.fromJson(Map<String, dynamic> json) {
    return TicketRatingModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      ticketId: int.tryParse(json['ticket_id'].toString()) ?? 0,
      residentId: int.tryParse(json['resident_id'].toString()) ?? 0,
      stars: int.tryParse(json['stars'].toString()) ?? 5,
      comment: json['comment']?.toString(),
      createdAt:
      DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    ticketId,
    residentId,
    stars,
    comment,
    createdAt,
  ];
}