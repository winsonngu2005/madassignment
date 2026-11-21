import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/floating_pill_nav_bar.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../core/widgets/status_badge.dart';
import '../../data/models/announcement_model.dart';
import '../../data/models/ticket_model.dart';
import '../../data/models/user_model.dart';
import '../auth/auth_bloc.dart';
import '../forum/forum_screen.dart';
import '../profile/profile_screen.dart';
import '../report/report_issue_screen.dart';
import '../tickets/ticket_detail_screen.dart';
import 'dashboard_bloc.dart';

class DashboardScreen extends StatefulWidget {
  final UserModel user;

  const DashboardScreen({super.key, required this.user});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentTabIndex = 0;

  @override
  void initState() {
    super.initState();
    // Trigger initial announcements and tickets load
    context.read<DashboardBloc>().add(const DashboardLoadRequested());
  }

  Future<void> _handleRefresh() async {
    final bloc = context.read<DashboardBloc>();
    bloc.add(const DashboardRefreshRequested());
    await bloc.stream.firstWhere(
          (state) => state is DashboardLoaded || state is DashboardError,
    );
  }

  void _confirmSignOut() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign Out'),
        content:
        const Text('Are you sure you want to sign out of your account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<AuthBloc>().add(const AuthLogoutRequested());
            },
            child: const Text(
              'Sign Out',
              style: TextStyle(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Allows content to scroll smoothly behind the floating pill bar
      extendBody: true,
      body: IndexedStack(
        index: _currentTabIndex,
        children: [
          // Tab 1: Home (Community Notices)
          _NoticesTab(
            userName: widget.user.name,
            onRefresh: _handleRefresh,
          ),
          // Tab 2: My Service Tickets
          _MyTicketsTab(
            onRefresh: _handleRefresh,
          ),
          // Tab 3: Camera / Report Issue
          ReportIssueScreen(
            user: widget.user,
            onTicketSubmitted: () {
              setState(() {
                _currentTabIndex = 1;
              });
            },
          ),
          // Tab 4: Community Forum
          ForumScreen(user: widget.user),
          // Tab 5: User Profile
          ProfileScreen(
            user: widget.user,
            onSignOut: _confirmSignOut,
          ),
        ],
      ),
      bottomNavigationBar: FloatingPillNavBar(
        currentIndex: _currentTabIndex,
        onTap: (index) {
          setState(() {
            _currentTabIndex = index;
          });
        },
      ),
    );
  }
}

// ============================================================================
// Tab 1: Home — Community Notices
// ============================================================================
class _NoticesTab extends StatelessWidget {
  final String userName;
  final Future<void> Function() onRefresh;

