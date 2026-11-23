import 'package:flutter/material.dart';


/// Monograma "LA" em placa amarela.
class LaMonogram extends StatelessWidget {
  const LaMonogram({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Lab Gold',
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary,
          borderRadius: BorderRadius.circular(size * 0.25),
        ),
        child: Icon(
          Icons.blur_circular,
          color: Theme.of(context).colorScheme.onPrimary,
          size: size * 0.62,
        ),
      ),
    );
  }
}
