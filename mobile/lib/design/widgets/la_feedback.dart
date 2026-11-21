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
      padding: EdgeInsets.symmetric(vertical: LaSpace.xxl, horizontal: LaSpace.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          LaFlowSymbol(kind: LaFlowKind.fila, size: 44, vazio: true),
          SizedBox(height: LaSpace.item),
          Text(titulo, style: LaType.tituloSecao.copyWith(fontSize: 28)),
          SizedBox(height: LaSpace.xs),
          Text(mensagem, style: LaType.corpo.copyWith(color: LaColors.adapt(context, LaColors.regua))),
          if (acao != null) ...[SizedBox(height: LaSpace.l), acao!],
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
        padding: EdgeInsets.all(LaSpace.secao),
        decoration: BoxDecoration(
          color: LaColors.adapt(context, LaColors.perigoFundo),
          borderRadius: LaRadius.rBotao,
          border: Border.all(color: LaColors.adapt(context, LaColors.perigo), width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: LaType.corpoForte.copyWith(fontWeight: FontWeight.w700, color: LaColors.adapt(context, LaColors.perigo))),
            SizedBox(height: LaSpace.xs),
            Text(mensagem, style: LaType.corpo),
            if (onTentarDeNovo != null) ...[
              SizedBox(height: LaSpace.m),
              LaButton(label: 'Tentar de novo', onPressed: onTentarDeNovo, height: LaSize.toque, expand: false),
            ],
          ],
        ),
      ),
    );
  }
}
