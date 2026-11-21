import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/primary_button.dart';
import '../../data/models/user_model.dart';
import '../auth/auth_bloc.dart';
import 'notification_settings_screen.dart';

/// Tab 5: Resident profile screen with Edit Profile and Change Password flows.
class ProfileScreen extends StatelessWidget {
  final UserModel user;
  final VoidCallback onSignOut;

  const ProfileScreen({
    super.key,
    required this.user,
    required this.onSignOut,
  });

  void _openEditProfile(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _EditProfileScreen(user: user),
      ),
    );
  }

  void _openChangePassword(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const _ChangePasswordScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final initial =
    user.name.trim().isNotEmpty ? user.name.trim()[0].toUpperCase() : 'R';
    final hasPhone = user.phone != null && user.phone!.trim().isNotEmpty;

    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (previous, current) {
        if (current is! AuthAuthenticated) return false;
        if (current.feedbackMessage == null) return false;
        if (previous is AuthAuthenticated) {
          return previous.feedbackTick != current.feedbackTick;
        }
        return true;
      },
      listener: (context, state) {
        if (state is! AuthAuthenticated || state.feedbackMessage == null) {
          return;
        }
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(state.feedbackMessage!),
              backgroundColor:
              state.isErrorFeedback ? AppColors.error : AppColors.success,
            ),
          );
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Profile')),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              // Bottom padding avoids overlap with the floating pill bar
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 110),
              children: [
                // 1. User Summary Card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 30,
                          backgroundColor: AppColors.primaryLight,
                          child: Text(
                            initial,
                            style: textTheme.headlineMedium?.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(user.name, style: textTheme.titleLarge),
                              const SizedBox(height: 4),
                              Text(user.email, style: textTheme.bodyMedium),
                              const SizedBox(height: 2),
                              Text(
                                hasPhone ? user.phone! : 'No phone number added',
                                style: textTheme.bodyMedium?.copyWith(
                                  color: hasPhone
                                      ? AppColors.textSecondary
                                      : AppColors.textHint,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Account Settings Card
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.edit_outlined),
                        title: const Text('Edit Profile'),
                        subtitle: const Text('Update your display name and phone'),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => _openEditProfile(context),
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      ListTile(
                        leading: const Icon(Icons.lock_outline_rounded),
                        title: const Text('Change Password'),
                        subtitle: const Text('Update your account password'),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => _openChangePassword(context),
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      ListTile(
                        leading: const Icon(Icons.badge_outlined),
                        title: const Text('Account Role'),
                        trailing: Text(
                          user.role.toUpperCase(),
                          style: textTheme.labelSmall?.copyWith(
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      ListTile(
                        leading: const Icon(Icons.notifications_outlined),
                        title: const Text('Notification Settings'),
                        subtitle: const Text('Manage device alert preferences'),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                              const NotificationSettingsScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 3. Sign Out Button
                PrimaryButton(
                  label: 'Sign Out',
                  icon: Icons.logout_rounded,
                  onPressed: onSignOut,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// Edit Profile Screen (Name & Phone; Email is read-only)
// ============================================================================
class _EditProfileScreen extends StatefulWidget {
  final UserModel user;

  const _EditProfileScreen({required this.user});

  @override
  State<_EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<_EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.user.name);
    _phoneController = TextEditingController(text: widget.user.phone ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    context.read<AuthBloc>().add(
      AuthProfileUpdateRequested(
        name: _nameController.text,
        phone: _phoneController.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (previous, current) {
        if (current is! AuthAuthenticated) return false;
        if (current.feedbackMessage == null || current.isErrorFeedback) {
          return false;
        }
        if (previous is AuthAuthenticated) {
          return previous.feedbackTick != current.feedbackTick;
        }
        return false;
      },
      listener: (context, state) {
        // Close screen automatically once profile update succeeds
        Navigator.of(context).pop();
      },
      builder: (context, state) {
        final isUpdating = state is AuthAuthenticated && state.isUpdating;

        return Scaffold(
          appBar: AppBar(title: const Text('Edit Profile')),
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Personal Information',
                              style: textTheme.titleMedium,
                            ),
                            const SizedBox(height: 16),

                            // Read-only email field (unique login ID)
                            TextFormField(
                              initialValue: widget.user.email,
                              enabled: false,
                              decoration: const InputDecoration(
                                labelText: 'Email Address (Cannot be changed)',
                                prefixIcon: Icon(Icons.email_outlined),
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Editable full name (required)
                            TextFormField(
                              controller: _nameController,
                              enabled: !isUpdating,
                              textInputAction: TextInputAction.next,
                              maxLength: 80,
                              decoration: const InputDecoration(
                                labelText: 'Full Name *',
                                hintText: 'Enter your full name',
                                prefixIcon: Icon(Icons.person_outline_rounded),
                              ),
                              validator: (value) {
                                final text = (value ?? '').trim();
                                if (text.isEmpty) {
                                  return 'Please enter your name.';
                                }
                                if (text.length < 2) {
                                  return 'Name must be at least 2 characters.';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),

                            // Editable phone number (optional)
                            TextFormField(
                              controller: _phoneController,
                              enabled: !isUpdating,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.done,
                              maxLength: 20,
                              decoration: const InputDecoration(
                                labelText: 'Phone Number (Optional)',
                                hintText: 'e.g. +60123456789',
                                prefixIcon: Icon(Icons.phone_outlined),
                              ),
                              validator: (value) {
                                final text = (value ?? '').trim();
                                if (text.isEmpty) return null;
                                if (text.length < 8) {
                                  return 'Please enter a valid phone number.';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    PrimaryButton(
                      label: 'Save Changes',
                      icon: Icons.check_rounded,
                      isLoading: isUpdating,
                      onPressed: _save,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ============================================================================
// Change Password Screen (Verifies Current Password & Confirms New Password)
// ============================================================================
class _ChangePasswordScreen extends StatefulWidget {
  const _ChangePasswordScreen();

  @override
  State<_ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<_ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    context.read<AuthBloc>().add(
      AuthPasswordChangeRequested(
        currentPassword: _currentPasswordController.text,
        newPassword: _newPasswordController.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (previous, current) {
        if (current is! AuthAuthenticated) return false;
        if (current.feedbackMessage == null || current.isErrorFeedback) {
          return false;
        }
        if (previous is AuthAuthenticated) {
          return previous.feedbackTick != current.feedbackTick;
        }
        return false;
      },
      listener: (context, state) {
        // Close screen only when password change succeeds; stay open on error
        Navigator.of(context).pop();
      },
      builder: (context, state) {
        final isUpdating = state is AuthAuthenticated && state.isUpdating;

        return Scaffold(
          appBar: AppBar(title: const Text('Change Password')),
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Security Credentials',
                              style: textTheme.titleMedium,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Enter your current password to verify your identity before setting a new one.',
                              style: textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 16),

                            // Current Password
                            TextFormField(
                              controller: _currentPasswordController,
                              enabled: !isUpdating,
                              obscureText: _obscureCurrent,
                              textInputAction: TextInputAction.next,
                              decoration: InputDecoration(
                                labelText: 'Current Password *',
                                prefixIcon:
                                const Icon(Icons.lock_outline_rounded),
                                suffixIcon: IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _obscureCurrent = !_obscureCurrent;
                                    });
                                  },
                                  icon: Icon(
                                    _obscureCurrent
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (value) {
                                if ((value ?? '').isEmpty) {
                                  return 'Please enter your current password.';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // New Password
                            TextFormField(
                              controller: _newPasswordController,
                              enabled: !isUpdating,
                              obscureText: _obscureNew,
                              textInputAction: TextInputAction.next,
                              decoration: InputDecoration(
                                labelText: 'New Password *',
                                hintText: 'At least 6 characters',
                                prefixIcon: const Icon(Icons.vpn_key_outlined),
                                suffixIcon: IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _obscureNew = !_obscureNew;
                                    });
                                  },
                                  icon: Icon(
                                    _obscureNew
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (value) {
                                final text = value ?? '';
                                if (text.isEmpty) {
                                  return 'Please enter a new password.';
                                }
                                if (text.length < 6) {
                                  return 'Password must be at least 6 characters.';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // Confirm New Password
                            TextFormField(
                              controller: _confirmPasswordController,
                              enabled: !isUpdating,
                              obscureText: _obscureConfirm,
                              textInputAction: TextInputAction.done,
                              decoration: InputDecoration(
                                labelText: 'Confirm New Password *',
                                prefixIcon:
                                const Icon(Icons.check_circle_outline),
                                suffixIcon: IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _obscureConfirm = !_obscureConfirm;
                                    });
                                  },
                                  icon: Icon(
                                    _obscureConfirm
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (value) {
                                if ((value ?? '').isEmpty) {
                                  return 'Please confirm your new password.';
                                }
                                if (value != _newPasswordController.text) {
                                  return 'New passwords do not match.';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    PrimaryButton(
                      label: 'Update Password',
                      icon: Icons.security_rounded,
                      isLoading: isUpdating,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}