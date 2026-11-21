import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Light floating pill bottom navigation bar with 5 grey icons.
class FloatingPillNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const FloatingPillNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final items = [
      (
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      tooltip: 'Home',
      ),
      (
      icon: Icons.confirmation_number_outlined,
      activeIcon: Icons.confirmation_number_rounded,
      tooltip: 'My Service Tickets',
      ),
      (
      icon: Icons.photo_camera_outlined,
      activeIcon: Icons.photo_camera_rounded,
      tooltip: 'Report Issue',
      ),
      (
      icon: Icons.forum_outlined,
      activeIcon: Icons.forum_rounded,
      tooltip: 'Community Forum',
      ),
      (
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      tooltip: 'Profile',
      ),
    ];

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(36),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                children: List.generate(items.length, (index) {
                  final item = items[index];
                  final isSelected = index == currentIndex;

                  return Expanded(
                    child: Tooltip(
                      message: item.tooltip,
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => onTap(index),
                          borderRadius: BorderRadius.circular(28),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeOut,
                            height: double.infinity,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              // Soft grey pill highlight for the active tab
                              color: isSelected
                                  ? const Color(0xFFE2E8F0)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(28),
                            ),
                            child: Icon(
                              isSelected ? item.activeIcon : item.icon,
                              size: 25,
                              // Dark grey when active, medium grey when inactive
                              color: isSelected
                                  ? const Color(0xFF334155)
                                  : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}