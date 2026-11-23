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
    this.prazo = "Sem prazo",
    this.dueAt,
    this.medical = false,
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
  final String prazo;
  final String? dueAt;
  final bool medical;
  final bool urgente;
  final bool emCorrecao;

  /// true quando a próxima etapa é Pronto: ação principal em destaque.
  final bool acaoFinal;
  final bool carregando;

  @override
  Widget build(BuildContext context) {
    final due = DateTime.tryParse(dueAt ?? '');
    final hours = due?.difference(DateTime.now()).inMinutes;
    final color = hours != null && hours < 0
        ? LaColors.adapt(context, LaColors.perigo)
        : urgente || (hours != null && hours <= 240)
        ? LaColors.adapt(context, LaColors.perigo)
        : hours != null && hours <= 1440
        ? LaColors.adapt(context, LaColors.alerta)
        : Theme.of(context).colorScheme.outline;
    return Container(
      decoration: BoxDecoration(
        color: LaColors.surface(context),
        borderRadius: LaRadius.rCartao,
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: ExpansionTile(
        key: PageStorageKey('bench-$numero'),
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        shape: const Border(),
        collapsedShape: const Border(),
        title: Text(
          cliente,
          style: LaType.corpoForte,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OS $numero',
              style: LaType.apoio.copyWith(fontFamily: 'JetBrainsMono'),
            ),
            Text(
              prazo,
              style: LaType.rotulo.copyWith(
                color: hours != null && hours <= 1440 || urgente
                    ? color
                    : LaColors.adapt(context, LaColors.regua),
              ),
            ),
            if (medical)
              Text(
                'Precisa de conferência médica',
                style: LaType.rotulo.copyWith(
                  color: LaColors.adapt(context, LaColors.alerta),
                ),
              ),
            if (urgente) LaBadge.urgente(),
            if (emCorrecao) LaBadge.emCorrecao(),
          ],
        ),
        children: [
          Text(detalhe, style: LaType.apoio),
          const SizedBox(height: 10),
          if (onAcao != null)
            LaButton(
              label: acaoLabel,
              height: LaSize.toque,
              variant: acaoFinal
                  ? LaButtonVariant.principal
                  : LaButtonVariant.escuro,
              loading: carregando,
              onPressed: onAcao,
            ),
          TextButton.icon(
            onPressed: onAbrir,
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text('Processos, fotos e histórico'),
          ),
        ],
      ),
    );
  }
}
