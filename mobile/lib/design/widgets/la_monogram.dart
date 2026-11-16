import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Monograma "LA" em placa amarela.
class LaMonogram extends StatelessWidget {
  const LaMonogram({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'ÓticaHub Lab',
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: LaColors.faixa,
          borderRadius: BorderRadius.circular(size * 0.25),
        ),
        child: Icon(
          Icons.blur_circular,
          color: LaColors.branco,
          size: size * 0.62,
        ),
      ),
    );
  }
}
