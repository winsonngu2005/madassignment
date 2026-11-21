import 'dart:convert';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import '../../data/models/ticket_model.dart';
import '../../data/models/ticket_rating_model.dart';
import '../../data/models/ticket_status_log_model.dart';

/// Local SQLite database storing tickets, status timeline logs, and ratings.
/// Also acts as an offline cache layer once REST API sync is added later.
class LocalDatabaseService {
  static const String _dbName = 'community_service_local.db';
  static const int _dbVersion = 1;

  Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final fullPath = p.join(dbPath, _dbName);

    return openDatabase(
      fullPath,
      version: _dbVersion,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE local_tickets (
            id INTEGER PRIMARY KEY,
            ticket_no TEXT NOT NULL,
            resident_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            category_code TEXT NOT NULL,
            category_name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            location_desc TEXT NOT NULL,
            lat REAL,
            lng REAL,
            photo_urls_json TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            created_at TEXT NOT NULL,
            due_at TEXT,
            reject_reason TEXT,
            cancelled_reason TEXT,
            cancelled_at TEXT
          )
        ''');

        await db.execute('''
          CREATE TABLE local_ticket_logs (
            id INTEGER PRIMARY KEY,
            ticket_id INTEGER NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL
          )
        ''');

        await db.execute('''
          CREATE TABLE local_ticket_ratings (
            id INTEGER PRIMARY KEY,
            ticket_id INTEGER NOT NULL UNIQUE,
            resident_id INTEGER NOT NULL,
            stars INTEGER NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  Future<bool> hasAnyTickets() async {
    final db = await database;
    final rows = await db.rawQuery('SELECT COUNT(*) AS cnt FROM local_tickets');
    final count = Sqflite.firstIntValue(rows) ?? 0;
    return count > 0;
  }

  Future<int> getNextId(String tableName, {int fallbackStart = 1}) async {
    final db = await database;
    final rows = await db.rawQuery('SELECT MAX(id) AS max_id FROM $tableName');
    final maxId = Sqflite.firstIntValue(rows);
    if (maxId == null) return fallbackStart;
    return maxId + 1;
  }

  Future<void> upsertTicket(TicketModel ticket) async {
    final db = await database;
    await db.insert(
      'local_tickets',
      _ticketToRow(ticket),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<TicketModel>> getAllTickets() async {
    final db = await database;
    final rows = await db.query(
      'local_tickets',
      orderBy: 'created_at DESC, id DESC',
    );
    return rows.map(_rowToTicket).toList();
  }

  Future<TicketModel?> getTicketById(int ticketId) async {
    final db = await database;
    final rows = await db.query(
      'local_tickets',
      where: 'id = ?',
      whereArgs: [ticketId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _rowToTicket(rows.first);
  }

  Future<void> insertLog(TicketStatusLogModel log) async {
    final db = await database;
    await db.insert(
      'local_ticket_logs',
      {
        'id': log.id,
        'ticket_id': log.ticketId,
        'from_status': log.fromStatus,
        'to_status': log.toStatus,
        'actor_name': log.actorName,
        'note': log.note,
        'created_at': log.createdAt.toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<TicketStatusLogModel>> getLogsForTicket(int ticketId) async {
    final db = await database;
    final rows = await db.query(
      'local_ticket_logs',
      where: 'ticket_id = ?',
      whereArgs: [ticketId],
      orderBy: 'created_at ASC, id ASC',
    );
    return rows.map(_rowToLog).toList();
  }

  Future<void> upsertRating(TicketRatingModel rating) async {
    final db = await database;
    await db.insert(
      'local_ticket_ratings',
      {
        'id': rating.id,
        'ticket_id': rating.ticketId,
        'resident_id': rating.residentId,
        'stars': rating.stars,
        'comment': rating.comment,
        'created_at': rating.createdAt.toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<TicketRatingModel?> getRatingForTicket(int ticketId) async {
    final db = await database;
    final rows = await db.query(
      'local_ticket_ratings',
      where: 'ticket_id = ?',
      whereArgs: [ticketId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _rowToRating(rows.first);
  }

  Map<String, Object?> _ticketToRow(TicketModel ticket) {
    return {
      'id': ticket.id,
      'ticket_no': ticket.ticketNo,
      'resident_id': ticket.residentId,
      'category_id': ticket.categoryId,
      'category_code': ticket.categoryCode,
      'category_name': ticket.categoryName,
      'title': ticket.title,
      'description': ticket.description,
      'location_desc': ticket.locationDesc,
      'lat': ticket.lat,
      'lng': ticket.lng,
      'photo_urls_json': jsonEncode(ticket.photoUrls),
      'status': ticket.status,
      'priority': ticket.priority,
      'created_at': ticket.createdAt.toIso8601String(),
      'due_at': ticket.dueAt?.toIso8601String(),
      'reject_reason': ticket.rejectReason,
      'cancelled_reason': ticket.cancelledReason,
      'cancelled_at': ticket.cancelledAt?.toIso8601String(),
    };
  }

  TicketModel _rowToTicket(Map<String, Object?> row) {
    final List<String> photos = [];
    final rawPhotos = row['photo_urls_json']?.toString();
    if (rawPhotos != null && rawPhotos.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawPhotos);
        if (decoded is List) {
          for (final item in decoded) {
            photos.add(item.toString());
          }
        }
      } catch (_) {}
    }

    return TicketModel(
      id: (row['id'] as int?) ?? 0,
      ticketNo: (row['ticket_no'] ?? '').toString(),
      residentId: (row['resident_id'] as int?) ?? 0,
      categoryId: (row['category_id'] as int?) ?? 0,
      categoryCode: (row['category_code'] ?? 'facility').toString(),
      categoryName: (row['category_name'] ?? 'Public Facility').toString(),
      title: (row['title'] ?? '').toString(),
      description: (row['description'] ?? '').toString(),
      locationDesc: (row['location_desc'] ?? '').toString(),
      lat: row['lat'] is num ? (row['lat'] as num).toDouble() : null,
      lng: row['lng'] is num ? (row['lng'] as num).toDouble() : null,
      photoUrls: photos,
      status: (row['status'] ?? 'pending').toString(),
      priority: (row['priority'] ?? 'normal').toString(),
      createdAt:
      DateTime.tryParse((row['created_at'] ?? '').toString()) ??
          DateTime.now(),
      dueAt: row['due_at'] != null
          ? DateTime.tryParse(row['due_at'].toString())
          : null,
      rejectReason: row['reject_reason']?.toString(),
      cancelledReason: row['cancelled_reason']?.toString(),
      cancelledAt: row['cancelled_at'] != null
          ? DateTime.tryParse(row['cancelled_at'].toString())
          : null,
    );
  }

  TicketStatusLogModel _rowToLog(Map<String, Object?> row) {
    return TicketStatusLogModel(
      id: (row['id'] as int?) ?? 0,
      ticketId: (row['ticket_id'] as int?) ?? 0,
      fromStatus: row['from_status']?.toString(),
      toStatus: (row['to_status'] ?? 'pending').toString(),
      actorName: (row['actor_name'] ?? 'System').toString(),
      note: row['note']?.toString(),
      createdAt:
      DateTime.tryParse((row['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }

  TicketRatingModel _rowToRating(Map<String, Object?> row) {
    return TicketRatingModel(
      id: (row['id'] as int?) ?? 0,
      ticketId: (row['ticket_id'] as int?) ?? 0,
      residentId: (row['resident_id'] as int?) ?? 0,
      stars: (row['stars'] as int?) ?? 5,
      comment: row['comment']?.toString(),
      createdAt:
      DateTime.tryParse((row['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}