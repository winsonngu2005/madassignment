import 'package:equatable/equatable.dart';

/// Represents a community service ticket aligned with `tickets` and `categories`.
class TicketModel extends Equatable {
  final int id;
  final String ticketNo;
  final int residentId;
  final int categoryId;
  final String categoryCode; // lighting, garbage, facility, noise
  final String categoryName;
  final String title;
  final String description;
  final String locationDesc;
  final double? lat;
  final double? lng;
  final List<String> photoUrls;
  final String status; // pending, accepted, in_progress, completed, rejected, cancelled
  final String priority; // low, normal, urgent
  final DateTime createdAt;
  final DateTime? dueAt;
  final String? rejectReason;
  final String? cancelledReason;
  final DateTime? cancelledAt;

  const TicketModel({
    required this.id,
    required this.ticketNo,
    required this.residentId,
    required this.categoryId,
    required this.categoryCode,
    required this.categoryName,
    required this.title,
    required this.description,
    required this.locationDesc,
    this.lat,
    this.lng,
    this.photoUrls = const [],
    required this.status,
    this.priority = 'normal',
    required this.createdAt,
    this.dueAt,
    this.rejectReason,
    this.cancelledReason,
    this.cancelledAt,
  });

  TicketModel copyWith({
    String? status,
    String? rejectReason,
    String? cancelledReason,
    DateTime? cancelledAt,
  }) {
    return TicketModel(
      id: id,
      ticketNo: ticketNo,
      residentId: residentId,
      categoryId: categoryId,
      categoryCode: categoryCode,
      categoryName: categoryName,
      title: title,
      description: description,
      locationDesc: locationDesc,
      lat: lat,
      lng: lng,
      photoUrls: photoUrls,
      status: status ?? this.status,
      priority: priority,
      createdAt: createdAt,
      dueAt: dueAt,
      rejectReason: rejectReason ?? this.rejectReason,
      cancelledReason: cancelledReason ?? this.cancelledReason,
      cancelledAt: cancelledAt ?? this.cancelledAt,
    );
  }

  factory TicketModel.fromJson(Map<String, dynamic> json) {
    final rawPhotos = json['photo_urls'];
    final parsedPhotos = rawPhotos is List
        ? rawPhotos.map((e) => e.toString()).toList()
        : <String>[];

    return TicketModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      ticketNo: (json['ticket_no'] ?? '').toString(),
      residentId: int.tryParse(json['resident_id'].toString()) ?? 0,
      categoryId: int.tryParse(json['category_id'].toString()) ?? 0,
      categoryCode: (json['category_code'] ?? 'facility').toString(),
      categoryName: (json['category_name'] ?? 'Public Facility').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      locationDesc: (json['location_desc'] ?? '').toString(),
      lat: json['lat'] != null ? double.tryParse(json['lat'].toString()) : null,
      lng: json['lng'] != null ? double.tryParse(json['lng'].toString()) : null,
      photoUrls: parsedPhotos,
      status: (json['status'] ?? 'pending').toString(),
      priority: (json['priority'] ?? 'normal').toString(),
      createdAt:
      DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      dueAt: json['due_at'] != null
          ? DateTime.tryParse(json['due_at'].toString())
          : null,
      rejectReason: json['reject_reason']?.toString(),
      cancelledReason: json['cancelled_reason']?.toString(),
      cancelledAt: json['cancelled_at'] != null
          ? DateTime.tryParse(json['cancelled_at'].toString())
          : null,
    );
  }

  @override
  List<Object?> get props => [
    id,
    ticketNo,
    residentId,
    categoryId,
    categoryCode,
    categoryName,
    title,
    description,
    locationDesc,
    lat,
    lng,
    photoUrls,
    status,
    priority,
    createdAt,
    dueAt,
    rejectReason,
    cancelledReason,
    cancelledAt,
  ];
}