import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/approximate_location_map.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../core/widgets/primary_button.dart';
import '../../core/widgets/status_badge.dart';
import '../../data/models/ticket_model.dart';
import '../../data/models/ticket_rating_model.dart';
import '../../data/models/ticket_status_log_model.dart';
import '../../data/repositories/ticket_repository.dart';
import '../auth/auth_bloc.dart';
import '../dashboard/dashboard_bloc.dart';
import 'ticket_detail_bloc.dart';
import '../../core/notifications/local_notification_service.dart';

/// Full detail view for a single service ticket with timeline, cancel & rating.
class TicketDetailScreen extends StatelessWidget {
  final TicketModel ticket;

  const TicketDetailScreen({super.key, required this.ticket});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => TicketDetailBloc(
        ticketRepository: context.read<TicketRepository>(),
      )..add(TicketDetailLoadRequested(ticket.id)),
      child: _TicketDetailView(initialTicket: ticket),
    );
  }
}

class _TicketDetailView extends StatelessWidget {
  final TicketModel initialTicket;

  const _TicketDetailView({required this.initialTicket});

  Future<void> _openCancelDialog(
      BuildContext context,
      TicketModel ticket,
      ) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _CancelTicketDialog(),
    );

    if (reason == null || !context.mounted) return;

    final authState = context.read<AuthBloc>().state;
    final residentName = authState is AuthAuthenticated
        ? authState.user.name
        : 'Resident';

    context.read<TicketDetailBloc>().add(
      TicketCancelRequested(
        ticketId: ticket.id,
        reason: reason,
        residentName: residentName,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ticket Details'),
      ),
      body: BlocConsumer<TicketDetailBloc, TicketDetailState>(
        listenWhen: (previous, current) {
          if (current is! TicketDetailLoaded) return false;
          if (current.feedbackMessage == null) return false;
          if (previous is TicketDetailLoaded) {
            return previous.feedbackTick != current.feedbackTick;
          }
          return true;
        },
        listener: (context, state) {
          if (state is! TicketDetailLoaded || state.feedbackMessage == null) {
            return;
          }
          if (state.shouldRefreshDashboard) {
            context
                .read<DashboardBloc>()
                .add(const DashboardRefreshRequested());
            if (!state.isErrorFeedback) {
              LocalNotificationService.instance.notifyTicketCancelled(
                ticketNo: state.ticket.ticketNo,
              );
            }
          } else if (!state.isErrorFeedback &&
              state.ticket.status == 'completed' &&
              state.rating != null) {
            LocalNotificationService.instance.notifyRatingSubmitted(
              ticketNo: state.ticket.ticketNo,
              stars: state.rating!.stars,
            );
          }
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              SnackBar(
                content: Text(state.feedbackMessage!),
                backgroundColor: state.isErrorFeedback
                    ? AppColors.error
                    : AppColors.success,
              ),
            );
        },
        builder: (context, state) {
          if (state is TicketDetailLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is TicketDetailError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      size: 48,
                      color: AppColors.error,
                    ),
                    const SizedBox(height: 12),
                    Text(state.message, style: textTheme.bodyLarge),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        context
                            .read<TicketDetailBloc>()
                            .add(TicketDetailLoadRequested(initialTicket.id));
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final loaded = state as TicketDetailLoaded;
          final ticket = loaded.ticket;
          final hasDescription = ticket.description.trim().isNotEmpty;
          final hasCoordinates = ticket.lat != null && ticket.lng != null;
          final canCancel =
              ticket.status == 'pending' || ticket.status == 'accepted';
          final isCompleted = ticket.status == 'completed';

          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  // 1. Header summary card (Ticket No, Status, Title, Metadata)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                ticket.ticketNo,
                                style: textTheme.labelSmall?.copyWith(
                                  color: AppColors.primary,
                                  fontSize: 13,
                                  letterSpacing: 0.4,
                                ),
                              ),
                              StatusBadge(statusCode: ticket.status),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            ticket.title,
                            style: textTheme.titleLarge,
                          ),
                          const SizedBox(height: 16),
                          const Divider(height: 1, color: AppColors.border),
                          const SizedBox(height: 14),
                          _DetailInfoRow(
                            icon: Icons.category_outlined,
                            label: 'Category',
                            value: ticket.categoryName,
                          ),
                          const SizedBox(height: 10),
                          _DetailInfoRow(
                            icon: Icons.location_on_outlined,
                            label: 'Location',
                            value: ticket.locationDesc,
                          ),
                          const SizedBox(height: 10),
                          _DetailInfoRow(
                            icon: Icons.flag_outlined,
                            label: 'Priority',
                            value: _capitalize(ticket.priority),
                          ),
                          const SizedBox(height: 10),
                          _DetailInfoRow(
                            icon: Icons.schedule_outlined,
                            label: 'Submitted',
                            value: _formatDate(ticket.createdAt),
                          ),
                          if (ticket.status == 'cancelled' &&
                              ticket.cancelledReason != null &&
                              ticket.cancelledReason!.trim().isNotEmpty) ...[
                            const SizedBox(height: 14),
                            _NoticeBanner(
                              icon: Icons.cancel_outlined,
                              title: 'Cancellation Reason',
                              message: ticket.cancelledReason!,
                              color: AppColors.textSecondary,
                              backgroundColor: const Color(0xFFF1F5F9),
                            ),
                          ],
                          if (ticket.status == 'rejected' &&
                              ticket.rejectReason != null &&
                              ticket.rejectReason!.trim().isNotEmpty) ...[
                            const SizedBox(height: 14),
                            _NoticeBanner(
                              icon: Icons.report_gmailerrorred_outlined,
                              title: 'Rejection Reason',
                              message: ticket.rejectReason!,
                              color: AppColors.error,
                              backgroundColor: const Color(0xFFFEE2E2),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 2. Approximate Location Map (shown when coordinates exist)
                  if (hasCoordinates) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Approximate Location Map',
                                  style: textTheme.titleMedium,
                                ),
                                Text(
                                  '${ticket.lat!.toStringAsFixed(4)}, ${ticket.lng!.toStringAsFixed(4)}',
                                  style: textTheme.labelSmall,
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ApproximateLocationMap(
                              latitude: ticket.lat!,
                              longitude: ticket.lng!,
                              height: 190,
                              isInteractive: false,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // 3. Description section (always keeps the section & box placeholder)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Description', style: textTheme.titleMedium),
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            constraints: const BoxConstraints(minHeight: 76),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: hasDescription
                                ? Text(
                              ticket.description,
                              style: textTheme.bodyLarge,
                            )
                                : const SizedBox.shrink(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 4. Complete uploaded photos section
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Uploaded Photos',
                                style: textTheme.titleMedium,
                              ),
                              Text(
                                '${ticket.photoUrls.length} photo(s)',
                                style: textTheme.labelSmall,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (ticket.photoUrls.isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 24),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                children: [
                                  const Icon(
                                    Icons.photo_library_outlined,
                                    color: AppColors.textHint,
                                    size: 32,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'No photos uploaded for this ticket.',
                                    style: textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            )
                          else
                            GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: ticket.photoUrls.length,
                              gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: 10,
                                mainAxisSpacing: 10,
                              ),
                              itemBuilder: (context, index) {
                                return GestureDetector(
                                  onTap: () {
                                    PhotoGalleryViewer.open(
                                      context,
                                      photoUrls: ticket.photoUrls,
                                      initialIndex: index,
                                    );
                                  },
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: TicketNetworkImage(
                                      imageUrl: ticket.photoUrls[index],
                                    ),
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 5. Status Timeline (aligned with `ticket_status_logs`)
                  _StatusTimelineCard(logs: loaded.logs),
                  const SizedBox(height: 16),

                  // 6. Service Rating Section (only for completed tickets)
                  if (isCompleted) ...[
                    _ServiceRatingCard(
                      ticketId: ticket.id,
                      existingRating: loaded.rating,
                      isSubmitting: loaded.isSubmittingAction,
                    ),
                    const SizedBox(height: 16),
                  ],

                  // 7. Cancel Ticket Action (only for pending / accepted tickets)
                  if (canCancel)
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        minimumSize: const Size.fromHeight(50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: loaded.isSubmittingAction
                          ? null
                          : () => _openCancelDialog(context, ticket),
                      icon: loaded.isSubmittingAction
                          ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.error,
                        ),
                      )
                          : const Icon(Icons.cancel_outlined),
                      label: Text(
                        loaded.isSubmittingAction
                            ? 'Cancelling Ticket...'
                            : 'Cancel Ticket',
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text[0].toUpperCase() + text.substring(1).toLowerCase();
  }

  String _formatDate(DateTime dt) {
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${dt.year}-$m-$d $hh:$mm';
  }
}

// ============================================================================
// Status Timeline Card
// ============================================================================
class _StatusTimelineCard extends StatelessWidget {
  final List<TicketStatusLogModel> logs;

  const _StatusTimelineCard({required this.logs});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Status Timeline', style: textTheme.titleMedium),
                Text('${logs.length} update(s)', style: textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: 14),
            if (logs.isEmpty)
              Text(
                'No status updates recorded yet.',
                style: textTheme.bodyMedium,
              )
            else
              Column(
                children: List.generate(logs.length, (index) {
                  final log = logs[index];
                  final isLast = index == logs.length - 1;
                  final dotColor = _statusColor(log.toStatus);

                  return IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          width: 24,
                          child: Column(
                            children: [
                              Container(
                                width: 12,
                                height: 12,
                                margin: const EdgeInsets.only(top: 4),
                                decoration: BoxDecoration(
                                  color: dotColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              if (!isLast)
                                Expanded(
                                  child: Container(
                                    width: 2,
                                    margin:
                                    const EdgeInsets.symmetric(vertical: 4),
                                    color: AppColors.border,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _statusLabel(log.toStatus),
                                      style: textTheme.titleMedium?.copyWith(
                                        fontSize: 14,
                                        color: dotColor,
                                      ),
                                    ),
                                    Text(
                                      _formatDate(log.createdAt),
                                      style: textTheme.labelSmall?.copyWith(
                                        fontWeight: FontWeight.w400,
                                        color: AppColors.textHint,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'By ${log.actorName}',
                                  style: textTheme.labelSmall?.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                if (log.note != null &&
                                    log.note!.trim().isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    log.note!,
                                    style: textTheme.bodyMedium,
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return AppColors.warning;
      case 'accepted':
        return const Color(0xFF2563EB);
      case 'in_progress':
        return const Color(0xFF7C3AED);
      case 'completed':
        return AppColors.success;
      case 'rejected':
        return AppColors.error;
      case 'cancelled':
      default:
        return AppColors.textSecondary;
    }
  }

  String _statusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  String _formatDate(DateTime dt) {
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${dt.year}-$m-$d $hh:$mm';
  }
}

// ============================================================================
// Service Rating Card (1-5 Stars)
// ============================================================================
class _ServiceRatingCard extends StatefulWidget {
  final int ticketId;
  final TicketRatingModel? existingRating;
  final bool isSubmitting;

  const _ServiceRatingCard({
    required this.ticketId,
    required this.existingRating,
    required this.isSubmitting,
  });

  @override
  State<_ServiceRatingCard> createState() => _ServiceRatingCardState();
}

class _ServiceRatingCardState extends State<_ServiceRatingCard> {
  final _commentController = TextEditingController();
  int _selectedStars = 0;
  bool _showStarError = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _submitRating() {
    if (_selectedStars < 1) {
      setState(() => _showStarError = true);
      return;
    }

    FocusScope.of(context).unfocus();
    final authState = context.read<AuthBloc>().state;
    final residentId =
    authState is AuthAuthenticated ? authState.user.id : 1;

    context.read<TicketDetailBloc>().add(
      TicketRatingSubmitted(
        ticketId: widget.ticketId,
        residentId: residentId,
        stars: _selectedStars,
        comment: _commentController.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final existing = widget.existingRating;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: existing != null
            ? _buildSubmittedView(textTheme, existing)
            : _buildInputView(textTheme),
      ),
    );
  }

  Widget _buildSubmittedView(TextTheme textTheme, TicketRatingModel rating) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Your Service Rating', style: textTheme.titleMedium),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Submitted',
                style: textTheme.labelSmall?.copyWith(
                  color: AppColors.primaryDark,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: List.generate(5, (index) {
            final filled = index < rating.stars;
            return Icon(
              filled ? Icons.star_rounded : Icons.star_outline_rounded,
              color: filled ? const Color(0xFFF59E0B) : AppColors.textHint,
              size: 28,
            );
          }),
        ),
        if (rating.comment != null && rating.comment!.trim().isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(rating.comment!, style: textTheme.bodyLarge),
          ),
        ],
      ],
    );
  }

  Widget _buildInputView(TextTheme textTheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Rate This Service', style: textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          'How satisfied are you with the completed repair?',
          style: textTheme.bodyMedium,
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(5, (index) {
            final starValue = index + 1;
            final isSelected = starValue <= _selectedStars;
            return IconButton(
              onPressed: widget.isSubmitting
                  ? null
                  : () {
                setState(() {
                  _selectedStars = starValue;
                  _showStarError = false;
                });
              },
              iconSize: 36,
              icon: Icon(
                isSelected ? Icons.star_rounded : Icons.star_outline_rounded,
                color:
                isSelected ? const Color(0xFFF59E0B) : AppColors.textHint,
              ),
            );
          }),
        ),
        if (_showStarError)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Center(
              child: Text(
                'Please select a rating from 1 to 5 stars.',
                style: textTheme.labelSmall?.copyWith(color: AppColors.error),
              ),
            ),
          ),
        const SizedBox(height: 8),
        TextField(
          controller: _commentController,
          enabled: !widget.isSubmitting,
          maxLines: 3,
          maxLength: 300,
          decoration: const InputDecoration(
            labelText: 'Feedback Comment (Optional)',
            hintText: 'Share your thoughts about response speed or repair quality...',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 12),
        PrimaryButton(
          label: 'Submit Rating',
          icon: Icons.star_rounded,
          isLoading: widget.isSubmitting,
          onPressed: _submitRating,
        ),
      ],
    );
  }
}

// ============================================================================
// Cancel Ticket Dialog (with quick reasons & form validation)
// ============================================================================
class _CancelTicketDialog extends StatefulWidget {
  const _CancelTicketDialog();

  @override
  State<_CancelTicketDialog> createState() => _CancelTicketDialogState();
}

class _CancelTicketDialogState extends State<_CancelTicketDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();

  static const _quickReasons = [
    'Issue resolved on its own',
    'Submitted by mistake',
    'Duplicate ticket',
  ];

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  void _confirm() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(_reasonController.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancel Service Ticket'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Please provide a short reason for cancelling this request:',
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _quickReasons.map((preset) {
                  return ActionChip(
                    label: Text(preset, style: const TextStyle(fontSize: 12)),
                    onPressed: () {
                      _reasonController.text = preset;
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _reasonController,
                maxLines: 3,
                maxLength: 200,
                decoration: const InputDecoration(
                  labelText: 'Cancellation Reason *',
                  hintText: 'Explain why you want to cancel...',
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return 'Please enter a cancellation reason.';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Keep Ticket'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.error,
            foregroundColor: Colors.white,
          ),
          onPressed: _confirm,
          child: const Text('Confirm Cancel'),
        ),
      ],
    );
  }
}

// ============================================================================
// Helper Widgets
// ============================================================================
class _DetailInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailInfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        SizedBox(
          width: 82,
          child: Text(label, style: textTheme.bodyMedium),
        ),
        Expanded(
          child: Text(
            value,
            style: textTheme.bodyLarge?.copyWith(fontSize: 14),
          ),
        ),
      ],
    );
  }
}

class _NoticeBanner extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final Color color;
  final Color backgroundColor;

  const _NoticeBanner({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
    required this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(message, style: textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}