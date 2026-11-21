import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Chips de condição da OS.
class LaBadge extends StatelessWidget {
  const LaBadge._(this.texto, this.fundo, this.cor, this.borda);

  factory LaBadge.urgente() =>
      const LaBadge._('Urgente', LaColors.perigo, LaColors.branco, null);

  factory LaBadge.emCorrecao() => const LaBadge._(
    'Em correção',
    LaColors.alertaFundo,
    LaColors.alerta,
    LaColors.alertaBorda,
  );

  final String texto;
  final Color fundo;
  final Color cor;
  final Color? borda;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: texto == "Urgente" ? fundo : LaColors.adapt(context, fundo),
        borderRadius: LaRadius.rChip,
        border: borda == null ? null : Border.all(color: LaColors.adapt(context, borda!), width: 1.5),
      ),
      child: Text(
        texto,
        style: LaType.rotulo.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: LaColors.adapt(context, cor),
        ),
      ),
    );
  }
}

enum LaPrazo { atrasada, proximo, noPrazo }

/// Prazo com ponto colorido + texto. Nunca só cor.
class LaPrazoTag extends StatelessWidget {
  const LaPrazoTag({
    super.key,
    required this.status,
    required this.texto,
    this.tamanho = 13,
  });

  final LaPrazo status;

  /// Ex.: "Venceu 01/11", "Vence 04/11", "10/11".
  final String texto;
  final double tamanho;

  static (Color ponto, Color texto) cores(LaPrazo s) => switch (s) {
    LaPrazo.atrasada => (LaColors.pontoAtrasada, LaColors.perigo),
    LaPrazo.proximo => (LaColors.pontoProximo, LaColors.alerta),
    LaPrazo.noPrazo => (LaColors.pontoNoPrazo, LaColors.noPrazo),
  };

  @override
  Widget build(BuildContext context) {
    final (ponto, cor) = cores(status);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: ponto, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            texto,
            style: LaType.rotulo.copyWith(
              fontSize: tamanho,
              fontWeight: FontWeight.w700,
              color: LaColors.adapt(context, cor),
            ),
          ),
        ),
      ],
    );
  }
}
