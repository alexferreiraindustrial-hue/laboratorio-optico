import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../session.dart';
import '../production_scope.dart';
import 'bench_screen.dart';
import 'dashboard_screen.dart';
import 'launch_screen.dart';
import 'lenses_screen.dart';
import 'more_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key, required this.session});
  final Session session;
  static const paths = ['/painel', '/lancar', '/bancada', '/lentes', '/mais'];
  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  final scope = ProductionScope();
  static const paths = ShellScreen.paths;
  @override
  void dispose() {
    scope.dispose();
    super.dispose();
  }

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
      backgroundColor: LaColors.adapt(context, LaColors.piso),
      body: Row(
        children: [
          if (wide)
            SafeArea(
              child: NavigationRail(
                scrollable: true,
                selectedIndex: tab,
                onDestinationSelected: (index) => context.go(paths[index]),
                labelType: NavigationRailLabelType.all,
                backgroundColor: LaColors.surface(context),
                indicatorColor: LaColors.adapt(context, LaColors.acentoSuave),
                leading: Padding(
                  padding: EdgeInsets.all(12),
                  child: LaMonogram(),
                ),
                destinations: [
                  NavigationRailDestination(
                    icon: Icon(Icons.dashboard_outlined),
                    label: Text('Visão geral'),
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
            key: ValueKey('conteudo-operacional'),
            child: LaContent(
              child: IndexedStack(
                index: tab,
                sizing: StackFit.expand,
                children: [
                  DashboardScreen(
                    key: ValueKey('tab-painel'),
                    scope: scope,
                    active: tab == 0,
                    session: widget.session,
                  ),
                  LaunchScreen(key: ValueKey('tab-lancar'), inShell: true),
                  BenchScreen(
                    key: ValueKey('tab-bancada'),
                    scope: scope,
                    active: tab == 2,
                    session: widget.session,
                  ),
                  LensesScreen(
                    key: ValueKey('tab-lentes'),
                    scope: scope,
                    active: tab == 3,
                    session: widget.session,
                  ),
                  MoreScreen(
                    key: ValueKey('tab-mais'),
                    session: widget.session,
                  ),
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
