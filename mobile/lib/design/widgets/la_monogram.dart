import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Monograma "LA" em placa amarela.
class LaMonogram extends StatelessWidget {
  const LaMonogram({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Laboratório ALEX',
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: LaColors.faixa,
          borderRadius: BorderRadius.circular(size * 0.25),
        ),
        child: Text('LA', style: LaType.numeroLista.copyWith(fontSize: size * 0.5, letterSpacing: -0.5)),
      ),
    );
  }
}
