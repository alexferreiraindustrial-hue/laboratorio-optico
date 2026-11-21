import 'package:flutter/material.dart';

import '../la_tokens.dart';
import 'la_flow_symbol.dart';

class LaFlowStep {
  const LaFlowStep({
    required this.rotulo,
    required this.subtitulo,
    required this.contagem,
    required this.kind,
    required this.onTap,
  });

  final String rotulo;
  final String subtitulo;
  final int contagem;
  final LaFlowKind kind;
  final VoidCallback onTap;
}

/// Fluxo do laboratório no Painel: símbolos VSM ligados por uma faixa amarela.
class LaFlowList extends StatelessWidget {
  const LaFlowList({super.key, required this.steps});

  final List<LaFlowStep> steps;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(8, 6, 14, 6),
      decoration: BoxDecoration(
        color: LaColors.surface(context),
        borderRadius: LaRadius.rCartao,
      ),
      child: Stack(
        children: [
          // Trilho amarelo atrás dos símbolos (centro da coluna de 44 px).
          Positioned(
            left: 20,
            top: LaSize.linhaFluxo / 2,
            bottom: LaSize.linhaFluxo / 2,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: LaColors.adapt(context, LaColors.faixa),
                borderRadius: BorderRadius.all(Radius.circular(2)),
              ),
              child: SizedBox(width: 4),
            ),
          ),
          Column(children: [for (final s in steps) _Linha(step: s)]),
        ],
      ),
    );
  }
}

class _Linha extends StatelessWidget {
  const _Linha({required this.step});

  final LaFlowStep step;

  @override
  Widget build(BuildContext context) {
    final retrabalho = step.kind == LaFlowKind.retrabalho;
    final destaque = retrabalho ? LaColors.adapt(context, LaColors.alerta) : LaColors.adapt(context, LaColors.grafite);
    final numero = step.contagem > 999 ? '999+' : '${step.contagem}';
    final corNumero = step.contagem == 0 ? LaColors.adapt(context, LaColors.regua) : destaque;

    return Semantics(
      button: true,
      label: '${step.rotulo}, ${step.subtitulo.toLowerCase()}, $numero OS',
      onTap: step.onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: step.onTap,
        borderRadius: LaRadius.rBotao,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: 72),
          child: Row(
            children: [
              SizedBox(
                width: 44,
                child: Center(child: LaFlowSymbol(kind: step.kind)),
              ),
              SizedBox(width: LaSpace.m),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(step.rotulo, style: LaType.corpoForte),
                    Text(
                      step.subtitulo,
                      style: LaType.apoio.copyWith(
                        color: retrabalho ? LaColors.adapt(context, LaColors.alerta) : LaColors.adapt(context, LaColors.regua),
                        fontWeight: retrabalho
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              Text(numero, style: LaType.contagem.copyWith(color: corNumero)),
              SizedBox(width: LaSpace.m),
              Icon(Icons.chevron_right, size: 18, color: LaColors.adapt(context, LaColors.regua)),
            ],
          ),
        ),
      ),
    );
  }
}
