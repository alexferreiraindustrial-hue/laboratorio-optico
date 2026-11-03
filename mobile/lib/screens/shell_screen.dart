import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../session.dart';
import 'bench_screen.dart';
import 'dashboard_screen.dart';
import 'launch_screen.dart';
import 'lenses_screen.dart';
import 'more_screen.dart';

class ShellScreen extends StatelessWidget {
  const ShellScreen({super.key, required this.session});
  final Session session;

  static const paths = ['/painel', '/lancar', '/bancada', '/lentes', '/mais'];

  int _tabOf(String location) {
    for (var i = 0; i < paths.length; i++) {
      if (location == paths[i]) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final tab = _tabOf(GoRouterState.of(context).matchedLocation);
    return Scaffold(
      backgroundColor: LaColors.piso,
      body: IndexedStack(
        index: tab,
        sizing: StackFit.expand,
        children: [
          DashboardScreen(key: const ValueKey('tab-painel'), session: session),
          const LaunchScreen(key: ValueKey('tab-lancar'), inShell: true),
          BenchScreen(key: const ValueKey('tab-bancada'), session: session),
          LensesScreen(key: const ValueKey('tab-lentes'), session: session),
          MoreScreen(key: const ValueKey('tab-mais'), session: session),
        ],
      ),
      bottomNavigationBar: LaTabBar(
        currentIndex: tab,
        onTap: (index) => context.go(paths[index]),
      ),
    );
  }
}
