import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import 'screens/assistencia_screen.dart';
import 'screens/delivery_screen.dart';
import 'screens/kaizen_screen.dart';
import 'screens/login_screen.dart';
import 'screens/messages_screen.dart';
import 'screens/order_detail_screen.dart';
import 'screens/order_form_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/parties_screen.dart';
import 'screens/party_edit_screen.dart';
import 'screens/ranking_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/routine_screen.dart';
import 'screens/five_s_screen.dart';
import 'screens/indicators_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/shell_screen.dart';
import 'screens/stock_create_screen.dart';
import 'screens/stock_detail_screen.dart';
import 'screens/portal_screen.dart';
import 'screens/stock_screen.dart';
import 'domain.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets.dart';

final _rootKey = GlobalKey<NavigatorState>();

GoRouter createRouter(Session session) {
  return GoRouter(
    navigatorKey: _rootKey,
    refreshListenable: session,
    initialLocation: '/painel',
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final loggingIn = loc == '/login';
      final onPortal = loc == '/portal' || loc.startsWith('/portal/');
      if (!session.isSignedIn && !loggingIn) return '/login';
      if (session.isPortal) {
        if (loggingIn || loc == '/' || loc.isEmpty || loc == '/painel')
          return '/portal';
        if (!onPortal && loc != '/login') return '/portal';
        return null;
      }
      if (session.isLab && loggingIn) return '/painel';
      if (session.isLab && onPortal) return '/painel';
      if (session.isLab &&
          (state.uri.path.isEmpty || loc == '/' || loc.isEmpty))
        return '/painel';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => LoginScreen(session: session),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/portal',
        builder: (context, state) => PortalHomeScreen(session: session),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/portal/os/:id',
        builder: (context, state) => PortalOrderScreen(
          id: state.pathParameters['id']!,
          session: session,
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => ShellScreen(session: session),
        routes: [
          GoRoute(
            path: '/painel',
            builder: (context, state) => const SizedBox.shrink(),
          ),
          GoRoute(
            path: '/lancar',
            builder: (context, state) => const SizedBox.shrink(),
          ),
          GoRoute(
            path: '/bancada',
            builder: (context, state) => const SizedBox.shrink(),
          ),
          GoRoute(
            path: '/lentes',
            builder: (context, state) => const SizedBox.shrink(),
          ),
          GoRoute(
            path: '/mais',
            builder: (context, state) => const SizedBox.shrink(),
          ),
        ],
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/fila/:status',
        builder: (context, state) {
          final status = state.pathParameters['status'] ?? '';
          return OrdersScreen(
            key: ValueKey(status),
            status: queueStatuses.contains(status)
                ? status
                : 'aguardando_lentes',
          );
        },
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/estoque',
        builder: (context, state) => PushedScaffold(
          title: 'Estoque',
          child: StockScreen(session: session),
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/entrega',
        builder: (context, state) => PushedScaffold(
          title: 'Entrega',
          child: DeliveryScreen(session: session),
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/os',
        builder: (context, state) => OrdersScreen(
          key: ValueKey(state.uri.query),
          status: queueStatuses.contains(state.uri.queryParameters['status'])
              ? state.uri.queryParameters['status']
              : null,
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/os/nova',
        builder: (context, state) => const OrderFormScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/os/:id',
        builder: (context, state) => OrderDetailScreen(
          id: state.pathParameters['id']!,
          session: session,
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/os/:id/editar',
        builder: (context, state) =>
            OrderFormScreen(id: state.pathParameters['id']),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/estoque/nova',
        builder: (context, state) => StockCreateScreen(
          sphere: state.uri.queryParameters['esf'],
          cylinder: state.uri.queryParameters['cil'],
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/estoque/:id',
        builder: (context, state) => StockDetailScreen(
          id: state.pathParameters['id']!,
          session: session,
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/assistencia',
        builder: (context, state) => AssistenciaScreen(session: session),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/lojas',
        builder: (context, state) =>
            PartiesScreen(kind: 'lojas', session: session),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/lojas/nova',
        builder: (context, state) => const PartyEditScreen(kind: 'lojas'),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/lojas/:id',
        builder: (context, state) =>
            PartyEditScreen(kind: 'lojas', id: state.pathParameters['id']),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/vendedores',
        builder: (context, state) =>
            PartiesScreen(kind: 'vendedores', session: session),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/vendedores/nova',
        builder: (context, state) => const PartyEditScreen(kind: 'vendedores'),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/vendedores/:id',
        builder: (context, state) =>
            PartyEditScreen(kind: 'vendedores', id: state.pathParameters['id']),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/recados',
        builder: (context, state) => const MessagesScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/rotina',
        builder: (context, state) => RoutineScreen(session: session),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/ranking',
        builder: (context, state) => const RankingScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/kaizen',
        builder: (context, state) => const KaizenScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/relatorios',
        builder: (context, state) => const ReportsScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/indicadores',
        builder: (context, state) => const IndicatorsScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/auditoria-5s',
        builder: (context, state) => const FiveSScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/configuracoes',
        builder: (context, state) => SettingsScreen(session: session),
      ),
    ],
  );
}

class LabApp extends StatefulWidget {
  const LabApp({super.key, required this.session});
  final Session session;

  @override
  State<LabApp> createState() => _LabAppState();
}

class _LabAppState extends State<LabApp> {
  late final GoRouter router = createRouter(widget.session);

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'ÓticaHub Lab',
      theme: labTheme(),
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
