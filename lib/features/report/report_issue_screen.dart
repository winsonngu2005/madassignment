import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/approximate_location_map.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../core/widgets/primary_button.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/ticket_repository.dart';
import '../dashboard/dashboard_bloc.dart';
import 'report_bloc.dart';
import '../../core/notifications/local_notification_service.dart';

class ReportIssueScreen extends StatelessWidget {
  final UserModel user;
  final VoidCallback onTicketSubmitted;

  const ReportIssueScreen({
    super.key,
    required this.user,
    required this.onTicketSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => ReportBloc(
        ticketRepository: context.read<TicketRepository>(),
      ),
      child: _ReportIssueView(
        user: user,
        onTicketSubmitted: onTicketSubmitted,
      ),
    );
  }
}

class _ReportIssueView extends StatefulWidget {
  final UserModel user;
  final VoidCallback onTicketSubmitted;

  const _ReportIssueView({
    required this.user,
    required this.onTicketSubmitted,
  });

  @override
  State<_ReportIssueView> createState() => _ReportIssueViewState();
}

class _ReportIssueViewState extends State<_ReportIssueView> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _locationController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _imagePicker = ImagePicker();

  final List<String> _selectedPhotoPaths = [];
  _CategoryOption? _selectedCategory;
  String _selectedPriority = 'normal';
  bool _attachGps = false;
  bool _showCategoryError = false;

  // Default approximate coordinates (Sibu area)
  static const double _defaultLat = 2.341400;
  static const double _defaultLng = 111.842500;
  double _selectedLat = _defaultLat;
  double _selectedLng = _defaultLng;

  static const _categories = [
    _CategoryOption(
      id: 1,
      code: 'lighting',
      name: 'Lighting',
      icon: Icons.lightbulb_outline_rounded,
    ),
    _CategoryOption(
      id: 2,
      code: 'garbage',
      name: 'Garbage Collection',
      icon: Icons.delete_outline_rounded,
    ),
    _CategoryOption(
      id: 3,
      code: 'facility',
      name: 'Public Facility',
      icon: Icons.handyman_outlined,
    ),
    _CategoryOption(
      id: 4,
      code: 'noise',
      name: 'Noise Disturbance',
      icon: Icons.volume_up_outlined,
    ),
  ];

  static const _locationPresets = [
    'Block A, ',
    'Block B, ',
    'Block C, ',
    'Central Playground, ',
    'Main Lobby, ',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _locationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    if (_selectedPhotoPaths.length >= 3) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('You can attach up to 3 photos.')),
        );
      return;
    }

    try {
      // Built-in compression keeps uploads fast and lightweight
      final XFile? file = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 75,
      );
      if (file == null || !mounted) return;
      setState(() {
        _selectedPhotoPaths.add(file.path);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text('Unable to open camera or gallery: $e'),
            backgroundColor: AppColors.error,
          ),
        );
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _selectedPhotoPaths.removeAt(index);
    });
  }

  void _applyLocationPreset(String prefix) {
    _locationController.text = prefix;
    _locationController.selection = TextSelection.fromPosition(
      TextPosition(offset: prefix.length),
    );
  }

  void _resetForm() {
    _formKey.currentState?.reset();
    _titleController.clear();
    _locationController.clear();
    _descriptionController.clear();
    setState(() {
      _selectedPhotoPaths.clear();
      _selectedCategory = null;
      _selectedPriority = 'normal';
      _attachGps = false;
      _showCategoryError = false;
      _selectedLat = _defaultLat;
      _selectedLng = _defaultLng;
    });
  }

  void _submitForm() {
    final isCategorySelected = _selectedCategory != null;
    setState(() {
      _showCategoryError = !isCategorySelected;
    });

    final isFormValid = _formKey.currentState!.validate();
    // Strictly block submission if either category or form fields fail validation
    if (!isCategorySelected || !isFormValid) {
      return;
    }

    FocusScope.of(context).unfocus();
    context.read<ReportBloc>().add(
      ReportSubmitted(
        residentId: widget.user.id,
        categoryId: _selectedCategory!.id,
        categoryCode: _selectedCategory!.code,
        categoryName: _selectedCategory!.name,
        title: _titleController.text,
        description: _descriptionController.text,
        locationDesc: _locationController.text,
        lat: _attachGps ? _selectedLat : null,
        lng: _attachGps ? _selectedLng : null,
        photoPaths: List<String>.from(_selectedPhotoPaths),
        priority: _selectedPriority,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Report an Issue'),
      ),
      body: BlocConsumer<ReportBloc, ReportState>(
        listener: (context, state) {
          if (state is ReportFailure) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(state.message),
                  backgroundColor: AppColors.error,
                ),
              );
          } else if (state is ReportSuccess) {
            // Refresh My Service Tickets list immediately
            context
                .read<DashboardBloc>()
                .add(const DashboardRefreshRequested());
            LocalNotificationService.instance.notifyTicketSubmitted(
              ticketNo: state.createdTicket.ticketNo,
              title: state.createdTicket.title,
            );
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(
                    'Ticket ${state.createdTicket.ticketNo} submitted!',
                  ),
                  backgroundColor: AppColors.success,
                ),
              );
            _resetForm();
            context.read<ReportBloc>().add(const ReportReset());
            // Switch to Tab 2 (My Service Tickets) to show the new ticket
            widget.onTicketSubmitted();
          }
        },
        builder: (context, state) {
          final isSubmitting = state is ReportSubmitting;

          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Form(
                key: _formKey,
                child: ListView(
                  // Bottom padding prevents content from hiding behind the floating pill bar
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 115),
                  children: [
                    // 1. Photos section (Camera + Gallery, max 3)
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
                                  'Issue Photos (Optional)',
                                  style: textTheme.titleMedium,
                                ),
                                Text(
                                  '${_selectedPhotoPaths.length} / 3',
                                  style: textTheme.labelSmall?.copyWith(
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'The first photo will appear as the thumbnail on your ticket card.',
                              style: textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: isSubmitting
                                        ? null
                                        : () => _pickPhoto(ImageSource.camera),
                                    icon: const Icon(Icons.photo_camera_outlined),
                                    label: const Text('Take Photo'),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: isSubmitting
                                        ? null
                                        : () => _pickPhoto(ImageSource.gallery),
                                    icon: const Icon(Icons.photo_library_outlined),
                                    label: const Text('From Gallery'),
                                  ),
                                ),
                              ],
                            ),
                            if (_selectedPhotoPaths.isNotEmpty) ...[
                              const SizedBox(height: 14),
                              SizedBox(
                                height: 92,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: _selectedPhotoPaths.length,
                                  separatorBuilder: (_, _) =>
                                  const SizedBox(width: 10),
                                  itemBuilder: (context, index) {
                                    final path = _selectedPhotoPaths[index];
                                    return Stack(
                                      children: [
                                        GestureDetector(
                                          onTap: () {
                                            PhotoGalleryViewer.open(
                                              context,
                                              photoUrls: _selectedPhotoPaths,
                                              initialIndex: index,
                                            );
                                          },
                                          child: ClipRRect(
                                            borderRadius:
                                            BorderRadius.circular(10),
                                            child: Image.file(
                                              File(path),
                                              width: 92,
                                              height: 92,
                                              fit: BoxFit.cover,
                                            ),
                                          ),
                                        ),
                                        Positioned(
                                          top: 4,
                                          right: 4,
                                          child: GestureDetector(
                                            onTap: isSubmitting
                                                ? null
                                                : () => _removePhoto(index),
                                            child: Container(
                                              padding: const EdgeInsets.all(3),
                                              decoration: const BoxDecoration(
                                                color: Colors.black87,
                                                shape: BoxShape.circle,
                                              ),
                                              child: const Icon(
                                                Icons.close,
                                                size: 14,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    );
                                  },
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 2. Category selection (required, supports toggling off)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Category *',
                              style: textTheme.titleMedium,
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _categories.map((cat) {
                                final isSelected =
                                    _selectedCategory?.id == cat.id;
                                return ChoiceChip(
                                  avatar: Icon(
                                    cat.icon,
                                    size: 18,
                                    color: isSelected
                                        ? AppColors.primaryDark
                                        : AppColors.textSecondary,
                                  ),
                                  label: Text(cat.name),
                                  selected: isSelected,
                                  selectedColor: AppColors.primaryLight,
                                  labelStyle: TextStyle(
                                    color: isSelected
                                        ? AppColors.primaryDark
                                        : AppColors.textSecondary,
                                    fontWeight: isSelected
                                        ? FontWeight.w600
                                        : FontWeight.w500,
                                  ),
                                  side: BorderSide(
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.border,
                                  ),
                                  onSelected: isSubmitting
                                      ? null
                                      : (selected) {
                                    setState(() {
                                      // Toggle off when tapping the already-selected chip
                                      _selectedCategory =
                                      selected ? cat : null;
                                      _showCategoryError = false;
                                    });
                                  },
                                );
                              }).toList(),
                            ),
                            if (_showCategoryError) ...[
                              const SizedBox(height: 8),
                              Text(
                                'Please select an issue category.',
                                style: textTheme.labelSmall?.copyWith(
                                  color: AppColors.error,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 3. Ticket details (Title, Location, Approximate Map, Priority, Description)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Issue Details', style: textTheme.titleMedium),
                            const SizedBox(height: 14),

                            // Title (VARCHAR 120, NOT NULL)
                            TextFormField(
                              controller: _titleController,
                              enabled: !isSubmitting,
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(
                                labelText: 'Issue Title *',
                                hintText: 'e.g. Broken streetlight near gate',
                                prefixIcon: Icon(Icons.title_rounded),
                              ),
                              validator: (value) {
                                final text = (value ?? '').trim();
                                if (text.isEmpty) {
                                  return 'Please enter a short issue title.';
                                }
                                if (text.length > 120) {
                                  return 'Title must not exceed 120 characters.';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // Quick location presets
                            Text(
                              'Quick Building / Area Presets',
                              style: textTheme.labelSmall,
                            ),
                            const SizedBox(height: 6),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: _locationPresets.map((preset) {
                                  final label = preset.replaceAll(', ', '');
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: ActionChip(
                                      label: Text(label),
                                      onPressed: isSubmitting
                                          ? null
                                          : () => _applyLocationPreset(preset),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                            const SizedBox(height: 10),

                            // Location description (VARCHAR 200, NOT NULL)
                            TextFormField(
                              controller: _locationController,
                              enabled: !isSubmitting,
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(
                                labelText: 'Location Description *',
                                hintText: 'e.g. Block A, Level 3, end of corridor',
                                prefixIcon: Icon(Icons.location_on_outlined),
                              ),
                              validator: (value) {
                                final text = (value ?? '').trim();
                                if (text.isEmpty) {
                                  return 'Please describe where the issue is located.';
                                }
                                if (text.length > 200) {
                                  return 'Location must not exceed 200 characters.';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 10),

                            // Optional GPS switch + embedded approximate map picker
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              activeThumbColor: AppColors.primary,
                              title: const Text(
                                'Attach Approximate Location (Optional)',
                              ),
                              subtitle: Text(
                                _attachGps
                                    ? 'Pinned: ${_selectedLat.toStringAsFixed(4)}, ${_selectedLng.toStringAsFixed(4)}'
                                    : 'Turn on to pin an approximate area on the map',
                                style: textTheme.bodyMedium,
                              ),
                              value: _attachGps,
                              onChanged: isSubmitting
                                  ? null
                                  : (val) => setState(() => _attachGps = val),
                            ),
                            if (_attachGps) ...[
                              const SizedBox(height: 8),
                              ApproximateLocationMap(
                                latitude: _selectedLat,
                                longitude: _selectedLng,
                                isInteractive: true,
                                onLocationChanged: isSubmitting
                                    ? null
                                    : (lat, lng) {
                                  setState(() {
                                    _selectedLat = lat;
                                    _selectedLng = lng;
                                  });
                                },
                              ),
                            ],
                            const SizedBox(height: 12),

                            // Priority selection
                            Text('Priority', style: textTheme.labelSmall),
                            const SizedBox(height: 8),
                            SegmentedButton<String>(
                              segments: const [
                                ButtonSegment(value: 'low', label: Text('Low')),
                                ButtonSegment(
                                  value: 'normal',
                                  label: Text('Normal'),
                                ),
                                ButtonSegment(
                                  value: 'urgent',
                                  label: Text('Urgent'),
                                ),
                              ],
                              selected: {_selectedPriority},
                              onSelectionChanged: isSubmitting
                                  ? null
                                  : (selection) {
                                setState(() {
                                  _selectedPriority = selection.first;
                                });
                              },
                            ),
                            const SizedBox(height: 16),

                            // Description (Optional - can be left empty)
                            TextFormField(
                              controller: _descriptionController,
                              enabled: !isSubmitting,
                              maxLines: 4,
                              decoration: const InputDecoration(
                                labelText: 'Description (Optional)',
                                hintText:
                                'Add extra details to help maintenance staff locate and fix the problem...',
                                alignLabelWithHint: true,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    PrimaryButton(
                      label: 'Submit Ticket',
                      icon: Icons.send_rounded,
                      isLoading: isSubmitting,
                      onPressed: _submitForm,
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

class _CategoryOption {
  final int id;
  final String code;
  final String name;
  final IconData icon;

  const _CategoryOption({
    required this.id,
    required this.code,
    required this.name,
    required this.icon,
  });
}