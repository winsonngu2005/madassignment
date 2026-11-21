import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/storage/local_database_service.dart';
import 'core/storage/session_storage.dart';
import 'core/theme/app_theme.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/forum_repository.dart';
import 'data/repositories/ticket_repository.dart';
import 'features/auth/auth_bloc.dart';
import 'features/auth/login_screen.dart';
import 'features/dashboard/dashboard_bloc.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/forum/forum_bloc.dart';
import 'core/notifications/local_notification_service.dart';

Future<void> main() async {
  // Ensures native plugins (SharedPreferences, SQLite, Notifications) are ready
  WidgetsFlutterBinding.ensureInitialized();
  await LocalNotificationService.instance.init();
  runApp(const CommunityServiceApp());
}

class CommunityServiceApp extends StatelessWidget {
  const CommunityServiceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final sessionStorage = SessionStorage();
    final localDb = LocalDatabaseService();

    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider(
          create: (_) => AuthRepository(sessionStorage: sessionStorage),
        ),
        RepositoryProvider(
          create: (_) => TicketRepository(localDb: localDb),
        ),
        RepositoryProvider(create: (_) => ForumRepository()),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (context) => AuthBloc(
              authRepository: context.read<AuthRepository>(),
            )..add(const AuthCheckRequested()),
          ),
          BlocProvider(
            create: (context) => DashboardBloc(
              ticketRepository: context.read<TicketRepository>(),
            ),
          ),
          BlocProvider(
            create: (context) => ForumBloc(
              forumRepository: context.read<ForumRepository>(),
            ),
          ),
        ],
        child: MaterialApp(
          title: 'Community Service Tracking',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          home: BlocBuilder<AuthBloc, AuthState>(
            builder: (context, state) {
              // Brief splash while checking saved local session
              if (state is AuthInitial) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              if (state is AuthAuthenticated) {
                return DashboardScreen(user: state.user);
              }
              return const LoginScreen();
            },
          ),
        ),
      ),
    );
  }
}