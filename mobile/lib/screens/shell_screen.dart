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
    final wide = MediaQuery.sizeOf(context).width >= 720;
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Scaffold(
      backgroundColor: LaColors.piso,
      body: Row(
        children: [
          if (wide)
            SafeArea(
              child: NavigationRail(
                scrollable: true,
                selectedIndex: tab,
                onDestinationSelected: (index) => context.go(paths[index]),
                labelType: NavigationRailLabelType.all,
                backgroundColor: LaColors.branco,
                indicatorColor: LaColors.acentoSuave,
                leading: const Padding(
                  padding: EdgeInsets.all(12),
                  child: LaMonogram(),
                ),
                destinations: const [
                  NavigationRailDestination(
                    icon: Icon(Icons.dashboard_outlined),
                    label: Text('Hoje'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.add_circle_outline),
                    label: Text('Lançar'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.handyman_outlined),
                    label: Text('Bancada'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.inventory_2_outlined),
                    label: Text('Lentes'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.more_horiz),
                    label: Text('Mais'),
                  ),
                ],
              ),
            ),
          Expanded(
            key: const ValueKey('conteudo-operacional'),
            child: LaContent(
              child: IndexedStack(
                index: tab,
                sizing: StackFit.expand,
                children: [
                  DashboardScreen(
                    key: const ValueKey('tab-painel'),
                    session: session,
                  ),
                  const LaunchScreen(
                    key: ValueKey('tab-lancar'),
                    inShell: true,
                  ),
                  BenchScreen(
                    key: const ValueKey('tab-bancada'),
                    session: session,
                  ),
                  LensesScreen(
                    key: const ValueKey('tab-lentes'),
                    session: session,
                  ),
                  MoreScreen(key: const ValueKey('tab-mais'), session: session),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: wide || keyboardOpen
          ? null
          : LaTabBar(
              currentIndex: tab,
              onTap: (index) => context.go(paths[index]),
            ),
    );
  }
}
