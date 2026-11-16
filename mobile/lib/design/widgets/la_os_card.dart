import 'package:flutter/material.dart';

import '../la_tokens.dart';
import 'la_badges.dart';
import 'la_button.dart';

/// Cartão de OS da Bancada.
/// A ação diz para onde a OS vai: "Mover para Em montagem".
class LaOsCard extends StatelessWidget {
  const LaOsCard({
    super.key,
    required this.numero,
    required this.cliente,
    required this.detalhe,
    required this.acaoLabel,
    required this.onAcao,
    required this.onAbrir,
    this.urgente = false,
    this.emCorrecao = false,
    this.acaoFinal = false,
    this.carregando = false,
  });

  final String numero;
  final String cliente;

  /// Ex.: "Loja 01, Carla".
  final String detalhe;
  final String acaoLabel;

  /// null = sem permissão para mover (papel Consulta): botão não aparece.
  final VoidCallback? onAcao;
  final VoidCallback onAbrir;
  final bool urgente;
  final bool emCorrecao;

  /// true quando a próxima etapa é Pronto: ação principal em destaque.
  final bool acaoFinal;
  final bool carregando;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: const BoxDecoration(
        color: LaColors.branco,
        borderRadius: LaRadius.rCartao,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            label:
                'OS $numero, $cliente${urgente ? ', urgente' : ''}${emCorrecao ? ', em correção' : ''}',
            onTap: onAbrir,
            excludeSemantics: true,
            child: InkWell(
              onTap: onAbrir,
              borderRadius: LaRadius.rBotao,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: LaSize.toque),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(numero, style: LaType.numeroCartao),
                        if (urgente) LaBadge.urgente(),
                        if (emCorrecao) LaBadge.emCorrecao(),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(cliente, style: LaType.corpoForte),
                    const SizedBox(height: 4),
                    Text(detalhe, style: LaType.apoio),
                  ],
                ),
              ),
            ),
          ),
          if (onAcao != null) ...[
            const SizedBox(height: LaSpace.m),
            LaButton(
              label: acaoLabel,
              height: LaSize.toque,
              variant: acaoFinal
                  ? LaButtonVariant.principal
                  : LaButtonVariant.escuro,
              loading: carregando,
              onPressed: onAcao,
            ),
          ],
        ],
      ),
    );
  }
}