  const _NoticesTab({
    required this.userName,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Community Notices'),
            Text(
              'Hello, $userName',
              style: textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w400,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
      body: BlocBuilder<DashboardBloc, DashboardState>(
        builder: (context, state) {
          if (state is DashboardInitial || state is DashboardLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is DashboardError) {
            return _ErrorRetryView(message: state.message);
          }

          final announcements = (state as DashboardLoaded).announcements;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: onRefresh,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Latest Announcements', style: textTheme.titleLarge),
                        Text(
                          '${announcements.length} active',
                          style: textTheme.labelSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (announcements.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('No community announcements at the moment.'),
                        ),
                      )
                    else
                      ...announcements.map(
                            (notice) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _NoticeCard(notice: notice),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  final AnnouncementModel notice;

  const _NoticeCard({required this.notice});

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
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.campaign_outlined,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(notice.title, style: textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(
                        _formatDate(notice.createdAt),
                        style: textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w400,
                          color: AppColors.textHint,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(notice.content, style: textTheme.bodyLarge),
          ],
        ),
      ),
    );
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
// Tab 2: My Service Tickets
// ============================================================================
class _MyTicketsTab extends StatelessWidget {
  final Future<void> Function() onRefresh;

  const _MyTicketsTab({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Service Tickets'),
      ),
      body: BlocBuilder<DashboardBloc, DashboardState>(
        builder: (context, state) {
          if (state is DashboardInitial || state is DashboardLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is DashboardError) {
            return _ErrorRetryView(message: state.message);
          }

          final loaded = state as DashboardLoaded;
          final tickets = loaded.filteredTickets;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: onRefresh,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Filter by Status', style: textTheme.titleMedium),
                        Text(
                          '${tickets.length} shown',
                          style: textTheme.labelSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _StatusFilterBar(
                      selectedFilter: loaded.selectedFilter,
                      onSelected: (filter) {
                        context
                            .read<DashboardBloc>()
                            .add(DashboardFilterChanged(filter));
                      },
                    ),
                    const SizedBox(height: 14),
                    if (tickets.isEmpty)
                      const _EmptyTicketsCard()
                    else
                      ...tickets.map(
                            (ticket) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _TicketCard(
                            ticket: ticket,
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      TicketDetailScreen(ticket: ticket),
                                ),
                              );
                            },
                            onThumbnailTap: () {
                              if (ticket.photoUrls.isEmpty) return;
                              PhotoGalleryViewer.open(
                                context,
                                photoUrls: ticket.photoUrls,
                                initialIndex: 0,
                              );
                            },
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StatusFilterBar extends StatelessWidget {
  final String selectedFilter;
  final ValueChanged<String> onSelected;

  const _StatusFilterBar({
    required this.selectedFilter,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final filters = [
      ('all', 'All'),
      ('active', 'Active'),
      ('completed', 'Completed'),
      ('closed', 'Closed'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((item) {
          final isSelected = selectedFilter == item.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(item.$2),
              selected: isSelected,
              selectedColor: AppColors.primaryLight,
              labelStyle: TextStyle(
                color: isSelected
                    ? AppColors.primaryDark
                    : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
              side: BorderSide(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
              onSelected: (_) => onSelected(item.$1),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  final TicketModel ticket;
  final VoidCallback onTap;
  final VoidCallback onThumbnailTap;

  const _TicketCard({
    required this.ticket,
    required this.onTap,
    required this.onThumbnailTap,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final hasPhotos = ticket.photoUrls.isNotEmpty;
    final extraPhotoCount = ticket.photoUrls.length - 1;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: Ticket reference number + Status badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    ticket.ticketNo,
                    style: textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                      letterSpacing: 0.4,
                    ),
                  ),
                  StatusBadge(statusCode: ticket.status),
                ],
              ),
              const SizedBox(height: 10),

              // Middle row: Title & Location on the left; first photo thumbnail on the right
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ticket.title,
                          style: textTheme.titleMedium,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(
                              Icons.location_on_outlined,
                              size: 16,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                ticket.locationDesc,
                                style: textTheme.bodyMedium,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (hasPhotos) ...[
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: onThumbnailTap,
                      child: SizedBox(
                        width: 68,
                        height: 68,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: TicketNetworkImage(
                                imageUrl: ticket.photoUrls.first,
                              ),
                            ),
                            if (extraPhotoCount > 0)
                              Positioned(
                                right: 4,
                                bottom: 4,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.68),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '+$extraPhotoCount',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),

              // Bottom row: Category tag + Submitted date
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        _categoryIcon(ticket.categoryCode),
                        size: 15,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        ticket.categoryName,
                        style: textTheme.labelSmall,
                      ),
                    ],
                  ),
                  Text(
                    _formatDate(ticket.createdAt),
                    style: textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w400,
                      color: AppColors.textHint,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _categoryIcon(String code) {
    switch (code.toLowerCase()) {
      case 'lighting':
        return Icons.lightbulb_outline_rounded;
      case 'garbage':
        return Icons.delete_outline_rounded;
      case 'noise':
        return Icons.volume_up_outlined;
      case 'facility':
      default:
        return Icons.handyman_outlined;
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

class _EmptyTicketsCard extends StatelessWidget {
  const _EmptyTicketsCard();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
        child: Column(
          children: [
            const Icon(
              Icons.inbox_outlined,
              size: 44,
              color: AppColors.textHint,
            ),
            const SizedBox(height: 10),
            Text('No tickets in this category', style: textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              'Use the camera tab below to submit a new community service request.',
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// Shared Error View
// ============================================================================
class _ErrorRetryView extends StatelessWidget {
  final String message;

  const _ErrorRetryView({required this.message});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 56,
              color: AppColors.textHint,
            ),
            const SizedBox(height: 12),
            Text('Unable to load data', style: textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                context
                    .read<DashboardBloc>()
                    .add(const DashboardLoadRequested());
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}