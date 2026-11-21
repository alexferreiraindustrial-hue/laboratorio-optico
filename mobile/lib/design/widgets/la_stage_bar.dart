import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Etapas na ordem do fluxo. Índice + 1 = número da etapa.
const laEtapas = <String>[
  'Aguardando lentes',
  'Aguardando montagem',
  'Em montagem',
  'Em correção',
  'Em conferência',
  'Pronto',
];

/// Barra de 6 segmentos: anteriores grafite, atual amarela, futuras cinza.
class LaStageBar extends StatelessWidget {
  const LaStageBar({super.key, required this.etapaAtual, this.encerrada = false, this.altura = 8});

  /// 1 a 6.
  final int etapaAtual;
  final bool encerrada;
  final double altura;

  @override
  Widget build(BuildContext context) {
    final nome = encerrada ? 'Encerrada' : laEtapas[(etapaAtual - 1).clamp(0, 5)];
    return Semantics(
      label: encerrada ? 'OS encerrada' : 'Etapa $etapaAtual de 6, $nome',
      excludeSemantics: true,
      child: Row(
        children: [
          for (var i = 1; i <= 6; i++) ...[
            if (i > 1) SizedBox(width: 3),
            Expanded(
              child: Container(
                height: altura,
                decoration: BoxDecoration(
                  color: encerrada || i < etapaAtual
                      ? LaColors.adapt(context, LaColors.grafite)
                      : i == etapaAtual
                          ? LaColors.adapt(context, LaColors.faixa)
                          : LaColors.adapt(context, LaColors.filete),
                  borderRadius: BorderRadius.circular(2),
                  border: !encerrada && i == etapaAtual && altura >= 8 ? Border.all(color: LaColors.adapt(context, LaColors.grafite), width: 2) : null,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
