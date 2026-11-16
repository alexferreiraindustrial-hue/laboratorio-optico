import 'package:flutter/material.dart';

class LaContent extends StatelessWidget {
  const LaContent({super.key, required this.child, this.maxWidth = 1040});
  final Widget child;
  final double maxWidth;
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: SizedBox(
        width: double.infinity,
        height: double.infinity,
        child: child,
      ),
    ),
  );
}

/// Natural card heights accommodate accessible text sizes.
class LaAdaptiveGrid extends StatelessWidget {
  const LaAdaptiveGrid({
    super.key,
    required this.children,
    this.minWidth = 220,
    this.spacing = 8,
  });
  final List<Widget> children;
  final double minWidth;
  final double spacing;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
      final columns = (box.maxWidth / (minWidth * scale.clamp(1, 1.5)))
          .floor()
          .clamp(1, 4);
      final width = (box.maxWidth - spacing * (columns - 1)) / columns;
      return Wrap(
        spacing: spacing,
        runSpacing: spacing,
        children: [
          for (final child in children) SizedBox(width: width, child: child),
        ],
      );
    },
  );
}
