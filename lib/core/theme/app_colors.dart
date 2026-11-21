import 'package:flutter/material.dart';

/// Centralised colour palette for the Community Service Tracking system.
/// Shared as the visual standard between the Resident App and Web Admin Panel.
class AppColors {
  AppColors._();

  // Brand colours
  static const Color primary = Color(0xFF0F766E);       // Civic Teal
  static const Color primaryLight = Color(0xFFCCFBF1);  // Soft Teal tint
  static const Color primaryDark = Color(0xFF115E59);   // Pressed state

  // Neutral surface & text colours (high contrast for night-time outdoor use)
  static const Color background = Color(0xFFF8FAFC);    // Page background
  static const Color surface = Color(0xFFFFFFFF);       // Card & input fill
  static const Color border = Color(0xFFE2E8F0);        // Subtle divider/border
  static const Color textPrimary = Color(0xFF0F172A);   // Main headings & body
  static const Color textSecondary = Color(0xFF475569); // Subtitles & captions
  static const Color textHint = Color(0xFF94A3B8);      // Input placeholders

  // Semantic feedback colours
  static const Color error = Color(0xFFDC2626);
  static const Color warning = Color(0xFFD97706);
  static const Color success = Color(0xFF16A34A);

  // Ticket status colours (strictly mapped to database status codes)
  static const Color statusPendingText = Color(0xFFB45309);
  static const Color statusPendingBg = Color(0xFFFEF3C7);

  static const Color statusAcceptedText = Color(0xFF1D4ED8);
  static const Color statusAcceptedBg = Color(0xFFDBEAFE);

  static const Color statusInProgressText = Color(0xFF6D28D9);
  static const Color statusInProgressBg = Color(0xFFEDE9FE);

  static const Color statusCompletedText = Color(0xFF15803D);
  static const Color statusCompletedBg = Color(0xFFDCFCE7);

  static const Color statusRejectedText = Color(0xFFB91C1C);
  static const Color statusRejectedBg = Color(0xFFFEE2E2);

  static const Color statusCancelledText = Color(0xFF475569);
  static const Color statusCancelledBg = Color(0xFFF1F5F9);
}