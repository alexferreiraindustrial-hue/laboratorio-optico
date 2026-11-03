import 'package:flutter/material.dart';

import 'design/la_tokens.dart';
import 'theme.dart';

class LensField extends StatelessWidget {
  const LensField({
    super.key,
    this.child,
    this.intensity = 1,
    this.dark = false,
  });
  final Widget? child;
  final double intensity;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: LaColors.piso,
      child: child ?? const SizedBox.expand(),
    );
  }
}

class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpace.lg),
  });
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: LaColors.branco,
        borderRadius: LaRadius.rCartao,
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}
