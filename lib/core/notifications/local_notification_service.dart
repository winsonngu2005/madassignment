import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Stores the resident's persisted notification toggle preferences.
class NotificationPreferences {
  final bool enabled;
  final bool ticketAlerts;
  final bool noticeAlerts;

  const NotificationPreferences({
    required this.enabled,
    required this.ticketAlerts,
    required this.noticeAlerts,
  });
}

/// Manages local system notifications and persists user notification preferences.
class LocalNotificationService {
  LocalNotificationService._();

  static final LocalNotificationService instance = LocalNotificationService._();

  static const String _keyEnabled = 'notif_master_enabled';
  static const String _keyTicketAlerts = 'notif_ticket_alerts';
  static const String _keyNoticeAlerts = 'notif_notice_alerts';

  static const String _channelId = 'community_service_alerts';
  static const String _channelName = 'Community Service Alerts';
  static const String _channelDesc =
      'Updates for service ticket submissions, cancellations, ratings, and notices.';

  final FlutterLocalNotificationsPlugin _plugin =
  FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  int _nextId = 100;

  /// Initializes the local notifications plugin safely at app startup.
  Future<void> init() async {
    if (_initialized) return;

    try {
      const androidSettings =
      AndroidInitializationSettings('@mipmap/ic_launcher');
      const darwinSettings = DarwinInitializationSettings();
      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: darwinSettings,
      );

      await _plugin.initialize(settings: initSettings);
      _initialized = true;
    } catch (e) {
      debugPrint('LocalNotificationService init skipped: $e');
    }
  }

  /// Requests Android 13+ / iOS runtime notification permission.
  Future<bool> requestPermission() async {
    if (!_initialized) await init();

    try {
      final androidImpl = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidImpl != null) {
        final granted = await androidImpl.requestNotificationsPermission();
        return granted ?? true;
      }

      final iosImpl = _plugin.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      if (iosImpl != null) {
        final granted = await iosImpl.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
        return granted ?? true;
      }
      return true;
    } catch (e) {
      debugPrint('Permission request error: $e');
      return false;
    }
  }

  /// Opens the device's system notification settings page for this app.
  Future<void> openSystemSettings() async {
    try {
      await _plugin.openAppNotificationSettings();
    } catch (e) {
      debugPrint('Unable to open system notification settings: $e');
    }
  }

  Future<NotificationPreferences> loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    return NotificationPreferences(
      enabled: prefs.getBool(_keyEnabled) ?? true,
      ticketAlerts: prefs.getBool(_keyTicketAlerts) ?? true,
      noticeAlerts: prefs.getBool(_keyNoticeAlerts) ?? true,
    );
  }

  Future<void> savePreferences(NotificationPreferences settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyEnabled, settings.enabled);
    await prefs.setBool(_keyTicketAlerts, settings.ticketAlerts);
    await prefs.setBool(_keyNoticeAlerts, settings.noticeAlerts);
  }

  /// Sends a test notification immediately (used in Notification Settings).
  Future<bool> showTestNotification() async {
    final prefs = await loadPreferences();
    if (!prefs.enabled) return false;

    final granted = await requestPermission();
    if (!granted) return false;

    await _show(
      title: 'Community Service Reminder',
      body: 'Notifications are active! You will receive live ticket updates here.',
    );
    return true;
  }

  /// Triggered when a resident submits a new service ticket.
  Future<void> notifyTicketSubmitted({
    required String ticketNo,
    required String title,
  }) async {
    final prefs = await loadPreferences();
    if (!prefs.enabled || !prefs.ticketAlerts) return;

    await _show(
      title: 'Ticket Submitted ($ticketNo)',
      body: 'We received "$title". Management will review it shortly.',
    );
  }

  /// Triggered when a resident cancels a pending/accepted ticket.
  Future<void> notifyTicketCancelled({
    required String ticketNo,
  }) async {
    final prefs = await loadPreferences();
    if (!prefs.enabled || !prefs.ticketAlerts) return;

    await _show(
      title: 'Ticket Cancelled ($ticketNo)',
      body: 'Your ticket has been moved to the Closed archive.',
    );
  }

  /// Triggered when a resident submits a 1-5 star rating for a completed ticket.
  Future<void> notifyRatingSubmitted({
    required String ticketNo,
    required int stars,
  }) async {
    final prefs = await loadPreferences();
    if (!prefs.enabled || !prefs.ticketAlerts) return;

    await _show(
      title: 'Rating Recorded ($ticketNo)',
      body: 'Thank you for rating our community maintenance $stars/5 stars!',
    );
  }

  Future<void> _show({
    required String title,
    required String body,
  }) async {
    if (!_initialized) await init();

    try {
      const details = NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDesc,
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      );

      await _plugin.show(
        id: _nextId++,
        title: title,
        body: body,
        notificationDetails: details,
      );
    } catch (e) {
      debugPrint('Failed to show local notification: $e');
    }
  }
}