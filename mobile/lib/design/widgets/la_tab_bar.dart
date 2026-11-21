import 'package:flutter/material.dart';

import '../la_tokens.dart';

class LaTabBar extends StatelessWidget {
  const LaTabBar({super.key, required this.currentIndex, required this.onTap});
  final int currentIndex;
  final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: LaColors.adapt(context, LaColors.filete))),
    ),
    child: NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      height:
          72 + (MediaQuery.textScalerOf(context).scale(12) - 12).clamp(0, 20),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      destinations: [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard, color: LaColors.adapt(context, LaColors.acento)),
          label: 'Hoje',
        ),
        NavigationDestination(
          icon: Icon(Icons.add_circle_outline),
          selectedIcon: Icon(Icons.add_circle, color: LaColors.adapt(context, LaColors.acento)),
          label: 'Lançar',
        ),
        NavigationDestination(
          icon: Icon(Icons.handyman_outlined),
          selectedIcon: Icon(Icons.handyman, color: LaColors.adapt(context, LaColors.acento)),
          label: 'Bancada',
        ),
        NavigationDestination(
          icon: Icon(Icons.inventory_2_outlined),
          selectedIcon: Icon(Icons.inventory_2, color: LaColors.adapt(context, LaColors.acento)),
          label: 'Lentes',
        ),
        NavigationDestination(icon: Icon(Icons.more_horiz), label: 'Mais'),
      ],
    ),
  );
}
