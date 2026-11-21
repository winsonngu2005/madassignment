import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Translates raw backend status codes into styled resident-facing badges.
/// Supported codes: pending, accepted, in_progress, completed, rejected, cancelled.
class StatusBadge extends StatelessWidget {
  final String statusCode;

  const StatusBadge({
    super.key,
    required this.statusCode,
  });

  @override
  Widget build(BuildContext context) {
    final config = _resolveStatus(statusCode);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: config.backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: config.textColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            config.label,
            style: TextStyle(
              color: config.textColor,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  _StatusStyle _resolveStatus(String code) {
    switch (code.toLowerCase()) {
      case 'pending':
        return const _StatusStyle(
          label: 'Pending',
          textColor: AppColors.statusPendingText,
          backgroundColor: AppColors.statusPendingBg,
        );
      case 'accepted':
        return const _StatusStyle(
          label: 'Accepted',
          textColor: AppColors.statusAcceptedText,
          backgroundColor: AppColors.statusAcceptedBg,
        );
      case 'in_progress':
        return const _StatusStyle(
          label: 'In Progress',
          textColor: AppColors.statusInProgressText,
          backgroundColor: AppColors.statusInProgressBg,
        );
      case 'completed':
        return const _StatusStyle(
          label: 'Completed',
          textColor: AppColors.statusCompletedText,
          backgroundColor: AppColors.statusCompletedBg,
        );
      case 'rejected':
        return const _StatusStyle(
          label: 'Rejected',
          textColor: AppColors.statusRejectedText,
          backgroundColor: AppColors.statusRejectedBg,
        );
      case 'cancelled':
        return const _StatusStyle(
          label: 'Cancelled',
          textColor: AppColors.statusCancelledText,
          backgroundColor: AppColors.statusCancelledBg,
        );
      default:
        return const _StatusStyle(
          label: 'Unknown',
          textColor: AppColors.textSecondary,
          backgroundColor: AppColors.border,
        );
    }
  }
}

class _StatusStyle {
  final String label;
  final Color textColor;
  final Color backgroundColor;

  const _StatusStyle({
    required this.label,
    required this.textColor,
    required this.backgroundColor,
  });
}