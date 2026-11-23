import 'package:flutter/material.dart';

import '../la_tokens.dart';

class LaTabBar extends StatelessWidget {
  const LaTabBar({super.key, required this.currentIndex, required this.onTap});
  final int currentIndex;
  final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: LaColors.adapt(context, LaColors.filete)),
          borderRadius: BorderRadius.circular(22),
        ),
        child: NavigationBar(
          selectedIndex: currentIndex,
          onDestinationSelected: onTap,
          height:
              72 +
              (MediaQuery.textScalerOf(context).scale(12) - 12).clamp(0, 20),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(
                Icons.dashboard,
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF1A1205)
                    : LaColors.acento,
              ),
              label: 'Visão geral',
            ),
            NavigationDestination(
              icon: Icon(Icons.add_circle_outline),
              selectedIcon: Icon(
                Icons.add_circle,
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF1A1205)
                    : LaColors.acento,
              ),
              label: 'Lançar',
            ),
            NavigationDestination(
              icon: Icon(Icons.handyman_outlined),
              selectedIcon: Icon(
                Icons.handyman,
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF1A1205)
                    : LaColors.acento,
              ),
              label: 'Bancada',
            ),
            NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(
                Icons.inventory_2,
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF1A1205)
                    : LaColors.acento,
              ),
              label: 'Lentes',
            ),
            NavigationDestination(icon: Icon(Icons.more_horiz), label: 'Mais'),
          ],
        ),
      ),
    ),
  );
}
