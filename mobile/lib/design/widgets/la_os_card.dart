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

  /// true quando a próxima etapa é Pronto: botão amarelo.
  final bool acaoFinal;
  final bool carregando;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: const BoxDecoration(color: LaColors.branco, borderRadius: LaRadius.rCartao),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            label: 'OS $numero, $cliente${urgente ? ', urgente' : ''}${emCorrecao ? ', em correção' : ''}',
            onTap: onAbrir,
            excludeSemantics: true,
            child: InkWell(
              onTap: onAbrir,
              borderRadius: LaRadius.rBotao,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: LaSize.toque),
                child: Row(
                  children: [
                    Text(numero, style: LaType.numeroCartao),
                    const SizedBox(width: LaSpace.m),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(cliente, style: LaType.corpo.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text(detalhe, style: LaType.apoio, maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    if (urgente) LaBadge.urgente(),
                    if (emCorrecao) ...[const SizedBox(width: 6), LaBadge.emCorrecao()],
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
              variant: acaoFinal ? LaButtonVariant.principal : LaButtonVariant.escuro,
              loading: carregando,
              onPressed: onAcao,
            ),
          ],
        ],
      ),
    );
  }
}
