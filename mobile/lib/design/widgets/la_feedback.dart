import 'package:flutter/material.dart';

import '../la_tokens.dart';
import 'la_button.dart';
import 'la_flow_symbol.dart';

/// Estado vazio: convite para a próxima ação, sem tom de lamento.
class LaEmptyState extends StatelessWidget {
  const LaEmptyState({super.key, required this.titulo, required this.mensagem, this.acao});

  /// Ex.: "Nada em correção".
  final String titulo;

  /// Ex.: "As OS que voltarem da conferência aparecem aqui."
  final String mensagem;
  final Widget? acao;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LaSpace.xxl, horizontal: LaSpace.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const LaFlowSymbol(kind: LaFlowKind.fila, size: 44, vazio: true),
          const SizedBox(height: LaSpace.item),
          Text(titulo, style: LaType.tituloSecao.copyWith(fontSize: 28)),
          const SizedBox(height: LaSpace.xs),
          Text(mensagem, style: LaType.corpo.copyWith(color: LaColors.regua)),
          if (acao != null) ...[const SizedBox(height: LaSpace.l), acao!],
        ],
      ),
    );
  }
}

/// Erro: diz o que aconteceu e como resolver. Não pede desculpas.
class LaErrorBanner extends StatelessWidget {
  const LaErrorBanner({super.key, required this.titulo, required this.mensagem, this.onTentarDeNovo});

  /// Ex.: "Lote não lançado".
  final String titulo;

  /// Ex.: "Sem conexão com o laboratório. As 4 OS continuam no campo."
  final String mensagem;
  final VoidCallback? onTentarDeNovo;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(LaSpace.secao),
        decoration: BoxDecoration(
          color: LaColors.perigoFundo,
          borderRadius: LaRadius.rBotao,
          border: Border.all(color: LaColors.perigo, width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: LaType.corpoForte.copyWith(fontWeight: FontWeight.w700, color: LaColors.perigo)),
            const SizedBox(height: LaSpace.xs),
            Text(mensagem, style: LaType.corpo),
            if (onTentarDeNovo != null) ...[
              const SizedBox(height: LaSpace.m),
              LaButton(label: 'Tentar de novo', onPressed: onTentarDeNovo, height: LaSize.toque, expand: false),
            ],
          ],
        ),
      ),
    );
  }
}
