import 'package:flutter/material.dart';
import '../../core/notifications/local_notification_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/primary_button.dart';

/// Allows residents to toggle local notification categories and send a test alert.
class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends State<NotificationSettingsScreen> {
  bool _isLoading = true;
  bool _masterEnabled = true;
  bool _ticketAlerts = true;
  bool _noticeAlerts = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await LocalNotificationService.instance.loadPreferences();
    if (!mounted) return;
    setState(() {
      _masterEnabled = prefs.enabled;
      _ticketAlerts = prefs.ticketAlerts;
      _noticeAlerts = prefs.noticeAlerts;
      _isLoading = false;
    });
  }

  Future<void> _persistSettings() async {
    await LocalNotificationService.instance.savePreferences(
      NotificationPreferences(
        enabled: _masterEnabled,
        ticketAlerts: _ticketAlerts,
        noticeAlerts: _noticeAlerts,
      ),
    );
  }

  Future<void> _toggleMaster(bool value) async {
    if (value) {
      await LocalNotificationService.instance.requestPermission();
    }
    setState(() {
      _masterEnabled = value;
    });
    await _persistSettings();
  }

  Future<void> _toggleTicketAlerts(bool value) async {
    setState(() {
      _ticketAlerts = value;
    });
    await _persistSettings();
  }

  Future<void> _toggleNoticeAlerts(bool value) async {
    setState(() {
      _noticeAlerts = value;
    });
    await _persistSettings();
  }

  Future<void> _sendTestNotification() async {
    if (!_masterEnabled) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Please turn on "Enable Notifications" first.'),
            backgroundColor: AppColors.warning,
          ),
        );
      return;
    }

    final sent = await LocalNotificationService.instance.showTestNotification();
    if (!mounted) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            sent
                ? 'Test notification sent! Check your status bar.'
                : 'Notification permission is blocked. Open system settings to allow it.',
          ),
          backgroundColor: sent ? AppColors.success : AppColors.error,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Notification Settings')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // 1. Master Switch Card
              Card(
                child: SwitchListTile(
                  activeThumbColor: AppColors.primary,
                  secondary: const Icon(
                    Icons.notifications_active_outlined,
                    color: AppColors.primary,
                  ),
                  title: Text(
                    'Enable Notifications',
                    style: textTheme.titleMedium,
                  ),
                  subtitle: const Text(
                    'Receive local alerts on this device',
                  ),
                  value: _masterEnabled,
                  onChanged: _toggleMaster,
                ),
              ),
              const SizedBox(height: 16),

              // 2. Category Switches Card
              Card(
                child: Column(
                  children: [
                    SwitchListTile(
                      activeThumbColor: AppColors.primary,
                      secondary: const Icon(
                        Icons.confirmation_number_outlined,
                      ),
                      title: const Text('Ticket Status Alerts'),
                      subtitle: const Text(
                        'Confirmations when you submit, cancel, or rate a ticket',
                      ),
                      value: _masterEnabled && _ticketAlerts,
                      onChanged:
                      _masterEnabled ? _toggleTicketAlerts : null,
                    ),
                    const Divider(height: 1, color: AppColors.border),
                    SwitchListTile(
                      activeThumbColor: AppColors.primary,
                      secondary: const Icon(Icons.campaign_outlined),
                      title: const Text('Community Notice Alerts'),
                      subtitle: const Text(
                        'Alerts for scheduled maintenance and office notices',
                      ),
                      value: _masterEnabled && _noticeAlerts,
                      onChanged:
                      _masterEnabled ? _toggleNoticeAlerts : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 3. One-Tap Test Notification Button
              PrimaryButton(
                label: 'Send Test Notification',
                icon: Icons.send_to_mobile_rounded,
                onPressed: _sendTestNotification,
              ),
              const SizedBox(height: 10),

              // 4. Fallback shortcut to Android OS Notification Settings
              TextButton.icon(
                onPressed: () {
                  LocalNotificationService.instance.openSystemSettings();
                },
                icon: const Icon(Icons.settings_outlined, size: 18),
                label: const Text('Open Device Notification Settings'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}